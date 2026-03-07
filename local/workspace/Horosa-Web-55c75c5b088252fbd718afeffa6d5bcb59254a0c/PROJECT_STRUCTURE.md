# Horosa Web 项目结构（GitHub 上传版）

更新时间：2026-03-06

## 1) 根目录（入口）

- `Horosa_OneClick_Mac.command`：Mac 一键部署+启动主入口
- `Horosa_Local.command`：已安装依赖后的快速启动入口（含 `/static/umi.*` 白屏兼容补丁）
- `Horosa_SelfCheck_Mac.command`：Mac 本地一键自检入口（启动服务、验收主限法链路、自动停服务）
- `Horosa_Local_Windows.bat` / `Horosa_Local_Windows.ps1`：Windows 启动入口
- `Prepare_Runtime_Mac.command` / `Prepare_Runtime_Windows.*`：离线 runtime 打包脚本
- `README.md`：部署和上传说明
- `PROJECT_STRUCTURE.md`：目录结构说明（本文件）
- `WINDOWS_CODEX_ASTROAPP_PD_REPRO_KIT/`：给 Windows 上 Codex 使用的 AstroAPP 主限法复现包（含详细复现文档、关键代码快照、模型文件、验证脚本、结果摘要、SHA256 校验）
- `ASTROAPP_ALCHABITIUS_PTOLEMY_REVERSE_ENGINEERING_FULL_PROCESS.md`：AstroApp `Alchabitius + Ptolemy` 主限法完整逆向推理与本地落地过程总文档
- `ASTROAPP_ALCHABITIUS_PTOLEMY_REVERSE_ENGINEERING_PUBLIC_EDITION.md`：适合公开发布的正式整理稿，保留工程证据链与实现细节，但行文改写为文章体

## 2) 主业务代码

- `Horosa-Web/`

### 2.1 前端（Umi/React）

- `Horosa-Web/astrostudyui/src/`：前端业务源码
- `Horosa-Web/astrostudyui/public/`：静态资源
- `Horosa-Web/astrostudyui/dist-file/`：构建产物（GitHub 版默认不提交）
- `Horosa-Web/astrostudyui/node_modules/`：依赖目录（不提交）
- `Horosa-Web/astrostudyui/src/utils/constants.js`：前端本地/线上后端根地址解析；当前本地模式优先按 `srv` 参数和当前网页端口推导实际 backend（`webPort + 1999`），只有无法推导时才回退 `localStorage.horosaLocalServerRoot`
- `Horosa-Web/astrostudyui/src/utils/request.js`：统一请求封装；当前会把主限法重算链路里的布尔型 `cache` 选项规范化为浏览器原生 `fetch` 可接受的字符串枚举
- `Horosa-Web/astrostudyui/src/components/tongshefa/TongSheFaMain.js`：统摄法主模块（四卦选择、本卦/互潜/错亲盘式、三十二观/三界/爻位/纳甲筮法、事盘保存、AI快照）
- `Horosa-Web/astrostudyui/src/components/cnyibu/CnYiBuMain.js`：易与三式子菜单入口（已新增“统摄法”标签）
- `Horosa-Web/astrostudyui/src/utils/localcases.js`：本地事盘类型映射（已新增 `tongshefa`）
- `Horosa-Web/astrostudyui/src/utils/aiExport.js`：AI导出技术识别与分段导出（已新增统摄法导出链路）

### 2.2 Java 后端（Maven 多模块）

- `Horosa-Web/astrostudysrv/`
  - 关键模块：`boundless`、`basecomm`、`image`、`astrostudy`、`astrostudycn`、`astroreader`、`astrodeeplearn`、`astroesp`、`astrostudyboot`
  - 启动 Jar：`Horosa-Web/astrostudysrv/astrostudyboot/target/astrostudyboot.jar`（构建产物，不提交）

### 2.3 Python 图表服务

- `Horosa-Web/astropy/astrostudy/`：算法实现
- `Horosa-Web/astropy/websrv/`：服务入口
- 主入口：`Horosa-Web/astropy/websrv/webchartsrv.py`

### 2.4 本地运行脚本（主工程内）

- `Horosa-Web/start_horosa_local.sh`
- `Horosa-Web/stop_horosa_local.sh`
- `Horosa-Web/verify_horosa_local.sh`
  - 当前会在检测到可用 Playwright Python 时自动补跑浏览器级宗师巡检
- `Horosa_Local.command`
  - 当前支持默认端口冲突时自动切换到替代端口，并通过 `srv` 查询参数把新页面绑定到正确的本地后端地址
  - 当前 `8000/8899/9999` 都通过 `nohup + setsid + disown` 常驻启动，降低“启动窗口一结束服务就死”的概率

## 3) 自动化脚本（新增整理）

- `scripts/mac/bootstrap_and_run.sh`
  - Mac 首次自动安装依赖、构建、启动的核心脚本
- `scripts/mac/self_check_horosa.sh`
  - 本地服务验收脚本；若 8899/9999 未启动则先无浏览器启动，再执行 `Horosa-Web/verify_horosa_local.sh`
  - 当前支持多副本共存：默认端口被别的 Horosa 副本占用时，会自动改用空闲端口完成当前副本验收
- `scripts/browser_horosa_master_check.py`
  - 浏览器级宗师巡检脚本（Playwright Python）
  - 覆盖左侧 16 个主模块、主限法切方法重算、星盘/推运盘/印度律盘/八字紫微/易与三式等关键子页点击、AI 导出与 AI 导出设置弹层
  - 产物默认写入：
    - `runtime/browser_horosa_master_check.json`
    - `runtime/browser_horosa_master_check.png`
- `scripts/requirements/mac-python.txt`
  - Mac Python 依赖清单
- `scripts/repo/clean_for_github.sh`
  - 清理 node_modules/target/runtime/logs，准备上传 GitHub

## 4) runtime 与缓存目录

- `runtime/README.md`：runtime 说明
- `runtime/*`：离线打包产物与当前保留的最小主限法验证样本目录（默认不提交）
- `.runtime/`：一键脚本生成的本地 Python venv（默认不提交）
- `.runtime/mac/node/`：一键部署在 Homebrew 不可用时直连安装的 Node runtime（默认不提交）
- `.runtime/mac/python/`：一键部署在 Homebrew 不可用时直连安装的 Python runtime（Miniconda，默认不提交）

## 5) modules（扩展参考资料）

- `modules/fengshui/naqi/`
- `modules/reference/kintaiyi-master/`
- `modules/reference/xuan-utils-pro-master/`
- `modules/reference/zhong-zhou-zi-wei-dou-shu-2/`

## 6) 建议检索路径

- 改前端页面：`Horosa-Web/astrostudyui/src/components/`
- 改前端模型：`Horosa-Web/astrostudyui/src/models/`
- 改后端接口：`Horosa-Web/astrostudysrv/astrostudyboot/`
- 改 Python 服务：`Horosa-Web/astropy/websrv/`
- 排查启动日志：`Horosa-Web/.horosa-local-logs/`

## 7) 本次性能修复说明（结构层）

- 未新增第三方依赖包；一键部署脚本与依赖清单无需额外安装步骤。
- 节气计算性能关键路径位于：
  - `Horosa-Web/astropy/astrostudy/jieqi/YearJieQi.py`
  - `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/JieQiController.java`
- 节气页面展示链路（前端拆分“全24节气卡片”与“图盘子集异步加载”）位于：
  - `Horosa-Web/astrostudyui/src/components/jieqi/JieQiChartsMain.js`
- 统一参数哈希缓存层位于：
  - `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/helper/ParamHashCacheHelper.java`

## 8) 本次统摄法新增结构（2026-02-23）

- 页面入口：
  - `Horosa-Web/astrostudyui/src/components/cnyibu/CnYiBuMain.js` -> `TabPane tab="统摄法" key="tongshefa"`
- 统摄法主实现：
  - `Horosa-Web/astrostudyui/src/components/tongshefa/TongSheFaMain.js`
  - 含：本卦/互潜/错亲矩阵、边框显示开关、四位卦象下拉、三十二观/三界/爻位/纳甲筮法、事盘保存与回填。
- 事盘类型与模块快照：
  - `Horosa-Web/astrostudyui/src/utils/localcases.js`（caseType + label 映射）
  - `Horosa-Web/astrostudyui/src/utils/moduleAiSnapshot.js`（复用模块快照存储，统摄法使用 `module=tongshefa`）
- AI 导出链路：
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - 已支持：技术识别 `tongshefa`、导出分段 `本卦/六爻/潜藏/亲和`、旧分段名兼容映射（互潜->潜藏，错亲->亲和，统摄法起盘->本卦）。

## 9) 本次六壬格局参考新增结构（2026-02-25）

- 六壬页面主实现：
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - 新增：右栏底部 `大格/小局` 双标签、六壬格局匹配引擎、匹配结果卡片展示、AI 快照同步分区。
  - 修复：`起课` 时可读取未确认时间草稿并同步排盘，不再依赖先点“确定”。
  - 二次加严：`三交/游子/解离/乱首/孤寡/龙战/赘婿` 等小局触发条件改为强约束组合匹配，降低宽松误命中。
  - 文案升级：改为文献原文块（诗诀 + 荀注 + 要点/依据），去除“主象/判词/风险/建议”模板文案。
  - 文案对齐（续）：`大格/小局` 其余条目荀注已按 `12. 大格.md` 与 `13. 小局.md` 逐字回填；`局式/局义/局注` 与荀注合并同块展示，保持右栏与 AI 导出一致。
  - 小局全收录：匹配条目由 15 条提升至 62 条（含 `旺孕/德孕/二烦/天祸/天寇/天狱/死奇/魄化/三阴/富贵/天合局/宫时局/北斗局` 全部缺口），并保持 `泆女+狡童` 双项可判。
  - 规则口径加严：新增日月支、节气、昨日干支、旬内天干映射、宫时孟仲季叠合、斗罡落位等上下文字段；小局匹配改为按 `13. 小局.md` 局式计算，不再停留在 41 条简化版。
  - 自检覆盖：`XIAO_JU_META`、`XIAO_JU_REFERENCE_TEXT`、`matchXiaoJuReferences` 三处键集合已对齐（62/62/62）。
- 六壬输入组件：
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengInput.js`
  - 新增 `timeHook` 透传，供父组件在点击 `起课` 时读取当前时间编辑值。
- AI 导出链路：
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - 六壬 AI 导出设置预设分区：`起盘信息`、`大格`、`小局`（已移除 `分类占`）。

## 10) 本次遁甲八宫新增结构（2026-02-25）

- 遁甲页面主实现：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - 右侧标签改为：`概览`、`神煞`、`八宫`（已移除原 `状态` 与 `历法` 标签，内容并入 `概览`）。
  - `八宫` 标签新增宫位按钮顺序：`乾/坎/艮/震/巽/离/坤/兑`，点击宫位后显示五段内容：
    - 奇门吉格（名称）
    - 奇门凶格（名称）
    - 十干克应（天盘干 + 地盘干）
    - 八门克应与奇仪主应（人盘门 + 地盘本位门；人盘门 + 天盘干）
    - 八神加八门（当前宫八神 + 当前宫八门）
- 遁甲八宫规则模块：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaBaGongRules.js`
  - 统一承载八宫规则映射与判定逻辑，供界面展示与 AI 快照导出复用。
- 遁甲 AI 快照导出：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaCalc.js`
  - 快照新增 `[八宫详解]` 分区，并按八宫输出对应计算结果。
- AI 导出设置：
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - 遁甲预设分区新增 `八宫详解`，与新增快照分区保持同步。

## 11) 本次六壬宫时局算法修正（2026-02-25）

- 六壬页面主实现：
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - 宫时局匹配口径从“孟仲季全盘轮转泛化”改为用户指定直判：
    - `绛宫时`：登明（亥）加四仲（子午卯酉）；
    - `明堂时`：神后（子）加四仲（子午卯酉）；
    - `玉堂时`：大吉（丑）加四仲（子午卯酉）。
  - 右栏命中证据文案改为“X加四仲”表达，减少误触发歧义。
  - `绛宫时/明堂时/玉堂时` 的 `局式/局义/局注` 已按用户给定原文更新，保持详情展示与 AI 快照一致。
- 一致性校验：
  - 小局三处键集合（`XIAO_JU_META`、`XIAO_JU_REFERENCE_TEXT`、`matchXiaoJuReferences`）仍保持 `62/62/62` 对齐，无新增缺口。

## 12) 本次遁甲八宫展示优化（2026-02-25）

- 遁甲页面主实现：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - 八宫右栏由连续文本改为板块卡片式布局（风格对齐六壬大格/小局）：
    - `奇门吉格`
    - `奇门凶格`
    - `十干克应`
    - `八门克应和奇仪主应`
    - `八神加八门`
  - 删除“第一部分/第二部分…”等编号文案。
  - 删除“当前宫位：X9宫”行，避免无依据宫位数字在右栏出现。
  - 删除八宫顶部冗余说明卡文案，仅保留核心结果板块。
- 八宫规则快照输出：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaBaGongRules.js`
  - 八宫快照标题从 `X9宫` 调整为 `X宫`，与页面展示口径统一。

## 13) 六壬宫时局命中修复（2026-02-25）

- 六壬小局匹配实现：
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - 宫时局条件修正为“天盘加临地盘”直判（使用 `upDownMap` 逆查）：
    - `绛宫时`：天盘 `亥` 加临地盘四仲；
    - `明堂时`：天盘 `子` 加临地盘四仲；
    - `玉堂时`：天盘 `丑` 加临地盘四仲。
  - 移除此前“月将+时支”临时判定，恢复宫时局在小局栏的正常命中展示。

## 14) 六壬小局展示分栏优化（2026-02-25）

- 六壬页面主实现：
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - 在“格局参考”Tabs 中新增 `参考` 标签页（位于 `小局` 右侧）。
  - 将 `始终/迍福/刑德`（键：`shizhong`/`tunfu`/`xingde`）从 `小局` 视图分流到 `参考` 视图。
  - 两个标签页沿用同一张卡片样式与命中依据展示，保证视觉一致。

## 15) 遁甲八宫吉凶格释义展示（2026-02-25）

- 八宫规则与展示实现：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaBaGongRules.js`
  - 新增吉凶格释义映射：
    - `QIMEN_JIGE_INTERPRETATION`
    - `QIMEN_XIONGGE_INTERPRETATION`
  - `buildQimenBaGongPanelData` 返回新增字段：
    - `jiPatternDetails`（`格名：释义`）
    - `xiongPatternDetails`（`格名：释义`）
  - 八宫快照 `[八宫详解]` 的吉凶格输出改为多行 `- 格名：释义`。
- 遁甲页面 UI：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - 八宫页 `奇门吉格/奇门凶格` 改为逐条展示“格名：释义”，不再仅显示格名。

## 16) 遁甲八宫释义显示开关（2026-02-25）

- 遁甲页面 UI：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - 新增 `showPatternInterpretation` 展示状态（默认开启）。
  - 在“换日/经纬度选择”区域中，新增按钮 `释义：是/否`，位于“经纬度选择”左侧。
  - 八宫 `奇门吉格/奇门凶格` 根据开关切换显示模式：
    - 开：`格名：释义`
    - 关：仅格名

## 17) 遁甲释义开关本地持久化（2026-02-25）

- 遁甲页面 UI：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - 新增本地持久化键：`qimenShowPatternInterpretation`。
  - 页面加载时读取本地值作为 `showPatternInterpretation` 初始状态；无值默认开启。
  - 点击“释义：是/否”时同步写入本地存储，刷新后保持上次选择。

## 18) 遁甲奇门演卦（2026-02-25）

- 八宫规则模块：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaBaGongRules.js`
  - 新增门卦映射与六十四卦名映射。
  - 新增 `buildQimenFuShiYiGua(pan)`：
    - 值符值使演卦：地盘值符宫为内卦、天盘值使宫为外卦。
  - `buildQimenBaGongPanelData` 新增：
    - `menFangYiGua`
    - `menFangYiGuaText`
    - 用于八宫“门方演卦例”展示。
- 遁甲页面展示：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - 概览新增：`奇门演卦`（符使演卦）。
  - 八宫每个宫位最下方新增板块：`奇门演卦`（门方演卦）。
