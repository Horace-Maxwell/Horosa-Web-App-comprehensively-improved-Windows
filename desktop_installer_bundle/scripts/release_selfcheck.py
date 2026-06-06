#!/usr/bin/env python3
"""Horosa Windows release self-check gate (change-agnostic).

Philosophy: every vulnerability we have ever hit becomes a PERMANENT automated check here,
so it can never silently recur. The checks verify CLASSES of problems (staleness, version
drift, reverted fixes, asset/hash mismatch) rather than one release's specific change, so this
script does NOT need editing every release -- only when a NEW class of bug is discovered (then
add a new check / sentinel, per .claude/skills/horosa-dev/SKILL.md).

Run it as the final gate after `npm run dist:win` (it is also wired into the `dist:win` script):
    python scripts/release_selfcheck.py
Exit code 0 = all gates pass; non-zero = a release-blocking problem was found.

Past bugs encoded as gates:
- silent stale jar  -> staged astrostudyboot.jar must be newer than all astrostudysrv/**/*.java
- forgot rebuild FE -> staged dist-file must be newer than astrostudyui/src
- version-bump miss -> all download/badge/tag refs must equal package.json version
- reverted Win fix  -> Windows-ahead + ported-fix sentinels must still be present
- bad release set   -> 4 assets present, SHA256SUMS matches files, latest.yml version matches
- broken auto-update-> latest.yml sha512/size/path must match the shipped exe byte-for-byte
                       (a drifted latest.yml -- e.g. an overwrite-in-place re-release that forgot
                        to regenerate it -- silently fails every client's electron-updater check)
"""
import os, re, sys, glob, hashlib, base64, subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BUNDLE = os.path.dirname(SCRIPT_DIR)                       # desktop_installer_bundle
REPO = os.path.dirname(BUNDLE)                             # repo root

def _ws():
    cands = glob.glob(os.path.join(REPO, "local", "workspace", "Horosa-Web-*"))
    cands = [c for c in cands if os.path.isdir(os.path.join(c, "astrostudyui"))]
    if not cands:
        raise RuntimeError("Cannot locate local/workspace/Horosa-Web-* workspace dir")
    return sorted(cands)[0]

WS = _ws()
UI = os.path.join(WS, "astrostudyui")
SRV = os.path.join(WS, "astrostudysrv")
BUNDLE_RUNTIME = os.path.join(REPO, "local", "workspace", "runtime", "windows", "bundle")

results = []  # (name, ok, detail)
def record(name, ok, detail=""):
    results.append((name, ok, detail))

def read(path):
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()

def newest_mtime(root, exts, skip_substr=()):
    newest = 0.0
    newest_path = None
    for dirpath, _dirs, files in os.walk(root):
        if any(s in dirpath.replace("\\", "/") for s in skip_substr):
            continue
        for fn in files:
            if exts and not fn.lower().endswith(exts):
                continue
            p = os.path.join(dirpath, fn)
            try:
                m = os.path.getmtime(p)
            except OSError:
                continue
            if m > newest:
                newest, newest_path = m, p
    return newest, newest_path

def pkg_version():
    import json
    with open(os.path.join(BUNDLE, "package.json"), "r", encoding="utf-8") as f:
        return json.load(f)["version"]

# ---------------------------------------------------------------- checks
def check_version_consistency(V):
    bad = []
    # CITATION.cff
    cff = read(os.path.join(REPO, "CITATION.cff"))
    m = re.search(r"^version:\s*(.+)$", cff, re.MULTILINE)
    if not m or m.group(1).strip() != V:
        bad.append(f"CITATION.cff version = {m.group(1).strip() if m else 'missing'} != {V}")
    # bundle README "当前发布版本：`X Beta`（安装器版本号为 `X`）"
    bre = read(os.path.join(BUNDLE, "README.md"))
    for mm in re.finditer(r"当前发布版本：`([\d.]+) Beta`（安装器版本号为 `([\d.]+)`）", bre):
        if mm.group(1) != V or mm.group(2) != V:
            bad.append(f"bundle README current-version = {mm.group(1)}/{mm.group(2)} != {V}")
    # README download / badge / tag refs must all == V (historical 'includes X' prose & docs/releases/X.md links are bare and untouched)
    pat = [(r"Horosa-Setup-([\d.]+)\.exe", "download exe"),
           (r"version-([\d.]+)%20beta", "version badge"),
           (r"releases/tag/v([\d.]+)", "tag link")]
    for fn in ("README.md", "README_ZH.md", "README_EN.md", os.path.join("desktop_installer_bundle", "README.md")):
        txt = read(os.path.join(REPO, fn))
        for rx, label in pat:
            for mm in re.finditer(rx, txt):
                if mm.group(1) != V:
                    bad.append(f"{fn}: stale {label} -> {mm.group(1)} (expect {V})")
    record("version consistency", not bad, "; ".join(bad) if bad else f"all refs == {V}")

