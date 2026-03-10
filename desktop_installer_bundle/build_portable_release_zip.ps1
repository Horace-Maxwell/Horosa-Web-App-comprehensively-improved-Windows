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

$ResolvedPythonExe = Resolve-PythonExe -RequestedPath $PythonExe -BundledPath $BundledPythonExe

$env:HOROSA_DESKTOP_BUNDLE_ROOT = $ScriptRoot
$env:HOROSA_DESKTOP_REQUESTED_VERSION = $Version
$env:HOROSA_DESKTOP_REQUIRE_TAG_MATCH = if ($RequireTagMatch) { '1' } else { '0' }
$env:HOROSA_DESKTOP_GIT_TAG = $env:GITHUB_REF_NAME
$env:HOROSA_DESKTOP_PYTHON_EXE = $ResolvedPythonExe

@'
import hashlib
import json
import os
import time
from fnmatch import fnmatch
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

script_root = Path(os.environ["HOROSA_DESKTOP_BUNDLE_ROOT"]).resolve()
repo_root = script_root.parent
release_dir = script_root / "release"
release_dir.mkdir(parents=True, exist_ok=True)

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
manifest_path = release_dir / f"{asset_prefix}-{version}.manifest.json"
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

remove_with_retry(zip_path)
remove_with_retry(manifest_path)
remove_with_retry(runtime_zip_path)
remove_with_retry(runtime_manifest_path)

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

with ZipFile(zip_path, "w", compression=ZIP_DEFLATED, compresslevel=9) as zf:
    for current_root, dirs, files in os.walk(repo_root):
        current_path = Path(current_root)
        rel_dir = current_path.relative_to(repo_root).as_posix() if current_path != repo_root else ""

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
                zf.write(file_path, rel_file)
            except FileNotFoundError:
                continue

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
    zip_path,
    zip_name,
    manifest_path,
    "Attach the installer zip asset to a published GitHub release whose tag matches this version.",
)
write_manifest(
    runtime_zip_path,
    runtime_zip_name,
    runtime_manifest_path,
    "Attach the runtime zip asset to the same GitHub release; the Windows installer downloads it during install.",
)
print(f"[OK] Portable release zip built: {zip_path}")
print(f"[OK] Runtime payload zip built: {runtime_zip_path}")
'@ | & $ResolvedPythonExe -

Remove-Item Env:HOROSA_DESKTOP_BUNDLE_ROOT -ErrorAction SilentlyContinue
Remove-Item Env:HOROSA_DESKTOP_REQUESTED_VERSION -ErrorAction SilentlyContinue
Remove-Item Env:HOROSA_DESKTOP_REQUIRE_TAG_MATCH -ErrorAction SilentlyContinue
Remove-Item Env:HOROSA_DESKTOP_GIT_TAG -ErrorAction SilentlyContinue
Remove-Item Env:HOROSA_DESKTOP_PYTHON_EXE -ErrorAction SilentlyContinue
