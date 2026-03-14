param(
  [Parameter(Mandatory = $true)]
  [string]$InstallRoot,
  [Parameter(Mandatory = $true)]
  [string]$LocalAppDataRoot
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$launcherExe = Join-Path $InstallRoot 'desktop_installer_bundle\Xingque.exe'
if (-not (Test-Path $launcherExe -PathType Leaf)) {
  throw "Installed launcher not found: $launcherExe"
}

Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object {
    try {
      $proc = Get-Process -Id $_ -ErrorAction Stop
      if ($proc.ProcessName -match '^(python|pwsh|powershell|java|Xingque|HorosaDesktop)$') {
        Stop-Process -Id $_ -Force -ErrorAction Stop
      }
    } catch {}
  }

Remove-Item Env:HOROSA_SMOKE_TEST -ErrorAction SilentlyContinue
Remove-Item Env:HOROSA_SMOKE_WAIT_SECONDS -ErrorAction SilentlyContinue
Remove-Item Env:HOROSA_DESKTOP_AUTOCLOSE_SECONDS -ErrorAction SilentlyContinue
$env:HOROSA_NO_BROWSER = '1'
$env:HOROSA_PERF_MODE = '1'
$env:LocalAppData = $LocalAppDataRoot

$proc = Start-Process -FilePath $launcherExe -PassThru
$launcherLog = Join-Path $LocalAppDataRoot 'HorosaDesktop\runtime-logs\desktop-launcher.log'
$readyUrl = $null

for ($i = 0; $i -lt 240; $i++) {
  try {
    if (-not $readyUrl -and (Test-Path $launcherLog)) {
      $logText = Get-Content $launcherLog -Raw -ErrorAction SilentlyContinue
      if ($logText -match 'Started \(no-browser mode\):\s*(?<url>https?://\S+)') {
        $readyUrl = $Matches.url
      }
    }
    if ($readyUrl) {
      $resp = Invoke-WebRequest $readyUrl -UseBasicParsing -TimeoutSec 3
      if ($resp.StatusCode -eq 200) {
        break
      }
    }
  } catch {}
  Start-Sleep -Seconds 1
}

if (-not $readyUrl) {
  throw "Ready URL not found in launcher log: $launcherLog"
}

Write-Output $proc.Id
