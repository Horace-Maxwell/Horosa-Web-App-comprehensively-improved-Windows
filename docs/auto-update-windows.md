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
3. **先提示再下载**（`autoDownload = false`）：不偷跑 ~800MB；`autoInstallOnAppQuit = true` 作兜底（下载后选"稍后"的，下次退出时自动装；此时 runtime 已由正常退出流程停掉，安全）。
4. **退出流程协同。** `installUpdateNow()` 先置 `isQuitting/isShuttingDown = true`，于是既有的 `before-quit`/`window-all-closed`/窗口 `close` 处理器会**放行** `quitAndInstall` 触发的 `app.quit()`，而不是 `preventDefault` 去抢着自己关——避免死锁/二次停服。
5. **`quitAndInstall(true, true)`** = 静默安装 + 装完自动重启（对应用户要的"自动…然后重启"，而非再点一遍安装向导）。`perMachine:false` + `asInvoker` → 无需 UAC，静默安装顺畅。

## 发布门禁（防"静默失效"）

`scripts/release_selfcheck.py` 新增第 7 个 gate **`update feed (latest.yml) matches exe`**：校验 `release/latest.yml` 的 `path`/`sha512`/`size` 与实际 `Horosa-Setup-<ver>.exe` **逐字节一致**。

为什么需要它：electron-updater 下载 `latest.yml` 里指定的 exe 并核对其 sha512+size；一旦 `latest.yml` 与实际 exe **漂移**（最典型：**原地覆盖**重发时重打包导致 exe 哈希必变，却忘了重生成/重传 `latest.yml`），所有客户端的自动更新都会在完整性校验处**静默失败**。这个 gate 在本地就拦住它。

另外 `check_sentinels` 新增 `electron/main.js` 哨兵：必须含 `AUTO_UPDATE_ENABLED = true` + `runtimeManager.stop('update-install')` + `quitAndInstall`——防止"重新被关掉"或"停服那步被删掉"这类回归。

## 验证

- **单测**：`update-flow.test.js`（决策逻辑）+ `service-manager.test.js`，`node --test` 26/26（经 PowerShell）。
- **feed 探针**（`scripts/_update_feed_probe.js`，强制 `currentVersion=0.0.1`）：真实 `NsisUpdater` 打真实公开仓库 feed → 正确解析出 `version 2.2.0 / size 849344684 / sha512 YYpQ…`，触发 `update-available`。证明 feed 可达（无需 token）、`latest.yml` 解析正确、提示链路会触发。
  - 加 `PROBE_DOWNLOAD=1` 还会实际下载并跑 electron-updater 的 sha512 完整性校验（证明线上 exe 可下载且与 feed 自洽）。
- **selfcheck**：第 7 个 gate 实测对当前 `Horosa-Setup-2.2.0.exe` 算 sha512 并与 `latest.yml` 比对，PASS。

> ⚠️ **真正的端到端**（旧版 app 检测到新版→下载→装上→重启进新版）天然需要**两个已发布版本**，最好在干净 Win11 VM 上跑。本地能证明到「检测+下载+完整性+安装时序逻辑」为止；首个"已启用自动更新"的版本本身必须**手动安装一次**（或原地覆盖 v2.2.0），因为线上 v2.2.0 的更新器是关的——之后的版本才会被它自动拉取。

## 注意 / 维护

- `win.verifyUpdateCodeSignature` 必须保持 `false`（应用未签名）。若将来做了代码签名，可改回校验并配 `publisherName`。
- 任何时候改了更新流程，跑 `_update_feed_probe.js` 自测 feed；改了发布资产，靠第 7 个 gate 保 `latest.yml` 与 exe 一致。
- 同版本**原地覆盖**重发时：务必重生成 `SHA256SUMS.txt` **和** `latest.yml`（exe 哈希必变），否则自动更新失效——第 7 个 gate 会在本地拦住，但上传后也要确认线上 `latest.yml` 与线上 exe 一致。
