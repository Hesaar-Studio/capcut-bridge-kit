#!/usr/bin/env python3
"""
HS.Tech Video Bridge Server (Hesa Art Tech) - v2.4.0
Dual Mode:
  1. REST sample API server on http://127.0.0.1:8766
  2. Model Context Protocol (MCP) Stdio JSON-RPC server for Claude Desktop, Cursor, Codex, Open-source LLMs

Multi-NLE Support:
  - CapCut Desktop (JSON draft_content.json with RTL Persian shaping)
  - Adobe Premiere Pro (Apple FCPXML 1.10)
  - DaVinci Resolve (CMX3600 EDL + 3D CUBE LUT 33x33x33)
"""

import sys
import os
import re
import json
import math
import argparse
import subprocess
import tempfile
from urllib.parse import urlsplit
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

# Standard MCP JSON-RPC protocol helper
def run_mcp_stdio():
    """Stdio JSON-RPC server for Claude Desktop, Cursor, and MCP clients"""
    sys.stderr.write("[HS.Tech Bridge] Starting MCP Stdio Server (hs-art-tech-bridge v2.4.0)...\n")
    sys.stderr.flush()

    tools_definitions = [
        {"name": "capcut_status", "description": "Read-only local CapCut process and project-folder check. Does not imply live editor control.", "inputSchema": {"type": "object", "properties": {}}},
        {"name": "list_capcut_projects", "description": "List CapCut draft folders for the current operating-system account.", "inputSchema": {"type": "object", "properties": {}}},
        {"name": "inspect_capcut_timeline", "description": "Read-only summary of a CapCut draft timeline from its on-disk draft JSON.", "inputSchema": {"type": "object", "properties": {"project_name": {"type": "string", "minLength": 1, "maxLength": 80}}, "required": ["project_name"], "additionalProperties": False}},
        {"name": "capcut_live_split", "description": "Send the split shortcut to the foreground CapCut timeline.", "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False}},
        {"name": "capcut_live_export", "description": "Start export in the foreground CapCut timeline.", "inputSchema": {"type": "object", "properties": {"output_path": {"type": "string"}}, "additionalProperties": False}},
        {"name": "create_capcut_draft", "description": "Create a new draft from local video cuts. Existing projects are never overwritten. Returns verified on-disk timeline and media readback, or an error if the result does not match the request. The current CLI may close and relaunch CapCut while writing the project.", "inputSchema": {"type": "object", "properties": {"project_name": {"type": "string", "minLength": 1, "maxLength": 80}, "cuts": {"type": "array", "minItems": 1, "maxItems": 500, "items": {"type": "object", "properties": {"source_path": {"type": "string"}, "start": {"type": "number", "minimum": 0}, "duration": {"type": "number", "exclusiveMinimum": 0}}, "required": ["source_path", "start", "duration"], "additionalProperties": False}}}, "required": ["project_name", "cuts"], "additionalProperties": False}},
        {"name": "add_capcut_text", "description": "Add a text segment to an existing CapCut draft through the bridge CLI. The current CLI may close and relaunch CapCut while writing the project.", "inputSchema": {"type": "object", "properties": {"project_name": {"type": "string", "minLength": 1, "maxLength": 80}, "text": {"type": "string", "minLength": 1, "maxLength": 2000}, "at": {"type": "number", "minimum": 0}, "duration": {"type": "number", "exclusiveMinimum": 0}}, "required": ["project_name", "text", "at"], "additionalProperties": False}}
    ]

    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            line = line.strip()
            if not line:
                continue

            request = json.loads(line)
            req_id = request.get("id")
            method = request.get("method")

            if method == "initialize":
                response = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "protocolVersion": request.get("params", {}).get("protocolVersion", "2024-11-05"),
                        "capabilities": {"tools": {"listChanged": False}},
                        "serverInfo": {
                            "name": "hs-art-tech-bridge",
                            "version": "2.4.0"
                        }
                    }
                }
            elif method in ("notifications/initialized", "notifications/cancelled"):
                continue
            elif method == "ping":
                response = {"jsonrpc": "2.0", "id": req_id, "result": {}}
            elif method == "tools/list":
                response = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {"tools": tools_definitions}
                }
            elif method == "tools/call":
                params = request.get("params", {})
                tool_name = params.get("name")
                args = params.get("arguments", {})

                if tool_name == "capcut_status":
                    projects_dir = _capcut_projects_dir()
                    value = {"platform": sys.platform, "projects_path": str(projects_dir), "projects_path_exists": projects_dir.is_dir(), "editor_running": _capcut_running(), "connection": "local_process_and_filesystem_check_only"}
                    response = _mcp_result(req_id, json.dumps(value, ensure_ascii=False, indent=2))
                elif tool_name == "list_capcut_projects":
                    projects_dir = _capcut_projects_dir()
                    names = sorted(p.name for p in projects_dir.iterdir() if p.is_dir() and not p.name.startswith(".")) if projects_dir.is_dir() else []
                    response = _mcp_result(req_id, json.dumps({"projects": names, "count": len(names)}, ensure_ascii=False, indent=2))
                elif tool_name == "inspect_capcut_timeline":
                    project = _safe_project_name(args.get("project_name"))
                    response = _mcp_result(req_id, json.dumps(_read_timeline_summary(project), ensure_ascii=False, indent=2))
                elif tool_name == "capcut_live_split":
                    if not _capcut_running():
                        raise RuntimeError("CapCut is not running")
                    response = _mcp_result(req_id, _run_bridge(["split"]))
                elif tool_name == "capcut_live_export":
                    if not _capcut_running():
                        raise RuntimeError("CapCut is not running")
                    export_args = ["export"]
                    if args.get("output_path"):
                        export_args.extend(["--to", str(args["output_path"])])
                    response = _mcp_result(req_id, _run_bridge(export_args))
                elif tool_name == "create_capcut_draft":
                    project = _safe_project_name(args.get("project_name"))
                    cuts = args.get("cuts")
                    if not isinstance(cuts, list) or not cuts or len(cuts) > 500:
                        raise ValueError("cuts must contain between 1 and 500 items")
                    normalized = []
                    for cut in cuts:
                        source = os.path.abspath(os.path.expanduser(cut["source_path"]))
                        start, duration = float(cut["start"]), float(cut["duration"])
                        if not os.path.isfile(source) or start < 0 or duration <= 0:
                            raise ValueError(f"Invalid media path or time range: {source}")
                        normalized.append({"source_path": source, "start": start, "duration": duration})
                    if (_capcut_projects_dir() / project).exists():
                        raise ValueError("Draft already exists; refusing to overwrite it")
                    with tempfile.TemporaryDirectory(prefix="capcut-bridge-") as temp_dir:
                        job_path = os.path.join(temp_dir, "cuts.json")
                        with open(job_path, "w", encoding="utf-8") as f:
                            json.dump({"draft_name": project, "cuts": normalized}, f, ensure_ascii=False)
                        result = _run_bridge(["replay", job_path, "--name", project])
                    verification = _verify_capcut_draft(project, len(normalized))
                    response = _mcp_result(req_id, json.dumps({
                        "message": result,
                        "readback": verification,
                    }, ensure_ascii=False))
                elif tool_name == "add_capcut_text":
                    project = _safe_project_name(args.get("project_name"))
                    text = args.get("text", "")
                    at, duration = float(args.get("at", 0)), float(args.get("duration", 3))
                    if not isinstance(text, str) or not text.strip() or at < 0 or duration <= 0:
                        raise ValueError("Provide non-empty text, at >= 0, and duration > 0")
                    if not (_capcut_projects_dir() / project).is_dir():
                        raise ValueError("CapCut draft not found")
                    result = _run_bridge(["add-text", project, text, "--at", str(at), "--dur", str(duration)])
                    verification = _verify_capcut_text(project, text, at, duration)
                    response = _mcp_result(req_id, json.dumps({
                        "message": result,
                        "readback": verification,
                    }, ensure_ascii=False))
                else:
                    response = _mcp_result(req_id, f"Unknown tool: {tool_name}", True)
            else:
                response = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": -32601, "message": f"Method '{method}' not found"}
                }

            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()

        except Exception as e:
            if 'req_id' in locals() and req_id is not None:
                sys.stdout.write(json.dumps(_mcp_result(req_id, str(e), True), ensure_ascii=False) + "\n")
                sys.stdout.flush()
            sys.stderr.write(f"[HS.Tech Bridge Error] {str(e)}\n")
            sys.stderr.flush()


