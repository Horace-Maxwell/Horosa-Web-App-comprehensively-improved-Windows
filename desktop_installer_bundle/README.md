# Horosa Windows Desktop Bundle

这个目录承载 Horosa v2.6.6 Beta Windows 桌面应用工程。

- 当前发布版本：`2.6.6 Beta`（安装器版本号为 `2.6.6`）
- 发布定位：Mac 端 v2.6.6 产品面同步（排盘计算修正批 + 主限法大升级 宿命点应星/年数 3000/`_wireRev` v12 + 修 Windows #23 Gemini 400 / #24+#25 聊天发送 `[object Object]` + 全 UI 扫雷）+ **Windows 壳层加固 9 项**（界面缩放持久化 / AI 资料导入抗损 / 导出加固 / 重启串行化 / 修复顺序加固 / 计时器清理 / winget 真实日期 / 自检堵漏）。后端 Java 改动（`AIAnalysisProxyService` Gemini 参数修正 + 4 控制器 `_wireRev` v12）→ 已重建 `astrostudyboot.jar`（324,254,540 B）；v2.6.5 之前所有功能全部保留
- 用户入口：`release/Horosa-Setup-2.6.6.exe`
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

## v2.6.6 Beta 发布口径

v2.6.6 Beta 对齐 Mac 端 `dbac0ed→47f59a4`（重写史等效基线，旧 `dbac0ed` = 新 `f401bfe`）产品面（**排盘计算修正批**：度分串解析改标准 `deg+min/60` + 均时差表 3 区修正 + 「±HH:MM」半小时时区 + 日返寻根顺行弧 + 返照/合盘相位/映点归一化 [0,180] + 组合中点短弧 + 围攻 orb 隔离 + 时主星 floor + 反平行首伙伴漏加修复；**主限法大升级**：显示窗 pre-norm 精确化 + 宿命点 Vertex 应星闭式 + 每盘时间钥匙 + 太阳弧钥匙正逆函数 + 年数上限 1000→3000 多圈复发 + golden 校准语料 v266；**修 Windows #23**：`buildGeminiBody()` 采样参数移入 `generationConfig`；**修 Windows #24/#25**：聊天发送按钮 `onClick={handleSend}` 事件对象串化 `[object Object]`，按钮改箭头函数 + `overrideText` 只认字符串；**聊天高级参数真正生效**：`isOpenAiFamily()` 修判定永假 + 思考档覆盖 gpt-5.5/6/7、o6/o7；**全 UI 扫雷**：AI 挂载 C 类临时写入用毕还原 + 白屏防护 + 暗色可读性 + 列表 key 稳定化 + 一批渲染修复）+ **Windows 壳层加固 9 项（本仓独有）**：界面缩放持久化（只写不读 → 启动恢复）/ AI 资料导入跳过不可读·超大文件 / 诊断·备份导出加固 / 「重启后端」串行化 / 修复先失效缓存再删树 / 退出清理计时器 / winget 真实日期 / 自检对过期 SHA256SUMS 响亮 FAIL。后端 Java 改动（`AIAnalysisProxyService` Gemini 修正 + `PredictiveController`/`IndiaChartController`/astrostudycn `ChartController`/`QueryChartController` `_wireRev` v12）→ **已重建 `astrostudyboot.jar`（324,254,540 B）**。v2.6.5（合盘交互链重建 + 起课时间 13 技法）/ v2.6.4（恒星黄道 47 岁差全栈 + AI 四同步 + AI 报告 v1 + 启动健壮性 + #21）/ v2.6.3 / v2.6.2（#18 升级安装修复）/ v2.6.1 前所有功能全部保留。Windows 发布包必须保持自包含。

这一版重点包括：

- 太乙、金口诀、皇极经世、五兆、太玄、荆诀、神易数、Kin Astro、七政四余、奇门等后端接入
- 三式合一中奇门/太乙走 kentang，六壬继续走本地实现
- 管理命盘/事盘保留结构化数据、快照、标签、原始 payload 与 JSON 导入导出
- AI 导出分段读取结构化后端数据
- 设置、窗口尺寸和必要 UI 选项持久化
- 启动控制台、窗口恢复、明暗主题、紫微四化盘、八字细盘滚动与桌面 harness 加固

正式 GitHub Release 的标准资产是：

- `Horosa-Setup-2.6.6.exe`
- `Horosa-Setup-2.6.6.exe.blockmap`
- `latest.yml`
- `SHA256SUMS.txt`

公开下载入口是 `Horosa-Setup-2.6.6.exe`。`latest.yml`、`.blockmap` 与 `SHA256SUMS.txt` 用于更新和校验流程。

当前安装包按用户要求未做 Authenticode 签名。发布前仍需明确告知：这可能触发 Windows SmartScreen 提示，但不代表 Java/Python/接口不匹配。