def check_sentinels():
    # file (relative to WS unless absolute) -> required substrings (a reverted fix removes these)
    SENT = {
        # v2.2.0: Feng Shui was rewritten iframe -> React (fengshuiEngine canvas). The old
        # Windows-ahead relative-iframe fix is OBSOLETED by the rewrite (no iframe = no desktop
        # file:// path problem); guard that the React engine is wired (not a reverted iframe shell).
        os.path.join(UI, "src/components/fengshui/FengShuiMain.js"): ["fengshuiEngine"],
        os.path.join(UI, "src/utils/windowSizePersistence.js"): ["isDesktopShellWindow"],
        os.path.join(UI, "src/components/ziwei/ZWHouse.js"): ["kinastroBorrowed"],
        os.path.join(UI, "src/pages/index.js"): ["ensureField"],
        os.path.join(UI, "src/utils/aiAnalysisContext.js"): ["compatible !== false", "regenerateChartTechniqueSnapshot"],
        os.path.join(UI, "src/components/aianalysis/AIAnalysisMain.js"): ["renderMarkdownToHtml", "DOMPurify", "streamError"],
        os.path.join(UI, "src/integrations/kentang/serviceRoot.js"): ["LOCAL_KENTANG_CHART_PORT"],
        os.path.join(UI, "src/utils/baziLunarLocal.js"): ["clockTime", "solarTime"],
        os.path.join(BUNDLE, "electron/service-manager.js"): [
            # v2.5.4 启动稳健化 ①: the trusted fast-path no longer uses 'Promise.resolve(...port probe...)' —
            # it now runs a REAL waitForBackendHeartbeat against trustedRuntimeServerRoot with short-timeout
            # then full-timeout fallback. The presence of this variable name is the marker that the trusted-path
            # probe goes through real HTTP /heartbeat (not just port-open) — reverting breaks the white-screen fix.
            "trustedRuntimeServerRoot",
            # issue #2 (Win11 won't run): embedded Python/Java must be spawned
            # with host PYTHON*/_JAVA_OPTIONS contamination stripped + Python run
            # isolated (-E -s -X utf8). Reverting any of these re-opens the bug.
            "sanitizeEmbeddedRuntimeEnv",
            "buildPythonRuntimeArgs",
            "_JAVA_OPTIONS",
            "'-E', '-s', '-X', 'utf8'",
            # issue #7: payload extraction must resolve tar to an absolute path, not bare `tar`
            # (bare-tar PATH/PATHEXT resolution ENOENT'd on some machines -> app couldn't launch).
            "resolveTarExe",
            # v2.3.0 issue #9: the embedded JVM must honor the OS system proxy so AI providers
            # (OpenAI/Anthropic/etc.) are reachable behind a corporate/system proxy. This launcher
            # flag is the 3rd leg of the fix (with boundless+astrostudy ProxySelector); reverting it
            # re-breaks AI for proxied users. The flag is inert when no system proxy is configured.
            "useSystemProxies",
            # v2.5.0 startup hardening (mirror of macOS start_runtime_with_port_retry): on a port/bind
            # conflict the launcher retries with a fresh port pair (launchServicesWithPortRetry +
            # isPortConflictError gating the retry decision), and tags the embedded backend
            # (-Dhorosa.runtime.owner) so it is positively identifiable. Reverting these re-opens the
            # "端口被占用 / 后端未启动" symptom the release fixes.
            "launchServicesWithPortRetry",
            "isPortConflictError",
            "-Dhorosa.runtime.owner=horosa-desktop",
            # v2.5.4 启动稳健化 ③: Spring Boot must bind 127.0.0.1 only (NOT default 0.0.0.0)
            # otherwise Windows Firewall prompts on first launch / may block startup.
            # Mirror of macOS start_horosa_local.sh; see docs/windows-启动稳健化-镜像清单.md ③.
            "--server.address=127.0.0.1",
            # v2.5.4 启动稳健化 ①: even on trusted fast-path the backend probe must do a REAL
            # HTTP /heartbeat (not just port-open) — port open ≠ Java truly ready, otherwise UI
            # loads PRE-ready → 白屏. Falls back to full STARTUP_READY_TIMEOUT_MS wait on first
            # try failure (never short-circuits). See docs/windows-启动稳健化-镜像清单.md ①.
            "waitForBackendHeartbeat(trustedRuntimeServerRoot",
            # v2.5.4 启动稳健化 ②: Windows Job Object KILL_ON_JOB_CLOSE so children (python/java)
            # die with parent Electron on crash/OOM/external kill. Implemented in job-object.js,
            # wired at top-level of service-manager.js. Failure falls back to taskkill/findPort.
            "attachJobObject",
        ],
        # v2.5.4 启动稳健化 ②: the Job Object module itself — KILL_ON_JOB_CLOSE flag + koffi binding
        # to CreateJobObjectW / SetInformationJobObject / AssignProcessToJobObject. Reverting breaks
        # the cleanup-on-crash guarantee that prevents 孤儿 python.exe/java.exe → port-occupied bugs.
        os.path.join(REPO, "desktop_installer_bundle/electron/job-object.js"): [
            "attachJobObject",
            "JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE",
            "CreateJobObjectW",
            "AssignProcessToJobObject",
        ],
        # In-app auto-update must stay ENABLED (it was once disabled wholesale as
        # "updater noise"), and the install handoff MUST stop the embedded Python/Java
        # sidecars BEFORE quitAndInstall -- otherwise NSIS fails to overwrite the
        # locked app-runtime files (the classic instability). Also guard that the
        # visible download-progress window stays wired (without it the user can't tell
        # the download is happening), and that the initial check is scheduled from
        # bootstrap (runtime-independent, so it fires on every app open).
        os.path.join(BUNDLE, "electron/main.js"): [
            "AUTO_UPDATE_ENABLED = true",
            "runtimeManager.stop('update-install')",
            "quitAndInstall",
            "showDownloadProgressWindow",
            # P0-1 (v2.5.4): fail-closed Ed25519 update-signature verification before install, and
            # autoInstallOnAppQuit OFF so an unverified update can never be silently applied on quit.
            # Reverting either re-opens the unsigned-auto-update RCE channel.
            "verifyDownloadedUpdate",
            "autoInstallOnAppQuit = false",
            # H-7 (v2.5.4): bounded auto-restart of a crashed backend before the manual repair UI.
            "MAX_RUNTIME_AUTO_RESTARTS",
            # P1-4: differential (delta) downloads kept ON explicitly.
            "disableDifferentialDownload = false",
        ],
        # P0-1 (v2.5.4): Ed25519 update-signature verifier (pure node crypto, shared by main.js +
        # scripts/sign-update.cjs). Must keep the verify primitive + the embedded public key.
        os.path.join(BUNDLE, "electron/update-signature.js"): [
            "verifyUpdateSignature",
            "crypto.verify",
            "UPDATE_PUBLIC_KEY_PEM",
            "ed25519",
        ],
        os.path.join(BUNDLE, "scripts/sign-update.cjs"): [
            "sign-release",
            "createPrivateKey",
        ],
        # The download-progress window's UI (loaded from this file). The IPC channel
        # names must match what main.js sends — if either side drifts, progress stops
        # displaying. Sentinel the unique channel strings.
        os.path.join(BUNDLE, "electron/update-progress.html"): [
            "update:init",
            "update:progress",
            "update:done",
        ],
        # Win issue #18 (升级安装从来都没有成功过，只能卸载后再装): the NSIS installer must
        # FORCE-terminate a running Horosa before the upgrade's uninstall-old/extract step.
        # electron-builder's default _CHECK_APP_RUNNING relies on a polite WM_CLOSE (which
        # main.js vetoes via event.preventDefault for async shutdown) + a $INSTDIR-path /
        # USERNAME-filtered taskkill (breaks on the Chinese "星阙" path) -> "无法关闭" ->
        # "Failed to uninstall old application files: 2". We override customCheckAppRunning
        # to (1) taskkill /F /IM Horosa.exe (image-direct, no /T, no path filter) and
        # (2) Stop-Process ONLY the embedded sidecars under the unique embedded-runtime dir.
        # Reverting any of these re-opens the "upgrade never succeeds" bug.
        #
        # #18 round 2: a reboot proves no process is alive yet the upgrade STILL fails with
        # "...files: 2" — that 2 is the OLD (pre-2.6.0, on-disk) uninstaller's exit code, which an
        # in-place upgrade is forced to run; app-builder-lib's handleUninstallResult then does
        # SetErrorLevel 2; Quit. customCheckAppRunning hardens only the NEW installer, never the OLD
        # uninstaller. The fix is customUnInstallCheck: it is inserted INSTEAD of that fatal default,
        # force-cleans the stale program dir ourselves, and continues the upgrade. Reverting it
        # re-opens "upgrade never succeeds even after reboot / on a Chinese Windows username".
        os.path.join(BUNDLE, "assets/installer.nsh"): [
            "customCheckAppRunning",
            'taskkill.exe" /F /IM',
            "embedded-runtime",
            "customUnInstallCheck",
            "horosa_unchk_clean",
        ],
        # v2.2.1 Issue #8 AI-streaming double-fix (Mac handoff requests the same grep sentinel on Windows):
        # catch MUST log the primary exception first (QueueLog.error), and all 3 stream paths MUST keep-alive
        # heartbeat so a slow local model (Ollama long first-token) isn't cut off by an idle-timeout disconnect.
        # v2.5.2 Windows issue #15: Ollama must use its NATIVE /api/chat + /api/embed endpoints (the OpenAI-compatible
        # /v1/... endpoints silently ignore num_ctx -> default 4096 truncation of long astrology context). The native
        # path puts num_ctx/num_predict/top_k/top_p/repeat_penalty under options:{} so Ollama actually honours them.
        os.path.join(SRV, "astrostudy/src/main/java/spacex/astrostudy/service/AIAnalysisProxyService.java"): ["max_completion_tokens", "isOpenAIReasoningModel", "authHeaderName", "isEmbeddingModel", "keep-alive", "QueueLog.error(AppLoggers.ErrorLogger", "ProxySelector", "SseChannel", "streamOllamaNative", "embeddingsOllamaNative", "extractOllamaEmbedVectors", "ollamaNativeBase"],
        # v2.5.1 Windows issue #14: loopback (127.0.0.1 chart service) must NEVER be tunnelled through the system
        # proxy — doCmd skips the proxy for loopback targets (isLoopbackTarget) while external AI hosts keep it (#9).
        # See windows-adaptations/patches/boundless__HttpUriRequestHystrixCommand.java.patch (BACKEND -> jar rebuild).
        os.path.join(SRV, "boundless/src/main/java/boundless/net/http/HttpUriRequestHystrixCommand.java"): ["redactSensitiveHeaders", "stripQuery", "isLoopbackTarget"],
        os.path.join(UI, "src/services/aianalysis.js"): ["resolveRequestTimeout"],
        # v2.2.1 global day-boundary: the late-zi-hour 时柱 second switch field must stay wired through the model.
        os.path.join(SRV, "astrostudycn/src/main/java/spacex/astrostudycn/model/BaZi.java"): ["clockTime", "solarTime", "lateZiHourUseNextDay"],
        # v2.1.6 qimen 历法 fix (issue #4): month-pillar 交节 boundary + 置闰超神接气 ju-determination
        # in the vendored Python engine. Reverting these re-opens the calendar defect.
        os.path.join(WS, "vendor/kinqimen/jieqi.py"): ["def zhirun_jieqi"],
        os.path.join(WS, "vendor/kinqimen/config.py"): ["def dingju_jieqi", "zhirun_jieqi"],
        os.path.join(WS, "vendor/kinqimen/kinqimen.py"): ["config.dingju_jieqi"],
        # v2.1.6 India chart map-pick fix (issue #3): flat changeGeo patch matching parent changeCond.
        os.path.join(UI, "src/components/astro/IndiaChartMain.js"): ["patch.tm"],
        # v2.1.7 qimen/sanshi true-solar-time fix: fetchQimenPan must run the time-basis correction
        # (resolveCalcDateTime) so 真太阳时 casts at the corrected time, not raw clock time.
        os.path.join(UI, "src/components/dunjia/DunJiaCalc.js"): ["resolveCalcDateTime(baseDt"],
        # v2.1.8 issue #6 (local Ollama stops mid-generation): the 120s AI-streaming hard cap
        # must stay removed (SseEmitter(0L)); + Predictive/perchart pdYears passthrough.
        os.path.join(SRV, "boundless/src/main/java/boundless/spring/help/interceptor/SseHelper.java"): ["new SseEmitter(0L)"],
        os.path.join(SRV, "astrostudy/src/main/java/spacex/astrostudy/controller/PredictiveController.java"): ["pdYears", "agepoint"],
        os.path.join(WS, "astropy/astrostudy/perchart.py"): ["pdYears"],
        # v2.1.8 bazi month-pillar 交节 boundary across the other kentang engines (same class as 2.1.6 kinqimen).
        os.path.join(WS, "vendor/kinwuzhao/jieqi.py"): ["getJieQiJD"],
        os.path.join(WS, "vendor/kinastro/astro/bazi/calculator.py"): ["MONTH_JIE_INDICES"],
        os.path.join(WS, "vendor/kintaiyi/src/kintaiyi/config.py"): ["getJieQiJD"],
        # ---------------- v2.3.0 sync (Mac e712784..a649287) ----------------
        # #9 AI system-proxy fix has THREE legs (all required; the launcher flag alone is inert):
        #   (1) boundless HttpClientUtility ProxySelector.getDefault() fallback (here),
        #   (2) streaming AIAnalysisProxyService .proxy(ProxySelector.getDefault()) (guarded above),
        #   (3) launcher -Djava.net.useSystemProxies=true (service-manager.js, guarded above).
        os.path.join(SRV, "boundless/src/main/java/boundless/net/http/HttpClientUtility.java"): ["ProxySelector"],
        # v2.3.1 issue #10 (服务不稳定): SSE streaming stability has TWO legs.
        # (A) AIAnalysisProxyService routes all emitter writes through a thread-safe `SseChannel`
        #     (guarded in the AIAnalysisProxyService needles above) so the keep-alive heartbeat thread
        #     and the read loop can't race a non-thread-safe SseEmitter into "already completed".
        # (B) RequestHeaderInterceptor must reset the SSE flag per request (setSSE(false)) and skip
        #     body-decode + signature re-check on a non-REQUEST (async) dispatch (DispatcherType.REQUEST).
        #     Else a prior AI stream's SSE flag leaks onto a pooled request object -> a later chart /
        #     predict / AI request is mishandled as SSE -> intermittent signature.error / "not ready".
        os.path.join(SRV, "boundless/src/main/java/boundless/spring/help/interceptor/RequestHeaderInterceptor.java"): ["DispatcherType.REQUEST", "setSSE(false)"],
        # 占星地图 ACG: analytic RA/Dec rewrite (parans + click landing-point report) + the new
        # /location/acgpoint endpoint (controller + helper getAcgPoint w/ requestNoCache) + the D3 map FE.
        os.path.join(SRV, "astrostudy/src/main/java/spacex/astrostudy/controller/AcgController.java"): ["acgpoint", "clickLat"],
        os.path.join(SRV, "astrostudy/src/main/java/spacex/astrostudy/helper/AstroHelper.java"): ["getAcgPoint", "requestNoCache", "getAstroExtraGreatConj", "getAgePoint", "getDistribution"],
        os.path.join(WS, "astropy/astrostudy/acg/ACGraph.py"): ["def pointReport", "_parans"],
        os.path.join(UI, "src/components/acg/AstroAcg.js"): ["AcgD3Map", "/location/acgpoint"],
        # 六壬 / 三式合一 发三传: 八专 must be evaluated AFTER 遥克 (classics' 九法 order). The guard
        # comment documents why; reverting it reopens mis-classifying "八专结构 + 遥克" as 八专课.
        os.path.join(UI, "src/components/liureng/ChuangChart.js"): ["遥克必须在八专之前"],
        # 卜卦盘 + 择日盘 (new auxiliary charts): case-type registration + sub-charts wired into AuxChart
        # with componentDidUpdate so applyCase can switch to the right sub-tab (else event-chart restore breaks).
        os.path.join(UI, "src/utils/localcases.js"): ["value: 'horary'", "value: 'election'"],
        os.path.join(UI, "src/components/auxchart/AuxChartMain.js"): ["HoraryMain", "ElectionMain", "componentDidUpdate"],
        # ---------------- v2.4.0 sync (Mac fa6d9f3..d8fe575): western 6-technique full-AI + orbs persistence ----------------
        # Six Western techniques (dodecatemoria / dispositor / lifespan / distributions / age-point / mundane)
        # wired end-to-end into AI: AI-mount snapshot + AI-export registers + event-chart storage. New backend
        # routes (rebuilt jar): /predict/dist + /predict/agepoint (PredictiveController, guarded above),
        # /astroextra/greatconj + /astroextra/draconic (AstroExtraController + AstroHelper getters, above),
        # and orbs/orbScale passthrough in the astrostudycn ChartController whitelist. Reverting any of these
        # silently drops a shipped Western technique or the orb-tolerance persistence.
        os.path.join(SRV, "astrostudy/src/main/java/spacex/astrostudy/controller/AstroExtraController.java"): ["greatconj", "getGreatConjParams"],
        os.path.join(SRV, "astrostudycn/src/main/java/spacex/astrostudycn/controller/ChartController.java"): ["orbs", "orbScale"],
        # orbs/orbScale persist with the chart (mirrors the after23NewDay 5-point passthrough); zero-regression default.
        os.path.join(UI, "src/utils/localcharts.js"): ["orbs"],
        # The six Western techniques' AI-export six-register audit matrix (AI-mount != AI-export are two systems).
        os.path.join(UI, "src/utils/aiExport.js"): ["getAIExportAuditMatrix"],
        os.path.join(UI, "src/components/mundane/MundaneMain.js"): ["MundaneMain"],
    }
    missing = []
    for path, needles in SENT.items():
        if not os.path.exists(path):
            missing.append(f"MISSING FILE {os.path.relpath(path, REPO)}")
            continue
        txt = read(path)
        for n in needles:
            if n not in txt:
                missing.append(f"{os.path.relpath(path, REPO)} lost '{n}'")
    record("windows-ahead / ported-fix sentinels", not missing, "; ".join(missing) if missing else f"{len(SENT)} files OK")