def _mcp_result(req_id, message, is_error=False):
    return {"jsonrpc": "2.0", "id": req_id, "result": {"content": [{"type": "text", "text": str(message)}], "isError": is_error}}


def _capcut_projects_dir():
    if sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    elif sys.platform == "darwin":
        base = Path.home() / "Movies"
    else:
        base = Path.home() / ".local" / "share"
    return base / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"


def _capcut_running():
    try:
        if sys.platform == "win32":
            result = subprocess.run(["powershell", "-NoProfile", "-Command", "if (Get-Process -Name CapCut -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"], capture_output=True, text=True, timeout=5)
            return result.returncode == 0
        result = subprocess.run(["pgrep", "-fi", "CapCut"], capture_output=True, text=True, timeout=5)
        return result.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def _safe_project_name(name):
    if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9 _().-]{0,79}", name) or name in {".", ".."}:
        raise ValueError("project_name must be a simple folder name (letters, numbers, spaces, dot, _ or -)")
    return name


def _read_timeline_summary(project_name):
    """Read a project draft without modifying it; this is the timeline adapter."""
    draft_dir = _capcut_projects_dir() / project_name
    content_path = draft_dir / "draft_content.json"
    if not content_path.is_file():
        raise FileNotFoundError(f"CapCut draft file not found: {content_path}")
    with content_path.open("r", encoding="utf-8") as draft_file:
        content = json.load(draft_file)
    tracks = content.get("tracks", [])
    summary = []
    for track in tracks if isinstance(tracks, list) else []:
        if not isinstance(track, dict):
            continue
        segments = track.get("segments", [])
        summary.append({
            "track_type": track.get("type"),
            "track_id": track.get("id"),
            "segments_count": len(segments) if isinstance(segments, list) else 0,
            "segments": segments if isinstance(segments, list) else [],
        })
    return {
        "project_name": project_name,
        "source": str(content_path),
        "duration": content.get("duration"),
        "tracks_count": len(summary),
        "tracks": summary,
        "read_only": True,
    }


