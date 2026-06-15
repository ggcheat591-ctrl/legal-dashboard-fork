@echo off
cd /d "%~dp0"
if exist node_modules\.vite rmdir /s /q node_modules\.vite
if exist node_modules\.vite-temp rmdir /s /q node_modules\.vite-temp
npm run dev -- --force
pause
