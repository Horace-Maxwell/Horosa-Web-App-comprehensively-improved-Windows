param(
  [string]$Version,
  [string]$Branch = 'main',
  [switch]$SkipBuild,
  [switch]$SkipPush
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptRoot
$VersionFile = Join-Path $ScriptRoot 'version.json'

if (-not (Test-Path $VersionFile)) {
  throw "version.json not found: $VersionFile"
}

$VersionInfo = Get-Content -Raw $VersionFile | ConvertFrom-Json
$ResolvedVersion = if ($Version) { $Version.Trim() } else { [string]$VersionInfo.version }

if (-not $ResolvedVersion) {
  throw 'Resolved release version is empty.'
}

if ([string]$VersionInfo.version -ne $ResolvedVersion) {
  throw "version.json version '$($VersionInfo.version)' does not match requested version '$ResolvedVersion'."
}

Push-Location $RepoRoot
try {
  $dirty = git status --porcelain
  if ($dirty) {
    Write-Host '[INFO] Working tree has local changes:'
    $dirty | ForEach-Object { Write-Host $_ }
    Write-Host '[INFO] Continuing because this release flow intentionally includes new desktop bundle files.'
  }

  if (-not $SkipBuild) {
    & (Join-Path $ScriptRoot 'build_portable_release_zip.ps1') -Version $ResolvedVersion
  }

  $tagExistsLocal = git rev-parse -q --verify "refs/tags/$ResolvedVersion" 2>$null
  if (-not $tagExistsLocal) {
    git tag -a $ResolvedVersion -m "Horosa Desktop $ResolvedVersion"
  } else {
    Write-Host "[INFO] Local tag already exists: $ResolvedVersion"
  }

  if (-not $SkipPush) {
    git push origin "HEAD:$Branch"
    git push origin "refs/tags/$ResolvedVersion"
    Write-Host "[OK] Pushed commit and tag $ResolvedVersion. GitHub Actions should create the release automatically."
  } else {
    Write-Host "[OK] Prepared local tag $ResolvedVersion without pushing."
  }
}
finally {
  Pop-Location
}
