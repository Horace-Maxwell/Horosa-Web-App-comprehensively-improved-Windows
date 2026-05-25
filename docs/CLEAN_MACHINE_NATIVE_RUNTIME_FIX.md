# 全新 Windows 机器“开箱即用”修复技术文档

> 适用范围：星阙 / Horosa 桌面版（Electron 外壳 + 内置 Python 图表服务 + 内置 Java 后端）。
> 主题：为什么在全新 Windows 机器上装完打不开，怎么修的，以后怎么避免，构建/发布注意点。
> 最后更新：2026-05-25。

---

## 0. 一句话总结

打包出的内置 Python 缺少 **`msvcp140.dll`**（VC++ C++ 运行时）。开发机的 `C:\Windows\System32` 里有它，所以本机一切正常；全新 Windows 没装 VC++ 运行库就加载失败，导致 `swisseph` / `_sxtwl` 等编译扩展无法导入，Python 服务 `code=1` 退出，整个 app 卡在启动页。**修复 = 把 VC++ 运行时 DLL 随内置 Python 一起打包到 `python.exe` 同级目录。**

> **验证状态（2026-05-25）**：本文所有改动均已落地并验证。standalone-Python 安装包已在**全新 Windows 11 VM 实测通过** —— 应用以「星阙」名启动、命盘正常渲染、Python 图表服务 + Java 后端进程均正常运行。当前可手测安装包：`desktop_installer_bundle/release/Horosa-Setup-2.1.1.exe`（瘦身版，约 1.11 GB）。

---

## 1. 问题现象

- 测试环境：全新 Windows 11（VirtualBox “Clean Machine”），未装 Visual C++ Redistributable、未装 Python。
- 安装后启动，启动页报错，两种表现交替出现：
  - `Python chart service exited unexpectedly (code=1, signal=null)`
  - `Java backend exited unexpectedly (code=1, signal=null)`
- 运行状态：`failed`，本地服务“等待分配端口”。

关键日志（`%LOCALAPPDATA%\HorosaDesktop\logs\runtime\python.log`）：

```
ImportError: DLL load failed while importing swisseph: 找不到指定的模块。
```

---

## 2. 根因分析

### 2.1 直接原因：缺少 `msvcp140.dll`

`pyswisseph` 的编译扩展 `swisseph.cp311-win_amd64.pyd` 的 PE 导入表依赖：

| 依赖 DLL | 是否随 Python 自带 | 是否系统自带（Win10/11） | 结论 |
|---|---|---|---|
| `python311.dll` | ✅ 自带 | — | OK |
| `vcruntime140.dll` | ✅ 在 `python.exe` 旁 | 否 | OK |
| `vcruntime140_1.dll` | ✅ 在 `python.exe` 旁 | 否 | OK |
| `api-ms-win-crt-*.dll`（UCRT） | 否 | ✅ 系统自带 | OK |
| **`MSVCP140.dll`** | ❌ **不带** | ❌ **不带**（来自 VC++ Redistributable） | **缺失 → 崩溃** |

python.org 的发行版只在自己目录放 `vcruntime140.dll`，**不放 `msvcp140.dll`**；`msvcp140.dll` 只在装了 VC++ Redistributable 的机器的 `System32` 里。全新机器两边都没有，于是扩展加载失败。

### 2.2 为什么“本机能跑，干净机器不行”

构建脚本 `prepareruntime/Prepare_Runtime_Windows.ps1` 用 `robocopy` **直接拷贝开发机已安装的 Python 3.11 目录**。该目录里有 `vcruntime140.dll`（所以被带上了），但 **没有 `msvcp140.dll`**（它在 System32，不在 Python 目录）。开发机 System32 有这个文件，运行时被动找到 → 本机正常；干净机器找不到 → 崩溃。这是典型的 “works on my machine” 陷阱。

### 2.3 影响范围不止 swisseph

用 PE 依赖扫描整套内置 Python 后发现，**导入 `msvcp140.dll` 的编译模块共 13 个**，关键的有：

- `swisseph`（天文历）
- `_sxtwl`（农历，核心功能）
- 其它当前 requirements 中存在的编译扩展

