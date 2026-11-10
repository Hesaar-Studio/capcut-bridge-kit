"""Fail-closed CapCut process detection shared by CLI, REST, and MCP paths."""

from __future__ import annotations

import csv
import io
import subprocess
import sys


class ProcessStateUnknown(RuntimeError):
    """Raised when the host cannot reliably determine whether CapCut is running."""


def _unknown(platform: str, reason: str) -> ProcessStateUnknown:
    return ProcessStateUnknown(
        f"Unable to determine whether CapCut is running on {platform} ({reason}); "
        "refusing file or live-editor operations."
    )


def capcut_process_running(platform: str | None = None) -> bool:
    """Return a verified process state, or raise instead of treating errors as closed.

    On Windows, ``tasklist`` is constrained to CapCut.exe and CSV output is parsed
    rather than searched as a substring. On macOS/Linux, ``pgrep`` exit code 1 is
    the documented no-match result; launch, timeout, and other exit failures are
    indeterminate and therefore fail closed.
    """
    platform = platform or sys.platform

    if platform == "win32":
        command = [
            "tasklist",
            "/FI",
            "IMAGENAME eq CapCut.exe",
            "/FO",
            "CSV",
            "/NH",
        ]
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                errors="replace",
                timeout=5,
                check=False,
            )
        except (OSError, subprocess.SubprocessError, ValueError) as exc:
            raise _unknown(platform, "tasklist could not be completed") from exc

        if result.returncode != 0:
            raise _unknown(platform, f"tasklist exited with code {result.returncode}")

        output = result.stdout or ""
        try:
            rows = list(csv.reader(io.StringIO(output)))
        except csv.Error as exc:
            raise _unknown(platform, "tasklist returned malformed CSV") from exc

        for row in rows:
            if not row:
                continue
            image_name = row[0].strip().casefold()
            if image_name == "capcut.exe":
                if len(row) > 1 and row[1].strip().isdigit():
                    return True
                raise _unknown(platform, "tasklist returned an incomplete CapCut process row")

        if any(
            row
            and (
                row[0].strip().casefold().startswith("info:")
                or "no tasks are running" in row[0].strip().casefold()
            )
            for row in rows
        ):
            return False

        raise _unknown(platform, "tasklist returned an unrecognized response")

    if platform in {"darwin", "linux", "linux2"}:
        try:
            result = subprocess.run(
                ["pgrep", "-x", "CapCut"],
                capture_output=True,
                text=True,
                errors="replace",
                timeout=5,
                check=False,
            )
        except (OSError, subprocess.SubprocessError, ValueError) as exc:
            raise _unknown(platform, "pgrep could not be completed") from exc

        if result.returncode == 1:
            return False
        if result.returncode != 0:
            raise _unknown(platform, f"pgrep exited with code {result.returncode}")
        if any(line.strip().isdigit() for line in (result.stdout or "").splitlines()):
            return True
        raise _unknown(platform, "pgrep returned no process identifier")

    raise _unknown(platform, "unsupported operating system")
