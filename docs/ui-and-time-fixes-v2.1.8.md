# v2.1.8 — UI 几何/明暗修复 + 太乙四柱时间 + 主限推运年数 + Ollama 流式

本版集中修复一批 UI/术数显示问题与 AI 分析流式问题。下表标注每项是否需要重编 `astrostudyboot.jar`。

| 项 | 改动文件 | 是否重编 jar |
|---|---|---|
| 各盘符号几何居中 | `astrostudyui/src/components/astro/{AstroChartCircle,AstroHelper}.js` | 否(纯前端) |
| 太乙四柱随时间基准+两时间 | `astrostudyui/src/components/taiyi/{TaiYiCalc,TaiYiMain}.js` | 否(纯前端) |
| 主限法 表头/页码/去core | `astrostudyui/src/layouts/app.less`、`components/astro/{AstroPrimaryDirection,AstroPrimaryDirectionChart}.js` | 否 |
| 主限法 推运年数控件 | 前端 `AstroDirectMain.js`/`AstroPrimaryDirection.js`;后端 `astropy/.../perchart.py`+`perpredict.py`;Java `PredictiveController.java` | **是**(Java 白名单 pdYears) |
| Ollama 流式不中断 | Java `boundless/.../SseHelper.java`、`astrostudy/.../AIAnalysisProxyService.java` | **是** |
| 紫微空白条/三合神煞/合盘明亮/配置溢出/菜单精简 | `astrostudyui/src/layouts/app.less`、各前端组件 | 否 |

> 本版 Java 改了 `boundless`(SseHelper)与 `astrostudy`(AIAnalysisProxyService、PredictiveController),已用 JDK17 重编并验证(`pdYears` 进入 boot jar、SseEmitter=0L)。Windows 端务必重编 `astrostudyboot.jar`。

## 1. 各盘符号几何上偏(根因级)
- 根因:`AstroChartCircle`/`AstroHelper` 的所有图表文字用 `dominant-baseline:"middle"`。对天文符号字体,`middle` 对齐到 x-height 中线而非几何中心,导致符号整体上偏(实测 ~7.9px @24px)。
- 改动:把这两个文件里全部 `dominant-baseline","middle"` → `"central"`(central 按字体几何中心对齐)。`AstroChartCircle` 是占星/合盘共享渲染器、`AstroHelper` 是共享绘制助手,故覆盖占星(清简+经典)/合盘/辅盘/主限法盘等所有西洋盘。
- 验证:占星清简盘 12 星座质心 deltaY 由 -7.9 → 0;盘内 143 文字全部 central。

## 2. 太乙四柱随时间基准 + 同时显示两时间
- 根因:太乙四柱原从 `fetchPreciseNongli`(/nongli/time,固定一次、默认真太阳)取,切「直接/真太阳」只重算太乙盘、四柱不变;且 /nongli/time 不返回稳定的 clockTime/solarTime。
- 改动:`TaiYiCalc` 复用八字 `utils/baziLunarLocal.buildLocalBaziResult`(timeAlg=基准)——`bazi.nongli.clockTime/solarTime` 为稳定两时间(与基准无关)、`bazi.fourColumns` 随 timeAlg 变;`applyNongliDisplay` 用之。太乙盘 `/taiyi/pan` 不动。`TaiYiMain` 快照+信息表显示直接时间+真太阳时。
- 验证(90e26):切基准→日柱辛丑↔庚子、时柱戊子↔丁亥(四柱随基准变);两显示时间恒定 23:15:16 / 21:20:07(稳定),与八字一致。

## 3. 主限法
- 推运年数:前端控件(默认100、1-180);经 `AstroDirectMain` 沿 pdMethod/pdTimeKey 同路径下发 `pdYears`;Java `PredictiveController.getParams` 白名单透传;Python `perchart.pdYears`(clamp 1-180)→`perpredict.getPrimaryDirectionByZCoreKernel` 的 `max_arc=self.perchart.pdYears`。注:kernel 弧用 `norm180` 归一化到 ±180°,故上限 180(>180 无新方向,经用户确认不扩展多圈)。
- 表头:`.ant-table-cell-scrollbar` 被 `[class*=scrollbar]{padding-bottom:var(--horosa-scroll-safe-bottom)}` 误命中加了 82px 底pad~撑高表头→给 `.horosa-primary-direction-table thead th` 强制紧凑 padding。页码:减小底部预留(`bottomSafeReserve`/常数)使表体长高、页码下移。去 core:`Core-Alchabitius`→`Alchabitius`。

## 4. Ollama 流式中断
- 根因:流式路径两个写死 120s 上限——`SseHelper.java` `new SseEmitter(120000L)`(用户超时设置改不到它,主因)与 `AIAnalysisProxyService.buildJsonRequest` 的 `.timeout(120s)`。慢速本地模型超 120s 即被掐断「停止生成」。
- 改动:`SseEmitter(0L)`(无服务端超时,靠完成/错误/客户端断开);`buildJsonRequest` 仅在用户显式设 requestTimeoutMs 时才加超时(流式默认不设整体超时,connectTimeout 15s 仍护连接)。`buildJsonRequest` 仅 3 处流式调用使用,不影响非流式。
- 验证:代码已编入新 jar(SseEmitter 0L、buildJsonRequest 条件超时)。行为端到端需真 Ollama 实测。
