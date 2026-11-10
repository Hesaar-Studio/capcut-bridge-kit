'use strict';

const { app, BrowserWindow, dialog, shell, ipcMain, safeStorage, session } = require('electron');
const { createServer } = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { BridgeServiceManager } = require('./service_manager.cjs');

const PRODUCT_NAME = 'HS.Tech AI Video Bridge';
const APP_ID = 'com.hesaart.capcutbridge';
const hasSingleInstanceLock = app.requestSingleInstanceLock();
let mainWindow = null;
let httpServer = null;
let serviceManager = null;
let logStream = null;
let logPath = '';
let appOrigin = '';
let sessionGeminiKey = '';
let shutdownPromise = null;
let shutdownComplete = false;

app.setName(PRODUCT_NAME);
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

function safeText(value) {
  return String(value || '')
    .replace(/AIza[\w-]{20,}/g, '[redacted key]')
    .replace(/Bearer\s+[\w.\-]+/gi, 'Bearer [redacted]')
    .replace(/(api[_-]?key\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]')
    .slice(0, 4000);
}

function log(level, message) {
  const line = `${new Date().toISOString()} [${String(level).toUpperCase()}] ${safeText(message)}\n`;
  try { logStream?.write(line); } catch {}
}

function initializeLogging() {
  const logsDirectory = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logsDirectory, { recursive: true });
  logPath = path.join(logsDirectory, 'desktop.log');
  logStream = fs.createWriteStream(logPath, { flags: 'a', encoding: 'utf8' });
  log('info', `Starting ${PRODUCT_NAME} v${app.getVersion()} (${process.platform}/${process.arch}).`);
  log('info', `Persistent logs are stored under the per-user data directory.`);
}

function secretsDirectory() {
  return path.join(app.getPath('userData'), 'secure-store');
}

function apiKeyFile() {
  return path.join(secretsDirectory(), 'gemini-api-key.bin');
}

function getGeminiApiKey() {
  if (sessionGeminiKey) return sessionGeminiKey;
  const file = apiKeyFile();
  if (!fs.existsSync(file) || !safeStorage.isEncryptionAvailable()) return process.env.GEMINI_API_KEY || '';
  try {
    const encrypted = fs.readFileSync(file);
    sessionGeminiKey = safeStorage.decryptString(encrypted);
    return sessionGeminiKey;
  } catch (error) {
    log('error', `Could not decrypt the stored AI credential: ${error.message}`);
    return '';
  }
}

function getGeminiKeyStatus() {
  return {
    configured: Boolean(getGeminiApiKey()),
    secureStorageAvailable: safeStorage.isEncryptionAvailable(),
  };
}

function saveGeminiApiKey(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  if (!key || key.length < 20 || key.length > 512 || /[\r\n\0]/.test(key)) {
    throw new Error('Enter a valid Gemini API key (20–512 characters).');
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('The operating-system secure credential store is unavailable. The key was not saved.');
  }
  const directory = secretsDirectory();
  fs.mkdirSync(directory, { recursive: true });
  const file = apiKeyFile();
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, safeStorage.encryptString(key), { mode: 0o600 });
  fs.renameSync(temporary, file);
  sessionGeminiKey = key;
  log('info', 'Gemini credential saved to OS-protected secure storage (value omitted).');
  return getGeminiKeyStatus();
}

function clearGeminiApiKey() {
  const file = apiKeyFile();
  try { fs.rmSync(file, { force: true }); } catch (error) { log('warn', `Could not remove stored AI credential: ${error.message}`); }
  sessionGeminiKey = '';
  log('info', 'Stored Gemini credential cleared.');
  return { cleared: true };
}

function runtimeExecutable() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'python-services', 'HS.Tech Bridge Runtime', 'HS.Tech Bridge Runtime.exe');
  }
  return path.join(path.resolve(__dirname, '..'), 'bridge_system', 'runtime_entry.py');
}

function buildMcpConfig() {
  if (app.isPackaged) {
    return {
      available: fs.existsSync(runtimeExecutable()),
      executable: runtimeExecutable(),
      config: JSON.stringify({
        mcpServers: {
          'hs-tech-capcut-bridge': {
            command: runtimeExecutable(),
            args: ['--mcp'],
            env: { PYTHONIOENCODING: 'utf-8', HS_TECH_APP_VERSION: app.getVersion() },
          },
        },
      }, null, 2),
    };
  }
  const script = path.join(path.resolve(__dirname, '..'), 'bridge_system', 'bridge_server.py');
  const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
  return {
    available: fs.existsSync(script),
    executable: script,
    config: JSON.stringify({
      mcpServers: {
        'hs-tech-capcut-bridge': {
          command: pythonCommand,
          args: [script, '--mcp'],
          env: { PYTHONIOENCODING: 'utf-8', HS_TECH_APP_VERSION: app.getVersion() },
        },
      },
    }, null, 2),
  };
}

