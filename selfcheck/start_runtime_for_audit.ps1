Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ProjectDir = Join-Path $RepoRoot 'local\workspace\Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c'
$StdOutLog = Join-Path $RepoRoot 'tmp_audit_launcher.out.log'
$StdErrLog = Join-Path $RepoRoot 'tmp_audit_launcher.err.log'
$Launcher = Join-Path $RepoRoot 'local\Horosa_Local_Windows.ps1'

function Remove-HorosaPidFiles {
  foreach ($name in @('.horosa_win_java.pid', '.horosa_win_py.pid', '.horosa_win_web.pid', '.horosa_win_warmup.pid')) {
    $path = Join-Path $ProjectDir $name
    if (Test-Path $path) {
      Remove-Item -Force $path -ErrorAction SilentlyContinue
    }
  }
}

function Stop-HorosaRuntime {
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

function Wait-ForHttpReady {
  param(
    [string]$Url,
    [int]$TimeoutSec = 45
  )

  if ([string]::IsNullOrWhiteSpace($Url)) {
    return $false
  }

  for ($i = 0; $i -lt $TimeoutSec; $i++) {
    try {
      $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($resp.StatusCode -eq 200) {
        return $true
      }
    } catch {}
    Start-Sleep -Seconds 1
  }

  return $false
}

foreach ($log in @($StdOutLog, $StdErrLog)) {
  if (Test-Path $log) {
    Remove-Item -Force $log -ErrorAction SilentlyContinue
  }
}

Stop-HorosaRuntime
Start-Sleep -Seconds 1
Remove-HorosaPidFiles

$env:HOROSA_NO_BROWSER = '1'
$env:HOROSA_PERF_MODE = '1'
$env:HOROSA_PERSIST_STACK = '1'
Remove-Item Env:HOROSA_SMOKE_TEST -ErrorAction SilentlyContinue
Remove-Item Env:HOROSA_SMOKE_WAIT_SECONDS -ErrorAction SilentlyContinue

$timer = [System.Diagnostics.Stopwatch]::StartNew()
$proc = Start-Process -FilePath 'powershell.exe' `
  -ArgumentList @('-ExecutionPolicy', 'Bypass', '-File', $Launcher) `
  -WorkingDirectory $RepoRoot `
  -RedirectStandardOutput $StdOutLog `
  -RedirectStandardError $StdErrLog `
  -PassThru

$readyUrl = Wait-ForLauncherReady -OutFile $StdOutLog
$timer.Stop()

if (-not $readyUrl) {
  throw "launcher did not reach Started (no-browser mode). See $StdOutLog and $StdErrLog"
}
if (-not (Wait-ForHttpReady -Url $readyUrl -TimeoutSec 45)) {
  throw "launcher reported a readyUrl but web root did not answer 200 in time: $readyUrl"
}

[pscustomobject]@{
  readyUrl = $readyUrl
  readyMs = $timer.ElapsedMilliseconds
  processId = $proc.Id
  stdoutLog = $StdOutLog
  stderrLog = $StdErrLog
} | ConvertTo-Json -Depth 4
