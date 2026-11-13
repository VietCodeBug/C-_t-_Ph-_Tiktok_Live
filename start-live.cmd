@echo off
setlocal
cd /d "%~dp0web"
if not defined COTYPHI_PORT set "COTYPHI_PORT=5182"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12 or newer, then run this file again.
  pause
  exit /b 1
)
node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>22||(major===22&&minor>=12)?0:1)"
if errorlevel 1 (
  echo Node.js 22.12 or newer is required.
  pause
  exit /b 1
)
powershell -NoProfile -Command "if ($env:COTYPHI_PORT -notmatch '^[1-9][0-9]{0,4}$' -or [int]$env:COTYPHI_PORT -gt 65535) { exit 1 }; exit 0"
if errorlevel 1 goto failed
powershell -NoProfile -Command "try { $liveCheck = Invoke-RestMethod -Uri ('http://127.0.0.1:' + $env:COTYPHI_PORT + '/api/health') -TimeoutSec 2; if ($liveCheck.app -eq 'co-ty-phi-live') { exit 10 } } catch {}; exit 0"
if errorlevel 10 (
  echo Co Ty Phi LIVE is already running at http://127.0.0.1:%COTYPHI_PORT%/admin
  echo Run stop-live.cmd before rebuilding a running server.
  pause
  exit /b 0
)
if not exist node_modules\tiktok-live-connector\package.json (
  call npm ci
  if errorlevel 1 goto failed
)
if not exist node_modules\msedge-tts\package.json (
  call npm ci
  if errorlevel 1 goto failed
)
call npm run build
if errorlevel 1 goto failed
echo.
echo Admin:   http://127.0.0.1:%COTYPHI_PORT%/admin
echo Overlay: http://127.0.0.1:%COTYPHI_PORT%/overlay
echo Demo:    http://127.0.0.1:%COTYPHI_PORT%/demo
echo Keep this terminal open. Press Ctrl+C once or run stop-live.cmd to stop.
call npm run live
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo The LIVE server could not start. Read the error above.
pause
exit /b 1
