@echo off
setlocal
cd /d "%~dp0"
echo.
echo Legal Dashboard - Windows EXE build
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)
call npm install
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)
call npm run dist:win
if errorlevel 1 (
  echo EXE build failed.
  pause
  exit /b 1
)
echo Done. Output folder: %cd%elease
pause
endlocal
