from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import traceback
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional

import requests
from packaging.version import InvalidVersion, Version
from PySide6.QtCore import QObject, QSettings, QStandardPaths, Qt, QTimer, QUrl, Signal
from PySide6.QtGui import QAction, QDesktopServices, QFont, QFontDatabase, QKeySequence
from PySide6.QtWebEngineCore import QWebEnginePage, QWebEngineProfile, QWebEngineSettings
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWidgets import (
    QApplication,
    QDialog,
    QFrame,
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QMessageBox,
    QPlainTextEdit,
    QPushButton,
    QProgressBar,
    QStackedLayout,
    QStatusBar,
    QVBoxLayout,
    QWidget,
)

ORG_NAME = "Horosa"
APP_NAME = "Horosa Desktop"
DISPLAY_NAME = "星阙"
STARTUP_TIMEOUT_SECONDS = 240
CREATE_NO_WINDOW = 0x08000000
DETACHED_PROCESS = 0x00000008
NEW_PROCESS_GROUP = 0x00000200
MIN_ZOOM_FACTOR = 0.7
MAX_ZOOM_FACTOR = 2.0
ZOOM_STEP = 0.1
DEFAULT_STARTUP_ZOOM_FACTOR = 0.8


def normalize_version(value: str) -> Version:
    cleaned = value.strip().lstrip("vV")
    try:
        return Version(cleaned)
    except InvalidVersion:
        numeric = re.sub(r"[^0-9.]+", ".", cleaned).strip(".")
        if not numeric:
            raise
        return Version(numeric)


