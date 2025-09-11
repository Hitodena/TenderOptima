# PowerShell script to start only the client
Write-Host "🌐 Starting Vite client only..." -ForegroundColor Green

# Set environment variables for client
$env:VITE_SERVER_PORT = "5000"
$env:NODE_ENV = "development"

# Change to client directory and start Vite
Write-Host "🚀 Starting Vite development server from client directory..." -ForegroundColor Cyan
Set-Location -Path "client"
npx vite --host 0.0.0.0 --port 3000
