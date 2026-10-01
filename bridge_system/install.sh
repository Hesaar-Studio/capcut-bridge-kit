#!/usr/bin/env bash
# HS.Tech Video Bridge - macOS & Linux Installer (Hesa Art Tech)
set -e

echo "====================================================================="
echo "   HS.Tech Video Bridge Setup (Hesa Art Tech v2.4.0)"
echo "   Multi-NLE Connector: CapCut, Premiere Pro, and DaVinci Resolve"
echo "====================================================================="

if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
else
    echo "[ERROR] Python 3 is required. Please install Python 3.10+."
    exit 1
fi

echo "[1/3] Python environment: $($PYTHON_CMD --version)"

# Check if uv exists
if command -v uv &>/dev/null; then
    echo "[2/3] Using ultra-fast package manager (uv)..."
    uv pip install --quiet fastapi uvicorn pydantic requests pillow 2>/dev/null || true
else
    echo "[2/3] Installing dependencies with pip..."
    $PYTHON_CMD -m pip install --quiet --upgrade pip
    $PYTHON_CMD -m pip install --quiet fastapi uvicorn pydantic requests pillow 2>/dev/null || true
fi

echo "[3/3] Starting HS.Tech sample HTTP service on port 8766..."
echo "Sample endpoint: http://127.0.0.1:8766"
echo "This service does not provide live NLE timeline synchronization."
echo "MCP stdio command: $PYTHON_CMD $(pwd)/bridge_server.py --mcp"

$PYTHON_CMD bridge_server.py --port 8766
