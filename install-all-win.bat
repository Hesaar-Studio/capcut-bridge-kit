@echo off
setlocal
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
  echo [ERROR] Node.js 18+ is required and was not found in PATH.
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
npm install
if errorlevel 1 goto :fail

echo [3/3] Installation complete.
echo.
echo Start the panel with: npm run dev
echo Start MCP directly with: python bridge_system\bridge_server.py --mcp
echo.
pause
exit /b 0

:fail
echo.
echo [ERROR] Installation failed. Review the message above and retry.
pause
exit /b 1
