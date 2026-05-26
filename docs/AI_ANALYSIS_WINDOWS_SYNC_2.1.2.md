# Horosa Windows 2.1.2 Beta — AI 分析同步、移植决策与发布技术文档

> 日期：2026-05-25 · 范围：把 Mac 仓库 `main` 的「AI 分析」重做同步到 Windows 交付工程，构建 2.1.2 安装包。
> 目的：让其他 agent 能完整 catch up 本轮改动、理解 Windows 与 Mac 的架构差异、按既定流程验收，并据此执行 GitHub 发布。
> 配套：用户可读发布说明见 [`docs/releases/2.1.2.md`](releases/2.1.2.md)；干净机器运行时背景见 [`docs/CLEAN_MACHINE_NATIVE_RUNTIME_FIX.md`](CLEAN_MACHINE_NATIVE_RUNTIME_FIX.md)；目录结构见 [`docs/PROJECT_STRUCTURE.md`](PROJECT_STRUCTURE.md)。
>
> **更新（后续版本）**：本文档记录 2.1.2 的 AI 分析同步。**操作规范（同步方法 / Windows 独有修复保留清单 / 必须用 PowerShell / `astrostudyboot.jar` 重建步骤 / 发布 runbook / CI 自动发布坑）已固化进 [`.claude/skills/horosa-dev/SKILL.md`](../.claude/skills/horosa-dev/SKILL.md)（Claude Code 自动加载），并要求每次遇到问题都同步更新该 skill 与对应 harness 文档。** 2.1.3（八字时间显示修复）见 [`docs/releases/2.1.3.md`](releases/2.1.3.md)。

---

## 0. TL;DR

- 本轮把 **Mac 仓库 `main`（HEAD `df026fd "release: prepare v2.1.2 beta"`，来源 `https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-MacOS.git`）** 的「AI 分析」改动同步到 Windows 工程的前端 `astrostudyui`。
- 核心修复：**「挂错盘」严重 bug**（选中命盘后勾选技法，过去会挂到「上次看过的那张盘」）；新增 **9 个命盘技法的按盘无头复算**；事盘 **绝不按时间重算**；挂载面板重做；AI 回复 **Markdown 渲染**；本地 kentang 端口解析修复。
- **移植方法是「逐文件 diff + 分类」**：只移植 Mac 端的 AI 分析改动，对每个有差异但不属于本轮的文件判定「Mac 领先 / Windows 领先」，**完整保留所有 Windows 独有修复**（风水相对路径、窗口抖动守卫、策天飞星亮度、`pages/index.js` 字段兜底等）。
- 版本号升到 **2.1.2**，构建出 **`Horosa-Setup-2.1.2.exe`（≈1.11 GB）**，全套验收通过（129 前端测试、`npm run verify`、原生依赖闸门、`dist:win` exit 0）。
- 本轮继续执行了发布前最终闸门：重新打包 2.1.2 安装器，修正桌面冷启动探针不再打签名 `/heartbeat`、Mongo fallback 不再 ping 本机 Mongo，且 clean-machine cold/warm smoke 通过。

---

## 1. Windows 工程结构（同步前必读）

Windows 与 Mac 是两个独立仓库，目录布局不同，**不能直接 `git apply` Mac 的 patch**：

| | Mac 仓库 | Windows 仓库 |
| --- | --- | --- |
| 前端路径 | `Horosa-Web/astrostudyui/` | `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/` |
| 桌面壳 | Tauri（Rust）`Horosa_Desktop_Installer/` | **Electron + NSIS** `desktop_installer_bundle/` |
| 构建命令 | `build_desktop_release.sh` | `npm run dist:win`（**PowerShell**，见 §1.1） |
| 发布产物 | `.pkg` / `.tar.gz` / `horosa-latest.json` | `Horosa-Setup-X.Y.Z.exe` / `.blockmap` / `latest.yml` / `SHA256SUMS.txt` |
| 后端 | 同一套 Python（`astropy`）+ Java（`astrostudysrv`），随包内置 | 同左 |

Windows 桌面构建管线（`desktop_installer_bundle/package.json` 的 scripts）：