def check_jar_not_stale():
    jar = os.path.join(BUNDLE_RUNTIME, "astrostudyboot.jar")
    if not os.path.exists(jar):
        record("staged jar not stale", False, "bundle astrostudyboot.jar MISSING")
        return
    jar_m = os.path.getmtime(jar)
    src_m, src_p = newest_mtime(SRV, (".java",), skip_substr=("/target/",))
    ok = src_m <= jar_m
    detail = "jar newer than all .java" if ok else f"STALE: {os.path.relpath(src_p, REPO)} is newer than the staged jar (jar not rebuilt from current backend source)"
    record("staged jar not stale", ok, detail)

def check_distfile_not_stale():
    idx = os.path.join(BUNDLE_RUNTIME, "dist-file", "index.html")
    if not os.path.exists(idx):
        record("staged dist-file not stale", False, "bundle dist-file/index.html MISSING")
        return
    idx_m = os.path.getmtime(idx)
    src_m, src_p = newest_mtime(os.path.join(UI, "src"), (".js", ".jsx", ".ts", ".tsx", ".less"), skip_substr=("/.umi/", "/.umi-production/"))
    ok = src_m <= idx_m
    detail = "dist-file newer than astrostudyui/src" if ok else f"STALE: {os.path.relpath(src_p, REPO)} newer than staged dist-file (frontend not rebuilt)"
    record("staged dist-file not stale", ok, detail)

