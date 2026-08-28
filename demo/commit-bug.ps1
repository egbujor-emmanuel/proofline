# Commits the regression so the FIX becomes the next change to verify.
# Run after Proofline has blocked the bug, before running fix.js.
# Uses Push/Pop-Location so it does NOT move you out of your current folder.
Push-Location "C:\Users\Yoma Maroh\proofline"
try {
  git add app/server/services/subscriptionService.js
  git commit -m "Agent change: upgrade returns success without persisting" | Out-Null
  Write-Host "Regression committed." -ForegroundColor Green
  Write-Host "Next:  node ..\demo\fix.js" -ForegroundColor Cyan
  Write-Host "Undo later:  ..\demo\reset-demo.ps1" -ForegroundColor DarkGray
} finally {
  Pop-Location
}
