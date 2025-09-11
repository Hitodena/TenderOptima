@echo off
echo Starting SupplierFinder development server...
cd /d "%~dp0SupplierFinder"
echo Current directory: %CD%
echo Running npm run dev...
npm run dev
pause
