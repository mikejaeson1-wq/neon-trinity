@echo off
cd /d "%~dp0"
call npm install
if errorlevel 1 exit /b 1
call npm run build:win
if errorlevel 1 (
  echo Erstellen fehlgeschlagen.
  pause
  exit /b 1
)
start "" "release"
pause
