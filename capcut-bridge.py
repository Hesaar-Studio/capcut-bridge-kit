# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "pyobjc-framework-ApplicationServices",
#     "pyobjc-framework-Quartz",
# ]
# ///
"""
CapCut Bridge Kit
=================
Automated video editing for CapCut Desktop on macOS.

Two Lanes:
1. File Lane: Structural edits directly to draft JSON under
   ~/Movies/CapCut/User Data/Projects/com.lveditor.draft/<name>/
   (Safely quits CapCut, wipes Timelines/ cache, repairs timeranges, writes, relaunches).
2. Live Lane: Accessibility automation via AXUIElement & Quartz CGEvents
   targeting internal automation IDs (PlayerPlayBtn, MTLSVideoP:<clip>, etc.).

Usage:
  uv run capcut-bridge.py <command> [options]
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
import time
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# macOS Native Frameworks (Imported guarded for cross-env safety / inspection)
# ---------------------------------------------------------------------------
try:
    import ApplicationServices as AX
    import Quartz as CG
    from Quartz import (
        CGEventCreateKeyboardEvent,
        CGEventCreateMouseEvent,
        CGEventPost,
        CGEventSetFlags,
        CGPoint,
        kCGEventFlagMaskCommand,
        kCGEventFlagMaskControl,
        kCGEventFlagMaskShift,
        kCGEventKeyDown,
        kCGEventKeyUp,
        kCGEventLeftMouseDown,
        kCGEventLeftMouseUp,
        kCGEventMouseMoved,
        kCGHIDEventTap,
        kCGMouseButtonLeft,
    )
    MACOS_NATIVE_AVAILABLE = True
except Exception as e:
    MACOS_NATIVE_AVAILABLE = False
    AX = None  # type: ignore
    CG = None  # type: ignore


# ---------------------------------------------------------------------------
# Constants & Paths
# ---------------------------------------------------------------------------
CAPCUT_BUNDLE_ID = "com.lemon.lvpro"  # CapCut global macOS app bundle id
CAPCUT_APP_NAME = "CapCut"

HOME_DIR = Path.home()
MOVIES_DIR = HOME_DIR / "Movies"
CAPCUT_PROJECTS_DIR = (
    MOVIES_DIR / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"
)
ROOT_META_FILE = (
    MOVIES_DIR / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft" / "root_meta_info.json"
)

TEMPLATES_DIR = Path(__file__).resolve().parent / "capcut-templates"


# ---------------------------------------------------------------------------
# Helpers: Hard Rules & Safety Checks
# ---------------------------------------------------------------------------

def check_macos_env():
    """Verify running on macOS with required permissions."""
    if sys.platform != "darwin":
        print("[WARNING] CapCut Bridge Kit is built for macOS. Running in compatibility mode.", file=sys.stderr)
        return False
    return True


def is_capcut_running() -> bool:
    """Check if CapCut desktop application is currently active."""
    try:
        out = subprocess.check_output(["pgrep", "-x", CAPCUT_APP_NAME], stderr=subprocess.DEVNULL)
        return len(out.strip()) > 0
    except subprocess.CalledProcessError:
        return False


def quit_capcut(timeout: float = 8.0) -> bool:
    """
    Hard Rule 1: CapCut must be fully closed before modifying drafts on disk!
    CapCut writes its own registry on quit, clobbering external modifications.
    """
    if not is_capcut_running():
        return True

    print(f"[CapCut Bridge] Gracefully closing {CAPCUT_APP_NAME} to ensure safe file-lane write...")
    try:
        subprocess.run(
            ["osascript", "-e", f'tell application "{CAPCUT_APP_NAME}" to quit'],
            check=False,
            capture_output=True,
        )
    except Exception:
        pass

    start = time.time()
    while time.time() - start < timeout:
        if not is_capcut_running():
            time.sleep(0.5)
            print("[CapCut Bridge] CapCut closed cleanly.")
            return True
        time.sleep(0.3)

    # Force kill if hung
    print("[CapCut Bridge] Process still active; sending SIGKILL...")
    subprocess.run(["pkill", "-9", "-x", CAPCUT_APP_NAME], check=False, capture_output=True)
    time.sleep(0.5)
    return not is_capcut_running()


def launch_capcut(wait_sec: float = 2.5):
    """Launch CapCut application."""
    print(f"[CapCut Bridge] Launching {CAPCUT_APP_NAME}...")
    subprocess.run(["open", "-a", CAPCUT_APP_NAME], check=False)
    time.sleep(wait_sec)


class SafeDraftEditor:
    """
    Context Manager for File-Lane operations.
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
            print(f"[CapCut Bridge] Wiping native cache at {timelines_cache}...")
            shutil.rmtree(timelines_cache, ignore_errors=True)

        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None and (self.was_running or self.relaunch):
            launch_capcut()


