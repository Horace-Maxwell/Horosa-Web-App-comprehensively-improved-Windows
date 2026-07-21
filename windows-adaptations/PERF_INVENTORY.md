# Windows 性能改进总账(tracked)

> **这份文件存在的理由**:owner 的要求是「这些独有的改进都要彻底制度化,确保以后任何别的 session
> 就算没有上下文也可以确保全面落实」。台账(`README.md`)回答「有哪些 Windows 适配」,
> 这里回答「**哪些是性能改进、各自的开关是什么、被哪条哨兵钉住、实测收益多少**」。
>
> **它由门守着,不是一份会腐烂的文档**(`check_perf_inventory_sync`):
> * **P1 不许说谎** —— 「哨兵」列里写的每个钉,必须在 `release_selfcheck.py` 的 `SENT` 里真实存在。
>   声称有覆盖而实际没有 = FAIL。**这条是这份文件值得存在的全部理由。**
> * **P2 开关必须真在** —— 文中写的每个 `horosa.perf.X` / `HOROSA_X`,必须在目标文件里真实存在。
>   上游同步悄悄删掉一个 kill-switch,会在这里被抓到。
> * **P3 反向覆盖** —— `perfFlags.js` 里定义的每个 `horosa.perf.*`、任何 overlay 补丁引入的每个
>   `HOROSA_*`,**必须**在此有一行。**你没法加一个性能改动而不进总账。**
> * **P4 无僵尸** —— 状态 ∈ `windows-only` / `upstreamed-to-Mac` / `retired`;`retired` 行不得还有活哨兵。
>
> 散文列(「干什么」「实测收益」)由人写、不设门;每个机器可核的格子都设门。
> 这就是对「不同步的文档比没有更糟」的回答。

## 一、后端 Python(astropy / flatlib-ctrad2 / vendor)

