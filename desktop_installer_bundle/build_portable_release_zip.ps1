param(
  [string]$Version,
  [string]$PythonExe,
  [switch]$RequireTagMatch
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptRoot
$BundledPythonExe = Join-Path $RepoRoot 'local\workspace\runtime\windows\python\python.exe'
$WheelhouseDir = Join-Path $ScriptRoot 'wheelhouse'
$RuntimeRequirementsFile = Join-Path $ScriptRoot 'runtime_requirements.txt'
$SetupBuilderRequirementsFile = Join-Path $ScriptRoot 'setup_builder_requirements.txt'
$PreparedRuntimeRoot = Join-Path $RepoRoot 'local\workspace\runtime\windows'
$PreparedRuntimeJar = Join-Path $PreparedRuntimeRoot 'bundle\astrostudyboot.jar'
$SetupDepsRoot = Join-Path $env:LocalAppData 'HorosaDesktop\setupbuilddeps'

function Resolve-PythonExe {
  param(
    [string]$RequestedPath,
    [string]$BundledPath
  )

  if ($RequestedPath) {
    if (-not (Test-Path $RequestedPath)) {
      throw "Requested Python executable not found: $RequestedPath"
    }
    return (Resolve-Path $RequestedPath).Path
  }

  if (Test-Path $BundledPath) {
    return (Resolve-Path $BundledPath).Path
  }

  $command = Get-Command python -ErrorAction SilentlyContinue
  if ($command -and $command.Source) {
    return $command.Source
  }

  throw "Python executable not found. Expected bundled runtime at $BundledPath or python on PATH."
}

function Test-WheelhouseComplete {
  param([string]$WheelDir)

  if (-not (Test-Path $WheelDir -PathType Container)) {
    return $false
  }

  $requiredPrefixes = @(
    'PySide6-',
    'PySide6_Addons-',
    'PySide6_Essentials-',
    'shiboken6-',
    'packaging-',
    'requests-',
    'certifi-',
    'charset_normalizer-',
    'idna-',
    'urllib3-'
  )

  foreach ($prefix in $requiredPrefixes) {
    $match = Get-ChildItem -Path $WheelDir -File -Filter ($prefix + '*.whl') -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $match) {
      return $false
    }
    if ($match.Length -lt 1024) {
      return $false
    }
  }

  return $true
}

function Ensure-Wheelhouse {
  param(
    [string]$PythonExe,
    [string]$ReqFile,
    [string]$WheelDir
  )

  if (-not (Test-Path $ReqFile -PathType Leaf)) {
    throw "runtime_requirements.txt not found: $ReqFile"
  }

  if (Test-WheelhouseComplete -WheelDir $WheelDir) {
    Write-Host "[OK] Desktop wheelhouse already available: $WheelDir"
    return
  }

  New-Item -ItemType Directory -Force -Path $WheelDir | Out-Null
  Get-ChildItem -Path $WheelDir -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

  Write-Host "[INFO] Downloading desktop wheelhouse for offline installer..."
  & $PythonExe -m pip download --disable-pip-version-check --only-binary=:all: --dest $WheelDir -r $ReqFile
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to download desktop wheelhouse via pip."
  }

  if (-not (Test-WheelhouseComplete -WheelDir $WheelDir)) {
    throw "Desktop wheelhouse is incomplete after download: $WheelDir"
  }

  Write-Host "[OK] Desktop wheelhouse ready: $WheelDir"
}

function Ensure-SetupBuilderDeps {
  param(
    [string]$PythonExe,
    [string]$ReqFile,
    [string]$DepsRoot
  )

  if (-not (Test-Path $ReqFile -PathType Leaf)) {
    throw "setup_builder_requirements.txt not found: $ReqFile"
  }

  if (Test-Path $DepsRoot) {
    Remove-Item -Recurse -Force $DepsRoot -ErrorAction SilentlyContinue
  }

  New-Item -ItemType Directory -Force -Path $DepsRoot | Out-Null
  Write-Host "[INFO] Installing single-file setup builder dependencies..."
  & $PythonExe -m pip install --disable-pip-version-check --upgrade --target $DepsRoot -r $ReqFile
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to install setup builder dependencies."
  }

  if (-not (Test-Path (Join-Path $DepsRoot 'PyInstaller'))) {
    throw "PyInstaller was not installed into setup builder deps: $DepsRoot"
  }

  Write-Host "[OK] Single-file setup builder dependencies ready: $DepsRoot"
}

