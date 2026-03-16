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

function Wait-ForPortReady {
  param(
    [string]$TargetHost = '127.0.0.1',
    [int]$Port,
    [int]$TimeoutSec = 45
  )

  if ($Port -lt 1 -or $Port -gt 65535) {
    return $false
  }

  for ($i = 0; $i -lt $TimeoutSec; $i++) {
    $client = $null
    try {
      $client = New-Object System.Net.Sockets.TcpClient
      $iar = $client.BeginConnect($TargetHost, $Port, $null, $null)
      if ($iar.AsyncWaitHandle.WaitOne(1000, $false) -and $client.Connected) {
        $client.EndConnect($iar)
        return $true
      }
    } catch {
    } finally {
      if ($client) {
        try { $client.Close() } catch {}
      }
    }
    Start-Sleep -Seconds 1
  }

  return $false
}

function Convert-ReadyQueryToMap {
  param(
    [string]$Query
  )

  $map = @{}
  if ([string]::IsNullOrWhiteSpace($Query)) {
    return $map
  }

  $text = $Query.TrimStart('?')
  if ([string]::IsNullOrWhiteSpace($text)) {
    return $map
  }

  foreach ($pair in ($text -split '&')) {
    if ([string]::IsNullOrWhiteSpace($pair)) {
      continue
    }
    $parts = $pair -split '=', 2
    $rawKey = if ($parts.Length -ge 1) { $parts[0] } else { '' }
    if ([string]::IsNullOrWhiteSpace($rawKey)) {
      continue
    }
    $rawValue = if ($parts.Length -ge 2) { $parts[1] } else { '' }
    $key = [System.Uri]::UnescapeDataString(($rawKey -replace '\+', ' '))
    $value = [System.Uri]::UnescapeDataString(($rawValue -replace '\+', ' '))
    $map[$key] = $value
  }

  return $map
}

foreach ($log in @($StdOutLog, $StdErrLog)) {
  if (Test-Path $log) {
    Remove-Item -Force $log -ErrorAction SilentlyContinue
  }
}

Stop-HorosaRuntime
Start-Sleep -Seconds 1
Remove-HorosaPidFiles

$basePort = Get-Random -Minimum 18000 -Maximum 50000
$env:HOROSA_WEB_PORT = "$basePort"
$env:HOROSA_CHART_PORT = "$($basePort + 899)"
$env:HOROSA_SERVER_PORT = "$($basePort + 1999)"
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

try {
  $readyUri = [System.Uri]$readyUrl
  $query = Convert-ReadyQueryToMap -Query $readyUri.Query
  foreach ($serviceKey in @('srv', 'chart')) {
    $serviceUrl = $query[$serviceKey]
    if ([string]::IsNullOrWhiteSpace($serviceUrl)) {
      continue
    }
    try {
      $serviceUri = [System.Uri]$serviceUrl
      if (-not (Wait-ForPortReady -TargetHost $serviceUri.Host -Port $serviceUri.Port -TimeoutSec 45)) {
        throw "runtime reported $serviceKey=$serviceUrl but port did not open in time"
      }
    } catch {
      throw $_
    }
  }
  Start-Sleep -Milliseconds 1500
} catch {
  throw "runtime readyUrl dependencies not ready: $($_.Exception.Message)"
}

$resultJson = ([pscustomobject]@{
  readyUrl = $readyUrl
  readyMs = $timer.ElapsedMilliseconds
  processId = $proc.Id
  stdoutLog = $StdOutLog
  stderrLog = $StdErrLog
} | ConvertTo-Json -Depth 4)

[Console]::Out.WriteLine($resultJson)
