Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptRoot
$DepsRoot = Join-Path $env:LocalAppData 'HorosaDesktop\runtime-pydeps'
$PythonWExe = Join-Path $RepoRoot 'local\workspace\runtime\windows\python\pythonw.exe'
$LauncherScript = Join-Path $ScriptRoot 'src\horosa_desktop.pyw'

if (-not (Test-Path $PythonWExe)) {
  throw "pythonw.exe not found: $PythonWExe"
}

if (-not (Test-Path $LauncherScript)) {
  throw "Launcher script not found: $LauncherScript"
}

if (-not (Test-Path $DepsRoot)) {
  throw "Desktop dependency root not found: $DepsRoot"
}

$env:PYTHONPATH = $DepsRoot
$env:HOROSA_INSTALLED_APP = '1'
$quotedLauncherScript = '"' + $LauncherScript + '"'

Start-Process -FilePath $PythonWExe -ArgumentList @($quotedLauncherScript) -WorkingDirectory (Split-Path -Parent $LauncherScript) -WindowStyle Hidden | Out-Null