- 快照导出：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaCalc.js`
  - `buildDunJiaSnapshotText` 增加概览演卦行；`[八宫详解]` 增加每宫“奇门演卦（门方）”。

## 19) AI导出分区同步补齐（2026-02-25）

- 六壬快照与导出：
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - 快照分区改为：
    - `[大格]`
    - `[小局]`（主小局）
    - `[参考]`（始终/迍福/刑德分流）
- 遁甲快照与导出：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaCalc.js`
  - 新增独立分区 `[奇门演卦]`（值符值使演卦）；门方演卦继续在 `[八宫详解]` 分宫输出。
- AI 导出设置预设：
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `liureng` 预设分区新增 `参考`。
  - `qimen` 预设分区新增 `奇门演卦`。

## 20) 六壬参考常驻条目（2026-02-25）

- 六壬小局匹配与分栏：
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `参考` 分流键新增：`wuqi`（物气）、`xingu`（新故）。
  - 常驻参考键集合为：`wuqi`、`xingu`、`tunfu`、`shizhong`、`xingde`。
  - 对上述五键启用“未命中也补入”机制，确保在“参考”标签始终可见；其余小局维持盘式条件命中。

## 21) 六壬“入课传”严判边界修正（2026-02-25）

- 六壬小局匹配实现：
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `courseBranches` 边界收紧为“四课上下神 + 三传地支”，移除此前混入的扩展位（如行年/贵人）。
  - 所有依赖“入课传”语义的条目随之统一严判（含 `三奇/六仪/游子/孤寡/官爵` 等），避免出现“左盘无此局式仍命中”的误报。

## 22) 遁甲吉凶格算法二次严判（2026-02-25）

- 八宫规则实现：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaBaGongRules.js`
  - 按上传术文对吉格/凶格判定做二次收紧，重点包括：
    - `天遁/地遁/人遁/鬼遁/云遁/龙遁/虎遁` 的门、神、宫位与干组合条件；
    - `三奇得使` 收紧为“日干映射三奇 + 地盘值使门宫 + 对应地干组合”；
    - `玉女守门` 使用“值使门加丁奇 + 时干映射 + 指定时辰补例”联合判定；
    - `三奇入墓` 收紧为 `乙坤、丙乾、丁艮`。
- 格名补齐：
  - 吉格新增：`青龙回首`、`飞鸟跌穴`。
  - 凶格新增：`青龙逃走`、`白虎猖狂`、`螣蛇夭矫`、`朱雀投江`、`太白火荧`、`荧入太白`、`飞宫格`、`伏宫格`、`大格`、`小格`、`天网四张格`、`地罗遮格`。
  - `伏吟/返吟` 格名与文献口径统一（替代旧命名 `门伏吟/门反吟`）。
- 释义联动：
  - 新增与重命名格名均补齐 `QIMEN_JIGE_INTERPRETATION` / `QIMEN_XIONGGE_INTERPRETATION`，确保“格名：释义”与算法输出一致。

## 23) 六壬三光与天合局严判修正（2026-02-25）

- 小局匹配实现：
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `三光` 从“偏宽松”改为“硬条件”：
    - 日干、日支、初传三者均需旺相；
    - 三传神将需全为吉神（贵人、六合、青龙、太常、太阴、天后）；
    - 保留日辰与发用无硬克约束。
  - `XIAO_JU_META.sanguang.condition` 同步更新为上述判定口径。
- 天合局判定扩展：
  - 新增天合规则集（甲己、乙庚、丙辛、丁壬、戊癸）统一驱动匹配。
  - 命中源由扩展到原文强调的三类显位：
    - 同课上下相合；
    - 三传有合；
    - 日干与日支上神有合，或日支与日干上神有合。
  - 新增上下课天干对、日支旬干、天合天干池等上下文字段用于证据回溯与界面展示。

## 24) 六壬十二盘式判定接入（2026-02-25）

- 新增盘式算法模块：
  - `Horosa-Web/astrostudyui/src/components/liureng/LRPanStyle.js`
  - 提供统一方法 `resolveLiuRengTwelvePanStyle(yueBranch, timeBranch)`。
  - 基于 `distance = (月将序 - 占时序 + 12) % 12` 映射十二式：
    - 伏吟、进连茹、进间传、生胎、顺三合、四墓覆生、反吟、四绝体、逆三合、病胎、退间传、退连茹。
- 六壬盘中心展示链路：
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengChart.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/RengChart.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/LRCommChart.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/LRChart.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/LRInnerChart.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/LRCircleChart.js`
  - 在天地盘中心区 `XX课` 下新增第三行盘式文案（`XX式`），圆盘/方盘均一致。
- AI 导出与设置同步：
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
    - 快照新增独立分区 `[十二盘式]`；
    - `[起盘信息]` 增加 `十二盘式` 摘要行。
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
    - `liureng` 预设分区新增 `十二盘式`，导出设置可单独勾选。

## 25) 六壬神将悬浮窗与“概览”条目（2026-02-25）

- 神将文档模块化：
  - `Horosa-Web/astrostudyui/src/components/liureng/LRShenJiangDoc.js`
  - 汇总《神》《将》两章核心数据：
    - 12神神义摘要；
    - 12将“临十二神”判词；
    - 将名归一（如 `贵人→天乙`、`玄武→元武`）。
  - 导出 `buildLiuRengHouseTipObj`，统一生成“天盘神 + 地盘神”双层悬浮窗内容。
- 六壬盘悬浮窗接入：
  - `Horosa-Web/astrostudyui/src/components/liureng/LRCommChart.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/LRChart.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/LRCircleChart.js`
  - `Horosa-Web/astrostudyui/src/components/graph/D3Circle.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/RengChart.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengChart.js`
  - 方盘/圆盘的神将区块均可 hover 出现文档浮窗，内容明确区分天盘神、地盘神。
- 六壬右栏“概览”：
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - 在 `参考` 右侧新增 `概览` Tab，展示：
    - `天将发用来意诀`
    - `天将杂主吉凶`
  - 匹配基于当前盘的 `发用` 与 `日干上神`，并附命中依据。
- AI 导出同步：
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
    - 快照新增 `[概览]` 分区。
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
    - `liureng` 预设分区新增 `概览`。

## 26) 六壬/遁甲格局算法严检收口（2026-02-25）

- 六壬小局收紧：
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `三阳` 按局式收紧为：贵人顺治 + 日干/日支在贵人前 + 日干/日支/初传皆旺相。
  - `富贵` 收紧为：贵人所乘旺相 + 贵人临核心位 + 三传皆生旺。

- 遁甲八宫收紧：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaBaGongRules.js`
  - `三奇得使` 与 `玉女守门` 去除非原文扩展条件，按上传术文主条件判定。
  - `伏吟/返吟` 由“门单判”改为“门+星联合判定”。
  - `时干入墓` 改为固定五个时干支硬触发（戊戌、壬辰、丙戌、癸未、丁丑）。
  - `门迫/门受制` 使用五行克制硬判（门克宫 / 宫克门）。
  - `星门入墓` 改为“星+门+宫位”联合匹配；`三奇受制` 改为奇墓/击刑/迫制联合判定。

## 27) 六壬原文荀注回填与依据口径修正（2026-02-25）

- 六壬主实现：
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `XIAO_JU_REFERENCE_TEXT` 大规模回填为长版原文（含 `增注`），不再使用摘要化短注。
  - 回填覆盖面：
    - 淫泆局、新孕局、隐匿局、乖别局、凶否局、吉泰局、五行局、天合局、宫时局、北斗局相关条目。

- 依据展示与命中逻辑：
  - **罗网**：
    - 命中口径由“同位”扩展为“同位 + 上神加临”双通道；
    - 依据拆分为“命中地位 / 命中上神”两行输出。
  - **概览**：
    - 按 `group + name` 合并同名条目，避免重复卡片；
    - 合并后依据并集去重，确保多条依据完整保留。
  - **乱首/赘婿依据文案**：
    - 修正法一/法二“临”方向描述，统一为与盘面上下神关系一致的表述。

- 变更登记：
  - `UPGRADE_LOG.md` 已同步新增对应记录，便于后续追溯“原文回填 + 判定修正 + 展示修正”。

## 28) 六壬神/将浮窗文案升级（2026-02-25）

- 资料与渲染：
  - `Horosa-Web/astrostudyui/src/components/liureng/LRShenJiangDoc.js`
  - 十二神条目升级为文档化结构字段：`title/month/verse1/verse2/desc/symbol`（对应《神》章）。
  - 标题改为优先文档标题（如 `登明亥神`、`河魁戌神`）。
- 十二将浮窗口径：
  - 保留：`天盘神`、`地盘神`、两盘对应判词。
  - 移除：`天盘神义/地盘神义` 展示行，避免与需求冲突。

## 29) 遁甲时间显示与快照导出同步（2026-02-25）

- 遁甲主界面：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - 左盘顶部与右侧概览统一显示：
    - `直接时间`
    - `真太阳时`
  - 增强 `parseDisplayDateHm` 兼容多种时间格式，减少空值显示。
- 快照导出：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaCalc.js`
  - `[起盘信息]` 新增：
    - `直接时间`
    - `真太阳时`
    - `计算基准`

## 30) AI 导出缺段补齐机制（遁甲/六壬）（2026-02-25）

- 导出实现：
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
- 遁甲：
  - 旧缓存缺段时，自动从当前页面补齐：
    - `奇门演卦`
    - `八宫详解`
  - 过滤兜底新增保留项：`奇门演卦`、`八宫详解`。
- 六壬：
  - 旧缓存缺段时，自动从右侧四个标签补齐：
    - `大格`
    - `小局`
    - `参考`
    - `概览`
- 通用：
  - 新增分段存在性检测与内容合并函数，避免“缓存优先导致新分段导不出”。

## 31) timeAlg 与真太阳时显示解耦（2026-02-25）

- 遁甲与三式合一：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- 修正内容：
  - 删除“选直接时间时改用时区中央经线”的地理参数替换逻辑。
  - `timeAlg` 仅用于计算基准切换；
  - 左侧显示用 `真太阳时` 始终基于真实经纬度计算，不随该选项被改写。

## 32) 三式合一参数区布局调整（2026-02-25）

- 右侧参数布局：
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- 调整：
  - 将原先分两行的参数合并到同一行四列：
    - `时计太乙`
    - `太乙统宗`
    - `回归黄道`
    - `整宫制`

## 33) 六壬/遁甲导出源切换为计算快照（2026-02-25）

- 导出实现：
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
- 调整要点：
  - `extractLiuRengContent` 与 `extractQiMenContent` 不再从右侧DOM采集文本。
  - 导出仅使用“计算阶段快照”：
    - 本地模块快照：`loadModuleAISnapshot(module)`；
    - 当前案例快照兜底：`currentCase.payload.snapshot`。
  - 无快照时不再DOM拼装补齐，避免“右侧展示态”影响导出原文排版。

## 34) AI导出去“右侧栏目”与原始段落排版（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaCalc.js`
- 结构调整：
  - 新增 `AI_EXPORT_FORBIDDEN_SECTIONS`：
    - 当前对 `liureng/qimen/sanshiunited` 禁止导出 `[右侧栏目]`。
  - 新增导出净化函数：
    - `getForbiddenSectionSet(key)`
    - `stripForbiddenSections(content, key)`
  - 导出流水更新：
    - `buildPayload` 在分段过滤前先执行 `stripForbiddenSections`；
    - `applyUserSectionFilter` 在“无用户设置”及“有设置”两条路径都执行禁用分段剔除。
  - 导出设置选项源更新：
    - `getOptionsForTechniqueKey` 会过滤禁用分段，避免设置面板再次出现“右侧栏目”。
  - 奇门分段映射兼容：
    - 旧分段名 `概览/右侧栏目` 映射到 `盘面要素`；
    - 预设分段改为 `起盘信息/盘型/盘面要素/奇门演卦/八宫详解/九宫方盘`。
  - 文本整形策略：
    - `normalizeText` 对 `liureng/qimen/sanshiunited` 走“保留原始段落”分支，避免统一转`-`列表。
  - 快照分段命名：
    - `buildDunJiaSnapshotText` 将 `[右侧栏目]` 改为 `[盘面要素]`。

## 35) 真太阳时显示与时间算法彻底解耦（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaCalc.js`
- 结构调整：
  - 遁甲与三式合一新增显示用参数构造函数：
    - `buildDisplaySolarParams(params)`：固定 `timeAlg=0`。
  - 新增显示真太阳时解析链路：
    - `resolveDisplaySolarTime(params, primaryResult)`。
    - 当用户选择`直接时间`时，额外获取`timeAlg=0`对应的`birth`作为显示值。
  - 状态与缓存签名新增字段：
    - `displaySolarTime`进入组件状态；
    - 遁甲盘缓存键 / 重算签名纳入该字段，避免缓存命中导致旧显示残留。
  - 盘面写入口径变更：
    - `calcDunJia`的`realSunTime`优先取`context.displaySolarTime`，其次才回退`nongli.birth`。
- 行为结果：
  - `timeAlg`仍仅决定盘面计算基准；
  - 左盘与概览里的“真太阳时”不再被“直接时间”按钮覆盖。

## 36) 导出前模块快照强制刷新（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
- 结构调整：
  - AI导出新增导出前刷新函数：
    - `requestModuleSnapshotRefresh(moduleName)`；
    - 在`extractLiuRengContent`、`extractQiMenContent`中先触发刷新事件再读取模块快照。
  - 六壬组件新增事件监听：
    - 监听`horosa:refresh-module-snapshot`；
    - 当`detail.module==='liureng'`时调用`saveLiuRengAISnapshot`即时重写快照。
  - 遁甲组件新增事件监听：
    - 当`detail.module==='qimen'`时重写当前`pan`快照。
  - 分段兼容：
    - `aiExport.mapLegacySectionTitle`中补充六壬旧分段名`三传(初传/中传/末传) -> 三传`。
- 行为结果：
  - 六壬导出优先使用当前盘即时快照，降低读取旧案例快照导致“格局参考缺失”的概率。

## 37) 三式合一重算容错兜底（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- 结构调整：
  - `recalcByNongli` 调度回调加入异常捕获：
    - 任一子步骤报错时，重算 Promise 仍可正常结束，不阻塞后续刷新。
  - `performRecalcByNongli` 中太乙计算改为可降级：
    - `calcTaiyiPanFromKintaiyi` 异常时返回 `taiyi=null`，其余盘继续渲染。
  - `refreshAll` 增加“空盘兜底二次重算”：
    - 当异步重算未产生变更且当前 `dunjia` 为空时，立即执行一次同步重算。
- 行为结果：
  - 三式合一不会因单一子模块异常直接落入“暂无三式合一数据”空态。

## 38) AI导出实时快照回传链路（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
- 结构调整：
  - `aiExport.requestModuleSnapshotRefresh(moduleName)` 从“仅派发通知”升级为“派发+回收实时文本”：
    - 事件 `detail` 新增 `snapshotText` 回传槽。
  - `extractQiMenContent`/`extractLiuRengContent` 数据源优先级更新：
    - 实时回传快照（刷新后） > 模块缓存快照 > `window.__horosa_*_snapshot_text` > 旧缓存兜底。
    - 核心分段缺失时不再直接信任旧缓存（遁甲看`[奇门演卦]/[八宫详解]`，六壬看`[大格]/[小局]/[参考]/[概览]`）。
  - 遁甲组件新增回传能力：
    - `saveQimenLiveSnapshot` 返回快照文本并记录 `window.__horosa_qimen_snapshot_at`；
    - 在 `horosa:refresh-module-snapshot` 中回填 `evt.detail.snapshotText` 并重写模块快照。
  - 六壬组件新增回传能力：
    - `saveLiuRengAISnapshot` 改为返回快照文本；
    - 在刷新事件中回填 `evt.detail.snapshotText`。
- 行为结果：
  - 导出触发时优先拿当前盘实时文本，降低“八宫详解/格局参考偶发缺失”风险。
- 本地运行包同步：
  - `runtime/mac/bundle/dist-file/` 已与 `Horosa-Web/astrostudyui/dist-file/` 同步；
  - 运行时入口脚本更新为 `umi.3fc83e7f.js`。

## 39) 真太阳时显示二次请求容错（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
- 结构调整：
  - 两处 `resolveDisplaySolarTime` 统一改为：
    - 先读 `getNongliLocalCache(timeAlg=0)`（缓存命中直接返回）；
    - 缓存未命中再请求 `fetchPreciseNongli(timeAlg=0)`；
    - 请求异常时回退主请求时间，不抛错。
