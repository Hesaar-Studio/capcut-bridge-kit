# Change record — first consolidation increment

## P1: route project-index reads through ContractDispatcher

- **WHY:** The dashboard project list currently bypasses the canonical typed contract by preferring plugin REST and falling back to a legacy MCP filesystem scan. A provider-neutral, read-only core should own the project index used by the desktop dashboard and the legacy MCP list tool.
- **FILE:** `ai_contract/schemas.py`, `ai_contract/capabilities.py`, `ai_contract/dispatcher.py`, `bridge_system/bridge_server.py`, `bridge_system/service_manager.cjs`, `bridge_system/README.md`, `server.ts` (read-only REST allowlist), `tests/test_ai_contract.py`, `tests/test_mcp_contract_tools.py`, and a small Node service-manager test.
- **CURRENT BEHAVIOR:** `BridgeServiceManager.listProjects()` probes the Windows plugin's `/api/v1/drafts` endpoint and otherwise invokes the independent `list_capcut_projects` MCP handler. The MCP handler lists directories itself. Neither uses `ContractDispatcher`.
- **NEW BEHAVIOR:** A bounded `list_projects` read-only contract operation returns local project summaries; the desktop manager and backward-compatible MCP list tool delegate to it. The REST contract allowlist also exposes it without permitting a caller-selected filesystem root. The old MCP tool name/legacy result fields remain stable. Hidden, unsafe and symlink project entries are excluded; filesystem paths are not exposed in the index.
- **RISK:** External MCP clients depend on the current simple `{projects, count}` response. The new contract response is additive; the legacy tool must preserve its current shape. Unreadable/corrupt project JSON must not crash listing or be mislabeled as a valid timeline. No project writes or CapCut UI operations are part of this change.
- **VERIFICATION:** Isolated temporary-directory tests cover valid, hidden, symlink, malformed, and unreadable drafts; MCP regression verifies the old tool response; Node test verifies the service manager calls only the contract operation. Focused Python and Node tests pass; `git diff --check` passes. The TypeScript build/REST runtime is unverified because this workspace lacks frontend dependencies. No live Windows or CapCut claim.

**Approval:** User authorized implementation incrementally on 2026-10-02. This record is written before the source edits. No commit or push is authorized.

## P0: Fail closed when CapCut process state cannot be established

- **WHY:** A failed or timed-out process query is currently converted to `False` in the Windows CLI, Windows REST plugin, and MCP process probe. File-lane callers interpret `False` as “CapCut is closed,” so an unavailable process check can permit a draft mutation while the editor may still be running. Live-action status can also be misreported.
- **FILE:** Add a shared standard-library process probe in `bridge_system/process_guard.py`; route `capcut-bridge-win.py`, `capcut-bridge.py`, `capcut-plugin-win.py`, and `bridge_system/bridge_server.py` through it; update process/status and live-guard tests in `tests/test_process_guard.py`, `tests/test_replay_safety.py`, `tests/test_cli_live_safety.py`, and `tests/test_local_plugin_security.py`.
- **CURRENT BEHAVIOR:** Windows `tasklist` and PowerShell/`pgrep` errors/timeouts are coerced to “not running.” The Windows bridge therefore may proceed with file operations on an unknown state. The REST routes may repeat a failed probe while selecting an HTTP status.
- **NEW BEHAVIOR:** Use bounded, deterministic process queries; distinguish a verified running/closed result from an unavailable or malformed result; raise a dedicated `ProcessStateUnknown` for the latter. File writes and live shortcuts must stop on unknown. Status reports must not turn unknown into `false`, and HTTP guard errors must not trigger a second process query.
- **RISK:** Process-query failures will now block operations until the check works; this is intentionally conservative. This does not prove the detector can observe every process or replace a real Windows/CapCut test, and no elevation/UIPI bypass is part of the fix.
- **VERIFICATION:** Unit tests will simulate matching/no-match output, missing commands, timeouts, nonzero exit codes, unknown formats, and assert no draft write or keyboard event occurs on unknown. Run the focused Python suite and `git diff --check`; report live Windows/CapCut behavior as unverified.

**Approval:** User authorized incremental implementation and the existing hardening plan marks this P0 as the next code priority. This plan is recorded before source edits. No commit or push is authorized.

### Verification outcome — 2026-10-02

- Implemented the shared fail-closed process probe and routed the Windows/macOS CLIs, Windows loopback plugin, and MCP status/live guards through it. Unknown/error states now raise `ProcessStateUnknown`; file writes and live actions stop, and status no longer reports unknown as `false`.
- Focused Python tests passed: **69 tests across 9 modules** (`test_process_guard`, `test_replay_safety`, `test_cli_live_safety`, `test_ai_contract`, `test_draft_engine`, `test_mcp_draft_readback`, `test_mcp_text_readback`, `test_mcp_contract_tools`, `test_smart_editing`). Python syntax compilation passed for 9 edited/new Python files; `git diff --check` passed.
- `test_local_plugin_security.py` could not run because Flask is not installed in this workspace. The Windows process command, REST plugin behavior, Windows installation, and actual CapCut process visibility have not been exercised on Windows; no live NLE claim is made.
- No CapCut process was launched/terminated, no project or media was changed, no dependencies were installed, and no commit/push was performed. Pre-existing working-tree edits and deletions remain preserved.

