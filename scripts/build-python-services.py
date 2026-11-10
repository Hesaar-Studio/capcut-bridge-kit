#!/usr/bin/env python3
"""Bundle the Bridge MCP and Windows plugin into a PyInstaller runtime.

Run this only on 64-bit Windows with Python 3.11 and requirements-win-build.txt
installed. The resulting folder is consumed by electron-builder as an extra resource.
"""

from __future__ import annotations

import argparse
import importlib.util
import os
import shutil
import struct
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME_NAME = "HS.Tech Bridge Runtime"
PYTHON_SERVICES_ROOT = ROOT / "release" / "runtime" / "python-services"
RUNTIME_TARGET = PYTHON_SERVICES_ROOT / RUNTIME_NAME
ENTRY_POINT = ROOT / "bridge_system" / "runtime_entry.py"
PACKAGE_DIRS = ("bridge_system", "ai_contract", "draft_engine", "smart_editing")
ROOT_SCRIPTS = ("capcut-bridge-win.py", "capcut-plugin-win.py")
REQUIRED_PAYLOAD = (
    Path("bridge_system") / "bridge_server.py",
    Path("bridge_system") / "process_guard.py",
    Path("bridge_system") / "versioning.py",
    Path("ai_contract") / "dispatcher.py",
    Path("draft_engine") / "reader.py",
    Path("smart_editing") / "edit_planner.py",
    Path("capcut-bridge-win.py"),
    Path("capcut-plugin-win.py"),
)


def validate_sources() -> list[str]:
    required = [
        ENTRY_POINT,
        ROOT / "requirements-win-build.txt",
        *(ROOT / name for name in ROOT_SCRIPTS),
        *(ROOT / package for package in PACKAGE_DIRS),
    ]
    missing = [str(path.relative_to(ROOT)) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError("Missing Python runtime build inputs: " + ", ".join(missing))
    missing_payload = [str(path) for path in REQUIRED_PAYLOAD if not (ROOT / path).is_file()]
    if missing_payload:
        raise FileNotFoundError("Missing required runtime payload: " + ", ".join(missing_payload))
    return [str(path.relative_to(ROOT)) for path in required]


def add_data_arguments() -> list[str]:
    args: list[str] = []
    path_separator = os.pathsep  # semicolon on Windows, which is the supported build host
    for package_name in PACKAGE_DIRS:
        package_root = ROOT / package_name
        for source in sorted(package_root.rglob("*.py")):
            if "__pycache__" in source.parts:
                continue
            destination = source.relative_to(ROOT).parent.as_posix()
            args.extend(["--add-data", f"{source}{path_separator}{destination}"])
    for script_name in ROOT_SCRIPTS:
        source = ROOT / script_name
        args.extend(["--add-data", f"{source}{path_separator}."])
    return args


def build_runtime() -> Path:
    if sys.platform != "win32":
        raise RuntimeError("Windows Python runtime packaging must run on native Windows; cross-building from Linux/macOS is unsupported.")
    if sys.version_info < (3, 11):
        raise RuntimeError(f"Python 3.11 or newer is required; found {sys.version.split()[0]}.")
    if struct.calcsize("P") != 8:
        raise RuntimeError("A 64-bit Python interpreter is required for the x64 Windows installer.")
    if importlib.util.find_spec("PyInstaller") is None:
        raise RuntimeError("PyInstaller is missing. Run: python -m pip install -r requirements-win-build.txt")

    validate_sources()
    PYTHON_SERVICES_ROOT.mkdir(parents=True, exist_ok=True)

    # Build beside the destination so the final rename stays on the same volume.
    with tempfile.TemporaryDirectory(prefix=".hs-tech-runtime-stage-", dir=PYTHON_SERVICES_ROOT) as temp:
        stage = Path(temp)
        dist = stage / "dist"
        work = stage / "work"
        spec = stage / "spec"
        command = [
            sys.executable,
            "-m",
            "PyInstaller",
            "--noconfirm",
            "--onedir",
            "--console",  # MCP must retain stdin/stdout pipes.
            "--contents-directory",
            "_internal",
            "--name",
            RUNTIME_NAME,
            "--distpath",
            str(dist),
            "--workpath",
            str(work),
            "--specpath",
            str(spec),
            "--paths",
            str(ROOT),
            "--collect-all",
            "flask",
            "--collect-all",
            "pyautogui",
            "--collect-all",
            "PIL",
            "--hidden-import",
            "win32api",
            "--hidden-import",
            "win32con",
            "--hidden-import",
            "win32gui",
            *add_data_arguments(),
            str(ENTRY_POINT),
        ]
        print("Building the Windows x64 Bridge runtime with PyInstaller...")
        subprocess.run(command, cwd=ROOT, check=True)

        built_runtime = dist / RUNTIME_NAME
        executable = built_runtime / f"{RUNTIME_NAME}.exe"
        payload_root = built_runtime / "_internal"
        if not executable.is_file():
            raise FileNotFoundError(f"PyInstaller did not produce the expected runtime executable: {executable}")
        missing = [str(item) for item in REQUIRED_PAYLOAD if not (payload_root / item).is_file()]
        if missing:
            raise FileNotFoundError("The runtime bundle is missing required payload files: " + ", ".join(missing))

        backup: Path | None = None
        if RUNTIME_TARGET.exists():
            backup_root = ROOT / "release" / "backups"
            backup_root.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            backup = backup_root / f"{RUNTIME_NAME}-previous-{stamp}"
            suffix = 1
            while backup.exists():
                backup = backup_root / f"{RUNTIME_NAME}-previous-{stamp}-{suffix}"
                suffix += 1
            RUNTIME_TARGET.rename(backup)

        try:
            shutil.move(str(built_runtime), str(RUNTIME_TARGET))
        except Exception:
            if backup and backup.exists() and not RUNTIME_TARGET.exists():
                backup.rename(RUNTIME_TARGET)
            raise

    print(f"Python service runtime ready: {RUNTIME_TARGET.relative_to(ROOT)}")
    if backup:
        print(f"Previous runtime preserved at: {backup.relative_to(ROOT)}")
    return RUNTIME_TARGET


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--validate-only", action="store_true", help="Check source inputs without building or writing files")
    parser.add_argument("--replace-existing", action="store_true", help="Preserve an existing runtime under release/backups, then replace it")
    args = parser.parse_args()

    try:
        inputs = validate_sources()
        if args.validate_only:
            print(f"Python packaging inputs valid ({len(inputs)} required paths); no files written.")
            return 0
        if RUNTIME_TARGET.exists() and not args.replace_existing:
            raise FileExistsError(
                f"An existing runtime is present at {RUNTIME_TARGET}. Preserve it and rebuild with --replace-existing."
            )
        build_runtime()
        return 0
    except (OSError, RuntimeError, subprocess.CalledProcessError) as exc:
        print(f"[Windows runtime build] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
