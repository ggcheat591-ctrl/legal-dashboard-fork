@echo off
setlocal
cd /d "%~dp0"

echo.
echo Cleaning old dependencies...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json

echo.
echo Installing fixed dependencies...
call npm install
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)

echo.
echo Checking audit...
call npm audit
pause
endlocal
