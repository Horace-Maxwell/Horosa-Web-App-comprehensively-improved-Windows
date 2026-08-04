// stepPrefetch —— 时间步进方向预取调度器(极速化大修 WP-P1;R4-B1 扩容+运行时闸)。
//
// 原理:点步进(±步长)时「下一步」的时间完全可预测。主请求 settle 后,空闲时把相邻
// 1-2 步的 /chart(及当前技法登记的端点)预先算好塞进既有缓存(chartMem/requestDedupe)——
// 用户点下一步时命中,请求耗时 229ms → ~8ms(实测)。
//
// 五重风暴防护:
//   ① 触发点在 fetchByFields settle 之后(用户已停手 + 主盘已回,天然错峰);
//   ② latest-wins 代际令牌:新一轮 submit 整队替换,旧代排队任务全弃
//      (已在途的网络请求不 abort —— 结果仍可入缓存,无害);
//   ③ requestIdleCallback 调度(降级 setTimeout 250ms) + 串行并发 1;
//   ④ 每 settle 预算 ≤12 个任务 + 任务间自适应最小间隔 max(80ms, 上个任务耗时);
//   ⑤ 预取请求由任务方自带 silent + retry:{retries:0} —— 后端重启窗口绝不退避重试风暴。
//
// 纪律(有 jest 快照哨兵 + preflight 机械核双镜像):
//   · 预取参数必须「与用户真点会发出的请求」逐字节同键(复用同一参数构建路径),绝不臆造;
//   · PREFETCH_ALLOWED_PATHS 白名单之外的端点绝不预取 —— 尤其【随机起卦/抽牌类】
//     (dice/摇卦/塔罗/地占),预取即把随机结果钉死;AI/心跳类同禁。
//
// horosa_prefetch_runtime_whitelist_v1(R4-B1)——【白名单从注释变运行时闸】:
//   病根:旧版任务契约是 {name, run},run 是不可内省的闭包 —— 白名单只是注释 + jest 快照,
//   运行时【零】拦截,任何登记方都能把随机端点塞进预取队列而无人察觉。且旧允许集里裸 '/pan'
//   一条【匹配不到任何真实路径】(真路径是 /qimen/pan、/taiyi/pan…),等于形同虚设。
//   修法两层:
//     ① 契约加声明位:{name, path, run} —— submitStepPrefetch 用 path 过白名单,不合格【丢弃】
//        (不抛错:预取是优化不是功能,丢一条只是回到冷即付);
//     ② 纵深防御(path 是自述的,可能与 run 里真发的 URL 不符):pump 期间置 ambient 标志,
//        utils/request.js 与 utils/chartFetch.js 在标志置位时对不合格 URL 直接拒发并计数。
//   两层的拒绝都累加进同一计数器(prefetchRefusalCount),测试据此断言「零泄漏」。
//
// horosa_prefetch_pump_livelock_v1(R4-B1,实测「20 连点 0 派发」病灶):
//   连点时每次 settle 都 submit(generation+1 整队替换),而旧 pump 一拍只处理一个 entry ——
//   拍到时 entry 多半已是旧代,「丢弃 → 排下一拍」把整拍浪费在丢旧代上;繁忙期 rIC 又只按
//   timeout 兜底触发,于是连点稳态下预取几乎颗粒无收(每一下都付冷价)。修法两处:
//     · 一拍之内先把旧代 entry 全部丢干净,直接执行遇到的第一个当代任务(丢旧不耗拍);
//     · rIC timeout 2000→500:繁忙期每 ~500ms 保底一拍,配合上一条即「连点稳态仍在派发」。
//   验收硬指标:20 连点期间预取派发 ≥15(jest fake-timer + 真机 interact_probe 双验)。
import { stepPrefetchEnabled, stepSelectPrefetchEnabled, stepPrefetchFastFirstEnabled } from './perfFlags';

/** 允许预取的端点前缀(显式白名单;哨兵对照此数组,增删须同步测试)
 *  —— kentang 各技法 /{key}/pan【逐条枚举,绝不通配】:通配 '/*\/pan' 会把 seedInBody 族
 *  (taixuan/jingjue/geomancy —— body 含用户随机种子,预取即把起课钉死)一并放进来。
 *  枚举清单与 perfCoverageManifest.KENTANG_MODULES 的 policy==='deterministic' 恒等
 *  (jest 哨兵对拍;15 条)。⚠️ 与 Windows 版两处刻意不同:五兆(wuzhao)在列(Mac 政策表
 *  =deterministic,ganzhi 模式的合法预取在组件层判断)、太玄(taixuan)不在列
 *  (=seedInBody,Windows 版把它放进白名单是漏洞,此处按 Mac 政策表修正,禁词兜底)。 */
