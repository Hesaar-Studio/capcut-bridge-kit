"""
CapCut Bridge Windows Plugin & Local REST Server
=================================================
Runs as a local background daemon on Windows (http://127.0.0.1:8765).
Acts as an internal API plugin for CapCut Desktop, enabling web apps,
video editing extensions, OBS, or scripts to automate CapCut with simple HTTP requests.

Install and run:
    pip install flask pyautogui pillow
    python capcut-plugin-win.py
"""

from __future__ import annotations

import json
import ctypes
from ctypes import wintypes
import os
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit
from flask import Flask, request, jsonify

from bridge_system.process_guard import ProcessStateUnknown, capcut_process_running

try:
    from bridge_system.versioning import APP_VERSION
except ImportError:
    APP_VERSION = os.environ.get("HS_TECH_APP_VERSION", "unknown")

# Windows CapCut Paths
LOCAL_APPDATA = os.environ.get("LOCALAPPDATA", "")
CAPCUT_PROJECTS_DIR = (
    Path(LOCAL_APPDATA) / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"
)

app = Flask(__name__)
DEFAULT_ALLOWED_ORIGINS = ("http://127.0.0.1:3000", "http://localhost:3000")
ALLOWED_ORIGINS = {
    origin.strip().rstrip("/")
    for origin in os.environ.get("CAPCUT_PLUGIN_ALLOWED_ORIGINS", ",".join(DEFAULT_ALLOWED_ORIGINS)).split(",")
    if origin.strip()
}


@app.before_request
def enforce_local_origin():
    """Reject DNS-rebinding hosts and browser origins outside the local UI allowlist."""
    hostname = urlsplit(f"//{request.host}").hostname
    if hostname not in {"localhost", "127.0.0.1", "::1"}:
        return jsonify({"error": "This local plugin only accepts loopback hosts."}), 403

    origin = request.headers.get("Origin")
    if origin is not None and origin.rstrip("/") not in ALLOWED_ORIGINS:
        return jsonify({"error": "This browser origin is not allowed."}), 403

# Enable CORS for local web tools
@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin is not None and origin.rstrip("/") in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


def is_capcut_running() -> bool:
    """Return CapCut's verified process state; query failures must stop the caller."""
    return capcut_process_running(platform="win32")


def is_capcut_foreground() -> bool:
    """Return true only when the active Windows window belongs to CapCut.exe."""
    if sys.platform != "win32":
        return False
    process_handle = None
    try:
        user32 = ctypes.WinDLL("user32", use_last_error=True)
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        user32.GetForegroundWindow.restype = wintypes.HWND
        user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
        user32.GetWindowThreadProcessId.restype = wintypes.DWORD
        kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel32.OpenProcess.restype = wintypes.HANDLE
        kernel32.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
        kernel32.QueryFullProcessImageNameW.restype = wintypes.BOOL
        kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
        kernel32.CloseHandle.restype = wintypes.BOOL

        hwnd = user32.GetForegroundWindow()
        if not hwnd:
            return False
        pid = wintypes.DWORD()
        if not user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid)):
            return False
        process_handle = kernel32.OpenProcess(0x1000, False, pid.value)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not process_handle:
            return False
        image_path = ctypes.create_unicode_buffer(32768)
        image_length = wintypes.DWORD(len(image_path))
        if not kernel32.QueryFullProcessImageNameW(process_handle, 0, image_path, ctypes.byref(image_length)):
            return False
        return Path(image_path.value).name.casefold() == "capcut.exe"
    except (AttributeError, OSError, ValueError):
        return False
    finally:
        if process_handle:
            try:
                kernel32.CloseHandle(process_handle)
            except Exception:
                pass


def require_capcut_foreground():
    if not is_capcut_running():
        raise RuntimeError("CapCut is not currently open")
    if not is_capcut_foreground():
        raise RuntimeError("Bring the CapCut window to the foreground before sending live shortcuts")


def _live_guard_http_status(error: RuntimeError) -> int:
    """Indeterminate process state is unavailable; known guard failures are conflicts."""
    return 503 if isinstance(error, ProcessStateUnknown) else 409


@app.route("/api/v1/health", methods=["GET"])
def health():
    return jsonify({
        "service": "hs-tech-capcut-plugin",
        "version": APP_VERSION,
        "pid": os.getpid(),
        "port": int(os.environ.get("CAPCUT_PLUGIN_PORT", "8765")),
        "connection": "local_process_and_project_files_check_only",
    })


@app.route("/", methods=["GET"])
def index():
    try:
        running = is_capcut_running()
        process_check = "verified"
    except ProcessStateUnknown:
        running = None
        process_check = "unknown"
    return jsonify({
        "plugin": "CapCut Bridge Windows Plugin",
        "version": APP_VERSION,
        "platform": "Windows",
        "capcut_running": running,
        "process_check": process_check,
        "projects_dir": str(CAPCUT_PROJECTS_DIR),
        "endpoints": [
            "GET /api/v1/status",
            "GET /api/v1/drafts",
            "POST /api/v1/launch",
            "POST /api/v1/export",
            "POST /api/v1/split",
            "POST /api/v1/play"
        ]
    })


@app.route("/api/v1/status", methods=["GET"])
def get_status():
    try:
        running = is_capcut_running()
        process_check = "verified"
        foreground = is_capcut_foreground() if running else False
    except ProcessStateUnknown:
        running = None
        foreground = None
        process_check = "unknown"
    return jsonify({
        "service": "hs-tech-capcut-plugin",
        "version": APP_VERSION,
        "running": running,
        "foreground": foreground,
        "process_check": process_check,
        "platform": "win32",
        "projects_path_exists": CAPCUT_PROJECTS_DIR.exists()
    })


