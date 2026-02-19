Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$RuntimeRoot = Join-Path $Root 'runtime\\windows'
$JavaDst = Join-Path $RuntimeRoot 'java'
$PyDst = Join-Path $RuntimeRoot 'python'
$BundleDst = Join-Path $RuntimeRoot 'bundle'
$ProjectDir = Join-Path $Root 'Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c'
$JarSrc = Join-Path $ProjectDir 'astrostudysrv\\astrostudyboot\\target\\astrostudyboot.jar'
$DistFileSrc = Join-Path $ProjectDir 'astrostudyui\\dist-file'
$DistSrc = Join-Path $ProjectDir 'astrostudyui\\dist'
$JarBundleDst = Join-Path $BundleDst 'astrostudyboot.jar'
$DistFileBundleDst = Join-Path $BundleDst 'dist-file'
$DistBundleDst = Join-Path $BundleDst 'dist'

New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null
New-Item -ItemType Directory -Force -Path $BundleDst | Out-Null

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
    "$env:LocalAppData\\Programs\\Python\\Python312",
    "$env:LocalAppData\\Programs\\Python\\Python311",
    "$env:ProgramFiles\\Python312",
    "$env:ProgramFiles\\Python311"
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
  Write-Host "Copy Python runtime: $PySrc -> $PyDst"
  if (Test-Path $PyDst) { Remove-Item -Recurse -Force $PyDst }
  New-Item -ItemType Directory -Force -Path $PyDst | Out-Null
  robocopy $PySrc $PyDst /E /NFL /NDL /NJH /NJS /NP | Out-Null
} else {
  Write-Host 'Python runtime not found. Set HOROSA_PYTHON_HOME then rerun.'
}

if (Test-Path $JarSrc) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $JarBundleDst) | Out-Null
  Copy-Item -Path $JarSrc -Destination $JarBundleDst -Force
  Write-Host "Copy backend jar: $JarSrc -> $JarBundleDst"
} else {
  Write-Host "[MISSING] Backend jar not found: $JarSrc"
}

if (Test-Path (Join-Path $DistFileSrc 'index.html')) {
  if (Test-Path $DistFileBundleDst) { Remove-Item -Recurse -Force $DistFileBundleDst }
  New-Item -ItemType Directory -Force -Path $DistFileBundleDst | Out-Null
  robocopy $DistFileSrc $DistFileBundleDst /E /NFL /NDL /NJH /NJS /NP | Out-Null
  Write-Host "Copy frontend dist-file: $DistFileSrc -> $DistFileBundleDst"
} elseif (Test-Path (Join-Path $DistSrc 'index.html')) {
  if (Test-Path $DistBundleDst) { Remove-Item -Recurse -Force $DistBundleDst }
  New-Item -ItemType Directory -Force -Path $DistBundleDst | Out-Null
  robocopy $DistSrc $DistBundleDst /E /NFL /NDL /NJH /NJS /NP | Out-Null
  Write-Host "Copy frontend dist: $DistSrc -> $DistBundleDst"
} else {
  Write-Host "[MISSING] Frontend dist not found: $DistFileSrc or $DistSrc"
}

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
if (Test-Path (Join-Path $DistFileBundleDst 'index.html') -or Test-Path (Join-Path $DistBundleDst 'index.html')) {
  Write-Host '[OK] runtime\\windows\\bundle\\dist-file or dist'
} else {
  Write-Host '[MISSING] runtime\\windows\\bundle\\dist-file or dist'
}
Read-Host 'Press Enter to exit'
