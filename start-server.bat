@echo off
echo Starting SupplierFinder Server...
set DATABASE_URL=postgresql://neondb_owner:npg_w6m4xfJLtiUG@ep-jolly-firefly-a4a5r2fx.us-east-1.aws.neon.tech/neondb?sslmode=require
set SKIP_AUTH=true
set NODE_ENV=development
echo Environment variables set
echo Starting server...
npm run dev
pause
