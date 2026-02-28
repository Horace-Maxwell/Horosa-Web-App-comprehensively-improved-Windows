# Horosa Web 项目目录分类（2026-02-17）

## A. 根目录（仅保留一键部署相关）
以下文件固定在根目录，不再下沉：
- `Horosa_Local.command`
- `Horosa_Local_Windows.bat`
- `Horosa_Local_Windows.ps1`
- `Prepare_Runtime_Mac.command`
- `Prepare_Runtime_Windows.bat`
- `Prepare_Runtime_Windows.ps1`

## B. 主工程（运行代码）
- `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/`
: 唯一运行中的业务工程（UI + Java API + Python 算法服务）。

### B1. 前端
- `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/`
: 所有技术页 UI（星盘/遁甲/太乙/六壬/易卦/风水入口）。
- `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/models/`
: 状态管理、命盘/事盘本地存储读写逻辑。
- `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/utils/`
: AI 导出、请求层、离线本地缓存工具。

### B2. 后端
- `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudysrv/`
: Java 后端服务（9999）。
- `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astropy/`
: Python 图表服务（8899）。

## C. 运行时（部署辅助）
- `runtime/windows/bundle/`
: Windows 启动回填目录（`dist-file` / `wheels` / `astrostudyboot.jar` / URL 模板 / `runtime.manifest.json`）。
- `runtime/windows/maven/`
: 可选，Windows 缺少系统 Maven 时用于后端 jar 本地构建。

### C1. 弱网兜底 URL 列表（可选）
- `runtime/windows/bundle/java17.url.txt`
- `runtime/windows/bundle/python311.url.txt`
- `runtime/windows/bundle/astrostudyboot.url.txt`
: 每行一个 URL，启动器按顺序重试，首个成功即使用。

### C2. 验包清单
- `runtime/windows/bundle/runtime.manifest.json`
: 记录关键分发资产的路径、大小、SHA256、生成时间，用于部署前后快速核验。

## D. 快速检索建议
- 改主站功能：`Horosa-Web-55.../astrostudyui/src/`
- 改本地部署：根目录脚本 + `runtime/`
- 看离线运行日志：`Horosa-Web-55.../.horosa-local-logs-win/`

## E. 同步状态（2026-02-23）
- `统摄法` 已并入主工程：`Horosa-Web-55.../astrostudyui/src/components/tongshefa/`
- `易与三式` 已包含 `统摄法` 子页（位于 `太乙` 下方）。
- AI 导出与本地案例映射均已包含 `tongshefa`。
- 已修复“保存命盘读取后当前页不刷新”链路：
  - `astrostudyui/src/models/astro.js`（`fetchByChartData` 深拷贝字段）
  - `astrostudyui/src/components/ziwei/ZiWeiMain.js`（三合盘字段变更自动重算）
  - `astrostudyui/src/components/sanshi/SanShiUnitedMain.js`（三式合一外部命盘切换检测与刷新）
- 参考目录 `Horosa-Web+App (Mac)/` 已删除，当前运行仅依赖本目录现存文件与 `runtime/`。
- 仅 Git 工作树不保证可运行；发布包必须包含 `runtime/` 与 `runtime/windows/bundle/` 关键资产。

## F. 同步状态（2026-02-27）
- 三式合一六壬参考文本已独立为常量文件：
  - `Horosa-Web-55.../astrostudyui/src/constants/LiuRengReferenceTexts.js`
  - 覆盖 `9.神 / 10.将 / 11.释课元微 / 12.大格 / 13.小局` 的文档段，用于右侧二级标签与 AI 快照分段。
- 三式合一右侧结构已统一为一级：
  - `概览 / 太乙 / 神煞 / 六壬 / 八宫`
  - 六壬下含二级：`概览 / 大格 / 小局 / 参考`
- 六壬圈节点释义已统一在：
  - `Horosa-Web-55.../astrostudyui/src/constants/LiuRengTexts.js`（十二神/十二将）
  - `Horosa-Web-55.../astrostudyui/src/components/sanshi/SanShiUnitedMain.js`（tooltip 渲染）
