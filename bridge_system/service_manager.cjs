'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { McpStdioClient } = require('./mcp_client.cjs');

const PLUGIN_PORT = Number.parseInt(process.env.CAPCUT_PLUGIN_PORT || '8765', 10);
const MCP_RESTART_LIMIT = 2;
const PLUGIN_RESTART_LIMIT = 2;
const PLUGIN_START_TIMEOUT_MS = 12000;

function redact(value) {
  return String(value || '')
    .replace(/AIza[\w-]{20,}/g, '[redacted key]')
    .replace(/Bearer\s+[\w.\-]+/gi, 'Bearer [redacted]')
    .replace(/(api[_-]?key\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]')
    .slice(0, 1600);
}

function requestJson(url, timeoutMs = 1200) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const http = require(target.protocol === 'https:' ? 'node:https' : 'node:http');
    const request = http.get({
      hostname: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      headers: { Host: target.host, Accept: 'application/json' },
      timeout: timeoutMs,
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
        if (body.length > 512 * 1024) request.destroy(new Error('Service response exceeded the size limit.'));
      });
      response.on('end', () => {
        let data = null;
        try { data = body ? JSON.parse(body) : null; } catch { data = null; }
        resolve({ statusCode: response.statusCode || 0, data, body });
      });
    });
    request.on('timeout', () => request.destroy(new Error('Local service request timed out.')));
    request.on('error', reject);
  });
}

function safeProjectName(value) {
  return typeof value === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9 _().-]{0,79}$/.test(value)
    && value !== '.' && value !== '..';
}

class BridgeServiceManager {
  constructor({ appRoot, resourcesPath, isPackaged, platform = process.platform, version = 'unknown', userDataPath, getApiKey = () => '', logger = () => {} }) {
    this.appRoot = appRoot;
    this.resourcesPath = resourcesPath;
    this.isPackaged = Boolean(isPackaged);
    this.platform = platform;
    this.version = version;
    this.userDataPath = userDataPath;
    this.getApiKey = getApiKey;
    this.logger = logger;
    this.startedAt = null;
    this.appOrigin = '';
    this.pluginChild = null;
    this.pluginManaged = false;
    this.pluginRestartCount = 0;
    this.pluginRestartTimer = null;
    this.pluginState = { status: 'starting', error: null, managed: false };
    this.mcpClient = null;
    this.mcpRestartCount = 0;
    this.mcpRestartTimer = null;
    this.stopped = false;
    this.healthTimer = null;
  }

  _log(level, message) {
    this.logger(level, redact(message));
  }

  async start({ appOrigin }) {
    this.stopped = false;
    this.startedAt = Date.now();
    this.appOrigin = appOrigin;
    this._log('info', `Starting local bridge services for ${this.platform}; target plugin port ${PLUGIN_PORT}.`);

    const startup = await Promise.allSettled([this._ensureMcp(), this._ensurePlugin()]);
    for (const result of startup) {
      if (result.status === 'rejected') this._log('error', `A managed service failed to become ready: ${redact(result.reason && result.reason.message ? result.reason.message : result.reason)}`);
    }
    this.healthTimer = setInterval(() => this._monitor(), 10000);
    this.healthTimer.unref?.();
    return this.getStatus();
  }

  _pythonServicePath(kind) {
    return path.join(this.resourcesPath, 'python-services', kind);
  }

  _mcpLaunchConfig() {
    if (this.isPackaged) {
      const folder = this._pythonServicePath('HS.Tech Bridge Runtime');
      const exe = path.join(folder, 'HS.Tech Bridge Runtime.exe');
      return { command: exe, args: ['--mcp'], cwd: folder };
    }
    const script = path.join(this.appRoot, 'bridge_system', 'bridge_server.py');
    const python = process.env.HS_TECH_PYTHON || (this.platform === 'win32' ? 'python' : 'python3');
    return { command: python, args: [script, '--mcp'], cwd: this.appRoot };
  }

