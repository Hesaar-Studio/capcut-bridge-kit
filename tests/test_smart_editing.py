"""
Unit and Integration Tests for Smart Editing Engine (Phase 3A)
==============================================================
Validates read-only pause gap detection, duplicate take analysis, pure subtitle operations,
Edit Plan serialization, and non-mutation guarantees.
"""

import copy
import json
import unittest

from draft_engine.models import (
    DraftProject,
    Segment,
    TextMaterial,
    TimeRange,
    Track,
)
from smart_editing.duplicate_detection import (
    calculate_text_similarity,
    detect_duplicate_candidates,
    normalize_text,
)
from smart_editing.edit_planner import generate_edit_plan
from smart_editing.models import (
    DuplicateCategory,
    EditAction,
    SubtitleItem,
)
from smart_editing.pause_detection import (
    clean_text_content,
    detect_subtitle_gaps,
    extract_subtitle_items,
)
from smart_editing.subtitle_ops import (
    adjust_subtitle_timing,
    merge_subtitles,
    split_subtitle,
    validate_subtitle_timing,
)


def create_sample_project() -> DraftProject:
    """Helper to build a sample DraftProject with subtitles and pauses."""
    t1 = TextMaterial(id="t1", content="<font>Welcome to this video tutorial</font>")
    t2 = TextMaterial(id="t2", content="Welcome to this video tutorial")  # Exact duplicate take
    t3 = TextMaterial(id="t3", content="Today we will explore smart editing")
    t4 = TextMaterial(id="t4", content="Today we will look at smart editing")  # High similarity take

    # Timeline layout:
    # 0s to 3s: seg1 (t1)
    # 3s to 5.5s: GAP of 2.5s
    # 5.5s to 8.5s: seg2 (t2)
    # 8.5s to 9.0s: GAP of 0.5s
    # 9.0s to 12.0s: seg3 (t3)
    # 12.0s to 14.0s: GAP of 2.0s
    # 14.0s to 17.0s: seg4 (t4)
    seg1 = Segment(
        id="s1",
        material_id="t1",
        target_timerange=TimeRange.from_seconds(0.0, 3.0),
        source_timerange=TimeRange.from_seconds(0.0, 3.0),
    )
    seg2 = Segment(
        id="s2",
        material_id="t2",
        target_timerange=TimeRange.from_seconds(5.5, 3.0),
        source_timerange=TimeRange.from_seconds(0.0, 3.0),
    )
    seg3 = Segment(
        id="s3",
        material_id="t3",
        target_timerange=TimeRange.from_seconds(9.0, 3.0),
        source_timerange=TimeRange.from_seconds(0.0, 3.0),
    )
    seg4 = Segment(
        id="s4",
        material_id="t4",
        target_timerange=TimeRange.from_seconds(14.0, 3.0),
        source_timerange=TimeRange.from_seconds(0.0, 3.0),
    )

    track = Track(id="trk_sub", type="text", segments=[seg1, seg2, seg3, seg4])

    return DraftProject(
        id="sample_proj_1",
        name="SampleTutorial",
        duration=17_000_000,
        texts=[t1, t2, t3, t4],
        tracks=[track],
    )


class TestSubtitleGapDetection(unittest.TestCase):
    def test_extract_and_detect_gaps(self):
        project = create_sample_project()
        subtitles = extract_subtitle_items(project)
        self.assertEqual(len(subtitles), 4)
        self.assertEqual(subtitles[0].content, "Welcome to this video tutorial")

        # Threshold 1.0 second: should detect gap between s1 & s2 (2.5s) and s3 & s4 (2.0s)
        # Gap between s2 & s3 is 0.5s so it must NOT be detected
        gaps = detect_subtitle_gaps(subtitles, min_gap_sec=1.0)
        self.assertEqual(len(gaps), 2)

        gap1 = gaps[0]
        self.assertEqual(gap1.preceding_segment_id, "s1")
        self.assertEqual(gap1.following_segment_id, "s2")
        self.assertAlmostEqual(gap1.gap_duration_sec, 2.5)

        gap2 = gaps[1]
        self.assertEqual(gap2.preceding_segment_id, "s3")
        self.assertEqual(gap2.following_segment_id, "s4")
        self.assertAlmostEqual(gap2.gap_duration_sec, 2.0)

    def test_gap_threshold_behavior(self):
        project = create_sample_project()
        subtitles = extract_subtitle_items(project)

        # Threshold 0.4s: all 3 gaps (2.5s, 0.5s, 2.0s) must be detected
        gaps_04 = detect_subtitle_gaps(subtitles, min_gap_sec=0.4)
        self.assertEqual(len(gaps_04), 3)

        # Threshold 3.0s: none of the gaps are >= 3.0s
        gaps_30 = detect_subtitle_gaps(subtitles, min_gap_sec=3.0)
        self.assertEqual(len(gaps_30), 0)

    def test_empty_and_single_subtitle_inputs(self):
        self.assertEqual(detect_subtitle_gaps([], min_gap_sec=1.0), [])

        single_item = SubtitleItem(
            segment_id="s1",
            material_id="m1",
            content="Lone segment",
            timerange=TimeRange.from_seconds(0, 5),
        )
        self.assertEqual(detect_subtitle_gaps([single_item], min_gap_sec=1.0), [])


