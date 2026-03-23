from __future__ import annotations

import json
import os
import subprocess
import time
import traceback
import winreg
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path

from pywinauto import Desktop
from win32com.client import Dispatch


ROOT = Path(__file__).resolve().parents[1]
PACKAGE_JSON = ROOT / "package.json"
APP_VERSION = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))["version"]
INSTALLER_EXE = ROOT / "release" / f"Horosa-Setup-{APP_VERSION}.exe"
REPORT_DIR = ROOT / "qa_artifacts" / datetime.now().strftime("%Y-%m-%d")
SCREENSHOT_DIR = REPORT_DIR / "screenshots"
JSON_REPORT = REPORT_DIR / "installer_regression.json"
MARKDOWN_REPORT = ROOT / f"QA_REGRESSION_{datetime.now().strftime('%Y-%m-%d')}.md"
APP_GUID = "9d2acd56-1a0c-5d43-a9dc-c1506beeddee"
INSTALL_REG_PATH = fr"Software\{APP_GUID}"
UNINSTALL_REG_PATH = fr"Software\Microsoft\Windows\CurrentVersion\Uninstall\{APP_GUID}"


@dataclass
class Snapshot:
    install_location: str | None
    display_version: str | None
    install_exists: bool
    app_exe_exists: bool
    uninstall_exe_exists: bool
    user_data_exists: bool
    user_data_items: list[str]
    start_menu_root: str
    desktop_root: str
    start_menu_links: list[str]
    desktop_links: list[str]
    start_menu_shortcuts: list[dict]
    desktop_shortcuts: list[dict]


@dataclass
class ShortcutSnapshot:
    path: str
    target_path: str
    working_directory: str
    icon_location: str
    description: str
    valid: bool
    issues: list[str]


def ensure_dirs() -> None:
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


def reg_get(root: int, subkey: str, value_name: str) -> str | None:
    try:
        with winreg.OpenKey(root, subkey) as key:
            value, _ = winreg.QueryValueEx(key, value_name)
            return str(value)
    except OSError:
        return None


def normalize_path(value: str | None) -> str:
    return str(value or "").strip().replace("/", "\\").lower()


def get_shell_special_folder(name: str, fallback: Path) -> Path:
    try:
        shell = Dispatch("WScript.Shell")
        folder = shell.SpecialFolders(name)
        if folder:
            return Path(str(folder))
    except Exception:
        pass
    return fallback


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


def list_links(root: Path) -> list[str]:
    if not root.exists():
        return []
    matches: list[str] = []
    for path in root.rglob("*"):
        if path.is_file() and path.suffix.lower() == ".lnk" and any(
            token in path.name for token in ("星阙", "Horosa", "START_HERE")
        ):
            matches.append(str(path))
    return sorted(matches)


def unique_paths(paths: list[Path]) -> list[Path]:
    seen: set[str] = set()
    result: list[Path] = []
    for path in paths:
        key = normalize_path(str(path))
        if key in seen:
            continue
        seen.add(key)
        result.append(path)
    return result


def read_shortcut(path: Path, expected_target: str | None) -> ShortcutSnapshot:
    issues: list[str] = []
    target_path = ""
    working_directory = ""
    icon_location = ""
    description = ""

    try:
        shell = Dispatch("WScript.Shell")
        shortcut = shell.CreateShortcut(str(path))
        target_path = str(shortcut.TargetPath or "")
        working_directory = str(shortcut.WorkingDirectory or "")
        icon_location = str(shortcut.IconLocation or "")
        description = str(shortcut.Description or "")
    except Exception as exc:
        issues.append(f"read_error:{exc}")

    if not path.exists():
        issues.append("missing")

    if not target_path:
        issues.append("empty_target")

    if expected_target:
        expected_target_norm = normalize_path(expected_target)
        expected_workdir = normalize_path(str(Path(expected_target).parent))
        expected_icon = normalize_path(f"{expected_target},0")

        if normalize_path(target_path) != expected_target_norm:
            issues.append("target_mismatch")
        if normalize_path(working_directory) != expected_workdir:
            issues.append("working_directory_mismatch")
        if normalize_path(icon_location) != expected_icon:
            issues.append("icon_location_mismatch")

    return ShortcutSnapshot(
        path=str(path),
        target_path=target_path,
        working_directory=working_directory,
        icon_location=icon_location,
        description=description,
        valid=not issues,
        issues=issues,
    )


def collect_shortcut_details(root: Path, expected_target: str | None) -> list[dict]:
    return [asdict(read_shortcut(Path(link), expected_target)) for link in list_links(root)]


