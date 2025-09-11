@echo off
echo 🚀 Starting migration of SupplierFinder to root directory...

REM Check if we're in the right directory
if not exist "SupplierFinder" (
    echo ❌ SupplierFinder directory not found!
    echo Please run this script from the root directory of the project.
    pause
    exit /b 1
)

echo ✅ SupplierFinder directory found

REM Create backup directory
echo 📦 Creating backup of current root files...
if exist "backup-root" rmdir /s /q "backup-root"
mkdir "backup-root"

REM Backup existing files in root
if exist "package.json" copy "package.json" "backup-root\" >nul
if exist "start-dev.bat" copy "start-dev.bat" "backup-root\" >nul
if exist "start-dev.ps1" copy "start-dev.ps1" "backup-root\" >nul
if exist "STARTUP_GUIDE.md" copy "STARTUP_GUIDE.md" "backup-root\" >nul

echo 📋 Copying files from SupplierFinder to root...
xcopy "SupplierFinder\*" "." /E /H /Y >nul

echo ✅ Files copied successfully

echo 🗑️ Removing empty SupplierFinder directory...
rmdir /s /q "SupplierFinder"

echo ✅ Migration completed successfully!
echo.
echo 📋 Next steps:
echo 1. Run: npm install
echo 2. Run: npm run dev
echo 3. Open: http://localhost:5000
echo.
echo 🔄 If you need to rollback, files are backed up in 'backup-root' folder
pause
