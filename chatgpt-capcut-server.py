# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "fastapi",
#     "uvicorn",
#     "pydantic",
# ]
# ///
"""
ChatGPT <-> CapCut Bridge Server
================================
Lightweight local REST server that allows ChatGPT (Custom GPT Action or local AI Agent)
to directly drive CapCut via CapCut Bridge Kit.

Usage:
  uv run chatgpt-capcut-server.py
  (Runs at http://localhost:8000, docs at http://localhost:8000/docs)
"""

from __future__ import annotations

import json
import os
import tempfile
import subprocess
import sys
from pathlib import Path
from typing import List, Optional
from urllib.parse import urlsplit
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from draft_engine.reader import safe_draft_name

app = FastAPI(
    title="CapCut Bridge ChatGPT API",
    description="Allows ChatGPT to automate CapCut video editing on macOS and Windows.",
    version="1.0.0",
)

SCRIPT_DIR = Path(__file__).resolve().parent
BRIDGE_SCRIPT = "capcut-bridge-win.py" if sys.platform == "win32" else "capcut-bridge.py"


def _is_loopback_host(host_header: str) -> bool:
    try:
        hostname = urlsplit(f"//{host_header}").hostname
        return hostname is not None and hostname.lower() in {"localhost", "127.0.0.1", "::1"}
    except ValueError:
        return False


@app.middleware("http")
async def local_origin_guard(request: Request, call_next):
    host_header = request.headers.get("host", "")
    if not _is_loopback_host(host_header):
        return JSONResponse(status_code=403, content={"error": "This local API accepts loopback hosts only."})
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin_header = request.headers.get("origin")
        if origin_header:
            try:
                origin = urlsplit(origin_header)
                if origin.scheme not in {"http", "https"} or origin.netloc.lower() != host_header.lower():
                    return JSONResponse(status_code=403, content={"error": "Cross-origin API requests are not allowed."})
            except ValueError:
                return JSONResponse(status_code=403, content={"error": "Invalid request origin."})
    return await call_next(request)


def _require_project_name(value: str) -> str:
    try:
        return safe_draft_name(value)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def run_bridge_command(args: list[str]) -> dict:
    """Execute the fixed local CLI without a shell; exit code alone is not NLE verification."""
    script_path = SCRIPT_DIR / BRIDGE_SCRIPT
    uv_command = ["uv", "run", str(script_path), *args]
    try:
        res = subprocess.run(uv_command, capture_output=True, text=True, timeout=300)
    except FileNotFoundError:
        # Compatibility fallback if uv is not installed. Still invoke only this fixed script.
        direct_command = [sys.executable, str(script_path), *args]
        try:
            res = subprocess.run(direct_command, capture_output=True, text=True, timeout=300)
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise HTTPException(status_code=500, detail={"error": "Bridge command could not be started or timed out."}) from exc
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail={"error": "Bridge command timed out."}) from exc

    if res.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Bridge command exited unsuccessfully.",
                "stderr": (res.stderr or "")[-4000:],
                "stdout": (res.stdout or "")[-4000:],
            },
        )
    return {
        "status": "command_completed_unverified",
        "verified": False,
        "verification_scope": "cli_exit_only",
        "stdout": (res.stdout or "").strip(),
    }


# Request Models
class ReplayCut(BaseModel):
    source_path: str = Field(..., min_length=1, max_length=2048, description="Local video file path")
    start: float = Field(0.0, ge=0, allow_inf_nan=False, description="Start in seconds")
    duration: float = Field(3.0, gt=0, allow_inf_nan=False, description="Cut duration in seconds")

class ReplayRequest(BaseModel):
    draft_name: str = Field(..., min_length=1, max_length=80, description="Target CapCut draft project name")
    cuts: List[ReplayCut] = Field(..., min_length=1, max_length=500, description="List of video cuts")

class AddTextRequest(BaseModel):
    draft_name: str = Field(..., min_length=1, max_length=80)
    text: str = Field(..., min_length=1, max_length=2000, description="Caption or hook text")
    at: float = Field(..., ge=0, allow_inf_nan=False, description="Timeline position in seconds")
    duration: float = Field(3.0, gt=0, le=3600, allow_inf_nan=False, description="Duration in seconds")

class AddOverlayRequest(BaseModel):
    draft_name: str = Field(..., min_length=1, max_length=80)
    media_path: str = Field(..., min_length=1, max_length=2048, description="Path to overlay media")
    at: float = Field(..., ge=0, allow_inf_nan=False, description="Timeline position in seconds")
    duration: float = Field(3.0, gt=0, le=3600, allow_inf_nan=False, description="Duration in seconds")
    mute: bool = Field(True, description="Whether to mute overlay audio")

