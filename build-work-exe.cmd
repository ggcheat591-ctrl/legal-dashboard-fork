@echo off
setlocal
cd /d "%~dp0"

set MAP_PROXY_URL=http://192.168.227.254:3128
set HTTP_PROXY=http://192.168.227.254:3128
set HTTPS_PROXY=http://192.168.227.254:3128
set NO_PROXY=localhost,127.0.0.1

echo.
echo ==========================================
echo  Legal Dashboard - WORK EXE BUILD
echo ==========================================
echo Corporate proxy: %MAP_PROXY_URL%
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js LTS first.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js LTS first.
  pause
  exit /b 1
)

echo Installing dependencies...
call npm install
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)

echo.
echo Building installer and portable EXE...
call npm run dist:work
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo Done.
echo Open folder:
echo %cd%\release
echo.
echo Use installer EXE to create desktop shortcut automatically.
echo Or run portable EXE directly.
echo.
pause
endlocal
