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
   %LOCALAPPDATA%\\CapCut\\User Data\\Projects\\com.lveditor.draft\\<name>\\
   (Safely quits CapCut, wipes Timelines/ cache, repairs timeranges, writes, relaunches).
2. Live Lane: Desktop automation via pyautogui (Ctrl+E export, Ctrl+B split, Space play, etc.).

Usage:
  uv run capcut-bridge-win.py <command> [options]
"""

from __future__ import annotations

import argparse
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
# Process Control (Windows tasklist / taskkill)
# ---------------------------------------------------------------------------

def is_capcut_running() -> bool:
    """Check if CapCut.exe is running on Windows."""
    try:
        out = subprocess.check_output(
            ["tasklist", "/FI", "IMAGENAME eq CapCut.exe"],
            stderr=subprocess.DEVNULL,
            text=True,
        )
        return "CapCut.exe" in out
    except Exception:
        return False


def quit_capcut(timeout: float = 8.0) -> bool:
    """
    Hard Rule 1: CapCut must be fully closed before modifying drafts on disk!
    CapCut writes its own registry on quit, clobbering external modifications.
    """
    if not is_capcut_running():
        return True

    print("[CapCut Bridge Win] Gracefully closing CapCut.exe...")
    try:
        # Graceful close request
        subprocess.run(["taskkill", "/IM", "CapCut.exe"], check=False, capture_output=True)
    except Exception:
        pass

    start = time.time()
    while time.time() - start < timeout:
        if not is_capcut_running():
            print("[CapCut Bridge Win] CapCut closed cleanly.")
            return True
        time.sleep(0.4)

    # Force kill if still hung
    print("[CapCut Bridge Win] Sending force termination...")
    subprocess.run(["taskkill", "/F", "/IM", "CapCut.exe"], check=False, capture_output=True)
    time.sleep(0.5)
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
    """
    Context Manager for File-Lane operations on Windows.
    Enforces Hard Rule 1 (Quit -> Edit -> Relaunch) and wipes native Timelines/ cache (Hard Rule 3).
    """
    def __init__(self, draft_name: str, relaunch: bool = True):
        self.draft_name = draft_name
        self.relaunch = relaunch
        self.was_running = False
        self.draft_dir = CAPCUT_PROJECTS_DIR / draft_name

    def __enter__(self):
        self.was_running = is_capcut_running()
        if self.was_running:
            quit_capcut()

        # Hard Rule 3: Wipe native Timelines cache or edit is silently ignored!
        timelines_cache = self.draft_dir / "Timelines"
        if timelines_cache.exists():
            print(f"[CapCut Bridge Win] Wiping native cache at {timelines_cache}...")
            shutil.rmtree(timelines_cache, ignore_errors=True)

        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None and (self.was_running or self.relaunch):
            launch_capcut()


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
    repaired = repair_null_timeranges(data)
    if repaired > 0:
        print(f"[CapCut Bridge Win] Repaired {repaired} null source_timeranges to prevent encoder hang.")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _safe_replay_name(name: str) -> str:
    """Accept a single portable folder name; never allow replay path traversal."""
    if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9 _.-]{0,79}", name) or name in {".", ".."}:
        raise ValueError("Draft name must be a simple folder name (letters, numbers, spaces, dot, _ or -)")
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
    if target_dir.exists() and not overwrite:
        raise FileExistsError(f"Draft already exists; refusing to overwrite: {target_dir}")
    if target_dir.exists() and confirm_name != draft_name:
        raise ValueError(f"Overwrite requires --overwrite --confirm-name {draft_name!r}")

    CAPCUT_PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    stage_dir = CAPCUT_PROJECTS_DIR / f".{draft_name}.staging-{uuid.uuid4().hex}"
    backup_dir = CAPCUT_PROJECTS_DIR / f".{draft_name}.backup-{uuid.uuid4().hex}"
    was_running = is_capcut_running()
    if was_running and not quit_capcut():
        raise RuntimeError("CapCut did not close; refusing to modify draft files")
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

        out_file = draft_dir / "draft_content.json"
        write_draft_content(out_file, content)
        with out_file.open("r", encoding="utf-8") as staged_file:
            staged_content = json.load(staged_file)
        if not isinstance(staged_content, dict) or not isinstance(staged_content.get("tracks"), list):
            raise ValueError("Staged draft JSON failed validation")
        for material in staged_content.get("materials", {}).get("videos", []):
            media = Path(material.get("path", ""))
            try:
                rel_media = media.relative_to(stage_dir)
            except ValueError:
                continue
            material["path"] = str(draft_dir.parent / draft_name / rel_media)
        with out_file.open("w", encoding="utf-8") as staged_file:
            json.dump(staged_content, staged_file, indent=2, ensure_ascii=False)
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
        print(f"[CapCut Bridge Win] Draft written successfully at {target_dir / 'draft_content.json'}")
        if backup_dir.exists():
            print(f"[CapCut Bridge Win] Previous draft backup retained at {backup_dir}")
        committed = True
    finally:
        if stage_dir.exists():
            shutil.rmtree(stage_dir)
        if was_running or committed:
            launch_capcut()


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
    quit_capcut()


def cmd_live_play(args):
    check_pyautogui()
    pyautogui.press("space")
    print("[Live Lane Win] Toggled Play/Pause (Space).")


def cmd_live_split(args):
    check_pyautogui()
    pyautogui.hotkey("ctrl", "b")
    print("[Live Lane Win] Executed Split (Ctrl+B).")


def cmd_live_export(args):
    """
    Trigger export with Ctrl+E, confirm, and dismiss post-export modal.
    """
    check_pyautogui()
    if not is_capcut_running():
        raise RuntimeError("CapCut is not running; refusing to send export shortcuts")
    print("[Live Lane Win] Sending Ctrl+E export shortcut. Keep CapCut in the foreground; export completion is not observable.")
    pyautogui.hotkey("ctrl", "e")
    time.sleep(1.2)

    # Press Enter to start export
    print("[Live Lane Win] Confirming export dialog (Enter)...")
    pyautogui.press("enter")

    timeout = args.timeout or 60.0
    print(f"[Live Lane Win] Waiting {min(timeout, 3.0):.1f}s before dismissing the modal; the timeout is not a render-progress check.")
    time.sleep(3.0)

    # Dismiss post-export share modal (Esc)
    pyautogui.press("esc")
    print("[Live Lane Win] Keyboard shortcuts sent. Export completion and output file were not verified.")


def cmd_live_shot(args):
    check_pyautogui()
    out = args.out or f"capcut_win_qa_{int(time.time())}.png"
    shot = pyautogui.screenshot()
    shot.save(out)
    print(f"[Live Lane Win] Window screenshot saved to {out}")


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
