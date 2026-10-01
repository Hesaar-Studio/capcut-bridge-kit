import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def load_bridge(filename, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ReplaySafetyTests(unittest.TestCase):
    def test_replay_safety_on_both_platform_clis(self):
        for filename, module_name in (("capcut-bridge.py", "mac_bridge_test"), ("capcut-bridge-win.py", "win_bridge_test")):
            with self.subTest(platform=filename), tempfile.TemporaryDirectory() as temp:
                module = load_bridge(filename, module_name)
                projects = Path(temp) / "projects"
                source = Path(temp) / "source.mp4"
                source.write_bytes(b"mock media")
                job = Path(temp) / "cuts.json"
                job.write_text(json.dumps({"draft_name": "SafeDraft", "cuts": [{"source_path": str(source), "start": 0, "duration": 1}]}), encoding="utf-8")
                target = projects / "SafeDraft"
                target.mkdir(parents=True)
                original = target / "keep.txt"
                original.write_bytes(b"preserve-me")
                module.CAPCUT_PROJECTS_DIR = projects
                with patch.object(module, "is_capcut_running", return_value=False), patch.object(module, "launch_capcut"), patch("builtins.print"):
                    with self.assertRaises(FileExistsError):
                        module.cmd_replay(SimpleNamespace(job=str(job), name="SafeDraft", overwrite=False, confirm_name=None))
                    self.assertEqual(original.read_bytes(), b"preserve-me")
                    with self.assertRaises(ValueError):
                        module.cmd_replay(SimpleNamespace(job=str(job), name="../escape", overwrite=False, confirm_name=None))
                    self.assertEqual(original.read_bytes(), b"preserve-me")
                    module.cmd_replay(SimpleNamespace(job=str(job), name="NewDraft", overwrite=False, confirm_name=None))
                    self.assertTrue((projects / "NewDraft" / "draft_content.json").is_file())
                    with patch.object(module, "is_capcut_running", return_value=True), patch.object(module, "quit_capcut", return_value=False):
                        with self.assertRaisesRegex(RuntimeError, "did not close"):
                            module.cmd_replay(SimpleNamespace(job=str(job), name="AnotherDraft", overwrite=False, confirm_name=None))
                    self.assertFalse((projects / "AnotherDraft").exists())
                    with patch.object(module, "write_draft_content", side_effect=OSError("mock staging failure")):
                        with self.assertRaisesRegex(OSError, "mock staging failure"):
                            module.cmd_replay(SimpleNamespace(job=str(job), name="SafeDraft", overwrite=True, confirm_name="SafeDraft"))
                    self.assertEqual(original.read_bytes(), b"preserve-me")
                    module.cmd_replay(SimpleNamespace(job=str(job), name="SafeDraft", overwrite=True, confirm_name="SafeDraft"))
                backups = list(projects.glob(".SafeDraft.backup-*"))
                self.assertEqual(len(backups), 1)
                self.assertEqual((backups[0] / "keep.txt").read_bytes(), b"preserve-me")
                draft = json.loads((target / "draft_content.json").read_text(encoding="utf-8"))
                media_path = Path(draft["materials"]["videos"][0]["path"])
                self.assertTrue(media_path.is_file())


if __name__ == "__main__":
    unittest.main()

