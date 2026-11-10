from __future__ import annotations

import importlib.util
import json
import re
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("package_source", ROOT / "scripts" / "package-source.py")
assert SPEC and SPEC.loader
PACKAGE_SOURCE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACKAGE_SOURCE)


class SourceArchiveTests(unittest.TestCase):
    def test_source_archive_is_integrity_checked_and_excludes_binaries_and_nested_archives(self):
        with tempfile.TemporaryDirectory(prefix=".hs-tech-source-archive-test-", dir=ROOT / "public") as temporary:
            output = Path(temporary) / "source.zip"
            count, digest = PACKAGE_SOURCE.build_archive(output)
            self.assertGreater(count, 0)
            self.assertEqual(len(digest), 64)
            with ZipFile(output, "r") as archive:
                self.assertIsNone(archive.testzip())
                names = archive.namelist()
                disabled_helpers = (
                    "capcut-bridge-kit/install-plugin-win.bat",
                    "capcut-bridge-kit/bridge_system/setup.bat",
                    "capcut-bridge-kit/bridge_system/install.sh",
                )
                command = re.compile(r"^\s*(?:pip(?:3)?|python(?:3)?|winget|taskkill|setx)\b", re.IGNORECASE)
                for helper in disabled_helpers:
                    text = archive.read(helper).decode("utf-8")
                    self.assertIn("disabled", text.lower())
                    self.assertFalse(any(command.match(line) for line in text.splitlines()), helper)
                nested_package = json.loads(archive.read("capcut-bridge-kit/bridge_system/package.json"))
                self.assertTrue(nested_package["private"])
                self.assertNotIn("dependencies", nested_package)
                self.assertNotIn("devDependencies", nested_package)
                self.assertNotIn("scripts", nested_package)

        self.assertIn("capcut-bridge-kit/LICENSE", names)
        self.assertIn("capcut-bridge-kit/package-lock.json", names)
        self.assertIn("capcut-bridge-kit/docs/WINDOWS_INSTALLER_BUILD.md", names)
        self.assertIn("capcut-bridge-kit/scripts/verify-windows-release.ps1", names)
        self.assertFalse(any(name.lower().endswith((".exe", ".dll", ".pdb", ".pyc", ".pyo", ".zip")) for name in names))
        self.assertFalse(any("node_modules" in Path(name).parts for name in names))
        self.assertFalse(any("__pycache__" in Path(name).parts for name in names))
        self.assertFalse(any(Path(name).name.startswith(".env") and Path(name).name != ".env.example" for name in names))


if __name__ == "__main__":
    unittest.main()
