@ECHO OFF
SETLOCAL
REM Sync web assets into Android assets/www before building APK
SET ROOT=%~dp0..
SET DEST=%~dp0app\src\main\assets\www
IF NOT EXIST "%DEST%" mkdir "%DEST%"
COPY /Y "%ROOT%\index.html" "%DEST%\" >NUL
COPY /Y "%ROOT%\styles.css" "%DEST%\" >NUL
COPY /Y "%ROOT%\script.js" "%DEST%\" >NUL
COPY /Y "%ROOT%\sw.js" "%DEST%\" >NUL
COPY /Y "%ROOT%\manifest.webmanifest" "%DEST%\" >NUL
COPY /Y "%ROOT%\icon-192.png" "%DEST%\" >NUL
COPY /Y "%ROOT%\icon-512.png" "%DEST%\" >NUL
ECHO Assets synced to %DEST%
ENDLOCAL