- 行为结果：
  - “显示真太阳时”的辅助请求不再影响主盘计算成功与否；
  - 三式合一不会再因该辅助请求失败而出现“暂无三式合一数据”空白；
  - 在缓存命中场景减少一次额外接口调用，避免不必要时延。
- 本地运行包同步：
  - `runtime/mac/bundle/dist-file/` 已同步为最新构建，入口脚本更新为 `umi.c3707dd4.js`。

## 40) 修复后自检流程（2026-02-25）

- 自检入口与脚本：
  - `Horosa-Web/verify_horosa_local.sh`
  - `Horosa-Web/astrostudyui/.tmp_horosa_perf_check.js`
- 自检范围：
  - 本地服务端口（8899/9999）可用性；
  - 关键接口链路（`/nongli/time`、`/jieqi/year`、`/liureng/gods`）；
  - 前端单元测试（`umi-test`）；
  - 前端构建产物与运行目录一致性（`dist-file` -> `runtime/mac/bundle/dist-file`）。
- 当前基线结果：
  - 单测 `3/3` 套件通过，`16/16` 用例通过；
  - 接口 smoke/perf 检查通过；
  - 运行端页面脚本版本：`umi.c3707dd4.js`。

## 41) 三式合一时区标准化修复（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- 结构调整（仅三式合一）：
  - 新增时区标准化链路：
    - `parseZoneOffsetHour`：兼容 `+08:00`、纯数字、`UTC/GMT`、`东/西X区`；
    - `normalizeZoneOffset`：统一输出 `±HH:mm`。
  - 请求参数入口改造：
    - `onTimeChanged`
    - `getTimeFieldsFromSelector`
    - `genParams`
    - `genJieqiParams`
  - 以上路径全部保证发送到精确历法服务的 `zone` 为合法格式。
- 行为结果：
  - 修复三式合一“精确历法服务不可用”假阳性；
  - 避免因 `zone=8/东8区` 导致 `/nongli/time` 失败；
  - 遁甲模块逻辑保持不变（按要求未改）。
- 运行包同步：
  - `runtime/mac/bundle/dist-file/index.html` 当前入口脚本为 `umi.6bdb560e.js`。

## 42) 精确历法桥接层参数归一（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/utils/preciseCalcBridge.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- 结构调整：
  - 在桥接层新增统一归一化方法：
    - `normalizeZone`：兼容 `+08:00` / `8` / `UTC+8` / `东8区`，统一输出 `±HH:mm`；
    - `normalizeAd`：兼容 `AD/BC/1/-1`，并按日期符号兜底；
    - `normalizeBit`：统一布尔/数值开关到 `0/1`。
  - 请求参数入口统一：
    - `fetchPreciseNongli`、`fetchPreciseJieqiYear`、`fetchPreciseJieqiSeed`
      都在“缓存键构建、缓存读写、网络请求”前三步先做归一化。
  - 三式合一参数口径补齐：
    - `SanShiUnitedMain.genParams` 新增 `ad` 字段透传。
- 行为结果：
  - 彻底避免 `zone` 被透传为单字符导致 `/nongli/time` 抛出
    `StringIndexOutOfBounds(begin 1, end 3, length 1)`；
  - 即使上层模块传入历史格式时区，也能稳定拿到精确历法结果。
- 运行包同步：
  - `runtime/mac/bundle/dist-file/index.html` 当前入口脚本为 `umi.88aa4eb2.js`。

## 43) 三式合一 displaySolarTime 与排盘解耦（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- 结构调整：
  - `getCachedDunJia` 恢复旧稳定口径：
    - 移除 `displaySolarTime` 参数；
    - 缓存键不再包含显示时间；
    - 调用 `calcDunJia` 时不再把显示时间写入上下文。
  - `performRecalcByNongli` 改为“两段式”：
    - 先得到 `panRaw`（纯计算结果）；
    - 再覆盖 `realSunTime` 为 `displaySolarTime`（纯展示字段）。
  - 新增 `normalizeCalcFieldsForDunJia`：
    - 在三式合一调用遁甲计算前统一 `date/time/zone/ad` 输入格式；
    - 降低 `DateTime` 类型漂移导致的重算异常。
- 行为结果：
  - 修复“显示真太阳时”改动影响三式合一排盘的问题；
  - 三式合一继续支持“直接时间/真太阳时”双时间显示，同时计算路径保持稳定。
- 运行包同步：
  - `runtime/mac/bundle/dist-file/index.html` 当前入口脚本为 `umi.9107fbb7.js`。

## 44) 三式合一失败提示可观测性增强（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- 结构调整：
  - `refreshAll` catch 分支对非精确历法异常输出具体 `error.message`：
    - 从固定文案“请重试”改为带原因提示，便于定位真实失败点。
- 行为结果：
  - 用户端可直接看到导致三式合一失败的具体错误文本；
  - 减少“无法复现/无法定位”的来回排查成本。
- 运行包同步：
  - `runtime/mac/bundle/dist-file/index.html` 当前入口脚本为 `umi.8191667a.js`。

## 45) 三式合一稳定回退：撤销 displaySolarTime 主链路（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- 结构调整：
  - `refreshAll` 不再在主流程中额外请求/注入 `displaySolarTime`；
  - `recalcByNongli`、`performRecalcByNongli` 恢复为稳定签名（不携带显示时间参数）；
  - 三式合一内部对 `this.state.options` 统一增加空值兜底；
  - 修正 `overrideOptions` 为空时的读取路径，避免 `taiyiStyle` 空对象异常。
- 行为结果：
  - 修复三式合一报错：`null is not an object (evaluating 'n.taiyiStyle')`；
  - 三式合一起盘链路回到稳定计算路径，不再因显示时间分支中断。
- 运行包同步：
  - `runtime/mac/bundle/dist-file/index.html` 当前入口脚本为 `umi.62edd81c.js`。

## 46) 遁甲左盘日期渲染兼容短年份（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
- 结构调整：
  - `parseDisplayDateHm` 的年份解析改为可变位数（非固定4位）；
  - `getBoardTimeInfo` 统一通过解析函数生成日期/时间，不再使用固定下标切片。
- 行为结果：
  - 输入 `100`、`999` 等短年份时，左侧盘头日期不再显示 `日期--`；
  - 保持 `直接时间/真太阳时` 展示逻辑不变。
- 运行包同步：
  - `runtime/mac/bundle/dist-file/index.html` 当前入口脚本为 `umi.25ee3d4c.js`。

## 47) 三式合一顶部日期行统一与双时间显示解耦（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.less`
- 结构调整：
  - 顶部“日期”行改为同一文本节点输出，统一字号；
  - 直接时间显示改为 `HH:mm:ss`，真太阳时显示改为 `HH:mm:ss`；
  - 新增 `displaySolarTime` 显示状态与 `resolveDisplaySolarTime`（仅用于显示层）；
  - `displaySolarTime` 不参与三式合一主排盘重算签名与计算上下文。
- 行为结果：
  - 左盘日期行固定输出：`年-月-日 真太阳时：XX:XX:XX 直接时间：XX:XX:XX`；
  - 右侧时间算法选择仍决定实际排盘计算基准；
  - 页面稳定性保持，不回引此前 `n.taiyiStyle` 崩溃问题。
- 运行包同步：
  - `runtime/mac/bundle/dist-file/index.html` 当前入口脚本为 `umi.34a10371.js`，样式为 `umi.b7659491.css`。

## 48) 遁甲/三式合一时间算法对齐八字紫微口径（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaCalc.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- 结构调整：
  - `DunJiaCalc.buildGanzhiForQimen` 升级为 `buildGanzhiForQimen(nongli, dateParts, opts, context)`：
    - 引入 `parseDateTimeText / resolveCalcDateTime`；
    - 当 `timeAlg=0` 时按真太阳时文本解析小时用于时柱计算；
    - 当 `timeAlg=1` 时按直接时间口径（并保留精确历法时柱优先兜底）；
    - 年/月/日/时支持从 `nongli.bazi.fourColumns` 读取兜底。
  - `SanShiUnitedMain.getQimenOptions` 增加 `timeAlg` 透传：
    - 三式合一右侧“真太阳时/直接时间”选择可直接影响遁甲子模块计算。
  - `DunJiaMain` 的盘头时间解析增强：
    - `parseDisplayDateHm` 支持可变位数年份；
    - `getBoardTimeInfo` 使用解析兜底，避免短年份出现 `日期--`。
- 行为结果：
  - 遁甲与三式合一的时间算法行为与八字/紫微一致：右侧选项直接影响实际计算口径；
  - 真太阳时与直接时间可同时显示，且在小时跨界时可驱动时柱变化；
  - 短年份（<4位）盘头日期显示恢复稳定。
- 运行包同步：
  - `runtime/mac/bundle/dist-file/index.html` 当前入口脚本为 `umi.01433c13.js`，样式为 `umi.b7659491.css`。

## 49) 三式合一顶部神煞列宽调整（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.less`
- 结构调整：
  - `.topBox` 两列布局由 `1fr 174px` 改为 `minmax(0, 1fr) 148px`；
  - 固定收窄右侧“神煞双列”区域，释放左侧“日期/真太阳时/直接时间”行的可用宽度。
- 行为结果：
  - 三式合一盘左上“日期行”更易完整显示；
  - 不影响排盘计算、数据结构与右侧参数面板逻辑。
- 运行包同步：
  - `runtime/mac/bundle/dist-file/index.html` 当前入口脚本为 `umi.01433c13.js`，样式为 `umi.4fac2da6.css`。

## 50) 奇门遁甲取象悬浮窗（干/门/星/神）接入（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/dunjia/QimenXiangDoc.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
- 结构调整：
  - 新增 `QimenXiangDoc.js`：
    - 内置并解析 `4.取象 1.md` 全文（十天干/八门/九星/八神）；
    - 解析规则支持 `#` 标题、`####` 子标题、空行、分割线；
    - 子标题在渲染层按“标题 + 分割线”展示；
    - 提供 `buildQimenXiangTipObj` 与 `formatQimenDocLineToHtml`（保留 `<font>` 与 `**加粗**`）。
  - `DunJiaMain.js`：
    - 引入 `Popover`；
    - 新增 `renderQimenDocPopover` / `renderQimenHoverNode`；
    - 在宫格中将天盘干、地盘干、八神、九星、八门节点统一接入 hover 悬浮窗口。
- 行为结果：
  - 奇门遁甲盘实现与六壬/紫微一致的“鼠标悬停看释义”交互；
  - 支持干、门、星、神四类取象；原文条目不删减并可滚动查看。
- 运行包同步：
  - `runtime/mac/bundle/dist-file/index.html` 当前入口脚本为 `umi.e9018768.js`，样式为 `umi.4fac2da6.css`。

## 51) 奇门悬浮窗繁体安全转简（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/dunjia/QimenXiangDoc.js`
- 结构调整：
  - 新增 `SAFE_TRAD_TO_SIMP_MAP` + `toSafeSimplified`，以白名单方式做繁体转简体；
  - `normalizeText`（索引匹配）与 `formatQimenDocLineToHtml`（悬浮窗正文渲染）统一复用该转换链路；
  - 规避语义误转：不引入 `乾 -> 干` 这类破坏术数语义的替换。
- 行为结果：
  - 奇门干/门/星/神悬浮窗显示为更一致的简体文本；
  - 术数关键字保持原义，避免误读。
- 运行包同步：
  - `runtime/mac/bundle/dist-file/index.html` 当前入口脚本为 `umi.c042ba38.js`，样式为 `umi.4fac2da6.css`。

## 52) 占星“行星”白屏与希腊点标题排版修复（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPlanet.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroLots.js`
- 结构调整：
  - `AstroPlanet` 修正实例方法绑定：`genPlanetsDom.bind(this)`，防止 Tab 懒加载时进入“行星”页触发 `this` 为空。
  - `AstroLots` 新增 `renderTitle`：
    - 符号（`AstroMsg`）用 `AstroFont`；
    - 名称（`AstroTxtMsg/AstroMsgCN`）用 `NormalFont`；
    - 占位符符号 `{` 不再显示。
  - 移除 `AstroLots` Card 根级 `AstroFont`，避免希腊点标题与正文挤压重叠。
- 行为结果：
  - 占星页点击“行星”不再白屏；
  - 希腊点列表标题恢复可读，不再全部挤成一团。
- 运行包同步：
  - `runtime/mac/bundle/dist-file/index.html` 当前入口脚本为 `umi.21875f3f.js`，样式为 `umi.4fac2da6.css`。

## 53) 占星图释义悬浮开关（星/宫/座/相）接入（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/astro/ChartDisplaySelector.js`
  - `Horosa-Web/astrostudyui/src/models/app.js`
  - `Horosa-Web/astrostudyui/src/pages/index.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroChart.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroDoubleChart.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroChartCircle.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroMeaningData.js`
- 结构调整：
  - 新增 app 级别配置项 `showAstroMeaning`，并纳入 `GlobalSetup` 持久化。
  - 星盘组件抽屉新增勾选项：`是否显示星/宫/座/相释义`（最下方）。
  - `AstroChartCircle` 新增 `setShowAstroMeaning(flag)`：
    - 开启时为行星/宫位 tooltip 追加释义正文；
    - 开启时给星座环与相位线附加 tooltip；
    - tooltip 样式扩展为宽版可滚动容器，支持长文本。
  - `AstroDoubleChart` 由 `AstroHelper.drawDoubleChart` 迁移为 `AstroChartCircle.drawDoubleChart`，统一单盘/双盘的 tooltip 行为。
  - `AstroMeaningData.js` 更新为完整释义数据集：
    - 行星（太阳、月亮、水星、金星、火星、木星、土星、天王、海王、冥王、北交、南交）；
    - 星座（白羊至双鱼）；
    - 宫位（1th~12th）；
    - 相位（0/30/45/60/90/120/135/150/180）。
- 行为结果：
  - 关闭开关：保持当前基础显示（中文名 + 黄经信息）；
  - 开启开关：鼠标悬停星/宫位/星座/相位可见完整释义悬浮窗，覆盖占星单盘与双盘页面。
- 运行包同步：
  - `runtime/mac/bundle/dist-file/index.html` 当前入口脚本为 `umi.cc6e307f.js`，样式为 `umi.4fac2da6.css`。

## 54) 占星释义原文直存解析（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/astro/AstroMeaningData.js`
- 结构调整：
  - 引入 `RAW_ASTRO_REFERENCE` 保存用户提供的星/星座/宫位释义原文；
  - 通过 `extractBetween + blockToMeaning` 按起止标记切块，构建行星/星座/宫位释义映射；
  - 不再对原文进行简写改写或内容压缩。
- 行为结果：
  - Tooltip 展示数据来源于原文文本本体；
  - 保留原文层级与措辞，减少“参考文本被改动”的风险。
- 运行包同步：
  - `runtime/mac/bundle/dist-file/index.html` 当前入口脚本为 `umi.caedc923.js`，样式为 `umi.4fac2da6.css`。

## 55) 占星释义开关全模块同步（含推运/量化表格，2026-02-25）

- 目标文件（核心）：
  - `Horosa-Web/astrostudyui/src/pages/index.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroMeaningPopover.js`（新增）
  - `Horosa-Web/astrostudyui/src/components/astro/AstroMeaningData.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroChartMain.js`
  - `Horosa-Web/astrostudyui/src/components/astro3d/AstroChartMain3D.js`
  - `Horosa-Web/astrostudyui/src/components/direction/AstroDirectMain.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroFirdaria.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroAspect.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPlanet.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroLots.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroInfo.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroDoubleChartMain.js`
  - `Horosa-Web/astrostudyui/src/components/relative/AspectInfo.js`
  - `Horosa-Web/astrostudyui/src/components/relative/MidpointInfo.js`
  - `Horosa-Web/astrostudyui/src/components/relative/AntisciaInfo.js`
  - `Horosa-Web/astrostudyui/src/components/germany/Midpoint.js`
  - `Horosa-Web/astrostudyui/src/components/germany/AspectToMidpoint.js`
  - `Horosa-Web/astrostudyui/src/components/germany/MidpointMain.js`
  - `Horosa-Web/astrostudyui/src/components/germany/AstroMidpoint.js`
  - `Horosa-Web/astrostudyui/src/components/germany/AstroGermany.js`
  - `Horosa-Web/astrostudyui/src/components/dice/DiceMain.js`
  - `Horosa-Web/astrostudyui/src/components/otherbu/OtherBuMain.js`
  - 及相关包装组件：`IndiaChartMain/IndiaChart`、`HellenAstroMain/AstroChart13`、`JieQiChartsMain/JieQiChart`、`AstroSolarReturn/AstroLunarReturn/AstroGivenYear/AstroProfection/AstroSolarArc/AstroZR`、`AstroRelative` 与其子组件。

