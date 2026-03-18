@echo off
setlocal EnableExtensions
for %%I in ("%~dp0.") do set "REPO_ROOT=%%~fI"
set "HOROSA_REPO_ROOT=%REPO_ROOT%"
if not defined HOROSA_WORKSPACE_DIR set "HOROSA_WORKSPACE_DIR=%REPO_ROOT%\local\workspace"

echo Horosa Windows one-click start

echo Only run this file. Do not open other scripts.
echo.
call "%REPO_ROOT%\local\Horosa_Local_Windows.bat" %*
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Startup failed.
  echo Please check:
  echo   %REPO_ROOT%\README.md
  echo   %REPO_ROOT%\docs\SELFCHECK_LOG.md
  echo   %REPO_ROOT%\log\HOROSA_RUN_ISSUES.md
)
endlocal & exit /b %EXIT_CODE%
