@echo off
title OpenAce
echo.
echo   Starting OpenAce...
echo.
node "%~dp0scripts\start-dashboard.js"
if %ERRORLEVEL% neq 0 (
    echo.
    echo   OpenAce failed to start. Make sure Node.js is installed.
    echo   Download from: https://nodejs.org
    echo.
    pause
)
