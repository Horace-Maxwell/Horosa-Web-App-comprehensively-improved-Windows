// divination/election/returnCharts.js
// 回归盘(日返/月返)与主限命中——择日「合参」第三段。全部按需触发(UI 按钮拉取),不默认拉盘。
// 日返=太阳精确还本命黄经(~365.25 日);月返=月还本命度(27.3 恒星月,勿与 29.5 朔望混)。
// 主限命中=只读复用既有主限引擎:按本命参数带 predictive+主限法补拉一张命盘,
// 取 Result 顶层 predictives.primaryDirection 过滤择日日期前后命中;绝不触碰引擎与默认路径。
import moment from 'moment';
import { chartAtMoment } from '../mundane/momentPipeline';
import { buildFacts } from '../engine/chartFacts';
import { fetchChart } from '../../services/astro';
import { PLANETS } from '../data/planets';
import { SIGNS } from '../data/signs';
import { SOLAR_RETURN_DAYS, LUNAR_RETURN_DAYS } from '../engine/timeLords';

const cn = (k) => (PLANETS[k] || {}).cn || k;
const RATE = { sun: 360 / SOLAR_RETURN_DAYS, moon: 360 / LUNAR_RETURN_DAYS };   // °/日(平均)

function shortDelta(target, cur){
	return ((target - cur + 540) % 360) - 180;   // ∈(−180,180]
}
function fmt(m){ return m.format('YYYY-MM-DD HH:mm:ss'); }

// 牛顿迭代求「电盘时刻之前最近一次」回归精确时刻。返回 {momentStr, facts} 或 null。
export async function solveReturnBefore(kind, natalLon, electionMomentStr, fieldsLike){
	if(natalLon === null || natalLon === undefined) return null;
	const rate = RATE[kind];
	const elec = moment(electionMomentStr, 'YYYY-MM-DD HH:mm:ss');
	if(!elec.isValid()) return null;
	// 种子:按电盘时刻该体黄经与本命黄经的「已行过」角距回推
	const R0 = await chartAtMoment(electionMomentStr, fieldsLike);
	if(!R0) return null;
	const f0 = buildFacts(R0);
	const p0 = f0 && f0.planets[kind];
	if(!p0 || p0.lon === null || p0.lon === undefined) return null;
	const elapsedDeg = ((p0.lon - natalLon) % 360 + 360) % 360;
	// ⚠️ moment 对 'days' 的小数会整数截断(71.53→71 天、±0.4→0 天,迭代原地踏步)——
	// 一律折算成整数秒做时间算术(白盒复现后根修,勿回退成 days 浮点)。
	const daysToSec = (d) => Math.round(d * 86400);
	let t = elec.clone().subtract(daysToSec(elapsedDeg / rate), 'seconds');
	let facts = null;
	for(let i = 0; i < 6; i++){
		const R = await chartAtMoment(fmt(t), fieldsLike);
		if(!R) return null;
		facts = buildFacts(R);
		const p = facts && facts.planets[kind];
		if(!p || p.lon === null || p.lon === undefined) return null;
		const d = shortDelta(natalLon, p.lon);
		if(Math.abs(d) < 0.005) break;
		const v = (typeof p.speed === 'number' && Math.abs(p.speed) > 0.05) ? Math.abs(p.speed) : rate;
		t = t.add(daysToSec(d / v), 'seconds');
	}
	// 收敛点若落在电盘之后(边界:电盘恰在回归点前) → 回退一整周期再精化一次
	if(t.isAfter(elec)){
		t = t.subtract(daysToSec(kind === 'sun' ? SOLAR_RETURN_DAYS : LUNAR_RETURN_DAYS), 'seconds');
		const R = await chartAtMoment(fmt(t), fieldsLike);
		if(R){ facts = buildFacts(R); }
	}
	return facts ? { momentStr: fmt(t), facts } : null;
}