  async _ensureMcp(recovery = false) {
    const config = this._mcpLaunchConfig();
    if (this.isPackaged && !fs.existsSync(config.command)) {
      throw new Error(`Packaged MCP runtime is missing: ${config.command}`);
    }
    const childEnv = { ...process.env, HS_TECH_APP_VERSION: this.version };
    this.mcpClient = new McpStdioClient({
      ...config,
      env: childEnv,
      version: this.version,
      logger: (level, message) => this._log(level, message),
    });
    await this.mcpClient.start();
    if (!recovery) this.mcpRestartCount = 0;
    return this.mcpClient.getStatus();
  }

  async _probePlugin() {
    try {
      const health = await requestJson(`http://127.0.0.1:${PLUGIN_PORT}/api/v1/health`, 1000);
      if (health.statusCode === 200 && health.data?.service === 'hs-tech-capcut-plugin') {
        return { available: true, ours: true, compatible: false, health: health.data };
      }
      if (health.statusCode > 0 && health.statusCode !== 404) {
        return { available: true, ours: false, compatible: false, conflict: `Port ${PLUGIN_PORT} is occupied by a non-HS.Tech service.` };
      }
      if (health.statusCode === 404) {
        const root = await requestJson(`http://127.0.0.1:${PLUGIN_PORT}/`, 700);
        if (root.statusCode === 200 && /CapCut Bridge Windows Plugin/i.test(root.data?.plugin || '') && root.data?.platform === 'Windows') {
          return { available: true, ours: true, compatible: true, health: root.data };
        }
        if (root.statusCode > 0) return { available: true, ours: false, conflict: `Port ${PLUGIN_PORT} is occupied by a non-HS.Tech service.` };
      }
    } catch (error) {
      if (error && (error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH' || error.code === 'ECONNRESET')) {
        // Check compatibility with the older repository plugin. It has a root identity endpoint,
        // but no dedicated health endpoint.
        try {
          const root = await requestJson(`http://127.0.0.1:${PLUGIN_PORT}/`, 700);
          if (root.statusCode === 200 && /CapCut Windows Plugin/i.test(root.data?.plugin || '') && root.data?.platform === 'Windows') {
            return { available: true, ours: true, compatible: true, health: root.data };
          }
          if (root.statusCode > 0) return { available: true, ours: false, conflict: `Port ${PLUGIN_PORT} is occupied by a non-HS.Tech service.` };
        } catch (rootError) {
          if (!rootError || !['ECONNREFUSED', 'EHOSTUNREACH', 'ECONNRESET'].includes(rootError.code)) {
            return { available: true, ours: false, conflict: `Port ${PLUGIN_PORT} is occupied or not responding as an HS.Tech service.` };
          }
        }
        return { available: false, ours: false };
      }
      return { available: true, ours: false, conflict: `Could not verify the service on port ${PLUGIN_PORT}: ${redact(error.message || error)}` };
    }
    return { available: false, ours: false };
  }

  async _ensurePlugin(recovery = false) {
    if (this.platform !== 'win32') {
      this.pluginState = { status: 'unavailable', error: 'The CapCut Windows local plugin is only available on Windows.', managed: false };
      return this.pluginState;
    }

    const before = await this._probePlugin();
    if (before.ours && before.available) {
      this.pluginManaged = false;
      this.pluginState = { status: 'online', error: null, managed: false, reused: true, compatible: before.compatible || false };
      this._log('info', `Reusing an existing HS.Tech plugin service on port ${PLUGIN_PORT}.`);
      return this.pluginState;
    }
    if (before.conflict) {
      this.pluginState = { status: 'conflict', error: before.conflict, managed: false };
      this._log('error', before.conflict);
      return this.pluginState;
    }

    const config = this._pluginLaunchConfig();
    if (!config) {
      this.pluginState = { status: 'offline', error: 'The packaged CapCut local service is missing; rebuild the Windows runtime bundle.', managed: false };
      return this.pluginState;
    }
    const env = {
      ...process.env,
      CAPCUT_PLUGIN_PORT: String(PLUGIN_PORT),
      CAPCUT_PLUGIN_ALLOWED_ORIGINS: this.appOrigin,
      PYTHONIOENCODING: 'utf-8',
      HS_TECH_APP_VERSION: this.version,
    };
    try {
      const child = spawn(config.command, config.args, {
        cwd: config.cwd,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      this.pluginChild = child;
      this.pluginManaged = true;
      this.pluginState = { status: 'starting', error: null, managed: true };
      child.stdout?.on('data', (data) => {
        const line = redact(data.toString('utf8').trim());
        if (line) this._log('info', `Plugin: ${line}`);
      });
      child.stderr?.on('data', (data) => {
        const line = redact(data.toString('utf8').trim());
        if (line) this._log('warn', `Plugin: ${line}`);
      });
      child.on('error', (error) => {
        if (this.pluginChild !== child || this.stopped) return;
        this.pluginState = { status: 'offline', error: redact(error.message), managed: true };
        this._log('error', `Failed to launch the plugin service: ${error.message}`);
      });
      child.on('exit', (code, signal) => {
        if (this.pluginChild === child) this.pluginChild = null;
        if (!this.stopped) {
          this.pluginState = { status: 'offline', error: `Plugin service exited (code ${code}, signal ${signal || 'none'}).`, managed: true };
          this._log(code === 0 || code === null ? 'warn' : 'error', this.pluginState.error);
        }
      });

      const deadline = Date.now() + PLUGIN_START_TIMEOUT_MS;
      while (Date.now() < deadline && !this.stopped) {
        const probe = await this._probePlugin();
        if (probe.ours && probe.available) {
          this.pluginState = { status: 'online', error: null, managed: true, reused: false };
          if (!recovery) this.pluginRestartCount = 0;
          this._log('info', `CapCut local plugin is healthy on 127.0.0.1:${PLUGIN_PORT}.`);
          return this.pluginState;
        }
        if (probe.conflict) {
          this.pluginState = { status: 'conflict', error: probe.conflict, managed: true };
          this._log('error', probe.conflict);
          this._stopOwnedPlugin();
          return this.pluginState;
        }
        if (!this.pluginChild || this.pluginChild.exitCode !== null) break;
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      const finalProbe = await this._probePlugin();
      if (finalProbe.ours) {
        this.pluginState = { status: 'online', error: null, managed: true, reused: false };
        if (!recovery) this.pluginRestartCount = 0;
      } else {
        this.pluginState = { status: 'offline', error: this.pluginChild ? 'Local plugin health check timed out.' : 'Local plugin process did not start. Check the service log.', managed: true };
      }
      if (this.pluginState.status !== 'online') this._stopOwnedPlugin();
      return this.pluginState;
    } catch (error) {
      this.pluginState = { status: 'offline', error: redact(error.message || error), managed: false };
      this._log('error', `Plugin startup failed: ${this.pluginState.error}`);
      return this.pluginState;
    }
  }

  _pluginLaunchConfig() {
    if (this.isPackaged) {
      const folder = this._pythonServicePath('HS.Tech Bridge Runtime');
      const exe = path.join(folder, 'HS.Tech Bridge Runtime.exe');
      return fs.existsSync(exe) ? { command: exe, args: ['--plugin'], cwd: folder } : null;
    }
    const script = path.join(this.appRoot, 'capcut-plugin-win.py');
    if (!fs.existsSync(script)) return null;
    return { command: process.env.HS_TECH_PYTHON || 'python', args: [script], cwd: this.appRoot };
  }

  async _monitor() {
    if (this.stopped) return;
    if (this.platform === 'win32') {
      const probe = await this._probePlugin();
      if (probe.ours && this.pluginState.status !== 'online') {
        this.pluginState = { status: 'online', error: null, managed: this.pluginManaged, reused: !this.pluginManaged };
        this._log('info', 'CapCut local plugin recovered and passed its identity health check.');
      } else if (!probe.ours && this.pluginState.status === 'online') {
        this.pluginState = { status: probe.conflict ? 'conflict' : 'offline', error: probe.conflict || 'The local plugin stopped responding.', managed: this.pluginManaged };
        this._log('error', this.pluginState.error);
      }
      if (!probe.ours && !probe.conflict && this.pluginManaged
        && (!this.pluginChild || this.pluginChild.exitCode !== null)
        && this.pluginRestartCount < PLUGIN_RESTART_LIMIT && !this.pluginRestartTimer) {
        this.pluginRestartCount += 1;
        const delay = this.pluginRestartCount * 1500;
        this._log('warn', `Plugin exited; scheduling bounded recovery attempt ${this.pluginRestartCount}/${PLUGIN_RESTART_LIMIT}.`);
        this.pluginRestartTimer = setTimeout(() => {
          this.pluginRestartTimer = null;
          if (!this.stopped) this._ensurePlugin(true).catch((error) => this._log('error', `Plugin recovery failed: ${redact(error.message || error)}`));
        }, delay);
        this.pluginRestartTimer.unref?.();
      }
    }

    const mcpStatus = this.mcpClient?.getStatus();
    if (mcpStatus && mcpStatus.status === 'offline' && !this.stopped && !this.mcpRestartTimer && this.mcpRestartCount < MCP_RESTART_LIMIT) {
      this.mcpRestartCount += 1;
      const delay = this.mcpRestartCount * 1500;
      this._log('warn', `MCP exited; scheduling bounded recovery attempt ${this.mcpRestartCount}/${MCP_RESTART_LIMIT}.`);
      clearTimeout(this.mcpRestartTimer);
      this.mcpRestartTimer = setTimeout(() => {
        this.mcpRestartTimer = null;
        this._ensureMcp(true).catch((error) => this._log('error', `MCP recovery failed: ${redact(error.message || error)}`));
      }, delay);
      this.mcpRestartTimer.unref?.();
    }
  }

  async _pluginStatus() {
    const probe = await this._probePlugin();
    if (!probe.ours || !probe.available) {
      return { status: probe.conflict ? 'conflict' : 'offline', error: probe.conflict || this.pluginState.error, managed: this.pluginManaged };
    }
    try {
      const response = await requestJson(`http://127.0.0.1:${PLUGIN_PORT}/api/v1/status`, 1000);
      if (response.statusCode !== 200 || !response.data) return { status: 'offline', error: 'Plugin status endpoint returned an invalid response.', managed: this.pluginManaged };
      return { status: 'online', data: response.data, managed: this.pluginManaged, compatible: probe.compatible || false };
    } catch (error) {
      return { status: 'offline', error: redact(error.message || error), managed: this.pluginManaged };
    }
  }

  async getStatus() {
    const mcp = this.mcpClient ? this.mcpClient.getStatus() : { status: 'offline', connected: false, tools: [], error: 'MCP client has not started.' };
    const plugin = this.platform === 'win32' ? await this._pluginStatus() : { status: 'unavailable', error: 'Windows plugin is not available on this platform.' };
    let apiConfigured = false;
    try { apiConfigured = Boolean(await this.getApiKey()); } catch {}
    let mcpEditorRunning = null;
    if (mcp.connected && mcp.tools.includes('capcut_status')) {
      try {
        const editorProbe = await this.mcpClient.callTool('capcut_status', {});
        if (editorProbe.data && typeof editorProbe.data.editor_running === 'boolean') mcpEditorRunning = editorProbe.data.editor_running;
      } catch {}
    }
    const editorRunning = typeof plugin.data?.running === 'boolean' ? plugin.data.running : mcpEditorRunning;
    const editorForeground = typeof plugin.data?.foreground === 'boolean' ? plugin.data.foreground : null;
    const editorState = editorRunning === true
      ? (editorForeground === true ? 'foreground' : editorForeground === false ? 'running_background' : 'running_unverified')
      : editorRunning === false ? 'offline' : 'unknown';
    const now = Date.now();
    return {
      version: this.version,
      platform: this.platform,
      uptimeSeconds: this.startedAt ? Math.floor((now - this.startedAt) / 1000) : 0,
      bridge: {
        status: plugin.status === 'online' ? 'online' : (plugin.status === 'conflict' ? 'warning' : plugin.status),
        label: 'Local plugin daemon',
        detail: plugin.status === 'online' ? `REST service verified on 127.0.0.1:${PLUGIN_PORT}.` : plugin.error || 'The local plugin service is not available.',
      },
      api: { status: 'online', label: 'Desktop API', detail: 'Loopback-only local API is responding.' },
      editor: {
        status: editorState,
        running: editorRunning,
        foreground: editorForeground,
        label: 'CapCut Desktop',
        detail: editorRunning === true
          ? (editorForeground === true
            ? 'CapCut process detected and foreground at status-read time; the open timeline is not verified.'
            : editorForeground === false
              ? 'CapCut process detected in the background; live keyboard actions are blocked until it is foreground.'
              : 'CapCut process detected; foreground ownership was not checked on this platform.')
          : editorRunning === false ? 'CapCut process was not detected.' : 'Editor process state is unknown.',
      },
      mcp: {
        status: mcp.connected ? 'online' : (mcp.status === 'starting' ? 'starting' : 'offline'),
        label: 'MCP stdio session',
        detail: mcp.connected ? `Local JSON-RPC handshake passed; ${mcp.tools.length} tools advertised.` : mcp.error || 'MCP service is not connected.',
        tools: mcp.tools,
      },
      ai: {
        status: apiConfigured ? 'configured' : 'not_configured',
        label: 'Gemini AI',
        detail: apiConfigured ? 'Credential stored in the desktop secure store; provider reachability is checked per request.' : 'No Gemini key is configured. Local allowlisted commands remain available.',
      },
      automation: {
        status: plugin.status === 'online' ? (editorForeground ? 'available' : (editorRunning ? 'not_foreground' : 'waiting')) : 'unavailable',
        label: 'Desktop automation',
        detail: editorForeground
          ? 'CapCut was foreground when status was read; each live action still rechecks focus and remains unverified without timeline readback.'
          : (editorRunning ? 'CapCut is running but not foreground; live keyboard actions will be refused.' : 'Requires the Windows plugin and a running CapCut process.'),
      },
      capabilities: {
        fileLane: mcp.tools.includes('create_capcut_draft') && mcp.tools.includes('add_capcut_text'),
        liveLane: mcp.tools.some((tool) => tool.startsWith('capcut_live_')),
        projectReadback: mcp.tools.includes('inspect_capcut_timeline'),
        pluginAvailable: plugin.status === 'online',
      },
      plugin: {
        status: plugin.status,
        managed: plugin.managed,
        error: plugin.error || null,
        port: PLUGIN_PORT,
        projectsPathExists: Boolean(plugin.data && plugin.data.projects_path_exists),
      },
    };
  }

  async listProjects() {
    const result = await this.callContract('list_projects');
    if (!result.data || !Array.isArray(result.data.projects) || result.data.count !== result.data.projects.length) {
      throw new Error('The project index returned an invalid contract response.');
    }
    return result.data;
  }

  async inspectProject(projectName) {
    if (!safeProjectName(projectName)) throw new Error('Invalid project name.');
    const result = await this.mcpClient.callTool('inspect_capcut_timeline', { project_name: projectName });
    if (!result.data || result.data.read_only !== true) throw new Error('The project readback did not return a valid read-only timeline summary.');
    return result.data;
  }

  async createProject(projectName, cuts) {
    if (!safeProjectName(projectName)) throw new Error('Invalid project name.');
    const result = await this.mcpClient.callTool('create_capcut_draft', { project_name: projectName, cuts });
    if (!result.data?.readback?.verified) throw new Error('Draft creation returned without a verified project readback.');
    this._log('info', `Project created and readback verified: ${projectName}.`);
    return { verified: true, projectName, result: result.data };
  }

  async addText(projectName, text, at, duration) {
    if (!safeProjectName(projectName)) throw new Error('Invalid project name.');
    const result = await this.mcpClient.callTool('add_capcut_text', { project_name: projectName, text, at, duration });
    if (!result.data?.readback?.verified) throw new Error('Caption operation returned without a verified readback.');
    this._log('info', `Caption readback verified in project ${projectName}.`);
    return { verified: true, projectName, result: result.data };
  }

  async executeIntent(intent) {
    if (!intent || !['capcut_live_split', 'capcut_live_play', 'capcut_live_export', 'add_capcut_text'].includes(intent.tool)) {
      throw new Error('Requested tool is not allowlisted. No command was executed.');
    }
    if (intent.tool === 'add_capcut_text') {
      return this.addText(intent.projectName, intent.text, intent.at, intent.duration);
    }
    const result = await this.mcpClient.callTool(intent.tool, intent.tool === 'capcut_live_export' ? {} : {});
    this._log('info', `Live action requested: ${intent.intent}. Editor-side completion was not confirmed.`);
    return { verified: false, tool: intent.tool, message: result.text || 'The live shortcut was sent; CapCut readback is not available for this operation.' };
  }

  async callContract(operation, parameters = {}) {
    const allowed = new Set([
      'get_capabilities', 'get_capcut_surface_map', 'list_projects', 'inspect_project', 'inspect_timeline', 'inspect_media',
      'inspect_subtitles', 'analyze_gaps', 'analyze_duplicates', 'create_edit_plan',
      'validate_edit_plan', 'preview_edit_plan', 'execute_edit_plan',
      'verify_execution', 'get_execution_receipt',
    ]);
    if (!allowed.has(operation)) throw new Error('Contract operation is not allowlisted.');
    if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters) || 'projects_dir' in parameters) {
      throw new Error('Contract parameters must be an object and cannot select an arbitrary filesystem root.');
    }
    if (parameters.project_name !== undefined && !safeProjectName(parameters.project_name)) {
      throw new Error('Invalid project name.');
    }
    const result = await this.mcpClient.callTool(`bridge_contract_${operation}`, parameters);
    if (!result.data || result.data.operation !== operation) throw new Error('MCP contract returned an invalid response envelope.');
    if (result.data.success !== true) throw new Error(result.data.error?.message || 'Contract operation is unavailable.');
    return result.data;
  }

  async getLogs(lines = 120) {
    const logPath = path.join(this.userDataPath, 'logs', 'desktop.log');
    try {
      const content = await fs.promises.readFile(logPath, 'utf8');
      return { path: logPath, lines: content.split(/\r?\n/).filter(Boolean).slice(-lines) };
    } catch (error) {
      if (error && error.code === 'ENOENT') return { path: logPath, lines: [] };
      throw error;
    }
  }

  _stopOwnedPlugin() {
    const child = this.pluginChild;
    if (!child) return;
    this.pluginChild = null;
    this.pluginManaged = false;
    try { child.kill(); } catch (error) { this._log('warn', `Could not stop owned plugin process: ${redact(error.message || error)}`); }
  }

  async stop() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.healthTimer) clearInterval(this.healthTimer);
    if (this.mcpRestartTimer) clearTimeout(this.mcpRestartTimer);
    if (this.pluginRestartTimer) clearTimeout(this.pluginRestartTimer);
    this._log('info', 'Shutting down local bridge services.');
    if (this.mcpClient) await this.mcpClient.stop();
    this._stopOwnedPlugin();
    this.pluginState = { status: 'offline', error: null, managed: false };
  }
}

module.exports = { BridgeServiceManager, requestJson, safeProjectName, PLUGIN_PORT };