@app.route("/api/v1/drafts", methods=["GET"])
def list_drafts():
    if not CAPCUT_PROJECTS_DIR.exists():
        return jsonify({"drafts": [], "count": 0, "source": "local_capcut_projects"})

    drafts = []
    for item in CAPCUT_PROJECTS_DIR.iterdir():
        if not item.is_dir() or item.name.startswith("."):
            continue
        content_file = item / "draft_content.json"
        summary = {
            "name": item.name,
            "duration_seconds": None,
            "media_count": None,
            "video_count": None,
            "audio_count": None,
            "timeline_count": None,
            "clip_count": None,
            "modified_at": None,
            "path": str(item),
        }
        try:
            modified = content_file.stat().st_mtime if content_file.exists() else item.stat().st_mtime
            summary["modified_at"] = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(modified))
        except OSError:
            pass
        if content_file.is_file():
            try:
                with content_file.open("r", encoding="utf-8") as draft_file:
                    content = json.load(draft_file)
                duration_us = int(content.get("duration", 0) or 0)
                materials = content.get("materials", {})
                videos = materials.get("videos", []) if isinstance(materials, dict) else []
                audios = materials.get("audios", []) if isinstance(materials, dict) else []
                tracks = content.get("tracks", [])
                videos = videos if isinstance(videos, list) else []
                audios = audios if isinstance(audios, list) else []
                tracks = tracks if isinstance(tracks, list) else []
                clip_count = sum(
                    len(track.get("segments", []))
                    for track in tracks
                    if isinstance(track, dict) and isinstance(track.get("segments", []), list)
                )
                summary.update({
                    "duration_seconds": round(duration_us / 1_000_000, 3),
                    "media_count": len(videos) + len(audios),
                    "video_count": len(videos),
                    "audio_count": len(audios),
                    "timeline_count": sum(1 for track in tracks if isinstance(track, dict) and track.get("segments")),
                    "clip_count": clip_count,
                })
            except (OSError, ValueError, TypeError, json.JSONDecodeError):
                summary["read_error"] = True
        drafts.append(summary)

    drafts.sort(key=lambda draft: draft["modified_at"] or "", reverse=True)
    return jsonify({"drafts": drafts, "count": len(drafts), "source": "local_capcut_projects"})


@app.route("/api/v1/export", methods=["POST"])
def export_timeline():
    """Trigger Export dialog and clear modal share screen using pyautogui."""
    try:
        require_capcut_foreground()
    except RuntimeError as exc:
        return jsonify({"status": "not_sent", "verified": False, "error": str(exc)}), _live_guard_http_status(exc)

    try:
        import pyautogui
    except ImportError:
        return jsonify({"error": "pyautogui is required for Live actions. Run: pip install pyautogui"}), 500

    # Each global keyboard action requires CapCut to remain foreground.
    try:
        require_capcut_foreground()
        pyautogui.hotkey("ctrl", "e")
        time.sleep(1.0)
        require_capcut_foreground()
        pyautogui.press("enter")
        time.sleep(2.0)  # fixed delay only; this is not render-progress polling
        require_capcut_foreground()
        pyautogui.press("esc")
    except RuntimeError as exc:
        return jsonify({"status": "not_sent_or_incomplete", "verified": False, "error": str(exc)}), _live_guard_http_status(exc)

    return jsonify({
        "status": "sent_unverified",
        "action": "export_shortcut_sequence_sent",
        "verified": False,
        "verification_scope": "keyboard_events_only",
        "message": "Keyboard events were sent; export dialog state, completion, and output file were not verified."
    })


@app.route("/api/v1/split", methods=["POST"])
def split_clip():
    """Trigger Split cut (Ctrl+B) at current playhead."""
    try:
        require_capcut_foreground()
    except RuntimeError as exc:
        return jsonify({"status": "not_sent", "verified": False, "error": str(exc)}), _live_guard_http_status(exc)

    try:
        import pyautogui
    except ImportError:
        return jsonify({"error": "pyautogui required"}), 500

    try:
        require_capcut_foreground()
    except RuntimeError as exc:
        return jsonify({"status": "not_sent", "verified": False, "error": str(exc)}), _live_guard_http_status(exc)
    pyautogui.hotkey("ctrl", "b")
    return jsonify({
        "status": "sent_unverified",
        "action": "split_shortcut_sent",
        "verified": False,
        "verification_scope": "keyboard_event_only",
        "message": "Split shortcut was sent to foreground CapCut; edit result was not verified."
    })


@app.route("/api/v1/play", methods=["POST"])
def toggle_play():
    """Toggle Play / Pause (Space)."""
    try:
        require_capcut_foreground()
    except RuntimeError as exc:
        return jsonify({"status": "not_sent", "verified": False, "error": str(exc)}), _live_guard_http_status(exc)

    try:
        import pyautogui
    except ImportError:
        return jsonify({"error": "pyautogui required"}), 500

    try:
        require_capcut_foreground()
    except RuntimeError as exc:
        return jsonify({"status": "not_sent", "verified": False, "error": str(exc)}), _live_guard_http_status(exc)
    pyautogui.press("space")
    return jsonify({
        "status": "sent_unverified",
        "action": "play_pause_shortcut_sent",
        "verified": False,
        "verification_scope": "keyboard_event_only",
    })


if __name__ == "__main__":
    port = int(os.environ.get("CAPCUT_PLUGIN_PORT", 8765))
    if port < 1 or port > 65535:
        raise ValueError("CAPCUT_PLUGIN_PORT must be between 1 and 65535")
    print("=======================================================")
    print(f"  HS.Tech CapCut Plugin v{APP_VERSION} running on port {port}")
    print(f"  API Address: http://127.0.0.1:{port}")
    print("=======================================================")
    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)