def resolve_powershell_exe() -> str:
    candidates = [
        Path(os.environ.get("ProgramFiles", "")) / "PowerShell" / "7" / "pwsh.exe",
        Path(os.environ.get("ProgramFiles(x86)", "")) / "PowerShell" / "7" / "pwsh.exe",
        Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe",
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    found = shutil.which("pwsh.exe") or shutil.which("powershell.exe")
    if found:
        return found
    raise FileNotFoundError("PowerShell executable not found")


def resource_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[1]


def app_install_root() -> Path:
    return resource_root()


def app_package_root() -> Path:
    start = app_install_root()
    if (start.parent / "version.json").exists():
        return start.parent
    if (start / "version.json").exists():
        return start
    for candidate in [start, *start.parents]:
        if (candidate / "version.json").exists():
            return candidate
        nested = candidate / "desktop_installer_bundle"
        if (nested / "version.json").exists():
            return nested
    return start


def app_data_root(package_root: Path) -> Path:
    install_root = app_install_root()
    internal_root = install_root / "_internal"
    if (internal_root / "version.json").exists():
        return internal_root
    if (package_root / "version.json").exists():
        return package_root
    return install_root


def find_repo_root(start: Path) -> Path:
    for candidate in [start, *start.parents]:
        if (candidate / "local" / "Horosa_Local_Windows.ps1").exists():
            return candidate
    raise FileNotFoundError("Could not find repo root containing local/Horosa_Local_Windows.ps1")


def app_version(data_root: Path) -> str:
    payload = json.loads((data_root / "version.json").read_text(encoding="utf-8"))
    return payload["version"]


def preferred_ui_font_family() -> str:
    preferred_families = [
        "Microsoft YaHei UI",
        "Microsoft YaHei",
        "PingFang SC",
        "Hiragino Sans GB",
        "Noto Sans CJK SC",
        "Source Han Sans SC",
        "Segoe UI Variable Text",
        "Segoe UI",
    ]
    available = {family.lower(): family for family in QFontDatabase.families()}
    for family in preferred_families:
        if family.lower() in available:
            return available[family.lower()]
    app = QApplication.instance()
    return app.font().family() if app else ""


def clamp_zoom_factor(value: object) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        numeric = 1.0
    return round(min(MAX_ZOOM_FACTOR, max(MIN_ZOOM_FACTOR, numeric)), 2)


def resolve_initial_zoom_factor(settings: QSettings) -> float:
    customized = settings.value("ui/zoomCustomized", False, type=bool)
    if customized:
        return clamp_zoom_factor(settings.value("ui/zoomFactor", DEFAULT_STARTUP_ZOOM_FACTOR))
    return DEFAULT_STARTUP_ZOOM_FACTOR


def smoke_test_enabled() -> bool:
    return os.environ.get("HOROSA_DESKTOP_SMOKE_TEST", "0") == "1"


def smoke_autoclose_seconds() -> int:
    raw = os.environ.get("HOROSA_DESKTOP_AUTOCLOSE_SECONDS", "5").strip()
    try:
        return max(1, int(raw))
    except ValueError:
        return 5


def fallback_user_root() -> Path:
    local_app_data = os.environ.get("LocalAppData")
    if local_app_data:
        return Path(local_app_data) / "HorosaDesktop"
    return Path.cwd() / ".horosa-desktop"


def write_fatal_log(message: str) -> None:
    candidates = [fallback_user_root(), app_install_root(), Path.cwd()]
    for root in candidates:
        try:
            root.mkdir(parents=True, exist_ok=True)
            (root / "desktop-fatal.log").write_text(message, encoding="utf-8")
            return
        except Exception:
            continue


def sha256_of_file(file_path: Path) -> str:
    digest = hashlib.sha256()
    with file_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def format_release_timestamp(value: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        return "未提供"
    try:
        stamp = datetime.fromisoformat(cleaned.replace("Z", "+00:00"))
    except ValueError:
        return cleaned
    return stamp.astimezone().strftime("%Y-%m-%d %H:%M")


def release_notes_text(release: dict) -> str:
    notes = (release.get("body") or "").replace("\r\n", "\n").strip()
    return notes or "这个版本还没有填写更新日志。"


def select_release_asset(release: dict, asset_prefixes: list[str]) -> tuple[Optional[dict], Optional[int]]:
    assets = release.get("assets") or []
    for priority, prefix in enumerate(asset_prefixes):
        selected_asset = next(
            (
                item
                for item in assets
                if item.get("name", "").startswith(prefix) and item.get("name", "").lower().endswith(".zip")
            ),
            None,
        )
        if selected_asset:
            return selected_asset, priority
    return None, None


def select_best_release(releases: list[dict], asset_prefixes: list[str]) -> Optional[dict]:
    best: Optional[dict] = None
    best_key: Optional[tuple[Version, str]] = None

    for release in releases:
        if release.get("draft") or release.get("prerelease"):
            continue

        tag_name = (release.get("tag_name") or release.get("name") or "").strip()
        if not tag_name:
            continue

        try:
            parsed_version = normalize_version(tag_name)
        except InvalidVersion:
            continue

        selected_asset, selected_priority = select_release_asset(release, asset_prefixes)

        if not selected_asset:
            continue

        published_at = release.get("published_at") or ""
        current_key = (parsed_version, published_at)
        if best is None or current_key > best_key:
            best = {
                "release": release,
                "asset": selected_asset,
                "parsed_version": parsed_version,
                "asset_priority": selected_priority or 0,
            }
            best_key = current_key

    return best


def collect_newer_releases(releases: list[dict], asset_prefixes: list[str], current_version: Version) -> list[dict]:
    newer_releases: list[dict] = []

    for release in releases:
        if release.get("draft") or release.get("prerelease"):
            continue

        tag_name = (release.get("tag_name") or release.get("name") or "").strip()
        if not tag_name:
            continue

        try:
            parsed_version = normalize_version(tag_name)
        except InvalidVersion:
            continue

        selected_asset, _ = select_release_asset(release, asset_prefixes)
        if not selected_asset or parsed_version <= current_version:
            continue

        newer_releases.append(
            {
                "tag": release.get("tag_name", "") or tag_name,
                "version": str(parsed_version),
                "title": (release.get("name") or release.get("tag_name") or tag_name).strip(),
                "published_at": release.get("published_at", ""),
                "published_label": format_release_timestamp(release.get("published_at", "")),
                "asset_name": selected_asset.get("name", ""),
                "html_url": release.get("html_url", ""),
                "notes": release_notes_text(release),
                "_sort_key": (parsed_version, release.get("published_at") or ""),
            }
        )

    newer_releases.sort(key=lambda item: item["_sort_key"])
    for item in newer_releases:
        item.pop("_sort_key", None)
    return newer_releases


class AppSignals(QObject):
    status = Signal(str)
    ready = Signal(str)
    failed = Signal(str)
    update_check_ok = Signal(dict)
    update_check_error = Signal(str)
    download_progress = Signal(int, int)
    download_done = Signal(dict)
    download_error = Signal(str)


class LauncherController(QObject):
    def __init__(self, repo_root: Path, state_root: Path, signals: AppSignals) -> None:
        super().__init__()
        self.repo_root = repo_root
        self.state_root = state_root
        self.signals = signals
        self.process: Optional[subprocess.Popen[str]] = None
        self.reader_thread: Optional[threading.Thread] = None
        self.stop_requested = False
        self.ready_url: Optional[str] = None
        self.log_dir = state_root / "runtime-logs"
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.log_path = self.log_dir / "desktop-launcher.log"
        self.launch_started_at = 0.0

    def start(self) -> None:
        if self.process and self.process.poll() is None:
            return

        launcher = self.repo_root / "local" / "Horosa_Local_Windows.ps1"
        if not launcher.exists():
            self.signals.failed.emit(f"Launcher not found: {launcher}")
            return

        env = os.environ.copy()
        env["HOROSA_NO_BROWSER"] = "1"
        env["HOROSA_PERF_MODE"] = env.get("HOROSA_PERF_MODE", "0")
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUTF8"] = "1"

        self.stop_requested = False
        self.ready_url = None
        self.launch_started_at = time.time()
        self.signals.status.emit(f"正在启动{DISPLAY_NAME}服务...")

        self.process = subprocess.Popen(
            [
                resolve_powershell_exe(),
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(launcher),
            ],
            cwd=str(self.repo_root),
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
            creationflags=CREATE_NO_WINDOW,
        )

        self.reader_thread = threading.Thread(target=self._read_output_loop, daemon=True)
        self.reader_thread.start()
        threading.Thread(target=self._timeout_watch, daemon=True).start()

    def _timeout_watch(self) -> None:
        while self.process and self.process.poll() is None and not self.ready_url:
            if time.time() - self.launch_started_at > STARTUP_TIMEOUT_SECONDS:
                self.signals.failed.emit(
                    f"启动在 {STARTUP_TIMEOUT_SECONDS} 秒后超时。请检查桌面日志。"
                )
                self.stop(force=True)
                return
            time.sleep(0.5)

    def _append_log(self, line: str) -> None:
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        with self.log_path.open("a", encoding="utf-8") as handle:
            handle.write(f"[{timestamp}] {line}\n")

    def _read_output_loop(self) -> None:
        failure_message = None
        assert self.process is not None
        assert self.process.stdout is not None
        try:
            for raw_line in self.process.stdout:
                line = raw_line.rstrip()
                self._append_log(line)
                if not line:
                    continue
                if line.startswith("[1/4]"):
                    self.signals.status.emit("正在启动后端服务...")
                elif line.startswith("[2/4]"):
                    self.signals.status.emit("正在启动本地网页服务...")
                elif "Started (no-browser mode):" in line:
                    url = line.split("Started (no-browser mode):", 1)[1].strip()
                    self.ready_url = url
                    self.signals.status.emit(f"正在加载{DISPLAY_NAME}窗口...")
                    self.signals.ready.emit(url)
                elif line.startswith("Startup failed:"):
                    failure_message = line.split(":", 1)[1].strip()
                elif line.startswith("Backend not ready in time"):
                    failure_message = line
        finally:
            exit_code = self.process.wait()
            if not self.stop_requested and not self.ready_url:
                self.signals.failed.emit(failure_message or f"启动程序提前退出，退出码：{exit_code}。")

    def stop(self, force: bool = False) -> None:
        if not self.process:
            return

        self.stop_requested = True
        try:
            if not force and self.process.stdin:
                self.process.stdin.write("\n")
                self.process.stdin.flush()
        except Exception:
            force = True

        try:
            self.process.wait(timeout=20 if not force else 5)
        except subprocess.TimeoutExpired:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)
        finally:
            self.process = None
            self.ready_url = None

    def restart(self) -> None:
        self.stop()
        time.sleep(1.0)
        self.start()


class GitHubUpdater(QObject):
    def __init__(
        self,
        repo_root: Path,
        package_root: Path,
        data_root: Path,
        user_root: Path,
        signals: AppSignals,
    ) -> None:
        super().__init__()
        self.repo_root = repo_root
        self.package_root = package_root
        self.data_root = data_root
        self.user_root = user_root
        self.signals = signals
        self.config = json.loads((data_root / "src" / "app_release_config.json").read_text(encoding="utf-8"))
        self.current_version_text = app_version(data_root)
        self.current_version = normalize_version(self.current_version_text)

    def check_async(self) -> None:
        threading.Thread(target=self._check, daemon=True).start()

    def _check(self) -> None:
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": APP_NAME,
            "X-GitHub-Api-Version": "2022-11-28",
        }
        try:
            response = requests.get(self.config["releases_api"], headers=headers, timeout=20)
            response.raise_for_status()
            releases = response.json()
            asset_prefixes = self.config.get("preferred_asset_prefixes") or []
            best = select_best_release(releases, asset_prefixes)

            if not best:
                self.signals.update_check_error.emit(
                    "未找到包含受支持更新包的已发布 GitHub Release。"
                )
                return

            release = best["release"]
            asset = best["asset"]
            parsed_version = best["parsed_version"]
            newer_releases = collect_newer_releases(releases, asset_prefixes, self.current_version)
            result = {
                "current_version": self.current_version_text,
                "latest_tag": release.get("tag_name", ""),
                "latest_version": str(parsed_version),
                "latest_name": (release.get("name") or release.get("tag_name") or str(parsed_version)).strip(),
                "latest_notes": release_notes_text(release),
                "html_url": release.get("html_url", self.config["release_page"]),
                "release_page": self.config["release_page"],
                "download_url": asset.get("browser_download_url", ""),
                "asset_name": asset.get("name", ""),
                "asset_digest": asset.get("digest", ""),
                "published_at": release.get("published_at", ""),
                "published_label": format_release_timestamp(release.get("published_at", "")),
                "newer_releases": newer_releases,
                "has_update": parsed_version > self.current_version,
            }

            self.signals.update_check_ok.emit(result)
        except Exception as exc:
            self.signals.update_check_error.emit(str(exc))

    def download_async(self, update_info: dict) -> None:
        threading.Thread(target=self._download, args=(update_info,), daemon=True).start()

    def _download(self, update_info: dict) -> None:
        download_root = self.user_root / "updates"
        download_root.mkdir(parents=True, exist_ok=True)
        asset_name = update_info["asset_name"]
        zip_path = download_root / asset_name
        headers = {"User-Agent": APP_NAME}

        try:
            with requests.get(update_info["download_url"], headers=headers, stream=True, timeout=60) as response:
                response.raise_for_status()
                total = int(response.headers.get("Content-Length") or 0)
                current = 0
                with zip_path.open("wb") as handle:
                    for chunk in response.iter_content(chunk_size=1024 * 256):
                        if not chunk:
                            continue
                        handle.write(chunk)
                        current += len(chunk)
                        self.signals.download_progress.emit(current, total)

            expected_digest = (update_info.get("asset_digest") or "").strip()
            if expected_digest.lower().startswith("sha256:"):
                expected_hash = expected_digest.split(":", 1)[1].lower()
                actual_hash = sha256_of_file(zip_path)
                if actual_hash.lower() != expected_hash:
                    raise RuntimeError("已下载的更新压缩包未通过 SHA256 校验。")

            self.signals.download_done.emit(
                {
                    "zip_path": str(zip_path),
                    "version_label": update_info["latest_tag"],
                    "asset_name": asset_name,
                }
            )
        except Exception as exc:
            self.signals.download_error.emit(str(exc))

    def apply_update(self, zip_path: str) -> None:
        helper = self.data_root / "src" / "horosa_update_helper.ps1"
        if not helper.exists():
            raise FileNotFoundError(f"未找到更新辅助脚本：{helper}")

        relaunch_vbs = self.package_root / "Run_Horosa_Desktop.vbs"
        if not relaunch_vbs.exists():
            raise FileNotFoundError(f"未找到重新启动脚本：{relaunch_vbs}")

        subprocess.Popen(
            [
                resolve_powershell_exe(),
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-WindowStyle",
                "Hidden",
                "-File",
                str(helper),
                "-ZipPath",
                zip_path,
                "-TargetDir",
                str(self.repo_root),
                "-RelaunchVbs",
                str(relaunch_vbs),
            ],
            cwd=str(self.repo_root),
            creationflags=DETACHED_PROCESS | NEW_PROCESS_GROUP | CREATE_NO_WINDOW,
        )


