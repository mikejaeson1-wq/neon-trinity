@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Bitte zuerst die aktuelle LTS-Version von Node.js installieren:
  echo https://nodejs.org/
  start https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\electron\dist\electron.exe" (
  echo Neon Trinity wird fuer den ersten Start vorbereitet...
  call npm install
  if errorlevel 1 (
    echo Die Installation ist fehlgeschlagen. Internetverbindung pruefen.
    pause
    exit /b 1
  )
)
call npm start
pause
