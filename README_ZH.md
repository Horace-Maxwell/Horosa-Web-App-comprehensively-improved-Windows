<div align="center">

简体中文 · [English](README_EN.md)

<img src="desktop_installer_bundle/assets/horosa_setup_badge.png" alt="星阙 Horosa" width="128" />

# 星阙 Horosa

**把占星与中国术数，收进一个原生 Windows 工作站**

[![Version](https://img.shields.io/badge/version-2.6.5%20beta-b45309?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.5)
[![License](https://img.shields.io/badge/license-AGPL--3.0-dc2626?style=flat-square)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows%2010%2F11-x64-111111?style=flat-square&logo=windows&logoColor=white)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.5)
[![Installer](https://img.shields.io/badge/NSIS-bundled%20runtime-1f6feb?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.5)
[![Stars](https://img.shields.io/github/stars/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/stargazers)

[下载安装包](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-2.6.5.exe) ·
[入口页](README.md) ·
[English Guide](README_EN.md) ·
[所有版本](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases)

</div>

---

## 星阙是什么

星阙 Horosa 是一套桌面端的玄学工作站。西方占星的本命、推运、关系盘，连同八字、紫微、奇门、六壬、太乙这些中国传统术数，被放进同一个原生 Windows 应用里。它要解决的事其实很朴素：不必在十几个网页排盘器之间来回切，也不必自己拼装底层的 Python、Java 与历表运行时——你下载一个离线 NSIS 安装包，打开的就是一个成品。

这个仓库承担的是 Windows 这一侧的交付：应用源码、共享运行时、Electron 桌面外壳，以及把这一切打成单个 NSIS 安装包（`Horosa-Setup-2.6.5.exe`）的发布链路。

## 下载

普通用户直接下载离线安装包，像任何 Windows 软件一样安装、打开即可。

**[⬇︎ Horosa-Setup-2.6.5.exe](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-2.6.5.exe)**

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

## v2.6.5 beta 更新

**v2.6.5 = 合盘交互链全面重建（5 子盘全可用）+ AI「起课时间」挂载 8→13 技法 + Python 数值经纬度容错 + 导航搜索关键词 + 关于框真图标**。本版**无后端 Java 改动 / 无需重建 jar**（合盘端点恢复 = 前端把请求路由回 Java modern-chart 后端 `:9999`，`ModernChartController` v2.6.4 已在）；命盘计算默认行为与 v2.6.4 字节级一致；v2.6.4 之前所有功能全部保留。

- **合盘 / 关系盘交互链全面重建** —— 五子盘（合盘 / 组合中点 / Marks / 时空盘 / 关系评分）全部恢复可用：请求路由回 Java `:9999`、ResizeObserver 实测高度、`chartStyle/dispatch/onChange` 全透传、change 直写 fields、`paramsToFields` 不再覆盖宫制/黄道、黄道 Select 局部 CSS 定宽 50/50
- **AI「起课时间」挂载 8→13 技法** —— 太玄 / 荆诀 / 五兆 / 神易数各补 `buildXxxSnapshotForFields` 快照构造器，起课盘现可挂入 AI 分析；技法注册表 + 一键挂载文案同步全 13 项（4 法升 `kind:'payload'`，`buildFieldObject` 兜底 `divTime`）
- **Python 数值经纬度容错** —— `helper.py` 的 `convertLonStrToDegree/convertLatStrToDegree` + `realsuntime.py` 的 `getBaseLonByZone` 接受地图选点存的浮点经纬度 / 时区，修地图选点排盘潜在 crash
- **顺手修** —— 全 22 模块导航搜索补 keywords；关于框真 `appicon.png` 图标；波斯向运「应期年数」联动表格；UranianDial glyph 描边修复；测天字重微调；星历 / 额外盘 / 巴比伦星空一批小修
- **测试** —— jest **658 通过 / 70 suites**（v2.6.4: 638）；service-manager + update-signature **39 通过**

—— 以下为 v2.6.4 引入的功能（v2.6.5 全部保留）——

**v2.6.4 = 恒星黄道 47 岁差全栈 + 西洋月宿 + 印占补齐 + AI 四同步双盘双配置 + AI 报告生成 v1 + 启动健壮性大批加固**。后端 Java 改动（8 个控制器 `getParams()` 全栈透传 `siderealAyanamsa`）→ 已重建 `astrostudyboot.jar`；命盘计算默认行为与 v2.6.3 字节级一致；v2.6.3 之前所有功能全部保留。**修复 Windows issue #21**「点击排盘提示『本地排盘服务未就绪』，无处查看状态、自检修复失效」。

- **恒星黄道全栈补齐（重建 jar）** —— 西洋盘「黄道」从 回归/恒星 二元扩为 **回归 + 47 ayanāṃśa**（复用印占注册表），每制经 Swiss Ephemeris 真实位移；覆盖全西洋技法盘（命占/合盘/中点/3D/卜卦/三式/节气）。**siderealAyanamsa 贯穿前端 + Java 8 控制器 + Python 排盘 + 响应回显 + 储存。**
- **西洋盘月宿（Nakshatra）** —— 恒星黄道模式下显示 27 宿（新 `astropy/astrostudy/nakshatra.py`）
- **印占补齐** —— 左栏下拉遮挡修复 + 岁差 6→47 / 分宫 4→24（`SE_SIDM 0–46`）
- **AI 四同步** —— 双盘技法（返照/小限/太阳弧/流年/行星弧/主限法盘/Vedic·Jayne 推运）补「本命盘 + 时段盘」双配置；印占 / 七政四余(su28) / 西洋盘挂载设置补齐可调项；波斯向运加「应期年数」开关；`AI_EXPORT_SETTINGS_VERSION` 23→24 自动迁移
- **AI 报告生成 v1（纯前端）** —— 6 套预置模板（八字 8/12/20 节 + 紫微 8/12/20 节）+ 9 套流派 guideline + 分节顺序流式 + 命盘截图嵌入（`html-to-image`）+ 4 种导出（Markdown / PDF / Word / HTML）；IndexedDB schema v3→v4 自动 migrate
- **启动健壮性大批加固（修复 issue #21）** —— 右下角常驻后端健康灯 🟢/🟡/🔴；「排盘失败」Modal 4 类原因 + 4 个一键操作；透明重试 12s→30s 覆盖慢机首启；StartupGate 6s/15s/30s 分阶段文案 + 操作按钮
- **测试** —— jest **638 通过 / 68 suites**（v2.6.3: 522）；service-manager + update-signature **39 通过**

—— 以下为 v2.6.3 引入的功能（v2.6.5 全部保留）——

**v2.6.3 = AI 分析一轮深度打磨 + Qizheng 七政四余「政余格局/相位」出导/挂 + 五兆/太玄/荆诀/神易数补 AI 挂载 + 分至盘样式修复 + 多处稳定性修复**；**修复 Windows issue #20**「聊天挂载内容被截断 + 太阳返照 AI 用本命盘信息」。

—— 以下为 v2.6.2 引入的修复（v2.6.5 全部保留）——

**v2.6.2 = v2.6.1 全部功能 + Windows「升级安装从未成功（issue #18）」彻底修复**。纯安装器补丁（NSIS `customUnInstallCheck`），覆盖升级时若旧版本卸载器返回非零（中文用户名 / 中文安装路径 + 杀软占用）→ 安装器接管：强制结束残留星阙 + 仅清理旧「程序目录」后继续升级，用户数据零影响。

—— 以下为 v2.6.1 引入的功能（v2.6.5 全部保留）——

**v2.6.1 = AI 挂载全选项打磨 + 多时段 / 区间扫描输出 + 风水八卦阳宅法 v2（倪海厦，纯前端）+ 一批跨模块修复**；唯一后端改动 = `ChartController.getParams()` 转发 `pdYears`（挂载主限法年数生效的真因）→ 已重建 `astrostudyboot.jar`。

完整改动见 [v2.6.5 Beta Release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v2.6.5) 与 [本地发布说明](docs/releases/2.6.5.md)（v2.6.4 见 [docs/releases/2.6.4.md](docs/releases/2.6.4.md), v2.6.3 见 [docs/releases/2.6.3.md](docs/releases/2.6.3.md), v2.6.2 安装器补丁见 [docs/releases/2.6.2.md](docs/releases/2.6.2.md), v2.6.1 功能见 [docs/releases/2.6.1.md](docs/releases/2.6.1.md)）；上一版 v2.6.0（六壬毕法100法 + 紫微 P0–P2 + 奇门法奇门 + 占星 buildout + #16/#17/#18 修复）详见 [docs/releases/2.6.0.md](docs/releases/2.6.0.md)。

## 技术构成

- **前端** —— React 17 + Umi 3 + TypeScript，Ant Design；D3 绘盘，Babylon.js / Three.js 三维，Plotly 星体地图，Monaco 编辑 AI 导出模板
- **后端** —— Java 17 / Spring Boot 承载占星与中国术数核心服务；Python 3.11 服务层封装 Swiss Ephemeris（`pyswisseph`）与 vendored 的 kentang 传统术数引擎
- **桌面壳** —— Electron 原生外壳，启动时在后台拉起本地 Python / Java 服务并做健康检查，窗口 / 缩放 / 设置状态持久化
- **运行时** —— 内置 Python 采用固定版本的 python-build-standalone（可复现、自包含），随包附带 VC++ 运行时、离线 wheels 与后端 jar；构建期有原生依赖闸门与发布前自检
- **发布** —— 面向 Windows 10 / 11（`x64`）的离线 NSIS 安装包，支持选择安装目录与升级；附 `latest.yml` / `.blockmap` / `SHA256SUMS.txt`

## 常见问题

**我只是普通用户，需要克隆仓库吗？**
不需要。直接在最新 release 里下载 `Horosa-Setup-2.6.5.exe` 即可。

**安装完还要自己装 Python 或 Java 吗？**
不需要。Windows 安装器已经把发布版所需的运行时纳入流程；首次启动会因本地解包和校验稍慢，后续复用缓存。

**可以选择安装目录吗？**
可以。v2.2.0 Beta 安装器支持标准安装向导，可选择安装目录，并在安装前做目录创建 / 写入检查、快捷方式修复；遇到 Windows 权限限制时可提权继续。

**为什么 release 里还有别的文件？**
`latest.yml`、`.blockmap` 与 `SHA256SUMS.txt` 用于更新和校验。对普通用户来说，真正要点的只有 `Horosa-Setup-2.6.5.exe`。

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
