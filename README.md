<div align="center">

简体中文 | [English](README_EN.md)

# 星阙 Horosa for Windows

### A desktop metaphysics workstation for Windows x64
### 面向 Windows x64 的桌面玄学工作站

[![Latest Release](https://img.shields.io/github/v/release/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?display_name=tag&sort=semver)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
[![License](https://img.shields.io/badge/license-AGPL--3.0-dc2626)](LICENSE)
[![GitHub Repo stars](https://img.shields.io/github/stars/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?style=flat)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/stargazers)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11%20%7C%20x64-black)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
[![Distribution](https://img.shields.io/badge/distribution-NSIS%20Installer%20%2B%20Bundled%20Runtime-1f6feb)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
[![Primary Download](https://img.shields.io/badge/download-setup%20exe-2ea043)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-1.3.3.exe)
[![CI](https://img.shields.io/github/actions/workflow/status/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/ci.yml?branch=main&label=CI)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/actions/workflows/ci.yml)
[![GitHub Discussions](https://img.shields.io/badge/discussions-open-7c3aed)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/discussions)
[![Sanshi United](https://img.shields.io/badge/Sanshi%20United-Chart%20Switch%20Sync-0f766e)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v1.3.3)
[![Runtime](https://img.shields.io/badge/runtime-1.3.3--windows--bundle-2563eb)](desktop_installer_bundle/README.md)
[![Security](https://img.shields.io/badge/security-policy-dc2626)](SECURITY.md)
[![Support](https://img.shields.io/badge/support-discussions%20%26%20email-4b5563)](SUPPORT.md)
[![Citation](https://img.shields.io/badge/citation-CFF-a855f7)](CITATION.cff)
[![Contributing](https://img.shields.io/badge/contributing-guide-0891b2)](CONTRIBUTING.md)

[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-3f3f46?logo=github&logoColor=white&labelColor=52525b)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows)
[![GitHub Releases](https://img.shields.io/badge/GitHub-Releases-1d4ed8?logo=github&logoColor=white&labelColor=52525b)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases)
[![Read In English](https://img.shields.io/badge/Read%20In-English-0f766e?labelColor=52525b)](README_EN.md)
[![查看中文版](https://img.shields.io/badge/查看-中文版-0f766e?labelColor=52525b)](README_ZH.md)

[中文完整版](README_ZH.md) | [English Guide](README_EN.md) | [Latest Release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest) | [v1.3.3 版本页面](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v1.3.3) | [All Releases](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases)

<p>Horosa on Windows is delivered as an installer-first desktop product with bundled runtime, a shared web/app workspace, and a clear public release path.</p>
<p>Windows 版 Horosa 以安装器优先、运行时随包交付、Web/App 共用工作区的正式桌面产品形态发布。</p>
<p><strong>Current release train / 当前发布线：v1.3.3</strong></p>
<p><strong>Licensing note:</strong> the public repository is now distributed under <code>AGPL-3.0</code> because the released stack integrates Swiss Ephemeris / <code>pyswisseph</code>. Third-party subdirectories keep their own upstream notices.</p>
<p><strong>许可证说明：</strong> 当前公开仓库已切换为 <code>AGPL-3.0</code>，原因是发布栈中集成了 Swiss Ephemeris / <code>pyswisseph</code>。第三方子目录仍保留各自上游原始许可证说明。</p>

</div>

## Start Here / 先看这里

<table>
  <tr>
    <td width="50%">
      <strong>English</strong><br /><br />
      End users should download the Windows installer and open Horosa like a finished desktop app.<br />
      <a href="https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-1.3.3.exe"><strong>Download the setup .exe</strong></a>
    </td>
    <td width="50%">
      <strong>中文</strong><br /><br />
      普通用户请直接下载 Windows 安装器，像标准桌面软件一样安装和打开 Horosa。<br />
      <a href="https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-1.3.3.exe"><strong>下载 setup .exe</strong></a>
    </td>
  </tr>
  <tr>
    <td width="50%">
      Maintainers should start from the bilingual guides and the current GitHub Release page instead of guessing from asset names.
    </td>
    <td width="50%">
      维护者请从双语说明和当前 GitHub Release 页面进入，不要只靠 release 资产名反推结构。
    </td>
  </tr>
</table>

## Preview / 截图预览

<div align="center">
  <p><strong>Main Workspace / 主界面工作区</strong></p>
  <img src="docs/assets/screenshots/main-workspace.png" alt="Horosa Main Workspace" width="1200" />
  <p><em>The primary Horosa desktop workspace for chart reading, controls, and everyday use.</em></p>
  <p><em>Horosa 的核心桌面工作区，用于盘面浏览、参数控制与日常使用。</em></p>
</div>

<div align="center">
  <p><strong>Sanshi Workspace / 三式合一工作区</strong></p>
  <img src="docs/assets/screenshots/sanshi-workspace.png" alt="Horosa Sanshi Workspace" width="960" />
  <p><em>An advanced workflow view that highlights Sanshi and deeper tool-driven analysis.</em></p>
  <p><em>更偏高级功能的一面，用于体现三式合一与更深层的工具化分析场景。</em></p>
</div>

## At A Glance / 一眼看懂

<table>
  <tr>
    <td width="50%">
      <strong>English</strong><br /><br />
      Horosa combines Western astrology, timing systems, relationship charts, Chinese traditional methods, Yi and Sanshi workflows, Feng Shui, and AI-oriented export controls inside one desktop surface.
    </td>
    <td width="50%">
      <strong>中文</strong><br /><br />
      Horosa 把西方占星、推运体系、关系盘、中国传统术数、易与三式、风水与 AI 导出控制整合进同一个桌面工作面。
    </td>
  </tr>
  <tr>
    <td width="50%">
      The Windows delivery is already shaped as a real desktop release: installer-first distribution, bundled runtime, update manifest, and a clear public download path.
    </td>
    <td width="50%">
      Windows 交付已经具备正式桌面产品的基本形态：安装器优先分发、运行时随包提供、更新清单与明确的公开下载入口。
    </td>
  </tr>
</table>

## Signature Workflows / 代表性工作流

### Natal To Timing / 从本命到时运

English: Start from natal and 3D chart reading, then move into primary directions, zodiacal releasing, firdaria, profection, solar arc, returns, and annual methods without leaving the same desktop product.

中文：从本命盘和三维盘进入，再继续切到主/界限法、黄道星释、法达、小限、太阳弧、返照与流年法，不需要离开同一个桌面产品。

### Relationship Analysis / 关系分析

English: The relationship layer already includes compare, composite, synastry, time-space midpoint, and Marks charts as parallel ways to inspect the same relationship.

中文：关系分析层已经覆盖比较盘、组合盘、影响盘、时空中点盘与马克斯盘，用不同结构切同一段关系。

### Chinese Traditional Stack / 中国传统术数栈

English: Bazi, Ziwei, calendar, Feng Shui, and supporting references already live in the same workspace, so the product feels like a broader traditional stack rather than a single-method tool.

中文：八字、紫微斗数、万年历、风水和配套参考入口已经进入同一工作面，所以它更像一整套中国传统术数栈，而不是某一术的单点工具。

### Yi And Sanshi Depth / 易与三式纵深

English: Yi and Sanshi go beyond standalone tabs through Su Zhan, Yi Gua, Liu Ren, Jin Kou, Dun Jia, Tai Yi, Tong She Fa, and a deeper Sanshi United surface.

中文：易与三式不只是单术入口，还包含宿盘、易卦、六壬、金口诀、遁甲、太乙、统摄法，以及更深的三式合一综合工作区。

## Capability Matrix / 功能矩阵

### Western Astrology / 西方占星

English: A continuous chain from natal reading to timing and relationship work.

中文：从本命阅读到推运、关系分析的连续链路。

- Natal chart and 3D chart / 星盘、本命盘、三维盘
- Timing stack including primary directions, returns, solar arc, and annual methods / 覆盖主限、返照、太阳弧与流年法的推运栈
- Compare, composite, synastry, time-space midpoint, and Marks charts / 比较盘、组合盘、影响盘、时空中点盘、马克斯盘

### Global And Specialty Modules / 全球与专门模块

English: A broader surface than the default desktop astrology stack.

中文：比常见桌面占星软件更宽的专门模块面。

- Jieqi charts / 节气盘
- Astrocartography and planetary maps / 星体地图与地理占星
- Qizheng Siyu, Hellenistic, Indian, and quantitative views / 七政四余、希腊星术、印度律盘、量化盘

### Chinese Traditional And Divination / 中国传统与术数

English: A structured traditional system rather than a decorative side module.

中文：系统化组织的传统术数层，而不是点缀式附属模块。

- Bazi, Ziwei, gua-symbol references, twelve-palace tools, and rule references / 八字、紫微斗数、八卦类象、十二串宫、规则参考
- Calendar and Feng Shui as first-class modules / 万年历与风水作为正式模块
- Yi and Sanshi modules across standalone and integrated surfaces / 易与三式兼具单术入口与整合面

### Desktop Workflow / 桌面工作流

English: Controls for shaping, filtering, inspecting, and exporting analysis sessions.

中文：围绕分析、筛选、检查与导出的桌面控制层。

- Chart configuration, aspect selection, planet selection / 星盘配置、相位选择、行星选择
- Chart components and utility tools / 星盘组件与小工具
- AI export and AI export settings / AI 导出与 AI 导出设置

## Updated In v1.3.3 / v1.3.3 更新重点

<table>
  <tr>
    <td width="50%">
      <strong>English</strong><br /><br />
      Horosa v1.3.3 fixes Sanshi United chart-list switching after the first plot. Selecting another saved chart now syncs the right-side input panel and recalculates automatically across Web and Windows App.
    </td>
    <td width="50%">
      <strong>中文</strong><br /><br />
      Horosa v1.3.3 修复三式合一第一次起盘后从星盘列表切换命盘的同步问题。再次选择已保存命盘时，右侧输入栏会自动更新，并在 Web 与 Windows App 中自动重新计算。
    </td>
  </tr>
  <tr>
    <td width="50%">
      - Sanshi United now detects external chart-field changes after an existing plot<br />
      - the right-side time/input selector remounts only for saved-chart switches, clearing stale internal selector state<br />
      - Tai Yi, Dun Jia, and Liu Ren integrated results refresh from the newly selected saved chart<br />
      - Web bundle, Windows App runtime payload, installer, and update manifest are aligned to <code>1.3.3</code>
    </td>
    <td width="50%">
      - 三式合一会在已经起盘后继续识别外部星盘字段变化<br />
      - 右侧时间/输入选择器只在切换已保存命盘时重挂载，清掉旧命盘的内部选择状态<br />
      - 太乙、遁甲、六壬合并结果会根据新选中的命盘重新刷新<br />
      - Web 包、Windows App 运行时载荷、安装器与更新清单统一到 <code>1.3.3</code>
    </td>
  </tr>
</table>

## Get Started / 下载与文档导航

<table>
  <tr>
    <td width="50%">
      <strong>English</strong><br /><br />
      Public install entry: <code>Horosa-Setup-1.3.3.exe</code><br />
      Best for Windows x64 users, weak-network environments, offline forwarding, and first-time installs.<br /><br />
      <a href="https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-1.3.3.exe"><strong>Open download</strong></a>
    </td>
    <td width="50%">
      <strong>中文</strong><br /><br />
      公开安装入口：<code>Horosa-Setup-1.3.3.exe</code><br />
      适合 Windows x64、弱网环境、离线转发和第一次安装的普通用户。<br /><br />
      <a href="https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-1.3.3.exe"><strong>打开下载</strong></a>
    </td>
  </tr>
</table>

## Documentation / 文档导航

<table>
  <tr>
    <td width="50%">
      <strong>English</strong><br /><br />
      <a href="README_EN.md">README_EN.md</a>: full English guide<br />
      <a href="README_ZH.md">README_ZH.md</a>: Chinese full guide<br />
      <a href="https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v1.3.3">v1.3.3 release page</a><br />
      <a href="https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases">All releases</a><br />
      <a href="desktop_installer_bundle/README.md">Desktop bundle internals</a>
    </td>
    <td width="50%">
      <strong>中文</strong><br /><br />
      <a href="README_ZH.md">README_ZH.md</a>：中文完整说明<br />
      <a href="README_EN.md">README_EN.md</a>：英文完整说明<br />
      <a href="https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v1.3.3">v1.3.3 版本页面</a><br />
      <a href="https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases">所有 Release</a><br />
      <a href="desktop_installer_bundle/README.md">桌面打包与安装器说明</a>
    </td>
  </tr>
</table>

<details>
<summary><strong>Developer Entry / 开发者入口</strong></summary>

<table>
  <tr>
    <td width="50%">
      <strong>English</strong><br /><br />
      Understand the public-facing repository layout: <a href="README.md">README.md</a><br />
      Inspect desktop bundle internals and publishing flow: <a href="desktop_installer_bundle/README.md">desktop_installer_bundle/README.md</a><br />
      Read the current version release page: <a href="https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v1.3.3">v1.3.3</a><br />
      Enter the application source tree: <code>local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/</code><br />
      Inspect runtime and verification notes: <code>local/workspace/runtime/windows/</code>, <a href="docs/PROJECT_STRUCTURE.md">docs/PROJECT_STRUCTURE.md</a>, <a href="docs/SELFCHECK_LOG.md">docs/SELFCHECK_LOG.md</a>
    </td>
    <td width="50%">
      <strong>中文</strong><br /><br />
      理解首页与用户入口：<a href="README.md">README.md</a><br />
      查看桌面打包与发布链路：<a href="desktop_installer_bundle/README.md">desktop_installer_bundle/README.md</a><br />
      阅读当前版本页面：<a href="https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v1.3.3">v1.3.3</a><br />
      进入主工程源码：<code>local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/</code><br />
      查看运行时与自检文档：<code>local/workspace/runtime/windows/</code>、<a href="docs/PROJECT_STRUCTURE.md">docs/PROJECT_STRUCTURE.md</a>、<a href="docs/SELFCHECK_LOG.md">docs/SELFCHECK_LOG.md</a>
    </td>
  </tr>
</table>

</details>