```
dist:win = verify
         → build:desktop ( build:renderer  → 编译 astrostudyui 出 dist-file
                          → prepare:runtime → 下载固定版 python-build-standalone + 复制 JRE + 注入 VC++ DLL + 装离线 wheels
                          → stage:runtime   → 把 dist-file/python/java/vendor 暂存进 runtime，跑原生依赖闸门 check_runtime_native_deps.py )
         → electron-builder --dir  → win-unpacked
         → patch:win-icon          → 给 Horosa.exe 写入图标
         → electron-builder --win nsis --prepackaged release/win-unpacked  → 出 Horosa-Setup-<version>.exe
```

### 1.1 必须用 PowerShell 构建

`stage-runtime.cjs` 的暂存依赖 `tar`。在 Git-Bash / MSYS 下 `tar` 会误读 `C:\` 盘符，破坏暂存与 fixture 测试。**所有 `desktop_installer_bundle/` 下的构建命令（`npm run verify` / `dist:win` 等）必须用 PowerShell 跑，不要用 Git-Bash。** （git diff、前端 `astrostudyui` 的 `npm install`/`build:file` 用哪个都行。）

---

## 2. Windows 与 Mac 的架构差异（同步 AI 分析时的关键判断）

理解这两点，才能判断哪些 Mac 改动可以照搬、哪些会破坏 Windows：

### 2.1 kentang 引擎的端口路由

- **后端事实（两端一致）**：奇门/太乙/金口诀等所有 kentang/kin 引擎都挂在**主图表服务 `CHART_PORT`（默认 8899）** 上 —— 见 `astropy/websrv/webchartsrv.py:261` 的 `mount_kentang_services`。各引擎适配器（如 `astropy/websrv/kentang/kinastro_common.py:17-22`）会**自行把 `vendor/` 子包插入 `sys.path`**。
- **所以**：Windows 桌面 Python 图表服务的 `PYTHONPATH` 只含 `astropy` + `flatlib-ctrad2`（`service-manager.js:1271`）也能跑 kentang —— vendor 由适配器自解析。§7 中"vendor 不在 PYTHONPATH"那条 Mac 本地启动器根因 **不影响 Windows 桌面包**。
- **前端 `serviceRoot.js` 的 §7 改动是安全的**：它只改 `ServerRoot` 以 `:9999` 结尾（本地 Java 后端）这一分支，让 kentang 解析到 `8899`。而 **Windows 桌面 App 在 `electron/main.js:258-259` 注入了显式的 `chartSrv=kentangSrv=http://127.0.0.1:8899` 查询参数**，`resolveKentangServiceRoot` 优先走 `COMMON_QUERY_KEYS` 显式分支，**根本不会进入 `:9999` 分支**。结论：照搬 Mac 的 `serviceRoot.js` 既修好了本地网页运行，又不影响已正常的桌面包。

### 2.2 桌面壳自管窗口与文件协议

Windows 桌面是 Electron（file:// 加载 renderer），Mac 是 Tauri。这导致几处 Windows **必须**和 Mac 不同的代码（见 §4「保留的 Windows 独有修复」）。同步时**绝不能**用 Mac 版覆盖它们。

---

## 3. 本轮移植的 AI 分析改动（13 个文件，逐字节同步自 Mac）

> 这些文件经核对**仅含 AI 分析改动、无 Windows 分叉**，因此直接采用 Mac 版（LF 行尾，两端一致，无 CRLF 漂移）。

### 3.1 核心：上下文挂载正确性 — `src/utils/aiAnalysisContext.js`

- **A1 硬性签名过滤**：`pickSnapshotCandidate()` 先剔除 `compatible === false` 的候选（`item && item.content && item.compatible !== false`）。`generated` 候选恒为 `compatible:true`；`payload`/`cache` 候选由 `isSnapshotMetaCompatible` 判定（源签名为空时为 true，不误伤）。**这一处根除「挂错盘」——改候选逻辑务必保留此过滤。**
- **命盘技法无头复算注册表**：新增 `buildChartBaziParams` / `buildChartZiweiParams`（形状对齐组件 `genParams`：date `YYYY-MM-DD` / time `HH:mm:ss`）、`fetchChartResultForRecord`（取西洋盘原始结果，含 predictive，可选含主限法）、`regenerateChartTechniqueSnapshot(record, key)`（按 key 分派，`try/catch` 失败安全降级为空 → 显示「缺失」）。
- **`buildTechniqueContext()` 按 `sourceType` 分流**：
  - **chart 命盘**：payload 命中优先 → 兼容缓存（A1 已过滤）→ 仍无则 `regenerateChartTechniqueSnapshot` 按本盘出生数据复算，生成后 `saveGeneratedTechniqueSnapshot`（带 `buildSnapshotMetaFromRecord` 出生签名）。
  - **case 事盘（Part F）**：只用本案例 `payload`（`generateCaseTechniqueSnapshot`），**不调用** `regenerateCaseTechniqueSnapshot`（按时间重起盘）、**也不读全局模块缓存**。勾选的技法不在 payload 中 → 返回空 → 「缺失」。`buildCaseContext()` 同样移除了时间重算兜底。
  - 设计理由：事盘绑定起盘那一刻的卦/课（掷币/骰子/手动起卦不可由时间重现）。命盘按时间复算（chart）与事盘禁止重算（case）是**两条相反规则**。
