Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptRoot

function Resolve-LocalAppBase {
  $candidates = @()
  if (-not [string]::IsNullOrWhiteSpace([string]$env:HOROSA_DESKTOP_USER_ROOT)) {
    try {
      $configuredRoot = [System.IO.Path]::GetFullPath([string]$env:HOROSA_DESKTOP_USER_ROOT)
      $configuredParent = Split-Path -Parent $configuredRoot
      if (-not [string]::IsNullOrWhiteSpace($configuredParent)) {
        $candidates += $configuredParent
      }
    } catch {}
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$env:LocalAppData)) {
    $candidates += [string]$env:LocalAppData
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$env:UserProfile)) {
    $candidates += (Join-Path ([string]$env:UserProfile) 'AppData\Local')
  }
  $candidates += [System.IO.Path]::GetTempPath()
  foreach ($candidate in ($candidates | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)) {
    try {
      New-Item -ItemType Directory -Force -Path $candidate | Out-Null
      return (Resolve-Path $candidate).Path
    } catch {}
  }
  throw 'Unable to resolve writable local app data base directory.'
}

$LocalAppBase = Resolve-LocalAppBase
$DepsRoot = Join-Path $LocalAppBase 'HorosaDesktop\runtime-pydeps'
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
$env:HOROSA_DESKTOP_USER_ROOT = (Join-Path $LocalAppBase 'HorosaDesktop')

Start-Process -FilePath $PythonWExe -ArgumentList @($LauncherScript) -WorkingDirectory (Split-Path -Parent $LauncherScript) -WindowStyle Hidden | Out-Null
