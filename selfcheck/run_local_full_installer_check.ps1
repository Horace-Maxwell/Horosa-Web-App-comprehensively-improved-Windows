Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$installer = Join-Path $repo 'desktop_installer_bundle\release\XingqueSetupFull.exe'
$root = 'C:\xqe\local-full-e2e-20260314'
$local = Join-Path $root 'LocalAppData'

if (Test-Path $root) {
  Remove-Item -Recurse -Force $root -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Force -Path $local | Out-Null

$oldLocal = $env:LocalAppData
$oldAutoInstall = $env:HOROSA_DESKTOP_INSTALLER_AUTO_INSTALL
$oldAutoFinish = $env:HOROSA_DESKTOP_INSTALLER_AUTO_FINISH
$oldAutoLaunch = $env:HOROSA_DESKTOP_INSTALLER_AUTO_LAUNCH
$oldSmoke = $env:HOROSA_DESKTOP_SMOKE_TEST
$oldAutoClose = $env:HOROSA_DESKTOP_AUTOCLOSE_SECONDS

try {
  $env:LocalAppData = $local
  $env:HOROSA_DESKTOP_INSTALLER_AUTO_INSTALL = '1'
  $env:HOROSA_DESKTOP_INSTALLER_AUTO_FINISH = '1'
  $env:HOROSA_DESKTOP_INSTALLER_AUTO_LAUNCH = '1'
  $env:HOROSA_DESKTOP_SMOKE_TEST = '1'
  $env:HOROSA_DESKTOP_AUTOCLOSE_SECONDS = '8'

  $proc = Start-Process -FilePath $installer -PassThru
  if (-not $proc.WaitForExit(1200000)) {
    throw 'installer timeout'
  }

  $ready = Join-Path $local 'HorosaDesktop\runtime-logs\smoke-ready.json'
  $deadline = (Get-Date).AddMinutes(8)
  while ((Get-Date) -lt $deadline -and -not (Test-Path $ready)) {
    Start-Sleep -Seconds 2
  }

  $log = Join-Path $local 'HorosaDesktop\runtime-logs\desktop-launcher.log'
  $tail = if (Test-Path $log) { Get-Content $log -Tail 200 } else { @() }
  $match = $tail | Select-String 'Auto-selected temporary ports|ready-url-emitted|Runtime quick warmup completed|Started \(no-browser mode\)|\[2/4\]|\[1/4\]|web-ready|chart-ready|backend-ready|backend-port-ready'

  $result = [pscustomobject]@{
    setupExit = $proc.ExitCode
    smokeReady = (Test-Path $ready)
    keyLines = @($match | ForEach-Object { $_.Line })
    logPath = $log
  }

  $result | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $root 'result.json') -Encoding UTF8
  Get-Content (Join-Path $root 'result.json')
} finally {
  $env:LocalAppData = $oldLocal
  $env:HOROSA_DESKTOP_INSTALLER_AUTO_INSTALL = $oldAutoInstall
  $env:HOROSA_DESKTOP_INSTALLER_AUTO_FINISH = $oldAutoFinish
  $env:HOROSA_DESKTOP_INSTALLER_AUTO_LAUNCH = $oldAutoLaunch
  $env:HOROSA_DESKTOP_SMOKE_TEST = $oldSmoke
  $env:HOROSA_DESKTOP_AUTOCLOSE_SECONDS = $oldAutoClose
}
