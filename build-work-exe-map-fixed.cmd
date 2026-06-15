@echo off
setlocal
cd /d "%~dp0"

set MAP_PROXY_URL=http://192.168.227.254:3128
set HTTP_PROXY=
set HTTPS_PROXY=
set http_proxy=
set https_proxy=
set NO_PROXY=localhost,127.0.0.1

echo.
echo ==========================================
echo  Legal Dashboard - WORK EXE BUILD MAP FIX
echo ==========================================
echo NSPD proxy baked into app: %MAP_PROXY_URL%
echo OSM tiles fixed: direct browser/system proxy
echo.

call npm config delete proxy >nul 2>nul
call npm config delete https-proxy >nul 2>nul

call npm install
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)

call npm run dist:work
if errorlevel 1 (
  echo dist:work failed, trying dist:win...
  call npm run dist:win
  if errorlevel 1 (
    echo Build failed.
    pause
    exit /b 1
  )
)

echo.
echo Done.
echo Open: %cd%\release
pause
endlocal
