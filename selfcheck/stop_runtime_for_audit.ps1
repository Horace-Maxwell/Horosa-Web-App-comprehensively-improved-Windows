Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ProjectDir = Join-Path $RepoRoot 'local\workspace\Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c'
$Launcher = Join-Path $RepoRoot 'local\Horosa_Local_Windows.ps1'

function Remove-HorosaPidFiles {
  foreach ($name in @('.horosa_win_java.pid', '.horosa_win_py.pid', '.horosa_win_web.pid', '.horosa_win_warmup.pid')) {
    $path = Join-Path $ProjectDir $name
    if (Test-Path $path) {
      Remove-Item -Force $path -ErrorAction SilentlyContinue
    }
  }
}

$oldCleanupOnly = $env:HOROSA_CLEANUP_ONLY
try {
  $env:HOROSA_CLEANUP_ONLY = '1'
  Start-Process -FilePath 'powershell.exe' `
    -ArgumentList @('-ExecutionPolicy', 'Bypass', '-File', $Launcher) `
    -WorkingDirectory $RepoRoot `
    -WindowStyle Hidden `
    -Wait `
    -ErrorAction SilentlyContinue | Out-Null
} catch {}

if ($null -ne $oldCleanupOnly) {
  $env:HOROSA_CLEANUP_ONLY = $oldCleanupOnly
} else {
  Remove-Item Env:HOROSA_CLEANUP_ONLY -ErrorAction SilentlyContinue
}

Remove-HorosaPidFiles