def check_payload_slimmed():
    # Tier-1 payload slimming (docs/PACKAGING_SIZE_AUDIT.md): these build-only / duplicate /
    # regenerable dirs must NOT be in the staged runtime payload. If a future change re-includes
    # them (e.g. the prune list in stage-runtime.cjs is reverted), the installer balloons ~600 MB.
    stage = os.path.join(REPO, "desktop_installer_bundle", "build", "app-runtime", "runtime", "windows")
    if not os.path.isdir(stage):
        record("payload slimmed (Tier-1)", True, "SKIPPED (staged payload not built yet)")
        return
    must_be_absent = [
        "node", "maven", "maven-extract", "wheels",
        os.path.join("bundle", "wheels"), os.path.join("bundle", "dist"), "appcds",
    ]
    present = [p.replace("\\", "/") for p in must_be_absent if os.path.exists(os.path.join(stage, p))]
    ok = not present
    detail = "build-only/duplicate/regenerable dirs pruned from payload" if ok else \
        f"NOT pruned -> ~600MB installer bloat: {', '.join(present)} (see stage-runtime.cjs runtimePruneTargets)"
    record("payload slimmed (Tier-1)", ok, detail)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

def sha512_base64(path):
    h = hashlib.sha512()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return base64.b64encode(h.digest()).decode("ascii")

