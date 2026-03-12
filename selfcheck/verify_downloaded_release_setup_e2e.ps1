param(
  [string]$Root = 'C:\xqe\gh-release-e2e-20260312_120436',
  [string]$Tag = '2026.03.11.8'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$installer = Join-Path $Root 'download\XingqueSetup.exe'
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$testRoot = Join-Path $Root ("install-e2e-$stamp")
$localAppDataRoot = Join-Path $testRoot 'LocalAppData'
$installRoot = Join-Path $localAppDataRoot 'Horosa\Xingque App'
$installedLauncher = Join-Path $installRoot 'desktop_installer_bundle\Xingque.exe'
$smokeReady = Join-Path $localAppDataRoot 'HorosaDesktop\runtime-logs\smoke-ready.json'
$desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) '星阙.lnk'
$startShortcut = Join-Path ([Environment]::GetFolderPath('Programs')) '星阙.lnk'
$backupRoot = Join-Path $testRoot 'shortcut-backups'
$resultPath = Join-Path $Root 'install-e2e-result.json'

if (-not (Test-Path $installer -PathType Leaf)) {
  throw "Downloaded setup installer not found: $installer"
}

New-Item -ItemType Directory -Force -Path $localAppDataRoot, $backupRoot | Out-Null

foreach ($lnk in @($desktopShortcut, $startShortcut)) {
  if (Test-Path $lnk) {
    Copy-Item $lnk (Join-Path $backupRoot ([IO.Path]::GetFileName($lnk))) -Force
    Remove-Item $lnk -Force
  }
}

$oldLocal = $env:LocalAppData
$oldAutoInstall = $env:HOROSA_DESKTOP_INSTALLER_AUTO_INSTALL
$oldAutoFinish = $env:HOROSA_DESKTOP_INSTALLER_AUTO_FINISH
$oldAutoLaunch = $env:HOROSA_DESKTOP_INSTALLER_AUTO_LAUNCH
$oldSmoke = $env:HOROSA_DESKTOP_SMOKE_TEST
$oldAutoClose = $env:HOROSA_DESKTOP_AUTOCLOSE_SECONDS
$oldReleaseBase = $env:HOROSA_DESKTOP_RELEASE_DOWNLOAD_BASE_URL

try {
  $env:LocalAppData = $localAppDataRoot
  $env:HOROSA_DESKTOP_INSTALLER_AUTO_INSTALL = '1'
  $env:HOROSA_DESKTOP_INSTALLER_AUTO_FINISH = '1'
  $env:HOROSA_DESKTOP_INSTALLER_AUTO_LAUNCH = '1'
  $env:HOROSA_DESKTOP_SMOKE_TEST = '1'
  $env:HOROSA_DESKTOP_AUTOCLOSE_SECONDS = '10'
  $env:HOROSA_DESKTOP_RELEASE_DOWNLOAD_BASE_URL = "https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/download/$Tag"

  $proc = Start-Process -FilePath $installer -PassThru
  if (-not $proc.WaitForExit(1800000)) {
    throw 'setup timeout'
  }

  if (-not (Test-Path $installedLauncher -PathType Leaf)) {
    throw "installed launcher missing: $installedLauncher"
  }

  $deadline = (Get-Date).AddMinutes(8)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path $smokeReady) {
      break
    }
    Start-Sleep -Seconds 2
  }

  if (-not (Test-Path $smokeReady)) {
    throw "smoke ready missing: $smokeReady"
  }

  $shell = New-Object -ComObject WScript.Shell
  $shortcutRows = @()
  foreach ($lnk in @($desktopShortcut, $startShortcut)) {
    if (Test-Path $lnk) {
      $s = $shell.CreateShortcut($lnk)
      $shortcutRows += [pscustomobject]@{
        shortcut = $lnk
        target = $s.TargetPath
        args = $s.Arguments
        workdir = $s.WorkingDirectory
        icon = $s.IconLocation
      }
    }
  }

  $smoke = Get-Content -Raw $smokeReady | ConvertFrom-Json
  [pscustomobject]@{
    installer = $installer
    tag = $Tag
    setup_exit = $proc.ExitCode
    install_root = $installRoot
    installed_launcher = $installedLauncher
    smoke_status = $smoke.status
    smoke_url = $smoke.url
    smoke_timestamp = $smoke.timestamp
    shortcuts = $shortcutRows
  } | ConvertTo-Json -Depth 6 | Set-Content -Path $resultPath -Encoding UTF8

  Get-Content $resultPath
} finally {
  $env:LocalAppData = $oldLocal
  $env:HOROSA_DESKTOP_INSTALLER_AUTO_INSTALL = $oldAutoInstall
  $env:HOROSA_DESKTOP_INSTALLER_AUTO_FINISH = $oldAutoFinish
  $env:HOROSA_DESKTOP_INSTALLER_AUTO_LAUNCH = $oldAutoLaunch
  $env:HOROSA_DESKTOP_SMOKE_TEST = $oldSmoke
  $env:HOROSA_DESKTOP_AUTOCLOSE_SECONDS = $oldAutoClose
  $env:HOROSA_DESKTOP_RELEASE_DOWNLOAD_BASE_URL = $oldReleaseBase

  foreach ($lnk in @($desktopShortcut, $startShortcut)) {
    Remove-Item $lnk -Force -ErrorAction SilentlyContinue
    $backup = Join-Path $backupRoot ([IO.Path]::GetFileName($lnk))
    if (Test-Path $backup) {
      Move-Item $backup $lnk -Force
    }
  }
}