## P1: Add a read-only, evidence-based CapCut integration-surface catalog

- **WHY:** The Bridge currently reports its own tool capabilities but has no separate inventory of practical CapCut integration routes. A missing public desktop SDK must not end discovery. Current research establishes a first-party CapCut × Codex remote-MCP route (with regional limits), local/community draft APIs, and material safety limitations in one public desktop companion; none of these facts should be collapsed into the existing `CapabilityStatus` enum or presented as live CapCut verification. The README also still describes kill/relaunch/cache-clearing behavior and an Administrator install path that are not part of the hardened code and should no longer be recommended.
- **FILE:** Add `ai_contract/surface_map.py` and `docs/CAPCUT_SURFACE_MAP.md`; update `ai_contract/schemas.py`, `ai_contract/capabilities.py`, `ai_contract/dispatcher.py`, `bridge_system/bridge_server.py`, `bridge_system/service_manager.cjs`, `server.ts`, `src/components/AgentPipelinePanel.tsx`, `README.md`, `docs/ARCHITECTURE.md`, `bridge_system/README.md`, `docs/HARDENING_PLAN.md`; add focused contract/MCP/surface-map tests.
- **CURRENT BEHAVIOR:** The contract registry describes Bridge tools only (`available/unavailable/experimental`). MCP/REST/UI do not expose the ten requested CapCut integration families. README describes shutdown/cache clearing and asks for an elevated installer, despite the current safety policy. The current run has no access to the user's Windows CapCut process, IPC, accessibility tree, or active timeline.
- **NEW BEHAVIOR:** Add an independent `CapCutSurfaceStatus` model with exactly `FOUND`, `SUPPORTED`, `EXPERIMENTAL`, `UNVERIFIED`, and `UNAVAILABLE`; expose a fixed, read-only ten-pathway evidence map through a no-argument contract/MCP/REST operation and display it in the agent panel. Each entry records scope, evidence, limitations, whether runtime CapCut was tested, and a safe next probe. Include the current official remote-MCP route and region notes; distinguish Bridge/VectCutAPI services and draft JSON from a CapCut-owned live-editor API. Update documentation to prohibit treating disk JSON readback as in-app acceptance and to exclude arbitrary process/port probing, credentials, injection, patching, UIPI bypass, blind coordinates, Administrator execution, and implicit app close/relaunch.
- **RISK:** The inventory is a dated evidence snapshot, not a runtime detector or certification; public-source claims and compatibility may change. The official plugin is region-gated and was not installed or authorized. Community code was inspected read-only but not cloned, run, or security-audited; its current `desktop_companion.py` describes launching CapCut and hard-coded mouse coordinates, so that path is expressly not adopted. Static entries can become stale and must be reviewed when evidence or target CapCut version changes.
- **VERIFICATION:** Add tests for exactly ten entries, allowed independent statuses, safe-copy serialization, read-only dispatcher behavior, and MCP exposure/no file mutation; run focused Python tests and `git diff --check`. Check the REST allowlist and UI source statically. Frontend build, Flask-plugin tests, Windows/CapCut/UIA, user-account authorization, and all live probes remain explicitly unverified; do not install dependencies or run external implementations.

**Approval:** User's standing scope authorizes systematic discovery of all permitted CapCut routes while preserving the stated access-control and project-safety boundaries. This record is written before source/document edits. No commit or push is authorized.

### Verification outcome — P1 CapCut surface map — 2026-10-02

- Focused Python verification passed: **75 tests across 10 modules** (`test_process_guard`, `test_replay_safety`, `test_cli_live_safety`, `test_ai_contract`, `test_draft_engine`, `test_mcp_draft_readback`, `test_mcp_text_readback`, `test_mcp_contract_tools`, `test_smart_editing`, `test_capcut_surface_map`). Temporary test fixtures exercised the static map, independent status enum, read-only dispatcher/MCP response, and no-draft-mutation boundary.
- Node service-manager tests passed: **2 tests**, including the read-only surface-map call. `git diff --check` and Python syntax compilation for the six touched contract/MCP Python files passed.
- REST allowlist and React panel wiring were checked statically only. Frontend/TypeScript build was not run because frontend dependencies/toolchain are unavailable in this workspace. `tests/test_local_plugin_security.py` remains unrun because Flask is not installed.
- No Windows, live CapCut, IPC, UIA/QML, user account, region-egress, OAuth, or in-app draft acceptance probe was performed. No official plugin was installed; no external repository was cloned or executed; no dependencies were installed; no user project/media was changed; no CapCut process was started or terminated.
- No commit, push, restore, reset, or cleanup was performed. Existing working-tree modifications/deletions (including tracked bytecode state) remain preserved.

## P1: Define the subtitle-application scenario gate and integrity-level boundary

