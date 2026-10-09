@echo off
cd /d "%~dp0"
echo ==========================================
echo   Shin-chan Runner - Kasukabe Adventure
echo   Server: http://127.0.0.1:3000/
echo   Press Ctrl+C in this window to stop.
echo ==========================================
echo.
start "" http://127.0.0.1:3000/
node server\server.js
pause
