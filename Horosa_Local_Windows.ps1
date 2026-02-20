Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Join-Path $Root 'Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c'

$PyPidFile = Join-Path $ProjectDir '.horosa_win_py.pid'
$JavaPidFile = Join-Path $ProjectDir '.horosa_win_java.pid'
$WebPidFile = Join-Path $ProjectDir '.horosa_win_web.pid'

$LogRoot = Join-Path $ProjectDir '.horosa-local-logs-win'
$RunTag = Get-Date -Format 'yyyyMMdd_HHmmss'
$LogDir = Join-Path $LogRoot $RunTag
$PyLog = Join-Path $LogDir 'astropy.log'
$JavaLog = Join-Path $LogDir 'astrostudyboot.log'
$WebLog = Join-Path $LogDir 'web.log'
$BrowserProfile = Join-Path $ProjectDir '.horosa-browser-profile-win'

$DistDir = Join-Path $ProjectDir 'astrostudyui/dist-file'
if (-not (Test-Path (Join-Path $DistDir 'index.html'))) {
  $DistDir = Join-Path $ProjectDir 'astrostudyui/dist'
}

$JarPath = Join-Path $ProjectDir 'astrostudysrv/astrostudyboot/target/astrostudyboot.jar'
$WinBundleRoot = Join-Path $Root 'runtime/windows/bundle'
$CommonBundleRoot = Join-Path $Root 'runtime/bundle'
$PythonBin = $null
$JavaBin = $null
$WebPort = if ($env:HOROSA_WEB_PORT) { [int]$env:HOROSA_WEB_PORT } else { 8000 }
$BackendPort = 9999
$ChartPort = 8899
$PerfMode = $env:HOROSA_PERF_MODE -ne '0'
$UserHomeDir = if (-not [string]::IsNullOrWhiteSpace($env:HOME)) {
  $env:HOME
} elseif (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
  $env:USERPROFILE
} else {
  $ProjectDir
}
$env:HOME = $UserHomeDir
$HorosaLogBaseDir = Join-Path $UserHomeDir '.horosa-logs/astrostudyboot'

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
if ($env:HOROSA_KEEP_BROWSER_PROFILE -ne '1') {
  if (Test-Path $BrowserProfile) {
    Remove-Item -Recurse -Force $BrowserProfile -ErrorAction SilentlyContinue
  }
}
New-Item -ItemType Directory -Force -Path $BrowserProfile | Out-Null

function Test-PortOpen {
  param([int]$Port)
  $client = $null
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(300)
    if (-not $ok) { return $false }
    $client.EndConnect($iar) | Out-Null
    return $true
  } catch {
    return $false
  } finally {
    if ($client) { $client.Dispose() }
  }
}

function Wait-PortFree {
  param(
    [int]$Port,
    [int]$TimeoutMs = 6000
  )
  $elapsed = 0
  while ($elapsed -lt $TimeoutMs) {
    if (-not (Test-PortOpen -Port $Port)) { return $true }
    Start-Sleep -Milliseconds 200
    $elapsed += 200
  }
  return (-not (Test-PortOpen -Port $Port))
}

function Get-PidFromFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return $null }
  $raw = (Get-Content -Path $Path -Raw).Trim()
  if (-not $raw) { return $null }
  try { return [int]$raw } catch { return $null }
}

function Stop-PidFile {
  param([string]$Name, [string]$Path)
  $procId = Get-PidFromFile -Path $Path
  if ($procId) {
    try {
      Stop-Process -Id $procId -Force -ErrorAction Stop
      Write-Host "$Name stopped pid $procId"
    } catch {
      Write-Host "$Name pid $procId not running"
    }
  }
  if (Test-Path $Path) { Remove-Item -Force $Path }
}

function Stop-PortOwners {
  param([string]$Name, [int]$Port)
  $ownerPids = @()
  try {
    $ownerPids = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique)
  } catch {
    $ownerPids = @()
  }

  foreach ($ownerPid in $ownerPids) {
    if (-not $ownerPid) { continue }
    if ($ownerPid -eq $PID) { continue }
    $ownerProc = $null
    try {
      $ownerProc = Get-Process -Id $ownerPid -ErrorAction Stop
    } catch {
      continue
    }
    try {
      Stop-Process -Id $ownerProc.Id -Force -ErrorAction Stop
      Write-Host "$Name freed port $Port by stopping pid $ownerPid"
    } catch {
      Write-Host "$Name could not stop pid $ownerPid on port $Port"
    }
  }

  if (-not (Wait-PortFree -Port $Port -TimeoutMs 6000)) {
    Write-Host "$Name port $Port is still occupied after cleanup attempts"
  }
}

function Cleanup-All {
  Stop-PidFile -Name 'web' -Path $WebPidFile
  Stop-PidFile -Name 'java' -Path $JavaPidFile
  Stop-PidFile -Name 'python' -Path $PyPidFile
  Stop-PortOwners -Name 'web' -Port $WebPort
  Stop-PortOwners -Name 'java' -Port $BackendPort
  Stop-PortOwners -Name 'python' -Port $ChartPort
}

