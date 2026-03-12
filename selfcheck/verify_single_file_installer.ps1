param(
  [string]$InstallerPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'desktop_installer_bundle\release\XingqueSetup.exe')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$TestRoot = Join-Path 'C:\xqe' 'singlefile-installer-smoke'
$LocalAppDataRoot = Join-Path $TestRoot 'LocalAppData'
$SmokeFile = Join-Path $LocalAppDataRoot 'HorosaDesktop\installer-smoke.json'

if (-not (Test-Path $InstallerPath -PathType Leaf)) {
  throw "Single-file installer not found: $InstallerPath"
}

if (Test-Path $TestRoot) {
  Remove-Item -Recurse -Force $TestRoot -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Force -Path $LocalAppDataRoot | Out-Null

$oldLocalAppData = $env:LocalAppData
$oldSmoke = $env:HOROSA_DESKTOP_INSTALLER_SMOKE

$proc = $null
try {
  $env:LocalAppData = $LocalAppDataRoot
  $env:HOROSA_DESKTOP_INSTALLER_SMOKE = '1'

  $proc = Start-Process -FilePath $InstallerPath -PassThru
  [void]$proc.WaitForExit(120000)
  if (-not $proc.HasExited) {
    try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
    throw 'Single-file installer did not exit during smoke window.'
  }

  if (-not (Test-Path $SmokeFile -PathType Leaf)) {
    throw "Installer smoke file was not created: $SmokeFile"
  }

  $smoke = Get-Content -Raw $SmokeFile | ConvertFrom-Json
  [pscustomobject]@{
    installer = $InstallerPath
    exit_code = $proc.ExitCode
    smoke_status = $smoke.status
    smoke_version = $smoke.version
    smoke_installed = $smoke.installed
    smoke_timestamp = $smoke.timestamp
  } | ConvertTo-Json -Depth 4
} finally {
  $env:LocalAppData = $oldLocalAppData
  $env:HOROSA_DESKTOP_INSTALLER_SMOKE = $oldSmoke
}