也就是说：即便单独修好 swisseph，`_sxtwl` 还是会接着崩。**正确做法是把 VC++ 运行时放到 `python.exe` 同级，一次性覆盖所有已安装的编译扩展**（加载器一定会搜 `python.exe` 所在目录）。如果将来重新加入 `greenlet`、`scikit-learn` 等原生包，也应由同一套原生依赖扫描自动兜底，而不是把它们硬编码成永远存在的 release gate。

> 注意：`numpy / pandas / pyarrow` 自带的 `msvcp140-<hash>.dll`（delvewheel 改名 + 打补丁，放在各自的 `*.libs` 目录）是自包含的，不受影响；类似 `sklearn/.libs/msvcp140.dll` 这种包内副本即便存在，也只在该包自己的搜索路径上，救不了 swisseph / `_sxtwl`。

### 2.4 “Java 启动失败”是误报（同一个根因的连带现象）

Java 后端其实**启动成功**了，日志可见：

```
spring.log: Tomcat started on port(s): 9999 (http) with context path ''
```

真实链路：Python 崩溃 → 编排层进入失败/清理 → 用 `taskkill /F` 强杀 Java（被强杀的进程在 Windows 上退出码为 1）→ Python 与 Java 两个退出回调存在**竞态**，谁先被捕获就报谁。所以同一个根因，有时显示“Python 退出”，有时显示“Java 退出”。**修好 Python（DLL）后，Java 自然不再被连带杀掉。**

### 2.5 诊断方法（以后排查同类问题可复用）

查某个 `.pyd` 真正依赖哪些 DLL（PowerShell，无需额外工具）：

```powershell
$pyd = "...\python\Lib\site-packages\swisseph.cp311-win_amd64.pyd"
$b = [IO.File]::ReadAllBytes($pyd)
(-join ($b | % { if ($_ -ge 32 -and $_ -lt 127) { [char]$_ } else { "`n" } })) -split "`n" |
  Where-Object { $_ -match '\.dll$' -and $_.Length -lt 40 } | Sort-Object -Unique
```

全量扫描整个运行时、并判断“干净机器上是否会缺”，用仓库内置脚本（见 3.3）。

---

## 3. 修复方案（已落地，逐文件说明）

### 3.1 内置 VC++ 运行时 DLL（核心修复）

- 新增目录 **`prepareruntime/vendor/vc_runtime/x64/`**，收录 10 个 VC++ 2015–2022 (x64) 运行时 DLL（版本 14.44，向后兼容 14.x 工具链编译的扩展）：

  ```
  msvcp140.dll              ← 关键，之前缺的就是它
  msvcp140_1.dll  msvcp140_2.dll  msvcp140_codecvt_ids.dll  msvcp140_atomic_wait.dll
  vcruntime140.dll  vcruntime140_1.dll
  concrt140.dll  vccorlib140.dll  vcomp140.dll
  ```

- 这些是微软可再分发文件，VC++ Redistributable 许可证明确允许随应用分发。来源与刷新方法见 `prepareruntime/vendor/vc_runtime/README.md`。

### 3.2 把 DLL 放进 `python.exe` 同级（两道保险）

- **`prepareruntime/Prepare_Runtime_Windows.ps1`**：新增 `Copy-VcRuntimeDlls`，在拷贝 Python 之后，把 `vendor/vc_runtime/x64` 的 DLL 复制到 `$PyDst`（即 `python.exe` 旁）。优先用 vendored 副本，缺失时回退 System32；若最终仍缺 `msvcp140.dll` 直接 `throw` 终止构建。
- **`desktop_installer_bundle/scripts/stage-runtime.cjs`**：新增 `ensureVcRuntime()`，在 staging 时再次把 vendored DLL 注入到 staged Python，并断言 `msvcp140.dll` 存在。即使有人没重跑 `prepare:runtime`，staging 也会补齐。