- 结构变化：
  - 新增占星释义渲染工具：
    - `AstroMeaningPopover.js`
      - `isMeaningEnabled(flag)`：统一判断开关；
      - `renderMeaningContent(tip)`：统一生成可滚动 tooltip 内容；
      - `wrapWithMeaning(node, enabled, tip)`：为任意节点挂载释义悬浮层。
  - `showAstroMeaning` 从 `pages/index.js` 透传至推运盘、量化盘、关系盘、节气盘、希腊星术、星盘、西洋游戏、印度律盘与相关内部组件。
  - 推运与量化相关表格组件统一接入悬浮释义：
    - 推运：`AstroPrimaryDirection`、`AstroFirdaria`
    - 关系盘：`AspectInfo`、`MidpointInfo`、`AntisciaInfo`
    - 量化盘：`Midpoint`、`AspectToMidpoint`
  - 星盘右侧页签统一接入悬浮释义：
    - `AstroAspect`（相位）
    - `AstroPlanet`（行星）
    - `AstroLots`（希腊点）
    - `AstroInfo`（行星标签）
  - 西洋游戏 `DiceMain` 的骰子结果（行星/星座/宫位）及两类图盘也同步接入。

- 行为结果：
  - 同一个开关可跨页面控制释义显示，避免“主盘有、子页无”的割裂。
  - 推运盘“表格也是”已生效：悬停行星/相位文本可显示释义。
  - 七政四余未改动，保持默认 RA 显示行为不变。

## 56) 三式合一外圈释义同步补齐（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`

- 结构变化：
  - 三式合一页面接入占星释义工具：
    - `buildMeaningTipByCategory`
    - `isMeaningEnabled`
    - `wrapWithMeaning`
  - `buildOuterData` 增加 `starsByBranchMeta`（包含 `shortTxt/fullTxt/objId`），用于在外圈星曜短标上挂载准确释义。
  - 外圈渲染 `renderOuterMarks` 新增三类悬浮释义：
    - 地支：显示对应星座释义（按 `BRANCH_SIGN_ID_MAP` 映射）；
    - 宫位：显示对应宫位释义（1~12宫）；
    - 星曜：显示完整星曜文本 + 行星释义。

- 计算与兼容性：
  - 仅改渲染层；不改起盘算法、时间算法、参数签名与缓存逻辑。
  - 七政四余（`guolao/*`）未触及，默认 `RA/赤经` 显示保持原行为。

## 57) 占星释义悬浮窗层级化排版（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/astro/AstroMeaningPopover.js`

- 结构变化：
  - 悬浮窗渲染器新增 Markdown 风格语义解析：
    - `#`/`##`/`####` 开头行识别为“标题行”；
    - 标题行以下自动绘制分隔线；
    - 行内 `**...**` 解析为加粗片段；
    - `==` 保持为分割线；空行渲染为间距行。
  - 视觉层级调整为接近遁甲浮窗：
    - 顶部标题更大更粗；
    - 小节标题加粗并与正文分离；
    - 正文行高、颜色、间距统一。

- 行为结果：
  - 占星相关释义浮窗（星/宫/座/相及其扩展表格）主次更清晰；
  - 用户提供文本中的 `#` 与 `**` 标记可以直接体现在悬浮窗中。

## 58) 希腊点释义专用数据源（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/astro/AstroMeaningData.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroLots.js`

- 结构变化：
  - `AstroMeaningData.js` 新增 `RAW_ASTRO_LOTS_REFERENCE`（希腊点原文全文）；
  - 新增 `LOT_BLOCK_MARKERS` 与 `LOT_MEANINGS`，支持 `buildMeaningTipByCategory('lot', key)`；
  - `resolveMeaning('planet', key)` 增加希腊点兜底（兼容旧调用路径）；
  - `AstroLots` 的标题释义入口从 `planet` 改为 `lot` 分类。

- 行为结果：
  - 希腊点悬浮释义优先显示用户提供的专用文本，不再混入行星释义；
  - 其他占星页面若以旧路径请求希腊点释义，仍能显示同一套文案，避免模块间不一致。

## 59) AI导出占星释义开关与注释注入（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `Horosa-Web/astrostudyui/src/components/homepage/PageHeader.js`

- 结构变化：
  - `AI_EXPORT_SETTINGS_VERSION` 升级为 `5`；
  - 新增 `astroMeaning` 配置块（按技法独立）；
  - 在 `listAIExportTechniqueSettings()` 中新增：
    - `supportsAstroMeaning`
    - `astroMeaning`
  - `PageHeader` 的 “AI导出设置” 弹窗新增占星注释复选项：
    - `在对应分段输出星/宫/座/相/希腊点释义`
  - 导出流程新增 `applyAstroMeaningFilterByContext()`：
    - 仅在占星相关技法且开关开启时生效；
    - 按分段识别并在对应位置追加 `[...]释义` 分段；
    - 注释来源统一调用 `AstroMeaningData`（行星/星座/宫位/相位/希腊点）。

- 行为结果：
  - AI导出与前端释义能力同步；
  - 用户在 AI导出设置中勾选后，导出文本会在对应分段输出完整注释内容；
  - 不勾选时保持原有导出格式与体量。

## 60) AI导出占星注释全分段覆盖与对应位置输出（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`

- 结构变化：
  - 注释注入策略从“标题白名单触发”升级为“标题显式触发 + 内容识别触发”：
    - 显式标题（行星/希腊点/相位/宫位/信息/推运等）持续触发注释；
    - 其它占星分段只要检测到星/宫/座/相/希腊点关键词也触发注释。
  - `appendAstroMeaningSections` 去掉跨分段全局去重，改为每个分段独立注释块。

- 行为结果：
  - AI导出在所有占星相关页面更稳定地输出注释；
  - 注释会跟随原分段出现在“对应位置”，不会因前文重复而被省略；
  - 仍受 AI导出设置里的“占星注释”开关控制。

## 61) 左侧星盘 tooltip 富文本渲染与遁甲风格化（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/utils/helper.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroChartCircle.js`

- 结构变化：
  - `helper.js`：
    - 新增 tooltip 富文本解析器：
      - `# / ## / ### / ####` 标题识别；
      - `**...**` 行内加粗渲染；
      - `==` 分割线保留；
      - 仅在检测到富文本标记时启用新渲染，否则走 `genHtmlLegacy`。
    - 新增 `escapeTooltipHtml`、`renderTooltipInlineBoldHtml` 等工具函数。
  - `AstroChartCircle.js`：
    - tooltip 容器样式改为白底卡片（560px + max-width），增加边框与阴影，提升层次可读性。

- 行为结果：
  - 左侧星盘（含推运等基于 `AstroChartCircle` 的图盘）悬浮释义不再显示原始 markdown；
  - 标题/分割线/加粗层级与遁甲风格趋同；
  - 非占星普通 tooltip 渲染保持兼容。

## 62) 遁甲顶部四柱配色对齐八字紫微（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`

- 结构变化：
  - 引入八字配色数据源：
    - `BaZiColor`（天干五行色）
    - `ZhiColor`（地支色）
  - 新增映射函数：
    - `GAN_COLOR_MAP`
    - `getBaZiStemColor(stem)`
    - `getBaZiBranchColor(branch)`
  - `renderBoard` 顶部四柱 `pillars` 颜色来源改为按干支字符动态映射。

- 行为结果：
  - 遁甲左上角“年/月/日/时”显示配色与八字紫微方案一致；
  - 修改仅作用于顶部四柱文本，不影响下方九宫方盘与宫格内容显示。

## 63) 三式合一左盘同步六壬/遁甲/占星悬浮释义（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`

- 结构变化：
  - 引入六壬释义数据源：
    - `buildLiuRengShenTipObj`
    - `buildLiuRengHouseTipObj`
  - 引入遁甲释义数据源：
    - `buildQimenXiangTipObj`
  - 新增 `toQimenMeaningTip()`：
    - 将遁甲文档块（blank/divider/subTitle/text）转换为统一 tooltip 行结构（兼容 `wrapWithMeaning`）。
  - `renderLiuRengMarks()`：
    - 给“天盘支”挂载十二神悬浮释义；
    - 给“天将”挂载将神/天地盘对应悬浮释义。
  - `renderQimenBlock()`：
    - 给天盘干、八神、地盘干、九星、八门挂载遁甲悬浮释义。

- 行为结果：
  - 三式合一左盘悬浮能力与单盘保持一致：
    - 占星（星/宫/座）可悬浮；
    - 六壬（神/将）可悬浮；
    - 遁甲（干/门/星/神）可悬浮。
  - 全部受 `showAstroMeaning` 开关统一控制，关闭释义时不显示 tooltip。

## 64) 三式合一悬浮无响应修复（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.less`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroMeaningPopover.js`

- 结构变化：
  - `SanShiUnitedMain.less`：
    - `.outerCell`、`.qmBlock`、`.lrMark` 改为 `pointer-events: auto`，允许悬浮命中。
  - `AstroMeaningPopover.js`：
    - `wrapWithMeaning` 从“外包 span 触发”改为“优先直接 clone 原节点触发”；
    - 解决绝对定位节点悬浮时触发区域丢失的问题。

- 行为结果：
  - 三式合一左盘鼠标悬停可稳定弹出释义；
  - 同时提升其他使用 `wrapWithMeaning` 的绝对定位节点兼容性。

## 65) AI导出同步三式悬浮注释（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `Horosa-Web/astrostudyui/src/components/homepage/PageHeader.js`

- 结构变化：
  - `aiExport.js`：
    - 新增技法集合 `AI_EXPORT_HOVER_MEANING_TECHNIQUES`（`qimen/liureng/sanshiunited`）；
    - 扩展注释开关覆盖：`AI_EXPORT_ASTRO_MEANING_TECHNIQUES` 加入 `qimen/liureng`；
    - 新增技法文案元信息 `getMeaningSettingMetaByTechnique`；
    - 新增三类注释构建器：
      - `appendQimenMeaningSections`（干/门/星/神注释）
      - `appendLiurengMeaningSections`（十二神/天将注释）
      - `appendSanShiUnitedMeaningSections`（六壬/遁甲/占星合并注释）
    - `applyAstroMeaningFilterByContext` 改为按技法分流注释注入。
  - `PageHeader.js`：
    - AI导出设置弹窗中“注释开关”标题与描述改为按技法动态显示（占星类/三式类不同文案）。

- 行为结果：
  - 六壬、遁甲、三式合一在 AI 导出设置中可独立勾选“悬浮注释输出”；
  - 勾选后导出文本在对应分段追加与悬浮窗口一致的注释内容；
  - 不勾选保持原始导出正文不变。

## 66) AI导出统一改为计算快照通道（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`

- 结构变化：
  - 导出提取函数去 DOM 右栏化：
    - `extractAstroContent` 仅走 `astroAiSnapshot`（星盘/希腊）与 `indiachart` 快照；
    - `extractSixYaoContent` 仅走 `guazhan` 快照；
    - `extractSanShiUnitedContent` 仅走 `sanshiunited` 快照；
    - `extractTaiYiContent`、`extractGermanyContent`、`extractJieQiContent`、`extractRelativeContent`、`extractOtherBuContent` 统一仅走对应模块快照。
    - `extractTongSheFaContent` 与 `extractFengShuiContent` 移除 `extractGenericContent` 回退。
  - `extractGenericContent` 删除最终 DOM 文本兜底，避免误采右侧栏目文本。
  - 六爻分段设置与快照标题对齐：
    - 预设改为 `起盘信息/卦象/六爻与动爻/卦辞与断语`；
    - 兼容映射：`起卦方式 -> 卦象`，`卦辞 -> 卦辞与断语`。

- 行为结果：
  - AI导出默认不再从右侧栏目复制文本，改为计算阶段快照输出；
  - 占星盘导出恢复为稳定分段文本来源（避免Tab抓取导致的缺段/串段）；
  - 六爻旧配置用户无需重配，过滤项仍有效。

## 67) 三式合一占星悬浮兼容修复（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/astro/AstroMeaningPopover.js`

- 结构变化：
  - 新增 `normalizeTip()`：
    - 统一将 `string / array / object` 三种tip输入规范为 `{ title, tips }`；
    - 保留对象型tip的标题与细节结构。
  - `renderMeaningContent()`：
    - 改为基于 `normalizeTip` 后的数据渲染，避免字符串tip被判空。

- 行为结果：
  - 三式合一左盘占星元素（外圈星/宫/座）在开启释义时可正常弹出悬浮；
  - 六壬/遁甲悬浮逻辑与显示不受影响。

## 68) AI导出风水快照化与全模块快照链路收口（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `Horosa-Web/astrostudyui/src/components/fengshui/FengShuiMain.js`
  - `Horosa-Web/astrostudyui/public/fengshui/app.js`

- 结构变化：
  - `aiExport.js`：
    - `extractTongSheFaContent` 改为仅使用模块快照（支持 `horosa:refresh-module-snapshot` 主动刷新）；
    - `extractFengShuiContent` 改为仅使用模块快照（先刷新，再读缓存）。
  - `FengShuiMain.js`：
    - 新增 iframe 引用与轮询快照同步；
    - 新增 `horosa:refresh-module-snapshot` 监听，支持导出时即时拉取风水快照；
    - 将快照保存到 `moduleAiSnapshot('fengshui')`。
  - `public/fengshui/app.js`：
    - 新增 AI 快照文本生成器（分段模板）：
      - `[起盘信息]`
      - `[标记判定]`
      - `[冲突清单]`
      - `[建议汇总]`
      - `[纳气建议]`
    - 在标记列表更新时实时同步 `window.__horosa_fengshui_snapshot_text`。

- 行为结果：
  - AI导出链路进一步统一到“计算/模块快照”来源；
  - 导出过程不再依赖页面右栏/DOM文本拼接；
  - 风水页面也具备与其它术法一致的快照导出能力与导出设置过滤能力。

## 69) AI导出分段过滤容错（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`

- 结构变化：
  - `applyUserSectionFilter(content, key)`：
    - 配置值非数组时：直接走正文（仅剔除禁用分段）；
    - 分段数组为空时：回退到 `AI_EXPORT_PRESET_SECTIONS[key]`；
    - 过滤后为空时：回退原始正文，避免导出空白。
  - `applyUserSectionFilterByContext(content, 'jieqi')`：
    - 若节气盘分段过滤结果为空，回退原始正文。

- 行为结果：
  - 星盘、推运盘、量化盘、关系盘、节气盘、希腊星术、统摄法等页面，不会再因设置分段为空/失配而出现“当前页面没有可导出文本”误报；
  - AI导出设置仍然有效，但加入了防误清空保护。

## 70) AI导出 payload 级回退与全技法自检（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`

- 结构变化：
  - `buildPayload()`：
    - 新增 `rawSnapshotContent` 保存计算快照原文；
    - 在“分段过滤 + 后天信息过滤 + 释义注入”之后，若内容为空则回退至 `rawSnapshotContent` 再生成导出文本。
  - 一致性校验：
    - 校验导出分发链路覆盖（`context.key -> extract*Content`）；
    - 校验禁导出分段（`右侧栏目`）剔除规则；
    - 校验分段过滤与 payload 兜底开关已启用。

- 行为结果：
  - 所有方法页面 AI 导出在设置误配时不会被清空；
  - 保持“计算快照优先”的导出来源，不回退右侧栏目复制；
  - AI导出设置仍按所选分段生效，且具备空白保护。

## 71) AI导出上下文 store 兜底识别（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`

- 结构变化：
  - 新增 `resolveContextByAstroState()`：
    - 读取 `store.astro.currentTab/currentSubTab`，映射当前技法导出 key；
    - 覆盖 `astrochart / direction / germanytech / relativechart / jieqichart / locastro / hellenastro / indiachart / cntradition / cnyibu / guolao / otherbu / fengshui / sanshiunited`。
  - 新增 `withStoreContextFallback(context)`：
    - 当 DOM 上下文识别为 `generic` 或处于 `direction/cntradition/cnyibu` 时，改用 store 结果兜底。
  - `buildPayload()` 与 `getCurrentAIExportContext()`：
    - 统一调用 `withStoreContextFallback(resolveActiveContext())`，确保 AI导出与 AI导出设置读取同一技法上下文。
  - `getAstroCachedContent()`：
    - 增加 `loadAstroAISnapshot()` 回退链，在签名不匹配或保存失败时仍可导出现存快照。

