@echo off
setlocal EnableExtensions
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"
python "%ROOT%\SELF_CHECK_HOROSA_WINDOWS.py" %*
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Self-check failed. See the generated report directory in the JSON summary above.
)
endlocal & exit /b %EXIT_CODE%
