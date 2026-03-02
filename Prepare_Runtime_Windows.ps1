Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-HorosaProjectDir {
  param([string]$DirPath)

  if ([string]::IsNullOrWhiteSpace($DirPath)) { return $false }
  if (-not (Test-Path $DirPath -PathType Container)) { return $false }

  $requiredDirs = @('astrostudyui', 'astrostudysrv', 'astropy')
  foreach ($requiredDir in $requiredDirs) {
    if (-not (Test-Path (Join-Path $DirPath $requiredDir) -PathType Container)) {
      return $false
    }
  }
  return $true
}

function Resolve-ProjectDir {
  param([string]$BaseDir)

  if (Test-HorosaProjectDir -DirPath $BaseDir) {
    return (Resolve-Path $BaseDir).Path
  }

  if (-not [string]::IsNullOrWhiteSpace($env:HOROSA_PROJECT_DIR)) {
    $customDir = $env:HOROSA_PROJECT_DIR.Trim()
    if (-not [System.IO.Path]::IsPathRooted($customDir)) {
      $customDir = Join-Path $BaseDir $customDir
    }
    if (Test-HorosaProjectDir -DirPath $customDir) {
      return (Resolve-Path $customDir).Path
    }
    Write-Host ("[WARN] HOROSA_PROJECT_DIR is set but invalid: {0}" -f $env:HOROSA_PROJECT_DIR)
  }

  $preferredNames = @(
    'Horosa-Web',
    'Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c'
  )
  foreach ($name in $preferredNames) {
    $candidate = Join-Path $BaseDir $name
    if (Test-HorosaProjectDir -DirPath $candidate) {
      return (Resolve-Path $candidate).Path
    }
  }

  $matches = @(
    Get-ChildItem -Path $BaseDir -Directory -ErrorAction SilentlyContinue |
      Where-Object { Test-HorosaProjectDir -DirPath $_.FullName } |
      Sort-Object Name
  )
  if ($matches.Count -gt 0) {
    return $matches[0].FullName
  }

  return $null
}

function Resolve-FrontendBuildSource {
  param([string]$ProjDir)

  $distFileDir = Join-Path $ProjDir 'astrostudyui\dist-file'
  $distDir = Join-Path $ProjDir 'astrostudyui\dist'
  $distFileIndex = Join-Path $distFileDir 'index.html'
  $distIndex = Join-Path $distDir 'index.html'

  $hasDistFile = Test-Path $distFileIndex
  $hasDist = Test-Path $distIndex

  if ($hasDistFile -and $hasDist) {
    $distFileTime = (Get-Item $distFileIndex).LastWriteTimeUtc
    $distTime = (Get-Item $distIndex).LastWriteTimeUtc
    if ($distTime -gt $distFileTime) {
      return [pscustomobject]@{
        Kind = 'dist'
        Path = $distDir
      }
    }
    return [pscustomobject]@{
      Kind = 'dist-file'
      Path = $distFileDir
    }
  }

  if ($hasDistFile) {
    return [pscustomobject]@{
      Kind = 'dist-file'
      Path = $distFileDir
    }
  }
  if ($hasDist) {
    return [pscustomobject]@{
      Kind = 'dist'
      Path = $distDir
    }
  }

  return $null
}

$RuntimeRoot = Join-Path $Root 'runtime\\windows'
$JavaDst = Join-Path $RuntimeRoot 'java'
$PyDst = Join-Path $RuntimeRoot 'python'
$WheelsDst = Join-Path $RuntimeRoot 'wheels'
$BundleDst = Join-Path $RuntimeRoot 'bundle'
$WheelsBundleDst = Join-Path $BundleDst 'wheels'
$ProjectDir = Resolve-ProjectDir -BaseDir $Root
if (-not $ProjectDir) {
  Write-Host "Project folder not found under: $Root"
  Write-Host 'Expected a folder that contains astrostudyui / astrostudysrv / astropy.'
  Write-Host 'You can set HOROSA_PROJECT_DIR to override project directory detection.'
  Read-Host 'Press Enter to exit'
  exit 1
}
$JarSrc = Join-Path $ProjectDir 'astrostudysrv\\astrostudyboot\\target\\astrostudyboot.jar'
$DistFileSrc = Join-Path $ProjectDir 'astrostudyui\\dist-file'
$DistSrc = Join-Path $ProjectDir 'astrostudyui\\dist'
$JarBundleDst = Join-Path $BundleDst 'astrostudyboot.jar'
$DistFileBundleDst = Join-Path $BundleDst 'dist-file'
$DistBundleDst = Join-Path $BundleDst 'dist'

