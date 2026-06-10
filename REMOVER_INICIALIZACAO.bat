@echo off
title Remover Bolão Copa 2026 da Inicialização
color 0C

REM Verifica se está rodando como Administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  [ERRO] Este script precisa ser executado como Administrador.
    echo.
    echo  Clique com o botão direito em REMOVER_INICIALIZACAO.bat
    echo  e selecione "Executar como administrador".
    echo.
    pause
    exit /b 1
)

set "TASK_NAME=BolaoCopaDoMundo2026"

echo.
echo  ===============================================
echo   REMOVER INICIALIZACAO AUTOMATICA
echo   Bolao Copa do Mundo 2026
echo  ===============================================
echo.

schtasks /Delete /TN "%TASK_NAME%" /F >nul 2>&1

if %errorLevel% equ 0 (
    echo.
    echo  ===============================================
    echo   [OK] Inicializacao automatica removida!
    echo  ===============================================
    echo.
    echo  A tarefa "%TASK_NAME%" foi excluida do Windows.
    echo  O Bolao nao iniciara mais junto com o sistema.
    echo.
) else (
    echo.
    echo  [AVISO] Nenhuma tarefa encontrada com o nome:
    echo  "%TASK_NAME%"
    echo.
    echo  A inicializacao automatica ja deve estar desativada.
    echo.
)

pause
