// components/horary/horaryOverlayData.js
// 卜卦盘中栏「判读叠层」二期数据构建器（WP5.1 余项）：把 runHorary 判读结果压成
// 纯几何描述对象,交 AstroChartCircle 独立 SVG 层渲染。
//   perfection.lines —— 完成法连线（direct=实线 / relay(传递·汇集)=虚线经中间星 / broken=红叉破坏）
//   antiscia         —— 各星映点 (180−λ) 小三角,落宫头 ≤1° 者加重
//   stars            —— 恒星命中(命度/天顶/三征象星),轮缘打点+星名
//   terms            —— 界限环着色开关(具体表由 Circle 按 chartObj.params.termsVariant 单源取)
//
// 铁律：本模块只在卜卦页被消费;占星页不传 horaryOverlay prop → Circle 叠层短路,
// 渲染路径与现状逐字节一致。四子层各有 extra 开关（缺省=开,与一期 chartFocus 同口径）。
//
// 性能：单槽 memo（chartObj 引用 + 输入键串）——同盘同设置重复 render 返回同一对象引用,
// AstroChart 重绘签名/sCU 按引用比即可短路（不 memo 则每次新对象 → 守卫形同虚设）。
import { runHorary } from '../../divination/horary/horaryEngine';
import { horaryJudgeOpts, HORARY_SCHOOLS, HORARY_SCHOOL_ORDER } from '../../divination/horary/horarySchools';
import { judgeLayerOverrides } from '../../utils/judgeLayerOverrides';

// 引擎键(lowercase) → 盘面 chartId：优先走 j.facts.planets[key].chartId(单一真值),
// 此表仅兜底(facts 缺失时)。
const KEY2ID_FALLBACK = {
	sun: 'Sun', moon: 'Moon', mercury: 'Mercury', venus: 'Venus', mars: 'Mars',
	jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluto',
};

function angularDist(a, b){
	const d = Math.abs(((a - b) % 360 + 360) % 360);
	return d > 180 ? 360 - d : d;
}

// 未显式选流派时按盘参宫制反推(与 horarySchools.presetOf 同口径,输入源换成 chartObj.params)。
function schoolIdOf(extra, chartObj){
	if(extra && extra.horarySchool && HORARY_SCHOOLS[extra.horarySchool]){ return extra.horarySchool; }
	const hsys = chartObj && chartObj.params && chartObj.params.hsys !== undefined ? chartObj.params.hsys : null;
	if(hsys === null){ return 'classical'; }
	const hit = HORARY_SCHOOL_ORDER.find((id) => HORARY_SCHOOLS[id].backend.hsys === hsys);
	return hit || 'classical';
}

function switchesOf(extra){
	return {
		perfection: !extra || extra.overlayPerfection !== false,
		antiscia: !extra || extra.overlayAntiscia !== false,
		terms: !extra || extra.overlayTerms !== false,
		stars: !extra || extra.overlayStars !== false,
	};
}

