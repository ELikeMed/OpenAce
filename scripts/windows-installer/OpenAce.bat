@echo off
REM ═══════════════════════════════════════════════════════════
REM OpenAce Launcher — Windows entry point
REM Double-click to start OpenAce. No Node.js install required.
REM ═══════════════════════════════════════════════════════════

setlocal enabledelayedexpansion

set "APP_DIR=%~dp0"
set "BUNDLED_NODE=%APP_DIR%node\node.exe"
set "OPENACE_SRC=%APP_DIR%openace"
set "DATA_DIR=%APPDATA%\OpenAce"
set "LOG_FILE=%DATA_DIR%\openace.log"
set "PID_FILE=%DATA_DIR%\openace.pid"
set "PORT=3333"

REM ── Ensure data directory exists ──
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

REM ── Log function ──
echo [%TIME%] === OpenAce starting === >> "%LOG_FILE%"
echo [%TIME%] App dir: %APP_DIR% >> "%LOG_FILE%"
echo [%TIME%] Data dir: %DATA_DIR% >> "%LOG_FILE%"

REM ── Check if already running ──
if exist "%PID_FILE%" (
    set /p OLD_PID=<"%PID_FILE%"
    tasklist /FI "PID eq !OLD_PID!" 2>nul | find /i "node" >nul
    if !errorlevel! equ 0 (
        echo [%TIME%] Already running (PID !OLD_PID!) — opening browser >> "%LOG_FILE%"
        start "" "http://localhost:%PORT%"
        exit /b 0
    ) else (
        echo [%TIME%] Stale PID file, removing >> "%LOG_FILE%"
        del "%PID_FILE%" 2>nul
    )
)

REM ── Verify bundled Node exists ──
if not exist "%BUNDLED_NODE%" (
    echo [%TIME%] ERROR: Bundled Node.js not found at %BUNDLED_NODE% >> "%LOG_FILE%"
    msg * "OpenAce could not find its bundled Node.js runtime. The app may be corrupted — please re-download."
    exit /b 1
)

for /f "tokens=*" %%v in ('"%BUNDLED_NODE%" --version 2^>nul') do set NODE_VERSION=%%v
echo [%TIME%] Bundled Node: %NODE_VERSION% >> "%LOG_FILE%"

REM ── First-launch: copy config + data templates to user data dir ──
if not exist "%DATA_DIR%\config\openace.config.json" (
    echo [%TIME%] First launch — setting up data directory >> "%LOG_FILE%"

    if exist "%OPENACE_SRC%\config" (
        xcopy /E /I /Y /Q "%OPENACE_SRC%\config" "%DATA_DIR%\config" >nul 2>&1
        echo [%TIME%] Copied config templates >> "%LOG_FILE%"
    )

    if exist "%OPENACE_SRC%\data" (
        xcopy /E /I /Y /Q "%OPENACE_SRC%\data" "%DATA_DIR%\data" >nul 2>&1
        echo [%TIME%] Copied data templates >> "%LOG_FILE%"
    )
)

REM ── Link user data into source tree (Windows junction) ──
if not exist "%OPENACE_SRC%\data.bundled" if exist "%OPENACE_SRC%\data" if exist "%DATA_DIR%\data" (
    ren "%OPENACE_SRC%\data" "data.bundled" 2>nul
    mklink /J "%OPENACE_SRC%\data" "%DATA_DIR%\data" >nul 2>&1
    echo [%TIME%] Linked data → %DATA_DIR%\data >> "%LOG_FILE%"
)

if not exist "%OPENACE_SRC%\config.bundled" if exist "%OPENACE_SRC%\config" if exist "%DATA_DIR%\config" (
    ren "%OPENACE_SRC%\config" "config.bundled" 2>nul
    mklink /J "%OPENACE_SRC%\config" "%DATA_DIR%\config" >nul 2>&1
    echo [%TIME%] Linked config → %DATA_DIR%\config >> "%LOG_FILE%"
)

REM ── Set PATH so bundled node is found ──
set "PATH=%APP_DIR%node;%PATH%"
set "NODE_ENV=production"
set "PORT=%PORT%"

REM ── Start the Express server ──
echo [%TIME%] Starting server on port %PORT%... >> "%LOG_FILE%"

cd /d "%OPENACE_SRC%"

REM Start server, capture PID
start /B "" "%BUNDLED_NODE%" scripts/start-dashboard.js >> "%LOG_FILE%" 2>&1

REM Give server a moment to write its PID
timeout /t 2 /nobreak >nul

REM Find the node process we just started
for /f "tokens=2" %%p in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST 2^>nul ^| findstr "PID"') do (
    set "SERVER_PID=%%p"
)
echo %SERVER_PID% > "%PID_FILE%"
echo [%TIME%] Server PID: %SERVER_PID% >> "%LOG_FILE%"

REM ── Wait for server to be ready ──
set MAX_WAIT=30
set WAITED=0

:wait_loop
if %WAITED% geq %MAX_WAIT% goto wait_done

REM Try to connect
curl -s "http://localhost:%PORT%" >nul 2>&1
if %errorlevel% equ 0 (
    echo [%TIME%] Server ready after %WAITED%s >> "%LOG_FILE%"
    goto server_ready
)

timeout /t 1 /nobreak >nul
set /a WAITED+=1

REM Check if process died
tasklist /FI "PID eq %SERVER_PID%" 2>nul | find /i "node" >nul
if %errorlevel% neq 0 (
    echo [%TIME%] ERROR: Server process died >> "%LOG_FILE%"
    del "%PID_FILE%" 2>nul
    msg * "OpenAce failed to start. Check the log at: %LOG_FILE%"
    exit /b 1
)

goto wait_loop

:wait_done
echo [%TIME%] WARNING: Server may not be ready (waited %MAX_WAIT%s), opening browser anyway >> "%LOG_FILE%"

:server_ready
REM ── Open browser ──
start "" "http://localhost:%PORT%"
echo [%TIME%] Browser opened >> "%LOG_FILE%"

REM ── Keep alive — wait for user to close this window ──
echo.
echo   ╔════════════════════════════════════════╗
echo   ║         OpenAce is running!            ║
echo   ║                                        ║
echo   ║  Dashboard: http://localhost:%PORT%      ║
echo   ║                                        ║
echo   ║  Close this window to stop OpenAce.    ║
echo   ╚════════════════════════════════════════╝
echo.

REM Wait for the node process to exit (or window close)
:keep_alive
timeout /t 5 /nobreak >nul
tasklist /FI "PID eq %SERVER_PID%" 2>nul | find /i "node" >nul
if %errorlevel% equ 0 goto keep_alive

del "%PID_FILE%" 2>nul
echo [%TIME%] === OpenAce stopped === >> "%LOG_FILE%"
