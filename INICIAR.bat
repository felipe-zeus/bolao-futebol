@echo off
title Bolão Copa 2026 — Iniciando...
color 0A
echo.
echo  ===============================================
echo   BOLAO COPA DO MUNDO 2026 - INICIALIZANDO
echo  ===============================================
echo.

REM Navega para a pasta do projeto
cd /d "%~dp0"

REM Carrega as variaveis do arquivo .env
for /f "tokens=1,2 delims==" %%A in (.env) do (
    if not "%%A"=="" if not "%%A:~0,1%"=="#" set "%%A=%%B"
)

echo  [1/3] Variaveis de ambiente carregadas do .env
echo        API Key: %FOOTBALL_DATA_KEY:~0,8%... (ocultada por seguranca)
echo.

REM Inicia o Proxy football-data.org em uma nova janela
echo  [2/3] Iniciando Proxy football-data.org (porta 3002)...
start "Proxy Copa 2026 [porta 3002]" cmd /k "node proxy/server.js"
timeout /t 2 /nobreak >nul

REM Inicia o servidor frontend em uma nova janela
echo  [3/3] Iniciando Frontend (porta 3001)...
start "Frontend Copa 2026 [porta 3001]" cmd /k "npx serve public -l 3001"
timeout /t 3 /nobreak >nul

echo.
echo  ===============================================
echo   TUDO PRONTO! Acesse no navegador:
echo   http://localhost:3001
echo  ===============================================
echo.
echo  Proximos passos:
echo  - O Frontend roda na porta 3001
echo  - O Proxy roda na porta 3002
echo  - Feche as janelas para encerrar os servicos
echo.
start "" "http://localhost:3001"
pause
