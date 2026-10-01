"""
Pause / Subtitle Gap Detection
==============================
Analyzes time gaps between consecutive subtitle/text segments.
Does not claim to detect acoustic audio silence; measures timeline subtitle intervals.
"""

from __future__ import annotations

import re
from typing import List, Optional

from draft_engine.models import DraftProject, Track
from .models import SubtitleGap, SubtitleItem


def clean_text_content(content: str) -> str:
    """Removes CapCut XML/HTML styling tags (e.g. <font color="...">) to get clean prose."""
    if not content:
        return ""
    clean = re.sub(r"<[^>]+>", "", content)
    return clean.strip()


def extract_subtitle_items(project: DraftProject) -> List[SubtitleItem]:
    """
    Finds all text tracks in the project, matches each segment to its TextMaterial,
    and returns a sorted list of SubtitleItem ordered by start time.
    """
    text_materials = {m.id: m for m in project.texts}
    items: List[SubtitleItem] = []

    for track in project.tracks:
        if track.type != "text":
            continue

        for seg in track.segments:
            mat = text_materials.get(seg.material_id)
            content = mat.content if mat else ""
            cleaned = clean_text_content(content)
            items.append(
                SubtitleItem(
                    segment_id=seg.id,
                    material_id=seg.material_id,
                    content=cleaned or content,
                    timerange=seg.target_timerange,
                )
            )

    items.sort(key=lambda item: item.start)
    return items


def detect_subtitle_gaps(
    subtitles: List[SubtitleItem],
    min_gap_sec: float = 1.0,
) -> List[SubtitleGap]:
    """
    Scans consecutive subtitle items and detects intervals where the gap between
    the end of one segment and the start of the next is >= min_gap_sec.

    Parameters:
      subtitles: Chronologically ordered list of SubtitleItem
      min_gap_sec: Minimum pause threshold in seconds (default 1.0s)

    Returns:
      List of SubtitleGap records describing each pause interval.
    """
    if len(subtitles) < 2:
        return []

    min_gap_us = int(round(min_gap_sec * 1_000_000))
    gaps: List[SubtitleGap] = []

    for i in range(len(subtitles) - 1):
        curr_sub = subtitles[i]
        next_sub = subtitles[i + 1]

        # Calculate gap between end of current and start of next
        gap_us = next_sub.start - curr_sub.end
        if gap_us >= min_gap_us:
            gaps.append(
                SubtitleGap(
                    preceding_segment_id=curr_sub.segment_id,
                    following_segment_id=next_sub.segment_id,
                    gap_start_us=curr_sub.end,
                    gap_end_us=next_sub.start,
                    gap_duration_us=gap_us,
                    reason=f"subtitle_gap_exceeds_{min_gap_sec:.2f}s",
                )
            )

    return gaps
