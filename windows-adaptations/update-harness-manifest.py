#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Regenerate HARNESS_MANIFEST.md — the tracked inventory of GITIGNORED build-harness files.

WHY: the Windows build harness (Electron shell, release scripts, the dev SKILL) is gitignored by
policy (ships inside the exe, not in the public repo). That makes silent loss invisible to git.
This manifest is the tracked record: file list + sha256 + purpose. `release_selfcheck.py`'s
`harness manifest fresh` gate recomputes the hashes and FAILS the release on any drift or missing
file — so a loss is detected, and the content is recoverable from the shipped exe's app.asar
(electron/*) or the release workflow docs.

Run from the repo root after ANY harness change, before release:
    python windows-adaptations/update-harness-manifest.py
"""
import hashlib
import io
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "windows-adaptations", "HARNESS_MANIFEST.md")

# path (repo-relative, forward slashes) -> one-line purpose
FILES = {
    "desktop_installer_bundle/electron/main.js": "Electron main process (bootstrap, updater, windows, Defender-exclusion hook)",
    "desktop_installer_bundle/electron/service-manager.js": "runtime manager: python/java spawn, readiness gate, uber-jar build, static+dynamic layered CDS, port retry",
    "desktop_installer_bundle/electron/build-uber-jar.py": "fat-jar -> single uber jar merge (classpath.idx first-wins + SPI union + dir entries) enabling fast static CDS",
    "desktop_installer_bundle/electron/defender-exclusion.js": "consented Windows Defender exclusion of the app runtime (~500x on-access I/O tax fix)",
    "desktop_installer_bundle/electron/job-object.js": "Windows Job Object KILL_ON_JOB_CLOSE so children die with the shell",
    "desktop_installer_bundle/electron/logger.js": "shell logger + rotation",
    "desktop_installer_bundle/electron/preload.js": "renderer bridge (window.horosaDesktop)",
    # SELF-HEAL-R3:两张 harness UI 页此前只被哨兵门守住内容、却不在校验和清单里(silent loss
    # 不可见)。loading.html 现在承载修复屏的可行动按钮与 'restarting' 状态,必须收编。
    "desktop_installer_bundle/electron/loading.html": "startup/repair screen (stepper, retry/repair/open-logs/copy-diag + download-full-installer action, runtime-state renderer)",
    "desktop_installer_bundle/electron/update-progress.html": "update download-progress window UI",
    "desktop_installer_bundle/scripts/e2e_loading_screen.cjs": "SELF-HEAL-R3 E2E: drives the real loading.html through the real preload bridge (button visibility / click routing / BUSY states / crashed-webContents reload contract)",
    "desktop_installer_bundle/electron/update-flow.js": "auto-update flow (sidecar-stop-before-install, progress window)",
    "desktop_installer_bundle/electron/update-signature.js": "Ed25519 update-signature verify",
    "desktop_installer_bundle/electron/update-progress-preload.js": "download-progress window preload",
    "desktop_installer_bundle/electron/service-manager.test.js": "node:test suite for the runtime manager",
    "desktop_installer_bundle/electron/update-flow.test.js": "node:test suite for the update flow",
    "desktop_installer_bundle/electron/update-signature.test.js": "node:test suite for signature verify",
    "desktop_installer_bundle/scripts/release_selfcheck.py": "release gate: sentinels, hashes, feed, signature, THIS manifest",
    "desktop_installer_bundle/scripts/release_preflight.py": "pre-release env checks",
    "desktop_installer_bundle/scripts/stage-runtime.cjs": "stages local/workspace/runtime -> build/app-runtime payload",
    "desktop_installer_bundle/scripts/build-renderer.cjs": "frontend build wrapper",
    "desktop_installer_bundle/scripts/sign-update.cjs": "Ed25519 signing of release assets",
    "desktop_installer_bundle/scripts/write-app-update-yml.cjs": "app-update.yml generator (updater feed)",
    "desktop_installer_bundle/scripts/patch-nsis-template.cjs": "PERF-R7 I-1 install-speed: build-time controlled patch of app-builder-lib extractAppPackage.nsh (same-volume move-first instead of the second full-tree copy; version-pinned, exact-anchor, idempotent)",
    "desktop_installer_bundle/scripts/delta-report.py": "DELTA-V2: blockmap differential estimator + payload-manifest diff (powers the differential-efficiency release gate)",
    "desktop_installer_bundle/scripts/hostile_env_smoke.ps1": "PERF-R6 B-1: hostile-env packaged-app smoke (poisoned PYTHON*/JAVA*/proxy/GBK -> ready + /chart 200 + clean logs)",
    "desktop_installer_bundle/scripts/verify_kentang_services.py": "institutional gate: every kentang technique backend (KENTANG_SERVICE_SPECS) imports+resolves+instantiates in the packaged runtime, in BOTH forward and reverse spec order (order-poisoning coverage — the v3.2.0 太乙 404 only reproduced qizheng-before-taiyi); wired into release_selfcheck.py",
    "desktop_installer_bundle/scripts/verify_all_services.py": "institutional gate: launches the packaged chart service and POSTs a REAL request to EVERY mounted python route (eager + kentang) in the post-warmup production state, with a mount-drift check (new service without a probe row = release FAIL); wired into release_selfcheck.py",
    "desktop_installer_bundle/electron/update-splash.js": "detached PowerShell WPF 'installing update' splash for the silent-install minutes (survives the NSIS taskkill of Horosa.exe; self-closes on relaunch/timeout; HOROSA_UPDATE_SPLASH=0)",
    "desktop_installer_bundle/assets/installer.nsh": "NSIS hooks: disk-space gate, uninstall cleanup, OS gate, details-visible install log + phase banners",
    ".claude/skills/horosa-dev/SKILL.md": "the dev/sync/release runbook CORE (rules + runbooks + commands; restructured 2026-07-04)",
    ".claude/skills/horosa-dev/references/gotchas-full.md": "the full 49-gotcha institutional archive (verbatim history + topic index; new gotchas append HERE)",
    "CLAUDE.md": "repo-root session baseline (paths, red lines, verification entry points; local-only)",
    "desktop_installer_bundle/scripts/run_pytest_embedded.ps1": "one-command astropy pytest on the EMBEDDED interpreter (gotcha #29 recipe as code)",
    "desktop_installer_bundle/scripts/verify_release_live.ps1": "post-release LIVE verification: server digests==local + prerelease/latest + feed probe (SKILL 铁律 12 as code)",
    # 2026-07-07: local/Horosa_Local_Windows.bat/.ps1 promoted to TRACKED (git-safe) so the public
    # README's "web one-click from source" section can point to them — dropped from this manifest
    # (which only inventories GITIGNORED harness). check_local_launchers still pins them on disk
    # (existence / dual-engine parse / encoding / sentinels); git now guards against silent loss.
}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def is_ignored(rel):
    try:
        r = subprocess.run(["git", "check-ignore", rel], cwd=ROOT,
                           capture_output=True, text=True)
        return r.returncode == 0
    except OSError:
        return None