function compute(chartObj, extra, schoolId, sw){
	const opts = horaryJudgeOpts(schoolId, (extra && extra.horaryOverrides) || null, judgeLayerOverrides());
	const j = runHorary(chartObj, (extra && extra.questionCategory) || 'general', opts);
	if(!j){ return null; }
	const cid = (k) => {
		if(!k){ return null; }
		if(j.facts && j.facts.planets && j.facts.planets[k] && j.facts.planets[k].chartId){ return j.facts.planets[k].chartId; }
		return KEY2ID_FALLBACK[k] || null;
	};
	const out = { terms: !!sw.terms };

	// ── 完成法连线 ─────────────────────────────────────────────
	if(sw.perfection && j.perfection){
		const perf = j.perfection;
		const A = cid(j.significators && j.significators.querentKey);
		const B = cid(j.significators && j.significators.quesitedKey);
		const lines = [];
		const marks = [];
		if(A && B && A !== B){
			if(perf.perfects && perf.method === 'translation' && perf.translator){
				lines.push({ from: cid(perf.translatorFrom) || A, via: cid(perf.translator), to: cid(perf.translatorTo) || B, kind: 'relay' });
			}else if(perf.perfects && perf.method === 'collection' && perf.collector){
				lines.push({ from: A, via: cid(perf.collector), to: B, kind: 'relay' });
			}else if(perf.perfects && perf.method === 'antiscion'){
				lines.push({ from: A, to: B, kind: 'antiscion' });
			}else if(perf.perfects){
				// application / position / mutual 等 → 两征象星直连实线。
				lines.push({ from: A, to: B, kind: 'direct' });
			}
			if(perf.destroyed){
				lines.push({ from: A, to: B, kind: 'broken' });
				const T = cid(perf.interferer);
				if(T){ marks.push({ id: T, style: 'danger' }); }
			}
		}
		// [H8] 并列路径:月亮独立成事径(moonPerfection 成而主径未成)→ 月亮→事项星虚线(kind: parallel)。
		const mp = j.moonPerfection;
		if(mp && mp.perfects && !mp.destroyed && !(perf.perfects) && B){
			const M = cid('moon');
			if(M && M !== B){
				if(mp.method === 'translation' && mp.translator){
					lines.push({ from: cid(mp.translatorFrom) || M, via: cid(mp.translator), to: cid(mp.translatorTo) || B, kind: 'parallel' });
				}else{
					lines.push({ from: M, to: B, kind: 'parallel' });
				}
			}
		}
		if(lines.length || marks.length){ out.perfection = { lines, marks }; }
	}

	// ── 映点小三角（引擎口径星集 = facts.planets;含三王星与否随流派/覆盖）────
	if(sw.antiscia && j.facts && j.facts.planets){
		const houses = (chartObj.chart && chartObj.chart.houses) || [];
		const items = [];
		Object.keys(j.facts.planets).forEach((k) => {
			const p = j.facts.planets[k];
			if(!p || p.lon === undefined || p.lon === null){ return; }
			const alon = ((180 - p.lon) % 360 + 360) % 360;
			let onCusp = false;
			for(let i = 0; i < houses.length; i++){
				if(houses[i] && houses[i].lon !== undefined && angularDist(alon, houses[i].lon) <= 1){ onCusp = true; break; }
			}
			items.push({ id: p.chartId || KEY2ID_FALLBACK[k] || k, alon, onCusp });
		});
		if(items.length){ out.antiscia = items; }
	}

	// ── 恒星命中（引擎 buildFixedStars 附带 starLon;engine 单源,不在此重算岁差）──
	if(sw.stars && Array.isArray(j.fixedStars) && j.fixedStars.length){
		const seen = {};
		const items = [];
		j.fixedStars.forEach((row) => {
			if(!row || row.starLon === undefined || row.starLon === null){ return; }
			const key = row.star + '@' + Math.round(row.starLon * 100);
			if(seen[key]){ return; }   // 同星命中多点(命度+月亮…)只画一次,轮缘不堆叠
			seen[key] = true;
			items.push({ name: row.star, lon: row.starLon, royal: !!row.royal, caution: row.nature === 'caution' });
		});
		if(items.length){ out.stars = items; }
	}

	// 全空（连界环开关也关）→ null,Circle 零动作。
	if(!out.perfection && !out.antiscia && !out.stars && !out.terms){ return null; }
	return out;
}

// 单槽 memo：同 chartObj(引用) + 同输入键 → 返回同一 overlay 对象。
let _memo = { chart: null, key: '', value: null };

export function buildHoraryOverlay(chartObj, extra){
	if(!chartObj || !chartObj.chart || chartObj.err){ return null; }
	const sw = switchesOf(extra);
	if(!sw.perfection && !sw.antiscia && !sw.terms && !sw.stars){ return null; }
	const schoolId = schoolIdOf(extra, chartObj);
	const key = JSON.stringify([
		schoolId,
		(extra && extra.horaryOverrides) || null,
		(extra && extra.questionCategory) || 'general',
		sw,
		judgeLayerOverrides(),
	]);
	if(_memo.chart === chartObj && _memo.key === key){ return _memo.value; }
	let value = null;
	try{
		value = compute(chartObj, extra, schoolId, sw);
	}catch(e){
		// 判读异常绝不拖垮盘面渲染:叠层静默缺席,右栏判读组件自会报错。
		value = null;
	}
	_memo = { chart: chartObj, key, value };
	return value;
}

export function __resetHoraryOverlayMemoForTest(){
	_memo = { chart: null, key: '', value: null };
}
