"""
Smart Editing Engine for CapCut Bridge Kit (Phase 3A: Read-Only Layer)
======================================================================
Provides pause gap analysis, duplicate take detection, pure subtitle operations,
and structured Edit Plan generation without project file modification.
"""

from .models import (
    DuplicateCandidate,
    DuplicateCategory,
    EditAction,
    EditPlan,
    PlanItem,
    SubtitleGap,
    SubtitleItem,
)
from .pause_detection import (
    clean_text_content,
    detect_subtitle_gaps,
    extract_subtitle_items,
)
from .duplicate_detection import (
    calculate_text_similarity,
    detect_duplicate_candidates,
    normalize_text,
)
from .subtitle_ops import (
    adjust_subtitle_timing,
    merge_subtitles,
    split_subtitle,
    validate_subtitle_timing,
)
from .edit_planner import generate_edit_plan

__all__ = [
    "EditAction",
    "DuplicateCategory",
    "SubtitleItem",
    "SubtitleGap",
    "DuplicateCandidate",
    "PlanItem",
    "EditPlan",
    "clean_text_content",
    "detect_subtitle_gaps",
    "extract_subtitle_items",
    "calculate_text_similarity",
    "detect_duplicate_candidates",
    "normalize_text",
    "adjust_subtitle_timing",
    "merge_subtitles",
    "split_subtitle",
    "validate_subtitle_timing",
    "generate_edit_plan",
]