- 行为结果：
  - 修复“当前页面没有可导出文本”误报（由 DOM 技法识别失败触发）；
  - 星盘、推运盘、量化盘、关系盘、节气盘、希腊星术、统摄法等页面导出链路更稳；
  - 保持“计算快照优先”，不依赖右侧栏目复制。

## 72) 三式合一占星悬浮提示结构化对齐（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`

- 结构变化：
  - 新增释义对象处理函数：
    - `normalizeMeaningTip`
    - `mergeMeaningTips`
    - `buildOuterHouseMeaningTip`
    - `buildOuterBranchMeaningTip`
    - `buildOuterStarMeaningTip`
  - `renderOuterMarks`：
    - `宫位`、`地支-星座`、`星曜` 悬浮说明全部改为结构化 `title + tips`，不再拼接对象到字符串。

- 行为结果：
  - 修复三式合一占星悬浮出现 `[object Object]`；
  - 悬浮内容样式与星盘统一（标题、分段、加粗/分隔线风格一致）。

## 73) 星座释义补齐四尊贵状态（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/astro/AstroMeaningData.js`

- 结构变化：
  - 新增 `SIGN_DIGNITY_LINES` 常量：
    - 为 12 星座增加 `入庙 / 擢升 / 入落 / 入陷` 文案映射。
  - 新增 `enrichSignMeaningWithDignity(signKey, meaning)`：
    - 在星座释义 tips 中插入四尊贵状态；
    - 默认插入在“宫位属性”后；
    - 若已存在“入庙”行则跳过，避免重复。
  - 调整 `resolveMeaning('sign', key)`：
    - 返回补齐后的星座释义对象，而非原始 `SIGN_MEANINGS`。

- 行为结果：
  - 星盘相关页面与三式合一中，星座悬浮释义统一新增四尊贵状态；
  - AI导出“星座释义”分段自动携带四尊贵状态；
  - AI导出设置中的占星注释开关仍按原逻辑控制输出，仅内容被增强。

## 74) 量化盘 AI 导出快照刷新链路补齐（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/germany/AstroMidpoint.js`
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`

- 结构变化：
  - `AstroMidpoint.js`：
    - 新增 `saveGermanySnapshot(paramsOverride, resultOverride)`，统一生成并保存 `[起盘信息]/[中点]/[中点相位]` 快照；
    - 新增 `handleSnapshotRefreshRequest(evt)`，响应 `horosa:refresh-module-snapshot` 且 `module === 'germany'`；
    - `componentDidMount` 注册监听并主动尝试写入快照；
    - `componentDidUpdate` 在 `midpoints/chart/fields` 变化时自动刷新快照；
    - `componentWillUnmount` 注销监听；
    - `requestChart` 改为通过 `saveGermanySnapshot` 落库，确保导出与页面同源。
  - `aiExport.js`：
    - `extractGermanyContent` 改为“先刷新再读缓存”：
      - 先 `requestModuleSnapshotRefresh('germany')`；
      - 刷新失败再回退 `getModuleCachedContent('germany')`。

- 行为结果：
  - 量化盘页面点击 AI导出时，不再因本地快照未及时落库而提示“当前页面没有可导出文本”；
  - 保持“计算阶段快照导出”的实现方式，不依赖右侧栏复制。

## 75) AI导出稳态增强（2026-02-25）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `Horosa-Web/astrostudyui/src/utils/moduleAiSnapshot.js`
  - `Horosa-Web/astrostudyui/src/utils/astroAiSnapshot.js`

- 结构变化：
  - `moduleAiSnapshot.js`：
    - 新增 `MODULE_SNAPSHOT_MEMORY` 内存快照池；
    - `saveModuleAISnapshot/loadModuleAISnapshot` 改为“localStorage + 内存双通道”。
  - `astroAiSnapshot.js`：
    - 新增 `ASTRO_AI_SNAPSHOT_MEMORY`；
    - `saveAstroAISnapshot/loadAstroAISnapshot` 支持 localStorage 失败时内存兜底。
  - `aiExport.js`：
    - `withStoreContextFallback` 增强：当 DOM 上下文与 store 上下文冲突或不完整时，优先采用 store 当前术法；
    - `getCurrentAIExportContext` 对 `direction` 返回 `primarydirect`；
    - 新增 `normalizeExportKey/getTechniqueLabelByKey/getCandidateExportKeys/extractContentByKey`；
    - `buildPayload` 改为候选键兜底提取，并按 `usedExportKey` 执行分段过滤/注释开关；
    - 推运子模块导出增加 refresh 优先（法达/太阳弧/返照/流年等）；
    - `requestModuleSnapshotRefresh` 等待窗口从 `80ms` 调整为 `220ms`；
    - `getModuleCachedContent` 增加跨模块别名识别，减少 case 快照读取误判。

- 行为结果：
  - 修复多个术法点击 AI导出“无反应/无可导出文本”；
  - 修复上下文误判导致的导出串台；
  - 在 localStorage 异常情况下，仍可通过内存快照稳定导出。

## 76) 星盘组件底部选项统一复选框（2026-02-27）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/astro/ChartDisplaySelector.js`
  - `Horosa-Web/astrostudyui/src/models/app.js`
  - `Horosa-Web/astrostudyui/src/pages/index.js`

- 结构变化：
  - `ChartDisplaySelector`：
    - 移除 `Checkbox.Group + Select` 混合结构，改为统一单项 `Checkbox` 渲染；
    - `主/界限法显示界限法` 改为纯复选框（布尔勾选映射 `showPdBounds: 1/0`）；
    - 新增底部开关：`仅按照本垣擢升计算互容接纳`。
  - `app` 模型新增 `showOnlyRulExaltReception` 状态并纳入 `GlobalSetup` 持久化。
  - `index` 页面补充 `showOnlyRulExaltReception` 下发，保证显示链路可读该配置。

- 行为结果：
  - 星盘组件底部选项风格统一，不再出现“下拉+复选框”混合断层；
  - “主/界限法显示界限法”交互与其它选项一致；
  - 新增“仅按照本垣擢升计算互容接纳”全局开关进入状态与持久化链路。

## 77) 接纳/互容本垣擢升过滤同步到信息面板与AI快照（2026-02-27）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/astro/AstroInfo.js`
  - `Horosa-Web/astrostudyui/src/utils/astroAiSnapshot.js`

- 结构变化：
  - `AstroInfo` 新增：
    - `getOnlyRulerExaltReceptionEnabled`
    - `hasRulerOrExalt`
    - `keepReceptionLine`
    - `keepMutualLine`
  - `receptions/mutuals` 渲染前先按本垣/擢升规则过滤：
    - 正接纳：`supplierRulerShip` 必含 `ruler/exalt`；
    - 邪接纳：`supplierRulerShip` 或 `beneficiaryDignity` 任一含 `ruler/exalt`；
    - 互容：双方 `rulerShip` 均含 `ruler/exalt`。
  - `astroAiSnapshot` 新增同名过滤辅助并应用到 `buildInfoSection`；
  - `createAstroSnapshotSignature` 纳入该开关位（`...|onlyRulerExaltReception`）；
  - `build/save/get` 快照函数签名新增 `options`，支持导出链路传入该开关并保持一致。

- 行为结果：
  - 页面右侧“接纳/互容”与 AI导出“信息”分段使用同一过滤规则；
  - 切换开关后不会误命中旧快照，导出内容与当前显示保持对齐；
  - 当过滤后为空时，不再输出空“接纳/互容”标题分节。

## 78) 本地启动脚本服务生命周期修复（2026-02-27）

- 目标文件：
  - `Horosa_Local.command`
  - `Horosa-Web/stop_horosa_local.sh`
  - `README.md`

- 结构变化：
  - `Horosa_Local.command`：
    - 新增 `WEB_PID_FILE`（`.horosa_web.pid`）管理前端静态服务进程；
    - `cleanup` 改为统一调用 `stop_horosa_local.sh` 做 py/java/web 全量回收；
    - 启动前 stale 检查从 `py/java` 扩展为 `py/java/web`；
    - 当前 `HOROSA_KEEP_SERVICES_RUNNING` 默认恢复为 `1`，避免用户在浏览器继续使用时因启动窗口结束而把后端一起停掉。
    - 若默认 `8000/8899/9999` 已被其他副本占用，会自动切换到空闲端口（常见为 `18000/18899/19999`），并要求用户使用新打开的页面而不是旧标签页。
  - `stop_horosa_local.sh`：
    - 新增 web 进程 `stop_by_pid_file "web" "${WEB_PID_FILE}"`。
  - `README.md`：
    - 增补 `HOROSA_KEEP_SERVICES_RUNNING=1` 说明；
    - 说明 `Horosa_Local.command` 的自动端口避让行为和“不要继续使用旧 8000 标签页”的注意事项。

- 行为结果：
  - 当前默认保持本地服务常驻，避免页面仍开着时点击“重新计算”触发 8899 假掉线；
  - 需要关窗自动停服时可显式设置 `HOROSA_KEEP_SERVICES_RUNNING=0`；
  - pid 文件与 stop 脚本职责对齐，清理链路更稳定。

## 79) 本地启动浏览器优先级调整为 Safari（2026-02-27）

- 目标文件：
  - `Horosa_Local.command`

- 结构变化：
  - 新增 Safari 跟踪函数：
    - `launch_safari_window`
    - `safari_window_exists`
    - `wait_for_safari_window_close`
  - 自动停止模式的打开顺序改为：
    - Safari（可跟踪关闭） -> Chromium app window -> `open -a Safari` -> 系统默认浏览器。

- 行为结果：
  - 软件默认优先以 Safari 打开；
  - 在默认“自动停服”模式下，关闭 Safari 窗口即可触发停服，无需手动回车。

## 80) 三式合一外圈星曜简称去歧义（2026-02-27）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`

- 结构变化：
  - `shortMainStarLabel(name)` 新增天顶/中天特判：
    - `天顶` -> `顶`
    - `中天` -> `顶`

- 行为结果：
  - 外圈短标签不再出现“天顶=天”与“天王星=天”冲突；
  - 悬浮全称保持不变，短标签识别更清晰。

## 81) 六壬/三式合一天将悬浮正文按将拆分补全（2026-02-28）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/liureng/LRShenJiangDoc.js`

- 结构变化：
  - 新增 `JIANG_INFO`：
    - 收录十二天将的 `intros / verses / extra` 文案结构；
    - `天乙` 专门承载“主清御…天乙持魁钺…”加粗段落；
    - 其余十一将仅使用本将对应文案。
  - 新增 `buildJiangDocTips(jiang)`：
    - 按当前天将动态生成悬浮正文；
    - 统一插入将名标题（`### **将名**`）与该将诗诀（加粗）。
  - `buildLiuRengHouseTipObj`：
    - 在原“天盘神/地盘神命中信息”前追加当前天将正文；
    - 保留命中位说明用于格位定位。
  - 去重调整：
    - 移除正文内“XX临十二神”整段，避免与当前盘面命中位信息重复。

- 行为结果：
  - 六壬与三式合一中的天将悬浮，不再出现“把天乙内容灌到所有将”的错误；
  - 每个天将显示对应原文段落与诗诀；
  - 悬浮内容更完整，同时避免重复段落堆叠。

## 82) 六壬悬浮样式对齐三式合一富文本风格（2026-02-28）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/utils/helper.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/LRCommChart.js`

- 结构变化：
  - `helper.js`：
    - `genHtml(tipobj, needpadding, forceRich)`：新增 `forceRich`，可强制富文本渲染路径；
    - `creatTooltip(..., needpadding, forceRich)`：新增参数透传。
  - `LRCommChart.js`：
    - 六壬宫位将神悬浮、神义悬浮统一传入 `forceRich=true`。

- 行为结果：
  - 六壬相关悬浮窗统一使用与三式合一相同的富文本视觉层级；
  - 不再因文本缺少 `#/**` 标记而回退到旧版列表风格。

## 83) 六壬盘悬浮容器样式卡片化（2026-02-28）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengChart.js`
  - `Horosa-Web/astrostudyui/src/utils/helper.js`

- 结构变化：
  - `LiuRengChart.setupToolTip` 从旧版蓝底定宽提示框升级为白底卡片样式：
    - `width:auto + max-width/min-width`
    - `max-height + overflow-y`
    - `background/border/shadow/z-index` 对齐统一悬浮风格。
  - `helper.creatTooltip` 增加 `forceRich=true` 时的不透明显示策略（`opacity=1`）。

- 行为结果：
  - 六壬盘悬浮不再出现“半透明蓝底整条覆盖”的旧观感；
  - 视觉层级、可读性、滚动行为与三式合一悬浮更一致。

## 84) 文档同步确认：六壬悬浮窗调整（2026-02-28）

- 同步范围：
  - 六壬天将文案补全与去重；
  - 六壬悬浮富文本强制渲染；
  - 六壬提示容器样式卡片化（白底、边框、阴影、自动宽高）。

- 已登记文件：
  - `Horosa-Web/astrostudyui/src/components/liureng/LRShenJiangDoc.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/LRCommChart.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengChart.js`
  - `Horosa-Web/astrostudyui/src/utils/helper.js`

- 结果：
  - 变更已在 `UPGRADE_LOG.md` 与 `PROJECT_STRUCTURE.md` 双处落档，可追踪。

## 85) 六壬悬浮标题去重（2026-02-28）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/liureng/LRShenJiangDoc.js`

- 结构变化：
  - `buildJiangDocTips(jiang)`：移除正文开头的 `### **将名**` 注入。

- 行为结果：
  - 六壬与三式合一中的六壬悬浮，仅保留卡片最上方标题显示一次名称；
  - 正文不再重复同名标题。

## 86) 六壬悬浮加粗语义补齐（2026-02-28）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/liureng/LRShenJiangDoc.js`

- 结构变化：
  - 新增 `formatJiangIntroLine(line)`：
    - 识别 `其吉：/其吉:` 与 `其戾：/其戾:` 前缀并转成加粗输出。
  - `buildLiuRengHouseTipObj`：
    - `天盘神`、`地盘神` 标签改为 markdown 加粗。
  - `buildLiuRengShenTipObj`：
    - 两句诗 (`verse1`/`verse2`) 改为整句加粗；
    - `类象` 标签改为加粗前缀（`**类象：**`）。

- 行为结果：
  - 六壬与三式合一的六壬悬浮，重点语义标签层级更清晰；
  - 天将/地支两类悬浮在排版强调上保持一致。

## 87) 六壬悬浮追加四课/三传上下文（2026-02-28）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/liureng/LRShenJiangDoc.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/LRCommChart.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/RengChart.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`

- 结构变化：
  - `LRShenJiangDoc.js`：
    - 新增 `appendKeAndChuanTips(tips, tipContext)`，输出四课/三传的“地支+天将”段落；
    - `buildLiuRengShenTipObj(branch, tipContext)` 与 `buildLiuRengHouseTipObj(..., tipContext)` 支持可选上下文参数。
  - `LRCommChart.js`：
    - 新增 `sanChuanData` 状态与 `setSanChuanData`；
    - 新增 `buildTooltipContext()`，聚合 `getKe()` 与 `sanChuanData` 供悬浮使用。
  - `RengChart.js`：
    - 三传图计算后将 `cuangs` 回写到主六壬盘实例，保证悬浮读取到最新三传。
  - `SanShiUnitedMain.js`：
    - 六壬环悬浮调用增加 `liurengTipContext`（`keData.raw + sanChuan`）。

- 行为结果：
  - 六壬与三式合一中的六壬悬浮，均可直接看到四课与三传的地支/天将上下文，判断链更完整。

## 88) 四课/三传元素级悬浮提示（2026-02-28）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/liureng/KeChart.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/ChuangChart.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/RengChart.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`

- 结构变化：
  - `KeChart`：新增 `buildKeTipObj`，每课列绑定元素级 tooltip（地支/天将）。
  - `ChuangChart`：新增 `buildChuanTipObj` 与支提取逻辑，每传列绑定元素级 tooltip（地支/天将）。
  - `RengChart`：`drawGua2` 将 `divTooltip` 下发至 `KeChart/ChuangChart`。
  - `SanShiUnitedMain`：中宫四课列与三传行包裹 `wrapWithMeaning`，显示对应地支/天将信息。

