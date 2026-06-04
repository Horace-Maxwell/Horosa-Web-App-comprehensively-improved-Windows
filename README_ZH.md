<div align="center">

简体中文 · [English](README_EN.md)

<img src="desktop_installer_bundle/assets/horosa_setup_badge.png" alt="星阙 Horosa" width="128" />

# 星阙 Horosa

**把占星与中国术数，收进一个原生 Windows 工作站**

[![Version](https://img.shields.io/badge/version-2.5.5%20beta-b45309?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.5.5)
[![License](https://img.shields.io/badge/license-AGPL--3.0-dc2626?style=flat-square)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows%2010%2F11-x64-111111?style=flat-square&logo=windows&logoColor=white)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.5.5)
[![Installer](https://img.shields.io/badge/NSIS-bundled%20runtime-1f6feb?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.5.5)
[![Stars](https://img.shields.io/github/stars/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/stargazers)

[下载安装包](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-2.5.5.exe) ·
[入口页](README.md) ·
[English Guide](README_EN.md) ·
[所有版本](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases)

</div>

---

## 星阙是什么

星阙 Horosa 是一套桌面端的玄学工作站。西方占星的本命、推运、关系盘，连同八字、紫微、奇门、六壬、太乙这些中国传统术数，被放进同一个原生 Windows 应用里。它要解决的事其实很朴素：不必在十几个网页排盘器之间来回切，也不必自己拼装底层的 Python、Java 与历表运行时——你下载一个离线 NSIS 安装包，打开的就是一个成品。

这个仓库承担的是 Windows 这一侧的交付：应用源码、共享运行时、Electron 桌面外壳，以及把这一切打成单个 NSIS 安装包（`Horosa-Setup-2.5.5.exe`）的发布链路。

## 下载

普通用户直接下载离线安装包，像任何 Windows 软件一样安装、打开即可。

**[⬇︎ Horosa-Setup-2.5.5.exe](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-2.5.5.exe)**

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

## v2.5.5 beta 更新

**v2.5.5 = 天文馆精修（投影对齐天文真值 + 每颗恒星可点击/按名搜索 + 文字更清晰）+ 流畅度优化 + 主限法铁律守护强化**。所有技法的命盘结果与 v2.5.4 完全相同；v2.5.4 及更早全部功能保留。本版仅更新桌面应用，运行时组件与 v2.5.4 一致（无需重新下载运行时）。

- **天文馆 · 投影对齐天文真值** —— 星座 / 宫位 / 星宿区间名称不再偏移；时间回放不再「先瞬跳再旋转」。前端投影改用逐日黄赤交角 + 视恒星时 + 大气折射，与后端 `swisseph.azalt` 完全一致；初始帧 / 暂停帧补算一次消除残余偏差
- **二十八宿回到赤道** —— 宿度按距星赤经定位（赤道宿度），不再误贴到黄道
- **天文馆 · 每颗恒星可点击 + 按名搜索** —— 点击任意恒星（含暗星）弹出名称 / 拜耳编号 / 星座 / 星等 / 赤经赤纬；搜索框支持中文专名 / 英文专名 / HR 编号自动补全并定位（如「织女 / Vega」「天狼 / Sirius」），对齐成熟天文馆软件
- **文字更清晰** —— 天文馆标签贴图按设备像素比（DPR）超采样 + 三线性过滤，缩放后不再发虚
- **流畅度优化（不降级任何功能）** —— 七政四余等确定性纯计算技法加「同参复用 + 在途合并」缓存：重开同一盘 / 来回切技法第二次起瞬时复显，命中结果与直连请求逐值等价；抽出通用请求去重工具供重技法 service 复用
- **主限法铁律守护强化** —— 默认 Alcabitius + Ptolemy 输出经全语料实证与 v2.5.3 逐字节一致（540/540）；校正一处过期回归基线，发布门禁 `[32]` 改为**实跑** byte-perfect 子集（此前仅查文件存在），杜绝「基线与代码脱节」再次悄悄发布。**主限法 PD 代码未改动**

完整改动见 [v2.5.5 Beta Release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.5.5) 与 [本地发布说明](docs/releases/2.5.5.md)；上一版 v2.5.4（七政宿度三制 + 主限法 v10 全方位法 + 量化盘汉堡补全 + 启动稳健化）详见 [docs/releases/2.5.4.md](docs/releases/2.5.4.md)。

## 技术构成

- **前端** —— React 17 + Umi 3 + TypeScript，Ant Design；D3 绘盘，Babylon.js / Three.js 三维，Plotly 星体地图，Monaco 编辑 AI 导出模板
- **后端** —— Java 17 / Spring Boot 承载占星与中国术数核心服务；Python 3.11 服务层封装 Swiss Ephemeris（`pyswisseph`）与 vendored 的 kentang 传统术数引擎
- **桌面壳** —— Electron 原生外壳，启动时在后台拉起本地 Python / Java 服务并做健康检查，窗口 / 缩放 / 设置状态持久化
- **运行时** —— 内置 Python 采用固定版本的 python-build-standalone（可复现、自包含），随包附带 VC++ 运行时、离线 wheels 与后端 jar；构建期有原生依赖闸门与发布前自检
- **发布** —— 面向 Windows 10 / 11（`x64`）的离线 NSIS 安装包，支持选择安装目录与升级；附 `latest.yml` / `.blockmap` / `SHA256SUMS.txt`

## 常见问题

**我只是普通用户，需要克隆仓库吗？**
不需要。直接在最新 release 里下载 `Horosa-Setup-2.5.5.exe` 即可。

**安装完还要自己装 Python 或 Java 吗？**
不需要。Windows 安装器已经把发布版所需的运行时纳入流程；首次启动会因本地解包和校验稍慢，后续复用缓存。

**可以选择安装目录吗？**
可以。v2.2.0 Beta 安装器支持标准安装向导，可选择安装目录，并在安装前做目录创建 / 写入检查、快捷方式修复；遇到 Windows 权限限制时可提权继续。

**为什么 release 里还有别的文件？**
`latest.yml`、`.blockmap` 与 `SHA256SUMS.txt` 用于更新和校验。对普通用户来说，真正要点的只有 `Horosa-Setup-2.5.5.exe`。

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
