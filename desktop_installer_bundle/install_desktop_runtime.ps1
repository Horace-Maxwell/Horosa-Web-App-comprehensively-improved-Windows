Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptRoot
$PythonExe = Join-Path $RepoRoot 'local\workspace\runtime\windows\python\python.exe'
$DepsRoot = Join-Path $env:LocalAppData 'HorosaDesktop\runtime-pydeps'
$ProgressFile = Join-Path $env:LocalAppData 'HorosaDesktop\install-progress.json'
$ReqFile = Join-Path $ScriptRoot 'runtime_requirements.txt'
$Wheelhouse = Join-Path $ScriptRoot 'wheelhouse'
$InstallStateFile = Join-Path $DepsRoot 'install_state.json'

if (-not (Test-Path $PythonExe)) {
  throw "Bundled Python not found: $PythonExe"
}

if (-not (Test-Path $ReqFile)) {
  throw "Runtime requirements file not found: $ReqFile"
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ProgressFile) | Out-Null

function Write-InstallProgress {
  param(
    [string]$State,
    [string]$Title,
    [string]$Message,
    [int]$Percent
  )

  @{
    state = $State
    title = $Title
    message = $Message
    percent = $Percent
    updatedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  } | ConvertTo-Json | Set-Content -Path $ProgressFile -Encoding UTF8
}

$versionInfo = Get-Content -Raw (Join-Path $ScriptRoot 'version.json') | ConvertFrom-Json
$targetVersion = [string]$versionInfo.version

if (Test-Path $InstallStateFile) {
  try {
    $state = Get-Content -Raw $InstallStateFile | ConvertFrom-Json
    if ($state.version -eq $targetVersion) {
      Write-InstallProgress -State 'done' -Title 'Horosa Desktop 已准备完成' -Message '当前版本所需的桌面运行环境已经准备好了。' -Percent 100
      Write-Host '[OK] Desktop runtime already prepared.'
      exit 0
    }
  } catch {}
}

Write-InstallProgress -State 'preparing' -Title '正在准备安装程序' -Message '正在检查本地运行环境和桌面依赖。' -Percent 10

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

  Write-InstallProgress -State 'installing' -Title '正在安装桌面运行环境' -Message '正在使用随包附带的离线组件。' -Percent 45
  & $PythonExe -m pip install --upgrade --target $DepsRoot --no-index --find-links $Wheelhouse -r $ReqFile
  return ($LASTEXITCODE -eq 0)
}

function Install-Online {
  Write-InstallProgress -State 'installing' -Title '正在安装桌面运行环境' -Message '正在下载所需的桌面组件。' -Percent 45
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
  installedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  depsRoot = $DepsRoot
} | ConvertTo-Json | Set-Content -Path $InstallStateFile -Encoding UTF8

Write-InstallProgress -State 'done' -Title 'Horosa Desktop 已准备完成' -Message '桌面运行环境已经准备好，可以立即启动。' -Percent 100
Write-Host '[OK] Desktop runtime prepared.'