- `generateCaseTechniqueSnapshot` 对 qimen/sixyao/taiyi/sanshiunited 加了「payload 缺数据则返回空」的硬性守卫。

**已接入的 9 个命盘技法**（key → 复用的已导出 builder）：

| key | 标签 | builder（来源组件） |
| --- | --- | --- |
| `astrochart` | 星盘 | `buildChartContext`（原有） |
| `indiachart` | 印度占星 | `buildIndiaSnapshotForFields`（IndiaChart.js） |
| `bazi` | 八字 | `buildBaziSnapshotForParams`（BaZi.js） |
| `ziwei` | 紫微 | `buildZiweiSnapshotForParams`（ZiWeiMain.js） |
| `firdaria` | 法达星限 | `buildFirdariaSnapshotText`（AstroDirectMain.js） |
| `primarydirect` | 主限/界限法 | `buildPrimaryDirectSnapshotText`（默认 Alchabitius 弧 / Ptolemy 时钥 / 含界限） |
| `guolao` | 七政四余 | `buildGuolaoSnapshotForFields`（GuoLaoChartMain.js，沿用已保存设置） |
| `suzhan` | 宿占 | `buildSuzhanSnapshotText`（SuZhanMain.js） |
| `germany` | 量化盘 | `buildGermanySnapshotForFields`（AstroMidpoint.js） |

> 未接入（仅安全降级，永不挂错盘）：profection/solararc/solarreturn/lunarreturn/givenyear（需目标时刻）、jieqi（需多次取数）、fengshui/decennials 等（仅 DOM/iframe，无可复用 builder）；本质不可复算：`otherbu`（骰子）、`relative`（合盘需两张盘）。

### 3.2 界面 — `src/components/aianalysis/AIAnalysisMain.js` + `.less`

- 导入 antd `Collapse`、`marked`、`DOMPurify`。
- 删除 `filterByDateRange`，新增 `renderMarkdownToHtml`（`marked.parse` → `DOMPurify.sanitize({ADD_ATTR:['target','rel']})`，**保留 DOMPurify 防 XSS**）、`CONTEXT_STATUS_META`（ready/regenerated/missing/pending）、`buildContextSignatureText(meta)`（从 meta 取出生/起盘签名）。
- `lockedContextItems` 改为携带完整 `content` + `meta` + `status`（不再预截断 180/120 字）。
- 渲染改用 `Collapse`：每挂载层一个 Panel，头部 = 标题 + 类型 Tag + 状态 Tag + 出生签名小字；体内完整文本、内部滚动。
- **自动展开**：受控 `activeKey={contextActiveKeys}`，由 effect + `seenContextKeysRef` 维护 —— 新出现的层默认展开，用户手动收起的保持收起（否则「挂载后才加技法」时新面板默认收起、看着像空的）。
- 气泡渲染：`item.role === 'user'` → `.messageText`（纯文本 pre-wrap）；否则 → `.markdownBody`（`dangerouslySetInnerHTML`）。
- 布局：系统提示移出顶部工具栏 → 右列 `.sideColumn` 上方；底部按钮行（刷新案例/新对话/重新生成/编辑分支/停止）移入 `composerActions`，置于发送键左侧。
- 历史页：删除右上两个空白 `<Input>`（startDate/endDate）、对应过滤与 `filterByDateRange`。
- `.less` 新增 `.markdownBody`/`.sideColumn`/`.systemPromptCard`/`.contextCollapse`/`.contextPanelHeader`/`.contextBody`/`.messageText` 等全套样式；`white-space:pre-wrap` 从 `.messageBubble` 移到 `.messageText`。

