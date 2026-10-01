import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import bridge_system.bridge_server as bridge


class McpTextReadbackTests(unittest.TestCase):
    def test_verifies_caption_text_and_timing(self):
        with tempfile.TemporaryDirectory() as temp:
            projects = Path(temp)
            draft = projects / "TestProject"
            draft.mkdir()
            content = {
                "materials": {"texts": [{"id": "txt1", "content": "<font>سلام</font>"}]},
                "tracks": [{"type": "text", "segments": [{
                    "id": "seg1", "material_id": "txt1",
                    "target_timerange": {"start": 2_000_000, "duration": 3_000_000},
                }]}],
            }
            (draft / "draft_content.json").write_text(json.dumps(content), encoding="utf-8")
            with patch.object(bridge, "_capcut_projects_dir", return_value=projects):
                result = bridge._verify_capcut_text("TestProject", "سلام", 2, 3)
            self.assertTrue(result["verified"])
            self.assertEqual(result["text_segment_id"], "seg1")

    def test_fails_when_caption_position_does_not_match(self):
        with tempfile.TemporaryDirectory() as temp:
            projects = Path(temp)
            draft = projects / "TestProject"
            draft.mkdir()
            content = {
                "materials": {"texts": [{"id": "txt1", "content": "hello"}]},
                "tracks": [{"type": "text", "segments": [{
                    "id": "seg1", "material_id": "txt1",
                    "target_timerange": {"start": 0, "duration": 3_000_000},
                }]}],
            }
            (draft / "draft_content.json").write_text(json.dumps(content), encoding="utf-8")
            with patch.object(bridge, "_capcut_projects_dir", return_value=projects):
                with self.assertRaisesRegex(RuntimeError, "could not find"):
                    bridge._verify_capcut_text("TestProject", "hello", 2, 3)


if __name__ == "__main__":
    unittest.main()