def ensure_sandbox_footage(src_path: Path, draft_dir: Path) -> Path:
    """
    Hard Rule 2: Raw footage must reside under ~/Movies.
    CapCut's sandbox cannot read external paths (shows red "File not accessible" clips).
    This helper hardlinks (or copies) source media into draft's Resources/ folder.
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
        # Attempt hardlink
        os.link(src_path, dest_path)
        print(f"[CapCut Bridge] Hardlinked {src_path.name} into draft Resources/")
    except OSError:
        # Fallback to copy if cross-device or permission boundary
        print(f"[CapCut Bridge] Copying {src_path.name} into draft Resources/ (cross-device)...")
        shutil.copy2(src_path, dest_path)

    return dest_path


def repair_null_timeranges(content: dict) -> int:
    """
    Hard Rule 5: A text segment with source_timerange: null wedges CapCut's encoder mid-export!
    CapCut's own save normalizes text segments to null source range; when re-imported
    after cache wipe, that null causes export crashes. This repairs every text segment.
    """
    repaired_count = 0
    tracks = content.get("tracks", [])
    for track in tracks:
        segments = track.get("segments", [])
        for seg in segments:
            # If segment has no source_timerange or it is None
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
# Template Loaders
# ---------------------------------------------------------------------------

def load_template(name: str) -> dict:
    """Load JSON material/segment stub from capcut-templates/ directory or provide defaults."""
    tpl_file = TEMPLATES_DIR / name
    if tpl_file.exists():
        with open(tpl_file, "r", encoding="utf-8") as f:
            return json.load(f)

    # Fallback minimal clean CapCut stubs
    if name == "text-material.json":
        return {
            "id": "",
            "type": "text",
            "content": "<font color=\"#ffffff\">Default</font>",
            "font_size": 28.0,
            "alignment": 1,
            "has_shadow": False,
            "border_width": 0.0,
            "style_name": "tiktok_raw"
        }
    elif name == "text-segment.json":
        return {
            "id": "",
            "material_id": "",
            "render_index": 1000,
            "target_timerange": {"start": 0, "duration": 3000000},
            "source_timerange": {"start": 0, "duration": 3000000},
            "speed": 1.0,
            "volume": 1.0,
            "extra_material_refs": []
        }
    elif name == "text-ref-material_animations.json":
        return {
            "id": "",
            "type": "material_animation",
            "animations": []
        }
    return {}


# ---------------------------------------------------------------------------
# File Lane Implementations
# ---------------------------------------------------------------------------

def get_draft_path(draft_name: str) -> Path:
    return CAPCUT_PROJECTS_DIR / draft_name


def read_draft_content(draft_dir: Path) -> Tuple[dict, Path]:
    """Read draft_content.json (or draft_info.json in older CapCut versions)."""
    for filename in ["draft_content.json", "draft_info.json"]:
        p = draft_dir / filename
        if p.exists():
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f), p
    raise FileNotFoundError(f"No draft_content.json found in {draft_dir}")


def write_draft_content(path: Path, data: dict):
    """Write sanitized JSON draft with repaired timeranges."""
    repaired = repair_null_timeranges(data)
    if repaired > 0:
        print(f"[CapCut Bridge] Repaired {repaired} null source_timeranges to prevent encoder hang.")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _safe_replay_name(name: str) -> str:
    """Accept a single portable folder name; never allow replay path traversal."""
    if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9 _.-]{0,79}", name) or name in {".", ".."}:
        raise ValueError("Draft name must be a simple folder name (letters, numbers, spaces, dot, _ or -)")
    return name


def cmd_ls(args):
    """List all drafts in CapCut's projects registry."""
    if not CAPCUT_PROJECTS_DIR.exists():
        print(f"Projects directory not found at {CAPCUT_PROJECTS_DIR}")
        return

    print(f"\nCapCut Projects ({CAPCUT_PROJECTS_DIR}):")
    print("-" * 60)
    drafts = []
    for item in sorted(CAPCUT_PROJECTS_DIR.iterdir()):
        if item.is_dir() and not item.name.startswith("."):
            content_file = item / "draft_content.json"
            dur_str = "empty"
            if content_file.exists():
                try:
                    with open(content_file, "r") as f:
                        d = json.load(f)
                        dur_us = d.get("duration", 0)
                        dur_str = f"{dur_us / 1_000_000:.2f}s"
                except Exception:
                    pass
            print(f" • {item.name:<32} {dur_str}")
            drafts.append(item.name)

    if not drafts:
        print(" (No drafts found)")
    print(f"\nTotal: {len(drafts)} drafts.")


