"""
Smart Editing Data Models
=========================
Read-only data structures for subtitle gaps, duplicate candidates, and edit plans.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

from draft_engine.models import TimeRange


class EditAction(str, Enum):
    REMOVE_SEGMENT = "REMOVE_SEGMENT"
    TRIM_GAP = "TRIM_GAP"
    MERGE_SUBTITLES = "MERGE_SUBTITLES"
    SPLIT_SUBTITLE = "SPLIT_SUBTITLE"
    ADJUST_TIMING = "ADJUST_TIMING"
    DUPLICATE_CANDIDATE = "DUPLICATE_CANDIDATE"


class DuplicateCategory(str, Enum):
    EXACT_DUPLICATE = "EXACT_DUPLICATE"
    HIGH_SIMILARITY = "HIGH_SIMILARITY"
    POSSIBLE_DUPLICATE = "POSSIBLE_DUPLICATE"


@dataclass(frozen=True)
class SubtitleItem:
    """Immutable representation of a text/subtitle segment on the timeline."""
    segment_id: str
    material_id: str
    content: str
    timerange: TimeRange

    @property
    def start(self) -> int:
        return self.timerange.start

    @property
    def end(self) -> int:
        return self.timerange.end

    @property
    def duration(self) -> int:
        return self.timerange.duration

    @property
    def start_sec(self) -> float:
        return self.timerange.start_sec

    @property
    def end_sec(self) -> float:
        return self.timerange.end_sec

    @property
    def duration_sec(self) -> float:
        return self.timerange.duration_sec

    def to_dict(self) -> Dict[str, Any]:
        return {
            "segment_id": self.segment_id,
            "material_id": self.material_id,
            "content": self.content,
            "timerange": self.timerange.to_dict(),
            "start_sec": round(self.start_sec, 3),
            "end_sec": round(self.end_sec, 3),
            "duration_sec": round(self.duration_sec, 3),
        }


@dataclass(frozen=True)
class SubtitleGap:
    """Represents a detected gap between consecutive subtitle/text segments."""
    preceding_segment_id: str
    following_segment_id: str
    gap_start_us: int
    gap_end_us: int
    gap_duration_us: int
    reason: str = "subtitle_pause_gap"

    @property
    def gap_start_sec(self) -> float:
        return self.gap_start_us / 1_000_000.0

    @property
    def gap_end_sec(self) -> float:
        return self.gap_end_us / 1_000_000.0

    @property
    def gap_duration_sec(self) -> float:
        return self.gap_duration_us / 1_000_000.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "preceding_segment_id": self.preceding_segment_id,
            "following_segment_id": self.following_segment_id,
            "gap_start_us": self.gap_start_us,
            "gap_end_us": self.gap_end_us,
            "gap_duration_us": self.gap_duration_us,
            "gap_start_sec": round(self.gap_start_sec, 3),
            "gap_end_sec": round(self.gap_end_sec, 3),
            "gap_duration_sec": round(self.gap_duration_sec, 3),
            "reason": self.reason,
        }


@dataclass(frozen=True)
class DuplicateCandidate:
    """Represents a pair of subtitle segments with similar or identical content."""
    first_segment_id: str
    second_segment_id: str
    first_text: str
    second_text: str
    similarity_score: float
    category: DuplicateCategory
    time_distance_sec: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "first_segment_id": self.first_segment_id,
            "second_segment_id": self.second_segment_id,
            "first_text": self.first_text,
            "second_text": self.second_text,
            "similarity_score": round(self.similarity_score, 3),
            "category": self.category.value,
            "time_distance_sec": round(self.time_distance_sec, 3),
        }


@dataclass
class PlanItem:
    """A proposed edit action within an Edit Plan."""
    action: EditAction
    target_segment_ids: List[str]
    description: str
    time_range: Optional[TimeRange] = None
    parameters: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "action": self.action.value,
            "target_segment_ids": self.target_segment_ids,
            "description": self.description,
            "time_range": self.time_range.to_dict() if self.time_range else None,
            "parameters": self.parameters,
        }


@dataclass
class EditPlan:
    """Structured collection of proposed edit operations (Dry Run result)."""
    project_name: str
    total_duration_us: int
    items: List[PlanItem] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def total_duration_sec(self) -> float:
        return self.total_duration_us / 1_000_000.0

    def add_item(self, item: PlanItem):
        self.items.append(item)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "project_name": self.project_name,
            "total_duration_us": self.total_duration_us,
            "total_duration_sec": round(self.total_duration_sec, 3),
            "planned_operations_count": len(self.items),
            "items": [item.to_dict() for item in self.items],
            "metadata": self.metadata,
        }
