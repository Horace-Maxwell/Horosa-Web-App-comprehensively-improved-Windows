param(
  [int]$Round = 1,
  [int]$SmokeWaitSeconds = 600
)

$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

function Test-PortOpen {
  param([int]$Port)
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    $ok = $async.AsyncWaitHandle.WaitOne(500)
    if ($ok -and $client.Connected) {
      $client.EndConnect($async) | Out-Null
      $client.Close()
      return $true
    }
    $client.Close()
    return $false
  } catch {
    return $false
  }
}

function Read-TextFile {
  param([string]$Path)
  if (Test-Path $Path) {
    return Get-Content -Raw -Path $Path
  }
  return ''
}

function Invoke-LoggedProcess {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$WorkingDirectory,
    [string]$LogPath
  )
  $outPath = "${LogPath}.out"
  $errPath = "${LogPath}.err"
  if (Test-Path $outPath) { Remove-Item -Force $outPath }
  if (Test-Path $errPath) { Remove-Item -Force $errPath }

  $proc = Start-Process -FilePath $FilePath `
    -ArgumentList $ArgumentList `
    -WorkingDirectory $WorkingDirectory `
    -RedirectStandardOutput $outPath `
    -RedirectStandardError $errPath `
    -PassThru
  $proc.WaitForExit()
  $proc.Refresh()

  $outText = Read-TextFile -Path $outPath
  $errText = Read-TextFile -Path $errPath
  ($outText + $errText) | Set-Content -Path $LogPath -Encoding UTF8

  if ($null -eq $proc.ExitCode) {
    return 0
  }
  return $proc.ExitCode
}

$Root = $PSScriptRoot
$ProjectDir = Join-Path $Root 'Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c'
$UiDir = Join-Path $ProjectDir 'astrostudyui'
$ReportDir = Join-Path $Root 'SELF_CHECK_REPORTS'
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$prefix = "ROUND${Round}_${stamp}"

$launcherOut = Join-Path $ReportDir "${prefix}_launcher.out.log"
$launcherErr = Join-Path $ReportDir "${prefix}_launcher.err.log"
$buttonOut = Join-Path $ReportDir "${prefix}_button.out.log"
$buttonReport = Join-Path $ReportDir "${prefix}_button.report.json"
$buildLog = Join-Path $ReportDir "${prefix}_build.log"
$testLog = Join-Path $ReportDir "${prefix}_test.log"
$sourceButtonScan = Join-Path $ReportDir "${prefix}_source_button_scan.log"
$summaryPath = Join-Path $ReportDir "${prefix}_summary.json"

$result = [ordered]@{
  round = $Round
  startedAt = (Get-Date).ToString('s')
  smokeWaitSeconds = $SmokeWaitSeconds
  launcher = [ordered]@{
    started = $false
    ready = $false
    exitCode = $null
    backendReady = $false
    chartReady = $false
    webReady = $false
    logMarkers = [ordered]@{
      backendLine = $false
      chartLine = $false
      noBrowserLine = $false
      stoppedPidLine = $false
    }
    outLog = $launcherOut
    errLog = $launcherErr
  }
  buttonCheck = [ordered]@{
    ran = $false
    exitCode = $null
    reportPath = $buttonReport
    outLog = $buttonOut
    summary = $null
  }
  build = [ordered]@{
    ran = $false
    exitCode = $null
    logPath = $buildLog
  }
  test = [ordered]@{
    ran = $false
    exitCode = $null
    logPath = $testLog
  }
  sourceButtonScan = [ordered]@{
    ran = $false
    exitCode = $null
    logPath = $sourceButtonScan
  }
  pass = $false
  endedAt = $null
}

$launcherProc = $null
try {
  $launcherCmd = @(
    "`$env:HOROSA_NO_BROWSER='1'",
    "`$env:HOROSA_SMOKE_TEST='1'",
    "`$env:HOROSA_SMOKE_WAIT_SECONDS='$SmokeWaitSeconds'",
    "& '$Root\Horosa_Local_Windows.ps1'"
  ) -join '; '

  $launcherProc = Start-Process -FilePath 'powershell.exe' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $launcherCmd) `
    -RedirectStandardOutput $launcherOut `
    -RedirectStandardError $launcherErr `
    -PassThru

  $result.launcher.started = $true

  $ready = $false
  for ($i = 0; $i -lt 180; $i++) {
    $result.launcher.backendReady = Test-PortOpen -Port 9999
    $result.launcher.chartReady = Test-PortOpen -Port 8899
    $result.launcher.webReady = Test-PortOpen -Port 8000
    if ($result.launcher.backendReady -and $result.launcher.chartReady -and $result.launcher.webReady) {
      $ready = $true
      break
    }
    if ($launcherProc.HasExited) {
      break
    }
    Start-Sleep -Milliseconds 500
  }
  $result.launcher.ready = $ready

  if ($ready) {
    $result.buttonCheck.ran = $true
    $oldNodePath = $env:NODE_PATH
    $env:NODE_PATH = Join-Path $Root '.tmp_playwright_runner\node_modules'
    try {
      & node "$Root\button_self_check_playwright.js" `
        "--url=http://127.0.0.1:8000/index.html" `
        "--output=$buttonReport" `
        "--timeout=300000" `
        "--maxButtons=80" `
        "--maxInnerTabs=8" `
        "--maxRuntime=240000" 2>&1 | Tee-Object -FilePath $buttonOut
      $result.buttonCheck.exitCode = $LASTEXITCODE
    } finally {
      $env:NODE_PATH = $oldNodePath
    }
    if (Test-Path $buttonReport) {
      try {
        $buttonObj = Get-Content -Raw -Encoding UTF8 -Path $buttonReport | ConvertFrom-Json
        if ($buttonObj.summary) {
          $result.buttonCheck.summary = $buttonObj.summary
        } else {
          $result.buttonCheck.summary = $null
        }
      } catch {
        $result.buttonCheck.summary = $null
      }
    }
  }

  if ($launcherProc -and -not $launcherProc.HasExited) {
    $timeoutSec = [Math]::Max(($SmokeWaitSeconds + 120), 240)
    $launcherProc.WaitForExit($timeoutSec * 1000) | Out-Null
    if (-not $launcherProc.HasExited) {
      Stop-Process -Id $launcherProc.Id -Force
      Start-Sleep -Milliseconds 500
    }
  }
  if ($launcherProc) {
    $launcherProc.Refresh()
    $result.launcher.exitCode = $launcherProc.ExitCode
    if ($null -eq $result.launcher.exitCode -and $launcherProc.HasExited) {
      $result.launcher.exitCode = 0
    }
  }

  $launcherText = Read-TextFile -Path $launcherOut
  $result.launcher.logMarkers.backendLine = $launcherText.Contains('backend: http://127.0.0.1:9999')
  $result.launcher.logMarkers.chartLine = $launcherText.Contains('chartpy: http://127.0.0.1:8899')
  $result.launcher.logMarkers.noBrowserLine = $launcherText.Contains('Started (no-browser mode): http://127.0.0.1:8000/index.html')
  $result.launcher.logMarkers.stoppedPidLine = $launcherText.Contains('stopped pid')

  Push-Location $UiDir
  try {
    $result.build.ran = $true
    $result.build.exitCode = Invoke-LoggedProcess `
      -FilePath 'cmd.exe' `
      -ArgumentList @('/c', 'npm run build:file') `
      -WorkingDirectory $UiDir `
      -LogPath $buildLog

    $result.test.ran = $true
    $result.test.exitCode = Invoke-LoggedProcess `
      -FilePath 'cmd.exe' `
      -ArgumentList @('/c', 'npm test -- --watch=false') `
      -WorkingDirectory $UiDir `
      -LogPath $testLog

    $result.sourceButtonScan.ran = $true
    $result.sourceButtonScan.exitCode = Invoke-LoggedProcess `
      -FilePath 'cmd.exe' `
      -ArgumentList @('/c', 'rg -n "<Button|<button|role=\"button\"|onClick=" src') `
      -WorkingDirectory $UiDir `
      -LogPath $sourceButtonScan
  } finally {
    Pop-Location
  }

  $buttonPass = $false
  if ($result.buttonCheck.summary -and $result.buttonCheck.summary.summary) {
    $buttonPass = [bool]$result.buttonCheck.summary.summary.pass
  } elseif ($result.buttonCheck.summary) {
    $buttonPass = [bool]$result.buttonCheck.summary.pass
  }

  $launcherPass = $result.launcher.started -and
    $result.launcher.ready -and
    (($null -eq $result.launcher.exitCode) -or ($result.launcher.exitCode -eq 0)) -and
    $result.launcher.logMarkers.backendLine -and
    $result.launcher.logMarkers.chartLine -and
    $result.launcher.logMarkers.noBrowserLine

  $result.pass = $launcherPass -and
    ($result.build.exitCode -eq 0) -and
    ($result.test.exitCode -eq 0) -and
    ($result.sourceButtonScan.exitCode -eq 0) -and
    $buttonPass
} catch {
  if ($launcherProc -and -not $launcherProc.HasExited) {
    Stop-Process -Id $launcherProc.Id -Force -ErrorAction SilentlyContinue
  }
  $result.pass = $false
  $result | Add-Member -NotePropertyName error -NotePropertyValue $_.Exception.Message -Force
} finally {
  $result.endedAt = (Get-Date).ToString('s')
  ($result | ConvertTo-Json -Depth 18) + "`n" | Set-Content -Path $summaryPath -Encoding UTF8
  Write-Host "ROUND_SUMMARY: $summaryPath"
  Write-Host "ROUND_PASS: $($result.pass)"
}
