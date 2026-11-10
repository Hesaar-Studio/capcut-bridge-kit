#!/usr/bin/env python3
"""Create the current source-only ZIP served by the dashboard.

This archive is not a Windows installer. It excludes generated files, caches,
credentials, nested ZIPs and executable binaries.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "public" / "hs-art-tech-bridge.zip"
EXCLUDED_DIRS = {
    ".git", "node_modules", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
    ".cache", ".local", ".venv", "venv", "build", "dist", "release", "target", "coverage",
    ".next", ".nuxt", ".output", ".parcel-cache", ".svelte-kit", ".tox", ".turbo", ".vite",
    "%BUILD_VENV%", "hs-tech-ai-video-bridge",
}
EXCLUDED_FILES = {
    ".env", ".env.local", ".env.development.local", ".env.production.local",
    ".npmrc", ".netrc", ".git-credentials",
}
EXCLUDED_SUFFIXES = {
    ".pyc", ".pyo", ".exe", ".dll", ".pdb", ".log", ".pem", ".p12", ".pfx", ".key",
}
REQUIRED_FILES = {
    "LICENSE",
    "README.md",
    "package.json",
    "package-lock.json",
    "requirements-win-build.txt",
    "scripts/build-win.mjs",
    "scripts/build-python-services.py",
    "assets/hs-tech-bridge.ico",
    ".github/workflows/windows-installer.yml",
    "install-plugin-win.bat",
    "bridge_system/README.md",
    "bridge_system/setup.bat",
    "bridge_system/install.sh",
    "bridge_system/package.json",
    "scripts/package-source.py",
    "scripts/verify-windows-release.ps1",
    "tests/test_source_archive.py",
}


def should_include(path: Path, output: Path) -> bool:
    if path.is_symlink() or not path.is_file():
        return False
    if path.resolve() == output.resolve():
        return False
    if path.parent.resolve() == output.parent.resolve() and path.name.startswith(f".{output.name}."):
        return False
    relative = path.relative_to(ROOT)
    if any(part in EXCLUDED_DIRS for part in relative.parts):
        return False
    if path.name in EXCLUDED_FILES or path.suffix.lower() in EXCLUDED_SUFFIXES:
        return False
    if path.suffix.lower() == ".zip":
        return False
    if path.name.startswith(".env.") and path.name != ".env.example":
        return False
    return True


def build_archive(output: Path) -> tuple[int, str]:
    output.parent.mkdir(parents=True, exist_ok=True)
    # Fast pruned traversal
    sources: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS]
        for f in filenames:
            p = Path(dirpath) / f
            if should_include(p, output):
                sources.append(p)
    sources.sort()
    with tempfile.NamedTemporaryFile(prefix=f".{output.name}.", suffix=".tmp", dir=output.parent, delete=False) as temporary:
        temporary_path = Path(temporary.name)

    try:
        entries: list[str] = []
        with ZipFile(temporary_path, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
            for source in sources:
                relative = source.relative_to(ROOT)
                archive_name = (Path(ROOT.name) / relative).as_posix()
                archive.write(source, archive_name)
                entries.append(archive_name)

        with ZipFile(temporary_path, "r") as archive:
            bad_entry = archive.testzip()
            if bad_entry:
                raise RuntimeError(f"ZIP integrity check failed at {bad_entry}")
            names = set(archive.namelist())
            missing = {f"{ROOT.name}/{name}" for name in REQUIRED_FILES} - names
            if missing:
                raise RuntimeError("Source archive is missing required inputs: " + ", ".join(sorted(missing)))
            if any(name.lower().endswith((".exe", ".dll", ".pdb", ".pyc", ".pyo")) for name in names):
                raise RuntimeError("Source archive unexpectedly contains executable or cache files.")
            if any(name.lower().endswith(".zip") for name in names):
                raise RuntimeError("Source archive must not contain nested ZIP files.")
            if any(part in EXCLUDED_DIRS for name in names for part in Path(name).parts):
                raise RuntimeError("Source archive unexpectedly contains a generated/cache directory.")
            if any(Path(name).name.startswith(".env") and Path(name).name != ".env.example" for name in names):
                raise RuntimeError("Source archive unexpectedly contains an environment/secret file.")

        os.replace(temporary_path, output)
    except Exception:
        try:
            temporary_path.unlink()
        except FileNotFoundError:
            pass
        raise

    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    return len(entries), digest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Output source ZIP (default: public/hs-art-tech-bridge.zip)")
    args = parser.parse_args()
    output = args.output if args.output.is_absolute() else ROOT / args.output
    count, digest = build_archive(output)
    print(f"Source-only archive created: {output}")
    print(f"Entries: {count}")
    print(f"Size: {output.stat().st_size:,} bytes")
    print(f"SHA-256: {digest}")
    print("ZIP integrity passed; installer executable is not included.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
