@echo off
setlocal
TITLE CapCut Bridge Kit - Legacy Setup Disabled
color 0E

echo =============================================================
echo   Legacy install-plugin-win.bat is disabled
echo =============================================================
echo.
echo This legacy helper is not the packaged Windows installer.
echo It previously changed the user PATH and created a persistent
echo   plugin-daemon shortcut. It no longer performs those actions.
echo.
echo The Windows Setup.exe has not been built in this source package.
echo For the current, non-elevated build steps, see:
echo   docs\WINDOWS_INSTALLER_BUILD.md
echo.
echo No files, PATH values, services, or CapCut processes were changed.
echo.
pause
exit /b 1