> 为什么必须在 staging 之前就放进 `local/workspace/runtime/windows/python/`：运行时分发链是
> `local/workspace/runtime/windows`（源）→ `stage-runtime.cjs` 复制 → 打成 `app-runtime.tar` → electron-builder 作为 `extraResources` 携带 → 首启解压到 `%LOCALAPPDATA%\HorosaDesktop\embedded-runtime\<hash>\`。
> DLL 必须在“源”里（或 staging 注入），才能流到最终安装包。

### 3.3 构建期原生依赖自检（防止再次踩坑）

- 新增 **`desktop_installer_bundle/scripts/check_runtime_native_deps.py`**（纯标准库，可用内置 Python 3.11 直接跑）：
  - 遍历运行时下所有 `*.pyd / *.dll`，自己解析 PE 导入表；
  - 对每个导入做“干净机器可解析性”判断：系统/UCRT DLL（`api-ms-win-*`、`kernel32`、`msi.dll`、`webservices.dll` 等）放行；其余必须能在该模块的搜索路径上找到（`python.exe` 同级 / `DLLs` / 该模块自身包目录树）；
  - 任何“非系统且找不到”的依赖 → 退出码非 0，**让构建失败**；
  - 硬性校验 `msvcp140.dll / vcruntime140.dll / vcruntime140_1.dll` 必须在 `python.exe` 同级。
- 已接入 `stage-runtime.cjs`：staging 完成后用 staged 的 `python.exe` 跑一遍，不过就报错中止。
- 实测：删掉 `msvcp140.dll` 时它会精确报出 `swisseph / _sxtwl` 以及其它当前已安装原生扩展的缺失链路。

### 3.4 编排健壮性（修掉 Java 误报、透出真实错误）

文件：**`desktop_installer_bundle/electron/service-manager.js`**

- 某个服务**意外退出**时：立即标记 `shuttingDown=true`，并主动收掉**另一个**服务 → 它的退出会被判定为“计划内关停”，不再被误报成第二次崩溃（解决 Python/Java 交替报错）。
- 把**崩溃服务日志的结尾**（如 swisseph 的 `ImportError`）读出来拼进错误信息，界面直接看到真实原因，而不只是退出码。
- `cleanupProcesses()` 开头统一置 `shuttingDown=true`（清理即关停）。
- 启动失败的 `catch` 优先采用上面记录的“崩溃详细信息”，避免被泛化的端口超时信息覆盖。
- 兼容性：保留 `"<name> exited unexpectedly (code=..., signal=...)"` 这句（既有单测按子串匹配），细节追加在其后。
- 顺手移除了工作区里一处**未提交**的 `packagedPayloadReady ||` 信任短路（来自之前失败的修改、不在最后一次提交里），恢复提交版的 “trusted fast-path” 语义：首启会真正验证后端 heartbeat，只有指纹匹配且上次验证通过后才走快速路径。这同时修复了 2 条相关单测（现 `node --test` 14/14 全过）。

### 3.5 启动 / 错误窗口 UI 重做

文件：**`desktop_installer_bundle/electron/loading.html`**（整文件重写）

- 之前丑的根因：同一个**最大化大窗**先 `loadFile(loading.html)` 再 `loadURL(renderer)`，一张小卡片飘在 1536px 黑底里。
- 现在：满铺渐变背景 + 居中品牌、5 步进度条（准备运行时 → 启动 Python → 启动 Java → 验证服务 → 就绪）、状态点（蓝=进行/绿=就绪/红=失败）、失败时高亮出错步骤并用等宽面板清晰展示真实错误、“复制诊断信息”按钮、底部版本号。
- 约束（务必保持）：
  - **CSP 不变**（无外网资源，全内联）。
  - **不改 preload 桥接 API**：`getBootstrapConfig / onRuntimeState / retryRuntime / repairRuntime / openLogsDirectory`（另有 `getAppInfo / exportDiagnostics` 可用）。
  - 状态值映射：`preparing-runtime-payload|repairing-runtime|starting-window→步0`、`starting-python→步1`、`starting-java→步2`、`verifying-runtime→步3`、`ready→全完成`、`failed/error→当前步标红`。
- 三个状态（加载 / 失败 / 就绪）均已用浏览器实测截图确认。

### 3.6 安装器图标 / 品牌资产重做

文件：`desktop_installer_bundle/scripts/generate_brand_assets.py`（重写）；重新生成
`assets/horosa_setup.ico`、`installerHeader.bmp`、`installerSidebar.bmp`、`uninstallerSidebar.bmp`。

- 问题：唯一的品牌源是 `assets/horosa_setup_badge.png`（最新 logo：新月 + 点），生成脚本从它派生所有图标/位图。但安装器的 header / sidebar 位图还是 3 月旧版本，印着**旧 logo**（白底“星阙”方块）+ 扁平排版 —— 这就是“图标不是最新的、排版丑”的来源（`.ico` 本身已是新的，但安装器界面里的位图没跟着更新）。
- 改动：
  - 重写生成脚本，所有图标/位图都从最新 badge 派生，始终与 logo 同步。
  - 修正旧脚本把 RGBA 直接 `convert("RGB")` 粘贴导致**透明圆角变黑**的问题（改用 `alpha_composite`）。
  - 为 logo 加柔和投影 + 品牌光晕、强调分隔线；文字改为居中、层级更清晰；配色与启动页统一。
- 重新生成：`python desktop_installer_bundle/scripts/generate_brand_assets.py`（**换 logo 后必跑**）。
- electron-builder 用 `assets/` 下这些文件作安装器图标/位图；`patch:win-icon` 用新 `.ico` 修补可执行文件图标。

### 3.7 安装后显示名改为「星阙」

文件：`desktop_installer_bundle/package.json`、`desktop_installer_bundle/assets/installer.nsh`。

- `build.productName` 与 `nsis.shortcutName` 均为 `星阙` —— 决定桌面/开始菜单快捷方式、Add/Remove Programs 显示名、窗口标题。
- 可执行文件**刻意保留 `Horosa.exe`**（ASCII，规避中文路径在打包/图标修补/路径长度上的坑；`scripts/patch-win-exe-icon.cjs` 按此名修补图标）。用户看到的是「星阙」标签，不是文件名。
- `installer.nsh` 里 `CURRENT_SHORTCUT_FILE_NAME` = `星阙.lnk`、`LEGACY_BRAND_SHORTCUT_FILE_NAME` = `Horosa.lnk`（卸载/升级时清掉旧的 `Horosa.lnk`）。改名时这两个 define 必须同步。

### 3.8 内置 Python 改用 python-build-standalone（消除环境漂移）

文件：`prepareruntime/Prepare_Runtime_Windows.ps1`。

- 旧逻辑：`robocopy` 构建机上**已安装的** Python 3.11 —— 不同机器的小版本/site-packages 状态不同，是“works on my machine”漂移的根源。
- 新逻辑：**默认下载固定版本的 python-build-standalone（Astral）CPython**（当前 `tag=20260510` / `cpython-3.11.15`，x86_64-pc-windows-msvc，relocatable、自包含），解压进运行时目录。不再依赖构建机上的 Python。
- 安全网（三重）：① 下载/解压失败时**自动回退**到“复制系统 Python 3.11”的旧逻辑；② 设 `HOROSA_PYTHON_RUNTIME_SOURCE=system` 可强制走旧逻辑；③ 之后照常 pip 装依赖 + 构建期 DLL 自检 + 发布前 preflight + 干净 VM 实测。
- **仍然需要** `Copy-VcRuntimeDlls`：standalone 构建只带 `vcruntime140*`，**不带 `msvcp140.dll`**（和 python.org 一样），所以 §3.1–3.2 的 VC++ 运行时注入照旧。
- 升级 Python 版本：改 `Get-StandalonePythonRuntime` 里的 `$tag` 与 `$asset` 两行即可。
- 打包时裁掉 standalone 自带的 `.pdb` 调试符号（约 77 MB，运行时不需要，已做成 `stage-runtime.cjs` 的永久步骤），瘦身版安装包约 1.11 GB。
- **已验证（含真实干净机）**：standalone python + `pip install -r requirements.txt`（全套依赖：swisseph、`_sxtwl`、numpy、pandas、streamlit、kerykeion、astropy…）全部安装成功；图表服务需要的全部模块 import 通过——既在**进包的 runtime**上跑通，也在**全新 Windows 11 VM 实测通过**（应用启动、命盘正常渲染、Java + Python 本地服务均正常运行）。

---

## 4. 以后应该怎么做（构建 / 发布流程）

### 4.1 正常打包发布

在 `desktop_installer_bundle/` 下：

```powershell
npm run dist:win
```

它会依次 `verify（单测 + release_preflight）→ build:renderer → prepare:runtime → stage:runtime`（构建期自检在此把关）→ `electron-builder` 出 `release/Horosa-Setup-<version>.exe`。`loading.html` 等 `electron/` 文件由 electron-builder 直接打包，无需 staging。`verify` 不过会在打包前就中止，避免出错的包被打出来。

> 已安装的旧版不会自动修复——必须重新打包并在目标机器重装；安装后“自检修复并重试”会从新安装包重新解压（含 DLL）。

### 4.2 新增 / 升级 Python 依赖时

1. 在 `astropy/requirements.txt` 改动后，重跑 `prepare:runtime`（会重装依赖并补齐 VC 运行时）。
2. 跑一次自检：

   ```powershell
   python desktop_installer_bundle/scripts/check_runtime_native_deps.py `
     local/workspace/runtime/windows/python --survey
   ```

