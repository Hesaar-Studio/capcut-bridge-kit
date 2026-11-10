# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "pyautogui",
#     "pillow",
# ]
# ///
"""
CapCut Bridge Kit (Windows Edition)
===================================
Automated video editing for CapCut Desktop on Windows.

Two Lanes:
1. File Lane: Structural edits directly to draft JSON under
   %LOCALAPPDATA%\\CapCut\\User Data\\Projects\\com.lveditor.draft\\<name>\\.
   It refuses to write while CapCut is running, retains a project backup, and
   verifies JSON readback; it does not close/relaunch CapCut or delete its cache.
2. Live Lane: Guarded desktop shortcuts via pyautogui (Ctrl+E export, Ctrl+B split, Space play).
   Keyboard events are not editor-side verification.

Usage:
  uv run capcut-bridge-win.py <command> [options]
"""

from __future__ import annotations

import argparse
import ctypes
from ctypes import wintypes
import json
import os
import re
import shutil
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from bridge_system.process_guard import capcut_process_running

try:
    import pyautogui
    PYAUTOGUI_AVAILABLE = True
except ImportError:
    PYAUTOGUI_AVAILABLE = False
    pyautogui = None  # type: ignore

# ---------------------------------------------------------------------------
# Windows Paths & Executable Detection
# ---------------------------------------------------------------------------
LOCAL_APP_DATA = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
CAPCUT_PROJECTS_DIR = (
    LOCAL_APP_DATA / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"
)

# Potential CapCut installation paths on Windows
POSSIBLE_CAPCUT_PATHS = [
    Path(r"C:\Program Files\CapCut\CapCut.exe"),
    Path(r"C:\Program Files (x86)\CapCut\CapCut.exe"),
    LOCAL_APP_DATA / "CapCut" / "Apps" / "CapCut.exe",
    LOCAL_APP_DATA / "Programs" / "CapCut" / "CapCut.exe",
]


def find_capcut_binary() -> Optional[Path]:
    """Find installed CapCut.exe on Windows."""
    for p in POSSIBLE_CAPCUT_PATHS:
        if p.exists():
            return p
    # Search AppData subfolders
    apps_dir = LOCAL_APP_DATA / "CapCut" / "Apps"
    if apps_dir.exists():
        for sub in apps_dir.glob("**/CapCut.exe"):
            return sub
    return POSSIBLE_CAPCUT_PATHS[0]


CAPCUT_PATH = find_capcut_binary()


# ---------------------------------------------------------------------------
# Process Control (verified Windows tasklist probe)
# ---------------------------------------------------------------------------

def is_capcut_running() -> bool:
    """Return CapCut's verified process state; query failures must stop the caller."""
    return capcut_process_running(platform="win32")


def is_capcut_foreground() -> bool:
    """True only when the foreground window belongs to CapCut.exe."""
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
        process_handle = kernel32.OpenProcess(0x1000, False, pid.value)
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


def require_capcut_foreground() -> None:
    if not is_capcut_running():
        raise RuntimeError("CapCut is not currently open")
    if not is_capcut_foreground():
        raise RuntimeError("Bring CapCut to the foreground before sending a live keyboard shortcut")


def quit_capcut(timeout: float = 8.0) -> bool:
    """Compatibility helper: never terminate or force-kill the user's editor."""
    return not is_capcut_running()


def launch_capcut(wait_sec: float = 6.0):
    """Launch CapCut on Windows and wait for UI initialization."""
    print(f"[CapCut Bridge Win] Launching {CAPCUT_PATH}...")
    try:
        subprocess.Popen([str(CAPCUT_PATH)])
    except Exception as e:
        print(f"[CapCut Bridge Win] Error launching CapCut: {e}", file=sys.stderr)
    time.sleep(wait_sec)


