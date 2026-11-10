# HS.Tech Bridge — Architecture as inspected

**Status:** repository-level architecture map, 2026-10-02. This is not a claim of a successful Windows install or live CapCut timeline integration. It records code paths found before consolidation; UIA/CapCut findings about HWND `396244` and `QQuickWindow` come from the prior Windows investigation and were not reproduced on this Linux host.

## Intended product path

```text
React renderer
  └─ same-origin fetch (/api/*)
      └─ server.ts (Express; loopback/Origin checks)
          └─ Electron main process (production entry)
              ├─ BridgeServiceManager
              │   ├─ MCP stdio child → bridge_system/bridge_server.py
              │   │   ├─ bridge_contract_* → ai_contract.ContractDispatcher
              │   │   │   └─ get_capcut_surface_map → static, read-only evidence inventory
              │   │   └─ legacy CapCut tools → Python CLI / process probes
              │   └─ Windows Flask plugin child → capcut-plugin-win.py :8765
              └─ secure credential store, per-user logs, BrowserWindow
```

`server.ts` accepts a `BridgeController` dependency. The Electron entry intends to inject `BridgeServiceManager`; standalone `npm run dev` creates the app without one, so desktop project/MCP routes are unavailable in that mode. The Electron entry expects built `dist/` and `build/desktop/backend.cjs` artifacts.

## Existing executable paths

| Entry point | Calls | Scope / boundary |
|---|---|---|
| `npm run dev` → `tsx server.ts` | Express + Vite at loopback | Development UI/API; no desktop service manager is injected by default. |
| `bridge_system/electron_main.cjs` | Built Express app + `BridgeServiceManager` | Intended production desktop launcher. It manages MCP and the Windows plugin as child processes; it is not a registered Windows Service. |
| `python bridge_system/bridge_server.py --mcp` | Custom stdio JSON-RPC | Exposes legacy CapCut tools and `bridge_contract_*` tools. |
| `capcut-bridge-win.py`, `capcut-bridge.py` | Python argparse CLIs | File-lane JSON edits and limited foreground-guarded keyboard actions; separate from `ContractDispatcher`. |
| `python capcut-plugin-win.py` | Flask on `127.0.0.1:8765` | Process/status/draft routes and guarded keyboard events; directly calls Windows automation, not the contract dispatcher. |
| `chatgpt-capcut-server.py` | FastAPI on its configured local port | Duplicate REST wrapper that invokes a fixed CLI path directly. |
| `python bridge_system/bridge_server.py --port 8766` | Sample HTTP server | Health/status, unsupported sync, and sample LUT; not an NLE adapter. |
| `bridge_system/electron_main.js` | Legacy tray entry | Starts the sample HTTP service separately from the newer Electron path. |

## Current contract boundary

`ai_contract.ContractDispatcher` validates typed envelopes and routes project inspection, timeline/media/subtitle readback, heuristics, EditPlan creation/validation/preview, receipt lookup, and the static `get_capcut_surface_map` inventory. The integration-surface status enum is independent from the tool `CapabilityStatus` enum. `execute_edit_plan` and `verify_execution` are registered as unavailable. Receipts are in-memory. The dispatcher does not currently own all CLI, MCP, plugin REST, or UI command execution.

The desktop `server.ts` contract route calls `BridgeServiceManager.callContract()`, which sends `bridge_contract_<operation>` over the MCP stdio client. The agent panel uses that REST route for capabilities, the evidence map, and plan/validate/preview; the REST allowlist includes `list_projects` and `get_capcut_surface_map`, and the dashboard project index also uses the typed contract through the manager. The surface-map call returns a dated static snapshot: it does not inspect the host or execute suggested probes. The backward-compatible `list_capcut_projects` MCP tool adapts project summaries to its old `{projects, count}` result. Legacy timeline inspection and other project CLI/plugin routes still bypass the contract.

## Duplicate paths recorded before consolidation and their current status

1. Project listing (pre-P1): Windows plugin `GET /api/v1/drafts`; MCP `list_capcut_projects`; `BridgeServiceManager.listProjects()` preferred plugin REST then fell back to an independent MCP filesystem scan; Python CLIs also list project directories. After P1, the desktop manager calls `bridge_contract_list_projects`; legacy MCP `list_capcut_projects` delegates to that core operation but keeps `{projects, count}`. The plugin endpoint and CLI list commands remain separate surfaces; the dashboard no longer probes `/api/v1/drafts`.
2. Project/timeline inspection (still duplicated): `ContractDispatcher.inspect_project/inspect_timeline`; legacy MCP `inspect_capcut_timeline` with `_read_timeline_summary`; `BridgeServiceManager.inspectProject()` uses the legacy MCP tool; CLI list commands perform their own filesystem reads.
3. Mutations: desktop REST project/text routes → manager → legacy MCP create/text tools → CLI; FastAPI endpoints → CLI; direct CLI invocations; plugin REST split/play/export → `pyautogui`; natural-language REST uses a separate TypeScript parser and allowlist before dispatching legacy MCP tools.
4. Sample surfaces: port 8766 REST and old tray daemon are not the live Windows plugin or a CapCut editing adapter. UI command previews do not execute.

