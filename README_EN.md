<div align="center">

[简体中文](README_ZH.md) | English

# Horosa for Windows

### v2.0.0 Beta Mac Web parity release for Windows x64, delivered as an installer-first desktop product

[![Latest Release](https://img.shields.io/github/v/release/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?display_name=tag&sort=semver)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
[![License](https://img.shields.io/badge/license-AGPL--3.0-dc2626)](LICENSE)
[![GitHub Repo stars](https://img.shields.io/github/stars/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?style=flat)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/stargazers)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11%20%7C%20x64-black)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
[![Distribution](https://img.shields.io/badge/distribution-NSIS%20Installer%20%2B%20Bundled%20Runtime-1f6feb)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
[![Primary Download](https://img.shields.io/badge/download-setup%20exe-2ea043)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-2.0.0.exe)
[![CI](https://img.shields.io/github/actions/workflow/status/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/ci.yml?branch=main&label=CI)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/actions/workflows/ci.yml)
[![GitHub Discussions](https://img.shields.io/badge/discussions-open-7c3aed)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/discussions)
[![Beta Release](https://img.shields.io/badge/v2.0.0%20Beta-Mac%20Web%20Parity-0f766e)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.0.0)
[![Runtime](https://img.shields.io/badge/runtime-2.0.0--beta--windows--bundle-2563eb)](desktop_installer_bundle/README.md)
[![Security](https://img.shields.io/badge/security-policy-dc2626)](SECURITY.md)
[![Support](https://img.shields.io/badge/support-discussions%20%26%20email-4b5563)](SUPPORT.md)
[![Citation](https://img.shields.io/badge/citation-CFF-a855f7)](CITATION.cff)
[![Contributing](https://img.shields.io/badge/contributing-guide-0891b2)](CONTRIBUTING.md)

[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-3f3f46?logo=github&logoColor=white&labelColor=52525b)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows)
[![GitHub Releases](https://img.shields.io/badge/GitHub-Releases-1d4ed8?logo=github&logoColor=white&labelColor=52525b)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases)
[![Read In Chinese](https://img.shields.io/badge/Read%20In-Chinese-0f766e?labelColor=52525b)](README_ZH.md)
[![Portal](https://img.shields.io/badge/Portal-Bilingual-0f766e?labelColor=52525b)](README.md)

[Portal](README.md) | [Chinese Guide](README_ZH.md) | [Latest Release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest) | [v2.0.0 Beta release page](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.0.0)

**Current release:** `v2.0.0 Beta`

**Beta note:** this public installer is the v2.0.0 beta package. It is published as the visible current GitHub Release so Windows users can download and test the new unified Web/Desktop build directly.

**Licensing note:** the public repository is distributed under `AGPL-3.0` because the released stack integrates Swiss Ephemeris / `pyswisseph`. Third-party subdirectories keep their own upstream notices.

</div>

## Why v2.0.0 Beta Matters

Horosa v2.0.0 Beta is the major Windows release that brings the comprehensively improved Mac Web product surface into the Windows Web and desktop package. It is not a small calculator fix. It aligns the UI shell, controls, module navigation, frontend pages, Python backend, Java backend, assets, AI analysis flow, export settings, and desktop runtime delivery into one cross-platform line.

The Windows release remains self-contained. The Mac sync source folder is not required at runtime or build time, and clean Windows 10/11 x64 machines do not need users to install Python, Java, Node.js, Maven, or frontend build tools manually.

## Primary Entry

- [Horosa-Setup-2.0.0.exe](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-2.0.0.exe)

Best fit:

- first-time installation on a clean Windows 10/11 x64 machine
- weak-network or offline-forwarding use
- users who want Horosa to open like a finished desktop app
- maintainers preparing the GitHub Release asset set

The first launch can be slower while the bundled runtime initializes. Later launches are optimized around the local runtime cache and should feel much closer to a normal desktop app.

## Preview

<div align="center">
  <p><strong>Horosa v2 Main Workspace</strong></p>
  <img src="docs/assets/screenshots/horosa-2.0-main-workspace.png" alt="Horosa v2 main astrology workspace" width="1200" />
  <p><em>The new XQ shell, chart controls, side inspection panels, quick actions, theme controls, and desktop layout in one screen.</em></p>
</div>

<div align="center">
  <p><strong>Module Navigator</strong></p>
  <img src="docs/assets/screenshots/horosa-2.0-module-navigator.png" alt="Horosa v2 module navigator" width="1100" />
  <p><em>The dark module chooser gives fast access to astrology, timing, Bazi, Ziwei, Qizheng, Indian astrology, auxiliary charts, Sanshi, tools, AI analysis, and the planetarium.</em></p>
</div>

<div align="center">
  <p><strong>Sanshi Workspace</strong></p>
  <img src="docs/assets/screenshots/horosa-2.0-sanshi-workspace.png" alt="Horosa v2 Sanshi workspace" width="1200" />
  <p><em>Sanshi, Liu Ren, Dun Jia, Tai Yi, shensha, Bagong, and related detail panels now share the same Windows desktop shell.</em></p>
</div>

## Updated In v2.0.0 Beta

### Product Shell

- New XQ UI shell with aligned desktop layout
- icon system, navigation structure, module selector, and quick actions
- day/night theme controls
- search, favorites, history, settings, help, AI export, and module routing

### Astrology And Specialty Modules

- natal chart, chart controls, aspect/planet selection, and chart styling
- timing stack: primary directions, zodiacal releasing, firdaria, profection, solar arc, solar/lunar returns, annual methods, and decennials
- relationship stack: compare, composite, synastry, time-space midpoint, and Marks charts
- auxiliary charts, Jieqi, astrocartography, quantitative views, Hellenistic views, Indian astrology extensions, Qizheng Siyu, Qizheng Moira, and planetarium/3D views

### Chinese Traditional And Sanshi Workflows

- Bazi, Ziwei, calendar, Feng Shui, gua-symbol references, twelve-palace tools, and rule references
- Su Zhan, Yi Gua, Liu Yao, Liu Ren, Jin Kou, Dun Jia, Tai Yi, Tong She Fa, and Sanshi United
- Sanshi workspace coverage for overview, Tai Yi, shensha, Liu Ren, major patterns, sub-patterns, references, Bagong details, and exportable snapshots

### AI Analysis And Export

- AI Analysis surface with module context collection
- provider, material, chat, embedding, and stream-capable service paths
- AI export settings for astrology, timing, relationship charts, traditional modules, Sanshi, Qizheng, and Indian astrology
- local module snapshots for export and analysis reuse

### Backend Parity

- Python backend adds `/astroextra`, `/planetarium`, supporting ephemeris paths, Indian astrology extensions, star resources, and planetarium state data
- Java backend adds `/astroextra/*`, `/planetarium/state`, `/qizheng/moira`, and AI Analysis service wiring
- Windows launch and installer logic keep the local bundled runtime path stable

## Desktop Delivery

- Windows 10/11 (`x64`)
- NSIS installer: `Horosa-Setup-2.0.0.exe`
- optional installation directory with directory creation/write validation
- bundled Python, Java, Node/Web assets, and app runtime
- update manifest, blockmap, checksum file, and release notes prepared for GitHub Releases
- shared behavior between Web mode and Windows desktop mode

## Release Assets

The standard GitHub Release asset set is:

- `Horosa-Setup-2.0.0.exe`
- `Horosa-Setup-2.0.0.exe.blockmap`
- `latest.yml`
- `SHA256SUMS.txt`

## Documentation

- [README.md](README.md): bilingual portal
- [README_ZH.md](README_ZH.md): full Chinese guide
- [docs/releases/2.0.0.md](docs/releases/2.0.0.md): local v2.0.0 Beta release notes
- [desktop_installer_bundle/README.md](desktop_installer_bundle/README.md): desktop bundle internals
- [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md): project structure
- [All Releases](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases)

## FAQ

### Do I Need To Clone The Repo To Use Horosa

No. Regular users should go straight to the latest release and download the setup executable.

### Do I Need To Install Python Or Java Myself

No. The public installer path is designed to carry the required runtime setup.

### Can I Choose The Install Directory

Yes. The v2.0.0 Beta installer uses an assisted install flow with directory selection, write checks, and elevation when Windows requires it.

### Why Are There Other Files In The Release

`latest.yml`, `.blockmap`, and `SHA256SUMS.txt` support updater and verification workflows. The setup `.exe` remains the public install entry.

### Will Updates Remove My User Data

No. App replacement and runtime switching are designed to update the program and shared runtime, not erase user data.

## Acknowledgements

This Windows edition is an improved distribution and integration work based on the Horosa App and Web released by Horosa-荀爽（Herakleios）. The lineage matters: Horosa was originally created by 郑大哥, with auxiliary design work from 荀爽（Herakleios）, and their public release made later study, maintenance, and extension possible.

Please do not forget the contributions of 爽哥 and 郑大哥. This repository continues from their groundwork with respect, gratitude, and the hope that Horosa can remain useful to more people over time.
