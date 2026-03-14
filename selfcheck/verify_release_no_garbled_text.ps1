param(
  [string]$Tag = '2026.03.13.5',
  [string]$InstallerName = 'XingqueSetup.exe'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$installerStem = [System.IO.Path]::GetFileNameWithoutExtension($InstallerName)
$root = Join-Path 'C:\xqe' ("garble-check-{0}-{1}" -f $Tag, $installerStem)
$downloadDir = Join-Path $root 'download'
$installRoot = Join-Path $root 'install'
$localAppDataRoot = Join-Path $installRoot 'LocalAppData'
$installerPath = Join-Path $downloadDir $InstallerName
$progressFile = Join-Path $localAppDataRoot 'HorosaDesktop\install-progress.json'
$smokeReady = Join-Path $localAppDataRoot 'HorosaDesktop\runtime-logs\smoke-ready.json'
$resultFile = Join-Path $root 'garble-check-result.json'

function Test-GarbledText {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $false
  }

  return $Text -match "[\u00C3\u00C2\u00E6\u00E7\u00EF\u00BC\u00BD\u00A4]"
}

if (Test-Path $root) {
  Remove-Item -Recurse -Force $root -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Force -Path $downloadDir, $localAppDataRoot | Out-Null
gh release download $Tag --pattern $InstallerName --dir $downloadDir --clobber | Out-Null

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
  $env:HOROSA_DESKTOP_AUTOCLOSE_SECONDS = '8'
  $env:HOROSA_DESKTOP_RELEASE_DOWNLOAD_BASE_URL = "https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/download/$Tag"

  $proc = Start-Process -FilePath $installerPath -PassThru

  $samples = New-Object System.Collections.Generic.List[object]
  $deadline = (Get-Date).AddMinutes(8)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path $progressFile -PathType Leaf) {
      try {
        $raw = [System.IO.File]::ReadAllText($progressFile, [System.Text.Encoding]::UTF8)
        $json = $raw | ConvertFrom-Json
        $samples.Add([pscustomobject]@{
          state = [string]$json.state
          title = [string]$json.title
          message = [string]$json.message
          percent = [int]$json.percent
          garbledTitle = Test-GarbledText ([string]$json.title)
          garbledMessage = Test-GarbledText ([string]$json.message)
        })
      } catch {}
    }

    if (Test-Path $smokeReady -PathType Leaf) {
      break
    }
    Start-Sleep -Seconds 2
  }

  if (-not $proc.WaitForExit(600000)) {
    throw 'installer did not exit in time'
  }

  $smoke = if (Test-Path $smokeReady -PathType Leaf) {
    Get-Content -Raw $smokeReady | ConvertFrom-Json
  } else {
    $null
  }

  $garbledStates = @($samples | Where-Object { $_.garbledTitle -or $_.garbledMessage })
  $lastSamples = @(
    $samples |
      Select-Object -Last 10 |
      ForEach-Object {
        [ordered]@{
          state = [string]$_.state
          title = [string]$_.title
          message = [string]$_.message
          percent = [int]$_.percent
          garbledTitle = [bool]$_.garbledTitle
          garbledMessage = [bool]$_.garbledMessage
        }
      }
  )

  [ordered]@{
    tag = $Tag
    installer = $installerPath
    setupExit = $proc.ExitCode
    sampleCount = [int]$samples.Count
    garbledCount = [int]$garbledStates.Count
    smokeStatus = if ($smoke -and $smoke.PSObject.Properties['status']) { [string]$smoke.status } else { $null }
    smokeTimestamp = if ($smoke -and $smoke.PSObject.Properties['timestamp']) { [string]$smoke.timestamp } else { $null }
    lastSamples = $lastSamples
  } | ConvertTo-Json -Depth 6 | Set-Content -Path $resultFile -Encoding UTF8

  Get-Content $resultFile
} finally {
  $env:LocalAppData = $oldLocal
  $env:HOROSA_DESKTOP_INSTALLER_AUTO_INSTALL = $oldAutoInstall
  $env:HOROSA_DESKTOP_INSTALLER_AUTO_FINISH = $oldAutoFinish
  $env:HOROSA_DESKTOP_INSTALLER_AUTO_LAUNCH = $oldAutoLaunch
  $env:HOROSA_DESKTOP_SMOKE_TEST = $oldSmoke
  $env:HOROSA_DESKTOP_AUTOCLOSE_SECONDS = $oldAutoClose
  $env:HOROSA_DESKTOP_RELEASE_DOWNLOAD_BASE_URL = $oldReleaseBase
}
