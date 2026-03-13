import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from zipfile import ZipFile


def show_error(message: str) -> None:
    try:
        import ctypes

        ctypes.windll.user32.MessageBoxW(0, message, "星阙安装程序", 0x10)
    except Exception:
        pass


def resource_path(name: str) -> Path:
    if hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS) / name
    return Path(__file__).resolve().parent / name


def resolve_payload_zip() -> Path:
    direct = resource_path("payload.zip")
    if direct.exists():
        return direct

    search_root = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    preferred = sorted(search_root.glob("HorosaPortableWindows-*.zip"))
    if preferred:
        return preferred[0]

    candidates = sorted(search_root.glob("*.zip"))
    if candidates:
        return candidates[0]

    return direct


def resolve_local_runtime_asset_root() -> Path | None:
    search_root = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    runtime_zips = sorted(search_root.glob("HorosaRuntimeWindows-*.zip"))
    manifests = sorted(search_root.glob("HorosaRuntimeWindows-*.manifest.json"))
    if runtime_zips and manifests:
        return search_root
    return None


def log_line(message: str) -> None:
    try:
        local_app_data = Path(os.environ.get("LocalAppData", tempfile.gettempdir()))
        log_dir = local_app_data / "HorosaDesktop"
        log_dir.mkdir(parents=True, exist_ok=True)
        log_path = log_dir / "setup-bootstrap.log"
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {message}\n")
    except Exception:
        pass


def cleanup_old_extract_roots(temp_root: Path) -> None:
    cutoff = time.time() - 7 * 24 * 60 * 60
    for candidate in temp_root.glob("xq*"):
        try:
            if candidate.is_dir() and candidate.stat().st_mtime < cutoff:
                shutil.rmtree(candidate, ignore_errors=True)
        except OSError:
            continue


def hide_directory(path: Path) -> None:
    try:
        import ctypes

        FILE_ATTRIBUTE_HIDDEN = 0x2
        FILE_ATTRIBUTE_SYSTEM = 0x4
        ctypes.windll.kernel32.SetFileAttributesW(str(path), FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM)
    except Exception:
        pass


def resolve_short_extract_base() -> Path:
    candidates = []
    system_drive = os.environ.get("SystemDrive")
    if system_drive:
        drive_root = system_drive if system_drive.endswith("\\") else f"{system_drive}\\"
        candidates.append(Path(drive_root) / "xq")
    candidates.append(Path(tempfile.gettempdir()) / "xq")

    last_error: Exception | None = None
    for candidate in candidates:
        try:
            candidate.mkdir(parents=True, exist_ok=True)
            return candidate
        except Exception as exc:
            last_error = exc

    if last_error:
        raise last_error
    raise RuntimeError("unable to create extract root")


def extract_payload(payload_zip: Path) -> Path:
    temp_root = resolve_short_extract_base()
    temp_root.mkdir(parents=True, exist_ok=True)
    cleanup_old_extract_roots(temp_root)
    extract_root = temp_root / f"xq{os.getpid():x}{int(time.time()) % 0xFFFFF:x}"
    extract_root.mkdir(parents=True, exist_ok=True)
    with ZipFile(payload_zip) as archive:
        archive.extractall(extract_root)
    package_dir = extract_root / "_package"
    if package_dir.exists():
        hide_directory(package_dir)
    return extract_root


def find_powershell_host() -> str:
    candidates = [
        Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "PowerShell" / "7" / "pwsh.exe",
        Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe",
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return "powershell.exe"


def main() -> int:
    payload_zip = resolve_payload_zip()
    if not payload_zip.exists():
        log_line(f"payload missing: {payload_zip}")
        show_error(f"未找到安装载荷文件：\n{payload_zip}")
        return 1

    log_line(f"payload resolved: {payload_zip}")
    try:
        log_line("extract payload start")
        extract_root = extract_payload(payload_zip)
        log_line(f"extract payload done: {extract_root}")
    except Exception as exc:
        log_line(f"extract payload failed: {exc!r}")
        show_error(f"安装器解压内部载荷失败：\n{exc}")
        return 1

    wizard_script = extract_root / "_package" / "desktop_installer_bundle" / "install_desktop_wizard.ps1"
    if not wizard_script.exists():
        log_line(f"wizard script missing: {wizard_script}")
        show_error(f"未找到安装入口文件：\n{wizard_script}")
        return 1

    host = find_powershell_host()
    log_line(f"launching installer via {host}")
    try:
        creationflags = 0
        startupinfo = None
        child_env = os.environ.copy()
        local_runtime_root = resolve_local_runtime_asset_root()
        if local_runtime_root:
            child_env["HOROSA_DESKTOP_LOCAL_RUNTIME_ASSET_ROOT"] = str(local_runtime_root)
            log_line(f"local runtime asset root: {local_runtime_root}")
        else:
            log_line("local runtime asset root: none")
        if os.name == "nt":
            creationflags |= getattr(subprocess, "CREATE_NO_WINDOW", 0)
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= getattr(subprocess, "STARTF_USESHOWWINDOW", 0)
            startupinfo.wShowWindow = 0
        result = subprocess.run(
            [
                host,
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-WindowStyle",
                "Hidden",
                "-File",
                str(wizard_script),
            ],
            env=child_env,
            check=False,
            creationflags=creationflags,
            startupinfo=startupinfo,
        )
        log_line(f"installer exit code: {result.returncode}")
        return int(result.returncode)
    except Exception as exc:
        log_line(f"bootstrap exception: {exc}")
        raise


if __name__ == "__main__":
    raise SystemExit(main())
