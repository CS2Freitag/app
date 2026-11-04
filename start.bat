@echo off
title CS2Freitag PWA Launcher
cd /d "%~dp0"

echo ========================================================
echo   CS2Freitag - Counter-Strike 2 Callouts und Tactic Planner
echo   Starte lokalen Offline-Server...
echo ========================================================

rem 1. Ermittle den Web-Ordner
set "SERVER_DIR="
if exist "%~dp0offline\index.html" (
    set "SERVER_DIR=%~dp0offline"
) else if exist "%~dp0dist\index.html" (
    set "SERVER_DIR=%~dp0dist"
) else if exist "%~dp0assets" (
    set "SERVER_DIR=%~dp0"
)

if "%SERVER_DIR%"=="" (
    echo.
    echo ========================================================
    echo   [FEHLER] Web-Ordner nicht gefunden!
    echo ========================================================
    echo   Der Ordner 'offline' oder 'dist' wurde nicht gefunden.
    echo   Bitte stelle sicher, dass der 'offline'-Ordner aus dem
    echo   Download-Paket neben der 'start.bat' liegt.
    echo ========================================================
    echo.
    pause
    exit /b 1
)

echo Ausfuehrungsort: %SERVER_DIR%
echo.

rem 2. Falls Node.js vorhanden ist: Nutze den eingebauten schnellen Node-Server
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo Starte lokalen Server ueber Node.js...
    node "%~dp0scripts\server.cjs" "%SERVER_DIR%"
    exit /b
)

rem 3. Falls Python / py vorhanden ist: Nutze Python
where python >nul 2>nul
if %errorlevel% equ 0 (
    echo Starte lokalen Server ueber Python...
    start "" "http://localhost:8000"
    python -m http.server 8000 --directory "%SERVER_DIR%"
    exit /b
)
where py >nul 2>nul
if %errorlevel% equ 0 (
    echo Starte lokalen Server ueber Python Launcher...
    start "" "http://localhost:8000"
    py -m http.server 8000 --directory "%SERVER_DIR%"
    exit /b
)

rem 4. Standard Windows Offline-Server ueber PowerShell (funktioniert auf JEDEM Windows-PC)
echo Starte lokalen Server ueber Windows PowerShell...
if exist "%~dp0scripts\server.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\server.ps1" -RootDirectory "%SERVER_DIR%"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$dir = '%SERVER_DIR%'; $l = New-Object System.Net.HttpListener; $l.Prefixes.Add('http://localhost:8000/'); $l.Start(); Write-Host 'Server laeuft auf http://localhost:8000'; Start-Process 'http://localhost:8000'; while ($l.IsListening) { try { $ctx = $l.GetContext(); $p = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar); if ($p -eq '') { $p = 'index.html' }; $f = Join-Path $dir $p; if (-not (Test-Path $f -PathType Leaf) -and -not [System.IO.Path]::HasExtension($p)) { $f = Join-Path $dir 'index.html' }; if (Test-Path $f -PathType Leaf) { $ext = [System.IO.Path]::GetExtension($f).ToLower(); $ct = switch ($ext) { '.html' { 'text/html; charset=utf-8' } '.js' { 'text/javascript; charset=utf-8' } '.css' { 'text/css; charset=utf-8' } '.png' { 'image/png' } '.svg' { 'image/svg+xml' } '.ico' { 'image/x-icon' } '.json' { 'application/json; charset=utf-8' } '.webmanifest' { 'application/manifest+json; charset=utf-8' } '.woff2' { 'font/woff2' } '.woff' { 'font/woff' } default { 'application/octet-stream' } }; $b = [System.IO.File]::ReadAllBytes($f); $ctx.Response.ContentType = $ct; $ctx.Response.ContentLength64 = $b.Length; $ctx.Response.KeepAlive = $false; $ctx.Response.AddHeader('Access-Control-Allow-Origin', '*'); $ctx.Response.OutputStream.Write($b, 0, $b.Length) } else { $ctx.Response.StatusCode = 404; $ctx.Response.KeepAlive = $false; $eb = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found'); $ctx.Response.ContentLength64 = $eb.Length; $ctx.Response.OutputStream.Write($eb, 0, $eb.Length) } } catch {} finally { try { $ctx.Response.OutputStream.Close(); $ctx.Response.Close() } catch {} } }"
)

pause
