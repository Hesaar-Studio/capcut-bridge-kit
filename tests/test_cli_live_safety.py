import importlib.util
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from bridge_system.process_guard import ProcessStateUnknown

ROOT = Path(__file__).resolve().parents[1]


def load_bridge(filename, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class MacLiveSafetyTests(unittest.TestCase):
    def setUp(self):
        self.bridge = load_bridge("capcut-bridge.py", "mac_live_safety_test")
        self.bridge.MACOS_NATIVE_AVAILABLE = True

    def test_global_key_injection_fails_closed_when_capcut_not_frontmost(self):
        event_factory = Mock()
        with patch.object(self.bridge, "is_capcut_running", return_value=True), \
             patch.object(self.bridge, "is_capcut_frontmost", return_value=False), \
             patch.object(self.bridge, "CGEventCreateKeyboardEvent", event_factory, create=True):
            with self.assertRaisesRegex(RuntimeError, "foreground"):
                self.bridge.synthesize_key(49)
        event_factory.assert_not_called()

    def test_unsupported_seek_timed_split_and_dump_send_no_events(self):
        key = Mock()
        with patch.object(self.bridge, "synthesize_key", key):
            with self.assertRaises(NotImplementedError):
                self.bridge.cmd_live_seek(SimpleNamespace(seconds=12))
            with self.assertRaises(NotImplementedError):
                self.bridge.cmd_live_split(SimpleNamespace(seconds=12))
            with self.assertRaises(NotImplementedError):
                self.bridge.cmd_live_dump(SimpleNamespace(needle=None))
        key.assert_not_called()

    def test_export_refuses_when_capcut_is_not_foreground(self):
        key = Mock()
        with patch.object(self.bridge, "is_capcut_running", return_value=True), \
             patch.object(self.bridge, "is_capcut_frontmost", return_value=False), \
             patch.object(self.bridge, "synthesize_key", key):
            with self.assertRaisesRegex(RuntimeError, "foreground"):
                self.bridge.cmd_live_export(SimpleNamespace(to=None, timeout=60))
        key.assert_not_called()


class WindowsLiveSafetyTests(unittest.TestCase):
    def setUp(self):
        self.bridge = load_bridge("capcut-bridge-win.py", "win_live_safety_test")
        self.bridge.PYAUTOGUI_AVAILABLE = True
        self.bridge.pyautogui = Mock()

    def test_shortcut_refuses_when_capcut_not_foreground(self):
        with patch.object(self.bridge, "is_capcut_running", return_value=True), \
             patch.object(self.bridge, "is_capcut_foreground", return_value=False), \
             patch.object(self.bridge, "check_pyautogui", return_value=None):
            with self.assertRaisesRegex(RuntimeError, "foreground"):
                self.bridge.cmd_live_play(SimpleNamespace())
            with self.assertRaisesRegex(RuntimeError, "foreground"):
                self.bridge.cmd_live_split(SimpleNamespace())
        self.bridge.pyautogui.press.assert_not_called()
        self.bridge.pyautogui.hotkey.assert_not_called()

    def test_shortcut_refuses_when_process_state_is_unknown(self):
        with patch.object(self.bridge, "is_capcut_running", side_effect=ProcessStateUnknown("probe unavailable")), \
             patch.object(self.bridge, "is_capcut_foreground", return_value=True), \
             patch.object(self.bridge, "check_pyautogui", return_value=None):
            with self.assertRaises(ProcessStateUnknown):
                self.bridge.cmd_live_split(SimpleNamespace())
        self.bridge.pyautogui.hotkey.assert_not_called()
        self.bridge.pyautogui.press.assert_not_called()

    def test_custom_export_path_is_rejected_without_shortcut(self):
        with self.assertRaises(NotImplementedError):
            self.bridge.cmd_live_export(SimpleNamespace(to="/tmp/output.mp4", timeout=60))
        self.bridge.pyautogui.hotkey.assert_not_called()
        self.bridge.pyautogui.press.assert_not_called()

    def test_quit_helper_never_terminates_capcut(self):
        with patch.object(self.bridge, "is_capcut_running", return_value=True), \
             patch.object(self.bridge.subprocess, "run") as run_mock:
            self.assertFalse(self.bridge.quit_capcut())
            self.bridge.cmd_live_quit(SimpleNamespace())
        run_mock.assert_not_called()


if __name__ == "__main__":
    unittest.main()
