param(
  [switch]$KeepRuntime
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ResultsRoot = Join-Path $PSScriptRoot 'results'
$Timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$RunRoot = Join-Path $ResultsRoot ("fast_" + $Timestamp)
New-Item -ItemType Directory -Force -Path $RunRoot | Out-Null

$summary = [ordered]@{
  startedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  target = '2-minute-fast-selfcheck'
}

try {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()

  Write-Host '[1/2] Starting local audit runtime...'
  $startLog = Join-Path $RunRoot 'start-runtime.log'
  $startErr = Join-Path $RunRoot 'start-runtime.err.log'
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'start_runtime_for_audit.ps1') 1> $startLog 2> $startErr
  if ($LASTEXITCODE -ne 0) {
    throw "Runtime start failed. See $startLog and $startErr"
  }
  $startInfo = Get-Content $startLog -Raw | ConvertFrom-Json
  if ([string]::IsNullOrWhiteSpace([string]$startInfo.readyUrl)) {
    throw "Runtime start did not report a readyUrl. See $startLog"
  }
  $env:HOROSA_APP_URL = [string]$startInfo.readyUrl

  Write-Host '[2/2] Running fast UI smoke...'
  $uiLog = Join-Path $RunRoot 'ui-fast-smoke.json'
  $uiErr = Join-Path $RunRoot 'ui-fast-smoke.err.log'
  Push-Location $RepoRoot
  try {
    & node.exe '.\selfcheck\ui_fast_smoke.js' 1> $uiLog 2> $uiErr
  }
  finally {
    Pop-Location
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Fast UI smoke failed. See $uiLog and $uiErr"
  }

  $sw.Stop()
  $ui = Get-Content $uiLog -Raw | ConvertFrom-Json
  $filteredConsoleErrors = @($ui.consoleErrors | Where-Object { $_ -notmatch 'DOMNodeInserted' })
  $summary.finishedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  $summary.durationSeconds = [math]::Round($sw.Elapsed.TotalSeconds, 2)
  $summary.targetSeconds = 120
  $summary.meetsTwoMinuteTarget = $summary.durationSeconds -le 120
  $summary.rootTabsChecked = @($ui.results.rootTabs).Count
  $summary.representativesChecked = @($ui.results.representatives).Count
  $summary.topbar = $ui.results.topbar
  $summary.uiTimings = $ui.results.timings
  $summary.failures = @($ui.failures)
  $summary.failureCount = @($ui.failures).Count
  $summary.pageErrors = $ui.pageErrors
  $summary.consoleErrors = $filteredConsoleErrors
  $summary.status = if ($summary.failureCount -eq 0 -and @($ui.pageErrors).Count -eq 0 -and @($filteredConsoleErrors).Count -eq 0 -and $summary.meetsTwoMinuteTarget) { 'passed' } else { 'failed' }
}
catch {
  $summary.finishedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  $summary.status = 'failed'
  $summary.error = $_.Exception.Message
}
finally {
  if (-not $KeepRuntime) {
    try {
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'stop_runtime_for_audit.ps1') | Out-Null
    } catch {
    }
  }
  $summaryPath = Join-Path $RunRoot 'summary.json'
  ($summary | ConvertTo-Json -Depth 8) | Set-Content -Path $summaryPath -Encoding UTF8
  Write-Host ("[DONE] Summary: {0}" -f $summaryPath)
  if ($summary.status -ne 'passed') {
    exit 1
  }
}
