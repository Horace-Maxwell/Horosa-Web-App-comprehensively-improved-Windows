#!/usr/bin/env python3
"""Smoke-check the installed Horosa desktop app on this machine."""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import subprocess
import sys
import time
import urllib.request
from dataclasses import asdict
from pathlib import Path

from playwright.sync_api import sync_playwright
from pywinauto import Desktop

SCRIPT_DIR = Path(__file__).resolve().parent
DESKTOP_ROOT = SCRIPT_DIR.parent
REPO_ROOT = DESKTOP_ROOT.parent
DEFAULT_EXE = Path(os.environ["LOCALAPPDATA"]) / "Programs" / "Horosa" / "Horosa.exe"
DEFAULT_LOG_ROOT = Path(os.environ["LOCALAPPDATA"]) / "HorosaDesktop" / "logs"
FORBIDDEN_DESKTOP_LOG_PATTERNS = [
    "latest.yml",
    "param error",
    "Runtime error",
    "Python chart service exited unexpectedly",
]
FORBIDDEN_PYTHON_LOG_PATTERNS = [
    "TypeError: must be real number, not list",
]

sys.path.insert(0, str(SCRIPT_DIR))
from run_installer_regression import collect_snapshot, first_valid_shortcut, is_app_running, kill_running_app  # noqa: E402


def configure_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


configure_stdio()


def ensure_parent(path_value: Path) -> None:
    path_value.parent.mkdir(parents=True, exist_ok=True)


def read_case_payload(case_file: Path) -> list[dict]:
    payload = json.loads(case_file.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("cases"), list):
        return payload["cases"]
    return []


