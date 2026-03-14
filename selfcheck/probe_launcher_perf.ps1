Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ProjectDir = Join-Path $RepoRoot 'local\workspace\Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c'
$StdOutLog = Join-Path $RepoRoot 'tmp_launcher_perf.out.log'
$StdErrLog = Join-Path $RepoRoot 'tmp_launcher_perf.err.log'
$PerfScript = Join-Path $ProjectDir 'astrostudyui\scripts\verifyHorosaPerformanceRuntime.js'

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

function Remove-HorosaPidFiles {
  foreach ($name in @('.horosa_win_java.pid', '.horosa_win_py.pid', '.horosa_win_web.pid', '.horosa_win_warmup.pid')) {
    $path = Join-Path $ProjectDir $name
    if (Test-Path $path) {
      Remove-Item -Force $path -ErrorAction SilentlyContinue
    }
  }
}

function Wait-ForLauncherReady {
  param(
    [string]$OutFile,
    [int]$TimeoutSec = 90
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

foreach ($log in @($StdOutLog, $StdErrLog)) {
  if (Test-Path $log) {
    Remove-Item -Force $log -ErrorAction SilentlyContinue
  }
}

Stop-HorosaPorts
Start-Sleep -Seconds 1
Remove-HorosaPidFiles

$startupTimer = [System.Diagnostics.Stopwatch]::StartNew()
$env:HOROSA_NO_BROWSER = '1'
$env:HOROSA_PERF_MODE = '1'
$env:HOROSA_SMOKE_TEST = '1'
$env:HOROSA_SMOKE_WAIT_SECONDS = '90'

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
  $startupTimer.Stop()
  Write-Output ("startup_ready_ms={0}" -f $startupTimer.ElapsedMilliseconds)
  Write-Output ("ready_url={0}" -f $readyUrl)

  $serverRoot = $null
  try {
    $readyUri = [System.Uri]$readyUrl
    foreach ($part in $readyUri.Query.TrimStart('?').Split('&', [System.StringSplitOptions]::RemoveEmptyEntries)) {
      if ($part -like 'srv=*') {
        $serverRoot = [System.Uri]::UnescapeDataString($part.Substring(4))
        break
      }
    }
  } catch {}
  if ([string]::IsNullOrWhiteSpace($serverRoot)) {
    throw "failed to parse srv query from ready url: $readyUrl"
  }
  $env:HOROSA_SERVER_ROOT = $serverRoot

  Write-Output '--- launcher stdout ---'
  Get-Content $StdOutLog -Tail 120
  Write-Output '--- launcher stderr ---'
  if (Test-Path $StdErrLog) {
    Get-Content $StdErrLog -Tail 120
  }

  Write-Output '--- perf after startup + 2s ---'
  Start-Sleep -Seconds 2
  & node $PerfScript
  Write-Output ("perf_exit_1={0}" -f $LASTEXITCODE)

  Write-Output '--- perf after background warmup + 18s ---'
  Start-Sleep -Seconds 18
  & node $PerfScript
  Write-Output ("perf_exit_2={0}" -f $LASTEXITCODE)
} finally {
  if ($launcher) {
    try { Stop-Process -Id $launcher.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
  Stop-HorosaPorts
  Remove-HorosaPidFiles
}

exit 0
