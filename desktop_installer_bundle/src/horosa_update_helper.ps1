param(
  [Parameter(Mandatory = $true)][string]$ZipPath,
  [Parameter(Mandatory = $true)][string]$TargetDir,
  [Parameter(Mandatory = $true)][string]$RelaunchVbs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

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
  & robocopy $resolvedSource $DestinationRoot /E /XJ /R:2 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
  $copyExitCode = $LASTEXITCODE
  if ($copyExitCode -ge 8) {
    throw ("robocopy failed with exit code {0}: {1} -> {2}" -f $copyExitCode, $resolvedSource, $DestinationRoot)
  }
}

$systemDrive = if ($env:SystemDrive) { $env:SystemDrive } else { 'C:' }
$shortTempBase = Join-Path $systemDrive 'hdu'
New-Item -ItemType Directory -Force -Path $shortTempBase | Out-Null
$tempRoot = Join-Path $shortTempBase ([guid]::NewGuid().ToString('n'))
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

try {
  Wait-ForTargetExit -VbsPath $RelaunchVbs
  Expand-ZipSafely -ArchivePath $ZipPath -DestinationPath $tempRoot
  $payload = Resolve-PayloadRoot -ExtractRoot $tempRoot
  $payloadRoot = $payload.Root

  $destinationRoot = $TargetDir
  if ($payload.Kind -eq 'bundle') {
    $destinationRoot = Join-Path $TargetDir 'desktop_installer_bundle'
  }

  New-Item -ItemType Directory -Force -Path $destinationRoot | Out-Null
  Copy-PayloadOverlay -SourceRoot $payloadRoot -DestinationRoot $destinationRoot

  Start-Sleep -Milliseconds 500
  Start-Process -FilePath 'wscript.exe' -ArgumentList @($RelaunchVbs) -WorkingDirectory (Split-Path -Parent $RelaunchVbs) | Out-Null
} finally {
  Start-Sleep -Milliseconds 500
  if (Test-Path $tempRoot) {
    Remove-Item -Recurse -Force $tempRoot -ErrorAction SilentlyContinue
  }
}