class TestDuplicateDetection(unittest.TestCase):
    def test_exact_duplicate_detection(self):
        project = create_sample_project()
        subtitles = extract_subtitle_items(project)

        duplicates = detect_duplicate_candidates(subtitles, max_time_distance_sec=60.0)
        # s1 and s2 are exact duplicates: "Welcome to this video tutorial"
        exacts = [d for d in duplicates if d.category == DuplicateCategory.EXACT_DUPLICATE]
        self.assertEqual(len(exacts), 1)
        self.assertEqual(exacts[0].first_segment_id, "s1")
        self.assertEqual(exacts[0].second_segment_id, "s2")
        self.assertEqual(exacts[0].similarity_score, 1.0)

    def test_high_similarity_detection(self):
        project = create_sample_project()
        subtitles = extract_subtitle_items(project)

        duplicates = detect_duplicate_candidates(subtitles, max_time_distance_sec=60.0)
        # s3 ("Today we will explore smart editing") vs s4 ("Today we will look at smart editing")
        high_sim = [d for d in duplicates if d.category == DuplicateCategory.HIGH_SIMILARITY]
        self.assertEqual(len(high_sim), 1)
        self.assertEqual(high_sim[0].first_segment_id, "s3")
        self.assertEqual(high_sim[0].second_segment_id, "s4")
        self.assertGreaterEqual(high_sim[0].similarity_score, 0.80)

    def test_dissimilar_subtitles_not_flagged(self):
        score = calculate_text_similarity("Apple banana orange", "Completely different topic here")
        self.assertLess(score, 0.5)  # Well below 0.70 duplicate threshold
        # Also verify detect_duplicate_candidates does not flag them
        item1 = SubtitleItem("s1", "m1", "Apple banana orange", TimeRange.from_seconds(0, 3))
        item2 = SubtitleItem("s2", "m1", "Completely different topic here", TimeRange.from_seconds(3, 3))
        dups = detect_duplicate_candidates([item1, item2])
        self.assertEqual(len(dups), 0)


class TestPureSubtitleOperations(unittest.TestCase):
    def test_merge_subtitles(self):
        sub1 = SubtitleItem("s1", "m1", "First phrase", TimeRange.from_seconds(1.0, 2.0))
        sub2 = SubtitleItem("s2", "m1", "Second phrase", TimeRange.from_seconds(3.5, 2.0))

        merged = merge_subtitles(sub1, sub2, separator=" ")
        self.assertEqual(merged.content, "First phrase Second phrase")
        self.assertAlmostEqual(merged.start_sec, 1.0)
        self.assertAlmostEqual(merged.end_sec, 5.5)
        self.assertAlmostEqual(merged.duration_sec, 4.5)

        # Verify original items remain untouched
        self.assertEqual(sub1.content, "First phrase")
        self.assertAlmostEqual(sub1.duration_sec, 2.0)
        self.assertEqual(sub2.content, "Second phrase")

    def test_split_subtitle(self):
        sub = SubtitleItem("s1", "m1", "Whole phrase here", TimeRange.from_seconds(2.0, 4.0))
        # Split at 4.0s (midpoint between 2.0 and 6.0)
        part1, part2 = split_subtitle(sub, split_time_sec=4.0, part_one_text="Whole", part_two_text="phrase here")

        self.assertEqual(part1.content, "Whole")
        self.assertAlmostEqual(part1.start_sec, 2.0)
        self.assertAlmostEqual(part1.end_sec, 4.0)

        self.assertEqual(part2.content, "phrase here")
        self.assertAlmostEqual(part2.start_sec, 4.0)
        self.assertAlmostEqual(part2.end_sec, 6.0)

        # Invalid split time outside timerange
        with self.assertRaises(ValueError):
            split_subtitle(sub, split_time_sec=1.5, part_one_text="a", part_two_text="b")
        with self.assertRaises(ValueError):
            split_subtitle(sub, split_time_sec=7.0, part_one_text="a", part_two_text="b")

    def test_adjust_and_validate_timing(self):
        sub = SubtitleItem("s1", "m1", "Hello", TimeRange.from_seconds(2.0, 3.0))
        self.assertTrue(validate_subtitle_timing(sub))

        adjusted = adjust_subtitle_timing(sub, offset_start_sec=0.5, delta_duration_sec=-0.5)
        self.assertAlmostEqual(adjusted.start_sec, 2.5)
        self.assertAlmostEqual(adjusted.duration_sec, 2.5)

        # Negative start validation
        with self.assertRaises(ValueError):
            adjust_subtitle_timing(sub, offset_start_sec=-3.0)


class TestEditPlannerAndReadOnlyGuarantee(unittest.TestCase):
    def test_generate_edit_plan_and_serialization(self):
        project = create_sample_project()
        plan = generate_edit_plan(project, min_pause_gap_sec=1.0)

        self.assertEqual(plan.project_name, "SampleTutorial")
        self.assertEqual(len(plan.items), 4)  # 2 pause gaps + 2 duplicate candidates

        # Check serialization to dictionary / JSON
        plan_dict = plan.to_dict()
        self.assertIn("planned_operations_count", plan_dict)
        self.assertIn("items", plan_dict)
        self.assertIn("metadata", plan_dict)

        # Must be JSON serializable
        json_output = json.dumps(plan_dict, indent=2)
        self.assertIsInstance(json_output, str)
        self.assertIn("TRIM_GAP", json_output)
        self.assertIn("DUPLICATE_CANDIDATE", json_output)

    def test_read_only_guarantee(self):
        """Verifies that running the planner causes ZERO mutations on the input DraftProject."""
        project = create_sample_project()
        # Take deepcopy of dict representation before running
        before_state = copy.deepcopy(project.to_dict())

        # Run planner multiple times with different parameters
        _plan1 = generate_edit_plan(project, min_pause_gap_sec=0.5)
        _plan2 = generate_edit_plan(project, min_pause_gap_sec=2.0)

        after_state = project.to_dict()
        self.assertEqual(before_state, after_state)


if __name__ == "__main__":
    unittest.main()
