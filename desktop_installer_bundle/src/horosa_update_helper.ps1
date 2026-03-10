param(
  [Parameter(Mandatory = $true)][string]$ZipPath,
  [Parameter(Mandatory = $true)][string]$TargetDir,
  [Parameter(Mandatory = $true)][string]$RelaunchVbs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$script:UpdateLogPath = $null

function Get-UpdateLogPath {
  param([Parameter(Mandatory = $true)][string]$Root)

  $bundleRoot = Join-Path $Root 'desktop_installer_bundle'
  if (Test-Path $bundleRoot) {
    return Join-Path $bundleRoot 'update-helper.log'
  }

  return Join-Path $Root 'update-helper.log'
}

function Write-UpdateLog {
  param([Parameter(Mandatory = $true)][string]$Message)

  if (-not $script:UpdateLogPath) {
    return
  }

  $logDir = Split-Path -Parent $script:UpdateLogPath
  if ($logDir) {
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  }

  $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  Add-Content -Path $script:UpdateLogPath -Value "[$timestamp] $Message" -Encoding UTF8
}

function Resolve-VersionFilePath {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][ValidateSet('repo', 'bundle')]$Kind
  )

  if ($Kind -eq 'repo') {
    return Join-Path $Root 'desktop_installer_bundle\version.json'
  }

  return Join-Path $Root 'version.json'
}

function Read-VersionLabel {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][ValidateSet('repo', 'bundle')]$Kind
  )

  $versionFile = Resolve-VersionFilePath -Root $Root -Kind $Kind
  if (-not (Test-Path $versionFile)) {
    return $null
  }

  try {
    $payload = Get-Content -Raw $versionFile | ConvertFrom-Json
    return [string]$payload.version
  } catch {
    return $null
  }
}

