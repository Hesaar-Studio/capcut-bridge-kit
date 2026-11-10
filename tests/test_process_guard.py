import io
import json
import subprocess
import unittest
from unittest.mock import patch

from bridge_system import process_guard
from bridge_system.process_guard import ProcessStateUnknown
import bridge_system.bridge_server as bridge_server


class ProcessGuardTests(unittest.TestCase):
    @staticmethod
    def completed(returncode=0, stdout="", stderr=""):
        return subprocess.CompletedProcess([], returncode, stdout=stdout, stderr=stderr)

    def test_windows_tasklist_detects_exact_capcut_process_row(self):
        result = self.completed(stdout='"CapCut.exe","5840","Console","1","123,456 K"\r\n')
        with patch.object(process_guard.subprocess, "run", return_value=result) as run:
            self.assertTrue(process_guard.capcut_process_running("win32"))
        args, kwargs = run.call_args
        self.assertEqual(args[0][0], "tasklist")
        self.assertIn("/FO", args[0])
        self.assertEqual(kwargs["timeout"], 5)

    def test_windows_tasklist_no_match_is_a_verified_closed_state(self):
        result = self.completed(stdout="INFO: No tasks are running which match the specified criteria.\r\n")
        with patch.object(process_guard.subprocess, "run", return_value=result):
            self.assertFalse(process_guard.capcut_process_running("win32"))

    def test_windows_tasklist_unrecognized_output_is_unknown(self):
        with patch.object(process_guard.subprocess, "run", return_value=self.completed(stdout="unexpected output")):
            with self.assertRaisesRegex(ProcessStateUnknown, "unrecognized response"):
                process_guard.capcut_process_running("win32")

    def test_windows_tasklist_nonzero_exit_is_unknown(self):
        with patch.object(process_guard.subprocess, "run", return_value=self.completed(returncode=1)):
            with self.assertRaisesRegex(ProcessStateUnknown, "exited with code 1"):
                process_guard.capcut_process_running("win32")

    def test_windows_tasklist_launch_failure_and_timeout_are_unknown(self):
        failures = (OSError("missing tasklist"), subprocess.TimeoutExpired("tasklist", 5))
        for failure in failures:
            with self.subTest(failure=type(failure).__name__):
                with patch.object(process_guard.subprocess, "run", side_effect=failure):
                    with self.assertRaisesRegex(ProcessStateUnknown, "tasklist could not be completed"):
                        process_guard.capcut_process_running("win32")

    def test_pgrep_distinguishes_process_no_match_and_errors(self):
        with patch.object(process_guard.subprocess, "run", return_value=self.completed(stdout="8765\n")):
            self.assertTrue(process_guard.capcut_process_running("darwin"))
        with patch.object(process_guard.subprocess, "run", return_value=self.completed(returncode=1)):
            self.assertFalse(process_guard.capcut_process_running("linux"))
        with patch.object(process_guard.subprocess, "run", return_value=self.completed(returncode=2)):
            with self.assertRaisesRegex(ProcessStateUnknown, "pgrep exited with code 2"):
                process_guard.capcut_process_running("darwin")
        with patch.object(process_guard.subprocess, "run", side_effect=OSError("pgrep unavailable")):
            with self.assertRaisesRegex(ProcessStateUnknown, "pgrep could not be completed"):
                process_guard.capcut_process_running("linux")

    def test_unsupported_platform_is_unknown(self):
        with self.assertRaisesRegex(ProcessStateUnknown, "unsupported operating system"):
            process_guard.capcut_process_running("plan9")

    def test_mcp_live_tool_does_not_call_cli_when_process_state_is_unknown(self):
        request = {
            "jsonrpc": "2.0",
            "id": 7,
            "method": "tools/call",
            "params": {"name": "capcut_live_split", "arguments": {}},
        }
        stdout = io.StringIO()
        stderr = io.StringIO()
        with patch.object(bridge_server, "_capcut_running", side_effect=ProcessStateUnknown("process probe unavailable")), \
             patch.object(bridge_server, "_run_bridge") as run_bridge, \
             patch("sys.stdin", io.StringIO(json.dumps(request) + "\n")), \
             patch("sys.stdout", stdout), \
             patch("sys.stderr", stderr):
            bridge_server.run_mcp_stdio()

        run_bridge.assert_not_called()
        response = json.loads(stdout.getvalue())
        self.assertTrue(response["result"]["isError"])
        self.assertIn("process probe unavailable", response["result"]["content"][0]["text"])


if __name__ == "__main__":
    unittest.main()
