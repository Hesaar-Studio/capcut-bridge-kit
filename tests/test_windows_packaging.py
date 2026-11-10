from __future__ import annotations

import subprocess
import sys
import unittest
from pathlib import Path

from bridge_system.runtime_entry import _resource_root

ROOT = Path(__file__).resolve().parents[1]


class WindowsPackagingPreflightTests(unittest.TestCase):
    def test_runtime_entry_resolves_source_checkout_root(self):
        self.assertEqual(_resource_root(), ROOT)

    def test_python_runtime_builder_has_a_read_only_preflight(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "build-python-services.py"), "--validate-only"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
        self.assertIn("no files written", result.stdout)


if __name__ == "__main__":
    unittest.main()
