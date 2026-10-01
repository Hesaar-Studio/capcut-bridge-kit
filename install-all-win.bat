@echo off
setlocal
cd /d "%~dp0"
title CapCut Bridge Kit - Full Windows Installer
color 0A

echo ================================================
echo   CapCut Bridge Kit - Full Windows Installer
echo ================================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python 3.11+ is required and was not found in PATH.
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
npm install
if errorlevel 1 goto :fail

echo [3/3] Installation complete.
echo.
echo Start the panel with: npm run dev
echo Start MCP directly with: python bridge_system\bridge_server.py --mcp
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