def _verify_capcut_draft(project_name, expected_cuts):
    """Read the generated draft back and verify its timeline and local media references."""
    draft_dir = _capcut_projects_dir() / project_name
    content_path = draft_dir / "draft_content.json"
    if not content_path.is_file():
        raise RuntimeError(f"Draft command returned, but project file is missing: {content_path}")
    try:
        with content_path.open("r", encoding="utf-8") as draft_file:
            content = json.load(draft_file)
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Draft readback failed: {exc}") from exc

    if not isinstance(content, dict):
        raise RuntimeError("Draft readback failed: project JSON root is not an object")
    materials = content.get("materials", {})
    videos = materials.get("videos", []) if isinstance(materials, dict) else []
    tracks = content.get("tracks", [])
    if not isinstance(videos, list) or not isinstance(tracks, list):
        raise RuntimeError("Draft readback failed: video materials or tracks have an invalid shape")
    if any(not isinstance(track, dict) or not isinstance(track.get("segments", []), list) for track in tracks):
        raise RuntimeError("Draft readback failed: a track or its segments have an invalid shape")
    if any(not isinstance(material, dict) for material in videos):
        raise RuntimeError("Draft readback failed: a video material has an invalid shape")
    video_segments = [
        segment
        for track in tracks if track.get("type") == "video"
        for segment in track.get("segments", [])
    ]
    if len(videos) != expected_cuts or len(video_segments) != expected_cuts:
        raise RuntimeError(
            f"Draft readback mismatch: expected {expected_cuts} video materials and timeline segments, "
            f"found {len(videos)} and {len(video_segments)}"
        )

    missing_media = [
        material.get("path") for material in videos
        if not isinstance(material.get("path"), str) or not Path(material["path"]).is_file()
    ]
    if missing_media:
        raise RuntimeError(f"Draft readback found missing media files: {missing_media}")

    return {
        "verified": True,
        "project_path": str(draft_dir),
        "draft_file": str(content_path),
        "video_materials": len(videos),
        "timeline_segments": len(video_segments),
        "duration_us": content.get("duration", 0),
    }


