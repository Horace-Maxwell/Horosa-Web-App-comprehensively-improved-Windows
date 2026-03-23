#!/usr/bin/env python3
"""Maintainer self-check entrypoint for the local Horosa workspace."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen


def configure_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


configure_stdio()


REPO_ROOT = Path(__file__).resolve().parent
WORKSPACE_ROOT = REPO_ROOT / "local" / "workspace"


def find_project_root(explicit: str | None) -> Path:
    if explicit:
        path_value = Path(explicit).resolve()
        if (path_value / "astrostudyui").exists():
            return path_value
        raise FileNotFoundError(f"invalid --project-root: {explicit}")
    candidates = sorted(WORKSPACE_ROOT.glob("Horosa-Web*"))
    for candidate in candidates:
        if (candidate / "astrostudyui").exists() and (candidate / "scripts").exists():
            return candidate
    raise FileNotFoundError("cannot locate Horosa project under local/workspace")


def ensure_dir(path_value: Path) -> None:
    path_value.mkdir(parents=True, exist_ok=True)


def resolve_command(command: list[str]) -> list[str]:
    if not command:
        return command
    head = command[0]
    if os.path.isabs(head) and Path(head).exists():
        return command
    resolved = shutil.which(head)
    if not resolved and os.name == "nt" and "." not in Path(head).name:
        for suffix in (".cmd", ".exe", ".bat"):
            resolved = shutil.which(f"{head}{suffix}")
            if resolved:
                break
    if not resolved:
        return command
    return [resolved, *command[1:]]


def run_command(command: list[str], cwd: Path, env: dict[str, str] | None = None) -> dict:
    started = time.time()
    resolved_command = resolve_command(command)
    process = subprocess.run(
        resolved_command,
        cwd=str(cwd),
        env=env,
        text=True,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    return {
        "command": resolved_command,
        "cwd": str(cwd),
        "returncode": process.returncode,
        "stdout": process.stdout,
        "stderr": process.stderr,
        "elapsedSeconds": round(time.time() - started, 2),
    }


def start_local_stack() -> subprocess.Popen[str]:
    creationflags = 0
    if os.name == "nt":
        creationflags = getattr(subprocess, "CREATE_NEW_CONSOLE", 0)
    return subprocess.Popen(
        ["cmd", "/c", "START_HERE.bat"],
        cwd=str(REPO_ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=creationflags,
        text=True,
    )


def wait_for_url(url: str, timeout_seconds: int = 120) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=5) as response:
                if 200 <= int(getattr(response, "status", 0)) < 500:
                    return True
        except Exception:
            time.sleep(2)
    return False


def read_json_if_exists(path_value: Path) -> dict | list | None:
    if not path_value.exists():
        return None
    return json.loads(path_value.read_text(encoding="utf-8"))


def find_pids_for_port(port: int) -> list[int]:
    result = subprocess.run(
        ["netstat", "-ano", "-p", "tcp"],
        text=True,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    marker = f":{port}"
    pids: set[int] = set()
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


def free_ports(ports: list[int]) -> dict[int, list[int]]:
    killed: dict[int, list[int]] = {}
    for port in ports:
        killed_pids: list[int] = []
        for pid in find_pids_for_port(port):
            if pid <= 0:
                continue
            subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True, check=False)
            killed_pids.append(pid)
        killed[port] = killed_pids
    return killed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", default=os.environ.get("HOROSA_PROJECT_DIR", ""))
    parser.add_argument("--case-file", default="")
    parser.add_argument("--skip-start", action="store_true")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000/index.html?srv=http%3A%2F%2F127.0.0.1%3A9999")
    parser.add_argument("--installed-app", action="store_true")
    args = parser.parse_args()

    project_root = find_project_root(args.project_root or None)
    case_file = Path(args.case_file).resolve() if args.case_file else (project_root / "scripts" / "self_check_cases.default.json")
    report_root = project_root / "runtime" / "self-check" / time.strftime("%Y%m%d_%H%M%S")
    ensure_dir(report_root)

    rule_json = report_root / "rule-check.json"
    rule_md = report_root / "rule-check.md"
    ui_json = report_root / "ui-check.json"
    ui_md = report_root / "ui-check.md"
    installed_json = report_root / "installed-desktop-check.json"
    installed_md = report_root / "installed-desktop-check.md"
    aggregate_json = report_root / "self-check-summary.json"
    aggregate_md = report_root / "self-check-summary.md"

    summary = {
        "projectRoot": str(project_root),
        "caseFile": str(case_file),
        "baseUrl": args.base_url,
        "reportRoot": str(report_root),
        "steps": [],
        "overallStatus": "FAIL",
    }

    env = os.environ.copy()
    env["HOROSA_SELF_CHECK_CASE_FILE"] = str(case_file)
    env["HOROSA_SELF_CHECK_RULE_JSON"] = str(rule_json)
    env["HOROSA_SELF_CHECK_RULE_MD"] = str(rule_md)

    rule_step = run_command(
        ["npm", "test", "--", "--runInBand", "src/components/liureng/__tests__/LRRuleSelfCheck.runner.test.js"],
        project_root / "astrostudyui",
        env,
    )
    summary["steps"].append({"name": "rule-check", **rule_step})

    build_step = run_command(
        ["npm", "run", "build:file"],
        project_root / "astrostudyui",
        os.environ.copy(),
    )
    summary["steps"].append({"name": "build-file", **build_step})

    launcher_process = None
    start_ok = wait_for_url("http://127.0.0.1:8000/index.html", timeout_seconds=3)
    start_mode = "reused-running-stack" if start_ok else "started-by-self-check"
    if not args.skip_start:
        if not start_ok:
            launcher_process = start_local_stack()
            start_ok = wait_for_url("http://127.0.0.1:8000/index.html", timeout_seconds=150)
    summary["steps"].append({
        "name": "start-local-stack",
        "returncode": 0 if start_ok else 1,
        "stdout": "",
        "stderr": "" if start_ok else "local web entry did not become ready in time",
        "pid": launcher_process.pid if launcher_process else None,
        "mode": start_mode,
    })

    ui_env = os.environ.copy()
    ui_env["HOROSA_SELF_CHECK_CASE_FILE"] = str(case_file)
    ui_env["HOROSA_SELF_CHECK_UI_JSON"] = str(ui_json)
    ui_env["HOROSA_SELF_CHECK_UI_MD"] = str(ui_md)
    ui_step = run_command(
        [
            sys.executable,
            str(project_root / "scripts" / "browser_horosa_targeted_self_check.py"),
            "--base-url",
            args.base_url,
            "--case-file",
            str(case_file),
            "--json-out",
            str(ui_json),
            "--md-out",
            str(ui_md),
        ],
        project_root,
        ui_env,
    )
    summary["steps"].append({"name": "ui-check", **ui_step})

    if args.installed_app:
        freed_ports = free_ports([8000, 9999])
        summary["steps"].append({
            "name": "free-source-stack-ports",
            "returncode": 0,
            "stdout": json.dumps(freed_ports, ensure_ascii=False),
            "stderr": "",
        })
        installed_step = run_command(
            [
                sys.executable,
                str(REPO_ROOT / "desktop_installer_bundle" / "scripts" / "installed_desktop_smoke_check.py"),
                "--project-root",
                str(project_root),
                "--case-file",
                str(case_file),
                "--json-out",
                str(installed_json),
                "--md-out",
                str(installed_md),
            ],
            REPO_ROOT,
            os.environ.copy(),
        )
        summary["steps"].append({"name": "installed-desktop-check", **installed_step})

    rule_report = read_json_if_exists(rule_json)
    ui_report = read_json_if_exists(ui_json)
    installed_report = read_json_if_exists(installed_json) if args.installed_app else None
    summary["ruleReport"] = rule_report
    summary["uiReport"] = ui_report
    summary["installedDesktopReport"] = installed_report
    summary["overallStatus"] = "PASS" if all(step.get("returncode") == 0 for step in summary["steps"]) else "FAIL"

    aggregate_json.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# Horosa Self Check Summary",
        "",
        f"Overall: {summary['overallStatus']}",
        f"Project: {project_root}",
        f"Case file: {case_file}",
        f"Report dir: {report_root}",
        "",
        "## Steps",
    ]
    for step in summary["steps"]:
        lines.append(f"- {step['name']}: {'PASS' if step.get('returncode') == 0 else 'FAIL'}")
    lines.extend([
        "",
        "## Reports",
        f"- Rule JSON: {rule_json}",
        f"- Rule Markdown: {rule_md}",
        f"- UI JSON: {ui_json}",
        f"- UI Markdown: {ui_md}",
    "",
    ])
    if args.installed_app:
        lines.extend([
            f"- Installed JSON: {installed_json}",
            f"- Installed Markdown: {installed_md}",
            "",
        ])
    aggregate_md.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(json.dumps({
        "overallStatus": summary["overallStatus"],
        "reportRoot": str(report_root),
        "ruleJson": str(rule_json),
        "uiJson": str(ui_json),
        "installedJson": str(installed_json) if args.installed_app else "",
        "summaryJson": str(aggregate_json),
    }, ensure_ascii=False, indent=2))

    if summary["overallStatus"] != "PASS":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
