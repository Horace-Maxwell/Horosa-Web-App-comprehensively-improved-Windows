# 性能验收证据(tracked;由 `check_perf_baseline_evidence` 门守护)

> **这份文件存在的理由**:让「发布前必跑验收」从口头纪律变成机器可核的硬条件。门核三件事:
> ① `version:` 必须 == `desktop_installer_bundle/package.json` 的 version(**机器可核的新鲜度**:
>    bump 版本而不重跑验收 → 这里的旧版本号立刻红);
> ② 预算三常量必须 == `scripts/perf_acceptance.cjs` 里的字面默认(口径永锁,单边改必红);
> ③ 逐技法表行数 ≥ 20(结构完整)。
> **明写的边界**:门**不**校验数字本身的新鲜与优劣 —— 机器态(睿频压制/后台模拟器,gotcha #64)
> 不可 CI 化;数字判定属于人:任何超标先做**同机同后台旧版对照**,再谈回归。

## 本版验收头

- version: 3.9.5
- build: release(v3.9.4 **术数真值校准轮**:六壬六亲/三合十二神煞/八字十二长生逐格对拍修正
  [约 1000 格公式派生看守随上游落地]+ 3D 星盘与阅读器全屏根治[**我方 v3.9.1 fullscreenState
  两补丁按 #49 退役** —— 上游以自有符号形重实现同三处修并扩到 BookReader,哨兵迁钉上游形态,
  回归测试改写为行为+源扫描+能力位负锚]+ 紫微运限流年干支年基准 + 连续操作时序防护;
  **启动路径零改动**[壳 0 文件、Python 0 改动、Java 仅 RuntimeWire 版本号];性能面零新增,
  唯一 overlay 相交=ZWLuckPanel(perfR9 切片,已 regen+round-trip 1/1 自证)。
- date: 2026-08-20(v3.9.4 同步轮;逐技法全表存档日 2026-07-22,本轮未重跑逐技法全表)
- commit: 见本轮发布 commit(v3.9.4 同步轮)
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

## 逐技法验收表(27 键;tarot 行 v3.9.3 增;2026-07-22 v3.5.1 打包件实测,repeat=10,--step-unit 天;zeri 行=2026-08-02 v3.7.0 冷沙箱实测)

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
| zeri | 321 | **78**/321 | —(征象工作台为弹窗流,无左栏数据轴钮) | 12 | 命中 p50 78 PASS;首下/尾=冷沙箱首绘(v3.7.0 新页,DivinationChartShell /chart 底盘;征象扫描属显式批量求值不计入本表) |
| tarot | — | — | — | 0 | 结构性:随机起卦型(FE-28,预取=钉死随机结果),无步进/预取语义;v3.9.3 升「卜」一级导航成为独立键,P5 终点 markPanelReady('tarot') 已随迁(原记 cnyibu 名下) |

### 构成分析(v3.5.1;判定不放水,读数要懂构成)

① 命中 regime 66-126ms;**160ms 极速连点**在 ~6 击后越过 ±3 预取窗落冷路径(全部 < 冷预算
   1000)。② 汇总 50 项:**PASS 8 · 超标 9 · 无数据 33**(3.5.0 轮为 7/13/30)——八字与数算
   由超转绿(上游渲染守卫 + 我方引擎叠加),option 族普遍再快(分至 40/42、六壬 67、其他 81、
   数算 84、astro 数据轴往返 85-96)。③ 超标 9 行两机理不变:超窗尾(astro/cnyibu/mingother)
   与重引擎/渲染(七政 341、卜三式 363、六爻 371[随机族照实记]、六壬尾、辅盘 146、3D 157)
   = Ship7 数据清单沿袭。④ 首盘端到端(bootstrap 确定击)= **63-64ms**(升级后温启实例,
   上游 pm 三段:compute 2.4-2.5 / commit 48.6-49.7)。⑤ 台架注:印占/太乙/遁甲本轮
   no-time-control 属可见性判别差异(上游 UI 改版),非产品回归 —— 台架跟进项。

### v3.6.0 键石复测(2026-07-31,隔离 win-unpacked 冷沙箱首启实例,repeat=10;docs/perf-artifacts/perf_accept_360.json)

| 键 | step p50/p95 | option p50/p95 | vs 3.5.1 |
| --- | --- | --- | --- |
| bazi | 105.7/114.1 | — | 109/135 → **更优** |
| ziwei | 41.8/120.8 | — | 49/126 → **更优** |
| shusuan | 111.8/145.4 | 81.8/83.1 | 115/186·84/93 → **更优** |
| mingother | 115.8/150.8 | 82.8/83.8 | 133/189·81/88 → **更优** |
| auxchart | 115.7/130.1 | — | 146/181 → **更优** |
| astrochart3D | 87.7/295.5 | — | 157/296 → **p50 减半** |
| jieqichart | —(no-time-control 沿袭) | 39.9/44.3 | 40/42 → 持平 |
| cnyibu | 68.2/269.1 | — | 69/299 → 持平(尾=超窗同机理) |
| astrochart | 267.2/285.7 | — | 台架条件注① |
| liureng | 359.6/513.9 | 59.7/59.7 | 台架条件注①(option 67→59.7 更优) |

① 台架条件注:本轮验收实例为**冷沙箱首次启动**(v3.5.1 表为升级后温启实例,带 L3/history 温底),
astrochart/liureng 的 step 样本全落冷路径(astro ±3 臂在首启实例未及建成;六壬另叠加 3.6.0
古法贵人表归正的逐步真算)——全部 < 冷预算 1000 判定线,机理与 3.5.1 表「超窗尾/重引擎」两类同。
② 星运(direction)页 3.6.0 方位法工具条重构令台架 CDP 选择器抛错(v3.5.1 轮印占/太乙/遁甲同类)
—— 台架跟进项,非产品结论;其余 15 键沿 07-22 存档表。
③ 结论:键石 10 键 8 键持平或更优、0 键回归;叠加启动稳态(下节)= 本版零性能降级。

### v3.7.0 键石+新页复测(2026-08-02,隔离 win-unpacked 冷沙箱首启实例,repeat=10;docs/perf-artifacts/2026-08-02-v3.7.0/)

| 键 | step 首下/p50/p95 | option p50/p95 | vs 上轮 |
| --- | --- | --- | --- |
| bazi | 113/101/113 | — | 105.7/114.1 → 持平 |
| ziwei | 124/42/124 | — | 41.8/120.8 → 持平(p50 42) |
| shusuan | 101/77/101 | 75/81 | 111.8/145.4·81.8/83.1 → **更优** |
| mingother | 121/99/121 | 72/78 | 115.8/150.8·82.8/83.8 → **更优** |
| auxchart | 85/118/125 | — | 115.7/130.1 → 持平 |
| astrochart3D | 82/84/296 | — | 87.7/295.5 → 逐位复现(持平) |
| jieqichart | —(no-time-control 沿袭) | 44/45 | 39.9/44.3 → 持平 |
| cnyibu | 65/65/274 | — | 68.2/269.1 → 持平(尾=超窗同机理) |
| astrochart | 293/253/293 | — | 267.2/285.7 → 台架条件注①同机理(冷沙箱首启,±3 臂未建成) |
| liureng | 467/146/467 | 55/55 | 359.6/513.9 → **p50 更优**(option 59.7→55) |
| **zeri(新)** | 321/**78**/321 | — | 新页首钉:命中 p50 78 = 与占星族命中 regime 同档;首下/尾=冷首绘 |

注:冷沙箱首启实例(与 v3.6.0 键石表同台架条件);全部冷样本 < 冷预算 1000;
PASS 9 · 超标 5(astrochart/liureng/cnyibu/3D/zeri 全部为「冷首绘/超窗/重引擎」已档机理,
数字与上两轮逐位可比、零回归)· 无数据 8(结构性/无 toggle)。**结论:v3.7.0 新页入册即达
命中口径,键石零回归 = 本版零性能降级。**

### R12-P2 宗师轮落地(2026-08-03,**只落地不发布**,R10 先例;本地 commit f5d0a265,版本族不动)

**落地面**:W3a 泵 fast-first/偏斜(`stepPrefetchFastFirst`/`stepPrefetchSkew`)· W3b zeri 五修(Z5=否决线)·
W3c 三式 S1-S6 · W3d 七政 G0-G6(G5 `guolaoMergedPaint`+peekCachedPost;G6 Moira 规则物化预取链,
禁词精确豁免 `PREFETCH_FORBIDDEN_EXEMPT_EXACT`,豁免不放大类)· W3e 六壬 L1-L4 · W3f 辅盘 A1-A3
(rings 19 键=读取面清单推导,**异步落点字段必须入键**)· W3g 3D 补间五针源级钉 · W3h 台架四修 ·
W2.5 裸 React.lazy 自愈加固 15 处(`horosa_lazy_healing_wrap_v1`)。全部独立 kill-switch,五层契约齐
(补丁 15 regen + 6 新,README 56 行,SENT 283 文件)。

**W1 证据收官(零代码)**:bean top-40 全为框架底座、应用 bean 零候选 ⇒ D1 定点形收官;
PD 预热 62-91ms << 300ms ⇒ D5 恒门前;门前串行头 ≈1.34s vs java 3.5-4.4s = Java 长杆;
**W0d 门后槽产线确认**(owner 机 py.warmup_core_postgate 4.5ms 温/191.7ms 冷)。
W2a 预置 .jsa 否决(73.5MB/版 vs 差量 10MB 体系;重开条件=W0c ladder 字段实证覆盖不足)。
证据 docs/perf-artifacts/2026-08-03-r12p2/(INDEX 领读)。

**电池**:umi 470/471+baziStress solo 绿 · pytest 2049+alcabitius 钉 · 金标 3823 零漂移 ·
node 142/142 · dist:win 32/34 绿(恰 2 冻结诚实红=资产/文档哈希,land-only 永不回填)·
差量 vs LIVE v3.7.0 仅 5MB/0.6%(复用 99.4%)· 构建指纹 clean@f5d0a265。

**26 键验收(2026-08-03 冷沙箱 win-unpacked,repeat=10;全天重载后机器态,#64 注)**:
PASS 9 · 超标 12 · 无数据 31。**与昨日 v3.7.0 键石表(同台架条件)重叠 11 键逐位对照 = 零回归**:
astrochart 294/254/294(昨 293/253/293,条件注①同机理逐位复现)· zeri 310/80/310(昨 321/78/321)·
cnyibu 70/70/264(昨 65/65/274)· ziwei p50 42==42 · bazi 121/109(昨 113/101)· auxchart 116(昨 118)·
3D 88(昨 84)· jieqichart opt 39/50(昨 44/45);**liureng 更优**:首下 467→215 / opt 55→46(W3e+fast-first);
shusuan/mingother p50 +30-50(唯二上移,同宿主组件,今晚机器态嫌疑 —— 下轮静机复测裁决,#64 不夜判)。
「超标 12」中新增可测 15 键(七政/三式/六壬/太乙/六爻/印占…首次入册)全部为冷链尾样本
(p50 多在预算内、p95=单尾),是下轮的既名优化对象,不是回归。
**台架修带来的覆盖扩容**:黄历 step 首次可测且 PASS(109ms p50,年/月二档变体 profile);
六爻/数算/六壬/太乙/分至 option 首次有样本(xq-check-item 扩容)。

**两项既名 findings(下轮工单)**:
- F1 astro 主盘时间条未挂「选步长即武装」opt-in prop(arms=0 实证;= 键石条件注①的机制细节;
  冷沙箱首击恒 ~250ms 的真因)——一行 prop 接线 + 五层,下轮首项。
- F2 dunjia 验收观测环:确认制交互(未确认步进模型,+/- 零成本是产品最优形态)在台架下
  起点-终点配对静默失联(armStats 证明导航/武装正常;probe 时间盒用尽)——下轮 in-app 断点查
  recalc 入口配对;台架已备 confirmAfterStep 机制 + 结构化诊断,产品功能不受影响。

**人工矩阵注**:FreezeSubTab 新增点(zeri 右栏 7 面板)人工切回抽查依 R10 惯例留至下一发布轮
(本轮 land-only;单测/SSR 冒烟已盖行为面)。

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
### 温启对照 v3.9.5(2026-08-24 同步轮·卜卦盘全面改进 + 缩放档浮层根治;horosa_warm_ab_stamp_v1)

- **构建自洽 A/B(startup_ab,双臂同构建 A=B,6/臂弃首样 ⇒ n=5,commit `ea967134`)**:
  warmReady 中位 **4817 / 4821ms**(p95 4869 / 4906),两臂相距 **+0.1%** = 构建自洽,无回归信号。
  **workspaceVisible 602 / 608ms**(p95 606 / 618,预算 1500 内 ✓);spawnToVisible 821 / 829ms。
  工件:`docs/perf-artifacts/startup_ab_v395_warmstamp.json`。
- **🔴 #64 机器态照录**:`currentClockMHz 2611 == maxClockMHz`(睿频压制**照旧**)+ `mumuRunning: true`
  (owner 应用,未动)、`vmmemRunning: false`。**记录在案的机器态与上一轮逐项相同。**
- **★★本轮是七轮以来最快的一次,但功劳不算在 v3.9.5 头上(重要,别误读成本版优化成果)**:
  近七轮同台带 warmReady 中位 = v3.7.3 7210/7056 → v3.8.0 6846/6661 → v3.9.2 6572/6607 →
  v3.9.3 7007/6978 → v3.9.4 6263/6200 → **本轮 4817/4821**,较上一轮再降约 23%,**远低于该带下沿**;
  workspaceVisible 同步从 816/782 降到 **602/608**(约 −25%)。
  **判定依据(为什么不是本版的功劳)**:warmReady 覆盖的是 **python + java 起栈 + 校验**,
  workspaceVisible 覆盖的是 **renderer 载入** —— 这是两条彼此独立的路径,**却同步下降了几乎相同的比例**。
  前端代码改动不可能让 Python/Java 起栈也快 23%;能同时压低两者的只有**机器级因素**
  (最可能是 MuMu 虽在但本轮处于空载 —— 指纹只记「进程在否」,不记它的实时负载,这正是该指纹的已知盲点)。
  **⇒ 结论:机器态红利,不是 v3.9.5 的性能成果;下轮若回到 6000+ 也不构成回归,先查同一盲点。**
- **★预算判定**:门给出 `OVER(check #64 machine state first)`(4817 > 4500)—— 与前六轮同型
  (前六轮 6200-7210 同样 OVER)。该台架 `resourceMode: direct` 且 ready 即被杀 ⇒ 加速档不建成
  (uberJar:false / staticJsa:false),绝对值恒是「失活态」读数,只作双臂/跨轮对照,不作用户体感判据。
- **★本轮启动路径的代码面**:Electron 壳 **0 文件**;Python/vendor **0 文件**;Java 仅 `RuntimeWire`
  版本号常量。前端有 3 个 boot 路径文件被碰(`global.js` 增 `installAlignHooks()`、`pages/index.js`、
  `models/app.js`),但**方向都是加钩子/加逻辑**,只可能变慢不可能变快 —— 更佐证上面的机器态归因。
  缩放钩子在默认档(zoom=1)直接短路返回、**探针 DOM 从未创建**(守卫 T2 有「零 reflow 成本锁」用例)。
- **★增量更新**:差量门实测 **7MB / 0.8% 下载 / 99.2% 复用**(真变 19MB,预算 79MB);
  **CDS 档 byte-identical vs 3.9.4** —— 存量用户升级近乎无感。

### 温启对照 v3.9.4(2026-08-20 同步轮·术数真值校准;horosa_warm_ab_stamp_v1)

- **构建自洽 A/B(startup_ab,双臂同构建 A=B,6/臂弃首样 ⇒ n=5,commit `6e9c2512`)**:
  warmReady 中位 **6263 / 6200ms**(p95 6804 / 6364),两臂相距 **−1.0%** = 构建自洽,无回归信号。
  **workspaceVisible 816 / 782ms**(p95 858 / 838,预算 1500 内 ✓);spawnToVisible 1070 / 1057ms。
  工件:`docs/perf-artifacts/startup_ab_v394_warmstamp.json`。
- **🔴 #64 机器态照录**:`currentClockMHz 2611 == maxClockMHz`(睿频压制)+ `mumuRunning: true`
  (owner 应用,未动)。绝对值属机器态区间读数:近六轮同台同压制态 warmReady 中位带 =
  **6200-7210ms**(v3.7.3 7210/7056 → v3.8.0 6846/6661 → v3.9.2 6572/6607 → v3.9.3 7007/6978 →
  本轮 **6263/6200**)——**本轮落在该带的下沿**,是近六轮最快的一次,更无越界之虞。
  workspaceVisible 同带(近六轮 867/794/831/858/852/845/836 → 本轮 816/782)。
- **★最硬论据 = 代码级不变性(启动路径零改动)**:Electron 壳 **0 文件**;Python **0 文件**
  (本轮 port 含 0 个 astropy 文件);Java 仅 `RuntimeWire` 版本号常量,无业务逻辑改动。
  前端 11 个改动件全在组件/文案层(liureng 三件、astro3d、reader、ziwei、bazimsg、helper 全屏段),
  无一在 boot 关键路径上。**⇒ 结构上不存在本版引入的温启回归面**,上表 A/B 只作台账留痕。
- **★退役面对性能中性**:`horosa_fullscreen_state_v1` 两补丁退役后由上游等价实现承载
  (→ gotcha #101),订阅/量测都发生在用户进全屏时,不在启动路径;A/B 双臂同带即实证。
- **★台架结构限制照旧**:`resourceMode: direct` 且 ready 即被杀 ⇒ 加速档不建成
  (`uberJar:false / staticJsa:false / anyJsa:2`),绝对值恒是「失活态」读数,只作双臂/跨轮对照。
- **★增量更新**:差量门实测 **8MB / 1.0% 下载 / 99.0% 复用**(真变 15MB,预算 72MB);
  **CDS 档 byte-identical vs 3.9.3** —— 存量用户升级近乎无感。

### 温启对照 v3.9.3(2026-08-20 同步轮·占星古典设置大扩充;horosa_warm_ab_stamp_v1)

- **构建自洽 A/B(startup_ab,双臂同构建 A=B,6/臂弃首样 ⇒ n=5,commit `ec7f6782`)**:
  warmReady 中位 **7007 / 6978ms**(p95 7246 / 7171),两臂相距 **−0.4%** = 构建自洽,无回归信号。
  **workspaceVisible 845 / 836ms**(p95 954 / 869,预算 1500 内 ✓)—— 用户「双击到可见工作区」段
  与近五轮读数(836-867ms)完全同带。工件:`docs/perf-artifacts/startup_ab_v393_warmstamp.json`。
- **🔴 #64 机器态照录**:`currentClockMHz 2611 == maxClockMHz`(睿频压制)+ `mumuRunning: true`
  (owner 应用,未动)。绝对值属机器态区间读数:近五轮同台同压制态 warmReady 中位带 =
  **6572-7210ms**(v3.7.3 7210/7056 → v3.8.0 6846/6661 → v3.9.2 6572/6607 → 本轮 7007/6978),
  本轮落带内、无越界 —— 带内 ±5% 波动为后台负载噪声,历轮已档。
- **★最硬论据 = 代码级不变性**:启动路径**零改动** —— Electron 壳 0 文件;Python 就绪链
  (webchartsrv 门前段/registry/ledger)0 改动;Java 仅四控制器古典参数透传 + RuntimeWire 版本号,
  均不在启动路径上。台架结构限制照旧(`resourceMode: direct`,ladder 失活态读数,只做对照)。

### 温启对照 v3.9.2(2026-08-14 同步轮·档案管理体系;horosa_warm_ab_stamp_v1)

- **构建自洽 A/B(startup_ab,双臂同构建 A=B,6/臂弃首样 ⇒ n=5,commit `dc2335e4`)**:
  warmReady 中位 **6572 / 6607ms**(p95 7371 / 6704),两臂相距 **+0.5%** 落在噪声内
  ⇒ **构建自洽,无回归信号**。**workspaceVisible 852 / 825ms**(p95 902 / 835,预算 1500 内 ✓);
  spawnToVisible 1144 / 1102ms。工件:`docs/perf-artifacts/startup_ab_v392_warmstamp.json`。
- **🔴 绝对值按 #64 读**:机器态仍为睿频压制(`currentClockMHz 2611 == maxClockMHz 2611`,
  W-11955M 睿频 ~4.5GHz ⇒ `turboSuppressedLikely: true`)+ `mumuRunning: true`(owner 应用,**绝不擅杀**)。
  故 warmReady 超 4500 预算属机器态,门如实打 `OVER(check #64 machine state first)`。
- **★跨轮对照(同机同压制态,五轮同一平台)**:v3.8.0 6846/6661 → v3.8.1 6290/6392 →
  v3.9.0 6533/6483 → v3.9.1 6650/6635 → 本轮 **6572/6607**,±3% 单轮噪声域,**无趋势性劣化**;
  workspaceVisible 五轮 867/794/831/858/852 同域。
- **★本轮启动路径代码面(逐处核过)**:Python 就绪链 **0 改动**(本轮 port 含 0 个 astropy 文件);
  Java 仅 `RuntimeWire` 版本号常量;Electron 壳 **2 文件**(main.js/preload.js)但只是
  「双保险副本」IPC 通道**注册**(`desktop:shadow-store-write/read-all`)——注册零工作,
  仅在渲染器调用时才落盘。前端档案体系新件(localRecordStore/unifiedBackup/autoBackup 等)
  全部组件级/工具级懒载,`check-chunk-dup` 实证首屏批次仍无引擎;启动新增的
  `reconcileShadowOnBoot` = 一次 IPC read-all + 4 键 localStorage 对账(毫秒级,fire 于渲染器
  boot 后,不在 runtime-ready 关键路径上)——上表 A/B 的 852/825ms 已含其代价,与前四轮同域即为实证。
- **★台架结构限制照旧**:`resourceMode: direct` 且 ready 即被杀 ⇒ 加速档不建成
  (`uberJar:false / staticJsa:false / anyJsa:2`),绝对值恒是「失活态」读数,只作双臂/跨轮对照。
- **★增量更新**:差量门实测 **8MB / 1.0% 下载 / 99.0% 复用**(真变 19MB,预算 79MB);
  **CDS 档 byte-identical vs 3.9.1** —— 档案体系大版本对存量用户仍近乎无感升级。

### 温启对照 v3.9.1(2026-08-13 同步轮 + 线上事故根治;horosa_warm_ab_stamp_v1)

- **构建自洽 A/B(startup_ab,双臂同构建 A=B,6/臂弃首样 ⇒ n=5,commit `92aea532`)**:
  warmReady 中位 **6650 / 6635ms**(p95 7192 / 6782),两臂相距 **−0.2%** 落在噪声内
  ⇒ **构建自洽,无回归信号**。**workspaceVisible 858 / 819ms**(p95 956 / 834,预算 1500 内 ✓);
  spawnToVisible 1153 / 1108ms。工件:`docs/perf-artifacts/startup_ab_v391_warmstamp.json`。
- **🔴 绝对值按 #64 读**:机器态仍为睿频压制(`currentClockMHz 2611 == maxClockMHz 2611`,
  W-11955M 睿频 ~4.5GHz ⇒ `turboSuppressedLikely: true`)+ `mumuRunning: true`(owner 应用,**绝不擅杀**)。
  故 warmReady 超 4500 预算属机器态,门如实打 `OVER(check #64 machine state first)`。
- **★跨轮对照(同机同压制态,四轮同一平台)**:v3.8.0 6846/6661 → v3.8.1 6290/6392 →
  v3.9.0 6533/6483 → 本轮 **6650/6635**,**波动 ±3% 属单轮 n=5 的噪声量级,无趋势性劣化**;
  workspaceVisible 四轮 867/794/831/858 同域。
- **★本轮启动路径代码面**:Electron 壳 **0 文件**;Python 就绪链 **0 改动**
  (v3.9.1 新增的 `geomancy/ephem.py` 是**按需 import 的计算件**,只在天文地占请求里被调,不在启动链上);
  Java 仅 `RuntimeWire` 版本号常量。**两处 issue 修复均在渲染层**:三式 24 控件搬回子组件
  (`SanShiInputPanel` 本就在 `horosa_freeze_subtabs_v1` 冻结之下 ⇒ **未激活时不重渲**,
  搬回后反而比留在主 render 里更省);3D 全屏改事件驱动后**去掉了两个 `setTimeout(100)` 竞态**,
  只在 `fullscreenchange` 与 `resize` 时各量两帧 —— **较原实现更少无谓重排**。
- **★台架结构限制照旧**:`resourceMode: direct` 且 ready 即被杀 ⇒ 加速档不建成
  (`uberJar:false / staticJsa:false / anyJsa:2`),绝对值恒是「失活态」读数,只作双臂/跨轮对照。
- **★增量更新**:差量门实测 **7MB / 0.8% 下载 / 99.2% 复用**(真变 13MB,预算 70MB);
  CDS 档 byte-identical vs 3.9.0 —— 修复版升级几乎无感。

### 温启对照 v3.9.0(2026-08-12 同步轮;horosa_warm_ab_stamp_v1)

- **构建自洽 A/B(startup_ab,双臂同构建 A=B,6/臂弃首样 ⇒ n=5,commit `bd6f52a7`)**:
  warmReady 中位 **6533 / 6483ms**(p95 6888 / 6545),两臂相距 **−0.8%** 落在噪声内
  ⇒ **构建自洽,无回归信号**。**workspaceVisible 831 / 803ms**(p95 861 / 807,预算 1500 内 ✓);
  spawnToVisible 1112 / 1082ms。
  工件:`docs/perf-artifacts/startup_ab_v390_warmstamp.json`(逐样本 + 机器指纹)。
- **🔴 绝对值必须按 #64 读:本轮机器态仍是「睿频压制」态**(与 v3.8.0/v3.8.1 戳同态):
  `currentClockMHz 2611 == maxClockMHz 2611`(W-11955M 睿频 ~4.5GHz ⇒ **turboSuppressedLikely: true**)、
  `mumuRunning: true`(owner 的 MuMu 模拟器常驻,**绝不擅杀 —— owner 红线**)。
  故 warmReady 超 4500 预算属机器态,门如实打 `OVER(check #64 machine state first)`。
- **★跨轮对照(同机同压制态)**:v3.8.1 轮 6290/6392ms → 本轮 **6533/6483ms**,同域内小幅波动
  (+2~4%,单轮 n=5 的噪声量级);v3.8.0 轮 6846/6661ms ⇒ **三轮横向看仍在同一平台,无趋势性劣化**。
  workspaceVisible 831/803 与 v3.8.1 的 794/765 同域。
- **★本轮是 +180K 行的大版本,但启动路径代码面几乎未动(逐文件核过)**:Electron 壳 **0 文件**;
  Python 就绪链(`webchartsrv.py` / `kentang/registry.py` / `startup_ledger.py`)**0 改动**
  —— 上游新增的 `wuzhao_classics/duanci/leizhan` 与 `cetian_yiyu*` 都是**被服务模块按需 import 的数据/逻辑件**,
  不在启动就绪链上;Java 仅 `RuntimeWire` 版本号常量。前端新增面(灵棋经/塔罗/风水扩容)全部走
  组件级 lazy(灵棋经已并入 `makeHealingFactory`),不入首屏批次 ——
  `check-chunk-dup` 实证首屏批次仍为 `[vendors-d3, shared-technique, …]` **无引擎**。
- **★台架结构限制照旧**(承 v3.7.2~v3.8.1 记档):`resourceMode: direct` 且 ready 即被杀 ⇒
  加速档链不建成(本轮 artifact 记 `uberJar:false / staticJsa:false / anyJsa:2`)。
  **该台架的绝对值恒是「失活态」读数,只能做双臂/跨轮对照,不能当建成态验收数。**
- **★增量更新**:差量门实测 **11MB / 1.3% 下载 / 98.7% 复用**(真变 33MB,预算 99MB);
  星历/JDK/玄史等大件字节恒等不重下,**CDS 档 byte-identical vs 3.8.1** —— 大版本不等于大下载。

### 温启对照 v3.8.1(2026-08-10 同步轮;horosa_warm_ab_stamp_v1)

- **构建自洽 A/B(startup_ab,双臂同构建 A=B,6/臂弃首样 ⇒ n=5,commit `13d0f977`)**:
  warmReady 中位 **6290 / 6392ms**(p95 6412 / 6491),两臂相距 **+1.6%** 落在噪声内
  ⇒ **构建自洽,无回归信号**。**workspaceVisible 794 / 765ms**(p95 849 / 780,
  预算 1500 内 ✓);spawnToVisible 1068 / 1028ms。
  工件:`docs/perf-artifacts/startup_ab_v381_warmstamp.json`(逐样本 + 机器指纹)。
- **🔴 绝对值必须按 #64 读:本轮机器态仍是「睿频压制」态**(与 v3.8.0 戳同态):
  `currentClockMHz 2611 == maxClockMHz 2611`(W-11955M 睿频 ~4.5GHz ⇒ **turboSuppressedLikely: true**)、
  `mumuRunning: true`(owner 的 MuMu 模拟器常驻,**绝不擅杀 —— owner 红线**)。
  故 warmReady 超 4500 预算属机器态,门如实打 `OVER(check #64 machine state first)`。
- **★跨轮对照(同机同压制态,这才是能说话的比较)**:v3.8.0 轮 **6846 / 6661ms** →
  本轮 **6290 / 6392ms**,**快约 6%** —— 方向上不存在回归。
- **★台架结构限制照旧**(承 v3.7.2~v3.8.0 记档):样本跑在 `resourceMode: direct` 且 ready 即被杀
  ⇒ 加速档链不建成(本轮 artifact 记 `uberJar:false / staticJsa:false / anyJsa:2`)。
  **该台架的绝对值恒是「失活态」读数,只能做双臂/跨轮对照,不能当建成态验收数。**
- **★最硬的论据 = 代码级不变性(逐文件核过)**:启动路径**零改动** —— Electron 壳 **0 文件**;
  Python **0 文件**(本轮零 Python 改动);Java 仅 `RuntimeWire` 版本号常量。前端为纯渲染路径
  (盘面美术 wheelArt prop 穿线 + 新 AstroWheelArtChart 组件),不在启动就绪链上;
  workspaceVisible 794/765ms 与 v3.8.0 的 867/842ms 同域即为实证。
- **★增量更新**:差量门实测 **10MB / 1.2% 下载 / 98.8% 复用**(星历/JDK/玄史等大件与 v3.8.0
  逐字节一致不重下;CDS 档 byte-identical vs 3.8.0),健康。

### 温启对照 v3.8.0(2026-08-09 同步轮;horosa_warm_ab_stamp_v1)

- **构建自洽 A/B(startup_ab,双臂同构建 A=B,6/臂弃首样 ⇒ n=5,commit `d3febced`)**:
  warmReady 中位 **6846 / 6661ms**(p95 7403 / 6997),两臂相距 **−2.7%** 落在噪声内
  ⇒ **构建自洽,无回归信号**。**workspaceVisible 867 / 842ms**(p95 1006 / 867,
  预算 1500 内 ✓)—— 用户「双击到能看见工作区」这一段完全正常;spawnToVisible 1168 / 1139ms。
  工件:`docs/perf-artifacts/startup_ab_v380_warmstamp.json`(逐样本 + 机器指纹)。
- **🔴 绝对值必须按 #64 读:本轮机器态仍是「睿频压制」态。** 台架自带的 `machineAtStart` 当场记下:
  `currentClockMHz 2611 == maxClockMHz 2611`(W-11955M 睿频 ~4.5GHz ⇒ **turboSuppressedLikely: true**)、
  `mumuRunning: true`(owner 的 MuMu 模拟器常驻)。**MuMu 是 owner 应用,绝不擅杀(owner 红线)。**
  故 warmReady 超 4500 预算属机器态,门也如实打 `OVER(check #64 machine state first)`。
- **★跨轮对照(同机同态,这才是能说话的比较)**:v3.7.3 轮同台架同压制态记录 **7210 / 7056ms**,
  本轮 **6846 / 6661ms** —— **本版反而快约 5%**,方向上不存在回归。
- **★台架结构限制照旧(承 v3.7.2/v3.7.3 记档,勿重复踩)**:样本跑在 `resourceMode: direct` 且
  ready 即被杀 ⇒ 加速档链不建成(本轮 artifact 记 `uberJar:false / staticJsa:false / anyJsa:2`)。
  **该台架的绝对值恒是「失活态」读数,只能做双臂/跨轮对照,不能当建成态验收数。**
- **★最硬的论据 = 代码级不变性(逐文件核过)**:启动路径**零改动** —— Electron 壳 **0 文件**;
  Python 就绪链(`webchartsrv.py` / `kentang/registry.py` / `startup_ledger.py`)**0 改动**;
  Java 仅 `RuntimeWire` 版本号常量 + `ZiWeiChart` 截空正副(不在启动路径上)。
  本轮性能面唯一新增是**上游** AI 分析的渐进载入(只影响该页首帧,不在启动就绪链上),
  与我方 `horosa_freeze_subtabs_v1` 相容互补且已按上游新结构重新落位。
- **★载荷两修对启动的影响 = 零**:`horosa_payload_residue_free_v1`(剪 204.5KB 构建机残渣)与
  `horosa_source_eol_upstream_v1`(151 文件换行归位)都**不改运行时行为**,只影响发货字节;
  实测差量 **10MB / 1.2% 下载 / 98.8% 复用**,健康。

### 温启对照 v3.7.3(2026-08-04 同步轮;horosa_warm_ab_stamp_v1)

- **构建自洽 A/B(startup_ab,双臂同构建 A=B,6/臂,commit a9216e7e)**:warmReady 两臂中位
  **7210 / 7056ms**(去首样本;首样本 10256/7729 为实例首跑),两臂相距 **2.1%** 落在噪声内
  ⇒ **构建自洽,无回归信号**。**workspaceVisible 848 / 838ms**(early-nav 活,预算 1500 内)——
  用户「双击到能看见工作区」这一段本轮完全正常。
  工件:`docs/perf-artifacts/startup_ab_v373_warmstamp.json`(逐样本 + 机器指纹)。
- **🔴 绝对值必须按 #64 读:本轮机器态是「睿频压制」态,不是版本对比。**
  台架自带的 `machineAtStart` 当场记下:`currentClockMHz 2611 == maxClockMHz 2611`
  (W-11955M 睿频 ~4.5GHz ⇒ **turboSuppressedLikely: true**)、`mumuRunning: true`
  (owner 的 MuMu 模拟器常驻,MuMuVMMHeadless 累计 150,329 CPU-s / 4GB 工作集)。
  **MuMu 是 owner 应用,绝不擅杀(owner 红线)。** 故本轮 7.1s 与上一轮 6.65s 的差
  **不构成版本回归判据** —— 两次读数的机器态不同,#64 明令「先做同机同后台对照再谈回归」。
- **★台架结构限制照旧(承 v3.7.2 记档,勿重复踩)**:样本跑在 `resourceMode: direct` 且
  ready 即被杀 ⇒ 加速档链不建成(本轮 artifact 记 `uberJar:false / staticJsa:false`)。
  **该台架的绝对值恒是「失活态」读数,只能做双臂对照,不能当建成态验收数。**
- **★本轮最硬的论据 = 代码级不变性(逐文件核过)**:启动路径**零改动** ——
  Electron 壳 **0 文件**;Python 侧 `webchartsrv.py` / `kentang/registry.py` / `startup_ledger.py`
  **全部 unchanged**;Java 侧除 `RuntimeWire` 版本串外 **0 文件**(`ZiWeiChart` 不在启动路径上)。
  ⇒ 结构上不存在本版引入的温启回归面;唯一启动影响是版本 bump 使旧加速档失效需重建
  (每次 bump 皆有,JV-21 更新收尾自动重建承接)。
- **裁决线:建成态数字以 owner 实机安装后读数为准**(startup-history 自带 `ladder` 字段,自解释)。

### 温启对照 v3.7.2(2026-08-04 同步轮;horosa_warm_ab_stamp_v1)

- **构建自洽 A/B(startup_ab,双臂同构建 A=B,6/臂,commit 06950a0e)**:warmReady 两臂中位
  **6646 / 6713ms**(逐样本 6601-6785,首样本各 8375/7274 为实例首跑);workspaceVisible
  **822-870ms**(early-nav 活,预算 1500 内)。两臂差落在噪声内 ⇒ **构建自洽,无回归信号**。
  工件:docs/perf-artifacts/startup_ab_v372_warmstamp.json(逐样本带机器指纹)。
- **★台架结构限制(本轮查明,入档防下轮重复踩)**:startup_ab 的样本跑在
  `resourceMode: "direct"`(直接起 win-unpacked)**且每样本 ready 后即被杀** ⇒
  **加速档链(uber jar 合并 + static CDS dump)在该模式下从不建成**。本轮专门做过养档尝试
  (同隔离环境启一次 + dwell 300s):首次进沙箱付 43.7s 载荷物化后仅剩 ~4 分钟,
  结果 `.jsa` 计数 **0**、history 三行 `ladder:{uber:false,static:false}`。
  ⇒ **该台架产出的绝对值恒为「失活态」读数,与建成态基准(owner 机 4118/4236ms)不同 regime,
  禁止直接比较**;它的正确用途是**双臂对照**(旗标 A/B、版本自洽),不是绝对值验收。
  下轮若真要建成态数字:或延长 dwell 至 ≥10min 并确认链条触发条件,或直接用 owner 机实测
  (history 自带 ladder 字段,自解释)。
- **★本轮更强的论据 = 代码级不变性(比任何台架数字都硬)**:v3.7.2 的启动路径**逐文件核过**——
  Electron 壳改动文件数 **0**;Python 侧 **0 改动**;Java 侧只有 `RuntimeWire` 版本串。
  唯一的启动影响是**版本变更导致旧加速档失效需重建**(每次 bump 都有,JV-21 更新收尾自动重建承接)。
  ⇒ 结构上不存在本版引入的温启回归面。**裁决线:建成态数字以 owner 实机安装后读数为准。**

### 温启对照 v3.7.1(2026-08-04 同步轮;horosa_warm_ab_stamp_v1)

- **构建自洽 A/B(startup_ab,双臂同构建 A=B,6/臂,commit 88642d33)**:medianDeltaPct **3.3%**
  =构建自洽;workspaceVisible 中位 843-878ms(early-nav 活,预算 1500 内)。工件:
  docs/perf-artifacts/startup_ab_v371_warmstamp.json(样本逐条带机器指纹)。
- **⚠️ 本轮绝对值不可判读(#64 双重污染,如实记录)**:①测时机器处**压制态**(CurrentClockSpeed
  钉基频 2611MHz==Max、MuMu 五进程常驻、同日全量构建/测试负载,指纹已入样本);②沙箱为
  **失活态**(`ladder:{uberJar:false,staticJsa:false}` 入档)——warmReady 6.7-9.4s 段=
  「压制×无档」复合,与建成态基准(v3.7.0 建成态 4077/4118ms)**不同 regime,禁止对比**。
- **★ owner 实感「稳定 6s」当场结案(2026-08-04,ladder 字段第一次真正兑现价值)**:
  owner 机 startup-history 连续四行自解释,**不需要任何推断**:

  | 本地时刻 | totalMs | spawnToPorts | ladder |
  | --- | --- | --- | --- |
  | 08-03 23:42 | 4970 | 4393 | uber=T static=T |
  | 08-04 00:17 | **8312** | 7584 | **uber=F static=F** |
  | 08-04 00:18 | **5930** | 5153 | uber=T **static=F** |
  | 08-04 00:19 | **4236** | 3761 | uber=T static=T |

  即:**加速档失效 → 逐档重建的过渡态**(8.3s → 5.9s → 4.2s,三次启动内自愈),
  **不是代码回归**。三条制度结论:
  ① 「6s 段」的唯一已知成因至此收敛为**档失效过渡态**(#89 判例的同族第二次实证);
  ② W0c 的 ladder 字段是本判据的**充分条件** —— 没有它,这四行只是「5s/8s/6s/4s 噪声」,
     照旧要靠同机旧版对照才敢下结论(#64 的成本);
  ③ **遗留待查(不阻发)**:23:42(双档建成)→ 00:17(两档全失效)之间**是什么让档失效的**
     尚无证据。JV-21 只覆盖「更新后」这一条失效路径;若非更新触发,则存在第二条失效路径,
     下一轮首项 = 给档失效点加因由字段(who/why invalidated),让下次同样自解释。
- **裁决线:v3.7.1 建成态温启以 owner 实机读数 + 静机复测为准;压制态窗口不夜判(#64/#89)。**

### 温启对照 v3.7.0(2026-08-03 覆盖修轮;horosa_warm_ab_stamp_v1 首戳)

- **建成态受控 A/B(沙箱养档后双臂,5/臂,安静机)**:postgate ON 中位 **4077** vs OFF **4091ms**
  (**Δ14ms=零差异**);建成态中位 ≈4.08s 与 R11 基准 4096 持平 ⇒ **v3.7.0 无建成态温启回归**。
  失活态等化双臂(startup_ab,5/臂)Δ145ms(2.3%)。工件:docs/perf-artifacts/
  startup_ab_w0d-postgate_*.json + ab_built.log(history 尾 10 行含新 ladder 字段)。
- **归因修正(#64 三踩)**:owner 实感 5042/5051ms「Δ9ms 系统性」样本实为**本机全天构建负载的
  机器态**;双样本窗口内自洽 ≠ 同机同态对照。真实痛点=更新后阶梯失活过渡态(6.1s 段跨多会话,
  JV-21 更新建档槽根治其复发)。W0d 结构加固照发(金标双臂零漂移,Δ14ms 噪声级),
  `horosa_pregate_prewarm_budget_v1` 门防未来真重链服务。
- **W0c ladder 字段首战即立功**:本轮 A/B 判读直接读样本内 `ladder:{uber,static}`,失活/建成
  两 regime 不再可能混谈。

### v3.6.0 启动追记(2026-07-31;台架=scripts/startup_ab.cjs,新 jar 阶梯重建后稳态)

- **温启 runtime-ready:阶梯建成态中位 3846 / p95 3865-3935ms(双臂一致)——较 v3.5.1 的
  4096/4189 再快 ~6%,预算 4500 内 PASS**;失活态(新 jar 使旧档失效、阶梯重建前)6089-6092ms,
  一至两个使用会话内自动建成(uber+static 实录:本轮 static 73.5MB 新指纹档)。
- 台架口径工作区可见 796-1060ms(1500 判别线内);敌意冒烟双码页 GBK 冷 59.7s(全新物化+冷 JVM)
  / UTF-8 温 8.1s;6b 一键启停 ready+自动停+零残留(关机动态 CDS 落档)。机器态=睿频压制+MuMu
  常驻(#64 保守值)。

- 冷物化并发 A/B 与桶账(startup_ab --cold,3/臂,headless+packed 载荷,Defender=suspect 态):
  **conc 12 中位 30148 / p95 31145ms;conc 24 = 30845/32105(+2.3% 更慢)→ 默认 12 维持**
  (busyMs 206→430s 翻倍 = AV 扫描队列竞争,墙钟零收益;<15% 改善线)。桶账首采:
  py-sitepkgs 12,607 文件 = busyMs 74%(仅 29% 字节)= 文件数税实锤;se1 busyMs 3.3s ⇒
  request-blocking 分级维持不做(决策线全文在 PERF_INVENTORY JV-19)。firstBoot 预算 60s 内 PASS。

## 人工矩阵节(FreezeSubTab 切回原样;12 代表文件)

- 3.5.0 轮:自动代理已证「切回可交互可落定」(25 技法真实往返、14 技法样本);滚动/残影两维属人眼。
- 3.5.1:随验收轮复核;建议 owner 抽 3-4 对(占星↔八字、紫微↔六壬、三式↔太乙)人眼过一遍,
  关 `horosa.perf.freezeSubTabs` 对照即可。
