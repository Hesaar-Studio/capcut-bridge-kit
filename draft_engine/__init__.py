"""
Draft Engine for CapCut Bridge Kit
==================================
Modular, safety-conscious foundation for locating, reading, validating,
backing up, and atomically writing CapCut Desktop draft projects.
"""

from .models import (
    TimeRange,
    Segment,
    Track,
    VideoMaterial,
    AudioMaterial,
    TextMaterial,
    DraftProject,
)
from .reader import (
    get_capcut_projects_dir,
    list_draft_names,
    read_draft_project,
    read_raw_draft_json,
)
from .validator import (
    validate_draft_structure,
    repair_null_timeranges,
    ValidationResult,
)
from .backup import (
    create_draft_backup,
    list_draft_backups,
    restore_draft_backup,
)
from .writer import (
    write_draft_project,
    write_raw_draft_json_atomic,
)

__all__ = [
    "TimeRange",
    "Segment",
    "Track",
    "VideoMaterial",
    "AudioMaterial",
    "TextMaterial",
    "DraftProject",
    "get_capcut_projects_dir",
    "list_draft_names",
    "read_draft_project",
    "read_raw_draft_json",
    "validate_draft_structure",
    "repair_null_timeranges",
    "ValidationResult",
    "create_draft_backup",
    "list_draft_backups",
    "restore_draft_backup",
    "write_draft_project",
    "write_raw_draft_json_atomic",
]