class SeekRequest(BaseModel):
    seconds: float = Field(..., ge=0, allow_inf_nan=False, description="Unsupported target timestamp")

class SplitRequest(BaseModel):
    seconds: Optional[float] = Field(None, ge=0, allow_inf_nan=False, description="Timestamped split is unsupported")

class ExportRequest(BaseModel):
    output_dir: Optional[str] = Field(None, max_length=2048, description="Unsupported: choose a destination in CapCut")
    timeout: float = Field(90.0, gt=0, le=3600, allow_inf_nan=False, description="Not an export-progress guarantee")


# Endpoints for ChatGPT
@app.get("/")
def root():
    return {
        "service_status": "running",
        "service": "CapCut Bridge ChatGPT API",
        "platform": sys.platform,
        "bridge_script": BRIDGE_SCRIPT,
        "editor_status": "not_checked",
    }


@app.get("/drafts")
def list_drafts():
    """List all recognized drafts in CapCut projects folder."""
    return run_bridge_command(["ls"])


@app.post("/draft/replay")
def replay_project(req: ReplayRequest):
    """Creates a new draft only; existing projects are never overwritten over REST."""
    draft_name = _require_project_name(req.draft_name)
    projects_dir = (
        Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"
        if sys.platform == "win32" else Path.home() / "Movies" / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"
    )
    if (projects_dir / draft_name).exists() or (projects_dir / draft_name).is_symlink():
        raise HTTPException(status_code=409, detail="Draft already exists; refusing to overwrite it")
    normalized_cuts = []
    for cut in req.cuts:
        media_path = Path(cut.source_path).expanduser().resolve()
        if not media_path.is_file():
            raise HTTPException(status_code=422, detail=f"Local media file not found: {media_path.name}")
        normalized_cuts.append({"source_path": str(media_path), "start": cut.start, "duration": cut.duration})
    fd, temp_path = tempfile.mkstemp(prefix="capcut-cuts-", suffix=".json")
    os.close(fd)
    temp_cuts_file = Path(temp_path)
    data = {
        "draft_name": draft_name,
        "resolution": {"width": 1080, "height": 1920, "ratio": "9:16"},
        "fps": 30.0,
        "cuts": normalized_cuts,
    }
    with open(temp_cuts_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    try:
        return run_bridge_command(["replay", str(temp_cuts_file), "--name", draft_name])
    finally:
        temp_cuts_file.unlink(missing_ok=True)


@app.post("/draft/add_text")
def add_text_caption(req: AddTextRequest):
    """Update draft JSON with text; CapCut acceptance is not verified."""
    draft_name = _require_project_name(req.draft_name)
    if not req.text.strip():
        raise HTTPException(status_code=422, detail="Text must not be blank.")
    return run_bridge_command([
        "add-text", draft_name, req.text.strip(),
        "--at", str(req.at),
        "--dur", str(req.duration),
    ])


@app.post("/draft/add_overlay")
def add_video_overlay(req: AddOverlayRequest):
    """Update draft JSON with an overlay reference; CapCut acceptance is not verified."""
    draft_name = _require_project_name(req.draft_name)
    media_path = Path(req.media_path).expanduser().resolve()
    if not media_path.is_file():
        raise HTTPException(status_code=422, detail=f"Local overlay file not found: {media_path.name}")
    args = [
        "add-overlay", draft_name, str(media_path),
        "--at", str(req.at),
        "--dur", str(req.duration),
    ]
    if req.mute:
        args.append("--mute")
    return run_bridge_command(args)


@app.post("/live/seek")
def seek_playhead(req: SeekRequest):
    """Seeking is not implemented; no keyboard event is sent."""
    raise HTTPException(status_code=501, detail="Live seek is not implemented; no action was performed.")


@app.post("/live/split")
def split_cut(req: SplitRequest):
    """A current-playhead shortcut can be sent; timestamped split is unsupported."""
    if req.seconds is not None:
        raise HTTPException(status_code=501, detail="Timed split is unsupported; no action was performed.")
    return run_bridge_command(["split"])


@app.post("/live/export")
def trigger_export(req: ExportRequest):
    """Send guarded keyboard events; render completion and output are not verified."""
    if req.output_dir:
        raise HTTPException(status_code=501, detail="Custom export destinations are unsupported; no action was performed.")
    return run_bridge_command(["export"])


if __name__ == "__main__":
    import uvicorn
    print("\n[CapCut Bridge] Starting ChatGPT Bridge server on http://localhost:8000")
    print("[CapCut Bridge] Interactive OpenAPI docs available at http://localhost:8000/docs\n")
    uvicorn.run(app, host="127.0.0.1", port=8000)
