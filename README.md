<div align="center">

简体中文 | [English](README_EN.md)

# 星阙 Horosa for Windows

### Horosa v2.0.0 Beta Mac Web parity release for Windows x64
### 面向 Windows x64 的星阙 2.0 Beta 跨平台统一大版本

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
[![Read In English](https://img.shields.io/badge/Read%20In-English-0f766e?labelColor=52525b)](README_EN.md)
[![查看中文版](https://img.shields.io/badge/查看-中文版-0f766e?labelColor=52525b)](README_ZH.md)

[中文完整版](README_ZH.md) | [English Guide](README_EN.md) | [Latest Release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest) | [v2.0.0 Beta 版本页面](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.0.0) | [All Releases](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases)

<p>Horosa v2.0.0 Beta brings the improved Mac Web product surface to Windows: UI shell, modules, frontend, Python backend, Java backend, assets, and desktop delivery are aligned into one cross-platform release line.</p>
<p>Horosa v2.0.0 Beta 将新版 Mac Web 产品面完整同步到 Windows：UI 外壳、模块、前端、Python 后端、Java 后端、资源和桌面交付统一进入同一条跨平台发布线。</p>
<p><strong>Current release train / 当前发布线：v2.0.0 Beta</strong></p>
<p><strong>Beta note:</strong> this public installer is the v2.0.0 beta package. It is published as the visible current GitHub Release so Windows users can download and test the new unified Web/Desktop build directly.</p>
<p><strong>Beta 说明：</strong> 当前公开安装器是 v2.0.0 beta 包。它会作为 GitHub Releases 中可直接看到的当前版本发布，方便 Windows 用户下载测试新版统一 Web/Desktop 构建。</p>
<p><strong>Licensing note:</strong> the public repository is distributed under <code>AGPL-3.0</code> because the released stack integrates Swiss Ephemeris / <code>pyswisseph</code>. Third-party subdirectories keep their own upstream notices.</p>
<p><strong>许可证说明：</strong> 当前公开仓库使用 <code>AGPL-3.0</code>，原因是发布栈中集成了 Swiss Ephemeris / <code>pyswisseph</code>。第三方子目录仍保留各自上游原始许可证说明。</p>

</div>

## Start Here / 先看这里

<table>
  <tr>
    <td width="50%">
      <strong>English</strong><br /><br />
      End users can download the v2.0.0 Beta Windows installer and open Horosa like a finished desktop app. A clean Windows 10/11 x64 machine does not need a separate Python, Java, Node.js, Maven, or frontend toolchain install.<br />
      <a href="https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-2.0.0.exe"><strong>Download Horosa-Setup-2.0.0.exe</strong></a>
    </td>
    <td width="50%">
      <strong>中文</strong><br /><br />
      普通用户可以直接下载 v2.0.0 Beta Windows 安装器，像标准桌面软件一样安装和打开 Horosa。全新的 Windows 10/11 x64 机器不需要额外安装 Python、Java、Node.js、Maven 或前端工具链。<br />
      <a href="https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-2.0.0.exe"><strong>下载 Horosa-Setup-2.0.0.exe</strong></a>
    </td>
  </tr>
  <tr>
    <td width="50%">
      First launch can take longer while the bundled runtime settles. Later launches are optimized around the local runtime cache and should feel like a normal desktop app.
    </td>
    <td width="50%">
      首次启动会因为运行时初始化而更慢；后续启动会复用本地运行时缓存，体验应接近正常桌面软件。
    </td>
  </tr>
</table>

## Preview / 截图预览

<div align="center">
  <p><strong>Horosa v2 Main Workspace / 星阙 2.0 本命盘工作区</strong></p>
  <img src="docs/assets/screenshots/horosa-2.0-main-workspace.png" alt="Horosa v2 main astrology workspace" width="1200" />
  <p><em>The new XQ shell, chart controls, side inspection panels, quick actions, theme controls, and desktop layout in one screen.</em></p>
  <p><em>新版 XQ 外壳、命盘控制、右侧信息面板、底部快捷功能、主题控制与桌面布局整合在同一工作面。</em></p>
</div>

<div align="center">
  <p><strong>Module Navigator / 功能模块导航</strong></p>
  <img src="docs/assets/screenshots/horosa-2.0-module-navigator.png" alt="Horosa v2 module navigator" width="1100" />
  <p><em>The dark module chooser gives fast access to astrology, timing, Bazi, Ziwei, Qizheng, Indian astrology, auxiliary charts, Sanshi, tools, AI analysis, and the planetarium.</em></p>
  <p><em>深色模块选择器快速连接占星、星运、八字、紫微、七政、印占、辅盘、三式、小工具、AI 分析与天文馆。</em></p>
</div>

<div align="center">
  <p><strong>Sanshi Workspace / 三式工作区</strong></p>
  <img src="docs/assets/screenshots/horosa-2.0-sanshi-workspace.png" alt="Horosa v2 Sanshi workspace" width="1200" />
  <p><em>Sanshi, Liu Ren, Dun Jia, Tai Yi, shensha, Bagong, and related detail panels now share the same Windows desktop shell.</em></p>
  <p><em>三式、六壬、遁甲、太乙、神煞、八宫与细节面板现在共用同一套 Windows 桌面外壳。</em></p>
</div>

## What Changed In v2.0.0 Beta / v2.0.0 Beta 更新重点

<table>
  <tr>
    <td width="50%">
      <strong>English</strong><br /><br />
      v2.0.0 Beta is the cross-platform parity release. The improved Mac Web implementation is now reflected in the Windows Web and desktop package, while keeping the Windows-specific bundled runtime and launcher adaptations required for clean-machine use.
    </td>
    <td width="50%">
      <strong>中文</strong><br /><br />
      v2.0.0 Beta 是跨平台统一大版本。新版 Mac Web 中已经完成的产品面同步进入 Windows Web 与桌面安装包，同时保留 Windows 在全新机器上可直接运行所需的运行时与启动适配。
    </td>
  </tr>
  <tr>
    <td width="50%">
      - New XQ UI shell, icon system, navigation, module chooser, quick actions, day/night theme, settings, help, search, favorites, and history<br />
      - Expanded astrology surface: natal, timing, relationship charts, auxiliary charts, Indian astrology extensions, Qizheng Moira, and planetarium/3D views<br />
      - Chinese and divination workflows: Bazi, Ziwei, Yi, Liu Ren, Dun Jia, Tai Yi, Sanshi United, Feng Shui, calendar, and related reference panels<br />
      - AI analysis and export settings now cover more module snapshots and provider/material/chat/embedding/stream service paths<br />
      - Python backend includes <code>/astroextra</code>, <code>/planetarium</code>, star resources, Indian extensions, and supporting ephemeris services<br />
      - Java backend includes <code>/astroextra/*</code>, <code>/planetarium/state</code>, <code>/qizheng/moira</code>, and AI Analysis service wiring<br />
      - Windows release remains self-contained; the old Mac sync source folder is not required at runtime or build time
    </td>
    <td width="50%">
      - 新版 XQ UI 外壳、图标系统、导航、模块选择器、快捷功能、昼夜主题、设置、帮助、搜索、收藏与历史<br />
      - 占星面扩展到本命、星运、关系盘、辅盘、印度占星扩展、七政 Moira 与天文馆 / 3D 视图<br />
      - 中国传统与术数工作流覆盖八字、紫微、易、六壬、遁甲、太乙、三式合一、风水、万年历与相关参考面板<br />
      - AI 分析与 AI 导出设置覆盖更多模块快照，并接入 provider/material/chat/embedding/stream 服务路径<br />
      - Python 后端包含 <code>/astroextra</code>、<code>/planetarium</code>、星表资源、印度占星扩展与星历支持服务<br />
      - Java 后端包含 <code>/astroextra/*</code>、<code>/planetarium/state</code>、<code>/qizheng/moira</code> 与 AI Analysis 服务接线<br />
      - Windows 发布包保持自包含；旧的 Mac 同步来源文件夹不再作为运行或构建依赖
    </td>
  </tr>
</table>

## Capability Matrix / 功能矩阵

### Western Astrology / 西方占星

- Natal chart, chart controls, aspects, planet selection, chart styling, and inspection panels / 本命盘、盘面控制、相位、行星选择、样式与信息面板
- Timing stack: primary directions, zodiacal releasing, firdaria, profection, solar arc, solar/lunar returns, annual methods, and decennials / 星运体系覆盖主限、黄道星释、法达、小限、太阳弧、日月返照、流年法与十年大运
- Relationship stack: compare, composite, synastry, time-space midpoint, Marks charts, and AI-ready snapshots / 关系盘覆盖比较盘、组合盘、影响盘、时空中点盘、马克斯盘与 AI 快照
- Auxiliary and specialty charts including Jieqi, astrocartography, quantitative views, Hellenistic views, Indian astrology, Qizheng Siyu, and Moira / 辅盘与专门模块包含节气盘、星体地图、量化盘、希腊星术、印度占星、七政四余与 Moira

### Chinese Traditional And Sanshi / 中国传统与三式

- Bazi, Ziwei, calendar, Feng Shui, gua-symbol references, twelve-palace tools, and rule references / 八字、紫微、万年历、风水、八卦类象、十二串宫与规则参考
- Yi and divination entrypoints: Su Zhan, Yi Gua, Liu Yao, Liu Ren, Jin Kou, Dun Jia, Tai Yi, Tong She Fa, and Sanshi United / 易与术数入口包含宿盘、易卦、六爻、六壬、金口诀、遁甲、太乙、统摄法与三式合一
- Sanshi workspace with overview, Tai Yi, shensha, Liu Ren, major patterns, sub-patterns, references, Bagong details, and exportable snapshots / 三式工作区包含概览、太乙、神煞、六壬、大格、小局、参考、八宫详情与可导出快照

### AI, Export, And Research Flow / AI、导出与研究流

- AI Analysis surface with local module context, provider settings, material handling, chat paths, embeddings, and stream-capable service wiring / AI 分析工作面支持本地模块上下文、供应商设置、材料处理、对话路径、embedding 与流式服务接线
- AI export settings for chart sections, timing sections, traditional modules, Sanshi content, Qizheng, Indian astrology, and relationship views / AI 导出设置覆盖盘面、星运、传统模块、三式、七政、印度占星与关系盘
- Search, favorites, history, settings, help, quick actions, and module navigator support repeated desktop work / 搜索、收藏、历史、设置、帮助、快捷功能与模块导航支撑长期桌面研究

## Desktop Delivery / 桌面交付

On Windows, the delivery layer is meant to feel installable and finished rather than improvised.

Windows 交付目标是让 Horosa 像成品桌面软件一样安装、打开、更新和恢复，而不是让普通用户自己拼环境。

- Windows 10/11 (`x64`)
- NSIS installer: `Horosa-Setup-2.0.0.exe`
- Bundled Python, Java, Node/Web assets, and app runtime
- No required external Python/Java/Node/Maven installation for normal users
- Update manifest, blockmap, checksum file, and release notes prepared for GitHub Releases
- Shared frontend and backend behavior across Web mode and Windows desktop mode

## Documentation / 文档导航

<table>
  <tr>
    <td width="50%">
      <strong>English</strong><br /><br />
      <a href="README_EN.md">README_EN.md</a>: full English guide<br />
      <a href="README_ZH.md">README_ZH.md</a>: Chinese full guide<br />
      <a href="https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.0.0">v2.0.0 Beta release page</a><br />
      <a href="docs/releases/2.0.0.md">local v2.0.0 Beta release notes</a><br />
      <a href="desktop_installer_bundle/README.md">Desktop bundle internals</a><br />
      <a href="docs/PROJECT_STRUCTURE.md">Project structure</a>
    </td>
    <td width="50%">
      <strong>中文</strong><br /><br />
      <a href="README_ZH.md">README_ZH.md</a>：中文完整说明<br />
      <a href="README_EN.md">README_EN.md</a>：英文完整说明<br />
      <a href="https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.0.0">v2.0.0 Beta 版本页面</a><br />
      <a href="docs/releases/2.0.0.md">本地 v2.0.0 Beta 发布说明</a><br />
      <a href="desktop_installer_bundle/README.md">桌面打包与安装器说明</a><br />
      <a href="docs/PROJECT_STRUCTURE.md">项目结构说明</a>
    </td>
  </tr>
</table>

## FAQ / 常见问题

### Do I Need To Clone The Repo / 普通用户需要克隆仓库吗

No. Regular users should download `Horosa-Setup-2.0.0.exe` from the latest release.

不需要。普通用户直接在最新 Release 下载 `Horosa-Setup-2.0.0.exe` 即可。

### Do I Need To Install Python Or Java / 需要自己安装 Python 或 Java 吗

No. The Windows installer is designed to carry the runtime pieces needed by the released app. The first launch can be slower because those pieces are initialized locally.

不需要。Windows 安装器会携带发布版所需运行时。首次启动可能因本地初始化更慢，后续会复用缓存。

### Why Are There Other Files In The Release / Release 里为什么还有其他文件

`latest.yml`, `.blockmap`, and `SHA256SUMS.txt` support updater and verification workflows. The public install entry remains the setup `.exe`.

`latest.yml`、`.blockmap` 与 `SHA256SUMS.txt` 用于更新和校验。普通用户的公开安装入口仍然是 setup `.exe`。

## Acknowledgements / 致谢

本项目为参考星阙 Horosa-荀爽（Herakleios）所发布的星阙 App 和 Web，并在 Windows 交付、运行时打包、功能整合与使用体验上继续改良制作。源流不可忘：星阙 Horosa 最早由郑大哥一手创建，荀爽（Herakleios）曾参与辅助设计，并将相关 App 与 Web 版本公开出来供后来者研究、学习与延展。

请不要忘记爽哥和郑大哥的贡献。这个 Windows 版本的继续整理与发布，建立在前人已经搭起的星阙体系、术数工作流和公开分享精神之上。也感谢所有持续测试、反馈、修复和推动 Horosa 变得更完整的人。

This Windows edition is an improved distribution and integration work based on the Horosa App and Web released by Horosa-荀爽（Herakleios）. The lineage matters: Horosa was originally created by 郑大哥, with auxiliary design work from 荀爽（Herakleios）, and their public release made later study, maintenance, and extension possible.

Please do not forget the contributions of 爽哥 and 郑大哥. This repository continues from their groundwork with respect, gratitude, and the hope that Horosa can remain useful to more people over time.
