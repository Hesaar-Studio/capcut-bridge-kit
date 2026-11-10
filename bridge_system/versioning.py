"""Resolve the product version from the root package manifest at build/development time."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def get_app_version() -> str:
    override = os.environ.get("HS_TECH_APP_VERSION", "").strip()
    if override:
        return override

    resource_root = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[1]))
    candidates = [resource_root / "hs-tech-version.txt", resource_root / "package.json"]
    if not getattr(sys, "frozen", False):
        candidates.append(Path(__file__).resolve().parents[1] / "package.json")

    for candidate in candidates:
        try:
            value = candidate.read_text(encoding="utf-8").strip()
            if candidate.suffix == ".json":
                value = str(json.loads(value).get("version", ""))
            if value:
                return value
        except (OSError, json.JSONDecodeError, AttributeError):
            continue
    return "unknown"


APP_VERSION = get_app_version()
