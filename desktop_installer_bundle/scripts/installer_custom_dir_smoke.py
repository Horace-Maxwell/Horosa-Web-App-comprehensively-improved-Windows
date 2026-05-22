#!/usr/bin/env python3
"""Smoke-check NSIS custom install directory behavior without GUI automation."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import time
import traceback
import winreg
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_VERSION = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
INSTALLER_EXE = ROOT / "release" / f"Horosa-Setup-{APP_VERSION}.exe"
APP_GUID = "9d2acd56-1a0c-5d43-a9dc-c1506beeddee"
INSTALL_REG_PATH = fr"Software\{APP_GUID}"
UNINSTALL_REG_PATH = fr"Software\Microsoft\Windows\CurrentVersion\Uninstall\{APP_GUID}"
REPORT_DIR = ROOT / "qa_artifacts" / datetime.now().strftime("%Y-%m-%d")
JSON_REPORT = REPORT_DIR / "installer_custom_dir_smoke.json"


def normalize_path(value: str | None) -> str:
    return str(value or "").strip().replace("/", "\\").lower()


def reg_get(root: int, subkey: str, value_name: str) -> str | None:
    try:
        with winreg.OpenKey(root, subkey) as key:
            value, _ = winreg.QueryValueEx(key, value_name)
            return str(value)
    except OSError:
        return None


def get_install_location() -> str | None:
    return reg_get(winreg.HKEY_CURRENT_USER, INSTALL_REG_PATH, "InstallLocation") or reg_get(
        winreg.HKEY_LOCAL_MACHINE, INSTALL_REG_PATH, "InstallLocation"
    )


def get_display_version() -> str | None:
    return reg_get(winreg.HKEY_CURRENT_USER, UNINSTALL_REG_PATH, "DisplayVersion") or reg_get(
        winreg.HKEY_LOCAL_MACHINE, UNINSTALL_REG_PATH, "DisplayVersion"
    )


def get_quiet_uninstall() -> str | None:
    return reg_get(winreg.HKEY_CURRENT_USER, UNINSTALL_REG_PATH, "QuietUninstallString") or reg_get(
        winreg.HKEY_LOCAL_MACHINE, UNINSTALL_REG_PATH, "QuietUninstallString"
    )


def kill_processes() -> None:
    for image in ("Horosa.exe", f"Horosa-Setup-{APP_VERSION}.exe"):
        subprocess.run(["taskkill", "/IM", image, "/T", "/F"], check=False, capture_output=True)


def uninstall_existing() -> None:
    quiet = get_quiet_uninstall()
    if not quiet:
        return
    subprocess.run(quiet, shell=True, check=False, timeout=300)
    deadline = time.time() + 180
    while time.time() < deadline:
        install_location = get_install_location()
        if not install_location or not Path(install_location).exists():
            return
        time.sleep(2)
    raise RuntimeError(f"existing install did not disappear: {get_install_location()}")


def wait_until_installed(timeout_seconds: int = 300) -> dict:
    deadline = time.time() + timeout_seconds
    last_snapshot: dict = {}
    while time.time() < deadline:
        install_location = get_install_location()
        install_path = Path(install_location) if install_location else None
        snapshot = {
            "install_location": install_location,
            "display_version": get_display_version(),
            "install_exists": bool(install_path and install_path.exists()),
            "app_exe_exists": bool(install_path and (install_path / "Horosa.exe").exists()),
            "uninstall_exe_exists": bool(install_path and (install_path / "Uninstall Horosa.exe").exists()),
        }
        last_snapshot = snapshot
        if snapshot["install_exists"] and snapshot["app_exe_exists"] and snapshot["uninstall_exe_exists"]:
            return snapshot
        time.sleep(2)
    raise RuntimeError(f"installer did not complete before timeout: {last_snapshot}")


def run_powershell_json(script: str, timeout: int = 30) -> dict:
    result = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    return json.loads(result.stdout)


def read_shortcuts(expected_target: Path) -> dict:
    script = rf"""
$shell = New-Object -ComObject WScript.Shell
$desktop = $shell.SpecialFolders('Desktop')
$programs = $shell.SpecialFolders('Programs')
$paths = @((Join-Path $desktop 'Horosa.lnk'), (Join-Path $programs 'Horosa.lnk'))
$items = @()
foreach ($p in $paths) {{
  if (Test-Path $p) {{
    $s = $shell.CreateShortcut($p)
    $items += [pscustomobject]@{{
      path = $p
      target = $s.TargetPath
      workingDirectory = $s.WorkingDirectory
      iconLocation = $s.IconLocation
      valid = (([string]$s.TargetPath).ToLowerInvariant() -eq "{str(expected_target).lower()}")
    }}
  }}
}}
[pscustomobject]@{{ shortcuts = $items }} | ConvertTo-Json -Depth 5 -Compress
"""
    return run_powershell_json(script)


def run_installer_custom_dir(custom_parent: Path) -> dict:
    selected_dir = custom_parent / "HorosaSelectedByUser"
    if selected_dir.exists():
        shutil.rmtree(selected_dir, ignore_errors=True)

    proc = subprocess.run(
        [str(INSTALLER_EXE), "/S", f"/D={selected_dir}"],
        check=False,
        timeout=900,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"installer failed with exit code {proc.returncode}")

    snapshot = wait_until_installed()
    install_location = Path(snapshot["install_location"] or "")
    shortcut_result = read_shortcuts(install_location / "Horosa.exe")

    install_norm = normalize_path(str(install_location))
    selected_norm = normalize_path(str(selected_dir))
    issues: list[str] = []
    if not install_norm.startswith(selected_norm):
        issues.append(f"install_location_not_under_selected_dir:{install_location}")
    if snapshot["display_version"] != APP_VERSION:
        issues.append(f"display_version_mismatch:{snapshot['display_version']}")

    shortcuts = shortcut_result.get("shortcuts") or []
    if isinstance(shortcuts, dict):
        shortcuts = [shortcuts]
    if len(shortcuts) < 2:
        issues.append(f"missing_shortcuts:{len(shortcuts)}")
    invalid_shortcuts = [item for item in shortcuts if not item.get("valid")]
    if invalid_shortcuts:
        issues.append(f"invalid_shortcuts:{len(invalid_shortcuts)}")

    return {
        "selected_dir": str(selected_dir),
        "snapshot": snapshot,
        "shortcuts": shortcuts,
        "issues": issues,
        "ok": not issues,
    }


def main() -> int:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    if not INSTALLER_EXE.exists():
        raise FileNotFoundError(f"installer not found: {INSTALLER_EXE}")

    kill_processes()
    uninstall_existing()
    time.sleep(2)

    custom_parent = Path(tempfile.mkdtemp(prefix="HorosaCustomDirSmoke-"))
    result = {
        "generated_at": datetime.now().isoformat(),
        "installer": str(INSTALLER_EXE),
        "custom_parent": str(custom_parent),
        "custom_install": run_installer_custom_dir(custom_parent),
    }
    JSON_REPORT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    if not result["custom_install"]["ok"]:
        raise RuntimeError(f"custom directory install failed: {result['custom_install']['issues']}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:
        traceback.print_exc()
        raise
