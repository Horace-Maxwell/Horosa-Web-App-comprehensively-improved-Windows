<div align="center">

# Horosa for Windows

### A desktop metaphysics workstation for Windows, delivered through an installer with runtime included

[![Latest Release](https://img.shields.io/github/v/release/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?display_name=tag&sort=semver)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11%20x64-0078D4)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
[![Primary Download](https://img.shields.io/badge/download-setup%20exe-2ea043)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
[![Runtime](https://img.shields.io/badge/runtime-bundled%20with%20installer-6f42c1)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)

[Portal](README.md) | [Chinese Guide](README_ZH.md) | [Latest Release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)

</div>

## Why Horosa Feels Different

Even though this repository looks packaging-heavy, what it delivers is not a thin installer shell. What users install is already a feature-dense metaphysics workstation that brings Western astrology, timing systems, relationship analysis, Chinese traditional methods, Yi and Sanshi workflows, Feng Shui, and export-oriented reading into one desktop surface.

That is the real story of the Windows repository. The installer matters, but the stronger claim is that the software behind it already feels broad, layered, and product-like.

## What You Can Actually Do

<table>
  <tr>
    <td width="50%">
      <strong>As an end user</strong><br />
      Download the Windows installer, complete the standard setup flow, and open Horosa without manually assembling runtime dependencies.
    </td>
    <td width="50%">
      <strong>As a maintainer</strong><br />
      Use the same repository to inspect packaging, self-check scripts, versioned release docs, and the installer-side workspace behind the public delivery channel.
    </td>
  </tr>
</table>

Primary entry:

- [Horosa-Setup-1.1.2.exe](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-1.1.2.exe)

Why this path is the recommendation:

- one clear public install entry
- runtime bundled with the installer
- closer to the expected Windows desktop software experience

## Preview

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

## Signature Workflows

### Natal To Timing

Horosa already supports a continuous predictive flow on Windows. Users can start with natal and 3D chart reading, then move into primary directions, zodiacal releasing, firdaria, profection, solar arc, returns, and annual methods without leaving the same desktop product.

### Relationship Analysis

The relationship layer is broader than a single compare screen. It already includes compare, composite, synastry, time-space midpoint, and Marks charts as parallel ways to inspect the same relationship from different structural angles.

### Chinese Traditional Stack

Bazi, Ziwei, calendar, Feng Shui, and supporting references are already part of the same desktop environment, which makes Horosa feel like a broader Chinese traditional stack rather than a single-method utility.

### Yi And Sanshi Depth

Yi and Sanshi go beyond standalone tabs. Horosa already includes Su Zhan, Yi Gua, Liu Ren, Jin Kou, Dun Jia, Tai Yi, Tong She Fa, and a deeper Sanshi United surface.

## Implemented Disciplines

### Western Astrology

The strength here is continuity from natal reading to timing and relationship work.

- natal chart and 3D chart
- primary directions, zodiacal releasing, firdaria, profection, solar arc, returns, and annual methods
- compare, composite, synastry, time-space midpoint, and Marks charts

### Global And Specialty Modules

Horosa goes beyond the default packaged desktop astrology stack.

- Jieqi charts
- astrocartography and planetary maps
- Qizheng Siyu, Hellenistic, Indian, and quantitative views

### Chinese Traditional Systems

The Chinese traditional layer is arranged as a genuine system of entrypoints and references.

- Bazi, Ziwei, gua-symbol references, twelve-palace tools, and rule references
- calendar and Feng Shui as first-class modules
- a workspace that allows cross-reading between different traditions

### Yi And Sanshi

This layer gains its depth from the jump between standalone methods and an integrated analysis surface.

- Su Zhan, Yi Gua, Liu Ren, Jin Kou, Dun Jia, Tai Yi, and Tong She Fa
- Sanshi United with overview, Tai Yi, shensha, Liu Ren, major patterns, sub-patterns, references, and Bagong details
- integrated explanatory depth instead of placeholder tabs

### Tools And Export Workflow

Horosa is not only about calculation. It also provides the controls needed for desktop research and export-ready interpretation.

- chart configuration
- aspect selection
- planet selection
- chart components
- utility tools
- AI export
- AI export settings

## Desktop Delivery

On Windows, the focus is installer-first delivery rather than asking users to assemble their own environment.

- Windows 10 / 11 x64
- installer-first public distribution
- runtime included with the installer path
- developer and maintainer tooling kept in the repository, but not required for ordinary users

The point is not “here is some code.” The point is “here is Horosa as a real installable desktop product.”

## Latest Release Docs

- [v1.1.2 Release Notes (English)](docs/releases/v1.1.2-en.md)
- [v1.1.2 Chinese Release Notes](docs/releases/v1.1.2-zh.md)

## FAQ

### Do I Need To Clone The Repository To Use Horosa

No. Regular users should just download the installer from the latest release.

### Do I Need To Install Python Or Java Myself

Not on the intended public install path. The Windows delivery goal is to keep that complexity out of the normal user flow.

### Why Are `START_HERE.bat` And Self-Check Scripts Still In The Repository

Because the repository also serves maintainers. End users use the installer; maintainers use the scripts.

## Developer Entry

If you maintain the Windows delivery flow, start with the path that matches your goal:

- understand the public-facing repository layout: [README.md](README.md)
- read the full Chinese guide: [README_ZH.md](README_ZH.md)
- run verification and self-check: `SELF_CHECK_HOROSA_WINDOWS.bat`
- inspect versioned release notes and publishing context: `docs/releases/`
- enter the installer workspace: `desktop_installer_bundle/`
- inspect the mirrored application source used by packaging: `local/workspace/.../`