// 回归盘要点(展示层):光体状态 + 角宫吉凶 + 上升座。
export function judgeReturnFacts(kindCn, ret){
	if(!ret || !ret.facts) return [];
	const facts = ret.facts;
	const notes = [];
	const asc = facts.meta.ascSign;
	notes.push({ pol: 'info', text: `${kindCn}时刻 ${ret.momentStr}，上升 ${SIGNS[asc] ? SIGNS[asc].cn : asc || '—'}。` });
	['jupiter', 'venus'].forEach((k) => {
		const p = facts.planets[k];
		if(p && p.angularity === 'angular') notes.push({ pol: 'positive', text: `${kindCn}盘吉星 ${cn(k)} 临角宫（本期得助）。` });
	});
	['saturn', 'mars'].forEach((k) => {
		const p = facts.planets[k];
		if(p && p.angularity === 'angular') notes.push({ pol: 'negative', text: `${kindCn}盘凶星 ${cn(k)} 临角宫（本期承压）。` });
	});
	const light = facts.meta.isDiurnal ? 'sun' : 'moon';
	const lp = facts.planets[light];
	if(lp){
		if(lp.dignityScore >= 2) notes.push({ pol: 'positive', text: `${kindCn}盘区分光 ${cn(light)} 有尊贵。` });
		else if(lp.combustion === 'combust' || lp.dignityScore <= -4) notes.push({ pol: 'negative', text: `${kindCn}盘区分光 ${cn(light)} 受克。` });
	}
	return notes;
}

// 双返一站式:自电盘时刻回推最近日返+月返(约 6+6 次轻量排盘,cache:true)。
export async function fetchReturnSet(natalFacts, electionMomentStr, fieldsLike){
	if(!natalFacts) return null;
	const sunLon = natalFacts.planets.sun ? natalFacts.planets.sun.lon : null;
	const moonLon = natalFacts.planets.moon ? natalFacts.planets.moon.lon : null;
	const [solar, lunar] = await Promise.all([
		solveReturnBefore('sun', sunLon, electionMomentStr, fieldsLike),
		solveReturnBefore('moon', moonLon, electionMomentStr, fieldsLike),
	]);
	return { solar, lunar };
}

// 主限命中(只读):本命参数 + predictive/主限法旗标补拉命盘 → 取 predictives.primaryDirection,
// 过滤择日日期 ±windowDays,按时距升序取前 N。行结构 [_, promissor, significator, method, date]。
export async function fetchPdHitsNearElection(natalParams, electionDateStr, opts){
	const o = opts || {};
	const params = {
		...natalParams,
		predictive: 1, includePrimaryDirection: true,
		pdtype: 0, showPdBounds: 0,
		pdMethod: o.pdMethod || 'core_alchabitius',
		pdTimeKey: o.pdTimeKey || 'Ptolemy',
		pdDirect: 1, pdConverse: 0, pdAntiscia: 0, pdTerms: 0,
		pdaspects: [0, 60, 90, 120, 180],
	};
	try{
		const rsp = await fetchChart(params, { cache: true });
		const R = rsp && rsp.Result;
		const rows = (R && R.predictives && R.predictives.primaryDirection) || [];
		const elec = moment(electionDateStr, 'YYYY-MM-DD');
		if(!elec.isValid()) return [];
		const win = o.windowDays || 240;
		const out = [];
		rows.forEach((row) => {
			if(!Array.isArray(row) || !row[4]) return;
			const d = moment(String(row[4]).slice(0, 10), 'YYYY-MM-DD');
			if(!d.isValid()) return;
			const delta = d.diff(elec, 'days');
			if(Math.abs(delta) > win) return;
			out.push({ promissor: row[1], significator: row[2], method: row[3], date: String(row[4]).slice(0, 10), deltaDays: delta });
		});
		return out.sort((a, b) => Math.abs(a.deltaDays) - Math.abs(b.deltaDays)).slice(0, o.limit || 8);
	}catch(e){ return []; }
}

export default fetchReturnSet;