### 3.3 7 个组件新增导出（供 §3.1 无头复算调用）

| 文件 | 新增 |
| --- | --- |
| `src/components/cntradition/BaZi.js` | `export async buildBaziSnapshotForParams(params)` |
| `src/components/ziwei/ZiWeiMain.js` | `export async buildZiweiSnapshotForParams(params)` |
| `src/components/astro/IndiaChart.js` | `export async buildIndiaSnapshotForFields(fields, chartnum)` |
| `src/components/direction/AstroDirectMain.js` | 导出新增 `buildFirdariaSnapshotText`（`buildPrimaryDirectSnapshotText` 原已导出；函数本就定义在 line 258，仅加进 export 列表） |
| `src/components/guolao/GuoLaoChartMain.js` | `export async buildGuolaoSnapshotForFields(fields)` |
| `src/components/germany/AstroMidpoint.js` | `export async buildGermanySnapshotForFields(fields)` |
| `src/components/suzhan/SuZhanMain.js` | 给 `buildSuzhanSnapshotText` 加 `export` |

> 这些组件**未**反向 import `aiAnalysisContext`，无循环依赖（已核查）。新增技法时务必维持。

### 3.4 kentang 本地端口 — `src/integrations/kentang/serviceRoot.js`

- 新增常量 `LOCAL_KENTANG_CHART_PORT = 8899`；`resolveKentangServiceRoot` 对本地 `:9999` 后端统一解析到 `8899`（不再用每引擎遗留端口 8898/8895/...）。
- 安全性见 §2.1：桌面 App 走显式 `kentangSrv` 分支，不受影响；生产 `srv.horosa.com` 按路径路由，不受影响。

### 3.5 依赖与测试

- `astrostudyui/package.json` 新增 `"marked": "^4.3.0"`、`"dompurify": "^2.5.9"`（CommonJS 友好，兼容 umi3 / webpack4 / React 17 / Node 24）；`package-lock.json` 经 `npm install` 重新生成。
- 测试更新：`src/utils/__tests__/aiAnalysisContext.test.js`（删除旧的"按时间重算"用例，新增 Part F / A1 / 按技法隔离用例）、`src/integrations/kentang/__tests__/serviceRoot.test.js`（旧 8898/8895/... 断言改为 8899）。

---

## 4. 保留的 Windows 独有修复（同步时**绝不能**用 Mac 版覆盖）

这些文件 Windows 比 Mac「领先」或「为 Windows 定制」，经逐个 diff 确认**不属于本轮 AI 分析**，全部保留 Windows 版。**未来从 Mac 再同步时，对这些文件要特别小心，不要回退：**

| 文件 | Windows 版做法 | 为什么不能用 Mac 版 |
| --- | --- | --- |
| `components/fengshui/FengShuiMain.js` | iframe `src="fengshui/index.html"`（相对） | Mac 用绝对 `/fengshui/...`；在桌面 file:// 下绝对路径指向盘根，iframe 加载失败（commit 93a11e6 修复） |
| `utils/windowSizePersistence.js` | 保留 `isDesktopShellWindow`，桌面壳里禁用网页层窗口尺寸持久化 | Electron 自管窗口 bounds；网页层持久化会与之打架 → 启动窗口抖动（93a11e6 修复） |
| `components/ziwei/ZWHouse.js` | 内联 `showStarLight = this.kinastroBorrowed \|\| …`（策天飞星亮度） | 与 Mac 抽出的 `shouldShowStarLight()` 方法**逻辑等价**；保留已验证的 Windows 内联版即可，无功能差异 |
| `pages/index.js` | `ensureField()` 兜底缺失字段；`${flds.lat.value}` 转字符串再 `.toLowerCase()` | Mac 直接 `flds.x.value=` 假设字段存在，且对数值调 `.toLowerCase()` 会崩 —— Windows 版更稳健 |
| `components/astro/AstroRelative.js` | `selectChartA` 内对 `this.props.fields.hsys/zodiacal` 有空值守卫 | Mac 版守卫更少；保留 Windows 的防御式写法 |
| `components/comp/DateTimeSelector.js` | 按钮带 `autoInsertSpace={false}` | 防止两个中文字之间被插空格；非 AI 分析改动 |
| `layouts/app.less` | 八字细盘滚动槽用 `scroll-padding-bottom` | 细微样式差异，非 AI 分析；保留 Windows |

