# Quick fix script
Write-Host "🔧 Quick fix for client issues..." -ForegroundColor Green

# Stop any running processes
Write-Host "🛑 Stopping processes..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -like "*node*" -or $_.ProcessName -like "*tsx*"} | Stop-Process -Force -ErrorAction SilentlyContinue

# Clear Vite cache
Write-Host "🗑️ Clearing Vite cache..." -ForegroundColor Yellow
if (Test-Path "node_modules/.vite") {
    Remove-Item -Path "node_modules/.vite" -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "✅ Quick fix completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Now run these commands in separate terminals:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Terminal 1 (Server):" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Terminal 2 (Client):" -ForegroundColor Cyan
Write-Host "  cd client" -ForegroundColor White
Write-Host "  npx vite --host 0.0.0.0 --port 3000" -ForegroundColor White
Write-Host ""
Write-Host "Then open: http://localhost:3000" -ForegroundColor Green
