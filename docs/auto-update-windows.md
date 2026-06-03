# Windows 应用内自动更新（electron-updater + GitHub Releases）

> 适用范围：**仅 Windows 桌面端**（Electron + NSIS）。macOS（Tauri）是另一套机制，单独维护——本文不涉及。

## 这是什么

桌面端在后台静默检查 GitHub Releases，发现新版时用**原生系统弹窗**提示用户：

1. **每次软件打开**约 15s 后自动做一次后台检查（之后每 6 小时一次）；菜单「帮助 → 检查更新」可手动触发。检查从 `bootstrap()` 调度，**与本地 runtime 是否启动成功无关**——就算 runtime 挂了也会照常弹更新提示（更新本身可能就是修这个挂的）。
2. 发现新版 → 弹窗「发现新版本 vX（当前 vY）。是否现在下载并安装？[下载并安装] [稍后]」。
3. 点「下载并安装」→ **弹出专用下载进度窗口**（暗色小窗：版本号 / 百分比进度条 / 已下载-总大小 / 速度），任务栏图标同时显示进度。进度窗口非模态、可最小化、可关闭（关闭不会取消下载——任务栏进度 + 完成后的弹窗仍会提示你）。
4. 下载完成 → 进度窗口自动关闭 → 弹窗「新版本 vX 已下载完成，需要重启应用完成安装。[立即重启并安装] [稍后]」。
5. 点「立即重启并安装」→ **先彻底停掉本地 Python/Java 服务**，再交给 NSIS 静默安装并自动重启到新版本。

实现全部在 `desktop_installer_bundle/electron/`，**不碰共享前端 `astrostudyui`**（所以不会产生 Mac→Win 同步分叉，也无需重建前端）。

## 关键文件

- `electron/main.js` — `configureAutoUpdater()`（事件接线 + 原生弹窗）、`promptForDownload`/`promptForInstall`/`installUpdateNow`（流程）、`startUpdateRecheckTimer`（周期检查）。开关：`AUTO_UPDATE_ENABLED`（必须为 `true`）。
- `electron/update-flow.js` — **纯函数**决策逻辑（无 electron 依赖，可 `node --test`）：`shouldPromptForAvailableUpdate`（手动总提示 / 后台不重复提示已暂缓版本）、`shouldAnnounceNoUpdate` / `shouldAnnounceUpdateError`（"已最新"/报错弹窗仅手动检查才弹——后台静默，避免"updater noise"）、`formatUpdateErrorMessage`。
- `electron/update-flow.test.js` — 上述逻辑的单测（接入 `npm run verify`）。
- `electron/update-progress.html` — 下载进度窗口的 UI（暗色主题：标题/版本/百分比进度条/已下载-总大小/速度）。由 `showDownloadProgressWindow()` 用 `BrowserWindow` 加载；通过 IPC 通道 `update:init` / `update:progress` / `update:done` 接收主进程的事件流。
- `scripts/write-app-update-yml.cjs` — 打包时把 `app-update.yml` 写进 `resources/`（修补 `--dir`+`--prepackaged` 拆分会跳过 electron-builder 自身生成的根因）。
- `package.json` `build.publish` = GitHub `Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows`（**公开仓库** → electron-updater 无需 token）；`win.verifyUpdateCodeSignature: false`（应用未签名，必须关签名校验，否则更新会失败）。
- `scripts/_update_feed_probe.js` — 手动诊断：用真实 `NsisUpdater` 打真实 feed，强制低版本验证「发现新版→下载→校验」（见下）。

## 为什么之前不稳 / 这次怎么做稳的

历史：整套 `electron-updater` 机制其实早就写好，但被 commit `ea5cbb2`（2026-03-23，*"Disable updater noise for installer-only release"*）用 `AUTO_UPDATE_ENABLED = false` **整个关掉了**——纯禁用，从未真正做稳；前端也从来没有任何更新提示 UI。

这次做稳的核心（按"最成熟方案"）：