| ID | 目标 | 干什么 | kill-switch | 哨兵钉 | 实测收益 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| PY-1 | `flatlib/ephem/swe.py` | **星历路径短路** —— `applySiderealMode` 每次 swe 调用都走一趟 `ensureEphePath`,而重设路径是**幂等**的。追踪当前生效路径,未变则跳过。★ 同时守卫 `swisseph.close`,任何人关闭句柄即作废追踪器(否则短路不安全) | `HOROSA_EPHE_PATH_FASTPATH` | `horosa_ephe_path_fastpath_v1` | 单次 `BirthJieQi.compute` 里该函数被调 **680 次/82ms(占 61%)**;compute **135→12.5 ms(10×)**;`/jieqi/birth` 端到端 **154→28.5 ms** | windows-only |
| PY-2 | `vendor/kinqimen/jieqi.py` | 六十甲子提模块常量(原每请求重建 **4,712 次**、282,720 次 lambda) | `HOROSA_QIMEN_JIAZI_CONST` | `horosa_qimen_jiazi_const_v1` | 见 PY-5 合计 | windows-only |
| PY-3 | `vendor/kinqimen/config.py` | 同参重复调用收敛(`zhifu_n_zhishi` 每请求 15 次、内部 helper 各调两遍)+ **七处四路定局改惰性**(★ 刻意不给 `.get` 默认值,保住 option 越界的 `ResultCode -1` 语义) | — | `horosa_qimen_cse_v1` / `horosa_qimen_lazyju_v1` | 见 PY-5 合计 | windows-only |
| PY-4 | `vendor/kinqimen/kinqimen.py` | `Qimen` 实例级 memo(实例 == 请求),消掉 `overall()` 对 `pan()` 的重复求值 | `HOROSA_QIMEN_PAN_MEMO` | `horosa_qimen_pan_memo_v1` | 见 PY-5 合计 | windows-only |
| PY-5 | (PY-2 + PY-3 + PY-4 合计) | 奇门引擎热路径 Tier-1 | 同上 | 同上 | `/qimen/pan` 中位 **282→65.7 ms(4.3×)**;3528 例黄金矩阵墙钟 **835.5→142.4 s(5.87×)**;**逐字节零漂移**,开关关闭后同样零漂移 | windows-only |
| PY-6 | `astropy/websrv/webwangjisrv.py` | 皇极经世典籍按需取(原每次 `/wangji/pan` 都随响应发 979,910 字节全文) | — | `horosa_wangji_classics_ondemand_v1` | **1,961,244 → 27,249 B(72×)** | windows-only |
| PY-7 | `astropy/astrostudy/xuanshi/celestial.py` + `websrv/webxuanshisrv.py` | 玄学史长文本按需 + `microchronology` 纳入模块 memo(原**绕过** `load_events` 每次重查 SQLite) | — | `horosa_xuanshi_longtext_ondemand_v1` | 第二次 **1,127.7 → 11.7 ms(96×)**;载荷 **26.4 MB → 257 KB** | windows-only |
| PY-8 | `astropy/astrostudy/perchart.py` | 同请求内纯函数结果 memo(67 恒星批 / 28 宿批 ×2 / 日出 / 围攻 / 互容)+ **`getParallel` 稳定排序** | — | `_getFixedStars67Cached` … / `horosa_decl_parallel_stable_order_v1` | 重复盘 617-747 → 443-504 ms | windows-only |
| PY-9 | `astropy/astrostudy/india/primitives.py` + `india/yoga_engine.py` | **输出确定性** —— `set` 顺序不得泄漏进响应(发货 app 不设 `PYTHONHASHSEED` ⇒ 每次重启软件列表顺序都可能变) | — | `horosa_rasi_drishti_stable_order_v1` / `horosa_yoga_planet_order_v1` | 跨进程 **72/205 例仅顺序有别 → 0/205** | windows-only |
| PY-10 | `astropy/astrostudy/jieqi/{BirthJieQi,NongLi,YearJieQi}.py` | 瘦 Chart 快路径(只读一个角/一个黄经时不建整盘) | `HOROSA_JIEQI_FAST_APPROACH` | `_JIEQI_FAST_APPROACH` | 21.6× / 44.3×(历史轮) | windows-only |
| PY-11 | `flatlib/ephem/ephem.py` | 恒星批有界 LRU(8 条,线程安全,存取双 deepcopy 防 relocate 串染) | `HOROSA_STAR_LRU` | `_STAR_LRU` | 379-480 → 183-236 ms(历史轮) | windows-only |
| PY-12 | `astropy/astrostudy/guostarsect/guo74.py` | 走 28 宿批缓存入口 | — | `getRawFixedStarSu28Cached` | 随 PY-8 | windows-only |
| PY-13 | `astropy/websrv/webchartsrv.py` | 玄学史预热(门后执行,绝不延长业务请求);PERF-R9 改瞄真正贵的 `microchronology` | `HOROSA_XUANSHI_WARMUP` | `xuanshi_summary_warmup_v1` | 玄学史首点秒开 | windows-only |
| PY-14 | `astropy/websrv/webchartsrv.py` | **删掉 `/chart` 的 `print(data)`** —— 每次请求把**整个请求字典**(出生日期/时间/经纬度/地名)同步写 stdout;打包件里 stdout 经管道回主进程并落日志文件 ⇒ 请求路径上的同步写盘,且用户出生信息被持续写进日志。调试残留,产线无人读 | `HOROSA_CHART_DEBUG_DUMP`(默认关,置 1 恢复旧行为) | `horosa_chart_no_stdout_dump_v1` | 去掉每 `/chart` 一次同步写盘;兼修隐私面 | windows-only |
| PY-15 | `astropy/websrv/kentang/registry.py` + `webchartsrv.py` | **预装「请求路径内惰性 import」的重模块** —— `kintaiyi.pan(enable_game_theory=True)` 才 `from .game_theory import TaiyiGame`(793 行)。★ 刻意拆成独立的 `prewarm_kentang_modules()` 并放在 `STARTUP_GATE.set()` **之后**:并进门前的 `prewarm_kentang_services()` 等于把启动门整整推迟 528ms。只 import 不调用 ⇒ 零盘面副作用 | `HOROSA_KENTANG_MODULE_PREWARM` | `horosa_kentang_prewarm_modules_v1` | 冷导入 **528.1 ms → 温 0.001 ms**;太乙首次勾「博弈论」不再白等这半秒 | windows-only |
| PY-16 | `astropy/astrostudy/xuanshi/__init__.py` | 玄学史子模块惰性导入(启动期不装 SQLite 底座与全部子模块) | `HOROSA_XUANSHI_LAZY_IMPORT` | `xuanshi.lazyImport` / `_LAZY_SUBS` | 缩短挂载段 | windows-only |
| PY-17 | `local/.../start_horosa_local.sh`(Web/本地版启动器) | 首启前预编译 `.pyc`,避免首个请求付编译成本 | `HOROSA_WEB_PYC_PRECOMPILE` | `start_horosa_local.webLauncherHardening` | Web 版首启更快 | windows-only |