def check_update_feed_consistency(V):
    # electron-updater downloads the exe named in latest.yml and verifies it against
    # latest.yml's sha512 + size. If latest.yml drifts from the actual exe (the classic
    # failure after an "overwrite-in-place" re-release that forgot to regenerate latest.yml,
    # since a rebuild always changes the exe hash), EVERY client's auto-update fails the
    # integrity check -- silently breaking the whole feature. Gate it byte-for-byte.
    rel = os.path.join(BUNDLE, "release")
    exe = os.path.join(rel, f"Horosa-Setup-{V}.exe")
    ly = os.path.join(rel, "latest.yml")
    if not os.path.exists(exe) or not os.path.exists(ly):
        record("update feed (latest.yml) matches exe", True, "SKIPPED (installer/latest.yml not built yet)")
        return
    lytxt = read(ly)
    bad = []
    m_path = re.search(r"^path:\s*(.+?)\s*$", lytxt, re.MULTILINE)          # top-level path
    m_sha = re.search(r"^sha512:\s*(\S+)\s*$", lytxt, re.MULTILINE)         # top-level sha512 (column 0)
    m_size = re.search(r"^\s+size:\s*(\d+)\s*$", lytxt, re.MULTILINE)       # files[].size (indented)
    actual_sha = sha512_base64(exe)
    actual_size = os.path.getsize(exe)
    if not m_path or m_path.group(1).strip() != f"Horosa-Setup-{V}.exe":
        bad.append(f"latest.yml path = {m_path.group(1).strip() if m_path else 'missing'} != Horosa-Setup-{V}.exe")
    if not m_sha or m_sha.group(1).strip() != actual_sha:
        bad.append("latest.yml sha512 != exe sha512 (clients would fail the auto-update integrity check)")
    if not m_size or int(m_size.group(1)) != actual_size:
        bad.append(f"latest.yml size = {m_size.group(1) if m_size else 'missing'} != exe size {actual_size}")
    record("update feed (latest.yml) matches exe", not bad,
           "; ".join(bad) if bad else "latest.yml path/sha512/size match the shipped exe")

