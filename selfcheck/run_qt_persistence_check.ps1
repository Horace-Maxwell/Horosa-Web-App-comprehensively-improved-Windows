Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ProjectDir = Join-Path $RepoRoot 'local\workspace\Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c'
$StdOutLog = Join-Path $RepoRoot 'tmp_qt_persist.out.log'
$StdErrLog = Join-Path $RepoRoot 'tmp_qt_persist.err.log'
$ResultFile = Join-Path $PSScriptRoot 'results\qt_persistence_check.json'
$ProfileRoot = Join-Path $RepoRoot 'selfcheck\results\qt-persist-profile'

function Remove-HorosaPidFiles {
  foreach ($name in @('.horosa_win_java.pid', '.horosa_win_py.pid', '.horosa_win_web.pid', '.horosa_win_warmup.pid')) {
    $path = Join-Path $ProjectDir $name
    if (Test-Path $path) {
      Remove-Item -Force $path -ErrorAction SilentlyContinue
    }
  }
}

function Stop-HorosaPorts {
  $oldCleanupOnly = $env:HOROSA_CLEANUP_ONLY
  try {
    $env:HOROSA_CLEANUP_ONLY = '1'
    Start-Process -FilePath 'powershell.exe' `
      -ArgumentList @('-ExecutionPolicy', 'Bypass', '-File', (Join-Path $RepoRoot 'local\Horosa_Local_Windows.ps1')) `
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
}

function Wait-ForLauncherReady {
  param(
    [string]$OutFile,
    [int]$TimeoutSec = 120
  )

  for ($i = 0; $i -lt ($TimeoutSec * 2); $i++) {
    Start-Sleep -Milliseconds 500
    if (-not (Test-Path $OutFile)) { continue }
    $text = Get-Content $OutFile -Raw -ErrorAction SilentlyContinue
    if ($text -match 'Started \(no-browser mode\):\s*(?<url>https?://\S+)') {
      return $Matches.url
    }
    if ($text -match 'Startup failed:') {
      return $null
    }
  }
  return $null
}

foreach ($log in @($StdOutLog, $StdErrLog, $ResultFile)) {
  if (Test-Path $log) {
    Remove-Item -Force $log -ErrorAction SilentlyContinue
  }
}
if (Test-Path $ProfileRoot) {
  Remove-Item -Recurse -Force $ProfileRoot -ErrorAction SilentlyContinue
}

Stop-HorosaPorts
Start-Sleep -Seconds 1
Remove-HorosaPidFiles

$env:HOROSA_NO_BROWSER = '1'
$env:HOROSA_PERF_MODE = '1'
$env:HOROSA_PERSIST_STACK = '1'
$env:HOROSA_SMOKE_TEST = '1'
$env:HOROSA_SMOKE_WAIT_SECONDS = '120'

$launcher = $null
try {
  $launcher = Start-Process -FilePath 'powershell.exe' `
    -ArgumentList @('-ExecutionPolicy', 'Bypass', '-File', (Join-Path $RepoRoot 'local\Horosa_Local_Windows.ps1')) `
    -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput $StdOutLog `
    -RedirectStandardError $StdErrLog `
    -PassThru

  $readyUrl = Wait-ForLauncherReady -OutFile $StdOutLog
  if (-not $readyUrl) {
    throw 'launcher did not reach Started (no-browser mode)'
  }

  & node (Join-Path $RepoRoot 'selfcheck\verify_ui_state_persistence.js') $readyUrl $ProfileRoot 1> $ResultFile
  if ($LASTEXITCODE -ne 0) {
    throw "UI state persistence check failed. See $ResultFile"
  }
}
finally {
  if ($launcher) {
    try { Stop-Process -Id $launcher.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
  Stop-HorosaPorts
  Remove-HorosaPidFiles
}