class SafeDraftEditor:
    """Guard file-lane operations without controlling the user's editor."""
    def __init__(self, draft_name: str, relaunch: bool = False):
        from draft_engine.reader import safe_draft_name
        self.draft_name = safe_draft_name(draft_name)
        self.relaunch = relaunch
        self.draft_dir = CAPCUT_PROJECTS_DIR / self.draft_name

    def __enter__(self):
        if is_capcut_running():
            raise RuntimeError("CapCut is running; close it yourself before editing draft files. No process was terminated.")
        if self.draft_dir.is_symlink() or not self.draft_dir.is_dir():
            raise FileNotFoundError(f"Draft directory not found or unsafe: {self.draft_dir}")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # The bridge never launches or closes CapCut implicitly.
        return False


def ensure_sandbox_footage(src_path: Path, draft_dir: Path) -> Path:
    """
    Copies or hardlinks footage into draft Resources/ folder.
    """
    src_path = Path(src_path).resolve()
    if not src_path.exists():
        raise FileNotFoundError(f"Source footage not found: {src_path}")

    resources_dir = draft_dir / "Resources"
    resources_dir.mkdir(parents=True, exist_ok=True)
    dest_path = resources_dir / src_path.name

    if dest_path.exists():
        return dest_path

    try:
        shutil.copy2(src_path, dest_path)
        print(f"[CapCut Bridge Win] Linked {src_path.name} into Resources/")
    except Exception as e:
        print(f"[CapCut Bridge Win] Copy error: {e}", file=sys.stderr)

    return dest_path


def repair_null_timeranges(content: dict) -> int:
    """
    Hard Rule 5: A text segment with source_timerange: null wedges CapCut's encoder mid-export!
    """
    repaired_count = 0
    tracks = content.get("tracks", [])
    for track in tracks:
        segments = track.get("segments", [])
        for seg in segments:
            if seg.get("source_timerange") is None:
                target_range = seg.get("target_timerange")
                dur = target_range.get("duration", 3000000) if target_range else 3000000
                seg["source_timerange"] = {
                    "duration": dur,
                    "start": 0
                }
                repaired_count += 1
    return repaired_count


# ---------------------------------------------------------------------------
# File Lane Commands
# ---------------------------------------------------------------------------

def read_draft_content(draft_dir: Path) -> Tuple[dict, Path]:
    for filename in ["draft_content.json", "draft_info.json"]:
        p = draft_dir / filename
        if p.exists():
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f), p
    raise FileNotFoundError(f"No draft_content.json in {draft_dir}")


def write_draft_content(path: Path, data: dict):
    """Write a new staged JSON atomically, or back up and atomically update an existing project."""
    path = Path(path)
    repaired = repair_null_timeranges(data)
    if repaired > 0:
        print(f"[CapCut Bridge Win] Repaired {repaired} null source_timeranges.")

    if path.is_file() and path.name in {"draft_content.json", "draft_info.json"}:
        from draft_engine import update_existing_draft_json
        result = update_existing_draft_json(path.parent, data)
        if result.get("backup_dir"):
            print(f"[CapCut Bridge Win] Retained project backup at {result['backup_dir']}")
        print(f"[CapCut Bridge Win] JSON disk readback verified; CapCut acceptance remains unverified.")
        return result

    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp-{uuid.uuid4().hex}")
    try:
        with temporary.open("x", encoding="utf-8", newline="\n") as handle:
            json.dump(data, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        if json.loads(path.read_text(encoding="utf-8")) != data:
            raise RuntimeError("Draft JSON disk readback did not match the staged content")
        return {"verified": True, "verification_scope": "draft_json_disk_readback_only", "draft_file": str(path)}
    finally:
        try:
            temporary.unlink(missing_ok=True)
        except OSError:
            pass


def _safe_replay_name(name: str) -> str:
    """Accept a single portable folder name; never allow replay path traversal."""
    if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9 _().-]{0,79}", name) or name in {".", ".."}:
        raise ValueError("Draft name must be a simple folder name (letters, numbers, spaces, parentheses, dot, _ or -)")
    return name


