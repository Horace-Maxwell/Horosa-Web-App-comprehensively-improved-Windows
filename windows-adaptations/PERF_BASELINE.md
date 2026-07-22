# 性能验收证据(tracked;由 `check_perf_baseline_evidence` 门守护)

> **这份文件存在的理由**:让「发布前必跑验收」从口头纪律变成机器可核的硬条件。门核三件事:
> ① `version:` 必须 == `desktop_installer_bundle/package.json` 的 version(**机器可核的新鲜度**:
>    bump 版本而不重跑验收 → 这里的旧版本号立刻红);
> ② 预算三常量必须 == `scripts/perf_acceptance.cjs` 里的字面默认(口径永锁,单边改必红);
> ③ 逐技法表行数 ≥ 20(结构完整)。
> **明写的边界**:门**不**校验数字本身的新鲜与优劣 —— 机器态(睿频压制/后台模拟器,gotcha #64)
> 不可 CI 化;数字判定属于人:任何超标先做**同机同后台旧版对照**,再谈回归。

## 本版验收头

- version: 3.5.1
- build: release(v3.5.1 同步发布轮;上游性能宗师终局轮 + Windows R10 武装引擎收敛合体)
- date: 2026-07-22
- commit: (随发布 commit 填)
- 机器态: (验收时填:CPU 名 / CurrentClockSpeed vs MaxClockSpeed / 后台模拟器在否 / #64 对照结论)
- 台架: 隔离打包件(win-unpacked,LOCALAPPDATA/APPDATA 双隔离 + 端口基址 18899/19999,
  绝不触碰 owner 常驻 app)+ CDP 真实输入事件(HOROSA_PERF_DEBUG_PORT=9333, connect-only)。

## 口径(与 perf_acceptance.cjs 字面锁步)

- budgetMs: 1000        # 冷路径 p95 预算
- budgetHitP50Ms: 120   # 预取命中路径 p50 预算
- budgetHitP95Ms: 250   # 预取命中路径 p95 预算
- 场景: step-first(选步长→首点)/ step-run(连点+反向)/ option(左栏开关来回)
- 判定: 命中路径 n≥3 且 p50≤120 且 p95≤250;冷路径 p95≤1000;零样本=台架问题必须显式报

## 逐技法验收表(25 键;3.5.1 数字待本轮打包件 acceptance 回填)

| 技法键 | step-first(ms) | step p50/p95 | option p50/p95 | n | 判定 |
| --- | --- | --- | --- | --- | --- |
| astrochart | — | — | — | — | pending-3.5.1-run |
| direction | — | — | — | — | 结构性:主时间条不在本页可见,步进走各推运方法自有控件 |
| bazi | — | — | — | — | pending-3.5.1-run |
| ziwei | — | — | — | — | pending-3.5.1-run |
| guolao | — | — | — | — | pending-3.5.1-run |
| indiachart | — | — | — | — | pending-3.5.1-run |
| auxchart | — | — | — | — | pending-3.5.1-run |
| relativechart | — | — | — | — | 结构性:双人盘无步进语义 |
| shusuan | — | — | — | — | pending-3.5.1-run |
| mingother | — | — | — | — | pending-3.5.1-run |
| sanshiunited | — | — | — | — | pending-3.5.1-run |
| liureng | — | — | — | — | pending-3.5.1-run |
| dunjia | — | — | — | — | pending-3.5.1-run(3.5.0 轮观测缺口跟进) |
| guazhan | — | — | — | — | pending-3.5.1-run(随机起卦 NO_ARM,数字如实记) |
| taiyi | — | — | — | — | pending-3.5.1-run |
| jieqichart | — | — | — | — | pending-3.5.1-run(专用邻位机制,仅 option) |
| fengshui | — | — | — | — | 结构性:纯本地引擎页 |
| cnyibu | — | — | — | — | pending-3.5.1-run |
| aianalysis | — | — | — | — | SSE 流式:无步进/无落定单点(结构性) |
| planetarium | — | — | — | — | 取现时型:无步进条(结构性) |
| calendar | — | — | — | — | 月历型:单位集不同(台架按页配 --step-unit 跟进) |
| cntradition | — | — | — | — | 结构性:无步进条 |
| xuanshi | — | — | — | — | 浏览型:首屏 settle 观测已接,无步进语义 |
| astrochart3D | — | — | — | — | pending-3.5.1-run |
| astrodata | — | — | — | — | exempt(iframe 离线页,P5 豁免同理) |

### 上一轮(3.5.0 PERF-R10 落地轮)存档要点

数字全表见 git 历史(commit `c3410ed` 的本文件)。要点:选步长首击 占星82/紫微57/印占93/易卜70ms;
紫微 57/57/66 全绿;选项数据轴往返 87-98;超标 13 行两机理(极速连点超 ±3 窗落冷路径 170-670<1000;
渲染/重引擎均匀慢=Ship7 清单);全部为睿频压制+MuMu 常驻机器态的保守值。v3.5.1 预期改善:
上游 kentangCache 三层+在途去重(卜类/数算切换)、选步长触发线上游化(±depth 引擎不变)、
预热分档并行(冷启)、LazyCacheFactory(Java 就绪)。

## 温启节(3.5.1 待填)

- 温启 runtime-ready 中位: —
- 工作区可见(early-nav on): —(3.5.0 轮:ON 665/697 vs OFF 4269/4388ms,n=20/臂)
- spawnToPortsMs 回归检查: —

## 人工矩阵节(FreezeSubTab 切回原样;12 代表文件)

- 3.5.0 轮:自动代理已证「切回可交互可落定」(25 技法真实往返、14 技法样本);滚动/残影两维属人眼。
- 3.5.1:随验收轮复核;建议 owner 抽 3-4 对(占星↔八字、紫微↔六壬、三式↔太乙)人眼过一遍,
  关 `horosa.perf.freezeSubTabs` 对照即可。
