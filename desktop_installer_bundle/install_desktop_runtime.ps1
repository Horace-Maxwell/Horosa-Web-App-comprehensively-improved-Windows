Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptRoot
$RuntimeRoot = Join-Path $RepoRoot 'local\workspace\runtime\windows'
$PythonExe = Join-Path $RuntimeRoot 'python\python.exe'
$PythonWExe = Join-Path $RuntimeRoot 'python\pythonw.exe'
$DepsRoot = Join-Path $env:LocalAppData 'HorosaDesktop\runtime-pydeps'
$ProgressFile = Join-Path $env:LocalAppData 'HorosaDesktop\install-progress.json'
$DownloadRoot = Join-Path $env:LocalAppData 'HorosaDesktop\downloads'
$ReqFile = Join-Path $ScriptRoot 'runtime_requirements.txt'
$Wheelhouse = Join-Path $ScriptRoot 'wheelhouse'
$InstallStateFile = Join-Path $DepsRoot 'install_state.json'
$ReleaseConfigFile = Join-Path $ScriptRoot 'src\app_release_config.json'
$DisplayName = '星阙'
$ReleaseRepository = 'Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows'

function Write-InstallProgress {
  param(
    [string]$State,
    [string]$Title,
    [string]$Message,
    [int]$Percent
  )

  @(
    Split-Path -Parent $ProgressFile,
    $DepsRoot
  ) | Where-Object { $_ } | Select-Object -Unique | ForEach-Object {
    New-Item -ItemType Directory -Force -Path $_ | Out-Null
  }

  @{
    state = $State
    title = $Title
    message = $Message
    percent = $Percent
    updatedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  } | ConvertTo-Json | Set-Content -Path $ProgressFile -Encoding UTF8
}

function Remove-TreeWithRetry {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return
  }

  $lastError = $null
  for ($i = 0; $i -lt 8; $i++) {
    try {
      Remove-Item -Recurse -Force $Path
      return
    } catch {
      $lastError = $_
      Start-Sleep -Milliseconds 400
    }
  }

  if ($lastError) {
    throw $lastError
  }
}

function Resolve-ReleaseRepository {
  if (Test-Path $ReleaseConfigFile) {
    try {
      $config = Get-Content -Raw $ReleaseConfigFile | ConvertFrom-Json
      $repo = [string]$config.github_repo
      if (-not [string]::IsNullOrWhiteSpace($repo)) {
        return $repo.Trim()
      }
    } catch {}
  }

  return $ReleaseRepository
}

function Get-RuntimeAssetInfo {
  param(
    [string]$Version,
    [pscustomobject]$VersionInfo
  )

  $repo = Resolve-ReleaseRepository
  $runtimePrefixProp = $VersionInfo.PSObject.Properties['runtime_asset_prefix']
  $runtimePrefix = if ($runtimePrefixProp -and -not [string]::IsNullOrWhiteSpace([string]$runtimePrefixProp.Value)) { [string]$runtimePrefixProp.Value } else { 'HorosaRuntimeWindows' }
  $assetName = "$runtimePrefix-$Version.zip"
  $manifestName = "$runtimePrefix-$Version.manifest.json"
  $baseOverride = [string]$env:HOROSA_DESKTOP_RELEASE_DOWNLOAD_BASE_URL
  if (-not [string]::IsNullOrWhiteSpace($baseOverride)) {
    $baseUrl = $baseOverride.Trim().TrimEnd('/')
  } else {
    $baseUrl = "https://github.com/$repo/releases/download/$Version"
  }

  return @{
    AssetName = $assetName
    ManifestName = $manifestName
    AssetUrl = "$baseUrl/$assetName"
    ManifestUrl = "$baseUrl/$manifestName"
  }
}

function Test-RuntimePayloadPresent {
  $wheelCount = if (Test-Path $Wheelhouse) {
    @(Get-ChildItem -Path $Wheelhouse -File -ErrorAction SilentlyContinue).Count
  } else {
    0
  }

  return (Test-Path $PythonExe) -and (Test-Path $PythonWExe) -and $wheelCount -gt 0
}

