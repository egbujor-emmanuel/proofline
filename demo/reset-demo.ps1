# Puts the repo back exactly as it was before the demo.
Set-Location "C:\Users\Yoma Maroh\proofline"
$msg = git log -1 --format=%s
if ($msg -eq "Agent change: upgrade returns success without persisting") {
  git reset --hard HEAD~1 | Out-Null
  Write-Host "Removed the demo commit." -ForegroundColor Green
} else {
  git checkout -- app/ 2>$null
  Write-Host "Discarded demo edits." -ForegroundColor Green
}
Select-String -Path "app\server\services\subscriptionService.js" -Pattern "writeAccount\(account\)" |
  Select-Object -First 1 | ForEach-Object { Write-Host "app is correct: $($_.Line.Trim())" -ForegroundColor DarkGray }
