# PowerShell script to start the development server
Write-Host "Starting SupplierFinder development server..." -ForegroundColor Green
Set-Location -Path "$PSScriptRoot\SupplierFinder"
Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
Write-Host "Running npm run dev..." -ForegroundColor Cyan
npm run dev
