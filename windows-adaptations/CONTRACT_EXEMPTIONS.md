# 五层契约 —— 显式豁免表(tracked)

> **为什么这个文件是 tracked 的**:`desktop_installer_bundle/scripts/release_selfcheck.py`(所有门的载体)
> 按政策 **gitignored**。它丢失是「可检测」的(`HARNESS_MANIFEST.md` 有 sha256),但**不可从 git 恢复**。
> 一个零上下文的 session 至少必须能读到「哪些东西被刻意放过、为什么」—— 否则它只会看到一堆门,
> 却不知道缺口在哪。豁免必须留在 **tracked 树**里。
>
> **判据(由 selfcheck 强制)**:
> * 理由必须 ≥ 40 字符且不得是占位符 —— 空理由 / 「TODO」 / 「暂时」 / 「同上」 一律视同**未登记**,门 FAIL。
>   (「同上」被明确拒绝是有来由的:该门首跑就抓到了一条写着「同上」的豁免。零上下文的读者无从知道「上」是哪一条。)
> * 键指向的路径若已不存在 ⇒ **陈旧豁免 = FAIL**。陈旧豁免会烂成盲区:它让门以为「这里已解释过」,
>   而实际上被解释的东西早就没了。
> * 想加豁免?先问一遍「能不能改成不需要豁免」。这张表越短越好。

## 哨兵层豁免(有实物、但不走 `SENT` needle 门)

| 层 | 键 | 理由 |
| --- | --- | --- |
| sentinel | `start_horosa_local.sh` | Web 一键启动脚本;其内容由 `check_local_launchers()` 的 `sh_specs` 单独钉住(存在性 + `bash -n` + marker 三重),口径与 needle 门不同,重复登记会造成两处判据漂移 |
| sentinel | `verify_horosa_local.sh` | 同上;`bash -n` 语法门 + marker 双验已在 `check_local_launchers`,不进 `SENT` |

## 运行期缺口(结构性钉住,但发布门里不真跑)

| 层 | 键 | 理由 |
| --- | --- | --- |
| test-run | `astrostudyui/src/utils/__tests__/idleWarmQueue.test.js` | jest 冷启在本机 >4 分钟、曾与 `dist:win` 同跑到 889 秒;把它接进发布门,两轮之内必被人绕过,那比现在更糟。**已改为结构性覆盖**:`SENT` 钉住文件在 + 三条关键断言在;真跑走人工 `npx umi-test <file>`。这个缺口是**明写**的,不是粉饰的 |

## 清单层豁免(`update-harness-manifest.py` 的 `EXEMPT`)

| 层 | 键 | 理由 |
| --- | --- | --- |
| manifest | `desktop_installer_bundle/electron/__pycache__` | Python 字节码副产物,非源文件;内容随解释器版本变化,收编只会制造无意义的 sha 漂移 |
| manifest | `desktop_installer_bundle/scripts/__pycache__` | Python 字节码副产物,非源文件;与 electron/ 下那个同理,内容随解释器版本变化,收编只会制造无意义的 sha 漂移 |

## P5 观测覆盖层(`check_perf_observation_coverage`)—— 动态归属映射与豁免

> 键 = `pages/index.js` `navigationPages` 的技法键。`dynamic:<UI 相对路径>` 表示该键的
> `markPanelReady` 归属由所指文件按 config 动态分发(门会核验该文件同时含
> `markPanelReady(` 与 `moduleKey: '<键>'`);普通行 = 真豁免(该技法结构上不可打点)。

| 层 | 键 | 理由 |
| --- | --- | --- |
| p5-observation | `shusuan` | dynamic:src/components/kinastro/KinAstroMain.js —— 数算 9 个子技法共用一个宿主组件,归属键经 `this.config.moduleKey` 动态给出('shusuan');打字面量会退化成 serviceKey 类错键(PERF-R9 实测恒零样本的根因) |
| p5-observation | `mingother` | dynamic:src/components/kinastro/KinAstroMain.js —— 与 shusuan 同宿主:策天/一掌经的 `moduleKey: 'mingother'`、演禽为伪页签 'yanqin',全部经 config 动态分发,同一文件同一机制 |
| p5-observation | `astrodata` | 名人库是 iframe 装载的离线独立页(public/astrodata/index.html,sql.js 浏览器内查询):宿主侧 perfMark 无法进入其文档,且 iframe 内交互不触发宿主捕获期 pointerdown ⇒ 起点/终点两头都不存在,结构上不可测;其加载性能由「首次点开才挂载 + 38MB 不入启动」策略单独治理 |