function Ensure-PreparedRuntime {
  param(
    [string]$RepoPath,
    [string]$ExpectedJarPath
  )

  if (Test-Path $ExpectedJarPath -PathType Leaf) {
    Write-Host "[OK] Prepared runtime bundle already available."
    return
  }

  $prepareScript = Join-Path $RepoPath 'prepareruntime\Prepare_Runtime_Windows.ps1'
  if (-not (Test-Path $prepareScript -PathType Leaf)) {
    throw "Prepare runtime script not found: $prepareScript"
  }

  Write-Host "[INFO] Runtime bundle missing; preparing Windows runtime payload..."
  & $prepareScript
  if ($LASTEXITCODE -ne 0) {
    throw "Prepare_Runtime_Windows.ps1 failed with exit code $LASTEXITCODE"
  }

  if (-not (Test-Path $ExpectedJarPath -PathType Leaf)) {
    throw "Prepared runtime jar still missing after runtime preparation: $ExpectedJarPath"
  }

  Write-Host "[OK] Prepared runtime bundle regenerated."
}

Ensure-PreparedRuntime -RepoPath $RepoRoot -ExpectedJarPath $PreparedRuntimeJar
$ResolvedPythonExe = Resolve-PythonExe -RequestedPath $PythonExe -BundledPath $BundledPythonExe
Ensure-Wheelhouse -PythonExe $ResolvedPythonExe -ReqFile $RuntimeRequirementsFile -WheelDir $WheelhouseDir
Ensure-SetupBuilderDeps -PythonExe $ResolvedPythonExe -ReqFile $SetupBuilderRequirementsFile -DepsRoot $SetupDepsRoot

$versionInfo = Get-Content -Raw (Join-Path $ScriptRoot 'version.json') | ConvertFrom-Json
$launcherAssetName = if ($versionInfo.PSObject.Properties['launcher_asset_name']) { [string]$versionInfo.launcher_asset_name } else { 'Xingque.exe' }
$launcherExePath = Join-Path (Join-Path $ScriptRoot 'release') $launcherAssetName
$launcherWorkDir = Join-Path $ScriptRoot 'build\xingque-launcher'
$launcherSpec = Join-Path $ScriptRoot 'pyinstaller\xingque_launcher.spec'

if (-not (Test-Path $launcherSpec -PathType Leaf)) {
  throw "Installed app launcher spec not found: $launcherSpec"
}
if (Test-Path $launcherWorkDir) {
  Remove-Item -Recurse -Force $launcherWorkDir -ErrorAction SilentlyContinue
}
if (Test-Path $launcherExePath) {
  Remove-Item -Force $launcherExePath -ErrorAction SilentlyContinue
}

$env:HOROSA_DESKTOP_BUNDLE_ROOT = $ScriptRoot
$env:HOROSA_DESKTOP_REQUESTED_VERSION = $Version
$env:HOROSA_DESKTOP_REQUIRE_TAG_MATCH = if ($RequireTagMatch) { '1' } else { '0' }
$env:HOROSA_DESKTOP_GIT_TAG = $env:GITHUB_REF_NAME
$env:HOROSA_DESKTOP_PYTHON_EXE = $ResolvedPythonExe

