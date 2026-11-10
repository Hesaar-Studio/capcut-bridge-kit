@echo off
setlocal
cd /d "%~dp0"
title CapCut Bridge Kit - Developer Setup Helper
color 0A

echo ================================================
echo   CapCut Bridge Kit - Developer Setup Helper
echo   This is not the packaged Windows Setup.exe
echo ================================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python 3.11+ is required and was not found in PATH.
  pause
  exit /b 1
)
python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)"
if errorlevel 1 (
  echo [ERROR] Python 3.11 or newer is required.
  pause
  exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
  echo [INFO] Node.js was not found. Attempting installation with winget...
  winget install --id OpenJS.NodeJS.LTS --exact --accept-source-agreements --accept-package-agreements
  if errorlevel 1 (
    echo [ERROR] Node.js installation failed. Install Node.js LTS, reopen this file, and retry.
    pause
    exit /b 1
  )
  echo [INFO] Node.js installed. Close and reopen this installer so PATH refreshes.
  pause
  exit /b 0
)
node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1)"
if errorlevel 1 (
  echo [ERROR] Node.js 22.12 or newer is required. Install the current LTS release and retry.
  pause
  exit /b 1
)

npm --version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found in PATH.
  pause
  exit /b 1
)

echo [1/3] Installing Python Bridge dependencies...
python -m pip install --upgrade pyautogui pillow flask requests pywin32
if errorlevel 1 goto :fail

echo [2/3] Installing web panel dependencies...
npm ci
if errorlevel 1 goto :fail

echo [3/3] Developer dependencies installed.
echo.
echo Start the panel with: npm run dev
echo Start MCP directly with: python bridge_system\bridge_server.py --mcp
echo Build the native Windows Setup.exe with: npm run build:win
echo (Run the build from a Windows x64 terminal after installing requirements-win-build.txt.)
echo.
choice /M "Start the web panel now"
if errorlevel 2 goto :done
call npm run dev
:done
pause
exit /b 0

:fail
echo.
echo [ERROR] Installation failed. Review the message above and retry.
pause
exit /b 1
