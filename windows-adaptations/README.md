# windows-adaptations/ — Windows-only changes to the (gitignored) product source

This Windows repo is **build-harness-only**: the product source under
`local/workspace/Horosa-Web-*/` (astrostudyui / astropy / astrostudysrv / vendor) is **gitignored**
and is **wholesale-replaced from the Mac repo** on every sync (`re-clone Mac → copy Mac's Horosa-Web/
tree over the workspace`, see `.claude/skills/horosa-dev/SKILL.md` gotcha #16). The Mac tree does **not**
contain the Windows-specific adaptations below, so every sync drops them — and a `git reset --hard` /
workspace wipe loses them with **no git recovery** (this is exactly what happened in the v2.5.0 "disaster").

**So they live here, tracked in git.** After each wholesale-replace, run:

```bash
bash windows-adaptations/apply.sh \
  local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c \
  tmp/mac-sync-<ver>/Horosa-Web      # optional 2nd arg: Mac clone (for THIRD_PARTY_NOTICES.md)
```

then `cd desktop_installer_bundle && npm run selfcheck` — the `windows-ahead / ported-fix sentinels`
gate must be **40/40**. Every item below is guarded by a `release_selfcheck.py` sentinel, so a drop is
caught before release.

## The adaptations (13)

> **Round-3 note — the dominant Windows perf fix is NOT in this overlay.** Measured: Windows Defender on-access
> scanning of the bundled runtime = ~500x I/O tax (2 MB/s) — the #1 cause of slow startup + slow compute on
> Windows (macOS has no such scanning). The fix is a **consented Defender exclusion** of the app's own runtime,
> implemented in the (gitignored, ships-in-exe) shell: `desktop_installer_bundle/electron/defender-exclusion.js`
> (app first-run, UAC-consented, idempotent) + `assets/installer.nsh` (install-time, elevated best-effort). Not a
> product-source patch, so it is guarded by `release_selfcheck.py` sentinels rather than an apply.sh row.

| # | Target (in workspace) | What / Why | How restored |
|---|---|---|---|
| 1 | `astrostudyui/scripts/umi-runner.js` | **Windows-only.** Mac's `package.json` build scripts use bash `export NODE_OPTIONS=--openssl-legacy-provider && umi build`, which **fails on Windows cmd/PowerShell**. This wrapper sets the env cross-platform and runs umi. `build-renderer.cjs` runs `npm run build:file` in this dir, so it's load-bearing. | full copy in `files/` |
| 2 | `astrostudyui/scripts/loadCryptoDeps.js` + `scripts/vendor/` | **Windows-only.** Crypto-dep shim + vendored `js-rsa`/`node-forge` used by the Windows build. | full copy in `files/` |
| 3 | `astrostudyui/package.json` (name + scripts) | Keep Mac's v2.5.0 **dependencies**, but restore the Windows **name** (`horosa-astrostudyui`) + **umi-runner-based scripts** (start/build/build:file/postinstall). | `apply.sh` merges Mac deps + `files/astrostudyui/package.name-scripts.json` |
| 4 | `astropy/requirements.txt` | **Strip `flatlib==0.2.3.post3`.** Not on PyPI (it's Mac's local flatlib-ctrad2 `setup.py` version); on Windows flatlib is provided by the **vendored flatlib-ctrad2 via sys.path injection** in the service-manager bootstrap, NOT pip. The pin makes the embedded-python `pip install -r requirements.txt` fail resolution → installs **nothing** → chart service dead. | `apply.sh`: `sed -i '/^flatlib==/d'` |
| 5 | `THIRD_PARTY_NOTICES.md` (workspace root) | Mac keeps it at the **repo root** (sibling of `Horosa-Web/`), so a Horosa-Web-only replace misses it; `stage-runtime.cjs` hard-requires it at the workspace root or `dist:win` dies in stage:runtime. | `apply.sh` copies from the Mac clone root |
| 6 | `astrostudyui/src/utils/windowSizePersistence.js` | Add `isDesktopShellWindow(win)` (Electron mirror of Mac's `isTauriWindow`, via `window.horosaDesktop`) + skip web-layer window persistence in the desktop shell — Electron self-manages window bounds; web persistence caused **startup resize jitter**. | `patches/src__utils__windowSizePersistence.js.patch` |
| 7 | `astrostudyui/src/pages/index.js` | Add `ensureField(flds,name)` defensive guard + `String()`-coerce `lat` in `changeCond` — a restored/imported chart payload may omit a field or carry a **numeric lat**, which would crash `lat.toLowerCase()`. | `patches/src__pages__index.js.patch` |
| 9 | `astrostudyui/src/utils/perfFlags.js` + `components/planetarium/PlanetariumBabylon.js` + `components/xuanshi/{echartsCore.js (new), XuanShiCelestial.js, XuanShiMap.js}` | **v3.0.1 perf — pure performance, ZERO functionality change; cross-platform.** Planetarium render-loop gating: idle render-throttle (~10 fps) when paused+static + 60 fps when playing/animating/interacting, plus pause on `document.hidden` — kills the software-render 60 fps core-peg that janks the whole app (visible+active+playing = identical). `onMetrics`→~2 Hz. Editable-time backend re-fetch debounced (display + `确定`/commit never debounced → final result exact). echarts: full barrel `import * as echarts from 'echarts'` → modular `echarts/core` + `echarts.use([...])` (玄学史 chunk slimming; charts byte-identical). Each gated by a `perfFlags.js` kill-switch. **Recommend landing upstream in Mac** (Mac tree is identical — no platform-specific reason); once Mac has them the marker guards make `apply.sh` a no-op (isLoopbackTarget precedent). | `files/` full-copy `echartsCore.js` + `patches/src__utils__perfFlags.js.patch` (marker `planetariumRenderGatingEnabled`) + `patches/src__components__planetarium__PlanetariumBabylon.js.patch` (marker `perf:planetariumRenderGating`) + `patches/src__components__xuanshi__XuanShi{Celestial,Map}.js.patch` (marker `./echartsCore`) |
| 10 | `astrostudyui/src/utils/perfFlags.js` + `components/ziwei/ZiWeiMain.js` | **v3.0.1 perf round-2 — pure performance, ZERO functionality change; cross-platform.** Deterministic technique-result cache: `techniqueResultCacheEnabled()` kill-switch + ZiWei natal `/ziwei/birth` fetch wrapped in `cachedPost` (same-params reuse + in-flight dedup, deep-clone per caller → mutation-safe) so switching to / oscillating 紫微 is instant on a repeat. Only deterministic pure-compute endpoints (no random casting / no "now" dependency). **Recommend landing upstream in Mac.** | `patches/src__utils__perfFlags.techniqueCache.js.patch` (marker `techniqueResultCacheEnabled`, applied AFTER the planetarium perfFlags patch) + `patches/src__components__ziwei__ZiWeiMain.js.patch` |
| 11 | `astrostudysrv/astrostudycn/.../controller/ChartController.java` | **BACKEND — needs a jar rebuild.** v3.0.1 perf round-2 B0: `/chart` per-segment timing (Python base / bazi+assemble / predictSign / predSync / total) written to the `perf` log — **observation only, does NOT change compute, control flow, or the response**. Makes the real "single-chart 2-3s" breakdown visible on the owner's machine to target follow-up compute optimizations. `CHART_PERF_SEG_REV` doubles as the rebuilt-jar sentinel marker. **Recommend landing upstream in Mac.** | `patches/astrostudycn__ChartController.java.patch` (marker `CHART_PERF_SEG_REV`) |
| 12 | `astrostudyui/src/utils/perfFlags.js` + `components/xuanshi/XuanShiMain.js` | **v3.0.1 perf round-3 — pure timing, ZERO functionality change; cross-platform.** First-load parallelization: `firstLoadParallelEnabled()` kill-switch + 玄学史 `XuanShiMain.loadSummary` fires its 4 independent fetches (总览/玄典/名家/事件) CONCURRENTLY instead of await-summary-then-3-serial → faster first open (summary still gates the overview render; results unchanged). **Recommend landing upstream in Mac.** | `patches/src__utils__perfFlags.firstLoadParallel.js.patch` (marker `firstLoadParallelEnabled`, applied AFTER the techniqueCache perfFlags patch) + `patches/src__components__xuanshi__XuanShiMain.js.patch` |
| 13 | `astrostudysrv/boundless/.../log/QueueLog.java` | **BACKEND — needs a jar rebuild.** v3.0.1 perf round-3: `processLog` did a `Thread.getStackTrace()` **synchronously on the request thread for EVERY info/debug call**, just to append a cosmetic `(Class.method:line)` suffix. Now OFF by default (returns the format unchanged); restore with `-Dhorosa.queuelog.callerLocation=true`. Read as a JVM system property (no Spring init-order dependency). Logging + results unchanged. `horosa.queuelog.callerLocation` doubles as the rebuilt-jar sentinel marker. **Recommend landing upstream in Mac.** | `patches/boundless__QueueLog.java.patch` (marker `horosa.queuelog.callerLocation`) |
| 8 | `astrostudysrv/boundless/.../net/http/HttpUriRequestHystrixCommand.java` | **BACKEND — needs a jar rebuild.** Windows issue #14: the embedded JVM was tunnelling its **internal `127.0.0.1:8899` chart-service calls through the system proxy**. `doCmd` set `RequestConfig.setProxy(getHttpHost())` unconditionally; with the launcher's `-Djava.net.useSystemProxies=true` (for AI reachability, #9) `getHttpHost()` resolves the OS proxy, and Apache HttpClient applies an explicit proxy **ignoring `http.nonProxyHosts`** → Clash/v2ray (ubiquitous on CN Windows) mishandles `127.0.0.1` → 12–17 s stalls → "本地排盘服务未就绪". Fix: skip the proxy for loopback targets (`isLoopbackTarget`); external AI hosts still use it (#9 preserved). **The shared frontend connection-refused retry (Mac `270eb01e`, `services/astro.js`) only covers the restart/startup window — it does NOT cover this proxy stall, which is the Windows-specific half of #14.** | `patches/boundless__HttpUriRequestHystrixCommand.java.patch` |

## Notes
- **#1–#5 are robust** (full copies / idempotent ops). **#6–#8 are patches** against Mac `1c463718`/`270eb01e`; if a
  future Mac change touches the same region the patch may not apply cleanly — `apply.sh` warns, and the
  exact changes are also visible in the `.patch` files (diff `--- Mac ... +++ Windows-adapted`). Re-apply by hand if so.
- **#8 is BACKEND (boundless) → it needs a jar rebuild every time it's (re-)applied.** `apply.sh` only patches the
  source; `prepare:runtime`'s auto-build pulls boundless from `.m2` (stale) so it will NOT pick the patch up. After
  `apply.sh`, rebuild per SKILL gotcha #5: `boundless install → astrostudy install → astrostudycn install →
  astrostudyboot clean package`, then copy `target/astrostudyboot.jar` to `local/workspace/runtime/windows/bundle/`.
  **Recommended: also land this fix upstream in Mac's boundless** (it's a cross-platform proxy bug, not truly
  Windows-only — Mac's launcher sets the same `-Djava.net.useSystemProxies=true`); once Mac has `isLoopbackTarget`,
  `apply.sh`'s marker guard makes this patch a harmless no-op and the two trees converge.
- The launcher mirror (service-manager.js port-retry etc.) is NOT here — it lives in the **tracked**
  `desktop_installer_bundle/electron/service-manager.js`, so it's already git-safe.
- When you ADD a new Windows adaptation in a future sync: drop the file/patch here, wire it into `apply.sh`,
  add a `release_selfcheck.py` sentinel, and note it in this table (+ SKILL.md gotcha #16).