- **WHY:** The requested narrative test (“find the extra part and actually apply subtitles”) needs an explicit truthful stopping point. Until a CapCut-targeted adapter and an editor-side before/after readback source are demonstrated, execution must not be implied or attempted. Any UIA/QML inspection must occur in the user's interactive session at the same integrity level as CapCut; the cited Windows policy explains UIPI's same-level behavior and treats UIAccess as a controlled cross-level capability, not a workaround for this project.
- **FILE:** Update `ai_contract/surface_map.py`, `docs/CAPCUT_SURFACE_MAP.md`, `docs/ARCHITECTURE.md`, `docs/HARDENING_PLAN.md`, and `tests/test_capcut_surface_map.py`.
- **CURRENT BEHAVIOR:** EditPlan generation/preview is available, while `execute_edit_plan` and `verify_execution` are unavailable. The general map requires a disposable project and app-side verification but does not name the subtitle scenario or explicitly require same-user/same-integrity UI inspection.
- **NEW BEHAVIOR:** Mark subtitle application as analysis/preview-only until exact-version evidence proves a real CapCut adapter and reliable editor-side readback. After user confirmation, the first probe is read-only: record the exact CapCut version and inspect its actual UIA/QML surface in the same interactive user session and same integrity level. Any later test is one bounded operation on a disposable user-owned project, with backup and independent before/after readback. If there is no stable observable surface, keep the capability explicitly unsupported. Never elevate CapCut, use UIAccess to bypass UIPI, or otherwise circumvent integrity/access controls.
- **RISK:** A preview may be mistaken for an applied subtitle; UIA/QML controls vary by version and can be absent. Same-integrity read-only inspection may still provide no useful timeline state; this must remain a stop condition rather than prompting a workaround.
- **VERIFICATION:** Add a unit assertion that model guidance includes the scenario gate and the same-integrity/no-bypass constraint; run the focused surface-map test and `git diff --check`. Do not launch CapCut, probe UIA/QML, or mutate a project in this workspace.

**Approval:** User supplied this specific acceptance and integrity boundary on 2026-10-02. The rationale is recorded before source/document edits. No commit or push is authorized.

### Verification outcome — P1 subtitle scenario gate — 2026-10-02

- `tests.test_capcut_surface_map`, `tests.test_ai_contract`, and `tests.test_mcp_contract_tools` passed: **31 tests**. The guidance assertion covers the analysis/preview-only subtitle gate, same-integrity UI inspection, and no UIPI bypass.
- `git diff --check` and syntax compilation of `ai_contract/surface_map.py` and `ai_contract/dispatcher.py` passed.
- No UIA/QML, process, CapCut, subtitle, or user-project probe was run. The scenario remains analysis/preview-only; no adapter/readback claim is made.

### Independent local review — 2026-10-02

- Re-ran the focused Python suite: **75 tests across 10 modules passed**. The service-manager CommonJS test file passed **2 tests**. Python syntax compilation and `git diff --check` passed.
- A separate direct invocation of `tests/rate_limit.test.mjs` did not run its assertions: Node 20.20.2 stopped with `ERR_UNKNOWN_FILE_EXTENSION` while loading `server_rate_limit.ts`. The repository's `npm test` script currently selects `*.test.cjs`, so this `.mjs` test is not included in that script; frontend/node dependencies were not installed and no test-script change was made in this review.
- `tests/test_local_plugin_security.py` remains unavailable because Flask is not installed. No frontend build, Windows/CapCut, UIA/QML, IPC, OAuth, or real project test was run. The “CapCut is still running” line printed during the Python suite came from the replay safety test's mocked process state; no CapCut process was started or stopped.
- No inaccessible source was accessed, no credentials or private code were sought, and no clone/install/privilege bypass occurred. Existing working-tree modifications/deletions and bytecode state were left as found; no cleanup, restore, reset, commit, or push was done.

## P2: Restore the Windows x64 installer pipeline

- **WHY:** The user explicitly requested a Windows installer. The prior delivered ZIP is only a source archive; `install-all-win.bat` installs development prerequisites and starts `npm run dev`, not a packaged desktop installer. The current `package.json` advertises an NSIS target but references missing build inputs, so calling the project installer-ready would be inaccurate.
- **FILE:** Update `package.json`, `bridge_system/electron_main.cjs` and Windows packaging documentation as required; add `bridge_system/preload.cjs`, `scripts/build-win.mjs`, `scripts/build-python-services.py`, a valid `build/hs-tech-bridge.ico`, and focused packaging tests. Add or adjust only the runtime wiring required by the existing desktop entry point. Do not alter the static CapCut surface map or enable real timeline mutation.
- **CURRENT:** `npm run build:win` and `npm run build:python:win` target absent scripts; the Electron main config references an absent preload and absent bundled Python runtime; the configured Windows icon is absent; `npm start` targets `server-entry.cjs` while the server build emits `backend.cjs`. No Windows installer has been built or tested. The available workspace runner is Linux and initially has no installed npm dependencies or Windows installer toolchain.
- **NEW:** Make the NSIS x64 build reproducible on a supported Windows build host, with explicit prerequisites, correct artifact/runtime paths, per-user `asInvoker` installation, and a safe Electron preload contract. Keep the existing user data outside uninstall deletion. Ensure the installer build fails early with actionable messages when required files/tools are missing. Do not claim a verified `.exe` until a Windows build and clean-install smoke test succeed.
- **RISK:** Electron packaging and Python native dependencies (notably Windows-only automation libraries) are platform-sensitive. A Linux-only source/build check cannot prove Windows startup, uninstall, child-process launch, or CapCut behavior. Existing source modifications must be preserved. No Administrator elevation, implicit CapCut launch/termination, OAuth, or live project mutation is in scope.
- **VERIFICATION:** Run focused tests and static checks without resetting/cleaning the working tree; build renderer/backend where dependencies permit; verify generated package inputs and that the installer artifact contains the expected entry points. Attempt Windows packaging only if the available toolchain supports it; otherwise report the precise host-side command and leave the installer status as unverified. A real Windows smoke test remains required before describing the Setup as tested.