def collect_snapshot() -> Snapshot:
    install_location = get_install_location()
    install_path = Path(install_location) if install_location else None
    user_data = Path(os.environ["LOCALAPPDATA"]) / "HorosaDesktop"
    expected_target = str(install_path / "Horosa.exe") if install_path else None
    desktop_root = get_shell_special_folder("Desktop", Path(os.environ["USERPROFILE"]) / "Desktop")
    start_menu_root = get_shell_special_folder(
        "Programs", Path(os.environ["APPDATA"]) / "Microsoft" / "Windows" / "Start Menu" / "Programs"
    )

    desktop_roots = unique_paths([desktop_root, Path(os.environ["USERPROFILE"]) / "Desktop"])
    start_menu_roots = unique_paths(
        [start_menu_root, Path(os.environ["APPDATA"]) / "Microsoft" / "Windows" / "Start Menu" / "Programs"]
    )

    desktop_shortcuts: list[dict] = []
    for root in desktop_roots:
        desktop_shortcuts.extend(collect_shortcut_details(root, expected_target))

    start_menu_shortcuts: list[dict] = []
    for root in start_menu_roots:
        start_menu_shortcuts.extend(collect_shortcut_details(root, expected_target))

    return Snapshot(
        install_location=install_location,
        display_version=get_display_version(),
        install_exists=bool(install_path and install_path.exists()),
        app_exe_exists=bool(install_path and (install_path / "Horosa.exe").exists()),
        uninstall_exe_exists=bool(install_path and (install_path / "Uninstall Horosa.exe").exists()),
        user_data_exists=user_data.exists(),
        user_data_items=sorted([item.name for item in user_data.iterdir()])[:20] if user_data.exists() else [],
        start_menu_root=str(start_menu_root),
        desktop_root=str(desktop_root),
        start_menu_links=sorted([item["path"] for item in start_menu_shortcuts]),
        desktop_links=sorted([item["path"] for item in desktop_shortcuts]),
        start_menu_shortcuts=start_menu_shortcuts,
        desktop_shortcuts=desktop_shortcuts,
    )


def uninstall_existing() -> None:
    quiet = get_quiet_uninstall()
    if not quiet:
        return
    subprocess.run(quiet, shell=True, check=False, timeout=240)
    deadline = time.time() + 120
    while time.time() < deadline:
        install_location = get_install_location()
        if not install_location:
            return
        if not Path(install_location).exists():
            return
        time.sleep(2)


def kill_running_app() -> None:
    subprocess.run(["taskkill", "/IM", "Horosa.exe", "/T", "/F"], check=False, capture_output=True)


def kill_running_installers() -> None:
    subprocess.run(["taskkill", "/IM", f"Horosa-Setup-{APP_VERSION}.exe", "/T", "/F"], check=False, capture_output=True)


def is_app_running() -> bool:
    result = subprocess.run(
        ["tasklist", "/FI", "IMAGENAME eq Horosa.exe"],
        check=False,
        capture_output=True,
        text=True,
    )
    return "Horosa.exe" in result.stdout


def find_setup_window(timeout: int = 60, process_id: int | None = None):
    deadline = time.time() + timeout
    while time.time() < deadline:
        for win in Desktop(backend="uia").windows():
            try:
                title = win.window_text()
                pid = win.process_id()
            except Exception:
                continue
            if process_id is not None and pid != process_id:
                continue
            if "Setup" in title and ("星阙" in title or "Horosa" in title):
                return win
        time.sleep(0.5)
    raise RuntimeError("未找到安装器窗口")


def try_find_setup_window(timeout: int = 3, process_id: int | None = None):
    try:
        return find_setup_window(timeout=timeout, process_id=process_id)
    except RuntimeError:
        return None


def find_message_window(text_fragment: str, process_id: int | None = None):
    for win in Desktop(backend="uia").windows():
        try:
            if process_id is not None and win.process_id() != process_id:
                continue
            if text_fragment in win.window_text():
                return win
            for child in win.descendants():
                if text_fragment in child.window_text():
                    return win
        except Exception:
            continue
    return None


def capture_window(win, name: str) -> str:
    path = SCREENSHOT_DIR / name
    win.capture_as_image().save(path)
    return str(path)


def texts_of(win) -> list[str]:
    texts: list[str] = []
    try:
        texts.append(win.window_text())
    except Exception:
        pass
    for control in win.descendants():
        try:
            text = control.window_text()
        except Exception:
            continue
        if text:
            texts.append(text)
    return texts


def controls_by_class(win, class_name: str):
    result = []
    for control in win.descendants():
        try:
            if control.friendly_class_name() == class_name:
                result.append(control)
        except Exception:
            pass
    return result


