'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function runNodeScript(relativePath, args) {
  return spawnSync(process.execPath, [path.join(root, relativePath), ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30000,
  });
}

test('Windows installer manifest uses the Electron entry point and safe per-user NSIS settings', () => {
  assert.equal(packageJson.main, 'bridge_system/electron_main.cjs');
  assert.equal(packageJson.scripts.start, 'electron .');
  assert.equal(packageJson.build.win.requestedExecutionLevel, 'asInvoker');
  assert.equal(packageJson.build.nsis.perMachine, false);
  assert.equal(packageJson.build.nsis.deleteAppDataOnUninstall, false);
  assert.ok(packageJson.build.win.target.some((target) => target.target === 'nsis' && target.arch.includes('x64')));
  assert.ok(packageJson.build.files.includes('bridge_system/**/*.cjs'));
  assert.ok(packageJson.build.extraResources.some((resource) => resource.from === 'release/runtime/python-services'));
});

test('required Windows packaging inputs and ICO container are present', () => {
  const required = [
    'bridge_system/electron_main.cjs',
    'bridge_system/preload.cjs',
    'bridge_system/service_manager.cjs',
    'bridge_system/mcp_client.cjs',
    'bridge_system/runtime_entry.py',
    'scripts/build-win.mjs',
    'scripts/build-python-services.py',
    'requirements-win-build.txt',
    'package-lock.json',
    'assets/hs-tech-bridge.ico',
  ];
  for (const relative of required) assert.ok(fs.existsSync(path.join(root, relative)), `missing ${relative}`);
  const icon = fs.readFileSync(path.join(root, 'assets/hs-tech-bridge.ico'));
  assert.equal(icon.readUInt16LE(0), 0);
  assert.equal(icon.readUInt16LE(2), 1);
  assert.ok(icon.readUInt16LE(4) >= 1);
});

test('Windows preflight can be checked without building an installer', () => {
  const result = runNodeScript('scripts/build-win.mjs', ['--validate-only']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /preflight passed/i);
});

test('Windows runtime bundler has a non-mutating preflight', () => {
  const result = spawnSync(process.env.PYTHON || 'python', ['scripts/build-python-services.py', '--validate-only'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /no files written/i);
});

test('Linux does not attempt to cross-build the Windows installer', { skip: process.platform === 'win32' }, () => {
  const result = runNodeScript('scripts/build-win.mjs', []);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /native Windows x64 runner/i);
});

test('preload exposes only allowlisted IPC wrappers and rejects unsafe external URLs', async () => {
  const source = fs.readFileSync(path.join(root, 'bridge_system/preload.cjs'), 'utf8');
  const calls = [];
  let exposedName = '';
  let exposedApi = null;
  const electron = {
    contextBridge: {
      exposeInMainWorld(name, api) {
        exposedName = name;
        exposedApi = api;
      },
    },
    ipcRenderer: {
      invoke(channel, ...args) {
        calls.push({ channel, args });
        return Promise.resolve({ channel });
      },
    },
  };

  vm.runInNewContext(source, {
    require: (name) => {
      assert.equal(name, 'electron');
      return electron;
    },
    URL,
    Object,
    Promise,
  }, { filename: 'preload.cjs' });

  assert.equal(exposedName, 'hsTech');
  assert.deepEqual(Object.keys(exposedApi).sort(), [
    'clearGeminiApiKey',
    'getGeminiKeyStatus',
    'getMcpConfig',
    'openExternal',
    'openLogs',
    'saveGeminiApiKey',
    'selectMedia',
  ].sort());
  assert.equal('invoke' in exposedApi, false);

  const rejected = await exposedApi.openExternal('javascript:alert(1)');
  assert.equal(rejected.opened, false);
  assert.equal(calls.length, 0);

  await exposedApi.openExternal('https://example.com/');
  assert.deepEqual(calls.at(-1), { channel: 'hs-tech:open-external', args: ['https://example.com/'] });

  const invalidKey = await exposedApi.saveGeminiApiKey('short');
  assert.equal(invalidKey.saved, false);
  assert.equal(calls.some((call) => call.channel === 'hs-tech:key-save'), false);
});
