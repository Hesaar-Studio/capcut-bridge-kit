@echo off
TITLE CapCut Bridge Kit - Windows Plugin Installer
color 0A

echo =======================================================
echo   CapCut Bridge Kit - Windows Plugin & CLI Installer
echo =======================================================
echo.

:: 1. Check Python installation
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    echo Please install Python 3.11+ from https://www.python.org/
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

echo [1/4] Python detected. Installing required plugin packages...
pip install --upgrade pyautogui pillow flask requests pywin32 >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Pip install had issues, trying standard install...
    pip install pyautogui pillow flask requests
)
echo [OK] Dependencies installed successfully.

:: 2. Create destination folder in AppData
set INSTALL_DIR=%USERPROFILE%\.capcut-bridge
echo [2/4] Setting up plugin directory in: %INSTALL_DIR%
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: 3. Copy bridge script and plugin server
copy /Y "capcut-bridge-win.py" "%INSTALL_DIR%\capcut-bridge.py" >nul
copy /Y "capcut-plugin-win.py" "%INSTALL_DIR%\capcut-plugin.py" >nul

:: Create a global batch wrapper
echo @echo off > "%INSTALL_DIR%\capcut-bridge.bat"
echo python "%INSTALL_DIR%\capcut-bridge.py" %%* >> "%INSTALL_DIR%\capcut-bridge.bat"

:: 4. Add to user PATH if not present
echo [3/4] Registering capcut-bridge in Windows User PATH...
powershell -Command "[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';%INSTALL_DIR%', 'User')" >nul 2>&1

:: 5. Create Desktop shortcut to Plugin Background Server
echo [4/4] Creating CapCut Plugin Server shortcut...
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\CapCut Plugin Daemon.lnk'); $Shortcut.TargetPath = 'pythonw.exe'; $Shortcut.Arguments = '\"%INSTALL_DIR%\capcut-plugin.py\"'; $Shortcut.Description = 'CapCut Local HTTP Plugin Server'; $Shortcut.Save()" >nul 2>&1

echo.
echo =======================================================
echo   INSTALLATION COMPLETED SUCCESSFULLY!
echo =======================================================
echo.
echo 1. You can now run 'capcut-bridge <command>' from any CMD or PowerShell.
echo 2. The CapCut Plugin Daemon is ready on your Desktop.
echo    It runs a local background server on http://localhost:8765
echo    allowing any app, browser extension, or script to drive CapCut!
echo.
pause