**Approval:** User explicitly authorized doing the necessary work on 2026-10-03. This plan is recorded before packaging source edits. No reset, cleanup, commit, or push is authorized.

### P2 verification addendum — include existing TypeScript/ESM tests

- **WHY:** The existing `npm test` glob excludes `*.test.mjs` and `*.test.ts`; the rate-limit test imports a `.ts` module and therefore requires the already-declared `tsx` loader. The Windows CI build should execute these tests instead of silently omitting them.
- **FILE:** Update the root `package.json` test script and add the corresponding focused packaging/preload tests under `tests/`.
- **CURRENT:** Only `tests/*.test.cjs` run in the Node stage; the rate-limit and TypeScript parser tests are skipped by the configured command.
- **NEW:** Use Node's test runner with `--import tsx` over the CJS, MJS, and TS test patterns before Python unittest discovery.
- **RISK:** Loader/version mismatches can make a test command fail before assertions; tests must be verified with the installed package versions before this is treated as a regression.
- **VERIFICATION:** Run the Node test command locally after installing the declared dependencies, then include it in the Windows workflow.

## P3: Remediate vulnerable build/runtime dependency graph

- **WHY:** After installing the declared dependency tree to verify packaging, `npm audit` reported 21 high and 1 critical finding across Electron/Electron Builder's build chain, plus 4 high findings in the production tree through Firebase's `@grpc/grpc-js`. The existing Electron 33 / electron-builder 25 declarations are not acceptable for a new Windows installer.
- **FILE:** Update root `package.json` and regenerate `package-lock.json`; adjust CI only if the current Node/Python pins conflict with supported package engines.
- **CURRENT:** Electron `^33.0.0`, electron-builder `^25.0.0`, Firebase `^12.19.0`; the current lock resolves vulnerable Electron/build transitive packages and `@grpc/grpc-js` <=1.13.5.
- **NEW:** Move to a current stable Electron/Electron Builder pair compatible with the existing Electron main/preload APIs, and pin a patched `@grpc/grpc-js` override without downgrading Firebase. Preserve the application's existing direct dependencies unless verification demonstrates a need to change them.
- **RISK:** Electron major upgrades may change runtime APIs or packaging behavior. A lockfile-only refresh is insufficient; rerun Node/Python tests, renderer/backend build, TypeScript lint, and packaging preflight. A native Windows installer build and smoke test are still required.
- **VERIFICATION:** `npm ci`; `npm audit` with no high/critical findings; `npm test`; `npm run build:desktop`; `npm run lint`; Node/Python syntax and Windows packaging preflight. Do not claim the Windows installer is built on this Linux host.

**Approval:** The user authorized the necessary finalization work on 2026-10-03. This dependency-change rationale is recorded before package/lockfile edits. No reset, cleanup, commit, or push is authorized.

### P3 audit adjustment — residual development-only advisory (2026-10-03)

- **WHY:** After upgrading Electron/Electron Builder and overriding `@grpc/grpc-js`, production audit is clean. Full-tree audit still reports 8 high entries, all cascading from `http-cache-semantics@4.2.0` through electron-builder's build-only `app-builder-lib -> @electron/get@3 -> got -> cacheable-request` chain. npm registry and advisory lookup show no patched `http-cache-semantics` release as of this check; do not invent an override or downgrade the patched packager to silence the audit.
- **FILE:** CI audit step and this record. No dependency downgrade is planned.
- **CURRENT:** `npm audit --omit=dev --audit-level=high` reports 0 vulnerabilities. `npm audit` reports the unpatched high advisory only in development/packaging tools; no critical findings remain after the Electron Builder update.
- **NEW:** CI will explicitly fail on high/critical production findings and on critical findings anywhere in the dependency tree. The development-only high advisory remains visible in full audit output until upstream publishes a fix.
- **RISK:** Build tooling that uses the affected cache semantics could be exposed in a shared-cache scenario. CI jobs should remain isolated; do not feed attacker-controlled `max-stale` cache directives into a shared cache. Re-check the advisory before each release.
- **VERIFICATION:** Re-run both audit commands after lockfile installation, plus the tests and build preflight. The native Windows installer still requires a separate Windows runner.