$oldPythonPath = $env:PYTHONPATH
try {
  if ([string]::IsNullOrWhiteSpace($oldPythonPath)) {
    $env:PYTHONPATH = $SetupDepsRoot
  } else {
    $env:PYTHONPATH = $SetupDepsRoot + ';' + $oldPythonPath
  }

  $env:HOROSA_XINGQUE_EXE_NAME = [System.IO.Path]::GetFileNameWithoutExtension($launcherAssetName)
  & $ResolvedPythonExe -m PyInstaller $launcherSpec --noconfirm --clean --distpath (Join-Path $ScriptRoot 'release') --workpath $launcherWorkDir
  if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller failed while building installed app launcher with exit code $LASTEXITCODE"
  }
} finally {
  if ($null -ne $oldPythonPath) {
    $env:PYTHONPATH = $oldPythonPath
  } else {
    Remove-Item Env:PYTHONPATH -ErrorAction SilentlyContinue
  }
  Remove-Item Env:HOROSA_XINGQUE_EXE_NAME -ErrorAction SilentlyContinue
}

if (-not (Test-Path $launcherExePath -PathType Leaf)) {
  throw "Installed app launcher was not produced: $launcherExePath"
}
Write-Host "[OK] Installed app launcher built: $launcherExePath"
$env:HOROSA_DESKTOP_LAUNCHER_EXE = $launcherExePath

@'
import hashlib
import json
import os
import time
import shutil
from fnmatch import fnmatch
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

script_root = Path(os.environ["HOROSA_DESKTOP_BUNDLE_ROOT"]).resolve()
repo_root = script_root.parent
release_dir = script_root / "release"
release_dir.mkdir(parents=True, exist_ok=True)
short_stage_base = Path(os.environ.get("SystemDrive", "C:")) / "hpx"
short_stage_base.mkdir(parents=True, exist_ok=True)

version_info = json.loads((script_root / "version.json").read_text(encoding="utf-8"))
version = str(version_info["version"])
requested_version = (os.environ.get("HOROSA_DESKTOP_REQUESTED_VERSION") or "").strip()
git_tag = (os.environ.get("HOROSA_DESKTOP_GIT_TAG") or "").strip()
require_tag_match = os.environ.get("HOROSA_DESKTOP_REQUIRE_TAG_MATCH") == "1"

if requested_version and version != requested_version:
    raise RuntimeError(
        f"version.json version {version!r} does not match requested version {requested_version!r}."
    )

if require_tag_match and git_tag and version != git_tag:
    raise RuntimeError(
        f"version.json version {version!r} does not match Git tag {git_tag!r}."
    )

asset_prefix = "HorosaPortableWindows"
runtime_asset_prefix = str(version_info.get("runtime_asset_prefix") or "HorosaRuntimeWindows")
zip_name = f"{asset_prefix}-{version}.zip"
zip_path = release_dir / zip_name
runtime_zip_name = f"{runtime_asset_prefix}-{version}.zip"
runtime_zip_path = release_dir / runtime_zip_name
runtime_manifest_path = release_dir / f"{runtime_asset_prefix}-{version}.manifest.json"

root_excludes = {".git", ".github"}
relative_excludes = {
    "desktop_installer_bundle/build",
    "desktop_installer_bundle/dist",
    "desktop_installer_bundle/release",
    "desktop_installer_bundle/qt-cache",
    "desktop_installer_bundle/qt-profile",
    "desktop_installer_bundle/runtime-logs",
    "desktop_installer_bundle/wheelhouse",
    "log",
    "local/workspace/runtime/windows",
}
pattern_excludes = [
    "smallpkg_selfcheck*",
    "release_selfcheck_tmp*",
    "local/workspace/runtime/horosa_runtime_perf_check.json",
    "local/workspace/*/.horosa_win_*.pid",
    "local/workspace/*/*.command",
    "local/workspace/*/runtime",
    "local/workspace/*/astropy/astrostudy/models",
    "local/workspace/*/astrostudysrv/*/target",
    "local/workspace/*/flatlib-ctrad2/flatlib/resources/swefiles",
    "local/workspace/*/astrostudyui/node_modules",
    "local/workspace/*/astrostudyui/coverage",
    "local/workspace/*/astrostudyui/dist",
    "local/workspace/*/astrostudyui/dist-file",
    "local/workspace/*/astrostudysrv/astrostudyboot/target",
    "local/workspace/*/.horosa-browser-profile-win",
    "local/workspace/*/.horosa-local-logs-win",
    "local/workspace/*/tmp_*.out",
    "local/workspace/*/tmp_*.err",
]