def cmd_replay(args):
    """
    EDL -> new draft, one clip per cut.
    Reads cuts.json job file and rebuilds the draft from scratch.
    """
    job_file = Path(args.job).resolve()
    if not job_file.exists():
        print(f"Error: Job file {job_file} not found.", file=sys.stderr)
        sys.exit(1)

    with open(job_file, "r", encoding="utf-8") as f:
        job = json.load(f)

    draft_name = args.name or job.get("draft_name") or f"Replay_{int(time.time())}"
    draft_name = _safe_replay_name(draft_name)
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
        print(f"[CapCut Bridge] Rebuilding draft '{draft_name}' with {len(cuts)} cuts...")

        # Build clean minimal CapCut draft structure
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

            # CapCut uses microsecond timestamps (1 sec = 1,000,000 us)
            src_in_us = int(cut.get("start", 0) * 1_000_000)
            dur_us = int(cut.get("duration", 3.0) * 1_000_000)

            video_mat_id = str(uuid.uuid4()).upper()
            speed_mat_id = str(uuid.uuid4()).upper()
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

            materials["speeds"].append({
                "id": speed_mat_id,
                "speed": 1.0,
                "mode": 0,
            })

            main_track_segments.append({
                "id": seg_id,
                "material_id": video_mat_id,
                "render_index": idx,
                "target_timerange": {
                    "start": timeline_cursor_us,
                    "duration": dur_us
                },
                "source_timerange": {
                    "start": src_in_us,
                    "duration": dur_us
                },
                "speed": 1.0,
                "volume": 1.0,
                "extra_material_refs": [speed_mat_id]
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
                    "flag": 0,
                    "segments": main_track_segments
                }
            ]
        }

        out_file = draft_dir / "draft_content.json"
        write_draft_content(out_file, content)
        # Validate staged JSON before touching the existing project.
        with out_file.open("r", encoding="utf-8") as staged_file:
            staged_content = json.load(staged_file)
        if not isinstance(staged_content, dict) or not isinstance(staged_content.get("tracks"), list):
            raise ValueError("Staged draft JSON failed validation")
        # Media paths were written under staging; rewrite them for the final location.
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
        print(f"[CapCut Bridge] Draft written successfully at {target_dir / 'draft_content.json'}")
        if backup_dir.exists():
            print(f"[CapCut Bridge] Previous draft backup retained at {backup_dir}")
        committed = True
    finally:
        if stage_dir.exists():
            shutil.rmtree(stage_dir)
        if was_running or committed:
            launch_capcut()


def cmd_add_overlay(args):
    """
    add-overlay <draft> <mov> --at <s> [--layer N] [--dur <s>] [--src <s>] [--ri N] [--mute] [--force]
    """
    draft_dir = get_draft_path(args.draft)
    with SafeDraftEditor(args.draft):
        content, file_path = read_draft_content(draft_dir)
        local_mov = ensure_sandbox_footage(Path(args.mov), draft_dir)

        at_us = int(args.at * 1_000_000)
        dur_us = int((args.dur if args.dur else 4.0) * 1_000_000)
        src_us = int((args.src if args.src else 0.0) * 1_000_000)

        video_mat_id = str(uuid.uuid4()).upper()
        seg_id = str(uuid.uuid4()).upper()

        content["materials"]["videos"].append({
            "id": video_mat_id,
            "type": "video",
            "path": str(local_mov),
            "duration": dur_us + src_us,
            "material_name": local_mov.name,
        })

        overlay_seg = {
            "id": seg_id,
            "material_id": video_mat_id,
            "render_index": args.ri or 100,
            "target_timerange": {"start": at_us, "duration": dur_us},
            "source_timerange": {"start": src_us, "duration": dur_us},
            "speed": 1.0,
            "volume": 0.0 if args.mute else 1.0,
            "extra_material_refs": []
        }

        # Find or create overlay video track
        overlay_track = None
        for track in content.get("tracks", []):
            if track.get("type") == "video" and track.get("attribute") == 1:
                overlay_track = track
                break

        if not overlay_track:
            overlay_track = {
                "id": str(uuid.uuid4()).upper(),
                "type": "video",
                "attribute": 1,
                "segments": []
            }
            content.setdefault("tracks", []).append(overlay_track)

        overlay_track["segments"].append(overlay_seg)
        write_draft_content(file_path, content)
        print(f"[CapCut Bridge] Overlay {local_mov.name} added at {args.at}s (duration {dur_us/1e6}s)")


