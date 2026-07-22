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
    ".claude/skills/horosa-dev/references/gotchas-full.md": "the full institutional gotcha archive #1-#73 (verbatim history + topic index; new gotchas append HERE, newest-first in the list). ★ Read the topic index first — rows '验证手段本身不可信'(#71) / '自检门的完整性'(#72) / '真机 UI 验收'(#73) are the transferable lessons from PERF-R9.",
    "docs/SELFCHECK_LOG.md": "per-release local archive of the FULL process detail (root causes, measured numbers, what the gates caught, what was deliberately NOT done and why). gitignored like the skill — losing it loses every release's reasoning, so it is inventoried here for the same reason gotchas-full.md is.",
    "docs/perf-artifacts/INDEX.md": "reading guide for the local raw perf-evidence archive (per-round acceptance JSONs, warm A/B details, diagnostic dumps, full build/test logs). PERF_BASELINE.md holds the CONCLUSION numbers (tracked+gated); this index is the entry point to their per-sample provenance. Losing the archive loses history only, never the guard rails — but losing the index silently orphans the evidence, so it is inventoried.",
    "CLAUDE.md": "repo-root session baseline (paths, red lines, verification entry points; local-only)",
    "desktop_installer_bundle/scripts/run_pytest_embedded.ps1": "one-command astropy pytest on the EMBEDDED interpreter (gotcha #29 recipe as code)",
    "desktop_installer_bundle/scripts/verify_release_live.ps1": "post-release LIVE verification: server digests==local + prerelease/latest + feed probe (SKILL 铁律 12 as code)",
    "desktop_installer_bundle/scripts/perf_acceptance.cjs": "PERF-R9 acceptance harness: drives the REAL packaged Electron shell over CDP and measures owner's criterion (click -> centre+right panels fully painted <= 1s) per technique, reading window.__horosaPerf. CONNECT-ONLY — never starts or kills a process (the owner keeps their own Horosa running; killing it is a red line). Needs HOROSA_PERF_DEBUG_PORT set on the app (electron/main.js:horosa_perf_remote_debug_v1, off by default).",
    # 2026-07-07: local/Horosa_Local_Windows.bat/.ps1 promoted to TRACKED (git-safe) so the public
    # README's "web one-click from source" section can point to them — dropped from this manifest
    # (which only inventories GITIGNORED harness). check_local_launchers still pins them on disk
    # (existence / dual-engine parse / encoding / sentinels); git now guards against silent loss.

    # ── PERF-R9 G6:以下 16 个 scripts/ 文件长期在清单之外(30 个只收编了 14 个)。
    # 最危险的是 resolve-project.cjs —— build-renderer.cjs 与 stage-runtime.cjs 都 require 它,
    # 丢了构建直接崩,而清单门当时看不见。下方 discover() 已把「漏登记」变成硬失败。
    "desktop_installer_bundle/scripts/resolve-project.cjs": "locates the Horosa product workspace dir; HARD dependency of build-renderer.cjs + stage-runtime.cjs (losing it breaks the build)",
    "desktop_installer_bundle/scripts/check_runtime_native_deps.py": "build-time guard: every native extension in the bundled Python resolves its DLLs on a CLEAN machine (no VC++ redist, no system Python)",
    "desktop_installer_bundle/scripts/verify_kentang_runtime_endpoints.py": "release rule: every packaged kentang/kin technique endpoint must be represented here before publishing (installed-app checks drive it)",
    "desktop_installer_bundle/scripts/clean_machine_cold_warm_check.py": "runs Horosa.exe with isolated user/temp dirs and measures cold/warm runtime startup (the startup-budget evidence source)",
    "desktop_installer_bundle/scripts/installed_desktop_smoke_check.py": "smoke-checks the INSTALLED desktop app on this machine",
    "desktop_installer_bundle/scripts/installer_custom_dir_smoke.py": "NSIS custom install-directory behaviour without GUI automation (dangerous-dir / MAX_PATH negative cases)",
    "desktop_installer_bundle/scripts/run_installer_regression.py": "installer regression runner (drives the installer smoke matrix)",
    "desktop_installer_bundle/scripts/desktop_ai_analysis_smoke_check.py": "AI-analysis desktop smoke check (offline/static path)",
    "desktop_installer_bundle/scripts/desktop_ai_analysis_live_smoke_check.py": "AI-analysis smoke check against a LIVE provider",
    "desktop_installer_bundle/scripts/desktop_ai_analysis_technique_completeness_check.py": "asserts every technique is represented in the AI-analysis mount/export registers",
    "desktop_installer_bundle/scripts/start-standalone-runtime.cjs": "starts the embedded runtime standalone (prints HOROSA_RUNTIME_READY) for harness probes without the Electron shell",
    "desktop_installer_bundle/scripts/patch-win-exe-icon.cjs": "stamps assets/horosa_setup.ico onto the built exe via rcedit",
    "desktop_installer_bundle/scripts/winget-manifest.cjs": "generates the winget manifests for the current release (winget install path)",
    "desktop_installer_bundle/scripts/set-staging.cjs": "staged-rollout helper: writes electron-updater's optional stagingPercentage into the published latest.yml",
    "desktop_installer_bundle/scripts/_update_feed_probe.js": "manual auto-update FEED probe (diagnostic): runs the real NsisUpdater against the real GitHub feed with a forced-low currentVersion",
    "desktop_installer_bundle/scripts/generate_brand_assets.py": "regenerates installer brand assets (icon + NSIS header/sidebar bitmaps) from the single source logo",
}

# PERF-R9 G6:刻意不收编的文件 + 理由。空理由/占位理由视同未登记。
# 与 FILES 一起构成「discover() 发现的每个文件都必须被解释」的完备集。
EXEMPT = {
    "desktop_installer_bundle/electron/__pycache__": "Python 字节码副产物,非源文件",
    "desktop_installer_bundle/scripts/__pycache__": "Python 字节码副产物,非源文件",
}

# 发现式核对的扫描面。清单此前是**纯手工白名单**,新增文件不登记也没人发现 ——
# 这正是 16 个文件长期在外的机制原因(G6)。
DISCOVER_DIRS = [
    "desktop_installer_bundle/electron",
    "desktop_installer_bundle/scripts",
]
DISCOVER_EXTRA_FILES = [
    "desktop_installer_bundle/assets/installer.nsh",
]


def discover():
    """枚举扫描面下的全部文件(repo 相对、正斜杠)。"""
    found = set()
    for d in DISCOVER_DIRS:
        base = os.path.join(ROOT, d.replace("/", os.sep))
        if not os.path.isdir(base):
            continue
        for name in sorted(os.listdir(base)):
            p = os.path.join(base, name)
            rel = f"{d}/{name}"
            if os.path.isdir(p):
                found.add(rel)          # 目录也要被解释(通常走 EXEMPT)
            else:
                found.add(rel)
    for f in DISCOVER_EXTRA_FILES:
        if os.path.isfile(os.path.join(ROOT, f.replace("/", os.sep))):
            found.add(f)
    return found


def audit_coverage():
    """返回 (未登记, 陈旧豁免) —— 供本脚本与 release_selfcheck 共用同一判据。"""
    found = discover()
    known = set(FILES) | set(EXEMPT)
    unaccounted = sorted(f for f in found if f not in known)
    stale_exempt = sorted(k for k in EXEMPT if not os.path.exists(os.path.join(ROOT, k.replace("/", os.sep))))
    return unaccounted, stale_exempt


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
