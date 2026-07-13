<div align="center">

简体中文 · [English](README_EN.md)

<img src="assets/horosa_setup_badge.png" alt="星阙 Horosa" width="128" />

# 星阙 Horosa

**把所有玄学放进一个原生 Windows 软件里**<br />
*Every kind of metaphysics, in one native Windows app*

[![Version](https://img.shields.io/badge/version-3.3.5-2ea043?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v3.3.5)
[![License](https://img.shields.io/badge/license-AGPL--3.0-dc2626?style=flat-square)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows%2010%2F11-x64-111111?style=flat-square&logo=windows&logoColor=white)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v3.3.5)
[![Installer](https://img.shields.io/badge/NSIS-bundled%20runtime-1f6feb?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v3.3.5)
[![Stars](https://img.shields.io/github/stars/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/stargazers)

[下载安装包](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/download/v3.3.5/Horosa-Setup-3.3.5.exe) ·
[中文详版](README_ZH.md) ·
[English Guide](README_EN.md) ·
[所有版本](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases)

</div>

---

## 目录

1. [星阙是什么](#一星阙是什么)
2. [技术栈](#二技术栈)
3. [全功能清单（命 / 卜 / 工具）](#三全功能清单)
4. [网页版一键启动（从源码）](#四网页版一键启动从源码)
5. [许可与第三方](#五许可与第三方)
6. [致谢](#六致谢)
7. [文档与入口](#七文档与入口)

---

## 一、星阙是什么

星阙 Horosa 是一套桌面端玄学工作站，把几乎所有玄学术数放进同一个原生 Windows 应用里。从西方占星（本命、推运链、合盘）到中国术数（八字、紫微、奇门、六壬、太乙、六爻、风水、七政四余），再到印度吠陀、希腊化、汉堡量化、塔罗、地占等，外加内置多 LLM AI 分析。

目标是：**不再在十几个单一用途的网页排盘器之间来回切换，也不用手工拼装底层的 Python / Java / 星历运行时**。下载一个离线的安装包，打开就是成品。

本仓承担 Windows 这一侧的交付：应用源码、共享运行时、Windows 适配层，以及面向最终用户的 NSIS 离线安装包（`Horosa-Setup-3.3.5.exe`）发布。

- **当前版本**：3.3.5（运行时 `3.3.5-runtime1`）
- **平台**：Windows 10 / 11（`x64`）
- **许可**：AGPL-3.0-only

> 安装包当前未做 Authenticode 签名，首次运行 SmartScreen 可能提示「更多信息 → 仍要运行」；请从官方 Releases 下载并可比对 `SHA256SUMS.txt` 校验。

### 截图

<div align="center">
<img src="assets/screenshots/horosa-2.0-main-workspace.png" alt="Astrology workspace" width="900" />
<p><em>占星工作区 — 左栏起盘参数，中栏图盘画布，右栏信息 / 相位 / 行星 / 古典 / 格局页签。</em></p>

<img src="assets/screenshots/horosa-2.0-sanshi-workspace.png" alt="Sanshi workspace" width="900" />
<p><em>三式工作区 — 起盘参数、九宫盘面、概览 / 太乙 / 神煞 / 六壬 / 八宫页签同屏。</em></p>

<img src="assets/screenshots/horosa-2.0-module-navigator.png" alt="Navigation overlay" width="900" />
<p><em>导航弹层 — 命盘推运、易与三式、工具工作台分组，支持搜索与最近使用。</em></p>
</div>

---

## 二、技术栈

| 层 | 技术 | 说明 |
| --- | --- | --- |
| 桌面壳 | **Electron** | 原生外壳：生命周期 / 窗口 / 运行时引导 / 应用内更新（增量下载 + Ed25519 验签）/ 缩放持久化；离线运行时随包交付 |
| 前端 | **React 17 + UMI 3 + TypeScript / JS**，Ant Design | D3 绘盘、Babylon.js / Three.js 三维、Plotly 星体地图、Monaco 编辑 AI 导出模板 |
| 后端（业务） | **Java 17 / Spring Boot 2.7**（多模块 Maven） | 承载占星与中国术数核心服务；监听 `:9999`（前端请求体 RSA 加密），重计算转发 Python |
| 后端（计算） | **Python 3.11** | 封装 Swiss Ephemeris（`pyswisseph`）+ flatlib（改写版）+ vendored 传统术数计算引擎；CherryPy REST `:8899` |

**端口约定**：前端 ↔ Java `:9999`（RSA 加密信封）；Java ↔ Python `:8899`；前端静态端口动态分配（多实例不撞）。

---

## 三、全功能清单

导航把所有模块归为三组：**命**（命盘与推运）、**卜**（易与三式）、**工具**。模块名与应用内页签一一对应。

### 命 · 命盘与推运

这一层的强项是连贯：读本命、沿时间推开、再带进第二个人，全程不离开同一个工作面。

#### 占星（西方本命盘）
- 回归 / 恒星黄道本命盘；左栏起盘参数、中栏 D3 圆盘、右栏多页签信息。
- **流派一键预设**（含自定）：Brennan / Valens / Ptolemy / Dykes / Houlding / Zoller —— 每档联动黄道·宫制·界系·三分；默认 Brennan 档 = 零回归基线。
- **黄道系统**：回归 + 多种恒星 ayanāṃśa（印度主流族 / 真星定标 / 西占恒星 / 银道银心 / 历史巴比伦 + 历元）。
- **宫位制**：整宫 Whole Sign、Alcabitius、Koch、Porphyry、Equal、Meridian、Sunshine、Pullen SD/SR、APC、福点整宫 等多种。
- **界系（Bounds）**：Egyptian（默认）/ Ptolemaic / Lilly。**三分（Triplicity）**：Dorothean（默认）/ Ptolemaic / Ptolemaic Water Variant。
- **古典参数**（右栏「古典」页签）：日夜生盘（sect）、出界（out-of-bounds）、喜乐宫（joy）、宗派、野逸、月站、Thema Mundi、衍生宫、显赫度（eminence）、klimata。
- **右栏页签**：信息 / 相位 / 行星（+希腊点 Lots）/ 古典 / 可能性 / 格局 / 埃及。
- **3D 盘**（Babylon.js，与 2D 同数据源）、**星体地图 / 占星地理定位 ACG**（含地图选点）。
- **AI / 储存**：底部快捷坞导航各推运法；多类快照；存为命盘、批注。

#### 星运（推运总台）
- **主限法（Primary Directions）**：
  - **核心方位法**：Alcabitius（默认）/ Meridian / Porphyry / Equal Ecliptic / Equal Hour Circle。
  - **方向类型**：In Zodiaco（黄道，默认）/ In Mundo（世俗）。
  - **向运方向**：顺向 Direct / 逆向 Converse / 顺逆合展；**迫星**：映点迫星（antiscia）/ 界限迫星（terms）。
  - **时间换算（time keys）**：Ptolemy（默认）、Naibod、Cardano、Umar、Wöllner、Plantiko、TrueSolarArc、SymbolicSolarArc、SynodicYear、Kepler、Brahe 等。
- **其它推运法**（各独立子页 / 页签）：太阳弧、法达（Firdaria）、小限（Profections）、太阳返照、太阴返照、十年法、十年分段、黄道星释（Zodiacal Releasing）、行星年龄、印占推运、Jaynes 二次推运、行星弧、波斯向运、129 年体系、Balbillus、三分主星、关键点、月相推运、其它回归、产前朔望、二次推运总台、返照时间线、分布、年龄推进点、星历。

#### 八字（四柱）
- 四柱排盘走前端本地引擎；十神、五行力量旺衰、天干地支双层解读。
- **断命流派选择器**：传统综合（默认）/ 扶抑 / 格局 / 调候 / 病药 / 盲派 / 纳音古法。
- **解读层**：命宫数法、五行旺衰、格局（正格 / 变格 / 杂格）、用神三派（扶抑 / 格局 / 调候 + 病药 / 通关）、月律分野、神煞补全、虚岁 / 周岁、盲派结构、纳音古法盘。
- **推运**：大运 / 流年 / 流月 / 流日 / 流时 / 小运（多运限笛卡尔组合）；神煞面板随所选运限刷新。

#### 紫微（紫微斗数）
- 十二宫本命盘（默认字节零回归；任一传本开关走前端本地引擎双路）。
- **四化流派**：通行·飞星（默认基表）/ 全书系 / 中州派 / 北派·通用飞星 / 飞星派 / 透派。
- **分歧点开关**：大限跨度、天马基准、星集、三盘、天伤天使（固定 / 阴阳互换）、闰月、晚子时、定年界线、火铃（三合 / 南派）、空劫命名。
- 天地人三盘、格局本地化（含断语 / 来源 / 破条件）、长生标签层。
- **推运（运限）**：大限 / 流年（含小限）/ 流月 / 流日 / 流时；四化滑窗最多 3 层（自化仅无运限时）。

#### 七政（七政四余 / 果老星宗）
- 28 宿度系 + 七政（日月水金火木土）+ 四余（罗睺 / 计都 / 紫炁 / 月孛）。
- **双引擎**：Horosa 自研 / Kinastro（Qizheng）。**宿度制**：正恒星 / 古法立成 / 赤道回归。
- 庙旺陷落、化曜、虚实强弱、罗计真平交点 / 月孛真平远地点、七政擢升度数、报时星真 / 平 / 关太阳时。
- **大限**：洞微大限（共转法）/ 羽毛大限（古法渐进）。出生神煞 / 流年神煞。三盘面（环形大限盘 / 精选盘 / Qizheng 图）。

#### 印占（印度吠陀占星）
- 北 / 南 / 东印盘式 + 顺逆时针镜像；多种宫制 + 与西占同族 ayanāṃśa。
- **分盘 Vargas**：D1 Rashi … D60（主流分盘 + 分盘集网格）。
- **大运 Dasha**：Vimshottari（默认 120 年）+ Yogini（36）/ Ashtottari（108）/ KP（180）；主期 / Antardasha / 三级子期；Naisargika 自然大运。
- Yoga 自动识别、27 Nakshatra、Shadbala、Ashtakavarga、Vimsopaka、KP（真 Placidus 体系 + 订正）、Tajika / Argala / Gochara、Muhurta / Choghadia 择时、八分点、六座运、多流派器。

#### 辅盘
- **量化盘 / 汉堡学派**：四派 = classic / pure / uranian 美国对称 / cosmo 宇宙生物学；90°（或 45°）拨盘、中点树、中点相位、六宫框、图形星历、超海王星虚星（TNP）、校时、宇宙图。
- **希腊星术**：十三分盘（13 次谐波，界限 / 阿拉伯点）。
- **十二分盘、占星地图 / 重置盘、谐波盘（N 次）、龙盘（Draconic）、卜卦盘（五流派）、择日盘、世俗盘**。

#### 合盘
- 关系盘：比较盘（双向相位 / 中点 / 映点）/ 组合盘（中点生成第三盘）/ 影响盘（Synastry，内外双层）/ 时空中点盘 / 马克斯盘 + 关系量化评分。

#### 数算
- 邵子神数 / 铁板神数（扣入法 + 大运）/ 鬼谷分定经（两头钳）/ 北极神数 / 南极神数 / 蠢子数 / 邵子参评数（金锁银匙）/ 河洛理数（先后天八卦 + 爻辞）。

#### 其他（命）
- 演禽 / 万化仙禽（三宫 / 星禽 / 吞啖）；策天飞星（18 星飞布，两派：书法 / 原法）。

### 卜 · 易与三式

易与三式不止是几个独立页签，三式合一已做成一个真正能工作的整合面。

#### 三式（合一）
- 奇门 + 太乙 + 六壬整合呈现于一面，与三式各独立页**同输入同结果 + 同富显示**。
- 快捷页签：概览 / 太乙 / 六壬 / 遁甲（右栏富显示对齐独立页）；全选项流派对齐独立页（奇门各家本地局法、月家定局法、太乙 timeBasis）。

#### 遁甲（奇门遁甲）
- 起局法（置闰 / 拆补 / 茅山 / 无闰 / 阴盘报数）；盘式（转盘 / 飞盘 / 混合）；时家 / 日家 / 月家 / 年家；空亡驿马（日 / 时）；直使。
- 用神取用（基本类 + 查用类 + 生克类）；八宫面板。

#### 六壬（大六壬）
- 四课三传 + 64 课经（课体）。
- 贵人五法、月将三派、分昼夜三派、涉害取舍（含边界口径）、大格、小局、毕法（64 课匹配库）、七政四余子页。
- **AI / 储存**：流派挂载快照（含导出补登）。

#### 六爻（六爻纳甲）
- 全层引擎；**流派预设 + 自定**：通用 / 增删卜易·野鹤 / 卜筮正宗 / 易隐 / 邵伟华新派 / 盲派 / custom。
- 起卦法：摇卦 / 蓍草 / 时间（梅花）/ 报数 / 装卦；断卦设置（占类 / 月破 / 土长生 / 变爻范围 / 卦身 / 飞伏 / 变卦装法 / 神煞 / 六神 / 年界线）；本 / 互 / 之 / 错 / 综卦。

#### 太乙（太乙神数）
- 计神积年（多种古法常数）；盘式（時 / 年 / 月 / 日 / 分計 + 命法式样）；主客算几何（默认 / 加一宫 / 不加一宫）；格局胜负；分野；诸神之算（多类数理）。
- **流派覆盖层**（多轴开关，纯前端派生覆盖）；命法特化；大小限运。盘面落宫高亮 + 格局连线 + 点击面板。

#### 分至（节气盘）
- 24 节气盘 + 回归 / 恒星黄道行星位置 + 节气时刻。

#### 风水
- **两类八派**：户型图阳宅（纳气盘法 / 八卦阳宅法）；理气起盘罗盘（八宅·大游年 / 玄空飞星 / 三合·十二长生水法 / 金锁玉关 / 乾坤国宝 / 紫白飞星）。
- 玄空进阶（替卦兼向 / 城门 / 七星打劫 / 流月）；元运 / 坐向 / 流年流月 / 水口 / 坐卦 / 命。

#### 其他（卜）
- **宿占**（28 / 27 宿月宿 + 宿主 + 纳音）、**统摄法**（四象映八卦）、**皇极经世**（四起卦法 + 时空盘）、**五兆**（五起盘法 + 五分法）、**太玄**（太玄经 81 首揲筮 + 读卦深度）、**荆诀**、**神易数**。
- **金口诀**（多流派）：贵人体系 / 月将换将 / 盘式；五动三动 / 格局 / 四位生克 / 用神 / 神煞 / 应期 / 地分 / 空亡 / 纳音。
- **地占（天文地占）**：16 图盾牌（四母四女四甥 + 判官 + 调和者 + 两见证）/ 宫位图形入宫 / 占星定局 / 完美相位同伴。**多流派**（古典定局 / 行星共鸣 / 现代综合 / 阿拉伯沙占 / 印度骰占 / Sikidy / Hakata）；范围 L0–L4 / 黄道（古典 / 行星）/ 起卦（随机 / 时间 seed 可复现 / 手工 seed）；断语逐图含义。
- **塔罗**：**多牌组**（核心四套 + BOTA / Wirth / Egyptian / Etteilla / Lenormand 36 / Grand Tableau / Kipper 36 / Sibilla 52 / 扑克 52 / Visconti / Minchiate 97）；**多牌阵**；定局法（是否 / 精华 / 生命牌 / 年牌 / 计数链 / 合成叙事）；变体 A/B/C / 尊位 / 同 seed 跨流派一致。

### 工具 · 工作台

#### AI 分析
- **多 LLM 接入**：OpenAI / DeepSeek / Anthropic / Gemini / OpenRouter / Ollama（本地）/ Moonshot(Kimi) / 智谱 / 硅基流动 / Groq / xAI / 自定义 OpenAI 兼容端点。
- **思考 / 推理档**（off / low / medium / high / xhigh / max）；按协议族映射（Anthropic thinking budget / OpenAI reasoning_effort / Gemini thinkingConfig）；视觉模型自动识别。
- 流式对话（SSE，可停止）+ 历史记录 + 资料库（RAG：分块 / 向量嵌入 / 检索 / 关键词 + 向量重排）。
- **技法挂载**：命盘类与事盘类各式法 + 起课时间可铸式法；一键挂载全部式法。
- **结构化导出**：按技法 / 页签过滤段；md / html / json / csv / pdf / docx。

#### 天文馆
- Babylon.js 实时三维天象。**纯天文**：只借宫位，无岁差。
- 日月行星 + 南北交点 + 行星轨迹；中国星官（28 宿四象 / 三垣 / 北斗 / 星官 / 银河，恒真实距星）；西方 88 星座 + IAU 边界 + 星名；四套坐标网格（地平 / 赤道 / 黄道 / 宿度）；刻度叠加；极点与岁差圈 / 日行迹；星等过滤（1.0~6.5，默认 4.0）；点击读坐标 / 角距测量 / 升落中天时刻（大气折射 Bennett）。

#### 黄历
- 农历日期 / 24 节气 / 择日 / 宜忌。

#### 数据库
- 内置高可信名人星盘目录（数万条 A/AA 级名人出生数据），全程离线、秒级检索：关键词 / 星座 / 性别 / 出生年 / 评级 / 分类多维筛选与排序。
- 详情含黄道星盘轮（逆时针、经度递增）、生平事件与分类标签；**一键加入命盘管理**——任选名人导入本地命盘库，在占星 / 八字 / 紫微等任意技法页直接排盘。

#### 玄学史（中国玄学史）
- 以二十四史、太平广记等公有古籍为底，汇编历代玄学人物 · 故事 · 术数源流与天象记录（数千条玄学事件 + 上万条星象记录）。
- 离线中国历史地图 + 人物关系力导图 + 编年时间轴，按朝代 / 技法 / 人物检索；选中历史时刻可一键带入排盘，古籍原文支持反查对照。

#### 辅助（参考）
- 八卦类象 / 十二串宫 / 八字规则速查；真太阳时计算器。

### 跨技法能力

- **本地储存**：命盘与事盘本地保存（标签、快照、后端原始结构化数据），JSON 导入导出，重开恢复现场。
- **命盘批注**（memo）、起盘配置抽屉（相位选择 / 容许度 / 显示星体 / 星盘组件 / 星盘分布）、小工具抽屉。

---

## 四、网页版一键启动(从源码)

不装 exe,直接从源码把星阙跑成本地网页版(适合开发者或想跑源码的用户):

- **启动**:双击仓库里的 `local\Horosa_Local_Windows.bat` —— 有现成构建产物时几秒即开浏览器;首次运行自动补齐内置 Python / Java / Node 运行时并构建(Mongo / Redis 对本产品是可选依赖,默认跳过)。默认在 `127.0.0.1` 上起 网页 `8000` / 排盘 `8899` / 后端 `9999`,端口被占会自动换用空闲口。
- **停止**:回到启动时的控制台窗口按 Enter,或直接关闭它(脚本只回收带本产品指纹的进程,绝不误伤其它软件)。设 `HOROSA_NO_BROWSER=1` 可不自动开浏览器。
- **首次运行 SmartScreen**:未签名脚本可能触发 Windows 提示,选「更多信息 → 仍要运行」即可。
- **Git Bash / WSL 用户**:也可用产品源里的 `start_horosa_local.sh` / `stop_horosa_local.sh`(同一套服务,跨平台)。

---

## 五、许可与第三方

- **本项目**：[AGPL-3.0-only](LICENSE)。
- **法律与隐私**：服务条款 / 隐私政策 / 安全说明 / 网络说明 / 开源声明，见 [docs/legal](docs/legal/)（中英双语）。
- **第三方**：完整清单与许可证文本见 [THIRD_PARTY_NOTICES.md](local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/THIRD_PARTY_NOTICES.md)。
  - vendored 传统术数计算引擎：部分上游声明 MIT（许可证文本在对应 `vendor/*/LICENSE` 保留）；部分上游未声明许可，单独标注、不擅自假定为任何开源许可。
  - 天球坐标参考数据 d3-celestial（BSD 3-Clause；星座线 / IAU 边界 / 中国三垣派生）。
  - flatlib（改写版）。
  - Swiss Ephemeris（`pyswisseph`）。

---

## 六、致谢

星阙的源流不能忘。最早的星阙 Horosa 由**郑大哥**一手创建，**荀爽-Herakleios** 参与辅助设计，并把相关 App 与 Web 公开出来，后来者才有得研究、学习与延展。本 Windows 版正是在他们搭好的星阙体系、术数工作流与公开分享精神之上，继续做 Windows 交付、运行时打包、功能整合与体验改良。

特别感谢 [kentang2017](https://github.com/kentang2017) 长期公开的传统术数 Python 项目 —— 星阙接入或适配了其中多项计算引擎；已声明 MIT 的上游在 [`THIRD_PARTY_NOTICES.md`](local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/THIRD_PARTY_NOTICES.md) 与对应 vendored 目录保留许可证，未找到明确开源声明的项目则单独标注、避免混同。也感谢每一位持续测试、反馈、修复，推动星阙变得更完整的人。

---

## 七、文档与入口

- 从源码本地部署：完整产品源码随仓库发布于 [`local/workspace/Horosa-Web-…/`](local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/)（前端 `astrostudyui` · Java 后端 `astrostudysrv` · Python 排盘 `astropy` · 术数引擎 `vendor` · 星历 `flatlib-ctrad2`）；运行时准备脚本见 [`prepareruntime/`](prepareruntime/)，Windows 适配层见 [`windows-adaptations/`](windows-adaptations/)。工具链 Java 17 / Maven / Node 18+ / Python 3.11；用 Maven 构建 `astrostudysrv/` 产出后端 jar，然后 `bash start_horosa_local.sh`（Git Bash / WSL）。桌面打包工程（Electron + NSIS）私有维护、不在本仓库。
- 社区文档：[CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) · [SUPPORT.md](SUPPORT.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- 法律与隐私：[docs/legal](docs/legal/)（服务条款 · 隐私政策 · 安全 · 网络 · 开源声明）
- 语言详版：[README_ZH.md](README_ZH.md) · [README_EN.md](README_EN.md)
- 安装疑难解答（SmartScreen 提示 / 杀毒软件误报 / 磁盘与路径要求 / 离线使用与手动更新 / ARM 设备支持 / 系统语言无关）：见 [README_ZH.md「常见问题」](README_ZH.md#常见问题) 或 [README_EN.md “FAQ”](README_EN.md#faq)
