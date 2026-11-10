# Windows x64 installer build and smoke test

## Current status

The source now contains an Electron + NSIS build pipeline. **No Windows `.exe` has been built in this Linux workspace.** The pipeline must be run on native Windows x64; the scripts intentionally reject Linux/macOS rather than creating a misleading cross-build.

## Requirements

- Windows x64 (interactive desktop session for the install/start smoke test)
- Node.js 22.12 or newer and npm 10 or newer
- Python 3.11 or newer, 64-bit
- Internet access to install the locked Node and Python dependencies

## Build on Windows

The one-command runner checks the Windows x64 / Node / Python prerequisites, uses a temporary Python virtual environment, installs the locked Node and pinned Python dependencies, runs audits/tests/lint, refreshes the source-only ZIP, builds the actual installer, and writes its SHA-256 plus a transcript under `release/validation/`:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\scripts\verify-windows-release.ps1
```

The runner does **not** launch the installer, request elevation, or touch CapCut. It leaves the built artifact and log in the repository's `release/` directory; it removes only its temporary Python venv. If you prefer manual commands, use:

```powershell
npm ci --no-audit --no-fund
python -m pip install -r requirements-win-build.txt
npm audit --omit=dev --audit-level=high
npm audit --audit-level=critical
npm test
npm run lint
npm run build:win
```

To refresh just the in-app source-only ZIP (not an installer), run `npm run package:source`. The ZIP is generated at `public/hs-art-tech-bridge.zip` and excludes generated dependencies, nested archives and executables.

The executable is expected at:

```text
release/artifacts/HS.Tech-Bridge-Setup-x64.exe
```

The script prints its SHA-256. Verify the checksum before distributing the file. The GitHub Actions workflow named **Windows x64 installer** builds the same target and uploads the installer plus a `.sha256` file as a short-lived artifact.

## Required smoke test before calling a release verified

1. Use a clean Windows x64 user account and verify the downloaded artifact's SHA-256.
2. Run the installer as the normal user; it is configured per-user and `asInvoker`, not per-machine.
3. Confirm that setup does not request Administrator elevation, the app appears in Start Menu, and the dashboard starts.
4. Verify the app log and service status; confirm the packaged MCP config points at the bundled runtime executable under the app's resources directory.
5. Exit the app normally, verify its child services stop, uninstall it, then confirm per-user data was not deleted by uninstall.
6. Record Windows version, Python/Node build versions, installer hash, test results, and any SmartScreen warning. The installer is unsigned until a trusted code-signing certificate is configured.

Do not use the smoke test to inject into, elevate, probe, or mutate CapCut. Installer success does not establish a CapCut-owned live timeline API or prove subtitle edits were applied in the editor. The full npm audit also retains a documented high, development-only `http-cache-semantics@4.2.0` finding with no published fix; the production audit is clean and the CI job fails on critical findings.
