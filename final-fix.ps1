# Final fix script
Write-Host "Final fix for all issues..." -ForegroundColor Green

# Stop all processes
Write-Host "Stopping all processes..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -like "*node*" -or $_.ProcessName -like "*tsx*"} | Stop-Process -Force -ErrorAction SilentlyContinue

# Remove problematic dependency
Write-Host "Removing @hookform/resolvers..." -ForegroundColor Yellow
npm uninstall @hookform/resolvers

# Clear caches
Write-Host "Clearing caches..." -ForegroundColor Yellow
if (Test-Path "node_modules/.vite") {
    Remove-Item -Path "node_modules/.vite" -Recurse -Force -ErrorAction SilentlyContinue
}
if (Test-Path "package-lock.json") {
    Remove-Item -Path "package-lock.json" -Force -ErrorAction SilentlyContinue
}

# Reinstall dependencies
Write-Host "Reinstalling dependencies..." -ForegroundColor Cyan
npm install

Write-Host "Final fix completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Now run:" -ForegroundColor Yellow
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Then open: http://localhost:5000" -ForegroundColor Green