- 遁甲状态释义常量位于：
  - `Horosa-Web-55.../astrostudyui/src/constants/QimenPatternTexts.js`
  - 同时被 `DunJiaMain.js` 与 `DunJiaCalc.js` 调用，保证 UI 与 AI 导出一致。
- 占星悬浮释义常量位于：
  - `Horosa-Web-55.../astrostudyui/src/constants/AstroInterpretation.js`
  - `ASTRO_ANNOTATION_SIGNS` 已包含 12 星座“本垣/擢升/入落/入陷”信息，供悬浮与导出共用。
- 本地常驻启动脚本链路（Mac 脚本）：
  - `Horosa-Web-55.../horosa_local.command`
  - `Horosa-Web-55.../start_horosa_local.sh`
  - `Horosa-Web-55.../stop_horosa_local.sh`
  - 新增 `.horosa_web.pid` 管理 8000 web 服务，与 8899/9999 同步启停；默认常驻，`HOROSA_KEEP_SERVICES_RUNNING=0` 可切回旧行为。
  - `start_horosa_local.sh` 端口就绪探测已兼容 `lsof + netstat`，适配 Windows + Git Bash 场景。

## G. 同步状态（2026-02-27 二次回归）
- 占星悬浮：
  - `astrostudyui/src/components/astro/AstroChartCircle.js` 改为按段落逐行渲染注释（支持多级标题/空行），解决“整段糊成一行”与可读性下降。
  - `astrostudyui/src/constants/AstroInterpretation.js` 替换为文档 H 的完整长文本（星/星座/宫位/希腊点），并保留星座入庙/擢升/入落/入陷。
- 六壬独立页：
  - `astrostudyui/src/components/graph/D3Circle.js` 支持分段 tooltip 注入。
  - `astrostudyui/src/components/liureng/LRCircleChart.js` 对上神/天将圈接入“标题+诗句+释义+类象”悬浮。
  - `astrostudyui/src/components/lrzhan/RengChart.js` 去除 runyear 硬依赖，行年缺失不再导致下方神煞块整体消失。
- 遁甲与三式历法兜底：
  - `astrostudyui/src/components/dunjia/DunJiaMain.js`、`astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - 精确历法不可用时，回退 `localNongliAdapter` 与本地节气种子，降低“无法起盘”风险。
- 遁甲判断层：
  - `astrostudyui/src/components/dunjia/DunJiaCalc.js` 新增每宫判断数据（十干克应/八门克应/奇仪主应/吉格/凶格）与全盘吉凶格汇总。
  - `astrostudyui/src/components/dunjia/DunJiaMain.js` 右侧“格局”页支持按宫位查看；九宫卡片新增悬浮明细与点击聚焦。
- 三式合一八宫：
  - `astrostudyui/src/components/sanshi/SanShiUnitedMain.js` 八宫页改为按宫位聚焦显示，不再一次性平铺所有宫信息；并同步展示遁甲判断行。

## H. 同步状态（2026-02-27 三次回归）
- 占星悬浮分离（星/座/宫互不串段）：
  - `astrostudyui/src/components/astro/AstroChartCircle.js`
  - 新增 `annotationMode`（`planet/sign/house`）通道，星座环与宫位环分别独立显示对应释义；行星 hover 不再混入星座/宫位释义。
- 遁甲克应映射补全与占位文案清零：
  - `astrostudyui/src/components/dunjia/DunJiaCalc.js`
  - `TEN_GAN_RESPONSE_MAP` 扩展到 81 组；门克应/奇仪主应映射补全；删除“暂未录入详细释义”返回路径。
- 遁甲左右职责分离：
  - `astrostudyui/src/components/dunjia/DunJiaMain.js`
  - 左盘九宫仅负责盘面显示与选宫，不再出现克应/格局 tooltip；详细判断统一在右侧“格局”标签。
- 六壬格局判定模块化：
  - `astrostudyui/src/components/liureng/LRPatternJudge.js`（新增）
  - 输出 `dageHits/xiaojuHits`，供三式合一右侧与六壬 AI 快照共用。
- 三式合一六壬二级页改造：
  - `astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - “大格/小局”页改为仅显示算法命中；全文保留在“参考”页。
