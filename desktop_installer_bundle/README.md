# Horosa Desktop Bundle

This folder contains the Windows desktop wrapper for Horosa.

Goals:
- no visible PowerShell or cmd window during normal use
- open Horosa inside a native desktop window
- keep all new packaging files isolated in one root-level folder
- support GitHub release update checks from the app menu
- preserve user data across updates by storing desktop state outside the install folder

Contents:
- `src/`: desktop app source code and updater helper
- `wheelhouse/`: offline wheels for desktop runtime installation
- `pyinstaller/`: PyInstaller build spec
- `version.json`: desktop bundle version metadata
- `build_desktop_bundle.bat`: developer build entrypoint
- `build_desktop_bundle.ps1`: build script
- `Install_Horosa_Desktop.vbs`: creates Start Menu/Desktop shortcuts without a console
- `Run_Horosa_Desktop.vbs`: starts the packaged desktop app without a console
- `install_desktop_runtime.ps1`: installs desktop Python dependencies into a short local path
- `install_desktop_wizard.ps1`: branded Windows installer UI used by the VBS entrypoint
- `build_portable_release_zip.ps1`: builds the full portable update zip for GitHub Releases
- `publish_github_release.ps1`: builds the portable zip, creates the matching tag, and pushes the release trigger to GitHub
- `UPDATE_RELEASE_GUIDE.md`: repeatable release/update process so installed apps can detect every new version
- `INSTALL_3_STEPS.md`: short guide for non-technical users
- `STRUCTURE.md`: folder structure notes

The stable install path uses the bundled Horosa Python runtime plus `pythonw.exe`
to open the desktop shell without a console window. The shell reuses the existing
Horosa Windows launcher in hidden mode, then loads the generated local URL inside
an embedded Chromium view.

Desktop state that must survive updates is stored in:
- `%LocalAppData%\HorosaDesktop`

Recommended end-user entrypoint:
- `Install_Horosa_Desktop.vbs`

Developer-only:
- `build_desktop_bundle.ps1`
- `pyinstaller/`
- `dist/`
- `release/`
