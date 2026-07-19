@echo off
setlocal
cd /d "%~dp0"

echo.
echo  SYS.SCANNER — bezpieczny HTTPS (telefon / PWA)
echo  ================================================
echo.
echo  1) Start lokalnego serwera na porcie 5173...
echo.

start "SYS.SCANNER-HTTP" cmd /c "npx --yes serve -l 5173 ."

timeout /t 3 /nobreak >nul

echo  2) Tunel HTTPS (Cloudflare) — skopiuj adres https://... z ponizszego okna
echo     i otworz go na telefonie. NIE uzywaj http://192.168...
echo.
echo  Zamkniecie tego okna zatrzyma tunel.
echo.

npx --yes cloudflared tunnel --url http://localhost:5173

endlocal
