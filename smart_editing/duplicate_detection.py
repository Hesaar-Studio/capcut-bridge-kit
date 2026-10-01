"""
Duplicate Take Analysis
=======================
Conservative text-based similarity analysis across subtitle segments.
Identifies potential duplicate takes or repetitive utterances without external APIs or LLMs.
"""

from __future__ import annotations

import difflib
import re
from typing import List, Optional

from .models import DuplicateCandidate, DuplicateCategory, SubtitleItem


def normalize_text(text: str) -> str:
    """Lowercases, removes punctuation, and condenses whitespace."""
    if not text:
        return ""
    # Remove HTML tags if present
    cleaned = re.sub(r"<[^>]+>", "", text)
    # Remove punctuation
    cleaned = re.sub(r"[^\w\s]", "", cleaned, flags=re.UNICODE)
    return " ".join(cleaned.lower().split())


def calculate_text_similarity(text1: str, text2: str) -> float:
    """
    Computes Levenshtein/Ratcliff-Obershelp similarity ratio using standard library difflib.
    Returns float in range [0.0, 1.0].
    """
    norm1 = normalize_text(text1)
    norm2 = normalize_text(text2)
    if not norm1 or not norm2:
        return 0.0
    if norm1 == norm2:
        return 1.0
    return difflib.SequenceMatcher(None, norm1, norm2).ratio()


def detect_duplicate_candidates(
    subtitles: List[SubtitleItem],
    max_time_distance_sec: float = 60.0,
    high_threshold: float = 0.85,
    possible_threshold: float = 0.70,
    min_word_count: int = 2,
) -> List[DuplicateCandidate]:
    """
    Compares subtitle items within a temporal window to identify duplicate or restarted takes.

    Parameters:
      subtitles: List of SubtitleItem (chronological order)
      max_time_distance_sec: Maximum time window between two segments to consider them retakes
      high_threshold: Similarity score for HIGH_SIMILARITY category
      possible_threshold: Minimum similarity score for POSSIBLE_DUPLICATE category
      min_word_count: Ignore short phrases (e.g. "yes", "ok") to reduce false positives
    """
    candidates: List[DuplicateCandidate] = []
    n = len(subtitles)

    for i in range(n):
        item_a = subtitles[i]
        words_a = normalize_text(item_a.content).split()
        if len(words_a) < min_word_count:
            continue

        for j in range(i + 1, n):
            item_b = subtitles[j]
            time_diff_sec = (item_b.start - item_a.end) / 1_000_000.0

            # Stop checking once beyond the time distance window
            if time_diff_sec > max_time_distance_sec:
                break

            words_b = normalize_text(item_b.content).split()
            if len(words_b) < min_word_count:
                continue

            similarity = calculate_text_similarity(item_a.content, item_b.content)

            if similarity >= 1.0:
                category = DuplicateCategory.EXACT_DUPLICATE
            elif similarity >= high_threshold:
                category = DuplicateCategory.HIGH_SIMILARITY
            elif similarity >= possible_threshold:
                category = DuplicateCategory.POSSIBLE_DUPLICATE
            else:
                continue

            candidates.append(
                DuplicateCandidate(
                    first_segment_id=item_a.segment_id,
                    second_segment_id=item_b.segment_id,
                    first_text=item_a.content,
                    second_text=item_b.content,
                    similarity_score=similarity,
                    category=category,
                    time_distance_sec=max(0.0, time_diff_sec),
                )
            )

    return candidates
