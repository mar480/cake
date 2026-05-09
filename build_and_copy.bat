@echo off
setlocal

REM Get the directory where this batch file lives.
REM %~dp0 includes a trailing backslash.
set "ROOT=%~dp0"
set "FRONTEND=%ROOT%frontend"
set "BACKEND=%ROOT%backend"

REM Step 1: Build the frontend
echo === Building frontend... ===
cd /d "%FRONTEND%"

call npm run build
IF %ERRORLEVEL% NEQ 0 (
    echo !!! Build failed. Exiting.
    exit /b %ERRORLEVEL%
)
echo --- Build completed successfully. ---

REM Step 2: Copy files and log what changed
cd /d "%ROOT%"
echo === Copying files to backend ===

set "logfile=%TEMP%\xcopy_log_%RANDOM%.txt"

echo --- Copying index.html ---
xcopy /Y /F "%FRONTEND%\dist\index.html" "%BACKEND%\templates\" > "%logfile%"
type "%logfile%"

echo --- Copying asset files ---
xcopy /E /I /Y /F "%FRONTEND%\dist\assets" "%BACKEND%\static\assets" >> "%logfile%"
type "%logfile%"

echo --- Copy complete. Written files listed above. ===

del "%logfile%" >nul 2>&1

endlocal