@echo off
setlocal

echo Adding firewall rule for Be Your Hero (port 8080)...
netsh advfirewall firewall delete rule name="BeYourHero" 2>nul
netsh advfirewall firewall add rule name="BeYourHero" dir=in action=allow protocol=tcp localport=8080 profile=any
if %errorlevel% == 0 (
    echo [OK] Firewall rule added successfully for all network profiles.
) else (
    echo [ERROR] Failed. Please right-click this file and select "Run as Administrator".
)

pause
endlocal
