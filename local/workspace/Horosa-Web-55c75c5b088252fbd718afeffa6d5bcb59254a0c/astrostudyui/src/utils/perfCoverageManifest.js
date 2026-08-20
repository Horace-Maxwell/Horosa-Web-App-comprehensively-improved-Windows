// [R3-A0] 全技法性能覆盖矩阵 —— 「所有技法都要顶级性能」的机器台账(单一真值源)。
//
// 行 = 页面级技法(pages/index.js navigationPages 全集,含抽屉三页)
//    + kentang 后端模块(integrations/kentang/serviceRoot.js 全集,`page` 字段回链宿主页)。
// 轴 = 九条性能资产,每格必须显式处置,取值:
//    'done'      本轮(R3)落地
//    'existing'  此前轮次已有(探索/直读核实过)
//    'todo'      本轮计划内、尚未落地(收口前必须清零 —— preflight R3 哨兵把关)
//    'na:<理由>'  不适用,理由必须可读(如 随机冻结/无时间步进/纯本地即时/非计算页)
// 哨兵 perfCoverage.test.js:行集 ⊇ 两个真源穷举集、九轴齐全、取值合法、零 unknown。
// ⚠️ 新增技法页/新增 kentang 模块而不登记本表 = 哨兵红。禁止手挑改动面,一切从本表出。
//
// 轴语义速查:
//   netCache      网络结果缓存(B 型走 requestDedupe L1/L2/L3;C 型走 kentangCache)
//   stepPrefetch  settle 后时间步进预取(同向2+反向1)
//   stepSelect    选定步长那一刻的 ±2 步双向预取
//   optionPrefetch 枚举选项 intent 预取(下拉展开/hover)
//   dataPrewarm   进页/悬停数据预热(首次进页第一算不冷)
//   localMemo     本地引擎签名 memo
//   scu           页面主组件渲染守卫(sCU/React.memo)
//   drawGuard     imperative 画布(d3/canvas)签名守卫+可见性重画
//   keepStale     刷新期不闪屏(旧盘保留+更新角标)

export const PERF_AXES = [
	'netCache', 'stepPrefetch', 'stepSelect', 'optionPrefetch', 'dataPrewarm',
	'localMemo', 'scu', 'drawGuard', 'keepStale',
];

export const VALID_VALUE = /^(done|existing|todo|na:.+)$/;

