# -*- mode: python ; coding: utf-8 -*-

import os
from pathlib import Path

from PyInstaller.utils.hooks import collect_submodules

project_root = Path(os.environ["HOROSA_DESKTOP_BUNDLE_ROOT"]).resolve()
src_root = project_root / "src"

hiddenimports = []
hiddenimports += collect_submodules("PySide6.QtWebEngineCore")
hiddenimports += collect_submodules("PySide6.QtWebEngineWidgets")

datas = []
datas += [
    (str(project_root / "README.md"), "."),
    (str(project_root / "INSTALL_3_STEPS.md"), "."),
    (str(project_root / "STRUCTURE.md"), "."),
    (str(project_root / "version.json"), "."),
    (str(project_root / "src" / "app_release_config.json"), "src"),
    (str(project_root / "src" / "horosa_update_helper.ps1"), "src"),
]

block_cipher = None

a = Analysis(
    [str(src_root / "horosa_desktop.pyw")],
    pathex=[str(project_root)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "pkg_resources",
        "setuptools",
        "setuptools._vendor",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="HorosaDesktop",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    icon=str(project_root / "assets" / "horosa_setup.ico"),
)
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="HorosaDesktop",
)
