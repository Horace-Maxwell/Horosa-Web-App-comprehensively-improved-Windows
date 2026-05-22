<div align="center">

简体中文 | [English](README_EN.md)

# 星阙 Horosa for Windows

### v2.0.0 Beta Mac Web 对齐大版本，面向 Windows x64 的安装器优先桌面交付

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
[![Security](https://img.shields.io/badge/security-policy-dc2626)](SECURITY_ZH.md)
[![Support](https://img.shields.io/badge/support-discussions%20%26%20email-4b5563)](SUPPORT_ZH.md)
[![Citation](https://img.shields.io/badge/citation-CFF-a855f7)](CITATION.cff)
[![Contributing](https://img.shields.io/badge/contributing-guide-0891b2)](CONTRIBUTING_ZH.md)

[![GitHub 仓库](https://img.shields.io/badge/GitHub-Repository-3f3f46?logo=github&logoColor=white&labelColor=52525b)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows)
[![GitHub 发布](https://img.shields.io/badge/GitHub-Releases-1d4ed8?logo=github&logoColor=white&labelColor=52525b)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases)
[![阅读英文版](https://img.shields.io/badge/阅读-英文版-0f766e?labelColor=52525b)](README_EN.md)
[![返回入口页](https://img.shields.io/badge/返回-入口页-0f766e?labelColor=52525b)](README.md)

[入口页](README.md) | [英文说明](README_EN.md) | [最新 Release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest) | [v2.0.0 Beta 版本页面](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.0.0)

**当前版本：** `v2.0.0 Beta`

**Beta 说明：** 当前公开安装器是 v2.0.0 beta 包。它会作为 GitHub Releases 中可直接看到的当前版本发布，方便 Windows 用户下载测试新版统一 Web/Desktop 构建。

**许可证说明：** 当前公开仓库使用 `AGPL-3.0`，原因是发布栈中集成了 Swiss Ephemeris / `pyswisseph`。第三方子目录仍保留各自上游原始许可证说明。

</div>

## 为什么 v2.0.0 Beta 是大版本

Horosa v2.0.0 Beta 是 Windows 端把新版 Mac Web 产品面同步过来的大版本。它不是一次小修小补，而是把 UI 外壳、控件、模块导航、前端页面、Python 后端、Java 后端、资源、AI 分析流、导出设置和桌面运行时交付统一进同一条跨平台发布线。

Windows 发布包仍然保持自包含。旧的 Mac 同步来源文件夹不再是运行或构建依赖；全新的 Windows 10/11 x64 机器也不需要用户手动安装 Python、Java、Node.js、Maven 或前端构建工具。

## 推荐入口

- [Horosa-Setup-2.0.0.exe](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-2.0.0.exe)

适合场景：

- 第一次在全新 Windows 10/11 x64 机器上安装
- 弱网环境或离线转发
- 希望 Horosa 像正式桌面软件一样打开
- 准备 GitHub Release 标准发布资产

首次启动会因为随包运行时初始化而更慢；后续启动会复用本地运行时缓存，体验会更接近普通桌面软件。

## 截图预览

<div align="center">
  <p><strong>星阙 2.0 本命盘工作区</strong></p>
  <img src="docs/assets/screenshots/horosa-2.0-main-workspace.png" alt="星阙 2.0 本命盘工作区" width="1200" />
  <p><em>新版 XQ 外壳、命盘控制、右侧信息面板、底部快捷功能、主题控制与桌面布局整合在同一工作面。</em></p>
</div>

<div align="center">
  <p><strong>功能模块导航</strong></p>
  <img src="docs/assets/screenshots/horosa-2.0-module-navigator.png" alt="星阙 2.0 功能模块导航" width="1100" />
  <p><em>深色模块选择器快速连接占星、星运、八字、紫微、七政、印占、辅盘、三式、小工具、AI 分析与天文馆。</em></p>
</div>

<div align="center">
  <p><strong>三式工作区</strong></p>
  <img src="docs/assets/screenshots/horosa-2.0-sanshi-workspace.png" alt="星阙 2.0 三式工作区" width="1200" />
  <p><em>三式、六壬、遁甲、太乙、神煞、八宫与细节面板现在共用同一套 Windows 桌面外壳。</em></p>
</div>

## v2.0.0 Beta 更新重点

### 产品外壳

- 新版 XQ UI 外壳与 Windows 桌面布局对齐
- 图标系统、导航结构、模块选择器与快捷功能
- 昼夜主题控制
- 搜索、收藏、历史、设置、帮助、AI 导出与模块路由

### 占星与专门模块

- 本命盘、盘面控制、相位/行星选择与盘面样式
- 星运体系：主限、黄道星释、法达、小限、太阳弧、日月返照、流年法与十年大运
- 关系盘体系：比较盘、组合盘、影响盘、时空中点盘与马克斯盘
- 辅盘、节气盘、星体地图、量化盘、希腊星术、印度占星扩展、七政四余、七政 Moira 与天文馆 / 3D 视图

### 中国传统与三式工作流

- 八字、紫微、万年历、风水、八卦类象、十二串宫与规则参考
- 宿盘、易卦、六爻、六壬、金口诀、遁甲、太乙、统摄法与三式合一
- 三式工作区覆盖概览、太乙、神煞、六壬、大格、小局、参考、八宫详情与可导出快照

### AI 分析与导出

- AI 分析工作面支持模块上下文收集
- provider、material、chat、embedding 与 stream 服务路径
- AI 导出设置覆盖占星、星运、关系盘、传统模块、三式、七政与印度占星
- 本地模块快照可供导出和分析复用

### 后端对齐

- Python 后端加入 `/astroextra`、`/planetarium`、星历支持路径、印度占星扩展、星表资源与天文馆状态数据
- Java 后端加入 `/astroextra/*`、`/planetarium/state`、`/qizheng/moira` 与 AI Analysis 服务接线
- Windows 启动器和安装器逻辑继续保持本地随包运行时路径稳定

## 桌面交付

- Windows 10/11 (`x64`)
- NSIS 安装器：`Horosa-Setup-2.0.0.exe`
- 可选择安装目录，并在安装前校验目录可创建、可写
- 随包包含 Python、Java、Node/Web 资产与应用运行时
- 普通用户不需要额外安装 Python、Java、Node.js 或 Maven
- 为 GitHub Releases 准备更新清单、blockmap、校验和文件与发布说明
- Web 模式与 Windows 桌面模式共享行为

## 发布资产

标准 GitHub Release 资产为：

- `Horosa-Setup-2.0.0.exe`
- `Horosa-Setup-2.0.0.exe.blockmap`
- `latest.yml`
- `SHA256SUMS.txt`

## 文档导航

- [README.md](README.md)：双语入口页
- [README_EN.md](README_EN.md)：英文完整说明
- [docs/releases/2.0.0.md](docs/releases/2.0.0.md)：本地 v2.0.0 Beta 发布说明
- [desktop_installer_bundle/README.md](desktop_installer_bundle/README.md)：桌面安装包内部说明
- [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)：项目结构说明
- [所有 Release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases)

## 常见问题

### 普通用户需要克隆仓库吗

不需要。直接去最新 Release 下载 setup `.exe` 即可。

### 安装完成后还要自己装 Python 或 Java 吗

不需要。公开推荐的安装路径已经把运行所需内容纳入交付流程。

### 可以选择安装目录吗

可以。v2.0.0 Beta 安装器使用标准安装向导，支持选择安装目录，并会在安装前做目录创建/写入检查；遇到 Windows 权限限制时可提权继续。

### 为什么 Release 里还有别的文件

`latest.yml`、`.blockmap` 与 `SHA256SUMS.txt` 用于自动更新和校验流程。普通用户真正要点的仍然是 setup `.exe`。

### 更新时会不会删掉我的用户数据

不会。应用更新与运行时切换的目标是替换程序和共享组件，不是清空你的使用数据。

## 致谢

本项目为参考星阙 Horosa-荀爽（Herakleios）所发布的星阙 App 和 Web，并在 Windows 交付、运行时打包、功能整合与使用体验上继续改良制作。源流不可忘：星阙 Horosa 最早由郑大哥一手创建，荀爽（Herakleios）曾参与辅助设计，并将相关 App 与 Web 版本公开出来供后来者研究、学习与延展。

请不要忘记爽哥和郑大哥的贡献。这个 Windows 版本的继续整理与发布，建立在前人已经搭起的星阙体系、术数工作流和公开分享精神之上。也感谢所有持续测试、反馈、修复和推动 Horosa 变得更完整的人。