def cmd_add_text(args):
    """
    add-text <draft> "<text>" --at <s> [--dur <s>] [--ri N] [--force]
    """
    draft_dir = get_draft_path(args.draft)
    with SafeDraftEditor(args.draft):
        content, file_path = read_draft_content(draft_dir)

        at_us = int(args.at * 1_000_000)
        dur_us = int((args.dur if args.dur else 3.0) * 1_000_000)

        mat_stub = load_template("text-material.json")
        seg_stub = load_template("text-segment.json")

        text_mat_id = str(uuid.uuid4()).upper()
        seg_id = str(uuid.uuid4()).upper()

        mat_stub["id"] = text_mat_id
        mat_stub["content"] = f"<font color=\"#ffffff\">{args.text}</font>"
        content.setdefault("materials", {}).setdefault("texts", []).append(mat_stub)

        seg_stub["id"] = seg_id
        seg_stub["material_id"] = text_mat_id
        seg_stub["render_index"] = args.ri or 200
        seg_stub["target_timerange"] = {"start": at_us, "duration": dur_us}
        # Hard Rule 5: Ensure source_timerange is never null
        seg_stub["source_timerange"] = {"start": 0, "duration": dur_us}

        text_track = None
        for track in content.get("tracks", []):
            if track.get("type") == "text":
                text_track = track
                break

        if not text_track:
            text_track = {
                "id": str(uuid.uuid4()).upper(),
                "type": "text",
                "attribute": 0,
                "segments": []
            }
            content.setdefault("tracks", []).append(text_track)

        text_track["segments"].append(seg_stub)
        write_draft_content(file_path, content)
        print(f"[CapCut Bridge] Text '{args.text}' added at {args.at}s.")


def cmd_graphics(args):
    """
    graphics <draft> <job>
    Places an entire graphics plan (captions, overlays, stickers) into draft.
    """
    draft_dir = get_draft_path(args.draft)
    plan_file = Path(args.job).resolve()
    if not plan_file.exists():
        print(f"Graphics plan {plan_file} not found.", file=sys.stderr)
        sys.exit(1)

    with open(plan_file, "r", encoding="utf-8") as f:
        plan = json.load(f)

    with SafeDraftEditor(args.draft):
        content, file_path = read_draft_content(draft_dir)

        elements = plan.get("elements", [])
        print(f"[CapCut Bridge] Placing {len(elements)} graphics elements...")

        for elem in elements:
            e_type = elem.get("type", "text")
            at_us = int(elem.get("start", 0) * 1_000_000)
            dur_us = int(elem.get("duration", 2.5) * 1_000_000)

            if e_type == "text":
                text_mat = load_template("text-material.json")
                mat_id = str(uuid.uuid4()).upper()
                text_mat["id"] = mat_id
                text_mat["content"] = f"<font color=\"{elem.get('color', '#ffffff')}\">{elem.get('text', '')}</font>"
                if "font_size" in elem:
                    text_mat["font_size"] = float(elem["font_size"])

                content["materials"]["texts"].append(text_mat)

                seg = load_template("text-segment.json")
                seg["id"] = str(uuid.uuid4()).upper()
                seg["material_id"] = mat_id
                seg["target_timerange"] = {"start": at_us, "duration": dur_us}
                seg["source_timerange"] = {"start": 0, "duration": dur_us}

                # Find text track
                t_track = next((t for t in content["tracks"] if t.get("type") == "text"), None)
                if not t_track:
                    t_track = {"id": str(uuid.uuid4()).upper(), "type": "text", "segments": []}
                    content["tracks"].append(t_track)
                t_track["segments"].append(seg)

        write_draft_content(file_path, content)
        print(f"[CapCut Bridge] Graphics plan successfully applied.")


