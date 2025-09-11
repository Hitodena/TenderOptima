# PowerShell script to migrate SupplierFinder files to root directory
Write-Host "🚀 Starting migration of SupplierFinder to root directory..." -ForegroundColor Green

# Check if we're in the right directory
$currentPath = Get-Location
Write-Host "📁 Current directory: $currentPath" -ForegroundColor Yellow

# Check if SupplierFinder subdirectory exists
if (-not (Test-Path "SupplierFinder")) {
    Write-Host "❌ SupplierFinder directory not found!" -ForegroundColor Red
    Write-Host "Please run this script from the root directory of the project." -ForegroundColor Red
    exit 1
}

Write-Host "✅ SupplierFinder directory found" -ForegroundColor Green

# Backup current root files
Write-Host "📦 Creating backup of current root files..." -ForegroundColor Cyan
if (Test-Path "backup-root") {
    Remove-Item -Path "backup-root" -Recurse -Force
}
New-Item -ItemType Directory -Path "backup-root" | Out-Null

# Backup existing files in root
$rootFiles = @("package.json", "start-dev.bat", "start-dev.ps1", "STARTUP_GUIDE.md")
foreach ($file in $rootFiles) {
    if (Test-Path $file) {
        Copy-Item -Path $file -Destination "backup-root\" -Force
        Write-Host "  📄 Backed up: $file" -ForegroundColor Gray
    }
}

# Copy all files from SupplierFinder to root
Write-Host "📋 Copying files from SupplierFinder to root..." -ForegroundColor Cyan
Copy-Item -Path "SupplierFinder\*" -Destination "." -Recurse -Force

Write-Host "✅ Files copied successfully" -ForegroundColor Green

# Remove the empty SupplierFinder directory
Write-Host "🗑️ Removing empty SupplierFinder directory..." -ForegroundColor Cyan
Remove-Item -Path "SupplierFinder" -Recurse -Force

Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Run: npm install" -ForegroundColor White
Write-Host "2. Run: npm run dev" -ForegroundColor White
Write-Host "3. Open: http://localhost:5000" -ForegroundColor White
Write-Host ""
Write-Host "🔄 If you need to rollback, files are backed up in 'backup-root' folder" -ForegroundColor Gray
