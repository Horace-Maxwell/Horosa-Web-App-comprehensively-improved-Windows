param(
  [Parameter(Mandatory = $true)][string]$ZipPath,
  [Parameter(Mandatory = $true)][string]$TargetDir,
  [Parameter(Mandatory = $true)][string]$RelaunchVbs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

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

  foreach ($item in Get-ChildItem -LiteralPath $SourceRoot -Force) {
    $dest = Join-Path $DestinationRoot $item.Name
    if ($item.PSIsContainer) {
      New-Item -ItemType Directory -Force -Path $dest | Out-Null
      $children = @(Get-ChildItem -LiteralPath $item.FullName -Force -ErrorAction SilentlyContinue)
      if ($children.Count -gt 0) {
        foreach ($child in $children) {
          Copy-Item -LiteralPath $child.FullName -Destination $dest -Recurse -Force
        }
      }
    } else {
      Copy-Item -LiteralPath $item.FullName -Destination $dest -Force
    }
  }
}

$tempRoot = Join-Path $env:TEMP ("horosa-desktop-update-" + [guid]::NewGuid().ToString('n'))
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

try {
  Wait-ForTargetExit -VbsPath $RelaunchVbs
  Expand-Archive -LiteralPath $ZipPath -DestinationPath $tempRoot -Force
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
