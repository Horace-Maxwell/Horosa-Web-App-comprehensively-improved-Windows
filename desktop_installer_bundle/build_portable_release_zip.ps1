param(
  [Parameter(Mandatory = $true)]
  [string]$Version,

  [switch]$RequireTagMatch
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptRoot
$releaseRoot = Join-Path $scriptRoot 'release'
$portableRoot = Join-Path $releaseRoot 'portable-staging'

function Resolve-TagValue {
  param([string]$RawVersion)

  $value = $RawVersion.Trim()
  if ($value.StartsWith('refs/tags/')) {
    return $value.Substring(10)
  }
  return $value
}

function Resolve-ProjectDir {
  param([string]$WorkspaceRoot)

  $pointerFile = Join-Path $WorkspaceRoot 'HOROSA_PROJECT_DIR.txt'
  if (Test-Path $pointerFile) {
    $pointerValue = Get-Content -Path $pointerFile | Where-Object {
      $_ -and -not $_.StartsWith('#')
    } | Select-Object -First 1
    if ($pointerValue) {
      $candidate = $pointerValue
      if (-not [System.IO.Path]::IsPathRooted($candidate)) {
        $candidate = Join-Path $WorkspaceRoot $candidate
      }
      if (Test-Path (Join-Path $candidate 'astrostudyui')) {
        return (Resolve-Path $candidate).Path
      }
    }
  }

  $match = Get-ChildItem -Path $WorkspaceRoot -Directory |
    Where-Object {
      (Test-Path (Join-Path $_.FullName 'astrostudyui')) -and
      (Test-Path (Join-Path $_.FullName 'astrostudysrv')) -and
      (Test-Path (Join-Path $_.FullName 'astropy'))
    } |
    Sort-Object Name |
    Select-Object -First 1

  if ($match) {
    return $match.FullName
  }

  throw "Unable to locate Horosa project directory under $WorkspaceRoot"
}

function Invoke-RoboCopy {
  param(
    [string]$Source,
    [string]$Destination,
    [string[]]$ExcludeDirs = @(),
    [string[]]$ExcludeFiles = @()
  )

  New-Item -ItemType Directory -Force -Path $Destination | Out-Null
  $arguments = @(
    $Source,
    $Destination,
    '/E',
    '/R:1',
    '/W:1',
    '/NFL',
    '/NDL',
    '/NJH',
    '/NJS',
    '/NP'
  )
  if ($ExcludeDirs.Count -gt 0) {
    $arguments += '/XD'
    $arguments += $ExcludeDirs
  }
  if ($ExcludeFiles.Count -gt 0) {
    $arguments += '/XF'
    $arguments += $ExcludeFiles
  }

  & robocopy @arguments | Out-Null
  $exitCode = $LASTEXITCODE
  if ($exitCode -gt 7) {
    throw "robocopy failed for $Source -> $Destination with exit code $exitCode"
  }
}

function Copy-PortableFile {
  param(
    [string]$Source,
    [string]$Destination
  )

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
  Copy-Item -Path $Source -Destination $Destination -Force
}

function Get-Sha256 {
  param([string]$Path)

  return (Get-FileHash -Path $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

$releaseTag = Resolve-TagValue -RawVersion $Version
if ($RequireTagMatch -and -not ($releaseTag -like 'windows-stable-*')) {
  throw "Portable stable release tag must match windows-stable-*. Current: $releaseTag"
}

$workspaceRoot = Join-Path $repoRoot 'local\workspace'
$projectDir = Resolve-ProjectDir -WorkspaceRoot $workspaceRoot
$projectName = Split-Path -Leaf $projectDir
$runtimeRoot = Join-Path $workspaceRoot 'runtime\windows'

if (-not (Test-Path $runtimeRoot)) {
  throw "Portable runtime not found: $runtimeRoot"
}

if (Test-Path $portableRoot) {
  Remove-Item -Recurse -Force $portableRoot
}
New-Item -ItemType Directory -Force -Path $portableRoot | Out-Null

$packageRoot = Join-Path $portableRoot "HorosaPortableWindows-$releaseTag"
New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null

Copy-PortableFile -Source (Join-Path $repoRoot 'START_HERE.bat') -Destination (Join-Path $packageRoot 'START_HERE.bat')
Copy-PortableFile -Source (Join-Path $repoRoot 'README.md') -Destination (Join-Path $packageRoot 'README.md')
if (Test-Path (Join-Path $repoRoot 'docs')) {
  Invoke-RoboCopy -Source (Join-Path $repoRoot 'docs') -Destination (Join-Path $packageRoot 'docs')
}
if (Test-Path (Join-Path $repoRoot 'log')) {
  Invoke-RoboCopy -Source (Join-Path $repoRoot 'log') -Destination (Join-Path $packageRoot 'log')
}

Copy-PortableFile -Source (Join-Path $repoRoot 'local\Horosa_Local_Windows.bat') -Destination (Join-Path $packageRoot 'local\Horosa_Local_Windows.bat')
Copy-PortableFile -Source (Join-Path $repoRoot 'local\Horosa_Local_Windows.ps1') -Destination (Join-Path $packageRoot 'local\Horosa_Local_Windows.ps1')

if (Test-Path (Join-Path $workspaceRoot 'HOROSA_PROJECT_DIR.txt')) {
  Copy-PortableFile -Source (Join-Path $workspaceRoot 'HOROSA_PROJECT_DIR.txt') -Destination (Join-Path $packageRoot 'local\workspace\HOROSA_PROJECT_DIR.txt')
}

Invoke-RoboCopy -Source $runtimeRoot -Destination (Join-Path $packageRoot 'local\workspace\runtime\windows')
Invoke-RoboCopy `
  -Source $projectDir `
  -Destination (Join-Path $packageRoot "local\workspace\$projectName") `
  -ExcludeDirs @('node_modules', '.git', '.horosa-local-logs-win', '.horosa-browser-profile-win', '.umi', 'plugin_mfsu', '__pycache__') `
  -ExcludeFiles @('*.pid', '*.lock')

$guideTemplate = @'
# Horosa Windows 稳定版（非 App 浏览器壳）

## 使用说明

1. 解压 `HorosaPortableWindows-__TAG__.zip`
2. 进入解压后的目录
3. 双击 `START_HERE.bat`

## 默认行为

- 启动窗口默认最大化
- 页面内容缩放固定保持 `0.8`
- 关闭窗口后会自动停止本地服务（若未启用服务复用）

## 说明

- 这是非 App 版稳定入口，基于本地浏览器 `--app` 壳启动
- 安装版用户请下载 GitHub Release 中的 `Horosa-Setup-1.0.4.exe`
'@
$guideContent = $guideTemplate.Replace('__TAG__', $releaseTag)
$guidePath = Join-Path $packageRoot "使用说明-$releaseTag.md"
Set-Content -Path $guidePath -Value $guideContent -Encoding UTF8

New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
$zipName = "HorosaPortableWindows-$releaseTag.zip"
$zipPath = Join-Path $releaseRoot $zipName
if (Test-Path $zipPath) {
  Remove-Item -Force $zipPath
}
Compress-Archive -Path (Join-Path $packageRoot '*') -DestinationPath $zipPath -CompressionLevel Optimal

$manifestName = "HorosaPortableWindows-$releaseTag.manifest.json"
$manifestPath = Join-Path $releaseRoot $manifestName
$manifest = [ordered]@{
  tag = $releaseTag
  generatedAt = (Get-Date).ToString('o')
  packageType = 'windows-stable-browser-shell'
  archive = $zipName
  archiveSha256 = Get-Sha256 -Path $zipPath
  launcher = 'START_HERE.bat'
  projectDir = $projectName
  runtimeRoot = 'local/workspace/runtime/windows'
}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -Encoding UTF8

Write-Host "Portable stable archive created: $zipPath"
Write-Host "Portable stable manifest created: $manifestPath"
