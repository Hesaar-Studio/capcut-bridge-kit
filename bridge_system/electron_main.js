// Electron Tray Daemon for HS.Tech Video Bridge (Hesa Art Tech)
const { app, Tray, Menu, shell, dialog, nativeImage } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

let tray = null;
let pythonProcess = null;
let healthTimer = null;

const PORT = 8766;
const STUDIO_URL = 'http://127.0.0.1:3000';
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

function spawnPythonBridge() {
  if (pythonProcess) return;
  const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
  const serverScript = path.join(__dirname, 'bridge_server.py');

  try {
    const child = spawn(pythonExecutable, [serverScript, '--port', `${PORT}`], {
      detached: false,
      stdio: 'pipe'
    });
    pythonProcess = child;

    child.stdout.on('data', (data) => {
      console.log(`[Bridge Server]: ${data}`);
    });

    child.stderr.on('data', (data) => {
      console.error(`[Bridge Server Error]: ${data}`);
    });

    child.on('error', (err) => {
      console.error('Failed to start Python bridge server:', err);
      if (pythonProcess === child) pythonProcess = null;
      updateContextMenu(false);
    });

    child.on('close', (code) => {
      console.log(`Bridge server stopped with code ${code}`);
      if (pythonProcess === child) pythonProcess = null;
      updateContextMenu(false);
    });
  } catch (err) {
    console.error('Failed to spawn Python bridge server:', err);
    updateContextMenu(false);
  }
}

function checkServerHealth(callback) {
  let completed = false;
  const finish = (ok, info) => {
    if (completed) return;
    completed = true;
    callback(ok, info);
  };
  const req = http.get(`http://127.0.0.1:${PORT}/health`, (res) => {
    let raw = '';
    res.on('data', (chunk) => (raw += chunk));
    res.on('end', () => {
      try {
        const json = JSON.parse(raw);
        const isOurService = res.statusCode === 200 &&
          json.slug === 'hs-art-tech-bridge' &&
          json.port === PORT &&
          json.connection === 'health_only_no_nle_adapter';
        finish(isOurService, json);
      } catch (e) {
        finish(false, null);
      }
    });
  });

  req.on('error', () => {
    finish(false, null);
  });
  req.setTimeout(1500, () => {
    req.destroy();
    finish(false, null);
  });
}

function checkStudioHealth(callback) {
  const req = http.get(`${STUDIO_URL}/api/health`, (res) => {
    let raw = '';
    res.on('data', (chunk) => (raw += chunk));
    res.on('end', () => {
      try {
        const json = JSON.parse(raw);
        callback(res.statusCode === 200 && json.status === 'ok');
      } catch {
        callback(false);
      }
    });
  });
  req.on('error', () => callback(false));
  req.setTimeout(1500, () => req.destroy());
}

function restartPythonBridge() {
  const current = pythonProcess;
  if (!current) {
    spawnPythonBridge();
    return;
  }
  pythonProcess = null;
  let restarted = false;
  const start = () => {
    if (restarted) return;
    restarted = true;
    spawnPythonBridge();
  };
  const timeout = setTimeout(() => {
    dialog.showErrorBox('Bridge Restart', 'The Python service did not stop in time. It was not restarted to avoid a port collision.');
  }, 5000);
  current.once('close', () => {
    clearTimeout(timeout);
    start();
  });
  if (!current.kill()) {
    clearTimeout(timeout);
    start();
  }
}

function createTray() {
  // 16x16 or 32x32 transparent icon fallback
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('HS.Tech local bridge services');

  updateContextMenu(false);
}

function updateContextMenu(isOnline) {
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'HS.Tech Video Bridge (Hesa Art Tech)',
      enabled: false
    },
    {
      label: `Sample HTTP: ${isOnline ? `Online (Port ${PORT})` : 'Offline'}`,
      icon: null,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Open Web Studio',
      click: () => checkStudioHealth((ready) => {
        if (ready) shell.openExternal(STUDIO_URL);
        else dialog.showErrorBox('Web Studio Offline', 'The web app is not running at 127.0.0.1:3000. Start the HS.Tech web server separately, then try again.');
      })
    },
    {
      label: 'Check Sample HTTP Service',
      click: () => {
        checkServerHealth((ok, info) => {
          if (ok) {
            dialog.showMessageBox({
              type: 'info',
              title: 'HS.Tech Bridge Status',
              message: 'The sample HTTP service is responding. This does not confirm an NLE or timeline connection.',
              detail: JSON.stringify(info || {}, null, 2)
            });
          } else {
            dialog.showErrorBox(
              'Bridge Offline',
              `Could not verify the HS.Tech sample service on port ${PORT}. Check that the tray daemon started successfully.`
            );
          }
        });
      }
    },
    {
      label: 'View Claude MCP Config',
      click: () => {
        const configPath = path.join(__dirname, 'claude_desktop_config.json');
        shell.showItemInFolder(configPath);
      }
    },
    { type: 'separator' },
    {
      label: 'Restart Python Daemon',
      click: () => {
        restartPythonBridge();
      }
    },
    {
      label: 'Quit',
      click: () => {
        if (pythonProcess) pythonProcess.kill();
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) return;
  spawnPythonBridge();
  createTray();
  checkServerHealth((ok) => updateContextMenu(ok));
  healthTimer = setInterval(() => {
    checkServerHealth((ok) => updateContextMenu(ok));
  }, 10000);
});

app.on('window-all-closed', (e) => {
  e.preventDefault(); // Keep daemon in system tray
});

app.on('will-quit', () => {
  if (healthTimer) clearInterval(healthTimer);
  if (pythonProcess) {
    try {
      pythonProcess.kill();
    } catch (e) {}
  }
});
