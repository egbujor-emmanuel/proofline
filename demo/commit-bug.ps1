# Commits the regression so the FIX becomes the next change to verify.
# Run this after Proofline has blocked the bug, before running fix.js.
Set-Location "C:\Users\Yoma Maroh\proofline"
git add app/server/services/subscriptionService.js
git commit -m "Agent change: upgrade returns success without persisting" | Out-Null
Write-Host "Regression committed. Now run:  node ..\demo\fix.js" -ForegroundColor Green
Write-Host "Undo everything later with:     .\demo\reset-demo.ps1" -ForegroundColor DarkGray
