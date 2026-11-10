@echo off
chcp 65001 >nul
title HS.Tech Bridge - Legacy Helper Disabled

echo ======================================================================
echo  Legacy bridge_system/setup.bat is disabled.
echo  It installs packages into the Python environment and is not supported.
echo  No packages were installed and no service was started.
echo ======================================================================
echo.
echo For the current desktop app, use the repository-root README and build flow.
echo This is not the Windows Setup.exe.
echo.
pause
exit /b 1
