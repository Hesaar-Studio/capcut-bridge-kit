@echo off
chcp 65001 >nul
title HS.Tech Video Bridge - Setup ^& Installer (Hesa Art Tech)

echo =====================================================================
echo    HS.Tech Video Bridge Installer (Hesa Art Tech v2.4.0)
echo    NLE Connector for CapCut, Adobe Premiere Pro, and DaVinci Resolve
echo =====================================================================
echo.

:: 1. Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python 3 was not detected in PATH.
    echo Please install Python 3.10+ from https://www.python.org and ensure "Add Python to PATH" is checked.
    pause
    exit /b 1
)

echo [1/4] Checking Python environment... OK
echo.

:: 2. Install requirements
echo [2/4] Installing necessary Python bridge libraries...
pip install --quiet --upgrade pip
pip install --quiet fastapi uvicorn pydantic requests pillow pyautogui pywin32
if %errorlevel% neq 0 (
    echo [WARNING] Could not install all optional packages. Standard library fallback will be used.
) else (
    echo [2/4] Bridge dependencies installed successfully.
)
echo.

:: 3. Setup MCP configuration path info
echo [3/4] Locating AI coding assistant configurations...
set CLAUDE_CONFIG=%APPDATA%\Claude\claude_desktop_config.json
if exist "%APPDATA%\Claude" (
    echo Claude Desktop directory found at %APPDATA%\Claude
    echo You can register HS.Tech Bridge by merging claude_desktop_config.json
) else (
    echo Claude Desktop directory not yet created.
)
echo.

:: 4. Start Bridge Daemon
echo [4/4] Starting HS.Tech sample HTTP service on port 8766...
echo =====================================================================
echo Sample HTTP service is running at: http://127.0.0.1:8766
echo It does not provide live NLE timeline synchronization.
echo Press Ctrl+C in this window anytime to terminate the server.
echo =====================================================================
echo.

python bridge_server.py --port 8766
pause