另外，本 2.1.2 包还**顺带带上了两处此前排队待发的 Windows 改动**（它们在工作树里早已是 modified 状态，本次保留并一并打包）：
- `desktop_installer_bundle/assets/installer.nsh` —— 安装器快捷方式硬化（cscript/VBScript 被拦时用原生 NSIS `CreateShortCut` 兜底）。
- 上表的 `ZWHouse.js` 策天飞星亮度修复。

---

## 5. 完整变更文件清单

```
# AI 分析移植（来自 Mac，13 个）
local/workspace/Horosa-Web-*/astrostudyui/src/utils/aiAnalysisContext.js
local/workspace/Horosa-Web-*/astrostudyui/src/components/aianalysis/AIAnalysisMain.js
local/workspace/Horosa-Web-*/astrostudyui/src/components/aianalysis/AIAnalysisMain.less
local/workspace/Horosa-Web-*/astrostudyui/src/components/astro/IndiaChart.js
local/workspace/Horosa-Web-*/astrostudyui/src/components/cntradition/BaZi.js
local/workspace/Horosa-Web-*/astrostudyui/src/components/direction/AstroDirectMain.js
local/workspace/Horosa-Web-*/astrostudyui/src/components/germany/AstroMidpoint.js
local/workspace/Horosa-Web-*/astrostudyui/src/components/guolao/GuoLaoChartMain.js
local/workspace/Horosa-Web-*/astrostudyui/src/components/suzhan/SuZhanMain.js
local/workspace/Horosa-Web-*/astrostudyui/src/components/ziwei/ZiWeiMain.js
local/workspace/Horosa-Web-*/astrostudyui/src/integrations/kentang/serviceRoot.js
local/workspace/Horosa-Web-*/astrostudyui/src/utils/__tests__/aiAnalysisContext.test.js
local/workspace/Horosa-Web-*/astrostudyui/src/integrations/kentang/__tests__/serviceRoot.test.js

# 依赖
local/workspace/Horosa-Web-*/astrostudyui/package.json            # + marked, dompurify
local/workspace/Horosa-Web-*/astrostudyui/package-lock.json       # 重新生成

# 版本号 2.1.1 → 2.1.2
desktop_installer_bundle/package.json
desktop_installer_bundle/package-lock.json
CITATION.cff
README.md · README_ZH.md · README_EN.md
desktop_installer_bundle/README.md
docs/PROJECT_STRUCTURE.md

# 新增文档
docs/releases/2.1.2.md                       # 用户可读发布说明
docs/AI_ANALYSIS_WINDOWS_SYNC_2.1.2.md        # 本文档

# 构建副产物（被 dist:win 改写）
local/workspace/runtime/windows/bundle/runtime.manifest.json

# 保留未动（Windows 独有，见 §4） + 此前排队改动
desktop_installer_bundle/assets/installer.nsh                # 工作树早已 modified
local/workspace/Horosa-Web-*/astrostudyui/src/components/ziwei/ZWHouse.js   # 工作树早已 modified
```

> `Horosa-Web-*` = `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c`。

---

## 6. 验收（已执行，全绿）

- `astrostudyui` `npm run build:file`：Webpack 编译成功；产物 `dist-file/umi.*.js` 含 `marked` / `DOMPurify`。
- `astrostudyui` 测试（`umi-test`）：**28 套 / 129 个全部通过**，含新行为：「不对空 payload 的事盘重算」「不对无关命盘技法回退到通用快照」「每个技法只挂自己的内容」、kentang serviceRoot 8899 解析。
- `desktop_installer_bundle` `npm run verify`：`service-manager.test.js` 14/14 通过；`release_preflight.py` 通过（版本一致 `package.json`/`CITATION.cff` = 2.1.2、品牌资产未过期、VC++ 运行时齐全）。
- 原生依赖闸门 `check_runtime_native_deps.py`：**192 个暂存原生模块全部 DLL 可解析**（干净 Windows）。
- `npm run dist:win`：**exit 0**，产出下列资产。

**产物（`desktop_installer_bundle/release/`）：**

