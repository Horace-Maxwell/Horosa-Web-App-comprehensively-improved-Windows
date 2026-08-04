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
// horosa_interaction_span_v1(R4-B1):端到端「点击 → 中栏+右栏画完」测量。
//
// 为什么非加不可:此前这套观测**量不出**「单次设置/时间调整→显示」这个要验收的数。
// 三处失灵——①起点只在个别派发处打,技法内部选项(各自 setState/app-save 路径)一律没有
// 起点;②快车道技法(八字/紫微/数算)不打终点,报的是陈旧配对;③通用 render-complete 只
// 跟 chartObj 走,各技法自己的 fetch+setState 落在更后的帧。
// 修法:起点统一由【捕获期手势监听】给出(pointerdown/keydown capture,先于任何 React
// 处理器 = 用户按下那一刻);终点由各技法在「落中栏+右栏数据的那次 setState 回调」里
// 显式 markPanelReady(双 rAF 逼近「本帧已绘」)。
// kill-switch 沿用 horosa.perf.interactionMarks;关掉后全部退化为空操作。
const STEP_START_MARK = 'horosa:step:refresh-start';
let stepT0 = 0;
let stepTech = '';
let stepGen = 0;

// horosa_gesture_start_v1 —— 起点的**通用**来源。
// 给二十多个组件逐个手工补起点,既漏得快也错得快。正确的抽象是:这些交互本质上全是
// 一次点击,而「从点击算起」正是验收口径。捕获期先于任何 React 处理器。
// 与显式起点的关系:显式 markInteractionStart 保留,但若同一技法上已有一枚新鲜的手势
// 起点,则沿用更早的那枚(更接近真实点击),不覆盖。
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
	// 保留手势那一刻的 t0,不要用「处理器跑到这里」的时刻覆盖它。
	if(gestureT0 && gestureTech === tech && (nowMs() - gestureT0) <= GESTURE_COALESCE_MS && stepT0){
		stepTech = tech;
		return;
	}
	stepGen += 1;
	stepT0 = nowMs();
	stepTech = tech;
	try{
		if(typeof performance !== 'undefined' && performance.mark){
			// 每次先清掉上一枚,避免 mark 表随会话无界增长。
			if(performance.clearMarks){ performance.clearMarks(STEP_START_MARK); }
			performance.mark(STEP_START_MARK);
		}
	}catch(e){ /* observation only */ }
}

/**
 * 面板就绪。各技法 Main 在「落中栏+右栏数据的那次 setState 回调」里调用。
 * 同一次交互只记第一次(起点立刻消费,后续 setState 不再记)。
 */
export function markPanelReady(technique){
	if(!enabled() || !stepT0){ return; }
	// horosa_panel_ready_attribution_v1 —— 归属校验,防跨技法误记:起点记在技法 A、
	// 技法 B 的 ready 撞上来(冻结解除重渲之类)会配出巨大假样本。技法不一致直接丢弃
	// (不消费起点 —— 真正属于它的 ready 可能还在后面)。
	if(technique && stepTech && stepTech !== '-' && technique !== stepTech){ return; }
	// 跨度上限:悬空起点 + 很久以后的一次 ready = 垃圾。丢弃并清掉起点,避免继续污染。
	if((nowMs() - stepT0) > MAX_SPAN_MS){ stepT0 = 0; return; }
	const t0 = stepT0;
	const tech = technique || stepTech;
	stepT0 = 0;   // 立刻消费,后续 setState 不再记
	// t0/tech 在此已定格:「这次点击→这次绘制」的事实不因双 rAF 窗口(~32ms)内出现
	// 新 pointerdown 而改变(否则快节奏连点下几乎每条样本作废,慢面板技法恒零样本)。
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

// horosa_perf_reset_v1:清空聚合与环形样本。仅供**验收台架**使用:切到某技法页签会先付
// 一次性装载成本,那不属于「单次设置/时间调整」的预算;台架在切页签并稳定之后调一次
// reset,使随后 N 次步进的 p95 只反映稳态下的单次操作。业务代码不调它。
export function perfReset(){
	agg.clear();
	ring.length = 0;
	// 连同**在途的起点**一起清 —— 否则 reset 之后第一条样本会跟 reset 之前的某次点击
	// 配对,量出一个包含「切页签+等稳定」整段的巨大首样本。
	stepT0 = 0;
	stepGen += 1;
	gestureT0 = 0;
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

// dev/真机可读句柄(不覆盖既有)。
try{
	if(typeof window !== 'undefined' && !window.__horosaPerf){
		window.__horosaPerf = { summary: perfSummary, recent: perfRecent, reset: perfReset };
	}
}catch(e){ /* ignore */ }