- 行为结果：
  - 用户将鼠标放到四课/三传对应元素上时，弹出对应“地支+天将”提示；
  - 不再把该信息混入其他悬浮正文段落。

## 89) 四课/三传元素悬浮精细化映射（2026-02-28）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/liureng/KeChart.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/ChuangChart.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/RengChart.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`

- 结构变化：
  - `KeChart`：
    - 新增按元素映射的 tooltip 逻辑：
      - 天将 -> `buildLiuRengHouseTipObj`
      - 地支 -> `buildLiuRengShenTipObj`
    - 去掉整列统一提示，避免一个悬浮覆盖多个语义。
  - `ChuangChart`：
    - 三传上半区仅“地支位”挂接十二神释义；
    - 天将行挂接天将释义；
    - 六亲行保持无悬浮。
  - `RengChart`：
    - `drawGua2` 下发 `liuRengChart` 到 `KeChart` 供天将释义定位使用。
  - `SanShiUnitedMain`：
    - 中宫四课/三传从整列包裹改为单字符包裹：
      - 地支与天将字符可悬浮；
      - 天干与六亲字符不悬浮。

- 行为结果：
  - 鼠标停在“哪个元素”就显示“哪个元素”对应释义；
  - 不再出现整列同一提示或非目标元素弹出提示。

## 90) 三式合一后天十二宫悬浮标题去重（2026-02-28）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`

- 结构变化：
  - `buildOuterHouseMeaningTip`：
    - 合并分段时不再注入正文内 `N宫` 子标题（`title: ''`）；
    - 保留 tooltip 顶部标题作为唯一宫名显示。

- 行为结果：
  - 后天十二宫悬浮不再出现“宫名重复两次”；
  - 视觉上与用户期望一致（仅顶部显示宫名）。

## 91) 三式合一上升点简称调整（2026-02-28）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`

- 结构变化：
  - `shortMainStarLabel` 新增上升点简称映射：
    - `上升` -> `升`

- 行为结果：
  - 三式合一外圈星盘不再显示“上”，统一显示“升”。

## 92) 修复六壬四课/三传横线伪影（2026-02-28）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/liureng/KeChart.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/ChuangChart.js`

- 结构变化：
  - 元素级悬浮热区 `rect` 显式关闭描边：
    - `stroke: none`
    - `stroke-width: 0`

- 行为结果：
  - 去除四课地支区与三传干支区中部意外横线；
  - 保留元素级悬浮触发行为不变。

## 93) Horosa_Local 端口占用自动清理兜底（2026-02-28）

- 目标文件：
  - `Horosa_Local.command`

- 结构变化：
  - 新增函数：
    - `get_listener_pids(port)`：读取端口监听 PID 列表。
    - `is_horosa_web_listener(pid)`：识别是否为 Horosa 遗留 `http.server`（按命令行/工作目录判断）。
    - `cleanup_stale_horosa_web_listener(port)`：在启动前自动清理旧网页监听进程。
  - 启动 `[2/4]` 网页服务前流程调整：
    - 若端口已占用，先尝试清理可识别的 Horosa 残留进程；
    - 清理后仍占用则中止，并写入占用信息到诊断日志。

- 行为结果：
  - 关闭窗口后遗留的旧 `python -m http.server` 不再阻塞下次启动；
  - 对非 Horosa 进程保持保守，不误杀其他服务。

## 94) 稳定性回归修复（全页面冒烟后收敛）（2026-03-03）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/graph/D3Arrow.js`
  - `Horosa-Web/astrostudyui/src/components/graph/__tests__/D3Arrow.test.js`
  - `Horosa-Web/astrostudyui/src/components/astro3d/Astro3D.js`
  - `Horosa-Web/astrostudyui/src/components/amap/MapV2.js`
  - `Horosa-Web/astrostudyui/src/pages/document.ejs`

- 结构变化：
  - `D3Arrow`：
    - `marker.viewBox` 改为模板串 `0 0 ${width} ${height}`，修复此前字符串拼接少空格问题。
  - `graph/__tests__/D3Arrow.test.js`（新增）：
    - 新增 `viewBox` 格式校验，防止回归到非法 SVG 参数。
  - `Astro3D`：
    - 引入 `preferRemote` 源选择策略；
    - 在 `file://`、`localhost`、`127.0.0.1` 场景下，3D 资源优先使用远端模型地址，避免本地缺失模型的 404 噪音。
  - `MapV2`：
    - 为 `AMapLoader.load(...)` 增加 `catch` 兜底；
    - 新增可选 `onLoadError` 回调，地图 SDK 不可用时维持页面可交互。
  - `document.ejs`：
    - 新增内联 favicon，避免浏览器默认请求 `/favicon.ico` 造成额外报错。

- 行为结果：
  - 六壬/三式合一等图形页面中由 SVG marker 引起的批量 console error 被消除；
  - 本地部署环境的 3D 资源加载噪音显著减少（不再先打本地 404）；
  - 前端主框架在地图 SDK 不可达时维持稳定，不因未处理异常中断主要流程；
  - 全页面冒烟（16 顶层 tab + 嵌套 tab）后，错误量从大量内部错误收敛到外部依赖超时类告警。

## 95) 地图 AMapUI 本地降级 + 全页面零错误冒烟（2026-03-03）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/amap/amapUIHelper.js`（新增）
  - `Horosa-Web/astrostudyui/src/components/amap/MapV2.js`
  - `Horosa-Web/astrostudyui/src/components/amap/ACG.js`
  - `Horosa-Web/astrostudyui/src/components/amap/GeoCoord.js`
  - `Horosa-Web/astrostudyui/src/components/amap/GeoCoordSelector.js`
  - `Horosa-Web/astrostudyui/src/components/amap/PointsCluster.js`

- 结构变化：
  - `amapUIHelper.js`：
    - 新增 `canUseAMapUI()`：统一判定是否允许加载 AMapUI（本地 `file/localhost/127.0.0.1` 关闭）；
    - 新增 `safeLoadAMapUI(modules, onLoaded, onFallback)`：集中封装 AMapUI 安全加载与兜底。
  - `MapV2.js`：
    - `AMapLoader.load` 采用动态 `loadOpts`；
    - 仅在 `canUseAMapUI()` 且存在 `uiplugin` 时注入 `AMapUI` 配置。
  - `ACG/GeoCoord/GeoCoordSelector/PointsCluster`：
    - 原 `window.AMapUI.loadUI(...)` 全部替换为 `safeLoadAMapUI(...)`；
    - `GeoCoord` 增加 `setupFallbackMarker`，`SimpleMarker` 不可用时回退普通 marker。

- 行为结果：
  - 本地全页面冒烟不再出现 `Load timeout for modules: ui/control/BasicControl` 异常；
  - 地图类页面在本地离线/弱网环境不会因 AMapUI 依赖阻塞或报错；
  - 全站主流程保持可交互，避免白屏。

## 96) 再次全量稳定性自检（页面/技法/AI导出/算法）（2026-03-03）

- 目标范围：
  - 所有主页面与主技法可用性；
  - AI 导出与 AI 导出设置一致性；
  - 核心算法与本地运行链路稳定性。

- 本轮结构化检查链路：
  - 基础构建与单测：
    - `npm --prefix Horosa-Web/astrostudyui test -- --watch=false`
    - `npm --prefix Horosa-Web/astrostudyui run build:file`
  - 本地服务链路：
    - `Horosa-Web/start_horosa_local.sh`
    - `Horosa-Web/verify_horosa_local.sh`
    - `Horosa-Web/stop_horosa_local.sh`
  - 算法/API 快速体检：
    - `Horosa-Web/astrostudyui/.tmp_horosa_verify.js`
    - `Horosa-Web/astrostudyui/.tmp_horosa_perf_check.js`
  - AI 导出配置矩阵校验：
    - `Horosa-Web/astrostudyui/.tmp_ai_export_matrix_check.js`
  - 页面级巡检（Playwright 分批短会话）：
    - 覆盖 16 主页面：`星盘`、`三维盘`、`推运盘`、`量化盘`、`关系盘`、`节气盘`、`星体地图`、`七政四余`、`希腊星术`、`印度律盘`、`八字紫微`、`易与三式`、`万年历`、`西洋游戏`、`风水`、`三式合一`。

- 输出判定口径（本轮统一）：
  - 页面元素可点击（`clicked=true`）；
  - 页面根节点存在（`#root`）；
  - 无错误边界（`hasErrorBoundary=false`）；
  - 页面文本非空（`textLen>0`）；
  - 控制台 `error` 为 0（允许 3D fallback warning）。

- 结果摘要：
  - 16 主页面均满足上述可用性判定；
  - AI 导出矩阵检查全部 PASS；
  - 核心算法接口与本地链路检查通过；
  - 未发现新的白屏回归。

## 97) 3D fallback 稳定性收敛 + 本地窗口关闭回收修复（2026-03-03）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/astro3d/Astro3D.js`
  - `Horosa_Local.command`

- 结构变化：
  - `Astro3D.js`
    - 新增模型不可用状态缓存：
      - `ModelUnavailableAtKey = 'horosa3dModelUnavailableAt'`
      - `ModelUnavailableCooldown = 10 * 60 * 1000`
      - `getModelUnavailableAt / markModelUnavailableNow / clearModelUnavailableMark / shouldSkipModelLoad`
    - `init()` 加载流程新增短路逻辑：
      - 若 `shouldSkipModelLoad()` 命中，直接 `initMesh + initGUI`，跳过 GLTF 请求。
    - 失败/成功状态联动：
      - timeout 或所有来源失败时：`markModelUnavailableNow()`
      - 成功加载模型后：`clearModelUnavailableMark()`
    - fallback 日志等级下调：
      - timeout fallback、source fail、unavailable fallback 从 `console.warn` 调整为 `console.info`。
  - `Horosa_Local.command`
    - 退出信号捕获扩展为：
      - `trap cleanup EXIT INT TERM HUP`
    - 覆盖直接关闭终端窗口触发的 `SIGHUP`，确保进入 cleanup。

- 行为结果：
  - 三维盘在模型暂不可用时不再反复尝试加载，减少卡顿与噪音；
  - fallback 保持可用（简化模式）但不再占用 warning 通道；
  - 关闭启动终端窗口时，Horosa 本地服务可自动执行停止回收流程，减少残留进程与端口占用。

- 本轮验证结果：
  - 单测与构建：
    - `npm --prefix Horosa-Web/astrostudyui test -- --watch=false` 通过；
    - `npm --prefix Horosa-Web/astrostudyui run build:file` 通过。
  - 本地服务链路：
    - `start_horosa_local.sh + verify_horosa_local.sh + stop_horosa_local.sh` 通过。
  - 算法/导出检查：
    - `.tmp_horosa_verify.js` 通过；
    - `.tmp_ai_export_matrix_check.js` 全部 PASS；
    - `.tmp_horosa_perf_check.js` 返回有效结果。
  - 页面巡检（Playwright）：
    - 顶层 16 tab 自动点击均可渲染（无错误边界）；
    - 三维盘重复切换后，console warning/error 均为 0。

## 98) 最终全量终检（内容/页面/技法设置/AI导出）（2026-03-03）

- 目标范围：
  - 所有主内容页面；
  - 所有主技法入口及其设置入口；
  - AI 导出与 AI 导出设置；
  - 本地服务链路与核心算法脚本。

- 本轮结构化检查链路：
  - 构建与单测：
    - `npm --prefix Horosa-Web/astrostudyui test -- --watch=false`
    - `npm --prefix Horosa-Web/astrostudyui run build:file`
  - 服务与算法：
    - `Horosa-Web/start_horosa_local.sh`
    - `Horosa-Web/verify_horosa_local.sh`
    - `Horosa-Web/stop_horosa_local.sh`
    - `Horosa-Web/astrostudyui/.tmp_horosa_verify.js`
    - `Horosa-Web/astrostudyui/.tmp_ai_export_matrix_check.js`
    - `Horosa-Web/astrostudyui/.tmp_horosa_perf_check.js`
  - 页面与交互（Playwright）：
    - 顶层 16 页面全量点击可达性与渲染性检查；
    - 星盘子页签检查（信息/相位/行星/希腊点/可能性）；
    - 抽屉设置入口检查（小工具/星盘组件/行星选择/相位选择/批注）；
    - AI 导出设置与 5 个导出动作全链路执行。

- 结果摘要：
  - 16 顶层页面全部可进入、可渲染、无白屏；
  - 主技法设置入口均可打开/关闭，控件切换可执行；
  - AI 导出设置可保存，AI 导出五项动作可执行并返回正确提示；
  - 控制台 `error=0`，未出现错误边界；
  - 仅观测到 1 条外部地图 SDK Canvas 性能 warning（非功能故障）。

- 产物记录：
  - `/tmp/horosa_final_fullcheck_20260303.txt`
  - `/tmp/hf1_ui_scan_result.txt`
  - `/tmp/hf2_ai_actions_result.txt`
  - `/tmp/hf3_settings_result.txt`

## 99) 三式合一遁甲悬浮文案繁转简补全（2026-03-03）

- 目标文件：
  - `Horosa-Web/astrostudyui/src/components/dunjia/QimenXiangDoc.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/__tests__/QimenXiangDoc.test.js`

- 结构变化：
  - `QimenXiangDoc.js`
    - 安全繁转简映射补充：
      - `宮→宫`、`於→于`、`強→强`、`進→进`、`麗→丽`、`洩→泄`。
    - `parseQimenDoc()` 中 `text` block 入库改为统一 `toSafeSimplified(line)`：
      - 使 `buildQimenXiangTipObj` 返回给三式合一悬浮窗口的正文文本均为简体；
      - 复用同一数据源时，遁甲主盘与三式合一盘展示一致。
    - 保留精确字符策略：
      - 未加入 `乾→干` 映射，保证宫位干支中的 `乾` 不被误改。
  - 新增测试 `QimenXiangDoc.test.js`
    - 覆盖“门/星条目繁转简”与“乾字不误改”。

- 行为结果：
  - 三式合一盘遁甲悬浮正文中的剩余繁体被补齐为简体；
  - 文案转换更稳定，且不影响关键术语字形（如 `乾`）。

- 本轮验证结果：
  - `npm --prefix Horosa-Web/astrostudyui test -- --watch=false src/components/dunjia/__tests__/QimenXiangDoc.test.js` 通过；
  - `npm --prefix Horosa-Web/astrostudyui test -- --watch=false src/components/dunjia/__tests__/DunJiaCalc.test.js src/components/dunjia/__tests__/QimenXiangDoc.test.js` 通过。

## 100) 本地窗口关闭后后台残留回收增强（2026-03-03）

- 目标文件：
  - `Horosa_Local.command`
  - `Horosa-Web/stop_horosa_local.sh`

- 结构变化：
  - `Horosa_Local.command`
    - `cleanup()` 调整为：非常驻模式下（`HOROSA_KEEP_SERVICES_RUNNING!=1`）退出必执行 `stop_horosa_local.sh`；
    - 启动前固定执行一次残留清理，减少“上次异常退出”影响；
    - 后端启动失败时，若检测到 `8899/9999` 端口占用，自动回收残留并重试一次。
  - `stop_horosa_local.sh`
    - 新增 `kill_pid_gracefully()`，统一停止逻辑；
    - 在 pid 文件回收之外，新增端口监听兜底回收（按进程特征匹配）：
      - `8899`：`webchartsrv.py`
      - `9999`：`astrostudyboot.jar`
      - `8000`：`http.server.*astrostudyui/(dist|dist-file)`

- 行为结果：
  - 用户直接关闭终端窗口后，即便 pid 文件丢失，下一次运行也可自动回收典型残留进程；
  - 对应 `port 9999 is already in use` 的常见场景可自动自愈。

- 本轮验证结果：
  - `bash -n Horosa_Local.command` 通过；
  - `bash -n Horosa-Web/stop_horosa_local.sh` 通过；
  - `Horosa-Web/stop_horosa_local.sh` 实测可回收无 pid 文件残留监听进程；
  - `cd Horosa-Web && HOROSA_SKIP_UI_BUILD=1 ./start_horosa_local.sh && ./stop_horosa_local.sh` 通过。