New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null
New-Item -ItemType Directory -Force -Path $BundleDst | Out-Null

function Test-PythonDeps {
  param([string]$PythonExe)
  if (-not (Test-Path $PythonExe)) { return $false }
  try {
    $flatlibPath = Join-Path $ProjectDir 'flatlib-ctrad2'
    $flatlibEscaped = $flatlibPath.Replace('\', '\\')
    & $PythonExe -c "import os,sys;p=r'$flatlibEscaped';p and os.path.isdir(os.path.join(p,'flatlib')) and sys.path.insert(0,p);import cherrypy,jsonpickle,swisseph,flatlib;print('ok')" *> $null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

function Get-PythonVersionInfo {
  param([string]$PythonExe)
  if (-not (Test-Path $PythonExe)) { return $null }
  try {
    $out = & $PythonExe -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
    if (-not $out) { return $null }
    $text = ($out | Select-Object -First 1).ToString().Trim()
    $parts = $text.Split('.')
    if ($parts.Length -lt 2) { return $null }

    $major = 0
    $minor = 0
    if (-not [int]::TryParse($parts[0], [ref]$major)) { return $null }
    if (-not [int]::TryParse($parts[1], [ref]$minor)) { return $null }

    return [pscustomobject]@{
      Major = $major
      Minor = $minor
      Text = $text
    }
  } catch {
    return $null
  }
}

function Resolve-MavenCmd {
  if ($env:HOROSA_MVN -and (Test-Path $env:HOROSA_MVN)) {
    return $env:HOROSA_MVN
  }

  $candidates = @(
    (Join-Path $Root 'runtime/windows/maven/bin/mvn.cmd'),
    (Join-Path $Root 'runtime/windows/maven/bin/mvn.bat'),
    "$env:ProgramFiles\Apache\maven\bin\mvn.cmd",
    "$env:ProgramFiles\apache-maven\bin\mvn.cmd",
    "$env:LocalAppData\Microsoft\WinGet\Links\mvn.cmd"
  )
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return $candidate
    }
  }

  $inPath = Get-Command 'mvn' -ErrorAction SilentlyContinue
  if ($inPath -and $inPath.Source) {
    return $inPath.Source
  }

  return $null
}

function Try-BuildBackendJar {
  param(
    [string]$ProjDir,
    [string]$TargetJarPath
  )

  if (Test-Path $TargetJarPath) { return $true }
  $bootDir = Join-Path $ProjDir 'astrostudysrv\astrostudyboot'
  if (-not (Test-Path $bootDir)) {
    Write-Host ("[WARN] Backend build folder not found: {0}" -f $bootDir)
    return $false
  }

  $mvn = Resolve-MavenCmd
  if (-not $mvn) {
    Write-Host '[WARN] Maven not found, cannot auto-build backend jar.'
    return $false
  }

  Write-Host ("[mvn] package astrostudyboot via {0}" -f $mvn)
  try {
    Push-Location $bootDir
    & $mvn -DskipTests package
  } catch {
    Write-Host ("[WARN] Maven build failed: {0}" -f $_.Exception.Message)
  } finally {
    Pop-Location
  }

  return (Test-Path $TargetJarPath)
}

function Test-WheelCompleteness {
  param([string]$WheelDir)

  if (-not (Test-Path $WheelDir)) { return $false }
  $requiredPrefixes = @(
    'CherryPy-',
    'jsonpickle-',
    'pyswisseph-'
  )
  foreach ($prefix in $requiredPrefixes) {
    $match = Get-ChildItem -Path $WheelDir -File -Filter ($prefix + '*.whl') -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $match) {
      return $false
    }
  }
  return $true
}

function Ensure-UrlTemplateFile {
  param(
    [string]$Path,
    [string[]]$Lines
  )

  if (Test-Path $Path) { return }
  $dir = Split-Path -Parent $Path
  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  Set-Content -Path $Path -Value $Lines -Encoding UTF8
  Write-Host ("[OK] URL template created: {0}" -f $Path)
}

