// 🔴 全站持久化键注册表 —— 「所有信息跨会话滴水不漏」的单一真值源。
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
//   'device-local' 设备绑定状态(设备本身的迁移标志/窗口尺寸/性能调优/调试) → 不带(跨机带走反而害)
//                  守着随备份走的数据的迁移标志标 settings、随数据一起走(只带数据不带标志 = 新机再迁移一遍)
// keepOnRestore: true —— 带设置面完整标记的恢复也不复位(守着账号 / 服务端状态的一次性迁移标志,复位 = 再迁移一遍)。
// 存储空间告急时可清的两档(safeStorage 由本表推导,不另抄清单):
//   kind 'cache' 的 localStorage 条目一律属第一档(随时可清:写入撞配额先清它、错误边界「一键清理缓存」也清它);
//   quotaClearable: 'emergency' —— 第二档,只在写入撞配额、第一档清完仍写不进时才清(AI 挂载快照可再生但正在用;
//                   工具箱表单态是设置类却丢了只要重填一次);
//   quotaClearable: false —— cache 里不许清的(多窗口租约 / 待落盘标记:清了会两窗口同跑或丢一次待落盘的改动)。
// storage: 'session' —— 这把键在 sessionStorage(不在 localStorage,告急清理不碰、备份不带)。
// maxEntries —— 前缀登记的 cache 族必须写明最多几把键(写入点按它修剪;0 = 本族已不再写进 localStorage,只剩待迁移 / 待清的旧键)。
// format: 'json' —— 值是 JSON 文本:全量恢复写入前先确认解析得出,解析不出的按「形状不对」跳过(不把坏串写进本机)。
// restoreMerge —— 用户资产列表 / 映射在全量恢复时按条目并集(本机条目先占、同一条保本机;有上限的本机先占容量),
//   不整值替换(恢复较早的包会冲掉之后新增的条目)。形状:
//     { shape: 'array', id: [字段…] 或 [[字段…], [字段…]](几组身份任一组相同即同一条), time: 字段, order: 'newest-first'|'oldest-first', cap: N }
//     身份字段由写入它的 store 导出时引用那一份(择日方案 schemeIdentity.SCHEME_RESTORE_MERGE),不在这里手写第二份;
//     每把键都有「同一身份再写一次 → 恢复合并后不重复」的行为合同(restoreMergeIdentityBehavior.test)
//     { shape: 'fields', fields: { 子字段: { 同上 array 规格 } } }(对象里的几个列表各自并集,其余字段保本机)
//     { shape: 'map' }(按键并集,同键保本机)
// restoreReplace: '理由' —— 明确整值替换的用户资产(单张表 / 单份文档)。user-data 且随备份走的键二者必居其一(合同测试锁)。
// 特殊 backup 值:
//   'dedicated'    不走 raw 整值直通,由全量备份专段处理(两库信封/回收站并集/AI-IDB 工作区)
//
// 匹配规则:精确 key 优先于 prefix;prefix 按最长匹配。
// ⚠ 登记新键时三思 kind:标错 'cache' = 用户数据被排除在备份外;标错 'user-data' 无害(多带)。

