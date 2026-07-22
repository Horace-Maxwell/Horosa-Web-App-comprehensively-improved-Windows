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
- commit: (随最终 commit 填)
- 机器态: (验收时填:CPU 名 / CurrentClockSpeed vs MaxClockSpeed / 后台模拟器在否 / #64 对照结论)

## 口径(与 perf_acceptance.cjs 字面锁步)

- budgetMs: 1000        # 冷路径 p95 预算
- budgetHitP50Ms: 120   # 预取命中路径 p50 预算
- budgetHitP95Ms: 250   # 预取命中路径 p95 预算
- 场景: step-first(选步长→首点)/ step-run(连点+反向)/ option(左栏开关来回)
- 判定: 命中路径 n≥3 且 p50≤120 且 p95≤250;冷路径 p95≤1000;零样本=台架问题必须显式报

## 逐技法验收表(25 键;首轮数字待 Ship8 acceptance 填)

| 技法键 | step-first(ms) | step p50/p95 | option p50/p95 | n | 判定 |
| --- | --- | --- | --- | --- | --- |
| astrochart | — | — | — | — | pending-first-run |
| direction | — | — | — | — | pending-first-run |
| bazi | — | — | — | — | pending-first-run |
| ziwei | — | — | — | — | pending-first-run |
| guolao | — | — | — | — | pending-first-run |
| indiachart | — | — | — | — | pending-first-run |
| auxchart | — | — | — | — | pending-first-run |
| relativechart | — | — | — | — | pending-first-run |
| shusuan | — | — | — | — | pending-first-run |
| mingother | — | — | — | — | pending-first-run |
| sanshiunited | — | — | — | — | pending-first-run |
| liureng | — | — | — | — | pending-first-run |
| dunjia | — | — | — | — | pending-first-run |
| guazhan | — | — | — | — | pending-first-run(随机起卦:仅 option 场景) |
| taiyi | — | — | — | — | pending-first-run |
| jieqichart | — | — | — | — | pending-first-run |
| fengshui | — | — | — | — | pending-first-run |
| cnyibu | — | — | — | — | pending-first-run |
| aianalysis | — | — | — | — | pending-first-run(SSE:仅可用性,不计延迟) |
| planetarium | — | — | — | — | pending-first-run(取现时:仅 option 场景) |
| calendar | — | — | — | — | pending-first-run |
| cntradition | — | — | — | — | pending-first-run |
| xuanshi | — | — | — | — | pending-first-run(浏览型:首屏 settle) |
| astrochart3D | — | — | — | — | pending-first-run |
| astrodata | — | — | — | — | exempt(iframe 离线页,P5 豁免同理) |

## 温启节(clean_machine + startup-history;首轮待填)

- 温启 runtime-ready 中位(20 次): —
- 首帧工作区(CDP,EARLY_NAV on/off A/B): —
- 首启差额构成表: —

## 人工矩阵节(FreezeSubTab 切回原样;12 代表文件)

- 状态: pending-first-run(步骤见 windows-adaptations/README.md 行 38/42 与 plan 存档)