- 六壬独立快照同步：
  - `astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - 快照增加 `[大格命中]` 与 `[小局命中]`。

## I. 同步状态（2026-02-27 四次回归）
- 六壬独立页格局展示补齐：
  - `astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - 右侧新增“格局判断”区块，显示 `大格命中 / 小局命中`，并与 `LRPatternJudge` 算法结果保持一致（仅显示命中项）。
- 风水 AI 导出快照链路补齐：
  - `astrostudyui/public/fengshui/app.js`
  - `astrostudyui/src/components/fengshui/FengShuiMain.js`
  - 内嵌风水页面基于内部判定对象构建结构化快照（`起盘信息 / 标记判定 / 冲突清单 / 建议汇总 / 纳气建议`），通过 `postMessage` 同步至主应用并保存为 `moduleAiSnapshot('fengshui')`。
- 星盘弹窗控件一致性补齐：
  - `astrostudyui/src/components/comp/ChartFormData.js`
  - `主/界限法显示界限法` 与 `仅按照本垣擢升计算互容接纳` 改为复选框，避免与 `ChartDisplaySelector` 出现下拉/复选框混用。

## J. 同步状态（2026-02-27 五次回归 + 2026-02-28 审计复核）
- 三式合一逐元素悬浮已按对象分离（不串段）：
  - `astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - 外圈独立绑定 `宫位标签 / 星座标签 / 星体条目` tooltip；遁甲九宫独立绑定 `天盘干 / 八神 / 地盘干 / 九星 / 八门` tooltip。
- 三式合一交互层遮挡已修复：
  - `astrostudyui/src/components/sanshi/SanShiUnitedMain.less`
  - `outerCell`/`qmBlock` 可交互、`qmRingCell` 不拦截指针；tooltip 文本启用 `white-space: pre-wrap`，保留多行释义。
- 三式合一六壬格局回填链路已补齐：
  - `astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - 新增 `/liureng/gods` 拉取 + 缓存 + 并发去重 + 签名防过期；回填后重算 `evaluateLiuRengPatterns`，右侧 `大格/小局` 保持“只显示命中”。
- 三式合一起盘入口一致性：
  - `astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - “确定”按钮与“起盘”按钮共用 `clickPlot`，保证行为一致。
- 文档逐行审计产物：
  - `CODEX_ALL_USED_TEXTS_AND_FILES_20260227.md`
  - `DOC_LINE_AUDIT_20260227.txt`（逐行 tag 审计）
  - `DOC_DIRECTIVES_20260227.txt`（提取 330 条 DIRECTIVE 作为逐条对照清单）

## K. 审计状态（2026-02-28 再次复核）
- 文档100遍复核证据：
  - `DOC_100PASS_VERIFY_20260228.txt`
  - 固定结果：`lines=4726`, `chars=126366`, `sha256=DE982CF42C0303F8A9D20E14212F2E8D7CDC90C0CD31D5035DB8D9CA9A98CE48`。
- 逐行语义拆解文件：
  - `DOC_LINE_MEANING_20260227.txt`
  - 每行结构：`lineNo / tag / intent / sourceText`，总行数 4726，与源文档逐行对齐。
- 审计汇总文件：
  - `DOC_AUDIT_SUMMARY_20260228.txt`
  - 汇总项：文档哈希、行数、字符数、`DOC_LINE_AUDIT_20260227.txt` 行数、`DOC_LINE_MEANING_20260227.txt` 行数、DIRECTIVE 总数（330）。

## L. 同步状态（2026-02-28 晚间修正）
- 三式合一六壬二级结构已恢复为：
  - `大格 / 小局 / 参考 / 概览`
  - 对应文件：`Horosa-Web-55.../astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - AI 快照同步包含：`【六壬-参考】`（基于命中项生成，不做全文平铺）。
