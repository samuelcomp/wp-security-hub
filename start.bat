@echo off
cd /d "%~dp0"
echo Starting WP Security Hub...
start "WP Security Hub Server" node dist/dashboard/server.js
timeout /t 2 /nobreak >nul
npx electron dist/dashboard/main.js