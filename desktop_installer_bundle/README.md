# Horosa Windows Desktop Bundle

这个目录承载 Horosa v2.1.2 Beta Windows 桌面应用工程。

- 当前发布版本：`2.1.2 Beta`（安装器版本号为 `2.1.2`）
- 发布定位：Mac 2.1.0 beta 产品面同步后的 Windows Web / Desktop 自包含大版本
- 用户入口：`release/Horosa-Setup-2.1.2.exe`
- 图标资产：`assets/horosa_setup.ico` 与 `assets/horosa_setup_badge.png`

## 目录职责

- `electron/`：Electron 主进程、预加载脚本、窗口管理、Python/Java/Web 服务编排、运行时健康检查、启动控制台与本地日志。
- `scripts/`：renderer 构建、runtime staging、项目路径解析、版本资产整理、安装器回归和干净机器冷/热启动检查。
- `assets/`：安装器图标、README 展示 icon、NSIS 定制资源与安装器图片。
- `release/`：本地安装器输出目录。

## 本地构建

1. 在主项目 `astrostudyui` 中执行 `npm run build:file`
2. 在本目录执行 `npm run build:desktop`
3. 需要完整安装器时执行 `npm run dist:win`

`npm run dist:win` 会重新构建 file-mode 前端、准备 Python/Java/Node/Web runtime、打包 runtime payload、生成 `win-unpacked`，再输出 NSIS 安装器。

## 开发验证

- `npm run dev`：重建 renderer、重新 stage runtime，再启动 Electron。
- `npm run dev:fast`：仅适合不涉及前端改动的快速调试。
- 如果改了 `astrostudyui`，不要跳过 `build:renderer`。
- `scripts/installer_custom_dir_smoke.py`：验证安装器自定义目录、卸载程序和快捷方式。
- `scripts/installed_desktop_smoke_check.py`：启动安装后的 App，跑桌面 runtime 和重点 UI 用例。
- `scripts/clean_machine_cold_warm_check.py`：用隔离 `LOCALAPPDATA`、`APPDATA`、`TEMP`、`TMP` 模拟干净机器冷/热启动。
- `scripts/verify_kentang_runtime_endpoints.py`：覆盖 kentang/kin 17 个 `/pan` 端点，并在之后回打普通 chart。

## 产物

- 安装器输出到 `desktop_installer_bundle/release/`
- Electron 会把完整运行时打进 `extraResources/app-runtime/`
- 默认安装路径：`%LocalAppData%\Programs\Horosa`
- 安装器支持用户选择安装目录；选择受限目录时可触发 Windows 提权，安装前会校验目录可创建、可写。
- 正常用户不需要额外安装 Python、Java、Node.js、Maven 或前端工具链。

## v2.1.2 Beta 发布口径

v2.1.2 Beta 对齐 Mac 2.1.0 beta 的最新产品面，但 Windows 发布包必须保持自包含。旧的 `Horosa-Web-App-comprehensively-improved-MacOS-main` 同步来源文件夹不应作为安装版、Web 启动或打包依赖。

这一版重点包括：

- 太乙、金口诀、皇极经世、五兆、太玄、荆诀、神易数、Kin Astro、七政四余、奇门等后端接入
- 三式合一中奇门/太乙走 kentang，六壬继续走本地实现
- 管理命盘/事盘保留结构化数据、快照、标签、原始 payload 与 JSON 导入导出
- AI 导出分段读取结构化后端数据
- 设置、窗口尺寸和必要 UI 选项持久化
- 启动控制台、窗口恢复、明暗主题、紫微四化盘、八字细盘滚动与桌面 harness 加固

正式 GitHub Release 的标准资产是：

- `Horosa-Setup-2.1.2.exe`
- `Horosa-Setup-2.1.2.exe.blockmap`
- `latest.yml`
- `SHA256SUMS.txt`

公开下载入口是 `Horosa-Setup-2.1.2.exe`。`latest.yml`、`.blockmap` 与 `SHA256SUMS.txt` 用于更新和校验流程。

当前安装包按用户要求未做 Authenticode 签名。发布前仍需明确告知：这可能触发 Windows SmartScreen 提示，但不代表 Java/Python/接口不匹配。
