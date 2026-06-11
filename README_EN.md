<div align="center">

[简体中文](README_ZH.md) · English

<img src="desktop_installer_bundle/assets/horosa_setup_badge.png" alt="Horosa" width="128" />

# Horosa

**Western astrology and Chinese metaphysics, in one native Windows workstation**

[![Version](https://img.shields.io/badge/version-2.6.6%20beta-b45309?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.6)
[![License](https://img.shields.io/badge/license-AGPL--3.0-dc2626?style=flat-square)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows%2010%2F11-x64-111111?style=flat-square&logo=windows&logoColor=white)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.6)
[![Installer](https://img.shields.io/badge/NSIS-bundled%20runtime-1f6feb?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.6)
[![Stars](https://img.shields.io/github/stars/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/stargazers)

[Download](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-2.6.6.exe) ·
[Portal](README.md) ·
[中文说明](README_ZH.md) ·
[All Releases](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases)

</div>

---

## What Horosa Is

Horosa is a desktop workstation for traditional cosmology. Western astrology—natal reading, the full timing chain, and relationship work—sits beside Chinese systems like Bazi, Ziwei, Qimen, Liuren, and Taiyi, all inside one native Windows application. The point is that you stop juggling a dozen single-purpose web tools, and you never hand-assemble the Python, Java, and ephemeris pieces underneath. You download an offline NSIS installer and open a finished app.

This repository is the Windows delivery of that app: the application source, the shared runtime, the Electron desktop shell, and the publishing flow that turns all of it into a single NSIS installer (`Horosa-Setup-2.6.6.exe`).

## Download

Regular users should go straight to the offline installer and open Horosa like any other Windows app.

**[⬇︎ Horosa-Setup-2.6.6.exe](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-2.6.6.exe)**

Best for:

- Windows 10 / 11 on `x64`
- weak-network or fully offline environments
- a first install, or forwarding the package to someone else
- anyone who wants the first launch to work without a separate runtime download

You do not need to install Python or Java yourself—the runtime ships inside the package. Updates replace the program and the shared runtime; they are not designed to touch your saved charts and cases.

> The installer is not yet Authenticode-signed, so on first launch Windows SmartScreen may say "Windows protected your PC"—choose "More info → Run anyway" to continue.

## Screenshots

<div align="center">
<img src="docs/assets/screenshots/horosa-2.0-main-workspace.png" alt="Astrology workspace" width="900" />
<p><em>Astrology workspace — chart controls on the left, the wheel canvas in the center, and detail tabs (info, aspects, planets, classical, patterns) on the right.</em></p>

<img src="docs/assets/screenshots/horosa-2.0-sanshi-workspace.png" alt="Sanshi workspace" width="900" />
<p><em>Sanshi workspace — setup panel, the nine-palace plate, and overview tabs all visible at once.</em></p>

<img src="docs/assets/screenshots/horosa-2.0-module-navigator.png" alt="Module navigator" width="900" />
<p><em>The command overlay groups charts, Yi & Sanshi, and tools, with search and recents for fast switching.</em></p>
</div>

## What's Inside

The navigation organizes everything under three groups: **命** (charts & timing), **卜** (divination), and **工具** (tools). What follows is what each group actually ships—module names map directly to the in-app tabs.

### Charts & Timing (命)

The strength here is continuity: you can read a natal chart, walk it forward through time, and bring in a second person, without leaving the same surface.

- **Astrology (占星)** — natal chart plus a real-time 3D chart (Babylon.js), with multiple house systems and classical/modern planet sets
- **Timing (星运)** — primary directions, zodiacal releasing, firdaria, profection, solar arc, solar and lunar returns, decennials, progressions, and an ephemeris
- **Relationship (合盘)** — compare, composite, synastry, time-space midpoint, and Marks charts
- **Specialty (辅盘)** — Hellenistic (bounds and lots), quantitative / midpoint trees (Hamburg / Uranian), astrocartography with interactive maps, and a harmonic lab
- **Vedic (印占)** — North, South, and East Indian charts on the sidereal zodiac
- **Qizheng (七政)** — Qizheng Siyu and Qizheng Moira
- **Bazi (八字) · Ziwei (紫微)** — four-pillar charting, and Purple Star including the Sihua chart
- **Numerology & more (数算 · 其他)** — Shaozi, Tieban, Yanqin and related numeric methods

### Divination (卜)

Yi and Sanshi go past standalone tabs into a genuinely integrated surface.

- **Sanshi United (三式)** — Qimen, Taiyi, and Liuren brought together: overview, Taiyi, shensha, Liuren, major patterns, sub-patterns, references, and the eight palaces
- **Qimen (遁甲) · Liuren (六壬) · Taiyi (太乙)** — each of the three formulae also as its own standalone surface
- **Liuyao (六爻) · Jieqi (分至) · Feng Shui (风水)** — najia hexagram casting, solar-term charts, and Feng Shui tools
- **More (其他)** — Suzhao, Jinkou, Tongshefa, Huangji Jingshi, Wuzhao, Taixuan, Jingjue, and Shenyishu

### Tools (工具)

- **AI Analysis (AI 分析)** — connects to OpenAI, Anthropic, Gemini, Ollama, OpenRouter, or a custom endpoint; supports streaming chat, conversation history, a materials library with vector retrieval, and structured export grouped by technique and tab
- **Planetarium (天文馆)** — a real-time 3D sky view built on Babylon.js
- **Almanac (黄历)** — lunar calendar, solar terms, and date selection
- **References (辅助)** — gua-symbol classes, the twelve palaces, and quick rule lookups

Charts and cases save locally with tags, snapshots, and raw backend payloads. Everything supports JSON import/export and restores its full state when you reopen it.

## New in v2.6.6 beta

**v2.6.6 = chart-math correction batch + primary-directions upgrade (Vertex promissor / 3000-year horizon) + fixes for Windows issues #23 / #24 / #25 + a full UI bug-sweep + a 9-item Windows-shell hardening pass (interface zoom persistence and more).** Backend Java touched (`AIAnalysisProxyService` Gemini parameter fix + 4 controllers `_wireRev` v12) → `astrostudyboot.jar` rebuilt; every v2.6.5-and-earlier feature is retained.

- **Fixes Windows issues #24 / #25 ("gpt5.5 upload fails")** — model-independent root cause: the round send button bound `onClick={handleSend}` directly, so antd passed the click event object as the first argument and messages became the literal string `[object Object]`. Fixed twice over: arrow-function binding + `overrideText` now accepts strings only.
- **Fixes Windows issue #23 (Gemini 400 "格式错误")** — sampling parameters (`temperature` / `maxOutputTokens`…) moved from the request top level into `generationConfig`, where Gemini requires them (jar rebuilt).
- **Chat advanced parameters now actually apply** — new `isOpenAiFamily()`: stop sequences / frequency·presence penalties / JSON mode used to check `protoFamily === 'openai'` while presets carry `'openai-compatible'`, so the checks never passed; thinking-level regex now covers gpt-5.5/6/7 and o6/o7; mid-stream report errors are no longer swallowed; aborted requests are no longer re-sent.
- **Chart-math correction batch (Python engine — wrong-to-right, results change)** — degree-minute string parsing now standard `deg+min/60`; equation-of-time table fixes + "±HH:MM" half-hour time zones in true solar time (India +05:30 was treated as +05:00); solar-return root seeking uses the forward arc (May–Dec births no longer step back a year); return/synastry aspects and antiscia normalized into [0,180] (cross-0° conjunctions no longer missed); composite midpoints take the short arc; besiegement orb isolation; hour-ruler flooring.
- **Primary-directions upgrade (jar rebuilt, `_wireRev` v12)** — precise display windows, Vertex promissor closed-form, per-chart time keys, solar-arc key forward/inverse functions, **year horizon 1000→3000** with multi-revolution recurrences, golden calibration corpus v266.
- **UI bug-sweep** — per-technique AI-mount settings now write-temporarily-and-restore (no longer permanently overwrite global Qizheng display settings); white-screen guards on corrupt localStorage across BookReader / BaZi / Gua / calendar / lon-lat inputs; dark-mode contrast on the error modal / health dot / update notifier; stable list keys (forms no longer lose focus); Su28 ring sizing, ACG click offset, Feng Shui Retina sharpness, report-capture serialization and more.
- **Windows-shell hardening, 9 items (this repo only — from a senior-engineer deep scan)** —
  - **Interface zoom persists across restarts**: the saved zoom factor was written but never read back, so every launch reset to default (the Electron mirror of the Mac shell's preferences.json fix).
  - **Material-import resilience**: one unreadable file (OneDrive placeholder / AV-locked / permission-denied) no longer aborts a whole directory import — skipped and logged; 64 MB per-file cap prevents OOM.
  - **Diagnostics / AI-backup export hardening**: write failures (missing folder, locked target) now surface a clear error instead of failing silently.
  - **Concurrent-restart latch**: rapid double-clicks on "Restart backend" no longer interleave stop/start (prevented a duplicate embedded python+java pair leak).
  - **Repair-order hardening**: runtime repair invalidates the trust caches before deleting the runtime tree.
  - Update/stability timers cleared on shutdown; winget manifests stamp the real release date; the release self-check now fails loudly on a stale SHA256SUMS file.
- **Tests** — jest **682 passing / 72 suites** (v2.6.5: 658); Python pytest **59/60** (the 60th is a Mac-platform byte-perfect golden pin; tolerance-verified on Windows as 540/540 equivalent — pure floating-point noise, max arc delta 2.1e-08°); service-manager + update-signature **39 passing**.

—— v2.6.5 features below (all retained in v2.6.6) ——

**v2.6.5 = comprehensive synastry / relationship-chart interaction-chain rebuild (all 5 sub-charts working) + AI "casting-time" mounting expanded 8→13 techniques + Python numeric-geo fault-tolerance + navigation search keywords + a real About-dialog icon.** **No backend Java change / no jar rebuild** (the synastry endpoint restoration is a frontend re-route back to the Java modern-chart backend at `:9999`; `ModernChartController` already shipped in v2.6.4); default chart math is byte-identical to v2.6.4; every v2.6.4-and-earlier feature is retained.

- **Synastry / relationship-chart interaction chain, fully rebuilt** — all five sub-charts (Synastry / Composite / Marks / Time-Space / relationship score) work again: requests routed back to the Java modern-chart backend (`:9999`), ResizeObserver-measured container heights, `chartStyle/dispatch/onChange` propagation, direct field writes on change, `paramsToFields` no longer overwrites house-system / zodiac, and a fixed-width 50/50 zodiac selector.
- **AI "casting-time" mounting 8→13 techniques** — Taixuan / Jingjue / Wuzhao / Shenyishu deterministic casting methods each gain a `buildXxxSnapshotForFields` snapshot builder so their cast charts mount into AI analysis; the technique registry and one-click mount copy are synchronized to all thirteen (four methods promoted to `kind:'payload'`, `buildFieldObject` falls back to `record.divTime`).
- **Python chart-engine numeric-geo fault-tolerance** — `helper.py`'s `convertLonStrToDegree/convertLatStrToDegree` + `realsuntime.py`'s `getBaseLonByZone` accept float longitude / latitude / time-zone values from map-pick selections (no longer assume string input), fixing a potential crash on map-selected chart casting.
- **Incidental fixes** — navigation search keywords across all 22 modules; a real `appicon.png` in the About dialog; Persian-directed "years to direction" table linkage; UranianDial glyph stroke fix; Cetian font-weight tuning; and a batch of small ephemeris / extra-chart / Babylon-sky fixes.
- **Tests** — jest **658 passing / 70 suites** (v2.6.4: 638); service-manager + update-signature **39 passing**.

—— v2.6.4 features below (all retained in v2.6.6) ——

**v2.6.4 = full-stack sidereal zodiac expansion (47 ayanāṃśa) + Western lunar mansions (Nakshatra) + Indian astrology completion + AI Analysis four-way sync with dual-chart-technique configs + integrated AI Analysis "report" generator v1 + comprehensive startup-robustness pass.** Backend Java touched (8 controllers forward `siderealAyanamsa`) → `astrostudyboot.jar` rebuilt; default chart math is byte-identical to v2.6.3; every v2.6.3-and-earlier feature is retained. **Fixes Windows issue #21** ("本地排盘服务未就绪" / "local chart service not ready" startup failure with no visible state and no self-repair).

- **Sidereal zodiac, full stack (jar rebuilt)** — Western charts now offer **tropical + 47 ayanāṃśa** via Swiss Ephemeris (reuses the Indian astrology registry), each precession mode producing real positional shifts. Covers every Western technique chart (natal/synastry/midpoint/3D/horary/sanshi/jieqi). `siderealAyanamsa` is plumbed through frontend → 8 Java controllers → Python chart kernel → response echo → storage.
- **Lunar mansions (Nakshatra) in Western charts** — 27 mansions shown when sidereal mode is selected (new `astropy/astrostudy/nakshatra.py`).
- **Indian astrology completion** — left-panel dropdown occlusion fix + ayanāṃśa 6→47 / house systems 4→24 (`SE_SIDM 0–46`).
- **AI Analysis four-way sync** — dual-chart techniques (**Solar Return / Lunar Return / Solar Arc / Given Year / Profections / Planetary Arc / Primary Direction / Vedic Jaynes progressions**) gain "natal chart + period chart" dual configs; Indian astrology / Qizheng Siyu (su28) / Western chart mount settings now have all the adjustable knobs; Persian directed adds a "years to direction" toggle; `AI_EXPORT_SETTINGS_VERSION` 23→24 with auto migration.
- **AI Analysis "report" generator v1 (front-end only)** — new 📄 Report tab in AI Analysis: 6 pre-built templates (Bazi 8/12/20 sections + Ziwei 8/12/20 sections) + 9 school-specific guidelines + sequential streaming + embedded chart capture (`html-to-image`) + 4 export formats (Markdown / PDF / Word / HTML); IndexedDB schema v3→v4 with auto migration (two new stores `report_templates` + `report_instances` + materials `schools` field).
- **Startup-robustness pass (fixes issue #21)** —
  - **Persistent backend health-light** 🟢/🟡/🔴 dot in the lower-right corner + popover showing backend URL / latency / "Retry / Restart backend / Open diagnostics / Copy info" buttons.
  - **Rich "service not ready" Modal** — four likely causes + four one-click actions (Retry / Restart backend / Open diagnostics / Copy info), no longer a dry "please confirm Horosa local service is still running".
  - **Transparent retry window 6→10 attempts (cumulative 12s→30s)** — covers the 35-60s slow-machine first-boot decompression window.
  - **Service-offline banner gains action buttons** — from "operations will retry…" to "Retry now / Restart backend / Open diagnostics".
  - **StartupGate phased copy** — silent first 6s; 6-15s "Retry" button; 15-30s "first boot can take a while" + "Restart backend"; 30s+ shows the backend URL + "Open diagnostics".
- **AI Report v1.2–v1.4 engineering fixes (rolled into this release)** — chart-capture `ChartCaptureMount` gains an ErrorBoundary + 15s fetch timeout + serialized `captureLock`; `ConcurrentQueue` exposes `getErrors()/getStats()`, skipping auxiliary sections when post-drain success rate < 40%; truncation detection adds ellipsis recognition; continuation loop is hard-capped at 2 attempts; `renderTemplateVars` guards against nested-template recursion; unknown-school `resolveSchoolPrompt` falls back to a generic guideline; INTRO/OUTRO `maxTokens` brought in line with actual output; `ChartServiceErrorModal` / `BackendStatusDot` / `ServiceStatusBanner` are fully async with real success/error feedback; `ReportGenerator` / `ReportPane` guarded against stale-closure race + double-click duplicate triggers.
- **Tests** — jest **638 passing / 68 suites** (v2.6.3: 522); service-manager + update-signature **39 passing**.

—— v2.6.3 features below (all retained in v2.6.6) ——

**v2.6.3 = AI Analysis deep polish (chat UX, settings, provider matrix, vision, usage/cost, JSON mode) + Qizheng Siyu "patterns/aspects" exported and mountable + four deterministic divination methods (Wuzhao / Taixuan / Jingjue / Shenyishu) become mountable + Jieqi chart-style button fix.** **Fixes Windows issue #20** (mounted chat content getting truncated + Solar-Return AI seeing only the natal chart).

—— v2.6.2 fixes below (all retained in v2.6.6) ——

**v2.6.2 = every v2.6.1 feature + a definitive fix for the Windows "upgrade install never succeeds" bug (issue #18).** Installer-only patch (NSIS `customUnInstallCheck`); the installer takes over when the old uninstaller returns non-zero.

—— v2.6.1 features below (all retained in v2.6.6) ——

**v2.6.1 polishes the AI-mount full options + multi-moment / range-scan output + Feng Shui "Bagua Yang-dwelling" method v2 (front-end only) + a batch of cross-module fixes.** One backend change forwards `pdYears` in `ChartController.getParams()` → `astrostudyboot.jar` rebuilt.

Full log on the [v2.6.6 release page](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.6) and the [local release notes](docs/releases/2.6.6.md) (v2.6.5 at [docs/releases/2.6.5.md](docs/releases/2.6.5.md), v2.6.4 at [docs/releases/2.6.4.md](docs/releases/2.6.4.md), v2.6.3 at [docs/releases/2.6.3.md](docs/releases/2.6.3.md), v2.6.2 installer patch at [docs/releases/2.6.2.md](docs/releases/2.6.2.md), v2.6.1 features at [docs/releases/2.6.1.md](docs/releases/2.6.1.md)); previous version v2.6.0 at [docs/releases/2.6.0.md](docs/releases/2.6.0.md).

## Under the Hood

- **Frontend** — React 17 + Umi 3 + TypeScript with Ant Design; D3 for chart drawing, Babylon.js / Three.js for 3D, Plotly for astrocartography maps, and Monaco for editing AI-export templates
- **Backend** — Java 17 / Spring Boot hosts the core astrology and Chinese-method services; a Python 3.11 service layer wraps Swiss Ephemeris (`pyswisseph`) and the vendored kentang traditional-method engines
- **Desktop shell** — Electron, which starts the local Python/Java services in the background with health checks, and persists window, zoom, and settings state
- **Runtime** — the bundled Python is a pinned python-build-standalone build (reproducible and self-contained), shipped with the VC++ runtime, offline wheels, and the backend jar; a native-dependency gate and a pre-release preflight guard the build
- **Distribution** — an offline NSIS installer targeting Windows 10 / 11 (`x64`) with directory selection and upgrades; `latest.yml`, `.blockmap`, and `SHA256SUMS.txt` accompany the release

## FAQ

**Do I need to clone the repo to use Horosa?**
No. Download `Horosa-Setup-2.6.6.exe` from the latest release.

**Do I need to install Python or Java myself?**
No. The Windows installer carries the runtime the released app needs. The first launch is a little slower while those pieces are extracted and verified locally; later launches reuse the cache.

**Can I choose the install directory?**
Yes. The v2.2.0 Beta installer offers an assisted flow with directory selection, write checks, shortcut repair, and elevation when Windows requires it.

**Why are there other files in the release?**
`latest.yml`, `.blockmap`, and `SHA256SUMS.txt` support the updater and verification flows. For end users, `Horosa-Setup-2.6.6.exe` is the only thing that matters.

**Will updates remove my data?**
No. App replacement and runtime switching update the program and shared runtime; they are not designed to erase your saved charts and cases.

## For Maintainers

Start from the entry point that matches your goal:

- public-facing layout and bilingual portal: [README.md](README.md)
- the full Chinese guide: [README_ZH.md](README_ZH.md)
- desktop bundle and installer internals: [desktop_installer_bundle/README.md](desktop_installer_bundle/README.md)
- project structure: [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)
- clean-machine runtime fix and release notes: [docs/CLEAN_MACHINE_NATIVE_RUNTIME_FIX.md](docs/CLEAN_MACHINE_NATIVE_RUNTIME_FIX.md)
- application source: `local/workspace/Horosa-Web-*/` — frontend in `astrostudyui`, backends in `astrostudysrv` and `astropy`, vendored engines in `vendor`

## Acknowledgements

The lineage matters. Horosa was originally created by **郑大哥**, with auxiliary design work by **荀爽 (Herakleios, 爽哥)**, who released the App and Web versions that made later study, maintenance, and extension possible. This Windows edition builds on that groundwork—adding the delivery layer, runtime packaging, integration, and a great deal of polish—and it would not exist without them. Thanks, too, to everyone who keeps testing, reporting, and fixing things to make Horosa more complete.

Special thanks to [kentang2017](https://github.com/kentang2017), whose long-running, openly shared Python projects power several of Horosa's calculation engines. Upstream projects identified as MIT-licensed retain their license texts in the corresponding vendored directories and `THIRD_PARTY_NOTICES.md`; projects without an explicit open-source license are listed separately, so no license is assumed where none was declared.