def should_skip(rel_posix: str) -> bool:
    if not rel_posix:
        return False
    if rel_posix in relative_excludes:
        return True
    for prefix in relative_excludes:
        if rel_posix.startswith(prefix + "/"):
            return True
    for pattern in pattern_excludes:
        if fnmatch(rel_posix, pattern):
            return True
    return False

def remove_with_retry(path: Path) -> None:
    if not path.exists():
        return
    last_exc = None
    for _ in range(20):
        try:
            path.unlink()
            return
        except FileNotFoundError:
            return
        except PermissionError as exc:
            last_exc = exc
            time.sleep(0.5)
    if last_exc:
        raise last_exc

def remove_tree_with_retry(path: Path) -> None:
    if not path.exists():
        return
    last_exc = None
    for _ in range(20):
        try:
            shutil.rmtree(path)
            return
        except FileNotFoundError:
            return
        except PermissionError as exc:
            last_exc = exc
            time.sleep(0.5)
    if last_exc:
        raise last_exc

remove_with_retry(zip_path)
remove_with_retry(runtime_zip_path)
remove_with_retry(runtime_manifest_path)
portable_stage_root = short_stage_base / f"portable-stage-{version}"
remove_tree_with_retry(portable_stage_root)

def add_tree(zf: ZipFile, source_root: Path, archive_root: str) -> None:
    if not source_root.exists():
        raise FileNotFoundError(f"Runtime payload source missing: {source_root}")

    for current_root, dirs, files in os.walk(source_root):
        current_path = Path(current_root)
        rel_dir = current_path.relative_to(source_root).as_posix() if current_path != source_root else ""
        arc_dir = "/".join([archive_root.strip("/"), rel_dir]).strip("/")

        dirs[:] = [d for d in dirs if d not in root_excludes]

        for file_name in files:
            file_path = current_path / file_name
            rel_file = file_path.relative_to(source_root).as_posix()
            arc_file = "/".join([archive_root.strip("/"), rel_file]).strip("/")
            try:
                zf.write(file_path, arc_file)
            except FileNotFoundError:
                continue

def copy_filtered_tree(source_root: Path, destination_root: Path) -> None:
    if not source_root.exists():
        raise FileNotFoundError(f"Portable payload source missing: {source_root}")

    for current_root, dirs, files in os.walk(source_root):
        current_path = Path(current_root)
        rel_dir = current_path.relative_to(repo_root).as_posix()

        dirs[:] = [
            d for d in dirs
            if d not in root_excludes
            and not should_skip(f"{rel_dir}/{d}".strip("/"))
        ]

        for file_name in files:
            file_path = current_path / file_name
            rel_file = file_path.relative_to(repo_root).as_posix()
            if should_skip(rel_file):
                continue
            try:
                destination = destination_root / file_path.relative_to(source_root)
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(file_path, destination)
            except FileNotFoundError:
                continue

def copy_tree(source_root: Path, destination_root: Path) -> None:
    if not source_root.exists():
        raise FileNotFoundError(f"Portable payload source missing: {source_root}")
    for current_root, dirs, files in os.walk(source_root):
        current_path = Path(current_root)
        rel_dir = current_path.relative_to(source_root)
        target_dir = destination_root / rel_dir
        target_dir.mkdir(parents=True, exist_ok=True)
        dirs[:] = [d for d in dirs if d not in root_excludes]
        for file_name in files:
            file_path = current_path / file_name
            destination = target_dir / file_name
            try:
                shutil.copy2(file_path, destination)
            except FileNotFoundError:
                continue