def check_update_signature(V):
    # P0-1 (v2.5.4): the release MUST ship `horosa-update.sig` (an Ed25519 signature of the exe) and it MUST
    # verify against the public key embedded in electron/update-signature.js. The shipped client is fail-closed:
    # it refuses any update without a valid signature, so publishing an unsigned/non-verifying release would
    # brick auto-update for every client. Verify via the SAME node verifier the client uses.
    rel = os.path.join(BUNDLE, "release")
    exe = os.path.join(rel, f"Horosa-Setup-{V}.exe")
    sig = os.path.join(rel, "horosa-update.sig")
    if not os.path.exists(exe):
        record("update signature (Ed25519)", True, "SKIPPED (installer not built yet)")
        return
    if not os.path.exists(sig):
        record("update signature (Ed25519)", False,
               "horosa-update.sig MISSING -> run `npm run sign:update`; fail-closed clients would refuse this release")
        return
    try:
        r = subprocess.run(
            ["node", os.path.join(SCRIPT_DIR, "sign-update.cjs"), "verify", exe, V, sig],
            capture_output=True, text=True, cwd=BUNDLE, timeout=180)
        ok = (r.returncode == 0)
        detail = "horosa-update.sig verifies against the embedded public key" if ok else \
                 (r.stderr.strip() or r.stdout.strip() or "verify failed")[:200]
    except Exception as e:
        ok, detail = False, f"verify exec failed: {e}"
    record("update signature (Ed25519)", ok, detail)

