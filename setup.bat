@echo off
title HapiEats TV - Setup
color 0A
echo.
echo  ============================================
echo    HapiEats TV - Installing dependencies...
echo  ============================================
echo.
cd /d "%~dp0"
echo [1/2] Running npm install...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ERROR: npm install failed. Check your Node.js installation.
    pause
    exit /b 1
)
echo.
echo  ============================================
echo    Installation complete!
echo  ============================================
echo.
echo  Next steps:
echo    1. Fill in your API keys in .env.local
echo    2. Run dev-server.bat to start the app
echo.
pause