function Ensure-RuntimePayload {
  param(
    [string]$TargetVersion,
    [pscustomobject]$VersionInfo
  )

  $state = $null
  if (Test-Path $InstallStateFile) {
    try {
      $state = Get-Content -Raw $InstallStateFile | ConvertFrom-Json
    } catch {}
  }

  if ((Test-RuntimePayloadPresent) -and $state -and $state.runtimeVersion -eq $TargetVersion) {
    return
  }

  $asset = Get-RuntimeAssetInfo -Version $TargetVersion -VersionInfo $VersionInfo
  $zipPath = Join-Path $DownloadRoot $asset.AssetName
  $manifestPath = Join-Path $DownloadRoot $asset.ManifestName
  $extractRoot = Join-Path $DownloadRoot ("runtime-" + $TargetVersion)

  New-Item -ItemType Directory -Force -Path $DownloadRoot | Out-Null
  Write-InstallProgress -State 'downloading' -Title '正在下载运行时组件' -Message '首次安装或版本升级时，需要自动下载较大的桌面运行时组件，请耐心等待。' -Percent 20

  $oldProgress = $ProgressPreference
  try {
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Headers @{ 'User-Agent' = 'HorosaDesktopInstaller' } -Uri $asset.ManifestUrl -OutFile $manifestPath
    Invoke-WebRequest -Headers @{ 'User-Agent' = 'HorosaDesktopInstaller' } -Uri $asset.AssetUrl -OutFile $zipPath
  } catch {
    Write-InstallProgress -State 'error' -Title '安装失败' -Message '运行时组件下载失败。请确认网络可用后重试，或重新下载最新 Release。' -Percent 100
    throw
  } finally {
    $ProgressPreference = $oldProgress
  }

  $manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
  $expectedHash = ([string]$manifest.sha256).ToLowerInvariant()
  $actualHash = (Get-FileHash $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($expectedHash -ne $actualHash) {
    Write-InstallProgress -State 'error' -Title '安装失败' -Message '下载到的运行时组件未通过完整性校验，请重新安装。' -Percent 100
    throw "Runtime payload SHA256 mismatch for $($asset.AssetName)"
  }

  Write-InstallProgress -State 'extracting' -Title '正在展开运行时组件' -Message '已下载完成，正在解压并准备本地运行环境。' -Percent 35
  Remove-TreeWithRetry -Path $extractRoot
  Expand-Archive -LiteralPath $zipPath -DestinationPath $extractRoot -Force

  $extractedRuntimeRoot = Join-Path $extractRoot 'local\workspace\runtime\windows'
  $extractedWheelhouse = Join-Path $extractRoot 'desktop_installer_bundle\wheelhouse'
  if (-not (Test-Path $extractedRuntimeRoot)) {
    throw "Extracted runtime payload missing directory: $extractedRuntimeRoot"
  }
  if (-not (Test-Path $extractedWheelhouse)) {
    throw "Extracted runtime payload missing directory: $extractedWheelhouse"
  }

  Remove-TreeWithRetry -Path $RuntimeRoot
  Remove-TreeWithRetry -Path $Wheelhouse
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $RuntimeRoot) | Out-Null
  Copy-Item -Path $extractedRuntimeRoot -Destination (Split-Path -Parent $RuntimeRoot) -Recurse -Force
  Copy-Item -Path $extractedWheelhouse -Destination $ScriptRoot -Recurse -Force
  Remove-TreeWithRetry -Path $extractRoot

  if (-not (Test-RuntimePayloadPresent)) {
    throw 'Runtime payload extraction finished but expected files are still missing.'
  }
}

if (-not (Test-Path $ReqFile)) {
  Write-InstallProgress -State 'error' -Title '安装失败' -Message "安装包缺少运行环境依赖清单：$ReqFile" -Percent 100
  throw "Runtime requirements file not found: $ReqFile"
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ProgressFile) | Out-Null

$versionInfo = Get-Content -Raw (Join-Path $ScriptRoot 'version.json') | ConvertFrom-Json
$targetVersion = [string]$versionInfo.version

if (Test-Path $InstallStateFile) {
  try {
    $state = Get-Content -Raw $InstallStateFile | ConvertFrom-Json
    if ($state.version -eq $targetVersion -and $state.runtimeVersion -eq $targetVersion -and (Test-RuntimePayloadPresent)) {
      Write-InstallProgress -State 'done' -Title "$DisplayName 已准备完成" -Message '当前版本所需的桌面运行环境已经准备好了。' -Percent 100
      Write-Host '[OK] Desktop runtime already prepared.'
      exit 0
    }
  } catch {}
}

Write-InstallProgress -State 'preparing' -Title '正在准备安装程序' -Message '正在检查本地运行环境和桌面依赖。' -Percent 10
Ensure-RuntimePayload -TargetVersion $targetVersion -VersionInfo $versionInfo

if (Test-Path $DepsRoot) {
  Remove-Item -Recurse -Force $DepsRoot
}
New-Item -ItemType Directory -Force -Path $DepsRoot | Out-Null

$env:PIP_DISABLE_PIP_VERSION_CHECK = '1'

function Install-Offline {
  if (-not (Test-Path $Wheelhouse)) {
    return $false
  }

  $wheelCount = @(Get-ChildItem -Path $Wheelhouse -File -ErrorAction SilentlyContinue).Count
  if ($wheelCount -eq 0) {
    return $false
  }

  Write-InstallProgress -State 'installing' -Title '正在安装桌面运行环境' -Message '正在使用已下载的离线组件完成桌面环境安装。' -Percent 55
  & $PythonExe -m pip install --upgrade --target $DepsRoot --no-index --find-links $Wheelhouse -r $ReqFile
  return ($LASTEXITCODE -eq 0)
}

function Install-Online {
  Write-InstallProgress -State 'installing' -Title '正在安装桌面运行环境' -Message '离线组件不可用，正在联网下载桌面组件。' -Percent 55
  & $PythonExe -m pip install --upgrade --target $DepsRoot -r $ReqFile
  return ($LASTEXITCODE -eq 0)
}

$installed = $false
if (Install-Offline) {
  $installed = $true
} else {
  $installed = Install-Online
}

if (-not $installed) {
  Write-InstallProgress -State 'error' -Title '安装失败' -Message '桌面运行环境依赖安装失败。' -Percent 100
  throw 'Desktop runtime dependency install failed.'
}

Write-InstallProgress -State 'finalizing' -Title '正在完成安装' -Message '正在保存运行环境状态，供以后启动时复用。' -Percent 85

@{
  version = $targetVersion
  runtimeVersion = $targetVersion
  installedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  depsRoot = $DepsRoot
} | ConvertTo-Json | Set-Content -Path $InstallStateFile -Encoding UTF8

Write-InstallProgress -State 'done' -Title "$DisplayName 已准备完成" -Message '桌面运行环境已经准备好，可以立即启动。' -Percent 100
Write-Host '[OK] Desktop runtime prepared.'
