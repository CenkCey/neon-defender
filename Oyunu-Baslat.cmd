@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto missing_node
where npm >nul 2>nul
if errorlevel 1 goto missing_node
if exist "node_modules\vite\bin\vite.js" goto launch
call npm ci
if errorlevel 1 goto failed
:launch
echo Neon Defender hazirlaniyor. Pencereyi acik tutun; durdurmak icin Ctrl+C.
call npm run play
if errorlevel 1 goto failed
exit /b 0
:missing_node
echo Node.js 22.12+ ve npm gerekli: https://nodejs.org/en/download
pause
exit /b 1
:failed
echo Oyun baslatilamadi. Yukaridaki hata mesajini kontrol edin.
echo 5176 portu kullanimdaysa mevcut sunucuya dokunulmaz.
pause
exit /b 1
