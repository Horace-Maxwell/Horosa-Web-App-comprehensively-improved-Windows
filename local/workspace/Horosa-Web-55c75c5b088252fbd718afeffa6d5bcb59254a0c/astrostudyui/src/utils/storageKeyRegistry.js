// 🔴 [V4 制度化] 全站持久化键注册表 —— 「所有信息跨会话滴水不漏」的单一真值源。
//
// 由来(用户明令):全量备份此前只点名 4 个 raw 键,而全站实际持久化键 ~180 个(含 ~50 个
// 不带 horosa 前缀的历史键,前缀 grep 必漏)。凡用户资产/设置不在备份面 = 迁机即丢。
// 本表把每一个键(或前缀)登记为四类之一,备份面由本表推导,并由三层防线看守:
//   ① 机械穷举哨兵(storageRegistryCompleteness.test):扫源码全部存储键字面量 diff 本表,
//      **新增键不登记即红**;
//   ② 运行时防呆:导出备份时扫 localStorage 实际全键,未登记键**默认按用户资产带走**
//      (宁多带不漏)并在 manifest.unknownKeys 留痕;
//   ③ preflight[212] 锚。
//
// kind 四类(backup 由 kind 推导,例外逐条显式):
//   'user-data'    用户创建的内容资产(不可再生) → 备份必带
//   'settings'     设置/偏好(可重配但费劲)     → 备份必带
//   'cache'        可再生派生缓存               → 不带(丢了只是多算一次)
//   'device-local' 设备绑定状态(迁移标志/窗口尺寸/性能调优/调试) → 不带(跨机带走反而害)
// 特殊 backup 值:
//   'dedicated'    不走 raw 整值直通,由全量备份专段处理(两库信封/回收站并集/AI-IDB 工作区)
//
// 匹配规则:精确 key 优先于 prefix;prefix 按最长匹配。
// ⚠ 登记新键时三思 kind:标错 'cache' = 用户数据被排除在备份外;标错 'user-data' 无害(多带)。

