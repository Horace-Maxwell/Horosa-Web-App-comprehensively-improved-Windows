<div align="center">

[简体中文](README_ZH.md) · English

<img src="desktop_installer_bundle/assets/horosa_setup_badge.png" alt="Horosa" width="128" />

# Horosa

**Western astrology and Chinese metaphysics, in one native Windows workstation**

[![Version](https://img.shields.io/badge/version-2.6.0%20beta-b45309?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.0)
[![License](https://img.shields.io/badge/license-AGPL--3.0-dc2626?style=flat-square)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows%2010%2F11-x64-111111?style=flat-square&logo=windows&logoColor=white)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.0)
[![Installer](https://img.shields.io/badge/NSIS-bundled%20runtime-1f6feb?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.0)
[![Stars](https://img.shields.io/github/stars/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/stargazers)

[Download](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-2.6.0.exe) ·
[Portal](README.md) ·
[中文说明](README_ZH.md) ·
[All Releases](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases)

</div>

---

## What Horosa Is

Horosa is a desktop workstation for traditional cosmology. Western astrology—natal reading, the full timing chain, and relationship work—sits beside Chinese systems like Bazi, Ziwei, Qimen, Liuren, and Taiyi, all inside one native Windows application. The point is that you stop juggling a dozen single-purpose web tools, and you never hand-assemble the Python, Java, and ephemeris pieces underneath. You download an offline NSIS installer and open a finished app.

This repository is the Windows delivery of that app: the application source, the shared runtime, the Electron desktop shell, and the publishing flow that turns all of it into a single NSIS installer (`Horosa-Setup-2.6.0.exe`).

## Download

Regular users should go straight to the offline installer and open Horosa like any other Windows app.

**[⬇︎ Horosa-Setup-2.6.0.exe](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-2.6.0.exe)**

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

## New in v2.6.0 beta

**v2.6.0 adds a Liuren "Bi Fa 100" interpretation layer, a comprehensive Zi Wei Dou Shu P0–P2 enhancement, a Qi Men "Fa Qi Men" overlay, a Western-astrology build-out (mundane / horary / electional / star-transit), professional city search, and fixes three reported issues — #16 (DeepSeek reasoner multi-turn), #17 (casting time), and the Windows-only #18 (in-place upgrade install).** Backend Java changed → `astrostudyboot.jar` rebuilt; all v2.5.5 and earlier features retained.

- **Liuren — "Bi Fa 100" interpretation layer** — imagery, the 100 methods (93 auto-matched + 7 reading-key mnemonics), a divination guide, common shen-sha, three-transmission relation diagrams, timing, and noble-spirit states. Front-end only, wired into the AI four-way sync.
- **Zi Wei Dou Shu — comprehensive P0–P2 enhancement** — the four-transformation chart now shows auxiliary lucky/unlucky stars + the twelve spirits; flow-stars descend to every layer + annual "flow-general/flow-year" markers + minor-limit yin-yang direction toggle; pattern-hit detail expansion + 6 new patterns (34→40); school-specific four-transformation tables (Beipai default / Zhongzhou / custom); Tian-Shang / Tian-Shi (backend → rebuilt jar). Zero regression: the default school is byte-identical, and saved charts don't persist a school field.
- **Qi Men Dun Jia — "Fa Qi Men" (Xun Shuang) overlay** — two new right panels ("resolution" + "use-god") with shen-sha verdict hovers and earthly-branch / palace imagery. Pure front-end, no engine change, no jar rebuild.
- **Western astrology — mundane / horary / electional / star-transit build-out** — a mundane moment pipeline + lunation-phase judgment, electional hard-flags / mundane integration, a horary question guide, plus solar/lunar returns, key degrees, triplicity rulers and more — wired into the AI four-way sync.
- **Professional city search** — traditional⇄simplified (opencc) + pinyin (pinyin-pro) build an offline match index so place selection is more accurate and faster; zero new runtime dependency (data is pre-generated).
- **AI deep-thinking compatibility (fixes #16)** — deepseek-reasoner multi-turn first (uncached) requests no longer fail / return empty. Root cause: (1) the backend dropped `reasoning_content` (a thinking phase that shows nothing looked like a failure); (2) the reasoner was wrongly sent `temperature` (can 400). Fix: pass `reasoning_content` through to a collapsible "thinking" bubble; never send sampling params to reasoning models; the 4 stream sites retry only before the first byte (connection / 429 / 5xx, exponential backoff) and **never retry a stream that already emitted tokens**; the front end adds an idle watchdog (only a true silence is treated as stuck).
- **Casting / chart time refreshes on selection (fixes #17)** — choosing the "casting time / chart time" radio under "select case" now gives you the time **at the moment you click**, not the time the app was opened (which was frozen at component mount).
- **In-place upgrade install fix (#18, Windows-only)** — the installer now **force-closes a running Horosa** (including its embedded Java/Python runtime, scoped precisely by the app's install / runtime path so it never kills the user's other Java/Python) before an over-the-top upgrade, so upgrades no longer hit "Horosa cannot be closed" / "Failed to uninstall old application files" and **no longer require uninstalling the old version first**.

Full log on the [v2.6.0 release page](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.0) and the [local release notes](docs/releases/2.6.0.md); previous version v2.5.5 (planetarium refinements + clickable/searchable stars + smoothness) at [docs/releases/2.5.5.md](docs/releases/2.5.5.md).

## Under the Hood

- **Frontend** — React 17 + Umi 3 + TypeScript with Ant Design; D3 for chart drawing, Babylon.js / Three.js for 3D, Plotly for astrocartography maps, and Monaco for editing AI-export templates
- **Backend** — Java 17 / Spring Boot hosts the core astrology and Chinese-method services; a Python 3.11 service layer wraps Swiss Ephemeris (`pyswisseph`) and the vendored kentang traditional-method engines
- **Desktop shell** — Electron, which starts the local Python/Java services in the background with health checks, and persists window, zoom, and settings state
- **Runtime** — the bundled Python is a pinned python-build-standalone build (reproducible and self-contained), shipped with the VC++ runtime, offline wheels, and the backend jar; a native-dependency gate and a pre-release preflight guard the build
- **Distribution** — an offline NSIS installer targeting Windows 10 / 11 (`x64`) with directory selection and upgrades; `latest.yml`, `.blockmap`, and `SHA256SUMS.txt` accompany the release

## FAQ

**Do I need to clone the repo to use Horosa?**
No. Download `Horosa-Setup-2.6.0.exe` from the latest release.

**Do I need to install Python or Java myself?**
No. The Windows installer carries the runtime the released app needs. The first launch is a little slower while those pieces are extracted and verified locally; later launches reuse the cache.

**Can I choose the install directory?**
Yes. The v2.2.0 Beta installer offers an assisted flow with directory selection, write checks, shortcut repair, and elevation when Windows requires it.

**Why are there other files in the release?**
`latest.yml`, `.blockmap`, and `SHA256SUMS.txt` support the updater and verification flows. For end users, `Horosa-Setup-2.6.0.exe` is the only thing that matters.

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
