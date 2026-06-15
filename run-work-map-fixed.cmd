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
echo  Legal Dashboard - WORK MAP FIX RUN
echo ==========================================
echo NSPD proxy: %MAP_PROXY_URL%
echo OSM tiles: direct browser/system proxy
echo.

call npm install
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)

call npm run desktop:dev
pause
endlocal
