@echo off
title Registrar Bolão Copa 2026 na Inicialização
color 0A

REM Verifica se está rodando como Administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  [ERRO] Este script precisa ser executado como Administrador.
    echo.
    echo  Clique com o botão direito em REGISTRAR_INICIALIZACAO.bat
    echo  e selecione "Executar como administrador".
    echo.
    pause
    exit /b 1
)

REM Caminho absoluto do INICIAR.bat
set "PROJETO=%~dp0"
set "BAT_PATH=%PROJETO%INICIAR.bat"
set "TASK_NAME=BolaoCopaDoMundo2026"

echo.
echo  ===============================================
echo   REGISTRAR INICIALIZACAO AUTOMATICA
echo   Bolao Copa do Mundo 2026
echo  ===============================================
echo.
echo  Caminho do projeto: %PROJETO%
echo.

REM Remove tarefa antiga se existir
schtasks /Delete /TN "%TASK_NAME%" /F >nul 2>&1

REM Cria a tarefa no Agendador do Windows
REM - Roda ao login do usuario atual
REM - Inicia minimizado (sem janela em destaque)
REM - Com nivel mais alto de privilegios
schtasks /Create ^
  /TN "%TASK_NAME%" ^
  /TR "cmd /c \"%BAT_PATH%\"" ^
  /SC ONLOGON ^
  /DELAY 0000:30 ^
  /RL HIGHEST ^
  /F

if %errorLevel% equ 0 (
    echo.
    echo  ===============================================
    echo   [OK] Tarefa registrada com sucesso!
    echo  ===============================================
    echo.
    echo  Nome da tarefa : %TASK_NAME%
    echo  Executado em   : Login do Windows
    echo  Atraso         : 30 segundos apos o login
    echo  Arquivo        : %BAT_PATH%
    echo.
    echo  Da proxima vez que voce ligar o computador
    echo  e fazer login, o Bolao iniciara automaticamente
    echo  em 30 segundos.
    echo.
    echo  Para REMOVER a inicializacao automatica:
    echo  Execute o arquivo REMOVER_INICIALIZACAO.bat
    echo.
) else (
    echo.
    echo  [ERRO] Falha ao registrar a tarefa.
    echo  Tente executar como Administrador.
    echo.
)

pause