## Trust and verification boundaries

- Same-origin/loopback protections reduce browser-origin exposure; the local plugin does not provide native-client authentication. Mutation confirmation is not uniform across REST/MCP/CLI paths.
- Process/focus detection is not active-project or timeline readback. The prior UIA inspection exposed `MainWindow.surface_main → QQuickWindow`, not timeline controls.
- Draft JSON readback proves only what was written to disk. It does not prove that CapCut loaded, displayed, or rendered the change.
- A successful keyboard API call proves only that an event was sent. Playback/split/export state and export output are not verified.
- `get_capcut_surface_map` is a dated evidence inventory, not a live detector or support certification. `FOUND` does not mean `SUPPORTED`; its next-probe text is descriptive and is not auto-executed.
- Bounded, read-only, user-authorized inspection of the user's own local CapCut installation may be used to discover practical surfaces. UIA/QML inspection must be in the same interactive user session and at the same integrity level as CapCut. Do not send trial requests to unknown endpoints or perform broad scans. Never extract credentials/tokens, read process memory, inject, patch binaries, bypass UIPI/access controls, use UIAccess as a cross-level workaround, use blind coordinates, or run CapCut elevated.
- Do not close, kill, relaunch, or restart CapCut implicitly as a discovery or edit step. Any future black-box test requires a disposable project, backup, separate disk readback, and explicit verification in the actual CapCut UI. A subtitle request such as “find the extra part and actually apply subtitles” remains analysis/preview-only unless a real CapCut adapter and reliable editor-side before/after readback are demonstrated; if no stable accessible surface exists, keep application unsupported.

## P1 consolidation implemented

`list_projects` is now a provider-neutral, read-only contract operation that uses only the current account's standard draft root. It examines direct-child safe draft folders, returns disk metadata without absolute paths, marks unreadable/malformed drafts with `read_error`, and skips hidden/unsafe/symlink folders. `BridgeServiceManager.listProjects()` now calls `bridge_contract_list_projects`; the old `list_capcut_projects` MCP name delegates to the same contract and retains its `{projects, count}` shape for compatibility. This operation does not identify the project open in CapCut or prove a CapCut UI edit. The formal WHY/FILE/baseline/target/risk/verification record is in `HARDENING_PLAN.md` and `CHANGE_RECORD.md`.

## CapCut integration-surface inventory added

`ai_contract.surface_map` now owns the separate five-value pathway status model and ten evidence records. `get_capcut_surface_map` is read-only and is exposed through `ContractDispatcher`, the MCP stdio contract tools, the desktop read-only REST allowlist, and the Agent Pipeline panel. The current snapshot identifies CapCut × Codex as a documented, region-gated official remote-MCP workflow; it keeps local IPC, UIA/QML, and direct CapCut protocols unverified unless target-host evidence exists. Community draft tools are not treated as official APIs. The map records the VectCutAPI desktop-companion behavior that conflicts with Bridge policy, and the README no longer instructs Administrator execution or describes implicit shutdown/cache deletion.

The map does not run runtime probes. Its evidence is static, dated 2026-10-02; no live Windows/CapCut, account/OAuth, UIA, IPC, or draft-acceptance test was performed. Premiere and DaVinci Resolve remain reference architectures only, not targets for new adapters. See `docs/CAPCUT_SURFACE_MAP.md` for the detailed matrix and bounded future verification procedure.

## Windows installer pipeline — source status 2026-10-03

The NSIS x64 packaging path is now wired in source. `npm run build:win` builds the React renderer and API bundle, runs the Windows-only PyInstaller bundler for a console-capable MCP/plugin runtime, then invokes electron-builder for a per-user NSIS installer. `bridge_system/preload.cjs` provides only narrow IPC wrappers; the Electron renderer keeps context isolation and node integration disabled. The icon is under `assets/` so it is source-controlled rather than hidden in a generated `build/` directory. The installer is configured `asInvoker`, per-user, and does not delete per-user data on uninstall. `install-all-win.bat` is explicitly only a developer setup helper, not the product installer.

Local Linux checks passed for renderer/API bundling, TypeScript, packaging preflight, and tests. The actual Windows build has **not** been produced: the build script deliberately refuses cross-builds, and this workspace has no native Windows runner. Use a native Windows x64 host with Python 3.11, run `npm ci`, install `requirements-win-build.txt`, then run `npm test` and `npm run build:win`. Alternatively, run the `Windows x64 installer` GitHub Actions workflow after these source changes are pushed to the repository. Until a native build and clean install/start/uninstall smoke test pass, no `.exe` should be described as tested. The installer is unsigned; public distribution needs a code-signing certificate. This packaging does not add a CapCut live timeline adapter; real subtitle application remains unsupported/preview-only.
