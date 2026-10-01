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
import re
import tempfile
import subprocess
import sys
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(
    title="CapCut Bridge ChatGPT API",
    description="Allows ChatGPT to automate CapCut video editing on macOS and Windows.",
    version="1.0.0",
)

SCRIPT_DIR = Path(__file__).resolve().parent
BRIDGE_SCRIPT = "capcut-bridge-win.py" if sys.platform == "win32" else "capcut-bridge.py"


def run_bridge_command(args: list[str]) -> dict:
    """Executes capcut-bridge CLI and returns stdout."""
    script_path = SCRIPT_DIR / BRIDGE_SCRIPT
    cmd = ["uv", "run", str(script_path)] + args
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return {"status": "success", "stdout": res.stdout.strip(), "command": " ".join(cmd)}
    except subprocess.CalledProcessError as e:
        raise HTTPException(
            status_code=500,
            detail={"error": str(e), "stderr": e.stderr, "stdout": e.stdout},
        )
    except FileNotFoundError:
        # Fallback if uv is not in path, try direct python
        cmd = [sys.executable, str(script_path)] + args
        res = subprocess.run(cmd, capture_output=True, text=True)
        return {"status": "success", "stdout": res.stdout.strip(), "command": " ".join(cmd)}


# Request Models
class ReplayCut(BaseModel):
    source_path: str = Field(..., description="Path to video file under ~/Movies")
    start: float = Field(0.0, description="Start in seconds")
    duration: float = Field(3.0, description="Cut duration in seconds")

class ReplayRequest(BaseModel):
    draft_name: str = Field(..., min_length=1, max_length=80, description="Target CapCut draft project name")
    cuts: List[ReplayCut] = Field(..., description="List of video cuts")

class AddTextRequest(BaseModel):
    draft_name: str
    text: str = Field(..., description="Caption or hook text")
    at: float = Field(..., description="Timeline position in seconds")
    duration: float = Field(3.0, description="Duration in seconds")

class AddOverlayRequest(BaseModel):
    draft_name: str
    media_path: str = Field(..., description="Path to overlay media")
    at: float = Field(..., description="Timeline position in seconds")
    duration: float = Field(3.0, description="Duration in seconds")
    mute: bool = Field(True, description="Whether to mute overlay audio")

class SeekRequest(BaseModel):
    seconds: float = Field(..., description="Target timestamp in seconds")

class SplitRequest(BaseModel):
    seconds: Optional[float] = Field(None, description="Optional cut timestamp")

class ExportRequest(BaseModel):
    output_dir: Optional[str] = Field(None, description="Destination folder")
    timeout: float = Field(90.0, description="Max export wait time")


# Endpoints for ChatGPT
@app.get("/")
def root():
    return {
        "status": "online",
        "service": "CapCut Bridge ChatGPT API",
        "platform": sys.platform,
        "bridge_script": BRIDGE_SCRIPT,
    }


@app.get("/drafts")
def list_drafts():
    """List all recognized drafts in CapCut projects folder."""
    return run_bridge_command(["ls"])


@app.post("/draft/replay")
def replay_project(req: ReplayRequest):
    """Creates a new draft only; existing projects are never overwritten over REST."""
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9 _.-]{0,79}", req.draft_name) or req.draft_name in {".", ".."}:
        raise HTTPException(status_code=422, detail="draft_name must be a simple folder name")
    projects_dir = (
        Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"
        if sys.platform == "win32" else Path.home() / "Movies" / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"
    )
    if (projects_dir / req.draft_name).exists():
        raise HTTPException(status_code=409, detail="Draft already exists; refusing to overwrite it")
    fd, temp_path = tempfile.mkstemp(prefix="capcut-cuts-", suffix=".json")
    os.close(fd)
    temp_cuts_file = Path(temp_path)
    data = {
        "draft_name": req.draft_name,
        "resolution": {"width": 1080, "height": 1920, "ratio": "9:16"},
        "fps": 30.0,
        "cuts": [c.model_dump() for c in req.cuts],
    }
    with open(temp_cuts_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    try:
        return run_bridge_command(["replay", str(temp_cuts_file), "--name", req.draft_name])
    finally:
        temp_cuts_file.unlink(missing_ok=True)


@app.post("/draft/add_text")
def add_text_caption(req: AddTextRequest):
    """Adds a styled text subtitle or hook card."""
    return run_bridge_command([
        "add-text", req.draft_name, req.text,
        "--at", str(req.at),
        "--dur", str(req.duration),
    ])


@app.post("/draft/add_overlay")
def add_video_overlay(req: AddOverlayRequest):
    """Inserts a B-roll or picture-in-picture overlay."""
    args = [
        "add-overlay", req.draft_name, req.media_path,
        "--at", str(req.at),
        "--dur", str(req.duration),
    ]
    if req.mute:
        args.append("--mute")
    return run_bridge_command(args)


@app.post("/live/seek")
def seek_playhead(req: SeekRequest):
    """Frame-exact playhead positioning in active editor."""
    return run_bridge_command(["seek", str(req.seconds)])


@app.post("/live/split")
def split_cut(req: SplitRequest):
    """Splits clip at playhead or specified timestamp."""
    args = ["split"]
    if req.seconds is not None:
        args.append(str(req.seconds))
    return run_bridge_command(args)


@app.post("/live/export")
def trigger_export(req: ExportRequest):
    """Drives export dialog, encodes video, and clears post-export modal."""
    args = ["export", "--timeout", str(req.timeout)]
    if req.output_dir:
        args.extend(["--to", req.output_dir])
    return run_bridge_command(args)


if __name__ == "__main__":
    import uvicorn
    print("\n[CapCut Bridge] Starting ChatGPT Bridge server on http://localhost:8000")
    print("[CapCut Bridge] Interactive OpenAPI docs available at http://localhost:8000/docs\n")
    uvicorn.run(app, host="127.0.0.1", port=8000)
