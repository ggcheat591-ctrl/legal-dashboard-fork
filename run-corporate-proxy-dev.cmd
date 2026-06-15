@echo off
setlocal
cd /d "%~dp0"
set MAP_PROXY_URL=http://192.168.227.254:3128
set HTTP_PROXY=http://192.168.227.254:3128
set HTTPS_PROXY=http://192.168.227.254:3128
set NO_PROXY=localhost,127.0.0.1

echo Corporate proxy: %MAP_PROXY_URL%
call npm install
if errorlevel 1 pause & exit /b 1
call npm run dev
pause
endlocal