## 二、后端 Java(astrostudysrv)+ Electron 壳

| ID | 目标 | 干什么 | kill-switch | 哨兵钉 | 实测收益 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| JV-1 | `electron/service-manager.js` | **关掉 Redis + 禁用显式 GC** —— 关闭旗标此前以 Spring 程序参数形式传递,而该键任何 properties 文件里都不存在 ⇒ **十几个版本以来一直是空操作**;机器上无 Redis ⇒ 每次缓存读写都抛 ⇒ `reconnect()` 里的 `System.gc()` ⇒ SerialGC 下 512MB 堆 stop-the-world | (无;`HOROSA_CHART_CACHE=0` 整体关缓存) | `horosa_paramhash_redis_kill_v1` / `-Dparamhash.cache.redis.enable=false` / `-XX:+DisableExplicitGC` | 单次 full GC **56.2 ms**、**每次缓存操作精确 2 次**;冷 `/chart` **1814→490 ms(3.7×)**、温 **179→40 ms(4.5×)**、full GC **归零** | windows-only |
| JV-2 | `astrostudycn/.../ChartController.java` | `/chart` 逐段计时(纯观测) | — | `CHART_PERF_SEG_REV` / `QueueLog.info(AppLoggers.Performance` | 观测本身;兼作重建 jar 哨兵 | windows-only |
| JV-3 | `boundless/.../QueueLog.java` | 去掉每条日志的同步栈回溯 | `-Dhorosa.queuelog.callerLocation=true` 恢复 | `horosa.queuelog.callerLocation` | 历史轮 | windows-only |
| JV-4 | `electron/build-uber-jar.py` + `service-manager.js` | uber-jar + 分层 CDS + exploded 扁平 classpath | `HOROSA_EXPLODED_LAUNCH` / `HOROSA_SHIP_FAT_JAR` | `HOROSA_UBER_OK` / `classpath.idx` / `HOROSA_EXPLODED_LAUNCH` | fat-jar 23.9 s → exploded 15.9 s | windows-only |
| JV-5 | `astrostudy/.../ParamHashCacheHelper.java` | 本地磁盘缓存可持久化判定(避免 POJO 污染) | `paramhash.cache.local.enable` | `PARAMHASH_PERSISTABLE_REV` | 重复/切回秒回 | windows-only |
| JV-6 | `astrostudy/.../ParamHashCacheHelper.java` + `electron/service-manager.js` | **磁盘缓存目录移出 payload 树** —— `LocalDir` 原先只经 `PropertyPlaceholder` 取值(**读不到 `-D`**),默认落在 `user.dir` 下即 `embedded-runtime/<payloadId>/` 之内;每次更新换 payloadId,启动清扫连缓存一起删 ⇒ **每发一版所有用户回到全冷**。新增 `resolveFlag`(先 `-D` 再属性文件),启动器指向 `userDataDir/cache/paramhash`。★ 已核实清扫正则 `^[0-9a-f]{16,64}…$` 只匹配十六进制 payloadId 目录,`cache` 不会被误删 | `-Dparamhash.cache.local.dir` | `horosa_paramhash_localdir_sysprop_v1` / `private static String resolveFlag` | 磁盘缓存跨版本存活(此前每版归零) | windows-only |
| JV-7 | `astrostudyboot/.../AstroStudyProgram.java` | 启动期八字/农历预热(把首次 `/chart` 的一次性成本挪进启动空闲) | `HOROSA_CHART_WARMUP` / `HOROSA_CHART_WARMUP_REV` | `HOROSA_CHART_WARMUP_REV` | 首次 `/chart` 不再付冷装载 | windows-only |
| JV-8 | `astrostudy/.../NongliHelper.java` | 农历日表持久化(跨启动复用,免每次重算) | `HOROSA_NONGLI_DAY_PERSIST` / `HOROSA_NONGLI_DAY_PERSIST_REV` | `HOROSA_NONGLI_DAY_PERSIST_REV` | 农历相关端点冷路径变短 | windows-only |

