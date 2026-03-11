# Horosa Windows 自检日志

最后更新：2026-03-11

## 2026-03-11 Windows 发布链与快检收敛

- Windows Release 已改为更接近 Mac 的小安装包方案：主安装包保留安装器与必要文件，首次安装时再自动下载较大的 Windows runtime 资产
- 已移除仓库中反复消耗 Git LFS 流量的 `wheelhouse/*.whl` 与 `astrostudyboot.jar` 跟踪方式，改为构建期自动准备
- 金口诀月将已改为优先使用大六壬月将来源，将神规则已核对为“月将加时，再取地盘中地分所在宫之上的地支”
- 推运盘主限法盘链路已重新验证，后端接口、前端渲染落点与定向测试已补齐
- 星盘组件中“显示星/宫/座/相释义”开关已修复，现已能正确影响页面显示
- `DateTime` 时区字符串增加了防呆兜底，避免冷启动或边界数据下因 `zone` 为空导致页面初始化异常
- 已新增 Windows `2 分钟内` 快速自检入口：`selfcheck/run_windows_2min_selfcheck.ps1`

## 2026-03-11 最新快速自检结果

- 本地执行：`powershell -ExecutionPolicy Bypass -File .\selfcheck\run_windows_2min_selfcheck.ps1`
- 实测总耗时：`34.51s`
- 顶部关键项检查通过：
  - `批注`
  - `星盘组件`
  - `AI导出`
  - `管理 -> 新增命盘`
- 左侧 `16` 个主技法入口切换通过
- 本轮快检无失败项、无页面级异常、无控制台错误

## 2026-03-11 本轮功能修复摘要

- 修复金口诀月将/将神取法
- 修复主限法盘显示链路与回归测试
- 修复星盘组件释义开关不生效
- 修复冷启动时区空值导致的前端初始化异常
- 保留完整深度自检脚本，同时新增更适合发版前使用的快检脚本

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
