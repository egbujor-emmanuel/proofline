# Guided Proofline demo. Run this, narrate, press Enter between steps.
#
#   cd "C:\Users\Yoma Maroh\proofline"
#   .\demo\demo.ps1
#
# It restarts the app server for you when the code changes, which is the
# fiddly part that is easy to forget on camera.

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$app  = Join-Path $root "app"
$cli  = Join-Path $root "proofline-cli\bin\proofline.js"

function Step($n, $title) {
  Write-Host ""
  Write-Host ("=" * 68) -ForegroundColor DarkGray
  Write-Host "  STEP $n  $title" -ForegroundColor Cyan
  Write-Host ("=" * 68) -ForegroundColor DarkGray
  Write-Host ""
}

function Pause($msg) {
  Write-Host ""
  Write-Host "  >> $msg" -ForegroundColor Yellow
  Read-Host "  Press Enter to continue"
}

function Restart-App {
  Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 600
  Start-Process -FilePath "node" -ArgumentList "server/index.js" -WorkingDirectory $app -WindowStyle Hidden
  Start-Sleep -Seconds 2
  try {
    Invoke-RestMethod -Uri "http://localhost:4000/api/reset" -Method Post -TimeoutSec 5 | Out-Null
    Write-Host "  app server running at http://localhost:4000 (account reset to Free)" -ForegroundColor DarkGreen
  } catch {
    Write-Host "  WARNING: app server did not answer on :4000" -ForegroundColor Red
  }
}

function Show-Account {
  $up  = Invoke-RestMethod -Uri "http://localhost:4000/api/upgrade" -Method Post
  $acc = Invoke-RestMethod -Uri "http://localhost:4000/api/account" -Method Get
  Write-Host ""
  Write-Host "    POST /api/upgrade  ->  plan = $($up.plan)" -ForegroundColor White
  Write-Host "    GET  /api/account  ->  plan = $($acc.plan)" -ForegroundColor White
  if ($acc.plan -eq "pro") {
    Write-Host "    persisted correctly" -ForegroundColor Green
  } else {
    Write-Host "    upgrade claimed success but nothing was saved" -ForegroundColor Red
  }
  Invoke-RestMethod -Uri "http://localhost:4000/api/reset" -Method Post | Out-Null
}

Clear-Host
Write-Host ""
Write-Host "  PROOFLINE - live demo" -ForegroundColor Cyan
Write-Host "  Which promises did this code change break, and can we prove it?" -ForegroundColor DarkGray

# ---------------------------------------------------------------
Step 1 "The app works"
Restart-App
Show-Account
Write-Host ""
Write-Host "  Open http://localhost:4000 and click Upgrade to Pro." -ForegroundColor DarkGray
Pause "Say: this is the app. Upgrading works, and it sticks."

# ---------------------------------------------------------------
Step 2 "Break it, the way an AI agent might"
& node (Join-Path $PSScriptRoot "break.js")
Restart-App
Show-Account
Pause "Say: the API still answers 'pro'. The UI still says success. But nothing was saved. A green test suite would not notice this."

# ---------------------------------------------------------------
Step 3 "Ask Proofline what is at risk (free, no Kane run)"
Write-Host "  > node bin/proofline.js --repo .. --dry-run" -ForegroundColor DarkGray
Write-Host "  (about 30 seconds)" -ForegroundColor DarkGray
Push-Location (Join-Path $root "proofline-cli")
& node $cli --repo $root --dry-run
Pop-Location
Pause "Say: it read the diff and ranked AC-1 first, high confidence. It has not tested anything yet."

# ---------------------------------------------------------------
Step 4 "Verify it for real, in a real browser"
Write-Host "  > node bin/proofline.js --repo .. --report ../proof-report.html" -ForegroundColor DarkGray
Write-Host "  (4-5 minutes - Kane is driving Chrome. SPEED THIS UP IN THE EDIT.)" -ForegroundColor Yellow
Push-Location (Join-Path $root "proofline-cli")
& node $cli --repo $root --report (Join-Path $root "proof-report.html")
Pop-Location
Write-Host ""
Write-Host "  Note AC-3 stayed green - the navigation promise genuinely still holds." -ForegroundColor Green
Pause "Say: BLOCK. AC-1, AC-2, AC-6 are broken. But AC-3 is still proven - it is discriminating, not just failing everything."

# ---------------------------------------------------------------
Step 5 "Fix it"
& node (Join-Path $PSScriptRoot "fix.js")
Restart-App
Show-Account
Pause "Say: the fix restores the write that was dropped."

# ---------------------------------------------------------------
Step 6 "Re-verify - prove the promise holds again"
Write-Host "  (SPEED THIS UP IN THE EDIT TOO.)" -ForegroundColor Yellow
Push-Location (Join-Path $root "proofline-cli")
& node $cli --repo $root --report (Join-Path $root "proof-report.html")
Pop-Location
Pause "Say: AC-1 is machine verified again. Same criterion, same targeted check, now with evidence."

# ---------------------------------------------------------------
Step 7 "The artifact you can share"
Start-Process (Join-Path $root "proof-report.html")
Write-Host "  Opened proof-report.html" -ForegroundColor DarkGreen
Write-Host ""
Write-Host "  Close on: the ambers are the point. A test claims those criteria," -ForegroundColor DarkGray
Write-Host "  but nothing independently asserts them - and Proofline says so" -ForegroundColor DarkGray
Write-Host "  instead of showing a green check you cannot trust." -ForegroundColor DarkGray
Write-Host ""
