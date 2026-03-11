$ErrorActionPreference = 'Stop'

$env:HOROSA_NO_BROWSER = '1'
$env:HOROSA_PERF_MODE = '0'
Remove-Item Env:HOROSA_SMOKE_TEST -ErrorAction SilentlyContinue
Remove-Item Env:HOROSA_SMOKE_WAIT_SECONDS -ErrorAction SilentlyContinue
Remove-Item Env:HOROSA_DESKTOP_SMOKE_TEST -ErrorAction SilentlyContinue
Remove-Item Env:HOROSA_DESKTOP_AUTOCLOSE_SECONDS -ErrorAction SilentlyContinue

$proc = Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'local\Horosa_Local_Windows.ps1' -PassThru
Set-Content -Path .\.tmp_horosa_ui_audit.pid -Value $proc.Id

for ($i = 0; $i -lt 60; $i++) {
  try {
    $resp = Invoke-WebRequest 'http://127.0.0.1:8000/index.html' -UseBasicParsing -TimeoutSec 5
    if ($resp.StatusCode -eq 200) {
      Write-Host '[OK] Local audit runtime ready on http://127.0.0.1:8000/index.html'
      exit 0
    }
  } catch {
  }
  Start-Sleep -Seconds 1
}

throw 'Runtime did not reach ready state for audit.'
