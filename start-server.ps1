Write-Host "Starting SupplierFinder Server..." -ForegroundColor Green

$env:DATABASE_URL = "postgresql://neondb_owner:npg_w6m4xfJLtiUG@ep-jolly-firefly-a4a5r2fx.us-east-1.aws.neon.tech/neondb?sslmode=require"
$env:SKIP_AUTH = "true"
$env:NODE_ENV = "development"

Write-Host "Environment variables set:" -ForegroundColor Yellow
Write-Host "DATABASE_URL: Set" -ForegroundColor Cyan
Write-Host "SKIP_AUTH: $env:SKIP_AUTH" -ForegroundColor Cyan
Write-Host "NODE_ENV: $env:NODE_ENV" -ForegroundColor Cyan

Write-Host "Starting server..." -ForegroundColor Green
npm run dev
