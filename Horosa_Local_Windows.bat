@echo off
setlocal EnableExtensions
set "ROOT=%~dp0"
if exist "%ROOT%runtime\windows\java\bin\java.exe" set "HOROSA_JAVA=%ROOT%runtime\windows\java\bin\java.exe"
if exist "%ROOT%runtime\windows\python\python.exe" set "HOROSA_PYTHON=%ROOT%runtime\windows\python\python.exe"
if exist "%LocalAppData%\Programs\Python\Python311\python.exe" set "HOROSA_PYTHON=%LocalAppData%\Programs\Python\Python311\python.exe"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Horosa_Local_Windows.ps1"
if errorlevel 1 (
  echo.
  echo Launcher failed. Press any key to exit.
  pause >nul
)
endlocal
