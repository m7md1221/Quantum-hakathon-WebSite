@echo off
echo ========================================
echo  Deploying fixes to Render server
echo ========================================
echo.

echo Step 1: Committing changes to Git...
git add .
git commit -m "Fix: Update score constraint to allow up to 15 points and improve logging"

echo.
echo Step 2: Pushing to GitHub...
git push origin main

echo.
echo ========================================
echo  Deployment initiated!
echo ========================================
echo.
echo Next steps:
echo 1. Wait for Render to redeploy automatically
echo 2. Once deployed, run this command on Render:
echo    node fix_score_constraint_script.js
echo.
echo Or connect to database directly and run:
echo    psql $DATABASE_URL -f fix_score_constraint_final.sql
echo.
echo ========================================
pause
