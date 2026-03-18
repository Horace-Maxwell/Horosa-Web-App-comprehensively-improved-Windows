# Horosa Windows 自检日志

最后更新：2026-03-17

## 2026-03-17 稳定版收尾与启动链路自检

本轮以“稳定版”为目标，重点完成以下整理与确认：

- 星盘相关下方面板的悬浮释义样式，已统一接入主盘同一套白底悬浮层
- Windows 启动器已改为默认快速启动模式，不再每次都强制扫描源码新鲜度
- Windows 启动器已补充服务复用与状态兜底逻辑
- Windows 启动器已补充 AppCDS 动态归档链路：首次训练、后续自动启用
- 本轮所有交付内容以稳定运行优先，避免引入需要用户额外理解的新入口

### 本轮关键自检结果

已完成并通过：

- `Horosa_Local_Windows.ps1` 语法检查
- 默认启动 smoke（AppCDS 开启）
- `HOROSA_APPCDS=0` 回退 smoke
- `HOROSA_CHECK_SOURCE_FRESHNESS=1` 兼容 smoke
- AppCDS 首次训练生成 archive
- AppCDS 第二次启动自动读取 archive

### 本轮确认无新增问题

未发现以下回归：

- `START_HERE.bat` 无法启动
- 关闭 AppCDS 后启动失败
- 开启源码新鲜度检查后启动失败
- 启动器因为 AppCDS 逻辑导致 Python / Java / 前端服务无法正常起来
- 星盘共享悬浮释义改动导致原有 tooltip 开关失效

### 本轮稳定版关键文件

- `START_HERE.bat`
- `local/Horosa_Local_Windows.ps1`
- `docs/PROJECT_STRUCTURE.md`
- `docs/SELFCHECK_LOG.md`
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/AstroObjectLabel.js`
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/__tests__/AstroObjectLabel.test.js`

### 本轮稳定版运行记录摘要

最近通过的启动日志目录：

- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/.horosa-local-logs-win/20260317_174231`
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/.horosa-local-logs-win/20260317_174305`
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/.horosa-local-logs-win/20260317_174340`

AppCDS 动态归档已成功生成：

- `%LocalAppData%\\Horosa\\runtime-cache\\55f8f8e47f4e\\windows\\appcds\\horosa-appcds-5c564233478ab4d839ce\\astrostudyboot-dynamic.jsa`

### 当前结论

- 这一轮可以作为 Windows 一键启动稳定版基线
- 启动性能已加入低风险优化与 AppCDS 加速，但冷启动主要瓶颈仍在后端初始化本身
- 如需继续压缩启动时间，应在当前稳定版基础上，谨慎推进更激进的 extracted / layered 后端运行方案

## 本轮根目录整理

- 根目录只保留一个给普通用户点击的启动脚本：`START_HERE.bat`
- 已移除根目录重复包装脚本：`START_HERE.ps1`、`Horosa_Local_Windows.*`、`Prepare_Runtime_Windows.*`
- `PROJECT_STRUCTURE.md`、`SELFCHECK_LOG.md`、`给完全不会的人看的启动说明.txt` 已移入 `docs/`
- `WINDOWS_CODEX_DECENNIALS_REPRO_PACKAGE/` 已作为临时复现参考包使用完毕，并在代码、自检、文档同步完成后删除，不再保留在交付根目录

## 这样整理后的目的

- 让普通用户打开根目录时，不会面对一堆不知道该点哪个脚本
- 保留完整说明文档，但把它们收进 `docs/`
- 复现参考资料只在实现阶段使用，完成后不继续占据交付目录

## 本轮检查结果

未发现以下问题：

- 根目录出现多个容易误点的启动脚本
- 说明文档路径失效
- 十年大运功能接线缺失
- AI 导出与 AI 导出设置漏接 `十年大运`
- `START_HERE.bat` 指向错误位置

## 当前交付状态摘要

以下内容已落实并保留：

- 主限法 AstroAPP-Alchabitius / Ptolemy / In Zodiaco 复现链路已接入 Windows 仓库
- `Horosa原方法` 仍保留为独立可切换方法
- AI 导出与主限法方法、度数换算字段已同步
- 本地启动链路已处理多副本端口切换、URL `srv` 参数、本地 backend 推导与 `cache` 规范化问题
- 三式合一页面已按最近调整缩小非核心文字、放宽左侧区域，并校正中宫四课三传的间距
- 十年大运页面、算法、测试、AI 导出和 AI 导出设置已全部接回当前工作区

## 2026-03-08 十年大运复现与自检

- 已按源码快照复现十年大运相关 5 个目标文件，其中新增 `AstroDecennials.js`、`decennials.js`、`decennials.test.js`，并补回 `AstroDirectMain.js`、`aiExport.js` 的接线
- 十年大运页面已确认包含 `起运主星`、`分配次序`、`日限体系`、`时间口径`；`时间口径` 只有 `360天/年（按30天/月换算）` 与 `365.25天/年（按回归年换算）`
- 两种时间口径都以具体日期为主显示；`360天/年` 模式额外显示 `名义：...` 辅助说明；`L4` 已显示到 `HH:MM`
- `AI导出` 与 `AI导出设置` 已同步支持 `推运盘-十年大运`
- 已完成并通过以下检查：`py -3 verification/verify_package.py`、`npm test -- --runInBand src/utils/__tests__/decennials.test.js`、`npm test -- --runInBand`、`npm run build`、`npm run build:file`
- 已按 `02_DETAILED_REPRODUCTION_GUIDE.md`、`03_ALGORITHM_SPEC.md`、`04_UI_AND_AI_EXPORT_SPEC.md`、`05_VERIFICATION_AND_ACCEPTANCE.md`、`06_EXPECTED_OUTPUTS.md` 逐条自检，未发现文档要求未落实的缺口
- 复现完成后确认该参考包不再参与运行、构建或交付，因此已删除 `WINDOWS_CODEX_DECENNIALS_REPRO_PACKAGE/`

## 本轮收尾状态

- 根目录现在更适合直接交给普通用户
- 详细说明仍可在 `docs/` 中找到
- 十年大运功能已并入正式工作区，不再依赖额外复现包
