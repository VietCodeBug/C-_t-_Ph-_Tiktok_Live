@echo off
cd /d "%~dp0web"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12 or newer, then run this file again.
  pause
  exit /b 1
)
if not exist node_modules\vite\bin\vite.js (
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Open http://localhost:4173/ after the server is ready.
echo Press Ctrl+C to stop the local preview.
call npm run dev -- --strictPort
pause
