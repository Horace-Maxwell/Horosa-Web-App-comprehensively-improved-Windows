param(
  [switch]$KeepRuntime
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ResultsRoot = Join-Path $PSScriptRoot 'results'
$Timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$RunRoot = Join-Path $ResultsRoot ("fast3_" + $Timestamp)
New-Item -ItemType Directory -Force -Path $RunRoot | Out-Null

$summary = [ordered]@{
  startedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  target = '3-minute-fast-selfcheck'
}

function Invoke-ProcessAndCapture {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$StdOutPath,
    [string]$StdErrPath,
    [string]$WorkingDirectory,
    [int]$TimeoutMs
  )

  if (Test-Path $StdOutPath) { Remove-Item -Force $StdOutPath -ErrorAction SilentlyContinue }
  if (Test-Path $StdErrPath) { Remove-Item -Force $StdErrPath -ErrorAction SilentlyContinue }

  $proc = Start-Process -FilePath $FilePath `
    -ArgumentList $ArgumentList `
    -WorkingDirectory $WorkingDirectory `
    -RedirectStandardOutput $StdOutPath `
    -RedirectStandardError $StdErrPath `
    -PassThru

  if (-not $proc.WaitForExit($TimeoutMs)) {
    try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
    throw "Process timeout after ${TimeoutMs}ms: $FilePath $($ArgumentList -join ' ')"
  }

  return $proc.ExitCode
}

function Get-ReadyUrlFromState {
  param([datetime]$NotBefore)

  $statePath = Join-Path $env:USERPROFILE '.horosa-desktop\runtime-stack.json'
  if (-not (Test-Path $statePath -PathType Leaf)) {
    return $null
  }

  $item = Get-Item $statePath -ErrorAction SilentlyContinue
  if (-not $item -or $item.LastWriteTime -lt $NotBefore.AddSeconds(-1)) {
    return $null
  }

  try {
    $state = Get-Content $statePath -Raw | ConvertFrom-Json
    return [string]$state.Url
  } catch {
    return $null
  }
}

function Get-ReadyUrlFromLauncherLog {
  $launcherLog = Join-Path $RepoRoot 'tmp_audit_launcher.out.log'
  if (-not (Test-Path $launcherLog -PathType Leaf)) {
    return $null
  }

  $text = Get-Content $launcherLog -Raw -ErrorAction SilentlyContinue
  if ($text -match 'Started \(no-browser mode\):\s*(?<url>https?://\S+)') {
    return $Matches.url
  }
  return $null
}

function Wait-ForHttpReady {
  param(
    [string]$Url,
    [int]$TimeoutSec = 30
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

function Test-ActionableClientError {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $false
  }

  $ignoredPatterns = @(
    'DOMNodeInserted',
    'ERR_CONNECTION_REFUSED'
  )

  foreach ($pattern in $ignoredPatterns) {
    if ($Text -match $pattern) {
      return $false
    }
  }

  return $true
}

function Get-OptionalCollection {
  param(
    $Object,
    [string]$PropertyName
  )

  if ($null -eq $Object) {
    return ,@()
  }

  $prop = $Object.PSObject.Properties[$PropertyName]
  if ($null -eq $prop) {
    return ,@()
  }

  return ,@($prop.Value)
}

function Get-ActionableUiSmokeState {
  param([string]$JsonPath)

  if (-not (Test-Path $JsonPath -PathType Leaf)) {
    return $null
  }

  try {
    $ui = Get-Content $JsonPath -Raw | ConvertFrom-Json
  } catch {
    return $null
  }

  $failures = @($ui.failures)
  $actionablePageErrors = Get-OptionalCollection -Object $ui -PropertyName 'actionablePageErrors'
  $actionableConsoleErrors = Get-OptionalCollection -Object $ui -PropertyName 'actionableConsoleErrors'
  $pageErrors = if ($actionablePageErrors.Count -gt 0) {
    $actionablePageErrors
  } else {
    @($ui.pageErrors | Where-Object { Test-ActionableClientError $_ })
  }
  $consoleErrors = if ($actionableConsoleErrors.Count -gt 0) {
    $actionableConsoleErrors
  } else {
    @($ui.consoleErrors | Where-Object { Test-ActionableClientError $_ })
  }

  [pscustomobject]@{
    ui = $ui
    isClean = (@($failures).Count -eq 0 -and @($pageErrors).Count -eq 0 -and @($consoleErrors).Count -eq 0)
  }
}

function Get-TargetedRegressionState {
  param([string]$JsonPath)

  if (-not (Test-Path $JsonPath -PathType Leaf)) {
    return $null
  }

  try {
    $targeted = Get-Content $JsonPath -Raw | ConvertFrom-Json
  } catch {
    return $null
  }

  $actionablePageErrors = Get-OptionalCollection -Object $targeted -PropertyName 'actionablePageErrors'
  $actionableConsoleErrors = Get-OptionalCollection -Object $targeted -PropertyName 'actionableConsoleErrors'
  $actionableFailedResponses = Get-OptionalCollection -Object $targeted -PropertyName 'actionableFailedResponses'
  $actionableFailedRequests = Get-OptionalCollection -Object $targeted -PropertyName 'actionableFailedRequests'
  $pageErrors = if ($actionablePageErrors.Count -gt 0) {
    $actionablePageErrors
  } else {
    @($targeted.pageErrors | Where-Object { Test-ActionableClientError $_ })
  }
  $consoleErrors = if ($actionableConsoleErrors.Count -gt 0) {
    $actionableConsoleErrors
  } else {
    @($targeted.consoleErrors | Where-Object { Test-ActionableClientError $_ })
  }
  $responseFailures = if ($actionableFailedResponses.Count -gt 0) {
    $actionableFailedResponses
  } else {
    @($targeted.failedResponses)
  }
  $requestFailures = if ($actionableFailedRequests.Count -gt 0) {
    $actionableFailedRequests
  } else {
    @($targeted.failedRequests)
  }

  [pscustomobject]@{
    targeted = $targeted
    isClean = (
      $targeted.primaryDirection.ok -and
      $targeted.cnYiBuTabs.ok -and
      $targeted.liuRengScroll.ok -and
      @($pageErrors).Count -eq 0 -and
      @($consoleErrors).Count -eq 0 -and
      @($responseFailures).Count -eq 0 -and
      @($requestFailures).Count -eq 0
    )
  }
}

try {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()

  Write-Host '[1/3] Starting local audit runtime...'
  $startLog = Join-Path $RunRoot 'start-runtime.log'
  $startErr = Join-Path $RunRoot 'start-runtime.err.log'
  $statePath = Join-Path $env:USERPROFILE '.horosa-desktop\runtime-stack.json'
  if (Test-Path $statePath) {
    Remove-Item -Force $statePath -ErrorAction SilentlyContinue
  }
  $startedAt = Get-Date
  $startExit = Invoke-ProcessAndCapture `
    -FilePath 'powershell.exe' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'start_runtime_for_audit.ps1')) `
    -StdOutPath $startLog `
    -StdErrPath $startErr `
    -WorkingDirectory $RepoRoot `
    -TimeoutMs 180000
  Start-Sleep -Milliseconds 400

  $readyUrl = $null
  if (Test-Path $startLog) {
    $raw = Get-Content $startLog -Raw
    if (-not [string]::IsNullOrWhiteSpace($raw)) {
      try {
        $startInfo = $raw | ConvertFrom-Json
        $readyUrl = [string]$startInfo.readyUrl
      } catch {
      }
    }
  }
  if ([string]::IsNullOrWhiteSpace($readyUrl)) {
    $readyUrl = Get-ReadyUrlFromState -NotBefore $startedAt
  }
  if ([string]::IsNullOrWhiteSpace($readyUrl)) {
    $readyUrl = Get-ReadyUrlFromLauncherLog
  }
  if ([string]::IsNullOrWhiteSpace($readyUrl)) {
    if ($startExit -ne 0) {
      throw "Runtime start failed. See $startLog and $startErr"
    }
    throw "Runtime start did not report a readyUrl. See $startLog"
  }
  if (-not (Wait-ForHttpReady -Url $readyUrl -TimeoutSec 30)) {
    throw "Runtime readyUrl did not answer 200 in time: $readyUrl"
  }
  $env:HOROSA_APP_URL = $readyUrl

  Write-Host '[2/3] Running fast UI smoke...'
  $uiLog = Join-Path $RunRoot 'ui-fast-smoke.json'
  $uiErr = Join-Path $RunRoot 'ui-fast-smoke.err.log'
  $uiExit = Invoke-ProcessAndCapture `
    -FilePath 'node.exe' `
    -ArgumentList @('.\selfcheck\ui_fast_smoke.js') `
    -StdOutPath $uiLog `
    -StdErrPath $uiErr `
    -WorkingDirectory $RepoRoot `
    -TimeoutMs 150000
  $uiState = Get-ActionableUiSmokeState -JsonPath $uiLog
  if ($uiExit -ne 0) {
    if ($null -eq $uiState -or -not $uiState.isClean) {
      throw "Fast UI smoke failed. See $uiLog and $uiErr"
    }
  }

  Write-Host '[3/3] Running targeted regressions...'
  $targetedLog = Join-Path $RunRoot 'ui-targeted.json'
  $targetedErr = Join-Path $RunRoot 'ui-targeted.err.log'
  $targetedExit = Invoke-ProcessAndCapture `
    -FilePath 'node.exe' `
    -ArgumentList @('.\selfcheck\ui_targeted_regression.js') `
    -StdOutPath $targetedLog `
    -StdErrPath $targetedErr `
    -WorkingDirectory $RepoRoot `
    -TimeoutMs 150000
  $targetedState = Get-TargetedRegressionState -JsonPath $targetedLog
  if ($targetedExit -ne 0) {
    if ($null -eq $targetedState -or -not $targetedState.isClean) {
      throw "Targeted regression failed. See $targetedLog and $targetedErr"
    }
  }

  $sw.Stop()
  $ui = if ($null -ne $uiState) { $uiState.ui } else { Get-Content $uiLog -Raw | ConvertFrom-Json }
  $targeted = if ($null -ne $targetedState) { $targetedState.targeted } else { Get-Content $targetedLog -Raw | ConvertFrom-Json }
  $filteredConsoleErrors = @($ui.consoleErrors | Where-Object { Test-ActionableClientError $_ })
  $filteredPageErrors = @($ui.pageErrors | Where-Object { Test-ActionableClientError $_ })
  $summary.finishedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  $summary.durationSeconds = [math]::Round($sw.Elapsed.TotalSeconds, 2)
  $summary.targetSeconds = 180
  $summary.meetsThreeMinuteTarget = $summary.durationSeconds -le 180
  $summary.rootTabsChecked = @($ui.results.rootTabs).Count
  $summary.representativesChecked = @($ui.results.representatives).Count
  $summary.failureCount = @($ui.failures).Count
  $summary.uiTimings = $ui.results.timings
  $summary.targeted = [ordered]@{
    primaryDirection = $targeted.primaryDirection.ok
    cnYiBuTabs = $targeted.cnYiBuTabs.ok
    liuRengScroll = $targeted.liuRengScroll.ok
  }
  $summary.pageErrors = $filteredPageErrors
  $summary.consoleErrors = $filteredConsoleErrors
  $summary.status = if (
    $summary.failureCount -eq 0 -and
    @($filteredPageErrors).Count -eq 0 -and
    @($filteredConsoleErrors).Count -eq 0 -and
    $summary.targeted.primaryDirection -and
    $summary.targeted.cnYiBuTabs -and
    $summary.targeted.liuRengScroll -and
    $summary.meetsThreeMinuteTarget
  ) { 'passed' } else { 'failed' }
}
catch {
  $summary.finishedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  $summary.status = 'failed'
  $summary.error = $_.Exception.Message
}
finally {
  Remove-Item Env:HOROSA_APP_URL -ErrorAction SilentlyContinue
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
