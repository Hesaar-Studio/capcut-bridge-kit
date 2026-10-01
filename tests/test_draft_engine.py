"""
Unit and Integration Tests for Draft Engine
============================================
Tests data models, validation, atomic writing, staging, backup, and restore.
"""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from draft_engine.backup import (
    create_draft_backup,
    list_draft_backups,
    prune_draft_backups,
    restore_draft_backup,
)
from draft_engine.models import (
    AudioMaterial,
    DraftProject,
    Segment,
    TextMaterial,
    TimeRange,
    Track,
    VideoMaterial,
)
from draft_engine.reader import (
    get_capcut_projects_dir,
    list_draft_names,
    read_draft_project,
    read_raw_draft_json,
    safe_draft_name,
)
from draft_engine.validator import (
    repair_null_timeranges,
    validate_draft_structure,
)
from draft_engine.writer import (
    write_draft_project,
    write_raw_draft_json_atomic,
)


class DraftEngineModelsTest(unittest.TestCase):
    def test_timerange_conversions(self):
        tr = TimeRange.from_seconds(1.5, 3.0)
        self.assertEqual(tr.start, 1_500_000)
        self.assertEqual(tr.duration, 3_000_000)
        self.assertAlmostEqual(tr.start_sec, 1.5)
        self.assertAlmostEqual(tr.duration_sec, 3.0)
        self.assertEqual(tr.end, 4_500_000)
        self.assertAlmostEqual(tr.end_sec, 4.5)

        data = tr.to_dict()
        self.assertEqual(data, {"start": 1_500_000, "duration": 3_000_000})
        restored = TimeRange.from_dict(data)
        self.assertIsNotNone(restored)
        self.assertEqual(restored.start, tr.start)
        self.assertEqual(restored.duration, tr.duration)

    def test_materials_and_project_roundtrip(self):
        v = VideoMaterial(id="v1", path="/path/to/clip.mp4", duration=5_000_000)
        a = AudioMaterial(id="a1", path="/path/to/music.mp3", duration=5_000_000)
        t = TextMaterial(id="t1", content="Hello CapCut", font_size=32.0)

        seg1 = Segment(
            id="s1",
            material_id="v1",
            target_timerange=TimeRange(0, 5_000_000),
            source_timerange=TimeRange(0, 5_000_000),
        )
        track1 = Track(id="trk1", type="video", segments=[seg1])

        project = DraftProject(
            id="p1",
            name="TestProject",
            duration=5_000_000,
            videos=[v],
            audios=[a],
            texts=[t],
            tracks=[track1],
        )

        project_dict = project.to_dict()
        self.assertEqual(project_dict["id"], "p1")
        self.assertEqual(len(project_dict["materials"]["videos"]), 1)
        self.assertEqual(len(project_dict["tracks"]), 1)

        restored_proj = DraftProject.from_dict(project_dict, project_name="TestProject")
        self.assertEqual(restored_proj.id, "p1")
        self.assertEqual(len(restored_proj.videos), 1)
        self.assertEqual(restored_proj.videos[0].path, "/path/to/clip.mp4")


class DraftEngineValidatorTest(unittest.TestCase):
    def test_validation_valid_structure(self):
        content = {
            "materials": {"videos": [{"id": "v1", "path": "test.mp4"}]},
            "tracks": [{
                "type": "video",
                "segments": [{
                    "id": "s1",
                    "material_id": "v1",
                    "target_timerange": {"start": 0, "duration": 3_000_000},
                    "source_timerange": {"start": 0, "duration": 3_000_000},
                }]
            }]
        }
        res = validate_draft_structure(content)
        self.assertTrue(res.is_valid)
        self.assertEqual(len(res.errors), 0)

    def test_validation_rejects_missing_tracks(self):
        res = validate_draft_structure({"materials": {}})
        self.assertFalse(res.is_valid)
        self.assertTrue(any("tracks" in e for e in res.errors))

    def test_repair_null_timeranges(self):
        content = {
            "tracks": [{
                "segments": [
                    {
                        "id": "s1",
                        "target_timerange": {"start": 0, "duration": 2_500_000},
                        "source_timerange": None,  # problematic
                    }
                ]
            }]
        }
        repaired = repair_null_timeranges(content)
        self.assertEqual(repaired, 1)
        seg = content["tracks"][0]["segments"][0]
        self.assertIsNotNone(seg["source_timerange"])
        self.assertEqual(seg["source_timerange"]["duration"], 2_500_000)
        self.assertEqual(seg["source_timerange"]["start"], 0)


