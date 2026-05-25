<div align="center">

简体中文 · [English](README_EN.md)

<img src="desktop_installer_bundle/assets/horosa_setup_badge.png" alt="星阙 Horosa" width="128" />

# 星阙 Horosa

**把占星与中国术数，收进一个原生 Windows 工作站**

[![Version](https://img.shields.io/badge/version-2.1.1%20beta-b45309?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.1.1)
[![License](https://img.shields.io/badge/license-AGPL--3.0-dc2626?style=flat-square)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows%2010%2F11-x64-111111?style=flat-square&logo=windows&logoColor=white)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.1.1)
[![Installer](https://img.shields.io/badge/NSIS-bundled%20runtime-1f6feb?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.1.1)
[![CI](https://img.shields.io/github/actions/workflow/status/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/actions/workflows/ci.yml)
[![Stars](https://img.shields.io/github/stars/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/stargazers)

[下载安装包](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-2.1.1.exe) ·
[入口页](README.md) ·
[English Guide](README_EN.md) ·
[所有版本](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases)

</div>

---

## 星阙是什么

星阙 Horosa 是一套桌面端的玄学工作站。西方占星的本命、推运、关系盘，连同八字、紫微、奇门、六壬、太乙这些中国传统术数，被放进同一个原生 Windows 应用里。它要解决的事其实很朴素：不必在十几个网页排盘器之间来回切，也不必自己拼装底层的 Python、Java 与历表运行时——你下载一个离线 NSIS 安装包，打开的就是一个成品。

这个仓库承担的是 Windows 这一侧的交付：应用源码、共享运行时、Electron 桌面外壳，以及把这一切打成单个 NSIS 安装包（`Horosa-Setup-2.1.1.exe`）的发布链路。

## 下载

普通用户直接下载离线安装包，像任何 Windows 软件一样安装、打开即可。

**[⬇︎ Horosa-Setup-2.1.1.exe](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-2.1.1.exe)**

适合场景：

- Windows 10 / 11，`x64`
- 弱网或完全离线的环境
- 第一次安装，或者要把安装包转发给别人
- 希望首次打开就能用，不再额外联网拉运行时

无需自备 Python 或 Java，运行时已随包交付。更新只替换程序与共享运行时，不会动你已经保存的命例与事盘数据。

> 安装包当前未做 Authenticode 签名，首次运行时 Windows SmartScreen 可能提示“Windows 已保护你的电脑”，点击「更多信息 → 仍要运行」即可。

## 截图

<div align="center">
<img src="docs/assets/screenshots/horosa-2.0-main-workspace.png" alt="占星工作区" width="900" />
<p><em>占星工作区 —— 左侧起盘参数，中间图盘画布，右侧信息 / 相位 / 行星 / 古典 / 格局页签。</em></p>

<img src="docs/assets/screenshots/horosa-2.0-sanshi-workspace.png" alt="三式工作区" width="900" />
<p><em>三式工作区 —— 起盘参数、九宫盘面、概览 / 太乙 / 神煞 / 六壬 / 八宫页签同屏呈现。</em></p>

<img src="docs/assets/screenshots/horosa-2.0-module-navigator.png" alt="导航弹层" width="900" />
<p><em>导航弹层 —— 命盘推运、易与三式、工具工作台分组，支持搜索与最近使用。</em></p>
</div>

## 功能总览

导航把所有模块归为三组：**命**（命盘与推运）、**卜**（易与三式）、**工具**。下面列的，是各组里真正能用的内容——名字与应用里的页签一一对应。

### 命 · 命盘与推运

这一层的强项是连贯：能读本命、把它沿时间推开、再带进第二个人，全程不离开同一个工作面。

- **占星** —— 本命盘与三维盘（Babylon.js 实时 3D），多种宫位制、古典 / 现代行星集
- **星运** —— 主限法、黄道星释、法达、小限、太阳弧、太阳 / 太阴返照、十年法、推运、星历
- **合盘** —— 比较盘、组合盘、影响盘、时空中点盘、马克斯盘
- **辅盘** —— 希腊星术（界限 / 阿拉伯点）、量化盘 / 中点树（汉堡学派）、星体地图（占星地理定位）、调波盘
- **印占** —— 北 / 南 / 东印度盘，恒星黄道
- **七政** —— 七政四余、七政 Moira
- **八字 · 紫微** —— 四柱排盘；紫微斗数含四化盘
- **数算 · 其他** —— 邵子神数、铁板神数、演禽等数术方法

### 卜 · 易与三式

易与三式不止是几个独立页签，三式合一已经做成一个真正能工作的整合面。

- **三式（合一）** —— 奇门、太乙、六壬整合呈现：概览、太乙、神煞、六壬、大格、小局、参考、八宫
- **遁甲 · 六壬 · 太乙** —— 三式各自的独立排盘入口
- **六爻 · 分至 · 风水** —— 纳甲六爻、节气盘、风水工具
- **其他** —— 宿盘、金口诀、统摄法、皇极经世、五兆、太玄、荆诀、神易数

### 工具 · 工具工作台

- **AI 分析** —— 可接入 OpenAI / Anthropic / Gemini / Ollama / OpenRouter / 自定义端点；支持流式对话、历史记录、资料库（向量检索），以及按技法 / 页签结构化导出
- **天文馆** —— 基于 Babylon.js 的实时三维天象
- **黄历** —— 农历、节气与择日
- **辅助** —— 八卦类象、十二宫、规则速查

命盘与事盘都能本地保存：带标签、快照与后端原始结构化数据，可 JSON 导入导出，重开后恢复现场。

## v2.1.1 beta 更新

这一版的重点，是把 Mac 端最新接入的一批传统命法 / 卜法同步到 Windows，并做到“可以长期用”的状态——能管理、能导出、能持久化，而且在全新 Windows 上稳定可启动，而不只是“能跑”。

- **更宽的传统术数后端** —— 新增并规范太乙、金口诀、皇极经世、五兆、太玄、荆诀、神易数、Kin Astro、七政、奇门等引擎
- **三式合一口径固定** —— 奇门与太乙走 kentang 后端，六壬保留本地实现；移除后端不支持的月家奇门，不再静默回退旧算法
- **数据管理补全** —— 命盘 / 事盘保留新技法输入、标签、快照、后端结构化数据、JSON 导入导出与重开恢复
- **AI 导出结构化** —— 直接读取后端结构化数据，按技法 / 页签提供可勾选的导出分段
- **状态持久化** —— 用户设置与窗口大小在关闭、重开、版本更新后保留
- **桌面体验打磨** —— 重做的启动页（分步进度条 + 失败态直接展示真实日志、可复制诊断信息）；紫微四化盘隐藏亮度标签，避免与星曜重叠；全局明暗主题再校对
- **干净机器可用性** —— 随包自包含 Python / Java / Web 运行时，内置 VC++ 运行时与构建期依赖自检；内置 Python 采用固定版本的 python-build-standalone，消除“构建机环境漂移”，全新 Windows 无需额外安装即可启动

完整改动见 [v2.1.1 Beta Release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.1.1) 与 [本地发布说明](docs/releases/2.1.1.md)。

## 技术构成

- **前端** —— React 17 + Umi 3 + TypeScript，Ant Design；D3 绘盘，Babylon.js / Three.js 三维，Plotly 星体地图，Monaco 编辑 AI 导出模板
- **后端** —— Java 17 / Spring Boot 承载占星与中国术数核心服务；Python 3.11 服务层封装 Swiss Ephemeris（`pyswisseph`）与 vendored 的 kentang 传统术数引擎
- **桌面壳** —— Electron 原生外壳，启动时在后台拉起本地 Python / Java 服务并做健康检查，窗口 / 缩放 / 设置状态持久化
- **运行时** —— 内置 Python 采用固定版本的 python-build-standalone（可复现、自包含），随包附带 VC++ 运行时、离线 wheels 与后端 jar；构建期有原生依赖闸门与发布前自检
- **发布** —— 面向 Windows 10 / 11（`x64`）的离线 NSIS 安装包，支持选择安装目录与升级；附 `latest.yml` / `.blockmap` / `SHA256SUMS.txt`

持续集成（CI）在每次推送时构建并测试：前端（Node 20）、后端（Java 17 / Maven），以及桌面打包侧的 renderer 校验；发布流水线（`desktop-release.yml`）在 Windows runner 上完整出包并带版本 / 品牌 / 依赖闸门。

## 常见问题

**我只是普通用户，需要克隆仓库吗？**
不需要。直接在最新 release 里下载 `Horosa-Setup-2.1.1.exe` 即可。

**安装完还要自己装 Python 或 Java 吗？**
不需要。Windows 安装器已经把发布版所需的运行时纳入流程；首次启动会因本地解包和校验稍慢，后续复用缓存。

**可以选择安装目录吗？**
可以。v2.1.1 Beta 安装器支持标准安装向导，可选择安装目录，并在安装前做目录创建 / 写入检查、快捷方式修复；遇到 Windows 权限限制时可提权继续。

**为什么 release 里还有别的文件？**
`latest.yml`、`.blockmap` 与 `SHA256SUMS.txt` 用于更新和校验。对普通用户来说，真正要点的只有 `Horosa-Setup-2.1.1.exe`。

**更新时会删掉我的数据吗？**
不会。应用更新与运行时切换替换的是程序与共享运行时，不会清空你保存的命例与事盘。

## 开发者入口

按你的目标选择入口：

- 想理解产品首页与用户入口：[README.md](README.md)
- 想看英文完整说明：[README_EN.md](README_EN.md)
- 想理解桌面打包与安装器：[desktop_installer_bundle/README.md](desktop_installer_bundle/README.md)
- 想理解项目结构：[docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)
- 想了解干净机器运行时修复与发布注意点：[docs/CLEAN_MACHINE_NATIVE_RUNTIME_FIX.md](docs/CLEAN_MACHINE_NATIVE_RUNTIME_FIX.md)
- 应用源码：`local/workspace/Horosa-Web-*/` —— 前端 `astrostudyui`，后端 `astrostudysrv` / `astropy`，引擎 `vendor`

## 致谢

星阙的源流不能忘。最早的星阙 Horosa 由**郑大哥**一手创建，**荀爽（Herakleios，爽哥）**参与辅助设计，并把相关 App 与 Web 公开出来，后来者才有得研究、学习与延展。这个 Windows 版本的继续整理与发布，正是建立在他们已经搭起的星阙体系、术数工作流与公开分享精神之上——补的是 Windows 交付、运行时打包、功能整合与体验改良。没有他们，就没有今天这一版。也感谢每一位持续测试、反馈、修复，推动星阙变得更完整的人。

特别感谢 [kentang2017](https://github.com/kentang2017) 长期公开的传统术数 Python 项目。星阙接入或适配了其中多项计算引擎——已声明为 MIT 的上游项目在对应 vendored 目录与 `THIRD_PARTY_NOTICES.md` 中保留许可证说明；未找到明确开源声明的项目则单独标注，避免在没有声明的地方擅自假定许可证。
