# Fix all @hookform/resolvers imports
Write-Host "Fixing all @hookform/resolvers imports..." -ForegroundColor Green

$files = @(
    "client/src/pages/clone-request.tsx",
    "client/src/components/auth/password-recovery.tsx", 
    "client/src/pages/enhanced-auth-page.tsx",
    "client/src/pages/auth-page.tsx",
    "client/src/pages/SupplierSearchPage.tsx",
    "client/src/components/supplier-search-form.tsx",
    "client/src/components/supplier-search-form-stage65.tsx",
    "client/src/components/supplier-follow-up.tsx",
    "client/src/components/email-form.tsx",
    "client/src/components/custom-supplier-input.tsx",
    "client/src/components/business-card-setup.tsx"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Processing: $file" -ForegroundColor Gray
        
        $content = Get-Content $file -Raw
        
        # Comment out imports
        $content = $content -replace 'import\s*\{\s*zodResolver\s*\}\s*from\s*["\']@hookform/resolvers/zod["\'];?\s*', '// import { zodResolver } from "@hookform/resolvers/zod";'
        $content = $content -replace 'import\s*\{\s*zodResolver\s*\}\s*from\s*["\']@hookform/resolvers["\'];?\s*', '// import { zodResolver } from "@hookform/resolvers";'
        
        # Comment out resolver usage
        $content = $content -replace 'resolver:\s*zodResolver\([^)]+\),?\s*', '// resolver: zodResolver(...),'
        
        Set-Content -Path $file -Value $content -NoNewline
    }
}

Write-Host "All imports fixed!" -ForegroundColor Green