## Verification outcome — Windows installer path and P3 dependency update (2026-10-03)

- Confirmed PyPI's current PyAutoGUI release is `0.9.54`; retained the pin.
- Generated `package-lock.json`; ran clean `npm ci` using Node `24.21.0` (npm `10.8.2`) after updating the supported engine floor. The resolved versions are Electron `44.5.1`, electron-builder `26.15.3`, and overridden `@grpc/grpc-js` `1.14.5`.
- `npm test`: **15 Node tests passed** and **83 Python tests passed**. The Python test run used Flask `3.1.3` in the sandbox; the Windows workflow installs the full pinned build requirements before tests.
- `npm run build:desktop`: passed (Vite + esbuild). Vite emits a non-fatal warning: the minified JavaScript chunk is about 1.15 MB, above its 500 kB advisory threshold.
- `npm run lint` (`tsc --noEmit`): passed.
- `npm audit --omit=dev --audit-level=high`: passed, 0 vulnerabilities. `npm audit --audit-level=critical`: exited successfully with no critical issues; it still reports 8 high entries from the single unpatched, build-only `http-cache-semantics@4.2.0` advisory documented above.
- `npm run build:win:check`, `python scripts/build-python-services.py --validate-only`, JavaScript syntax checks, Python compilation checks, and `git diff --check`: passed.
- `npm run build:win` was attempted on Linux and correctly stopped after preflight with “A native Windows x64 runner is required”; it did not cross-build. **No Windows runtime bundle or `.exe` installer exists yet.** The new GitHub Actions workflow has not run.
- No interactive Windows install, launch, uninstall, signing, CapCut-live, or official timeline-integration test was possible here. The installer path remains unverified until a Windows x64 runner builds it and a clean Windows smoke test succeeds.
- Existing modified/untracked workspace files were preserved. No cleanup, reset, commit, or push was performed.

### P2 Windows command-wrapper review — before edit (2026-10-03)

- **WHY:** Static review found that the Windows build orchestrator inserts per-argument quotes inside the string passed to `cmd.exe /s /c`, creating a nested-quote boundary that cannot be exercised on the Linux host.
- **FILE:** `scripts/build-win.mjs` only.
- **CURRENT:** `runNpm()` quotes each fixed argument, then passes the resulting command string as one argument to `cmd.exe`.
- **NEW:** Restrict this helper to the known static npm-script tokens and pass the plain `npm.cmd run <script>` command through `cmd.exe /d /s /c`, avoiding unnecessary nested quotes.
- **RISK:** Windows command parsing is not directly available in this environment; the CI runner remains the validation point.
- **VERIFICATION:** Re-run Node tests, syntax checks, preflight, and diff checks. Keep the explicit native Windows build/smoke limitation.

### P2 command-wrapper verification and handoff — 2026-10-03

- After simplifying the `cmd.exe` wrapper, reran `npm test` under Node 24.21.0: **15 Node + 83 Python tests passed**. `npm run build:win:check`, Python bundler `--validate-only`, JavaScript/Python syntax checks, workflow YAML parsing, and `git diff --check` passed.
- Created `/home/user/HS.Tech-CapCut-Bridge-Windows-Installer-Source-2026-10-03.zip` as a source/build-pipeline handoff. It passed ZIP integrity and required-input checks. The archive excludes `.git`, dependency/build/cache folders and contains no installer binary; its final SHA-256 is reported in the handoff.
- This handoff is not a substitute for the requested Setup.exe. A native Windows x64 build and interactive install/start/uninstall verification remain outstanding.

## P4: Non-invasive security and release-readiness audit — before report

- **WHY:** The user requested an independent reviewer/security-auditor assessment of the current Windows installer work and project boundary.
- **FILE:** Add `docs/AUDIT_REPORT_2026-10-03.md`; update this record with only the audit scope and verified findings.
- **CURRENT:** The Windows build pipeline is source-complete enough for preflight, but no `.exe` or Windows smoke-test result exists. Prior local tests/audits were recorded; no live CapCut or Windows host is available.
- **NEW:** Re-check project manifests, packaging scripts, Electron/preload boundaries, loopback APIs, dependency audits, test results, and ZIP integrity using static/local non-destructive checks only. Report severities, evidence, limitations, and next actions; do not modify product code under the audit label.
- **RISK:** Static analysis cannot establish behavior on a user's Windows machine or prove CapCut timeline integration. Running external builds, process probes, intrusive scans, credential extraction, injection, elevation/UIPI bypass, or editing user projects is out of scope.
- **VERIFICATION:** Rerun test/audit/preflight commands without cleaning or resetting the working tree; verify the archive checksum and confirm whether any `.exe` exists. Preserve all existing modifications and do not commit or push.

### P4 audit outcome — 2026-10-03

