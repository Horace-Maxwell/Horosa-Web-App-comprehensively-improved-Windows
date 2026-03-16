param(
  [string]$InstallerPath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$launcherPath = Join-Path $repoRoot 'desktop_installer_bundle\release\Xingque.exe'
$versionPath = Join-Path $repoRoot 'desktop_installer_bundle\version.json'
$versionInfo = Get-Content -Raw $versionPath | ConvertFrom-Json
$currentVersion = [string]$versionInfo.version

if ([string]::IsNullOrWhiteSpace($InstallerPath)) {
  $InstallerPath = Join-Path $repoRoot 'desktop_installer_bundle\release\XingqueSetup.exe'
}

$installerLaunchPath = (Resolve-Path $InstallerPath).ProviderPath
$installerIsScript = [System.IO.Path]::GetExtension($installerLaunchPath).Equals('.ps1', [System.StringComparison]::OrdinalIgnoreCase)

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

function Get-JsonFileUtf8 {
  param([string]$Path)

  if (-not (Test-Path $Path -PathType Leaf)) {
    return $null
  }

  $reader = $null
  try {
    $reader = New-Object System.IO.StreamReader($Path, [System.Text.Encoding]::UTF8, $true)
    $raw = $reader.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) {
      return $null
    }
    return $raw | ConvertFrom-Json
  } finally {
    if ($reader) {
      $reader.Dispose()
    }
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
  ) | ForEach-Object {
    [System.IO.File]::WriteAllText((Join-Path $stateDir 'install_state.json'), $_, (New-Object System.Text.UTF8Encoding($false)))
  }

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
    if ($installerIsScript) {
      $env:HOROSA_DESKTOP_LOCAL_RUNTIME_ASSET_ROOT = Join-Path $repoRoot 'desktop_installer_bundle\release'
      $process = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $installerLaunchPath) -PassThru -Wait
    } else {
      Remove-Item Env:HOROSA_DESKTOP_LOCAL_RUNTIME_ASSET_ROOT -ErrorAction SilentlyContinue
      $process = Start-Process -FilePath $installerLaunchPath -PassThru -Wait
    }
    if ($process.ExitCode -ne 0) {
      throw "Installer wizard exited with code $($process.ExitCode) for action $Action"
    }

    $smoke = Get-JsonFileUtf8 -Path $smokeFile
    $traceTail = if (Test-Path $traceFile -PathType Leaf) {
      @((Get-Content -Path $traceFile -Tail 12) | ForEach-Object { [string]$_ })
    } else {
      @()
    }

    $installStatePath = Join-Path $stateDir 'install_state.json'
    $finalState = Get-JsonFileUtf8 -Path $installStatePath
    $finalProgress = Get-JsonFileUtf8 -Path $progressFile

    [pscustomobject]@{
      action = $Action
      smoke_status = if ($smoke) { $smoke.status } else { $null }
      smoke_version = if ($smoke) { $smoke.version } else { $null }
      trace_tail = $traceTail
      final_progress_state = if ($finalProgress) { $finalProgress.state } else { $null }
      final_progress_title = if ($finalProgress) { $finalProgress.title } else { $null }
      final_progress_message = if ($finalProgress) { $finalProgress.message } else { $null }
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
