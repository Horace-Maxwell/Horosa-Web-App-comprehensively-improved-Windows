# 性能验收证据(tracked;由 `check_perf_baseline_evidence` 门守护)

> **这份文件存在的理由**:让「发布前必跑验收」从口头纪律变成机器可核的硬条件。门核三件事:
> ① `version:` 必须 == `desktop_installer_bundle/package.json` 的 version(**机器可核的新鲜度**:
>    bump 版本而不重跑验收 → 这里的旧版本号立刻红);
> ② 预算三常量必须 == `scripts/perf_acceptance.cjs` 里的字面默认(口径永锁,单边改必红);
> ③ 逐技法表行数 ≥ 20(结构完整)。
> **明写的边界**:门**不**校验数字本身的新鲜与优劣 —— 机器态(睿频压制/后台模拟器,gotcha #64)
> 不可 CI 化;数字判定属于人:任何超标先做**同机同后台旧版对照**,再谈回归。

## 本版验收头

- version: 3.6.0
- build: release(v3.5.1 同步发布轮 + 2026-07-24 R11 启动宗师覆盖:逐技法表沿 07-22 验收,
  温启/首启/冷物化数字见「启动预算三元组」与「温启节 R11 追记」,当轮重跑)
- date: 2026-07-24(逐技法表实测日 2026-07-22;启动面实测日 2026-07-23/24)
- commit: 457266d(R11 覆盖轮;07-22 首发轮为 d552f36)
- 机器态: Xeon W-11955M;CurrentClockSpeed **2611 == 基频**(睿频压制)+ MuMu/vmmem 7 进程常驻
  (owner 应用,未动)——#64 特征全中,本表数字仍为保守值;与 3.5.0 轮同机同态,跨轮可比。
- 台架: 隔离打包件(win-unpacked,LOCALAPPDATA/APPDATA 双隔离 + 端口基址 18899/19999,
  绝不触碰 owner 常驻 app)+ CDP 真实输入事件(HOROSA_PERF_DEBUG_PORT=9333, connect-only)。

## 口径(与 perf_acceptance.cjs 字面锁步)

- budgetMs: 1000        # 冷路径 p95 预算
- budgetHitP50Ms: 120   # 预取命中路径 p50 预算
- budgetHitP95Ms: 250   # 预取命中路径 p95 预算
- 场景: step-first(选步长→首点)/ step-run(连点+反向)/ option(左栏开关来回)
- 判定: 命中路径 n≥3 且 p50≤120 且 p95≤250;冷路径 p95≤1000;零样本=台架问题必须显式报

## 逐技法验收表(25 键;2026-07-22 v3.5.1 打包件实测,repeat=10,--step-unit 天)

| 技法键 | step-first(ms) | step p50/p95 | option p50/p95 | n | 判定 |
| --- | --- | --- | --- | --- | --- |
| astrochart | **71** | 85/279 | 数据轴 86/223(黄道↔Lahiri 首翻 223、往返 85-96) | 12+6 | 首击/往返 PASS;p95 尾=极速连点超窗(构成分析①) |
| direction | — | — | — | 0 | 结构性:主时间条不在本页可见,步进走各推运方法自有控件 |
| bazi | 118 | **109/135** | —(无数据轴快捷钮) | 12 | **PASS**(3.5.0 轮 124/134 超线 → 上游渲染守卫叠加后转绿) |
| ziwei | 126 | **49/126** | — | 12 | **PASS**(p50 49;首击含臂重建) |
| guolao | 335 | 341/711 | — | 10 | 超标:重引擎逐步付(Ship7 清单沿袭) |
| indiachart | — | — | — | 0 | 台架注:v3.5.1 上游改版后时间条未过可见性判别(3.5.0 轮曾出样 93/98/368)——台架跟进,非产品结论 |
| auxchart | 158 | 146/181 | — | 12 | 均匀 ~150-180 渲染主导(较 3.5.0 轮 156/213 收敛;Ship7 清单) |
| relativechart | — | — | — | 0 | 结构性:双人盘无步进语义 |
| shusuan | 115 | **115/186** | **84/93** | 12+4 | **双 PASS**(3.5.0 轮 step 145/177 超 → 转绿) |
| mingother | 122 | 133/189 | **81/88** | 12+6 | option PASS;step 贴线(133 vs 120) |
| sanshiunited | 389 | 363/740 | — | 8 | 超标:stage-1 重计算(Ship7/金口两阶段沿袭) |
| liureng | 266 | 159/362 | **67/67** | 9+2 | option PASS;step 尾超 |
| dunjia | — | — | — | 0 | 台架注:v3.5.1 上游遁甲界面自有草稿流(通用时间条不可见)——产品侧上游预取链+我方武装并存;逐击观测走上游 pm(fields compute/commit) |
| guazhan | 293 | 371/588 | 248/425 | 10+6 | 随机技法 NO_ARM(设计不预取);整卦重算数字如实记 |
| taiyi | — | — | — | 0 | 台架注:同印占,可见性判别未过(3.5.0 轮 227/211/387);option 亦未出钮 |
| jieqichart | — | — | **40/42** | 5 | 专用邻位机制;option PASS(较 3.5.0 轮 49/58 再快) |
| fengshui | — | — | — | 0 | 结构性:纯本地引擎页 |
| cnyibu | **66** | 69/299 | — | 12 | 首击 PASS(66);尾=超窗 |
| aianalysis | — | — | — | 0 | SSE 流式:无步进/无落定单点(结构性) |
| planetarium | — | — | — | 0 | 取现时型:无步进条(结构性) |
| calendar | — | — | — | 0 | 月历型:单位集不同(unit-option-not-found;台架按页配 --step-unit 跟进) |
| cntradition | — | — | — | 0 | 结构性:无步进条 |
| xuanshi | — | — | — | 0 | 浏览型:首屏 settle 观测已接,无步进语义 |
| astrochart3D | 170 | 157/296 | — | 12 | 3D 场景重建计入;贴线 |
| astrodata | — | — | — | 0 | exempt(iframe 离线页,P5 豁免同理) |

### 构成分析(v3.5.1;判定不放水,读数要懂构成)

① 命中 regime 66-126ms;**160ms 极速连点**在 ~6 击后越过 ±3 预取窗落冷路径(全部 < 冷预算
   1000)。② 汇总 50 项:**PASS 8 · 超标 9 · 无数据 33**(3.5.0 轮为 7/13/30)——八字与数算
   由超转绿(上游渲染守卫 + 我方引擎叠加),option 族普遍再快(分至 40/42、六壬 67、其他 81、
   数算 84、astro 数据轴往返 85-96)。③ 超标 9 行两机理不变:超窗尾(astro/cnyibu/mingother)
   与重引擎/渲染(七政 341、卜三式 363、六爻 371[随机族照实记]、六壬尾、辅盘 146、3D 157)
   = Ship7 数据清单沿袭。④ 首盘端到端(bootstrap 确定击)= **63-64ms**(升级后温启实例,
   上游 pm 三段:compute 2.4-2.5 / commit 48.6-49.7)。⑤ 台架注:印占/太乙/遁甲本轮
   no-time-control 属可见性判别差异(上游 UI 改版),非产品回归 —— 台架跟进项。

### 上一轮(3.5.0 PERF-R10 落地轮)存档要点

数字全表见 git 历史(commit `c3410ed` 的本文件)。要点:选步长首击 占星82/紫微57/印占93/易卜70ms;
紫微 57/57/66 全绿;选项数据轴往返 87-98;超标 13 行两机理(极速连点超 ±3 窗落冷路径 170-670<1000;
渲染/重引擎均匀慢=Ship7 清单);全部为睿频压制+MuMu 常驻机器态的保守值。v3.5.1 预期改善:
上游 kentangCache 三层+在途去重(卜类/数算切换)、选步长触发线上游化(±depth 引擎不变)、
预热分档并行(冷启)、LazyCacheFactory(Java 就绪)。

## 启动预算三元组(与 scripts/startup_ab.cjs 的 DEFAULT_BUDGETS 字面锁步;门双向核对)

- warmReadyBudgetMs: 4500        # 温启 runtime-ready 中位预算(startup-history totalMs 口径)
- workspaceVisibleBudgetMs: 1500 # 工作区可见预算(台架口径=壳日志首行→renderer load completed;
                                 # 回归判别线:实测 ON 1121-1140 vs OFF >4200,能抓 early-nav 失效
                                 # 而不对机器态哭狼;打包件 CDP 口径 637ms 是另一把尺,见温启节)
- firstBootBudgetMs: 60000       # 首启预算(--cold headless:spawn → 全量物化+就绪)
- 台架: `scripts/startup_ab.cjs`(R11-T5a 入库;隔离双臂/双口径/#64 机器态指纹随样本入档,
  产物写 docs/perf-artifacts/)。判定仍归人:超预算先按 #64 做同机同态对照,再谈回归。

## 温启节(2026-07-22 v3.5.1 隔离 A/B,每臂 8 次有效样本 + 首发提取弃样)

- **工作区可见:early-nav ON 中位 637 / p95 655ms;OFF 中位 4223 / p95 4415ms**
  (3.5.0 轮 ON 665/697 vs OFF 4269/4388,n=20/臂 —— 双轮互证,ON 臂还略快)。
- 后端分相:spawnToPortsMs ON 3509 vs OFF 3412(+97ms,< 100ms 评估线 ✓,较 3.5.0 轮
  +122ms 收敛);totalMs 3905 vs 3847(+58ms 噪音级)。评估结论=early-nav 默认开维持。
- 温启 runtime-ready 中位 ≈3.9s(睿频压制机器态;上游预热分档在 trusted 温启走串行原序,
  horosa_trusted_env_shape_v1 值形守卫生效)。

### R11 追记(2026-07-23,PERF-R11 启动宗师轮;台架=scripts/startup_ab.cjs,7 有效样本/臂)

- **CDS 阶梯激活是本轮温启主杠杆**:阶梯失活态(修复前全机常态)runtime-ready 中位
  **6204-7812ms**;一会话内阶梯建成(uber 337MB→chained static .jsa,ladder_sim 实录见
  docs/perf-artifacts/INDEX)后,**中位 4096 / p95 4189ms**(A 臂;B 臂 4145/4551,A=B
  同环境,delta 1.2%=台架复现性)——**-33%,预算 4500 内 PASS**,机器态=睿频压制
  2611==基频 + MuMu 常驻(#64 保守值)。分相:spawnToPortsMs ~3635(static CDS 已装载),
  payloadMs 58 / prepToSpawn 228 / portsToHeartbeat 78。
- 台架口径工作区可见:ON 1121/1140ms(dev electron,壳日志首行→load completed)——与打包件
  CDP 口径 637ms 是**两把尺**(锚点与壳形态不同),各自与各自的历史比;回归判别看
  workspaceVisibleBudgetMs=1500(OFF 臂 >4200 一抓一个准)。
- 冷物化并发 A/B 与桶账(startup_ab --cold,3/臂,headless+packed 载荷,Defender=suspect 态):
  **conc 12 中位 30148 / p95 31145ms;conc 24 = 30845/32105(+2.3% 更慢)→ 默认 12 维持**
  (busyMs 206→430s 翻倍 = AV 扫描队列竞争,墙钟零收益;<15% 改善线)。桶账首采:
  py-sitepkgs 12,607 文件 = busyMs 74%(仅 29% 字节)= 文件数税实锤;se1 busyMs 3.3s ⇒
  request-blocking 分级维持不做(决策线全文在 PERF_INVENTORY JV-19)。firstBoot 预算 60s 内 PASS。

## 人工矩阵节(FreezeSubTab 切回原样;12 代表文件)

- 3.5.0 轮:自动代理已证「切回可交互可落定」(25 技法真实往返、14 技法样本);滚动/残影两维属人眼。
- 3.5.1:随验收轮复核;建议 owner 抽 3-4 对(占星↔八字、紫微↔六壬、三式↔太乙)人眼过一遍,
  关 `horosa.perf.freezeSubTabs` 对照即可。
