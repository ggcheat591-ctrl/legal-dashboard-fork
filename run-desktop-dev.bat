@echo off
setlocal
cd /d "%~dp0"

echo.
echo Starting desktop dev version...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo Install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)

call npm install
if errorlevel 1 (
  pause
  exit /b 1
)

call npm run desktop:dev
pause
endlocal
