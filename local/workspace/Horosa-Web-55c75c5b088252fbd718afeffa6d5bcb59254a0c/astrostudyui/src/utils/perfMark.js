// [A8] 交互延迟测量架:选项改动 → 计算完成(→ 渲染提交)三段埋点。
// 设计约束:
//   · 零依赖、零副作用、单次开销 ≈ performance.now() 两次 + 环形缓冲一写(纳秒级),生产可常开;
//   · kill-switch horosa.perf.interactionMarks(默认开;localStorage 置 '0' 关);
//   · 不侵入渲染:compute 段在引擎调用点包一层;commit 段(可选)用 rAF 近似「本帧提交」。
// 消费口:
//   · window.__horosaPerf.summary() → 每 technique/op 的 {n, avg, max, p95}(dev 面板/console 可读);
//   · window.__horosaPerf.recent(n) → 最近 n 条原始样本;
//   · performance.measure('horosa:<tech>:<op>') 同步打点,Safari/Chrome devtools Timings 可见。
const RING_MAX = 512;
const ring = [];
const agg = new Map(); // key=tech|op → { n, total, max, samples:[环形 64 个用于 p95] }

function enabled(){
	try{
		if(typeof localStorage === 'undefined'){ return true; }
		return localStorage.getItem('horosa.perf.interactionMarks') !== '0';
	}catch(e){ return true; }
}

function nowMs(){
	try{
		if(typeof performance !== 'undefined' && performance.now){ return performance.now(); }
	}catch(e){ /* ignore */ }
	return Date.now();
}

function record(tech, op, phase, ms){
	const key = `${tech}|${op}`;
	let a = agg.get(key);
	if(!a){ a = { n: 0, total: 0, max: 0, samples: [] }; agg.set(key, a); }
	a.n += 1; a.total += ms; if(ms > a.max){ a.max = ms; }
	a.samples.push(ms); if(a.samples.length > 64){ a.samples.shift(); }
	ring.push({ t: Date.now(), tech, op, phase, ms: Math.round(ms * 100) / 100 });
	if(ring.length > RING_MAX){ ring.shift(); }
	try{
		if(typeof performance !== 'undefined' && performance.measure){
			// measure 名带段别,devtools 里可按前缀过滤。start 用 mark 不可得(免配对成本),直接记时长。
			performance.measure(`horosa:${tech}:${op}:${phase}`, { start: nowMs() - ms, duration: ms });
		}
	}catch(e){ /* Safari 旧版 measure(options) 不支持则跳过,环形缓冲仍在 */ }
}

/**
 * 开始一次交互测量。用法:
 *   const m = perfBegin('bazi', 'phaseType');
 *   …同步/异步计算…
 *   m.computed();            // 记「选择→计算完」段
 *   m.committed();           // 可选:rAF 后记「选择→渲染提交」段(近似)
 * disabled 时返回恒空操作对象,调用方零分支。
 */
export function perfBegin(technique, option){
	if(!enabled()){
		return { computed(){}, committed(){} };
	}
	const t0 = nowMs();
	let computeLogged = false;
	return {
		computed(){
			if(computeLogged){ return; }
			computeLogged = true;
			record(technique, option || '-', 'compute', nowMs() - t0);
		},
		committed(){
			try{
				if(typeof requestAnimationFrame === 'function'){
					requestAnimationFrame(()=>{ record(technique, option || '-', 'commit', nowMs() - t0); });
				}
			}catch(e){ /* SSR/jest 无 rAF 则略 */ }
		},
	};
}

