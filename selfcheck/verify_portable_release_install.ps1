param(
  [string]$Version = '2026.03.11.3'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ReleaseDir = Join-Path $RepoRoot 'desktop_installer_bundle\release'
$PortableZip = Join-Path $ReleaseDir ("HorosaPortableWindows-{0}.zip" -f $Version)
$RuntimeZip = Join-Path $ReleaseDir ("HorosaRuntimeWindows-{0}.zip" -f $Version)
$RuntimeManifest = Join-Path $ReleaseDir ("HorosaRuntimeWindows-{0}.manifest.json" -f $Version)
$RunStamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$TestRoot = Join-Path 'C:\xqe' ("portable-release-verify-{0}-{1}" -f ($Version -replace '[^0-9A-Za-z]+', '_'), $RunStamp)
$ExtractRoot = Join-Path $TestRoot 'extract'
$LocalAppDataRoot = Join-Path $TestRoot 'LocalAppData'
$InstallState = Join-Path $LocalAppDataRoot 'HorosaDesktop\runtime-pydeps\install_state.json'
$SystemLocalAppData = [Environment]::GetFolderPath('LocalApplicationData')
$DesktopUserRoot = Join-Path $SystemLocalAppData 'Horosa\Horosa Desktop'
$SmokeReady = Join-Path $DesktopUserRoot 'runtime-logs\smoke-ready.json'
$LauncherLog = Join-Path $DesktopUserRoot 'runtime-logs\desktop-launcher.log'
$InstallScript = Join-Path $ExtractRoot '_package\desktop_installer_bundle\install_desktop_runtime.ps1'
$RunScript = Join-Path $ExtractRoot '_package\desktop_installer_bundle\Run_Horosa_Desktop.vbs'
$ServerLog = Join-Path $TestRoot 'runtime-asset-server.log'
$ServerErr = Join-Path $TestRoot 'runtime-asset-server.err.log'

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

function Stop-ProcessesUsingRoot {
  param([string]$RootPath)

  if (-not $RootPath) {
    return
  }

  $normalizedRoot = $RootPath.ToLowerInvariant()
  $candidates = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    ($_.ExecutablePath -and $_.ExecutablePath.ToLowerInvariant().StartsWith($normalizedRoot)) -or
    ($_.CommandLine -and $_.CommandLine.ToLowerInvariant().Contains($normalizedRoot))
  }

  foreach ($proc in $candidates) {
    try {
      Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    } catch {}
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

  $tarCommand = Get-Command 'tar.exe' -ErrorAction SilentlyContinue
  if ($tarCommand) {
    & $tarCommand.Source -xf $ZipPath -C $DestinationPath
    if ($LASTEXITCODE -eq 0) {
      return
    }

    throw "tar extraction failed with exit code $LASTEXITCODE"
  }

  Add-Type -AssemblyName 'System.IO.Compression.FileSystem'
  [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $DestinationPath)
}

if (-not (Test-Path $PortableZip -PathType Leaf)) {
  throw "Portable zip not found: $PortableZip"
}
if (-not (Test-Path $RuntimeZip -PathType Leaf)) {
  throw "Runtime zip not found: $RuntimeZip"
}
if (-not (Test-Path $RuntimeManifest -PathType Leaf)) {
  throw "Runtime manifest not found: $RuntimeManifest"
}

Stop-ProcessesUsingRoot -RootPath $TestRoot
if (Test-Path $TestRoot) {
  Remove-TreeWithRetry -Path $TestRoot
}

New-Item -ItemType Directory -Force -Path $ExtractRoot, $LocalAppDataRoot | Out-Null
Expand-ZipArchive -ZipPath $PortableZip -DestinationPath $ExtractRoot

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = $listener.LocalEndpoint.Port
$listener.Stop()

$serverProcess = $null
try {
  $serverProcess = Start-Process -FilePath 'python' -ArgumentList @('-m', 'http.server', $port, '--bind', '127.0.0.1', '--directory', $ReleaseDir) -PassThru -RedirectStandardOutput $ServerLog -RedirectStandardError $ServerErr -WindowStyle Hidden
  Start-Sleep -Seconds 2

  $oldLocalAppData = $env:LocalAppData
  $oldReleaseBase = $env:HOROSA_DESKTOP_RELEASE_DOWNLOAD_BASE_URL
  $oldSmoke = $env:HOROSA_DESKTOP_SMOKE_TEST
  $oldAutoClose = $env:HOROSA_DESKTOP_AUTOCLOSE_SECONDS
  try {
    $env:LocalAppData = $LocalAppDataRoot
    $env:HOROSA_DESKTOP_RELEASE_DOWNLOAD_BASE_URL = "http://127.0.0.1:$port"
    & $InstallScript
    if (-not (Test-Path $InstallState -PathType Leaf)) {
      throw "Install state file was not created: $InstallState"
    }

    if (Test-Path $SmokeReady -PathType Leaf) {
      Remove-Item -Force $SmokeReady -ErrorAction SilentlyContinue
    }

    $env:HOROSA_DESKTOP_SMOKE_TEST = '1'
    $env:HOROSA_DESKTOP_AUTOCLOSE_SECONDS = '8'
    $launch = Start-Process -FilePath 'wscript.exe' -ArgumentList @($RunScript) -PassThru -WindowStyle Hidden
    $deadline = (Get-Date).AddMinutes(4)
    while ((Get-Date) -lt $deadline) {
      if (Test-Path $SmokeReady -PathType Leaf) {
        break
      }
      Start-Sleep -Seconds 2
    }

    if (-not (Test-Path $SmokeReady -PathType Leaf)) {
      throw "Smoke ready file was not produced: $SmokeReady"
    }

    $state = Get-Content -Raw $InstallState | ConvertFrom-Json
    $smoke = Get-Content -Raw $SmokeReady | ConvertFrom-Json

    $shutdownDeadline = (Get-Date).AddSeconds(25)
    do {
      Start-Sleep -Seconds 2
      Stop-ProcessesUsingRoot -RootPath $ExtractRoot
      $remaining = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        ($_.ExecutablePath -and $_.ExecutablePath.ToLowerInvariant().StartsWith($ExtractRoot.ToLowerInvariant())) -or
        ($_.CommandLine -and $_.CommandLine.ToLowerInvariant().Contains($ExtractRoot.ToLowerInvariant()))
      }
    } while ($remaining -and (Get-Date) -lt $shutdownDeadline)

    [pscustomobject]@{
      version = $Version
      portable_zip_mb = [math]::Round(((Get-Item $PortableZip).Length / 1MB), 2)
      runtime_zip_mb = [math]::Round(((Get-Item $RuntimeZip).Length / 1MB), 2)
      runtime_download_base = "http://127.0.0.1:$port"
      install_version = $state.version
      runtime_version = $state.runtimeVersion
      smoke_status = $smoke.status
      smoke_url = $smoke.url
      smoke_timestamp = $smoke.timestamp
      launcher_log = $LauncherLog
    } | ConvertTo-Json -Depth 4
  } finally {
    $env:LocalAppData = $oldLocalAppData
    $env:HOROSA_DESKTOP_RELEASE_DOWNLOAD_BASE_URL = $oldReleaseBase
    $env:HOROSA_DESKTOP_SMOKE_TEST = $oldSmoke
    $env:HOROSA_DESKTOP_AUTOCLOSE_SECONDS = $oldAutoClose
  }
} finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
  }
}

