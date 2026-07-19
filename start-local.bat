@echo off
cd /d "%~dp0"
echo SYS.SCANNER — tylko localhost (bezpieczny kontekst w Chrome)
echo Otworz: http://localhost:5173
echo Na telefonie to NIE wystarczy — uzyj start-https.bat
echo.
npx --yes serve -l 5173 .