- Added `docs/AUDIT_REPORT_2026-10-03.md` with a static/local security and release-readiness assessment, evidence paths, severity levels, limitations, and prioritized follow-up. No product source code was changed as part of the audit.
- Re-ran `npm test` after restoring the declared Node dependencies and the test-only Flask dependency: **15 Node + 83 Python tests passed**. `npm run build:desktop`, `npm run lint`, Windows/Python preflights, `pip-audit -r requirements-win-build.txt`, and archive integrity checks passed.
- Current audit results: no `.exe`; production npm audit reports 0; complete npm audit shows 8 high entries from the documented build-only `http-cache-semantics` chain and 0 critical; Python audit ran on Linux and therefore did not evaluate the Windows-marked `pywin32` dependency.
- No live network/process/CapCut probing, credential access, injection, privilege bypass, user project modification, cleanup, restore, reset, commit, or push was performed.

## P5: Replace stale in-app source archive before public release — before edit (2026-10-03)

- **WHY:** The app's download button serves `public/hs-art-tech-bridge.zip`. Static inspection shows this ZIP contains an older bundle dated 2026-09-29 that instructs users to run as Administrator, kill/relaunch CapCut and clear its cache, and claims direct timeline automation. Those claims conflict with the current README and safety policy. The fallback URL `/capcut-bridge-kit.zip` also does not exist in `public/`.
- **FILE:** Preserve the old ZIP outside the served tree; add a reproducible `scripts/package-source.py`; replace `public/hs-art-tech-bridge.zip` with a current source-only archive; update `src/App.tsx`, `src/components/BridgeStudioPanel.tsx`, `package.json`, and the lockfile if license metadata is added.
- **CURRENT:** The public asset contains stale instructions and old Electron/installer dependencies. The root has an MIT `LICENSE` and README badge, but root `package.json` does not declare `license`.
- **NEW:** Rebuild the download ZIP from current first-party repository files, excluding itself, `.git`, dependencies, generated output, caches, release artifacts, environment files and executables. Label it clearly as source-only, not a Setup.exe. Keep a recoverable copy of the previous asset; do not delete/reset it.
- **RISK:** The ZIP can become stale again if not regenerated after source changes. The MIT license only covers code/assets the project has rights to license; it does not authorize copying unrelated third-party proprietary code. No GitHub push is part of this change.
- **VERIFICATION:** Inspect the new archive listing and hash; assert it contains the current LICENSE, README, lockfile, installer scripts and workflow; assert it excludes the old nested ZIP, `.exe`, `.env`, `node_modules`, build/cache folders; run archive packager twice or validate integrity, then rerun Node/Python tests and Vite/lint as feasible.

### P5 scope adjustment — disable legacy Windows auto-setup claims before edit (2026-10-03)

- **WHY:** Additional UI review found the Windows Plugin tab still advertised `install-plugin-win.bat` as a one-click installer and claimed arbitrary apps could fully control CapCut as a professional plugin. The old script globally installs Python packages, mutates the user's PATH, and creates a persistent Desktop daemon shortcut; it is not the NSIS app installer. The React code tester also sends real loopback requests, so its descriptions must not imply editor-side verification.
- **FILE:** `install-plugin-win.bat`, `src/data/bridgeSource.ts`, `src/App.tsx`, `src/components/CodeViewer.tsx`, `src/components/WindowsPluginGuide.tsx`, `src/components/EditingMastery.tsx`, `README.md`, and root `package.json`/lock metadata.
- **CURRENT:** The legacy script is directly downloadable from the UI and its code is shown as an active automated installer; several UI claims contradict the README and surface map.
- **NEW:** Preserve the old script separately; replace the tracked legacy script with a harmless deprecation notice; remove the misleading one-click installer action; label the page as a local/dev-only helper; accurately state loopback and unverified results; declare the already-present MIT license in package metadata.
- **RISK:** Some existing users may rely on the old helper; preserving the original outside the served project allows recovery without continuing to distribute it as an active installer. This does not introduce a CapCut live adapter.
- **VERIFICATION:** Run TypeScript lint, Node/Python tests, and production renderer build; check the source archive for recursive/stale ZIP, active installer instructions, and `.exe`; keep all behavior descriptions consistent with the non-live integration boundary.

### P5 packaging-script correction — before edit (2026-10-03)

- **WHY:** First execution of `scripts/package-source.py` exposed a self-inclusion bug: its temporary archive was created under `public/` before the lazy `rglob` file walk, so the walk tried to include the archive while it was being written and eventually failed with `ENOSPC`. `os.replace` was never reached; the old public ZIP remains intact and the script removed only its own incomplete temporary file.
- **FILE:** `scripts/package-source.py` only.
- **CURRENT:** The walk skips the final output path but not the differently named temporary output.
- **NEW:** Exclude the temporary-name prefix (and/or materialize a source-file list before opening the temporary archive) so the output can never recursively include itself.
- **RISK:** A second uncontrolled run could waste disk again; validate the corrected filter with a temp output before replacing the public asset.
- **VERIFICATION:** Unit-test archive generation to a temporary destination; assert bounded archive size, integrity, no nested ZIP, and no temp/self entry. Only then generate the public source ZIP.

