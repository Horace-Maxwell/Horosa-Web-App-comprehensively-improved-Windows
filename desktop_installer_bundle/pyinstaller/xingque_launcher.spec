# -*- mode: python ; coding: utf-8 -*-

import os
from pathlib import Path

project_root = Path(os.environ["HOROSA_DESKTOP_BUNDLE_ROOT"]).resolve()
src_root = project_root / "src"
exe_name = os.environ.get("HOROSA_XINGQUE_EXE_NAME", "Xingque")

block_cipher = None

a = Analysis(
    [str(src_root / "xingque_launcher.py")],
    pathex=[str(project_root)],
    binaries=[],
    datas=[],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name=exe_name,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    icon=str(project_root / "assets" / "horosa_setup.ico"),
)
