# Frees port 4000 when the app server says EADDRINUSE.
# Usage:  .\demo\free-port.ps1
Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
  $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
  Write-Host "stopping PID $($_.OwningProcess) ($($p.ProcessName))"
  Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 1
if (Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue) {
  Write-Host "port 4000 is STILL busy" -ForegroundColor Red
} else {
  Write-Host "port 4000 is free - run 'npm run dev' again" -ForegroundColor Green
}
