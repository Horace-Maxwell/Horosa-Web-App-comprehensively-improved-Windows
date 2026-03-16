param(
  [string]$AppRoot = "$env:LocalAppData\Horosa\Xingque App",
  [switch]$KeepRunning
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ResultsRoot = Join-Path $PSScriptRoot 'results'
$Timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$RunRoot = Join-Path $ResultsRoot ("installed_gate_" + $Timestamp)
$LauncherPath = Join-Path $AppRoot 'desktop_installer_bundle\Xingque.exe'
$LauncherLog = Join-Path $env:LocalAppData 'HorosaDesktop\runtime-logs\desktop-launcher.log'
$UiComprehensiveJson = Join-Path $RunRoot 'ui-comprehensive.json'
$UiComprehensiveErr = Join-Path $RunRoot 'ui-comprehensive.err.log'
$TargetedJson = Join-Path $RunRoot 'ui-targeted.json'
$TargetedErr = Join-Path $RunRoot 'ui-targeted.err.log'
$PersistenceJson = Join-Path $RunRoot 'persistence.json'
$PersistenceErr = Join-Path $RunRoot 'persistence.err.log'
$PerfJson = Join-Path $RunRoot 'perf.json'
$PerfErr = Join-Path $RunRoot 'perf.err.log'
$SummaryJson = Join-Path $RunRoot 'summary.json'
$ProfileRoot = Join-Path $RunRoot 'profile'
$PerfScript = Join-Path $RepoRoot 'local\workspace\Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c\astrostudyui\scripts\verifyHorosaPerformanceRuntime.js'

New-Item -ItemType Directory -Force -Path $RunRoot | Out-Null

function Stop-InstalledAppProcesses {
  param([string]$Root)
  $rootNeedle = [regex]::Escape($Root)
  $procs = Get-CimInstance Win32_Process | Where-Object {
    ($_.ExecutablePath -and $_.ExecutablePath -like "$Root*") -or
    ($_.CommandLine -and $_.CommandLine -match $rootNeedle)
  }
  foreach ($proc in $procs) {
    try {
      Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    } catch {
    }
  }
}

function Wait-ForReadyUrl {
  param(
    [string]$LogPath,
    [datetime]$NotBefore,
    [int]$TimeoutSec = 90
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
    if (-not (Test-Path $LogPath)) {
      continue
    }
    $lines = Get-Content $LogPath -ErrorAction SilentlyContinue
    if (-not $lines) {
      continue
    }
    $started = @($lines | Where-Object { $_ -match '^\[(?<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\].*Started \(no-browser mode\):\s*(?<url>https?://\S+)' })
    [array]::Reverse($started)
    foreach ($line in $started) {
      if ($line -match '^\[(?<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\].*Started \(no-browser mode\):\s*(?<url>https?://\S+)') {
        $ts = [datetime]::ParseExact($Matches.ts, 'yyyy-MM-dd HH:mm:ss', [System.Globalization.CultureInfo]::InvariantCulture)
        if ($ts -ge $NotBefore.AddSeconds(-1)) {
          return $Matches.url
        }
      }
    }
  }
  return $null
}

function Parse-ServerRoot {
  param([string]$ReadyUrl)
  $uri = [System.Uri]$ReadyUrl
  foreach ($part in $uri.Query.TrimStart('?').Split('&', [System.StringSplitOptions]::RemoveEmptyEntries)) {
    if ($part -like 'srv=*') {
      return [System.Uri]::UnescapeDataString($part.Substring(4))
    }
  }
  return $null
}

function Read-JsonFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    return $null
  }
  return Get-Content $Path -Raw | ConvertFrom-Json
}

function Filter-ConsoleErrors {
  param($Items)
  return @($Items | Where-Object {
      $_ -notmatch 'DOMNodeInserted' -and
      $_ -notmatch 'ERR_CONNECTION_REFUSED'
    })
}

if (-not (Test-Path $LauncherPath -PathType Leaf)) {
  throw "Installed launcher not found: $LauncherPath"
}

$summary = [ordered]@{
  startedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  appRoot = $AppRoot
  launcher = $LauncherPath
  target = 'installed-app-5min-gate'
}