3. 如果报出“非系统且找不到”的新 DLL：把该 DLL 放进合适位置（VC 运行时类放 `prepareruntime/vendor/vc_runtime/x64`；其它第三方原生库一般随其 wheel 的 `*.libs` 自带，无需手动处理），直到自检通过。

### 4.3 刷新 vendored DLL（换工具链/升级时）

从装了最新 VC++ Redistributable 的机器重拷（命令见 `prepareruntime/vendor/vc_runtime/README.md`），或下载 `VC_redist.x64.exe` 解包取运行时 DLL。

### 4.4 每次发布前的验收清单

- [ ] `npm run stage:runtime` 输出 `ensured 10 ... DLL` 且 `[deps] OK`。
- [ ] 用内置 python 冒烟当前 requirements 里的关键模块，例如：`python.exe -c "import swisseph,_sxtwl,sxtwl,ephem,pendulum,kerykeion,astropy,pandas,streamlit; print('ok')"`。
- [ ] 单测：`node --test electron/service-manager.test.js` 应 **14/14 全过**。
- [ ] **在全新 Windows 11 VM 上实装**：服务起来、能算并渲染一张星盘。

### 4.5 更换 logo 时

1. 用新 logo 覆盖 `desktop_installer_bundle/assets/horosa_setup_badge.png`（建议 1024×1024、透明背景 PNG）。
2. 跑 `python desktop_installer_bundle/scripts/generate_brand_assets.py` 重新生成 `.ico` 与 header/sidebar 位图。
3. 正常 `npm run dist:win` 打包（electron-builder + `patch:win-icon` 会带上新图标）。