1. **安装前必须先停 sidecar（最关键、也是这类应用最典型的不稳定根源）。** 嵌入式 Python（图表服务）和 Java（Spring Boot 后端）作为子进程持有 `resources/app-runtime/**` 的文件句柄。若它们还活着，NSIS 覆盖安装目录时会因**文件被占用而失败/损坏**。`installUpdateNow()` 因此在 `quitAndInstall` 之前先 `await runtimeManager.stop('update-install')`（`taskkill /T /F` 杀掉并等待），再留 600ms 让 OS 释放句柄，然后才交给 NSIS。旧代码直接 `quitAndInstall` 没有这一步。
2. **后台检查不弹"噪音"。** 后台检查只在"发现新版/已下载"时弹窗；"已是最新"和网络错误**只记日志、不弹窗**（这正是当年被嫌"noise"而整个关掉的东西）。手动检查（菜单）才显示全部结果。已点过"稍后"的版本，本次会话内后台不再重复提示。
3. **先提示再下载**（`autoDownload = false`）：不偷跑 ~750MB。**自 v2.5.4 加固起 `autoInstallOnAppQuit = false`**：唯一的安装路径是用户在「已下载」弹窗点「立即重启并安装」走 `installUpdateNow()`，而 `installUpdateNow()` 只在 `updateState.status === 'downloaded'` 时执行，该状态又**只在 Ed25519 验签通过后**才置位（见下「更新链路安全」）。这样关掉了「退出时自动装」这条**绕过验签**的旁路——任何安装都必经验签。代价：下载后选「稍后」的用户，需要下次手动从菜单触发安装（验签会再跑一遍），而不是退出时静默装上。
4. **退出流程协同。** `installUpdateNow()` 先置 `isQuitting/isShuttingDown = true`，于是既有的 `before-quit`/`window-all-closed`/窗口 `close` 处理器会**放行** `quitAndInstall` 触发的 `app.quit()`，而不是 `preventDefault` 去抢着自己关——避免死锁/二次停服。
5. **`quitAndInstall(true, true)`** = 静默安装 + 装完自动重启（对应用户要的"自动…然后重启"，而非再点一遍安装向导）。`perMachine:false` + `asInvoker` → 无需 UAC，静默安装顺畅。

## 发布门禁（防"静默失效"）

`scripts/release_selfcheck.py` 新增第 7 个 gate **`update feed (latest.yml) matches exe`**：校验 `release/latest.yml` 的 `path`/`sha512`/`size` 与实际 `Horosa-Setup-<ver>.exe` **逐字节一致**。

为什么需要它：electron-updater 下载 `latest.yml` 里指定的 exe 并核对其 sha512+size；一旦 `latest.yml` 与实际 exe **漂移**（最典型：**原地覆盖**重发时重打包导致 exe 哈希必变，却忘了重生成/重传 `latest.yml`），所有客户端的自动更新都会在完整性校验处**静默失败**。这个 gate 在本地就拦住它。

另外 `check_sentinels` 新增 `electron/main.js` 哨兵：必须含 `AUTO_UPDATE_ENABLED = true` + `runtimeManager.stop('update-install')` + `quitAndInstall`——防止"重新被关掉"或"停服那步被删掉"这类回归。

## 验证