portable_stage_root.mkdir(parents=True, exist_ok=True)
portable_payload_root = portable_stage_root / "_package"
portable_payload_root.mkdir(parents=True, exist_ok=True)
copy_filtered_tree(repo_root / "desktop_installer_bundle", portable_payload_root / "desktop_installer_bundle")
copy_filtered_tree(repo_root / "local", portable_payload_root / "local")

launcher_exe = (os.environ.get("HOROSA_DESKTOP_LAUNCHER_EXE") or "").strip()
if launcher_exe:
    launcher_path = Path(launcher_exe)
    if not launcher_path.exists():
        raise FileNotFoundError(f"Installed app launcher missing: {launcher_path}")
    launcher_dest = portable_payload_root / "desktop_installer_bundle" / launcher_path.name
    launcher_dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(launcher_path, launcher_dest)

payload_readme = portable_payload_root / "README.md"
payload_readme.write_text(
    "\n".join(
        [
            "# Xingque Desktop Payload",
            "",
            "Internal payload for the Xingque Windows installer package.",
            "Do not run files from this folder directly.",
        ]
    ),
    encoding="ascii",
)

portable_readme = portable_stage_root / "README.md"
portable_readme.write_text(
    "\n".join(
        [
            "# Xingque Windows Installer",
            "",
            "1. Extract this zip completely.",
            "2. Double-click `Install_Horosa_Desktop.vbs` in this top-level folder.",
            "3. Follow the Chinese setup wizard to finish installation.",
            "",
            "You do not need to open the `_package` folder.",
            "Large runtime components will be downloaded automatically during installation.",
        ]
    ),
    encoding="ascii",
)

portable_bootstrap_vbs = portable_stage_root / "Install_Horosa_Desktop.vbs"
portable_bootstrap_vbs.write_text(
    "\n".join(
        [
            "Option Explicit",
            "",
            "Dim fso, shell, scriptDir, wizardScript, cmd, exitCode, pwshExe",
            'Set fso = CreateObject("Scripting.FileSystemObject")',
            'Set shell = CreateObject("WScript.Shell")',
            "",
            "scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)",
            'wizardScript = fso.BuildPath(scriptDir, "_package\\desktop_installer_bundle\\install_desktop_wizard.ps1")',
            'pwshExe = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\\PowerShell\\7\\pwsh.exe"',
            "If Not fso.FileExists(pwshExe) Then",
            '  pwshExe = "powershell.exe"',
            "End If",
            "",
            "If Not fso.FileExists(wizardScript) Then",
            '  MsgBox "Installer script not found." & vbCrLf & wizardScript, vbCritical, "Xingque"',
            "  WScript.Quit 1",
            "End If",
            "",
            'cmd = Chr(34) & pwshExe & Chr(34) & " -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " & Chr(34) & wizardScript & Chr(34)',
            "exitCode = shell.Run(cmd, 0, True)",
            "WScript.Quit exitCode",
            "",
        ]
    ),
    encoding="ascii",
)

with ZipFile(zip_path, "w", compression=ZIP_DEFLATED, compresslevel=9) as zf:
    for current_root, dirs, files in os.walk(portable_stage_root):
        current_path = Path(current_root)
        rel_dir = current_path.relative_to(portable_stage_root).as_posix() if current_path != portable_stage_root else ""

        dirs[:] = [d for d in dirs if d not in root_excludes]

        for file_name in files:
            file_path = current_path / file_name
            rel_file = file_path.relative_to(portable_stage_root).as_posix()
            try:
                zf.write(file_path, rel_file)
            except FileNotFoundError:
                continue

remove_tree_with_retry(portable_stage_root)

