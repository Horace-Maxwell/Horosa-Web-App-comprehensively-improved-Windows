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
$InstallLogDir = Join-Path $env:LocalAppData 'HorosaDesktop\runtime-logs'
$InstallLogFile = Join-Path $InstallLogDir 'install-runtime.log'
$PipLogFile = Join-Path $InstallLogDir 'install-runtime-pip.log'
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

  $payload = @{
    state = $State
    title = $Title
    message = $Message
    percent = $Percent
    updatedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  } | ConvertTo-Json

  $utf8Bom = New-Object System.Text.UTF8Encoding($true)
  $bytes = $utf8Bom.GetBytes($payload)
  $lastError = $null
  for ($attempt = 0; $attempt -lt 12; $attempt++) {
    $stream = $null
    try {
      $stream = New-Object System.IO.FileStream(
        $ProgressFile,
        [System.IO.FileMode]::Create,
        [System.IO.FileAccess]::Write,
        [System.IO.FileShare]::ReadWrite
      )
      $stream.SetLength(0)
      $stream.Write($bytes, 0, $bytes.Length)
      $stream.Flush()
      return
    } catch {
      $lastError = $_
      Start-Sleep -Milliseconds 120
    } finally {
      if ($stream) {
        $stream.Dispose()
      }
    }
  }

  if ($lastError) {
    throw $lastError
  }
}

function Write-InstallLog {
  param([string]$Message)

  New-Item -ItemType Directory -Force -Path $InstallLogDir | Out-Null
  $line = "[{0}] {1}" -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'), $Message
  Add-Content -Path $InstallLogFile -Value $line -Encoding UTF8
}

function Get-CurrentProgressState {
  if (-not (Test-Path $ProgressFile -PathType Leaf)) {
    return $null
  }

  try {
    return (Get-Content -Raw $ProgressFile | ConvertFrom-Json)
  } catch {
    return $null
  }
}

function Get-CompactErrorText {
  param([object]$ErrorRecord)

  if ($null -eq $ErrorRecord) {
    return '未知错误'
  }

  if ($ErrorRecord.Exception -and -not [string]::IsNullOrWhiteSpace([string]$ErrorRecord.Exception.Message)) {
    return ([string]$ErrorRecord.Exception.Message).Trim()
  }

  $text = [string]$ErrorRecord
  if (-not [string]::IsNullOrWhiteSpace($text)) {
    return $text.Trim()
  }

  return '未知错误'
}

