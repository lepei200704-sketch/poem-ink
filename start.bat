@echo off
setlocal
set PORT=8123
echo Starting Shimo Shanhe on http://localhost:%PORT%/ ...
start "shimo-server" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port %PORT%
timeout /t 2 >nul
start "" http://localhost:%PORT%/
echo Server window opened. Close it to stop the server.
endlocal
