<div align="center">

# 星阙 Horosa for Windows

### A Windows desktop delivery for Horosa with bundled runtime, one-click installer, and maintainable release docs

[![Latest Release](https://img.shields.io/github/v/release/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?display_name=tag&sort=semver)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11%20x64-0078D4)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
[![Primary Download](https://img.shields.io/badge/download-setup%20exe-2ea043)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
[![Runtime](https://img.shields.io/badge/runtime-bundled%20with%20installer-6f42c1)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)

[中文文档](README_ZH.md) | [English Guide](README_EN.md) | [Latest Release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest) | [版本说明](docs/releases/v1.1.2-zh.md) | [Release Notes](docs/releases/v1.1.2-en.md)

</div>

## Start Here / 先看这里

- End users: download `Horosa-Setup-1.1.2.exe` from the latest release page.
- 普通用户：直接去 latest release 下载 `Horosa-Setup-1.1.2.exe`。
- Developers and maintainers: start from the bilingual guides below, not from old release snippets.
- 开发者与维护者：请直接看中英双语文档和版本化 release 文档，不要再靠旧 release 页面拼信息。

## Preview

<div align="center">
  <p><strong>Main Workspace / 主界面工作区</strong></p>
  <img src="docs/assets/screenshots/main-workspace.png" alt="Horosa Main Workspace" width="1200" />
  <p><em>The primary Horosa desktop workspace delivered through the packaged Windows installer. / 通过 Windows 安装器交付给用户的 Horosa 核心桌面工作区。</em></p>
</div>

<div align="center">
  <p><strong>Sanshi Workspace / 三式合一工作区</strong></p>
  <img src="docs/assets/screenshots/sanshi-workspace.png" alt="Horosa Sanshi Workspace" width="960" />
  <p><em>An advanced workflow view that highlights Sanshi and deeper tool-driven analysis. / 用于展示三式合一与更深层工具分析场景的高级工作流界面。</em></p>
</div>

## Why This Repository Exists / 这个仓库的定位

- Deliver Horosa as a Windows desktop installer instead of a loose source-only bundle.
- 把 Horosa 作为真正的 Windows 桌面安装器交付，而不是只给源码。
- Keep one public install recommendation for ordinary users.
- 为普通用户保持单一、明确的安装入口。
- Preserve developer and maintainer entrypoints for packaging, self-check, and release verification.
- 同时保留开发者和维护者所需的打包、自检和发布验证入口。

## Recommended Download / 推荐下载

- Public install entry: `Horosa-Setup-1.1.2.exe`
- 当前公开安装入口：`Horosa-Setup-1.1.2.exe`
- Best for: regular Windows users who want the packaged runtime and the standard install flow.
- 适合：希望直接安装使用、由安装器带齐运行时的普通 Windows 用户。

## Documentation / 文档导航

- [README_ZH.md](README_ZH.md): 中文完整说明，包含下载安装、FAQ 与开发者入口。
- [README_EN.md](README_EN.md): Full English guide for installation, packaging context, FAQ, and developer entry.
- [docs/releases/v1.1.2-zh.md](docs/releases/v1.1.2-zh.md): 当前最新 Windows 版本说明。
- [docs/releases/v1.1.2-en.md](docs/releases/v1.1.2-en.md): Current Windows release notes in English.

<details>
<summary><strong>Developer Entry / 开发者入口</strong></summary>

- Root bootstrap script: `START_HERE.bat`
- Verification entry: `SELF_CHECK_HOROSA_WINDOWS.bat`
- Versioned release docs: `docs/releases/`
- Installer workspace: `desktop_installer_bundle/`

</details>