## P6 预取覆盖层(`check_prefetch_registry_coverage`)—— 动态登记映射与豁免

> 键 = navigationPages 技法键。`dynamic:<UI 相对路径>` 同 P5 语义(门核验该文件同时含
> `registerStepPrefetcher(` 与 `moduleKey: '<键>'`);普通行 = 结构性豁免。
> 想加豁免先问:这个技法的「下一步」真的不可预算吗?

| 层 | 键 | 理由 |
| --- | --- | --- |
| p6-prefetch | `shusuan` | dynamic:src/components/kinastro/KinAstroMain.js —— 数算 9 子技法共用宿主,登记键经 `this.config.moduleKey` 动态给出并随换轨迁移(_syncStepPrefetcher);字面量登记会在 mingother/yanqin 换轨时指错键 |
| p6-prefetch | `mingother` | dynamic:src/components/kinastro/KinAstroMain.js —— 与 shusuan 同宿主同机制;演禽伪页签 'yanqin' 的登记也由该文件的键迁移逻辑承接 |
| p6-prefetch | `astrochart` | 主盘 /chart 的 ±N 预取内建于 models/astro.js 的 buildStepPrefetchTasks(chartTasks 恒在,不经技法注册表)——再登记一份 = 同一端点双份任务白占预算 |
| p6-prefetch | `bazi` | chartFree 纯本地引擎(lunar-javascript/sxtwl 前端自算),时间步进零网络请求 —— 没有可预取的端点;/chart 底盘由内建 chartTasks 覆盖 |
| p6-prefetch | `fengshui` | chartFree 纯本地(玄空引擎前端自算),步进零网络;与 bazi 同理无端点可登记 |
| p6-prefetch | `calendar` | chartFree,黄历月历/日课走确定性历法端点但首点已由 dataWarmTasks 注册表暖(FE-16),步进语义是「换日期看月历」= /calendar/month 经 dedupe 白名单缓存,±N 预取收益已被月粒度缓存覆盖 |
| p6-prefetch | `cntradition` | chartFree 纯本地页(卦象符号/穿宫十二式/口诀速查全部前端自算),时间步进零网络请求,没有可登记的预取端点;/chart 底盘由内建 chartTasks 覆盖 |
| p6-prefetch | `guazhan` | 六爻随机起卦 —— 预取 = 把随机结果钉死进缓存(功能性降级,比慢更糟);gua 端点同时在 PREFETCH_FORBIDDEN_MARKERS 双闸 |
| p6-prefetch | `jieqichart` | 年份邻位预取由专门机制 prefetchJieqiYearNeighbors(FE-6)承担(year±1 粒度与本表 ±N 步进不同轴);/jieqi/ 在 dedupe 白名单,重复登记会双份取数 |
| p6-prefetch | `relativechart` | 合盘双人参数(另一人的生辰)不可从单侧 fields 步进推出 —— 预算「下一步」无定义;/modern/relative 在 dedupe 白名单,同参重放已覆盖 |
| p6-prefetch | `planetarium` | 取现时(实时天象),步进预取会把「此刻」钉死;NO_ARM_TABS + FORBIDDEN 双闸 |
| p6-prefetch | `aianalysis` | SSE 流式对话,无确定性「下一步」可预算;NO_ARM_TABS + FORBIDDEN 双闸 |
| p6-prefetch | `astrodata` | iframe 装载的离线名人库(sql.js 浏览器内查询 38MB 本地库),零后端端点、无时间步进语义,预取注册表对它没有任何可做的事 |
| p6-prefetch | `xuanshi` | 浏览/查询型(朝代/人物/事件树),交互是导航不是时间步进;首点由 PY-13 服务端预热覆盖 |

## 与 apply.sh 的耦合(改一处必须同时改另一处)

| 耦合 | 说明 |
| --- | --- |
| `files/` 逐字节等价断言 ↔ `apply.sh` §1 | 台账 #1/#2 的还原方式是直接 `cp` / `cp -r`,所以「工作区文件 sha256 == overlay 文件 sha256」这条断言才成立(它比 marker 更强:能抓到截断/损坏的部分还原)。**若 apply.sh 将来在拷贝后追加任何编辑,这条断言必须同步改**,否则会变成假红 |
| `package.json` 结构比对 ↔ `apply.sh` §3 | 判据镜像的是 §3 用 node 合并写入的字段(`name` + `scripts` 全量),而非整文件比对 —— Mac 的依赖变更不应触发红 |
