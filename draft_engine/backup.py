"""
Draft Engine Backup & Restore
=============================
Provides automated, safe snapshotting and rollback of CapCut projects.
"""

from __future__ import annotations

import shutil
import time
import uuid
from pathlib import Path
from typing import Dict, List, Optional


def get_backup_pattern(draft_name: str) -> str:
    return f".{draft_name}.backup-*"


def create_draft_backup(draft_dir: Path) -> Path:
    """
    Creates a full snapshot of the draft directory alongside it:
    .{draft_name}.backup-{uuid_hex}
    Compatible with existing repository tests and safety rules.
    """
    draft_dir = Path(draft_dir).resolve()
    if not draft_dir.is_dir():
        raise FileNotFoundError(f"Cannot backup non-existent directory: {draft_dir}")

    parent = draft_dir.parent
    draft_name = draft_dir.name
    backup_name = f".{draft_name}.backup-{uuid.uuid4().hex}"
    backup_path = parent / backup_name

    shutil.copytree(draft_dir, backup_path)
    return backup_path


def list_draft_backups(projects_dir: Path, draft_name: str) -> List[Path]:
    """
    Finds all backups matching .{draft_name}.backup-* sorted by modification time (newest first).
    """
    projects_dir = Path(projects_dir).resolve()
    if not projects_dir.is_dir():
        return []

    pattern = f".{draft_name}.backup-*"
    backups = [p for p in projects_dir.glob(pattern) if p.is_dir()]
    backups.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return backups


def restore_draft_backup(
    backup_path: Path,
    target_dir: Optional[Path] = None,
    keep_backup: bool = True,
) -> Path:
    """
    Restores a project from a specified backup path.
    If target_dir already exists, it creates a temporary safety copy before restoring.
    """
    backup_path = Path(backup_path).resolve()
    if not backup_path.is_dir():
        raise FileNotFoundError(f"Backup directory not found: {backup_path}")

    # Determine original draft name from backup folder name
    # e.g. .MyDraft.backup-1234 -> MyDraft
    if target_dir is None:
        name = backup_path.name
        if name.startswith(".") and ".backup-" in name:
            draft_name = name[1:].split(".backup-")[0]
            target_dir = backup_path.parent / draft_name
        else:
            raise ValueError(f"Cannot infer target draft name from backup folder: {backup_path.name}")
    else:
        target_dir = Path(target_dir).resolve()

    temp_rollback: Optional[Path] = None
    if target_dir.exists():
        temp_rollback = target_dir.parent / f".{target_dir.name}.temp-rollback-{uuid.uuid4().hex}"
        target_dir.rename(temp_rollback)

    try:
        if keep_backup:
            shutil.copytree(backup_path, target_dir)
        else:
            backup_path.rename(target_dir)

        if temp_rollback and temp_rollback.exists():
            shutil.rmtree(temp_rollback, ignore_errors=True)

        return target_dir
    except Exception as exc:
        # Roll back if restore failed
        if temp_rollback and temp_rollback.exists() and not target_dir.exists():
            temp_rollback.rename(target_dir)
        raise RuntimeError(f"Restore failed: {exc}") from exc


def prune_draft_backups(projects_dir: Path, draft_name: str, keep_last: int = 5) -> int:
    """
    Removes older backups, keeping only the most recent keep_last backups.
    Returns number of pruned backups.
    """
    backups = list_draft_backups(projects_dir, draft_name)
    if len(backups) <= keep_last:
        return 0

    to_prune = backups[keep_last:]
    pruned_count = 0
    for b in to_prune:
        try:
            shutil.rmtree(b)
            pruned_count += 1
        except OSError:
            pass
    return pruned_count
