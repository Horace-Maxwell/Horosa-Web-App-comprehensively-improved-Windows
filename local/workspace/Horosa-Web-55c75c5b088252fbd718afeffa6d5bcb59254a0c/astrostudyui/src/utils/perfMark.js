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
		window.__horosaPerf = { summary: perfSummary, recent: perfRecent };
	}
}catch(e){ /* ignore */ }
