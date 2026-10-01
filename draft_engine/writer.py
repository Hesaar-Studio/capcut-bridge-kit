"""
Draft Engine Writer
===================
Atomic, safety-conscious writer for CapCut project directories and draft JSON.
Enforces staging, validation, auto-backup, and rollback on failure.
"""

from __future__ import annotations

import json
import shutil
import uuid
from pathlib import Path
from typing import Any, Dict, Optional, Union

from .models import DraftProject
from .reader import safe_draft_name
from .validator import repair_null_timeranges, validate_draft_structure


def write_raw_draft_json_atomic(
    projects_dir: Path,
    draft_name: str,
    content: Dict[str, Any],
    overwrite: bool = False,
    confirm_name: Optional[str] = None,
    backup_existing: bool = True,
    repair_timeranges: bool = True,
) -> Dict[str, Any]:
    """
    Atomically creates or updates a CapCut draft folder using a staging directory.

    Safety workflow:
      1. Validates draft_name to prevent path traversal.
      2. Validates overwrite permissions if target already exists.
      3. Stages everything in .{draft_name}.staging-{uuid}.
      4. Auto-repairs null source_timeranges to prevent encoder hangs.
      5. Writes staged draft_content.json.
      6. Validates staged JSON before committing.
      7. Replaces staging paths in materials with destination paths.
      8. Moves existing draft to .{draft_name}.backup-{uuid} (if present).
      9. Atomically renames staging directory to target_dir.
      10. If rename fails, restores backup.
      11. Wipes native Timelines/ cache to force CapCut to reload changes.
    """
    safe_name = safe_draft_name(draft_name)
    projects_dir = Path(projects_dir).resolve()
    projects_dir.mkdir(parents=True, exist_ok=True)

    target_dir = projects_dir / safe_name
    if target_dir.exists() and not overwrite:
        raise FileExistsError(f"Draft already exists; refusing to overwrite: {target_dir}")
    if target_dir.exists() and confirm_name != safe_name:
        raise ValueError(f"Overwrite requires overwrite=True and confirm_name={safe_name!r}")

    stage_dir = projects_dir / f".{safe_name}.staging-{uuid.uuid4().hex}"
    backup_dir = projects_dir / f".{safe_name}.backup-{uuid.uuid4().hex}"

    stage_dir.mkdir(parents=True, exist_ok=True)
    (stage_dir / "Resources").mkdir(exist_ok=True)

    repaired_count = 0
    if repair_timeranges:
        repaired_count = repair_null_timeranges(content)

    val_res = validate_draft_structure(content)
    if not val_res.is_valid:
        shutil.rmtree(stage_dir, ignore_errors=True)
        errors_str = "; ".join(val_res.errors)
        raise ValueError(f"Draft content failed structural validation: {errors_str}")

    out_file = stage_dir / "draft_content.json"
    with out_file.open("w", encoding="utf-8") as f:
        json.dump(content, f, indent=2, ensure_ascii=False)

    # Re-read and adjust any staged media paths pointing to stage_dir
    with out_file.open("r", encoding="utf-8") as f:
        staged_content = json.load(f)

    for material in staged_content.get("materials", {}).get("videos", []):
        media = Path(material.get("path", ""))
        try:
            rel_media = media.relative_to(stage_dir)
            material["path"] = str(target_dir / rel_media)
        except ValueError:
            pass

    for material in staged_content.get("materials", {}).get("audios", []):
        media = Path(material.get("path", ""))
        try:
            rel_media = media.relative_to(stage_dir)
            material["path"] = str(target_dir / rel_media)
        except ValueError:
            pass

    with out_file.open("w", encoding="utf-8") as f:
        json.dump(staged_content, f, indent=2, ensure_ascii=False)

    # Perform atomic replacement
    committed = False
    backup_created: Optional[Path] = None

    try:
        if target_dir.exists() and not overwrite:
            raise FileExistsError(f"Draft appeared while building; refusing to overwrite: {target_dir}")

        if target_dir.exists():
            target_dir.rename(backup_dir)
            backup_created = backup_dir

        try:
            stage_dir.rename(target_dir)
        except Exception:
            # Rollback
            if backup_dir.exists() and not target_dir.exists():
                backup_dir.rename(target_dir)
            raise

        # Wipe native Timelines cache in target_dir (Hard Rule 3)
        timelines_cache = target_dir / "Timelines"
        if timelines_cache.exists():
            shutil.rmtree(timelines_cache, ignore_errors=True)

        committed = True
    finally:
        if stage_dir.exists():
            shutil.rmtree(stage_dir, ignore_errors=True)

    return {
        "success": committed,
        "draft_name": safe_name,
        "target_dir": str(target_dir),
        "backup_dir": str(backup_created) if backup_created else None,
        "repaired_null_timeranges": repaired_count,
        "duration_us": staged_content.get("duration", 0),
    }


def write_draft_project(
    projects_dir: Path,
    project: Union[DraftProject, Dict[str, Any]],
    draft_name: Optional[str] = None,
    overwrite: bool = False,
    confirm_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    High-level entry point accepting either a DraftProject dataclass or raw dictionary.
    """
    if isinstance(project, DraftProject):
        content = project.to_dict()
        name = draft_name or project.name
    else:
        content = project
        name = draft_name or content.get("name") or content.get("draft_name") or f"Draft_{uuid.uuid4().hex[:8]}"

    if not name:
        raise ValueError("Draft name must be provided")

    return write_raw_draft_json_atomic(
        projects_dir=projects_dir,
        draft_name=name,
        content=content,
        overwrite=overwrite,
        confirm_name=confirm_name,
    )
