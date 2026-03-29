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

## What You Get

- a standard Windows installer experience
- bundled runtime components instead of a “please install several dependencies first” workflow
- desktop and Start menu entrypoints
- repository-side verification and release documentation for maintainers

## Why There Is Only One Recommended Download

Like the macOS repo, the Windows repo should not force ordinary users to decode internal release assets. The public-facing answer should be obvious: download the installer from the latest release and run it.

## Visual

![Horosa Windows Installer Badge](desktop_installer_bundle/assets/horosa_setup_badge.png)

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