> 易错点：只换 `horosa_setup_badge.png` 而**忘了跑生成脚本**，安装器界面里的 header/sidebar 仍是旧 logo —— 本次踩的就是这个坑。

### 4.6 发布闸门与 CI（让更新不易出错）

把每一类踩过的坑都做成会自动拦截的闸门，并尽量在打包前就失败：

- **本地发布闸门**：`npm run verify` = `node --test`（编排单测）+ `scripts/release_preflight.py`（校验版本一致、品牌资产未过期、VC++ 运行时齐全、应用名为星阙）。已接进 `dist:win` 开头，preflight 不过整个打包提前中止。
- **构建期 DLL 闸门**：`stage-runtime.cjs` 自动跑 `check_runtime_native_deps.py`，缺失非系统 DLL 直接让构建失败。
- **CI 流水线** `.github/workflows/desktop-release.yml`（推 `v*` tag 或手动触发）已新增两步：① “Regenerate brand assets from logo”（`pip install pillow` + `npm run build:assets`，保证发布包永远用最新 logo）；② “Verify release gates”（`npm run verify`）。CI 跑 `Prepare_Runtime_Windows.ps1` 时也走 standalone python 路径。
- 原则：**能自动测的都做成闸门、能在打包前失败的绝不拖到用户机器**。

---

## 5. 注意点 / 坑（重要）