with ZipFile(runtime_zip_path, "w", compression=ZIP_DEFLATED, compresslevel=9) as zf:
    add_tree(zf, repo_root / "local" / "workspace" / "runtime" / "windows", "local/workspace/runtime/windows")
    add_tree(zf, script_root / "wheelhouse", "desktop_installer_bundle/wheelhouse")
    workspace_root = repo_root / "local" / "workspace"
    for project_dir in workspace_root.iterdir():
        if not project_dir.is_dir():
            continue
        if not (project_dir / "astrostudyui").is_dir():
            continue
        if not (project_dir / "astrostudysrv").is_dir():
            continue
        if not (project_dir / "astropy").is_dir():
            continue
        jar_path = project_dir / "astrostudysrv" / "astrostudyboot" / "target" / "astrostudyboot.jar"
        if jar_path.exists():
            add_tree(
                zf,
                jar_path.parent,
                jar_path.parent.relative_to(repo_root).as_posix(),
            )
        dist_file_dir = project_dir / "astrostudyui" / "dist-file"
        if dist_file_dir.exists():
            add_tree(
                zf,
                dist_file_dir,
                dist_file_dir.relative_to(repo_root).as_posix(),
            )
        dist_dir = project_dir / "astrostudyui" / "dist"
        if dist_dir.exists():
            add_tree(
                zf,
                dist_dir,
                dist_dir.relative_to(repo_root).as_posix(),
            )
        models_dir = project_dir / "astropy" / "astrostudy" / "models"
        if models_dir.exists():
            add_tree(
                zf,
                models_dir,
                models_dir.relative_to(repo_root).as_posix(),
            )
        swefiles_dir = project_dir / "flatlib-ctrad2" / "flatlib" / "resources" / "swefiles"
        if swefiles_dir.exists():
            add_tree(
                zf,
                swefiles_dir,
                swefiles_dir.relative_to(repo_root).as_posix(),
            )

def write_manifest(asset_path: Path, asset_name: str, target_manifest_path: Path, notes: str) -> None:
    sha256 = hashlib.sha256()
    with asset_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            sha256.update(chunk)

    manifest = {
        "version": version,
        "asset": asset_name,
        "sha256": sha256.hexdigest(),
        "createdAt": __import__("datetime").datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "notes": notes,
    }
    target_manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

write_manifest(
    runtime_zip_path,
    runtime_zip_name,
    runtime_manifest_path,
    "Attach the runtime zip asset to the dedicated runtime release for this version.",
)
print(f"[OK] Portable release zip built: {zip_path}")
print(f"[OK] Runtime payload zip built: {runtime_zip_path}")
'@ | & $ResolvedPythonExe -

$portableZipPath = Join-Path (Join-Path $ScriptRoot 'release') ("{0}-{1}.zip" -f $versionInfo.release_asset_prefix, $versionInfo.version)
$installerAssetName = if ($versionInfo.PSObject.Properties['installer_asset_name']) { [string]$versionInfo.installer_asset_name } else { 'XingqueSetup.exe' }
$offlineInstallerAssetName = if ($versionInfo.PSObject.Properties['offline_installer_asset_name']) { [string]$versionInfo.offline_installer_asset_name } else { 'XingqueSetupFull.exe' }
$installerExePath = Join-Path (Join-Path $ScriptRoot 'release') $installerAssetName
$offlineInstallerExePath = Join-Path (Join-Path $ScriptRoot 'release') $offlineInstallerAssetName
$setupWorkDir = Join-Path $ScriptRoot 'build\setup-installer'
$offlineSetupWorkDir = Join-Path $ScriptRoot 'build\setup-installer-full'
$setupSpec = Join-Path $ScriptRoot 'pyinstaller\xingque_setup.spec'
$runtimeZipPath = Join-Path (Join-Path $ScriptRoot 'release') ("{0}-{1}.zip" -f $versionInfo.runtime_asset_prefix, $versionInfo.version)
$runtimeManifestPath = Join-Path (Join-Path $ScriptRoot 'release') ("{0}-{1}.manifest.json" -f $versionInfo.runtime_asset_prefix, $versionInfo.version)

