import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const INSTALLER_PATH = path.join(ROOT, 'release', 'artifacts', 'HS.Tech-Bridge-Setup-x64.exe');
const PYTHON_RUNTIME = path.join(ROOT, 'release', 'runtime', 'python-services', 'HS.Tech Bridge Runtime', 'HS.Tech Bridge Runtime.exe');
const REQUIRED_FILES = [
  'package-lock.json',
  'bridge_system/electron_main.cjs',
  'bridge_system/preload.cjs',
  'bridge_system/service_manager.cjs',
  'bridge_system/mcp_client.cjs',
  'bridge_system/runtime_entry.py',
  'scripts/build-python-services.py',
  'requirements-win-build.txt',
  'assets/hs-tech-bridge.ico',
];

function fail(message, code = 1) {
  console.error(`[Windows installer] ${message}`);
  process.exitCode = code;
}

function validateSource() {
  const missing = REQUIRED_FILES.filter((relative) => !existsSync(path.join(ROOT, relative)));
  if (missing.length) throw new Error(`Missing installer inputs: ${missing.join(', ')}`);

  const manifest = JSON.parse(readFileSync(PACKAGE_PATH, 'utf8'));
  if (manifest.main !== 'bridge_system/electron_main.cjs') {
    throw new Error('package.json main must resolve to bridge_system/electron_main.cjs.');
  }
  if (!manifest.build?.win?.target?.some((item) => item.target === 'nsis' && item.arch?.includes('x64'))) {
    throw new Error('electron-builder must declare the NSIS x64 target.');
  }
  if (manifest.build?.win?.requestedExecutionLevel !== 'asInvoker' || manifest.build?.nsis?.perMachine !== false) {
    throw new Error('The installer must remain per-user and must not request Administrator elevation.');
  }
  const icon = readFileSync(path.join(ROOT, 'assets/hs-tech-bridge.ico'));
  if (icon.length < 22 || icon.readUInt16LE(0) !== 0 || icon.readUInt16LE(2) !== 1 || icon.readUInt16LE(4) < 1) {
    throw new Error('assets/hs-tech-bridge.ico is not a valid ICO container.');
  }
  const patterns = manifest.build.files || [];
  if (!patterns.some((pattern) => pattern.includes('bridge_system/**/*.cjs'))) {
    throw new Error('Electron packaging must include all bridge_system CommonJS runtime files.');
  }
  console.log(`Installer source preflight passed (${REQUIRED_FILES.length} required inputs).`);
  return manifest;
}

function run(command, args, label, options = {}) {
  console.log(`\n[Windows installer] ${label}`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    ...options,
  });
  if (result.error) throw new Error(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
}

function runNpm(args, label) {
  if (!args.length || args.some((value) => !/^[a-zA-Z0-9:._-]+$/.test(value))) {
    throw new Error('Only fixed npm script tokens may be passed to the Windows command wrapper.');
  }
  const commandLine = `npm.cmd ${args.join(' ')}`;
  run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', commandLine], label);
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function main() {
  const args = process.argv.slice(2);
  const allowed = new Set(['--validate-only', '--installer-only']);
  const unknown = args.filter((argument) => !allowed.has(argument));
  if (unknown.length) throw new Error(`Unknown option(s): ${unknown.join(', ')}`);
  if (args.includes('--validate-only') && args.length !== 1) throw new Error('--validate-only cannot be combined with other options.');

  validateSource();
  if (args.includes('--validate-only')) return;

  if (process.platform !== 'win32') {
    throw new Error('A native Windows x64 runner is required to build the NSIS installer and PyInstaller runtime. No cross-build is attempted.');
  }
  if (process.arch !== 'x64') throw new Error(`Build on Windows x64; current Node architecture is ${process.arch}.`);
  if (!existsSync(path.join(ROOT, 'node_modules'))) {
    throw new Error('Node dependencies are not installed. Run npm ci from the project root, then retry.');
  }

  runNpm(['run', 'build:desktop'], 'Build the React renderer and local API');
  run(process.env.PYTHON || 'python', ['scripts/build-python-services.py', '--replace-existing'], 'Bundle the Python MCP/plugin runtime');

  const expectedBuildInputs = [
    path.join(ROOT, 'dist', 'index.html'),
    path.join(ROOT, 'build', 'desktop', 'backend.cjs'),
    PYTHON_RUNTIME,
  ];
  const missing = expectedBuildInputs.filter((file) => !existsSync(file));
  if (missing.length) throw new Error(`Build completed without required package inputs: ${missing.join(', ')}`);

  runNpm(['run', 'package:win'], 'Create the per-user NSIS x64 installer');
  if (!existsSync(INSTALLER_PATH) || statSync(INSTALLER_PATH).size === 0) {
    throw new Error(`Installer artifact was not produced at ${INSTALLER_PATH}.`);
  }
  console.log(`\nInstaller created: ${path.relative(ROOT, INSTALLER_PATH)}`);
  console.log(`SHA-256: ${sha256(INSTALLER_PATH)}`);
  console.log('Build success is not a substitute for an interactive Windows install/start/uninstall smoke test.');
}

try {
  main();
} catch (error) {
  fail(error?.message || String(error));
}
