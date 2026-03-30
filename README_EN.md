<div align="center">

# Horosa for Windows

### The Windows desktop delivery repository for packaged installation, bundled runtime, and maintainable release docs

[![Latest Release](https://img.shields.io/github/v/release/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?display_name=tag&sort=semver)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11%20x64-0078D4)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
[![Primary Download](https://img.shields.io/badge/download-setup%20exe-2ea043)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)

[Portal](README.md) | [中文](README_ZH.md) | [Latest Release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)

</div>

## What This Repository Is For

This repository is the Windows delivery layer for Horosa. It exists to serve two audiences at once:

- regular users who need a packaged Windows installer
- maintainers who still need packaging, verification, and release documentation

The emphasis here is not “here is some code.” It is “here is the Windows desktop delivery channel that turns Horosa into a real installable product.”

## Why Horosa Is More Than a Single Chart Viewer

Even though this repository looks packaging-heavy, the thing it actually delivers is not a thin installer shell. What users install is already a feature-dense metaphysics workstation that brings Western astrology, timing systems, relationship analysis, Chinese traditional methods, Yi and Sanshi workflows, Feng Shui, and export-oriented reading into one desktop surface.

So the README should not stop at “download the `.exe`.” It should also show that the software behind that installer is already broad, layered, and real.

## What End Users Should Download

Go to the latest release and download:

- `Horosa-Setup-1.1.2.exe`

That is the public install recommendation. The goal is simple: one clear Windows entrypoint, one packaged install flow, no guessing.

## Installation Experience

Recommended steps:

1. Download `Horosa-Setup-1.1.2.exe`
2. Run the installer
3. Complete the setup wizard
4. Open `星阙` from the desktop shortcut or the Start menu

Current delivery profile:

- Windows 10 / 11 x64
- installer-first public distribution
- runtime bundled with the installer path
- developer and maintainer tooling kept in the repo, but not required for ordinary users

## What You Will Actually See in Horosa

- A primary workspace built around natal charting and a dedicated 3D chart view.
- A timing stack that already includes primary directions, a primary direction chart, zodiacal releasing, firdaria, profection, solar arc, solar return, lunar return, annual methods, and decennials.
- A relationship layer with compare, composite, synastry, time-space midpoint, and Marks charts.
- Broader astrology modules including Jieqi charts, astrocartography, Qizheng Siyu, Hellenistic, Indian, and quantitative views.
- Chinese traditional modules including Bazi, Ziwei, gua-symbol references, twelve-palace tools, Bazi rule references, calendar, and Feng Shui.
- An Yi and Sanshi stack covering Su Zhan, Yi Gua, Liu Ren, Jin Kou, Dun Jia, Tai Yi, and Tong She Fa.
- A Sanshi United workspace with overview, Tai Yi, shensha, Liu Ren, major patterns, sub-patterns, references, and Bagong details.
- Workspace-level controls for chart configuration, aspect selection, planet selection, chart components, utilities, AI export, and AI export settings.

## What You Get

- a standard Windows installer experience
- bundled runtime components instead of a “please install several dependencies first” workflow
- desktop and Start menu entrypoints
- repository-side verification and release documentation for maintainers

## Why There Is Only One Recommended Download

Like the macOS repo, the Windows repo should not force ordinary users to decode internal release assets. The public-facing answer should be obvious: download the installer from the latest release and run it.

## Visual

<div align="center">
  <p><strong>Main Workspace</strong></p>
  <img src="docs/assets/screenshots/main-workspace.png" alt="Horosa Main Workspace" width="1200" />
  <p><em>The primary Horosa workspace shipped through the packaged Windows installer, built for chart reading, controls, and everyday desktop use.</em></p>
</div>

<div align="center">
  <p><strong>Sanshi Workspace</strong></p>
  <img src="docs/assets/screenshots/sanshi-workspace.png" alt="Horosa Sanshi Workspace" width="960" />
  <p><em>A more advanced view that spotlights Sanshi workflows and deeper tool-driven analysis inside the Windows desktop release.</em></p>
</div>

## Implemented Disciplines

### Western and global astrology

- Natal chart, 3D chart, and everyday chart-reading workspace
- Predictive stack: primary directions, primary direction chart, zodiacal releasing, firdaria, profection, solar arc, solar return, lunar return, annual methods, and decennials
- Relationship charts: compare, composite, synastry, time-space midpoint, and Marks
- Jieqi charts, astrocartography, Qizheng Siyu, Hellenistic, Indian, and quantitative modules

### Chinese traditional and divination systems

- Bazi, Ziwei, gua-symbol references, twelve-palace tools, and Bazi rule references
- Yi and Sanshi modules: Su Zhan, Yi Gua, Liu Ren, Jin Kou, Dun Jia, Tai Yi, and Tong She Fa
- Sanshi United as an integrated surface with overview, Tai Yi, shensha, Liu Ren, pattern references, and Bagong interpretation details
- Calendar and Feng Shui as first-class desktop modules rather than side utilities

## Research Workflow

The Windows installer changes the delivery layer, not the product ambition. Once installed, Horosa is still meant to feel like a cross-tradition analysis surface where users can move from charting to timing, from relationship work to Chinese methods, and from calculation to export-ready interpretation without leaving the same desktop app.

The current workflow surface already includes:

- chart configuration
- aspect selection
- planet selection
- chart components
- utility tools
- AI export
- AI export settings

## Latest Release Docs

- [v1.1.2 Release Notes (English)](docs/releases/v1.1.2-en.md)
- [v1.1.2 中文版本说明](docs/releases/v1.1.2-zh.md)

## FAQ

### Do I need to clone the repo to use Horosa

No. Regular users should just download the installer from the latest release.

### Do I need to install Python or Java myself

Not on the intended public install path. The Windows delivery goal is to keep that complexity out of the normal user flow.

### Why are `START_HERE.bat` and self-check scripts still in the repo

Because the repository also serves maintainers. End users use the installer; maintainers use the scripts.

## Developer Entry

If you maintain the Windows delivery flow, start with:

- [README.md](README.md)
- [README_ZH.md](README_ZH.md)
- [docs/releases/v1.1.2-en.md](docs/releases/v1.1.2-en.md)
- `START_HERE.bat`
- `SELF_CHECK_HOROSA_WINDOWS.bat`

Key directories:

- `desktop_installer_bundle/`: packaging workspace and installer-side assets
- `docs/releases/`: versioned release documents
- `local/workspace/.../`: mirrored application source used by the Windows packaging flow