## 三、前端(astrostudyui)

| ID | 目标 | 干什么 | kill-switch | 哨兵钉 | 实测收益 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| FE-1 | 41 个组件 | **稳定 React key** —— 曾有 222 处 `key={randomStr(8)}`,每次渲染整棵子树卸载重建 | (无;仓库级门禁止回归) | `horosa_stable_react_keys_v1` | umi 4855 通过、**0 个 key 警告**;门 `check_no_random_react_keys` 永久守护 | windows-only |
| FE-2 | `services/_kentangResultCache.js` + 13 个接入点 | kentang raw-fetch 结果缓存(原 14 个调用点里 11 个零缓存)。★ **绝不缓存随机起卦**:地占/荆诀/五兆(`mode≠ganzhi` 时) | `horosa.perf.techniqueResultCache` | `horosa_kentang_result_cache_v1` | 切技法再切回、选项 A↔B↔A 免重算 | windows-only |
| FE-3 | `utils/requestDedupe.js` | **L1 改真 LRU** —— 命中不重插 + 从头淘汰 = FIFO,后台预取会挤掉用户正在反复访问的条目 | `horosa.perf.requestDedupe` / `horosa.perf.techniqueCache` | `horosa_dedupe_l1_lru_v1` | 回归断言受控验证(撤掉修复即 1/13 红) | windows-only |
| FE-4 | `utils/perfMark.js` + `pages/index.js` + `models/astro.js` | **交互跨度观测** —— 修好三处失灵(起点只在切页签打点、快车道从不打 end、`perfMark.js` 零调用点) | `horosa.perf.interactionMarks` | `horosa_interaction_span_v1` / `markInteractionStart` | 使「点击→中右栏画完 ≤1s」可验收 | windows-only |
| FE-5 | `utils/idleWarmQueue.js` + 4 个 builder | 排盘后数据层空闲预热(组式 API,generation 作废旧组)。**任务清单已于 PERF-R9 Ship 7 改注册表,见 FE-16** | `horosa.perf.idleWarmQueue` / `horosa.perf.dataWarmTasks` | `scheduleDataWarmGroup` | 首点即时 | windows-only |
| FE-6 | `utils/preciseCalcBridge.js` + `JieQiChartsMain.js` | 分至邻位预取(year±1) | `horosa.perf.neighborPrefetch` | `prefetchJieqiYearNeighbors` | 邻位秒开 | windows-only |
| FE-7 | `models/astro.js` + `ChartFormData.js` + `AstroFormComp.js` | 预测性预计算(表单编辑期防抖预发同参请求,只暖缓存) | `horosa.perf.speculativePrecompute` | `speculativePrecomputeEnabled` / `scheduleLivePrecompute` | 点击→显示≈渲染耗时 | windows-only |
| FE-8 | `services/astro.js` | `chartMem` 只缓存有效盘(错误信封不入缓存) | — | `chartMem_valid_only_v1` | 对既有路径也是净改善 | windows-only |
| FE-9 | `components/planetarium/PlanetariumBabylon.js` | 天文馆渲染门控 / 按需渲染 / 心跳 / 指标节流 / 时间编辑防抖 | `horosa.perf.planetarium*`(5 个) | `perf:planetariumRenderGating` 等 | 空闲不空转 | windows-only |
| FE-10 | `components/ziwei/ZiWeiMain.js` | 紫微本盘走确定性缓存 | `horosa.perf.techniqueResultCache` | `techniqueResultCacheEnabled` | 重复/来回切秒回 | windows-only |
| FE-11 | `components/xuanshi/XuanShiMain.js` + `echartsCore.js` | 首屏 4 请求并行 + echarts 模块化(整包→按需 `use()`) | `horosa.perf.firstLoadParallel` | `firstLoadParallelEnabled` / `./echartsCore` | 首开更快、包更小 | windows-only |
| FE-12 | `services/xuanshi.js` | 无界裸对象缓存改**有界 LRU(96)** | — | `horosa_kentang_result_cache_v1`(同批) | 修内存泄漏 | windows-only |
| FE-13 | 9 个技法组件(`astro/IndiaChartMain` · `auxchart/AuxChartMain` · `dunjia/DunJiaMain` · `sanshi/SanShiUnitedMain` · `taiyi/TaiYiMain` · `ziwei/ZiWeiMain` · `guolao/GuoLaoChartMain` · `direction/AstroDirectMain` · `lrzhan/LiuRengMain`)+ `models/astro.js` | **技法步进预取注册表(PERF-R9 Ship 7)** —— 此前只有 `/chart` 一个端点进预取,而**非占星页 gate 面板的是技法端点**,点下一步照样等一次冷计算。各技法在自己的组件里 `registerStepPrefetcher`(登记必须在组件内:构参吃组件态,模块级构不出同键 body);两段式技法只登记 stage-1。配套改任务序为**近端优先 + 技法端点先于同向 chart**(旧序技法任务恒被预算砍掉)、登记方收到**已步进**的 fields(旧版传基准 fields = 预取当前那张盘 = 白打)、预算 3→5、间隔改自适应 `max(80ms, 上个任务耗时)`、`chartMem` 96→192 | `horosa.perf.stepPrefetch`(关=零登记零提交) | `horosa_prefetch_registry_v1` | 覆盖面 1 个端点 → 9 个技法族;步进「下一步」由冷计算变缓存命中 | windows-only |
| FE-14 | 8 个技法组件的 `hook.prewarmRequests`(印占 / 辅盘 / 星运 / 遁甲 / 七政 / 六壬 / 三式 / 太乙) | **`prewarmRequests` 铺开到全部技法(PERF-R9 Ship 7)** —— 与主 `/chart` **互不依赖**的技法端点在 `/chart` 返回**之前**并行发出,latency 从「网络 + 技法」变 `max(网络, 技法)`。silent、丢结果、**绝不 `dispatch`/`setState`**;一律显式 `retry:{retries:0}`(后端重启窗口里 N 个深度预取绝不能变成 N×10 次退避重试风暴) | `horosa.perf.prewarmRequests`(关=模型层不调用,逐字节旧序) | `prewarmRequests`(随各组件既有哨兵条目并入) | 首点 latency 由串行和变并行最大值 | windows-only |
| FE-15 | `utils/stepPrefetch.js` + `utils/request.js` + `utils/chartFetch.js` + `utils/__tests__/stepPrefetchWhitelist.test.js` | **预取白名单从注释变运行时闸(PERF-R9 Ship 7)** —— 旧任务契约 `{name, run}` 的 `run` 是**不可内省的闭包**,`submitStepPrefetch` **从不看 URL**;旧允许集里裸 `/pan` 还**匹配不到任何真实路径**(真路径是 `/qimen/pan`…)= 形同虚设。⇒ 任何登记方都能把【随机起卦 / 取现时 / 流式】端点塞进预取队列,而预取它们 = 把随机结果或「此刻」**钉死进缓存** = 功能性降级(比慢更糟)。两层修:①契约加 `path` 声明位,提交期不合格即**丢弃**;②**纵深防御**(`path` 是自述的)—— pump 期间置 ambient 标志,`request.js`/`chartFetch.js` 对不合格 URL 拒发并计数。★ kentang 全族走 `chartFetch` 的**裸 fetch**,没有第二层整族在任何白名单之外。★ `/{key}/pan` **逐条枚举绝不通配**(`/*/pan` 会放进地占与五兆两个随机端点)。★ 非预取作用域**恒放行** ⇒ 用户真实请求逐字节零行为变化 | `horosa.perf.stepPrefetch`(总闸) | `horosa_prefetch_runtime_whitelist_v1` | 七类禁区端点(骰子/地占/五兆/荆诀/AI 流式/天文馆/七政 Moira)机械断言**零泄漏**;`prefetchRefusalCount` 可观测 | windows-only |
| FE-16 | `utils/dataWarmTasks.js`(新文件)+ `utils/idleWarmQueue.js` + `pages/index.js` | **数据层预热改注册表(PERF-R9 Ship 7)** —— 清单原本写死在 `pages/index.js` 的一条 **4 元素数组**里,与技法零关系的页面组件持有技法知识,漏项没人发现(**紫微 `/ziwei/birth` 首点概率最高却整轮不在组里**)。改注册表后追加一条 = 一行登记,`Map` 插入序 = 首点概率序 = 执行序;据此补入紫微 / 遁甲 stage-1 / 太乙 stage-1 / 分至 `/jieqi/year` 四条(分至是唯一重端点,**排最后一位**,只吃真正的空闲尾巴) | `horosa.perf.idleWarmQueue`(总)/ `horosa.perf.dataWarmTasks`(细) | `horosa_data_warm_registry_v1` | 预热覆盖 4 → 8 条;四个漏项技法的首点由冷计算变命中 | windows-only |
| FE-17 | `utils/techniqueChartFree.js` + `fengshui/FengShuiMain.js` + `calendar/CalendarMain.js` + `cntradition/CnTraditionMain.js` | **chartFree 快车道扩容(PERF-R9 Ship 7)** —— 声明 `hook.chartFree = true` 的页,`fetchByFields` 走快车道:fields 立即提交、**不等 `/chart` 网络**(整整省掉一次往返)。上一轮遗留的三个「已核实但无从声明」候选本轮核毕迁入;风水页此前连 `hook` 都没接(故无从声明),补接 `hook` **只为承载声明**、不注册 `.fun`。★ 组件里的声明与本表登记是**一对**:只登记不声明 = 无效;只声明不登记 = `chartFreeContract` 契约测试红 | `horosa.perf.fieldsFastCommit`(关=全部页回到「到齐才提交」) | `horosa_chart_free_declared_v1` | 风水 / 黄历 / 辅助三页由「等一次 `/chart` 往返」变点击即出 | windows-only |
| FE-18 | `pages/index.js` | **`changeCond` 就地变异根治(PERF-R9 Ship 7)** —— 旧写法 `{...fields}` **只拷顶层** ⇒ `flds.date` 与 `fields.date` 是同一个对象,`flds.date.value = x` 改的是 state 里那个对象本身;「旧 fields」与「新 fields」的嵌套引用完全相同,任何按引用比较的 `React.memo`/`shouldComponentUpdate` 都会判错。**这是本轮渲染优化的前提** —— 不修它,后面加多少 memo 都是白加。与 `models/astro.js` 的 `fetchByChartData` 早已修好的是同一个 bug | (无;纯正确性修复) | `horosa_change_cond_no_mutate_v1` | 使 memo/SCU 类优化第一次真正生效 | windows-only |
| FE-19 | 101 处 `setState` 回调(占星 / 黄历 / 八字 / 紫微 / 汉堡学派 / 各技法壳,共 73 个文件里的绝大多数) | **面板就绪观测终点 `markPanelReady`(PERF-R9 Ship 6)** —— 改之前 `render-complete` **只由 `chartObj.chartId` 变化触发**(= 排盘回来那一刻),而右栏技法面板**自己**那次 `setState` 之后的重绘完全不在计内 ⇒ owner 的验收口径「点击 → 中栏 + 右栏画完 ≤ 1 秒」**根本量不出来**(量到的是排盘返回时刻,面板还没画)。修:在每个技法「结果落定的那一次 `setState` 的回调」里打点(双 rAF 逼近「本帧已绘」+ generation 去重,同一轮只记一次)。**纯观测、零行为变化** —— 但没有它,后面 FE-20/FE-21 的收益无从验收 | `horosa.perf.interactionMarks`(同 FE-4 总闸) | `horosa_panel_ready_v1` / `markPanelReady(` | 使「点击 → 中栏+右栏画完」第一次成为可测量的量 | windows-only |
| FE-20 | 盘面与重表格组件的 `sCU` / `React.memo`(紫微 4 · 八字 6 · 数算 4 · 汉堡学派 3 · 黄历 3 · 3D 1 · 七政星宗 2 · 印占 2 · AI 1 · 六壬盘 / 命理其他壳 2) | **`sCU` / `React.memo` 拆分(PERF-R9 Ship 6)** —— 父组件一次无关 `setState` 此前会穿透到最重的那棵子树。一律走 `utils/chartUpdateGuard` 的 `wrapperPropsEqual` / `shallowPropsEqual`:函数型 props 视为恒等、显示数组按内容比、**自身 `state` 引用变恒重渲**(安全性地基 —— props/state 一变必渲 ⇒ `componentDidUpdate` 里的重画判据一次都不会被吞掉)。只吃掉「props 与 state 都没变」的纯冗余重渲,那种情况下旧代码走完 `render` 后各自的 `didUpdate` 比较也全等、什么都不做 ⇒ 跳过前后**行为逐字节一致**,只少付一次 reconcile。★ 前提是 FE-18 已根治 `changeCond` 的就地变异,否则嵌套引用相同、按引用比较全部判错 | `horosa.perf.chartSCU`(关 ⇒ 比较器恒返 `false` = 逐字节旧行为) | `horosa_panel_scu_v1` / `horosa_shallow_scu_v1` / `horosa_shusuan_native_scu_v1` / `horosa_ziwei_chart_scu_v1` / `horosa_ziwei_input_scu_v1` / `horosa_ziwei_luck_scu_v1` / `horosa_ziwei_pattern_scu_v1` / `horosa_bazi_finechart_scu_v1` / `horosa_bazi_info_split_v1` / `horosa_bazi_chartbazi_memo_v1` / `horosa_bazi_child_memo_v1` / `horosa_bazi_param_memo_v1` / `horosa_bazi_flow_derive_memo_v1` / `horosa_bazi_deadwork_v1` / `horosa_dial_scu_v1` / `horosa_frames_scu_v1` / `horosa_lazy_right_panels_v1` / `horosa_guolao_doc_scu_v1` / `horosa_guolao_doc_static_rows_v1` / `horosa_kinastro_center_memo_v1` / `horosa_kinastro_render_memo_v1` / `horosa_markdown_lru_v1` / `horosa_aspect_dom_memo_v1` / `horosa_no_mutate_chart_params_v1` / `horosa_no_state_mutation_v1` | 无关 `setState` 不再穿透到最重的子树 | windows-only |
| FE-21 | `components/comp/FreezeInactive.js`(`FreezeSubTab` 本体)+ 27 个接入子页签的技法壳 | **子页签冻结(PERF-R9 Ship 6)** —— antd `Tabs` 默认把**全部**子页签常驻渲染:改一次时间或选项,就把每一页重画一遍(推运页是「一个方法一张盘 + 一套表」× N 个方法)。改受控 `activeKey` + `FreezeSubTab`:只渲前台那一个,切回时拿本轮最新 `children` 立即渲一帧 —— **不卸载、不重发请求、不丢滚动位置**。配套 `horosa_controlled_tab_clamp_v1`:页签集合由后端结果决定、会随结果变化,用户选过的键仍在就保持,否则回落默认键、再不在就取首个,**绝不停在不存在的键上显示空白** | `horosa.perf.freezeSubTabs`(关 = 恒渲旧行为)/ `horosa.perf.subTabDeferMount`(关 = 不延迟首次挂载) | `horosa_freeze_subtabs_v1` / `horosa_controlled_tab_clamp_v1` / `freezeSubTabsEnabled` / `subTabDeferMountEnabled` | 一次改动的重渲面从「全部子页签」缩到「前台一个」 | windows-only |
| FE-22 | `pages/index.js`(idle 预载队列)+ `data/citiesFull.json` | **城市大库空闲预载(PERF-R9 Ship 6)** —— `GeoCoordSelector.componentDidMount` 才动态 `import` 3.85MB 的城市全库,于是「点开选地点」**当场**付取包 + `JSON.parse`,是全站最大的单次现付成本;而改出生地 / 事件地是首屏之后最常发生的操作之一。登记进既有 idle 预载队列,`order 1.5` = 排在全部 hot 技法 chunk 之后、normal 之前(队列本身仍是 `requestIdleCallback` 逐个执行、用户一交互就让路,不与首屏抢主线程)。**只改「何时付」,不改任何取数 / 匹配 / 渲染语义**:`GeoCoordSelector` 那边的 `import()` 一字未动 —— 预载过则秒回,未预载或关闸则完全是旧行为 | `horosa.perf.cityDbIdlePreload` | `cityDbIdlePreloadEnabled`(并入 `pages/index.js` 既有哨兵条目) | 「点开选地点」由现付 3.85MB 变已就绪 | windows-only |