def check_app_update_yml():
    # The packaged app MUST ship resources/app-update.yml so electron-updater can
    # resolve the GitHub feed. The `electron-builder --dir` + `--win nsis --prepackaged`
    # split skips electron-builder's own app-update.yml generation, so
    # scripts/write-app-update-yml.cjs writes it (wired into dist:win). This gate
    # ensures that step actually ran and the file matches package.json's publish config.
    # win-unpacked is a build output (gitignored) -> SKIP if not built yet.
    import json
    wu_res = os.path.join(BUNDLE, "release", "win-unpacked", "resources")
    if not os.path.isdir(wu_res):
        record("packaged app-update.yml present", True, "SKIPPED (win-unpacked not built yet)")
        return
    auy = os.path.join(wu_res, "app-update.yml")
    if not os.path.exists(auy):
        record("packaged app-update.yml present", False,
               "resources/app-update.yml MISSING -> electron-updater can't resolve the feed (write:update-config did not run)")
        return
    txt = read(auy)
    with open(os.path.join(BUNDLE, "package.json"), "r", encoding="utf-8") as f:
        pub = json.load(f).get("build", {}).get("publish", [])
    pub = (pub[0] if isinstance(pub, list) and pub else pub) or {}
    bad = []
    for key in ("provider", "owner", "repo"):
        want = pub.get(key, "")
        if f"{key}: {want}" not in txt:
            bad.append(f"app-update.yml {key} != package.json publish ({want!r})")
    record("packaged app-update.yml present", not bad,
           "; ".join(bad) if bad else "resources/app-update.yml present + matches publish config")

