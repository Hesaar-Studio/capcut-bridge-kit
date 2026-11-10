"""
Draft Engine Writer
===================
Safety-conscious writer for CapCut project directories and draft JSON.
New drafts are staged; updates preserve every existing project file and replace
only draft_content.json atomically after creating a retained project backup.
"""

from __future__ import annotations

import copy
import json
import os
import shutil
import tempfile
import uuid
from pathlib import Path
from typing import Any, Dict, Optional, Union

from .models import DraftProject
from .reader import safe_draft_name
from .validator import repair_null_timeranges, validate_draft_structure


def _write_json_file(path: Path, content: Dict[str, Any]) -> None:
    """Write a JSON object to a same-directory temporary file and atomically replace it."""
    fd, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.tmp-", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(content, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        try:
            temporary.unlink(missing_ok=True)
        except OSError:
            pass


def acquire_draft_write_lock(projects_dir: Path, draft_name: str):
    """Acquire the per-draft bridge lock and return a release callback."""
    safe_name = safe_draft_name(draft_name)
    projects_dir = Path(projects_dir).resolve()
    projects_dir.mkdir(parents=True, exist_ok=True)
    lock_path = projects_dir / f".{safe_name}.bridge-lock"
    try:
        lock_fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise RuntimeError(f"A bridge write is already in progress for draft '{safe_name}'.") from exc

    released = False

    def release() -> None:
        nonlocal released
        if released:
            return
        released = True
        try:
            os.close(lock_fd)
        except OSError:
            pass
        try:
            lock_path.unlink(missing_ok=True)
        except OSError:
            pass

    return release


def _validate_content(content: Any) -> Dict[str, Any]:
    if not isinstance(content, dict):
        raise ValueError("Draft content must be a JSON object")
    value = copy.deepcopy(content)
    repaired_count = repair_null_timeranges(value)
    validation = validate_draft_structure(value)
    if not validation.is_valid:
        raise ValueError("Draft content failed structural validation: " + "; ".join(validation.errors))
    return {"content": value, "repaired_count": repaired_count}