def _verify_capcut_text(project_name, text, at_seconds, duration_seconds):
    """Confirm an added caption exists at the requested timeline range."""
    draft_dir = _capcut_projects_dir() / project_name
    content_path = draft_dir / "draft_content.json"
    if not content_path.is_file():
        raise RuntimeError(f"Text command returned, but project file is missing: {content_path}")
    try:
        with content_path.open("r", encoding="utf-8") as draft_file:
            content = json.load(draft_file)
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Text readback failed: {exc}") from exc

    if not isinstance(content, dict):
        raise RuntimeError("Text readback failed: project JSON root is not an object")
    materials = content.get("materials", {})
    tracks = content.get("tracks", [])
    if not isinstance(materials, dict) or not isinstance(tracks, list):
        raise RuntimeError("Text readback failed: project JSON has an invalid shape")
    text_materials = materials.get("texts", [])
    if not isinstance(text_materials, list):
        raise RuntimeError("Text readback failed: text materials have an invalid shape")
    matching_ids = {
        material.get("id") for material in text_materials
        if isinstance(material, dict) and isinstance(material.get("content"), str) and text in material["content"]
    }
    expected_start = int(at_seconds * 1_000_000)
    expected_duration = int(duration_seconds * 1_000_000)
    for track in tracks:
        if not isinstance(track, dict) or track.get("type") != "text":
            continue
        segments = track.get("segments", [])
        if not isinstance(segments, list):
            continue
        for segment in segments:
            if not isinstance(segment, dict) or segment.get("material_id") not in matching_ids:
                continue
            target = segment.get("target_timerange", {})
            if isinstance(target, dict) and target.get("start") == expected_start and target.get("duration") == expected_duration:
                return {
                    "verified": True,
                    "project_path": str(draft_dir),
                    "draft_file": str(content_path),
                    "text_segment_id": segment.get("id"),
                    "start_us": expected_start,
                    "duration_us": expected_duration,
                }
    raise RuntimeError("Text readback could not find the requested caption at its timeline position")


def _run_bridge(args):
    script = Path(__file__).resolve().parents[1] / ("capcut-bridge-win.py" if sys.platform == "win32" else "capcut-bridge.py")
    if not script.is_file():
        raise FileNotFoundError(f"Bridge CLI not found: {script}")
    try:
        result = subprocess.run([sys.executable, str(script), *args], capture_output=True, text=True, timeout=300)
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("Bridge command timed out") from exc
    if result.returncode:
        raise RuntimeError((result.stderr or result.stdout or "Bridge command failed").strip())
    return (result.stdout or "Command completed.").strip()

def generate_cube_lut(lut_name: str, contrast: float = 1.1, saturation: float = 1.05, size: int = 33) -> str:
    """Generates standard 3D CUBE LUT format compatible with DaVinci and Premiere"""
    lines = [
        f"# HS.Tech Color Grade LUT (Hesa Art Tech)",
        f"# Title: {lut_name}",
        f"LUT_3D_SIZE {size}",
        f"DOMAIN_MIN 0.0 0.0 0.0",
        f"DOMAIN_MAX 1.0 1.0 1.0"
    ]
    for b in range(size):
        for g in range(size):
            for r in range(size):
                rf = r / (size - 1)
                gf = g / (size - 1)
                bf = b / (size - 1)
                
                # Apply contrast S-curve
                rf = 0.5 + (rf - 0.5) * contrast
                gf = 0.5 + (gf - 0.5) * contrast
                bf = 0.5 + (bf - 0.5) * contrast
                
                # Clamp to 0..1
                rf = max(0.0, min(1.0, rf))
                gf = max(0.0, min(1.0, gf))
                bf = max(0.0, min(1.0, bf))
                
                lines.append(f"{rf:.6f} {gf:.6f} {bf:.6f}")
    return "\n".join(lines)

