@echo off
setlocal enabledelayedexpansion
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
set "ALL_IPS="

:: 从 PowerShell 脚本获取所有可用 IPv4 地址
if exist "%PROJECT_DIR%get-ip.ps1" (
    for /f "usebackq tokens=*" %%a in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%get-ip.ps1"`) do (
        if defined ALL_IPS (
            set "ALL_IPS=!ALL_IPS!, %%a"
        ) else (
            set "ALL_IPS=%%a"
        )
        if not defined LOCAL_IP set "LOCAL_IP=%%a"
    )
)

echo [System Status]
node --version
echo.

echo [Access URLs]
echo   Local PC:   http://localhost:8080
if not "%LOCAL_IP%"=="" (
    echo   LAN IP:     http://%LOCAL_IP%:8080
    echo   Mobile:     http://%LOCAL_IP%:8080
    if not "%ALL_IPS%"=="%LOCAL_IP%" (
        echo   All IPs:    %ALL_IPS%
    )
) else (
    echo   LAN IP:     [Auto-detect failed]
    echo   Tip:        Run 'ipconfig' and use your WiFi/Ethernet IPv4 address
)
echo.

echo [Mobile Connection Tips]
echo   1. Make sure phone and PC are on the same WiFi
echo   2. Use the LAN IP above on your phone browser
echo   3. If still cannot connect, open port 8080 in firewall:
echo      - Right-click fix-firewall.bat ^> Run as Administrator
echo      - Or run: netsh advfirewall firewall add rule name="BeYourHero" dir=in action=allow protocol=tcp localport=8080
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
endlocal
