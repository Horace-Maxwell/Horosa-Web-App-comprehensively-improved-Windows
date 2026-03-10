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
from pathlib import Path
from typing import Optional

import requests
from packaging.version import InvalidVersion, Version
from PySide6.QtCore import QObject, QSettings, QStandardPaths, Qt, QTimer, QUrl, Signal
from PySide6.QtGui import QAction, QDesktopServices
from PySide6.QtWebEngineCore import QWebEnginePage, QWebEngineProfile, QWebEngineSettings
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWidgets import (
    QApplication,
    QLabel,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QProgressBar,
    QStackedLayout,
    QStatusBar,
    QVBoxLayout,
    QWidget,
)

ORG_NAME = "Horosa"
APP_NAME = "Horosa Desktop"
STARTUP_TIMEOUT_SECONDS = 240
CREATE_NO_WINDOW = 0x08000000
DETACHED_PROCESS = 0x00000008
NEW_PROCESS_GROUP = 0x00000200


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

        assets = release.get("assets") or []
        selected_asset = None
        selected_priority = None
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
                selected_priority = priority
                break

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
        self.signals.status.emit("Starting Horosa services...")

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
                    f"Startup timed out after {STARTUP_TIMEOUT_SECONDS} seconds. Check desktop logs."
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
                    self.signals.status.emit("Starting backend services...")
                elif line.startswith("[2/4]"):
                    self.signals.status.emit("Starting local web service...")
                elif "Started (no-browser mode):" in line:
                    url = line.split("Started (no-browser mode):", 1)[1].strip()
                    self.ready_url = url
                    self.signals.status.emit("Loading Horosa window...")
                    self.signals.ready.emit(url)
                elif line.startswith("Startup failed:"):
                    failure_message = line.split(":", 1)[1].strip()
                elif line.startswith("Backend not ready in time"):
                    failure_message = line
        finally:
            exit_code = self.process.wait()
            if not self.stop_requested and not self.ready_url:
                self.signals.failed.emit(failure_message or f"Launcher exited early with code {exit_code}.")

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
        self.current_version = normalize_version(app_version(data_root))

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
                    "No published GitHub release with a supported Horosa update asset was found."
                )
                return

            release = best["release"]
            asset = best["asset"]
            parsed_version = best["parsed_version"]
            result = {
                "latest_tag": release.get("tag_name", ""),
                "latest_version": str(parsed_version),
                "html_url": release.get("html_url", self.config["release_page"]),
                "download_url": asset.get("browser_download_url", ""),
                "asset_name": asset.get("name", ""),
                "asset_digest": asset.get("digest", ""),
                "published_at": release.get("published_at", ""),
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
                    raise RuntimeError("Downloaded update zip failed SHA256 verification.")

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
            raise FileNotFoundError(f"Update helper not found: {helper}")

        relaunch_vbs = self.package_root / "Run_Horosa_Desktop.vbs"
        if not relaunch_vbs.exists():
            raise FileNotFoundError(f"Relaunch script not found: {relaunch_vbs}")

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

        self.setWindowTitle(APP_NAME)
        self.resize(1540, 960)
        self._build_ui()
        self._build_menu()
        self._wire_signals()
        self._restore_window_settings()
        QTimer.singleShot(0, self.launcher.start)

    def _build_ui(self) -> None:
        self.status_bar = QStatusBar(self)
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("Preparing Horosa...")

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

        self.web_view = QWebEngineView(self)
        self.web_view.setPage(QWebEnginePage(self.web_profile, self.web_view))

        loading_widget = QWidget(self)
        loading_layout = QVBoxLayout(loading_widget)
        loading_layout.setContentsMargins(48, 48, 48, 48)
        loading_layout.setSpacing(16)

        self.loading_title = QLabel("Horosa Desktop is starting", loading_widget)
        self.loading_title.setAlignment(Qt.AlignCenter)
        self.loading_title.setStyleSheet("font-size: 28px; font-weight: 600;")

        self.loading_status = QLabel("Preparing services...", loading_widget)
        self.loading_status.setAlignment(Qt.AlignCenter)
        self.loading_status.setWordWrap(True)
        self.loading_status.setStyleSheet("font-size: 15px; color: #555;")

        self.loading_progress = QProgressBar(loading_widget)
        self.loading_progress.setRange(0, 0)
        self.loading_progress.setTextVisible(False)
        self.loading_progress.setFixedHeight(14)

        self.retry_button = QPushButton("Restart Horosa", loading_widget)
        self.retry_button.clicked.connect(self._restart_services)
        self.retry_button.hide()

        loading_layout.addStretch(1)
        loading_layout.addWidget(self.loading_title)
        loading_layout.addWidget(self.loading_status)
        loading_layout.addWidget(self.loading_progress)
        loading_layout.addWidget(self.retry_button, alignment=Qt.AlignCenter)
        loading_layout.addStretch(2)

        central = QWidget(self)
        self.stack = QStackedLayout(central)
        self.stack.addWidget(loading_widget)
        self.stack.addWidget(self.web_view)
        self.setCentralWidget(central)

    def _build_menu(self) -> None:
        menu_bar = self.menuBar()

        file_menu = menu_bar.addMenu("File")
        refresh_action = QAction("Refresh current page", self)
        refresh_action.triggered.connect(self.web_view.reload)
        file_menu.addAction(refresh_action)

        restart_action = QAction("Restart Horosa services", self)
        restart_action.triggered.connect(self._restart_services)
        file_menu.addAction(restart_action)

        open_logs_action = QAction("Open desktop logs", self)
        open_logs_action.triggered.connect(self._open_logs)
        file_menu.addAction(open_logs_action)

        exit_action = QAction("Exit", self)
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)

        update_menu = menu_bar.addMenu("Update")
        check_updates_action = QAction("Check for updates", self)
        check_updates_action.triggered.connect(self._check_updates)
        update_menu.addAction(check_updates_action)

        help_menu = menu_bar.addMenu("Help")
        guide_action = QAction("Open 3-step guide", self)
        guide_action.triggered.connect(self._open_install_guide)
        help_menu.addAction(guide_action)

        release_guide_action = QAction("Open update release guide", self)
        release_guide_action.triggered.connect(self._open_release_guide)
        help_menu.addAction(release_guide_action)

        about_action = QAction("About", self)
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

    def _handle_page_loaded(self, ok: bool) -> None:
        if ok:
            self.stack.setCurrentIndex(1)
            self.retry_button.hide()
            self.status_bar.showMessage("Horosa is ready.")
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
            self._show_startup_error("Embedded page failed to load.")

    def _show_startup_error(self, message: str) -> None:
        self.stack.setCurrentIndex(0)
        self.loading_progress.setRange(0, 1)
        self.loading_progress.setValue(0)
        self.retry_button.show()
        self.loading_status.setText(message)
        self.status_bar.showMessage(message)
        QMessageBox.critical(
            self,
            APP_NAME,
            f"{message}\n\nDesktop logs:\n{self.user_root / 'runtime-logs'}",
        )

    def _restart_services(self) -> None:
        self.stack.setCurrentIndex(0)
        self.loading_progress.setRange(0, 0)
        self.retry_button.hide()
        self.loading_status.setText("Restarting Horosa...")
        self.status_bar.showMessage("Restarting Horosa...")
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
            APP_NAME,
            (
                f"{APP_NAME}\n"
                f"Version: {app_version(self.data_root)}\n\n"
                "Runs Horosa inside a native desktop window, stores user data in LocalAppData, "
                "and can update itself from published GitHub releases."
            ),
        )

    def _check_updates(self) -> None:
        self.status_bar.showMessage("Checking GitHub updates...")
        self.updater.check_async()

    def _handle_update_info(self, payload: dict) -> None:
        if not payload.get("has_update"):
            QMessageBox.information(self, APP_NAME, "You already have the latest published version.")
            self.status_bar.showMessage("No update available.")
            return

        latest_tag = payload.get("latest_tag", "")
        asset_name = payload.get("asset_name", "")
        reply = QMessageBox.question(
            self,
            APP_NAME,
            (
                f"A new version is available: {latest_tag}\n\n"
                f"Asset: {asset_name}\n\n"
                "Horosa Desktop will download it, replace the installed app files, and restart automatically "
                "without touching your user data stored in LocalAppData.\n\n"
                "Continue?"
            ),
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.Yes,
        )
        if reply == QMessageBox.Yes:
            self.loading_status.setText(f"Downloading update {latest_tag}...")
            self.stack.setCurrentIndex(0)
            self.loading_progress.setRange(0, 100)
            self.loading_progress.setValue(0)
            self.retry_button.hide()
            self.updater.download_async(payload)
        else:
            self.status_bar.showMessage("Update cancelled.")

    def _show_download_progress(self, current: int, total: int) -> None:
        if total > 0:
            percent = int((current / total) * 100)
            self.loading_progress.setRange(0, 100)
            self.loading_progress.setValue(percent)
            self.loading_status.setText(f"Downloading update... {percent}%")
            self.status_bar.showMessage(f"Downloading update... {percent}%")
        else:
            self.loading_progress.setRange(0, 0)
            self.loading_status.setText("Downloading update...")
            self.status_bar.showMessage("Downloading update...")

    def _finish_update_download(self, payload: dict) -> None:
        self.pending_update_zip = payload["zip_path"]
        self.update_restart_requested = True
        self._save_window_settings()
        QMessageBox.information(
            self,
            APP_NAME,
            (
                f"Update {payload['version_label']} has finished downloading.\n\n"
                "Horosa Desktop will now close, replace the installed files, and reopen in the same desktop state."
            ),
        )
        self.status_bar.showMessage("Applying update...")
        self.loading_status.setText("Applying update and restarting...")
        try:
            self.updater.apply_update(self.pending_update_zip)
        except Exception as exc:
            self.update_restart_requested = False
            self._show_update_error(str(exc))
            return
        self.close()

    def _show_update_error(self, message: str) -> None:
        self.stack.setCurrentIndex(1 if self.current_url else 0)
        self.status_bar.showMessage(message)
        QMessageBox.warning(self, APP_NAME, message)

    def closeEvent(self, event) -> None:  # type: ignore[override]
        self._save_window_settings()
        self.status_bar.showMessage("Stopping Horosa services...")
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
