#!/usr/bin/env python3
"""Run Horosa.exe with isolated user/temp dirs and measure cold/warm runtime startup."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path


FORBIDDEN_LOG_PATTERNS = [
    "Python chart service exited unexpectedly",
    "Java backend exited unexpectedly",
    "Runtime bootstrap failed",
    "Renderer process gone",
    "EPIPE",
    "ERR_FILE_NOT_FOUND",
    "fetch failed",
    "ECONN",
    "Connection refused",
    "ImportError",
    "No module named",
    "jvm.dll not loaded",
    "failed to load",
    "TypeError: must be real number, not list",
    r"missing params\.birth",
    r"no\.register\.app\.in\.sys\.forapp",
]


def configure_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="replace")


def ready_lines(log_path: Path) -> list[str]:
    if not log_path.exists():
        return []
    return [
        line
        for line in log_path.read_text(encoding="utf-8", errors="replace").splitlines()
        if "Local runtime ready" in line
    ]


def parse_ready_line(line: str) -> dict:
    marker = "Local runtime ready "
    marker_index = line.find(marker)
    if marker_index < 0:
        raise ValueError(f"ready marker missing: {line[:160]}")
    return json.loads(line[marker_index + len(marker) :])


def port_listening(port: int) -> bool:
    result = subprocess.run(
        ["netstat", "-ano", "-p", "tcp"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    needle = f":{port}"
    return any(needle in line and "LISTENING" in line.upper() for line in result.stdout.splitlines())


def wait_port_free(port: int, timeout: float = 20.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if not port_listening(port):
            return True
        time.sleep(0.5)
    return not port_listening(port)


def kill_tree(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    subprocess.run(
        ["taskkill.exe", "/PID", str(proc.pid), "/T", "/F"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        pass
    time.sleep(2)


def run_once(exe_path: Path, env: dict[str, str], log_path: Path, label: str, debug_port: int, timeout: float) -> dict:
    wait_port_free(debug_port)
    wait_port_free(8899)
    wait_port_free(9999)
    before_count = len(ready_lines(log_path))
    proc = subprocess.Popen(
        [str(exe_path), f"--remote-debugging-port={debug_port}"],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    ready_line = None
    deadline = time.time() + timeout
    while time.time() < deadline:
        lines = ready_lines(log_path)
        if len(lines) > before_count:
            ready_line = lines[-1]
            break
        if proc.poll() is not None:
            break
        time.sleep(1)
    if ready_line is None:
        kill_tree(proc)
        raise RuntimeError(f"{label} launch did not reach Local runtime ready")

    ready = parse_ready_line(ready_line)
    resource_prep = ready.get("resourcePreparation") or {}
    readiness = ready.get("readinessChecks") or {}
    backend_heartbeat = readiness.get("backendHeartbeat") or {}
    chart_probe = readiness.get("chartProbe") or {}
    result = {
        "label": label,
        "startupDurationMs": int(ready.get("startupDurationMs") or 0),
        "mode": resource_prep.get("mode"),
        "extractionDurationMs": resource_prep.get("extractionDurationMs"),
        "payloadBytes": resource_prep.get("payloadBytes"),
        "trustedRuntime": bool(ready.get("trustedRuntime")),
        "backendReady": bool(backend_heartbeat.get("ok")),
        "backendAcceptedPortProbe": bool(backend_heartbeat.get("acceptedPortProbe")),
        "chartReady": bool(chart_probe.get("ok")),
        "chartBirth": chart_probe.get("birth"),
        "resourceRoot": ready.get("resourceRoot"),
    }
    kill_tree(proc)
    wait_port_free(8899)
    wait_port_free(9999)
    return result


def scan_forbidden_logs(log_root: Path) -> list[dict]:
    matches: list[dict] = []
    if not log_root.exists():
        return matches
    compiled = [(pattern, re.compile(pattern)) for pattern in FORBIDDEN_LOG_PATTERNS]
    for path_value in log_root.rglob("*"):
        if not path_value.is_file() or path_value.suffix.lower() not in {".log", ".txt"}:
            continue
        lines = path_value.read_text(encoding="utf-8", errors="replace").splitlines()
        for index, line in enumerate(lines, start=1):
            for label, pattern in compiled:
                if pattern.search(line):
                    matches.append({
                        "path": str(path_value),
                        "lineNumber": index,
                        "pattern": label,
                        "line": line,
                    })
    return matches


def main() -> int:
    configure_stdio()
    parser = argparse.ArgumentParser()
    parser.add_argument("--exe-path", required=True)
    parser.add_argument("--json-out", required=True)
    parser.add_argument("--debug-port", type=int, default=9464)
    parser.add_argument("--timeout", type=float, default=180.0)
    parser.add_argument("--keep-root", action="store_true")
    args = parser.parse_args()

    exe_path = Path(args.exe_path).resolve()
    if not exe_path.exists():
        raise FileNotFoundError(exe_path)

    isolated_root = Path(tempfile.mkdtemp(prefix="HorosaCleanMachineFinal-"))
    local_appdata = isolated_root / "LocalAppData"
    roaming_appdata = isolated_root / "RoamingAppData"
    temp_root = isolated_root / "Temp"
    local_appdata.mkdir(parents=True, exist_ok=True)
    roaming_appdata.mkdir(parents=True, exist_ok=True)
    temp_root.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    env.update({
        "LOCALAPPDATA": str(local_appdata),
        "APPDATA": str(roaming_appdata),
        "TEMP": str(temp_root),
        "TMP": str(temp_root),
    })

    log_root = local_appdata / "HorosaDesktop" / "logs"
    log_path = log_root / "horosa-desktop.log"
    cold = run_once(exe_path, env, log_path, "cold", args.debug_port, args.timeout)
    warm = run_once(exe_path, env, log_path, "warm", args.debug_port, args.timeout)
    warm["under10s"] = warm["startupDurationMs"] < 10_000

    ports_after_stop = [
        {"port": port, "listening": port_listening(port)}
        for port in (8899, 9999, args.debug_port)
    ]
    output = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "exe": str(exe_path),
        "isolatedRoot": str(isolated_root),
        "cold": cold,
        "warm": warm,
        "forbiddenLogMatches": scan_forbidden_logs(log_root),
        "portsAfterStop": ports_after_stop,
    }

    out_path = Path(args.json_out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(output, ensure_ascii=False, indent=2))
    if output["forbiddenLogMatches"] or not warm["under10s"] or any(item["listening"] for item in ports_after_stop):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
