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
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit
from flask import Flask, request, jsonify

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
    try:
        out = subprocess.check_output(
            ["tasklist", "/FI", "IMAGENAME eq CapCut.exe"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
        return "CapCut.exe" in out
    except Exception:
        return False


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


@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "plugin": "CapCut Bridge Windows Plugin",
        "version": "1.2.0",
        "platform": "Windows",
        "capcut_running": is_capcut_running(),
        "projects_dir": str(CAPCUT_PROJECTS_DIR),
        "endpoints": [
            "GET /api/v1/status",
            "GET /api/v1/drafts",
            "POST /api/v1/launch",
            "POST /api/v1/export",
            "POST /api/v1/split",
            "POST /api/v1/play",
            "POST /api/v1/seek",
            "POST /api/v1/add-text",
            "POST /api/v1/replay"
        ]
    })


@app.route("/api/v1/status", methods=["GET"])
def get_status():
    running = is_capcut_running()
    return jsonify({
        "running": running,
        "platform": "win32",
        "projects_path_exists": CAPCUT_PROJECTS_DIR.exists()
    })


@app.route("/api/v1/drafts", methods=["GET"])
def list_drafts():
    if not CAPCUT_PROJECTS_DIR.exists():
        return jsonify({"drafts": [], "error": "Projects directory not found"}), 404

    drafts = []
    for item in sorted(CAPCUT_PROJECTS_DIR.iterdir()):
        if item.is_dir() and not item.name.startswith("."):
            content_file = item / "draft_content.json"
            dur_sec = 0.0
            if content_file.exists():
                try:
                    with open(content_file, "r", encoding="utf-8") as f:
                        d = json.load(f)
                        dur_sec = d.get("duration", 0) / 1_000_000
                except Exception:
                    pass
            drafts.append({
                "name": item.name,
                "duration_seconds": dur_sec,
                "path": str(item)
            })

    return jsonify({"drafts": drafts, "count": len(drafts)})


@app.route("/api/v1/export", methods=["POST"])
def export_timeline():
    """Trigger Export dialog and clear modal share screen using pyautogui."""
    try:
        require_capcut_foreground()
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 409 if is_capcut_running() else 400

    try:
        import pyautogui
    except ImportError:
        return jsonify({"error": "pyautogui is required for Live actions. Run: pip install pyautogui"}), 500

    # Ctrl + E shortcut
    pyautogui.hotkey("ctrl", "e")
    time.sleep(1.0)
    # Confirm
    pyautogui.press("enter")
    time.sleep(2.0)
    # Clear modal share screen (Esc)
    pyautogui.press("esc")

    return jsonify({
        "success": True,
        "action": "export_shortcut_sent",
        "verified": False,
        "message": "Export shortcut sent; CapCut's completed output was not verified."
    })


@app.route("/api/v1/split", methods=["POST"])
def split_clip():
    """Trigger Split cut (Ctrl+B) at current playhead."""
    try:
        require_capcut_foreground()
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 409 if is_capcut_running() else 400

    try:
        import pyautogui
    except ImportError:
        return jsonify({"error": "pyautogui required"}), 500

    pyautogui.hotkey("ctrl", "b")
    return jsonify({
        "success": True,
        "action": "split_shortcut_sent",
        "verified": False,
        "message": "Split shortcut sent to the foreground application; edit result was not verified."
    })


@app.route("/api/v1/play", methods=["POST"])
def toggle_play():
    """Toggle Play / Pause (Space)."""
    try:
        require_capcut_foreground()
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 409 if is_capcut_running() else 400

    try:
        import pyautogui
    except ImportError:
        return jsonify({"error": "pyautogui required"}), 500

    pyautogui.press("space")
    return jsonify({"success": True, "action": "play_pause_shortcut_sent", "verified": False})


if __name__ == "__main__":
    port = int(os.environ.get("CAPCUT_PLUGIN_PORT", 8765))
    print(f"=======================================================")
    print(f"  CapCut Windows Plugin Server running on port {port}")
    print(f"  API Address: http://127.0.0.1:{port}")
    print(f"=======================================================")
    app.run(host="127.0.0.1", port=port, debug=False)