def cmd_ls(args):
    """List drafts in Windows CapCut projects directory."""
    if not CAPCUT_PROJECTS_DIR.exists():
        print(f"Projects directory not found at {CAPCUT_PROJECTS_DIR}")
        return

    print(f"\nWindows CapCut Projects ({CAPCUT_PROJECTS_DIR}):")
    print("-" * 60)
    drafts = []
    for item in sorted(CAPCUT_PROJECTS_DIR.iterdir()):
        if item.is_dir() and not item.name.startswith("."):
            print(f" • {item.name}")
            drafts.append(item.name)
    print(f"\nTotal: {len(drafts)} drafts.")


def cmd_replay(args):
    """EDL -> new draft on Windows."""
    job_file = Path(args.job).resolve()
    with open(job_file, "r", encoding="utf-8") as f:
        job = json.load(f)

    draft_name = _safe_replay_name(args.name or job.get("draft_name") or f"Replay_{int(time.time())}")
    target_dir = CAPCUT_PROJECTS_DIR / draft_name
    overwrite = bool(getattr(args, "overwrite", False))
    confirm_name = getattr(args, "confirm_name", None)
    if target_dir.is_symlink():
        raise ValueError("Refusing to overwrite a draft directory that is a symbolic link.")
    if target_dir.exists() and not overwrite:
        raise FileExistsError(f"Draft already exists; refusing to overwrite: {target_dir}")
    if target_dir.exists() and confirm_name != draft_name:
        raise ValueError(f"Overwrite requires --overwrite --confirm-name {draft_name!r}")
    if is_capcut_running():
        raise RuntimeError("CapCut is running; close it yourself before replaying. No process was terminated.")

    CAPCUT_PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    stage_dir = CAPCUT_PROJECTS_DIR / f".{draft_name}.staging-{uuid.uuid4().hex}"
    backup_dir = CAPCUT_PROJECTS_DIR / f".{draft_name}.backup-{uuid.uuid4().hex}"
    from draft_engine.writer import acquire_draft_write_lock
    release_write_lock = acquire_draft_write_lock(CAPCUT_PROJECTS_DIR, draft_name)
    committed = False
    try:
        draft_dir = stage_dir
        draft_dir.mkdir(parents=True, exist_ok=True)
        (draft_dir / "Resources").mkdir(exist_ok=True)

        cuts = job.get("cuts", [])
        print(f"[CapCut Bridge Win] Rebuilding draft '{draft_name}' with {len(cuts)} cuts...")

        draft_id = str(uuid.uuid4()).upper()
        materials: Dict[str, list] = {
            "videos": [],
            "audios": [],
            "texts": [],
            "material_animations": [],
            "canvases": [],
            "speeds": [],
        }

        main_track_segments = []
        timeline_cursor_us = 0

        for idx, cut in enumerate(cuts):
            media_path = Path(cut["source_path"])
            local_media = ensure_sandbox_footage(media_path, draft_dir)

            src_in_us = int(cut.get("start", 0) * 1_000_000)
            dur_us = int(cut.get("duration", 3.0) * 1_000_000)

            video_mat_id = str(uuid.uuid4()).upper()
            seg_id = str(uuid.uuid4()).upper()

            materials["videos"].append({
                "id": video_mat_id,
                "type": "video",
                "path": str(local_media),
                "duration": dur_us + src_in_us,
                "width": cut.get("width", 1080),
                "height": cut.get("height", 1920),
                "material_name": local_media.name,
            })

            main_track_segments.append({
                "id": seg_id,
                "material_id": video_mat_id,
                "render_index": idx,
                "target_timerange": {"start": timeline_cursor_us, "duration": dur_us},
                "source_timerange": {"start": src_in_us, "duration": dur_us},
                "speed": 1.0,
                "volume": 1.0,
                "extra_material_refs": []
            })
            timeline_cursor_us += dur_us

        content = {
            "id": draft_id,
            "version": 2,
            "canvas_config": {"width": 1080, "height": 1920, "ratio": "9:16"},
            "duration": timeline_cursor_us,
            "fps": 30.0,
            "materials": materials,
            "tracks": [
                {
                    "id": str(uuid.uuid4()).upper(),
                    "type": "video",
                    "attribute": 0,
                    "segments": main_track_segments
                }
            ]
        }

        # Point media paths at the final location before staging the JSON.
        for material in content.get("materials", {}).get("videos", []):
            media = Path(material.get("path", ""))
            try:
                rel_media = media.relative_to(stage_dir)
            except ValueError:
                continue
            material["path"] = str(target_dir / rel_media)

        out_file = draft_dir / "draft_content.json"
        write_draft_content(out_file, content)
        with out_file.open("r", encoding="utf-8") as staged_file:
            staged_content = json.load(staged_file)
        from draft_engine import validate_draft_structure
        validation = validate_draft_structure(staged_content)
        if not validation.is_valid:
            raise ValueError("Staged draft JSON failed structural validation: " + "; ".join(validation.errors))
        if is_capcut_running():
            raise RuntimeError("CapCut started during replay; refusing to replace project files.")
        if target_dir.is_symlink():
            raise ValueError("Draft target changed to a symbolic link during replay; refusing to continue.")
        if target_dir.exists() and not overwrite:
            raise FileExistsError(f"Draft appeared while building; refusing to overwrite: {target_dir}")
        if target_dir.exists():
            target_dir.rename(backup_dir)
        try:
            stage_dir.rename(target_dir)
        except Exception:
            if backup_dir.exists() and not target_dir.exists():
                backup_dir.rename(target_dir)
            raise
        final_content = json.loads((target_dir / "draft_content.json").read_text(encoding="utf-8"))
        if final_content != staged_content:
            raise RuntimeError("Final draft JSON disk readback did not match the staged content.")
        final_validation = validate_draft_structure(final_content, check_files=True, base_dir=target_dir)
        if not final_validation.is_valid:
            raise RuntimeError("Final draft JSON failed structural validation: " + "; ".join(final_validation.errors))
        print("[CapCut Bridge Win] Draft JSON staged and disk-readback verified. CapCut parse, timeline UI, and export remain unverified.")
        if backup_dir.exists():
            print(f"[CapCut Bridge Win] Previous project backup retained at {backup_dir}")
        committed = True
    finally:
        if stage_dir.exists():
            shutil.rmtree(stage_dir, ignore_errors=True)
        release_write_lock()