function Expand-ZipSafely {
  param(
    [Parameter(Mandatory = $true)][string]$ArchivePath,
    [Parameter(Mandatory = $true)][string]$DestinationPath
  )

  if (Test-Path $DestinationPath) {
    Remove-Item -Recurse -Force $DestinationPath
  }
  New-Item -ItemType Directory -Force -Path $DestinationPath | Out-Null

  $archive = [System.IO.Compression.ZipFile]::OpenRead($ArchivePath)
  try {
    foreach ($entry in $archive.Entries) {
      if ([string]::IsNullOrWhiteSpace($entry.FullName)) {
        continue
      }

      $targetPath = Join-Path $DestinationPath $entry.FullName
      $normalizedTarget = [System.IO.Path]::GetFullPath($targetPath)
      $normalizedRoot = [System.IO.Path]::GetFullPath($DestinationPath)
      if (-not $normalizedTarget.StartsWith($normalizedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Unsafe zip entry detected: $($entry.FullName)"
      }

      if ($entry.FullName.EndsWith('/')) {
        New-Item -ItemType Directory -Force -Path $normalizedTarget | Out-Null
        continue
      }

      $targetDir = Split-Path -Parent $normalizedTarget
      if ($targetDir) {
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
      }

      $entryStream = $entry.Open()
      try {
        $fileStream = [System.IO.File]::Open($normalizedTarget, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        try {
          $entryStream.CopyTo($fileStream)
        } finally {
          $fileStream.Dispose()
        }
      } finally {
        $entryStream.Dispose()
      }
    }
  } finally {
    $archive.Dispose()
  }
}

function Resolve-PayloadRoot {
  param([string]$ExtractRoot)

  $repoMarkers = @('desktop_installer_bundle', 'README.md')
  $bundleMarkers = @('version.json', 'src', 'Run_Horosa_Desktop.vbs')

  $directKind = $null
  $repoMatch = $true
  foreach ($marker in $repoMarkers) {
    if (-not (Test-Path (Join-Path $ExtractRoot $marker))) {
      $repoMatch = $false
      break
    }
  }
  if ($repoMatch) {
    $directKind = 'repo'
  } else {
    $bundleMatch = $true
    foreach ($marker in $bundleMarkers) {
      if (-not (Test-Path (Join-Path $ExtractRoot $marker))) {
        $bundleMatch = $false
        break
      }
    }
    if ($bundleMatch) {
      $directKind = 'bundle'
    }
  }
  if ($directKind) {
    return [pscustomobject]@{
      Root = $ExtractRoot
      Kind = $directKind
    }
  }

  $children = @(Get-ChildItem -Path $ExtractRoot -Directory -ErrorAction SilentlyContinue)
  if ($children.Count -eq 1) {
    $childRoot = $children[0].FullName
    $childRepoMatch = $true
    foreach ($marker in $repoMarkers) {
      if (-not (Test-Path (Join-Path $childRoot $marker))) {
        $childRepoMatch = $false
        break
      }
    }
    if ($childRepoMatch) {
      return [pscustomobject]@{
        Root = $childRoot
        Kind = 'repo'
      }
    }

    $childBundleMatch = $true
    foreach ($marker in $bundleMarkers) {
      if (-not (Test-Path (Join-Path $childRoot $marker))) {
        $childBundleMatch = $false
        break
      }
    }
    if ($childBundleMatch) {
      return [pscustomobject]@{
        Root = $childRoot
        Kind = 'bundle'
      }
    }
  }

  throw "Unable to locate update payload root inside: $ExtractRoot"
}

function Wait-ForTargetExit {
  param([string]$VbsPath)

  for ($i = 0; $i -lt 120; $i++) {
    $proc = Get-CimInstance Win32_Process -Filter "Name='pythonw.exe' OR Name='HorosaDesktop.exe'" -ErrorAction SilentlyContinue |
      Where-Object {
        $cmd = [string]$_.CommandLine
        $cmd.IndexOf('horosa_desktop.pyw', [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -or
        $cmd.IndexOf('HorosaDesktop.exe', [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -or
        $cmd.IndexOf($VbsPath, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
      }
    if (-not $proc) {
      return
    }
    Start-Sleep -Milliseconds 500
  }

  throw "Timed out waiting for Horosa Desktop to exit."
}

function Copy-PayloadOverlay {
  param(
    [string]$SourceRoot,
    [string]$DestinationRoot
  )

  $resolvedSource = (Resolve-Path $SourceRoot).Path
  New-Item -ItemType Directory -Force -Path $DestinationRoot | Out-Null
  Write-UpdateLog ("Copying payload via robocopy: {0} -> {1}" -f $resolvedSource, $DestinationRoot)
  & robocopy $resolvedSource $DestinationRoot /E /XJ /R:2 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
  $copyExitCode = $LASTEXITCODE
  Write-UpdateLog ("robocopy exit code: {0}" -f $copyExitCode)
  if ($copyExitCode -ge 8) {
    throw ("robocopy failed with exit code {0}: {1} -> {2}" -f $copyExitCode, $resolvedSource, $DestinationRoot)
  }
}

$systemDrive = if ($env:SystemDrive) { $env:SystemDrive } else { 'C:' }
$shortTempBase = Join-Path $systemDrive 'hdu'
New-Item -ItemType Directory -Force -Path $shortTempBase | Out-Null
$tempRoot = Join-Path $shortTempBase ([guid]::NewGuid().ToString('n'))
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
$script:UpdateLogPath = Get-UpdateLogPath -Root $TargetDir
Write-UpdateLog ("Updater started. ZipPath={0}; TargetDir={1}; RelaunchVbs={2}; PowerShell={3}" -f $ZipPath, $TargetDir, $RelaunchVbs, $PSHOME)

try {
  try {
    $targetVersionBefore = $null
    if (Test-Path $TargetDir) {
      $targetVersionBefore = Read-VersionLabel -Root $TargetDir -Kind 'repo'
      if (-not $targetVersionBefore) {
        $targetVersionBefore = Read-VersionLabel -Root $TargetDir -Kind 'bundle'
      }
    }
    if ($targetVersionBefore) {
      Write-UpdateLog ("Target version before apply: {0}" -f $targetVersionBefore)
    }

    Write-UpdateLog 'Waiting for running desktop processes to exit.'
    Wait-ForTargetExit -VbsPath $RelaunchVbs
    Write-UpdateLog 'Target processes stopped.'

    Write-UpdateLog ("Extracting zip to temp root: {0}" -f $tempRoot)
    Expand-ZipSafely -ArchivePath $ZipPath -DestinationPath $tempRoot
    $payload = Resolve-PayloadRoot -ExtractRoot $tempRoot
    $payloadRoot = $payload.Root
    Write-UpdateLog ("Resolved payload root: {0}; kind={1}" -f $payloadRoot, $payload.Kind)

    $payloadVersion = Read-VersionLabel -Root $payloadRoot -Kind $payload.Kind
    if ($payloadVersion) {
      Write-UpdateLog ("Payload version: {0}" -f $payloadVersion)
    }

    $destinationRoot = $TargetDir
    if ($payload.Kind -eq 'bundle') {
      $destinationRoot = Join-Path $TargetDir 'desktop_installer_bundle'
    }
    Write-UpdateLog ("Destination root: {0}" -f $destinationRoot)

    New-Item -ItemType Directory -Force -Path $destinationRoot | Out-Null
    Copy-PayloadOverlay -SourceRoot $payloadRoot -DestinationRoot $destinationRoot

    $targetVersionAfter = Read-VersionLabel -Root $TargetDir -Kind $payload.Kind
    if ($targetVersionAfter) {
      Write-UpdateLog ("Target version after copy: {0}" -f $targetVersionAfter)
    }
    if ($payloadVersion -and $targetVersionAfter -and $payloadVersion -ne $targetVersionAfter) {
      throw ("Update copy verification failed. Expected version {0}, found {1}" -f $payloadVersion, $targetVersionAfter)
    }

    Start-Sleep -Milliseconds 500
    Write-UpdateLog ("Relaunching via: {0}" -f $RelaunchVbs)
    Start-Process -FilePath 'wscript.exe' -ArgumentList @($RelaunchVbs) -WorkingDirectory (Split-Path -Parent $RelaunchVbs) | Out-Null
    Write-UpdateLog 'Relaunch requested successfully.'
  } catch {
    Write-UpdateLog ("Updater failed: {0}" -f $_.Exception.Message)
    throw
  }
} finally {
  Start-Sleep -Milliseconds 500
  if (Test-Path $tempRoot) {
    Remove-Item -Recurse -Force $tempRoot -ErrorAction SilentlyContinue
  }
  Write-UpdateLog ("Updater finished. Temp root cleaned: {0}" -f $tempRoot)
}
