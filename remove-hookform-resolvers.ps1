# PowerShell script to remove all @hookform/resolvers imports
Write-Host "Removing all @hookform/resolvers imports..." -ForegroundColor Green

# Find all files that import @hookform/resolvers
$files = Get-ChildItem -Path "client/src" -Recurse -Include "*.tsx", "*.ts" | Where-Object {
    (Get-Content $_.FullName -Raw) -match "@hookform/resolvers"
}

Write-Host "Found $($files.Count) files with @hookform/resolvers imports" -ForegroundColor Yellow

foreach ($file in $files) {
    Write-Host "Processing: $($file.Name)" -ForegroundColor Gray
    
    # Read file content
    $content = Get-Content $file.FullName -Raw
    
    # Remove imports completely
    $content = $content -replace 'import\s*\{\s*zodResolver\s*\}\s*from\s*["\']@hookform/resolvers/zod["\'];?\s*', ''
    $content = $content -replace 'import\s*\{\s*zodResolver\s*\}\s*from\s*["\']@hookform/resolvers["\'];?\s*', ''
    
    # Comment out resolver usage
    $content = $content -replace 'resolver:\s*zodResolver\([^)]+\),?\s*', '// resolver: zodResolver(...),'
    
    # Write back to file
    Set-Content -Path $file.FullName -Value $content -NoNewline
}

Write-Host "All @hookform/resolvers imports have been removed" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run: npm install" -ForegroundColor White
Write-Host "2. Run: npm run dev" -ForegroundColor White
Write-Host "3. Open: http://localhost:5000" -ForegroundColor White
