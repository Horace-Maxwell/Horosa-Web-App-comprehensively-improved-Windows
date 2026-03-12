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
  Where-Object { $_.LocalPort -in 8000, 8899, 9999 } |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object {
    try { Stop-Process -Id $_ -Force -ErrorAction Stop } catch {}
  }

Remove-Item Env:HOROSA_SMOKE_TEST -ErrorAction SilentlyContinue
Remove-Item Env:HOROSA_SMOKE_WAIT_SECONDS -ErrorAction SilentlyContinue
Remove-Item Env:HOROSA_DESKTOP_AUTOCLOSE_SECONDS -ErrorAction SilentlyContinue
$env:HOROSA_NO_BROWSER = '1'
$env:HOROSA_PERF_MODE = '1'
$env:LocalAppData = $LocalAppDataRoot

$proc = Start-Process -FilePath $launcherExe -PassThru

for ($i = 0; $i -lt 240; $i++) {
  try {
    $resp = Invoke-WebRequest 'http://127.0.0.1:8000/index.html?srv=http%3A%2F%2F127.0.0.1%3A9999#/' -UseBasicParsing -TimeoutSec 3
    if ($resp.StatusCode -eq 200) {
      break
    }
  } catch {}
  Start-Sleep -Seconds 1
}

Write-Output $proc.Id