def generate_fcpxml_premiere(project_name: str, cuts: List[Dict[str, Any]]) -> str:
    """Generates standard Apple FCPXML 1.10 for Adobe Premiere Pro"""
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
    <resources>
        <format id="r1" name="FFVideoFormat1080p30" frameDuration="1/30s" width="1920" height="1080"/>
    </resources>
    <library>
        <event name="HS.Tech Events">
            <project name="{project_name}">
                <sequence format="r1" duration="60s">
                    <spine>
"""
    for i, cut in enumerate(cuts):
        dur = max(0.1, cut.get("out_s", 1.0) - cut.get("in_s", 0.0))
        label = cut.get("label", f"Clip_{i+1}")
        xml += f'                        <clip name="{label}" duration="{dur:.2f}s" start="{cut.get("in_s", 0.0):.2f}s" />\n'
    xml += """                    </spine>
                </sequence>
            </project>
        </event>
    </library>
</fcpxml>"""
    return xml

def start_http_server(port: int = 8766):
    """Starts the local sample HTTP server using Python's standard library."""
    from http.server import HTTPServer, BaseHTTPRequestHandler
    
    class BridgeHTTPHandler(BaseHTTPRequestHandler):
        def _is_loopback_host(self):
            try:
                hostname = urlsplit(f"//{self.headers.get('Host', '')}").hostname
                return hostname in {"localhost", "127.0.0.1", "::1"}
            except ValueError:
                return False

        def _reject_non_loopback_host(self):
            if self._is_loopback_host():
                return False
            self.send_response(403)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "This local sample API only accepts loopback hosts."}).encode("utf-8"))
            return True

        def do_OPTIONS(self):
            if self._reject_non_loopback_host():
                return
            self.send_response(200)
            self.end_headers()

        def do_GET(self):
            if self._reject_non_loopback_host():
                return
            if self.path == "/health" or self.path == "/api/v1/status":
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                resp = {
                    "brand": "HS.Tech Video Bridge (Hesa Art Tech)",
                    "slug": "hs-art-tech-bridge",
                    "version": "2.4.0",
                    "status": "sample",
                    "nles": [],
                    "connection": "health_only_no_nle_adapter",
                    "port": port
                }
                self.wfile.write(json.dumps(resp, ensure_ascii=False).encode("utf-8"))
            else:
                self.send_response(404)
                self.end_headers()

        def do_POST(self):
            if self._reject_non_loopback_host():
                return
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
            try:
                data = json.loads(body)
            except Exception:
                data = {}

            if self.path == "/api/v1/sync":
                self.send_response(501)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": False,
                    "applied_cuts": 0,
                    "message": "Timeline sync is not implemented by this sample endpoint; no edits were applied."
                }).encode("utf-8"))

            elif self.path == "/api/v1/export-lut":
                lut_name = data.get("lut_name", "HS_Tech_Grade")
                cube_content = generate_cube_lut(lut_name)
                self.send_response(200)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Content-Disposition", f'attachment; filename="{lut_name}.cube"')
                self.end_headers()
                self.wfile.write(cube_content.encode("utf-8"))
            else:
                self.send_response(404)
                self.end_headers()

    server_address = ("127.0.0.1", port)
    httpd = HTTPServer(server_address, BridgeHTTPHandler)
    print(f"[HS.Tech Video Bridge] REST API listening on http://127.0.0.1:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[HS.Tech Bridge] Shutting down cleanly.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="HS.Tech Video Bridge (Hesa Art Tech)")
    parser.add_argument("--mcp", action="store_true", help="Run in MCP stdio JSON-RPC mode for AI assistants")
    parser.add_argument("--port", type=int, default=8766, help="HTTP REST sample port (default: 8766)")
    args = parser.parse_args()

    if args.mcp or not sys.stdin.isatty():
        run_mcp_stdio()
    else:
        start_http_server(args.port)