export const STORAGE_KEY_REGISTRY = [
	// ── 两库 + 回收站(全量备份专段:信封嵌套 / trash 并集) ──────────────────────────
	{ key: 'horosa.localCharts.v1', kind: 'user-data', backup: 'dedicated', label: '命盘库(信封嵌套专段)' },
	{ key: 'horosa.localCases.v1', kind: 'user-data', backup: 'dedicated', label: '事盘库(信封嵌套专段)' },
	{ key: 'horosa.localCharts.trash.v1', kind: 'user-data', backup: 'dedicated', label: '命盘回收站(并集恢复保本机)' },
	{ key: 'horosa.localCases.trash.v1', kind: 'user-data', backup: 'dedicated', label: '事盘回收站(并集恢复保本机)' },

	// ── IndexedDB 数据库(非 localStorage 键;字面量在源码,登记以过哨兵) ─────────────
	{ key: 'horosa.ai.analysis.v1', kind: 'user-data', backup: 'dedicated', label: 'AI 分析工作区 IndexedDB(对话/消息/元数据,aiWorkspace 专段全 store dump)' },
	{ key: 'horosa.record.revisions.v1', kind: 'device-local', backup: false, label: '记录版本历史 IndexedDB(本机撤销栈语义,每记录 10 版;备份带走的是当前真值,快照不随迁)' },

	// ── 用户内容资产(raw 整值直通) ────────────────────────────────────────────────
	{ key: 'horosa.lc.lifeEvents.v1', kind: 'user-data', backup: true, label: '人生事件(按事件 id 并集,同 id 保本机)' },
	{ key: 'HorosaLocalDeepLearn', kind: 'user-data', backup: true, label: '人生事件训练值' },
	{ key: 'horosa.tarot.dailyLog', kind: 'user-data', backup: true, label: '塔罗每日抽牌日志' },
	{ key: 'horosa.tarot.personalMeanings', kind: 'user-data', backup: true, label: '塔罗个人牌义(用户亲写)' },
	{ key: 'horosa.xuanshi.bookmarks.v1', kind: 'user-data', backup: true, label: '玄史书签' },
	{ key: 'horosa.xuanshi.history.v1', kind: 'user-data', backup: true, label: '玄史浏览历史' },
	{ key: 'horosa.zeri.schemes.v1', kind: 'user-data', backup: true, label: '西洋择日已存方案' },
	{ key: 'horosa.zeri.qimen.schemes.v1', kind: 'user-data', backup: true, label: '奇门择日已存方案' },
	{ key: 'horosa.zeri.huangli.schemes.v1', kind: 'user-data', backup: true, label: '黄历择日已存方案' },
	{ key: 'horosa.zeri.bazi.schemes.v1', kind: 'user-data', backup: true, label: '八字择日已存方案' },
	{ key: 'horosa.zeri.taiyi.schemes.v1', kind: 'user-data', backup: true, label: '太乙择日已存方案' },
	{ key: 'horosa.zeri.ziwei.schemes.v1', kind: 'user-data', backup: true, label: '紫微择日已存方案' },
	{ key: 'horosa.zeri.liureng.schemes.v1', kind: 'user-data', backup: true, label: '六壬择日已存方案' },
	{ key: 'horosa.zeri.sanshi.schemes.v1', kind: 'user-data', backup: true, label: '三式择日已存方案' },
	{ key: 'horosa.zeri.qizheng.schemes.v1', kind: 'user-data', backup: true, label: '七政择日已存方案' },
	{ key: 'horosa.zeri.india.schemes.v1', kind: 'user-data', backup: true, label: '印度择日已存方案' },
	{ key: 'horosa.mundane.region.user.v1', kind: 'user-data', backup: true, label: '世俗占星用户自定义区域' },
	{ key: 'horosa.report.glossary.global.v1', kind: 'user-data', backup: true, label: '术语表(全局,用户改动)' },
	{ key: 'ziweiBrightnessCustom', kind: 'user-data', backup: true, label: '紫微自定义亮度表(主存;IDB 另有镜像自愈)' },
	{ key: 'ziweiSihuaCustom', kind: 'user-data', backup: true, label: '紫微自定义四化表(主存;IDB 另有镜像自愈)' },
	// [Q-309/T-314] 纠正:CalculatorFormula 实为后端「公式帮助表」7 天缓存(Calculator.js 拉取 result.formula 落盘,配额清理白名单),非用户公式。
	{ key: 'CalculatorFormula', kind: 'cache', backup: false, label: '计算器公式帮助表缓存(后端拉取,7 天;非用户数据)' },
	// [Q-309/T-314] 工具箱三组历史键(常量标识符 / 模板串写入,穷举哨兵抓不到 → 此前未登记,备份靠兜底、存储健康报未登记):
	{ key: 'baziInverse', kind: 'settings', backup: true, label: '八字反查表单态(工具箱;最近一次查询条件)' },
	{ key: 'baziPattern', kind: 'settings', backup: true, label: '八字格局表单态(工具箱;最近一次查询条件)' },
	{ prefix: 'baziPattern_local::', kind: 'user-data', backup: true, label: '八字格局·用户手写属性笔记(按四柱+性别一条;用户资产)' },

	// ── 设置/偏好(raw 整值直通,恢复=整值替换) ─────────────────────────────────────
	{ key: 'horosa.ai.export.settings.v1', kind: 'settings', backup: true, label: 'AI 导出设置' },
	{ key: 'horosa.ai.mount.techniqueDefaults.v1', kind: 'settings', backup: true, label: 'AI 挂载每技法默认' },
	{ key: 'horosa.ai.analysis.ui.v3', kind: 'settings', backup: true, label: 'AI 分析 UI 偏好(当前模型选择/内页/挂载勾选/会话系统提示);provider 档案含 apiKey 密文存于 IndexedDB horosa.ai.analysis.v1/provider_profiles(密钥绑定本机钥匙串,跨机自动失效需重填,备份不含明文),不在此键' },
	{ key: 'horosa.ai.agent.enabled', kind: 'settings', backup: true, label: 'AI 助手行动能力总开关(默认关;仅 \'1\' 为开)' },
	{ key: 'horosa.ai.chat.contextPolicy.v1', kind: 'settings', backup: true, label: 'AI 对话上下文策略(历史窗口/trace 折叠/去重;缺省=窗口)' },
	{ key: 'horosa.tz.cnUnified', kind: 'settings', backup: true, label: '中国大陆统一北京时间归并开关(默认开;\'0\'=纯 IANA 地理时区,新疆回到 +06:00)' },
	{ key: 'horosa.ai.agent.approval', kind: 'settings', backup: true, label: 'AI 助手写入动作审批档(never=全自动可撤销 / on-request=每次确认 / read-only=只读禁写)' },
	{ key: 'horosa.ai.agent.approval.categories.v1', kind: 'settings', backup: true, label: 'AI 助手审批档按类别收紧(records/settings/workspace/tasks/query/external 各 inherit|never|on-request|read-only;只能比总档更严)' },
	{ key: 'horosa.ai.agent.trust.records.v1', kind: 'settings', backup: true, label: 'AI 助手信任的档案 cid 列表(载入/查询类写入免逐次确认;建档改设置永不因信任放行)' },
	{ key: 'horosa.ai.agent.external.policy.v1', kind: 'settings', backup: true, label: 'AI 助手外部客户端档(本机 MCP 调用方:approval auto|on-request|read-only / 每分钟调用上限 / 每小时写入上限;缺省 auto=现状)' },
	{ key: 'horosa.notify.desktop', kind: 'settings', backup: true, label: '桌面通知总开关(任务完成/失败/需要你 → macOS 横幅;缺省关;壳侧再限流 6/min)' },
	{ key: 'horosa.ai.tasks.goal.enabled', kind: 'settings', backup: true, label: 'AI 助手·目标任务子开关(1=开;缺省关=create_goal_task 不进工具目录、任务中心不起跑)' },
	{ key: 'horosa.ai.tasks.scheduler.enabled', kind: 'settings', backup: true, label: 'AI 助手·定时任务子开关(1=开;缺省关=schedule_task 不进工具目录、心跳到了也零执行)' },
	{ key: 'horosa.ai.tasks.scheduler.lastTickAt', kind: 'cache', backup: false, label: 'AI 助手·定时任务本机上次心跳毫秒(错过判定用;device-local 不备份)' },
	{ key: 'horosa.ai.tasks.scheduler.lease', kind: 'cache', backup: false, label: 'AI 助手·定时任务本机跳租约 {owner,until}(多窗口同时起跳只有租约主进执行体;device-local 不备份)' },
	{ key: 'horosa.ai.window.id', kind: 'cache', backup: false, label: 'AI 助手·窗口身份(sessionStorage:同一标签页刷新保持;任务记录 runner.owner 据此判「活窗口/死循环」;device-local 不备份)' },
	{ key: 'horosa.ai.chat.modelRoutes.v1', kind: 'settings', backup: true, label: 'AI 助手·按任务用模型六槽(工具轮/终稿/判官/审阅/规划/子任务;全空=跟随当前模型)' },
	{ key: 'horosa.ai.orchestrate.enabled', kind: 'settings', backup: true, label: 'AI 助手·多技法并行分析子开关(1=开;缺省关=/编排 只提示不发请求)' },
	{ key: 'horosa.ai.tools.external.enabled', kind: 'settings', backup: true, label: 'AI 助手·外部 MCP 服务器工具总开关(1=开;缺省关=一个外部工具都不注册)' },
	{ key: 'horosa.ai.tools.webSearch.enabled', kind: 'settings', backup: true, label: 'AI 助手·联网检索总开关(1=开;缺省关=web_search 不进工具目录、零出站)' },
	{ key: 'horosa.ai.tools.webFetch.enabled', kind: 'settings', backup: true, label: 'AI 助手·网页读取总开关(1=开;缺省关=web_fetch 不进工具目录、零出站;只出公网、本机内网拒)' },
	{ key: 'horosa.ai.tools.headless.enabled', kind: 'settings', backup: true, label: 'AI 助手·无头分析出口总开关(1=开;run_analysis 只经本机 MCP 可见;缺省关=不进任何目录)' },
	{ key: 'horosa.ai.tasks.goal.parallel', kind: 'settings', backup: true, label: 'AI 助手·目标任务并行上限(1..3;缺省不存在=现状不限不排队)' },
	{ key: 'horosa.ai.chat.routeProfiles.v1', kind: 'settings', backup: true, label: 'AI 助手·按任务用模型的具名方案 {profiles:{名:{routes,routeOptions}},active}(active 空=现状;切换=抄回两把活键)' },
	{ key: 'horosa.ai.automation.enabled', kind: 'settings', backup: true, label: 'AI 助手·自动化规则总开关(1=开;缺省关=引擎收到事件也零动作)' },
	{ key: 'horosa.ai.persona.v1', kind: 'settings', backup: true, label: 'AI 助手·个人口径文件(≤4000 字口径 + 启用注入/记忆注入/自动沉淀候选 开关;缺省全关=零注入)' },
	{ key: 'horosa.ai.agent.toolPolicy.v1', kind: 'settings', backup: true, label: 'AI 助手按工具名放行/禁用 {allow:[name],deny:[name]}(deny 任何档位都拒且不进目录;allow 只免写入类逐次确认;缺省空=现状)' },
	{ key: 'horosa.ai.chat.routeOptions.v1', kind: 'settings', backup: true, label: 'AI 助手·按槽思考档 {[槽]:{thinking}}(槽档优先于全局思考档;缺省不存在=全局档现状)' },
	{ key: 'horosa.ai.persona.layers.v1', kind: 'settings', backup: true, label: 'AI 助手·分层口径 {bySubject:{命主id:文本},byTechnique:{技法:文本}}(全局→命主→技法→会话 合成封顶 6000;受「启用注入」总开关;缺省不存在=只剩全局层)' },
	{ key: 'horosa.ai.agent.caps.v1', kind: 'cache', backup: false, label: 'AI 助手模型工具能力位缓存(per 档案::模型 原生工具调用是否可用,可重探)' },
	{ key: 'horosa.ai.agent.ledger.v1', kind: 'device-local', backup: false, label: 'AI 助手动作账本(本机撤销栈语义,200 条 FIFO,不随备份迁移)' },
	{ key: 'horosa.report.prefill.v1', kind: 'settings', backup: true, label: '文稿预填' },
	{ key: 'horosa.report.thinkingLevel', kind: 'settings', backup: true, label: 'AI 思考档' },
	{ key: 'horosa.sec.aiBodyEncrypt', kind: 'settings', backup: true, label: 'AI 请求体加密开关' },
	{ key: 'horosa.chart.classicalGlobals.v1', kind: 'settings', backup: true, label: '古典占星全局参数' },
	// [WP-7] 自定义界表 + 自定义恒星黄道槽位(星盘设置两 Modal;排盘条件下发)。
	{ key: 'horosa.astro.customTerms.v1', kind: 'settings', backup: true, label: '自定义界表(昼/夜两表)' },
	{ key: 'horosa.astro.customAyanamsa.v1', kind: 'settings', backup: true, label: '自定义恒星黄道槽位(≤10)' },
	{ key: 'horosa.chart.divinationJudgeGlobals.v1', kind: 'settings', backup: true, label: '卜卦判读全局参数' },
	{ key: 'horosa.astroTimeline.v1', kind: 'settings', backup: true, label: '占星时间线视图状态' },
	{ key: 'horosa.egypt.school.v1', kind: 'settings', backup: true, label: '埃及占星流派' },
	{ key: 'horosa.feigong.settings.v1', kind: 'settings', backup: true, label: '飞宫小成图设置' },
	{ key: 'horosa.guice.settings.v1', kind: 'settings', backup: true, label: '轨策设置' },
	{ key: 'horosa.guolao.engineMode', kind: 'settings', backup: true, label: '七政引擎模式' },
	{ key: 'horosa.guolao.kinastroQizheng.options', kind: 'settings', backup: true, label: '演禽七政选项' },
	{ key: 'horosa.india.rectify.prefs.v1', kind: 'settings', backup: true, label: '印占校正偏好' },
	{ key: 'horosa.lifespan.method', kind: 'settings', backup: true, label: '寿元法选择' },
	{ key: 'horosa.lingqi.settings.v1', kind: 'settings', backup: true, label: '灵棋经设置' },
	{ key: 'horosa.liuyao.settings.v1', kind: 'settings', backup: true, label: '六爻设置' },
	{ key: 'horosa.xiaochengtu.settings.v1', kind: 'settings', backup: true, label: '小成图设置' },
	{ key: 'horosa.xiaoliuren.settings.v1', kind: 'settings', backup: true, label: '小六壬设置' },
	{ key: 'horosa.liureng.settings.v1', kind: 'settings', backup: true, label: '六壬排盘设置(贵人体系/换将/分昼夜/涉害/始入课/年神排序/昼夜阳阴/土旺衰/时间算法/起课法)' },
	{ key: 'horosa.dunjia.settings.v1', kind: 'settings', backup: true, label: '奇门排盘设置(排盘体例/起局/盘式/值使/空亡驿马/八神预设/寄宫/飞盘顺逆/混合盘分层/年日刻家口径/暗干暗支/显示偏好)' },
	{ key: 'horosa.taiyi.settings.v1', kind: 'settings', backup: true, label: '太乙排盘设置(盘式/古法公式/时间基准/博弈/盘面标注/流派六键)' },
	{ key: 'horosa.sanshi.settings.v1', kind: 'settings', backup: true, label: '三式合一排盘设置(奇门层 / 太乙层 / 六壬层口径 + 贵人 + 时间算法)' },
	{ key: 'horosa.jinkou.settings.v1', kind: 'settings', backup: true, label: '金口诀排盘设置(换将 / 贵人昼夜表 / 起贵神盘 / 盘式 / 土长生 / 时间基准)' },
	{ key: 'horosa.wuzhao.settings.v1', kind: 'settings', backup: true, label: '五兆排盘设置(起兆法 / 筮法变体 / 刑神月 / 六兽与中栏视图)' },
	{ key: 'horosa.geomancy.settings.v1', kind: 'settings', backup: true, label: '地占排盘设置(起卦法 / 流派预设 / 读取范围 / 黄道体系 / 逐项覆盖 / 行星地占盘 / 字形叠加 / 地占三角含义取派)' },
	{ key: 'horosa.tarot.settings.v1', kind: 'settings', backup: true, label: '塔罗排盘设置(牌组 / 牌阵 / 牌面样式 / 种子来源 / 盘面开关 / 读法体系 / 定局法 / 精华牌 / 计时法)' },
	{ key: 'horosa.kinastro.settings.v1', kind: 'settings', backup: true, label: '策天飞星 / 一掌经 / 数算诸法排盘设置(算法 / 流派 / 口径 / 显示开关;各技法的键自带前缀)' },
	{ key: 'horosa.horary.settings.v1', kind: 'settings', backup: true, label: '卜卦盘排盘设置(流派 / 判读参数覆盖层 / 盘面叠层与聚焦 / 黄道 / 宫制)' },
	{ key: 'horosa.mundane.settings.v1', kind: 'settings', backup: true, label: '世俗盘排盘设置(世运规则集 / 判读容许度 / 入境主管制 / 恒星入境口径 / 世运大运年长 / 黄道 / 宫制)' },
	{ key: 'horosa.election.settings.v1', kind: 'settings', backup: true, label: '择日盘排盘设置(西方流派 / 逐项口径覆盖层 / 黄道 / 宫制)' },
	{ key: 'horosa.zeri.tianxing.settings.v1', kind: 'settings', backup: true, label: '天星择日排盘设置(黄道 / 宫制)' },
	{ key: 'horosa.direction.settings.v1', kind: 'settings', backup: true, label: '星运各子页排盘设置(南北交逆移 / 月长算法 / 行星年龄年数档 / 三分主星划分法与寿命基准 / 星历行运触发 / 返照双盘内外圈 / 波斯向运速率方向年数)' },
	{ key: 'horosa.guazhan.settings.v1', kind: 'settings', backup: true, label: '六爻起卦设置(自定义起卦 / 数字起卦的动爻取法)' },
	{ key: 'horosa.huangji.settings.v1', kind: 'settings', backup: true, label: '皇极经世排盘设置(心易发微起卦法)' },
	{ key: 'horosa.planetarium.settings.v1', kind: 'settings', backup: true, label: '天文馆显示设置(图层开关 / 星等上限 / 观测视角)' },
	{ key: 'horosa.acg.settings.v1', kind: 'settings', backup: true, label: '占星地图设置(主体线选集 / 投影 / 样式 / 各图层开关 / 宫制 / 地理等价流派 / 口径与坐标系 / 天体选项)' },
	{ key: 'horosa.babylon.settings.v1', kind: 'settings', backup: true, label: '巴比伦排盘设置(派系 / 逐项参数覆盖层)' },
	{ key: 'horosa.fengshui.settings.v1', kind: 'settings', backup: true, label: '风水排盘设置(流派:纳气 / 八卦阳宅 / 理气各派;罗盘盘面样式)' },
	{ key: 'horosa.xuanshi.state.v1', kind: 'settings', backup: true, label: '玄史视图状态' },
	{ key: 'xuanshi:density:events', kind: 'settings', backup: true, label: '玄史事件密度' },
	{ key: 'horosa.uranian.dial.v1', kind: 'settings', backup: true, label: '汉堡刻度盘配置' },
	{ key: 'horosa.uranian.gephem.v1', kind: 'settings', backup: true, label: '汉堡图形星历配置' },
	{ key: 'horosa.pd.columns.v1', kind: 'settings', backup: true, label: '主限法列配置' },
	{ key: 'horosa.pd.orb.v1', kind: 'settings', backup: true, label: '主限法容许度' },
	{ key: 'horosa.pd.pageSize', kind: 'settings', backup: true, label: '主限法分页大小' },
	{ prefix: 'horosa.pdsphere.', kind: 'settings', backup: true, label: '主限天球视图偏好族' },
	{ key: 'horosa.sidebar.collapse.v1', kind: 'settings', backup: true, label: '侧栏折叠' },
	{ key: 'horosa.ui.lightFlavor', kind: 'settings', backup: true, label: '浅色主题风味' },
	{ key: 'horosa.ui.skipDeleteConfirm.v1', kind: 'settings', backup: true, label: '删除确认跳过偏好' },
	{ key: 'horosa.reminders.enabled.v1', kind: 'settings', backup: true, label: '生日/整寿提醒开关(默认关,用户主动开启)' },
	{ key: 'globalSetup', kind: 'settings', backup: true, label: '全局设置(历史键)' },
	{ key: 'commtoolstab', kind: 'settings', backup: true, label: '工具页 tab 记忆' },
	{ key: 'readerBook', kind: 'settings', backup: true, label: '阅读器当前书' },
	{ key: 'horosaBackendIdentityOff', kind: 'settings', backup: true, label: '后端身份关闭开关' },
	{ key: 'horosaGuolaoLifeMode', kind: 'settings', backup: true, label: '七政命度模式' },
	// 七政挂载 schema storageKey 族(BodyMode/NodeMode/Su28Mode/Ayanamsa/TuibianMethod/GufaPrecess/
	// EqTropicalAnchor/LilithType/NodeType/TrueSolarTime…):无点 horosa 前缀+经变量写入,静态两轮
	// 扫描皆逃,被 C3 运行时前置闸抓获 —— 三层防线各司其职的实证。前缀一网打尽,未来同族新键自动归位。
	{ prefix: 'horosaGuolao', kind: 'settings', backup: true, label: '七政全局设置族(挂载 schema storageKey)' },
	{ key: 'horosaGeomancyHistory', kind: 'user-data', backup: true, label: '地占报数历史(用户起卦记录;V5-C3 闸找回的备份面缺口)' },
	{ key: 'horosa.deleted.log.v1', kind: 'user-data', backup: true, label: '删除日志(永久删除的最后防线,500 条 FIFO,可找回)' },
	{ prefix: 'liureng', kind: 'settings', backup: true, label: '六壬视图偏好族(历史无前缀键)' },
	{ prefix: 'suzhan', kind: 'settings', backup: true, label: '宿占视图偏好族(历史无前缀键)' },
	// [Q-377/T-357] 两枚以常量标识符写入的历史键(穷举哨兵只抓字面量首参 → 逃过登记;备份/存储健康此前按未登记兜底):
	{ key: 'chart3dOpt', kind: 'settings', backup: true, label: '3D 星盘显示设置(Astro3D chartOpt;历史无前缀键,常量标识符写入)' },
	{ key: 'guaData', kind: 'cache', backup: false, label: '八卦类象面板最近一次查询结果(GuaSymDesc;可再生的最近查询快照,历史无前缀键)' },
	// ziwei* 历史键族:全站紫微设置(38+ 键)。精确键条目(如 ziweiLateZiMigrated)优先于本前缀。
	{ prefix: 'ziwei', kind: 'settings', backup: true, label: '紫微设置族(历史无前缀键;自定义表两键已单列 user-data)' },

	// ── 可再生缓存(不带:丢了只是多算一次;quota 紧张可被清理) ──────────────────────
	{ prefix: 'horosa.localcalc.', kind: 'cache', backup: false, label: '本地计算缓存(RECOVERABLE 可清面)' },
	{ prefix: 'horosa.guadesc.cache.', kind: 'cache', backup: false, label: '卦辞缓存' },
	{ prefix: 'horosa.ai.snapshot.', kind: 'cache', backup: false, label: 'AI 挂载快照(QUOTA_EMERGENCY 告急清理面,可再生)' },
	{ prefix: 'horosa.reader.chapter.', kind: 'cache', backup: false, label: '阅读章节进度(RECOVERABLE 可清面=既定可丢语义)' },

	// ── 设备绑定(不带:跨机带走反而害) ─────────────────────────────────────────────
	{ prefix: 'horosa.perf.', kind: 'device-local', backup: false, label: '性能旗标族(设备调优,42+ 键)' },
	{ prefix: 'horosa.debug.', kind: 'device-local', backup: false, label: '调试开关' },
	{ key: 'horosa.compat.hasFallback', kind: 'device-local', backup: false, label: '兼容回退标志' },
	{ key: 'horosa.compat.alignZoom', kind: 'device-local', backup: false, label: '浮层缩放补偿开关(设 \'0\' 即全链退回补偿前行为;本机应急阀,不随迁)' },
	{ key: 'horosa.compat.zoomReprobe', kind: 'device-local', backup: false, label: '壳缩放探针多拍重测开关(设 \'0\' 即退回一拍旧行为;本机应急阀,不随迁)' },
	{ key: 'horosa.compat.svgCtmZoom', kind: 'device-local', backup: false, label: 'SVG 坐标矩阵缩放校正开关(设 \'0\' 即退回内核原始读数;本机应急阀,不随迁)' },
	{ key: 'horosa.compat.offsetXYZoom', kind: 'device-local', backup: false, label: '鼠标偏移量缩放校正开关(设 \'0\' 即退回内核原始读数;本机应急阀,不随迁)' },
	{ key: 'horosa.lc.idb', kind: 'device-local', backup: false, label: 'IndexedDB 可用性/迁移标志(带走会骗新机跳过迁移)' },
	{ key: 'horosa.localRecordStore.degraded', kind: 'device-local', backup: false, label: '存储降级会话标志' },
	{ key: 'horosa.localRecordStore.newerSchema', kind: 'device-local', backup: false, label: '超版记录提示事件名(非存储键,登记以过穷举哨兵,degraded 同例)' },
	{ key: 'horosa.map.consent.v1', kind: 'device-local', backup: false, label: '地图加载同意(设备+当下决定,不迁移)' },
	{ key: 'horosa.shell.zoom', kind: 'device-local', backup: false, label: '壳层缩放(屏幕相关)' },
	{ key: 'horosa.window.size.v1', kind: 'device-local', backup: false, label: '窗口尺寸(屏幕相关)' },
	// horosa_windows_storage_keys_v1(Windows-ahead):壳侧温启现场恢复键(utils/bootChartRestore.js,
	// PERF-R10 boot_chart_restore)。设备会话态:存的是「上次退出时的主盘现场」,跨机带走反而错
	// (新机首启会恢复别机的盘);丢失零资产损失(下次启动少一次自动恢复而已)。
	{ key: 'horosa.boot.lastChart.v1', kind: 'device-local', backup: false, label: '温启现场恢复:最近主盘现场快照(设备会话态)' },
	{ key: 'horosa.report.debugLog', kind: 'device-local', backup: false, label: '报告调试日志开关' },
	{ key: 'horosa.test.third.v1', kind: 'device-local', backup: false, label: 'safeStorage 自检探针键' },
	{ key: 'ziweiLateZiMigrated', kind: 'device-local', backup: false, label: '紫微晚子时迁移标志(带走会骗新机跳过迁移)' },
	{ key: 'horosaUpdateUiV2', kind: 'device-local', backup: false, label: '更新提示 UI 状态(绑定已装版本,跨机带走会骗新机)' },
	{ key: 'horosa.storage.persisted', kind: 'device-local', backup: false, label: 'persist() 授予状态(本设备引擎决定,健康页显示用)' },
	{ key: 'horosa.backup.lastResult', kind: 'device-local', backup: false, label: '自动备份最近结果(时间/指纹/路径;本机备份序列状态,不迁移)' },
];

