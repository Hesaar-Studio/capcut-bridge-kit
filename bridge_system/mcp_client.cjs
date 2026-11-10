'use strict';

const { spawn } = require('node:child_process');

function safeLine(value) {
  return String(value || '')
    .replace(/AIza[\w-]{20,}/g, '[redacted key]')
    .replace(/Bearer\s+[\w.\-]+/gi, 'Bearer [redacted]')
    .slice(0, 1000);
}

class McpStdioClient {
  constructor({ command, args = [], cwd, env = process.env, logger = () => {}, version = 'unknown' }) {
    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.env = env;
    this.logger = logger;
    this.version = version;
    this.child = null;
    this.ready = false;
    this.tools = new Set();
    this.pending = new Map();
    this.nextId = 1;
    this.stdoutBuffer = '';
    this.startedAt = null;
    this.lastError = null;
  }

  async start() {
    if (this.ready && this.child && this.child.exitCode === null) return this.getStatus();
    if (this.child && this.child.exitCode === null) await this.stop();
    this.lastError = null;
    this.stdoutBuffer = '';

    const child = spawn(this.command, this.args, {
      cwd: this.cwd,
      env: { ...this.env, PYTHONIOENCODING: 'utf-8', HS_TECH_APP_VERSION: this.version },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.child = child;
    this.startedAt = Date.now();
    child.stdout.on('data', (chunk) => this._onStdout(chunk));
    child.stderr.on('data', (chunk) => {
      const message = safeLine(chunk.toString('utf8').trim());
      if (message) this.logger('warn', `MCP stderr: ${message}`);
    });
    child.on('error', (error) => {
      this.lastError = safeLine(error.message);
      this.ready = false;
      this._rejectPending(new Error(this.lastError));
      this.logger('error', `MCP process failed: ${this.lastError}`);
    });
    child.on('exit', (code, signal) => {
      const current = this.child === child;
      if (current) {
        this.ready = false;
        this.tools.clear();
        this._rejectPending(new Error(`MCP process exited (${signal || code || 'unknown'}).`));
        if (code !== 0 && code !== null) this.lastError = `MCP process exited with code ${code}.`;
      }
      this.logger(code === 0 || code === null ? 'info' : 'error', `MCP process stopped (code ${code}, signal ${signal || 'none'}).`);
    });

    try {
      await this._request('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'hs-tech-desktop-control', version: this.version },
      }, 15000);
      this._notify('notifications/initialized', {});
      const listed = await this._request('tools/list', {}, 15000);
      const toolList = listed && listed.result && Array.isArray(listed.result.tools) ? listed.result.tools : [];
      this.tools = new Set(toolList.filter((tool) => tool && typeof tool.name === 'string').map((tool) => tool.name));
      this.ready = this.tools.size > 0;
      if (!this.ready) throw new Error('MCP handshake completed but no tools were advertised.');
      this.logger('info', `MCP ready; ${this.tools.size} allowlisted tools discovered.`);
      return this.getStatus();
    } catch (error) {
      this.ready = false;
      this.lastError = safeLine(error && error.message ? error.message : error);
      await this.stop();
      throw new Error(this.lastError);
    }
  }

  _onStdout(chunk) {
    this.stdoutBuffer += chunk.toString('utf8');
    if (this.stdoutBuffer.length > 1024 * 1024) {
      this.lastError = 'MCP response buffer exceeded the size limit.';
      this._rejectPending(new Error(this.lastError));
      this.stdoutBuffer = '';
      return;
    }
    let newline;
    while ((newline = this.stdoutBuffer.indexOf('\n')) >= 0) {
      const line = this.stdoutBuffer.slice(0, newline).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        this.logger('error', 'MCP wrote a non-JSON line to stdout; the protocol stream was rejected.');
        continue;
      }
      if (message && message.id !== undefined && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        clearTimeout(pending.timer);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(safeLine(message.error.message || 'MCP request failed.')));
        else pending.resolve(message);
      }
    }
  }

  _request(method, params, timeoutMs = 15000) {
    if (!this.child || this.child.exitCode !== null || !this.child.stdin.writable) {
      return Promise.reject(new Error('MCP service is not running.'));
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  _notify(method, params) {
    if (!this.child || this.child.exitCode !== null || !this.child.stdin.writable) return;
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
  }

  async callTool(name, args = {}) {
    if (!this.ready) throw new Error('MCP service is not ready.');
    if (!this.tools.has(name)) throw new Error(`MCP capability is unavailable: ${name}`);
    const response = await this._request('tools/call', { name, arguments: args }, 5 * 60 * 1000);
    const result = response.result || {};
    const text = Array.isArray(result.content)
      ? result.content.filter((item) => item && item.type === 'text').map((item) => item.text || '').join('\n')
      : '';
    if (result.isError) throw new Error(safeLine(text || `MCP tool failed: ${name}`));
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = null; }
    }
    return { tool: name, text, data, verified: Boolean(data && data.readback && data.readback.verified) };
  }

  getStatus() {
    return {
      status: this.ready ? 'online' : (this.child && this.child.exitCode === null ? 'starting' : 'offline'),
      connected: this.ready,
      tools: [...this.tools],
      uptimeSeconds: this.startedAt && this.ready ? Math.floor((Date.now() - this.startedAt) / 1000) : 0,
      error: this.lastError,
    };
  }

  _rejectPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  async stop() {
    const child = this.child;
    this.ready = false;
    this.tools.clear();
    if (!child) return;
    this.child = null;
    this._rejectPending(new Error('MCP client stopped.'));
    if (child.exitCode !== null) return;
    await new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        try { child.kill(); } catch {}
        done();
      }, 1800);
      child.once('exit', done);
      try { child.kill(); } catch { done(); }
    });
  }
}

module.exports = { McpStdioClient };