class DraftEngineBackupTest(unittest.TestCase):
    def test_create_and_restore_backup(self):
        with tempfile.TemporaryDirectory() as temp:
            projects_dir = Path(temp)
            draft_dir = projects_dir / "DemoDraft"
            draft_dir.mkdir()
            (draft_dir / "draft_content.json").write_text('{"id":"demo"}', encoding="utf-8")
            (draft_dir / "file.txt").write_text("sample content", encoding="utf-8")

            # 1. Create backup
            backup_path = create_draft_backup(draft_dir)
            self.assertTrue(backup_path.is_dir())
            self.assertTrue(backup_path.name.startswith(".DemoDraft.backup-"))
            self.assertEqual((backup_path / "file.txt").read_text(encoding="utf-8"), "sample content")

            # 2. List backups
            backups = list_draft_backups(projects_dir, "DemoDraft")
            self.assertEqual(len(backups), 1)
            self.assertEqual(backups[0], backup_path)

            # 3. Modify original
            (draft_dir / "file.txt").write_text("modified content", encoding="utf-8")
            self.assertEqual((draft_dir / "file.txt").read_text(encoding="utf-8"), "modified content")

            # 4. Restore backup
            restored = restore_draft_backup(backup_path, draft_dir)
            self.assertEqual(restored, draft_dir)
            self.assertEqual((draft_dir / "file.txt").read_text(encoding="utf-8"), "sample content")

    def test_prune_backups(self):
        with tempfile.TemporaryDirectory() as temp:
            projects_dir = Path(temp)
            draft_dir = projects_dir / "DemoDraft"
            draft_dir.mkdir()

            # Create 4 backups
            for _ in range(4):
                create_draft_backup(draft_dir)

            backups = list_draft_backups(projects_dir, "DemoDraft")
            self.assertEqual(len(backups), 4)

            # Prune keeping last 2
            pruned = prune_draft_backups(projects_dir, "DemoDraft", keep_last=2)
            self.assertEqual(pruned, 2)
            self.assertEqual(len(list_draft_backups(projects_dir, "DemoDraft")), 2)


class DraftEngineReaderWriterTest(unittest.TestCase):
    def test_safe_draft_name(self):
        self.assertEqual(safe_draft_name("Valid_Name-01"), "Valid_Name-01")
        with self.assertRaises(ValueError):
            safe_draft_name("../traversal")
        with self.assertRaises(ValueError):
            safe_draft_name("/root/path")
        with self.assertRaises(ValueError):
            safe_draft_name("")

    def test_atomic_write_and_readback(self):
        with tempfile.TemporaryDirectory() as temp:
            projects_dir = Path(temp)
            content = {
                "id": "PROJ1",
                "duration": 4_000_000,
                "materials": {"videos": [{"id": "v1", "path": "video.mp4"}]},
                "tracks": [{
                    "type": "video",
                    "segments": [{
                        "id": "s1",
                        "material_id": "v1",
                        "target_timerange": {"start": 0, "duration": 4_000_000},
                        "source_timerange": {"start": 0, "duration": 4_000_000},
                    }]
                }]
            }

            # 1. First write (new project)
            res = write_raw_draft_json_atomic(
                projects_dir=projects_dir,
                draft_name="MyFirstDraft",
                content=content,
                overwrite=False,
            )
            self.assertTrue(res["success"])
            target_dir = Path(res["target_dir"])
            self.assertTrue((target_dir / "draft_content.json").is_file())

            # 2. Read back
            draft_proj = read_draft_project(target_dir)
            self.assertEqual(draft_proj.id, "PROJ1")
            self.assertEqual(draft_proj.duration, 4_000_000)

            # 3. Refuse overwrite without flag
            with self.assertRaises(FileExistsError):
                write_raw_draft_json_atomic(
                    projects_dir=projects_dir,
                    draft_name="MyFirstDraft",
                    content=content,
                    overwrite=False,
                )

            # 4. Refuse overwrite without name confirmation
            with self.assertRaises(ValueError):
                write_raw_draft_json_atomic(
                    projects_dir=projects_dir,
                    draft_name="MyFirstDraft",
                    content=content,
                    overwrite=True,
                    confirm_name="WrongName",
                )

            # 5. Successful overwrite with backup
            updated_content = dict(content)
            updated_content["duration"] = 6_000_000
            res2 = write_raw_draft_json_atomic(
                projects_dir=projects_dir,
                draft_name="MyFirstDraft",
                content=updated_content,
                overwrite=True,
                confirm_name="MyFirstDraft",
            )
            self.assertTrue(res2["success"])
            self.assertIsNotNone(res2["backup_dir"])
            self.assertTrue(Path(res2["backup_dir"]).is_dir())

            # Verify target has updated duration
            draft_proj2 = read_draft_project(target_dir)
            self.assertEqual(draft_proj2.duration, 6_000_000)


if __name__ == "__main__":
    unittest.main()