- **单测**：`update-flow.test.js`（决策逻辑）+ `service-manager.test.js` + `update-signature.test.js`（Ed25519 验签，9 例），`node --test` 39/39（**经 PowerShell**——Bash/MSYS 的 GNU tar 会把 `C:\` 当远程主机使打包 fixture 失败）。
- **feed 探针**（`scripts/_update_feed_probe.js`，强制 `currentVersion=0.0.1`）：真实 `NsisUpdater` 打真实公开仓库 feed → 正确解析出 `version 2.2.0 / size 849344684 / sha512 YYpQ…`，触发 `update-available`。证明 feed 可达（无需 token）、`latest.yml` 解析正确、提示链路会触发。
  - 加 `PROBE_DOWNLOAD=1` 还会实际下载并跑 electron-updater 的 sha512 完整性校验（证明线上 exe 可下载且与 feed 自洽）。
- **selfcheck**：第 7 个 gate 实测对当前 `Horosa-Setup-2.2.0.exe` 算 sha512 并与 `latest.yml` 比对，PASS。

> ⚠️ **真正的端到端**（旧版 app 检测到新版→下载→装上→重启进新版）天然需要**两个已发布版本**，最好在干净 Win11 VM 上跑。本地能证明到「检测+下载+完整性+安装时序逻辑」为止；首个"已启用自动更新"的版本本身必须**手动安装一次**（或原地覆盖 v2.2.0），因为线上 v2.2.0 的更新器是关的——之后的版本才会被它自动拉取。

## v2.5.4 加固：更新链路安全 + 发布安全 + 分发（对齐成熟软件）

> 背景：本应用**未做 Authenticode 代码签名**（便宜的 Azure Trusted Signing GA 2026-04 仅 US/CA/EU/UK 主体可用，中国不可用；EV 证书须硬件 token、CI 不友好），且 `verifyUpdateCodeSignature: false`。因此自动更新此前的**唯一**完整性保障是「**未签名**的 `latest.yml` 里的 sha512 + GitHub HTTPS 传输」。若 GitHub 账号/release 被攻陷，或企业 rogue-CA MITM 了 HTTPS，一个恶意 exe 会被以**用户权限自动安装**——这正是 Electron updater 的教科书级 RCE 通道。下面 5 项是在**不依赖 CA**的前提下把更新/发布/分发对齐成熟软件（VS Code / Slack / Sparkle EdDSA / TUF）。

### ① 更新链路安全：Ed25519 签名更新元数据（fail-closed）

无需任何 CA：用一对离线 Ed25519 密钥给「下载下来的安装包」背书，客户端内置公钥验签后才允许安装。仿 Doyensec SafeUpdater / Sparkle EdDSA 模式。

- **密钥**：`crypto.generateKeyPairSync('ed25519')`。**私钥** `~/.horosa-release/update-ed25519-private.pem`，**永不进仓 / 永不进 CI**（仓库与 CI 都不该持有它——签名是发布者在本机做的离线动作）。**公钥**硬编码进 `electron/update-signature.js`（`UPDATE_PUBLIC_KEY_PEM`），随客户端一起发。
- **规范消息**（`canonicalUpdateMessage`）：`Horosa-Update-v1\n<version>\n<sha512-base64-of-exe>`——把版本号和安装包哈希一起签，防「换版本」与「换文件」两类替换。
- **发布签名**：`scripts/sign-update.cjs sign-release` 在 `dist:win` 出 exe 之后自动跑（`npm run sign:update`），对 `release/Horosa-Setup-<ver>.exe` 算 sha512、签名，写 `release/horosa-update.sig`（JSON `{v,version,alg:'ed25519',sha512,sig}`）。签完**当场用内置公钥自验**，不过就 abort（防私钥/公钥漂移发出验不过的签名）。`horosa-update.sig` 作为**第 5 个 release 资产**上传。
- **客户端验签**（`electron/main.js` `update-downloaded` → `verifyDownloadedUpdate`）：electron-updater 下完整包后，**先**对落地的安装包流式算 sha512 → 从该 release 拉 `horosa-update.sig` → 用内置公钥验 `version + sha512`。**验过**才把状态置 `'downloaded'`（`installUpdateNow` 的唯一前置 + 因 ① autoInstallOnAppQuit 已关 = 唯一安装路径）并弹「重启安装」；**验不过/拉不到签名/算哈希异常**一律 `downloadedUpdateInfo=null` + 状态 `'error'` + 提示去 GitHub 手动下完整包，**绝不 `quitAndInstall`**。这是 **fail-closed**：任何不确定都拒装。
- **双重不绕过**：因为 `autoInstallOnAppQuit = false`，连「退出时自动装」也走不了未验签的旧旁路。
- **单测**：`electron/update-signature.test.js`（9 例，接入 `npm run verify`）用**临时密钥**覆盖：正常验过 / 篡改安装包哈希拒 / 换版本号拒 / 换密钥伪造拒 / 翻转签名字节拒 / 不支持的 schema·alg 拒 / 缺字段·垃圾输入永不抛且 fail-closed / 内置公钥不认陌生密钥签名。
- **发布门**：`release_selfcheck.py` 新增 `check_update_signature` gate——`node sign-update.cjs verify` 实测 `horosa-update.sig` 对当前 exe 验签通过（缺失/验不过则发布失败）。

> **威胁模型与边界**：这把「GitHub release 被替换 / HTTPS 被 MITM」收敛为「**还需要拿到离线私钥**」才能让客户端装上恶意更新。私钥不在仓、不在 CI、只在发布者本机 → 攻陷面大幅收窄。建议 owner 给 GitHub 账号开 2FA。这**不替代**代码签名（SmartScreen 仍会对未签名安装器告警——那是**首次安装**面，不是**更新**面），两者正交：将来若做了 OS 签名可同时把 `verifyUpdateCodeSignature` 转 true，形成「OS 签名 + 自签元数据」双层。

### ② 发布安全：灰度发布（staged rollout）+ 通道

- **灰度**：`scripts/set-staging.cjs <percent>` 给**线上** `latest.yml` 注入 `stagingPercentage: <0-100>`。electron-updater 按每装机稳定 id 自分桶，只有桶位低于阈值的客户端才取更新 → 可 10%→25%→50%→100% 逐步放量，先在子集发现回归（v2.5.0→v2.5.4 那几版都是**全量**发，#14/#15/dial 若先灰度即可早发现）。**不**接进 `dist:win`（这是发布时对**线上** yml 的操作）；改完 yml 要重生成 `SHA256SUMS.txt` 再 `gh release upload --clobber`。只动 `stagingPercentage` 不碰 exe 的 path/sha512/size → 第 7 个 gate 仍绿。
- **回滚**：electron-updater **不会**因为你调低百分比就把已升级客户端退回去——**撤一个坏的灰度版只能 bump 版本**重发。
- **通道**：`allowDowngrade = false`、`allowPrerelease` 默认 false、`channel` 维持 `latest`（显式写明意图）。将来发 Beta 可走 `beta` channel + `beta.yml`（本轮不强制切）。

### ③ 带宽：差分下载（differential / blockmap）

- `disableDifferentialDownload = false`（显式写明：**保持开启**）。每版都发 `.blockmap`（已有），electron-updater 据此只下变化块。Chromium(~280MB) + 多数 wheels 跨版不变，理论上小版本更新可只传几十 MB 而非 756MB。
- **注意**：差分**只省下载**，不省解压——新版首启仍按新 payloadId 全量解压 ~1.35GB 到 userData（内嵌运行时模型的固有成本）。750MB 安装器里的 runtime tar 被 7z 重压**可能错位 block 边界**削弱差分命中；实测口径见 SELFCHECK_LOG。

### ④ 健康检查：运行期后端崩溃自动重启（H-7，supervisor 模式）

- 此前 runtime 在 ready 之后崩 = 杀兄弟进程 + 弹 runtime-error + **手动** repair。现 `electron/main.js` 的 `runtime-error` 处理器加**有界自动重启**：`MAX_RUNTIME_AUTO_RESTARTS = 2`，退避 `[1500, 4000]ms`，经 `startRuntimeFlow({restart:true})` 重新拿端口 + 重载 renderer；连续稳定 `45s` 则把尝试计数清零（下次独立崩溃重新有 2 次预算）。**计划内关闭 / 更新安装期间不重启**（`isQuitting/isShuttingDown` 守卫，退避中再查一次）；预算耗尽或重启没到 ready 才落到原来的手动 repair UI。Job Object（v2.5.4）会自动纳管重启出来的新子进程，不留孤儿。

### ⑤ 分发：winget

- `scripts/winget-manifest.cjs` 生成 3 个 winget manifest（`winget/manifests/h/HoraceMaxwell/Horosa/<ver>/`，`InstallerType: nullsoft`、`Scope: user`、URL=release exe、`InstallerSha256` 取自 `SHA256SUMS.txt`）。加一条 `winget install HoraceMaxwell.Horosa` 路径（发现性 / 可脚本化 / 企业装机），**不替换**现有 NSIS 下载。winget 接受**未签名** EXE + SHA-256。提交是**手动**的：fork `microsoft/winget-pkgs`、拷 manifest、开 PR（或 `wingetcreate`）——`winget/` 目录是源/模板，winget-pkgs 是另一个仓库。

### 暂缓（已与 owner 决策）

- **代码签名（消除 SmartScreen）**：中国不可用 Azure Trusted Signing、不买 EV 证书 → 维持现状并继续文档化「更多信息 → 仍要运行」。预算投向上面的更新链路安全。
- **CI 构建/签名/可复现发布**：维持本地手工 mature flow + selfcheck 门。

## 注意 / 维护

- `win.verifyUpdateCodeSignature` 必须保持 `false`（应用未签名）。若将来做了代码签名，可改回校验并配 `publisherName`。
- 任何时候改了更新流程，跑 `_update_feed_probe.js` 自测 feed；改了发布资产，靠第 7 个 gate 保 `latest.yml` 与 exe 一致。
- 同版本**原地覆盖**重发时：务必重生成 `SHA256SUMS.txt` **和** `latest.yml` **和** `horosa-update.sig`（exe 哈希必变 → 这三者都必变），否则自动更新失效——`latest.yml`/exe 漂移被第 7 个 gate 拦、`horosa-update.sig`/exe 漂移被 `check_update_signature` gate 拦；上传后也要确认线上四资产（exe/blockmap/latest.yml/horosa-update.sig）互相自洽。`dist:win` 的 `sign:update` 步骤会自动重签 `horosa-update.sig`。
- **Ed25519 私钥**（`~/.horosa-release/update-ed25519-private.pem`）是发布信任根：**永不提交、永不进 CI、做好离线备份**。丢了 = 无法再发能被现有客户端验过的更新（须连同新公钥发一个过渡版本）。换密钥要同步改 `electron/update-signature.js` 的内置公钥并发版。
- `horosa-update.sig` 必须作为**第 5 个 release 资产**和 exe/blockmap/latest.yml/SHA256SUMS 一起上传；少传它 → 客户端 `update-downloaded` 拉不到签名 → **fail-closed 拒装**（这是预期的安全行为，但会让自动更新「卡住」，排查时先确认该资产在线）。
