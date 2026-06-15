$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Release = Join-Path $Root "release"
$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop "Legal Dashboard.lnk"

$Portable = Get-ChildItem -Path $Release -Filter "*.exe" -File |
  Where-Object { $_.Name -notmatch "Setup" } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $Portable) {
  Write-Host "Portable EXE not found in release folder."
  Write-Host "Run build-work-exe.cmd first."
  pause
  exit 1
}

$Launcher = Join-Path $Root "Legal Dashboard Work Launcher.cmd"
@"
@echo off
set MAP_PROXY_URL=http://192.168.227.254:3128
set HTTP_PROXY=http://192.168.227.254:3128
set HTTPS_PROXY=http://192.168.227.254:3128
set NO_PROXY=localhost,127.0.0.1
start "" "$($Portable.FullName)"
"@ | Set-Content -Path $Launcher -Encoding ASCII

$WScript = New-Object -ComObject WScript.Shell
$Shortcut = $WScript.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $Launcher
$Shortcut.WorkingDirectory = $Root
$Shortcut.IconLocation = $Portable.FullName
$Shortcut.Save()

Write-Host "Shortcut created:"
Write-Host $ShortcutPath
pause
