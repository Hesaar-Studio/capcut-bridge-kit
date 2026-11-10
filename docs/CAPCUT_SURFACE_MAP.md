# CapCut integration-surface inventory

**Evidence snapshot:** 2026-10-02
**Target:** CapCut Desktop. Premiere Pro and DaVinci Resolve are architecture references only; this inventory does not propose adapters for them.
**Runtime state:** No live Windows/CapCut probe was run. The target CapCut version, user account access, open project, IPC endpoints, and accessibility tree are unknown.

This inventory is a discovery aid, not a capability guarantee. The same data is exposed through the read-only `get_capcut_surface_map` contract/MCP operation and the Agent Pipeline panel. It does not scan processes, ports, pipes, drafts, accounts, or networks, and it does not execute the suggested probes.

## Status vocabulary

| Status | Meaning |
|---|---|
| `FOUND` | A concrete document, implementation, service, or artifact exists. Existence alone does not prove support or successful CapCut use. |
| `SUPPORTED` | The vendor documents/supports the route within the stated scope. The user's account and runtime may still be untested or region-gated. |
| `EXPERIMENTAL` | A community or fragile implementation exists, or the route is version-sensitive; it is not accepted as dependable without isolated testing. |
| `UNVERIFIED` | Plausible or partially observed, but not verified on the target installation. This is not a claim that the route is absent. |
| `UNAVAILABLE` | Positive evidence says the route is unavailable in the precisely stated scope; do not generalize beyond that scope. |

## Ten-pathway assessment

| # | Pathway | Status | Finding and boundary |
|---:|---|---|---|
| 1 | Official API / first-party plugin | `SUPPORTED` | CapCut documents CapCut × Codex, backed by the official remote MCP endpoint `https://www.capcut.com/api/external_mcp`; this is not a generic local desktop SDK. It is region-gated: the product page says available outside the U.S.; the published plugin runbook says to skip authorization for U.S. network egress. No account check, install, OAuth, or request was made. A generic public desktop timeline SDK was not located in the official pages reviewed; that does not prove none exists privately or later. |
| 2 | Local IPC | `UNVERIFIED` | No CapCut-owned pipe/socket or process-level IPC evidence is available. No target Windows/macOS host was inspected. Bridge/VectCutAPI services do not count as CapCut-owned IPC. |
| 3 | Extension / in-app plugin surfaces | `UNVERIFIED` | The official Codex plugin is an external Codex integration; it does not establish a general in-editor CapCut extension SDK. No public, versioned desktop plugin manifest/SDK for timeline editing was validated. |
| 4 | Accessibility / UI Automation | `EXPERIMENTAL` | HS.Tech Bridge has foreground-guarded keyboard shortcuts; sending a key is not timeline readback. A CapCut UIA/QML tree proving editable timeline controls was not reproduced. Blind-coordinate automation is excluded. |
| 5 | Local services | `FOUND` | The Bridge has a loopback Flask service and local MCP server. VectCutAPI documents a local HTTP backend used by its MCP wrapper. These are adapter processes, not CapCut-owned services or proof of an open-editor connection. No service was launched or contacted during this audit. |
| 6 | Project / Draft format | `FOUND` | Bridge code reads/writes CapCut-style draft JSON including `draft_content.json`; VectCutAPI documents draft output profiles. This is evidence of file artifacts and community implementations, not an official versioned schema. Compatibility with the user's CapCut build is unknown. |
| 7 | File-based timeline manipulation | `EXPERIMENTAL` | Bridge writes use backup, atomic JSON replacement, and disk readback; existing-project writes refuse while CapCut is running. Disk readback does **not** show that CapCut loaded, displayed, or rendered the edit. No live acceptance test has been run. |
| 8 | Local communication protocols | `UNVERIFIED` | MCP stdio and local REST/JSON are found between agents and Bridge/service wrappers, but no CapCut-owned local RPC/WebSocket/pipe protocol was verified. Wrapper protocols must not be mislabeled as direct CapCut communication. |
| 9 | Public / open-source implementations | `EXPERIMENTAL` | VectCutAPI and an Atx-Guy MCP wrapper are public research leads. Their README claims are not independent proof. Static review found VectCutAPI's desktop companion can launch CapCut and uses hard-coded mouse coordinates; this path conflicts with Bridge guardrails and is not adopted. Code was not cloned, run, or fully security-audited. |
| 10 | Black-box behavior analysis | `UNVERIFIED` | No live CapCut session, version, disposable project, or UI/readback evidence was available. A bounded, user-authorized disposable-project test remains a future step. |