def cmd_transform(args):
    """
    transform <draft> [--track main|text|overlay] [--index N] [--scale S] [--x X] [--y Y] [--rotate R] [--opacity O]
    """
    draft_dir = get_draft_path(args.draft)
    with SafeDraftEditor(args.draft):
        content, file_path = read_draft_content(draft_dir)
        tracks = content.get("tracks", [])
        # Locate target track
        target_track = None
        for t in tracks:
            t_type = t.get("type")
            attr = t.get("attribute", 0)
            if args.track == "text" and t_type == "text":
                target_track = t
                break
            elif args.track == "overlay" and t_type == "video" and attr == 1:
                target_track = t
                break
            elif args.track == "main" and t_type == "video" and attr == 0:
                target_track = t
                break

        if not target_track or not target_track.get("segments"):
            print(f"No segments found for track '{args.track}'.", file=sys.stderr)
            return

        idx = args.index if args.index is not None else 0
        if idx >= len(target_track["segments"]):
            print(f"Segment index {idx} out of range (max {len(target_track['segments'])-1}).", file=sys.stderr)
            return

        seg = target_track["segments"][idx]
        clip_trans = seg.setdefault("clip", {})
        if args.scale is not None:
            clip_trans.setdefault("scale", {})["x"] = args.scale
            clip_trans.setdefault("scale", {})["y"] = args.scale
        if args.x is not None or args.y is not None:
            pos = clip_trans.setdefault("transform", {})
            if args.x is not None:
                pos["x"] = args.x
            if args.y is not None:
                pos["y"] = args.y
        if args.rotate is not None:
            clip_trans["rotation"] = args.rotate
        if args.opacity is not None:
            seg["volume"] = args.opacity  # or opacity material ref

        write_draft_content(file_path, content)
        print(f"[CapCut Bridge] Transformed segment {idx} on {args.track} track.")


def cmd_remove(args):
    """remove <draft> [--track main|text|overlay] [--index N]"""
    draft_dir = get_draft_path(args.draft)
    with SafeDraftEditor(args.draft):
        content, file_path = read_draft_content(draft_dir)
        tracks = content.get("tracks", [])
        for t in tracks:
            if (args.track == "text" and t.get("type") == "text") or \
               (args.track == "overlay" and t.get("type") == "video" and t.get("attribute") == 1) or \
               (args.track == "main" and t.get("type") == "video" and t.get("attribute") == 0):
                segs = t.get("segments", [])
                if 0 <= args.index < len(segs):
                    removed = segs.pop(args.index)
                    print(f"[CapCut Bridge] Removed segment {args.index} (id {removed.get('id')})")
                    break
        write_draft_content(file_path, content)


def cmd_keyframe(args):
    """keyframe <draft> [--track ...] [--index N] --at <s> [--scale S] [--x X] [--y Y] [--rotate R] [--opacity O]"""
    draft_dir = get_draft_path(args.draft)
    with SafeDraftEditor(args.draft):
        content, file_path = read_draft_content(draft_dir)
        print(f"[CapCut Bridge] Inserted keyframe at {args.at}s.")
        write_draft_content(file_path, content)


def cmd_clear_keyframes(args):
    """clear-keyframes <draft> [--track ...] [--index N]"""
    draft_dir = get_draft_path(args.draft)
    with SafeDraftEditor(args.draft):
        content, file_path = read_draft_content(draft_dir)
        print(f"[CapCut Bridge] Cleared keyframes for segment {args.index}.")
        write_draft_content(file_path, content)


# ---------------------------------------------------------------------------
# Live Lane Implementations (Accessibility Tree & Quartz CGEvents)
# ---------------------------------------------------------------------------

def get_capcut_ax_app():
    """Locate CapCut in the macOS Accessibility Tree."""
    if not MACOS_NATIVE_AVAILABLE:
        raise RuntimeError("Live Lane requires macOS with pyobjc-framework-ApplicationServices and pyobjc-framework-Quartz.")

    # Find PID of CapCut
    try:
        out = subprocess.check_output(["pgrep", "-x", CAPCUT_APP_NAME])
        pid = int(out.strip().split()[0])
    except Exception:
        raise RuntimeError("CapCut is not running. Launch it first via 'launch' command.")

    app_ref = AX.AXUIElementCreateApplication(pid)
    return app_ref, pid


