import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import bridge_system.bridge_server as bridge


class McpDraftReadbackTests(unittest.TestCase):
    def test_verifies_draft_timeline_and_media(self):
        with tempfile.TemporaryDirectory() as temp:
            projects = Path(temp)
            draft = projects / "TestProject"
            draft.mkdir()
            media = draft / "clip.mp4"
            media.write_bytes(b"mock")
            content = {
                "duration": 1_000_000,
                "materials": {"videos": [{"path": str(media)}]},
                "tracks": [{"type": "video", "segments": [{"material_id": "v1"}]}],
            }
            (draft / "draft_content.json").write_text(json.dumps(content), encoding="utf-8")
            with patch.object(bridge, "_capcut_projects_dir", return_value=projects):
                result = bridge._verify_capcut_draft("TestProject", 1)
            self.assertTrue(result["verified"])
            self.assertEqual(result["timeline_segments"], 1)
            self.assertEqual(result["duration_us"], 1_000_000)

    def test_fails_when_media_readback_is_missing(self):
        with tempfile.TemporaryDirectory() as temp:
            projects = Path(temp)
            draft = projects / "TestProject"
            draft.mkdir()
            content = {
                "materials": {"videos": [{"path": str(draft / "gone.mp4")}]},
                "tracks": [{"type": "video", "segments": [{}]}],
            }
            (draft / "draft_content.json").write_text(json.dumps(content), encoding="utf-8")
            with patch.object(bridge, "_capcut_projects_dir", return_value=projects):
                with self.assertRaisesRegex(RuntimeError, "missing media"):
                    bridge._verify_capcut_draft("TestProject", 1)


if __name__ == "__main__":
    unittest.main()
