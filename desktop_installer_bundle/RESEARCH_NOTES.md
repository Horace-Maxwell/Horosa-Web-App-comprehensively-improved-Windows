# Research Notes

Implementation references used for this desktop bundle:

- Qt for Python `QWebEngineView`
  `https://doc.qt.io/qtforpython-6/PySide6/QtWebEngineWidgets/QWebEngineView.html`
  Used for the embedded Horosa browser window.

- Qt for Python `QMainWindow`
  `https://doc.qt.io/qtforpython-6/PySide6/QtWidgets/QMainWindow.html`
  Used for the native menu bar and desktop window shell.

- PyInstaller Operating Mode
  `https://pyinstaller.org/en/stable/operating-mode.html`
  Used to evaluate packaged desktop build options and onedir layout behavior.

- GitHub REST API: latest release
  `https://docs.github.com/en/rest/releases/releases#get-the-latest-release`
  Reviewed, but not used for the final updater because GitHub documents that it is
  based on the latest non-draft, non-prerelease release and can be too implicit for
  strict version selection.

- GitHub REST API: list releases
  `https://docs.github.com/en/rest/releases/releases#list-releases`
  Used for the final updater so the app can inspect multiple published releases and
  choose the highest versioned asset directly.

- PowerShell `Start-Process`
  `https://learn.microsoft.com/powershell/module/microsoft.powershell.management/start-process`
  Used to align the hidden updater launch behavior on Windows.

- Qt for Python `QStandardPaths`
  `https://doc.qt.io/qtforpython-6/PySide6/QtCore/QStandardPaths.html`
  Used so user state, logs, and web profile data live in `%LocalAppData%` instead of
  inside the install folder, which keeps updates from overwriting user data.

- Qt for Python `QSettings`
  `https://doc.qt.io/qtforpython-6/PySide6/QtCore/QSettings.html`
  Used to restore the previous window geometry and last in-app route after restart
  and after updates.