## 101) 主限法双内核结构（2026-03-05）

- 后端入口：
  - `Horosa-Web/astropy/astrostudy/perchart.py`
    - 新增并承载：
      - `pdMethod`
      - `pdTimeKey`
    - 默认值：
      - `pdMethod='astroapp_alchabitius'`
      - `pdTimeKey='Ptolemy'`
  - `Horosa-Web/astropy/astrostudy/perpredict.py`
    - `getPrimaryDirectionByZ()` 改为双分流：
      - `horosa_legacy`
      - `astroapp_alchabitius`

- 双分流定义：
  - `horosa_legacy`
    - 结构上等同原版 Horosa `zodiaco主限法`：
      - `PrimaryDirections(chart).getList(self.perchart.pdaspects)`
      - 仅保留 `item[3] == 'Z'`
  - `astroapp_alchabitius`
    - 结构上为 AstroApp 对齐内核：
      - Significators：
        - `SIG_OBJECTS + SIG_HOUSES + SIG_ANGLES`
      - Promissors：
        - `SIG_OBJECTS(aspects)`
        - `terms`
      - 不包含：
        - `antiscia`
        - `contra-antiscia`
        - 即不包含页面所称“映点 / 反映点”
      - Arc：
        - 普通应星：
          - `norm180(sig.ra - prom.raZ)`
        - `Asc`：
          - `norm180(OA_zero(prom, true_obliquity - 0.0014°) - OA_zero(Asc, true_obliquity) - asc_case_bias(chart))`
        - `MC`：
          - `norm180(prom.raZ - MC.raZ)`
        - `Pars Fortuna`：
          - 当前仍先走普通应星分支，专用分支继续逆向中
      - 行过滤：
        - 去掉 Node
        - 去掉同对象
        - 去掉 `|arc| > 100`
        - 普通行星对额外套 AstroApp 显示窗
      - 排序：
        - `(|arc|, arc, prom_id, sig_id)`

- 日期换算：
  - `Horosa-Web/astropy/astrostudy/signasctime.py`
    - `getJDFromPDArc()`
      - 使用“周年日 + 年跨度插值”而不是固定回归年常数直乘；
      - converse 使用 `abs(arc)`；
    - `getDateFromPDArc()`
      - 使用 UTC 风格输出字符串，贴近 AstroApp `dirDate`。

- 输出结构：
  - 主限法行仍维持 5 元组：
    - `arc`
    - `promittor_id`
    - `significator_id`
    - `'Z'`
    - `date_str`
  - `Horosa-Web/astropy/astrostudy/helper.py`
    - `chartObj.params` 现明确返回：
      - `pdMethod`
      - `pdTimeKey`
  - 逆向现状：
    - `Asc / MC` 已从普通通用核中拆成角点专用分支；
    - `Pars Fortuna` 仍是当前未完全闭合的剩余对象；
    - PF 的昼夜判定后续统一按“太阳在地平线以上/以下”定义。

## 102) 主限法前端与导出链路（2026-03-05）

- 设置与状态：
  - `Horosa-Web/astrostudyui/src/models/app.js`
    - 全局设置持久化新增：
      - `pdMethod`
      - `pdTimeKey`
    - 登录态与无登录态都会恢复到 `astro.fields`
  - `Horosa-Web/astrostudyui/src/models/astro.js`
    - `fieldsToParams()` 会把：
      - `pdMethod`
      - `pdTimeKey`
      发给后端排盘

- 主限法页面：
  - `Horosa-Web/astrostudyui/src/components/direction/AstroDirectMain.js`
    - 新增 `applyPrimaryDirectionConfig(pdMethod, pdTimeKey)`；
    - 页面提供：
      - `推运方法`
      - `度数换算`
      - `计算`
    - 子组件渲染使用 `chartObj.params.pdMethod / pdTimeKey` 作为“已应用方法”；
    - 避免出现“左列按待应用值、右侧三列按旧结果”导致的假切换。
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
    - `Horosa原方法`：
      - 第一列标题 `赤经`
    - `AstroAPP-Alchabitius`：
      - 第一列标题 `Arc`
    - 主限法表格 remount key 现包含：
      - `chartId`
      - `pdMethod`
      - `pdTimeKey`
      - `showPdBounds`
    - 避免切换 `度数换算` 后继续复用旧表格行缓存
    - 顶部设置条改为响应式布局：
      - 窄宽度或浏览器缩放后可自动换行
      - `Select` 不再被固定宽高挤坏
      - `计算` 按钮会跟随容器宽度伸缩，而不是保持僵硬固定尺寸
    - 页面底部高度受控，表格在自身容器内滚动，不外溢窗口。

- AI 导出：
  - `Horosa-Web/astrostudyui/src/components/direction/AstroDirectMain.js`
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - 主限法快照新增 `[主/界限法设置]`，导出：
    - `推运方法`
    - `度数换算`
    - `显示界限法`
  - AI 导出设置 `primarydirect` 预设分段：
    - `出生时间`
    - `星盘信息`
    - `主/界限法设置`
    - `主/界限法表格`
  - 导出时优先触发：
    - `requestModuleSnapshotRefresh('primarydirect')`
  - 所以导出的主限法文本默认跟随当前已应用的：
    - `pdMethod`
    - `pdTimeKey`
    - `showPdBounds`
  - 表格第一列标题随方法切换：
    - `赤经`
    - `Arc`

- 文档入口：
  - 新增根目录文档：
    - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
    - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_MATH_FLOW.md`
  - 该文档用于完整描述 AstroApp 复刻核：
    - 行结构
    - Arc 公式
    - 显示过滤
    - 日期换算
    - 最小复刻伪代码
    - 回归脚本与统计结果
  - 数学版文档补充：
    - 纯数学符号定义
    - `ra / raZ` 的坐标含义
    - 各类对象构造公式
    - `dirJD` 推导
    - 流程图

## 103) AstroAPP-Alchabitius shared-core 对齐现状（2026-03-05 晚）

- 仅影响 AstroApp 选项：
  - `Horosa-Web/astropy/astrostudy/perchart.py`
  - `Horosa-Web/astropy/astrostudy/perpredict.py`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
  - `Horosa-Web/astrostudyui/src/components/direction/AstroDirectMain.js`
  - `Horosa-Web/astrostudyui/src/models/app.js`
  - `Horosa-Web/astrostudyui/src/models/astro.js`
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
- 当前 AstroApp kernel 的 shared-core 对象集：
  - promissor：`Sun..Pluto + North Node`
  - significator：`Sun..Pluto + North Node + Asc + MC`
- 当前 AstroApp kernel 明确排除：
  - `界 / Terms / Bounds / T_*`
  - `Pars Fortuna`
  - `Dark Moon`
  - `Purple Clouds`
  - `South Node`
  - 其它 AstroApp 不支持的扩展虚点
- 当前关键数学口径：
  - `North Node` 使用 `TRUE_NODE`
  - 普通对象与 `MC` 使用日期 `mean obliquity`
  - `Asc` 的 significator zero-lat OA 分支使用日期 `true obliquity`
  - `Asc` 的 promissor zero-lat OA 额外使用 `true obliquity - 0.0014°`
  - `Asc` 另有 chart-level `asc_case_bias(chart)` 修正，只对 `AstroAPP-Alchabitius` 的 `Asc` 行生效
  - 验证口径使用 `utc_sourcejd_exact`
- 前端主/界限法页：
  - `Horosa-Web/astrostudyui/src/components/direction/AstroDirectMain.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
  - 当前 `推运方法` 切换会强制按 `pdtype=0` 重算，并在结果返回后整表 remount，避免出现“只更新左列标题、右侧三列仍是旧结果”的假切换
- 本地验证与产物：
  - `scripts/compare_pd_backend_rows.py`
  - `scripts/compare_pd_backend_random.py`
  - `runtime/pd_reverse/shared_core_kernel100_exact_summary.json`
  - `runtime/pd_reverse/shared_core_hard200_exact_summary.json`
  - `runtime/pd_reverse/shared_core_geo300_exact_summary.json`
  - `runtime/pd_reverse/virtual_points_geo300_chart_summary.json`
- 配套实现文档：
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_MATH_FLOW.md`

### 103.1) 虚点残差的最新诊断与稳定修正（2026-03-06）

- 新增实验脚本：
  - `scripts/eval_virtual_point_kernels.py`
- 该脚本沿用 duplicate-safe 配对逻辑，专门评估：
  - `Asc`
  - `MC`
  - `North Node`
- 诊断结论：
  - 当前虚点残差的主要来源，不是 `Asc / MC / Node` 的主限弧公式主体跑偏；
  - 更像是 promissor 本体坐标与 AstroApp `chartSubmit` 本体坐标之间仍有细小差异；
  - 其中 `Moon` 的本体黄经差异最大，因此 `Moon -> Asc / MC / North Node` 是最差桶。
- 现已落地的稳定修正：
  - `Horosa-Web/astropy/astrostudy/perpredict.py`
  - 当前 production 已收窄为只对 `Moon -> Asc` 生效：
    - promissor 月亮本体改用 Swiss `FLG_TRUEPOS` 重建，再构造相位点
  - `Moon -> MC` 与 `Moon -> North Node` 都没有启用该修正：
    - 因为它在 `runtime/pd_auto/run_geo_wide240_v7` 上出现轻微回退
- 现有验证产物：
  - `runtime/pd_reverse/virtual_kernel_geo300_summary.json`
  - `runtime/pd_reverse/virtual_kernel_wide240_summary.json`
  - `runtime/pd_reverse/virtual_kernel_run200_login_v1_summary.json`
  - `runtime/pd_reverse/shared_core_geo300_exact_summary_vmoon2.json`
  - `runtime/pd_reverse/shared_core_geo_wide240_v7_exact_summary_vmoon2.json`
- 当前稳定收益：
  - `geo300`
    - `Asc`: `0.0010408782 -> 0.0010258268`
    - `North Node`: `0.0003763461 -> 0.0003560969`
  - `wide240_v7`
    - `Asc`: `0.0016621602 -> 0.0016548058`
    - `North Node`: `0.0005635118 -> 0.0005610257`
- 上界诊断也已确认：
  - 若 promissor 本体位置直接替换为 AstroApp `chartSubmit` 返回的本体位置，
    `Asc / MC / North Node` 都还能继续大幅下降；
  - 所以后续如果要逼近 `0.0001°`，重点应转向 AstroApp 本体星历口径，而不是继续大改虚点方向公式。

### 103.4) Asc promissor-side OA 微调（2026-03-06）

- 在 `Horosa-Web/astropy/astrostudy/perpredict.py` 新增：
  - `ASTROAPP_PD_ASC_PROM_TRUE_OBLIQUITY_OFFSET = -0.0014`
  - `ASTROAPP_PD_ASC_CASE_CORR_MODEL`
- 当前 `Asc` 生产口径：
  - promissor side 的 zero-lat OA 使用 `true obliquity - 0.0014°`
  - significator side 仍使用原始 `true obliquity`
  - 在此基础上，再减去一个只与 natal chart 几何有关的 `asc_case_bias(chart)` 小修正
- `asc_case_bias(chart)` 资源与训练入口：
  - 模型文件：`Horosa-Web/astropy/astrostudy/models/astroapp_pd_asc_case_corr_et_v1.joblib`
  - 元数据：`Horosa-Web/astropy/astrostudy/models/astroapp_pd_asc_case_corr_et_v1.json`
  - 训练脚本：`scripts/train_astroapp_asc_case_correction.py`
- 这层修正只作用于 `Asc`：
  - 不改 `MC`
  - 不改 `North Node`
  - 不改已稳定的 planet-to-planet
- 新验证产物：
  - `runtime/pd_reverse/shared_core_run200_login_exact_summary_v5.json`
  - `runtime/pd_reverse/shared_core_geo300_exact_summary_v11.json`
  - `runtime/pd_reverse/shared_core_run200_login_exact_rows_v5.csv`
  - `runtime/pd_reverse/shared_core_geo300_exact_rows_v11.csv`
- 当前稳定收益：
  - `run200_login`
    - `shared_core arc_mae: 0.0002465703 -> 0.0002213291`
    - `Asc arc_mae: 0.0006206678 -> 0.0003325791`
    - `North Node arc_mae: 0.0000998902 -> 0.0000988982`
  - `geo300`
    - `shared_core arc_mae: 0.0002415835 -> 0.0002217847`
    - `Asc arc_mae: 0.0006037416 -> 0.0003879265`
    - `North Node arc_mae: 0.0001004009 -> 0.0000994236`
  - `MC ≈ 3.06e-05°`
  - `North Node < 1.00e-04°`

### 103.3) 当前 AstroApp 口径再确认（run200_login，2026-03-06）

- 新验证产物：
  - `runtime/pd_auto/run200_login`
  - `runtime/pd_reverse/virtual_kernel_run200_login_v1_summary.json`
- 结论更新：
  - 当前 AstroApp 登录态样本的行为更接近 `geo300`，而不是 `wide240_v7`
  - `run200_login` 中本地图盘 `Asc / MC` 角度本体与 AstroApp `chartSubmit` 本体几乎重合：
    - `Asc mae ≈ 0.0000257°`
    - `MC mae ≈ 0.0000261°`
  - 因此 `wide240_v7` 体现出的整张图盘角度偏移，更像旧批次或异常批次，不应继续主导当前生产实现
- 当前 AstroApp 口径下的虚点行结果：
  - `Asc`: `arc_mae ≈ 0.0009593°`
  - `MC`: `arc_mae ≈ 0.0001460°`
  - `North Node`: `arc_mae ≈ 0.0001624°`
- 进一步拆解：
  - `Asc` 的剩余误差来自 promissor 本体经度，不来自 promissor 黄纬
  - 默认 Swiss `apparent` 已是 `Sun..Pluto` 最接近 AstroApp 的口径
  - `Moon` 仍然是唯一 `TRUEPOS` 比默认 `apparent` 更接近 AstroApp 的对象
- 因此后续方向应收敛为：
  - 不再围绕 `wide240_v7` 调整生产口径
  - 若继续压低 `Asc`，优先追 promissor apparent longitude 口径

### 103.2) 本地星历精度排查与可选 JPL 入口（2026-03-06）

- 当前本地星历现状：
  - `Horosa-Web/flatlib-ctrad2/flatlib/ephem/__init__.py`
  - `Horosa-Web/flatlib-ctrad2/flatlib/ephem/swe.py`
  - 默认星历路径指向 `Horosa-Web/flatlib-ctrad2/flatlib/resources/swefiles`
  - 默认 flag 为 `FLG_SWIEPH | FLG_SPEED`
  - 因此当前并非 Moshier，而是 Swiss Ephemeris `.se1`
- 新增运行时切换入口：
  - `Horosa-Web/flatlib-ctrad2/flatlib/ephem/swe.py`
  - 现支持：
    - `HOROSA_SWISSEPH_MODE=SWIEPH|JPL|MOSEPH`
    - `HOROSA_SWISSEPH_JPL_FILE=/abs/path/to/de440.eph` 或相对 `swefiles/` 路径
  - 现可通过 `getRuntimeConfig()` 读取当前 active path / mode / default flag / JPL file
- 新增本地自检脚本：
  - `scripts/check_local_ephemeris_precision.py`
  - 用途：
    - 输出当前 runtime ephemeris 配置
    - 采样 `SWIEPH / MOSEPH / JPL(若可用)` 的 `lon / lat / ra / decl`
    - 供后续拿到 JPL `.eph` 后直接复跑本地主限法误差对比
- 当前结论：
  - 机器本地未发现 `de406 / de431 / de440 / de441` 等 JPL 文件；
  - 所以“提升本地星历精度”的下一步，不是继续改 arc 公式，而是补入 JPL `.eph` 后再用同一批 case 复测。

### 103.4) current540 对象级 body correction（2026-03-06）

- 新增训练脚本：
  - `scripts/train_astroapp_virtual_body_corrections.py`
- 新增运行时模型：
  - `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_sun_v1.joblib`
  - `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_moon_v1.joblib`
  - `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_mercury_v1.joblib`
  - `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_venus_v1.joblib`
  - `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_mars_v1.joblib`
  - `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_jupiter_v1.joblib`
  - `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_saturn_v1.joblib`
  - `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_uranus_v1.joblib`
  - `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_neptune_v1.joblib`
  - `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_pluto_v1.joblib`
- 运行时接入点：
  - `Horosa-Web/astropy/astrostudy/perpredict.py`
  - 新增：
    - `ASTROAPP_PD_VIRTUAL_BODY_CORR_MODELS`
    - `_astroappLoadVirtualBodyCorrectionModel()`
    - `_astroappVirtualBodyCorrectionFeatures()`
    - `_applyAstroAppPromissorBodyModelCorrection()`
- 当前用途：
  - 只作用于 `AstroAPP-Alchabitius` 的虚点 significator 行：
    - `Asc`
    - `MC`
    - `North Node`
  - `North Node` 仍保留 true-node 本体逻辑，不走单独 node body model。
- current540 full-fit 虚点专项结果：
  - `Asc arc_mae = 0.0009919653`
  - `MC arc_mae = 0.0004144498`
  - `North Node arc_mae = 0.0001155451`
  - 三者都满足 `< 0.001°`

### 103.5) 主限法服务层传参与本地一键自检（2026-03-06）

- Java 控制器补齐 `pdMethod / pdTimeKey` 透传：
  - `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/ChartController.java`
  - `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/QueryChartController.java`
  - `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/IndiaChartController.java`
  - `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/PredictiveController.java`
- 同一轮还补了内部 `_wireRev=pd_method_sync_v2` 请求版本号：
  - 作用是让 `/chart`、`/qry/chart`、`/india/chart`、`/predict/pd` 相关缓存整体失效一次
  - 避免升级后还命中旧缓存，导致运行态 `/chart.params` 里看不到 `pdMethod / pdTimeKey`
- 作用：
  - 之前 `pdMethod / pdTimeKey` 主要只在 Python 内核层和前端状态层存在；
  - 现在通过 Java `/chart` 和 `/predict/pd` 控制器也会继续向下透传；
  - 因此 Horosa 网站里切换 `AstroAPP-Alchabitius / Horosa原方法` 时，整站真正换的是后端算法，不是只改前端显示或 AI 导出标签。
- 新增运行时主限法验收脚本：
  - `Horosa-Web/astrostudyui/scripts/verifyPrimaryDirectionRuntime.js`
  - 直接请求本地 `http://127.0.0.1:9999`
  - 同时验证：
    - `/chart`
    - `/predict/pd`
    - `astroapp_alchabitius`
    - `horosa_legacy`
  - 并断言：
    - `params.pdMethod / params.pdTimeKey` 返回值正确
    - 两条方法链各自有结果
    - `/chart` 与 `/predict/pd` 同方法输出一致
    - 新旧两种方法的前导 rows 不相同
