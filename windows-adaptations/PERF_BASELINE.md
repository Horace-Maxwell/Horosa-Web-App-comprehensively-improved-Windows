# 性能验收证据(tracked;由 `check_perf_baseline_evidence` 门守护)

> **这份文件存在的理由**:让「发布前必跑验收」从口头纪律变成机器可核的硬条件。门核三件事:
> ① `version:` 必须 == `desktop_installer_bundle/package.json` 的 version(**机器可核的新鲜度**:
>    bump 版本而不重跑验收 → 这里的旧版本号立刻红);
> ② 预算三常量必须 == `scripts/perf_acceptance.cjs` 里的字面默认(口径永锁,单边改必红);
> ③ 逐技法表行数 ≥ 20(结构完整)。
> **明写的边界**:门**不**校验数字本身的新鲜与优劣 —— 机器态(睿频压制/后台模拟器,gotcha #64)
> 不可 CI 化;数字判定属于人:任何超标先做**同机同后台旧版对照**,再谈回归。

## 本版验收头

- version: 3.7.0
- build: release(v3.7.0 **功能轮**:新增天星择日·征象搜索主导航页[navigationPages 新键
  zeri,32 类条件引擎,electionscan 服务挂 :8899 CORE_SERVICE_SPECS]+ 卜卦判读三修 +
  奇门置闰定局修正;**启动路径零改动**[壳层零字节变,Java 仅 RuntimeWire 版本号],
  性能面新增=zeri 的 P5 观测终点[markPanelReady('zeri'),照 ElectionMain 先例]与
  P6 结构性豁免[区间扫描型无步进主轴];缓存由上游 cachedKentangFetch 三层承载,
  引擎全文零 random/零 now() 已核=确定性标签实证)
- date: 2026-08-02(键石+zeri 复测日;逐技法全表存档日 2026-07-22)
- commit: 见本轮发布 commit(v3.7.0 同步轮,feat `adf073a5`)
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

## 逐技法验收表(26 键;2026-07-22 v3.5.1 打包件实测,repeat=10,--step-unit 天;zeri 行=2026-08-02 v3.7.0 冷沙箱实测)

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