if (-not (Test-Path $setupSpec -PathType Leaf)) {
  throw "Single-file installer spec not found: $setupSpec"
}
if (Test-Path $setupWorkDir) {
  Remove-Item -Recurse -Force $setupWorkDir -ErrorAction SilentlyContinue
}
if (Test-Path $installerExePath) {
  Remove-Item -Force $installerExePath -ErrorAction SilentlyContinue
}
if (Test-Path $offlineSetupWorkDir) {
  Remove-Item -Recurse -Force $offlineSetupWorkDir -ErrorAction SilentlyContinue
}
if (Test-Path $offlineInstallerExePath) {
  Remove-Item -Force $offlineInstallerExePath -ErrorAction SilentlyContinue
}

$oldPythonPath = $env:PYTHONPATH
try {
  if ([string]::IsNullOrWhiteSpace($oldPythonPath)) {
    $env:PYTHONPATH = $SetupDepsRoot
  } else {
    $env:PYTHONPATH = $SetupDepsRoot + ';' + $oldPythonPath
  }

  $env:HOROSA_SETUP_PAYLOAD_ZIP = $portableZipPath
  $env:HOROSA_SETUP_EXE_NAME = [System.IO.Path]::GetFileNameWithoutExtension($installerAssetName)

  & $ResolvedPythonExe -m PyInstaller $setupSpec --noconfirm --clean --distpath (Join-Path $ScriptRoot 'release') --workpath $setupWorkDir
  if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller failed while building single-file installer with exit code $LASTEXITCODE"
  }

  $extraFiles = @(
    @{
      source = $runtimeZipPath
      dest = '.'
    },
    @{
      source = $runtimeManifestPath
      dest = '.'
    }
  ) | ConvertTo-Json -Compress
  $env:HOROSA_SETUP_EXTRA_FILES = $extraFiles
  $env:HOROSA_SETUP_EXE_NAME = [System.IO.Path]::GetFileNameWithoutExtension($offlineInstallerAssetName)

  & $ResolvedPythonExe -m PyInstaller $setupSpec --noconfirm --clean --distpath (Join-Path $ScriptRoot 'release') --workpath $offlineSetupWorkDir
  if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller failed while building offline single-file installer with exit code $LASTEXITCODE"
  }
} finally {
  if ($null -ne $oldPythonPath) {
    $env:PYTHONPATH = $oldPythonPath
  } else {
    Remove-Item Env:PYTHONPATH -ErrorAction SilentlyContinue
  }
  Remove-Item Env:HOROSA_SETUP_PAYLOAD_ZIP -ErrorAction SilentlyContinue
  Remove-Item Env:HOROSA_SETUP_EXTRA_FILES -ErrorAction SilentlyContinue
  Remove-Item Env:HOROSA_SETUP_EXE_NAME -ErrorAction SilentlyContinue
}

if (-not (Test-Path $portableZipPath -PathType Leaf)) {
  throw "Portable release zip not found for single-file installer build: $portableZipPath"
}
if (-not (Test-Path $installerExePath -PathType Leaf)) {
  throw "Single-file installer was not produced: $installerExePath"
}
if (-not (Test-Path $offlineInstallerExePath -PathType Leaf)) {
  throw "Offline single-file installer was not produced: $offlineInstallerExePath"
}
Write-Host "[OK] Single-file setup built: $installerExePath"
Write-Host "[OK] Offline single-file setup built: $offlineInstallerExePath"

Remove-Item Env:HOROSA_DESKTOP_BUNDLE_ROOT -ErrorAction SilentlyContinue
Remove-Item Env:HOROSA_DESKTOP_REQUESTED_VERSION -ErrorAction SilentlyContinue
Remove-Item Env:HOROSA_DESKTOP_REQUIRE_TAG_MATCH -ErrorAction SilentlyContinue
Remove-Item Env:HOROSA_DESKTOP_GIT_TAG -ErrorAction SilentlyContinue
Remove-Item Env:HOROSA_DESKTOP_PYTHON_EXE -ErrorAction SilentlyContinue
Remove-Item Env:HOROSA_DESKTOP_LAUNCHER_EXE -ErrorAction SilentlyContinue

