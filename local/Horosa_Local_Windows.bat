@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Horosa Windows Stable Launcher
for %%I in ("%~dp0.") do set "ROOT=%%~fI"
set "WORKSPACE=%ROOT%\workspace"
if defined HOROSA_WORKSPACE_DIR set "WORKSPACE=%HOROSA_WORKSPACE_DIR%"
if not "%WORKSPACE:~-1%"=="\" set "WORKSPACE=%WORKSPACE%\"
if not defined HOROSA_WORKSPACE_DIR if exist "%WORKSPACE%" set "HOROSA_WORKSPACE_DIR=%WORKSPACE%"

if not defined HOROSA_PROJECT_DIR (
  if exist "%WORKSPACE%HOROSA_PROJECT_DIR.txt" (
    for /f "usebackq delims=" %%I in ("%WORKSPACE%HOROSA_PROJECT_DIR.txt") do (
      if not defined HOROSA_PROJECT_DIR if not "%%~I"=="" if not "%%~I"=="# Horosa current project pointer" if not "%%~I"=="# Relative child folder name or absolute path" (
        set "POINTER_VALUE=%%~I"
        if exist "!POINTER_VALUE!\astrostudyui" if exist "!POINTER_VALUE!\astrostudysrv" if exist "!POINTER_VALUE!\astropy" (
          set "HOROSA_PROJECT_DIR=!POINTER_VALUE!"
        ) else if exist "%WORKSPACE%!POINTER_VALUE!\astrostudyui" if exist "%WORKSPACE%!POINTER_VALUE!\astrostudysrv" if exist "%WORKSPACE%!POINTER_VALUE!\astropy" (
          set "HOROSA_PROJECT_DIR=%WORKSPACE%!POINTER_VALUE!"
        )
      )
    )
  )
)
if not defined HOROSA_PROJECT_DIR (
  for /d %%D in ("%WORKSPACE%*") do (
    if not defined HOROSA_PROJECT_DIR if exist "%%~fD\astrostudyui" if exist "%%~fD\astrostudysrv" if exist "%%~fD\astropy" (
      set "HOROSA_PROJECT_DIR=%%~fD"
    )
  )
)

if not defined HOROSA_JAVA if exist "%WORKSPACE%\runtime\windows\java\bin\java.exe" set "HOROSA_JAVA=%WORKSPACE%\runtime\windows\java\bin\java.exe"
if not defined HOROSA_PYTHON if exist "%WORKSPACE%\runtime\windows\python\python.exe" set "HOROSA_PYTHON=%WORKSPACE%\runtime\windows\python\python.exe"
if not defined HOROSA_PYTHON if exist "%LocalAppData%\Programs\Python\Python311\python.exe" set "HOROSA_PYTHON=%LocalAppData%\Programs\Python\Python311\python.exe"
if not defined HOROSA_PYTHON if exist "%LocalAppData%\Programs\Python\Python312\python.exe" set "HOROSA_PYTHON=%LocalAppData%\Programs\Python\Python312\python.exe"

set "PS_EXE="
if exist "%ProgramFiles%\PowerShell\7\pwsh.exe" set "PS_EXE=%ProgramFiles%\PowerShell\7\pwsh.exe"
if not defined PS_EXE if exist "%ProgramFiles(x86)%\PowerShell\7\pwsh.exe" set "PS_EXE=%ProgramFiles(x86)%\PowerShell\7\pwsh.exe"
if not defined PS_EXE for /f "delims=" %%I in ('where pwsh.exe 2^>nul') do if not defined PS_EXE set "PS_EXE=%%I"
if not defined PS_EXE set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

set "HOROSA_REPO_ROOT=%ROOT%\.."
"%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\Horosa_Local_Windows.ps1" %*
if errorlevel 1 (
  set "ISSUE_FILE=%ROOT%\..\log\HOROSA_RUN_ISSUES.md"
  set "PROJECT_DIR=%HOROSA_PROJECT_DIR%"
  set "LATEST_LOG="

  if not defined PROJECT_DIR (
    for /f "delims=" %%D in ('dir /b /ad /o-n "%WORKSPACE%Horosa-Web*" 2^>nul') do (
      if not defined PROJECT_DIR set "PROJECT_DIR=%WORKSPACE%%%D"
    )
  )
  if defined PROJECT_DIR (
    for /f "delims=" %%L in ('dir /b /ad /o-n "!PROJECT_DIR!\.horosa-local-logs-win" 2^>nul') do (
      if not defined LATEST_LOG set "LATEST_LOG=!PROJECT_DIR!\.horosa-local-logs-win\%%L"
    )
  )

  echo.
  echo Launcher failed.
  echo Launcher channel: stable
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