function Get-Sha256Text {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return $null }
  try {
    $hashObjs = @(Get-FileHash -LiteralPath $Path -Algorithm SHA256 -ErrorAction Stop)
    if ($hashObjs.Count -gt 0 -and $hashObjs[0].Hash) {
      return ("{0}" -f $hashObjs[0].Hash).ToLowerInvariant()
    }
  } catch {
    # Fallback for environments where Get-FileHash is blocked/unavailable.
    try {
      $certOut = certutil -hashfile $Path SHA256 2>$null
      $hexLine = @(
        $certOut |
          ForEach-Object { "$_".Trim() } |
          Where-Object { $_ -match '^[0-9a-fA-F ]{64,}$' } |
          Select-Object -First 1
      )
      if ($hexLine.Count -gt 0 -and $hexLine[0]) {
        return $hexLine[0].Replace(' ', '').ToLowerInvariant()
      }
    } catch {}
  }
  return $null
}

function Write-RuntimeManifest {
  param(
    [string]$ManifestPath,
    [string[]]$CandidateFiles
  )

  $assets = @()
  foreach ($candidate in $CandidateFiles) {
    if (-not $candidate) { continue }
    if (-not (Test-Path $candidate)) { continue }
    $item = Get-Item $candidate -ErrorAction SilentlyContinue
    if (-not $item) { continue }

    $resolvedPath = (Resolve-Path $candidate).Path
    $relativePath = $resolvedPath
    if ($resolvedPath.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
      $relativePath = $resolvedPath.Substring($Root.Length).TrimStart('\')
    }

    $assets += [pscustomobject]@{
      path = $relativePath
      size = [int64]$item.Length
      sha256 = Get-Sha256Text -Path $resolvedPath
    }
  }

  $manifest = [pscustomobject]@{
    generatedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ssK')
    root = $Root
    assets = $assets
  }
  $json = $manifest | ConvertTo-Json -Depth 6
  Set-Content -Path $ManifestPath -Value $json -Encoding UTF8
  Write-Host ("[OK] Runtime manifest generated: {0}" -f $ManifestPath)
}

function Ensure-PythonDepsInRuntime {
  param([string]$PythonExe)
  if (-not (Test-Path $PythonExe)) { return $false }
  if (Test-PythonDeps -PythonExe $PythonExe) {
    Write-Host '[OK] Python runtime dependencies already satisfied.'
    return $true
  }

  try {
    & $PythonExe -m ensurepip --upgrade *> $null
  } catch {
    # embedded/runtime python may already have pip
  }

  try {
    Write-Host 'Installing Python runtime dependencies into copied runtime...'
    & $PythonExe -m pip install --disable-pip-version-check --no-input cherrypy jsonpickle
    if ($LASTEXITCODE -ne 0) { return $false }

    $flatlibInstalled = $false
    $flatlibSpecs = @('flatlib==0.2.3.post3', 'flatlib==0.2.3', 'flatlib')
    foreach ($flatlibSpec in $flatlibSpecs) {
      try {
        & $PythonExe -m pip install --disable-pip-version-check --no-input $flatlibSpec *> $null
        if ($LASTEXITCODE -eq 0) {
          $flatlibInstalled = $true
          break
        }
      } catch {}
      Write-Host ("[WARN] Failed to install {0}, trying fallback..." -f $flatlibSpec)
    }
    if (-not $flatlibInstalled) {
      Write-Host '[WARN] Flatlib package install skipped; runtime can use bundled flatlib-ctrad2.'
    }

    & $PythonExe -m pip install --disable-pip-version-check --no-input --only-binary=:all: pyswisseph
    if ($LASTEXITCODE -ne 0) { return $false }
    return (Test-PythonDeps -PythonExe $PythonExe)
  } catch {
    Write-Host ("[WARN] Python runtime dependency install failed: {0}" -f $_.Exception.Message)
    return $false
  }
}

function Export-PythonWheels {
  param(
    [string]$PythonExe,
    [string]$WheelDir
  )
  if (-not (Test-Path $PythonExe)) { return $false }
  try {
    New-Item -ItemType Directory -Force -Path $WheelDir | Out-Null
    Write-Host "Exporting offline Python wheels to: $WheelDir"
    & $PythonExe -m pip download --disable-pip-version-check --only-binary=:all: --dest $WheelDir cherrypy jsonpickle pyswisseph
    if ($LASTEXITCODE -ne 0) { return $false }

    $flatlibDownloaded = $false
    $flatlibSpecs = @('flatlib==0.2.3.post3', 'flatlib==0.2.3', 'flatlib')
    foreach ($flatlibSpec in $flatlibSpecs) {
      try {
        & $PythonExe -m pip download --disable-pip-version-check --dest $WheelDir $flatlibSpec *> $null
        if ($LASTEXITCODE -eq 0) {
          $flatlibDownloaded = $true
          break
        }
      } catch {}
      Write-Host ("[WARN] Failed to export {0}, trying fallback..." -f $flatlibSpec)
    }
    if (-not $flatlibDownloaded) {
      Write-Host '[WARN] Flatlib wheel/source export skipped; startup can still use bundled flatlib-ctrad2.'
    }

    return (Test-WheelCompleteness -WheelDir $WheelDir)
  } catch {
    Write-Host ("[WARN] Wheel export failed: {0}" -f $_.Exception.Message)
    return $false
  }
}

$JavaSrc = $env:HOROSA_JAVA_HOME
if (-not $JavaSrc) {
  if ($env:JAVA_HOME) {
    $JavaSrc = $env:JAVA_HOME
  }
}
if (-not $JavaSrc) {
  $javaCmd = Get-Command java -ErrorAction SilentlyContinue
  if ($javaCmd -and $javaCmd.Source) {
    $javaBinDir = Split-Path -Parent $javaCmd.Source
    $JavaSrc = Split-Path -Parent $javaBinDir
  }
}
if (-not $JavaSrc) {
  $javaCandidates = @(
    "$env:ProgramFiles\Java",
    "$env:ProgramFiles\Eclipse Adoptium",
    "$env:ProgramFiles\Zulu",
    "$env:ProgramFiles\Amazon Corretto",
    "$env:ProgramFiles(x86)\Java",
    "$env:ProgramFiles(x86)\Eclipse Adoptium"
  )
  foreach ($base in $javaCandidates) {
    if (-not (Test-Path $base)) { continue }
    $found = Get-ChildItem -Path $base -Directory -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Where-Object { Test-Path (Join-Path $_.FullName 'bin\java.exe') } |
      Select-Object -First 1
    if ($found) {
      $JavaSrc = $found.FullName
      break
    }
  }
}

if ($JavaSrc -and (Test-Path (Join-Path $JavaSrc 'bin\\java.exe'))) {
  Write-Host "Copy Java runtime: $JavaSrc -> $JavaDst"
  if (Test-Path $JavaDst) { Remove-Item -Recurse -Force $JavaDst }
  New-Item -ItemType Directory -Force -Path $JavaDst | Out-Null
  robocopy $JavaSrc $JavaDst /E /NFL /NDL /NJH /NJS /NP | Out-Null
} else {
  Write-Host 'Java runtime not found. Set HOROSA_JAVA_HOME (or JAVA_HOME) then rerun.'
}

$PySrc = $env:HOROSA_PYTHON_HOME
if (-not $PySrc) {
  $cand = @(
    "$env:LocalAppData\\Programs\\Python\\Python311",
    "$env:ProgramFiles\\Python311",
    "$env:LocalAppData\\Programs\\Python\\Python312",
    "$env:ProgramFiles\\Python312"
  )
  foreach ($c in $cand) {
    if (Test-Path (Join-Path $c 'python.exe')) {
      $PySrc = $c
      break
    }
  }
}
if (-not $PySrc) {
  $pyCmd = Get-Command python -ErrorAction SilentlyContinue
  if ($pyCmd -and $pyCmd.Source) {
    $PySrc = Split-Path -Parent $pyCmd.Source
  }
}

if ($PySrc -and (Test-Path (Join-Path $PySrc 'python.exe'))) {
  $sourcePyExe = Join-Path $PySrc 'python.exe'
  $sourceVersion = Get-PythonVersionInfo -PythonExe $sourcePyExe
  if ($sourceVersion) {
    Write-Host ("Detected Python runtime source version: {0}" -f $sourceVersion.Text)
    if (-not ($sourceVersion.Major -eq 3 -and $sourceVersion.Minor -eq 11)) {
      Write-Host '[WARN] Python 3.11 is recommended for offline one-click startup compatibility.'
    }
  }

  Write-Host "Copy Python runtime: $PySrc -> $PyDst"
  if (Test-Path $PyDst) { Remove-Item -Recurse -Force $PyDst }
  New-Item -ItemType Directory -Force -Path $PyDst | Out-Null
  robocopy $PySrc $PyDst /E /NFL /NDL /NJH /NJS /NP | Out-Null
  $runtimePyExe = Join-Path $PyDst 'python.exe'
  $depsReady = Ensure-PythonDepsInRuntime -PythonExe $runtimePyExe
  if ($depsReady) {
    Write-Host '[OK] Python runtime deps ready.'
  } else {
    Write-Host '[WARN] Python runtime deps are incomplete. Target machine may require internet at first startup.'
  }
  $wheelOk = Export-PythonWheels -PythonExe $runtimePyExe -WheelDir $WheelsDst
  if ($wheelOk) {
    if (Test-Path $WheelsBundleDst) { Remove-Item -Recurse -Force $WheelsBundleDst }
    New-Item -ItemType Directory -Force -Path $WheelsBundleDst | Out-Null
    robocopy $WheelsDst $WheelsBundleDst /E /NFL /NDL /NJH /NJS /NP | Out-Null
    Write-Host "[OK] Offline wheels copied to: $WheelsBundleDst"
  } else {
    Write-Host '[WARN] Offline wheels not prepared.'
  }
} else {
  Write-Host 'Python runtime not found. Set HOROSA_PYTHON_HOME then rerun.'
}

if (-not (Test-Path $JarSrc)) {
  Write-Host ("[WARN] Backend jar not found: {0}" -f $JarSrc)
  Write-Host '[INFO] Trying local Maven build fallback...'
  $builtJar = Try-BuildBackendJar -ProjDir $ProjectDir -TargetJarPath $JarSrc
  if (-not $builtJar) {
    Write-Host '[WARN] Maven build fallback did not produce astrostudyboot.jar.'
  }
}

if (Test-Path $JarSrc) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $JarBundleDst) | Out-Null
  Copy-Item -Path $JarSrc -Destination $JarBundleDst -Force
  Write-Host "Copy backend jar: $JarSrc -> $JarBundleDst"
} else {
  Write-Host "[MISSING] Backend jar not found after fallback: $JarSrc"
}