$launcher = $null
try {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  Stop-InstalledAppProcesses -Root $AppRoot
  Start-Sleep -Seconds 2

  $launchStart = Get-Date
  $launcher = Start-Process -FilePath $LauncherPath -WorkingDirectory (Split-Path $LauncherPath) -PassThru
  $readyUrl = Wait-ForReadyUrl -LogPath $LauncherLog -NotBefore $launchStart
  if ([string]::IsNullOrWhiteSpace($readyUrl)) {
    throw "Installed app did not emit a ready URL. See $LauncherLog"
  }
  $summary.readyUrl = $readyUrl
  $summary.serverRoot = Parse-ServerRoot -ReadyUrl $readyUrl
  $summary.startupMs = $sw.ElapsedMilliseconds

  $env:HOROSA_APP_URL = $readyUrl
  $env:HOROSA_PERF_JSON = $PerfJson
  $env:HOROSA_SERVER_ROOT = $summary.serverRoot

  Push-Location $RepoRoot
  try {
    & node.exe '.\selfcheck\ui_comprehensive_audit.js' 1> $UiComprehensiveJson 2> $UiComprehensiveErr
    if ($LASTEXITCODE -ne 0) {
      throw "ui_comprehensive_audit failed. See $UiComprehensiveJson and $UiComprehensiveErr"
    }

    & node.exe '.\selfcheck\ui_targeted_regression.js' 1> $TargetedJson 2> $TargetedErr
    if ($LASTEXITCODE -ne 0) {
      throw "ui_targeted_regression failed. See $TargetedJson and $TargetedErr"
    }

    & node.exe '.\selfcheck\verify_ui_state_persistence.js' $readyUrl $ProfileRoot 1> $PersistenceJson 2> $PersistenceErr
    if ($LASTEXITCODE -ne 0) {
      throw "verify_ui_state_persistence failed. See $PersistenceJson and $PersistenceErr"
    }

    & node.exe $PerfScript 2> $PerfErr
    if ($LASTEXITCODE -ne 0) {
      throw "verifyHorosaPerformanceRuntime failed. See $PerfJson and $PerfErr"
    }
  }
  finally {
    Pop-Location
  }

  $uiComprehensive = Read-JsonFile -Path $UiComprehensiveJson
  $targeted = Read-JsonFile -Path $TargetedJson
  $persistence = Read-JsonFile -Path $PersistenceJson
  $perf = Read-JsonFile -Path $PerfJson

  $filteredUiConsole = Filter-ConsoleErrors -Items $uiComprehensive.consoleErrors
  $filteredTargetedConsole = Filter-ConsoleErrors -Items $targeted.consoleErrors

  $summary.finishedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  $summary.durationSeconds = [math]::Round($sw.Elapsed.TotalSeconds, 2)
  $summary.meetsFiveMinuteTarget = $summary.durationSeconds -le 300
  $summary.uiAudit = [ordered]@{
    failureCount = @($uiComprehensive.failures).Count
    pageErrorCount = @($uiComprehensive.pageErrors).Count
    consoleErrorCount = @($filteredUiConsole).Count
    actionCount = $uiComprehensive.totals.actions
    slowActionCount = $uiComprehensive.totals.slowActions
  }
  $summary.targeted = [ordered]@{
    primaryDirection = $targeted.primaryDirection.ok
    cnYiBuTabs = $targeted.cnYiBuTabs.ok
    liuRengScroll = $targeted.liuRengScroll.ok
    pageErrorCount = @($targeted.pageErrors).Count
    consoleErrorCount = @($filteredTargetedConsole).Count
  }
  $summary.persistence = [ordered]@{
    ok = [bool]$persistence.ok
    suzhanSelected = $persistence.readResult.suzhanSelected
    liurengSelected = $persistence.readResult.liurengSelected
  }
  $summary.performance = [ordered]@{
    status = $perf.status
    failingScenarios = @($perf.failingScenarios).Count
    failingModules = @($perf.failingModules).Count
    slowestScenario = $perf.slowestScenario
  }
  $summary.status =
    if (
      $summary.meetsFiveMinuteTarget -and
      $summary.uiAudit.failureCount -eq 0 -and
      $summary.uiAudit.pageErrorCount -eq 0 -and
      $summary.uiAudit.consoleErrorCount -eq 0 -and
      $summary.targeted.primaryDirection -and
      $summary.targeted.cnYiBuTabs -and
      $summary.targeted.liuRengScroll -and
      $summary.targeted.pageErrorCount -eq 0 -and
      $summary.targeted.consoleErrorCount -eq 0 -and
      $summary.persistence.ok -and
      $summary.performance.status -eq 'ok'
    ) { 'passed' } else { 'failed' }
}
catch {
  $summary.finishedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  $summary.status = 'failed'
  $summary.error = $_.Exception.Message
}
finally {
  if (-not $KeepRunning) {
    Stop-InstalledAppProcesses -Root $AppRoot
  }
  ($summary | ConvertTo-Json -Depth 8) | Set-Content -Path $SummaryJson -Encoding UTF8
  Write-Host ("[DONE] Summary: {0}" -f $SummaryJson)
  if ($summary.status -ne 'passed') {
    exit 1
  }
}