def click_button(win, patterns: list[str]) -> bool:
    for button in controls_by_class(win, "Button"):
        try:
            text = button.window_text()
            if any(pattern in text for pattern in patterns) and button.is_enabled():
                button.click_input()
                return True
        except Exception:
            continue
    return False


def select_radio(win, keyword: str) -> bool:
    for radio in controls_by_class(win, "RadioButton"):
        try:
            if keyword in radio.window_text():
                radio.click_input()
                return True
        except Exception:
            continue
    return False


def wait_installer_exit(proc: subprocess.Popen, timeout: int = 900) -> None:
    try:
        proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        proc.terminate()
        raise RuntimeError("安装器未在预期时间内退出") from exc


def launch_installed_app() -> bool:
    kill_running_app()
    install_location = get_install_location()
    if not install_location:
        return False
    exe = Path(install_location) / "Horosa.exe"
    if not exe.exists():
        return False
    subprocess.Popen([str(exe)])
    time.sleep(15)
    alive = is_app_running()
    kill_running_app()
    return alive


def launch_shortcut(shortcut_path: str | None) -> bool:
    if not shortcut_path:
        return False
    shortcut = Path(shortcut_path)
    if not shortcut.exists():
        return False
    kill_running_app()
    try:
        os.startfile(str(shortcut))
    except OSError:
        return False
    time.sleep(15)
    alive = is_app_running()
    kill_running_app()
    return alive


def first_valid_shortcut(shortcuts: list[dict]) -> str | None:
    for shortcut in shortcuts:
        if shortcut.get("valid"):
            return str(shortcut.get("path"))
    return None


def run_installer_flow(action: str, screenshot_name: str) -> dict:
    kill_running_installers()
    proc = subprocess.Popen([str(INSTALLER_EXE)])
    maintenance_screenshot = None
    confirm_screenshot = None
    finish_screenshot = None
    maintenance_seen = False
    deadline = time.time() + 900

    while time.time() < deadline:
        if proc.poll() is not None:
            break

        confirm = find_message_window("确定退出安装器并保留当前安装吗？", process_id=proc.pid)
        if confirm is not None:
            if confirm_screenshot is None:
                confirm_screenshot = capture_window(confirm, f"{screenshot_name}_confirm.png")
            click_button(confirm, ["Yes", "是", "Y"])
            time.sleep(1)
            continue

        win = try_find_setup_window(timeout=2, process_id=proc.pid)
        if win is None:
            time.sleep(1)
            continue
        texts = texts_of(win)

        if any("替换" in text for text in texts):
            maintenance_seen = True
            if maintenance_screenshot is None:
                maintenance_screenshot = capture_window(win, f"{screenshot_name}_maintenance.png")
            if action == "repair":
                select_radio(win, "修复")
            elif action == "cancel":
                select_radio(win, "取消")
            else:
                select_radio(win, "替换")
            if click_button(win, ["Install", "Next >", "安装"]):
                time.sleep(1.5)
                continue

        if any("Only for me" in text for text in texts):
            select_radio(win, "Only for me")
            if click_button(win, ["Next >", "Install"]):
                time.sleep(1.5)
                continue

        if click_button(win, ["Install", "安装"]):
            time.sleep(1.5)
            continue

        if click_button(win, ["Finish", "完成", "Close"]):
            finish_screenshot = capture_window(win, f"{screenshot_name}_finish.png")
            time.sleep(1)
            break

        time.sleep(1)

    wait_installer_exit(proc)
    kill_running_app()
    return {
        "maintenance_seen": maintenance_seen,
        "maintenance_screenshot": maintenance_screenshot,
        "confirm_screenshot": confirm_screenshot,
        "finish_screenshot": finish_screenshot,
    }


def snapshot_to_dict(snapshot: Snapshot) -> dict:
    return asdict(snapshot)


