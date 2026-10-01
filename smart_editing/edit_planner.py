"""
Edit Planner (Read-Only)
========================
Generates a structured, non-destructive EditPlan from a DraftProject.
Performs pause and duplicate take analysis to compile proposed changes without touching source files.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from draft_engine.models import DraftProject, TimeRange
from .duplicate_detection import detect_duplicate_candidates
from .models import (
    DuplicateCategory,
    EditAction,
    EditPlan,
    PlanItem,
)
from .pause_detection import detect_subtitle_gaps, extract_subtitle_items


def generate_edit_plan(
    project: DraftProject,
    min_pause_gap_sec: float = 1.0,
    max_duplicate_distance_sec: float = 60.0,
    duplicate_high_threshold: float = 0.85,
    duplicate_possible_threshold: float = 0.70,
) -> EditPlan:
    """
    Read-only analysis function. Inspects a DraftProject and produces a structured EditPlan.
    Does NOT modify the project or write any files.
    """
    subtitles = extract_subtitle_items(project)

    # 1. Detect subtitle pause gaps
    gaps = detect_subtitle_gaps(subtitles, min_gap_sec=min_pause_gap_sec)

    # 2. Detect duplicate candidates
    duplicates = detect_duplicate_candidates(
        subtitles,
        max_time_distance_sec=max_duplicate_distance_sec,
        high_threshold=duplicate_high_threshold,
        possible_threshold=duplicate_possible_threshold,
    )

    plan = EditPlan(
        project_name=project.name,
        total_duration_us=project.duration,
    )

    total_gap_us = 0
    for gap in gaps:
        total_gap_us += gap.gap_duration_us
        plan.add_item(
            PlanItem(
                action=EditAction.TRIM_GAP,
                target_segment_ids=[gap.preceding_segment_id, gap.following_segment_id],
                description=f"Pause gap of {gap.gap_duration_sec:.2f}s between segments {gap.preceding_segment_id} and {gap.following_segment_id}",
                time_range=TimeRange(start=gap.gap_start_us, duration=gap.gap_duration_us),
                parameters={
                    "gap_duration_sec": round(gap.gap_duration_sec, 3),
                    "reason": gap.reason,
                },
            )
        )

    for dup in duplicates:
        plan.add_item(
            PlanItem(
                action=EditAction.DUPLICATE_CANDIDATE,
                target_segment_ids=[dup.first_segment_id, dup.second_segment_id],
                description=(
                    f"Possible duplicate take ({dup.category.value}, similarity {dup.similarity_score:.0%}): "
                    f"'{dup.first_text[:30]}...' vs '{dup.second_text[:30]}...'"
                ),
                parameters={
                    "similarity_score": round(dup.similarity_score, 3),
                    "category": dup.category.value,
                    "first_text": dup.first_text,
                    "second_text": dup.second_text,
                    "time_distance_sec": round(dup.time_distance_sec, 3),
                },
            )
        )

    plan.metadata = {
        "subtitles_analyzed_count": len(subtitles),
        "detected_gaps_count": len(gaps),
        "total_gap_duration_sec": round(total_gap_us / 1_000_000.0, 3),
        "duplicate_candidates_count": len(duplicates),
        "min_pause_threshold_sec": min_pause_gap_sec,
        "is_dry_run": True,
        "applied": False,
    }

    return plan
