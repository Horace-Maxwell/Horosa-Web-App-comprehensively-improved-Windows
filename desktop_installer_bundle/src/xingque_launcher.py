from __future__ import annotations

import ctypes
import os
import subprocess
import sys
from pathlib import Path


DISPLAY_NAME = "星阙"


def show_error(message: str) -> None:
    try:
        ctypes.windll.user32.MessageBoxW(0, message, DISPLAY_NAME, 0x10)
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


def main() -> int:
    bundle_root = package_root()
    root = repo_root(bundle_root)
    pythonw_exe = root / "local" / "workspace" / "runtime" / "windows" / "python" / "pythonw.exe"
    launch_script = bundle_root / "launch_desktop_runtime.ps1"
    install_script = bundle_root / "install_desktop_runtime.ps1"
    deps_root = Path(os.environ.get("LocalAppData", "")) / "HorosaDesktop" / "runtime-pydeps"
    pwsh = resolve_powershell()

    if not launch_script.exists():
        show_error(f"未找到桌面启动桥接脚本：\n{launch_script}")
        return 1

    if not install_script.exists():
        show_error(f"未找到桌面运行环境安装脚本：\n{install_script}")
        return 1

    install_result = subprocess.run(
        [pwsh, "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", str(install_script)],
        check=False,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=0x08000000 if os.name == "nt" else 0,
    )
    if install_result.returncode != 0 or not deps_root.exists():
        show_error("桌面运行环境尚未准备完成，请重新运行安装程序。")
        return 1

    if not pythonw_exe.exists():
        show_error(f"桌面运行时文件缺失：\n{pythonw_exe}")
        return 1

    subprocess.Popen(
        [pwsh, "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", str(launch_script)],
        cwd=str(bundle_root),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=0x08000000 if os.name == "nt" else 0,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
