@echo off
setlocal EnableExtensions EnableDelayedExpansion
set "ROOT=%~dp0"
if not defined HOROSA_JAVA if exist "%ROOT%runtime\windows\java\bin\java.exe" set "HOROSA_JAVA=%ROOT%runtime\windows\java\bin\java.exe"
if not defined HOROSA_PYTHON if exist "%ROOT%runtime\windows\python\python.exe" set "HOROSA_PYTHON=%ROOT%runtime\windows\python\python.exe"
if not defined HOROSA_PYTHON if exist "%LocalAppData%\Programs\Python\Python311\python.exe" set "HOROSA_PYTHON=%LocalAppData%\Programs\Python\Python311\python.exe"
if not defined HOROSA_PYTHON if exist "%LocalAppData%\Programs\Python\Python312\python.exe" set "HOROSA_PYTHON=%LocalAppData%\Programs\Python\Python312\python.exe"

set "PS_EXE="
if exist "%ProgramFiles%\PowerShell\7\pwsh.exe" set "PS_EXE=%ProgramFiles%\PowerShell\7\pwsh.exe"
if not defined PS_EXE if exist "%ProgramFiles(x86)%\PowerShell\7\pwsh.exe" set "PS_EXE=%ProgramFiles(x86)%\PowerShell\7\pwsh.exe"
if not defined PS_EXE for /f "delims=" %%I in ('where pwsh.exe 2^>nul') do if not defined PS_EXE set "PS_EXE=%%I"
if not defined PS_EXE set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

"%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Horosa_Local_Windows.ps1"
if errorlevel 1 (
  set "ISSUE_FILE=%ROOT%HOROSA_RUN_ISSUES.md"
  set "PROJECT_DIR="
  set "LATEST_LOG="

  for /f "delims=" %%D in ('dir /b /ad /o-n "%ROOT%Horosa-Web*" 2^>nul') do (
    if not defined PROJECT_DIR set "PROJECT_DIR=%ROOT%%%D"
  )
  if defined PROJECT_DIR (
    for /f "delims=" %%L in ('dir /b /ad /o-n "!PROJECT_DIR!\.horosa-local-logs-win" 2^>nul') do (
      if not defined LATEST_LOG set "LATEST_LOG=!PROJECT_DIR!\.horosa-local-logs-win\%%L"
    )
  )

  echo.
  echo Launcher failed.
  if exist "!ISSUE_FILE!" (
    echo Issue summary: !ISSUE_FILE!
  ) else (
    echo Issue summary file not found yet: !ISSUE_FILE!
  )
  if defined LATEST_LOG (
    echo Latest log dir: !LATEST_LOG!
  ) else (
    echo Latest log dir: not found
  )
  echo Press any key to exit.
  pause >nul
)
endlocal
