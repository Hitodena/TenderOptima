# PowerShell script to temporarily disable @hookform/resolvers imports
Write-Host "🔧 Temporarily disabling @hookform/resolvers imports..." -ForegroundColor Green

# Find all files that import @hookform/resolvers
$files = Get-ChildItem -Path "client/src" -Recurse -Include "*.tsx", "*.ts" | Where-Object {
    (Get-Content $_.FullName -Raw) -match "@hookform/resolvers"
}

Write-Host "📁 Found $($files.Count) files with @hookform/resolvers imports" -ForegroundColor Yellow

foreach ($file in $files) {
    Write-Host "🔧 Processing: $($file.Name)" -ForegroundColor Gray
    
    # Read file content
    $content = Get-Content $file.FullName -Raw
    
    # Comment out imports
    $content = $content -replace 'import\s*\{\s*zodResolver\s*\}\s*from\s*["\']@hookform/resolvers/zod["\'];', '// import { zodResolver } from "@hookform/resolvers/zod";'
    $content = $content -replace 'import\s*\{\s*zodResolver\s*\}\s*from\s*["\']@hookform/resolvers["\'];', '// import { zodResolver } from "@hookform/resolvers";'
    
    # Comment out resolver usage
    $content = $content -replace 'resolver:\s*zodResolver\([^)]+\),', '// resolver: zodResolver(...),'
    
    # Write back to file
    Set-Content -Path $file.FullName -Value $content -NoNewline
}

Write-Host "✅ All @hookform/resolvers imports have been temporarily disabled" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Run: .\start-server-only.ps1" -ForegroundColor White
Write-Host "2. In another terminal: .\start-client-only.ps1" -ForegroundColor White
Write-Host "3. Open: http://localhost:3000" -ForegroundColor White