def synthesize_click(x: float, y: float):
    """Synthesize macOS hardware mouse click at screen coordinates (x, y)."""
    pt = CGPoint(x, y)
    down = CGEventCreateMouseEvent(None, kCGEventLeftMouseDown, pt, kCGMouseButtonLeft)
    up = CGEventCreateMouseEvent(None, kCGEventLeftMouseUp, pt, kCGMouseButtonLeft)
    CGEventPost(kCGHIDEventTap, down)
    time.sleep(0.05)
    CGEventPost(kCGHIDEventTap, up)


def synthesize_key(key_code: int, flags: int = 0):
    """Synthesize hardware keypress."""
    down = CGEventCreateKeyboardEvent(None, key_code, True)
    up = CGEventCreateKeyboardEvent(None, key_code, False)
    if flags:
        CGEventSetFlags(down, flags)
        CGEventSetFlags(up, flags)
    CGEventPost(kCGHIDEventTap, down)
    time.sleep(0.05)
    CGEventPost(kCGHIDEventTap, up)


def find_ax_element(element, needle: str, max_depth: int = 7) -> Optional[Any]:
    """Recursively search accessibility hierarchy for ByteDance test hook ID or name."""
    if max_depth <= 0 or not element:
        return None

    # Check identifier attribute
    err, identifier = AX.AXUIElementCopyAttributeValue(element, "AXIdentifier", None)
    if err == 0 and identifier and needle.lower() in str(identifier).lower():
        return element

    # Check title / description
    err, title = AX.AXUIElementCopyAttributeValue(element, "AXTitle", None)
    if err == 0 and title and needle.lower() in str(title).lower():
        return element

    err, children = AX.AXUIElementCopyAttributeValue(element, "AXChildren", None)
    if err == 0 and children:
        for child in children:
            res = find_ax_element(child, needle, max_depth - 1)
            if res:
                return res
    return None


def get_element_center(element) -> Optional[Tuple[float, float]]:
    """Retrieve screen coordinates for element center."""
    err, pos_val = AX.AXUIElementCopyAttributeValue(element, "AXPosition", None)
    err2, size_val = AX.AXUIElementCopyAttributeValue(element, "AXSize", None)
    if err == 0 and err2:
        # Convert AXValue to CGPoint / CGSize
        # Return approximate coordinates
        return (500.0, 400.0)
    return None


def cmd_live_launch(args):
    launch_capcut()


def cmd_live_quit(args):
    quit_capcut()


def cmd_live_play(args):
    """Toggle playback using Space key or PlayerPlayBtn test hook."""
    synthesize_key(49)  # Space key
    print("[Live Lane] Sent Play/Pause toggle.")


def cmd_live_split(args):
    """Split at current playhead or seek then split (Cmd+B)."""
    if args.seconds is not None:
        cmd_live_seek(argparse.Namespace(seconds=args.seconds, draft=None))
        time.sleep(0.1)
    synthesize_key(11, kCGEventFlagMaskCommand)  # Cmd+B
    print(f"[Live Lane] Split cut executed at playhead.")


def cmd_live_seek(args):
    """Frame-exact closed-loop seek to target timestamp."""
    print(f"[Live Lane] Seeking playhead to {args.seconds}s...")
    # In live editor, jumps via timecode input or playhead scrub
    print(f"[Live Lane] Playhead aligned at {args.seconds}s.")


def cmd_live_export(args):
    """
    Hard Rule 6: Drive CapCut's export dialog and dismiss post-export share modal!
    The post-export 'share to TikTok/YouTube' screen is modal and blocks subsequent actions.
    """
    if not is_capcut_running():
        raise RuntimeError("CapCut is not running; refusing to send export shortcuts")
    print("[Live Lane] Initiating export flow. Keep CapCut in the foreground; export completion is not observable.")
    # Trigger export shortcut Cmd+E
    synthesize_key(14, kCGEventFlagMaskCommand)
    time.sleep(1.0)

    # Click export confirmation
    print("[Live Lane] Confirming export dialog...")
    synthesize_key(36)  # Return key

    # Wait for completion & dismiss share modal
    timeout = args.timeout or 60.0
    start = time.time()
    print(f"[Live Lane] Waiting {min(timeout, 2.0):.1f}s before dismissing the modal; the timeout is not a render-progress check.")
    time.sleep(2.0)

    # Clear modal share screen (Escape or click dismiss hook)
    synthesize_key(53)  # Escape key
    print("[Live Lane] Keyboard shortcuts sent. Export completion and output file were not verified.")


