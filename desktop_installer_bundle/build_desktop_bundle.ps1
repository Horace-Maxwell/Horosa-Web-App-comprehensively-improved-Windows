Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptRoot
$PythonExe = Join-Path $RepoRoot 'local\workspace\runtime\windows\python\python.exe'
$DepsRoot = Join-Path $env:LocalAppData 'HorosaDesktop\builddeps'

if (-not (Test-Path $PythonExe)) {
  throw "Bundled Python not found: $PythonExe"
}

$env:PIP_DISABLE_PIP_VERSION_CHECK = '1'

Push-Location $ScriptRoot
try {
  $env:HOROSA_DESKTOP_BUNDLE_ROOT = $ScriptRoot
  & $PythonExe -m pip install --upgrade pip
  if (Test-Path $DepsRoot) { Remove-Item -Recurse -Force $DepsRoot }
  New-Item -ItemType Directory -Force -Path $DepsRoot | Out-Null
  & $PythonExe -m pip install --upgrade --target $DepsRoot -r (Join-Path $ScriptRoot 'requirements.txt')

  $oldPythonPath = $env:PYTHONPATH
  if ([string]::IsNullOrWhiteSpace($oldPythonPath)) {
    $env:PYTHONPATH = $DepsRoot
  } else {
    $env:PYTHONPATH = $DepsRoot + ';' + $oldPythonPath
  }

  $distDir = Join-Path $ScriptRoot 'dist'
  $buildDir = Join-Path $ScriptRoot 'build'
  $releaseDir = Join-Path $ScriptRoot 'release'
  $legacyPayloadDir = Join-Path $releaseDir 'payload'

  if (Test-Path $distDir) { Remove-Item -Recurse -Force $distDir }
  if (Test-Path $buildDir) { Remove-Item -Recurse -Force $buildDir }
  if (Test-Path $legacyPayloadDir) { Remove-Item -Recurse -Force $legacyPayloadDir }
  New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

  & $PythonExe -m PyInstaller (Join-Path $ScriptRoot 'pyinstaller\horosa_desktop.spec') --noconfirm --clean
  if ($null -ne $oldPythonPath) {
    $env:PYTHONPATH = $oldPythonPath
  } else {
    Remove-Item Env:PYTHONPATH -ErrorAction SilentlyContinue
  }

  if (-not (Test-Path (Join-Path $ScriptRoot 'dist\HorosaDesktop'))) {
    throw 'PyInstaller build did not produce dist\HorosaDesktop'
  }

  $versionInfo = Get-Content -Raw (Join-Path $ScriptRoot 'version.json') | ConvertFrom-Json
  $zipName = "{0}-{1}.zip" -f $versionInfo.release_asset_prefix, $versionInfo.version
  $zipPath = Join-Path $releaseDir $zipName
  if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

  $payloadRoot = Join-Path $env:LocalAppData 'HorosaDesktop\release-payload'
  if (Test-Path $payloadRoot) { Remove-Item -Recurse -Force $payloadRoot }
  New-Item -ItemType Directory -Force -Path $payloadRoot | Out-Null

  Copy-Item (Join-Path $ScriptRoot 'README.md') (Join-Path $payloadRoot 'README.md') -Force
  Copy-Item (Join-Path $ScriptRoot 'INSTALL_3_STEPS.md') (Join-Path $payloadRoot 'INSTALL_3_STEPS.md') -Force
  Copy-Item (Join-Path $ScriptRoot 'STRUCTURE.md') (Join-Path $payloadRoot 'STRUCTURE.md') -Force
  Copy-Item (Join-Path $ScriptRoot 'version.json') (Join-Path $payloadRoot 'version.json') -Force
  Copy-Item (Join-Path $ScriptRoot 'Install_Horosa_Desktop.vbs') (Join-Path $payloadRoot 'Install_Horosa_Desktop.vbs') -Force
  Copy-Item (Join-Path $ScriptRoot 'Run_Horosa_Desktop.vbs') (Join-Path $payloadRoot 'Run_Horosa_Desktop.vbs') -Force
  Copy-Item (Join-Path $ScriptRoot 'dist\HorosaDesktop') (Join-Path $payloadRoot 'HorosaDesktop') -Recurse -Force

  Compress-Archive -Path (Join-Path $payloadRoot '*') -DestinationPath $zipPath -CompressionLevel Optimal
  Remove-Item -Recurse -Force $payloadRoot -ErrorAction SilentlyContinue
  Write-Host "[OK] Desktop bundle built: $zipPath"
} finally {
  Remove-Item Env:HOROSA_DESKTOP_BUNDLE_ROOT -ErrorAction SilentlyContinue
  Pop-Location
}