def _backup_project(target_dir: Path, backup_dir: Path) -> None:
    """Create a complete retained copy before changing an existing draft."""
    try:
        shutil.copytree(target_dir, backup_dir, symlinks=True)
    except Exception:
        shutil.rmtree(backup_dir, ignore_errors=True)
        raise


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
    Safely create a new CapCut draft or atomically update only its draft JSON.

    Existing projects are never replaced wholesale: for an update, all project
    sidecars, media, and CapCut cache files remain in place. A full retained
    backup is copied before the JSON file is atomically replaced. This function
    does not start, stop, or modify the CapCut application and never deletes the
    native Timelines cache.
    """
    safe_name = safe_draft_name(draft_name)
    projects_dir = Path(projects_dir).resolve()
    projects_dir.mkdir(parents=True, exist_ok=True)
    target_dir = projects_dir / safe_name
    stage_dir = projects_dir / f".{safe_name}.staging-{uuid.uuid4().hex}"
    backup_dir = projects_dir / f".{safe_name}.backup-{uuid.uuid4().hex}"
    release_lock = acquire_draft_write_lock(projects_dir, safe_name)
    committed = False
    backup_created: Optional[Path] = None
    validation_warnings = []

    try:
        if target_dir.is_symlink():
            raise ValueError("Refusing to edit a draft directory that is a symbolic link.")
        if target_dir.exists() and not target_dir.is_dir():
            raise ValueError(f"Draft target is not a directory: {target_dir}")
        if target_dir.exists() and not overwrite:
            raise FileExistsError(f"Draft already exists; refusing to overwrite: {target_dir}")
        if target_dir.exists() and confirm_name != safe_name:
            raise ValueError(f"Overwrite requires overwrite=True and confirm_name={safe_name!r}")
        if target_dir.exists() and not backup_existing:
            raise ValueError("Updating an existing project requires a retained backup.")

        if repair_timeranges:
            validated = _validate_content(content)
            staged_content = validated["content"]
            repaired_count = validated["repaired_count"]
        else:
            staged_content = copy.deepcopy(content)
            validation = validate_draft_structure(staged_content)
            if not validation.is_valid:
                raise ValueError("Draft content failed structural validation: " + "; ".join(validation.errors))
            repaired_count = 0

        if target_dir.exists():
            output_file = target_dir / "draft_content.json"
            if not output_file.is_file() and (target_dir / "draft_info.json").is_file():
                output_file = target_dir / "draft_info.json"
            if not output_file.parent.is_dir():
                raise FileNotFoundError(f"Draft directory disappeared before write: {target_dir}")
            if output_file.is_symlink():
                raise ValueError(f"Refusing to replace a symbolic-link draft file: {output_file}")

            original_bytes = output_file.read_bytes() if output_file.is_file() else None
            _backup_project(target_dir, backup_dir)
            backup_created = backup_dir
            backup_file = backup_dir / output_file.name
            backup_bytes = backup_file.read_bytes() if backup_file.is_file() else None
            if original_bytes != backup_bytes:
                raise RuntimeError("Draft JSON changed while the backup was being created; no write was committed.")
            if not target_dir.is_dir() or target_dir.is_symlink():
                raise RuntimeError("Draft target changed during the update; no write was committed.")
            if output_file.is_file() and output_file.read_bytes() != original_bytes:
                raise RuntimeError("Draft JSON changed before commit; no write was committed.")

            _write_json_file(output_file, staged_content)
            try:
                reread = json.loads(output_file.read_text(encoding="utf-8"))
                if reread != staged_content:
                    raise RuntimeError("Draft JSON readback did not match the written content.")
            except Exception:
                # The retained copy is the recovery source if post-write readback fails.
                if backup_file.is_file():
                    _write_json_file(output_file, json.loads(backup_file.read_text(encoding="utf-8")))
                raise
            final_validation = validate_draft_structure(reread, check_files=True, base_dir=target_dir)
            if not final_validation.is_valid:
                if backup_file.is_file():
                    _write_json_file(output_file, json.loads(backup_file.read_text(encoding="utf-8")))
                raise RuntimeError("Updated draft JSON failed validation: " + "; ".join(final_validation.errors))
            validation_warnings = final_validation.warnings
            committed = True
            target_file = output_file
        else:
            stage_dir.mkdir(parents=True, exist_ok=False)
            (stage_dir / "Resources").mkdir(exist_ok=True)
            output_file = stage_dir / "draft_content.json"

            # If media paths are staged inside the new project, publish paths that
            # point to the final draft directory rather than the temporary stage.
            for collection_name in ("videos", "audios"):
                collection = staged_content.get("materials", {}).get(collection_name, [])
                if not isinstance(collection, list):
                    continue
                for material in collection:
                    if not isinstance(material, dict) or not isinstance(material.get("path"), str):
                        continue
                    media_path = Path(material["path"])
                    try:
                        relative = media_path.resolve().relative_to(stage_dir.resolve())
                    except (ValueError, OSError):
                        continue
                    material["path"] = str(target_dir / relative)

            validation = validate_draft_structure(staged_content)
            if not validation.is_valid:
                raise ValueError("Staged draft content failed structural validation: " + "; ".join(validation.errors))
            _write_json_file(output_file, staged_content)
            reread = json.loads(output_file.read_text(encoding="utf-8"))
            if reread != staged_content:
                raise RuntimeError("Staged draft JSON readback did not match the written content.")
            if target_dir.exists() or target_dir.is_symlink():
                raise FileExistsError(f"Draft appeared while building; refusing to overwrite: {target_dir}")
            stage_dir.rename(target_dir)
            target_file = target_dir / "draft_content.json"
            final_content = json.loads(target_file.read_text(encoding="utf-8"))
            if final_content != staged_content:
                raise RuntimeError("Final draft JSON disk readback did not match the staged content.")
            final_validation = validate_draft_structure(final_content, check_files=True, base_dir=target_dir)
            if not final_validation.is_valid:
                raise RuntimeError("Final draft JSON failed validation: " + "; ".join(final_validation.errors))
            validation_warnings = final_validation.warnings
            committed = True

        return {
            "success": committed,
            "verified": committed,
            "capcut_verified": False,
            "verification_scope": "draft_json_disk_readback_only",
            "warnings": validation_warnings,
            "draft_name": safe_name,
            "target_dir": str(target_dir),
            "draft_file": str(target_file),
            "backup_dir": str(backup_created) if backup_created else None,
            "repaired_null_timeranges": repaired_count,
            "duration_us": staged_content.get("duration", 0),
        }
    finally:
        if stage_dir.exists():
            shutil.rmtree(stage_dir, ignore_errors=True)
        release_lock()


def update_existing_draft_json(
    draft_dir: Path,
    content: Dict[str, Any],
    repair_timeranges: bool = True,
) -> Dict[str, Any]:
    """Update a draft through the same validated, backed-up atomic writer."""
    draft_dir = Path(draft_dir)
    if draft_dir.is_symlink():
        raise ValueError(f"Refusing to edit a symbolic-link draft directory: {draft_dir}")
    draft_dir = draft_dir.resolve()
    if not draft_dir.is_dir():
        raise FileNotFoundError(f"Draft directory not found or unsafe: {draft_dir}")
    return write_raw_draft_json_atomic(
        projects_dir=draft_dir.parent,
        draft_name=draft_dir.name,
        content=content,
        overwrite=True,
        confirm_name=draft_dir.name,
        backup_existing=True,
        repair_timeranges=repair_timeranges,
    )


def write_draft_project(
    projects_dir: Path,
    project: Union[DraftProject, Dict[str, Any]],
    draft_name: Optional[str] = None,
    overwrite: bool = False,
    confirm_name: Optional[str] = None,
) -> Dict[str, Any]:
    """High-level entry point accepting either a DraftProject or raw dictionary."""
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