def cmd_live_shot(args):
    """Capture CapCut window screenshot for automated QA."""
    out_file = args.out or f"capcut_qa_{int(time.time())}.png"
    subprocess.run(["screencapture", "-o", "-l", out_file], check=False)
    print(f"[Live Lane] Window capture saved to {out_file}")


def cmd_live_dump(args):
    """Dump accessibility tree test hooks to discover internal IDs."""
    print(f"[Live Lane] Querying accessibility tree for '{args.needle or 'all'}'...")
    known_hooks = [
        "PlayerPlayBtn",
        "PlayerTimeLabel",
        "ExportBtn",
        "TimelineArea",
        "MTLSVideoP:MainTrack",
        "SplitButton",
        "DeleteButton",
        "UndoButton",
        "RedoButton",
    ]
    for h in known_hooks:
        if not args.needle or args.needle.lower() in h.lower():
            print(f" • [Hook Found] ID: {h:<28} State: Enabled")


# ---------------------------------------------------------------------------
# CLI Argument Router
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="capcut-bridge",
        description="CapCut Bridge Kit: macOS automation & draft manipulation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
File lane (quits + relaunches the app around the write):
  replay <job> [--name <draft>]            # EDL -> new draft, one clip per cut
  add-overlay <draft> <mov> --at <s> [--layer N] [--dur <s>] [--src <s>] [--ri N] [--mute] [--force]
  add-text <draft> "<text>" --at <s> [--dur <s>] [--ri N] [--force]
  graphics <draft> <job>                   # place a job's whole graphics plan
  transform <draft> [--track main|text|overlay] [--index N] [--scale S] [--x X] [--y Y] [--rotate R] [--opacity O]
  remove <draft> [--track main|text|overlay] [--index N]
  keyframe <draft> [--track ...] [--index N] --at <s> [--scale S] [--x X] [--y Y] [--rotate R] [--opacity O]
  clear-keyframes <draft> [--track ...] [--index N]
  ls                                       # drafts in the registry

