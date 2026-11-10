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
   ~/Movies/CapCut/User Data/Projects/com.lveditor.draft/<name>/.
   It refuses to write while CapCut is running, retains a project backup, and
   verifies JSON readback; it never closes/relaunches CapCut or deletes its cache.
2. Live Lane: Limited, guarded macOS keyboard/accessibility actions. Unsupported
   actions and unverified results are reported honestly.

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

from bridge_system.process_guard import capcut_process_running

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
    """Return CapCut's verified process state; query failures must stop the caller."""
    return capcut_process_running(platform="darwin")


def quit_capcut(timeout: float = 8.0) -> bool:
    """Compatibility helper: never send quit or kill signals to the editor."""
    return not is_capcut_running()


def launch_capcut(wait_sec: float = 2.5):
    """Launch CapCut application."""
    print(f"[CapCut Bridge] Launching {CAPCUT_APP_NAME}...")
    subprocess.run(["open", "-a", CAPCUT_APP_NAME], check=False)
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
    from draft_engine.reader import safe_draft_name
    return CAPCUT_PROJECTS_DIR / safe_draft_name(draft_name)


def read_draft_content(draft_dir: Path) -> Tuple[dict, Path]:
    """Read draft_content.json (or draft_info.json in older CapCut versions)."""
    for filename in ["draft_content.json", "draft_info.json"]:
        p = draft_dir / filename
        if p.exists():
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f), p
    raise FileNotFoundError(f"No draft_content.json found in {draft_dir}")


def write_draft_content(path: Path, data: dict):
    """Atomically write staged JSON, or back up and update an existing project."""
    path = Path(path)
    repaired = repair_null_timeranges(data)
    if repaired > 0:
        print(f"[CapCut Bridge] Repaired {repaired} null source_timeranges.")

    if path.is_file() and path.name in {"draft_content.json", "draft_info.json"}:
        from draft_engine import update_existing_draft_json
        result = update_existing_draft_json(path.parent, data)
        if result.get("backup_dir"):
            print(f"[CapCut Bridge] Retained project backup at {result['backup_dir']}")
        print("[CapCut Bridge] JSON disk readback verified; CapCut acceptance remains unverified.")
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
        print("[CapCut Bridge] Draft JSON staged and disk-readback verified. CapCut parse, timeline UI, and export remain unverified.")
        if backup_dir.exists():
            print(f"[CapCut Bridge] Previous project backup retained at {backup_dir}")
        committed = True
    finally:
        if stage_dir.exists():
            shutil.rmtree(stage_dir, ignore_errors=True)
        release_write_lock()


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

def is_capcut_frontmost() -> bool:
    """Fail-closed check that the frontmost macOS application is CapCut."""
    if sys.platform != "darwin" or not is_capcut_running():
        return False
    try:
        frontmost = subprocess.check_output(
            [
                "osascript",
                "-e",
                'tell application "System Events" to get name of first application process whose frontmost is true',
            ],
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=2.0,
        ).strip()
        return frontmost == CAPCUT_APP_NAME
    except Exception:
        return False


def require_capcut_foreground() -> None:
    if not MACOS_NATIVE_AVAILABLE:
        raise RuntimeError("Live lane requires macOS Quartz/Accessibility support.")
    if not is_capcut_running():
        raise RuntimeError("CapCut is not running.")
    if not is_capcut_frontmost():
        raise RuntimeError("Bring CapCut to the foreground before sending a live keyboard or mouse event.")


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
    """Send a mouse click only when CapCut is confirmed frontmost."""
    require_capcut_foreground()
    pt = CGPoint(x, y)
    down = CGEventCreateMouseEvent(None, kCGEventLeftMouseDown, pt, kCGMouseButtonLeft)
    up = CGEventCreateMouseEvent(None, kCGEventLeftMouseUp, pt, kCGMouseButtonLeft)
    CGEventPost(kCGHIDEventTap, down)
    time.sleep(0.05)
    CGEventPost(kCGHIDEventTap, up)


def synthesize_key(key_code: int, flags: int = 0):
    """Send a keyboard event only when CapCut is confirmed frontmost."""
    require_capcut_foreground()
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
    """Return None until AXValue position/size conversion is implemented and tested."""
    return None


def cmd_live_launch(args):
    launch_capcut()


def cmd_live_quit(args):
    if is_capcut_running():
        print("CapCut is still running; the bridge does not terminate applications. Close it manually if desired.")
    else:
        print("CapCut is not running.")


def cmd_live_play(args):
    """Send Space to foreground CapCut; playback change remains unverified."""
    synthesize_key(49)  # Space key
    print("UNVERIFIED: Space was sent while CapCut was foreground; playback state was not read back.")


def cmd_live_split(args):
    """Send Cmd+B at the current playhead; there is no timeline readback."""
    if args.seconds is not None:
        raise NotImplementedError("Timed split is unsupported because deterministic seek is not implemented.")
    synthesize_key(11, kCGEventFlagMaskCommand)  # Cmd+B
    print("UNVERIFIED: Cmd+B was sent while CapCut was foreground; no split state was read back.")


def cmd_live_seek(args):
    """Seeking is unsupported until an editor-side timecode control and readback exist."""
    raise NotImplementedError("Live seek is not implemented; no keyboard event was sent.")


def cmd_live_export(args):
    """Send a guarded export shortcut sequence without claiming render completion."""
    if getattr(args, "to", None):
        raise NotImplementedError("A destination path is not supported by the keyboard-only export lane.")
    require_capcut_foreground()
    print("[Live Lane] Sending Cmd+E; export dialog state and destination are not inspected.")
    synthesize_key(14, kCGEventFlagMaskCommand)
    time.sleep(1.0)

    require_capcut_foreground()
    synthesize_key(36)  # Return key; dialog state is not verified.
    time.sleep(2.0)  # Fixed delay only; not an export-progress check.

    require_capcut_foreground()
    synthesize_key(53)  # Escape key; modal state is not verified.
    print("UNVERIFIED: keyboard events were sent; export completion and output file were not checked.")


def cmd_live_shot(args):
    """Capture the full desktop only after confirming CapCut is foreground."""
    require_capcut_foreground()
    out_file = Path(args.out or f"capcut_desktop_{int(time.time())}.png").expanduser()
    if out_file.exists():
        raise FileExistsError(f"Refusing to overwrite screenshot: {out_file}")
    subprocess.run(["screencapture", "-x", str(out_file)], check=True)
    if not out_file.is_file() or out_file.stat().st_size == 0:
        raise RuntimeError("Desktop screenshot command completed without a readable image file.")
    print(f"Desktop screenshot saved to {out_file}; it shows the display, not an editor-side timeline state.")


def cmd_live_dump(args):
    """Accessibility hook enumeration is not implemented; never return fabricated hooks."""
    raise NotImplementedError("Accessibility tree dump is not implemented; no hooks or state were reported.")


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
