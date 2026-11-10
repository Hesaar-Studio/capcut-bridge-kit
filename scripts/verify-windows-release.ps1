#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root
if ($env:OS -ne 'Windows_NT') {
    [Console]::Error.WriteLine('Run this script on Windows x64; it makes no changes on other platforms.')
    exit 1
}
$WindowsArchitecture = $env:PROCESSOR_ARCHITEW6432
if ([string]::IsNullOrWhiteSpace($WindowsArchitecture)) { $WindowsArchitecture = $env:PROCESSOR_ARCHITECTURE }
if ($WindowsArchitecture -ne 'AMD64' -and $WindowsArchitecture -ne 'x64') {
    [Console]::Error.WriteLine("Windows x64 is required; found architecture '$WindowsArchitecture'.")
    exit 1
}

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$ValidationDir = Join-Path $Root 'release/validation'
New-Item -ItemType Directory -Path $ValidationDir -Force -ErrorAction Stop | Out-Null
$LogPath = Join-Path $ValidationDir "windows-release-$Stamp.log"
$VenvPath = Join-Path $env:TEMP "hs-tech-bridge-build-$Stamp-$PID"
$TranscriptStarted = $false
$FailureCode = 0

function Invoke-Native {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    Write-Host "`n>>> $Executable $($Arguments -join ' ')"
    & $Executable @Arguments
    $CommandExitCode = $LASTEXITCODE
    if ($null -eq $CommandExitCode -or $CommandExitCode -ne 0) {
        throw "Command failed with exit code ${CommandExitCode}: $Executable $($Arguments -join ' ')"
    }
}

try {
    Start-Transcript -Path $LogPath -Force -ErrorAction Stop | Out-Null
    $TranscriptStarted = $true
    Write-Host "HS.Tech Windows x64 release build; log: $LogPath"

    $NodeCommand = (Get-Command node.exe -ErrorAction Stop).Source
    $NpmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
    $PythonCommand = (Get-Command python.exe -ErrorAction Stop).Source

    $NodeVersionText = (& $NodeCommand --version).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Could not query Node.js version.' }
    $NodeVersion = [Version]($NodeVersionText -replace '^v', '')
    if ($NodeVersion -lt [Version]'22.12.0') {
        throw "Node.js 22.12 or newer is required; found $NodeVersionText."
    }
    $NodeArch = (& $NodeCommand -p 'process.arch').Trim()
    if ($LASTEXITCODE -ne 0 -or $NodeArch -ne 'x64') {
        throw "A 64-bit Node.js runtime is required; found architecture '$NodeArch'."
    }

    $NpmVersionText = (& $NpmCommand --version).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Could not query npm version.' }
    $NpmVersion = [Version]$NpmVersionText
    if ($NpmVersion -lt [Version]'10.0.0') {
        throw "npm 10 or newer is required; found $NpmVersionText."
    }

    & $PythonCommand -c 'import sys,struct; print(sys.version.split()[0], "64-bit" if struct.calcsize("P") == 8 else "32-bit"); raise SystemExit(0 if sys.version_info >= (3,11) and struct.calcsize("P") == 8 else 1)'
    if ($LASTEXITCODE -ne 0) {
        throw 'Python 3.11 or newer, 64-bit, is required.'
    }

    Write-Host "Node: $NodeVersionText ($NodeArch); npm: $NpmVersionText"
    Write-Host 'Python build dependencies will be installed in a temporary venv, not globally.'

    Invoke-Native -Executable $PythonCommand -Arguments @('-m', 'venv', $VenvPath)
    $VenvScripts = Join-Path $VenvPath 'Scripts'
    $VenvPython = Join-Path $VenvScripts 'python.exe'
    if (-not (Test-Path -LiteralPath $VenvPython -PathType Leaf)) {
        throw "Temporary Python venv was not created: $VenvPython"
    }
    $env:PATH = "$VenvScripts;$env:PATH"
    $env:PYTHON = $VenvPython
    $env:PYTHONDONTWRITEBYTECODE = '1'

    Invoke-Native -Executable $VenvPython -Arguments @('-m', 'pip', 'install', '--upgrade', 'pip')
    Invoke-Native -Executable $VenvPython -Arguments @('-m', 'pip', 'install', '-r', (Join-Path $Root 'requirements-win-build.txt'))
    Invoke-Native -Executable $NpmCommand -Arguments @('ci', '--no-audit', '--no-fund')
    Invoke-Native -Executable $NpmCommand -Arguments @('audit', '--omit=dev', '--audit-level=high')
    Invoke-Native -Executable $NpmCommand -Arguments @('audit', '--audit-level=critical')
    Invoke-Native -Executable $NpmCommand -Arguments @('test')
    Invoke-Native -Executable $NpmCommand -Arguments @('run', 'lint')
    Invoke-Native -Executable $NpmCommand -Arguments @('run', 'package:source')
    Invoke-Native -Executable $NpmCommand -Arguments @('run', 'build:win')

    $Installer = Join-Path $Root 'release/artifacts/HS.Tech-Bridge-Setup-x64.exe'
    if (-not (Test-Path -LiteralPath $Installer -PathType Leaf)) {
        throw "The expected installer was not produced: $Installer"
    }
    $Hash = (Get-FileHash -LiteralPath $Installer -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
    $HashPath = "$Installer.sha256"
    Set-Content -LiteralPath $HashPath -Value "$Hash  HS.Tech-Bridge-Setup-x64.exe" -Encoding ascii -ErrorAction Stop

    Write-Host "`nBUILD SUCCEEDED"
    Write-Host "Installer: $Installer"
    Write-Host "SHA-256: $Hash"
    Write-Host "Log: $LogPath"
    Write-Host 'This script builds only. It does not install/run the app or test CapCut; perform the documented Windows smoke test separately.'
}
catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    Write-Host "Build log (if created): $LogPath"
    $FailureCode = 1
}
finally {
    if ($TranscriptStarted) {
        try { Stop-Transcript | Out-Null } catch { }
    }
    if (Test-Path -LiteralPath $VenvPath) {
        try { Remove-Item -LiteralPath $VenvPath -Recurse -Force -ErrorAction Stop }
        catch { Write-Warning "Could not remove temporary venv '$VenvPath'; remove it manually after confirming the build processes stopped." }
    }
}

exit $FailureCode
