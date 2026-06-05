<div align="center">

简体中文 · [English](README_EN.md)

<img src="desktop_installer_bundle/assets/horosa_setup_badge.png" alt="星阙 Horosa" width="128" />

# 星阙 Horosa

**把占星与中国术数，收进一个原生 Windows 工作站**<br />
*Western astrology and Chinese metaphysics, in one native Windows workstation*

[![Version](https://img.shields.io/badge/version-2.6.0%20beta-b45309?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.0)
[![License](https://img.shields.io/badge/license-AGPL--3.0-dc2626?style=flat-square)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows%2010%2F11-x64-111111?style=flat-square&logo=windows&logoColor=white)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.0)
[![Installer](https://img.shields.io/badge/NSIS-bundled%20runtime-1f6feb?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.0)
[![Stars](https://img.shields.io/github/stars/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/stargazers)

[下载安装包](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-2.6.0.exe) ·
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

**[⬇︎ Horosa-Setup-2.6.0.exe](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-2.6.0.exe)**

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

## 本次更新 · What's New in v2.6.0 beta

**v2.6.0 = 六壬毕法一百法解读层 + 紫微斗数全面增强（P0–P2）+ 奇门遁甲法奇门叠加层 + 占星世俗/卜卦/择日/星运全链路 + 城市搜索专业化 + AI 深度思考（DeepSeek reasoner）多轮兼容修复（#16）+ 起课时间即时刷新（#17）+ 升级安装修复（#18，Windows 独有）**。后端 Java 有改动 → 已重建 `astrostudyboot.jar`；v2.5.5 及更早全部功能保留。

- **六壬 · 毕法一百法解读层** —— 取象 / 毕法 100 法（93 条自动命中 + 7 条读法心诀）/ 占断向导 / 常用神煞 / 三传关系图 / 应期 / 贵神态，纯前端、AI 四同步
- **紫微斗数 · 全面增强 P0–P2** —— 主四化盘补显杂吉/杂凶 + 十二神「纳音格」；流曜下沉全层 + 流年流将前/流岁前 + 小限阴阳顺逆；格局命中详情展开 + 6 个新格局（清白格/泛水桃花/风流彩杖/羊陀夹忌/火铃照命/巨火擎羊，34→40）；流派四化表（北派/中州/自定义）；天伤天使（重建 jar）
- **奇门遁甲 · 法奇门叠加层（荀爽）** —— 新增「化解」「用神」两右栏 + 神煞判语 hover + 地支/宫名取象，纯前端零引擎改动
- **占星 · 世俗/卜卦/择日/星运全链路** —— 世俗盘月相管线 + 择日硬性标记 + 卜卦提问向导 + 回归盘/关键度/三分主星/月相相位等多项工程级补全，AI 四同步
- **城市搜索专业化** —— 繁简转换 + 拼音匹配，选地点更准更快（离线数据，运行时零新依赖）
- **AI 深度思考兼容（修 #16）** —— deepseek-reasoner 多轮对话首次请求不再易失败/空：后端透传 `reasoning_content`（思考过程独立气泡可折叠）、对推理模型不再误发采样参数（避免 400）、仅首字节前的连接/限流错误指数退避重试（已出 token 绝不重试）；前端加「空闲看门狗」
- **起课/命盘时间即时刷新（修 #17）** —— 在「选择案例」里选中「起课时间 / 命盘时间」单选，得到的是**点击此刻**的时间，而不再是打开软件那一刻的时间
- **升级安装修复（修 #18，Windows 独有）** —— 安装器在覆盖升级前会自动结束正在运行的星阙及其内置运行时（精确范围，不影响系统中其它 Java/Python），over-the-top 升级不再报「星阙无法关闭 / Failed to uninstall old application files」，**不再需要先卸载旧版**

完整改动见 [v2.6.0 Beta Release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.0) 与 [本地发布说明](docs/releases/2.6.0.md)；上一版 v2.5.5（天文馆精修 + 恒星点击/搜索 + 流畅度）详见 [docs/releases/2.5.5.md](docs/releases/2.5.5.md)。

> v2.6.0 adds a **Liuren "Bi Fa 100" interpretation layer** (imagery, the 100 methods, a divination guide, shen-sha, three-transmission diagrams, timing), a comprehensive **Zi Wei Dou Shu P0–P2 enhancement** (miscellaneous-star display, school-specific four-transformation tables, cascading flow-stars, pattern detail + 6 new patterns, Tian-Shang/Tian-Shi — rebuilt jar), a **Qi Men "Fa Qi Men" (Xun Shuang) overlay** (resolution / use-god / imagery), a **Western astrology build-out** across mundane / horary / electional / star-transit, and **professional city search** (traditional⇄simplified + pinyin). It fixes two reported issues — **#16** DeepSeek deep-thinking (reasoner) multi-turn compatibility (pass through `reasoning_content`, never send sampling params to reasoning models, first-byte-only stream retry, idle watchdog) and **#17** casting/chart time now refreshing to the moment you click, not app-open time — plus a Windows-only **installer fix #18**: the NSIS installer now force-terminates a running Horosa + its scoped embedded sidecars before an in-place upgrade, so over-the-top upgrades no longer fail and no longer need a manual uninstall first. Backend Java changed → `astrostudyboot.jar` rebuilt; all v2.5.5 and earlier features retained. Full log: [v2.6.0 release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.0).

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
