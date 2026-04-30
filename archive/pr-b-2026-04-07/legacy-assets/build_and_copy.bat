@echo off
setlocal

REM Step 1: Build the frontend
echo === Building frontend... ===
cd /d "C:\Users\r.marks\OneDrive - Financial Reporting Council\Desktop\cake\frontend"

call npm run build
IF %ERRORLEVEL% NEQ 0 (
    echo !!! Build failed. Exiting.
    exit /b %ERRORLEVEL%
)
echo --- Build completed successfully. ---

REM Step 2: Copy files and log what changed
cd /d "C:\Users\r.marks\OneDrive - Financial Reporting Council\Desktop\cake"
echo === Copying files to backend ===

set "logfile=%TEMP%\xcopy_log_%RANDOM%.txt"

echo --- Copying index.html ---
xcopy /Y /F frontend\dist\index.html backend\templates\ > "%logfile%"
type "%logfile%"

echo --- Copying asset files ---
xcopy /E /I /Y /F frontend\dist\assets backend\static\assets >> "%logfile%"
type "%logfile%"

echo --- Copy complete. Written files listed above. ===

del "%logfile%" >nul 2>&1

endlocal
