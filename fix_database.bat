@echo off
REM Fix Database Schema - Add github_url column
REM This batch file runs the fix_github_column.js script

echo.
echo ========================================
echo  Database Schema Fix
echo ========================================
echo.

REM Check if node is installed
where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Run the fix script
echo Running database fix script...
echo.
node fix_github_column.js

REM Check if successful
if errorlevel 1 (
    echo.
    echo ERROR: Database fix failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Fix completed successfully!
echo ========================================
echo.
pause