// 择日方案库的「同一条」= 同名(方案库自己的口径,单源导出;此前这里手写 id:['id'],同名再存换了新 id 后恢复出两份同名方案)
import { SCHEME_RESTORE_MERGE } from '../divination/zeri/schemeIdentity';
import { GEOMANCY_HISTORY_RESTORE_MERGE } from '../components/geomancy/geomancyHistory';

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
	{ key: 'horosa.lc.lifeEvents.v1', kind: 'user-data', backup: true, format: 'json', label: '人生事件(恢复时按事件合并,同一事件保留本机的)' },
	{ key: 'horosa.lc.lifeEvents.deleted.v1', kind: 'user-data', backup: true, format: 'json', label: '人生事件删除记录(恢复备份时你删过的事件不再带回)' },
	// 某项数据内容坏了(解析不出)时原样另存的一份:'horosa.corrupt.' + 原键 + '.' + 时刻(safeStorage.archiveCorruptStorageValue)
	{ prefix: 'horosa.corrupt.', kind: 'user-data', backup: true, format: 'text', restoreReplace: '每份留档是一件独立的东西(键名带时刻,不会撞)', label: '损坏内容留档(某项数据读不出来时原样另存的一份,可在「存储健康」里导出或删除)' },
	{ key: 'HorosaLocalDeepLearn', kind: 'user-data', backup: true, format: 'json', restoreMerge: { shape: 'map' }, label: '命主实况' },
	{ key: 'horosa.tarot.dailyLog', kind: 'user-data', backup: true, format: 'json', restoreMerge: { shape: 'array', id: ['d', 'deck'], time: 'd', order: 'oldest-first', cap: 730 }, label: '塔罗每日抽牌日志' },
	{ key: 'horosa.tarot.personalMeanings', kind: 'user-data', backup: true, format: 'json', restoreMerge: { shape: 'map' }, label: '塔罗个人牌义(用户亲写)' },
	{ key: 'horosa.xuanshi.bookmarks.v1', kind: 'user-data', backup: true, format: 'json', restoreMerge: { shape: 'array', id: ['kind', 'ref'], time: 'ts', order: 'newest-first', cap: 300 }, label: '玄史书签' },
	{ key: 'horosa.xuanshi.history.v1', kind: 'user-data', backup: true, format: 'json', restoreMerge: { shape: 'array', id: ['q'], time: 'ts', order: 'newest-first', cap: 20 }, label: '玄史浏览历史' },
	{ key: 'horosa.zeri.schemes.v1', kind: 'user-data', backup: true, format: 'json', restoreMerge: SCHEME_RESTORE_MERGE, label: '西洋择日已存方案' },
	{ key: 'horosa.zeri.qimen.schemes.v1', kind: 'user-data', backup: true, format: 'json', restoreMerge: SCHEME_RESTORE_MERGE, label: '奇门择日已存方案' },
	{ key: 'horosa.zeri.huangli.schemes.v1', kind: 'user-data', backup: true, format: 'json', restoreMerge: SCHEME_RESTORE_MERGE, label: '黄历择日已存方案' },
	{ key: 'horosa.zeri.bazi.schemes.v1', kind: 'user-data', backup: true, format: 'json', restoreMerge: SCHEME_RESTORE_MERGE, label: '八字择日已存方案' },
	{ key: 'horosa.zeri.taiyi.schemes.v1', kind: 'user-data', backup: true, format: 'json', restoreMerge: SCHEME_RESTORE_MERGE, label: '太乙择日已存方案' },
	{ key: 'horosa.zeri.ziwei.schemes.v1', kind: 'user-data', backup: true, format: 'json', restoreMerge: SCHEME_RESTORE_MERGE, label: '紫微择日已存方案' },
	{ key: 'horosa.zeri.liureng.schemes.v1', kind: 'user-data', backup: true, format: 'json', restoreMerge: SCHEME_RESTORE_MERGE, label: '六壬择日已存方案' },
	{ key: 'horosa.zeri.sanshi.schemes.v1', kind: 'user-data', backup: true, format: 'json', restoreMerge: SCHEME_RESTORE_MERGE, label: '三式择日已存方案' },
	{ key: 'horosa.zeri.qizheng.schemes.v1', kind: 'user-data', backup: true, format: 'json', restoreMerge: SCHEME_RESTORE_MERGE, label: '七政择日已存方案' },
	{ key: 'horosa.zeri.india.schemes.v1', kind: 'user-data', backup: true, format: 'json', restoreMerge: SCHEME_RESTORE_MERGE, label: '印度择日已存方案' },
	{ key: 'horosa.mundane.region.user.v1', kind: 'user-data', backup: true, format: 'json', restoreMerge: { shape: 'map' }, label: '世俗占星用户自定义区域' },
	{ key: 'horosa.report.glossary.global.v1', kind: 'user-data', backup: true, format: 'json', restoreMerge: { shape: 'array', id: ['term'] }, label: '术语表(全局,用户改动)' },
	{ key: 'ziweiBrightnessCustom', kind: 'user-data', backup: true, format: 'json', restoreReplace: '单张表(整表是一件东西,不按格并)', label: '紫微自定义亮度表' },
	{ key: 'ziweiSihuaCustom', kind: 'user-data', backup: true, format: 'json', restoreReplace: '单张表(整表是一件东西,不按格并)', label: '紫微自定义四化表' },
	// 纠正:CalculatorFormula 实为后端「公式帮助表」7 天缓存(Calculator.js 拉取 result.formula 落盘,配额清理白名单),非用户公式。
	{ key: 'CalculatorFormula', kind: 'cache', backup: false, label: '计算器公式帮助表缓存(后端拉取,7 天;非用户数据)' },
	{ key: 'horosa.boot.lastChart.v1', kind: 'cache', backup: false, label: '温启恢复上次的盘快照(载入命盘 record 口径 + 页签;7 天窗;丢了只是启动回空白默认态)' },
	// 工具箱三组历史键(常量标识符 / 模板串写入,穷举哨兵抓不到 → 此前未登记,备份靠兜底、存储健康报未登记):
	{ key: 'baziInverse', kind: 'settings', backup: true, format: 'json', quotaClearable: 'emergency', label: '八字反查表单态(工具箱;最近一次查询条件)' },
	{ key: 'baziPattern', kind: 'settings', backup: true, format: 'json', quotaClearable: 'emergency', label: '八字格局表单态(工具箱;最近一次查询条件)' },
	{ prefix: 'baziPattern_local::', kind: 'user-data', backup: true, format: 'json', restoreReplace: '每条笔记一把键(按四柱 + 性别),整条就是一件东西', label: '八字格局·用户手写属性笔记(按四柱+性别一条;用户资产)' },

	// ── 设置/偏好(raw 整值直通,恢复=整值替换) ─────────────────────────────────────
	{ key: 'horosa.ai.export.settings.v1', kind: 'settings', backup: true, format: 'json', label: 'AI 导出设置' },
	{ key: 'horosa.ai.mount.techniqueDefaults.v1', kind: 'settings', backup: true, format: 'json', label: 'AI 挂载每技法默认' },
	{ key: 'horosa.ai.analysis.ui.v3', kind: 'settings', backup: true, format: 'json', label: 'AI 分析界面偏好(当前模型、挂载勾选、会话提示等;接口密钥只在本机有效,换机需重填)' },
	{ key: 'horosa.ai.agent.enabled', kind: 'settings', backup: true, format: 'text', label: 'AI 助手行动能力(默认关)' },
	{ key: 'horosa.ai.chat.contextPolicy.v1', kind: 'settings', backup: true, format: 'json', label: 'AI 对话上下文策略' },
	{ key: 'horosa.tz.cnUnified', kind: 'settings', backup: true, format: 'text', label: '中国大陆统一用北京时间(默认开;关掉后按各地地理时区,如新疆回到东六区)' },
	{ key: 'horosa.ai.agent.approval', kind: 'settings', backup: true, format: 'text', label: 'AI 助手·写入动作审批(全自动可撤销 / 每次确认 / 只读)' },
	{ key: 'horosa.ai.agent.approval.categories.v1', kind: 'settings', backup: true, format: 'json', label: 'AI 助手·按类别收紧审批(只能比总档更严)' },
	{ key: 'horosa.ai.agent.trust.records.v1', kind: 'settings', backup: true, format: 'json', label: 'AI 助手·信任的档案(载入 / 查询类写入免逐次确认;建档与改设置永不因信任放行)' },
	{ key: 'horosa.ai.agent.toolPolicy.v1', kind: 'settings', backup: true, format: 'json', label: 'AI 助手·按工具名放行 / 禁用' },
	{ key: 'horosa.ai.agent.external.policy.v1', kind: 'settings', backup: true, format: 'json', label: 'AI 助手·外部客户端审批(审批档 / 每分钟调用上限 / 每小时写入上限)' },
	{ key: 'horosa.notify.desktop', kind: 'settings', backup: true, format: 'text', label: '桌面通知开关' },
	{ key: 'horosa.ai.tasks.goal.enabled', kind: 'settings', backup: true, format: 'text', label: 'AI 助手·目标任务(默认关)' },
	{ key: 'horosa.ai.tasks.scheduler.enabled', kind: 'settings', backup: true, format: 'text', label: 'AI 助手·定时任务(默认关)' },
	{ key: 'horosa.ai.tasks.scheduler.lastTickAt', kind: 'cache', backup: false, quotaClearable: false, label: 'AI 助手·定时任务本机上次心跳毫秒(错过判定用;device-local 不备份)' },
	{ key: 'horosa.ai.tasks.scheduler.lease', kind: 'cache', backup: false, quotaClearable: false, label: 'AI 助手·定时任务本机跳租约 {owner,until}(多窗口同时起跳只有租约主进执行体;device-local 不备份)' },
	{ key: 'horosa.ai.window.id', kind: 'cache', backup: false, storage: 'session', label: 'AI 助手·窗口身份(sessionStorage:同一标签页刷新保持;任务记录 runner.owner 据此判「活窗口/死循环」;device-local 不备份)' },
	{ key: 'horosa.ai.chat.modelRoutes.v1', kind: 'settings', backup: true, format: 'json', label: 'AI 助手·按任务用模型(工具轮 / 终稿 / 判官 / 审阅 / 规划 / 子任务;全空时跟随当前模型)' },
	{ key: 'horosa.ai.orchestrate.enabled', kind: 'settings', backup: true, format: 'text', label: 'AI 助手·多技法并行分析(默认关)' },
	{ key: 'horosa.ai.tools.external.enabled', kind: 'settings', backup: true, format: 'text', label: 'AI 助手·接入外部 MCP 服务器(默认关)' },
	{ key: 'horosa.ai.tools.webSearch.enabled', kind: 'settings', backup: true, format: 'text', label: 'AI 助手·联网检索(默认关)' },
	{ key: 'horosa.ai.tools.webFetch.enabled', kind: 'settings', backup: true, format: 'text', label: 'AI 助手·网页读取(默认关)' },
	{ key: 'horosa.ai.tools.headless.enabled', kind: 'settings', backup: true, format: 'text', label: 'AI 助手·无头分析出口(默认关)' },
	{ key: 'horosa.ai.tools.privateRead.enabled', kind: 'settings', backup: true, format: 'text', label: 'AI 助手·私人内容可读(默认关)' },
	{ key: 'horosa.ai.tasks.goal.parallel', kind: 'settings', backup: true, format: 'text', label: 'AI 助手·目标任务并行上限' },
	{ key: 'horosa.ai.chat.routeProfiles.v1', kind: 'settings', backup: true, format: 'json', label: 'AI 助手·按任务用模型的方案' },
	{ key: 'horosa.ai.automation.enabled', kind: 'settings', backup: true, format: 'text', label: 'AI 助手·自动规则(默认关)' },
	{ key: 'horosa.ai.persona.v1', kind: 'settings', backup: true, format: 'json', label: 'AI 助手·个人口径' },
	{ key: 'horosa.ai.chat.routeOptions.v1', kind: 'settings', backup: true, format: 'json', label: 'AI 助手·按任务的思考档' },
	{ key: 'horosa.ai.persona.layers.v1', kind: 'settings', backup: true, format: 'json', label: 'AI 助手·分层口径' },
	// { bySubject:{[命盘 cid]:true} }:哪几张命盘的命主实况随对话发给 AI(缺省一张都不发);恢复备份取较严的一档(unifiedBackup.BACKUP_SECURITY_KEYS)
	{ key: 'horosa.ai.subjectFacts.v1', kind: 'settings', backup: true, format: 'json', label: 'AI 分析·命主实况按命盘发送(默认不发)' },
	{ key: 'horosa.ai.agent.caps.v1', kind: 'cache', backup: false, label: 'AI 助手模型工具能力位缓存(per 档案::模型 原生工具调用是否可用,可重探)' },
	{ key: 'horosa.ai.agent.ledger.v1', kind: 'device-local', backup: false, label: 'AI 助手动作账本(本机撤销栈语义,200 条 FIFO,不随备份迁移)' },
	{ key: 'horosa.ai.agent.proposals.v1', kind: 'device-local', backup: false, label: 'AI 助手档案提案(AI 提议的档案修改 / 归档,待你在任务中心逐条采纳;待决 ≤50、总数 200 封顶;不随备份迁移)' },
	{ key: 'horosa.report.prefill.v1', kind: 'settings', backup: true, format: 'json', label: '文稿预填' },
	{ key: 'horosa.report.thinkingLevel', kind: 'settings', backup: true, format: 'text', label: 'AI 思考档' },
	{ key: 'horosa.sec.aiBodyEncrypt', kind: 'settings', backup: true, format: 'text', label: 'AI 请求体加密开关' },
	{ key: 'horosa.chart.classicalGlobals.v1', kind: 'settings', backup: true, format: 'json', label: '古典占星全局参数' },
	{ key: 'horosa.chart.newChartSeeds.v1', kind: 'settings', backup: true, format: 'json', label: '新命盘默认设置(黄道、恒星岁差、宫制、时间算法、八字长生与神煞、宿法、宿占人事十二宫起宫、印占、主限法:新建命盘时沿用你上次亲手选的值)' },
	// 两枚「数据已迁移」标志随它守着的数据一起走:只带数据不带标志,新机会把来源机早已迁移过的值再迁移一遍
	// (晚子时显式选的「子初换日(强制)」被当旧默认改成「跟随全局」;旧版同义存储里的过期值再并入种子)
	{ key: 'horosa.chart.newChartSeeds.legacyMerged.v1', kind: 'settings', backup: true, format: 'text', label: '新命盘默认设置·旧版设置已合并的记号' },
	{ key: 'horosa.chart.newChartSeeds.recordMissing.v1', kind: 'settings', backup: true, format: 'json', label: '旧命盘缺项时沿用的设置(来自旧版本,如宿占人事十二宫起宫)' },
	// 自定义界表 + 自定义恒星黄道槽位(星盘设置两 Modal;排盘条件下发)。
	{ key: 'horosa.astro.customTerms.v1', kind: 'settings', backup: true, format: 'json', label: '自定义界表(昼/夜两表)' },
	{ key: 'horosa.astro.customAyanamsa.v1', kind: 'settings', backup: true, format: 'json', label: '自定义恒星黄道槽位(≤10)' },
	{ key: 'horosa.chart.divinationJudgeGlobals.v1', kind: 'settings', backup: true, format: 'json', label: '卜卦判读全局参数' },
	{ key: 'horosa.egypt.school.v1', kind: 'settings', backup: true, format: 'json', label: '埃及占星流派' },
	{ key: 'horosa.feigong.settings.v1', kind: 'settings', backup: true, format: 'json', label: '飞宫小成图设置' },
	{ key: 'horosa.guice.settings.v1', kind: 'settings', backup: true, format: 'json', label: '轨策设置' },
	{ key: 'horosa.guolao.engineMode', kind: 'settings', backup: true, format: 'text', label: '七政引擎模式' },
	{ key: 'horosa.guolao.kinastroQizheng.options', kind: 'settings', backup: true, format: 'json', label: '演禽七政选项' },
	{ key: 'horosa.india.rectify.prefs.v1', kind: 'settings', backup: true, format: 'json', label: '印占校正偏好' },
	{ key: 'horosa.lifespan.method', kind: 'settings', backup: true, format: 'text', label: '寿元法选择' },
	{ key: 'horosa.lingqi.settings.v1', kind: 'settings', backup: true, format: 'json', label: '灵棋经设置' },
	{ key: 'horosa.liuyao.settings.v1', kind: 'settings', backup: true, format: 'json', label: '六爻设置' },
	{ key: 'horosa.xiaochengtu.settings.v1', kind: 'settings', backup: true, format: 'json', label: '小成图设置' },
	{ key: 'horosa.xiaoliuren.settings.v1', kind: 'settings', backup: true, format: 'json', label: '小六壬设置' },
	{ key: 'horosa.liureng.settings.v1', kind: 'settings', backup: true, format: 'json', label: '六壬排盘设置(贵人体系/换将/分昼夜/涉害/始入课/年神排序/昼夜阳阴/土旺衰/时间算法/起课法)' },
	{ key: 'horosa.dunjia.settings.v1', kind: 'settings', backup: true, format: 'json', label: '奇门排盘设置(排盘体例/起局/盘式/值使/空亡驿马/八神预设/寄宫/飞盘顺逆/混合盘分层/年日刻家口径/暗干暗支/显示偏好)' },
	{ key: 'horosa.taiyi.settings.v1', kind: 'settings', backup: true, format: 'json', label: '太乙排盘设置(盘式/古法公式/时间基准/博弈/盘面标注/流派各项)' },
	{ key: 'horosa.sanshi.settings.v1', kind: 'settings', backup: true, format: 'json', label: '三式合一排盘设置(奇门层 / 太乙层 / 六壬层口径 + 贵人 + 时间算法)' },
	{ key: 'horosa.jinkou.settings.v1', kind: 'settings', backup: true, format: 'json', label: '金口诀排盘设置(换将 / 贵人昼夜表 / 起贵神盘 / 盘式 / 土长生 / 时间基准)' },
	{ key: 'horosa.wuzhao.settings.v1', kind: 'settings', backup: true, format: 'json', label: '五兆排盘设置(起兆法 / 筮法变体 / 刑神月 / 六兽与中栏视图)' },
	{ key: 'horosa.geomancy.settings.v1', kind: 'settings', backup: true, format: 'json', label: '地占排盘设置(起卦法 / 流派预设 / 读取范围 / 黄道体系 / 逐项覆盖 / 行星地占盘 / 字形叠加 / 地占三角含义取派)' },
	{ key: 'horosa.tarot.settings.v1', kind: 'settings', backup: true, format: 'json', label: '塔罗排盘设置(牌组 / 牌阵 / 牌面样式 / 种子来源 / 盘面开关 / 读法体系 / 定局法 / 精华牌 / 计时法)' },
	{ key: 'horosa.kinastro.settings.v1', kind: 'settings', backup: true, format: 'json', label: '策天飞星 / 一掌经 / 数算诸法排盘设置(算法 / 流派 / 口径 / 显示开关)' },
	{ key: 'horosa.horary.settings.v1', kind: 'settings', backup: true, format: 'json', label: '卜卦盘排盘设置(流派 / 判读参数覆盖层 / 盘面叠层与聚焦 / 黄道 / 宫制)' },
	{ key: 'horosa.mundane.settings.v1', kind: 'settings', backup: true, format: 'json', label: '世俗盘排盘设置(世运规则集 / 判读容许度 / 入境主管制 / 恒星入境口径 / 世运大运年长 / 黄道 / 宫制)' },
	{ key: 'horosa.election.settings.v1', kind: 'settings', backup: true, format: 'json', label: '择日盘排盘设置(西方流派 / 逐项口径覆盖层 / 黄道 / 宫制)' },
	{ key: 'horosa.zeri.tianxing.settings.v1', kind: 'settings', backup: true, format: 'json', label: '天星择日排盘设置(黄道 / 宫制)' },
	{ key: 'horosa.direction.settings.v1', kind: 'settings', backup: true, format: 'json', label: '星运各子页排盘设置(南北交逆移 / 月长算法 / 行星年龄年数档 / 三分主星划分法与寿命基准 / 星历行运触发 / 返照双盘内外圈 / 波斯向运速率方向年数)' },
	{ key: 'horosa.guazhan.settings.v1', kind: 'settings', backup: true, format: 'json', label: '六爻起卦设置(自定义起卦 / 数字起卦的动爻取法)' },
	{ key: 'horosa.huangji.settings.v1', kind: 'settings', backup: true, format: 'text', label: '皇极经世排盘设置(旧版留存;起卦法现已不跨会话保留,不再读写)' },
	{ key: 'horosa.planetarium.settings.v1', kind: 'settings', backup: true, format: 'json', label: '天文馆显示设置(图层开关 / 星等上限 / 观测视角)' },
	{ key: 'horosa.acg.settings.v1', kind: 'settings', backup: true, format: 'json', label: '占星地图设置(主体线选集 / 投影 / 样式 / 各图层开关 / 宫制 / 地理等价流派 / 口径与坐标系 / 天体选项)' },
	{ key: 'horosa.babylon.settings.v1', kind: 'settings', backup: true, format: 'json', label: '巴比伦排盘设置(派系 / 逐项参数覆盖层)' },
	{ key: 'horosa.fengshui.settings.v1', kind: 'settings', backup: true, format: 'json', label: '风水排盘设置(流派:纳气 / 八卦阳宅 / 理气各派;罗盘盘面样式)' },
	{ key: 'horosa.xuanshi.state.v1', kind: 'settings', backup: true, format: 'json', label: '玄史视图状态' },
	{ key: 'xuanshi:density:events', kind: 'settings', backup: true, format: 'text', label: '玄史事件密度' },
	{ key: 'horosa.uranian.dial.v1', kind: 'settings', backup: true, format: 'json', label: '汉堡刻度盘配置' },
	{ key: 'horosa.uranian.gephem.v1', kind: 'settings', backup: true, format: 'json', label: '汉堡图形星历配置' },
	{ key: 'horosa.pd.columns.v1', kind: 'settings', backup: true, format: 'json', label: '主限法列配置' },
	{ key: 'horosa.pd.orb.v1', kind: 'settings', backup: true, format: 'text', label: '主限法容许度' },
	{ key: 'horosa.pd.pageSize', kind: 'settings', backup: true, format: 'text', label: '主限法分页大小' },
	{ prefix: 'horosa.pdsphere.', kind: 'settings', backup: true, format: 'text', label: '主限天球视图偏好' },
	// 族里值是 JSON 的几把单独登记(全量恢复写前要解析得出;族本身是文本开关)
	{ key: 'horosa.pdsphere.aiCurrentRow', kind: 'settings', backup: true, format: 'json', label: '主限天球视图偏好·当前选中的一行' },
	{ key: 'horosa.pdsphere.frameLayers', kind: 'settings', backup: true, format: 'json', label: '主限天球视图偏好·框架图层' },
	{ key: 'horosa.pdsphere.virtualToggles', kind: 'settings', backup: true, format: 'json', label: '主限天球视图偏好·虚点开关' },
	{ key: 'horosa.sidebar.collapse.v1', kind: 'settings', backup: true, format: 'json', label: '侧栏折叠' },
	{ key: 'horosa.ui.lightFlavor', kind: 'settings', backup: true, format: 'text', label: '浅色主题风味' },
	{ key: 'horosa.ui.script', kind: 'settings', backup: true, format: 'text', label: '界面简繁' },
	{ key: 'horosa.ui.skipDeleteConfirm.v1', kind: 'settings', backup: true, format: 'text', label: '删除确认跳过偏好' },
	{ key: 'horosa.reminders.enabled.v1', kind: 'settings', backup: true, format: 'text', label: '生日/整寿提醒开关(默认关,用户主动开启)' },
	{ key: 'globalSetup', kind: 'settings', backup: true, format: 'json', label: '全局设置' },
	{ key: 'commtoolstab', kind: 'settings', backup: true, format: 'text', quotaClearable: 'emergency', label: '工具页 tab 记忆' },
	{ key: 'readerBook', kind: 'settings', backup: true, format: 'text', label: '阅读器当前书' },
	{ key: 'horosaBackendIdentityOff', kind: 'settings', backup: true, format: 'text', label: '后端身份关闭开关' },
	{ key: 'horosaGuolaoLifeMode', kind: 'settings', backup: true, format: 'text', label: '七政命度模式' },
	// 七政挂载 schema storageKey 族(BodyMode/NodeMode/Su28Mode/Ayanamsa/TuibianMethod/GufaPrecess/
	// EqTropicalAnchor/LilithType/NodeType/TrueSolarTime…):无点 horosa 前缀+经变量写入,静态两轮
	// 扫描皆逃,被 C3 运行时前置闸抓获 —— 三层防线各司其职的实证。前缀一网打尽,未来同族新键自动归位。
	{ prefix: 'horosaGuolao', kind: 'settings', backup: true, format: 'text', label: '七政全局设置' },
	{ key: 'horosaGeomancyHistory', kind: 'user-data', backup: true, format: 'json', restoreMerge: GEOMANCY_HISTORY_RESTORE_MERGE, label: '地占报数历史(你的起卦记录)' },
	{ key: 'horosa.deleted.log.v1', kind: 'user-data', backup: true, format: 'json', label: '删除日志(彻底删除后的最后防线,可找回)' },
	{ prefix: 'liureng', kind: 'settings', backup: true, format: 'text', label: '六壬视图偏好' },
	{ prefix: 'suzhan', kind: 'settings', backup: true, format: 'text', label: '宿占视图偏好' },
	// 两枚以常量标识符写入的历史键(穷举哨兵只抓字面量首参 → 逃过登记;备份/存储健康此前按未登记兜底):
	{ key: 'chart3dOpt', kind: 'settings', backup: true, format: 'json', label: '3D 星盘显示设置' },
	{ key: 'horosa3dModelUnavailableAt', kind: 'cache', backup: false, storage: 'session', label: '3D 星盘模型加载失败的时刻(sessionStorage;10 分钟内不再重试,本机临时状态)' },
	{ key: 'guaData', kind: 'cache', backup: false, label: '八卦类象面板最近一次查询结果(可再生)' },
	// 同样经常量标识符写入、此前一直没登记的键(登记合同现已解析常量名):未登记 = 备份按用户资产带走,登录令牌因此进过备份文件
	{ key: 'baziopt', kind: 'settings', backup: true, format: 'json', label: '八字页选项(流派 / 命宫起法 / 藏干版本 / 大运精度等)' },
	{ key: 'baziChartStyle', kind: 'settings', backup: true, format: 'text', label: '八字盘样式(简盘 / 细盘 / 古法盘)' },
	{ key: 'aspects', kind: 'settings', backup: true, format: 'text', label: '星盘相位显示集' },
	{ key: 'horosa-calendar-tongshu-settings', kind: 'settings', backup: true, format: 'json', label: '通书设置' },
	{ key: 'horosa-yanqin-yanfa-settings', kind: 'settings', backup: true, format: 'json', label: '演禽演法流派与开关' },
	// 策天 / 演禽中宫内容档位(经对象映射取键写入)
	{ key: 'cetianCenterContent', kind: 'settings', backup: true, format: 'text', label: '策天飞星中宫内容' },
	{ key: 'xianqinCenterContent', kind: 'settings', backup: true, format: 'text', label: '演禽中宫内容' },
	{ key: 'qimenFaAskTopic', kind: 'settings', backup: true, format: 'text', label: '奇门问事主题' },
	{ key: 'qimenShowPatternInterpretation', kind: 'settings', backup: true, format: 'text', label: '奇门格局解读显示开关' },
	{ key: 'readerFontSize', kind: 'settings', backup: true, format: 'text', label: '阅读器字号' },
	{ key: 'readerTheme', kind: 'settings', backup: true, format: 'text', label: '阅读器主题' },
	{ key: 'TTSOpt', kind: 'settings', backup: true, format: 'text', label: '阅读器朗读设置' },
	{ key: 'LoginId', kind: 'settings', backup: true, format: 'text', label: '登录账号记忆(只记账号名,不含口令)' },
	// keepOnRestore:完整恢复时来源机没有这个键也不删本机的(删了下次登录会把账号里早已迁移过的宫制再改一遍)
	{ key: 'horosaHouseSystemDefaultsVersion', kind: 'settings', backup: true, format: 'text', keepOnRestore: true, label: '登录账号宫制默认值的升级记号(完整恢复时保留本机的)' },
	// ziwei* 历史键族:全站紫微设置(38+ 键)。精确键条目(如 ziweiBrightnessCustom)优先于本前缀。
	{ prefix: 'ziwei', kind: 'settings', backup: true, format: 'text', label: '紫微设置' },
	{ key: 'ziweiTaiSuiRelatives', kind: 'settings', backup: true, format: 'json', label: '紫微设置·太岁入卦的六亲' },
	{ key: 'ziweiUserSeed', kind: 'settings', backup: true, format: 'json', label: '紫微设置·你亲手设的那套(「新命盘」用回)' },
	{ key: 'ziweiLateZiMigrated', kind: 'settings', backup: true, format: 'text', label: '紫微晚子时设置的升级记号' },
	{ key: 'ziweiSessionTables', kind: 'cache', backup: false, label: '紫微·载入盘带来的临时自定义表(连记录号;温启恢复同一张盘时沿用,载入别的盘 / 新命盘 / 编辑自己的表时清掉;丢了只是重启后回到你自己的表)' },

	// ── 可再生缓存(不带:丢了只是多算一次;quota 紧张可被清理) ──────────────────────
	// maxEntries:本地计算缓存已搬进 IndexedDB(localStorage 里只剩首启迁移器要清的旧键);阅读页已下架(只剩旧键)
	{ prefix: 'horosa.localcalc.', kind: 'cache', backup: false, maxEntries: 0, label: '本地计算缓存(旧版留在本机存储里的,首启搬走;可清)' },
	// 按单卦存(六十四卦各一把,三卦组合读时拼;utils/guaDescCache.js),旧版按三卦组合存的键写入时清掉
	{ prefix: 'horosa.guadesc.cache.', kind: 'cache', backup: false, maxEntries: 64, label: '卦辞缓存' },
	// 按技法一把(astro 单例 + module.<技法>;技法名由代码固定)
	{ prefix: 'horosa.ai.snapshot.', kind: 'cache', backup: false, quotaClearable: 'emergency', maxEntries: 128, label: 'AI 挂载快照(告急清理面,可再生)' },
	{ prefix: 'horosa.reader.chapter.', kind: 'cache', backup: false, maxEntries: 0, label: '阅读章节进度(阅读页已下架,只剩旧键;可清)' },

	// ── 设备绑定(不带:跨机带走反而害) ─────────────────────────────────────────────
	{ prefix: 'horosa.perf.', kind: 'device-local', backup: false, label: '性能旗标族(设备调优,42+ 键)' },
	{ prefix: 'horosa.debug.', kind: 'device-local', backup: false, label: '调试开关' },
	{ key: 'horosa.compat.hasFallback', kind: 'device-local', backup: false, label: '兼容回退标志' },
	{ key: 'horosa.compat.alignZoom', kind: 'device-local', backup: false, label: '浮层缩放补偿开关(设 \'0\' 即全链退回补偿前行为;本机应急阀,不随迁)' },
	{ key: 'horosa.compat.zoomReprobe', kind: 'device-local', backup: false, label: '壳缩放探针多拍重测开关(设 \'0\' 即退回一拍旧行为;本机应急阀,不随迁)' },
	{ key: 'horosa.compat.tableRoDefer', kind: 'device-local', backup: false, label: '表格尺寸观察回调延帧开关(设 \'0\' 即退回同帧回调;本机诊断阀,不随迁)' },
	{ key: 'horosa.compat.svgCtmZoom', kind: 'device-local', backup: false, label: 'SVG 坐标矩阵缩放校正开关(设 \'0\' 即退回内核原始读数;本机应急阀,不随迁)' },
	{ key: 'horosa.compat.offsetXYZoom', kind: 'device-local', backup: false, label: '鼠标偏移量缩放校正开关(设 \'0\' 即退回内核原始读数;本机应急阀,不随迁)' },
	{ key: 'horosa.lc.idb', kind: 'device-local', backup: false, label: 'IndexedDB 可用性/迁移标志(带走会骗新机跳过迁移)' },
	{ key: 'horosa.localRecordStore.degraded', kind: 'device-local', backup: false, label: '存储降级会话标志' },
	{ key: 'horosa.localRecordStore.newerSchema', kind: 'device-local', backup: false, label: '超版记录提示事件名(非存储键,登记以过穷举哨兵,degraded 同例)' },
	{ key: 'horosa.shadowMirror.reconciled', kind: 'device-local', backup: false, label: '影子副本启动对账结果事件名(非存储键,登记以过穷举哨兵)' },
	{ key: 'horosa.map.consent.v1', kind: 'device-local', backup: false, label: '地图加载同意(设备+当下决定,不迁移)' },
	{ key: 'horosa.shell.zoom', kind: 'device-local', backup: false, label: '壳层缩放(屏幕相关)' },
	{ key: 'horosa.window.size.v1', kind: 'device-local', backup: false, label: '窗口尺寸(屏幕相关)' },
	{ key: 'horosa.report.debugLog', kind: 'device-local', backup: false, label: '调试日志开关' },
	{ key: 'horosa.test.third.v1', kind: 'device-local', backup: false, label: '存储自检用的临时键' },
	{ key: 'horosaUpdateUiV2', kind: 'device-local', backup: false, label: '更新提示 UI 状态(绑定已装版本,跨机带走会骗新机)' },
	{ key: 'Token', kind: 'device-local', backup: false, label: '登录凭据(不随备份迁移)' },
	// 本地网页版的后端服务地址(桌面会按地址栏参数覆盖;换机带走会指错服务)
	{ key: 'horosaLocalServerRoot', kind: 'device-local', backup: false, label: '本地网页版的后端服务地址(本机)' },
	{ key: 'horosaLocalServerRootMode', kind: 'device-local', backup: false, label: '本地网页版的后端服务地址取法(本机)' },
	{ key: 'forceChange', kind: 'device-local', backup: false, label: '账号状态变化的临时记号(本机)' },
	{ key: 'horosaLaunchSid', kind: 'device-local', backup: false, label: '本次启动的会话标识(sessionStorage;本机)' },
	{ key: 'horosa.restore.pendingResult.v1', kind: 'cache', backup: false, storage: 'session', label: '全量恢复结果(sessionStorage;恢复完立即刷新,刷新后弹出一次即删)' },
	{ key: 'horosa.storage.persisted', kind: 'device-local', backup: false, label: '本机存储保护的授予状态(健康页显示用)' },
	{ key: 'horosa.backup.lastResult', kind: 'device-local', backup: false, label: '自动备份最近结果(时间/指纹/路径;本机备份序列状态,不迁移)' },
	{ key: 'horosa.backup.incident.v1', kind: 'device-local', backup: false, format: 'json', label: '本机存储出过事的标记(记录库坏了 / 只在内存、AI 工作区读不开;出事之后写的自动备份据此标出,恢复成功或点「已处理」后清掉;本机状态,不迁移)' },
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
// complete:本机键面读全了(没抛错)。导出侧据此打「设置面完整」标记 —— 读不全的包恢复时不许复位本机设置。
export function collectBackupKeys(){
	const rawKeys = [];
	const unknownKeys = [];
	let complete = false;
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
		complete = true;
	}catch(_e){
		// localStorage 不可用:返回空面,导出侧退化为仅两库信封(经内存层)。
	}
	rawKeys.sort();
	unknownKeys.sort();
	return { rawKeys, unknownKeys, complete };
}
