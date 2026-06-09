# Horosa Windows Desktop Bundle

这个目录承载 Horosa v2.6.5 Beta Windows 桌面应用工程。

- 当前发布版本：`2.6.5 Beta`（安装器版本号为 `2.6.5`）
- 发布定位：Mac 端 v2.6.5 产品面同步（合盘交互链全面重建 5 子盘全可用 + AI「起课时间」挂载 8→13 技法 + Python 数值经纬度容错 + 导航搜索关键词 + 关于框真图标）。**本版无后端 Java 改动 / 无需重建 jar**（合盘端点恢复 = 前端把请求路由回 Java modern-chart 后端 `:9999`，`ModernChartController` v2.6.4 已在）；命盘计算默认行为与 v2.6.4 字节级一致；v2.6.4（恒星黄道 47 岁差全栈 + AI 四同步 + AI 报告 v1 + 启动健壮性 + #21）/ v2.6.3 之前所有功能全部保留
- 用户入口：`release/Horosa-Setup-2.6.5.exe`
- 图标资产：`assets/horosa_setup.ico` 与 `assets/horosa_setup_badge.png`

## 目录职责

- `electron/`：Electron 主进程、预加载脚本、窗口管理、Python/Java/Web 服务编排、运行时健康检查、启动控制台与本地日志。
- `scripts/`：renderer 构建、runtime staging、项目路径解析、版本资产整理、安装器校验和干净机器冷/热启动检查。
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

## v2.6.5 Beta 发布口径

v2.6.5 Beta 对齐 Mac 端 `15a21bb→dbac0ed` 产品面（合盘 / 关系盘交互链全面重建：五子盘 合盘 Synastry / 组合中点 Composite / Marks / 时空盘 Time-Space / 关系评分 全部恢复可用 [请求路由回 Java modern-chart 后端 `:9999` + ResizeObserver 实测高度 + `chartStyle/dispatch/onChange` 全透传 + change 直写 fields + `paramsToFields` 不再覆盖宫制/黄道 + 黄道 Select 局部 CSS 定宽 50/50] + AI「起课时间」挂载 8→13 技法 [太玄/荆诀/五兆/神易数各补 `buildXxxSnapshotForFields` + 技法注册表两份同步 13 项 + 4 法升 `kind:'payload'`] + Python 排盘数值经纬度容错 [`helper.py` `convertLonStrToDegree/convertLatStrToDegree` + `realsuntime.py` `getBaseLonByZone` 接受地图选点浮点经纬度/时区] + 全 22 模块导航搜索 keywords + 关于框真 `appicon.png` 图标 + 波斯向运应期年数联动表格 + 一批小修）。**本版无后端 Java 改动 / 无需重建 jar**（合盘端点恢复是前端改路由，`ModernChartController` v2.6.4 已在；沿用 v2.6.4 的 `astrostudyboot.jar` 324,254,239B，selfcheck 已核 jar 标记 + 内容不变）。命盘计算默认行为与 v2.6.4 字节级一致；v2.6.4（恒星黄道 47 岁差全栈 + AI 四同步 + AI 报告 v1 + 启动健壮性 + #21）/ v2.6.3 / v2.6.2（#18 升级安装修复）/ v2.6.1 前所有功能全部保留。Windows 发布包必须保持自包含。

这一版重点包括：

- 太乙、金口诀、皇极经世、五兆、太玄、荆诀、神易数、Kin Astro、七政四余、奇门等后端接入
- 三式合一中奇门/太乙走 kentang，六壬继续走本地实现
- 管理命盘/事盘保留结构化数据、快照、标签、原始 payload 与 JSON 导入导出
- AI 导出分段读取结构化后端数据
- 设置、窗口尺寸和必要 UI 选项持久化
- 启动控制台、窗口恢复、明暗主题、紫微四化盘、八字细盘滚动与桌面 harness 加固

正式 GitHub Release 的标准资产是：

- `Horosa-Setup-2.6.5.exe`
- `Horosa-Setup-2.6.5.exe.blockmap`
- `latest.yml`
- `SHA256SUMS.txt`

公开下载入口是 `Horosa-Setup-2.6.5.exe`。`latest.yml`、`.blockmap` 与 `SHA256SUMS.txt` 用于更新和校验流程。

当前安装包按用户要求未做 Authenticode 签名。发布前仍需明确告知：这可能触发 Windows SmartScreen 提示，但不代表 Java/Python/接口不匹配。