if ((Test-Path $DistFileBundleDst)) { Remove-Item -Recurse -Force $DistFileBundleDst }
if ((Test-Path $DistBundleDst)) { Remove-Item -Recurse -Force $DistBundleDst }

$frontendSource = Resolve-FrontendBuildSource -ProjDir $ProjectDir
if ($frontendSource -and $frontendSource.Path -and (Test-Path (Join-Path $frontendSource.Path 'index.html'))) {
  New-Item -ItemType Directory -Force -Path $DistFileBundleDst | Out-Null
  robocopy $frontendSource.Path $DistFileBundleDst /E /NFL /NDL /NJH /NJS /NP | Out-Null
  Write-Host ("Copy frontend {0}: {1} -> {2}" -f $frontendSource.Kind, $frontendSource.Path, $DistFileBundleDst)

  # Keep a mirror in bundle/dist for backward compatibility with existing restore logic.
  New-Item -ItemType Directory -Force -Path $DistBundleDst | Out-Null
  robocopy $frontendSource.Path $DistBundleDst /E /NFL /NDL /NJH /NJS /NP | Out-Null
  Write-Host ("Mirror frontend to dist: {0} -> {1}" -f $frontendSource.Path, $DistBundleDst)
} else {
  Write-Host "[MISSING] Frontend dist not found: $DistFileSrc or $DistSrc"
}