// ── 页面级(navigationPages + 抽屉三页) ──────────────────────────────────────
const PAGES = {
	astrochart: { kind: 'B', axes: {
		netCache: 'existing', stepPrefetch: 'existing', stepSelect: 'done', optionPrefetch: 'done:R4-B5 反转 R3 裁决——settle 后二值轴(zodiacal/southchart/tradition/simpleAsp)Hamming-1 变体走空闲组(组代作废+交互让路),R3 判弊的「开下拉即触真算」intent 形态已被规避(实证命中≈渲染);多值轴待组件登记值域',
		dataPrewarm: 'na:进页即取+keep-stale 可见+全层缓存承接;预挂载预热需复刻实例构参(坑45 漂移类)判不做,有纯函数缝者(七政/六壬/奇门)已做', localMemo: 'na:网络型主盘(chartMem 即其 memo)', scu: 'existing',
		drawGuard: 'existing', keepStale: 'existing',
	} },
	direction: { kind: 'B', axes: {
		netCache: 'existing', stepPrefetch: 'existing', stepSelect: 'done', optionPrefetch: 'na:已算沉淀(L1/L2/L3/paramhash)秒回+未命中路径最短;计算型后端投机变体预取判弊>利(开下拉即触真算),有据判不做',
		dataPrewarm: 'na:进页即取+keep-stale 可见+全层缓存承接;预挂载预热需复刻实例构参(坑45 漂移类)判不做,有纯函数缝者(七政/六壬/奇门)已做', localMemo: 'na:网络型', scu: 'done', drawGuard: 'existing', keepStale: 'existing(d3 画布天然驻帧,新数据到才重画)',
	} },
	bazi: { kind: 'A', axes: {
		netCache: 'existing', stepPrefetch: 'existing', stepSelect: 'done', optionPrefetch: 'na:本地引擎即时(0.4ms)',
		dataPrewarm: 'na:chartFree 快车道已即时', localMemo: 'existing', scu: 'existing',
		drawGuard: 'na:非 imperative 画布', keepStale: 'existing',
	} },
	ziwei: { kind: 'B', axes: {
		netCache: 'existing', stepPrefetch: 'existing', stepSelect: 'done', optionPrefetch: 'na:已算沉淀(L1/L2/L3/paramhash)秒回+未命中路径最短;计算型后端投机变体预取判弊>利(开下拉即触真算),有据判不做',
		dataPrewarm: 'na:进页即取+keep-stale 可见+全层缓存承接;预挂载预热需复刻实例构参(坑45 漂移类)判不做,有纯函数缝者(七政/六壬/奇门)已做', localMemo: 'existing', scu: 'existing', drawGuard: 'existing', keepStale: 'existing',
	} },
	guolao: { kind: 'B', axes: {
		netCache: 'existing', stepPrefetch: 'existing', stepSelect: 'done', optionPrefetch: 'na:已算沉淀(L1/L2/L3/paramhash)秒回+未命中路径最短;计算型后端投机变体预取判弊>利(开下拉即触真算),有据判不做',
		dataPrewarm: 'existing', localMemo: 'na:网络型', scu: 'existing', drawGuard: 'existing', keepStale: 'existing',
	} },
	indiachart: { kind: 'B', axes: {
		netCache: 'existing', stepPrefetch: 'existing', stepSelect: 'done', optionPrefetch: 'na:已算沉淀(L1/L2/L3/paramhash)秒回+未命中路径最短;计算型后端投机变体预取判弊>利(开下拉即触真算),有据判不做',
		dataPrewarm: 'na:进页即取+keep-stale 可见+全层缓存承接;预挂载预热需复刻实例构参(坑45 漂移类)判不做,有纯函数缝者(七政/六壬/奇门)已做', localMemo: 'na:网络型', scu: 'done', drawGuard: 'existing', keepStale: 'existing',
	} },
	auxchart: { kind: 'B', axes: {
		netCache: 'existing', stepPrefetch: 'existing', stepSelect: 'done:卜卦/择日/世俗三盘=DivinationChartShell 本地预取器±1±2+settle后±1预热(fields 自持,全局 handler 对其错键——用户实测「切步长第一下卡」坑修复);germanytech 等 store 面走全局', optionPrefetch: 'na:已算沉淀(L1/L2/L3/paramhash)秒回+未命中路径最短;计算型后端投机变体预取判弊>利(开下拉即触真算),有据判不做',
		dataPrewarm: 'na:进页即取+keep-stale 可见+全层缓存承接;预挂载预热需复刻实例构参(坑45 漂移类)判不做,有纯函数缝者(七政/六壬/奇门)已做', localMemo: 'na:网络型', scu: 'done', drawGuard: 'existing',
		keepStale: 'na:聚合壳,loading 态由子技法自面(kentang 子面 Spin 包裹旧盘)',
	} },
	relativechart: { kind: 'B', axes: {
		netCache: 'existing', stepPrefetch: 'na:双盘无时间步进主轴', stepSelect: 'na:同左', optionPrefetch: 'na:已算沉淀(L1/L2/L3/paramhash)秒回+未命中路径最短;计算型后端投机变体预取判弊>利(开下拉即触真算),有据判不做',
		dataPrewarm: 'na:进页即取+keep-stale 可见+全层缓存承接;预挂载预热需复刻实例构参(坑45 漂移类)判不做,有纯函数缝者(七政/六壬/奇门)已做', localMemo: 'na:网络型', scu: 'done', drawGuard: 'existing', keepStale: 'existing',
	} },
	shusuan: { kind: 'MIXED', axes: {
		netCache: 'done', stepPrefetch: 'done', stepSelect: 'done', optionPrefetch: 'na:已算沉淀(L1/L2/L3/paramhash)秒回+未命中路径最短;计算型后端投机变体预取判弊>利(开下拉即触真算),有据判不做',
		dataPrewarm: 'na:进页即取+keep-stale 可见+全层缓存承接;预挂载预热需复刻实例构参(坑45 漂移类)判不做,有纯函数缝者(七政/六壬/奇门)已做', localMemo: 'existing', scu: 'existing', drawGuard: 'na:文本条文为主', keepStale: 'na:聚合壳,loading 态由子技法自面(kentang 子面 Spin 包裹旧盘)',
	} },
	mingother: { kind: 'MIXED', axes: {
		netCache: 'done', stepPrefetch: 'done', stepSelect: 'done:全局(/chart)+kinastro 本地 prefetchStepSelect(pan ±1 双向,buildPayload 单源)', optionPrefetch: 'na:已算沉淀(L1/L2/L3/paramhash)秒回+未命中路径最短;计算型后端投机变体预取判弊>利(开下拉即触真算),有据判不做',
		dataPrewarm: 'na:进页即取+keep-stale 可见+全层缓存承接;预挂载预热需复刻实例构参(坑45 漂移类)判不做,有纯函数缝者(七政/六壬/奇门)已做', localMemo: 'existing', scu: 'done', drawGuard: 'na:声明式 React SVG', keepStale: 'na:聚合壳,loading 态由子技法自面(kentang 子面 Spin 包裹旧盘)',
	} },
	sanshiunited: { kind: 'MIXED', axes: {
		netCache: 'done', stepPrefetch: 'done', stepSelect: 'done:确认制起盘(步进只改草稿零请求,不存在步进冷卡;起盘一下由 kentangCache L1/L3 承接,三 pan 草稿预热为后续增强项)', optionPrefetch: 'na:已算沉淀(L1/L2/L3/paramhash)秒回+未命中路径最短;计算型后端投机变体预取判弊>利(开下拉即触真算),有据判不做',
		dataPrewarm: 'na:进页即取+keep-stale 可见+全层缓存承接;预挂载预热需复刻实例构参(坑45 漂移类)判不做,有纯函数缝者(七政/六壬/奇门)已做', localMemo: 'na:三式聚合(子引擎各管)', scu: 'existing', drawGuard: 'na:声明式渲染',
		keepStale: 'existing',
	} },
	liureng: { kind: 'B', axes: {
		netCache: 'existing', stepPrefetch: 'existing', stepSelect: 'done:全局(/chart)+本地 prefetchStepSelect(gods ±1 双向,genGodsParams 单源)', optionPrefetch: 'na:已算沉淀(L1/L2/L3/paramhash)秒回+未命中路径最短;计算型后端投机变体预取判弊>利(开下拉即触真算),有据判不做',
		dataPrewarm: 'done', localMemo: 'existing', scu: 'existing', drawGuard: 'existing', keepStale: 'existing(d3 画布天然驻帧,新数据到才重画)',
	} },
	dunjia: { kind: 'C', axes: {
		netCache: 'done', stepPrefetch: 'done', stepSelect: 'done:全局(/chart)+本地 prefetchStepSelect(pan ±1 双向,localFields 草稿为基,depth 语义复用 settle 链)', optionPrefetch: 'na:已算沉淀(L1/L2/L3/paramhash)秒回+未命中路径最短;计算型后端投机变体预取判弊>利(开下拉即触真算),有据判不做',
		dataPrewarm: 'done', localMemo: 'na:后端 kentang 引擎', scu: 'existing', drawGuard: 'na:声明式 React SVG(零 d3)', keepStale: 'existing',
	} },
	guazhan: { kind: 'A', axes: {
		netCache: 'existing', stepPrefetch: 'na:随机摇卦冻结(仅时间卦随时间,本地即时)', stepSelect: 'na:同左',
		optionPrefetch: 'na:本地引擎即时', dataPrewarm: 'na:起卦一次性', localMemo: 'existing', scu: 'existing',
		drawGuard: 'existing', keepStale: 'na:本地即时',
	} },
	taiyi: { kind: 'C', axes: {
		netCache: 'done', stepPrefetch: 'done', stepSelect: 'done', optionPrefetch: 'na:已算沉淀(L1/L2/L3/paramhash)秒回+未命中路径最短;计算型后端投机变体预取判弊>利(开下拉即触真算),有据判不做',
		dataPrewarm: 'na:进页即取+keep-stale 可见+全层缓存承接;预挂载预热需复刻实例构参(坑45 漂移类)判不做,有纯函数缝者(七政/六壬/奇门)已做', localMemo: 'na:后端 kentang 引擎', scu: 'existing', drawGuard: 'existing', keepStale: 'existing',
	} },
	jieqichart: { kind: 'B', axes: {
		netCache: 'existing', stepPrefetch: 'existing', stepSelect: 'na:年选择器无步长档(onlyYear 无步进)', optionPrefetch: 'na:已算沉淀(L1/L2/L3/paramhash)秒回+未命中路径最短;计算型后端投机变体预取判弊>利(开下拉即触真算),有据判不做',
		dataPrewarm: 'na:进页即取+keep-stale 可见+全层缓存承接;预挂载预热需复刻实例构参(坑45 漂移类)判不做,有纯函数缝者(七政/六壬/奇门)已做', localMemo: 'na:网络型', scu: 'done', drawGuard: 'existing', keepStale: 'existing',
	} },
	fengshui: { kind: 'A', axes: {
		netCache: 'na:本地理气引擎', stepPrefetch: 'na:无时间步进主轴(择日子面另计)', stepSelect: 'na:同左',
		optionPrefetch: 'na:本地即时', dataPrewarm: 'na:本地即时', localMemo: 'existing', scu: 'done',
		drawGuard: 'existing', keepStale: 'na:本地即时',
	} },
	// 塔罗 2026-08-15 升「卜」一级(性能语义自 cnyibu 聚合承袭:纯前端抽牌引擎,零后端排盘)。
	tarot: { kind: 'A', axes: {
		netCache: 'na:纯前端抽牌引擎(种子 RNG),零后端排盘请求', stepPrefetch: 'na:无时间步进主轴(种子模式手动抽)', stepSelect: 'na:同左',
		optionPrefetch: 'na:本地即时(牌组/牌阵切换纯前端)', dataPrewarm: 'na:本地即时', localMemo: 'existing', scu: 'done',
		drawGuard: 'na:声明式 React 渲染(无命令式画布)', keepStale: 'na:本地即时;抽牌「起出即冻结」无旧盘等待态',
	} },
	cnyibu: { kind: 'MIXED', axes: {
		netCache: 'done', stepPrefetch: 'done', stepSelect: 'done:全局(/chart)+jinkou 本地 prefetchStepSelect(gods→pan ±1 双向,经内嵌 LiuRengInput onStepSelect 透传)', optionPrefetch: 'na:已算沉淀(L1/L2/L3/paramhash)秒回+未命中路径最短;计算型后端投机变体预取判弊>利(开下拉即触真算),有据判不做',
		dataPrewarm: 'na:进页即取+keep-stale 可见+全层缓存承接;预挂载预热需复刻实例构参(坑45 漂移类)判不做,有纯函数缝者(七政/六壬/奇门)已做', localMemo: 'existing', scu: 'done', drawGuard: 'na:声明式 React SVG(金口/六壬画布各自已有守卫)', keepStale: 'na:聚合壳,loading 态由子技法自面(kentang 子面 Spin 包裹旧盘)',
	} },
	aianalysis: { kind: 'TOOL', axes: {
		netCache: 'na:SSE 流式(禁缓存)', stepPrefetch: 'na:AI 会话页', stepSelect: 'na:AI 会话页',
		optionPrefetch: 'na:AI 会话页', dataPrewarm: 'na:挂载按需', localMemo: 'na:非引擎页', scu: 'existing',
		drawGuard: 'na:非画布页', keepStale: 'na:会话流',
	} },
	planetarium: { kind: 'TOOL', axes: {
		netCache: 'na:实时状态端点(NoCache 哨兵[71])', stepPrefetch: 'na:实时漫游', stepSelect: 'na:实时漫游',
		optionPrefetch: 'na:实时漫游', dataPrewarm: 'na:实时漫游', localMemo: 'na:babylon 场景',
		scu: 'existing', drawGuard: 'na:babylon 自管增量', keepStale: 'na:实时渲染',
	} },
	calendar: { kind: 'A', axes: {
		netCache: 'existing', stepPrefetch: 'na:整月翻页本地缓存(localCalcCache+IDB)', stepSelect: 'na:同左',
		optionPrefetch: 'na:本地即时', dataPrewarm: 'na:进页即取+keep-stale 可见+全层缓存承接;预挂载预热需复刻实例构参(坑45 漂移类)判不做,有纯函数缝者(七政/六壬/奇门)已做', localMemo: 'existing', scu: 'done',
		drawGuard: 'na:声明式网格', keepStale: 'existing',
	} },
	cntradition: { kind: 'A', axes: {
		netCache: 'na:静态参考内容', stepPrefetch: 'na:参考页', stepSelect: 'na:参考页', optionPrefetch: 'na:参考页',
		dataPrewarm: 'na:参考页', localMemo: 'na:静态', scu: 'done', drawGuard: 'na:静态', keepStale: 'na:静态',
	} },
	xuanshi: { kind: 'C', axes: {
		netCache: 'done', stepPrefetch: 'na:朝代/列传浏览非时间步进', stepSelect: 'na:同左', optionPrefetch: 'na:玄学史零动红线',
		dataPrewarm: 'na:进页即取+keep-stale 可见+全层缓存承接;预挂载预热需复刻实例构参(坑45 漂移类)判不做,有纯函数缝者(七政/六壬/奇门)已做', localMemo: 'na:后端 SQLite', scu: 'na:玄学史零动红线,判不动', drawGuard: 'existing', keepStale: 'na:浏览页(玄学史零动红线)',
	} },
	astrochart3D: { kind: 'B', axes: {
		netCache: 'existing', stepPrefetch: 'existing', stepSelect: 'done', optionPrefetch: 'na:3D 补间已消重建',
		dataPrewarm: 'na:进页即取+keep-stale 可见+全层缓存承接;预挂载预热需复刻实例构参(坑45 漂移类)判不做,有纯函数缝者(七政/六壬/奇门)已做', localMemo: 'na:three 场景', scu: 'existing', drawGuard: 'existing(onDemand/morph)',
		keepStale: 'existing',
	} },
	astrodata: { kind: 'TOOL', axes: {
		netCache: 'existing', stepPrefetch: 'na:数据库检索页', stepSelect: 'na:同左', optionPrefetch: 'na:检索页',
		dataPrewarm: 'na:检索按需', localMemo: 'na:非引擎页', scu: 'done', drawGuard: 'na:列表页', keepStale: 'existing',
	} },
	zeri: { kind: 'TOOL', axes: {
		netCache: 'done:electionscan 走 cachedKentangFetch 三层(确定性扫描,按月段天然命中);奇门找局=纯本地引擎零 HTTP,无网络轴', stepPrefetch: 'existing:DivinationChartShell 本地预取器(fields 自持,同辅盘三盘)', stepSelect: 'existing:同左', optionPrefetch: 'na:征象扫描属重计算,投机预取判弊>利',
		dataPrewarm: 'na:进页即可用,扫描按需触发', localMemo: 'na:网络型(奇门找局分块让主线程+命中/跨度双上限)', scu: 'existing:壳层 wrapperPropsEqual', drawGuard: 'existing', keepStale: 'na:扫描结果显式触发,无陈旧窗口',
	} },
	astroreader: { kind: 'TOOL', axes: {
		netCache: 'na:阅读器(登录态内容)', stepPrefetch: 'na:阅读器', stepSelect: 'na:阅读器', optionPrefetch: 'na:阅读器',
		dataPrewarm: 'na:阅读器', localMemo: 'na:阅读器', scu: 'na:内容滚动页', drawGuard: 'na:阅读器', keepStale: 'na:阅读器',
	} },
	liveplayer: { kind: 'TOOL', axes: {
		netCache: 'na:直播流', stepPrefetch: 'na:直播流', stepSelect: 'na:直播流', optionPrefetch: 'na:直播流',
		dataPrewarm: 'na:直播流', localMemo: 'na:直播流', scu: 'na:播放器', drawGuard: 'na:播放器', keepStale: 'na:直播流',
	} },
	admintools: { kind: 'TOOL', axes: {
		netCache: 'na:管理页(登录态)', stepPrefetch: 'na:管理页', stepSelect: 'na:管理页', optionPrefetch: 'na:管理页',
		dataPrewarm: 'na:管理页', localMemo: 'na:管理页', scu: 'na:低频管理页', drawGuard: 'na:管理页', keepStale: 'na:管理页',
	} },
};