### P5 source handoff refresh — before overwrite (2026-10-03)

- **WHY:** The previously prepared external source handoff (`/home/user/HS.Tech-CapCut-Bridge-Windows-Installer-Source-2026-10-03.zip`) still contains the stale 34 KB public ZIP and the original active `install-plugin-win.bat`; updating only `public/hs-art-tech-bridge.zip` does not refresh that separately delivered archive.
- **FILE:** External source handoff ZIP only; refresh `docs/AUDIT_REPORT_2026-10-03.md` with the result after regeneration.
- **CURRENT:** 120 entries, SHA-256 `deb28c1bba2f0ae20ab7df241155bbb023570cd0dde19fd75c8b3460e593f2da`.
- **NEW:** Preserve the previous handoff as a backup, then regenerate it from the current repository using `scripts/package-source.py`; the packager excludes nested ZIPs and disabled legacy install helper content is current.
- **RISK:** Overwriting loses the previously delivered snapshot unless backed up; regeneration must not include its own temporary output or any executable installer.
- **VERIFICATION:** Check the new hash, ZIP integrity, entry count, no nested ZIP/.exe/secret/cache, and inspect the current README and disabled helper inside the archive. No Setup.exe should be implied.

### P5 legacy helper follow-up — before edit (2026-10-03)

- **WHY:** The refreshed source snapshot also contains an older, separate `bridge_system/setup.bat` that upgrades pip, installs packages into the ambient Python environment and starts a prototype HTTP server; `bridge_system/install.sh` similarly changes the Python environment. The nested `bridge_system/package.json` advertises an unsupported Electron 33 / electron-builder 25 multi-NLE product. These files are not used by the repository-root installer, but their names and metadata could mislead users or trigger unintended installs.
- **FILE:** `bridge_system/setup.bat`, `bridge_system/install.sh`, `bridge_system/package.json`, and `bridge_system/README.md`.
- **CURRENT:** The two helpers actively install dependencies; the nested package metadata looks like a supported, separate installer despite not being referenced by the root build.
- **NEW:** Preserve the old files outside the repository, turn the two legacy setup helpers into explicit no-op warnings, make the nested package private/deprecated with no dependencies/scripts, and document the root package as canonical. Do not remove the legacy daemon source; state that it is not the current packaged runtime.
- **RISK:** Retiring unsupported entry points may affect someone who still used the prototype manually; no in-repository documentation references these helpers. Backup copies will remain available outside the repository.
- **VERIFICATION:** Check the helpers contain no install/start commands, parse nested package metadata, search for references, rerun tests/lint/build/preflight, regenerate and inspect both source archives. No Windows/CapCut runtime claim will be made.

### P5 verification results (2026-10-03)

- **WHY:** Record the completed verification for the public-source handoff and disabled legacy helpers.
- **FILE:** `public/hs-art-tech-bridge.zip`, `scripts/package-source.py`, `tests/test_source_archive.py`, the P5 UI/docs files, and the external source handoff archive.
- **CURRENT:** The first packager run failed while recursively reading its own temporary ZIP. It did not replace the prior public archive. The old public ZIP, prior external source handoff, and prior legacy helpers were copied outside the repository before replacement.
- **NEW:** The corrected packager snapshots its input list before creating the temporary output, rejects nested ZIPs and installer/cache/secret files, and asserts required inputs. It also requires and tests the disabled helper stubs. The refreshed public ZIP and external source handoff are source snapshots only; neither contains Setup.exe.
- **RISK:** The root developer helper `install-all-win.bat` remains active by design; it may use `winget` and install Python dependencies into the active environment. README now discloses this. The legacy `bridge_system/electron_main.js` source is retained for reference but is explicitly documented as unsupported/not part of the current package.
- **VERIFICATION:** On Node `v24.21.0` / npm `10.8.2`, clean `npm ci --no-audit --no-fund` succeeded; `npm test` passed 15 Node + 84 Python tests; `npm run lint`, `npm run build:desktop`, `npm run build:win:check`, Python packager validation, source-archive test, and `git diff --check` passed. Vite still warns about a ~1.15 MB JS chunk. Production npm audit: 0 findings; full audit: 8 high findings in the existing `http-cache-semantics@4.2.0` build-tool chain, with no forced downgrade. No `.exe` build, Windows smoke test, CapCut live test, commit, push, or public release occurred. Current artifact checksums are provided in the delivery handoff, not embedded inside their own source ZIP.

Backups outside the repository: previous in-app ZIP `legacy-public-hs-art-tech-bridge-2026-10-03.zip` (SHA-256 `e7003c4624fbde2be0b9649ec0ea40e6811af199f1ca37d38abd64229709c995`); previous root helper `legacy-install-plugin-win-2026-10-03.bat` (`0d1909618ecc2b50865a037ff2a589d42ff71642501f83639493c2d76fbea06d`); previous source handoff `legacy-source-handoff-2026-10-03.zip` (`deb28c1bba2f0ae20ab7df241155bbb023570cd0dde19fd75c8b3460e593f2da`); previous bridge-system helpers/metadata: setup `.bat` (`e322f21f25d995718337fc393d3939166135798ffedd9d8ddb99a952fa4564f6`), install `.sh` (`87a9447c540242fc66b070e8cf77ff175d40c5d002f2c0d266320ac1e92b9653`), nested package metadata (`2cf4552c187640f1a29e88f9ce84ee9048a9f5e9fa3c1f2c4e43852e6ca57042`).

