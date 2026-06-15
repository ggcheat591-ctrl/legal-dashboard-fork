@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0create-work-shortcut.ps1"
