param(
  [ValidateSet('quick', 'full')]
  [string]$Mode = 'quick'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RepoRoot = Split-Path -Parent $PSScriptRoot
$WorkspaceRoot = Join-Path $RepoRoot 'local\workspace\Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c\astrostudyui'
$ResultsRoot = Join-Path $PSScriptRoot 'results'
$Timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$RunRoot = Join-Path $ResultsRoot $Timestamp
New-Item -ItemType Directory -Force -Path $RunRoot | Out-Null

$Summary = [ordered]@{
  startedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  mode = $Mode
  steps = @()
}

function Add-StepResult {
  param(
    [string]$Name,
    [string]$Status,
    [string]$Command,
    [string]$OutputPath
  )

  $Summary.steps += [ordered]@{
    name = $Name
    status = $Status
    command = $Command
    output = $OutputPath
  }
}

function Invoke-And-Capture {
  param(
    [string]$Name,
    [string]$Command
  )

  $safeName = ($Name -replace '[^A-Za-z0-9_-]', '_')
  $outputPath = Join-Path $RunRoot ($safeName + '.log')
  $stderrPath = Join-Path $RunRoot ($safeName + '.err.log')
  Write-Host ("[RUN] {0}" -f $Name)
  $proc = Start-Process `
    -FilePath 'powershell.exe' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $Command) `
    -RedirectStandardOutput $outputPath `
    -RedirectStandardError $stderrPath `
    -Wait `
    -PassThru
  if ($proc.ExitCode -ne 0) {
    $combined = @()
    if (Test-Path $outputPath) {
      $combined += Get-Content $outputPath
    }
    if (Test-Path $stderrPath) {
      $combined += Get-Content $stderrPath
    }
    Add-StepResult -Name $Name -Status 'failed' -Command $Command -OutputPath $outputPath
    $message = if ($combined.Count -gt 0) { ($combined | Select-Object -First 20) -join [Environment]::NewLine } else { "Step failed: $Name" }
    throw $message
  }
  Add-StepResult -Name $Name -Status 'passed' -Command $Command -OutputPath $outputPath
}

try {
  Invoke-And-Capture `
    -Name 'umi-test-chart-display-selector' `
    -Command "Set-Location '$WorkspaceRoot'; npx umi-test src/components/astro/__tests__/ChartDisplaySelector.test.js src/components/jinkou/JinKouCalc.test.js src/components/astro/__tests__/AstroPrimaryDirectionChart.test.js --runInBand"

  if ($Mode -eq 'full') {
    Invoke-And-Capture `
      -Name 'build-file' `
      -Command "Set-Location '$WorkspaceRoot'; npm run build:file"
  }

  Invoke-And-Capture `
    -Name 'start-runtime-for-audit' `
    -Command "Set-Location '$RepoRoot'; powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tmp_start_runtime_for_audit.ps1"

  Invoke-And-Capture `
    -Name 'audit-topbar' `
    -Command "Set-Location '$RepoRoot'; node .\tmp_ui_audit_topbar.js"

  Invoke-And-Capture `
    -Name 'audit-topbar-controls' `
    -Command "Set-Location '$RepoRoot'; node .\tmp_ui_audit_topbar_controls.js"

  Invoke-And-Capture `
    -Name 'audit-topbar-extras' `
    -Command "Set-Location '$RepoRoot'; node .\tmp_ui_audit_topbar_extras.js"

  Invoke-And-Capture `
    -Name 'audit-left-tabs' `
    -Command "Set-Location '$RepoRoot'; node .\tmp_ui_audit_left_tabs.js"

  Invoke-And-Capture `
    -Name 'audit-nested-tabs' `
    -Command "Set-Location '$RepoRoot'; node .\tmp_ui_audit_nested_tabs.js"

  Invoke-And-Capture `
    -Name 'audit-specialized-modules' `
    -Command "Set-Location '$RepoRoot'; node .\tmp_ui_audit_specialized_modules.js"

  Invoke-And-Capture `
    -Name 'audit-single-pane-controls' `
    -Command "Set-Location '$RepoRoot'; node .\tmp_ui_audit_single_pane_controls.js"

  $Summary.finishedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  $Summary.status = 'passed'
}
catch {
  $Summary.finishedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  $Summary.status = 'failed'
  $Summary.error = $_.Exception.Message
}
finally {
  try {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot 'tmp_stop_runtime_for_audit.ps1') | Out-Null
  } catch {
  }

  $summaryPath = Join-Path $RunRoot 'summary.json'
  ($Summary | ConvertTo-Json -Depth 8) | Set-Content -Path $summaryPath -Encoding UTF8
  Write-Host ("[DONE] Summary: {0}" -f $summaryPath)
  if ($Summary.status -ne 'passed') {
    exit 1
  }
}
