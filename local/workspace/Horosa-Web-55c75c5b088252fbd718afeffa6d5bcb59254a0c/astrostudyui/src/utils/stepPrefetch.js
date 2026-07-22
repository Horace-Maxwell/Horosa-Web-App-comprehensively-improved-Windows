// stepPrefetch —— 时间步进方向预取调度器(极速化大修 WP-P1;PERF-R9 Ship 7 扩容+加闸)。
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
//   ④ 每 settle 预算 ≤5 个任务 + 任务间自适应最小间隔 max(80ms, 上个任务耗时);
//   ⑤ 预取请求由任务方自带 silent + retry:{retries:0} —— 后端重启窗口绝不退避重试风暴。
//
// 纪律(有 jest 快照哨兵 + preflight 机械核双镜像):
//   · 预取参数必须「与用户真点会发出的请求」逐字节同键(复用同一参数构建路径),绝不臆造;
//   · PREFETCH_ALLOWED_PATHS 白名单之外的端点绝不预取 —— 尤其【随机起卦/抽牌类】
//     (dice/摇卦/塔罗/地占),预取即把随机结果钉死;AI/心跳类同禁。
//
// horosa_prefetch_runtime_whitelist_v1(PERF-R9 Ship 7)——【白名单从文档变成运行时闸】:
//   病根:旧版任务契约是 {name, run},run 是不可内省的闭包 —— 白名单只是注释 + jest 快照,
//   运行时【零】拦截,任何登记方都能把随机端点塞进预取队列而无人察觉。且旧允许集里裸 '/pan'
//   一条【匹配不到任何真实路径】(真路径是 /qimen/pan、/taiyi/pan…),等于形同虚设。
//   修法两层:
//     ① 契约加声明位:{name, path, run} —— submitStepPrefetch 用 path 过白名单,不合格【丢弃】
//        (不抛错:预取是优化不是功能,丢一条只是回到冷即付);
//     ② 纵深防御(path 是自述的,可能与 run 里真发的 URL 不符):pump 期间置 ambient 标志,
//        utils/request.js 与 utils/chartFetch.js 在标志置位时对不合格 URL 直接拒发并计数。
//   两层的拒绝都累加进同一计数器(prefetchRefusalCount),测试据此断言「零泄漏」。
import { stepPrefetchEnabled, stepSelectPrefetchEnabled } from './perfFlags';

/** 允许预取的端点前缀(显式白名单;哨兵对照此数组,增删须同步测试) */
export const PREFETCH_ALLOWED_PATHS = [
	'/chart',        // 共享出盘(chartMem+requestDedupe 双层承接)
	'/chart3d',      // 3D 星盘状态(确定性纯计算)
	'/predict/',     // 推运(dice 由 FORBIDDEN 拦)
	'/ziwei/',       // 紫微
	'/liureng/',     // 六壬/金口诀共用神将
	'/india/',       // 印占
	'/germany/',     // 汉堡/量化盘(中点)
	'/modern/',      // 现代技法
	'/astroextra/',  // 占星扩展
	'/calendar/',    // 黄历(确定性历法)
	'/nongli/',      // 农历/真太阳时(遁甲/太乙/三式 stage-1)
	'/jieqi/',       // 节气年表/种子(分至图 + 遁甲/太乙 stage-1)
	'/bazi/',        // 八字
	'/qizheng/',     // 七政(moira 流年由 FORBIDDEN 拦 —— 其默认过运时刻是「现在」)
	'/common/',      // 通用查表
	// —— kentang 各技法 /{key}/pan:【逐条枚举,绝不通配】——
	// 通配 '/*/pan' 会把 /geomancy/pan(地占,随机)与 /wuzhao/pan(五兆,random.randint)
	// 一并放进来 = 预取即把随机结果钉死。枚举是这里唯一安全的写法。
	'/qimen/pan',
	'/taiyi/pan',
	'/jinkou/pan',
	'/shaozi/pan',
	'/tieban/pan',
	'/fendjing/pan',
	'/beiji/pan',
	'/nanji/pan',
	'/chunzi/pan',
	'/xianqin/pan',
	'/cetian/pan',
	'/qizhengkin/pan',
	'/taixuan/pan',
	'/shenyishu/pan',
	'/wangji/pan',
];
/** 绝不预取(与 _requestCache 头注纪律镜像;哨兵断言两表交集为空) */
export const PREFETCH_FORBIDDEN_MARKERS = [
	'dice', 'gua', 'tarot', 'geomancy', 'aianalysis', 'heartbeat', 'planetarium',
	// PERF-R9 Ship 7 补齐:随机/取现时/流式/资源类,一律不得进预取。
	'wuzhao',      // 五兆(mode≠ganzhi 时后端 random.randint)
	'jingjue',     // 荆诀(随机起课)
	'xiaoliuren',  // 小六壬(随机/掌诀起课)
	'cast', 'shake', 'random', 'seed',   // 起卦/摇卦/随机/随机种子类动作
	'sse', 'stream',                      // 流式(AI 分析)
	'moira',                              // 七政 Moira 流年:默认过运时刻=「现在」
	'providers', 'materials',             // 资源/配置类,非确定性纯计算
];

// 预算:技法端点必须排在 chart 之前(非占星页是技法端点在 gate 面板)。
// PERF-R10 horosa_step_prefetch_arm_v1:5→12 —— 武装深度 ±3 时一轮最多 6 目标 ×(chart+技法)
// ≈ 12 任务;串行泵 + 自适应间隔即节流阀(后端 CherryPy 池 30、最坏并发 ~13,余量 >2× 已核),
// 已在缓存里的目标由 chartMem/L1 即时吸收,真实网络数远小于任务数。
const BUDGET_PER_SETTLE = 12;
// 自适应间隔下限:任务间至少 80ms;实际间隔取 max(80, 上个任务耗时) —— 重端点自然拉长错峰。
const MIN_GAP_MS = 80;

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
		window.requestIdleCallback(fn, { timeout: 2000 });
		return;
	}
	setTimeout(fn, 250);
}

function pump(){
	if(running){
		return;
	}
	const entry = queue.shift();
	if(!entry){
		return;
	}
	running = true;
	scheduleIdle(()=>{
		if(entry.gen !== generation){
			// 旧代任务:用户已有更新的操作,这步预取的目标时间已不是「下一步」—— 弃
			running = false;
			pump();
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
	});
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
	// 缺省仍走 BUDGET_PER_SETTLE(武装 ±3 一轮 ≤12,串行泵+白名单闸即节流)。
	const budget = opts && Number.isInteger(opts.budget) && opts.budget > 0
		? Math.min(opts.budget, 5)
		: BUDGET_PER_SETTLE;
	queue = accepted.slice(0, budget).map((t)=>({ ...t, gen }));
	pump();
}

// —— [R3-A1] 选步长即预取:DateTimeSelector.changeTimeType(opt-in 宿主)→ 此处 ——
// 与 settle 后预取共用同一队列/代际/预算体系;处理器由 models/astro 注册
// (Windows 侧处理器 = 武装引擎:按当前技法 ±stepPrefetchDepth 全窗,见 astro.js)。
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
