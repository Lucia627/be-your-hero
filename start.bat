@echo off
title Be Your Hero - Server
cls

echo ============================================
echo     Be Your Hero - Local Game Server
echo ============================================
echo.

set "PROJECT_DIR=%~dp0"
set "BACKEND_DIR=%PROJECT_DIR%backend"

node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    echo         Download: https://nodejs.org/
    pause
    exit /b 1
)

if not exist "%BACKEND_DIR%\server.js" (
    echo [ERROR] backend/server.js not found.
    echo         Make sure start.bat is in the project root.
    pause
    exit /b 1
)

set "LOCAL_IP="
for /f "usebackq tokens=*" %%a in (`powershell -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -eq 'Dhcp' } | Select-Object -First 1).IPAddress"`) do set "LOCAL_IP=%%a"

if "%LOCAL_IP%"=="" (
    for /f "usebackq tokens=*" %%a in (`powershell -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress"`) do set "LOCAL_IP=%%a"
)

echo [System Status]
node --version
echo.

echo [Access URLs]
echo   Local PC:   http://localhost:8080
if not "%LOCAL_IP%"=="" (
    echo   LAN IP:     http://%LOCAL_IP%:8080
    echo   Mobile:     http://%LOCAL_IP%:8080
) else (
    echo   LAN IP:     [Auto-detect failed, check ipconfig manually]
)
echo.

echo [Tip]
echo   If mobile cannot connect:
echo   1. Make sure phone and PC are on the same WiFi
echo   2. Check Windows Firewall is not blocking port 8080
echo   3. Run this command as Admin to open port 8080:
echo      netsh advfirewall firewall add rule name="BeYourHero" dir=in action=allow protocol=tcp localport=8080

echo.
echo Press any key to start server...
pause >nul

echo [Opening browser...]
start http://localhost:8080

echo.
echo ============================================
echo  Server started! Press Ctrl+C twice to stop
echo ============================================
echo.

cd /d "%BACKEND_DIR%"
node server.js

echo.
echo [Server stopped]
pause