### Windows release verification runner — before edit (2026-10-03)

- **WHY:** The user can provide a Windows x64 + CapCut environment. To reduce repeated manual setup and prevent installing build dependencies into the global Python environment, provide one bounded command that performs the real Windows build and returns a log/hash for review.
- **FILE:** Add `scripts/verify-windows-release.ps1`; update `docs/WINDOWS_INSTALLER_BUILD.md`, `scripts/package-source.py`, and `tests/test_source_archive.py` so the runner is distributed and required in the source snapshot.
- **CURRENT:** The repo has separate Windows build commands and a manual checklist; no one-command isolated environment exists. This Linux workspace has no PowerShell, Windows, or CapCut, so the new script cannot be executed here.
- **NEW:** PowerShell runner checks Windows x64, Node/npm and Python versions; creates a temporary Python venv; installs pinned build dependencies there; runs npm install/audits/tests/lint/source packaging/Windows build; writes installer SHA-256 and a transcript under `release/validation`; removes only its temporary venv. It will not run the installer, launch/modify CapCut, elevate, or change global Python packages.
- **RISK:** The runner downloads npm/Python dependencies and writes repository-local ignored `node_modules`/`release` build artifacts. Windows-native execution remains a required verification step; script success alone does not prove interactive install/uninstall or CapCut timeline acceptance.
- **VERIFICATION:** Review PowerShell syntax/command flow statically in Linux; run Python source-archive unit test and ensure the new runner is included. Explicitly disclose that only a Windows run can validate the script and produce the installer. No push/release will occur.

### Windows workflow uses the one-command runner — before edit (2026-10-03)

- **WHY:** Avoid maintaining a separate CI command sequence that can drift from the new Windows release runner; let a real Windows GitHub runner execute the same script and surface PowerShell/runtime errors.
- **FILE:** `.github/workflows/windows-installer.yml` only.
- **CURRENT:** Workflow repeats dependency installation, audits, tests, build, and checksum creation as separate steps; the runner script has not yet executed on Windows.
- **NEW:** Keep the Windows x64, Node 24, and Python 3.11 setup; invoke `scripts/verify-windows-release.ps1`; upload the generated installer, SHA-256 sidecar, and transcript log. Do not create a GitHub Release or push source.
- **RISK:** The workflow still needs a manual dispatch or push to run; CI can verify build automation but cannot prove interactive installation/uninstall or live CapCut timeline behavior. High build-only npm findings remain below the workflow's critical-failure threshold.
- **VERIFICATION:** Review YAML and paths locally; workflow execution itself remains pending a user-triggered Windows run. No credentials will be requested or used.

### Windows runner/workflow verification status (2026-10-03)

- **WHY:** Record what is locally verified versus what still requires the Windows environment the user can provide.
- **FILE:** `scripts/verify-windows-release.ps1`, `.github/workflows/windows-installer.yml`, `docs/WINDOWS_INSTALLER_BUILD.md`, `scripts/package-source.py`, and `tests/test_source_archive.py`.
- **CURRENT:** The helper/workflow changes are present; this Linux workspace has no `pwsh`, Windows x64, or CapCut, so no Windows-native parser/build/installation run has occurred.
- **NEW:** The PowerShell runner isolates Python build dependencies in a temporary venv; the workflow calls it and uploads the installer, checksum, and transcript (including failure logs). It deliberately does not execute the installer or interact with CapCut.
- **RISK:** Static review cannot prove PowerShell runtime correctness. The user-triggered Windows run and manual install/start/stop/uninstall test are still required; timeline behavior remains unverified and unsupported by the current project claims.
- **VERIFICATION:** Linux-side `npm test` passed 15 Node + 84 Python tests after the source-packager changes; `npm run lint`, `npm run build:desktop`, `npm run build:win:check`, Python packaging preflight, and `git diff --check` passed. The source ZIP will be regenerated after these records; its final SHA-256 is supplied in the handoff, not embedded in itself. No commit, push, or release was made.

### Public-staging whitespace cleanup — before edit (2026-10-03)

- **WHY:** The first staged-diff check identified trailing Markdown spaces in two newly added docs; remove them before the public commit.
- **FILE:** `docs/AUDIT_REPORT_2026-10-03.md` and `docs/CAPCUT_SURFACE_MAP.md` only.
- **CURRENT:** Four metadata lines contain trailing spaces for Markdown hard breaks.
- **NEW:** Remove trailing spaces/tabs only; leave all prose and meaning unchanged.
- **RISK:** Formatting-only change; no code/runtime behavior changes.
- **VERIFICATION:** Re-stage and require `git diff --cached --check` to be clean; regenerate the source ZIP after the docs are normalized.
