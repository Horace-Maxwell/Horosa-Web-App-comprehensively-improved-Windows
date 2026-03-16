from __future__ import annotations

import ctypes
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path


DISPLAY_NAME = "星阙"


def show_error(message: str) -> None:
    try:
        ctypes.windll.user32.MessageBoxW(0, message, DISPLAY_NAME, 0x10)
    except Exception:
        pass


def resolve_user_root() -> Path:
    candidates: list[Path] = []
    configured = (os.environ.get("HOROSA_DESKTOP_USER_ROOT") or "").strip()
    if configured:
        candidates.append(Path(configured))

    local_app_data = (os.environ.get("LocalAppData") or "").strip()
    if local_app_data:
        candidates.append(Path(local_app_data) / "HorosaDesktop")

    user_profile = (os.environ.get("UserProfile") or "").strip()
    if user_profile:
        candidates.append(Path(user_profile) / "AppData" / "Local" / "HorosaDesktop")

    try:
        candidates.append(Path.home() / "AppData" / "Local" / "HorosaDesktop")
    except Exception:
        pass

    candidates.append(Path(tempfile.gettempdir()) / "HorosaDesktop")
    candidates.append(Path.cwd() / ".horosa-desktop")

    for candidate in candidates:
        try:
            candidate.mkdir(parents=True, exist_ok=True)
            return candidate
        except Exception:
            continue

    raise RuntimeError("Unable to resolve writable Horosa user data directory")


def log_line(user_root: Path, message: str) -> None:
    try:
        log_dir = user_root / "runtime-logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        log_path = log_dir / "desktop-launcher.log"
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {message}\n")
    except Exception:
        pass


def package_root() -> Path:
    if getattr(sys, "frozen", False):
        exe_dir = Path(sys.executable).resolve().parent
        if (exe_dir / "version.json").exists():
            return exe_dir
    return Path(__file__).resolve().parents[1]


def repo_root(bundle_root: Path) -> Path:
    return bundle_root.parent


def resolve_powershell() -> str:
    candidates = [
        Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "PowerShell" / "7" / "pwsh.exe",
        Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe",
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return "powershell.exe"


def read_target_version(bundle_root: Path) -> str | None:
    version_file = bundle_root / "version.json"
    if not version_file.exists():
        return None
    try:
        payload = json.loads(version_file.read_text(encoding="utf-8-sig"))
        version = str(payload.get("version", "")).strip()
        return version or None
    except Exception:
        return None


def is_runtime_state_ready(deps_root: Path, target_version: str | None) -> bool:
    state_file = deps_root / "install_state.json"
    if not deps_root.exists() or not state_file.exists():
        return False
    try:
        payload = json.loads(state_file.read_text(encoding="utf-8-sig"))
    except Exception:
        return False

    installed_version = str(payload.get("version", "")).strip()
    runtime_version = str(payload.get("runtimeVersion", "")).strip()
    if not installed_version or not runtime_version:
        return False
    if target_version and (installed_version != target_version or runtime_version != target_version):
        return False
    return True


def main() -> int:
    bundle_root = package_root()
    root = repo_root(bundle_root)
    pythonw_exe = root / "local" / "workspace" / "runtime" / "windows" / "python" / "pythonw.exe"
    launcher_script = bundle_root / "src" / "horosa_desktop.pyw"
    install_script = bundle_root / "install_desktop_runtime.ps1"
    user_root = resolve_user_root()
    deps_root = user_root / "runtime-pydeps"
    pwsh = resolve_powershell()
    target_version = read_target_version(bundle_root)
    log_line(user_root, f"launcher start: bundle_root={bundle_root}")

    if not launcher_script.exists():
        log_line(user_root, f"launcher script missing: {launcher_script}")
        show_error(f"未找到桌面启动脚本：\n{launcher_script}")
        return 1

    if not install_script.exists():
        log_line(user_root, f"install script missing: {install_script}")
        show_error(f"未找到桌面运行环境安装脚本：\n{install_script}")
        return 1

    runtime_ready = pythonw_exe.exists() and is_runtime_state_ready(deps_root, target_version)
    if not runtime_ready:
        try:
            install_env = os.environ.copy()
            install_env["HOROSA_DESKTOP_USER_ROOT"] = str(user_root)
            install_result = subprocess.run(
                [pwsh, "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", str(install_script)],
                check=False,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=0x08000000 if os.name == "nt" else 0,
                env=install_env,
                timeout=20 * 60,
            )
            log_line(user_root, f"runtime install exit: {install_result.returncode}")
        except subprocess.TimeoutExpired:
            log_line(user_root, "runtime install timed out after 20 minutes")
            show_error("桌面运行环境准备超时。请稍后重试，或查看安装日志后再试。")
            return 1
        except Exception as exc:
            log_line(user_root, f"runtime install exception: {exc!r}")
            show_error(f"桌面运行环境启动失败：\n{exc}")
            return 1
        runtime_ready = pythonw_exe.exists() and is_runtime_state_ready(deps_root, target_version)
        if install_result.returncode != 0 or not runtime_ready:
            log_line(user_root, f"runtime not ready after install: pythonw={pythonw_exe.exists()}")
            show_error(f"桌面运行环境尚未准备完成，请重新运行安装程序。\n日志目录：\n{user_root / 'runtime-logs'}")
            return 1

    if not pythonw_exe.exists():
        log_line(user_root, f"pythonw missing: {pythonw_exe}")
        show_error(f"桌面运行时文件缺失：\n{pythonw_exe}")
        return 1

    launch_env = os.environ.copy()
    launch_env["PYTHONPATH"] = str(deps_root)
    launch_env["HOROSA_INSTALLED_APP"] = "1"
    launch_env["HOROSA_DESKTOP_USER_ROOT"] = str(user_root)

    try:
        subprocess.Popen(
            [str(pythonw_exe), str(launcher_script)],
            cwd=str(launcher_script.parent),
            env=launch_env,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=0x08000000 if os.name == "nt" else 0,
        )
        log_line(user_root, "desktop app launched")
    except Exception as exc:
        log_line(user_root, f"desktop app launch failed: {exc!r}")
        show_error(f"桌面程序启动失败：\n{exc}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
