@echo off
rem Controls for the Reminders browser app:  .\app.cmd status | build | run | start | stop | restart
rem (see scripts\app-control.mjs). Node.js is found even when it is not on the PATH of this shell.
setlocal
set "NODE=node"
where node >nul 2>nul || set "NODE=C:\Program Files\nodejs\node.exe"
cd /d "%~dp0"
"%NODE%" scripts\app-control.mjs %*
exit /b %ERRORLEVEL%
