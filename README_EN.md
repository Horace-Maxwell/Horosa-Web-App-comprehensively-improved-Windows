<div align="center">

[简体中文](README.md) · English

<img src="assets/horosa_setup_badge.png" alt="Horosa" width="128" />

# Horosa 星阙

**Every kind of metaphysics, in one native Windows app**<br />
*把所有玄学放进一个原生 Windows 软件里*

Three workspaces — **Fate (命) · Divination (卜) · Tools (工具)** — **26 primary disciplines, 60+ sub-techniques and schools** (full catalog in [What's Inside](#3-whats-inside))

[![Version](https://img.shields.io/badge/version-3.13.0-2ea043?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v3.13.0)
[![License](https://img.shields.io/badge/license-AGPL--3.0-dc2626?style=flat-square)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows%2010%2F11-x64-111111?style=flat-square&logo=windows&logoColor=white)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v3.13.0)
[![Installer](https://img.shields.io/badge/NSIS-bundled%20runtime-1f6feb?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v3.13.0)
[![Stars](https://img.shields.io/github/stars/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/stargazers)

[Download the installer](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/download/v3.13.0/Horosa-Setup-3.13.0.exe) ·
[Chinese portal](README.md) ·
[中文详版](README_ZH.md) ·
[All releases](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases)

</div>

---

## Contents

1. [What Horosa Is](#1-what-horosa-is)
2. [Technology Stack](#2-technology-stack)
3. [What's Inside (Fate / Divination / Tools)](#3-whats-inside)
4. [Download & Install](#4-download--install)
5. [Run the Web Version from Source](#5-run-the-web-version-from-source)
   - [5b. Terminal · MCP · REST (hand Horosa to an AI)](#5b-terminal--mcp--rest-hand-horosa-to-an-ai)
6. [FAQ](#6-faq)
7. [License & Third-Party Notices](#7-license--third-party-notices)
8. [Acknowledgements](#8-acknowledgements)
9. [Documentation & Entry Points](#9-documentation--entry-points)

---

## 1. What Horosa Is

Horosa is a desktop workstation for metaphysics and divination that puts almost every traditional art inside a single native Windows application. Western astrology (natal charts, the full timing chain, relationship charts) sits next to the Chinese systems (Bazi, Ziwei, Qimen, Liuren, Taiyi, Liuyao, Feng Shui, Qizheng Siyu), Vedic astrology, Hellenistic astrology, Hamburg-school quantitative charts, Tarot, geomancy and more — with built-in multi-LLM AI analysis on top.

The goal: **stop hopping between a dozen single-purpose web chart calculators, and never hand-assemble the Python / Java / ephemeris runtime underneath.** Download one offline installer and open a finished app.

This repository is the Windows delivery of that app: the application source, the shared runtime, the Windows adaptation layer, and the offline NSIS installer for end users (`Horosa-Setup-3.13.0.exe`).

- **Current version**: 3.13.0 (runtime `3.13.0-runtime1`)
- **Platform**: Windows 10 / 11 (`x64`)
- **License**: AGPL-3.0-only

### Screenshots

<table>
<tr>
<td width="50%"><img src="assets/screenshots/horosa-astrology-workspace.png" alt="Astrology workspace" /><br/><sub><b>Astrology (Western natal chart)</b> — chart parameters and school presets on the left, the wheel canvas in the center, and Info / Aspects / Planets / Classical / Patterns tabs on the right.</sub></td>
<td width="50%"><img src="assets/screenshots/horosa-bazi-workspace.png" alt="Bazi workspace" /><br/><sub><b>Bazi</b> — simple / detailed / classical plates, five-element strength, pattern and useful god, monthly commander, with linked major luck / annual / monthly / daily periods.</sub></td>
</tr>
<tr>
<td width="50%"><img src="assets/screenshots/horosa-vedic-vargas.png" alt="Vedic divisional charts" /><br/><sub><b>Vedic astrology</b> — D1–D60 divisional charts side by side, South / North / East Indian styles, Chitrapaksha ayanamsa, and Shashtiamsa dignities.</sub></td>
<td width="50%"><img src="assets/screenshots/horosa-primary-directions-sphere.png" alt="Primary directions sphere" /><br/><sub><b>Primary directions · celestial sphere</b> — ecliptic / equator / horizon / meridian / prime vertical rendered in 3D, with an event timeline that looks up table rows by age.</sub></td>
</tr>
<tr>
<td width="50%"><img src="assets/screenshots/horosa-astrocartography.png" alt="Astrocartography" /><br/><sub><b>Astrocartography (ACG)</b> — planetary ASC / MC / DSC / IC lines projected on a world map, equidistant projection and switchable house systems.</sub></td>
<td width="50%"><img src="assets/screenshots/horosa-planetarium.png" alt="Planetarium" /><br/><sub><b>Planetarium</b> — ground-observer and celestial-sphere modes, real-time stars, obliquity, sidereal time, a Babylon.js 3D sky.</sub></td>
</tr>
<tr>
<td width="50%"><img src="assets/screenshots/horosa-sanshi-workspace.png" alt="Sanshi United" /><br/><sub><b>Sanshi United</b> — Taiyi / Liuren / Qimen on one screen, the nine-palace plate with Overview / Taiyi / Liuren / Qimen / Ziwei Sihua tabs.</sub></td>
<td width="50%"><img src="assets/screenshots/horosa-qimen-workspace.png" alt="Qimen Dunjia" /><br/><sub><b>Qimen Dunjia</b> — hour-based rotating plate with intercalation, stars / doors / deities / stems in nine palaces, Overview / Shensha / Eight Palaces / Remedies / Useful-god tabs.</sub></td>
</tr>
<tr>
<td width="50%"><img src="assets/screenshots/horosa-liuren-workspace.png" alt="Da Liuren" /><br/><sub><b>Da Liuren</b> — three transmissions, four lessons and the twelve generals, with pattern / Bifa / judgement / imagery / Qizheng readings across schools.</sub></td>
<td width="50%"><img src="assets/screenshots/horosa-liuyao-workspace.png" alt="Liuyao Najia" /><br/><sub><b>Liuyao (Najia)</b> — original / changed / hidden / nuclear hexagrams, dynamic intervening lines by Shi-Ying position, with casting / verdicts / question types / hexagram texts.</sub></td>
</tr>
<tr>
<td width="50%"><img src="assets/screenshots/horosa-geomancy-workspace.png" alt="Astrological geomancy" /><br/><sub><b>Astrological geomancy</b> — the sixteen figures in a shield chart: mothers / daughters / nieces / judge / reconciler, with planet-in-house readings.</sub></td>
<td width="50%"><img src="assets/screenshots/horosa-almanac-workspace.png" alt="Almanac" /><br/><sub><b>Almanac (Huangli / Tongshu)</b> — traditional suitable / unsuitable activities, duty deity and mansion, Pengzu taboos, auspicious and inauspicious spirits, clash directions, fetal-god position, and date selection.</sub></td>
</tr>
</table>

<div align="center">
<img src="assets/screenshots/horosa-navigation-overlay.png" alt="Navigation overlay" width="900" />
<p><em>Navigation overlay — charts & timing, Yi & Sanshi, and tool workbenches grouped together, with search and recents.</em></p>
</div>

---

## 2. Technology Stack

| Layer | Technology | Notes |
| --- | --- | --- |
| Desktop shell | **Electron** | Native shell: lifecycle / windows / runtime bootstrap / in-app updates (incremental download + Ed25519 signature check) / zoom persistence; the offline runtime ships inside the package |
| Frontend | **React 17 + UMI 3 + TypeScript / JS**, Ant Design | D3 chart drawing, Babylon.js / Three.js 3D, Plotly astro-maps, Monaco editor for AI export templates |
| Backend (business) | **Java 17 / Spring Boot 2.7** (multi-module Maven) | Hosts the core astrology and Chinese-method services; listens on `:9999` (request bodies RSA-encrypted); heavy computation is forwarded to Python |
| Backend (computation) | **Python 3.11+** (the desktop package bundles 3.11) | Wraps Swiss Ephemeris (`pyswisseph`) + flatlib (modified) + vendored traditional-method engines; CherryPy REST on `:8899` |

**Port conventions**: frontend ↔ Java `:9999` (RSA-encrypted envelope); Java ↔ Python `:8899`; the frontend's static port is allocated dynamically (multiple instances never collide).

---

## 3. What's Inside

The navigation groups every module under three headings: **Fate (命)** — charts and timing, **Divination (卜)** — the Yi and the Three Formulae, and **Tools (工具)**. Module names map one-to-one onto the tabs inside the app.

### Fate (命) · Charts and Timing

The strength of this layer is continuity: read a natal chart, walk it forward through time, then bring in a second person — all on the same surface.

#### Astrology (Western natal chart)
- Tropical / sidereal natal charts; chart parameters on the left, a D3 wheel in the center, multi-tab details on the right.
- **One-click school presets** (plus custom): Brennan / Valens / Ptolemy / Dykes / Houlding / Zoller — each preset sets zodiac, house system, bounds and triplicities together; the default Brennan preset is the zero-regression baseline.
- **Zodiacs**: tropical plus many sidereal ayanāṃśas (mainstream Indian family / true-star calibrated / Western sidereal / galactic / historical Babylonian + epochs).
- **House systems**: Whole Sign, Alcabitius, Koch, Porphyry, Equal, Meridian, Sunshine, Pullen SD/SR, APC, Whole Sign from the Part of Fortune, and more.
- **Bounds**: Egyptian (default) / Ptolemaic / Lilly. **Triplicities**: Dorothean (default) / Ptolemaic / Ptolemaic water variant.
- **Classical parameters** (the "Classical" tab): sect, out-of-bounds, planetary joys, hayz, feral, lunar mansions, Thema Mundi, derived houses, eminence, klimata.
- **Right-hand tabs**: Info / Aspects / Planets (+ Hellenistic Lots) / Classical / Possibilities / Patterns / Egyptian.
- **3D chart** (Babylon.js, same data source as the 2D wheel), **astro-map / astrocartography (ACG)** with map point picking.
- **AI / storage**: the bottom quick dock jumps to each timing technique; multiple snapshot types; save as a chart record, add notes.

#### Timing (the directions hub)
- **Primary directions**:
  - **Methods (arc algorithms)**: Ptolemy (semi-arc proportion, default) / Alcabitius / Meridian / Porphyry / Equal (ecliptic) / Equal (hour circle) / Placidus / Regiomontanus / Campanus / Topocentric / Morinus / Horizontal / Koch / Along-Ecliptic / Edmund Jones and more, each implemented from its geometric definition; where the two readings really differ, a method is offered as "(improved)" (strict spherical geometry, default) and "(classic)" (the traditional program convention).
  - **Direction types**: in zodiaco (default) / in mundo (each method's own mundane position, with mundane meridian / horizon parallels and rapt parallels) / field plane.
  - **Point and direction settings**: aspect side, ignore significator / promissor latitude, traditional converse, lunar parallax, true position, aspect-point latitude (five modes), date year length, fixed-star promissors; settings with no effect in the current combination are greyed out with the reason.
  - **Motion**: direct / converse / both; **promissors**: antiscia / terms (bounds).
  - **Time keys (38)**: Ptolemy (default), Naibod, Cardano, Umar, Wöllner, Plantiko, true solar arc, Simmonite, Kepler, Brahe, ascendant-arc / vertical-arc timing and more, each implemented from its definition, plus 7 "(classic)" traditional variants.
- **Other timing techniques** (each on its own sub-page or tab): solar arc, Firdaria, profections, solar return, lunar return, decennials, decennial segments, zodiacal releasing, planetary ages, Vedic progressions, Jaynes secondary progressions, planetary arc, Persian directions, the 129-year system, Balbillus, triplicity lords, key points, lunar-phase progressions, other returns, prenatal syzygy, the secondary-progression hub, return timeline, distributions, age-point, and the ephemeris.

#### Bazi (Four Pillars)
- Four-pillar charting runs on the frontend's local engine; ten gods, five-element strength, stem and branch readings on two layers.
- **School selector for interpretation**: classic synthesis (default) / support-restrain / pattern / seasonal adjustment / disease-remedy / blind school / Nayin classical.
- **Reading layers**: life-palace numerology, five-element prosperity, patterns (regular / variant / miscellaneous), three schools of useful god (support-restrain / pattern / seasonal adjustment + disease-remedy / mediation), monthly commander, complete Shensha, nominal / actual age, blind-school structure, Nayin classical plate.
- **Timing**: major luck / annual / monthly / daily / hourly / minor luck (Cartesian combinations of several period levels); the Shensha panel follows the selected period.

#### Ziwei (Purple Star astrology)
- Twelve-palace natal chart (default output is byte-for-byte stable; any variant switch runs the frontend's local engine as a second path).
- **Sihua (four transformations) schools**: common Feixing (default base table) / Quanshu lineage / Zhongzhou school / Northern school · general Feixing / Feixing school / Tou school.
- **Divergence switches**: major-limit span, Tianma basis, star set, three plates, Tianshang / Tianshi (fixed / yin-yang swap), leap month, late Zi hour, year boundary, Huo / Ling (triple-harmony / Southern school), Kong / Jie naming.
- Heaven / Earth / Human plates, localized patterns (with verdicts / sources / breaking conditions), a long-life label layer.
- **Timing (luck periods)**: major limit / annual (incl. minor limit) / monthly / daily / hourly; stacked Sihua cards up to 3 layers (self-transformation only when no period is selected).

#### Qizheng (Qizheng Siyu / Guolao)
- The 28-mansion degree system + the seven governors (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn) + the four remainders (Rahu / Ketu / Ziqi / Yuebei).
- **Two engines**: Horosa's own / Kinastro (Qizheng). **Mansion degree systems**: true sidereal / classical tables / equatorial tropical.
- Dignities, transformations, true / mean nodes, Yuebei true / mean apogee, exaltation degrees, time-telling star in true / mean / apparent solar time.
- **Major limits**: Dongwei (co-rotation) / Yumao (classical progressive). Natal and annual Shensha. Three plate views (ring major-limit plate / curated plate / Qizheng diagram).

#### Vedic astrology (Jyotish)
- North / South / East Indian chart styles with clockwise / counter-clockwise mirroring; many house systems and the same ayanāṃśa family as the Western module.
- **Vargas**: D1 Rashi … D60 (mainstream divisional charts + a divisional grid).
- **Dashas**: Vimshottari (default, 120 years) + Yogini (36) / Ashtottari (108) / KP (180); mahadasha / antardasha / third-level sub-periods; Naisargika natural dasha.
- Automatic Yoga detection, 27 Nakshatras, Shadbala, Ashtakavarga, Vimsopaka, KP (true Placidus system with corrections), Tajika / Argala / Gochara, Muhurta / Choghadia electional timing, octants, six-seat progressions, multi-school toolkits.

#### Auxiliary charts
- **Quantitative / Hamburg school**: four schools = classic / pure / Uranian (American symmetrical) / cosmobiology; 90° (or 45°) dial (22 dial bases), midpoint trees, midpoint aspects, midpoints in right ascension / declination, a formula solver with a focus factor, six-house frames, graphic ephemeris, trans-Neptunian points (TNPs), a secondary-progression layer, rectification, cosmogram.
- **Hellenistic**: the thirteen-division chart (13th harmonic; bounds / Arabic parts).
- **Twelfth-parts, astrocartography / relocation chart, harmonic charts (N-th), Draconic chart, horary charts (five schools), electional charts, mundane charts.**

#### Relationship charts
- Comparison (bi-directional aspects / midpoints / antiscia) / composite (a third chart from midpoints) / synastry (inner and outer rings) / time-space midpoint / Marks chart, plus quantitative relationship scoring.

#### Numerology (Shushu)
- Shaozi Shenshu / Tieban Shenshu (the "hooking" method + major luck) / Guigu Fendingjing (two-headed pincers) / Beiji Shenshu / Nanji Shenshu / Chunzi Shu / Shaozi Canping Shu (golden lock and silver key) / Heluo Lishu (pre- and post-heaven trigrams with line texts).

#### Other (Fate)
- Yanqin / Wanhua Xianqin (three palaces / star-bird / devouring); Cetian Feixing (18 stars, two schools: book method / original method).

### Divination (卜) · The Yi and the Three Formulae

The Yi and the Three Formulae are more than independent tabs: Sanshi United is a genuinely working integrated surface.

#### Sanshi United (the Three Formulae together)
- Qimen + Taiyi + Liuren presented on one surface, **same input, same result and same rich display** as each standalone page.
- Quick tabs: Overview / Taiyi / Liuren / Qimen (right-hand rich display aligned with the standalone pages); every school option matches the standalone page (local Qimen plate methods of each lineage, monthly-formula plate setting, Taiyi time basis).

#### Qimen Dunjia
- Plate-setting methods (intercalation / split-and-supplement / Maoshan / no-leap / yin-plate by number); plate styles (rotating / flying / hybrid); hour / day / month / year formulae; void and post-horse (day / hour); duty envoy.
- Useful-god selection (basic + lookup + generation/control classes); eight-palace panel.

#### Da Liuren
- Four lessons, three transmissions + the 64 lesson classics (lesson bodies).
- Five noble-person methods, three monthly-general schools, three day/night divisions, harm-involvement selection (with boundary conventions), major patterns, minor situations, Bifa (a 64-lesson matching library), a Qizheng Siyu sub-page.
- **AI / storage**: school-aware mounted snapshots (with export supplements).

#### Liuyao (Najia hexagrams)
- A full-layer engine; **school presets + custom**: general / Zengshan Buyi · Yehe / Bushi Zhengzong / Yiyin / Shao Weihua's new school / blind school / custom.
- Casting methods: coins / yarrow stalks / time (Meihua) / numbers / manual; verdict settings (question type / monthly break / earth long-life / changing-line range / hexagram body / flying-hidden / changed-hexagram installation / Shensha / six beasts / year boundary); original / nuclear / changed / inverse / reversed hexagrams.

#### Taiyi (Taiyi Shenshu)
- Accumulated years for the reckoning deity (several classical constants); plate styles (hour / year / month / day / minute reckoning + fate-method layouts); host–guest reckoning geometry (default / plus one palace / without); pattern win-lose; field allocation; the deities' reckonings (several numerical classes).
- **School overlay layer** (multi-axis switches, derived purely on the frontend); fate-method specialization; major and minor limits. Palace highlighting + pattern lines + click-through panels.

#### Solstices & Equinoxes (solar-term chart)
- The 24-solar-term chart + tropical / sidereal planetary positions + solar-term times.

#### Feng Shui
- **Two families, eight schools**: floor-plan residential (Naqi plate method / Bagua residential method); compass-based Liqi charting (Bazhai · Da Youmian / Xuankong Feixing / Sanhe · twelve-stage water method / Jinsuo Yuguan / Qiankun Guobao / Zibai Feixing).
- Advanced Xuankong (replacement trigram with inclined facing / city gate / seven-star robbery / monthly stars); period / sitting-facing / annual & monthly / water mouth / sitting trigram / fate.

#### Other (Divination)
- **Mansion divination** (28 / 27 lunar mansions + mansion lord + Nayin), **Tongshe method** (four images mapped onto the eight trigrams), **Huangji Jingshi / Huangji Guice** (four casting methods + a time-space plate), **Wuzhao** (five plate methods + five division methods), **Taixuan** (the 81 heads of the Taixuan Jing with stalk casting + reading depth), **Jingjue**, **Shenyishu**.
- **Feigong** (flying-palace charting), **Xiaochengtu** (the Great Derivation yarrow method, two- / three-division variants), **Xiao Liuren** (palm six-deity method).
- **Jinkou Jue** (several schools): noble-person systems / monthly-general replacement / plate styles; five movements and three movements / patterns / four-position generation and control / useful gods / Shensha / timing / earth division / void / Nayin.
- **Geomancy (astrological geomancy)**: the sixteen figures in a shield chart (four mothers, four daughters, four nieces + judge + reconciler + two witnesses) / figures in houses / astrological house assignment / perfection and companionship. **Several schools** (classical house assignment / planetary resonance / modern synthesis / Arabic sand divination / Indian dice divination / Sikidy / Hakata); scope L0–L4 / zodiac (classical / planetary) / casting (random / reproducible time seed / manual seed); figure-by-figure meanings.
- **Tarot**: **many decks** (the core four + BOTA / Wirth / Egyptian / Etteilla / Lenormand 36 / Grand Tableau / Kipper 36 / Sibilla 52 / playing cards 52 / Visconti / Minchiate 97); **many spreads**; reading methods (yes-no / quintessence / life card / year card / counting chains / composite narrative); variants A/B/C / reversals / one seed gives the same result across schools.

### Tools (工具) · Workbenches

#### AI Analysis
- **Multi-LLM access**: OpenAI / DeepSeek / Anthropic / Gemini / OpenRouter / Ollama (local) / Moonshot (Kimi) / Zhipu / SiliconFlow / Groq / xAI / any custom OpenAI-compatible endpoint.
- **Thinking / reasoning levels** (off / low / medium / high / xhigh / max), mapped per protocol family (Anthropic thinking budget / OpenAI reasoning effort / Gemini thinking config); vision-capable models are detected automatically.
- Streaming chat (SSE, stoppable) + conversation history + a materials library (RAG: chunking / vector embeddings / retrieval / keyword + vector re-ranking).
- **Technique mounting**: every chart-type and case-type technique, plus techniques castable from a casting time; one click mounts them all.
- **Structured export**: filter sections by technique / tab; md / html / json / csv / pdf / docx.

#### Planetarium
- Real-time 3D sky on Babylon.js. **Pure astronomy**: it borrows only the house frame and applies no sidereal (precession) offset.
- Sun, Moon, planets + lunar nodes + planetary tracks; Chinese asterisms (the 28 mansions in four symbols / the three enclosures / the Big Dipper / asterisms / the Milky Way, always on their real stars); the 88 Western constellations + IAU boundaries + star names; four coordinate grids (horizon / equatorial / ecliptic / mansion degrees); scale overlays; poles and the precession circle / the analemma; magnitude filter (1.0–6.5, default 4.0); click to read coordinates / angular-distance measurement / rise, transit and set times (Bennett atmospheric refraction).

#### Almanac
- Lunar calendar dates / 24 solar terms / date selection / suitable and unsuitable activities.

#### Database
- A built-in catalog of high-confidence celebrity charts (tens of thousands of A/AA-rated birth records), fully offline with sub-second search: keyword / sign / gender / birth year / rating / category filters and sorting.
- Each entry shows a zodiac wheel (counter-clockwise, increasing longitude), life events and category tags; **one click adds it to chart management** — import any celebrity into your local chart library and cast it directly on the astrology / Bazi / Ziwei pages.

#### History of Chinese Metaphysics
- Built on public-domain classics (the Twenty-Four Histories, the Taiping Guangji and others): a compilation of figures, stories, the lineages of the arts and celestial-event records (thousands of events and tens of thousands of observations).
- An offline historical map of China + a force-directed relationship graph + a chronological timeline, searchable by dynasty / discipline / person; any historical moment can be sent straight into a chart, with the original classical text available for cross-checking.

#### Reference
- Trigram imagery / the twelve chained palaces / quick Bazi rule lookups; a true-solar-time calculator.

### Cross-technique capabilities

- **Local storage**: chart records and case records are saved locally (tags, snapshots, raw structured backend data), with JSON import / export and full state restore on reopen.
- **Chart notes** (memo), the charting configuration drawer (aspect selection / orbs / displayed bodies / chart components / chart distribution), and a small-tools drawer.

---

## 4. Download & Install

Regular users should go straight to the offline installer and open Horosa like any other Windows app.

**[⬇︎ Horosa-Setup-3.13.0.exe](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/download/v3.13.0/Horosa-Setup-3.13.0.exe)**

Best for:

- Windows 10 / 11 on `x64`
- weak-network or fully offline environments
- a first install, or forwarding the package to someone else
- anyone who wants the first launch to work without a separate runtime download

You do not need to install Python or Java yourself — the runtime ships inside the package. Updates replace the program and the shared runtime; they are not designed to touch your saved charts and cases. In-app updates are incremental: components that did not change are reused, so a typical upgrade downloads only the parts that actually changed.

> The installer is not yet Authenticode-signed, so on first launch Windows SmartScreen may say "Windows protected your PC" — choose "More info → Run anyway" to continue; you can verify the installer against the official `SHA256SUMS.txt`.

---

## 5. Run the Web Version from Source

Skip the installer and run Horosa as a local web app straight from the source tree (for developers or anyone who prefers the source):

- **Start**: double-click `local\Horosa_Local_Windows.bat` in the repo — it opens the browser within seconds when a build already exists; on first run it auto-provisions the bundled Python / Java / Node runtime and builds (Mongo / Redis are optional for this product and skipped by default). It serves web `8000` / chart `8899` / backend `9999` on `127.0.0.1`, auto-switching to free ports if any are taken.
- **Stop**: return to the console window it opened and press Enter, or just close it (the script only reclaims processes carrying this product's fingerprint — it never touches other software). Set `HOROSA_NO_BROWSER=1` to skip auto-opening the browser.
- **First-run SmartScreen**: the unsigned script may trigger a Windows prompt — choose "More info → Run anyway".
- **Git Bash / WSL users**: the product source also ships `start_horosa_local.sh` / `stop_horosa_local.sh` (same services, cross-platform).

---

## 5b. Terminal · MCP · REST (hand Horosa to an AI)

Every Horosa AI tool (records, chart casting, synastry data, election by school, the celebrity database, history-of-metaphysics (Xuanshi) search …) can be driven by an external AI client or a local script — on Windows this is provided by the desktop app, under **AI Analysis › Advanced › External connections**:

- **Hand it to an AI (MCP)**: turn on the external-agent connection; the panel copies a ready-made configuration for Claude Desktop / Claude Code / Codex and similar clients (the token is fetched only when you copy, never exposed through status).
- **Terminal**: install the `horosa` terminal command with one click (added to your user PATH, removable at any time), then from any terminal: `horosa status` / `horosa tools` / `horosa call <tool> k=v …` / `horosa records <name>` … (`--json` for machine-readable output).
- **REST**: turn on the REST interface and local scripts can call the same tools at `http://127.0.0.1:<port>/api/v1` (OpenAPI generated live; same port and token as MCP).
- Approval and limits follow the external-client policy: writes need confirmation and can be undone, deletion is never exposed; long calls report progress and can be cancelled.
- The no-app headless one-command deployment (`./horosa setup` / `./horosa start`) and the batch-validation runtime bundle target macOS / Linux; on Windows use the desktop connections above, or run the batch-validation bundle inside WSL2 (Ubuntu 24.04 / Debian 12).

## 6. FAQ

**Do I need to clone the repository to use Horosa?**
No. Download `Horosa-Setup-3.13.0.exe` from the latest release.

**Do I need to install Python or Java myself?**
No. The Windows installer carries the runtime the released app needs. The first launch is a little slower while those pieces are extracted and verified locally; later launches reuse the cache.

**Why are there other files in the release?**
`latest.yml`, `.blockmap`, `SHA256SUMS.txt` and `horosa-update.sig` support the in-app updater and verification. For end users, `Horosa-Setup-3.13.0.exe` is the only thing that matters.

**Will updates remove my data?**
No. Application and runtime updates replace the program and the shared runtime; they are not designed to erase your saved charts and cases.

**Can I choose the install directory?**
Yes. The installer offers an assisted flow with directory selection, write checks, shortcut repair, and elevation when Windows requires it.

**Windows says "Windows protected your PC" (SmartScreen). Is the download unsafe?**
The installer is not Authenticode-signed, so SmartScreen shows an "Unknown publisher" notice on fresh downloads. Verify your download against `SHA256SUMS.txt` from the release page, then click **More info → Run anyway**. In-app updates are additionally protected by an Ed25519 signature check that refuses any tampered package.

**My antivirus quarantined part of the app, or it says a local service failed to start.**
Some antivirus products occasionally flag the bundled Python/Java runtime. Add the install folder and `%LOCALAPPDATA%\HorosaDesktop` to your antivirus allowlist, restore anything quarantined, and relaunch — or simply reinstall. When the app can tell, its error screen names the blocked directory so you know exactly what to allow.

**Charts fail while a system proxy (DevSidecar / Clash …) is on.**
From this version on, calls between Horosa's own local services always go direct and never through the system proxy (AI providers and web search still use the proxy as before), so charts work with a system proxy turned on; if something still fails, restart Horosa once.

**How much disk space do I need, and does the install path matter?**
Have at least 6 GB free when installing (~2 GB program, ~1.4 GB runtime extracted on first launch, plus caches). Keep the install path under 100 characters and avoid drive roots or system folders — the installer enforces both and suggests a dedicated folder such as `C:\Horosa`.

**Does Horosa work fully offline?**
Yes. Every computation runs locally; no internet is needed to install or use it. The network is only touched to check GitHub for updates — if that is unreachable, the app simply keeps working, and you can update manually by downloading a newer installer. (Advanced: the `HOROSA_UPDATE_FEED_URL` environment variable points the updater at a custom feed.)

**Does it run on ARM laptops (Snapdragon)?**
Windows 11 on ARM runs Horosa through the system's built-in x64 emulation — fully functional, slightly slower than native x64. Windows 10 on ARM has no x64 emulation and is not supported; the installer detects this and says so instead of leaving a broken install.

**Does it work on Windows S-mode or company-managed PCs?**
Windows S-mode only allows Microsoft Store apps and blocks side-loaded installers (including Horosa's setup itself) — a system-level restriction; switch out of S-mode (Settings → Activation) before installing. Enterprise AppLocker / software-restriction policies behave the same way; ask your IT admin to allow the app.

**Does my Windows display language or region affect anything?**
No. Install and use are locale-independent by design: any system language, Turkish/Thai/Arabic regional settings, legacy GBK/Shift-JIS code pages, the "Beta: UTF-8 worldwide" option, and non-ASCII Windows user names all work. Blocking installer errors are shown in Chinese plus a short English line.

---

## 7. License & Third-Party Notices

- **This project**: [AGPL-3.0-only](LICENSE).
- **Legal & privacy**: Terms of Service / Privacy Policy / Security / Network / Open-source notices — see [docs/legal](docs/legal/) (Chinese and English).
- **Third parties**: the complete list with license texts is in [THIRD_PARTY_NOTICES.md](local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/THIRD_PARTY_NOTICES.md).
  - Vendored traditional-method engines: some upstreams declare MIT (license texts kept in the corresponding `vendor/*/LICENSE`); some upstreams declare no license — these are listed separately and no open-source license is assumed for them.
  - Celestial reference data from d3-celestial (BSD 3-Clause; constellation lines / IAU boundaries / Chinese three-enclosure derivations).
  - flatlib (modified).
  - Swiss Ephemeris (`pyswisseph`).

---

## 8. Acknowledgements

The lineage matters. Horosa was originally created by **郑大哥**, with **荀爽-Herakleios** contributing to the design, and they released the related App and Web versions so that others could study, learn from and extend them. This Windows edition stands on the Horosa system, the divination workflows and the spirit of open sharing they established, and continues the work: Windows delivery, runtime packaging, feature integration and experience refinements.

Special thanks to [kentang2017](https://github.com/kentang2017) for the long-running, openly shared Python projects on traditional Chinese divination — Horosa integrates or adapts several of their calculation engines. Upstreams identified as MIT-licensed keep their licenses in [`THIRD_PARTY_NOTICES.md`](local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/THIRD_PARTY_NOTICES.md) and the corresponding vendored directories; projects without an explicit open-source declaration are listed separately, so no license is assumed where none was declared. Thanks as well to everyone who keeps testing, reporting and fixing things to make Horosa more complete.

---

## 9. Documentation & Entry Points

- Runtime-prep scripts (with the bundled VC++ runtime): [`prepareruntime/`](prepareruntime/); Windows adaptation layer (Windows-only patches and release sentinels): [`windows-adaptations/`](windows-adaptations/)
- Community documents: [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) · [SUPPORT.md](SUPPORT.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- Legal & privacy: [docs/legal](docs/legal/) (Terms of Service · Privacy Policy · Security · Network · Open-source notices)
- Third-party licensing: [THIRD_PARTY_NOTICES.md](local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/THIRD_PARTY_NOTICES.md)
- Application source: [`local/workspace/Horosa-Web-…/`](local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/) — frontend in `astrostudyui`, backends in `astrostudysrv` and `astropy`, vendored engines in `vendor`, ephemeris in `flatlib-ctrad2`
- Language editions: [README.md](README.md) (Chinese portal) · [README_ZH.md](README_ZH.md) (Chinese guide)