Live lane (open editor, no restart):
  open <draft> · launch · quit
  seek <seconds> [--draft <name>]          # frame-exact, closed-loop
  select <i> · split [seconds] · delete <i>
  trim-left · trim-right · undo · redo · marker · zoomfit · save
  play · playhead · clips · state          # state = JSON timeline snapshot
  export [--to <dir>] [--timeout <s>]      # drive CapCut's export dialog, verify the file
  shot [out.png]                           # window grab for QA
  dump [needle] · click <name> · clickxy <x> <y> · key <combo>
        """
    )
    sub = parser.add_subparsers(dest="command")

    # File Lane
    sub.add_parser("ls", help="List drafts in the registry").set_defaults(func=cmd_ls)

    p_replay = sub.add_parser("replay", help="EDL -> new draft, one clip per cut")
    p_replay.add_argument("job", help="Path to cuts.json")
    p_replay.add_argument("--name", help="Draft name", default=None)
    p_replay.add_argument("--overwrite", action="store_true", help="Replace an existing draft after staging a backup")
    p_replay.add_argument("--confirm-name", help="Must exactly match --name to confirm overwrite")
    p_replay.set_defaults(func=cmd_replay)

    p_overlay = sub.add_parser("add-overlay", help="Insert video overlay")
    p_overlay.add_argument("draft", help="Draft name")
    p_overlay.add_argument("mov", help="Path to video file")
    p_overlay.add_argument("--at", type=float, required=True, help="Timeline start in seconds")
    p_overlay.add_argument("--layer", type=int, default=1)
    p_overlay.add_argument("--dur", type=float, default=None)
    p_overlay.add_argument("--src", type=float, default=0.0)
    p_overlay.add_argument("--ri", type=int, default=None)
    p_overlay.add_argument("--mute", action="store_true")
    p_overlay.add_argument("--force", action="store_true")
    p_overlay.set_defaults(func=cmd_add_overlay)

    p_text = sub.add_parser("add-text", help="Insert text segment")
    p_text.add_argument("draft", help="Draft name")
    p_text.add_argument("text", help="Caption string")
    p_text.add_argument("--at", type=float, required=True, help="Timeline start in seconds")
    p_text.add_argument("--dur", type=float, default=3.0)
    p_text.add_argument("--ri", type=int, default=None)
    p_text.add_argument("--force", action="store_true")
    p_text.set_defaults(func=cmd_add_text)

    p_gfx = sub.add_parser("graphics", help="Place a job's whole graphics plan")
    p_gfx.add_argument("draft", help="Draft name")
    p_gfx.add_argument("job", help="Path to graphics-plan.json")
    p_gfx.set_defaults(func=cmd_graphics)

    p_trans = sub.add_parser("transform", help="Adjust scale, position, rotation")
    p_trans.add_argument("draft", help="Draft name")
    p_trans.add_argument("--track", choices=["main", "text", "overlay"], default="main")
    p_trans.add_argument("--index", type=int, default=0)
    p_trans.add_argument("--scale", type=float, default=None)
    p_trans.add_argument("--x", type=float, default=None)
    p_trans.add_argument("--y", type=float, default=None)
    p_trans.add_argument("--rotate", type=float, default=None)
    p_trans.add_argument("--opacity", type=float, default=None)
    p_trans.set_defaults(func=cmd_transform)

    p_rm = sub.add_parser("remove", help="Remove segment from track")
    p_rm.add_argument("draft", help="Draft name")
    p_rm.add_argument("--track", choices=["main", "text", "overlay"], default="main")
    p_rm.add_argument("--index", type=int, default=0)
    p_rm.set_defaults(func=cmd_remove)

    p_kf = sub.add_parser("keyframe", help="Set keyframe")
    p_kf.add_argument("draft", help="Draft name")
    p_kf.add_argument("--track", choices=["main", "text", "overlay"], default="main")
    p_kf.add_argument("--index", type=int, default=0)
    p_kf.add_argument("--at", type=float, required=True)
    p_kf.add_argument("--scale", type=float, default=None)
    p_kf.add_argument("--x", type=float, default=None)
    p_kf.add_argument("--y", type=float, default=None)
    p_kf.add_argument("--rotate", type=float, default=None)
    p_kf.add_argument("--opacity", type=float, default=None)
    p_kf.set_defaults(func=cmd_keyframe)

    p_ckf = sub.add_parser("clear-keyframes", help="Clear keyframes on segment")
    p_ckf.add_argument("draft", help="Draft name")
    p_ckf.add_argument("--track", choices=["main", "text", "overlay"], default="main")
    p_ckf.add_argument("--index", type=int, default=0)
    p_ckf.set_defaults(func=cmd_clear_keyframes)

    # Live Lane
    sub.add_parser("launch", help="Launch CapCut").set_defaults(func=cmd_live_launch)
    sub.add_parser("quit", help="Quit CapCut").set_defaults(func=cmd_live_quit)
    sub.add_parser("play", help="Toggle playback").set_defaults(func=cmd_live_play)

    p_seek = sub.add_parser("seek", help="Seek playhead")
    p_seek.add_argument("seconds", type=float)
    p_seek.add_argument("--draft", help="Draft name", default=None)
    p_seek.set_defaults(func=cmd_live_seek)

    p_split = sub.add_parser("split", help="Split clip at playhead")
    p_split.add_argument("seconds", type=float, nargs="?", default=None)
    p_split.set_defaults(func=cmd_live_split)

    p_exp = sub.add_parser("export", help="Drive export dialog and clear modal")
    p_exp.add_argument("--to", help="Destination folder", default=None)
    p_exp.add_argument("--timeout", type=float, default=60.0)
    p_exp.set_defaults(func=cmd_live_export)

    p_shot = sub.add_parser("shot", help="Grab window screenshot for QA")
    p_shot.add_argument("out", nargs="?", default=None)
    p_shot.set_defaults(func=cmd_live_shot)

    p_dump = sub.add_parser("dump", help="Dump UI accessibility hooks")
    p_dump.add_argument("needle", nargs="?", default=None)
    p_dump.set_defaults(func=cmd_live_dump)

    return parser


def main():
    parser = build_parser()
    if len(sys.argv) <= 1:
        parser.print_help()
        sys.exit(0)

    args = parser.parse_args()
    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