class ZoomableWebView(QWebEngineView):
    def __init__(self, zoom_callback: Callable[[float], None], parent: Optional[QWidget] = None) -> None:
        super().__init__(parent)
        self._zoom_callback = zoom_callback

    def wheelEvent(self, event) -> None:  # type: ignore[override]
        if event.modifiers() & Qt.ControlModifier:
            delta_y = event.angleDelta().y()
            if delta_y:
                step = ZOOM_STEP if delta_y > 0 else -ZOOM_STEP
                self._zoom_callback(self.zoomFactor() + step)
                event.accept()
                return
        super().wheelEvent(event)


class UpdateInfoDialog(QDialog):
    def __init__(self, parent: QWidget, payload: dict, make_font: Callable[[float, QFont.Weight], QFont]) -> None:
        super().__init__(parent)
        self.payload = payload
        self.make_font = make_font
        self.setObjectName("UpdateInfoDialog")
        self.setModal(True)
        self.setWindowTitle(f"{DISPLAY_NAME} 更新检查")
        self.resize(760, 620)
        self.setStyleSheet(
            """
            QDialog#UpdateInfoDialog {
                background: #f7f1e7;
            }
            QFrame#UpdateHeaderCard, QFrame#UpdateNotesCard {
                background: rgba(255, 251, 245, 0.98);
                border: 1px solid #e5d7c2;
                border-radius: 24px;
            }
            QLabel#UpdateEyebrow {
                color: #8a6528;
                background: #f3e3c5;
                border-radius: 12px;
                padding: 6px 14px;
            }
            QLabel#UpdateTitle {
                color: #1f1913;
            }
            QLabel#UpdateSummary {
                color: #5f513f;
                line-height: 1.5;
            }
            QLabel#UpdateNotesTitle {
                color: #2c241b;
            }
            QPlainTextEdit#ReleaseNotesBox {
                background: #fbf7f0;
                border: 1px solid #e8dcc9;
                border-radius: 18px;
                padding: 12px;
                color: #3b3024;
                selection-background-color: #d9b36c;
            }
            QPushButton {
                min-height: 38px;
                padding: 0 18px;
                border-radius: 18px;
            }
            QPushButton#PrimaryAction {
                background: #201b15;
                color: #fffaf3;
                border: none;
            }
            QPushButton#PrimaryAction:hover {
                background: #30271f;
            }
            QPushButton#SecondaryAction {
                background: #efe4d5;
                color: #2b231b;
                border: 1px solid #dfcfb9;
            }
            QPushButton#SecondaryAction:hover {
                background: #e5d7c4;
            }
            """
        )

        root_layout = QVBoxLayout(self)
        root_layout.setContentsMargins(22, 22, 22, 20)
        root_layout.setSpacing(16)

        header_card = QFrame(self)
        header_card.setObjectName("UpdateHeaderCard")
        header_layout = QVBoxLayout(header_card)
        header_layout.setContentsMargins(26, 24, 26, 24)
        header_layout.setSpacing(14)

        eyebrow = QLabel("版本检查结果", header_card)
        eyebrow.setObjectName("UpdateEyebrow")
        eyebrow.setAlignment(Qt.AlignCenter)
        eyebrow.setFont(self.make_font(10.5, QFont.Weight.DemiBold))

        title = QLabel(self._dialog_title(), header_card)
        title.setObjectName("UpdateTitle")
        title.setWordWrap(True)
        title.setFont(self.make_font(21, QFont.Weight.Bold))

        summary = QLabel(self._summary_text(), header_card)
        summary.setObjectName("UpdateSummary")
        summary.setWordWrap(True)
        summary.setTextFormat(Qt.PlainText)
        summary.setTextInteractionFlags(Qt.TextSelectableByMouse)
        summary.setFont(self.make_font(11.5, QFont.Weight.Medium))

        header_layout.addWidget(eyebrow, alignment=Qt.AlignLeft)
        header_layout.addWidget(title)
        header_layout.addWidget(summary)

        notes_card = QFrame(self)
        notes_card.setObjectName("UpdateNotesCard")
        notes_layout = QVBoxLayout(notes_card)
        notes_layout.setContentsMargins(24, 22, 24, 22)
        notes_layout.setSpacing(12)

        notes_title = QLabel(self._notes_title(), notes_card)
        notes_title.setObjectName("UpdateNotesTitle")
        notes_title.setFont(self.make_font(12.5, QFont.Weight.DemiBold))

        notes_box = QPlainTextEdit(notes_card)
        notes_box.setObjectName("ReleaseNotesBox")
        notes_box.setReadOnly(True)
        notes_box.setLineWrapMode(QPlainTextEdit.WidgetWidth)
        notes_box.setPlainText(self._notes_text())
        notes_box.setFont(self.make_font(10.5, QFont.Weight.Medium))

        notes_layout.addWidget(notes_title)
        notes_layout.addWidget(notes_box, 1)

        button_row = QHBoxLayout()
        button_row.setSpacing(10)
        button_row.addStretch(1)

        release_button = QPushButton("打开 Release 页面", self)
        release_button.setObjectName("SecondaryAction")
        release_button.setFont(self.make_font(10.5, QFont.Weight.DemiBold))
        release_button.clicked.connect(self._open_release_page)
        button_row.addWidget(release_button)

        close_text = "稍后再说" if self.payload.get("has_update") else "知道了"
        close_button = QPushButton(close_text, self)
        close_button.setObjectName("SecondaryAction")
        close_button.setFont(self.make_font(10.5, QFont.Weight.DemiBold))
        close_button.clicked.connect(self.reject)
        button_row.addWidget(close_button)

        if self.payload.get("has_update"):
            update_button = QPushButton("立即更新", self)
            update_button.setObjectName("PrimaryAction")
            update_button.setFont(self.make_font(10.5, QFont.Weight.DemiBold))
            update_button.clicked.connect(self.accept)
            update_button.setDefault(True)
            button_row.addWidget(update_button)
        else:
            close_button.setDefault(True)

        root_layout.addWidget(header_card)
        root_layout.addWidget(notes_card, 1)
        root_layout.addLayout(button_row)

    def _dialog_title(self) -> str:
        if self.payload.get("has_update"):
            return f"发现可更新版本：{self.payload.get('latest_tag') or self.payload.get('latest_version')}"
        return f"{DISPLAY_NAME} 已是最新版本"

    def _summary_text(self) -> str:
        current_version = self.payload.get("current_version", "未提供")
        latest_version = self.payload.get("latest_tag") or self.payload.get("latest_version") or "未提供"
        latest_name = self.payload.get("latest_name") or latest_version
        published_label = self.payload.get("published_label") or "未提供"
        newer_releases = self.payload.get("newer_releases") or []

        if newer_releases:
            version_list = "、".join(item.get("tag") or item.get("version") or "" for item in newer_releases)
        else:
            version_list = "无"

        status_line = "可更新到最新发布版本" if self.payload.get("has_update") else "当前已经是最新发布版本"
        return (
            f"当前版本：{current_version}\n"
            f"最新版本：{latest_version}\n"
            f"发布名称：{latest_name}\n"
            f"检查结果：{status_line}\n"
            f"发布时间：{published_label}\n"
            f"可升级版本：{version_list}"
        )

    def _notes_title(self) -> str:
        if self.payload.get("has_update"):
            count = len(self.payload.get("newer_releases") or [])
            return f"更新内容与日志（{count} 个版本）"
        return "最新版本更新日志"

    def _notes_text(self) -> str:
        newer_releases = self.payload.get("newer_releases") or []
        if newer_releases:
            blocks = []
            for index, release in enumerate(newer_releases, start=1):
                title = release.get("title") or release.get("tag") or release.get("version") or "未命名版本"
                tag = release.get("tag") or release.get("version") or "未提供"
                published = release.get("published_label") or "未提供"
                asset_name = release.get("asset_name") or "未提供"
                notes = release.get("notes") or "这个版本还没有填写更新日志。"
                blocks.append(
                    f"{index}. {title}\n"
                    f"版本标记：{tag}\n"
                    f"发布时间：{published}\n"
                    f"更新包：{asset_name}\n\n"
                    f"{notes.strip()}"
                )
            return ("\n\n" + ("-" * 56) + "\n\n").join(blocks)

        latest_name = self.payload.get("latest_name") or self.payload.get("latest_tag") or "当前版本"
        latest_tag = self.payload.get("latest_tag") or self.payload.get("latest_version") or "未提供"
        notes = self.payload.get("latest_notes") or "这个版本还没有填写更新日志。"
        published = self.payload.get("published_label") or "未提供"
        return (
            f"{latest_name}\n"
            f"版本标记：{latest_tag}\n"
            f"发布时间：{published}\n\n"
            f"{notes.strip()}"
        )

    def _open_release_page(self) -> None:
        url = self.payload.get("html_url") or self.payload.get("release_page")
        if url:
            QDesktopServices.openUrl(QUrl(url))


