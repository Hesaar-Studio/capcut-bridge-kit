"""
Evidence-based CapCut integration-surface inventory.

This is deliberately separate from CapabilityStatus: a route can be found or
experimentally plausible without being a supported or live-verified Bridge tool.
The returned inventory is static and read-only; it never probes the host.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, Optional, Tuple


SURFACE_MAP_AS_OF = "2026-10-02"
SURFACE_MAP_VERSION = "capcut-surfaces-2026.10"


class CapCutSurfaceStatus(str, Enum):
    """Evidence state for an integration pathway, independent of tool status."""

    FOUND = "FOUND"
    SUPPORTED = "SUPPORTED"
    EXPERIMENTAL = "EXPERIMENTAL"
    UNVERIFIED = "UNVERIFIED"
    UNAVAILABLE = "UNAVAILABLE"


@dataclass(frozen=True)
class SurfaceEvidence:
    """A public source or repository artifact supporting a surface finding."""

    kind: str
    label: str
    url: Optional[str] = None
    repository_path: Optional[str] = None
    observed_at: str = SURFACE_MAP_AS_OF

    def to_dict(self) -> Dict[str, Any]:
        result: Dict[str, Any] = {
            "kind": self.kind,
            "label": self.label,
            "observed_at": self.observed_at,
        }
        if self.url:
            result["url"] = self.url
        if self.repository_path:
            result["repository_path"] = self.repository_path
        return result


@dataclass(frozen=True)
class CapCutIntegrationSurface:
    """One of the ten requested integration families and its evidence boundary."""

    surface_id: str
    name: str
    status: CapCutSurfaceStatus
    scope: str
    finding: str
    limitations: Tuple[str, ...]
    safe_next_probe: str
    evidence: Tuple[SurfaceEvidence, ...]
    runtime_verified: bool = False
    version_scope: str = "CapCut Desktop target version was not supplied or tested."
    regional_availability: Tuple[Dict[str, str], ...] = ()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.surface_id,
            "name": self.name,
            "status": self.status.value,
            "scope": self.scope,
            "finding": self.finding,
            "limitations": list(self.limitations),
            "safe_next_probe": self.safe_next_probe,
            "evidence": [source.to_dict() for source in self.evidence],
            "runtime_verified": self.runtime_verified,
            "version_scope": self.version_scope,
            "regional_availability": [dict(item) for item in self.regional_availability],
        }


_STATUS_LEGEND = {
    CapCutSurfaceStatus.FOUND.value: "A concrete document, implementation, service, or artifact exists; existence alone does not prove support or successful CapCut use.",
    CapCutSurfaceStatus.SUPPORTED.value: "The vendor documents/supports the route within the stated scope; the user's account and runtime may still be untested or region-gated.",
    CapCutSurfaceStatus.EXPERIMENTAL.value: "A community or fragile implementation exists, or the route is version-sensitive; it is not accepted as dependable without isolated testing.",
    CapCutSurfaceStatus.UNVERIFIED.value: "Plausible or partially observed, but not verified on the target CapCut installation; this is not a claim that the route is absent.",
    CapCutSurfaceStatus.UNAVAILABLE.value: "Positive evidence says the route is unavailable in the precisely stated scope; do not generalize beyond that scope.",
}


_SURFACES: Tuple[CapCutIntegrationSurface, ...] = (
    CapCutIntegrationSurface(
        surface_id="official_api_plugin",
        name="Official API / first-party plugin",
        status=CapCutSurfaceStatus.SUPPORTED,
        scope="CapCut × Codex first-party workflow. This is a hosted remote-MCP integration, not a generic local desktop SDK.",
        finding=(
            "CapCut documents a first-party CapCut × Codex workflow. Its published installer skill registers the `capcut_creation` MCP connection at "
            "https://www.capcut.com/api/external_mcp and leaves account authorization to the user in Codex. The product page describes conversational "
            "draft/timeline refinement and launching the CapCut editor."
        ),
        limitations=(
            "The official product page says the experience is available outside the U.S. and that the U.S. launch is forthcoming; the hosted installer skill (v0.2.0) explicitly says to skip authorization when network egress is detected as U.S. User-specific egress, account access, installation, and authorization were not checked.",
            "No general-purpose public CapCut Desktop timeline SDK/API reference was found in the official pages reviewed. That search result is not proof that no private, partner, or later-published API exists.",
            "This route is not installed or wired into HS.Tech Bridge. The inventory does not download the plugin, start OAuth, inspect credentials, or send requests to CapCut.",
        ),
        safe_next_probe=(
            "Only if the user explicitly asks and the official flow is available in their region: use the official Codex interface, let the user complete authorization, and inspect only the documented tools. Keep OAuth and credentials in the vendor's browser/client; do not automate login or reuse tokens."
        ),
        evidence=(
            SurfaceEvidence("official_web", "CapCut × Codex product page", "https://www.capcut.com/tools/capcut-x-codex"),
            SurfaceEvidence("official_runbook", "Hosted CapCut plugin installation/authorization skill, plugin version 0.2.0", "https://sf16-sg.tiktokcdn.com/obj/eden-sg/962370eh7nupenuhbo/capcut_codex_plugin/SKILL.md"),
        ),
        version_scope="Public product page reviewed 2026-10-02; hosted plugin runbook declares version 0.2.0. No installed plugin or CapCut app version was checked.",
        regional_availability=(
            {
                "scope": "U.S. network egress, per the published official runbook",
                "status": CapCutSurfaceStatus.UNAVAILABLE.value,
                "basis": "The runbook says to skip authorization when the country check returns US; no network-region check was run here.",
            },
            {
                "scope": "Outside-U.S. regions, per the product page",
                "status": CapCutSurfaceStatus.SUPPORTED.value,
                "basis": "The product page states the workflow is available outside the U.S.; account-level access remains untested.",
            },
        ),
    ),
    CapCutIntegrationSurface(
        surface_id="local_ipc",
        name="Local IPC",
        status=CapCutSurfaceStatus.UNVERIFIED,
        scope="CapCut-owned local process communication on the user's Windows/macOS host.",
        finding="No CapCut-owned named pipe, Unix socket, or local IPC endpoint was observed in this Linux workspace or evidenced by a target-version capture.",
        limitations=(
            "No live CapCut process, OS process table, sockets, pipes, or endpoint traffic were inspected.",
            "A Bridge or VectCutAPI endpoint is not evidence of CapCut-owned IPC.",
        ),
        safe_next_probe="With the user's explicit approval on their normal, non-elevated OS account, first record the exact CapCut version and inspect only documented or clearly process-owned endpoint metadata; do not read process memory, extract secrets, inject, or send trial commands to an unknown endpoint.",
        evidence=(
            SurfaceEvidence("repository_audit", "Architecture audit: no target-host IPC capture is present", repository_path="docs/ARCHITECTURE.md"),
        ),
    ),
    CapCutIntegrationSurface(
        surface_id="extension_plugin_surfaces",
        name="Extension / in-app plugin surfaces",
        status=CapCutSurfaceStatus.UNVERIFIED,
        scope="Third-party plugin/extension SDK hosted by CapCut Desktop itself.",
        finding="The official Codex plugin is a separate Codex-hosted integration backed by remote MCP; it does not establish that CapCut Desktop exposes a general in-app extension SDK for timeline editing.",
        limitations=(
            "No public CapCut Desktop extension manifest, developer SDK, or versioned in-app timeline plugin API was validated in the sources reviewed.",
            "A lack of a public reference is not proof that private/partner surfaces do not exist.",
        ),
        safe_next_probe="Check only CapCut's official developer/help materials or user-visible application settings for a published extension interface; record an exact documentation URL and version before designing an adapter.",
        evidence=(
            SurfaceEvidence("official_web", "CapCut × Codex product page (external integration context)", "https://www.capcut.com/tools/capcut-x-codex"),
            SurfaceEvidence("official_runbook", "CapCut plugin runbook registers a Codex MCP connection", "https://sf16-sg.tiktokcdn.com/obj/eden-sg/962370eh7nupenuhbo/capcut_codex_plugin/SKILL.md"),
        ),
    ),
    CapCutIntegrationSurface(
        surface_id="accessibility_ui_automation",
        name="Accessibility / UI Automation",
        status=CapCutSurfaceStatus.EXPERIMENTAL,
        scope="Foreground-guarded keyboard interaction and possible read-only accessibility-tree inspection.",
        finding="HS.Tech Bridge contains guarded keyboard shortcuts, but a successful key event is not a timeline readback. Historical UIA/QML observations were not reproduced on this host, and no CapCut accessibility tree proving editable timeline controls is available.",
        limitations=(
            "No actual CapCut UIA/QML session or version-specific control tree was tested.",
            "Blind-coordinate automation is not an approved path. Do not run CapCut as Administrator or bypass UIPI/access controls.",
        ),
        safe_next_probe="After explicit user confirmation, inspect the exact CapCut version in the user's interactive Windows session, at the same integrity level as CapCut. Take a read-only UIA/QML snapshot and verify the target window/process identity; do not send input during this probe. Never elevate CapCut or use UIAccess/UIPI bypass. Any later bounded action needs a disposable project, explicit confirmation, and CapCut-side before/after readback.",
        evidence=(
            SurfaceEvidence("repository_audit", "Guarded live-lane and UI-readback boundary", repository_path="docs/ARCHITECTURE.md"),
            SurfaceEvidence("repository_audit", "Keyboard-live safety wrappers", repository_path="capcut-bridge-win.py"),
        ),
        version_scope="Bridge source reviewed 2026-10-02; target CapCut build and UIA/QML tree unknown.",
    ),
    CapCutIntegrationSurface(
        surface_id="local_services",
        name="Local services",
        status=CapCutSurfaceStatus.FOUND,
        scope="Loopback REST/MCP services belonging to HS.Tech Bridge or third-party draft tooling; not CapCut-owned services.",
        finding="The repository contains a Windows loopback Flask plugin service and a stdio MCP server. VectCutAPI also documents a self-hosted local HTTP API (the MCP wrapper defaults to 127.0.0.1:9001). These are adapter/service processes; they do not by themselves prove a live connection to CapCut's open editor.",
        limitations=(
            "No local service was started or contacted for this audit; Windows plugin route tests still depend on Flask, which is not installed in the workspace.",
            "VectCutAPI is community code and was not cloned, installed, run, or security-audited; remote/upload settings require separate review.",
        ),
        safe_next_probe="Use documented Bridge status/contract routes only after the user starts the service locally; keep listeners on loopback, reject unapproved origins, and never probe a broad port range.",
        evidence=(
            SurfaceEvidence("repository_audit", "Windows local REST plugin", repository_path="capcut-plugin-win.py"),
            SurfaceEvidence("repository_audit", "Bridge MCP stdio service", repository_path="bridge_system/bridge_server.py"),
            SurfaceEvidence("community_readme", "VectCutAPI setup and local API claims", "https://github.com/sun-guannan/VectCutAPI/blob/6fd83c5aaebecf52bafb242e57a64a0b07123ca6/README.md"),
            SurfaceEvidence("community_source", "VectCutAPI MCP API-client default is loopback HTTP", "https://github.com/sun-guannan/VectCutAPI/blob/main/mcp-server/src/constants.ts"),
        ),
    ),
    CapCutIntegrationSurface(
        surface_id="project_draft_format",
        name="Project / Draft format",
        status=CapCutSurfaceStatus.FOUND,
        scope="On-disk draft JSON formats used by this Bridge and described by community tooling.",
        finding="The Bridge has draft readers/writers for files such as `draft_content.json`; VectCutAPI documents CapCut/Jianying draft export and profile-specific folder layouts. This establishes a file artifact and implementation, not an official CapCut format specification.",
        limitations=(
            "No official, versioned CapCut draft schema was validated.",
            "Format compatibility is version- and profile-sensitive; no user project was opened or changed during this audit.",
        ),
        safe_next_probe="Inspect only a user-owned copy or newly created disposable draft, record the app/version and file hashes, and compare after a manual save in CapCut; do not treat parser success as editor acceptance.",
        evidence=(
            SurfaceEvidence("repository_audit", "Draft JSON reader", repository_path="draft_engine/reader.py"),
            SurfaceEvidence("repository_audit", "Atomic draft JSON writer and backup path", repository_path="draft_engine/writer.py"),
            SurfaceEvidence("community_readme", "VectCutAPI draft export profiles", "https://github.com/sun-guannan/VectCutAPI/blob/6fd83c5aaebecf52bafb242e57a64a0b07123ca6/README.md"),
        ),
    ),
    CapCutIntegrationSurface(
        surface_id="file_based_timeline_manipulation",
        name="File-based timeline manipulation",
        status=CapCutSurfaceStatus.EXPERIMENTAL,
        scope="Changing draft files on disk while separating that result from state displayed by the running editor.",
        finding="The Bridge's file lane can write a draft, retain a project backup, replace JSON atomically, and read the JSON back. Existing-project writes refuse while CapCut is running. This verifies disk state only; it does not verify that CapCut loaded, displayed, or rendered the edit.",
        limitations=(
            "No live CapCut acceptance test has been run.",
            "The VectCutAPI companion includes an automatic desktop-reload path with hard-coded mouse coordinates and may launch CapCut; that path is not adopted by HS.Tech Bridge and is outside this project's safety policy.",
        ),
        safe_next_probe="Only in a separate disposable project with user-owned media: back up, perform one bounded file change, read it back, then have the user open the draft manually and compare the actual timeline. Never overwrite the source project or imply that disk readback is app-side verification.",
        evidence=(
            SurfaceEvidence("repository_audit", "File-lane backup, atomic write and readback", repository_path="draft_engine/writer.py"),
            SurfaceEvidence("repository_audit", "File-lane refuses writes while CapCut is running", repository_path="capcut-bridge-win.py"),
            SurfaceEvidence("community_source", "VectCutAPI desktop companion describes app launch and coordinate-driven reload", "https://github.com/sun-guannan/VectCutAPI/blob/e4f45a0c5323d9db69dd4c9eb60e17f2ca5617c1/desktop_companion.py"),
        ),
        version_scope="Bridge file-lane tests use temporary fixtures; CapCut acceptance for the target build is unverified.",
    ),
    CapCutIntegrationSurface(
        surface_id="local_communication_protocols",
        name="Local communication protocols",
        status=CapCutSurfaceStatus.UNVERIFIED,
        scope="MCP stdio and loopback HTTP/JSON used between agents and Bridge/service wrappers.",
        finding="HS.Tech Bridge exposes MCP over stdio and local REST routes; the VectCutAPI wrapper documents MCP stdio/HTTP transports calling a loopback API. These are agent-to-wrapper protocols, not verified CapCut-internal protocols.",
        limitations=(
            "No CapCut-owned local JSON-RPC, WebSocket, named-pipe, or undocumented protocol was observed or tested.",
            "Protocol availability does not demonstrate timeline readback or direct communication with an open CapCut editor.",
        ),
        safe_next_probe="Exercise only the Bridge's declared MCP schemas with temporary fixtures. For any claimed CapCut-owned endpoint, require vendor documentation or user-observed evidence before sending a request; do not extract tokens or brute-force endpoints.",
        evidence=(
            SurfaceEvidence("repository_audit", "Bridge MCP stdio contract and schemas", repository_path="bridge_system/bridge_server.py"),
            SurfaceEvidence("repository_audit", "Read-only REST contract allowlist", repository_path="server.ts"),
            SurfaceEvidence("community_readme", "VectCutAPI MCP wrapper requires its local API service", "https://github.com/sun-guannan/VectCutAPI/blob/e4f45a0c5323d9db69dd4c9eb60e17f2ca5617c1/mcp-server/README.md"),
        ),
    ),
    CapCutIntegrationSurface(
        surface_id="public_open_source_implementations",
        name="Public / open-source implementations",
        status=CapCutSurfaceStatus.EXPERIMENTAL,
        scope="Community repositories and wrappers; not official CapCut support and not adopted code.",
        finding=(
            "VectCutAPI and an Atx-Guy MCP wrapper are public. VectCutAPI's current README claims cloud editing APIs and CapCut draft export, while its MCP server README requires a local VectCutAPI backend. The wrapper source points to a local API URL. These are repository claims, not independent functional/security verification."
        ),
        limitations=(
            "Static source review found that the VectCutAPI MCP tool describes automatic deployment and stale-lock cleanup, and its desktop companion describes launching CapCut and clicking hard-coded coordinates; do not run or adopt that reload path under the Bridge's safety rules.",
            "The repository root reports Apache-2.0, while the MCP-server README says MIT and no separate `mcp-server/LICENSE` file was found in the reviewed tree; clarify licensing before reusing code.",
            "Neither project was cloned, installed, executed, or fully audited; external media URLs, optional cloud/OSS configuration, and data handling need review before any use.",
        ),
        safe_next_probe="Keep this as a research lead. Before considering reuse, pin a commit, review the complete data-flow and filesystem/automation behavior, resolve the license scope, remove disallowed launch/coordinate/lock-cleanup behavior, and test only in an isolated disposable environment.",
        evidence=(
            SurfaceEvidence("community_readme", "VectCutAPI README (updated August 2026)", "https://github.com/sun-guannan/VectCutAPI/blob/6fd83c5aaebecf52bafb242e57a64a0b07123ca6/README.md"),
            SurfaceEvidence("community_license", "VectCutAPI repository root license", "https://github.com/sun-guannan/VectCutAPI/blob/477db0909a94989f31c2571a62ce9038b17954e0/LICENSE"),
            SurfaceEvidence("community_source", "VectCutAPI MCP save/reload tool descriptions", "https://github.com/sun-guannan/VectCutAPI/blob/e4f45a0c5323d9db69dd4c9eb60e17f2ca5617c1/mcp-server/src/tools/index.ts"),
            SurfaceEvidence("community_source", "VectCutAPI desktop companion", "https://github.com/sun-guannan/VectCutAPI/blob/e4f45a0c5323d9db69dd4c9eb60e17f2ca5617c1/desktop_companion.py"),
            SurfaceEvidence("community_source", "Atx-Guy wrapper uses CAPCUT_API_URL and VectCutAPI backend", "https://github.com/Atx-Guy/capcut-mcp-server/blob/main/src/index.ts"),
        ),
        version_scope="Observed 2026-10-02: VectCutAPI README commit 6fd83c5 (2026-08-17), MCP/desktop companion commit e4f45a0 (2026-09-05); Atx-Guy source was read on main but its commit was not pinned. No checkout or executable build was tested.",
    ),
    CapCutIntegrationSurface(
        surface_id="black_box_behavior_analysis",
        name="Black-box behavior analysis",
        status=CapCutSurfaceStatus.UNVERIFIED,
        scope="User-authorized observation of CapCut Desktop behavior using a disposable project and user-owned data.",
        finding="No live CapCut session was available in this Linux environment, so no black-box behavior, IPC trace, UIA tree, or in-app draft acceptance was observed.",
        limitations=(
            "No Windows process, CapCut version, user project, or disposable draft was supplied for a live test.",
            "Black-box observation does not authorize credential extraction, memory inspection, injection, binary patching, privilege/access-control bypass, or testing on third-party data.",
        ),
        safe_next_probe="With user approval, use a disposable project and user-owned media; back up before each bounded change, record disk readback, then have the user verify the actual timeline inside CapCut. Keep those evidence records distinct.",
        evidence=(
            SurfaceEvidence("audit_scope", "No live Windows/CapCut test was performed", repository_path="docs/CHANGE_RECORD.md"),
        ),
    ),
)


def get_capcut_surface_map() -> Dict[str, Any]:
    """Return the ten-route, read-only evidence snapshot for CapCut Desktop."""
    return {
        "schema_version": "1.0",
        "map_version": SURFACE_MAP_VERSION,
        "as_of": SURFACE_MAP_AS_OF,
        "target": "CapCut Desktop integration pathways (CapCut is the target; Premiere/Resolve are reference architectures only).",
        "read_only": True,
        "runtime_probes_performed": False,
        "surface_count": len(_SURFACES),
        "status_legend": dict(_STATUS_LEGEND),
        "agent_guidance": [
            "Review all ten pathways before concluding that no practical route exists; absence of a public generic API reference is not proof that every route is absent.",
            "Use exactly one of FOUND, SUPPORTED, EXPERIMENTAL, UNVERIFIED, or UNAVAILABLE for each pathway, and explain the scope and evidence behind it.",
            "FOUND is not equivalent to SUPPORTED, and file or JSON readback is not proof that CapCut accepted or rendered a timeline change.",
            "For a request to find an extra segment and actually apply subtitles, remain at analysis/preview only until an exact-version CapCut adapter and reliable CapCut-side before/after readback are demonstrated. After user confirmation, begin with read-only UIA/QML inspection in the same interactive user's session and at the same integrity level as CapCut. If no stable observable surface exists, keep subtitle application unsupported; never elevate CapCut or bypass UIPI.",
            "This inventory and each safe_next_probe are descriptive only; do not automatically execute probes, shell commands, project writes, UI actions, or network requests.",
            "Discovery is read-only and user-authorized. Never extract credentials, inject/patch, bypass UIPI/access controls, use blind coordinates, run CapCut elevated, or close/relaunch the editor implicitly.",
        ],
        "surfaces": [surface.to_dict() for surface in _SURFACES],
    }


def surface_status_values() -> Tuple[str, ...]:
    """Return allowed surface labels for schema and test consumers."""
    return tuple(status.value for status in CapCutSurfaceStatus)
