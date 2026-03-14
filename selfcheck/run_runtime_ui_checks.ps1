Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ResultsDir = Join-Path $PSScriptRoot 'results'
New-Item -ItemType Directory -Force -Path $ResultsDir | Out-Null

$FastOut = Join-Path $ResultsDir 'latest_round15_ui_fast_runtime.json'
$TargetedOut = Join-Path $ResultsDir 'latest_round15_ui_targeted_runtime.json'
$PersistOut = Join-Path $ResultsDir 'latest_round15_browser_persistence.json'
$ProfileDir = Join-Path $ResultsDir 'round15-browser-profile'

if (Test-Path $ProfileDir) {
  Remove-Item -Recurse -Force $ProfileDir -ErrorAction SilentlyContinue
}

$startJson = powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'start_runtime_for_audit.ps1')
$start = $startJson | ConvertFrom-Json
$url = [string]$start.readyUrl
if ([string]::IsNullOrWhiteSpace($url)) {
  throw 'start_runtime_for_audit did not return readyUrl'
}

try {
  $env:HOROSA_APP_URL = $url
  & node (Join-Path $PSScriptRoot 'ui_fast_smoke.js') | Set-Content -Path $FastOut -Encoding UTF8
  & node (Join-Path $PSScriptRoot 'ui_targeted_regression.js') | Set-Content -Path $TargetedOut -Encoding UTF8
  & node (Join-Path $PSScriptRoot 'verify_browser_storage_persistence.js') $url $ProfileDir | Set-Content -Path $PersistOut -Encoding UTF8
} finally {
  powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'stop_runtime_for_audit.ps1') | Out-Null
  Remove-Item Env:HOROSA_APP_URL -ErrorAction SilentlyContinue
}

[pscustomobject]@{
  readyUrl = $url
  fast = $FastOut
  targeted = $TargetedOut
  persistence = $PersistOut
} | ConvertTo-Json -Depth 4