def cmd_add_text(args):
    draft_dir = CAPCUT_PROJECTS_DIR / args.draft
    with SafeDraftEditor(args.draft):
        content, file_path = read_draft_content(draft_dir)
        at_us = int(args.at * 1_000_000)
        dur_us = int((args.dur if args.dur else 3.0) * 1_000_000)
        text_mat_id = str(uuid.uuid4()).upper()
        seg_id = str(uuid.uuid4()).upper()

        content.setdefault("materials", {}).setdefault("texts", []).append({
            "id": text_mat_id,
            "type": "text",
            "content": f"<font color=\"#ffffff\">{args.text}</font>",
            "font_size": 28.0,
        })

        text_track = next((t for t in content.get("tracks", []) if t.get("type") == "text"), None)
        if not text_track:
            text_track = {"id": str(uuid.uuid4()).upper(), "type": "text", "segments": []}
            content.setdefault("tracks", []).append(text_track)

        text_track["segments"].append({
            "id": seg_id,
            "material_id": text_mat_id,
            "render_index": 200,
            "target_timerange": {"start": at_us, "duration": dur_us},
            "source_timerange": {"start": 0, "duration": dur_us},
            "speed": 1.0,
        })
        write_draft_content(file_path, content)
        print(f"[CapCut Bridge Win] Added caption '{args.text}' at {args.at}s.")