## 三之二、Mac 上游的性能开关(Windows 依赖它们,但**不是** Windows 首创)

> 这一节是被 **P3 反向覆盖**逼出来的:我按自己知道的写完总账后,门当场报出 `perfFlags.js` 里
> 还有 **26 个开关没登记**。它们大多来自 Mac 上游。**必须登记的理由有两条**:
> ① 让未来的 session 不会把它们误当成 Windows 首创而在收敛时删掉;
> ② 也不会把它们当成噪音而忽略 —— Windows 的多项改进(预取/缓存/防抖)是**架在它们之上**的。
> 状态一律 `upstreamed-to-Mac`:同步时**照抄不擅动**,除非 Mac 自己改了。

| 开关(`horosa.perf.*`) | 作用 | 谁依赖它 |
| --- | --- | --- |
| `stepPrefetch` | 时间步进预取调度器(总闸) | **FE-13 的技法预取注册表建在它之上** |
| `leadingDebounce` | 180ms leading+trailing 防抖(单次操作 0ms 起跑) | FE-4 的交互起点必须打在它**之前** |
| `netResultCache` / `techniqueCache` | 请求结果缓存分层 | FE-3(L1 真 LRU)修的正是它的一层 |
| `hoverPrefetch` | 悬停预载 | 与 FE-5 空闲预热互补 |
| `prewarmRequests` | 技法自报预热请求(saga 侧管道) | **FE-14 把它铺开到全部技法** |
| `chartSCU` / `chartDrawGuard` / `chartCloneLite` | 盘面重渲/重绘守卫、轻量克隆 | 渲染侧基础 |
| `freezeInactiveTabs` | 非活动页签冻结 | 渲染侧基础 |
| `ziweiLocalFirst` / `ziweiRulesCache` | 紫微本地引擎优先 / 规则缓存 | FE-10 建在其上 |
| `silentTechniquePanels` | 技法面板静默请求(不弹全局 loading) | FE-2 的缓存分支必须原样转发它 |
| `singleTriggerPredictive` / `fieldsFastCommit` / `hookRaf` | 推运单次触发 / 字段快提交 / hook 走 rAF | 交互链路 |
| `lazySnapshot` | AI 快照惰性生成 | 导出链路 |
| `bootGate` / `rsaSessionKey` / `sharedNativeModel` | 启动门 / 会话密钥复用 / 原生模型共享 | 启动链路 |
| `planetariumOnDemandRender` / `planetariumIdleHeartbeat` / `planetariumMetricsThrottle` / `planetariumTimeEditDebounce` | 天文馆四闸 | 与 FE-9 同族(FE-9 是 Windows 侧的 renderGating) |
| `astro3dOnDemand` / `astro3dMorph` / `astro3dSpriteLabels` | 3D 星盘三闸 | 3D 链路 |

## 四、已知缺口(诚实登记,不粉饰)

| 缺口 | 说明 |
| --- | --- |
| 高纬度整盘 8-16 秒 | `perchart.py:944 _phasis_event` 的 `swisseph.heliacal_ut` 从 `birth_jd-15` **无上界**前搜偕日升/没,极昼极夜下单次 2.03 秒(占整盘 99.7%),而结果只在 ±7 天内才采用。69°N 8.1s / 78°N 2.1s / 40°N 36ms,**与房屋制无关**。已在黄金矩阵里以 `north-hi` 钉住,任何针对它的优化都必须逐字节证明输出不变。**未修**。 |
| 公元前西洋盘 | `/chart` 对 `{"date":"0044/03/15","ad":0}` 返回 `{"err":"param error"}`。v3.5.0 的全年份域似乎只覆盖 kentang 术数引擎(极端年探针全 RC0),西洋盘可能走另一套参数形状或确实没覆盖。**待查**。 |
| jest 不进发布门 | 冷启 >4 分钟,硬接进 `dist:win` 两轮内必被绕过。改为结构性钉住(哨兵 + 契约门 R1/R3/R4),缺口**明写**在 `CONTRACT_EXEMPTIONS.md`。 |