### Official integration: regional and product scope

The first-party CapCut × Codex page describes draft creation, conversational timeline refinement, and opening CapCut for hands-on editing. Its hosted installation skill identifies plugin version `0.2.0`, registers `capcut_creation` against the official remote MCP URL, and separates installation from user-controlled OAuth. The same official materials currently say the workflow is available outside the U.S.; the installer runbook says not to authorize from a network detected as U.S. Accordingly:

- Overall pathway status: `SUPPORTED` within CapCut's documented supported scope.
- U.S. network egress: `UNAVAILABLE` per the published runbook; the current egress of this user's machine was not checked.
- User/account access: `UNVERIFIED` until the user completes the official flow in a supported region.
- Bridge integration: not implemented; this inventory has not installed the plugin or handled OAuth.

### Community implementation notes

The [VectCutAPI README at commit `6fd83c5`](https://github.com/sun-guannan/VectCutAPI/blob/6fd83c5aaebecf52bafb242e57a64a0b07123ca6/README.md) (updated August 2026) claims cloud editing APIs and CapCut/Jianying draft export. Its [MCP server documentation at commit `e4f45a0`](https://github.com/sun-guannan/VectCutAPI/blob/e4f45a0c5323d9db69dd4c9eb60e17f2ca5617c1/mcp-server/README.md) calls a separate VectCutAPI backend; the MCP API client defaults to loopback HTTP. The current MCP tool descriptions include automatic draft deployment and mention stale-lock cleanup. Its [`desktop_companion.py` at commit `e4f45a0`](https://github.com/sun-guannan/VectCutAPI/blob/e4f45a0c5323d9db69dd4c9eb60e17f2ca5617c1/desktop_companion.py) describes launching CapCut when it is closed and using hard-coded clicks to navigate/reopen a project. HS.Tech Bridge must not adopt that reload path: it violates the no-implicit-launch and no-blind-coordinate rules.

The VectCutAPI repository root identifies [Apache License 2.0](https://github.com/sun-guannan/VectCutAPI/blob/main/LICENSE), while its MCP-server README says MIT and no separate `mcp-server/LICENSE` was found in the reviewed tree. Clarify license scope before reusing any source. Optional cloud/OSS settings and external media handling also need a full data-flow review before any run. The Atx-Guy wrapper points to a local `CAPCUT_API_URL` (default `127.0.0.1:9001`) and requires the VectCutAPI server; it is not a standalone CapCut adapter.

No external implementation was cloned, installed, executed, or adopted for this inventory.

## Agent discovery rules

1. Review all ten pathways before concluding that no practical route exists.
2. Assign exactly one status from the five-value vocabulary to each pathway, and state the scope, evidence, version, and verification limit.
3. Distinguish `FOUND` from `SUPPORTED`; distinguish file/disk readback from CapCut UI readback.
4. Treat each `safe_next_probe` as a proposal requiring scope/approval, not an executable instruction. The inventory operation itself stays read-only.
5. Use only the user's own machine/session and data. No credential/token extraction, process-memory reads, injection, binary patching, UIPI/access-control bypass, blind-coordinate automation, broad port scans, or Administrator execution.
6. Do not close, kill, relaunch, or restart CapCut as an implicit part of discovery or editing.

## Scenario gate: “find the extra part and actually apply subtitles”

**Current outcome: analysis/preview only.** The Bridge may inspect a draft and propose/preview an EditPlan, but subtitle application must remain explicitly unsupported until both a real CapCut-targeted adapter and a reliable CapCut-side before/after readback source are demonstrated. A JSON write, disk diff, or successful shortcut call is not enough.

After the user confirms a Windows test, the first technical step is read-only: record the exact CapCut version/build and inspect the actual UIA/QML surface in the same user's interactive session, at the same integrity level as CapCut. Record the accessible roles/names and any stable, readable pre-change timeline state. If no stable observable control/readback is exposed, stop and keep the operation unsupported; do not substitute blind coordinates, file-only readback, process injection, UIAccess, or another UIPI bypass.

Only if that gate succeeds: use a separate disposable project and user-owned media; back it up; obtain explicit confirmation for one bounded subtitle/segment change; capture the CapCut-side state before and after; and report disk readback separately. If the in-app readback disagrees, is absent, or cannot be tied to the requested operation, do not report success.

## Safe future verification plan

A live acceptance test requires the user's Windows session and a separate disposable project:

1. After explicit confirmation, record the exact CapCut version/build, OS, and region context supplied by the user. Do not request credentials.
2. In the same interactive user session and at the same integrity level as CapCut, take a read-only UIA/QML snapshot and verify the target window/process identity. Do not send input during discovery.
3. Microsoft documents that UIPI restricts lower-to-higher-integrity UI messages, while same-integrity UI Automation is not blocked by UIPI; UIAccess is a controlled cross-level capability. Do not elevate CapCut or use UIAccess/UIPI bypass as a workaround. See [Microsoft's UIAccess/UIPI policy reference](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/security/threat-protection/security-policy-settings/user-account-control-only-elevate-uiaccess-applications-that-are-installed-in-secure-locations).
4. If no stable, readable timeline/subtitle control and matching before/after state is exposed, stop and mark application unsupported. Do not proceed by clicking guessed coordinates or assuming file JSON equals app state.
5. If a bounded supported surface is established, use user-owned media in a disposable project, leave the original untouched, and back up before the test. Change one property at a time and require explicit confirmation before any write/input.
6. Verify the actual subtitle/timeline state in CapCut after the operation and record the on-disk JSON/readback separately. Stop on unknown process state, unexpected app behavior, missing backup, permission/access-control boundary, or evidence of corruption; do not work around those conditions.

## Evidence references

- [Official CapCut × Codex page](https://www.capcut.com/tools/capcut-x-codex) — first-party features and regional availability statement.
- [Official hosted plugin skill](https://sf16-sg.tiktokcdn.com/obj/eden-sg/962370eh7nupenuhbo/capcut_codex_plugin/SKILL.md) — plugin version, remote MCP endpoint, region check, and user-auth authorization boundary.
- [VectCutAPI README at `6fd83c5`](https://github.com/sun-guannan/VectCutAPI/blob/6fd83c5aaebecf52bafb242e57a64a0b07123ca6/README.md), [MCP server README](https://github.com/sun-guannan/VectCutAPI/blob/e4f45a0c5323d9db69dd4c9eb60e17f2ca5617c1/mcp-server/README.md), [MCP tool source](https://github.com/sun-guannan/VectCutAPI/blob/e4f45a0c5323d9db69dd4c9eb60e17f2ca5617c1/mcp-server/src/tools/index.ts), [desktop companion](https://github.com/sun-guannan/VectCutAPI/blob/e4f45a0c5323d9db69dd4c9eb60e17f2ca5617c1/desktop_companion.py), and [root license](https://github.com/sun-guannan/VectCutAPI/blob/477db0909a94989f31c2571a62ce9038b17954e0/LICENSE) — community self-reports and the code behavior reviewed statically.
- [Atx-Guy wrapper source](https://github.com/Atx-Guy/capcut-mcp-server/blob/main/src/index.ts) — dependency on a local VectCutAPI backend.
- Internal evidence: `ai_contract/surface_map.py`, `draft_engine/reader.py`, `draft_engine/writer.py`, `capcut-bridge-win.py`, `capcut-plugin-win.py`, `bridge_system/bridge_server.py`, `docs/ARCHITECTURE.md`, and `docs/CHANGE_RECORD.md`.
