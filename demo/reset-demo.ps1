# Puts the repo back exactly as it was before the demo.
Push-Location "C:\Users\Yoma Maroh\proofline"
try {
  if ((git log -1 --format=%s) -eq "Agent change: upgrade returns success without persisting") {
    git reset --hard HEAD~1 | Out-Null
    Write-Host "Removed the demo commit." -ForegroundColor Green
  } else {
    git checkout -- app/ 2>$null
    Write-Host "Discarded demo edits." -ForegroundColor Green
  }
  Write-Host "App restored to correct state." -ForegroundColor DarkGray
} finally {
  Pop-Location
}
