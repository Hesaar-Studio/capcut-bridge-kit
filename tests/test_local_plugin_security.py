import importlib.util
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("capcut_plugin_test", ROOT / "capcut-plugin-win.py")
PLUGIN = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PLUGIN)


class LocalPluginSecurityTests(unittest.TestCase):
    def setUp(self):
        self.client = PLUGIN.app.test_client()

    def test_allows_configured_local_ui_origin(self):
        response = self.client.get("/api/v1/status", headers={"Origin": "http://127.0.0.1:3000"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("Access-Control-Allow-Origin"), "http://127.0.0.1:3000")

    def test_rejects_untrusted_origin_before_live_action(self):
        response = self.client.post("/api/v1/split", headers={"Origin": "https://attacker.example"})
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("Access-Control-Allow-Origin", response.headers)

    def test_rejects_non_loopback_host(self):
        response = self.client.get("/api/v1/status", base_url="http://attacker.example:8765")
        self.assertEqual(response.status_code, 403)

    def test_does_not_send_split_hotkey_when_capcut_is_closed(self):
        fake_pyautogui = SimpleNamespace(hotkey=lambda *_args: self.fail("hotkey must not be sent"))
        with patch.object(PLUGIN, "is_capcut_running", return_value=False), patch.dict(sys.modules, {"pyautogui": fake_pyautogui}):
            response = self.client.post("/api/v1/split")
        self.assertEqual(response.status_code, 400)
        self.assertIn("not currently open", response.get_json()["error"])


if __name__ == "__main__":
    unittest.main()