export const PREFETCH_ALLOWED_PATHS = [
	'/chart',        // 共享出盘(chartMem+requestDedupe 双层承接;含 chart12/chart13 前缀)
	// [Windows-only] /chart3d/state:3D 星盘状态,确定性纯计算(v3.5.0 起独立路由;
	// AstroChartMain3D 的步进预取任务声明此路径 —— 上游列表无此路由,Windows 补位,
	// 缺它 = 3D 页步进预取在提交层被静默丢弃)。
	'/chart3d',
	'/predict/',     // 推运(dice 由 FORBIDDEN 拦)
	'/ziwei/',       // 紫微
	'/liureng/',     // 六壬/金口诀共用神将
	'/india/',       // 印占
	'/germany/',     // 汉堡/量化盘(中点)
	'/modern/',      // 现代技法
	'/astroextra/',  // 占星扩展
	'/nongli/',      // 农历/真太阳时(遁甲/太乙/三式 stage-1)
	'/jieqi/',       // 节气年表/种子(分至图 + 遁甲/太乙 stage-1)
	'/bazi/birth',   // 八字(精确条目 —— /bazi/ 族含写端点,绝不整前缀)
	'/bazi/direct',
	// —— kentang deterministic 15 条(与 KENTANG_MODULES 政策表恒等,哨兵对拍) ——
	'/qimen/pan',
	'/taiyi/pan',
	'/jinkou/pan',
	'/wangji/pan',
	'/wuzhao/pan',
	'/shenyishu/pan',
	'/shaozi/pan',
	'/tieban/pan',
	'/fendjing/pan',
	'/beiji/pan',
	'/nanji/pan',
	'/chunzi/pan',
	'/xianqin/pan',
	'/cetian/pan',
	'/qizhengkin/pan',
];
/** 绝不预取(与 _requestCache 头注纪律镜像;哨兵断言两表交集为空)。
 *  R4-B1 补齐:seedInBody 族(taixuan/jingjue;geomancy 旧已在)、起卦/随机动作、流式、
 *  取现时(moira 流年默认过运时刻=「现在」)、资源/配置类。 */
export const PREFETCH_FORBIDDEN_MARKERS = [
	'dice', 'gua', 'tarot', 'geomancy', 'aianalysis', 'heartbeat', 'planetarium',
	'taixuan',     // 太玄(蓍法种子在体,预取恐钉死起课 —— Mac 政策表 seedInBody)
	'jingjue',     // 荆诀(揲蓍种子在体,同上)
	'cast', 'shake', 'random',            // 起卦/摇卦/随机类动作
	'sse', 'stream',                      // 流式(AI 分析)
	'moira',                              // 七政 Moira 流年:默认过运时刻=「现在」
	'providers', 'materials',             // 资源/配置类,非确定性纯计算
];

// 预算:技法端点必须排在 chart 之前(非占星页是技法端点在 gate 面板)。
// R4-B2 武装深度 ±3 时一轮最多 6 目标 ×(chart+技法) ≈ 12 任务;串行泵 + 自适应间隔即
// 节流阀(后端 CherryPy 池 30、最坏并发 ~13,余量 >2×),已在缓存里的目标由 chartMem/L1
// 即时吸收,真实网络数远小于任务数。
const BUDGET_PER_SETTLE = 12;
// 自适应间隔下限:任务间至少 80ms;实际间隔取 max(80, 上个任务耗时) —— 重端点自然拉长错峰。
const MIN_GAP_MS = 80;
// horosa_pump_fastfirst_v1(Windows-ahead,PERF-R12 W3a①):首目标组快发延迟 —— 32ms 只为
// 让出一帧(submit 在 settle 之后 = 主渲染已提交),与 livelock 修的 500ms 保底互补:
// fast-first 管「首目标 ±1 的第一拍要快」,保底管「长队列在繁忙期持续有拍」。
const FAST_FIRST_DELAY_MS = 32;

let generation = 0;
let running = false;
let queue = [];
let lastTaskDurationMs = 0;

// —— horosa_prefetch_runtime_whitelist_v1:ambient 预取作用域 + 拒绝计数 ——
// inPrefetchDepth 只在【同步】调用 entry.run() 的那一瞬置位(JS 单线程 ⇒ 期间绝无用户请求
// 能插进来),因此不存在「误拦用户真实请求」的可能;这是纵深防御,不是主闸。
let inPrefetchDepth = 0;
let refusalCount = 0;