1. **绝不要依赖 System32**：本机有不代表用户有。判断“是否真的打进包里”，永远以全新 VM 为准，或用 4.2 的自检。
2. **DLL 必须在 `python.exe` 同级**：放到 `python/DLLs` 或某个包的 `.libs` 里不一定在别的扩展的搜索路径上。`python.exe` 所在目录是加载器必搜的“应用目录”。
3. **别被 delvewheel 的副本迷惑**：`numpy.libs/pandas.libs/pyarrow.libs` 里那些带哈希名的 `msvcp140-xxxx.dll` 只服务各自的包；`sklearn/.libs/msvcp140.dll` 也只在 sklearn 路径上。它们都救不了 `swisseph / _sxtwl`。
4. **架构 / 版本必须匹配**：扩展是 `cp311-win_amd64` ↔ 内置 Python 必须是 3.11 x64。换 Python 小版本要同步换扩展和这套校验。
5. **VC++ 运行时向后兼容**：14.x（VS2015–2022）ABI 稳定，用较新的 `msvcp140.dll` 可服务老一些工具链编译的扩展。
6. **tar 差异（仅影响手动跑 staging）**：`stage-runtime.cjs` 调系统 `tar`。Windows 自带的 `bsdtar` 正常；若从 Git Bash/MSYS 跑，GNU tar 会把 `C:\...` 当成远程主机报 `Cannot connect to C:`。**请用 PowerShell/cmd 跑构建。**
7. **trusted fast-path 信任逻辑**：工作区里曾有一处未提交的 `packagedPayloadReady ||` 短路，让“trusted”几乎永远为真 → 每次启动都跳过后端 heartbeat 验证，并使 2 条单测失败。已恢复为提交版逻辑（仅当运行时指纹匹配且上次已验证通过才走 fast-path），现 14/14 全过。排查“某测试为何失败”时，记得先看是不是工作区未提交的脏改动（`git blame` 会标 `Not Committed Yet`），别想当然认定是“既有失败”。
8. **Electron 文件不走 staging**：`loading.html / main.js / preload.js` 由 electron-builder 按 `electron/**/*` 直接打包，改完即生效。
9. **内置 Python 现在默认是下载来的**（python-build-standalone，§3.8）：构建机需要能联网拉取一次（GH runner / 本机均可）；离线环境会自动回退系统 Python，或设 `HOROSA_PYTHON_RUNTIME_SOURCE=system`。升级 Python 改 `Get-StandalonePythonRuntime` 的 `$tag/$asset`，且 `msvcp140.dll` 仍要靠 §3.1–3.2 注入（standalone 不带它）。
10. **应用名是“星阙”、可执行是 `Horosa.exe`**：别把 `executableName` 也改成中文（会牵连 `patch:win-icon`、asar 完整性、路径长度）。改显示名时记得同步 `installer.nsh` 的 `CURRENT/LEGACY_*_SHORTCUT_FILE_NAME`。
11. **快捷方式别只依赖 VBScript/cscript**：旧逻辑只用 cscript 跑 `%TEMP%` 里的 `.vbs` 建快捷方式，写不出还会中止安装——在拦 cscript 的机器（AV/ASR、VBScript 弃用、OneDrive 桌面锁）上就建不出，表现为“干净 VM 能建、本地建不出”。现已加 NSIS 原生 `CreateShortCut` 兜底、不再中止、校验改存在性判定。**已在真实失败机（脚本宿主被拦、OneDrive 桌面）静默装包验证：原生兜底成功在桌面 + 开始菜单建出「星阙」快捷方式，指向 `C:\Horosa\Horosa.exe`**。（随下个版本发布）

---

## 6. 根治“works on my machine”：已实施

原“长期建议”——把“robocopy 开发机系统 Python”换成可复现、自包含、可重定位的
**astral-sh/python-build-standalone**——**已在 §3.8 落地**（默认下载固定版本、带系统 Python 回退与 `HOROSA_PYTHON_RUNTIME_SOURCE=system` 覆盖开关）。配合 §3.3 的构建期 DLL 自检与 §4.6 的发布闸门，运行时漂移已基本根治。后续若要进一步用 `uv` 统一管理可在此基础上演进。

