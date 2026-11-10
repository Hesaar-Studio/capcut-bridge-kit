import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from bridge_system.process_guard import ProcessStateUnknown

ROOT = Path(__file__).resolve().parents[1]


def load_bridge(filename, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ReplaySafetyTests(unittest.TestCase):
    def test_file_lane_refuses_running_editor_without_quit_or_cache_delete(self):
        for filename, module_name in (("capcut-bridge.py", "mac_file_lane_test"), ("capcut-bridge-win.py", "win_file_lane_test")):
            with self.subTest(platform=filename), tempfile.TemporaryDirectory() as temp:
                module = load_bridge(filename, module_name)
                module.CAPCUT_PROJECTS_DIR = Path(temp) / "projects"
                draft = module.CAPCUT_PROJECTS_DIR / "SafeDraft"
                timelines = draft / "Timelines"
                timelines.mkdir(parents=True)
                cache = timelines / "cache.bin"
                cache.write_bytes(b"keep")
                with patch.object(module, "is_capcut_running", return_value=True):
                    with patch.object(module, "quit_capcut") as quit_mock:
                        with patch.object(module, "launch_capcut") as launch_mock:
                            with self.assertRaisesRegex(RuntimeError, "CapCut is running"):
                                with module.SafeDraftEditor("SafeDraft"):
                                    self.fail("Editor context must refuse while CapCut is running")
                            quit_mock.assert_not_called()
                            launch_mock.assert_not_called()
                self.assertEqual(cache.read_bytes(), b"keep")

    def test_file_lane_refuses_unknown_process_state_before_mutation(self):
        for filename, module_name in (("capcut-bridge.py", "mac_unknown_process_test"), ("capcut-bridge-win.py", "win_unknown_process_test")):
            with self.subTest(platform=filename), tempfile.TemporaryDirectory() as temp:
                module = load_bridge(filename, module_name)
                projects = Path(temp) / "projects"
                module.CAPCUT_PROJECTS_DIR = projects
                draft = projects / "SafeDraft"
                draft.mkdir(parents=True)
                sentinel = draft / "preserve.txt"
                sentinel.write_bytes(b"keep")

                with patch.object(module, "is_capcut_running", side_effect=ProcessStateUnknown("probe unavailable")):
                    with self.assertRaises(ProcessStateUnknown):
                        with module.SafeDraftEditor("SafeDraft"):
                            self.fail("Unknown editor state must stop the file lane")

                self.assertEqual(sentinel.read_bytes(), b"keep")

                source = Path(temp) / "source.mp4"
                source.write_bytes(b"mock media")
                job = Path(temp) / "cuts.json"
                job.write_text(json.dumps({"draft_name": "NewDraft", "cuts": [{"source_path": str(source), "start": 0, "duration": 1}]}), encoding="utf-8")
                with patch.object(module, "is_capcut_running", side_effect=ProcessStateUnknown("probe unavailable")):
                    with self.assertRaises(ProcessStateUnknown):
                        module.cmd_replay(SimpleNamespace(job=str(job), name="NewDraft", overwrite=False, confirm_name=None))
                self.assertFalse((projects / "NewDraft").exists())
                self.assertEqual(sentinel.read_bytes(), b"keep")

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
                with patch.object(module, "is_capcut_running", return_value=False), patch.object(module, "launch_capcut") as launch_mock, patch("builtins.print"):
                    with self.assertRaises(FileExistsError):
                        module.cmd_replay(SimpleNamespace(job=str(job), name="SafeDraft", overwrite=False, confirm_name=None))
                    self.assertEqual(original.read_bytes(), b"preserve-me")
                    with self.assertRaises(ValueError):
                        module.cmd_replay(SimpleNamespace(job=str(job), name="../escape", overwrite=False, confirm_name=None))
                    self.assertEqual(original.read_bytes(), b"preserve-me")
                    module.cmd_replay(SimpleNamespace(job=str(job), name="NewDraft", overwrite=False, confirm_name=None))
                    self.assertTrue((projects / "NewDraft" / "draft_content.json").is_file())
                    with patch.object(module, "is_capcut_running", return_value=True), patch.object(module, "quit_capcut") as quit_mock:
                        with self.assertRaisesRegex(RuntimeError, "CapCut is running"):
                            module.cmd_replay(SimpleNamespace(job=str(job), name="AnotherDraft", overwrite=False, confirm_name=None))
                        quit_mock.assert_not_called()
                    self.assertFalse((projects / "AnotherDraft").exists())
                    with patch.object(module, "write_draft_content", side_effect=OSError("mock staging failure")):
                        with self.assertRaisesRegex(OSError, "mock staging failure"):
                            module.cmd_replay(SimpleNamespace(job=str(job), name="SafeDraft", overwrite=True, confirm_name="SafeDraft"))
                    self.assertEqual(original.read_bytes(), b"preserve-me")
                    module.cmd_replay(SimpleNamespace(job=str(job), name="SafeDraft", overwrite=True, confirm_name="SafeDraft"))
                    launch_mock.assert_not_called()
                backups = list(projects.glob(".SafeDraft.backup-*"))
                self.assertEqual(len(backups), 1)
                self.assertEqual((backups[0] / "keep.txt").read_bytes(), b"preserve-me")
                draft = json.loads((target / "draft_content.json").read_text(encoding="utf-8"))
                media_path = Path(draft["materials"]["videos"][0]["path"])
                self.assertTrue(media_path.is_file())


if __name__ == "__main__":
    unittest.main()