def main():
    rows = []
    missing = []
    for rel, purpose in sorted(FILES.items()):
        p = os.path.join(ROOT, rel.replace("/", os.sep))
        if not os.path.isfile(p):
            missing.append(rel)
            continue
        ign = is_ignored(rel)
        tag = "gitignored" if ign else ("tracked" if ign is False else "?")
        rows.append((rel, sha256(p), os.path.getsize(p), tag, purpose))

    with io.open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("# HARNESS_MANIFEST — tracked inventory of the (mostly gitignored) Windows build harness\n\n")
        f.write("Generated by `windows-adaptations/update-harness-manifest.py`. Do not edit by hand.\n")
        f.write("`release_selfcheck.py` gate `harness manifest fresh` recomputes these hashes and fails the\n")
        f.write("release on drift/missing — silent loss of a gitignored harness file becomes detectable.\n")
        f.write("Recovery: `electron/*` ship inside the released exe's `resources/app.asar`; scripts/SKILL are\n")
        f.write("additionally reconstructible from session records. See windows-adaptations/README.md (five-layer contract).\n\n")
        f.write("| file | sha256 | bytes | git | purpose |\n|---|---|---|---|---|\n")
        for rel, digest, size, tag, purpose in rows:
            f.write("| `%s` | `%s` | %d | %s | %s |\n" % (rel, digest, size, tag, purpose))
    print("wrote %s (%d files%s)" % (OUT, len(rows),
          ("; MISSING: " + ", ".join(missing)) if missing else ""))
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
