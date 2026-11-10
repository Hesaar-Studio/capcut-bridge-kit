"""Entry point for the bundled Python runtime used by Electron and MCP hosts."""

from __future__ import annotations

import argparse
import runpy
import sys
from pathlib import Path


_REQUIRED_RUNTIME_FILES = (
    Path("bridge_system") / "bridge_server.py",
    Path("capcut-plugin-win.py"),
    Path("capcut-bridge-win.py"),
)


def _resource_root() -> Path:
    """Resolve the source root both in a PyInstaller bundle and in a source checkout."""
    candidates: list[Path] = []
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        candidates.append(Path(meipass))
    candidates.append(Path(sys.executable).resolve().parent)
    candidates.append(Path(__file__).resolve().parents[1])

    seen: set[str] = set()
    for candidate in candidates:
        try:
            root = candidate.resolve()
            key = str(root).casefold()
            if key in seen:
                continue
            seen.add(key)
            if all((root / relative).is_file() for relative in _REQUIRED_RUNTIME_FILES):
                return root
        except OSError:
            continue

    attempted = ", ".join(str(item) for item in candidates) or "no runtime paths"
    raise FileNotFoundError(f"Could not locate bundled Bridge scripts (checked: {attempted}).")


def _run_script(script: Path, argv: list[str], resource_root: Path) -> None:
    if not script.is_file():
        raise FileNotFoundError(f"Bundled service script is missing: {script.name}")
    root_text = str(resource_root)
    if root_text not in sys.path:
        sys.path.insert(0, root_text)
    sys.argv = [str(script), *argv]
    runpy.run_path(str(script), run_name="__main__")


def main() -> int:
    parser = argparse.ArgumentParser(prog="HS.Tech Bridge Runtime")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--plugin", action="store_true", help="Run the local Windows plugin REST daemon")
    mode.add_argument("--mcp", action="store_true", help="Run the MCP stdio server")
    args = parser.parse_args()
    root = _resource_root()

    if args.plugin:
        if sys.platform != "win32":
            raise RuntimeError("The local CapCut plugin runtime is supported only on Windows.")
        _run_script(root / "capcut-plugin-win.py", [], root)
    else:
        _run_script(root / "bridge_system" / "bridge_server.py", ["--mcp"], root)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        sys.stderr.write(f"[HS.Tech Runtime] {exc}\n")
        sys.stderr.flush()
        raise
