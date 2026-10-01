"""
Draft Engine Reader
===================
Cross-platform reader for CapCut project directories and draft JSON files.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .models import DraftProject
from .validator import validate_draft_structure


def safe_draft_name(name: str) -> str:
    """
    Enforces safe draft folder naming to prevent directory traversal attacks.
    Matches the existing project security rule.
    """
    if (
        not isinstance(name, str)
        or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9 _.-]{0,79}", name)
        or name in {".", ".."}
    ):
        raise ValueError(
            "Draft name must be a simple folder name (letters, numbers, spaces, dot, _ or -)"
        )
    return name


def get_capcut_projects_dir(custom_path: Optional[Path] = None) -> Path:
    """
    Returns the standard CapCut Desktop draft projects path for the current OS.
    """
    if custom_path:
        return Path(custom_path).resolve()

    if sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
        return base / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"
    elif sys.platform == "darwin":
        return Path.home() / "Movies" / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"
    else:
        return Path.home() / ".local" / "share" / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"


def list_draft_names(projects_dir: Optional[Path] = None) -> List[str]:
    """
    Lists valid project folder names in the CapCut drafts directory.
    Ignores hidden folders (.staging-*, .backup-*, etc.).
    """
    p_dir = get_capcut_projects_dir(projects_dir)
    if not p_dir.is_dir():
        return []

    names = []
    for item in sorted(p_dir.iterdir()):
        if item.is_dir() and not item.name.startswith("."):
            names.append(item.name)
    return names


def read_raw_draft_json(draft_dir: Path) -> Tuple[Dict[str, Any], Path]:
    """
    Locates and parses the draft JSON file (draft_content.json or draft_info.json).
    Returns (parsed_dict, file_path).
    """
    draft_dir = Path(draft_dir).resolve()
    for filename in ["draft_content.json", "draft_info.json"]:
        p = draft_dir / filename
        if p.is_file():
            with p.open("r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                raise ValueError(f"Draft file {p} root is not a JSON object")
            return data, p

    raise FileNotFoundError(f"No draft_content.json or draft_info.json found in {draft_dir}")


def read_draft_project(
    draft_dir: Path,
    validate: bool = True,
    check_files: bool = False,
) -> DraftProject:
    """
    Reads a draft project into a structured DraftProject instance.
    """
    draft_dir = Path(draft_dir).resolve()
    raw_json, _ = read_raw_draft_json(draft_dir)

    if validate:
        val_res = validate_draft_structure(raw_json, check_files=check_files, base_dir=draft_dir)
        if not val_res.is_valid:
            errors_str = "; ".join(val_res.errors)
            raise ValueError(f"Invalid draft structure in {draft_dir}: {errors_str}")

    return DraftProject.from_dict(raw_json, project_name=draft_dir.name)
