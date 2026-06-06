<div align="center">

简体中文 · [English](README_EN.md)

<img src="desktop_installer_bundle/assets/horosa_setup_badge.png" alt="星阙 Horosa" width="128" />

# 星阙 Horosa

**把占星与中国术数，收进一个原生 Windows 工作站**<br />
*Western astrology and Chinese metaphysics, in one native Windows workstation*

[![Version](https://img.shields.io/badge/version-2.6.2%20beta-b45309?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.2)
[![License](https://img.shields.io/badge/license-AGPL--3.0-dc2626?style=flat-square)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows%2010%2F11-x64-111111?style=flat-square&logo=windows&logoColor=white)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.2)
[![Installer](https://img.shields.io/badge/NSIS-bundled%20runtime-1f6feb?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.2)
[![Stars](https://img.shields.io/github/stars/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/stargazers)

[下载安装包](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-2.6.2.exe) ·
[完整中文说明](README_ZH.md) ·
[English Guide](README_EN.md) ·
[所有版本](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases)

</div>

---

星阙 Horosa 是一套桌面端的玄学工作站。西方占星的本命、推运、关系盘，连同八字、紫微、奇门、六壬、太乙这些中国传统术数，被放进同一个原生 Windows 应用里——不必在十几个网页排盘器之间来回切换，也不必自己拼装 Python、Java 与历表运行时。它以 NSIS 离线安装包的形式交付，运行时随包自带，全新 Windows 10/11 x64 机器下载即用。

> Horosa is a desktop workstation for traditional cosmology. Western natal, timing, and relationship astrology sit beside Chinese systems—Bazi, Ziwei, Qimen, Liuren, Taiyi—inside one native Windows app, so you stop juggling a dozen web tools and never hand-assemble a Python/Java/ephemeris runtime yourself. It ships as an offline NSIS installer with the runtime bundled in, ready to run on a clean Windows 10/11 x64 machine.

## 下载 · Download

普通用户直接下载离线安装包，像任何 Windows 软件一样安装打开即可。无需自备 Python 或 Java，运行时已随包交付；更新只替换程序与共享组件，不会清空你的命例数据。首次启动会因解包与校验稍慢，之后复用本地缓存。

> Regular users grab the offline installer and open it like any finished Windows app. No Python or Java to install yourself—the runtime ships inside the package—and updates replace the program and shared runtime without wiping your saved charts. The first launch is a little slower while the runtime is extracted and verified; later launches reuse the local cache.

**[⬇︎ Horosa-Setup-2.6.2.exe](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-2.6.2.exe)**

适合：Windows 10/11 · `x64` · 弱网 / 离线环境 · 首次安装 · 转发给他人。

> 安装包当前未做 Authenticode 签名，首次运行 SmartScreen 可能提示「更多信息 → 仍要运行」。
> The installer is not yet Authenticode-signed, so SmartScreen may ask you to choose "More info → Run anyway" on first launch.

## 截图 · Screenshots

<div align="center">
<img src="docs/assets/screenshots/horosa-2.0-main-workspace.png" alt="Astrology workspace" width="900" />
<p><em>占星工作区 — 左侧起盘参数，中间图盘画布，右侧信息 / 相位 / 行星 / 古典 / 格局页签。</em><br /><em>Astrology workspace — chart controls on the left, the wheel in the center, detail tabs on the right.</em></p>

<img src="docs/assets/screenshots/horosa-2.0-sanshi-workspace.png" alt="Sanshi workspace" width="900" />
<p><em>三式工作区 — 起盘参数、九宫盘面、概览 / 太乙 / 神煞 / 六壬 / 八宫页签同屏。</em><br /><em>Sanshi workspace — setup, the nine-palace plate, and overview tabs in one view.</em></p>

<img src="docs/assets/screenshots/horosa-2.0-module-navigator.png" alt="Module navigator" width="900" />
<p><em>导航弹层 — 命盘推运、易与三式、工具工作台分组，支持搜索与最近使用。</em><br /><em>Command overlay — charts, Yi & Sanshi, and tools, with search and recents.</em></p>
</div>

## 功能总览 · What's Inside

导航把所有模块归为三组：**命**（命盘与推运）、**卜**（易与三式）、**工具**。下面是各组里实际可用的内容。

> Everything lives under three groups: **命** charts & timing, **卜** divination, and **工具** tools. Here is what each one actually ships.

### 命 · Charts & Timing

| 模块 | 说明 |
| --- | --- |
| **占星 Astrology** | 本命盘与三维盘（Babylon.js 实时 3D），多种宫位制与古典 / 现代行星集 |
| **星运 Timing** | 主限法（Primary Directions）、黄道星释（Zodiacal Releasing）、法达（Firdaria）、小限（Profection）、太阳弧（Solar Arc）、太阳 / 太阴返照、十年法、推运、星历 |
| **合盘 Relationship** | 比较盘、组合盘、影响盘、时空中点盘、马克斯盘 |
| **辅盘 Specialty** | 希腊星术（界限 / 阿拉伯点）、量化盘 / 中点树（汉堡学派）、星体地图（占星地理定位）、调波盘 |
| **印占 Vedic** | 北 / 南 / 东印度盘，恒星黄道 |
| **七政 Qizheng** | 七政四余、七政 Moira |
| **八字 Bazi · 紫微 Ziwei** | 四柱排盘；紫微斗数含四化盘 |
| **数算 · 其他** | 邵子神数、铁板神数、演禽等数术方法 |

### 卜 · Divination

| 模块 | 说明 |
| --- | --- |
| **三式 Sanshi United** | 奇门、太乙、六壬整合面：概览、太乙、神煞、六壬、大格、小局、参考、八宫 |
| **遁甲 Qimen · 六壬 Liuren · 太乙 Taiyi** | 三式各自的独立排盘入口 |
| **六爻 Liuyao · 分至 Jieqi · 风水 Feng Shui** | 纳甲六爻、节气盘、风水工具 |
| **其他 More** | 宿盘、金口诀、统摄法、皇极经世、五兆、太玄、荆诀、神易数 |

### 工具 · Tools

| 模块 | 说明 |
| --- | --- |
| **AI 分析 AI Analysis** | 接入 OpenAI / Anthropic / Gemini / Ollama / OpenRouter / 自定义端点；支持流式对话、历史记录、资料库（向量检索）、按技法 / 页签结构化导出 |
| **天文馆 Planetarium** | Babylon.js 实时三维天象 |
| **黄历 Almanac** | 农历 / 节气 / 择日 |
| **辅助 References** | 八卦类象、十二宫、规则速查 |

命盘与事盘都能本地保存：带标签、快照、后端原始数据，可 JSON 导入导出，重开后恢复现场。

> Charts and cases save locally—tags, snapshots, raw backend payloads, JSON import/export, and full restore on reopen.

## 本次更新 · What's New in v2.6.2 beta

**v2.6.2 = v2.6.1 的全部功能 + Windows「升级安装从未成功（issue #18）」彻底修复**。纯安装器补丁（NSIS `customUnInstallCheck`），命盘计算 / 前端 / jar 与 v2.6.1 **字节级一致**：覆盖升级时若旧版本卸载器返回非零——中文 Windows 用户名让旧版默认强杀（`/FI "USERNAME eq %USERNAME%"`）失配、或中文安装路径 `…\星阙` 下某文件被安全软件（360 / Defender 实时扫描）/ OneDrive / 开机自启短暂占用——安装器**不再**以「Failed to uninstall old application files: 2」中止，而是**接管**：强制结束残留星阙进程 + 仅清理旧「程序目录」后继续升级（用户数据零影响）。v2.6.0 的 `customCheckAppRunning` 只能加固「新」安装器，无法修复一次原地升级被迫调用的「旧」卸载器——这正是重启也无效的根因。

> v2.6.2 is a Windows-installer-only patch over v2.6.1 (chart math / frontend / jar byte-identical). In-place upgrades that previously died with "Failed to uninstall old application files: 2" — even after a reboot — now succeed: the installer takes over when the *old* (already-on-disk) uninstaller fails on a Chinese username / Chinese install path / a momentarily AV-locked file, force-cleaning the stale program dir and continuing. User data is never touched.

—— 以下为 v2.6.1 引入的功能（v2.6.2 全部保留）——

**v2.6.1 = AI 挂载全选项打磨（每技法「设置」齿轮抽屉，schema 驱动，无遗漏）+ 多时段 / 区间扫描输出 + 风水八卦阳宅法 v2（倪海厦，纯前端）+ 一批跨模块修复**。唯一后端改动 = `ChartController.getParams()` 转发 `pdYears`（挂载主限法年数生效的真因）→ 已重建 `astrostudyboot.jar`；所有技法命盘计算与 v2.6.0 字节级一致，v2.6.0 及更早全部功能保留。

- **AI 挂载全选项** —— 每技法「设置」齿轮抽屉（`techniqueMountSettings` schema 驱动）+ 内容勾选；**多时段日期选择器 + 区间扫描**输出。零回归铁律「默认即现状」（等于默认的项被 prune，快照逐字节不变）
- **主限法挂载年数生效（重建 jar）** —— 后端 `ChartController.getParams()` 此前丢弃 `pdYears` + `pdDirect/pdConverse/pdAntiscia/pdTerms` → 挂载主限法选项不生效；改为条件转发（缺省零回归）+ `_wireRev v9`（旧缓存失效）
- **风水 · 八卦阳宅法 v2（倪海厦，纯前端）** —— 新增八卦核 / 数据 / 纳气规则 + 罗盘皮肤；默认仍纳气盘，逐字节零回归
- **多盘 / 多时段补全** —— 占星各推运 builder、主限法盘表拆分、紫微 / 八字挂载、六爻三卦全装卦 + 一键挂载
- **跨模块修复** —— 辅盘样式切换失效（误把事件对象当值）、三式「时空」中点盘端口兜底（:9999→:8899）、主题 / 布局 / 暗黑双色快修

完整改动见 [v2.6.2 Beta Release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.2) 与 [本地发布说明](docs/releases/2.6.2.md)（v2.6.1 功能说明见 [docs/releases/2.6.1.md](docs/releases/2.6.1.md)）；上一版 v2.6.0（六壬毕法100法 + 紫微 P0–P2 + 奇门法奇门 + 占星 buildout + #16/#17/#18 修复）详见 [docs/releases/2.6.0.md](docs/releases/2.6.0.md)。

> v2.6.1 polishes **AI-mount full options** (a per-technique settings drawer driven by a schema, with nothing missed) plus **multi-moment / range-scan output**, adds a **Feng Shui "Bagua Yang-dwelling" method v2** (Ni Haisha, front-end only, default still the Naqi plate — byte-identical), and lands a batch of cross-module fixes. The one backend change forwards `pdYears` (+ `pdDirect/pdConverse/pdAntiscia/pdTerms`) in `ChartController.getParams()` — the real reason the AI-mounted primary-direction year options didn't take — so the jar is rebuilt. All technique chart math is byte-identical to v2.6.0; every v2.6.0 and earlier feature is retained. Full log: [v2.6.2 release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.2).

## 技术构成 · Under the Hood

- **前端 Frontend** — React 17 + Umi 3 + TypeScript，Ant Design；D3 绘盘，Babylon.js / Three.js 三维，Plotly 星体地图，Monaco 编辑 AI 导出模板。
- **后端 Backend** — Java 17 / Spring Boot 承载占星与中国术数核心服务；Python 3.11 服务层封装 Swiss Ephemeris（`pyswisseph`）与 vendored 的 kentang 传统术数引擎。
- **桌面壳 Desktop** — Electron 原生外壳，启动时在后台拉起本地 Python / Java 服务并做健康检查；窗口、缩放与设置状态持久化。
- **运行时 Runtime** — 内置 Python 采用固定版本的 python-build-standalone（可复现、自包含），随包附带 VC++ 运行时、离线 wheels 与后端 jar；构建期有原生依赖与发布前自检闸门。
- **发布 Distribution** — 面向 Windows 10/11（`x64`）的离线 NSIS 安装包，支持选择安装目录与升级；附 `latest.yml` / `.blockmap` / `SHA256SUMS.txt` 更新与校验资产。

## 文档 · Documentation

- [README_ZH.md](README_ZH.md) — 中文完整说明
- [README_EN.md](README_EN.md) — Full English guide
- [desktop_installer_bundle/README.md](desktop_installer_bundle/README.md) — 桌面打包与安装器说明 / installer internals
- [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) — 项目结构说明 / project structure
- [docs/CLEAN_MACHINE_NATIVE_RUNTIME_FIX.md](docs/CLEAN_MACHINE_NATIVE_RUNTIME_FIX.md) — 干净 Windows 运行时修复与发布注意点 / clean-machine runtime notes
- [docs/releases/2.2.0.md](docs/releases/2.2.0.md) · [docs/releases/2.1.8.md](docs/releases/2.1.8.md) · [docs/releases/2.1.7.md](docs/releases/2.1.7.md) · [docs/releases/2.1.6.md](docs/releases/2.1.6.md) · [docs/releases/2.1.5.md](docs/releases/2.1.5.md) · [docs/releases/2.1.4.md](docs/releases/2.1.4.md) · [docs/releases/2.1.3.md](docs/releases/2.1.3.md) · [docs/releases/2.1.2.md](docs/releases/2.1.2.md) · [docs/releases/2.1.1.md](docs/releases/2.1.1.md) · [SECURITY.md](SECURITY.md) · [SUPPORT.md](SUPPORT.md) · [CONTRIBUTING.md](CONTRIBUTING.md) · [CITATION.cff](CITATION.cff)
- 源码 / source: `local/workspace/Horosa-Web-*/`（前端 `astrostudyui`，后端 `astrostudysrv` / `astropy`，引擎 `vendor`）

## 致谢 · Acknowledgements

星阙的源流不能忘。最早的星阙 Horosa 由**郑大哥**一手创建，**荀爽（Herakleios，爽哥）**参与辅助设计，并把相关 App 与 Web 公开出来，后来者才有得研究、学习与延展。本项目正是在他们搭好的星阙体系、术数工作流与公开分享精神之上，继续做 Windows 交付、运行时打包、功能整合与体验改良。也感谢每一位持续测试、反馈、修复，推动 Horosa 变得更完整的人。

特别感谢 [kentang2017](https://github.com/kentang2017) 长期公开的传统术数 Python 项目。Horosa 接入或适配了其中多项计算引擎——已声明 MIT 的上游在对应 vendored 目录与 `THIRD_PARTY_NOTICES.md` 保留许可证；未找到明确开源声明的项目则单独标注，避免混同。

> The lineage matters. Horosa was originally created by **郑大哥**, with auxiliary design by **荀爽 (Herakleios)**, who released the App and Web that made later study and extension possible. This Windows edition builds on that groundwork—adding Windows delivery, runtime packaging, integration, and polish—with gratitude to them and to everyone who keeps testing and fixing along the way. Special thanks to [kentang2017](https://github.com/kentang2017), whose openly shared Python projects power several of Horosa's calculation engines.