| 文件 | 大小 / 说明 |
| --- | --- |
| `Horosa-Setup-2.1.2.exe` | 1,194,194,410 字节（≈1.11 GB） |
| `Horosa-Setup-2.1.2.exe.blockmap` | 1,237,430 字节 |
| `latest.yml` | version `2.1.2`，含 sha512 + size |
| `SHA256SUMS.txt` | 已刷新为 2.1.2（见下） |

**SHA256：**

```text
9ad30107123c559ab0f48334b00e361a209da5f33fff05c15094749b4a9370cf  Horosa-Setup-2.1.2.exe
692b410233eb19720ccf53ed0bcb607b517a4202bbb258d673d4533c269b876f  Horosa-Setup-2.1.2.exe.blockmap
8a57d4dd9d4b05a4e223b6f43d08759b0b0339bf28a1e41f61d413aa5fae3031  latest.yml
```

> 追加验收：`desktop_installer_bundle/scripts/clean_machine_cold_warm_check.py` 已用全新隔离 `LOCALAPPDATA` / `APPDATA` / `TEMP` 跑过；冷启动 25.2s（runtime extract），热启动 7.7s（cached），backend/chart 均 ready，`backendAcceptedPortProbe=true`，forbidden log matches 为空，8899 / 9999 / 9464 关闭后均释放。AI 分析活体 smoke 与真实干净 Win11 VM 实机验证仍可作为发布后人工复核项。

---

## 7. 未来从 Mac 再同步的标准方法（给下一个 agent）

本轮采用的可复现方法，**避免回退 Windows 独有修复**：

1. 浅克隆 Mac `main` 到 `tmp/`：`git clone --depth 1 --branch main <mac-repo> tmp/mac-sync-<ver>`。
2. 对整个 `astrostudyui/src` 做 `git diff --no-index <win-src> <mac-src> --stat`，列出所有差异文件（忽略 `.umi/` 生成物）。
3. **对每个差异文件分类**（`git diff --no-index WIN MAC` 中 `-` 行=Windows 独有、`+` 行=Mac 独有）：
   - 属于本轮 Mac 改动（在 Mac 改动文档的清单里）→ **移植**（无 Windows 分叉时可直接 `cp` Mac 版覆盖，行尾两端均 LF，无漂移）。
   - 不在清单里 → 多半是 **Windows 独有修复**（见 §4），**保留 Windows 版**，核对其 `-`/`+` 内容确认是 Windows 领先而非 Mac 领先。
4. `package.json` **不要整文件覆盖**（Windows 有自己的 `umi-runner.js` build 脚本）；只手动加新依赖，再 `npm install` 重生成 lock。
5. 移植后：`astrostudyui` 跑 `build:file` + `umi-test` 验证；再到 `desktop_installer_bundle`（PowerShell）跑 `verify` → `dist:win`。
6. 确认无 Mac-only 新文件被遗漏：`comm -13 <(win 文件列表) <(mac 文件列表)`。

---

## 8. 版本号同步点（升版必改）

`release_preflight.py` **硬性要求** `desktop_installer_bundle/package.json` 与 `CITATION.cff` 版本一致（不一致直接 fail）；`release/latest.yml` 不一致只是 note（打包会自动重写）。完整需改清单：

- `desktop_installer_bundle/package.json` → `version`（驱动 `artifactName = Horosa-Setup-${version}.exe`）
- `desktop_installer_bundle/package-lock.json` → 顶层 + `""` 包条目两处 `version`
- `CITATION.cff` → `version:` 行（+ 摘要里的版本措辞）
- `README.md` / `README_ZH.md` / `README_EN.md` → 徽章 `version-X.Y.Z`、`releases/tag/vX.Y.Z`、下载文件名 `Horosa-Setup-X.Y.Z.exe`、「What's New」段落
- `desktop_installer_bundle/README.md`、`docs/PROJECT_STRUCTURE.md` → 版本标签与资产文件名
- 新建 `docs/releases/X.Y.Z.md`

> 历史性引用**不要**乱改：`docs/releases/2.1.1.md`（旧版说明本身）、`docs/SELFCHECK_LOG.md` / `docs/CLEAN_MACHINE_NATIVE_RUNTIME_FIX.md` 里记述 2.1.1 当时做了什么的句子、README 里「保留 2.1.1 加固」这类表述、PROJECT_STRUCTURE 的「2.1.1 Beta 新功能面」历史小节。

---

## 9. GitHub 发布 Runbook（Windows，手动）

