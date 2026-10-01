"""
Subtitle Operations (Pure Functions)
====================================
Pure transformation functions on SubtitleItem models without modifying project files.
"""

from __future__ import annotations

import uuid
from typing import Tuple

from draft_engine.models import TimeRange
from .models import SubtitleItem


def validate_subtitle_timing(item: SubtitleItem) -> bool:
    """Verifies that a subtitle segment has non-negative start and positive duration."""
    return item.start >= 0 and item.duration > 0


def merge_subtitles(
    item_a: SubtitleItem,
    item_b: SubtitleItem,
    separator: str = " ",
    new_segment_id: str | None = None,
) -> SubtitleItem:
    """
    Pure function: Merges two subtitle items into a single SubtitleItem spanning from item_a to item_b.
    Does not modify inputs.
    """
    if item_a.start > item_b.start:
        item_a, item_b = item_b, item_a

    combined_start = item_a.start
    combined_end = max(item_a.end, item_b.end)
    combined_duration = combined_end - combined_start

    combined_text = f"{item_a.content.strip()}{separator}{item_b.content.strip()}".strip()
    seg_id = new_segment_id or f"merged_{uuid.uuid4().hex[:8]}"

    return SubtitleItem(
        segment_id=seg_id,
        material_id=item_a.material_id,
        content=combined_text,
        timerange=TimeRange(start=combined_start, duration=combined_duration),
    )


def split_subtitle(
    item: SubtitleItem,
    split_time_sec: float,
    part_one_text: str,
    part_two_text: str,
    new_id_1: str | None = None,
    new_id_2: str | None = None,
) -> Tuple[SubtitleItem, SubtitleItem]:
    """
    Pure function: Splits a SubtitleItem into two at split_time_sec.
    Does not modify inputs.
    """
    split_us = int(round(split_time_sec * 1_000_000))
    if split_us <= item.start or split_us >= item.end:
        raise ValueError(
            f"Split point {split_time_sec:.3f}s must be strictly between "
            f"item start ({item.start_sec:.3f}s) and end ({item.end_sec:.3f}s)"
        )

    dur1 = split_us - item.start
    dur2 = item.end - split_us

    id1 = new_id_1 or f"{item.segment_id}_part1"
    id2 = new_id_2 or f"{item.segment_id}_part2"

    sub1 = SubtitleItem(
        segment_id=id1,
        material_id=item.material_id,
        content=part_one_text.strip(),
        timerange=TimeRange(start=item.start, duration=dur1),
    )

    sub2 = SubtitleItem(
        segment_id=id2,
        material_id=item.material_id,
        content=part_two_text.strip(),
        timerange=TimeRange(start=split_us, duration=dur2),
    )

    return sub1, sub2


def adjust_subtitle_timing(
    item: SubtitleItem,
    offset_start_sec: float = 0.0,
    delta_duration_sec: float = 0.0,
) -> SubtitleItem:
    """
    Pure function: Returns a new SubtitleItem with adjusted start and/or duration.
    Does not modify inputs.
    """
    offset_us = int(round(offset_start_sec * 1_000_000))
    delta_dur_us = int(round(delta_duration_sec * 1_000_000))

    new_start = item.start + offset_us
    new_duration = item.duration + delta_dur_us

    if new_start < 0:
        raise ValueError(f"Adjusted start time cannot be negative ({new_start} us)")
    if new_duration <= 0:
        raise ValueError(f"Adjusted duration must be > 0 ({new_duration} us)")

    return SubtitleItem(
        segment_id=item.segment_id,
        material_id=item.material_id,
        content=item.content,
        timerange=TimeRange(start=new_start, duration=new_duration),
    )