- 遁甲左盘冗余块已移除：
  - 删除左盘底部固定状态标签（击刑/入墓/门迫/空亡/驿马），保持左盘聚焦盘面。
  - 对应文件：`Horosa-Web-55.../astrostudyui/src/components/dunjia/DunJiaMain.js`
- 全局请求兜底已加强：
  - `request()` 异常时返回结构化结果对象，防止调用侧读取 `Result` 时崩溃。
  - 对应文件：`Horosa-Web-55.../astrostudyui/src/utils/request.js`
- 最新自检报告：
  - `SELF_CHECK_REPORTS/ROUND11_20260227_204931_*`
  - `SELF_CHECK_REPORTS/ROUND12_20260227_205740_*`
  - `SELF_CHECK_REPORTS/ROUND13_20260227_210528_*`
  - `SELF_CHECK_REPORTS/ROUND14_20260227_211434_*`
  - `SELF_CHECK_REPORTS/ROUND15_20260227_212816_*`
  - 说明：Round14 在高压随机点击下 `pageErrorCount` 已明显下降（`1`），主要剩余失败为不可见控件点击与外部资源请求失败（地图/3D资产网络）。
- 希腊星术字段空窗保护：
  - `Horosa-Web-55.../astrostudyui/src/components/hellenastro/AstroChart13.js`
  - `fieldsToParams`/`requestChart`/`componentDidMount` 已加空值守卫，避免 `fields.date` 空引用。
  - Round15 复测 `pageErrorCount=0`。

## L. 稳定性修复（2026-02-28）
- 打开即卡死（六壬/遁甲/三式合一）修复：
  - `astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `astrostudyui/src/components/dunjia/DunJiaMain.js`
- 核心策略：
  - 将“读取保存案例后恢复选项”的链路改为差异化更新（只在值变化时 `setState`/同步字段/触发重算）。
  - 避免 `currentCase.updateTime` 变化导致的重复恢复与更新风暴。
- 结果：
  - 三式合一与遁甲在页面打开阶段不再进行无意义重复重算。
  - 构建与测试通过（`npm run build:file`、`npm test -- --watch=false`）。

## M. 性能优化（2026-02-28）
- 遁甲起盘 1 秒内快显（保持最终精度）：
  - `astrostudyui/src/components/dunjia/DunJiaMain.js`
- 机制：
  - 起盘链路改为“两阶段”：
  - 快速阶段：`650ms` 内优先命中精确缓存；未命中则先用本地历法/节气种子生成首屏盘面。
  - 精确阶段：后台等待精确农历与精确节气种子，返回后自动重算并覆盖为精确盘面。
  - `calcDunJia` 算法与参数口径不变，最终结果不降精度。

## N. 遁甲 UI 精简（2026-02-28）
- `astrostudyui/src/components/dunjia/DunJiaMain.js`
- 左盘底部冗余长文案已移除：
  - `六仪击刑 / 三奇入墓 / 门迫 / 空亡 / 驿马` 的固定解释不再在左侧重复展示。
- 说明位置统一：
  - 详细释义保留在右侧面板（格局/状态），左盘仅保留必要图例与盘面信息。

## O. 遁甲格局页结构调整（2026-02-28）
- `astrostudyui/src/components/dunjia/DunJiaMain.js`
- 右侧 `格局` 标签页已改为“仅八宫逐宫查看”：
  - 删除顶部全局汇总块（`六仪击刑/奇仪入墓/门迫/空亡宫/驿马` 与全局 `吉格/凶格`）。
  - 仅保留八宫按钮与当前宫详情区，按宫位查看对应判断内容。

## P. 六壬命中式展示（2026-02-28）
- `astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- 三式合一中的六壬展示已收口为“纯命中输出”：
  - 移除 `参考` 全文页，不再整段平铺条文。
  - `概览` 仅显示四课/三传本盘结果，不再附带全文说明。
  - `大格/小局` 保持算法命中项展示，取消“去参考页查全文”的引导。