---

## 7. 受影响文件清单

| 文件 | 改动 |
|---|---|
| `prepareruntime/vendor/vc_runtime/x64/*.dll` | 新增：10 个 vendored VC++ 运行时 DLL |
| `prepareruntime/vendor/vc_runtime/README.md` | 新增：来源 / 许可 / 刷新方法 |
| `prepareruntime/Prepare_Runtime_Windows.ps1` | 新增 `Copy-VcRuntimeDlls`；内置 Python 改为默认下载 python-build-standalone（`Get-StandalonePythonRuntime`，带系统 Python 回退与 `HOROSA_PYTHON_RUNTIME_SOURCE` 覆盖开关） |
| `desktop_installer_bundle/scripts/stage-runtime.cjs` | 新增 `ensureVcRuntime` + `runNativeDepCheck` + 断言并接入流程；并裁剪 `.pdb` 调试符号（standalone Python 自带约 77 MB，运行时不需要） |
| `desktop_installer_bundle/scripts/check_runtime_native_deps.py` | 新增：构建期原生依赖自检（纯标准库 PE 解析） |
| `desktop_installer_bundle/electron/service-manager.js` | 编排健壮性：日志结尾透出、`shuttingDown`、收掉兄弟进程、`catch` 优先采用崩溃信息；并还原被脏改动覆盖的 trusted fast-path 逻辑（修复 2 条单测） |
| `desktop_installer_bundle/electron/loading.html` | 启动/错误窗口整体重做 |
| `desktop_installer_bundle/scripts/generate_brand_assets.py` | 重写：从最新 logo 生成图标 + 安装器位图，修复透明圆角变黑、改进排版 |
| `desktop_installer_bundle/assets/{horosa_setup.ico,installerHeader.bmp,installerSidebar.bmp,uninstallerSidebar.bmp}` | 重新生成（最新 logo + 新排版） |
| `desktop_installer_bundle/scripts/release_preflight.py` | 新增：发布前闸门（版本一致 / 品牌资产未过期 / VC++ 运行时齐全 / 应用名=星阙） |
| `desktop_installer_bundle/package.json` | 新增 `build:assets`、`verify` 脚本并把 `verify` 接进 `dist:win`；`productName`/`nsis.shortcutName` 改为 `星阙` |
| `desktop_installer_bundle/assets/installer.nsh` | `CURRENT/LEGACY_*_SHORTCUT_FILE_NAME` 对调（当前=`星阙.lnk`、旧=`Horosa.lnk`）；**快捷方式硬化**：cscript/VBScript 被拦或失败时回退 NSIS 原生 `CreateShortCut`，写不出 helper 不再中止安装，校验改存在性判定（已编译验证，随**下个版本**发布；已发布的 2.1.1 未含） |
| `.github/workflows/desktop-release.yml` | 新增“重生品牌资产”和“verify 闸门”两步 |
| `docs/PROJECT_STRUCTURE.md` | 同步：vendored VC 运行时、新脚本、命名约定、启动页、发布闸门 |
| `README.md` / `README_ZH.md` / `README_EN.md` | 按 Mac 仓库 README 框架重写（Windows 化：NSIS / Electron / Python 3.11 standalone / Win10-11 x64），并去掉旧版冗余 badge 墙 |

---

## 8. 参考资料

- spaCy #5332 — Windows .pyd files sneakily depend on msvcp140.dll: https://github.com/explosion/spaCy/issues/5332
- cefpython #359 — Windows 需要 msvcp140.dll，Python 不自带: https://github.com/cztomczak/cefpython/issues/359
- Microsoft Q&A — ImportError: Could not find the DLL(s) 'msvcp140_1.dll': https://learn.microsoft.com/en-us/answers/questions/494596/
- electron #5528 / electron-packager #368 — Windows 需要 vcruntime140.dll: https://github.com/electron/electron/issues/5528
- python-build-standalone（自包含可重定位 Python）: https://gregoryszorc.com/docs/python-build-standalone/main/
- py-app-standalone（基于 uv 的现代自包含打包）: https://github.com/jlevy/py-app-standalone