def load_module(module_path: Path, module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module from {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def get_project_root(explicit: str | None) -> Path:
    if explicit:
        path_value = Path(explicit).resolve()
        if (path_value / "astrostudyui").exists():
            return path_value
        raise FileNotFoundError(f"invalid --project-root: {explicit}")
    workspace_root = REPO_ROOT / "local" / "workspace"
    for candidate in sorted(workspace_root.glob("Horosa-Web*")):
        if (candidate / "astrostudyui").exists() and (candidate / "scripts").exists():
            return candidate
    raise FileNotFoundError("cannot locate Horosa project under local/workspace")


def normalize_text(text: str) -> str:
    return " ".join((text or "").split())


def snapshot_log_offsets(paths: list[Path]) -> dict[str, int]:
    offsets: dict[str, int] = {}
    for path_value in paths:
        try:
            offsets[str(path_value)] = path_value.stat().st_size
        except OSError:
            offsets[str(path_value)] = 0
    return offsets


def read_log_delta(path_value: Path, offsets: dict[str, int]) -> str:
    start = offsets.get(str(path_value), 0)
    if not path_value.exists():
        return ""
    data = path_value.read_text(encoding="utf-8", errors="replace")
    if start <= 0:
        return data
    return data[start:]


def find_pids_for_port(port: int) -> list[int]:
    result = subprocess.run(
        ["netstat", "-ano", "-p", "tcp"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    pids: set[int] = set()
    marker = f":{port}"
    for line in result.stdout.splitlines():
        text = line.strip()
        if marker not in text:
            continue
        parts = text.split()
        if len(parts) < 5:
            continue
        local_addr = parts[1]
        state = parts[3] if len(parts) > 4 else ""
        pid_text = parts[-1]
        if not local_addr.endswith(marker):
            continue
        if state.upper() not in {"LISTENING", "ESTABLISHED", "TIME_WAIT", "CLOSE_WAIT"}:
            continue
        if pid_text.isdigit():
            pids.add(int(pid_text))
    return sorted(pids)


def free_port(port: int, protected_pids: set[int] | None = None) -> list[int]:
    protected = protected_pids or set()
    killed: list[int] = []
    for pid in find_pids_for_port(port):
        if pid in protected or pid <= 0:
            continue
        subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True, check=False)
        killed.append(pid)
    return killed


def wait_for_http_ok(url: str, timeout_seconds: int = 120) -> dict:
    deadline = time.time() + timeout_seconds
    last_error = ""
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                body = response.read().decode("utf-8", errors="replace")
                return {
                    "ok": 200 <= int(getattr(response, "status", 0)) < 300,
                    "status": int(getattr(response, "status", 0)),
                    "bodyExcerpt": normalize_text(body)[:240],
                    "url": url,
                }
        except Exception as exc:
            last_error = str(exc)
            time.sleep(2)
    return {
        "ok": False,
        "status": 0,
        "error": last_error or "timeout",
        "url": url,
    }


def wait_for_debug_port(port: int, timeout_seconds: int = 60) -> str:
    url = f"http://127.0.0.1:{port}/json/version"
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                data = json.loads(response.read().decode("utf-8", errors="replace"))
                return str(data.get("webSocketDebuggerUrl") or "")
        except Exception:
            time.sleep(1)
    raise RuntimeError(f"remote debugging port {port} did not become ready")


def wait_for_process_exit(timeout_seconds: int = 60) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        if not is_app_running():
            return True
        time.sleep(1)
    return False


def count_horosa_processes() -> int:
    result = subprocess.run(
        ["tasklist", "/FI", "IMAGENAME eq Horosa.exe"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    return sum(1 for line in result.stdout.splitlines() if line.strip().startswith("Horosa.exe"))


def close_app_window(process_id: int | None = None) -> bool:
    deadline = time.time() + 30
    while time.time() < deadline:
        for window in Desktop(backend="uia").windows():
            try:
                title = window.window_text()
                pid = window.process_id()
            except Exception:
                continue
            if process_id is not None and pid != process_id:
                continue
            if "星阙" not in title:
                continue
            try:
                window.close()
                return True
            except Exception:
                continue
        time.sleep(1)
    return False


def launch_shortcut(shortcut_path: str) -> bool:
    try:
        os.startfile(shortcut_path)
    except OSError:
        return False
    deadline = time.time() + 30
    while time.time() < deadline:
        if is_app_running():
            return True
        time.sleep(1)
    return False


def run_ui_cases(page, browser_module, case_payload: list[dict]) -> list[dict]:
    cases = [case for case in case_payload if f"{case.get('type', '')}".strip() == "ui-like-case"]
    results: list[dict] = []
    for case in cases:
        module = f"{case.get('input', {}).get('module', '')}".strip()
        checker = browser_module.MODULE_CHECKS.get(module)
        item = {
            "label": case.get("label", module or "unnamed-installed-ui-case"),
            "module": module,
            "status": "FAIL",
            "pass": False,
        }
        if not checker:
            item["error"] = f"unsupported module: {module}"
            results.append(item)
            continue
        try:
            output = checker(page)
            item["status"] = "PASS"
            item["pass"] = True
            item["output"] = output
        except Exception as exc:
            item["error"] = str(exc)
        results.append(item)
    return results


def build_markdown(summary: dict) -> str:
    lines = [
        "# Horosa Installed Desktop Smoke Check",
        "",
        f"Overall: {summary['overallStatus']}",
        f"Installed exe: {summary['exePath']}",
        "",
        "## Shortcut Checks",
        f"- Desktop valid: {summary['shortcutChecks']['desktopValid']}",
        f"- Start menu valid: {summary['shortcutChecks']['startMenuValid']}",
        "",
        "## Runtime Checks",
        f"- Runtime shell ready: {summary['runtimeChecks']['shellReady']}",
        f"- Allowed charts OK: {summary['runtimeChecks']['allowedCharts'].get('ok', False)}",
        f"- Graceful close OK: {summary['runtimeChecks']['gracefulClose']}",
        f"- Shortcut relaunch OK: {summary['runtimeChecks']['desktopShortcutRelaunch']}",
        f"- Single instance OK: {summary['runtimeChecks']['singleInstance']}",
        "",
        "## UI Cases",
    ]
    for case in summary["uiCases"]:
        lines.append(f"- {case['label']}: {case['status']}")
    lines.extend([
        "",
        "## Log Checks",
        f"- Desktop forbidden patterns: {summary['logChecks']['desktopForbiddenMatches'] or 'none'}",
        f"- Python forbidden patterns: {summary['logChecks']['pythonForbiddenMatches'] or 'none'}",
        "",
    ])
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", default=os.environ.get("HOROSA_PROJECT_DIR", ""))
    parser.add_argument("--case-file", default=os.environ.get("HOROSA_SELF_CHECK_CASE_FILE", ""))
    parser.add_argument("--exe-path", default="")
    parser.add_argument("--json-out", required=True)
    parser.add_argument("--md-out", required=True)
    parser.add_argument("--remote-debugging-port", type=int, default=9335)
    args = parser.parse_args()

    project_root = get_project_root(args.project_root or None)
    browser_module = load_module(project_root / "scripts" / "browser_horosa_targeted_self_check.py", "browser_horosa_targeted_self_check")
    case_file = Path(args.case_file).resolve() if args.case_file else (project_root / "scripts" / "self_check_cases.default.json")
    case_payload = read_case_payload(case_file)

    ensure_parent(Path(args.json_out))
    ensure_parent(Path(args.md_out))

    snapshot = collect_snapshot()
    exe_path = Path(args.exe_path).resolve() if args.exe_path else DEFAULT_EXE
    if snapshot.install_location:
        candidate = Path(snapshot.install_location) / "Horosa.exe"
        if candidate.exists():
            exe_path = candidate
    if not exe_path.exists():
        raise FileNotFoundError(f"installed Horosa.exe not found: {exe_path}")

    desktop_shortcut = first_valid_shortcut(snapshot.desktop_shortcuts)
    start_shortcut = first_valid_shortcut(snapshot.start_menu_shortcuts)
    log_paths = {
        "desktopLog": DEFAULT_LOG_ROOT / "horosa-desktop.log",
        "pythonLog": DEFAULT_LOG_ROOT / "runtime" / "python.log",
    }
    log_offsets = snapshot_log_offsets(list(log_paths.values()))

    kill_running_app()
    free_port(args.remote_debugging_port)
    app_proc = subprocess.Popen([str(exe_path), f"--remote-debugging-port={args.remote_debugging_port}"])

    console_errors: list[str] = []
    page_errors: list[str] = []
    ui_case_results: list[dict] = []
    bootstrap_config: dict = {}
    shell_ready = False
    shell_ready_output: dict = {}
    allowedcharts_result: dict = {"ok": False, "status": 0, "error": "not-run"}
    graceful_close = False
    desktop_shortcut_ok = False
    start_shortcut_ok = False
    single_instance_ok = False
    close_attempted = False

    try:
        wait_for_debug_port(args.remote_debugging_port)
        with sync_playwright() as p:
            browser = p.chromium.connect_over_cdp(f"http://127.0.0.1:{args.remote_debugging_port}")
            page = None
            deadline = time.time() + 90
            while time.time() < deadline:
                for context in browser.contexts:
                    if context.pages:
                        page = context.pages[0]
                        break
                if page is not None:
                    break
                time.sleep(1)
            if page is None:
                raise RuntimeError("unable to find desktop app page via CDP")

            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            page.on("pageerror", lambda exc: page_errors.append(str(exc)))

            bootstrap_config = page.evaluate("window.__HOROSA_DESKTOP_CONFIG__ || {}") or {}
            shell_ready_output = browser_module.wait_for_main_shell(page, timeout_ms=120_000)
            shell_ready = True

            bootstrap_config = page.evaluate("window.__HOROSA_DESKTOP_CONFIG__ || {}") or bootstrap_config
            server_root = str(bootstrap_config.get("serverRoot") or "http://127.0.0.1:9999").rstrip("/")
            allowedcharts_result = wait_for_http_ok(f"{server_root}/allowedcharts", timeout_seconds=60)
            if not allowedcharts_result.get("ok"):
                raise AssertionError(f"allowedcharts failed: {allowedcharts_result}")

            ui_case_results = run_ui_cases(page, browser_module, case_payload)

            close_attempted = close_app_window(app_proc.pid)
            graceful_close = close_attempted and wait_for_process_exit(60)
            browser.close()

        if not graceful_close:
            kill_running_app()

        if desktop_shortcut:
            desktop_shortcut_ok = launch_shortcut(desktop_shortcut)
            if desktop_shortcut_ok:
                time.sleep(5)
                if desktop_shortcut:
                    launch_shortcut(desktop_shortcut)
                    time.sleep(5)
                    single_instance_ok = count_horosa_processes() == 1
                close_app_window()
                wait_for_process_exit(45)

        if start_shortcut:
            start_shortcut_ok = launch_shortcut(start_shortcut)
            if start_shortcut_ok:
                close_app_window()
                wait_for_process_exit(45)
    finally:
        kill_running_app()
        subprocess.run(["taskkill", "/PID", str(app_proc.pid), "/T", "/F"], capture_output=True, check=False)

    desktop_delta = read_log_delta(log_paths["desktopLog"], log_offsets)
    python_delta = read_log_delta(log_paths["pythonLog"], log_offsets)
    desktop_forbidden = [pattern for pattern in FORBIDDEN_DESKTOP_LOG_PATTERNS if pattern in desktop_delta]
    python_forbidden = [pattern for pattern in FORBIDDEN_PYTHON_LOG_PATTERNS if pattern in python_delta]

    summary = {
        "type": "installed-desktop-check",
        "generatedAt": int(time.time()),
        "projectRoot": str(project_root),
        "caseFile": str(case_file),
        "exePath": str(exe_path),
        "bootstrapConfig": bootstrap_config,
        "shortcutChecks": {
            "desktopValid": bool(desktop_shortcut),
            "desktopShortcutPath": desktop_shortcut or "",
            "startMenuValid": bool(start_shortcut),
            "startMenuShortcutPath": start_shortcut or "",
            "snapshot": asdict(snapshot),
        },
        "runtimeChecks": {
            "shellReady": shell_ready,
            "shellReadyOutput": shell_ready_output,
            "allowedCharts": allowedcharts_result,
            "gracefulClose": graceful_close,
            "closeAttempted": close_attempted,
            "desktopShortcutRelaunch": desktop_shortcut_ok,
            "startShortcutLaunch": start_shortcut_ok,
            "singleInstance": single_instance_ok,
        },
        "uiCases": ui_case_results,
        "pageErrors": page_errors,
        "consoleErrors": console_errors,
        "logChecks": {
            "desktopLogPath": str(log_paths["desktopLog"]),
            "pythonLogPath": str(log_paths["pythonLog"]),
            "desktopForbiddenMatches": desktop_forbidden,
            "pythonForbiddenMatches": python_forbidden,
            "desktopLogExcerpt": normalize_text(desktop_delta)[-500:],
            "pythonLogExcerpt": normalize_text(python_delta)[-500:],
        },
    }

    ui_pass = all(item.get("pass") for item in ui_case_results)
    shortcut_pass = bool(desktop_shortcut) and bool(start_shortcut)
    runtime_pass = (
        shell_ready
        and allowedcharts_result.get("ok")
        and graceful_close
        and desktop_shortcut_ok
        and start_shortcut_ok
        and single_instance_ok
    )
    log_pass = not desktop_forbidden and not python_forbidden and not console_errors and not page_errors
    summary["overallStatus"] = "PASS" if ui_pass and shortcut_pass and runtime_pass and log_pass else "FAIL"

    Path(args.json_out).write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    Path(args.md_out).write_text(build_markdown(summary), encoding="utf-8")

    if summary["overallStatus"] != "PASS":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