function Start-Background {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$LogPath,
    [string]$PidFile
  )

  $ErrPath = "$LogPath.err"
  $proc = Start-Process -FilePath $FilePath `
                        -ArgumentList $Arguments `
                        -PassThru `
                        -WindowStyle Hidden `
                        -RedirectStandardOutput $LogPath `
                        -RedirectStandardError $ErrPath
  Set-Content -Path $PidFile -Value $proc.Id -NoNewline
  return $proc
}

function Quote-Arg {
  param([string]$Value)
  if ($null -eq $Value) { return '""' }
  '"' + ($Value -replace '"', '\\"') + '"'
}

function Resolve-Browser {
  $chromeCandidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Google\Chrome Beta\Application\chrome.exe",
    "$env:ProgramFiles(x86)\Google\Chrome Beta\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome Beta\Application\chrome.exe"
  )
  foreach ($p in $chromeCandidates) {
    if ($p -and (Test-Path $p)) { return $p }
  }

  $candidates = @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe",
    "$env:ProgramFiles(x86)\BraveSoftware\Brave-Browser\Application\brave.exe",
    "$env:LocalAppData\Chromium\Application\chrome.exe"
  )
  foreach ($p in $candidates) {
    if ($p -and (Test-Path $p)) { return $p }
  }
  return $null
}

function Test-JavaAtLeast17 {
  param([string]$JavaCmdOrPath)
  try {
    $out = & $JavaCmdOrPath -version 2>&1 | Out-String
    if (-not $out) { return $false }
    $m = [regex]::Match($out, 'version\s+"([^"]+)"')
    if (-not $m.Success) { return $false }
    $v = $m.Groups[1].Value
    if ($v.StartsWith('1.')) { return $false }
    $majorText = ($v -split '[\.\-_]')[0]
    $major = 0
    if (-not [int]::TryParse($majorText, [ref]$major)) { return $false }
    return ($major -ge 17)
  } catch {
    return $false
  }
}

function Test-PythonSupported {
  param([string]$PythonCmdOrPath)
  try {
    $out = & $PythonCmdOrPath -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
    if (-not $out) { return $false }
    $v = ($out | Select-Object -First 1).ToString().Trim()
    $parts = $v.Split('.')
    if ($parts.Length -lt 2) { return $false }
    $major = [int]$parts[0]
    $minor = [int]$parts[1]
    # Prefer Python 3.11; allow 3.12 for better cross-machine compatibility.
    return ($major -eq 3 -and ($minor -eq 11 -or $minor -eq 12))
  } catch {
    return $false
  }
}

function Test-PythonDepsReady {
  param([string]$PythonCmdOrPath)
  try {
    & $PythonCmdOrPath -c "import cherrypy, jsonpickle, swisseph; print('ok')" *> $null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

function Resolve-Java {
  $runtimeJava = Join-Path $Root 'runtime/windows/java/bin/java.exe'
  if (Test-Path $runtimeJava) {
    return $runtimeJava
  }

  if ($env:HOROSA_JAVA -and (Test-Path $env:HOROSA_JAVA)) {
    if (Test-JavaAtLeast17 -JavaCmdOrPath $env:HOROSA_JAVA) { return $env:HOROSA_JAVA }
  }

  if ($env:JAVA_HOME) {
    $javaHomeBin = Join-Path $env:JAVA_HOME 'bin/java.exe'
    if (Test-Path $javaHomeBin) {
      if (Test-JavaAtLeast17 -JavaCmdOrPath $javaHomeBin) { return $javaHomeBin }
    }
  }

  $bundled = @(
    (Join-Path $Root 'runtime/windows/java/bin/java.exe'),
    (Join-Path $Root 'runtime/java/bin/java.exe'),
    (Join-Path $Root 'jre/bin/java.exe'),
    (Join-Path $ProjectDir 'runtime/windows/java/bin/java.exe'),
    (Join-Path $ProjectDir 'runtime/java/bin/java.exe'),
    (Join-Path $ProjectDir 'jre/bin/java.exe')
  )
  foreach ($p in $bundled) {
    if (Test-Path $p) {
      if (Test-JavaAtLeast17 -JavaCmdOrPath $p) { return $p }
    }
  }

  $inPath = Get-Command 'java' -ErrorAction SilentlyContinue
  if ($inPath) {
    if (Test-JavaAtLeast17 -JavaCmdOrPath 'java') { return 'java' }
  }

  $javaCandidates = @(
    "$env:ProgramFiles\Java",
    "$env:ProgramFiles\Eclipse Adoptium",
    "$env:ProgramFiles\Microsoft",
    "$env:ProgramFiles\Zulu",
    "$env:ProgramFiles\Amazon Corretto",
    "$env:ProgramFiles(x86)\Java",
    "$env:ProgramFiles(x86)\Eclipse Adoptium",
    "$env:LocalAppData\Programs\Eclipse Adoptium",
    "$env:LocalAppData\Programs\Microsoft"
  )
  foreach ($base in $javaCandidates) {
    if (-not (Test-Path $base)) { continue }
    $found = Get-ChildItem -Path $base -Directory -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Where-Object { Test-Path (Join-Path $_.FullName 'bin\java.exe') } |
      Select-Object -First 1
    if ($found) {
      $candidate = Join-Path $found.FullName 'bin\java.exe'
      if (Test-Path $candidate) {
        if (Test-JavaAtLeast17 -JavaCmdOrPath $candidate) { return $candidate }
      }
    }
  }

  $deepSearchRoots = @(
    "$env:LocalAppData\Microsoft\WinGet\Packages",
    "$env:ProgramFiles\Microsoft",
    "$env:ProgramFiles\Eclipse Adoptium"
  )
  foreach ($root in $deepSearchRoots) {
    if (-not (Test-Path $root)) { continue }
    $matches = Get-ChildItem -Path $root -Recurse -Filter java.exe -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match 'jdk|jre|openjdk|temurin|corretto|zulu|microsoft' } |
      Select-Object -First 20
    foreach ($m in $matches) {
      if (Test-JavaAtLeast17 -JavaCmdOrPath $m.FullName) {
        return $m.FullName
      }
    }
  }

  return $null
}

function Resolve-Python {
  if ($env:HOROSA_PYTHON -and (Test-Path $env:HOROSA_PYTHON)) {
    if (Test-PythonSupported -PythonCmdOrPath $env:HOROSA_PYTHON) { return $env:HOROSA_PYTHON }
  }

  $bundled = @(
    (Join-Path $Root 'runtime/windows/python/python.exe'),
    (Join-Path $Root 'runtime/windows/python/python3.exe'),
    (Join-Path $Root 'runtime/python/python.exe'),
    (Join-Path $ProjectDir 'runtime/windows/python/python.exe'),
    (Join-Path $ProjectDir 'runtime/windows/python/python3.exe'),
    (Join-Path $ProjectDir 'runtime/python/python.exe')
  )
  foreach ($p in $bundled) {
    if (Test-Path $p) {
      if (Test-PythonSupported -PythonCmdOrPath $p) { return $p }
    }
  }

  $installed = @(
    "$env:LocalAppData\Programs\Python\Python311\python.exe",
    "$env:LocalAppData\Programs\Python\Python312\python.exe",
    "$env:ProgramFiles\Python312\python.exe",
    "$env:ProgramFiles\Python311\python.exe",
    'C:\Python311\python.exe',
    'C:\Python312\python.exe'
  )
  foreach ($p in $installed) {
    if (Test-Path $p) {
      if (Test-PythonSupported -PythonCmdOrPath $p) { return $p }
    }
  }

  $inPath = Get-Command 'python' -ErrorAction SilentlyContinue
  if ($inPath) {
    if (Test-PythonSupported -PythonCmdOrPath 'python') { return 'python' }
  }

  return $null
}

function Install-WithWinget {
  param(
    [string]$PackageId,
    [string]$DisplayName
  )
  $winget = Get-Command 'winget' -ErrorAction SilentlyContinue
  if (-not $winget) {
    Write-Host "winget not found, cannot auto-install $DisplayName."
    return $false
  }

  Write-Host "Auto installing $DisplayName via winget..."
  $attempts = @(
    @('install','-e','--id', $PackageId, '--scope','user','--source','winget','--accept-package-agreements','--accept-source-agreements','--silent'),
    @('install','-e','--id', $PackageId, '--accept-package-agreements','--accept-source-agreements','--silent')
  )
  foreach ($args in $attempts) {
    try {
      $p = Start-Process -FilePath $winget.Source -ArgumentList $args -Wait -PassThru
      if ($p.ExitCode -eq 0) { return $true }
      Write-Host ("winget install exit code for {0}: {1}" -f $DisplayName, $p.ExitCode)
    } catch {
      Write-Host ("Auto install failed for {0}: {1}" -f $DisplayName, $_.Exception.Message)
    }
  }
  return $false
}

function Install-Java17 {
  $candidates = @(
    @{ Id = 'EclipseAdoptium.Temurin.17.JDK'; Name = 'Java 17 (Temurin JDK)' },
    @{ Id = 'EclipseAdoptium.Temurin.17.JRE'; Name = 'Java 17 (Temurin JRE)' },
    @{ Id = 'Microsoft.OpenJDK.17'; Name = 'Java 17 (Microsoft OpenJDK)' }
  )
  foreach ($c in $candidates) {
    if (Install-WithWinget -PackageId $c.Id -DisplayName $c.Name) {
      Start-Sleep -Seconds 2
      $resolved = Resolve-Java
      if ($resolved) {
        Write-Host ("[OK] Java 17 detected: {0}" -f $resolved)
        return $true
      }
      Write-Host ("[WARN] {0} reported success but Java 17 was not detected. Trying next option..." -f $c.Name)
    }
  }
  if (Install-Java17Portable) {
    $resolvedPortable = Resolve-Java
    if ($resolvedPortable) {
      Write-Host ("[OK] Portable Java 17 ready: {0}" -f $resolvedPortable)
      return $true
    }
  }
  return $false
}

function Install-Java17Portable {
  try {
    Write-Host 'winget install failed, trying portable Java 17 download...'
    $portableRoot = Join-Path $Root 'runtime/windows'
    $javaTarget = Join-Path $portableRoot 'java'
    $tmpDir = Join-Path $env:TEMP ('horosa_java17_' + [DateTime]::Now.ToString('yyyyMMdd_HHmmss'))
    $zipPath = Join-Path $tmpDir 'java17.zip'
    New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
    New-Item -ItemType Directory -Force -Path $portableRoot | Out-Null

    $url = 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk'
    Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing

    $extractDir = Join-Path $tmpDir 'extract'
    Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

    # Robustly locate java.exe regardless of archive folder layout.
    $javaExe = Get-ChildItem -Path $extractDir -Recurse -Filter java.exe -File -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match '\\bin\\java\.exe$' } |
      Select-Object -First 1
    if (-not $javaExe) {
      Write-Host '[WARN] Portable archive extracted but java.exe not found.'
      return $false
    }
    $javaHomePath = Split-Path -Parent (Split-Path -Parent $javaExe.FullName)

    if (Test-Path $javaTarget) { Remove-Item -Recurse -Force $javaTarget }
    New-Item -ItemType Directory -Force -Path $javaTarget | Out-Null
    robocopy $javaHomePath $javaTarget /E /NFL /NDL /NJH /NJS /NP | Out-Null

    $ok = Test-Path (Join-Path $javaTarget 'bin\java.exe')
    if (-not $ok) {
      Write-Host '[WARN] Portable Java copy finished but bin\java.exe is still missing.'
    }
    return $ok
  } catch {
    Write-Host ("Portable Java download failed: {0}" -f $_.Exception.Message)
    return $false
  }
}

function Resolve-Maven {
  if ($env:HOROSA_MVN -and (Test-Path $env:HOROSA_MVN)) {
    return $env:HOROSA_MVN
  }

  $bundled = @(
    (Join-Path $Root 'runtime/windows/maven/bin/mvn.cmd'),
    (Join-Path $Root 'runtime/windows/maven/bin/mvn.bat')
  )
  foreach ($p in $bundled) {
    if (Test-Path $p) { return $p }
  }

  $installed = @(
    "$env:ProgramFiles\Apache\maven\bin\mvn.cmd",
    "$env:ProgramFiles\apache-maven\bin\mvn.cmd",
    "$env:LocalAppData\Microsoft\WinGet\Links\mvn.cmd"
  )
  foreach ($p in $installed) {
    if (Test-Path $p) { return $p }
  }

  $inPath = Get-Command 'mvn' -ErrorAction SilentlyContinue
  if ($inPath) { return $inPath.Source }

  return $null
}

function Install-Maven {
  if (Install-WithWinget -PackageId 'Apache.Maven' -DisplayName 'Apache Maven') {
    return $true
  }
  return (Install-MavenPortable)
}

function Install-MavenPortable {
  try {
    Write-Host 'winget install Maven failed, trying portable Maven download...'
    $portableRoot = Join-Path $Root 'runtime/windows'
    $mavenTarget = Join-Path $portableRoot 'maven'
    $tmpDir = Join-Path $env:TEMP ('horosa_maven_' + [DateTime]::Now.ToString('yyyyMMdd_HHmmss'))
    $zipPath = Join-Path $tmpDir 'maven.zip'
    New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
    New-Item -ItemType Directory -Force -Path $portableRoot | Out-Null

    $urls = @(
      'https://downloads.apache.org/maven/maven-3/3.9.11/binaries/apache-maven-3.9.11-bin.zip',
      'https://archive.apache.org/dist/maven/maven-3/3.9.11/binaries/apache-maven-3.9.11-bin.zip'
    )
    $downloaded = $false
    foreach ($url in $urls) {
      try {
        Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing
        if ((Test-Path $zipPath) -and ((Get-Item $zipPath).Length -gt 1024)) {
          $downloaded = $true
          break
        }
      } catch {
        Write-Host ("Portable Maven download failed from {0}" -f $url)
      }
    }
    if (-not $downloaded) {
      Write-Host '[WARN] Portable Maven download failed.'
      return $false
    }

    $extractDir = Join-Path $tmpDir 'extract'
    Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

    $mvnCmd = Get-ChildItem -Path $extractDir -Recurse -Filter mvn.cmd -File -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match '\\bin\\mvn\.cmd$' } |
      Select-Object -First 1
    if (-not $mvnCmd) {
      Write-Host '[WARN] Portable Maven archive extracted but mvn.cmd not found.'
      return $false
    }
    $mavenHome = Split-Path -Parent (Split-Path -Parent $mvnCmd.FullName)

    if (Test-Path $mavenTarget) { Remove-Item -Recurse -Force $mavenTarget }
    New-Item -ItemType Directory -Force -Path $mavenTarget | Out-Null
    robocopy $mavenHome $mavenTarget /E /NFL /NDL /NJH /NJS /NP | Out-Null

    $ok = Test-Path (Join-Path $mavenTarget 'bin\mvn.cmd')
    if ($ok) {
      Write-Host ("[OK] Portable Maven ready: {0}" -f (Join-Path $mavenTarget 'bin\mvn.cmd'))
    } else {
      Write-Host '[WARN] Portable Maven copy finished but bin\mvn.cmd is still missing.'
    }
    return $ok
  } catch {
    Write-Host ("Portable Maven download failed: {0}" -f $_.Exception.Message)
    return $false
  }
}

function Get-JavaHomeFromJavaExe {
  param([string]$JavaCmdOrPath)
  $javaExe = Get-ExePath -CmdOrPath $JavaCmdOrPath
  if (-not $javaExe) { return $null }
  $binDir = Split-Path -Parent $javaExe
  $javaHomeDir = Split-Path -Parent $binDir
  if (Test-Path $javaHomeDir) { return $javaHomeDir }
  return $null
}

function Invoke-Maven {
  param(
    [string]$MvnExe,
    [string]$WorkingDir,
    [string[]]$MavenArgs
  )
  try {
    $p = Start-Process -FilePath $MvnExe -WorkingDirectory $WorkingDir -ArgumentList $MavenArgs -NoNewWindow -Wait -PassThru
    return ($p.ExitCode -eq 0)
  } catch {
    Write-Host ("[WARN] Maven run failed in {0}: {1}" -f $WorkingDir, $_.Exception.Message)
    return $false
  }
}

function Install-MavenAliasArtifact {
  param(
    [string]$MvnExe,
    [string]$WorkingDir,
    [string]$JarPath,
    [string]$GroupId,
    [string]$ArtifactId,
    [string]$Version
  )
  if (-not (Test-Path $JarPath)) { return $false }
  $args = @(
    'install:install-file',
    "-Dfile=$JarPath",
    "-DgroupId=$GroupId",
    "-DartifactId=$ArtifactId",
    "-Dversion=$Version",
    '-Dpackaging=jar',
    '-DgeneratePom=true'
  )
  return (Invoke-Maven -MvnExe $MvnExe -WorkingDir $WorkingDir -MavenArgs $args)
}

function Try-BuildBackendJar {
  if (Test-Path $JarPath) { return $true }

  $mvn = Resolve-Maven
  if (-not $mvn) {
    if (Install-Maven) {
      Start-Sleep -Seconds 2
      $mvn = Resolve-Maven
    }
  }
  if (-not $mvn) {
    Write-Host '[WARN] Maven not found, skip auto build.'
    return $false
  }

  $buildJava = Resolve-Java
  if (-not $buildJava) {
    if (Install-Java17) {
      $buildJava = Resolve-Java
    }
  }
  if (-not $buildJava) {
    Write-Host '[WARN] Java 17+ unavailable, skip auto build.'
    return $false
  }
  $buildJavaHome = Get-JavaHomeFromJavaExe -JavaCmdOrPath $buildJava
  $javacPath = if ($buildJavaHome) { Join-Path $buildJavaHome 'bin/javac.exe' } else { $null }
  if (-not $javacPath -or -not (Test-Path $javacPath)) {
    Write-Host '[WARN] JDK compiler (javac) not found, skip auto build.'
    return $false
  }

  $srvRoot = Join-Path $ProjectDir 'astrostudysrv'
  if (-not (Test-Path $srvRoot)) {
    Write-Host '[WARN] Backend source folder missing, skip auto build.'
    return $false
  }

  $oldJavaHome = $env:JAVA_HOME
  $oldPath = $env:Path
  try {
    $env:JAVA_HOME = $buildJavaHome
    $env:Path = (Join-Path $buildJavaHome 'bin') + ';' + $oldPath

    Write-Host 'Backend jar missing, trying local Maven build...'
    $moduleOrder = @(
      'boundless',
      'basecomm',
      'image',
      'astroswisseph',
      'astrodeeplearn',
      'astroesp',
      'astrostudy',
      'astrostudycn',
      'astroreader'
    )

    foreach ($module in $moduleOrder) {
      $moduleDir = Join-Path $srvRoot $module
      $pom = Join-Path $moduleDir 'pom.xml'
      if (-not (Test-Path $pom)) { continue }
      Write-Host ("[mvn] install {0}" -f $module)
      $ok = Invoke-Maven -MvnExe $mvn -WorkingDir $moduleDir -MavenArgs @('-DskipTests', 'install')
      if (-not $ok) { return $false }

      if ($module -eq 'boundless') {
        $builtJar = Join-Path $moduleDir 'target\boundless-1.2.1.2.jar'
        if (Test-Path $builtJar) {
          Write-Host '[mvn] install alias boundless:1.2.1 -> local jar'
          $aliasOk = Install-MavenAliasArtifact -MvnExe $mvn -WorkingDir $moduleDir -JarPath $builtJar -GroupId 'boundless' -ArtifactId 'boundless' -Version '1.2.1'
          if (-not $aliasOk) { return $false }
        }
      }

      if ($module -eq 'basecomm') {
        $builtJar = Join-Path $moduleDir 'target\basecomm-1.1.1.jar'
        if (Test-Path $builtJar) {
          Write-Host '[mvn] install alias spacex:basecomm:1.1.2.2 -> local jar'
          $aliasOk = Install-MavenAliasArtifact -MvnExe $mvn -WorkingDir $moduleDir -JarPath $builtJar -GroupId 'spacex' -ArtifactId 'basecomm' -Version '1.1.2.2'
          if (-not $aliasOk) { return $false }
        }
      }
    }

    $bootDir = Join-Path $srvRoot 'astrostudyboot'
    if (-not (Test-Path (Join-Path $bootDir 'pom.xml'))) { return $false }
    Write-Host '[mvn] package astrostudyboot'
    $bootOk = Invoke-Maven -MvnExe $mvn -WorkingDir $bootDir -MavenArgs @('-DskipTests', 'package')
    if (-not $bootOk) { return $false }
  } finally {
    $env:JAVA_HOME = $oldJavaHome
    $env:Path = $oldPath
  }

  return (Test-Path $JarPath)
}

function Get-ExePath {
  param([string]$CmdOrPath)
  if (-not $CmdOrPath) { return $null }
  if (Test-Path $CmdOrPath) { return (Resolve-Path $CmdOrPath).Path }
  $cmd = Get-Command $CmdOrPath -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }
  return $null
}

function Sync-RuntimeFromExe {
  param(
    [string]$ExeCmdOrPath,
    [string]$TargetDir,
    [int]$UpLevels = 1,
    [string]$CheckRelative = ''
  )
  $exe = Get-ExePath -CmdOrPath $ExeCmdOrPath
  if (-not $exe) { return $false }

  $src = Split-Path -Parent $exe
  for ($i = 0; $i -lt $UpLevels; $i++) {
    $src = Split-Path -Parent $src
  }
  if (-not (Test-Path $src)) { return $false }

  if (Test-Path $TargetDir) { Remove-Item -Recurse -Force $TargetDir }
  New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
  robocopy $src $TargetDir /E /NFL /NDL /NJH /NJS /NP | Out-Null

  if (-not $CheckRelative) { return $true }
  return (Test-Path (Join-Path $TargetDir $CheckRelative))
}

function Ensure-PythonRuntimeDeps {
  param(
    [string]$PythonExe,
    [string]$ProjectRoot
  )
  $checkDeps = {
    param([string]$Exe)
    try {
      & $Exe -c "import cherrypy, jsonpickle, swisseph; print('ok')" *> $null
      return ($LASTEXITCODE -eq 0)
    } catch {
      return $false
    }
  }

  $installFromWheelDir = {
    param([string]$Exe, [string]$WheelDir)
    if (-not (Test-Path $WheelDir)) { return $false }
    try {
      Write-Host ("Installing Python dependencies from local wheelhouse: {0}" -f $WheelDir)
      & $Exe -m pip install --disable-pip-version-check --no-input --no-index --find-links $WheelDir cherrypy jsonpickle pyswisseph
      if ($LASTEXITCODE -ne 0) { return $false }
      return (& $checkDeps $Exe)
    } catch {
      return $false
    }
  }

  try {
    if (& $checkDeps $PythonExe) {
      Write-Host 'Python dependencies already satisfied, skip install.'
      return $true
    }
  } catch {
    # continue to install
  }

  try {
    & $PythonExe -m ensurepip --upgrade *> $null
  } catch {
    # embedded python may already include pip
  }

  $wheelDirs = @(
    (Join-Path $Root 'runtime/windows/wheels'),
    (Join-Path $Root 'runtime/wheels'),
    (Join-Path $WinBundleRoot 'wheels'),
    (Join-Path $CommonBundleRoot 'wheels')
  ) | Select-Object -Unique
  foreach ($wheelDir in $wheelDirs) {
    if (& $installFromWheelDir $PythonExe $wheelDir) {
      return $true
    }
  }

  try {
    Write-Host 'Installing Python dependencies for local runtime (online fallback)...'
    & $PythonExe -m pip install --disable-pip-version-check --no-input cherrypy jsonpickle
    if ($LASTEXITCODE -ne 0) { return $false }
    & $PythonExe -m pip install --disable-pip-version-check --no-input --only-binary=:all: pyswisseph
    if ($LASTEXITCODE -ne 0) { return $false }
    return (& $checkDeps $PythonExe)
  } catch {
    Write-Host ("Python dependency install failed: {0}" -f $_.Exception.Message)
    return $false
  }
}

function Sync-BundledFrontend {
  $sources = @(
    (Join-Path $WinBundleRoot 'dist-file'),
    (Join-Path $WinBundleRoot 'dist'),
    (Join-Path $CommonBundleRoot 'dist-file'),
    (Join-Path $CommonBundleRoot 'dist')
  )
  foreach ($src in $sources) {
    if (-not (Test-Path (Join-Path $src 'index.html'))) { continue }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $DistDir) | Out-Null
    if (Test-Path $DistDir) { Remove-Item -Recurse -Force $DistDir }
    New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
    robocopy $src $DistDir /E /NFL /NDL /NJH /NJS /NP | Out-Null
    if (Test-Path (Join-Path $DistDir 'index.html')) {
      Write-Host ("[OK] Frontend bundle restored from: {0}" -f $src)
      return $true
    }
  }
  return $false
}

function Ensure-FrontendStaticLayout {
  param([string]$DistPath)

  if (-not $DistPath) { return }
  $indexPath = Join-Path $DistPath 'index.html'
  if (-not (Test-Path $indexPath)) { return }

  $html = Get-Content -Path $indexPath -Raw -ErrorAction SilentlyContinue
  if (-not $html) { return }
  if ($html -notmatch '/static/umi\.') { return }

  $staticDir = Join-Path $DistPath 'static'
  New-Item -ItemType Directory -Force -Path $staticDir | Out-Null

  $fixed = $false
  Get-ChildItem -Path $DistPath -File -Filter 'umi.*' | ForEach-Object {
    $dest = Join-Path $staticDir $_.Name
    if (-not (Test-Path $dest)) {
      Copy-Item -Path $_.FullName -Destination $dest -Force
      $fixed = $true
    }
  }

  if ($fixed) {
    Write-Host '[OK] Repaired frontend static layout for /static assets.'
  }
}

function Get-BackendJarDownloadUrl {
  if ($env:HOROSA_BOOT_JAR_URL) {
    $envUrl = $env:HOROSA_BOOT_JAR_URL.Trim()
    if ($envUrl -match '^https?://') { return $envUrl }
    Write-Host '[WARN] HOROSA_BOOT_JAR_URL is set but is not a valid http(s) URL. Ignore it.'
  }

  $urlFiles = @(
    (Join-Path $WinBundleRoot 'astrostudyboot.url.txt'),
    (Join-Path $WinBundleRoot 'astrostudyboot.jar.url'),
    (Join-Path $CommonBundleRoot 'astrostudyboot.url.txt'),
    (Join-Path $CommonBundleRoot 'astrostudyboot.jar.url')
  ) | Select-Object -Unique

  foreach ($urlFile in $urlFiles) {
    if (-not (Test-Path $urlFile)) { continue }
    try {
      $lines = Get-Content -Path $urlFile -ErrorAction Stop
      foreach ($line in $lines) {
        $candidate = $line.Trim()
        if (-not $candidate) { continue }
        if ($candidate.StartsWith('#')) { continue }
        if ($candidate -match '^https?://') {
          Write-Host ("Using backend jar URL from file: {0}" -f $urlFile)
          return $candidate
        }
      }
      Write-Host ("[WARN] URL file exists but no valid http(s) URL found: {0}" -f $urlFile)
    } catch {
      Write-Host ("[WARN] Failed to read jar URL file {0}: {1}" -f $urlFile, $_.Exception.Message)
    }
  }

  return $null
}

function Ensure-BackendJar {
  if (Test-Path $JarPath) { return $true }

  $sources = @(
    (Join-Path $WinBundleRoot 'astrostudyboot.jar'),
    (Join-Path $CommonBundleRoot 'astrostudyboot.jar')
  )
  foreach ($src in $sources) {
    if (-not (Test-Path $src)) { continue }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $JarPath) | Out-Null
    Copy-Item -Path $src -Destination $JarPath -Force
    if (Test-Path $JarPath) {
      Write-Host ("[OK] Backend jar restored from: {0}" -f $src)
      return $true
    }
  }

  $jarUrl = Get-BackendJarDownloadUrl
  if ($jarUrl) {
    try {
      Write-Host ("Downloading backend jar from: {0}" -f $jarUrl)
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $JarPath) | Out-Null
      Invoke-WebRequest -Uri $jarUrl -OutFile $JarPath -UseBasicParsing
      if (Test-Path $JarPath) {
        Write-Host ("[OK] Backend jar downloaded to: {0}" -f $JarPath)
        return $true
      }
    } catch {
      Write-Host ("[WARN] Backend jar download failed: {0}" -f $_.Exception.Message)
    }
  }

  if (Try-BuildBackendJar) {
    Write-Host ("[OK] Backend jar built locally: {0}" -f $JarPath)
    return $true
  }

  return $false
}

if (-not (Test-Path $ProjectDir)) {
  Write-Host "Project folder not found: $ProjectDir"
  Read-Host 'Press Enter to exit'
  exit 1
}

if (-not (Test-Path (Join-Path $DistDir 'index.html'))) {
  Write-Host 'Frontend static file missing, trying bundle restore...'
  $distRestored = Sync-BundledFrontend
  if (-not $distRestored) {
    Write-Host "Frontend static file missing: $DistDir\index.html"
    Write-Host "Please run Prepare_Runtime_Windows.bat on build machine, then repack and retry."
    Read-Host 'Press Enter to exit'
    exit 1
  }
}

Ensure-FrontendStaticLayout -DistPath $DistDir

if (-not (Ensure-BackendJar)) {
  Write-Host "Backend jar missing: $JarPath"
  Write-Host "Please run Prepare_Runtime_Windows.bat on build machine,"
  Write-Host "or set HOROSA_BOOT_JAR_URL / runtime/windows/bundle/astrostudyboot.url.txt and retry."
  Read-Host 'Press Enter to exit'
  exit 1
}

$PythonBin = Resolve-Python
if (-not $PythonBin) {
  $installed = Install-WithWinget -PackageId 'Python.Python.3.11' -DisplayName 'Python 3.11'
  if ($installed) {
    $PythonBin = Resolve-Python
  }
  if (-not $PythonBin) {
    Write-Host 'Python 3.11/3.12 not found.'
    Write-Host 'Install Python 3.11+ (recommended 3.11), then rerun this launcher.'
    Read-Host 'Press Enter to exit'
    exit 1
  }
}

$PyRuntimeDir = Join-Path $Root 'runtime/windows/python'
if (-not (Test-Path (Join-Path $PyRuntimeDir 'python.exe'))) {
  Write-Host 'Preparing local Python runtime for offline use...'
  $pySynced = Sync-RuntimeFromExe -ExeCmdOrPath $PythonBin -TargetDir $PyRuntimeDir -UpLevels 1 -CheckRelative 'python.exe'
  if ($pySynced) {
    $PythonBin = Join-Path $PyRuntimeDir 'python.exe'
    Write-Host "[OK] Local Python runtime ready: $PythonBin"
  } else {
    Write-Host '[WARN] Could not sync local Python runtime, will continue with system Python.'
  }
}

$depsReady = Ensure-PythonRuntimeDeps -PythonExe $PythonBin -ProjectRoot $ProjectDir
if ($depsReady -and (-not (Test-PythonDepsReady -PythonCmdOrPath $PythonBin))) {
  Write-Host '[WARN] Python dependency check failed after install attempt; will try fallback.'
  $depsReady = $false
}
if (-not $depsReady) {
  $runtimePythonExe = Join-Path $PyRuntimeDir 'python.exe'
  $usingBundledPython = $false
  try {
    if ((Test-Path $PythonBin) -and (Test-Path $runtimePythonExe)) {
      $usingBundledPython = ((Resolve-Path $PythonBin).Path -ieq (Resolve-Path $runtimePythonExe).Path)
    }
  } catch {
    $usingBundledPython = $false
  }

  if ($usingBundledPython) {
    Write-Host '[WARN] Bundled Python dependencies are incomplete, trying system Python fallback...'
    $fallbackCandidates = @(
      "$env:LocalAppData\Programs\Python\Python311\python.exe",
      "$env:LocalAppData\Programs\Python\Python312\python.exe",
      "$env:ProgramFiles\Python311\python.exe",
      "$env:ProgramFiles\Python312\python.exe",
      'C:\Python311\python.exe',
      'C:\Python312\python.exe',
      'python'
    )
    foreach ($candidate in $fallbackCandidates) {
      if (-not (Test-PythonSupported -PythonCmdOrPath $candidate)) { continue }
      if ($candidate -ne 'python' -and (-not (Test-Path $candidate))) { continue }
      if ($candidate -ne 'python' -and (Test-Path $PythonBin)) {
        try {
          if ((Resolve-Path $candidate).Path -ieq (Resolve-Path $PythonBin).Path) { continue }
        } catch {}
      }

      if (Ensure-PythonRuntimeDeps -PythonExe $candidate -ProjectRoot $ProjectDir) {
        $PythonBin = $candidate
        $depsReady = $true
        Write-Host ("[OK] Switched to system Python: {0}" -f $PythonBin)
        break
      }
    }
  }
}

if (-not $depsReady) {
  Write-Host 'Python dependencies are incomplete. Startup aborted.'
  Read-Host 'Press Enter to exit'
  exit 1
}

$JavaBin = Resolve-Java
if (-not $JavaBin) {
  $installed = Install-Java17
  if ($installed) {
    $JavaBin = Resolve-Java
  }
  if (-not $JavaBin) {
    Write-Host 'Java 17+ not found.'
    Write-Host 'Install Java 17+, then rerun this launcher.'
    Read-Host 'Press Enter to exit'
    exit 1
  }
}

Write-Host ("Using Python: {0}" -f $PythonBin)
Write-Host ("Using Java: {0}" -f $JavaBin)
Write-Host ("Performance mode: {0} (set HOROSA_PERF_MODE=0 to disable)" -f ($(if($PerfMode){'ON'}else{'OFF'})))

Cleanup-All

$oldPythonPath = $env:PYTHONPATH
if ($oldPythonPath) {
  $env:PYTHONPATH = (Join-Path $ProjectDir 'astropy') + ';' + $oldPythonPath
} else {
  $env:PYTHONPATH = (Join-Path $ProjectDir 'astropy')
}

try {
  if (-not (Wait-PortFree -Port $ChartPort -TimeoutMs 6000)) {
    throw "Port $ChartPort is still in use before backend startup"
  }
  if (-not (Wait-PortFree -Port $BackendPort -TimeoutMs 6000)) {
    throw "Port $BackendPort is still in use before backend startup"
  }

  Write-Host '[1/4] Starting local backend services...'

  $pyScript = Join-Path $ProjectDir 'astropy/websrv/webchartsrv.py'
  $null = Start-Background -FilePath $PythonBin -Arguments @(Quote-Arg $pyScript) -LogPath $PyLog -PidFile $PyPidFile

  $mongoSelectTimeoutMs = if ($PerfMode) { 180 } else { 800 }
  $mongoConnectTimeoutMs = if ($PerfMode) { 180 } else { 800 }
  $mongoReadTimeoutMs = if ($PerfMode) { 220 } else { 1000 }
  $redisPoolTimeoutMs = if ($PerfMode) { 400 } else { 1000 }
  $cacheExpireSeconds = if ($PerfMode) { 300 } else { 120 }

  $javaArgs = @(
    "-Dhorosa.log.basedir=$HorosaLogBaseDir",
    "-Dhorosa.mongo.serverSelectionTimeoutMS=$mongoSelectTimeoutMs",
    "-Dhorosa.mongo.connectTimeoutMS=$mongoConnectTimeoutMs",
    "-Dhorosa.mongo.readTimeoutMS=$mongoReadTimeoutMs",
    '-jar',
    (Quote-Arg $JarPath),
    "--astrosrv=http://127.0.0.1:$ChartPort",
    '--mongodb.ip=127.0.0.1',
    '--mongodb.host=127.0.0.1',
    '--redis.ip=127.0.0.1',
    "--redis.pool.timeout=$redisPoolTimeoutMs",
    '--cachehelper.needcache=false',
    "--cachehelper.expireinsecond=$cacheExpireSeconds"
  )
  if ($PerfMode) {
    $javaArgs += @(
      '--needtranslog=false',
      '--mongo.statement.log=false'
    )
  }

  $null = Start-Background -FilePath $JavaBin -Arguments $javaArgs -LogPath $JavaLog -PidFile $JavaPidFile

  $ready = $false
  for ($i = 0; $i -lt 90; $i++) {
    $pyPid = Get-PidFromFile -Path $PyPidFile
    $javaPid = Get-PidFromFile -Path $JavaPidFile
    if (-not $pyPid -or -not $javaPid) { break }

    $pyAlive = Get-Process -Id $pyPid -ErrorAction SilentlyContinue
    $javaAlive = Get-Process -Id $javaPid -ErrorAction SilentlyContinue
    if (-not $pyAlive -or -not $javaAlive) { break }

    if ((Test-PortOpen -Port $ChartPort) -and (Test-PortOpen -Port $BackendPort)) {
      $ready = $true
      break
    }
    Start-Sleep -Seconds 1
  }

  if (-not $ready) {
    Write-Host "Backend not ready in time, required ports: $ChartPort and $BackendPort"
    if (Test-Path $PyLog) {
      Write-Host '--- python log tail ---'
      Get-Content $PyLog -Tail 30
    }
    if (Test-Path "$PyLog.err") {
      Write-Host '--- python err tail ---'
      Get-Content "$PyLog.err" -Tail 30
    }
    if (Test-Path $JavaLog) {
      Write-Host '--- java log tail ---'
      Get-Content $JavaLog -Tail 30
    }
    if (Test-Path "$JavaLog.err") {
      Write-Host '--- java err tail ---'
      Get-Content "$JavaLog.err" -Tail 30
    }
    throw 'Backend failed to start'
  }

  Write-Host "backend: http://127.0.0.1:$BackendPort"
  Write-Host "chartpy: http://127.0.0.1:$ChartPort"

  Write-Host "[2/4] Starting local web service on 127.0.0.1:$WebPort ..."
  if (Test-PortOpen -Port $WebPort) {
    throw "Port $WebPort is already in use"
  }

  $null = Start-Background -FilePath $PythonBin -Arguments @('-m', 'http.server', "$WebPort", '--bind', '127.0.0.1', '--directory', (Quote-Arg $DistDir)) -LogPath $WebLog -PidFile $WebPidFile

  $webReady = $false
  for ($i = 0; $i -lt 30; $i++) {
    if (Test-PortOpen -Port $WebPort) {
      $webReady = $true
      break
    }
    Start-Sleep -Milliseconds 300
  }

  if (-not $webReady) {
    throw "Web service failed to start. Check log: $WebLog"
  }

  $url = "http://127.0.0.1:$WebPort/index.html"

  Write-Host '[3/4] Opening browser...'
  if ($env:HOROSA_NO_BROWSER -eq '1') {
    Write-Host "[4/4] Started (no-browser mode): $url"
    if ($env:HOROSA_SMOKE_TEST -eq '1') {
      $waitSec = 6
      if ($env:HOROSA_SMOKE_WAIT_SECONDS) {
        try { $waitSec = [int]$env:HOROSA_SMOKE_WAIT_SECONDS } catch {}
      }
      if ($waitSec -lt 1) { $waitSec = 1 }
      Write-Host ("Smoke test mode: wait {0}s then stop services." -f $waitSec)
      Start-Sleep -Seconds $waitSec
    } else {
      Write-Host 'Press Enter to stop local services.'
      Read-Host 'Press Enter to stop'
    }
  } else {
    $browser = Resolve-Browser
    if ($browser) {
      $args = @(
        "--user-data-dir=$BrowserProfile",
        "--app=$url",
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-features=DialMediaRouteProvider'
      )
      $bp = Start-Process -FilePath $browser -ArgumentList $args -PassThru
      Write-Host "[4/4] Started: $url"
      Write-Host 'Close this app window to stop local services.'
      Wait-Process -Id $bp.Id
    } else {
      Start-Process $url | Out-Null
      Write-Host "[4/4] Started: $url"
      Write-Host 'No Chrome/Edge/Brave/Chromium found.'
      Write-Host 'Close browser, then come back here and press Enter to stop services.'
      Read-Host 'Press Enter to stop'
    }
  }

  Write-Host 'Browser closed, stopping local services...'
} catch {
  Write-Host "Startup failed: $($_.Exception.Message)"
  Write-Host "Log directory: $LogDir"
  Read-Host 'Press Enter to exit'
  exit 1
} finally {
  Cleanup-All
  $env:PYTHONPATH = $oldPythonPath
}
