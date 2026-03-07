@echo off
setlocal EnableExtensions

echo Horosa Windows one-click start

echo Only run this file. Do not open other scripts.
echo.
call "%~dp0local\Horosa_Local_Windows.bat" %*
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Startup failed.
  echo Please check:
  echo   %~dp0README.md
  echo   %~dp0docs\SELFCHECK_LOG.md
  echo   %~dp0log\HOROSA_RUN_ISSUES.md
)
endlocal & exit /b %EXIT_CODE%
