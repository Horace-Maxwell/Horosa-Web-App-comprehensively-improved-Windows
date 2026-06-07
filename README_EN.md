<div align="center">

[简体中文](README_ZH.md) · English

<img src="desktop_installer_bundle/assets/horosa_setup_badge.png" alt="Horosa" width="128" />

# Horosa

**Western astrology and Chinese metaphysics, in one native Windows workstation**

[![Version](https://img.shields.io/badge/version-2.6.3%20beta-b45309?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.3)
[![License](https://img.shields.io/badge/license-AGPL--3.0-dc2626?style=flat-square)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows%2010%2F11-x64-111111?style=flat-square&logo=windows&logoColor=white)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.3)
[![Installer](https://img.shields.io/badge/NSIS-bundled%20runtime-1f6feb?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.3)
[![Stars](https://img.shields.io/github/stars/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/stargazers)

[Download](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-2.6.3.exe) ·
[Portal](README.md) ·
[中文说明](README_ZH.md) ·
[All Releases](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases)

</div>

---

## What Horosa Is

Horosa is a desktop workstation for traditional cosmology. Western astrology—natal reading, the full timing chain, and relationship work—sits beside Chinese systems like Bazi, Ziwei, Qimen, Liuren, and Taiyi, all inside one native Windows application. The point is that you stop juggling a dozen single-purpose web tools, and you never hand-assemble the Python, Java, and ephemeris pieces underneath. You download an offline NSIS installer and open a finished app.

This repository is the Windows delivery of that app: the application source, the shared runtime, the Electron desktop shell, and the publishing flow that turns all of it into a single NSIS installer (`Horosa-Setup-2.6.3.exe`).

## Download

Regular users should go straight to the offline installer and open Horosa like any other Windows app.

**[⬇︎ Horosa-Setup-2.6.3.exe](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-2.6.3.exe)**

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

## New in v2.6.3 beta

**v2.6.3 = a deep polish pass on AI Analysis (chat UX, settings, provider matrix, vision, usage/cost, JSON mode) + Qizheng Siyu "patterns/aspects" now exported and mountable + four deterministic divination methods (Wuzhao / Taixuan / Jingjue / Shenyishu) become mountable + Jieqi chart-style button fix + a wave of stability fixes.** Backend Java touched → `astrostudyboot.jar` rebuilt; chart math is byte-identical to v2.6.2; the v2.6.2 #18 in-place upgrade fix and every v2.6.1-and-earlier feature are retained. **Fixes Windows issue #20** (mounted chat content getting truncated + Solar-Return AI seeing only the natal chart).

- **AI Analysis — chat UX** — code-block copy button + syntax highlighting (highlight.js), auto-scroll pause on user scroll + floating "jump to latest", auto-collapse reasoning when stream finishes + "copy thinking", drag/paste images into the composer, **true AI-generated 6-14 char short title** after the first reply (no truncated intro fluff), in-conversation export (Markdown / JSON / Word), errors shown as Alert with a Retry button, Markdown rendering now includes LaTeX math (KaTeX).
- **AI Analysis — settings & providers** — API Key uses Password input (reveal eye + auto-trims pasted whitespace), connection chip surfaces latency and failure detail in a tooltip, provider "advanced" split into three collapsible groups, provider list switch between card and dense table views, model list auto-fetches when a new provider is saved.
- **AI Analysis — materials / templates / bundles** — full-pane drag-and-drop material upload with a non-blocking batch queue + one-time decision for duplicates, grid/list switch for materials, folder CRUD drawer, template editor with variable inference + live JSON Schema validation + version diff modal, bundle "apply preview".
- **AI Analysis — backend (jar rebuilt)** — usage/cost metering via a new `usage` SSE event across OpenAI/Anthropic/Gemini/Ollama; full Gemini vision support (`inlineData`/`fileData`); **explicit** stop sequences / JSON mode / thinking-level mapping instead of generic pass-through; `isReasoningModel` covers gpt-5/6/7 and o1/3/4/5/6/7.
- **AI Analysis — history tab rework** — compact header, fixed column widths, actions consolidated into an "Export ▾" dropdown; empty state rendered externally.
- **Export/Mount — Qizheng Siyu "patterns" and "aspects" now mounted** — the two right-side Moira panels that were displayed but never exported/mounted are now included (`AI_EXPORT_SETTINGS_VERSION` 22→23 with auto migration).
- **Export/Mount — Wuzhao / Taixuan / Jingjue / Shenyishu now mountable** — four deterministic methods that were already storable but couldn't be mounted into AI analysis; this release closes that gap.
- **Fix — "Jieqi" chart style buttons did nothing** — `<JieQiChartsMain>` was not forwarding `chartStyle`/`dispatch` to the inner `<AstroChartMain>`. Two prop wires restore the buttons.

—— v2.6.2 fixes below (all retained in v2.6.3) ——

**v2.6.2 = every v2.6.1 feature + a definitive fix for the Windows "upgrade install never succeeds" bug (issue #18).** Installer-only patch (NSIS `customUnInstallCheck`); when the *old* (already-installed) uninstaller returns non-zero (Chinese username / Chinese install path + AV-locked file), the installer takes over: force-terminate the leftover app + force-clean only the stale program dir, then continue. User data is never touched.

—— v2.6.1 features below (all retained in v2.6.3) ——

**v2.6.1 polishes the AI-mount full options (a per-technique settings drawer driven by a schema, nothing missed) plus multi-moment / range-scan output, adds a Feng Shui "Bagua Yang-dwelling" method v2 (Ni Haisha, front-end only), and lands a batch of cross-module fixes.** The one backend change forwards `pdYears` in `ChartController.getParams()` → `astrostudyboot.jar` rebuilt; all technique chart math is byte-identical to v2.6.0, and every v2.6.0 and earlier feature is retained.

- **AI-mount full options** — a per-technique "settings" gear drawer (driven by `techniqueMountSettings`'s schema) with content checkboxes, plus a **multi-moment date picker / range scan** for output. Zero-regression rule "default = current": options equal to the default are pruned, so snapshots stay byte-identical.
- **AI-mounted primary-direction years now take effect (backend → rebuilt jar)** — `ChartController.getParams()` (the `/chart` path used by AI-mount) previously dropped `pdYears` + `pdDirect/pdConverse/pdAntiscia/pdTerms`, so the mounted primary-direction options had no effect; now forwarded conditionally (default unchanged) + `_wireRev v9` invalidates the stale ParamHashCache.
- **Feng Shui — "Bagua Yang-dwelling" method v2 (Ni Haisha, front-end only)** — new bagua core / data / naqi-rules modules + compass skins; the default is still the Naqi plate, byte-identical to before.
- **Multi-chart / multi-moment build-out** — astrology progression builders, primary-direction chart/table split, Ziwei / Bazi mounting, and Liuyao three-hexagram full casting + one-click mount.
- **Cross-module fixes** — specialty-chart style switch (an event object was mistaken for the value), the Sanshi "time-space" midpoint chart port fallback (`:9999→:8899`), and theme / layout / dark-mode quick fixes.

Full log on the [v2.6.3 release page](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.3) and the [local release notes](docs/releases/2.6.3.md) (v2.6.2 installer patch at [docs/releases/2.6.2.md](docs/releases/2.6.2.md), v2.6.1 features at [docs/releases/2.6.1.md](docs/releases/2.6.1.md)); previous version v2.6.0 (Bi Fa 100 + Ziwei P0–P2 + Fa Qi Men + western build-out + #16/#17/#18 fixes) at [docs/releases/2.6.0.md](docs/releases/2.6.0.md).

## Under the Hood

- **Frontend** — React 17 + Umi 3 + TypeScript with Ant Design; D3 for chart drawing, Babylon.js / Three.js for 3D, Plotly for astrocartography maps, and Monaco for editing AI-export templates
- **Backend** — Java 17 / Spring Boot hosts the core astrology and Chinese-method services; a Python 3.11 service layer wraps Swiss Ephemeris (`pyswisseph`) and the vendored kentang traditional-method engines
- **Desktop shell** — Electron, which starts the local Python/Java services in the background with health checks, and persists window, zoom, and settings state
- **Runtime** — the bundled Python is a pinned python-build-standalone build (reproducible and self-contained), shipped with the VC++ runtime, offline wheels, and the backend jar; a native-dependency gate and a pre-release preflight guard the build
- **Distribution** — an offline NSIS installer targeting Windows 10 / 11 (`x64`) with directory selection and upgrades; `latest.yml`, `.blockmap`, and `SHA256SUMS.txt` accompany the release

## FAQ

**Do I need to clone the repo to use Horosa?**
No. Download `Horosa-Setup-2.6.3.exe` from the latest release.

**Do I need to install Python or Java myself?**
No. The Windows installer carries the runtime the released app needs. The first launch is a little slower while those pieces are extracted and verified locally; later launches reuse the cache.

**Can I choose the install directory?**
Yes. The v2.2.0 Beta installer offers an assisted flow with directory selection, write checks, shortcut repair, and elevation when Windows requires it.

**Why are there other files in the release?**
`latest.yml`, `.blockmap`, and `SHA256SUMS.txt` support the updater and verification flows. For end users, `Horosa-Setup-2.6.3.exe` is the only thing that matters.

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
