Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$wizardPath = Join-Path $repoRoot 'desktop_installer_bundle\install_desktop_wizard.ps1'
$launcherPath = Join-Path $repoRoot 'desktop_installer_bundle\release\Xingque.exe'
$versionPath = Join-Path $repoRoot 'desktop_installer_bundle\version.json'
$releaseAssetRoot = Join-Path $repoRoot 'desktop_installer_bundle\release'
$versionInfo = Get-Content -Raw $versionPath | ConvertFrom-Json
$currentVersion = [string]$versionInfo.version

function Remove-PathIfExists {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return
  }

  try {
    Remove-Item -Recurse -Force $Path -ErrorAction Stop
    return
  } catch {}

  try {
    & cmd.exe /d /c "rmdir /s /q `"$Path`"" | Out-Null
  } catch {}
}

function Remove-ShortcutArtifact {
  param([string]$Path)
  if (Test-Path $Path -PathType Leaf) {
    Remove-Item -Force $Path -ErrorAction SilentlyContinue
  }
}

function Invoke-ExistingInstallScenario {
  param(
    [Parameter(Mandatory = $true)][string]$Action,
    [Parameter(Mandatory = $true)][string]$InstalledVersion,
    [switch]$AddSentinel,
    [switch]$UseSmoke
  )

  $testRoot = Join-Path 'C:\xqe' ("installer-option-{0}" -f $Action)
  $localAppDataRoot = Join-Path $testRoot 'LocalAppData'
  $stateDir = Join-Path $localAppDataRoot 'HorosaDesktop\runtime-pydeps'
  $installBundleDir = Join-Path $localAppDataRoot 'Horosa\Xingque App\desktop_installer_bundle'
  $installRoot = Split-Path -Parent $installBundleDir
  $smokeFile = Join-Path $localAppDataRoot 'HorosaDesktop\installer-smoke.json'
  $traceFile = Join-Path $localAppDataRoot 'HorosaDesktop\runtime-logs\install-wizard-trace.log'
  $progressFile = Join-Path $localAppDataRoot 'HorosaDesktop\install-progress.json'
  $sentinelPath = Join-Path $installRoot 'replace-marker.txt'
  $desktopShortcut = Join-Path $env:USERPROFILE 'OneDrive\Desktop\Xingque.lnk'
  $startMenuShortcut = Join-Path ([Environment]::GetFolderPath('Programs')) 'Xingque.lnk'

  Remove-PathIfExists -Path $testRoot
  New-Item -ItemType Directory -Force -Path $stateDir, $installBundleDir | Out-Null
  Copy-Item -Path $launcherPath -Destination (Join-Path $installBundleDir 'Xingque.exe') -Force
  if ($AddSentinel) {
    Set-Content -Path $sentinelPath -Value 'old-install' -Encoding UTF8
  }

  @(
    @{
      version = $InstalledVersion
      runtimeVersion = $InstalledVersion
    } | ConvertTo-Json
  ) | Set-Content -Path (Join-Path $stateDir 'install_state.json') -Encoding UTF8

  Remove-ShortcutArtifact -Path $desktopShortcut
  Remove-ShortcutArtifact -Path $startMenuShortcut

  $oldLocalAppData = $env:LocalAppData
  $oldSmoke = $env:HOROSA_DESKTOP_INSTALLER_SMOKE
  $oldAutoInstall = $env:HOROSA_DESKTOP_INSTALLER_AUTO_INSTALL
  $oldAutoFinish = $env:HOROSA_DESKTOP_INSTALLER_AUTO_FINISH
  $oldAutoLaunch = $env:HOROSA_DESKTOP_INSTALLER_AUTO_LAUNCH
  $oldExistingAction = $env:HOROSA_DESKTOP_INSTALLER_AUTO_EXISTING_ACTION
  $oldLocalRuntimeAssetRoot = $env:HOROSA_DESKTOP_LOCAL_RUNTIME_ASSET_ROOT

  try {
    $env:LocalAppData = $localAppDataRoot
    if ($UseSmoke) {
      $env:HOROSA_DESKTOP_INSTALLER_SMOKE = '1'
    } else {
      Remove-Item Env:HOROSA_DESKTOP_INSTALLER_SMOKE -ErrorAction SilentlyContinue
    }
    $env:HOROSA_DESKTOP_INSTALLER_AUTO_INSTALL = '1'
    $env:HOROSA_DESKTOP_INSTALLER_AUTO_FINISH = '1'
    $env:HOROSA_DESKTOP_INSTALLER_AUTO_LAUNCH = '0'
    $env:HOROSA_DESKTOP_INSTALLER_AUTO_EXISTING_ACTION = $Action
    $env:HOROSA_DESKTOP_LOCAL_RUNTIME_ASSET_ROOT = $releaseAssetRoot

    $hostExe = 'powershell.exe'
    $process = Start-Process -FilePath $hostExe -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $wizardPath) -PassThru -Wait
    if ($process.ExitCode -ne 0) {
      throw "Installer wizard exited with code $($process.ExitCode) for action $Action"
    }

    $smoke = if (Test-Path $smokeFile -PathType Leaf) {
      Get-Content -Raw $smokeFile | ConvertFrom-Json
    } else {
      $null
    }
    $traceTail = if (Test-Path $traceFile -PathType Leaf) {
      @(Get-Content -Path $traceFile -Tail 40)
    } else {
      @()
    }

    $installStatePath = Join-Path $stateDir 'install_state.json'
    $finalState = if (Test-Path $installStatePath -PathType Leaf) {
      Get-Content -Raw $installStatePath | ConvertFrom-Json
    } else {
      $null
    }

    [pscustomobject]@{
      action = $Action
      smoke_status = if ($smoke) { $smoke.status } else { $null }
      smoke_version = if ($smoke) { $smoke.version } else { $null }
      trace_tail = $traceTail
      final_progress = if (Test-Path $progressFile -PathType Leaf) { Get-Content -Raw $progressFile | ConvertFrom-Json } else { $null }
      desktop_shortcut_exists = Test-Path $desktopShortcut -PathType Leaf
      startmenu_shortcut_exists = Test-Path $startMenuShortcut -PathType Leaf
      sentinel_exists_after = Test-Path $sentinelPath -PathType Leaf
      final_install_state_version = if ($finalState) { [string]$finalState.version } else { $null }
      final_runtime_version = if ($finalState) { [string]$finalState.runtimeVersion } else { $null }
      installed_launcher_exists = Test-Path (Join-Path $installBundleDir 'Xingque.exe') -PathType Leaf
    }
  } finally {
    $env:LocalAppData = $oldLocalAppData
    $env:HOROSA_DESKTOP_INSTALLER_SMOKE = $oldSmoke
    $env:HOROSA_DESKTOP_INSTALLER_AUTO_INSTALL = $oldAutoInstall
    $env:HOROSA_DESKTOP_INSTALLER_AUTO_FINISH = $oldAutoFinish
    $env:HOROSA_DESKTOP_INSTALLER_AUTO_LAUNCH = $oldAutoLaunch
    $env:HOROSA_DESKTOP_INSTALLER_AUTO_EXISTING_ACTION = $oldExistingAction
    $env:HOROSA_DESKTOP_LOCAL_RUNTIME_ASSET_ROOT = $oldLocalRuntimeAssetRoot

    Remove-ShortcutArtifact -Path $desktopShortcut
    Remove-ShortcutArtifact -Path $startMenuShortcut
  }
}

$repairResult = Invoke-ExistingInstallScenario -Action 'repair' -InstalledVersion $currentVersion -UseSmoke
$replaceResult = Invoke-ExistingInstallScenario -Action 'replace' -InstalledVersion '2026.03.12.9' -AddSentinel
$cancelResult = Invoke-ExistingInstallScenario -Action 'cancel' -InstalledVersion '2026.03.12.9' -UseSmoke

[pscustomobject]@{
  version = $currentVersion
  repair = $repairResult
  replace = $replaceResult
  cancel = $cancelResult
} | ConvertTo-Json -Depth 8
