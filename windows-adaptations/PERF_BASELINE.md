# 性能验收证据(tracked;由 `check_perf_baseline_evidence` 门守护)

> **这份文件存在的理由**:让「发布前必跑验收」从口头纪律变成机器可核的硬条件。门核三件事:
> ① `version:` 必须 == `desktop_installer_bundle/package.json` 的 version(**机器可核的新鲜度**:
>    bump 版本而不重跑验收 → 这里的旧版本号立刻红);
> ② 预算三常量必须 == `scripts/perf_acceptance.cjs` 里的字面默认(口径永锁,单边改必红);
> ③ 逐技法表行数 ≥ 20(结构完整)。
> **明写的边界**:门**不**校验数字本身的新鲜与优劣 —— 机器态(睿频压制/后台模拟器,gotcha #64)
> 不可 CI 化;数字判定属于人:任何超标先做**同机同后台旧版对照**,再谈回归。

## 本版验收头

- version: 3.5.0
- build: local-unreleased(PERF-R10 落地轮,owner 决策=只落地不发布;LIVE 资产未动)
- date: 2026-07-21
- commit: 94fbc92(产品面;收尾文档随后一 commit)
- 机器态: Xeon W-11955M;CurrentClockSpeed **2611 == 基频**(睿频被压制)+ MuMu 模拟器 4 进程常驻
  (owner 应用,未动)——**#64 特征全中:本表全部数字都是睿频压制态跑出的保守值**,
  安静机器上预期普遍更快;逐项判定不因此放水,超标行照记。
- 台架: 隔离打包件(win-unpacked,LOCALAPPDATA/APPDATA 双隔离 + 端口基址 18899/19999,
  绝不触碰 owner 常驻 app)+ CDP 真实输入事件(HOROSA_PERF_DEBUG_PORT=9333, connect-only)。

## 口径(与 perf_acceptance.cjs 字面锁步)

- budgetMs: 1000        # 冷路径 p95 预算
- budgetHitP50Ms: 120   # 预取命中路径 p50 预算
- budgetHitP95Ms: 250   # 预取命中路径 p95 预算
- 场景: step-first(选步长→首点)/ step-run(连点+反向)/ option(左栏开关来回)
- 判定: 命中路径 n≥3 且 p50≤120 且 p95≤250;冷路径 p95≤1000;零样本=台架问题必须显式报

## 逐技法验收表(25 键;2026-07-21 打包件实测,repeat=10,--step-unit 天)

| 技法键 | step-first(ms) | step p50/p95 | option p50/p95 | n | 判定 |
| --- | --- | --- | --- | --- | --- |
| astrochart | **82** | 85/303 | 数据轴 95/228(黄道↔Lahiri 首翻 228、往返 87-98) | 11+6 | 首击/往返 PASS;p95 尾=极速连点超窗(构成分析①) |
| direction | — | — | — | 0 | 结构性:主时间条不在本页可见,步进走各推运方法自有控件(no-time-control) |
| bazi | 134 | 124/134 | —(无数据轴快捷钮) | 12 | 本地渲染恒 ~130ms,超 p50 线 4ms —— **Ship7 渲染切片首选**(构成分析②) |
| ziwei | **57** | **57/66** | — | 12 | **PASS(全绿样板:本地漏斗武装生效)** |
| guolao | 388 | 375/653 | — | 9 | 超标:重引擎逐步全额付(prefetcher 命中疑未达,Ship7 跟进单) |
| indiachart | **93** | 98/368 | — | 10 | 首击 PASS;尾=超窗 |
| auxchart | 190 | 156/213 | — | 12 | 均匀 ~150-210 = 渲染主导(Ship7 跟进单) |
| relativechart | — | — | — | 0 | 结构性:双人盘无步进语义(no-time-control) |
| shusuan | 156 | 145/177 | **96/113** | 12+4 | option PASS;step 均匀超 = 渲染+引擎(Ship7 跟进单) |
| mingother | 124 | 134/210 | **89/92** | 12+6 | option PASS;step 贴线 |
| sanshiunited | 369 | 339/668 | — | 8 | 超标:stage-1 重计算逐步付(Ship7/金口两阶段跟进) |
| liureng | 178 | 163/408 | **74/74** | 9+2 | option PASS;step 超(课传渲染,Ship7 跟进单) |
| dunjia | — | 0 样本 | — | 0 | **观测缺口**:控件在、点击真、零样本 —— 打点在 pan setState 回调,疑 pan 签名去重/异步链早退吞样本(遗留③) |
| guazhan | 221 | 278/499 | 251/484 | 11+6 | 随机起卦 NO_ARM(设计不预取);时间步进=整卦重算,数字如实记 |
| taiyi | 227 | 211/387 | **136/136** | 9+2 | option PASS;step 超(stage-1) |
| jieqichart | — | — | **49/58** | 5 | 分至专用邻位机制(FE-6);option PASS;无通用步进条 |
| fengshui | — | — | — | 0 | 结构性:纯本地引擎页(no-time-control) |
| cnyibu | **70** | 88/274 | — | 11 | 首击 PASS;尾=超窗 |
| aianalysis | — | — | — | 0 | SSE 流式:无步进/无落定单点(结构性) |
| planetarium | — | — | — | 0 | 取现时型:无步进条(结构性) |
| calendar | — | — | — | 0 | 月历型:单位集不同(unit-option-not-found,台架后续按页配 --step-unit) |
| cntradition | — | — | — | 0 | 结构性:无步进条(no-time-control) |
| xuanshi | — | — | — | 0 | 浏览型:首屏 settle 观测已接(P5),无步进语义 |
| astrochart3D | 227 | **118**/308 | — | 12 | p50 PASS;首击含 3D 场景重建 |
| astrodata | — | — | — | 0 | exempt(iframe 离线页,P5 豁免同理) |

### 构成分析(判定不放水,但读数要懂构成)

① **两种超标机理要分开读**:命中 regime(武装窗内)= 57-98ms;**极速连点(160ms 间隔不停手)**
   在第 ~6 击后越过 ±3 预取窗,补泵(串行、每任务 ~70-100ms)追不上 → 该击落冷路径 170-670ms
   (全部 < 冷预算 1000)。占星 run2 原始样本即教科书:`[90,78,77,72,68,170,228,310,286,209,79,75]`
   —— 前 5 击命中、6-10 击超窗、末 2 反向击(±窗内)回到 79/75。真实用户「停一下再看」的节奏
   基本全程命中;要抬极速连点上限,路 = `horosa.perf.stepPrefetchDepth` 调 4-5(用户可自设)或
   后续轮做泵并发度自适应。
② **均匀慢 ≠ 超窗**:八字(恒 ~130,纯本地渲染)、辅盘/数算/六壬(150-210 渲染主导)、
   七政/卜三式(330-670 重引擎逐步付)—— 这些是 **Ship7 渲染切片/引擎跟进的数据驱动清单**,
   预取救不了本地渲染耗时。
③ **武装链路实机证据**:`__horosaPrefetch.stats()` = `{arms:4, lastReason:'unit-select',
   lastUnit:'d', lastDepth:3, lastTasks:6, refusals:0}`(占星页选「天」后)—— 四时机之
   unit-select 在打包件上真实触发,白名单零拒绝。
④ **选项数据轴实机证据**(optionPrefetch 所指的轴):黄道下拉真机形态 = 回归黄道 + 恒星
   ayanamsa 全家(非二值);回归↔Lahiri 往返 6 次:首翻 228ms(冷,<1000),此后 87-98ms
   全命中(p50 95 ≤ 120)。显示类快捷钮(四角/度数/界限)为纯本地重绘、无数据落定点,
   不属 option 度量对象(数算/其他/六壬/太乙/分至的 option 数据来自其真实数据轴钮)。

## 温启节(打包件隔离 A/B,每臂 20 次有效样本 + 首发提取弃样;2026-07-21)

- **工作区可见(Start-Process → 渲染器 index 已导航,CDP 判):early-nav ON 中位 665 / p95 697ms;
  OFF 中位 4269 / p95 4388ms** —— OFF 臂精确复现历史 ~4s 温启感知常态(互证),
  **early-nav 把「看到工作区」提前 ~3.6 秒**(bootChartRestore+L3 命中时内容随即可画)。
- 后端分相(startup-history.jsonl,两臂各 21 行):spawnToPortsMs ON 3547 vs OFF 3425
  (**+122ms,过 100ms 评估线 → 评估结论=保留默认开**:渲染器解析与后端引导争核的正常代价,
  换 3.6s 感知;ports→heartbeat ON 56 vs OFF 74 反而更快;totalMs 3978 vs 3880=+98ms 噪音级);
  payloadMs ~157-159 两臂同。机器态=睿频压制+MuMu 常驻(见验收头),绝对值偏保守。
- 首启:安装期 prepareruntime 已前置(S4 只计量);本轮首发提取样本 ~4.27s(弃样,含载荷落位)。

## 人工矩阵节(FreezeSubTab 切回原样;12 代表文件)

- 自动代理已覆盖的子集(2026-07-21):验收全矩阵经导航模态在 25 技法间真实往返切换,
  14 技法切回后即刻接受步进/选项交互并产出落定样本 —— 「切回可交互、可落定、不白屏」
  已被行为学证明。
- 仍属人眼的维度:**滚动位置保持 / 视觉残影 / 内容时间戳新鲜度**的逐对断言 —— 产线构建
  不暴露 store、逐对脚本未竟(诚实记录,不算 PASS)。建议 owner 抽 3-4 对(占星↔八字、
  紫微↔六壬、三式↔太乙)人眼过一遍;关 `horosa.perf.freezeSubTabs` 对照即可复核。