// ── kentang 后端模块级(C 型;page=宿主页) ────────────────────────────────────
// 缓存策略:deterministic=同 body 同结果 → 可缓存可预取;
//          seedInBody=body 含用户随机种子 → 可缓存(同 body 仍确定)但【绝不预取】;
//          browse=浏览检索型 → 可缓存,无步进语义。
const KENTANG_MODULES = {
	qimen:           { page: 'dunjia',   policy: 'deterministic', axes: { netCache: 'done', stepPrefetch: 'done' } },
	taiyi:           { page: 'taiyi',    policy: 'deterministic', axes: { netCache: 'done', stepPrefetch: 'done' } },
	jinkou:          { page: 'cnyibu',   policy: 'deterministic', axes: { netCache: 'done', stepPrefetch: 'done' } },
	wangji:          { page: 'cnyibu',   policy: 'deterministic', axes: { netCache: 'done', stepPrefetch: 'done' } },
	wuzhao:          { page: 'cnyibu',   policy: 'deterministic', axes: { netCache: 'done', stepPrefetch: 'done' } },
	taixuan:         { page: 'cnyibu',   policy: 'seedInBody',    axes: { netCache: 'done', stepPrefetch: 'na:蓍法种子在体(服务端 random.seed(body.seed),同 body 确定可缓存;预取恐钉死起课,禁)' } },
	jingjue:         { page: 'cnyibu',   policy: 'seedInBody',    axes: { netCache: 'done', stepPrefetch: 'na:揲蓍种子在体(同上,可缓存不可预取)' } },
	shenyishu:       { page: 'cnyibu',   policy: 'deterministic', axes: { netCache: 'done', stepPrefetch: 'done' } },
	geomancy:        { page: 'cnyibu',   policy: 'seedInBody',    axes: { netCache: 'done', stepPrefetch: 'na:随机成卦冻结,绝不预取' } },
	xuanshi:         { page: 'xuanshi',  policy: 'browse',        axes: { netCache: 'done', stepPrefetch: 'na:浏览型无步进' } },
	shaozi:          { page: 'shusuan',  policy: 'deterministic', axes: { netCache: 'done', stepPrefetch: 'done' } },
	tieban:          { page: 'shusuan',  policy: 'deterministic', axes: { netCache: 'done', stepPrefetch: 'done' } },
	fendjing:        { page: 'shusuan',  policy: 'deterministic', axes: { netCache: 'done', stepPrefetch: 'done' } },
	beiji:           { page: 'shusuan',  policy: 'deterministic', axes: { netCache: 'done', stepPrefetch: 'done' } },
	nanji:           { page: 'shusuan',  policy: 'deterministic', axes: { netCache: 'done', stepPrefetch: 'done' } },
	chunzi:          { page: 'shusuan',  policy: 'deterministic', axes: { netCache: 'done', stepPrefetch: 'done' } },
	xianqin:         { page: 'mingother', policy: 'deterministic', axes: { netCache: 'done', stepPrefetch: 'done' } },
	cetian:          { page: 'mingother', policy: 'deterministic', axes: { netCache: 'done', stepPrefetch: 'done' } },
	qizhengkin:      { page: 'mingother', policy: 'deterministic', axes: { netCache: 'done', stepPrefetch: 'done' } },
	qizhengelection: { page: 'auxchart', policy: 'deterministic', axes: { netCache: 'done', stepPrefetch: 'na:择日区间扫描型,无步进主轴' } },
	electionscan:    { page: 'zeri', policy: 'deterministic', axes: { netCache: 'done', stepPrefetch: 'na:征象搜索区间扫描型,无步进主轴' } },
};

export function getPerfCoveragePages(){
	return PAGES;
}

export function getPerfCoverageKentang(){
	return KENTANG_MODULES;
}

/** 收口计数器:全矩阵 todo 数(R3 收口=0;preflight 哨兵与测试共用)。 */
export function countPerfTodos(){
	let n = 0;
	Object.values(PAGES).forEach((row)=>{
		Object.values(row.axes).forEach((v)=>{ if(String(v).startsWith('todo')){ n += 1; } });
	});
	Object.values(KENTANG_MODULES).forEach((row)=>{
		Object.values(row.axes).forEach((v)=>{ if(String(v).startsWith('todo')){ n += 1; } });
	});
	return n;
}