- 三式合一 AI 快照同步改为命中式：
  - 删除 `六壬-参考` 段与概览中的全文扩展，保留可计算结果与命中条目。

## Q. 三式合一八宫信息域收口（2026-02-28）
- `astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- `八宫` 页显示范围调整为“仅遁甲”：
  - 每宫仅保留遁甲判断信息（十干克应/八门克应/奇仪主应/吉凶格及宫内干神星门）。
  - 移除六壬与星盘附加行，避免在八宫区混入遁甲之外内容。

## R. 三式合一八宫快照口径统一（2026-02-28）
- `astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- AI 快照中的八宫段已与 UI 一致：
  - 删除八宫段的“六壬/星盘”扩展行。
  - 八宫快照仅保留遁甲字段与遁甲判断。

## S. 三轮全量自检脚本与报告（2026-02-28）
- 新增自检脚本：
  - `button_self_check_playwright.js`
    - Headless 浏览器按钮级巡检，自动切换标签并点击可见按钮。
    - 输出：`mainTabsAttempted/mainTabsMissing/controlsClickedTotal/controlsFailedTotal/consoleErrorCount/pageErrorCount/requestFailureCount`。
  - `run_self_check_round.ps1`
    - 每轮固定执行：
      - `Horosa_Local_Windows.ps1` 无浏览器冒烟启动；
      - `button_self_check_playwright.js` 按钮级自动检查；
      - `npm run build:file`；
      - `npm test -- --watch=false`；
      - `rg` 源码按钮扫描（`<Button|<button|role="button"|onClick=`）。
- 自检报告目录：
  - `SELF_CHECK_REPORTS/`
  - 重点轮次：`ROUND2_20260227_175222_*`、`ROUND3_20260227_180314_*`、`ROUND4_20260227_181433_*`
  - 每轮产物：
    - `*_summary.json`（汇总）
    - `*_launcher.out.log` / `*_launcher.err.log`（启动器日志）
    - `*_button.report.json` / `*_button.out.log`（按钮巡检）
    - `*_build.log`（构建）
    - `*_test.log`（单测）
    - `*_source_button_scan.log`（源码按钮匹配）

## T. 右侧面板美化（2026-02-28）
- 六壬右侧（`LiuRengMain`）：
  - `astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `astrostudyui/src/components/lrzhan/LiuRengMain.less`（新增）
  - “格局判断”从普通文本改为命中条目卡片化展示（含大格/小局计数标签）。
- 遁甲右侧（`DunJiaMain`）：
  - `astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `astrostudyui/src/components/dunjia/DunJiaMain.less`（新增）
  - 概览/格局/神煞/历法统一为键值卡片排版，宫位格局加入标签化吉凶格。
- 三式合一右侧（`SanShiUnitedMain`）：
  - `astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `astrostudyui/src/components/sanshi/SanShiUnitedMain.less`
  - 概览、太乙、神煞、六壬命中、八宫判断统一为同风格卡片布局，提升阅读层级与扫读效率。

## U. 右侧面板美化第二版（2026-02-28）
- 六壬右侧二次增强：
  - `astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `astrostudyui/src/components/lrzhan/LiuRengMain.less`
  - 增加“命中概况”胶囊统计（大格/小局），并用条目侧边色区分大格与小局。
- 遁甲右侧二次增强：
  - `astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `astrostudyui/src/components/dunjia/DunJiaMain.less`
  - 概览/格局加入统计胶囊（吉格、凶格、神煞、当前宫命中），Tabs 视觉改为胶囊式导航。
- 三式合一右侧二次增强：
  - `astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `astrostudyui/src/components/sanshi/SanShiUnitedMain.less`
  - 概览、神煞、六壬、八宫增加统计胶囊；命中条目、八宫卡片增加强调边与 hover 层次。
