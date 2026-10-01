"""
Draft Engine Validator
======================
Validates structural integrity of CapCut draft JSON and repairs unsafe timeranges.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class ValidationResult:
    is_valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    repaired_count: int = 0

    def add_error(self, msg: str):
        self.errors.append(msg)
        self.is_valid = False

    def add_warning(self, msg: str):
        self.warnings.append(msg)


def repair_null_timeranges(content: Dict[str, Any]) -> int:
    """
    Hard Rule 5: A segment with source_timerange: null wedges CapCut's encoder mid-export!
    Repairs null or missing source_timerange in-place and returns repaired count.
    """
    repaired_count = 0
    tracks = content.get("tracks", [])
    if not isinstance(tracks, list):
        return 0

    for track in tracks:
        if not isinstance(track, dict):
            continue
        segments = track.get("segments", [])
        if not isinstance(segments, list):
            continue

        for seg in segments:
            if not isinstance(seg, dict):
                continue
            if seg.get("source_timerange") is None:
                target_range = seg.get("target_timerange")
                dur = (
                    target_range.get("duration", 3_000_000)
                    if isinstance(target_range, dict)
                    else 3_000_000
                )
                seg["source_timerange"] = {
                    "duration": dur,
                    "start": 0,
                }
                repaired_count += 1

    return repaired_count


def validate_draft_structure(
    content: Any,
    check_files: bool = False,
    base_dir: Optional[Path] = None,
) -> ValidationResult:
    """
    Inspects draft JSON content and verifies critical fields required by CapCut.
    """
    res = ValidationResult(is_valid=True)

    if not isinstance(content, dict):
        res.add_error("Draft content root must be a JSON object (dictionary)")
        return res

    # 1. Root structure checks
    if "tracks" not in content or not isinstance(content["tracks"], list):
        res.add_error("Draft must contain a 'tracks' array")
    if "materials" not in content or not isinstance(content["materials"], dict):
        res.add_error("Draft must contain a 'materials' object")

    if not res.is_valid:
        return res

    materials = content["materials"]
    tracks = content["tracks"]

    # 2. Material mapping
    material_ids = set()
    videos = materials.get("videos", [])
    if isinstance(videos, list):
        for idx, v in enumerate(videos):
            if not isinstance(v, dict):
                res.add_error(f"materials.videos[{idx}] is not an object")
                continue
            m_id = v.get("id")
            if not m_id:
                res.add_error(f"materials.videos[{idx}] is missing 'id'")
            else:
                material_ids.add(m_id)

            if check_files:
                path_str = v.get("path")
                if not path_str:
                    res.add_warning(f"Video material {m_id} has no path")
                else:
                    p = Path(path_str)
                    if not p.is_file():
                        res.add_warning(f"Referenced media file does not exist on disk: {p}")

    audios = materials.get("audios", [])
    if isinstance(audios, list):
        for idx, a in enumerate(audios):
            if isinstance(a, dict) and a.get("id"):
                material_ids.add(a["id"])

    texts = materials.get("texts", [])
    if isinstance(texts, list):
        for idx, t in enumerate(texts):
            if isinstance(t, dict) and t.get("id"):
                material_ids.add(t["id"])

    # 3. Track and segment checks
    seen_segment_ids = set()
    for t_idx, track in enumerate(tracks):
        if not isinstance(track, dict):
            res.add_error(f"tracks[{t_idx}] is not an object")
            continue

        segments = track.get("segments", [])
        if not isinstance(segments, list):
            res.add_error(f"tracks[{t_idx}].segments is not an array")
            continue

        for s_idx, seg in enumerate(segments):
            if not isinstance(seg, dict):
                res.add_error(f"tracks[{t_idx}].segments[{s_idx}] is not an object")
                continue

            seg_id = seg.get("id")
            if not seg_id:
                res.add_error(f"tracks[{t_idx}].segments[{s_idx}] is missing 'id'")
            elif seg_id in seen_segment_ids:
                res.add_warning(f"Duplicate segment ID detected: {seg_id}")
            else:
                seen_segment_ids.add(seg_id)

            # Check target timerange
            target_tr = seg.get("target_timerange")
            if not isinstance(target_tr, dict):
                res.add_error(f"Segment {seg_id} missing valid target_timerange")
            else:
                dur = target_tr.get("duration")
                if dur is None or dur <= 0:
                    res.add_error(f"Segment {seg_id} target_timerange duration must be > 0 (got {dur})")

            # Check source timerange nullity
            source_tr = seg.get("source_timerange")
            if source_tr is None:
                res.add_warning(f"Segment {seg_id} has source_timerange: null (needs repair)")

    return res