- `Horosa-Web/verify_horosa_local.sh` 现已扩展为：
  - 先跑原有 UI 代码静态校验
  - 再跑主限法 runtime 验收脚本
- 新增根目录自检入口：
  - `Horosa_SelfCheck_Mac.command`
  - 对应实现：`scripts/mac/self_check_horosa.sh`
  - 用于“别人 Mac 一键部署后”的本地验收：
    - 若服务没启动则用 `HOROSA_NO_BROWSER=1 + HOROSA_KEEP_SERVICES_RUNNING=1` 拉起
    - 执行 `Horosa-Web/verify_horosa_local.sh`
    - 自检结束后自动停止本次启动的服务
    - 若默认端口已被其他副本占用，则自动改用空闲端口

### 103.6) Horosa 整站静态接线 + 运行时 smoke check（2026-03-06）

- 静态断言脚本：
  - `scripts/check_horosa_full_integration.py`
  - 用途：
    - 检查首页顶层 tabs 与 `predictHook` 接线
    - 检查 `八字紫微 / 易与三式` 子 tabs
    - 检查模块级 AI snapshot 保存/读取
    - 检查 `AI_EXPORT_TECHNIQUES / AI_EXPORT_PRESET_SECTIONS / requestModuleSnapshotRefresh`
- 运行时 smoke 脚本：
  - `Horosa-Web/astrostudyui/scripts/verifyHorosaRuntimeFull.js`
  - 用途：
    - 直接调用本地 `127.0.0.1:9999`
    - 对整站核心模块做接口级形状断言
    - 当前覆盖：
      - `/chart`
      - `/chart13`
      - `/india/chart`
      - `/location/acg`
      - `/modern/relative`
      - `/germany/midpoint`
      - `/predict/pd`
      - `/predict/profection`
      - `/predict/solararc`
      - `/predict/solarreturn`
      - `/predict/lunarreturn`
      - `/predict/givenyear`
      - `/predict/zr`
      - `/nongli/time`
      - `/jieqi/year`
      - `/bazi/direct`
      - `/ziwei/birth`
      - `/ziwei/rules`
      - `/liureng/gods`
      - `/liureng/runyear`
      - `/gua/desc`
      - `/common/pithy`
      - `/common/gong12`
      - `/calendar/month`
- `Horosa-Web/verify_horosa_local.sh`
  - 已升级为整合：
    - 旧 UI 校验
    - 主限法 runtime 校验
    - 整站 runtime smoke
    - 主限法 Python 校验
    - 整站静态 Python 校验

### 103.7) AstroAPP-Alchabitius 主限法生产实现记录（2026-03-06）

- 实现说明文档：
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
  - 用途：
    - 记录 Horosa 当前生产版 `AstroAPP-Alchabitius` 的完整工程实现
    - 明确区分：
      - 主公式
      - True Node 重建
      - 动态 obliquity
      - 虚点 promissor 修正层
      - 前端 / AI 导出 / 服务层透传
- 数学版文档：
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_MATH_FLOW.md`
  - 用途：
    - 单独记录当前生产版数学骨架与流程图
    - 明确当前结果不是“纯公式版”，而是“公式 + 工程修正层”
- 训练与验证脚本：
  - `scripts/train_astroapp_virtual_body_corrections.py`
  - `scripts/train_astroapp_asc_case_correction.py`
  - `scripts/check_primary_direction_astroapp_integration.py`
  - `scripts/compare_pd_backend_rows.py`
  - `scripts/check_horosa_full_integration.py`
    - 额外覆盖：
      - 普通星盘右栏 `信息/相位/行星/希腊点/可能性`
      - 3D盘右栏 `信息/相位/行星/希腊点`
      - 希腊星术 `十三分盘`
      - 印度律盘 `命盘 + 多律盘`
      - 节气盘 `二十四节气 + 各节气星盘/宿盘/3D盘`
      - 星体地图 `行星地图`
      - 推运盘右栏全部技术页签
- 生产模型目录：
  - `Horosa-Web/astropy/astrostudy/models/`
  - 当前包含：
    - `astroapp_pd_virtual_body_corr_*.joblib`
    - `astroapp_pd_asc_case_corr_et_v1.joblib`
    - `astroapp_pd_asc_case_corr_et_v1.json`
- 说明：
  - 要在别人的 Mac 上“原模原样”复刻当前 Horosa 的 AstroApp 近似主限法，不能只复制 `perpredict.py`；
  - 还必须同时带上：
    - `models/` 目录
    - 前端主限法接线
    - Java 服务层透传
    - AI 导出链路
    - 自检脚本
  - 2026-03-06 下午又补了一层运行态同步要求：
    - `fieldsToParams()` 必须显式透传 `pdtype`
    - `AstroDirectMain.applyPrimaryDirectionConfig()` 必须用 `cache: false` 强制重算
    - `AstroPrimaryDirection` 必须把 `chart.params.pdtype !== 0` 视为未同步状态
    - `verifyPrimaryDirectionRuntime.js` / `check_primary_direction_astroapp_integration.py` 必须断言表格直接显示后端 `pd[0]/pd[1]/pd[2]/pd[4]`
    - 否则会出现“后端是对的，但页面还在显示旧 rows”的假偏差
  - 同一天又补了服务常驻要求：
    - `start_horosa_local.sh` 必须保证 `8899/9999` 在外层脚本退出后仍继续运行
    - `self_check_horosa.sh` 默认不能在验收结束后自动把它自己拉起的服务停掉
    - 否则用户页面还在，但主限法一点击 `计算` 就会报 `127.0.0.1:8899` 未就绪
  - 同一天又补了多副本隔离要求：
    - `stop_horosa_local.sh` 的兜底端口回收必须校验进程命令行属于当前工作区 `ROOT`
    - 否则另一份 Horosa 副本在同机执行清理时，会把当前副本的 8000/8899/9999 服务误停
  - 随后又补了多副本验收要求：
    - `self_check_horosa.sh` 不能再写死 `8899/9999/8000`
    - 若这些端口正被另一份副本占用，自检必须自动切到空闲端口而不是直接失败

### 103.8) Windows Codex 主限法复现包（2026-03-06）

- 根目录新目录：
  - `WINDOWS_CODEX_ASTROAPP_PD_REPRO_KIT/`
- 目标：
  - 让 Windows 上的 Codex 不需要重新研究算法，只依赖这个文件夹就能把当前 Mac 生产版 `AstroAPP-Alchabitius` 主限法准确搬到 Windows 仓库。
- 包内结构：
  - `README_FIRST.md`
    - 给人看的超详细复现说明
  - `WINDOWS_CODEX_TASK_PROMPT.md`
    - 直接交给 Windows Codex 的任务提示
  - `FILE_MANIFEST.md`
    - 文件清单与用途
  - `SHA256SUMS.txt`
    - 包内文件哈希校验
  - `reference_docs/`
    - 当前生产版主限法实现记录、数学版、结构说明、升级日志
  - `expected_results/`
    - 当前生产版关键结果摘要 JSON
  - `snapshot/`
    - 当前生产版关键代码快照、模型文件、Java/前端/验证脚本
- 关键意义：
  - `snapshot/` 下不仅有 Python 主限法算法文件，还包含：
    - `models/` 二进制模型
    - 前端主限法与 AI 导出接线
    - Java 控制器透传
    - 本地主限法/整站验证脚本
  - 因此 Windows Codex 可直接按相对路径复刻，而不是根据文档二次猜测实现。

### 103.9) AstroApp 主限法完整逆向推理总文档（2026-03-06）

- 根目录文档：
  - `ASTROAPP_ALCHABITIUS_PTOLEMY_REVERSE_ENGINEERING_FULL_PROCESS.md`
- 目标：
  - 把本地如何一步步推理 AstroApp 当前网站 `Alchabitius + Ptolemy` 主限法的全过程单独写成一份长文档
  - 不只写最终公式，还写：
    - 抓数对象
    - 对比策略
    - 每轮误差如何指向下一步
    - 早期错误方向为什么被排除
    - `TRUE_NODE / dynamic obliquity / Asc OA / body correction / display window / sourceJD exact` 各自是怎么被确认的
    - 最终 Horosa 如何接到前端、Java 透传、AI 导出和验证脚本
- 配套关系：
  - 它是顶层“全过程总文档”
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md` 更偏生产实现说明
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_MATH_FLOW.md` 更偏数学骨架与流程图

### 103.10) runtime 精简为主限法最小可运行/可验收集合（2026-03-06）

- 当前 `runtime/` 不再保留早期逆向阶段的全部大样本与中间 CSV。
- 现仅保留：
  - `runtime/mac/`
  - `runtime/pd_auto/run_geo_current540_v1`
  - `runtime/pd_auto/plan_geo_current540_v1.csv`
  - `runtime/pd_reverse/shared_core_geo_current540_s100_exact_rows_bodycorr.csv`
  - `runtime/pd_reverse/shared_core_geo_current540_s100_exact_summary_bodycorr.json`
  - `runtime/pd_reverse/stability_production_summary.json`
  - `runtime/pd_reverse/virtual_only_geo_current540_fullfit_summary.json`
  - `runtime/pd_reverse/shared_core_geo_current120_v2_exact_summary.json`
- 目的：
  - 让本地网站运行、主限法自检、整站自检仍然可用
  - 同时把逆向阶段产生的 20G+ 中间产物清理掉

### 103.11) AstroApp 主限法公开整理稿（2026-03-06）

- 根目录文档：
  - `ASTROAPP_ALCHABITIUS_PTOLEMY_REVERSE_ENGINEERING_PUBLIC_EDITION.md`
- 定位：
  - 这是在完整逆向记录文档基础上整理出来的公开发布版
  - 保留工程推理、证据层、关键常量、实现接线与验证结果
  - 但把原本偏实验笔记的写法改写为“摘要 - 问题定义 - 证据 - 推理 - 实现 - 验证 - 结语”的正式文章结构
- 与其它文档的关系：
  - `ASTROAPP_ALCHABITIUS_PTOLEMY_REVERSE_ENGINEERING_FULL_PROCESS.md` 保留原始全过程痕迹，更适合内部研究和追索
  - `ASTROAPP_ALCHABITIUS_PTOLEMY_REVERSE_ENGINEERING_PUBLIC_EDITION.md` 更适合对外公开发布
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md` 仍是最贴近生产代码的实现说明

### 103.12) AstroAPP 主限法浏览器一致性修复（2026-03-06）

- 这轮修复不是改主限法数学，而是改浏览器运行态一致性：
  - `astrostudyui/src/models/astro.js`
    - `pdtype` 默认值统一为 `0`
  - `astropy/websrv/webchartsrv.py`
  - `astropy/astrostudy/helper.py`
    - `/chart` 返回的 `params` 补齐 `pdtype` 和 `showPdBounds`
  - `astrostudysrv/astrostudy/.../AstroUser.java`
  - `astrostudysrv/astrostudy/.../UserInfoController.java`
    - Java 侧主限法类型默认值统一为 `0`
- 目的：
  - 避免页面标题显示 `AstroAPP-Alchabitius`，但实际请求还是 `mundo主限法(pdtype=1)`。
- 当前浏览器验收基准样本：
  - 广德盘 `2006-10-04 09:58 +08 / 30n53 / 119e25`
- 浏览器取证文件：
  - `runtime/guangde_after_select_browser.json`
  - `runtime/guangde_after_select_browser.png`
- 这组取证用于证明：
  - 用户浏览器第一页看到的主限法表格，已经重新和 AstroApp 当前网页的广德样本保持同一批结果。

### 103.13) AstroAPP 主限法同步判定加固（2026-03-06）

- `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
  - 主限法页面顶部“已同步 / 重新计算”的最终判定逻辑
  - 当前要求后端返回 `pdMethod / pdTimeKey / pdtype / pdSyncRev` 四项齐全，前端才允许进入 `已同步`
- `Horosa-Web/astropy/websrv/webchartsrv.py`
  - `/chart` 返回 `params.pdSyncRev = 'pd_method_sync_v4'`
- `Horosa-Web/astropy/astrostudy/helper.py`
  - helper 生成的 chart object 同步返回 `pdSyncRev`
- `runtime/guangde_main_repo_browser_check.png`
- `runtime/guangde_main_repo_browser_check.json`
  - 这轮加固后再次用广德盘做浏览器实测的证据文件

### 103.14) 桌面打包版主限法与主仓库重新对齐（2026-03-06）

- 目标：
  - 确保桌面打包目录 `Horosa-Web+App (Mac)` 里的 `AstroAPP-Alchabitius` 主限法，与主仓库当前生产实现完全一致。
  - 重点验证样本：
    - 广德盘 `2006-10-04 09:58 +08 / 30n53 / 119e25 / guangde`
- 本轮同步的关键文件：
  - `Horosa-Web/astropy/astrostudy/helper.py`
  - `Horosa-Web/astropy/websrv/webchartsrv.py`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
  - `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/ChartController.java`
  - `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/QueryChartController.java`
  - `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/PredictiveController.java`
  - `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/IndiaChartController.java`
- 关键约束：
  - 主限法同步修订号统一为 `pd_method_sync_v4`
  - 桌面包 Java `/chart` 也必须跟着升级 `_wireRev`，否则会继续命中旧版主限法缓存/旧编译产物
- 桌面包取证文件：
  - `runtime/guangde_pkg_browser_check.png`
  - `runtime/guangde_pkg_browser_check.json`
- 这两份取证证明：
  - 桌面包浏览器页面实际打的是桌面包自己的 `/chart`
  - 用户看到的第一页表格已经重新和桌面包后端 `AstroAPP-Alchabitius` 结果一致
  - 广德盘前几行重新对回：
    - `-0度4分 / 2006-10-25 10:54:14`
    - `0度21分 / 2007-02-11 16:06:12`
    - `-0度48分 / 2007-07-23 11:01:34`
    - `0度57分 / 2007-09-14 13:37:20`
    - `1度33分 / 2008-04-21 15:49:15`