- 共同约束：
  - 仅展示层迭代，不改变算法结果、命中逻辑和原始字段语义。

## V. 文档一致性再次确认快照（2026-02-28）
- 新增确认文件：
  - `DOC_AUDIT_SUMMARY_20260228_RUN4.txt`
- 快照内容：
  - 文档完整性：`sha256=DE982CF42C0303F8A9D20E14212F2E8D7CDC90C0CD31D5035DB8D9CA9A98CE48`、`lines=4726`、`chars=126366`。
  - 逐行审计计数：`line_audit_rows=4726`、`line_meaning_rows=4726`、`directive_rows=330`。
  - 关键功能抽查：
    - 三式合一一级标签结构仍在（概览/太乙/神煞/六壬/八宫）。
    - 三式合一“起盘/确定”仍同链路（`clickPlot`）。
    - 遁甲格局“按宫位查看判断”仍在。
    - 未检出“暂未录入详细释义”占位文案。
  - 最新构建与单测再次通过。

## W. 晚间稳定性补丁（2026-02-28）
- `astrostudyui/src/components/astro3d/Astro3D.js`
  - 新增 `getChartDom` / `appendToChartDom`，统一并保护 3D 页面 DOM 挂载。
  - GUI、Stats、Renderer、行星提示层的 `appendChild` 改为安全挂载，避免 tab 快切空容器报错。
- `astrostudyui/src/components/guolao/GuoLaoChartMain.js`
  - `chart` 初始化改为带 `chartObj.chart` 判空，避免 `chart.aspects` 写入 `undefined`。
- `astrostudyui/src/components/suzhan/SuZhanMain.js`
  - 同步 `chartObj.chart` 判空防护，保证苏战链路与国老链路一致。

## X. 最新回归产物（2026-02-28）
- 新增轮次报告：
  - `SELF_CHECK_REPORTS/ROUND19_20260227_220500_*`
  - `SELF_CHECK_REPORTS/ROUND20_20260227_221246_*`
  - `SELF_CHECK_REPORTS/ROUND21_20260227_222031_*`
  - `SELF_CHECK_REPORTS/ROUND22_20260227_222945_*`
  - `SELF_CHECK_REPORTS/ROUND23_20260227_224538_*`
- 结果概要：
  - Round19/20/22/23：`pageErrorCount=0`
  - Round21：捕获 `Cannot set properties of undefined (setting 'aspects')`，已由 W 节补丁修复。
  - 仍存在外部资源请求失败与不可见控件点击失败噪声，不影响本地核心起盘与导出链路。

## Y. 启停与补充扫描（2026-02-28）
- 原生脚本链路复验：
  - `start_horosa_local.sh`（使用 `runtime/windows/python/python.exe` + `runtime/windows/java/bin/java.exe`）
  - `stop_horosa_local.sh`
  - 结果：三端口 `8000/8899/9999` 可启动并保持监听；停服后端口全关闭，`.horosa_*.pid` 清理完成。
- 补充报告：
  - `SELF_CHECK_REPORTS/FULLSCAN_20260227_2257_button.report.json`
  - 覆盖到了 `量化盘/节气盘/七政四余/希腊星术/印度律盘/易与三式/万年历/风水` 等主标签点击巡检，`pageErrorCount=0`。
  - `SELF_CHECK_REPORTS/TARGET_MAIN_TABS_FULL_20260227_2302.json`
  - `SELF_CHECK_REPORTS/TARGET_REQUIRED_MODULES_20260227_2303.json`
  - `SELF_CHECK_REPORTS/TARGET_LR_DJ_20260227_2304.json`
  - `SELF_CHECK_REPORTS/TARGET_REQUIRED_MODULES_20260227_2305.json`
  - 用于补齐“16个一级标签全点击”与“点名技术页面定向起盘/导出点击”证据链。