// 精确 key 优先,其次最长 prefix。未登记 → null(备份侧按防呆带走并留痕)。
export function classifyStorageKey(k){
	if(typeof k !== 'string' || !k){
		return null;
	}
	let best = null;
	for(let i=0; i<STORAGE_KEY_REGISTRY.length; i++){
		const e = STORAGE_KEY_REGISTRY[i];
		if(e.key === k){
			return e;
		}
		if(e.prefix && k.indexOf(e.prefix) === 0){
			if(!best || e.prefix.length > best.prefix.length){
				best = e;
			}
		}
	}
	return best;
}

// 运行时备份面:扫 localStorage 实际全键 → {rawKeys(登记 backup:true), unknownKeys(未登记,防呆带走)}。
// dedicated/cache/device-local 排除;unknown 默认按用户资产带走(宁多带不漏)。
export function collectBackupKeys(){
	const rawKeys = [];
	const unknownKeys = [];
	try{
		const n = window.localStorage.length;
		for(let i=0; i<n; i++){
			const k = window.localStorage.key(i);
			if(!k){
				continue;
			}
			const e = classifyStorageKey(k);
			if(!e){
				unknownKeys.push(k);
			}else if(e.backup === true){
				rawKeys.push(k);
			}
		}
	}catch(_e){
		// localStorage 不可用:返回空面,导出侧退化为仅两库信封(经内存层)。
	}
	rawKeys.sort();
	unknownKeys.sort();
	return { rawKeys, unknownKeys };
}