> Windows 端**没有**自动发布脚本（`dist:win` 只构建不发布；`package.json` 里的 `build.publish` github 配置存在但 `dist:win` 未调用 publish）。发布按约定 **tag `vX.Y.Z` + 手动建 Release 上传 4 个资产**。**构建/发布属高影响操作，执行前与用户确认。**

### 9.1 前置
- 版本号已按 §8 全部同步、`npm run verify` 通过（已完成）。
- 分支干净、改动已 review。

### 9.2 步骤
```powershell
# 1) 提交（约定：先 "release: prepare vX.Y.Z beta"，发布时再 "Release Horosa Windows X.Y.Z beta"）
git add -A   # 注意：tmp/ 未被 gitignore，先排除 tmp/ 与 QA_REGRESSION_*.json，见 §10
git commit -m "release: prepare v2.1.2 beta"

# 2) 构建（PowerShell，从 desktop_installer_bundle/）
cd desktop_installer_bundle ; npm run dist:win        # 已完成；exit 0

# 3) 校验 release/ 四个资产齐全、latest.yml=2.1.2、SHA256SUMS.txt 已刷新（已完成，见 §6）

# 4)（可选但推荐）安装后 smoke，见 §9.3

# 5) 打 tag 并推
cd .. ; git tag v2.1.2 ; git push origin v2.1.2

# 6) 建 GitHub Release 并上传 4 个资产（gh 或网页手动）
gh release create v2.1.2 `
  desktop_installer_bundle/release/Horosa-Setup-2.1.2.exe `
  desktop_installer_bundle/release/Horosa-Setup-2.1.2.exe.blockmap `
  desktop_installer_bundle/release/latest.yml `
  desktop_installer_bundle/release/SHA256SUMS.txt `
  --title "Horosa Windows 2.1.2 Beta" --notes-file docs/releases/2.1.2.md --latest
# 普通发布省略 --prerelease 即可；要标记预发布才加 --prerelease（它是布尔开关，无 =false 写法）。
```

### 9.3 可选发布前 smoke（`desktop_installer_bundle/scripts/`，PowerShell）
- `installed_desktop_smoke_check.py` —— 安装后桌面启动 smoke。
- `desktop_ai_analysis_live_smoke_check.py` / `desktop_ai_analysis_smoke_check.py` —— **本轮重点**：AI 分析活体校验。
- `verify_kentang_runtime_endpoints.py --root http://127.0.0.1:8899` —— 17+ kentang 端点冒烟。
- `installer_custom_dir_smoke.py` —— 自定义安装目录。

### 9.4 检查单
- 发布前：版本四点一致（§8）、`verify` 通过、`release/` 四资产齐全、`latest.yml`=2.1.2、`SHA256SUMS.txt` 已刷新。
- 发布后：`.exe` 安装+启动正常、版本号正确、检查更新可拉到 `latest.yml`、`git tag` 已推、Release 页资产正确。
- **不要上传**：`win-unpacked`、`builder-debug.yml`、QA 日志、运行时缓存、临时目录、Mac 参考克隆。

---

## 10. 当前状态与注意点（交接）

- **发布准备完成**：2.1.2 安装包已重新构建，`SHA256SUMS.txt` 与本文档已更新到最终资产；clean-machine cold/warm smoke 已通过。当前交接状态是提交、推送 `main` / `v2.1.2` tag，并创建普通 GitHub Release（Beta 标题，`prerelease=false`）。
- **`tmp/` 未被 gitignore**：本轮的 Mac 参考克隆在 `tmp/mac-sync-2.1.2/`（浅克隆，~1 GB）。**提交时务必排除 `tmp/`**（别 `git add -A` 一把梭），可安全删除该克隆。仓库里还有既有的 `tmp/mac-v201-reference/`、`desktop_installer_bundle/QA_REGRESSION_*.json`、`scripts/browser_ai_*.json` 等未跟踪文件，与本轮无关。
- **Authenticode**：沿用当前发布约定（2.1.1 记为 NotSigned）；本文不对签名状态下结论。
- **关联文档**：[`docs/releases/2.1.2.md`](releases/2.1.2.md)（用户可读）、[`docs/CLEAN_MACHINE_NATIVE_RUNTIME_FIX.md`](CLEAN_MACHINE_NATIVE_RUNTIME_FIX.md)、[`docs/PROJECT_STRUCTURE.md`](PROJECT_STRUCTURE.md)。
