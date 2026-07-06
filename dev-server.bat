@echo off
title HapiEats TV - Dev Server
color 0A
echo.
echo  ============================================
echo    HapiEats TV - Starting dev server...
echo  ============================================
echo.
cd /d "%~dp0"
echo  Open http://localhost:3000 in your browser
echo.
node node_modules\next\dist\bin\next dev
pause