/** 计时包装:同步函数一行接入。const out = perfWrap('guice','pan', ()=>buildGuicePan(...)); */
export function perfWrap(technique, option, fn){
	const m = perfBegin(technique, option);
	try{
		return fn();
	}finally{
		m.computed();
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// horosa_interaction_span_v1 (PERF-R9 Ship 0a):端到端「点击 → 中栏+右栏画完」测量。
//
// 为什么非加不可:改之前这套观测**量不出**要验收的那个数。三处失灵——
//   ① ':refresh-start' 全仓只有 pages/index.js 的 changeTab 打点,**切时间/改选项从不打**,
//      于是 models/astro.js:markChartRefreshEnd 把新的 end 和上一次切页签留下的陈旧 start
//      配成 measure,量出秒级甚至分钟级的垃圾;
//   ② 快车道(八字/紫微/数算)在 models/astro.js 提前 return,压根不打 refresh-end,
//      而 chartObj.chartId 变了 → pages/index.js 的 render-complete 照样触发 → 三族报的是
//      拿陈旧 end 算出来的**伪造**渲染时间;
//   ③ pages/index.js 的 render-complete 只跟着 chartObj 走,双 rAF 就盖章,而各技法自己的
//      fetch+setState 落在更后面的帧 —— 除占星外**每个技法都提前触发**。
// 于是本模块提供一对显式 API:交互起点由派发处打,终点由**各技法自己**在面板数据落地后打。
// 落点用双 rAF 逼近「本帧已绘」,与既有 render-complete 的口径一致。
// kill-switch 沿用 horosa.perf.interactionMarks;关掉后全部退化为空操作。
const STEP_START_MARK = 'horosa:step:refresh-start';
let stepT0 = 0;
let stepTech = '';
let stepGen = 0;

// horosa_gesture_start_v1 —— 起点的**通用**来源。
// 背景:`markInteractionStart` 此前全站只在 pages/index.js 的 changeCond 里打,于是只有
// 「改生辰/宫制/黄道/时间」这条路有起点。而 owner 的验收口径是「所有单次设置 / 时间调整 /
// 选项」—— 技法**内部**的选项(遁甲流派与排盘法、六壬 13 项设置、太乙积年、金口贵神月将、
// 占星的相位线/四角/度数/界限显示开关、各族子页签切换…)走的是各自的 setState 或 app/save,
// 一律没有起点 ⇒ 那些交互的耗时**根本量不出来**,而它们恰恰是重绘最贵的一批。
//
// 给二十多个组件逐个手工补起点,既漏得快也错得快(本轮已实测:某族声称"每个技法都接了",
// 实际 28 个子技法漏了 14 个)。正确的抽象是:**这些交互本质上全是一次点击**,而"从点击算起"
// 正是 owner 原话。所以起点统一由一个**捕获期**监听给出 —— 捕获期先于任何 React 处理器,
// 拿到的就是用户按下的那一刻。
//
// 与显式起点的关系:changeCond 里的显式 `markInteractionStart` 保留,但若同一技法上已有一枚
// 新鲜的手势起点,则**沿用更早的那枚**(它更接近真实点击),不覆盖 —— 否则量出来的是
// 「React 处理器跑起来之后」而不是「用户点下」。
const GESTURE_COALESCE_MS = 1500;   // 手势与随后显式起点视为同一次交互的窗口
const MAX_SPAN_MS = 15000;          // 超过此跨度的配对一律丢弃(悬空起点产生的垃圾样本)
let gestureT0 = 0;
let gestureTech = '';
let currentTech = '';

/** 由 pages/index.js 在顶层页签变化时告知当前技法,供手势监听给样本归属。 */
export function setCurrentTechnique(technique){
	currentTech = technique || '';
}

/** 捕获期手势起点。只记时间,不做任何 DOM 操作,失败静默。 */
function onGestureCapture(){
	if(!enabled()){ return; }
	gestureT0 = nowMs();
	gestureTech = currentTech || '-';
	// 手势本身也直接成为一枚起点:很多技法内部选项**不经过** changeCond,
	// 没有任何显式起点会跟上来,此时这一枚就是唯一的起点。
	stepGen += 1;
	stepT0 = gestureT0;
	stepTech = gestureTech;
}

try{
	if(typeof document !== 'undefined' && document.addEventListener){
		// passive:不阻塞滚动/点击;capture:先于 React 合成事件,拿到真实按下时刻。
		document.addEventListener('pointerdown', onGestureCapture, { capture: true, passive: true });
		// 键盘可达性:空格/回车激活控件同样是一次交互。
		document.addEventListener('keydown', (ev)=>{
			if(ev && (ev.key === 'Enter' || ev.key === ' ')){ onGestureCapture(); }
		}, { capture: true, passive: true });
	}
}catch(e){ /* observation only */ }

/** 交互起点。technique = 当前页签 key。派发请求/本地计算之前调用。 */
export function markInteractionStart(technique){
	if(!enabled()){ return; }
	const tech = technique || '-';
	// 沿用更早的手势起点(见 horosa_gesture_start_v1):同技法 + 窗口内 ⇒ 同一次交互,
	// 保留手势那一刻的 t0,不要用"处理器跑到这里"的时刻覆盖它。
	if(gestureT0 && gestureTech === tech && (nowMs() - gestureT0) <= GESTURE_COALESCE_MS && stepT0){
		stepTech = tech;
		return;
	}
	stepGen += 1;
	stepT0 = nowMs();
	stepTech = tech;
	try{
		if(typeof performance !== 'undefined' && performance.mark){
			// ★ 名字必须包含 ':refresh-start' —— markChartRefreshEnd 按这个子串找最近一个 start
			// 来配 measure(它同时兼容 changeTab 的 horosa:tab:*:refresh-start)。改名会静默断链。
			// 每次先清掉上一枚,避免 mark 表随会话无界增长(既有实现是只加不清)。
			if(performance.clearMarks){ performance.clearMarks(STEP_START_MARK); }
			performance.mark(STEP_START_MARK);
		}
	}catch(e){ /* observation only */ }
}

/**
 * 面板就绪。各技法 Main 在「落中栏+右栏数据的那次 setState 回调」里调用。
 * 同一次交互只记第一次(用 generation 去重,避免一次交互里多次 setState 记多条)。
 */
export function markPanelReady(technique){
	if(!enabled() || !stepT0){ return; }
	// horosa_panel_ready_attribution_v1 —— 归属校验,防跨技法误记。
	// 没有这一条时的真实故障链(本轮复核实测):用户在「星运」步进 → 起点记在 direction;
	// 若星运某个子技法漏打 ready,起点就**悬着**;用户切回「占星」→ 冻结解除 → 占星面板
	// 拿到冻结期间已变过的数据重渲 → 打出一条 `astrochart` 的 ready,与 direction 的起点配对
	// ⇒ 记下一条**巨大的假样本**,而且它会污染的正是我们要验收的那个数字。
	// 判据:技法不一致直接丢弃(不消费起点 —— 真正属于它的 ready 可能还在后面)。
	if(technique && stepTech && stepTech !== '-' && technique !== stepTech){ return; }
	// 跨度上限:悬空起点 + 很久以后的一次 ready = 垃圾。丢弃并清掉起点,避免它继续污染后续。
	if((nowMs() - stepT0) > MAX_SPAN_MS){ stepT0 = 0; return; }
	const t0 = stepT0;
	const tech = technique || stepTech;
	stepT0 = 0;   // 立刻消费,后续 setState 不再记
	// horosa_panel_ready_no_gen_void_v1:t0/tech 在此已定格,「这次点击→这次绘制」的事实
	// 不因双 rAF 窗口(~32ms)内出现新 pointerdown 而改变。旧守卫(gen 变化即弃)防的只是
	// ≤2 帧的膨胀,却让快节奏连点下几乎每条样本作废 —— 慢面板技法(七政/印占)因此恒零样本。
	const finish = ()=>{
		record(tech, 'interaction', 'panel-ready', nowMs() - t0);
		try{
			if(typeof performance !== 'undefined' && performance.mark){
				performance.mark('horosa:step:panel-ready');
			}
		}catch(e){ /* ignore */ }
	};
	try{
		if(typeof requestAnimationFrame === 'function'){
			requestAnimationFrame(()=>{ requestAnimationFrame(finish); });
		}else{ finish(); }
	}catch(e){ finish(); }
}

export function perfSummary(){
	const out = {};
	agg.forEach((a, key)=>{
		const sorted = a.samples.slice().sort((x, y)=>x - y);
		const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;
		out[key] = {
			n: a.n,
			avg: Math.round((a.total / Math.max(1, a.n)) * 100) / 100,
			max: Math.round(a.max * 100) / 100,
			p95: Math.round(p95 * 100) / 100,
		};
	});
	return out;
}

export function perfRecent(n){
	return ring.slice(-(n || 50));
}

// horosa_perf_reset_v1:清空聚合与环形样本。仅供**验收台架**使用
// (scripts/perf_acceptance.cjs):切到某技法页签会先付一次性装载成本,那不属于
// 「单次设置/时间调整」的预算;台架在切页签并稳定之后调一次 reset,使随后 N 次
// 步进的 p95 只反映稳态下的单次操作。业务代码不调它。
export function perfReset(){
	agg.clear();
	ring.length = 0;
	// 连同**在途的起点**一起清 —— 否则 reset 之后第一条样本会跟 reset 之前的某次点击配对,
	// 量出一个包含了"切页签 + 等稳定"整段时间的巨大首样本(验收台架恰好每族都要 reset 一次)。
	stepT0 = 0;
	stepGen += 1;
	gestureT0 = 0;
}

// dev/真机可读句柄(不覆盖既有)。
try{
	if(typeof window !== 'undefined' && !window.__horosaPerf){
		window.__horosaPerf = { summary: perfSummary, recent: perfRecent, reset: perfReset };
	}
}catch(e){ /* ignore */ }
