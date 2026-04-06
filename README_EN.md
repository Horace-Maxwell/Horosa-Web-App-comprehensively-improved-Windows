<div align="center">

# Horosa for Windows

### A local-first metaphysics workstation for Windows with a bundled desktop delivery path

[![Latest Release](https://img.shields.io/github/v/release/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?display_name=tag&sort=semver)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/actions/workflows/ci.yml/badge.svg)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/actions/workflows/ci.yml)
[![Stars](https://img.shields.io/github/stars/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?style=social)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/stargazers)

[Portal](README.md) | [Chinese Guide](README_ZH.md) | [Latest Release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)

</div>

## Release Snapshot

- current public release: `v1.2.0`
- primary installer: `Horosa-Setup-1.2.0.exe`
- end users should download from GitHub Releases instead of cloning the source repository

## What Horosa Delivers

Horosa for Windows is not only a packaging shell. It delivers a full workstation that combines:

- Western astrology and timing workflows
- relationship charts and cross-reading surfaces
- Chinese traditional systems and Sanshi depth
- the new `AIAnalysis` workspace with streaming analysis, local history, materials, templates, bundles, provider diagnostics, and backup / restore
- a Windows desktop shell, runtime bootstrap chain, installer, and update path

## Preview

<div align="center">
  <p><strong>Main Workspace</strong></p>
  <img src="docs/assets/screenshots/main-workspace.png" alt="Horosa Main Workspace" width="1200" />
</div>

<div align="center">
  <p><strong>Sanshi Workspace</strong></p>
  <img src="docs/assets/screenshots/sanshi-workspace.png" alt="Horosa Sanshi Workspace" width="960" />
</div>

This release also emphasizes:

- `AIAnalysis - Analysis`
- `AIAnalysis - History`
- `AIAnalysis - Materials`
- `AIAnalysis - Templates`
- `AIAnalysis - Settings`
- the Windows installer / update flow

## What Is New In v1.2.0

- adds the formal `AIAnalysis` workspace entry with five right-side tabs: `Analysis / History / Materials / Templates / Settings`
- upgrades the analysis chain to native streaming behavior and supports stop, regenerate, edit-last-message, and branch sessions
- expands the materials library with full-text search, drag-and-drop upload, replace-file, backup / restore, and large-material RAG handling
- expands history with filters, batch export, batch delete, favorites, archive, and continue-conversation flows
- adds provider presets, model fetch, connection test, health status, and diagnostics to settings
- keeps the shared web frontend for both web and desktop while adding native file / folder / backup IPC on Windows
- fixes the bottom whitespace / scrolling issue under default scaling without breaking existing non-AI workspaces

## AIAnalysis Workspace

`AIAnalysis` is a first-class Horosa workspace, not a lightweight chat overlay. It includes:

- streaming analysis directly from saved chart or case records
- local-first history with search, export, branching, archive, favorites, and batch actions
- a materials library for `.txt/.md/.doc/.docx/.pdf`
- text / JSON templates with variables, versions, and reusable bundles
- provider presets for mainstream protocol families such as OpenAI-compatible, DeepSeek, Anthropic, Gemini, and Ollama / LM Studio
- workspace and material backup / restore

## Capability Snapshot

### Western Astrology

- natal chart, 3D chart, timing stack, returns, solar arc, profections, and firdaria
- compare, composite, synastry, time-space midpoint, and Marks charts

### Chinese Traditional Systems

- Bazi, Ziwei, calendar, Feng Shui, Yi and Sanshi workflows
- Su Zhan, Yi Gua, Liu Ren, Jin Kou, Dun Jia, Tai Yi, Tong She Fa, and Sanshi United

### Desktop Delivery

- installer-first distribution with bundled runtime
- desktop controls, AI export, AI export settings, and verification scripts
- maintainers can validate the packaged flow and the shared frontend from the same repository

## Installation

1. Open the [latest release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
2. Download `Horosa-Setup-1.2.0.exe`
3. Run the installer and finish the setup wizard
4. Launch `Horosa / 星阙` from the desktop or Start Menu

Notes:

- the installer bundles Electron, Java, Python, and the frontend / backend runtime assets
- default install path: `%LocalAppData%\\Programs\\Horosa`
- user data path: `%LocalAppData%\\HorosaDesktop`
- GitHub Release `v1.2.0` is the current latest public delivery entry

## Recommended First Run Flow

1. add a provider profile and fetch models in `Settings`
2. import local materials in `Materials`
3. save response templates or bundles in `Templates`
4. select a chart / case record and attach materials or bundles in `Analysis`
5. start a streaming analysis, then continue, export, archive, or branch it from `History`

## Developer Entry

Main directories:

- `desktop_installer_bundle/`: Electron shell, NSIS installer, release scripts
- `prepareruntime/`: Windows runtime preparation scripts
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/`: main source workspace
- `docs/`: release, verification, and architecture documentation

Useful entry points:

- `START_HERE.bat`
- `SELF_CHECK_HOROSA_WINDOWS.bat`
- `docs/releases/v1.2.0.md`

## Verification

```bash
cd local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui
npm ci
npm test -- --runInBand src/utils/__tests__/aiAnalysisContext.test.js src/utils/__tests__/aiAnalysisRetrieval.test.js src/utils/__tests__/aiAnalysisStore.test.js src/utils/__tests__/aiProviderAdapters.test.js
npm run build:file
```

```bash
cd desktop_installer_bundle
npm ci
npm run pack:win
npm run dist:win
```

## Governance And Docs

- release notes: [docs/releases/v1.2.0.md](docs/releases/v1.2.0.md)
- architecture: [docs/architecture.md](docs/architecture.md)
- progress: [docs/progress.md](docs/progress.md)
- contributing: [CONTRIBUTING.md](CONTRIBUTING.md)
- security: [SECURITY.md](SECURITY.md)
- support: [SUPPORT.md](SUPPORT.md)
- license: [LICENSE](LICENSE)

For general usage questions, please use GitHub Discussions first:

- [GitHub Discussions](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/discussions)
