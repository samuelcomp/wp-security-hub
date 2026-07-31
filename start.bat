@echo off
cd /d "%~dp0"
echo Starting WP Security Hub...
start "WP Security Hub Server" node dist/dashboard/server.js
timeout /t 3 /nobreak >nul
npx electron --no-sandbox --disable-gpu dist/dashboard/main.js