# ---------------------------------------------------------------------------
# Live Lane Commands (Windows pyautogui)
# ---------------------------------------------------------------------------

def check_pyautogui():
    if not PYAUTOGUI_AVAILABLE or pyautogui is None:
        raise RuntimeError("Live lane on Windows requires pyautogui. Run with: uv run capcut-bridge-win.py <cmd>")


def cmd_live_launch(args):
    launch_capcut()


def cmd_live_quit(args):
    if is_capcut_running():
        print("CapCut is still running; the bridge does not terminate applications. Close it manually if desired.")
    else:
        print("CapCut is not running.")


def cmd_live_play(args):
    check_pyautogui()
    require_capcut_foreground()
    pyautogui.press("space")
    print("[Live Lane Win] Toggled Play/Pause (Space).")


def cmd_live_split(args):
    check_pyautogui()
    require_capcut_foreground()
    pyautogui.hotkey("ctrl", "b")
    print("[Live Lane Win] Executed Split (Ctrl+B).")


def cmd_live_export(args):
    """Send an export shortcut only; never claim render or output-file completion."""
    if getattr(args, "to", None):
        raise NotImplementedError("A destination path is not supported by the keyboard-only export lane.")
    check_pyautogui()
    require_capcut_foreground()
    print("[Live Lane Win] Sending Ctrl+E. Export destination and completion are not observable.")
    pyautogui.hotkey("ctrl", "e")
    time.sleep(1.2)

    require_capcut_foreground()
    print("[Live Lane Win] Sending Enter to the current CapCut foreground window; dialog state is not verified.")
    pyautogui.press("enter")
    time.sleep(3.0)

    require_capcut_foreground()
    print("[Live Lane Win] Sending Esc to the current CapCut foreground window; no render status was checked.")
    pyautogui.press("esc")
    print("[Live Lane Win] Keyboard events sent. Export completion and output file were not verified.")


def cmd_live_shot(args):
    check_pyautogui()
    require_capcut_foreground()
    out = args.out or f"capcut_win_qa_{int(time.time())}.png"
    shot = pyautogui.screenshot()
    shot.save(out)
    print(f"[Live Lane Win] Desktop screenshot saved to {out}; this is not an editor-side timeline verification.")


# ---------------------------------------------------------------------------
# Main Router
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        prog="capcut-bridge-win",
        description="CapCut Bridge Kit (Windows Edition)",
    )
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("ls").set_defaults(func=cmd_ls)

    p_rep = sub.add_parser("replay")
    p_rep.add_argument("job", help="cuts.json path")
    p_rep.add_argument("--name", default=None)
    p_rep.add_argument("--overwrite", action="store_true", help="Replace an existing draft after staging a backup")
    p_rep.add_argument("--confirm-name", help="Must exactly match --name to confirm overwrite")
    p_rep.set_defaults(func=cmd_replay)

    p_txt = sub.add_parser("add-text")
    p_txt.add_argument("draft")
    p_txt.add_argument("text")
    p_txt.add_argument("--at", type=float, required=True)
    p_txt.add_argument("--dur", type=float, default=3.0)
    p_txt.set_defaults(func=cmd_add_text)

    sub.add_parser("launch").set_defaults(func=cmd_live_launch)
    sub.add_parser("quit").set_defaults(func=cmd_live_quit)
    sub.add_parser("play").set_defaults(func=cmd_live_play)
    sub.add_parser("split").set_defaults(func=cmd_live_split)

    p_exp = sub.add_parser("export")
    p_exp.add_argument("--to", default=None)
    p_exp.add_argument("--timeout", type=float, default=60.0)
    p_exp.set_defaults(func=cmd_live_export)

    p_shot = sub.add_parser("shot")
    p_shot.add_argument("out", nargs="?", default=None)
    p_shot.set_defaults(func=cmd_live_shot)

    args = parser.parse_args()
    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