class MainWindow(QMainWindow):
    def __init__(
        self,
        repo_root: Path,
        package_root: Path,
        data_root: Path,
        user_root: Path,
    ) -> None:
        super().__init__()
        self.repo_root = repo_root
        self.package_root = package_root
        self.data_root = data_root
        self.user_root = user_root
        self.signals = AppSignals()
        self.settings = QSettings(ORG_NAME, APP_NAME)
        self.launcher = LauncherController(repo_root, user_root, self.signals)
        self.updater = GitHubUpdater(repo_root, package_root, data_root, user_root, self.signals)
        self.current_url: Optional[str] = None
        self.pending_update_zip: Optional[str] = None
        self.update_restart_requested = False
        self.ui_font_family = preferred_ui_font_family()
        self.zoom_factor = resolve_initial_zoom_factor(self.settings)

        self.setWindowTitle(DISPLAY_NAME)
        self.resize(1540, 960)
        self._build_ui()
        self._build_menu()
        self._wire_signals()
        self._restore_window_settings()
        QTimer.singleShot(0, self.launcher.start)

    def _build_ui(self) -> None:
        self.status_bar = QStatusBar(self)
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage(f"正在准备 {DISPLAY_NAME}...")

        profile_root = self.user_root / "qt-profile"
        cache_root = self.user_root / "qt-cache"
        profile_root.mkdir(parents=True, exist_ok=True)
        cache_root.mkdir(parents=True, exist_ok=True)

        self.web_profile = QWebEngineProfile(APP_NAME, self)
        self.web_profile.setPersistentStoragePath(str(profile_root))
        self.web_profile.setCachePath(str(cache_root))
        self.web_profile.settings().setAttribute(QWebEngineSettings.LocalStorageEnabled, True)
        self.web_profile.settings().setAttribute(QWebEngineSettings.JavascriptEnabled, True)
        self.web_profile.settings().setAttribute(QWebEngineSettings.FullScreenSupportEnabled, True)

        self.web_view = ZoomableWebView(self._apply_zoom_factor, self)
        self.web_view.setPage(QWebEnginePage(self.web_profile, self.web_view))
        self.web_view.setZoomFactor(self.zoom_factor)

        web_surface = QWidget(self)
        web_surface_layout = QVBoxLayout(web_surface)
        web_surface_layout.setContentsMargins(6, 4, 6, 14)
        web_surface_layout.setSpacing(0)
        web_surface_layout.addWidget(self.web_view)

        loading_widget = QWidget(self)
        loading_widget.setObjectName("LoadingSurface")
        loading_widget.setStyleSheet(
            """
            QWidget#LoadingSurface {
                background: qlineargradient(
                    x1: 0, y1: 0, x2: 1, y2: 1,
                    stop: 0 #f8f2e9,
                    stop: 0.58 #f3eadc,
                    stop: 1 #ebe0cf
                );
            }
            QFrame#LoadingCard {
                background: rgba(255, 251, 245, 0.97);
                border: 1px solid #e4d6c0;
                border-radius: 28px;
            }
            QLabel#LoadingEyebrow {
                background: #f3e3c5;
                color: #7c5b21;
                border-radius: 12px;
                padding: 6px 14px;
            }
            QLabel#LoadingTitle {
                color: #201b15;
            }
            QLabel#LoadingSubtitle {
                color: #6e5f4c;
            }
            QFrame#LoadingStatusCard {
                background: #f7efe2;
                border: 1px solid #eadac3;
                border-radius: 20px;
            }
            QLabel#LoadingPhase {
                color: #8a6528;
            }
            QLabel#LoadingStatus {
                color: #2d241b;
            }
            QLabel#LoadingHint {
                color: #7c6d59;
            }
            QProgressBar#LoadingProgress {
                background: #eadfce;
                border: none;
                border-radius: 9px;
            }
            QProgressBar#LoadingProgress::chunk {
                background: qlineargradient(
                    x1: 0, y1: 0, x2: 1, y2: 0,
                    stop: 0 #d4ad64,
                    stop: 1 #c78d45
                );
                border-radius: 9px;
            }
            QPushButton#RetryButton {
                background: #201b15;
                color: #fffaf3;
                border: none;
                border-radius: 20px;
                min-width: 184px;
                min-height: 42px;
                padding: 0 22px;
            }
            QPushButton#RetryButton:hover {
                background: #30271f;
            }
            """
        )

        loading_layout = QVBoxLayout(loading_widget)
        loading_layout.setContentsMargins(72, 56, 72, 60)
        loading_layout.setSpacing(24)

        loading_card = QFrame(loading_widget)
        loading_card.setObjectName("LoadingCard")
        loading_card.setMaximumWidth(780)
        loading_card_layout = QVBoxLayout(loading_card)
        loading_card_layout.setContentsMargins(60, 50, 60, 46)
        loading_card_layout.setSpacing(24)

        self.loading_eyebrow = QLabel(loading_card)
        self.loading_eyebrow.setObjectName("LoadingEyebrow")
        self.loading_eyebrow.setAlignment(Qt.AlignCenter)
        self.loading_eyebrow.setFont(self._make_ui_font(10.5, QFont.Weight.DemiBold))

        self.loading_title = QLabel(loading_card)
        self.loading_title.setObjectName("LoadingTitle")
        self.loading_title.setAlignment(Qt.AlignCenter)
        self.loading_title.setWordWrap(True)
        self.loading_title.setMinimumHeight(92)
        self.loading_title.setFont(self._make_ui_font(23, QFont.Weight.Bold))

        self.loading_subtitle = QLabel(loading_card)
        self.loading_subtitle.setObjectName("LoadingSubtitle")
        self.loading_subtitle.setAlignment(Qt.AlignCenter)
        self.loading_subtitle.setWordWrap(True)
        self.loading_subtitle.setMaximumWidth(560)
        self.loading_subtitle.setFont(self._make_ui_font(12.5, QFont.Weight.Medium))

        loading_status_card = QFrame(loading_card)
        loading_status_card.setObjectName("LoadingStatusCard")
        loading_status_card.setMinimumHeight(118)
        loading_status_layout = QVBoxLayout(loading_status_card)
        loading_status_layout.setContentsMargins(30, 22, 30, 24)
        loading_status_layout.setSpacing(8)

        self.loading_phase = QLabel(loading_status_card)
        self.loading_phase.setObjectName("LoadingPhase")
        self.loading_phase.setAlignment(Qt.AlignCenter)
        self.loading_phase.setFont(self._make_ui_font(10.5, QFont.Weight.DemiBold))

        self.loading_status = QLabel(loading_status_card)
        self.loading_status.setObjectName("LoadingStatus")
        self.loading_status.setAlignment(Qt.AlignCenter)
        self.loading_status.setWordWrap(True)
        self.loading_status.setMinimumHeight(40)
        self.loading_status.setFont(self._make_ui_font(13.5, QFont.Weight.DemiBold))

        self.loading_progress = QProgressBar(loading_card)
        self.loading_progress.setObjectName("LoadingProgress")
        self.loading_progress.setRange(0, 0)
        self.loading_progress.setTextVisible(False)
        self.loading_progress.setFixedHeight(18)

        self.loading_hint = QLabel(loading_card)
        self.loading_hint.setObjectName("LoadingHint")
        self.loading_hint.setAlignment(Qt.AlignCenter)
        self.loading_hint.setWordWrap(True)
        self.loading_hint.setMaximumWidth(560)
        self.loading_hint.setFont(self._make_ui_font(11, QFont.Weight.Medium))

        self.retry_button = QPushButton(f"重新启动{DISPLAY_NAME}", loading_card)
        self.retry_button.setObjectName("RetryButton")
        self.retry_button.setFont(self._make_ui_font(11.5, QFont.Weight.DemiBold))
        self.retry_button.clicked.connect(self._restart_services)
        self.retry_button.hide()

        loading_status_layout.addWidget(self.loading_phase)
        loading_status_layout.addWidget(self.loading_status)

        loading_card_layout.addWidget(self.loading_eyebrow, alignment=Qt.AlignCenter)
        loading_card_layout.addWidget(self.loading_title)
        loading_card_layout.addWidget(self.loading_subtitle, alignment=Qt.AlignCenter)
        loading_card_layout.addWidget(loading_status_card)
        loading_card_layout.addWidget(self.loading_progress)
        loading_card_layout.addWidget(self.loading_hint, alignment=Qt.AlignCenter)
        loading_card_layout.addWidget(self.retry_button, alignment=Qt.AlignCenter)

        loading_layout.addStretch(1)
        loading_layout.addWidget(loading_card, alignment=Qt.AlignHCenter)
        loading_layout.addStretch(1)

        central = QWidget(self)
        self.stack = QStackedLayout(central)
        self.stack.addWidget(loading_widget)
        self.stack.addWidget(web_surface)
        self.setCentralWidget(central)
        self._set_loading_scene(
            scene="startup",
            status="正在准备本地服务与桌面窗口...",
        )

    def _set_loading_scene(self, scene: str, status: Optional[str] = None) -> None:
        scenes = {
            "startup": {
                "eyebrow": "桌面工作区",
                "title": f"正在打开 {DISPLAY_NAME}",
                "subtitle": "正在恢复本地桌面环境、连接服务，并回到你上次的使用状态。",
                "phase": "启动中",
                "hint": "通常只需几秒钟。这是应用启动页面，不会重新执行安装，也不会影响你的本地数据。",
            },
            "restart": {
                "eyebrow": "重新连接",
                "title": f"正在重新连接 {DISPLAY_NAME}",
                "subtitle": "正在重启本地服务并恢复桌面窗口，请稍候片刻。",
                "phase": "处理中",
                "hint": "如果刚刚出现异常，这是最快的恢复方式之一。",
            },
            "update": {
                "eyebrow": "版本更新",
                "title": f"正在更新 {DISPLAY_NAME}",
                "subtitle": "新版正在下载并准备替换当前程序文件，你的本地数据会被完整保留。",
                "phase": "下载中",
                "hint": "下载完成后，应用会自动关闭、替换文件，并恢复到你当前的桌面状态。",
            },
            "apply": {
                "eyebrow": "版本更新",
                "title": "正在应用更新",
                "subtitle": f"正在替换程序文件并准备重新打开 {DISPLAY_NAME}。",
                "phase": "即将重启",
                "hint": "这个过程不会重新安装应用，也不会清空你的本地使用数据。",
            },
            "error": {
                "eyebrow": "需要处理",
                "title": f"{DISPLAY_NAME} 未能完成启动",
                "subtitle": "可以尝试重新启动服务，或打开本地日志继续排查。",
                "phase": "启动失败",
                "hint": "如果问题持续出现，请把桌面日志提供给开发者进一步定位。",
            },
        }

        payload = scenes.get(scene, scenes["startup"])
        self.loading_eyebrow.setText(payload["eyebrow"])
        self.loading_title.setText(payload["title"])
        self.loading_subtitle.setText(payload["subtitle"])
        self.loading_phase.setText(payload["phase"])
        self.loading_hint.setText(payload["hint"])
        if status is not None:
            self.loading_status.setText(status)

    def _make_ui_font(self, point_size: float, weight: QFont.Weight = QFont.Weight.Normal) -> QFont:
        base_family = self.ui_font_family or self.font().family()
        font = QFont(base_family)
        font.setPointSizeF(point_size)
        font.setWeight(weight)
        return font

    def _build_menu(self) -> None:
        menu_bar = self.menuBar()
        menu_bar.setFont(self._make_ui_font(8.0, QFont.Weight.Medium))
        menu_bar.setStyleSheet(
            """
            QMenuBar {
                background: #f7f3ec;
                border-bottom: 1px solid #ddd4c6;
                spacing: 1px;
                padding: 0 4px 0 4px;
                min-height: 18px;
            }
            QMenuBar::item {
                padding: 1px 8px;
                margin: 0;
                background: transparent;
                border-radius: 4px;
            }
            QMenuBar::item:selected {
                background: #ebe2d6;
                color: #221d17;
            }
            QMenu {
                background: #fffaf3;
                border: 1px solid #ded3c3;
                padding: 5px;
            }
            QMenu::item {
                padding: 6px 24px 6px 10px;
                border-radius: 6px;
            }
            QMenu::item:selected {
                background: #efe4d5;
            }
            """
        )

        file_menu = menu_bar.addMenu("文件")
        refresh_action = QAction("刷新当前页面", self)
        refresh_action.setShortcut(QKeySequence.Refresh)
        refresh_action.triggered.connect(self.web_view.reload)
        file_menu.addAction(refresh_action)

        restart_action = QAction(f"重新启动{DISPLAY_NAME}服务", self)
        restart_action.triggered.connect(self._restart_services)
        file_menu.addAction(restart_action)

        open_logs_action = QAction("打开桌面日志", self)
        open_logs_action.triggered.connect(self._open_logs)
        file_menu.addAction(open_logs_action)

        exit_action = QAction("退出", self)
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)

        update_menu = menu_bar.addMenu("更新")
        check_updates_action = QAction("检查更新", self)
        check_updates_action.triggered.connect(self._check_updates)
        update_menu.addAction(check_updates_action)

        view_menu = menu_bar.addMenu("视图")
        zoom_in_action = QAction("放大", self)
        zoom_in_action.setShortcuts([QKeySequence.ZoomIn, QKeySequence("Ctrl+=")])
        zoom_in_action.triggered.connect(lambda: self._apply_zoom_factor(self.zoom_factor + ZOOM_STEP))
        view_menu.addAction(zoom_in_action)

        zoom_out_action = QAction("缩小", self)
        zoom_out_action.setShortcuts([QKeySequence.ZoomOut, QKeySequence("Ctrl+-")])
        zoom_out_action.triggered.connect(lambda: self._apply_zoom_factor(self.zoom_factor - ZOOM_STEP))
        view_menu.addAction(zoom_out_action)

        reset_zoom_action = QAction("恢复默认缩放", self)
        reset_zoom_action.setShortcut(QKeySequence("Ctrl+0"))
        reset_zoom_action.triggered.connect(lambda: self._apply_zoom_factor(DEFAULT_STARTUP_ZOOM_FACTOR))
        view_menu.addAction(reset_zoom_action)

        help_menu = menu_bar.addMenu("帮助")
        guide_action = QAction("打开三步安装说明", self)
        guide_action.triggered.connect(self._open_install_guide)
        help_menu.addAction(guide_action)

        release_guide_action = QAction("打开发布更新说明", self)
        release_guide_action.triggered.connect(self._open_release_guide)
        help_menu.addAction(release_guide_action)

        about_action = QAction("关于", self)
        about_action.triggered.connect(self._show_about)
        help_menu.addAction(about_action)

    def _wire_signals(self) -> None:
        self.signals.status.connect(self._set_status)
        self.signals.ready.connect(self._load_url)
        self.signals.failed.connect(self._show_startup_error)
        self.signals.update_check_ok.connect(self._handle_update_info)
        self.signals.update_check_error.connect(self._show_update_error)
        self.signals.download_progress.connect(self._show_download_progress)
        self.signals.download_done.connect(self._finish_update_download)
        self.signals.download_error.connect(self._show_update_error)
        self.web_view.loadFinished.connect(self._handle_page_loaded)

    def _restore_window_settings(self) -> None:
        geometry = self.settings.value("ui/geometry")
        if geometry:
            self.restoreGeometry(geometry)

    def _save_window_settings(self) -> None:
        self.settings.setValue("ui/geometry", self.saveGeometry())
        self.settings.setValue("ui/zoomFactor", self.zoom_factor)
        current = self.web_view.url()
        if current.isValid() and current.fragment():
            self.settings.setValue("ui/lastFragment", current.fragment())
        self.settings.sync()

    def _set_status(self, message: str) -> None:
        self.loading_status.setText(message)
        self.status_bar.showMessage(message)

    def _apply_saved_fragment(self, url: str) -> str:
        if "#" in url:
            return url
        fragment = self.settings.value("ui/lastFragment", "", type=str)
        if fragment:
            return f"{url}#{fragment}"
        return url

    def _load_url(self, url: str) -> None:
        self.current_url = self._apply_saved_fragment(url)
        self.web_view.load(QUrl(self.current_url))

    def _apply_zoom_factor(self, factor: float) -> None:
        normalized = clamp_zoom_factor(factor)
        self.zoom_factor = normalized
        self.web_view.setZoomFactor(normalized)
        self.settings.setValue("ui/zoomFactor", normalized)
        self.settings.setValue("ui/zoomCustomized", True)
        self.status_bar.showMessage(f"页面缩放：{int(round(normalized * 100))}%")

    def _handle_page_loaded(self, ok: bool) -> None:
        if ok:
            self.stack.setCurrentIndex(1)
            self.retry_button.hide()
            self.status_bar.showMessage(f"{DISPLAY_NAME} 已就绪。")
            if smoke_test_enabled():
                smoke_dir = self.user_root / "runtime-logs"
                smoke_dir.mkdir(parents=True, exist_ok=True)
                smoke_file = smoke_dir / "smoke-ready.json"
                smoke_file.write_text(
                    json.dumps(
                        {
                            "status": "ready",
                            "url": self.current_url,
                            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                        },
                        ensure_ascii=False,
                        indent=2,
                    ),
                    encoding="utf-8",
                )
                QTimer.singleShot(smoke_autoclose_seconds() * 1000, self.close)
        else:
            self._show_startup_error("内嵌页面加载失败。")

    def _show_startup_error(self, message: str) -> None:
        self.stack.setCurrentIndex(0)
        self.loading_progress.setRange(0, 1)
        self.loading_progress.setValue(0)
        self.retry_button.show()
        self._set_loading_scene("error", message)
        self.status_bar.showMessage(message)
        QMessageBox.critical(
            self,
            DISPLAY_NAME,
            f"{message}\n\n桌面日志位置：\n{self.user_root / 'runtime-logs'}",
        )

    def _restart_services(self) -> None:
        self.stack.setCurrentIndex(0)
        self.loading_progress.setRange(0, 0)
        self.retry_button.hide()
        self._set_loading_scene("restart", f"正在重新启动{DISPLAY_NAME}服务...")
        self.status_bar.showMessage(f"正在重新启动{DISPLAY_NAME}服务...")
        self.launcher.restart()

    def _open_logs(self) -> None:
        log_dir = self.user_root / "runtime-logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(log_dir)))

    def _open_install_guide(self) -> None:
        guide = self.package_root / "INSTALL_3_STEPS.md"
        if guide.exists():
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(guide)))

    def _open_release_guide(self) -> None:
        guide = self.package_root / "UPDATE_RELEASE_GUIDE.md"
        if guide.exists():
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(guide)))

    def _show_about(self) -> None:
        QMessageBox.information(
            self,
            DISPLAY_NAME,
            (
                f"{DISPLAY_NAME}\n"
                f"版本：{app_version(self.data_root)}\n\n"
                f"{DISPLAY_NAME} 会在原生桌面窗口中运行 Horosa，"
                "把用户数据保存在 LocalAppData，并支持从已发布的 GitHub Release 自动更新。"
            ),
        )

    def _check_updates(self) -> None:
        self.status_bar.showMessage("正在检查 GitHub 更新...")
        self.updater.check_async()

    def _handle_update_info(self, payload: dict) -> None:
        dialog = UpdateInfoDialog(self, payload, self._make_ui_font)

        if not payload.get("has_update"):
            dialog.exec()
            self.status_bar.showMessage("当前没有可用更新。")
            return

        if dialog.exec() == QDialog.Accepted:
            latest_tag = payload.get("latest_tag", "")
            self.stack.setCurrentIndex(0)
            self.loading_progress.setRange(0, 100)
            self.loading_progress.setValue(0)
            self.retry_button.hide()
            self._set_loading_scene("update", f"正在下载更新 {latest_tag}...")
            self.status_bar.showMessage(f"正在下载更新 {latest_tag}...")
            self.updater.download_async(payload)
        else:
            self.status_bar.showMessage("已查看更新信息，暂未开始更新。")

    def _show_download_progress(self, current: int, total: int) -> None:
        if total > 0:
            percent = int((current / total) * 100)
            self.loading_progress.setRange(0, 100)
            self.loading_progress.setValue(percent)
            self.loading_status.setText(f"正在下载更新... {percent}%")
            self.status_bar.showMessage(f"正在下载更新... {percent}%")
        else:
            self.loading_progress.setRange(0, 0)
            self.loading_status.setText("正在下载更新...")
            self.status_bar.showMessage("正在下载更新...")

    def _finish_update_download(self, payload: dict) -> None:
        self.pending_update_zip = payload["zip_path"]
        self.update_restart_requested = True
        self._save_window_settings()
        QMessageBox.information(
            self,
            DISPLAY_NAME,
            (
                f"更新 {payload['version_label']} 已完成下载。\n\n"
                f"{DISPLAY_NAME} 现在会关闭当前窗口、替换程序文件，并恢复到相同的桌面状态。"
            ),
        )
        self.status_bar.showMessage("正在应用更新...")
        self._set_loading_scene("apply", "正在应用更新并准备重新打开...")
        try:
            self.updater.apply_update(self.pending_update_zip)
        except Exception as exc:
            self.update_restart_requested = False
            self._show_update_error(str(exc))
            return
        self.close()

    def _show_update_error(self, message: str) -> None:
        self.stack.setCurrentIndex(1 if self.current_url else 0)
        if not self.current_url:
            self._set_loading_scene("error", message)
        self.status_bar.showMessage(message)
        QMessageBox.warning(self, DISPLAY_NAME, message)

    def closeEvent(self, event) -> None:  # type: ignore[override]
        self._save_window_settings()
        self.status_bar.showMessage(f"正在停止{DISPLAY_NAME}服务...")
        self.launcher.stop()
        super().closeEvent(event)


def user_state_root() -> Path:
    qt_path = QStandardPaths.writableLocation(QStandardPaths.AppLocalDataLocation)
    root = Path(qt_path) if qt_path else fallback_user_root()
    root.mkdir(parents=True, exist_ok=True)
    return root


def main() -> int:
    qt_app = QApplication(sys.argv)
    qt_app.setOrganizationName(ORG_NAME)
    qt_app.setApplicationName(APP_NAME)
    qt_app.setApplicationDisplayName(DISPLAY_NAME)
    app_font = qt_app.font()
    app_font_family = preferred_ui_font_family()
    if app_font_family:
        app_font.setFamily(app_font_family)
    app_font.setPointSize(10)
    qt_app.setFont(app_font)

    package_root = app_package_root()
    data_root = app_data_root(package_root)
    repo_root = find_repo_root(package_root)
    user_root = user_state_root()

    window = MainWindow(repo_root, package_root, data_root, user_root)
    window.show()
    return qt_app.exec()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        write_fatal_log(traceback.format_exc())
        raise