# Generate URL templates for weak-network mirrors.
Ensure-UrlTemplateFile -Path (Join-Path $BundleDst 'java17.url.txt') -Lines @(
  '# One URL per line. First successful URL wins.',
  '# Example:',
  '# https://mirror.example.com/temurin17-jdk.zip'
)
Ensure-UrlTemplateFile -Path (Join-Path $BundleDst 'python311.url.txt') -Lines @(
  '# One URL per line. First successful URL wins.',
  '# Default launcher expects Python 3.11 x64 package (Miniconda installer or zip runtime).',
  '# Example:',
  '# https://mirror.example.com/Miniconda3-py311-Windows-x86_64.exe'
)
Ensure-UrlTemplateFile -Path (Join-Path $BundleDst 'astrostudyboot.url.txt') -Lines @(
  '# One URL per line. First successful URL wins.',
  '# Example:',
  '# https://mirror.example.com/astrostudyboot.jar'
)

$manifestPath = Join-Path $BundleDst 'runtime.manifest.json'
$manifestCandidates = @(
  (Join-Path $JavaDst 'bin\java.exe'),
  (Join-Path $PyDst 'python.exe'),
  $JarBundleDst,
  (Join-Path $DistFileBundleDst 'index.html'),
  (Join-Path $DistBundleDst 'index.html')
)
$manifestCandidates += @(Get-ChildItem -Path $WheelsDst -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
Write-RuntimeManifest -ManifestPath $manifestPath -CandidateFiles $manifestCandidates

Write-Host 'Done. Runtime folder:'
Get-ChildItem -Force $RuntimeRoot | Format-Table Name, LastWriteTime
Write-Host ''
if (Test-Path (Join-Path $JavaDst 'bin\\java.exe')) {
  Write-Host '[OK] Java runtime ready.'
} else {
  Write-Host '[MISSING] runtime\\windows\\java\\bin\\java.exe'
}
if (Test-Path (Join-Path $PyDst 'python.exe')) {
  Write-Host '[OK] Python runtime ready.'
} else {
  Write-Host '[MISSING] runtime\\windows\\python\\python.exe'
}
if (Test-Path $JarBundleDst) {
  Write-Host '[OK] runtime\\windows\\bundle\\astrostudyboot.jar'
} else {
  Write-Host '[MISSING] runtime\\windows\\bundle\\astrostudyboot.jar'
}
if ((Test-Path (Join-Path $DistFileBundleDst 'index.html')) -or (Test-Path (Join-Path $DistBundleDst 'index.html'))) {
  Write-Host '[OK] runtime\\windows\\bundle\\dist-file or dist'
} else {
  Write-Host '[MISSING] runtime\\windows\\bundle\\dist-file or dist'
}
if (Test-Path $WheelsDst) {
  Write-Host '[OK] runtime\\windows\\wheels (offline Python deps)'
} else {
  Write-Host '[WARN] runtime\\windows\\wheels not found'
}

$validationErrors = New-Object System.Collections.Generic.List[string]
if (-not (Test-Path (Join-Path $JavaDst 'bin\\java.exe'))) {
  $validationErrors.Add('Missing runtime/windows/java/bin/java.exe')
}
if (-not (Test-Path (Join-Path $PyDst 'python.exe'))) {
  $validationErrors.Add('Missing runtime/windows/python/python.exe')
}
if (-not (Test-Path $JarBundleDst)) {
  $validationErrors.Add('Missing runtime/windows/bundle/astrostudyboot.jar')
}
if (-not ((Test-Path (Join-Path $DistFileBundleDst 'index.html')) -or (Test-Path (Join-Path $DistBundleDst 'index.html')))) {
  $validationErrors.Add('Missing runtime/windows/bundle/dist-file/index.html or dist/index.html')
}
if (-not (Test-WheelCompleteness -WheelDir $WheelsDst)) {
  $validationErrors.Add('Missing required wheels (CherryPy/jsonpickle/pyswisseph) under runtime/windows/wheels')
}
if (-not (Test-Path $manifestPath)) {
  $validationErrors.Add('Missing runtime/windows/bundle/runtime.manifest.json')
}

if ($validationErrors.Count -gt 0) {
  Write-Host ''
  Write-Host '[FAIL] Runtime prepare finished with blocking issues:'
  foreach ($err in $validationErrors) {
    Write-Host ("  - {0}" -f $err)
  }
  Read-Host 'Press Enter to exit'
  exit 1
}

Write-Host ''
Write-Host '[PASS] Runtime prepare completed with all required artifacts.'
Read-Host 'Press Enter to exit'
