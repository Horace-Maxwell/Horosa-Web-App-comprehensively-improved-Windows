# Structure

- `desktop_installer_bundle/src/horosa_desktop.pyw`
  Native desktop shell built with PySide6 + QtWebEngine.
- `desktop_installer_bundle/install_desktop_runtime.ps1`
  Silent installer for the desktop runtime dependencies.
- `desktop_installer_bundle/install_desktop_wizard.ps1`
  Native-looking Windows installer UI launched by the public VBS entrypoint.
- `desktop_installer_bundle/src/horosa_update_helper.ps1`
  Hidden update apply helper used after the app exits.
- `desktop_installer_bundle/src/app_release_config.json`
  GitHub repo and release asset matching rules.
- `desktop_installer_bundle/runtime_requirements.txt`
  Runtime dependencies for the desktop shell.
- `desktop_installer_bundle/wheelhouse/`
  Offline wheels used by the installer when available.
- `desktop_installer_bundle/build_portable_release_zip.ps1`
  Builds the full update zip that the in-app updater should download.
- `desktop_installer_bundle/UPDATE_RELEASE_GUIDE.md`
  Release discipline for reliable GitHub update detection.
- `desktop_installer_bundle/pyinstaller/horosa_desktop.spec`
  PyInstaller build spec for the packaged app.
- `desktop_installer_bundle/build_desktop_bundle.ps1`
  Installs build dependencies into the bundled Python and builds the app.
- `desktop_installer_bundle/build_desktop_bundle.bat`
  Simple double-click wrapper for the PowerShell build script.
- `desktop_installer_bundle/Install_Horosa_Desktop.vbs`
  Silent shortcut installer.
- `desktop_installer_bundle/Run_Horosa_Desktop.vbs`
  Silent app launcher.
- `desktop_installer_bundle/version.json`
  Desktop bundle version metadata.
- `desktop_installer_bundle/dist/`
  Generated packaged app output for developer experiments.
- `desktop_installer_bundle/release/`
  Generated zip artifact for GitHub Releases.