def write_reports(results: dict) -> None:
    ensure_dirs()
    JSON_REPORT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        f"# 星阙安装器真机回归记录（{datetime.now().strftime('%Y-%m-%d')}）",
        "",
        "- 机器：当前开发机 Windows",
        f"- 安装器：`{INSTALLER_EXE}`",
        "- 范围：首装基线、复跑修复、复跑替换、复跑取消",
        "",
        "## 结果摘要",
    ]

    for key in ("baseline_install", "rerun_repair", "rerun_replace", "rerun_cancel"):
        case = results[key]
        desktop_valid = sum(1 for item in case["after"]["desktop_shortcuts"] if item["valid"])
        desktop_total = len(case["after"]["desktop_shortcuts"])
        start_valid = sum(1 for item in case["after"]["start_menu_shortcuts"] if item["valid"])
        start_total = len(case["after"]["start_menu_shortcuts"])
        lines.append(
            f"- `{key}`：maintenance_seen={case['ui']['maintenance_seen']} app_launch_ok={case['app_launch_ok']} desktop_shortcut_launch_ok={case['desktop_shortcut_launch_ok']} start_menu_shortcut_launch_ok={case['start_menu_shortcut_launch_ok']} desktop_shortcuts_valid={desktop_valid}/{desktop_total} start_menu_shortcuts_valid={start_valid}/{start_total} install_exists={case['after']['install_exists']} user_data_exists={case['after']['user_data_exists']}"
        )

    lines.extend(
        [
            "",
            "## 证据",
            f"- JSON 报告：`{JSON_REPORT}`",
            f"- 截图目录：`{SCREENSHOT_DIR}`",
            f"- 基线前快照：`{results['baseline_install']['before']['install_location'] or '未安装'}`",
            "",
            "## 备注",
            "- 本机存在旧启动器痕迹时，首装基线仍可能展示维护页，这是当前机器状态导致的预期现象。",
        ]
    )

    MARKDOWN_REPORT.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    ensure_dirs()
    if not INSTALLER_EXE.exists():
        raise FileNotFoundError(f"未找到安装器：{INSTALLER_EXE}")

    results: dict = {
        "generated_at": datetime.now().isoformat(),
        "installer": str(INSTALLER_EXE),
        "initial_snapshot": snapshot_to_dict(collect_snapshot()),
    }

    kill_running_app()
    kill_running_installers()
    uninstall_existing()
    time.sleep(2)
    baseline_before = collect_snapshot()

    baseline_ui = run_installer_flow("replace", "baseline_install")
    time.sleep(8)
    baseline_after = collect_snapshot()
    results["baseline_install"] = {
        "ui": baseline_ui,
        "before": snapshot_to_dict(baseline_before),
        "after": snapshot_to_dict(baseline_after),
        "app_launch_ok": launch_installed_app(),
        "desktop_shortcut_launch_ok": launch_shortcut(first_valid_shortcut(baseline_after.desktop_shortcuts)),
        "start_menu_shortcut_launch_ok": launch_shortcut(first_valid_shortcut(baseline_after.start_menu_shortcuts)),
    }

    kill_running_app()
    before_repair = collect_snapshot()
    rerun_repair_ui = run_installer_flow("repair", "rerun_repair")
    time.sleep(8)
    repair_after = collect_snapshot()
    results["rerun_repair"] = {
        "ui": rerun_repair_ui,
        "before": snapshot_to_dict(before_repair),
        "after": snapshot_to_dict(repair_after),
        "app_launch_ok": launch_installed_app(),
        "desktop_shortcut_launch_ok": launch_shortcut(first_valid_shortcut(repair_after.desktop_shortcuts)),
        "start_menu_shortcut_launch_ok": launch_shortcut(first_valid_shortcut(repair_after.start_menu_shortcuts)),
    }

    kill_running_app()
    before_replace = collect_snapshot()
    rerun_replace_ui = run_installer_flow("replace", "rerun_replace")
    time.sleep(8)
    replace_after = collect_snapshot()
    results["rerun_replace"] = {
        "ui": rerun_replace_ui,
        "before": snapshot_to_dict(before_replace),
        "after": snapshot_to_dict(replace_after),
        "app_launch_ok": launch_installed_app(),
        "desktop_shortcut_launch_ok": launch_shortcut(first_valid_shortcut(replace_after.desktop_shortcuts)),
        "start_menu_shortcut_launch_ok": launch_shortcut(first_valid_shortcut(replace_after.start_menu_shortcuts)),
    }

    kill_running_app()
    before_cancel = collect_snapshot()
    rerun_cancel_ui = run_installer_flow("cancel", "rerun_cancel")
    time.sleep(3)
    cancel_after = collect_snapshot()
    results["rerun_cancel"] = {
        "ui": rerun_cancel_ui,
        "before": snapshot_to_dict(before_cancel),
        "after": snapshot_to_dict(cancel_after),
        "app_launch_ok": launch_installed_app(),
        "desktop_shortcut_launch_ok": launch_shortcut(first_valid_shortcut(cancel_after.desktop_shortcuts)),
        "start_menu_shortcut_launch_ok": launch_shortcut(first_valid_shortcut(cancel_after.start_menu_shortcuts)),
    }

    write_reports(results)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:
        traceback.print_exc()
        raise