def check_release_assets(V):
    rel = os.path.join(BUNDLE, "release")
    exe = os.path.join(rel, f"Horosa-Setup-{V}.exe")
    if not os.path.exists(exe):
        record("release assets", True, "SKIPPED (installer not built yet for this version)")
        return
    bad = []
    assets = [f"Horosa-Setup-{V}.exe", f"Horosa-Setup-{V}.exe.blockmap", "latest.yml", "SHA256SUMS.txt"]
    for a in assets:
        if not os.path.exists(os.path.join(rel, a)):
            bad.append(f"missing asset {a}")
    ly = os.path.join(rel, "latest.yml")
    if os.path.exists(ly):
        lytxt = read(ly)
        m = re.search(r"^version:\s*(.+)$", lytxt, re.MULTILINE)
        if not m or m.group(1).strip() != V:
            bad.append(f"latest.yml version {m.group(1).strip() if m else '?'} != {V}")
        if f"Horosa-Setup-{V}.exe" not in lytxt:
            bad.append("latest.yml url != current exe")
    sums = os.path.join(rel, "SHA256SUMS.txt")
    pending_sums = False
    if os.path.exists(sums):
        recorded = {}
        for line in read(sums).splitlines():
            parts = line.split()
            if len(parts) == 2:
                recorded[parts[1]] = parts[0].lower()
        if f"Horosa-Setup-{V}.exe" not in recorded:
            # SHA256SUMS.txt has not been regenerated for THIS version yet (expected at the end of dist:win,
            # before the manual `Get-FileHash` regen step). Don't fail here; the hash match is enforced when
            # `npm run selfcheck` is run after regenerating SHA256SUMS.
            pending_sums = True
        else:
            for a in (f"Horosa-Setup-{V}.exe", f"Horosa-Setup-{V}.exe.blockmap", "latest.yml"):
                p = os.path.join(rel, a)
                if a not in recorded:
                    bad.append(f"SHA256SUMS missing {a}")
                elif os.path.exists(p) and sha256(p) != recorded[a]:
                    bad.append(f"SHA256 mismatch for {a}")
    if bad:
        detail = "; ".join(bad)
    elif pending_sums:
        detail = "exe/blockmap/latest.yml present + latest.yml consistent; SHA256SUMS pending regen for this version (run selfcheck again after regenerating it)"
    else:
        detail = "4 assets, hashes + latest.yml consistent"
    record("release assets + hashes", not bad, detail)

def check_release_doc_hashes(V):
    # The per-release doc (docs/releases/X.Y.Z.md) publishes the exe/blockmap/latest.yml SHA256 so
    # users can verify their download. In the v2.4.0 sync we nearly shipped PLACEHOLDER hashes: the
    # doc was drafted (with plausible-looking fake hex) BEFORE the build produced the real ones, and
    # nothing caught it -- the other asset gates only check SHA256SUMS.txt / latest.yml, never the prose
    # doc. A wrong/placeholder/stale hash in the release doc misleads every user who checks their
    # download. Gate: docs/releases/{V}.md MUST contain the REAL sha256 of each shipped asset.
    # Discipline: while drafting, use the literal token "TODO" (never fake hex) so this gate fails
    # loudly and obviously instead of a fabricated hash sneaking into a published release.
    rel = os.path.join(BUNDLE, "release")
    exe = os.path.join(rel, f"Horosa-Setup-{V}.exe")
    doc = os.path.join(REPO, "docs", "releases", f"{V}.md")
    if not os.path.exists(exe):
        record("release-doc hashes match assets", True, "SKIPPED (installer not built yet)")
        return
    if not os.path.exists(doc):
        record("release-doc hashes match assets", False, f"docs/releases/{V}.md MISSING (per-release doc required)")
        return
    txt = read(doc)
    bad = []
    for name in (f"Horosa-Setup-{V}.exe", f"Horosa-Setup-{V}.exe.blockmap", "latest.yml"):
        p = os.path.join(rel, name)
        if not os.path.exists(p):
            continue
        h = sha256(p)
        if h not in txt:
            bad.append(f"{name}: real sha256 {h[:12]}… absent from doc (placeholder/stale/missing TODO)")
    record("release-doc hashes match assets", not bad,
           "; ".join(bad) if bad else f"docs/releases/{V}.md carries the real sha256 of exe/blockmap/latest.yml")

def main():
    try:
        V = pkg_version()
    except Exception as e:
        print(f"[selfcheck] FATAL: {e}")
        return 2
    print(f"[selfcheck] Horosa Windows release self-check - version {V}\n")
    check_version_consistency(V)
    check_sentinels()
    check_jar_not_stale()
    check_distfile_not_stale()
    check_payload_slimmed()
    check_release_assets(V)
    check_release_doc_hashes(V)
    check_update_feed_consistency(V)
    check_update_signature(V)
    check_app_update_yml()
    width = max(len(n) for n, _, _ in results)
    failed = 0
    for name, ok, detail in results:
        tag = "PASS" if ok else "FAIL"
        if not ok:
            failed += 1
        print(f"  [{tag}] {name.ljust(width)}  {detail}")
    print()
    if failed:
        print(f"[selfcheck] {failed} gate(s) FAILED - do not release.")
        return 1
    print("[selfcheck] OK - all release gates passed.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
