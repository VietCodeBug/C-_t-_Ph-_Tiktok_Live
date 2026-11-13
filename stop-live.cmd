@echo off
setlocal
if not defined COTYPHI_PORT set "COTYPHI_PORT=5182"
powershell -NoProfile -Command "try { if ($env:COTYPHI_PORT -notmatch '^[1-9][0-9]{0,4}$' -or [int]$env:COTYPHI_PORT -gt 65535) { throw 'Invalid COTYPHI_PORT' }; $stopOrigin = 'http://127.0.0.1:' + $env:COTYPHI_PORT; $liveHealth = Invoke-RestMethod -Uri ($stopOrigin + '/api/health') -TimeoutSec 3; if ($liveHealth.app -ne 'co-ty-phi-live') { Write-Host 'This port belongs to another app. Nothing was stopped.'; exit 1 }; $stopPayload = @{serverId=$liveHealth.serverId} | ConvertTo-Json -Compress; Invoke-RestMethod -Method Post -Uri ($stopOrigin + '/api/shutdown') -Headers @{Origin=$stopOrigin} -ContentType 'application/json' -Body $stopPayload -TimeoutSec 20 | Out-Null; Write-Host 'Co Ty Phi is saving and stopping. Check the LIVE terminal.' } catch { Write-Host $_.Exception.Message; exit 1 }"
if errorlevel 1 pause
