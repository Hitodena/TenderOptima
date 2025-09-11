# PowerShell script to fix client-side issues
Write-Host "🔧 Fixing client-side issues..." -ForegroundColor Green

# Stop any running processes
Write-Host "🛑 Stopping any running processes..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -like "*node*" -or $_.ProcessName -like "*tsx*"} | Stop-Process -Force -ErrorAction SilentlyContinue

# Clear node_modules and package-lock
Write-Host "🗑️ Clearing node_modules and package-lock..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Path "node_modules" -Recurse -Force
}
if (Test-Path "package-lock.json") {
    Remove-Item -Path "package-lock.json" -Force
}

# Clear Vite cache
Write-Host "🗑️ Clearing Vite cache..." -ForegroundColor Yellow
if (Test-Path "node_modules/.vite") {
    Remove-Item -Path "node_modules/.vite" -Recurse -Force -ErrorAction SilentlyContinue
}

# Reinstall dependencies
Write-Host "📦 Reinstalling dependencies..." -ForegroundColor Cyan
npm install

# Install specific version of @hookform/resolvers
Write-Host "🔧 Installing specific version of @hookform/resolvers..." -ForegroundColor Cyan
npm install @hookform/resolvers@3.3.4

Write-Host "✅ Client fixes completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Run: npm run dev" -ForegroundColor White
Write-Host "2. Open: http://localhost:5000" -ForegroundColor White
Write-Host ""
Write-Host "🎯 If issues persist, try running only the server:" -ForegroundColor Gray
Write-Host "   tsx server/index.ts" -ForegroundColor Gray
