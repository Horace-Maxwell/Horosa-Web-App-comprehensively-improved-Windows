#!/usr/bin/env python3
"""Pre-release preflight gate for the Horosa / 星阙 Windows desktop build.

Catches the classes of mistake that have actually bitten this project before a
build is shipped:

  1. Brand assets gone stale  -> installer shows the OLD logo because someone
     updated horosa_setup_badge.png but forgot to re-run generate_brand_assets.py.
  2. Version drift            -> package.json / CITATION.cff / latest.yml disagree.
  3. Missing VC++ runtime     -> vendored msvcp140.dll & friends absent, so a
     clean Windows machine cannot load compiled Python extensions.

Native-extension DLL resolution is additionally gated at build time by
stage-runtime.cjs -> check_runtime_native_deps.py; this script is the lighter
"before you package" checklist that does not need the heavy staged runtime.

Usage:  python scripts/release_preflight.py
Exit 0 = all good; non-zero = at least one blocking problem.
"""
from __future__ import annotations

import json
import os
import re
import sys

BUNDLE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(BUNDLE)
ASSETS = os.path.join(BUNDLE, "assets")

problems: list[str] = []
notes: list[str] = []


def fail(msg: str) -> None:
    problems.append(msg)


def note(msg: str) -> None:
    notes.append(msg)


def read_package_version() -> str | None:
    pkg_path = os.path.join(BUNDLE, "package.json")
    with open(pkg_path, encoding="utf-8") as fh:
        pkg = json.load(fh)
    build = pkg.get("build", {})
    artifact = build.get("artifactName", "")
    if "${version}" not in artifact:
        fail(f'build.artifactName should contain ${{version}} (got "{artifact}")')
    # Naming sanity: the installed display name should be 星阙.
    if build.get("productName") != "星阙":
        fail(f'build.productName should be 星阙 (got "{build.get("productName")}")')
    if build.get("nsis", {}).get("shortcutName") != "星阙":
        fail(f'nsis.shortcutName should be 星阙 (got "{build.get("nsis", {}).get("shortcutName")}")')
    return pkg.get("version")


def check_version_sync(version: str) -> None:
    citation = os.path.join(REPO, "CITATION.cff")
    if os.path.exists(citation):
        text = open(citation, encoding="utf-8").read()
        m = re.search(r"^version:\s*(.+)$", text, re.MULTILINE)
        if not m or m.group(1).strip() != version:
            fail(f"CITATION.cff version ({m.group(1).strip() if m else 'missing'}) != package.json ({version})")
    latest = os.path.join(BUNDLE, "release", "latest.yml")
    if os.path.exists(latest):
        text = open(latest, encoding="utf-8").read()
        m = re.search(r"^version:\s*(.+)$", text, re.MULTILINE)
        if m and m.group(1).strip() != version:
            note(f"release/latest.yml version ({m.group(1).strip()}) != package.json ({version}) "
                 f"- expected until you rebuild the installer.")


def check_brand_assets_fresh() -> None:
    badge = os.path.join(ASSETS, "horosa_setup_badge.png")
    if not os.path.exists(badge):
        fail("assets/horosa_setup_badge.png (the source logo) is missing")
        return
    badge_mtime = os.path.getmtime(badge)
    derived = ["horosa_setup.ico", "installerHeader.bmp",
               "installerSidebar.bmp", "uninstallerSidebar.bmp"]
    stale = []
    for name in derived:
        path = os.path.join(ASSETS, name)
        if not os.path.exists(path):
            fail(f"assets/{name} is missing - run scripts/generate_brand_assets.py")
        elif os.path.getmtime(path) + 1 < badge_mtime:
            stale.append(name)
    if stale:
        fail("brand assets are older than the logo (" + ", ".join(stale) +
             ") - run: python scripts/generate_brand_assets.py")


def check_vendored_vc_runtime() -> None:
    vc_dir = os.path.join(REPO, "prepareruntime", "vendor", "vc_runtime", "x64")
    required = ["msvcp140.dll", "vcruntime140.dll", "vcruntime140_1.dll"]
    for name in required:
        if not os.path.exists(os.path.join(vc_dir, name)):
            fail(f"vendored VC++ runtime missing: prepareruntime/vendor/vc_runtime/x64/{name} "
                 f"(clean machines need this; see docs/CLEAN_MACHINE_NATIVE_RUNTIME_FIX.md)")


def main() -> int:
    version = read_package_version()
    if not version:
        fail("package.json has no version")
    else:
        check_version_sync(version)
        print(f"[preflight] desktop version = {version}")
    check_brand_assets_fresh()
    check_vendored_vc_runtime()

    for n in notes:
        print(f"[preflight] note: {n}")
    if problems:
        print("\n[preflight] FAIL:")
        for p in problems:
            print(f"   - {p}")
        return 1
    print("[preflight] OK - version sync, brand assets and vendored VC++ runtime all good.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
