<div align="center">

简体中文 · [English](README_EN.md)

<img src="assets/horosa_setup_badge.png" alt="星阙 Horosa" width="128" />

# 星阙 Horosa

**把占星与中国术数，收进一个原生 Windows 工作站**

[![Version](https://img.shields.io/badge/version-3.3.6-2ea043?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v3.3.6)
[![License](https://img.shields.io/badge/license-AGPL--3.0-dc2626?style=flat-square)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows%2010%2F11-x64-111111?style=flat-square&logo=windows&logoColor=white)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v3.3.6)
[![Installer](https://img.shields.io/badge/NSIS-bundled%20runtime-1f6feb?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v3.3.6)
[![Stars](https://img.shields.io/github/stars/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?style=flat-square)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/stargazers)

[下载安装包](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-3.3.6.exe) ·
[入口页](README.md) ·
[English Guide](README_EN.md) ·
[所有版本](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases)

</div>

---

## 星阙是什么

星阙 Horosa 是一套桌面端的玄学工作站。西方占星的本命、推运、关系盘，连同八字、紫微、奇门、六壬、太乙这些中国传统术数，被放进同一个原生 Windows 应用里。它要解决的事其实很朴素：不必在十几个网页排盘器之间来回切，也不必自己拼装底层的 Python、Java 与历表运行时——你下载一个离线 NSIS 安装包，打开的就是一个成品。

这个仓库承担的是 Windows 这一侧的交付：应用源码、共享运行时、Electron 桌面外壳，以及把这一切打成单个 NSIS 安装包（`Horosa-Setup-3.3.6.exe`）的发布链路。

## 下载

普通用户直接下载离线安装包，像任何 Windows 软件一样安装、打开即可。

**[⬇︎ Horosa-Setup-3.3.6.exe](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest/download/Horosa-Setup-3.3.6.exe)**

适合场景：

- Windows 10 / 11，`x64`
- 弱网或完全离线的环境
- 第一次安装，或者要把安装包转发给别人
- 希望首次打开就能用，不再额外联网拉运行时

无需自备 Python 或 Java，运行时已随包交付。更新只替换程序与共享运行时，不会动你已经保存的命例与事盘数据。

- **法律与隐私**：服务条款 / 隐私政策 / 安全说明 / 网络说明 / 开源声明，见 [docs/legal](docs/legal/)（中英双语）。

> 安装包当前未做 Authenticode 签名，首次运行时 Windows SmartScreen 可能提示“Windows 已保护你的电脑”，点击「更多信息 → 仍要运行」即可；可比对官方 `SHA256SUMS.txt` 校验安装包完整性。

## 截图

<div align="center">
<img src="assets/screenshots/horosa-2.0-main-workspace.png" alt="占星工作区" width="900" />
<p><em>占星工作区 —— 左侧起盘参数，中间图盘画布，右侧信息 / 相位 / 行星 / 古典 / 格局页签。</em></p>

<img src="assets/screenshots/horosa-2.0-sanshi-workspace.png" alt="三式工作区" width="900" />
<p><em>三式工作区 —— 起盘参数、九宫盘面、概览 / 太乙 / 神煞 / 六壬 / 八宫页签同屏呈现。</em></p>

<img src="assets/screenshots/horosa-2.0-module-navigator.png" alt="导航弹层" width="900" />
<p><em>导航弹层 —— 命盘推运、易与三式、工具工作台分组，支持搜索与最近使用。</em></p>
</div>

## 功能总览

导航把所有模块归为三组：**命**（命盘与推运）、**卜**（易与三式）、**工具**。下面列的，是各组里真正能用的内容——名字与应用里的页签一一对应。

> v3.0.0 起，命系与卜系多门技法的各派分歧均做成左栏可选项，默认值与既有结果一致，默认排盘路径字节级不变。

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
- **六爻 · 分至 · 风水** —— 纳甲六爻、节气盘、风水（理气六派）工具
- **塔罗 · 天文地占** —— 塔罗牌阵（RWS / 埃及 / 马赛 / 维尔特 四套图集）、天文地占（星象地占）
- **其他** —— 宿盘、金口诀、统摄法、皇极经世、五兆、太玄、荆诀、神易数

### 工具 · 工具工作台

- **AI 分析** —— 可接入 OpenAI / Anthropic / Gemini / Ollama / OpenRouter / 自定义端点；流式对话、历史记录、资料库（向量检索）、把任一技法的盘面挂载进上下文、按技法 / 页签结构化导出，并可生成八字 / 紫微分节命理报告
- **玄学史** —— 以二十四史、太平广记等公有古籍为底，汇编历代玄学人物、故事、术数源流与天象记录；离线历史地图 + 人物关系力导图 + 编年时间轴，按朝代 / 技法 / 人物检索，并与排盘联动
- **天文馆** —— 完整星官、升落 / 中天精确时刻、宿度网格与连续时间播放实时同步（基于 Babylon.js 的实时三维天象）
- **黄历** —— 农历、节气与择日
- **辅助** —— 八卦类象、十二宫、规则速查
- **数据库** —— 内置高可信名人星盘目录（数万条名人出生数据），离线秒级检索、按星座 / 分类筛选；详情含黄道星盘轮，可一键加入命盘管理、在任意技法页直接排盘

命盘与事盘都能本地保存：带标签、快照与后端原始结构化数据，可 JSON 导入导出，重开后恢复现场。

## 技术构成

- **前端** —— React 17 + Umi 3 + TypeScript，Ant Design；D3 绘盘，Babylon.js / Three.js 三维，Plotly 星体地图，Monaco 编辑 AI 导出模板
- **后端** —— Java 17 / Spring Boot 承载占星与中国术数核心服务；Python 3.11 服务层封装 Swiss Ephemeris（`pyswisseph`）与 vendored 的 kentang 传统术数引擎
- **桌面壳** —— Electron 原生外壳，启动时在后台拉起本地 Python / Java 服务并做健康检查，窗口 / 缩放 / 设置状态持久化
- **运行时** —— 内置 Python 采用固定版本的 python-build-standalone（可复现、自包含），随包附带 VC++ 运行时、离线 wheels 与后端 jar；构建期有原生依赖闸门与发布前自检
- **发布** —— 面向 Windows 10 / 11（`x64`）的离线 NSIS 安装包，支持选择安装目录与升级；附 `latest.yml` / `.blockmap` / `SHA256SUMS.txt`

## 网页版一键启动(从源码)

不装 exe,直接从源码把星阙跑成本地网页版(适合开发者或想跑源码的用户):

- **启动**:双击仓库里的 `local\Horosa_Local_Windows.bat` —— 有现成构建产物时几秒即开浏览器;首次运行自动补齐内置 Python / Java / Node 运行时并构建(Mongo / Redis 对本产品是可选依赖,默认跳过)。默认在 `127.0.0.1` 上起 网页 `8000` / 排盘 `8899` / 后端 `9999`,端口被占会自动换用空闲口。
- **停止**:回到启动时的控制台窗口按 Enter,或直接关闭它(脚本只回收带本产品指纹的进程,绝不误伤其它软件)。设 `HOROSA_NO_BROWSER=1` 可不自动开浏览器。
- **首次运行 SmartScreen**:未签名脚本可能触发 Windows 提示,选「更多信息 → 仍要运行」即可。
- **Git Bash / WSL 用户**:也可用产品源里的 `start_horosa_local.sh` / `stop_horosa_local.sh`(同一套服务,跨平台)。

## 常见问题

**我只是普通用户，需要克隆仓库吗？**
不需要。直接在最新 release 里下载 `Horosa-Setup-3.3.6.exe` 即可。

**安装完还要自己装 Python 或 Java 吗？**
不需要。Windows 安装器已经把发布版所需的运行时纳入流程；首次启动会因本地解包和校验稍慢，后续复用缓存。

**可以选择安装目录吗？**
可以。v2.2.0 Beta 安装器支持标准安装向导，可选择安装目录，并在安装前做目录创建 / 写入检查、快捷方式修复；遇到 Windows 权限限制时可提权继续。

**为什么 release 里还有别的文件？**
`latest.yml`、`.blockmap` 与 `SHA256SUMS.txt` 用于更新和校验。对普通用户来说，真正要点的只有 `Horosa-Setup-3.3.6.exe`。

**更新时会删掉我的数据吗？**
不会。应用更新与运行时切换替换的是程序与共享运行时，不会清空你保存的命例与事盘。

**Windows 提示「已保护你的电脑」（SmartScreen），下载不安全吗？**
安装包未做 Authenticode 代码签名，新下载的文件会触发 SmartScreen 的「未知发布者」提示。请在 release 页用 `SHA256SUMS.txt` 核对你下载文件的哈希，然后点击 **更多信息 → 仍要运行**。应用内更新另有 Ed25519 签名校验层，任何被篡改的更新包都会被拒绝安装。

**杀毒软件把应用的组件隔离了 / 应用提示本地服务启动失败怎么办？**
个别杀毒软件（Windows Defender、360 等）可能误报内置的 Python/Java 运行时。请把安装目录与 `%LOCALAPPDATA%\HorosaDesktop` 加入杀毒软件白名单，恢复被隔离的文件后重新启动；或直接重装一次。应用能识别时，错误界面会直接写明被拦的目录，照着加白即可。

**需要多少磁盘空间？安装路径有讲究吗？**
安装时请保证至少 6 GB 可用空间（程序约 2 GB + 首次启动解压的运行时约 1.4 GB + 缓存）。安装路径请控制在 100 个字符以内，不要装到盘根或系统目录——安装器会强制检查这两条，并建议使用类似 `C:\Horosa` 的专用目录。

**星阙可以完全离线使用吗？**
可以。全部计算都在本地完成，安装与使用都不需要联网。联网只用于向 GitHub 检查更新——检查不到时应用照常工作，你也可以手动下载新版安装包覆盖安装。（进阶：环境变量 `HOROSA_UPDATE_FEED_URL` 可把更新源指向自定义地址。）

**ARM 笔记本（骁龙）能用吗？**
Windows 11 on ARM 可通过系统自带的 x64 仿真运行星阙——功能完整，性能略低于原生 x64 电脑。Windows 10 on ARM 没有 x64 仿真层，无法支持；安装器会直接检测并明确告知，而不是装出一个打不开的程序。

**Windows S 模式或公司管控的电脑能用吗？**
Windows S 模式只允许运行微软商店应用，会阻止安装任何旁加载软件（包括星阙的安装器本身）——这是系统级限制，需在「设置 → 激活」切出 S 模式后安装。企业 AppLocker / 软件限制策略同理，请联系 IT 管理员放行。

**我的 Windows 系统语言 / 区域设置会影响使用吗？**
不会。安装与运行在设计上与区域设置无关：任意系统显示语言、土耳其/泰语/阿拉伯语等区域格式、GBK/Shift-JIS 传统代码页、「Beta: 全球 UTF-8」选项、非 ASCII 用户名都可以正常安装使用。安装器的阻断类报错均为中文并附简短英文。

## 开发者入口

按你的目标选择入口：

- 想理解产品首页与用户入口：[README.md](README.md)
- 想看英文完整说明：[README_EN.md](README_EN.md)
- 想确认第三方许可证：[THIRD_PARTY_NOTICES.md](local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/THIRD_PARTY_NOTICES.md)
- 法律与隐私文档：[docs/legal](docs/legal/)
- 产品源码：[`local/workspace/Horosa-Web-…/`](local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/) —— 前端 `astrostudyui`，后端 `astrostudysrv` / `astropy`，引擎 `vendor`，星历 `flatlib-ctrad2`
- 运行时准备脚本（含随包 VC++ 运行时）：[`prepareruntime/`](prepareruntime/)
- Windows 适配层（上游同步后的 Windows 专属补丁）：[`windows-adaptations/`](windows-adaptations/)
- 历史版本与完整发布说明：[GitHub Releases](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases)

## 致谢

星阙的源流不能忘。最早的星阙 Horosa 由**郑大哥**一手创建，**荀爽（Herakleios，爽哥）**参与辅助设计，并把相关 App 与 Web 公开出来，后来者才有得研究、学习与延展。这个 Windows 版本的继续整理与发布，正是建立在他们已经搭起的星阙体系、术数工作流与公开分享精神之上——补的是 Windows 交付、运行时打包、功能整合与体验改良。没有他们，就没有今天这一版。也感谢每一位持续测试、反馈、修复，推动星阙变得更完整的人。

特别感谢 [kentang2017](https://github.com/kentang2017) 长期公开的传统术数 Python 项目。星阙接入或适配了其中多项计算引擎——已声明为 MIT 的上游项目在对应 vendored 目录与 `THIRD_PARTY_NOTICES.md` 中保留许可证说明；未找到明确开源声明的项目则单独标注，避免在没有声明的地方擅自假定许可证。