function Get-DownloadFailureFriendlyMessage {
  param(
    [Parameter(Mandatory = $true)]
    [string]$StageLabel,
    [object]$ErrorRecord
  )

  $reason = Get-CompactErrorText -ErrorRecord $ErrorRecord
  $normalized = $reason.ToLowerInvariant()

  if ($normalized.Contains('404')) {
    return "${StageLabel}下载失败：当前线上安装资源不存在或暂时不可用。请稍后重试，或直接改用离线完整版 XingqueSetupFull.exe。"
  }

  if (
    $normalized.Contains('timed out') -or
    $normalized.Contains('timeout') -or
    $normalized.Contains('name resolution') -or
    $normalized.Contains('no such host') -or
    $normalized.Contains('could not be resolved') -or
    $normalized.Contains('connection') -or
    $normalized.Contains('unable to connect')
  ) {
    return "${StageLabel}下载失败：网络连接不稳定或当前无法访问 GitHub 资源。你可以重试安装，或直接改用离线完整版 XingqueSetupFull.exe。"
  }

  if (
    $normalized.Contains('access denied') -or
    $normalized.Contains('cannot access') -or
    $normalized.Contains('being used by another process')
  ) {
    return "${StageLabel}下载失败：本地下载缓存正在被占用。请关闭其他安装器后重试；如果仍失败，可改用离线完整版 XingqueSetupFull.exe。"
  }

  return "${StageLabel}下载失败。你可以点击`"重试`"重新安装；如果网络较慢或下载总失败，建议直接改用离线完整版 XingqueSetupFull.exe。"
}

function Invoke-DownloadWithRetry {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Uri,
    [Parameter(Mandatory = $true)]
    [string]$OutFile,
    [Parameter(Mandatory = $true)]
    [string]$StageLabel,
    [Parameter(Mandatory = $true)]
    [int]$Percent,
    [string]$BaseMessage,
    [int]$MaxAttempts = 3
  )

  $lastError = $null
  $oldProgress = $ProgressPreference
  $ProgressPreference = 'SilentlyContinue'
  try {
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
      $attemptMessage = if ([string]::IsNullOrWhiteSpace($BaseMessage)) {
        "正在处理：$StageLabel（第 $attempt/$MaxAttempts 次尝试）"
      } else {
        "$BaseMessage`r`n当前步骤：$StageLabel（第 $attempt/$MaxAttempts 次尝试）"
      }
      Write-InstallProgress -State 'downloading' -Title '正在下载运行时组件' -Message $attemptMessage -Percent $Percent
      Write-InstallLog ("Download attempt {0}/{1}: {2}" -f $attempt, $MaxAttempts, $Uri)

      try {
        if (Test-Path $OutFile -PathType Leaf) {
          Remove-Item -Force $OutFile -ErrorAction SilentlyContinue
        }
        Invoke-WebRequest -Headers @{ 'User-Agent' = 'HorosaDesktopInstaller' } -Uri $Uri -OutFile $OutFile
        return
      } catch {
        $lastError = $_
        $compact = Get-CompactErrorText -ErrorRecord $_
        Write-InstallLog ("Download failed ({0}/{1}) for {2}: {3}" -f $attempt, $MaxAttempts, $StageLabel, $compact)
        if ($attempt -lt $MaxAttempts) {
          $retryMessage = "$StageLabel 下载遇到网络或资源错误，正在自动重试。`r`n失败原因：$compact`r`n如果多次失败，建议改用离线完整版 XingqueSetupFull.exe。"
          Write-InstallProgress -State 'downloading' -Title '正在重试下载运行时组件' -Message $retryMessage -Percent $Percent
          Start-Sleep -Seconds ([Math]::Min(2 * $attempt, 6))
        }
      }
    }
  } finally {
    $ProgressPreference = $oldProgress
  }

  if ($lastError) {
    throw $lastError
  }
}

function Publish-InstallFailure {
  param(
    [object]$ErrorRecord,
    [string]$FriendlyMessage = '安装过程中遇到错误。'
  )

  $reason = Get-CompactErrorText -ErrorRecord $ErrorRecord
  $combined = "$FriendlyMessage`r`n失败原因：$reason`r`n详细日志：$InstallLogFile"
  Write-InstallLog ("FAILED: {0}" -f $reason)
  if ($ErrorRecord.ScriptStackTrace) {
    Write-InstallLog ("STACK: {0}" -f $ErrorRecord.ScriptStackTrace)
  }
  Write-InstallProgress -State 'error' -Title '安装失败' -Message $combined -Percent 100
}

function Get-Sha256Hash {
  param([Parameter(Mandatory = $true)][string]$Path)

  $fileHashCmd = Get-Command Get-FileHash -ErrorAction SilentlyContinue
  if ($fileHashCmd) {
    return (Get-FileHash $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  }

  $stream = $null
  try {
    $stream = [System.IO.File]::OpenRead($Path)
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
      $hashBytes = $sha256.ComputeHash($stream)
    } finally {
      $sha256.Dispose()
    }
    return ([System.BitConverter]::ToString($hashBytes) -replace '-', '').ToLowerInvariant()
  } finally {
    if ($stream) {
      $stream.Dispose()
    }
  }
}

function New-ShortRuntimeExtractPath {
  param([Parameter(Mandatory = $true)][string]$Version)

  $tempRoot = [System.IO.Path]::GetTempPath()
  $compactVersion = ($Version -replace '[^0-9A-Za-z]', '')
  if ([string]::IsNullOrWhiteSpace($compactVersion)) {
    $compactVersion = 'runtime'
  }

  $prefix = "xqert-$compactVersion"
  Get-ChildItem -Path $tempRoot -Directory -Filter "$prefix*" -ErrorAction SilentlyContinue | ForEach-Object {
    try {
      if ($_.LastWriteTime -lt (Get-Date).AddHours(-12)) {
        Remove-TreeWithRetry -Path $_.FullName
      }
    } catch {}
  }

  $suffix = "{0}-{1}" -f $PID, ([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())
  return (Join-Path $tempRoot ("{0}-{1}" -f $prefix, $suffix))
}

function Invoke-PipInstall {
  param(
    [string[]]$Arguments,
    [string]$ProgressMessage
  )

  if (Test-Path $PipLogFile) {
    Remove-Item -Force $PipLogFile -ErrorAction SilentlyContinue
  }

  Write-InstallProgress -State 'installing' -Title '正在安装桌面运行环境' -Message $ProgressMessage -Percent 55
  Write-InstallLog ("pip install {0}" -f ($Arguments -join ' '))
  $output = & $PythonExe -m pip @Arguments 2>&1
  $exitCode = $LASTEXITCODE
  if ($null -ne $output) {
    $output | Out-File -FilePath $PipLogFile -Encoding UTF8
    foreach ($line in $output) {
      Write-InstallLog ("pip: {0}" -f $line)
    }
  }

  if ($exitCode -ne 0) {
    $tail = if (Test-Path $PipLogFile) {
      ((Get-Content -Path $PipLogFile -Tail 12) -join ' | ').Trim()
    } else {
      ''
    }
    if ([string]::IsNullOrWhiteSpace($tail)) {
      throw "pip install 失败，退出码：$exitCode"
    }
    throw "pip install 失败，退出码：$exitCode。$tail"
  }

  return $true
}

trap {
  $existingProgress = Get-CurrentProgressState
  if (-not $existingProgress -or [string]$existingProgress.state -ne 'error') {
    Publish-InstallFailure -ErrorRecord $_
  }
  break
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
      try {
        & cmd.exe /d /c "rmdir /s /q `"$Path`"" | Out-Null
        if (-not (Test-Path $Path)) {
          return
        }
      } catch {}
      Start-Sleep -Milliseconds 400
    }
  }

  if ($lastError) {
    throw $lastError
  }
}