function registerIpcHandlers() {
  ipcMain.handle('hs-tech:key-status', () => getGeminiKeyStatus());
  ipcMain.handle('hs-tech:key-save', (_event, key) => {
    try { return { saved: true, ...saveGeminiApiKey(key) }; }
    catch (error) { return { saved: false, secureStorageAvailable: safeStorage.isEncryptionAvailable(), error: safeText(error.message) }; }
  });
  ipcMain.handle('hs-tech:key-clear', () => clearGeminiApiKey());
  ipcMain.handle('hs-tech:select-media', async () => {
    if (!mainWindow) return [];
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select source media',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Video and audio files', extensions: ['mp4', 'mov', 'm4v', 'mkv', 'webm', 'avi', 'mp3', 'wav', 'm4a', 'aac'] }, { name: 'All files', extensions: ['*'] }],
    });
    return result.canceled ? [] : result.filePaths;
  });
  ipcMain.handle('hs-tech:mcp-config', () => buildMcpConfig());
  ipcMain.handle('hs-tech:open-logs', async () => {
    const folder = path.dirname(logPath || path.join(app.getPath('userData'), 'logs', 'desktop.log'));
    const error = await shell.openPath(folder);
    return { opened: !error, error: error || undefined };
  });
  ipcMain.handle('hs-tech:open-external', async (_event, value) => {
    try {
      const url = new URL(String(value));
      if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) return { opened: false, error: 'Unsupported external URL protocol.' };
      await shell.openExternal(url.toString());
      return { opened: true };
    } catch (error) {
      return { opened: false, error: safeText(error.message) };
    }
  });
}

function allowExternalLink(url) {
  try {
    const parsed = new URL(url);
    return ['https:', 'http:', 'mailto:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1580,
    height: 1000,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#070d18',
    title: PRODUCT_NAME,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (allowExternalLink(url)) shell.openExternal(url).catch((error) => log('warn', `External link open failed: ${error.message}`));
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    let targetOrigin = '';
    try { targetOrigin = new URL(targetUrl).origin; } catch {}
    if (targetOrigin !== appOrigin) {
      event.preventDefault();
      if (allowExternalLink(targetUrl)) shell.openExternal(targetUrl).catch((error) => log('warn', `External navigation failed: ${error.message}`));
    }
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log('error', `Renderer process exited (${details.reason}, code ${details.exitCode}).`);
  });
  mainWindow.on('closed', () => { mainWindow = null; });

  await mainWindow.loadURL(appOrigin);
  mainWindow.show();
  log('info', 'Desktop dashboard window loaded.');
}

function configurePermissions() {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    let sameOrigin = false;
    try { sameOrigin = new URL(webContents.getURL()).origin === appOrigin; } catch {}
    const audioOnly = Array.isArray(details?.mediaTypes) && details.mediaTypes.length === 1 && details.mediaTypes[0] === 'audio';
    callback(sameOrigin && permission === 'media' && audioOnly);
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (permission !== 'media' || !webContents) return false;
    try {
      const sameOrigin = new URL(requestingOrigin).origin === appOrigin;
      const audioOnly = !details?.mediaType || details.mediaType === 'audio';
      return sameOrigin && audioOnly;
    } catch { return false; }
  });
}

async function boot() {
  if (!hasSingleInstanceLock) {
    app.quit();
    return;
  }
  initializeLogging();
  registerIpcHandlers();
  configurePermissions();

  if (process.env.NODE_ENV !== 'production' && !process.env.GEMINI_API_KEY) {
    // Environment keys are a developer-only fallback; packaged builds never load .env.
  }

  const root = path.resolve(__dirname, '..');
  const backendPath = path.join(root, 'build', 'desktop', 'backend.cjs');
  if (!fs.existsSync(backendPath)) throw new Error(`Desktop API bundle is missing: ${backendPath}. Run npm run build:desktop first.`);
  const { createApp } = require(backendPath);
  serviceManager = new BridgeServiceManager({
    appRoot: root,
    resourcesPath: app.isPackaged ? process.resourcesPath : root,
    isPackaged: app.isPackaged,
    platform: process.platform,
    version: app.getVersion(),
    userDataPath: app.getPath('userData'),
    getApiKey: getGeminiApiKey,
    logger: log,
  });

  const backendApp = createApp({
    production: true,
    staticPath: path.join(root, 'dist'),
    bridge: serviceManager,
    getApiKey: getGeminiApiKey,
    logger: { info: (msg) => log('info', msg), warn: (msg) => log('warn', msg), error: (msg) => log('error', msg) },
  });
  httpServer = createServer(backendApp);
  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', () => {
      httpServer.removeListener('error', reject);
      const address = httpServer.address();
      if (!address || typeof address === 'string') return reject(new Error('Could not resolve the local API port.'));
      appOrigin = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
  log('info', `Local API bound to loopback on an ephemeral port.`);

  // Services are checked before the UI opens. A missing/failed subsystem is reported as
  // degraded state in the dashboard; unrelated processes are never killed.
  await serviceManager.start({ appOrigin });
  await createMainWindow();
}

async function shutdown() {
  log('info', 'Application shutdown requested.');
  if (serviceManager) await serviceManager.stop();
  if (httpServer && httpServer.listening) {
    await new Promise((resolve) => httpServer.close(() => resolve()));
  }
  log('info', 'Application shutdown complete.');
  if (logStream) await new Promise((resolve) => logStream.end(resolve));
}

if (hasSingleInstanceLock) {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(boot).catch(async (error) => {
  log('error', `Desktop startup failed: ${safeText(error.message || error)}`);
  const logDetail = logPath ? `\n\nDiagnostic log: ${logPath}` : '';
  await dialog.showMessageBox({ type: 'error', title: 'HS.Tech AI Video Bridge', message: 'The desktop application could not start its local services.', detail: `${safeText(error.message || error)}${logDetail}` });
  if (serviceManager) await serviceManager.stop();
  if (httpServer?.listening) httpServer.close();
  app.quit();
});

app.on('before-quit', (event) => {
  if (shutdownComplete) return;
  event.preventDefault();
  if (!shutdownPromise) {
    shutdownPromise = shutdown().finally(() => {
      shutdownComplete = true;
      app.quit();
    });
  }
});

app.on('will-quit', () => {
  if (logStream && !logStream.destroyed) logStream.end();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
