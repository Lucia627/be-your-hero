@echo off
netsh advfirewall firewall delete rule name="BeYourHero" 2>nul
netsh advfirewall firewall add rule name="BeYourHero" dir=in action=allow protocol=tcp localport=8080
if %errorlevel% == 0 (
    echo Firewall rule added successfully for port 8080.
) else (
    echo Failed. Please run this bat as Administrator.
)
pause
