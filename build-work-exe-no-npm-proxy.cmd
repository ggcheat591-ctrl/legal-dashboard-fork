@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==========================================
echo  Legal Dashboard - WORK EXE BUILD
echo ==========================================
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

echo Clearing npm proxy settings for dependency install...
call npm config delete proxy >nul 2>nul
call npm config delete https-proxy >nul 2>nul
set HTTP_PROXY=
set HTTPS_PROXY=
set http_proxy=
set https_proxy=

echo.
echo Installing dependencies WITHOUT corporate proxy...
call npm install
if errorlevel 1 (
  echo.
  echo npm install failed.
  echo If you are at work and npm registry is blocked, run npm install at home once,
  echo then bring the project folder back to work with node_modules included.
  pause
  exit /b 1
)

echo.
echo Building installer and portable EXE with corporate proxy baked into app...
set MAP_PROXY_URL=http://192.168.227.254:3128
set HTTP_PROXY=
set HTTPS_PROXY=
set http_proxy=
set https_proxy=
set NO_PROXY=localhost,127.0.0.1

call npm run dist:work
if errorlevel 1 (
  echo.
  echo dist:work failed. Trying dist:win...
  call npm run dist:win
  if errorlevel 1 (
    echo Build failed.
    pause
    exit /b 1
  )
)

echo.
echo Done.
echo Open folder:
echo %cd%\release
echo.
pause
endlocal