/** 把 url / path 归一成以 '/' 开头的纯路径(去 scheme+host、去 query/hash)。 */
export function normalizePrefetchPath(urlOrPath){
	if(urlOrPath === undefined || urlOrPath === null){
		return '';
	}
	let txt = `${urlOrPath}`;
	if(!txt){
		return '';
	}
	const scheme = txt.indexOf('://');
	if(scheme >= 0){
		const rest = txt.slice(scheme + 3);
		const slash = rest.indexOf('/');
		txt = slash < 0 ? '/' : rest.slice(slash);
	}
	const q = txt.search(/[?#]/);
	if(q >= 0){
		txt = txt.slice(0, q);
	}
	if(txt.charAt(0) !== '/'){
		txt = `/${txt}`;
	}
	return txt;
}

/** 该路径是否允许预取(禁词优先于允许前缀)。 */
export function isPrefetchPathAllowed(urlOrPath){
	const p = normalizePrefetchPath(urlOrPath).toLowerCase();
	if(!p || p === '/'){
		return false;
	}
	for(let i = 0; i < PREFETCH_FORBIDDEN_MARKERS.length; i += 1){
		if(p.indexOf(PREFETCH_FORBIDDEN_MARKERS[i]) >= 0){
			return false;
		}
	}
	for(let i = 0; i < PREFETCH_ALLOWED_PATHS.length; i += 1){
		if(p.indexOf(PREFETCH_ALLOWED_PATHS[i].toLowerCase()) === 0){
			return true;
		}
	}
	return false;
}

export function isInPrefetchScope(){
	return inPrefetchDepth > 0;
}

/**
 * 纵深防御闸(request.js / chartFetch.js 调):预取作用域内、URL 不在白名单 → 返回 false 并计数。
 * 非预取作用域恒 true(用户真实请求 100% 不受影响,逐字节旧行为)。
 */
export function guardPrefetchUrl(url){
	if(inPrefetchDepth <= 0){
		return true;
	}
	if(isPrefetchPathAllowed(url)){
		return true;
	}
	refusalCount += 1;
	return false;
}

/** 测试/诊断:累计被丢弃(提交期)+ 被拒发(运行期)的次数。 */
export function prefetchRefusalCount(){
	return refusalCount;
}

function scheduleIdle(fn){
	if(typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'){
		// horosa_prefetch_pump_livelock_v1:timeout 2000→500 —— 繁忙期(连点)每 ~500ms 保底一拍,
		// 空闲期 rIC 照常在帧尾即触发(更早)。
		window.requestIdleCallback(fn, { timeout: 500 });
		return;
	}
	setTimeout(fn, 250);
}

function pump(){
	if(running){
		return;
	}
	if(!queue.length){
		return;
	}
	running = true;
	const beat = ()=>{
		// horosa_prefetch_pump_livelock_v1:一拍之内先丢干净旧代,直接执行遇到的第一个当代任务
		// —— 丢旧代不消耗拍(旧行为「丢一个→排下一拍」在连点下把每一拍都浪费在丢弃上)。
		let entry = queue.shift();
		while(entry && entry.gen !== generation){
			entry = queue.shift();
		}
		if(!entry){
			running = false;
			return;
		}
		const startedAt = Date.now();
		// horosa_prefetch_runtime_whitelist_v1:run() 必须【同步】在作用域内起调,
		// 否则 ambient 标志覆盖不到任务里真正发请求的那一行。
		let p = null;
		inPrefetchDepth += 1;
		try{
			p = entry.run();
		}catch(e){
			p = Promise.reject(e);
		}finally{
			inPrefetchDepth -= 1;
		}
		Promise.resolve(p)
			.catch(()=>{ /* 预取失败静默:回到冷即付现状,正式请求自会兜底 */ })
			.finally(()=>{
				lastTaskDurationMs = Date.now() - startedAt;
				setTimeout(()=>{
					running = false;
					pump();
				}, Math.max(MIN_GAP_MS, lastTaskDurationMs));
			});
	};
	// horosa_pump_fastfirst_v1(Windows-ahead,PERF-R12 W3a①):排干旧代后队头若是本代
	// fast-first 任务(submit 侧标记首目标组 ≤2 个),该拍不等空闲帧 —— rIC 在快速连点下
	// 饥饿(无空闲帧 ⇒ 只剩超时兜底,届时代际已换),32ms 让出一帧即发;其余任务照走 rIC
	// (livelock 修的 500ms 保底继续兜)。代际检查仍在拍体内(过期任务照旧丢弃)。
	// 关 horosa.perf.stepPrefetchFastFirst = 恒走 rIC 旧调度。
	let fastHead = false;
	if(stepPrefetchFastFirstEnabled()){
		for(let i = 0; i < queue.length; i += 1){
			if(queue[i].gen === generation){
				fastHead = !!queue[i].fastFirst;
				break;
			}
		}
	}
	if(fastHead){
		setTimeout(beat, FAST_FIRST_DELAY_MS);
	}else{
		scheduleIdle(beat);
	}
}

/**
 * 提交一轮预取(fetchByFields settle 后调)。整队替换(latest-wins)。
 * @param {Array<{name:string, path:string, run:function}>} tasks 预取任务
 *        (path=该任务将访问的端点路径,过运行时白名单;run 返回 Promise;
 *        任务内的请求自带 silent+零重试;结果自然落进各自缓存层)
 */
export function submitStepPrefetch(tasks, opts){
	if(!stepPrefetchEnabled() || !Array.isArray(tasks) || !tasks.length){
		return;
	}
	// horosa_prefetch_runtime_whitelist_v1:白名单外的任务【丢弃】(不抛错)。
	const accepted = [];
	for(let i = 0; i < tasks.length; i += 1){
		const t = tasks[i];
		if(!t || typeof t.run !== 'function' || !isPrefetchPathAllowed(t.path)){
			refusalCount += 1;
			continue;
		}
		accepted.push(t);
	}
	if(!accepted.length){
		return;
	}
	generation += 1;
	const gen = generation;
	// [R3-A1 上游] 显式 opts.budget 硬顶 5(选步长双向 ±2=4 任务;绝不放开成风暴);
	// 缺省走 BUDGET_PER_SETTLE(R4-B2 武装 ±3 一轮 ≤12,串行泵+白名单闸即节流)。
	const budget = opts && Number.isInteger(opts.budget) && opts.budget > 0
		? Math.min(opts.budget, 5)
		: BUDGET_PER_SETTLE;
	// horosa_pump_fastfirst_v1:首目标组(登记方按价值序排列,前 2 个≈「技法+1 与 chart+1」)
	// 打 fastFirst 标 —— 只影响拍的调度方式,预算/白名单/latest-wins 结构全不动。
	queue = accepted.slice(0, budget).map((t, i)=>({ ...t, gen, fastFirst: i < 2 }));
	pump();
}

// —— [R3-A1] 选步长即预取:DateTimeSelector.changeTimeType(opt-in 宿主)→ 此处 ——
// 与 settle 后预取共用同一队列/代际/预算体系;处理器由 models/astro 注册
// (R4-B2 起处理器 = 武装引擎:按当前技法 ±stepPrefetchDepth 全窗,见 astro.js)。
// 同 unit 5s 去重:反复点同档不重复排队(切档立即生效,latest-wins 覆盖旧代)。
let stepSelectHandler = null;
let lastStepSelect = { unit: null, at: 0 };

export function registerStepSelectHandler(fn){
	if(typeof fn === 'function'){
		stepSelectHandler = fn;
	}
}

export function fireStepSelectPrefetch(unit){
	try{
		if(!stepPrefetchEnabled() || !stepSelectPrefetchEnabled() || !unit){
			return;
		}
		const now = Date.now();
		if(lastStepSelect.unit === unit && (now - lastStepSelect.at) < 5000){
			return;
		}
		lastStepSelect = { unit, at: now };
		if(stepSelectHandler){
			stepSelectHandler(unit);
		}
	}catch(e){ /* 预取失败无害 */ }
}

/** 测试用:清选步长去重态 */
export function __resetStepSelectForTest(){
	lastStepSelect = { unit: null, at: 0 };
}

// —— Phase B:技法端点注册表(kentang pan 等 raw fetch 不经 requestDedupe,
//    预取必须落到技法自己的缓存层 —— 由各技法用【自己真实的请求函数】登记) ——
const REGISTRY = new Map();

/**
 * @param {string} tabKey 主 tab 键(state.astro.currentTab 口径)
 * @param {function} fn (steppedFieldValues, stepHint) => Array<{name, path, run}>
 *        —— 返回该技法在【已步进到目标时间的 fields】下的预取任务。
 *        🔴 登记必须发生在【组件内部】(回调闭包吃 this.state):技法参数普遍依赖
 *        「渲染后才有」的组件态(流派/选项/引擎模式),模块级登记拿不到。
 */
export function registerStepPrefetcher(tabKey, fn){
	if(tabKey && typeof fn === 'function'){
		REGISTRY.set(tabKey, fn);
	}
}

export function unregisterStepPrefetcher(tabKey, fn){
	if(tabKey && REGISTRY.get(tabKey) === fn){
		REGISTRY.delete(tabKey);
	}
}

export function getStepPrefetcher(tabKey){
	return REGISTRY.get(tabKey);
}

/** 测试用:清内部态 */
export function __resetStepPrefetch(){
	generation += 1;
	queue = [];
	running = false;
	inPrefetchDepth = 0;
	refusalCount = 0;
	lastTaskDurationMs = 0;
	REGISTRY.clear();
}
