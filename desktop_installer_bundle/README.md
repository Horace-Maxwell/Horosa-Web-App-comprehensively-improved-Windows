# Horosa Windows Desktop Bundle

这个目录承载 Horosa v2.6.4 Beta Windows 桌面应用工程。

- 当前发布版本：`2.6.4 Beta`（安装器版本号为 `2.6.4`）
- 发布定位：Mac 端 v2.6.4 产品面同步（恒星黄道 47 岁差全栈 + 西洋月宿 + 印占补齐 + AI 四同步双盘双配置 + AI 报告生成 v1 + 启动健壮性大批加固）。后端 Java 改动（8 个控制器 `getParams()` 全栈透传 `siderealAyanamsa`）→ 已重建 `astrostudyboot.jar`；命盘计算默认行为与 v2.6.3 字节级一致；v2.6.3 之前所有功能全部保留。修复 Windows issue #21「点击排盘提示『本地排盘服务未就绪』，无处查看状态、自检修复失效」
- 用户入口：`release/Horosa-Setup-2.6.4.exe`
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

## v2.6.4 Beta 发布口径

v2.6.4 Beta 对齐 Mac 端 `15df8e3→15a21bb` 产品面（恒星黄道全栈：西洋盘「黄道」从 回归/恒星 二元扩为 **回归 + 47 ayanāṃśa** [复用印占注册表，每制经 Swiss Ephemeris 真实位移] 覆盖全西洋技法盘 + 西洋盘月宿(Nakshatra) + 印占岁差 6→47 / 分宫 4→24 + 印占左栏下拉遮挡修复 + AI 四同步双盘双配置 [`AI_EXPORT_SETTINGS_VERSION` 23→24 自动迁移] + AI 报告生成 v1 [6 模板 + 9 流派 + 分节流式 + 嵌图 + 4 导出] + 启动健壮性加固 [常驻健康灯 + 富错误 Modal + 透明重试 12s→30s + StartupGate 分阶段]），后端 Java（8 个控制器 `getParams()` 全栈透传 `siderealAyanamsa`：astrostudycn 的 `ChartController` / `QueryChartController` / `JieQiController` / `PlanetariumController` + astrostudy 的 `GermanyTechController` / `ModernChartController` / `AstroExtraController` / `PredictiveController`）→ 已重建 `astrostudyboot.jar`（324,254,239B）。命盘计算默认行为与 v2.6.3 字节级一致；v2.6.3 / v2.6.2（#18 升级安装修复）/ v2.6.1 前所有功能全部保留；并**修复 Windows issue #21**「点击排盘提示『本地排盘服务未就绪』，无处查看状态、自检修复失效」。Windows 发布包必须保持自包含。

这一版重点包括：

- 太乙、金口诀、皇极经世、五兆、太玄、荆诀、神易数、Kin Astro、七政四余、奇门等后端接入
- 三式合一中奇门/太乙走 kentang，六壬继续走本地实现
- 管理命盘/事盘保留结构化数据、快照、标签、原始 payload 与 JSON 导入导出
- AI 导出分段读取结构化后端数据
- 设置、窗口尺寸和必要 UI 选项持久化
- 启动控制台、窗口恢复、明暗主题、紫微四化盘、八字细盘滚动与桌面 harness 加固

正式 GitHub Release 的标准资产是：

- `Horosa-Setup-2.6.4.exe`
- `Horosa-Setup-2.6.4.exe.blockmap`
- `latest.yml`
- `SHA256SUMS.txt`

公开下载入口是 `Horosa-Setup-2.6.4.exe`。`latest.yml`、`.blockmap` 与 `SHA256SUMS.txt` 用于更新和校验流程。

当前安装包按用户要求未做 Authenticode 签名。发布前仍需明确告知：这可能触发 Windows SmartScreen 提示，但不代表 Java/Python/接口不匹配。
