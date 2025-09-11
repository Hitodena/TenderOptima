# PowerShell script to start only the server
Write-Host "🖥️ Starting Express server only..." -ForegroundColor Green

# Set environment variables
$env:NODE_ENV = "development"
$env:PORT = "5000"

# Start server
Write-Host "🚀 Starting Express server..." -ForegroundColor Cyan
tsx server/index.ts