function Expand-ZipArchive {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ZipPath,
    [Parameter(Mandatory = $true)]
    [string]$DestinationPath
  )

  Remove-TreeWithRetry -Path $DestinationPath
  New-Item -ItemType Directory -Force -Path $DestinationPath | Out-Null

  Add-Type -AssemblyName 'System.IO.Compression.FileSystem'
  [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $DestinationPath)

  $archive = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
  try {
    foreach ($entry in $archive.Entries) {
      if ([string]::IsNullOrWhiteSpace($entry.FullName)) {
        continue
      }
      if ($entry.FullName.EndsWith('/')) {
        continue
      }
      if ($entry.Length -ne 0) {
        continue
      }

      $targetPath = Join-Path $DestinationPath ($entry.FullName -replace '/', '\')
      $targetDir = Split-Path -Parent $targetPath
      if ($targetDir) {
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
      }
      if (-not (Test-Path $targetPath -PathType Leaf)) {
        New-Item -ItemType File -Force -Path $targetPath | Out-Null
      }
    }
  } finally {
    $archive.Dispose()
  }
}

function Copy-DirectoryTree {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath,
    [Parameter(Mandatory = $true)]
    [string]$DestinationPath
  )

  if (-not (Test-Path $SourcePath -PathType Container)) {
    throw "复制失败，源目录不存在：$SourcePath"
  }

  Remove-TreeWithRetry -Path $DestinationPath
  New-Item -ItemType Directory -Force -Path $DestinationPath | Out-Null

  $robocopyOutput = & robocopy $SourcePath $DestinationPath /E /R:2 /W:1 /NFL /NDL /NJH /NJS /NP 2>&1
  $robocopyExitCode = $LASTEXITCODE
  if ($null -ne $robocopyOutput) {
    foreach ($line in $robocopyOutput) {
      if (-not [string]::IsNullOrWhiteSpace([string]$line)) {
        Write-InstallLog ("robocopy: {0}" -f $line)
      }
    }
  }

  if ($robocopyExitCode -ge 8) {
    throw "robocopy 复制失败，退出码：$robocopyExitCode，源目录：$SourcePath，目标目录：$DestinationPath"
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
  $runtimeTagProp = $VersionInfo.PSObject.Properties['runtime_release_tag']
  $runtimeTag = if ($runtimeTagProp -and -not [string]::IsNullOrWhiteSpace([string]$runtimeTagProp.Value)) { [string]$runtimeTagProp.Value } else { "runtime-$Version" }
  $baseOverride = [string]$env:HOROSA_DESKTOP_RELEASE_DOWNLOAD_BASE_URL
  $configOverrideProp = $VersionInfo.PSObject.Properties['runtime_download_base_url']
  $configOverride = if ($configOverrideProp) { [string]$configOverrideProp.Value } else { '' }
  if (-not [string]::IsNullOrWhiteSpace($baseOverride)) {
    $baseUrl = $baseOverride.Trim().TrimEnd('/')
  } elseif (-not [string]::IsNullOrWhiteSpace($configOverride)) {
    $baseUrl = $configOverride.Trim().TrimEnd('/')
  } else {
    $baseUrl = "https://github.com/$repo/releases/download/$runtimeTag"
  }

  $localAssetRoot = [string]$env:HOROSA_DESKTOP_LOCAL_RUNTIME_ASSET_ROOT
  $localAssetPath = $null
  $localManifestPath = $null
  if (-not [string]::IsNullOrWhiteSpace($localAssetRoot)) {
    $candidateRoot = $localAssetRoot.Trim()
    $candidateAsset = Join-Path $candidateRoot $assetName
    $candidateManifest = Join-Path $candidateRoot $manifestName
    if ((Test-Path $candidateAsset -PathType Leaf) -and (Test-Path $candidateManifest -PathType Leaf)) {
      $localAssetPath = $candidateAsset
      $localManifestPath = $candidateManifest
    }
  }

  return @{
    AssetName = $assetName
    ManifestName = $manifestName
    AssetUrl = "$baseUrl/$assetName"
    ManifestUrl = "$baseUrl/$manifestName"
    LocalAssetPath = $localAssetPath
    LocalManifestPath = $localManifestPath
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
  $extractRoot = New-ShortRuntimeExtractPath -Version $TargetVersion

  New-Item -ItemType Directory -Force -Path $DownloadRoot | Out-Null
  Write-InstallProgress -State 'downloading' -Title '正在下载运行时组件' -Message '首次安装或版本升级时，需要自动下载较大的桌面运行时组件，请耐心等待。' -Percent 20

  if ($asset.LocalAssetPath -and $asset.LocalManifestPath) {
    Write-InstallLog ("Using bundled offline runtime manifest: {0}" -f $asset.LocalManifestPath)
    Write-InstallLog ("Using bundled offline runtime asset: {0}" -f $asset.LocalAssetPath)
    Copy-Item -Path $asset.LocalManifestPath -Destination $manifestPath -Force
    Copy-Item -Path $asset.LocalAssetPath -Destination $zipPath -Force
  } else {
    $baseMessage = '首次安装或版本升级时，需要自动下载较大的桌面运行时组件。安装器会自动重试下载；如果网络较慢或访问 GitHub 不稳定，建议改用离线完整版 XingqueSetupFull.exe。'
    try {
      Invoke-DownloadWithRetry -Uri $asset.ManifestUrl -OutFile $manifestPath -StageLabel '运行时清单文件' -Percent 20 -BaseMessage $baseMessage
      Invoke-DownloadWithRetry -Uri $asset.AssetUrl -OutFile $zipPath -StageLabel '运行时压缩包' -Percent 28 -BaseMessage $baseMessage
    } catch {
      $friendly = Get-DownloadFailureFriendlyMessage -StageLabel '运行时组件' -ErrorRecord $_
      Publish-InstallFailure -ErrorRecord $_ -FriendlyMessage $friendly
      throw
    }
  }

  $manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
  $expectedHash = ([string]$manifest.sha256).ToLowerInvariant()
  $actualHash = Get-Sha256Hash -Path $zipPath
  if ($expectedHash -ne $actualHash) {
    Publish-InstallFailure -ErrorRecord "下载到的运行时组件未通过完整性校验。期望哈希：$expectedHash，实际哈希：$actualHash" -FriendlyMessage '下载到的运行时组件未通过完整性校验，请重新安装。'
    throw "Runtime payload SHA256 mismatch for $($asset.AssetName)"
  }

  Write-InstallProgress -State 'extracting' -Title '正在展开运行时组件' -Message '已下载完成，正在解压并准备本地运行环境。' -Percent 35
  Expand-ZipArchive -ZipPath $zipPath -DestinationPath $extractRoot

  $extractedRuntimeRoot = Join-Path $extractRoot 'local\workspace\runtime\windows'
  $extractedWheelhouse = Join-Path $extractRoot 'desktop_installer_bundle\wheelhouse'
  if (-not (Test-Path $extractedRuntimeRoot)) {
    throw "Extracted runtime payload missing directory: $extractedRuntimeRoot"
  }
  if (-not (Test-Path $extractedWheelhouse)) {
    throw "Extracted runtime payload missing directory: $extractedWheelhouse"
  }

  Copy-DirectoryTree -SourcePath $extractedRuntimeRoot -DestinationPath $RuntimeRoot
  Copy-DirectoryTree -SourcePath $extractedWheelhouse -DestinationPath $Wheelhouse

  $workspaceExtractRoot = Join-Path $extractRoot 'local\workspace'
  if (Test-Path $workspaceExtractRoot -PathType Container) {
    $workspaceTargetRoot = Join-Path $RepoRoot 'local\workspace'
    $runtimeBundleJarSource = Join-Path $extractedRuntimeRoot 'bundle\astrostudyboot.jar'
    $copyPairs = @(
      @{
        SourcePattern = 'astropy\astrostudy\models'
        DestinationPattern = 'astropy\astrostudy\models'
      },
      @{
        SourcePattern = 'flatlib-ctrad2\flatlib\resources\swefiles'
        DestinationPattern = 'flatlib-ctrad2\flatlib\resources\swefiles'
      },
      @{
        SourcePattern = 'astrostudyui\dist-file'
        DestinationPattern = 'astrostudyui\dist-file'
      },
      @{
        SourcePattern = 'astrostudyui\dist'
        DestinationPattern = 'astrostudyui\dist'
      },
      @{
        SourcePattern = 'astrostudysrv\astrostudyboot\target'
        DestinationPattern = 'astrostudysrv\astrostudyboot\target'
      }
    )

    foreach ($projectDir in Get-ChildItem -Path $workspaceExtractRoot -Directory -ErrorAction SilentlyContinue) {
      foreach ($pair in $copyPairs) {
        $sourcePath = Join-Path $projectDir.FullName $pair.SourcePattern
        if (-not (Test-Path $sourcePath)) {
          continue
        }

        $targetPath = Join-Path (Join-Path $workspaceTargetRoot $projectDir.Name) $pair.DestinationPattern
        Copy-DirectoryTree -SourcePath $sourcePath -DestinationPath $targetPath
      }

      $projectJarTargetDir = Join-Path (Join-Path $workspaceTargetRoot $projectDir.Name) 'astrostudysrv\astrostudyboot\target'
      $projectJarTarget = Join-Path $projectJarTargetDir 'astrostudyboot.jar'
      if (-not (Test-Path $projectJarTarget -PathType Leaf) -and (Test-Path $runtimeBundleJarSource -PathType Leaf)) {
        New-Item -ItemType Directory -Force -Path $projectJarTargetDir | Out-Null
        Copy-Item -Path $runtimeBundleJarSource -Destination $projectJarTarget -Force
        Write-InstallLog ("Restored backend jar into project target from runtime bundle: {0}" -f $projectJarTarget)
      }
    }
  }

  Remove-TreeWithRetry -Path $extractRoot

  if (-not (Test-RuntimePayloadPresent)) {
    throw 'Runtime payload extraction finished but expected files are still missing.'
  }
}

if (-not (Test-Path $ReqFile)) {
  Publish-InstallFailure -ErrorRecord "安装包缺少运行环境依赖清单：$ReqFile" -FriendlyMessage '安装包内容不完整，缺少运行环境依赖清单。'
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

  return (Invoke-PipInstall -Arguments @('install', '--upgrade', '--target', $DepsRoot, '--no-index', '--find-links', $Wheelhouse, '-r', $ReqFile) -ProgressMessage '正在使用已下载的离线组件完成桌面环境安装。')
}

function Install-Online {
  return (Invoke-PipInstall -Arguments @('install', '--upgrade', '--target', $DepsRoot, '-r', $ReqFile) -ProgressMessage '离线组件不可用，正在联网下载桌面组件。')
}

$installed = $false
if (Install-Offline) {
  $installed = $true
} else {
  $installed = Install-Online
}

if (-not $installed) {
  Publish-InstallFailure -ErrorRecord '桌面运行环境依赖安装失败。' -FriendlyMessage '桌面运行环境依赖安装失败。'
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

