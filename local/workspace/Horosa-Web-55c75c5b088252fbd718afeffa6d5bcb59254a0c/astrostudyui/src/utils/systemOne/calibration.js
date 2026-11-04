// 决策层 · 校准闸:用随包金标集打用户自己的 key,按「真实模型号 × 接入点」存成绩;没达标的点 pointOn 恒假。
// 指标口径:平衡准确率 / κ / 给定阈值下的覆盖率 / 「自动采纳」那部分的错误率(不报总体一致率);
// 达标线(初值,key 到手按实测定):质量提升 / 减少误判类 平衡准确率 ≥ 0.85 且采纳错误率 ≤ 2%;只加严类 误报率 ≤ 1%;
// 界面建议类 前一命中率 ≥ 0.7;影子类不设达标线(只记指标)。
import { listPoints, getPoint } from './registry';
import { GOLDEN_SETS } from './golden';
import { callSystemOneBatch } from './client';
import { readThresholds } from './prefs';
import { tierOf, DEFAULT_TIER_THRESHOLDS, sameValue, TIER_ACT } from './gate';
import { writeCalibration, readCalibration, clearDrift } from './calibrationStore';

export const CALIBRATION_MIN_ITEMS = 20;
export const PASS_RULES = Object.freeze({
	quality: { balancedAccuracyMin: 0.85, adoptedErrorMax: 0.02 },
	precision: { balancedAccuracyMin: 0.85, adoptedErrorMax: 0.02 },
	tighten: { falsePositiveMax: 0.01, balancedAccuracyMin: 0.6 },
	suggest: { topHitMin: 0.7 },
	shadow: null,
});

function keyOf(v){
	try{ return JSON.stringify(v === undefined ? null : v); }catch(e){ return `${v}`; }
}

// rows: [{ pred, truth, adopted, positive }];positive = 本条「判为要拦 / 要标」(只加严类的误报率用)
export function computeMetrics(rows){
	const list = Array.isArray(rows) ? rows.filter((r)=>r && r.truth !== undefined) : [];
	const n = list.length;
	const classes = Array.from(new Set(list.map((r)=>keyOf(r.truth))));
	const recall = classes.map((c)=>{
		const mine = list.filter((r)=>keyOf(r.truth) === c);
		return mine.length ? mine.filter((r)=>keyOf(r.pred) === c).length / mine.length : 0;
	});
	const balancedAccuracy = recall.length ? recall.reduce((s, x)=>s + x, 0) / recall.length : 0;
	const accuracy = n ? list.filter((r)=>keyOf(r.pred) === keyOf(r.truth)).length / n : 0;
	// Cohen's κ
	let expected = 0;
	classes.forEach((c)=>{
		const pt = list.filter((r)=>keyOf(r.truth) === c).length / (n || 1);
		const pp = list.filter((r)=>keyOf(r.pred) === c).length / (n || 1);
		expected += pt * pp;
	});
	const kappa = expected >= 1 ? 1 : (accuracy - expected) / (1 - expected);
	const adopted = list.filter((r)=>r.adopted);
	const coverage = n ? adopted.length / n : 0;
	const adoptedErrorRate = adopted.length ? adopted.filter((r)=>keyOf(r.pred) !== keyOf(r.truth)).length / adopted.length : 0;
	const negatives = list.filter((r)=>r.truthPositive === false);
	const falsePositiveRate = negatives.length ? negatives.filter((r)=>r.positive === true).length / negatives.length : 0;
	return { n, classes: classes.length, accuracy, balancedAccuracy, kappa, coverage, adoptedErrorRate, falsePositiveRate };
}

export function passRule(kind, metrics){
	const rule = PASS_RULES[kind];
	if(!rule){ return { passed: false, reason: 'shadow' }; }
	if(!metrics || metrics.n < CALIBRATION_MIN_ITEMS){ return { passed: false, reason: `样本不足(${metrics ? metrics.n : 0} < ${CALIBRATION_MIN_ITEMS})` }; }
	if(rule.balancedAccuracyMin !== undefined && metrics.balancedAccuracy < rule.balancedAccuracyMin){ return { passed: false, reason: `平衡准确率 ${metrics.balancedAccuracy.toFixed(3)} < ${rule.balancedAccuracyMin}` }; }
	if(rule.adoptedErrorMax !== undefined && metrics.adoptedErrorRate > rule.adoptedErrorMax){ return { passed: false, reason: `自动采纳错误率 ${metrics.adoptedErrorRate.toFixed(3)} > ${rule.adoptedErrorMax}` }; }
	if(rule.falsePositiveMax !== undefined && metrics.falsePositiveRate > rule.falsePositiveMax){ return { passed: false, reason: `误报率 ${metrics.falsePositiveRate.toFixed(3)} > ${rule.falsePositiveMax}` }; }
	if(rule.topHitMin !== undefined && metrics.accuracy < rule.topHitMin){ return { passed: false, reason: `命中率 ${metrics.accuracy.toFixed(3)} < ${rule.topHitMin}` }; }
	return { passed: true, reason: '' };
}

// 对一个点的金标集算成绩(纯函数:answers 已由调用方拿到);item = { inputs, truth, truthPositive? }
export function evaluatePoint(point, items, answersList){
	const thresholds = { ...DEFAULT_TIER_THRESHOLDS, ...(point.defaultThresholds || {}), ...readThresholds(point.id) };
	const rows = [];
	let failed = 0;
	(items || []).forEach((item, i)=>{
		const res = answersList[i];
		if(!res || !res.ok){ failed += 1; return; }
		let out = null;
		try{ out = point.interpret(res.answers, thresholds, item.inputs) || null; }catch(e){ out = null; }
		if(!out){ failed += 1; return; }
		const tier = out.adopt === false ? 'escalate' : tierOf(out.confidence, thresholds);
		const positive = typeof point.isPositive === 'function' ? !!point.isPositive(out.value) : undefined;
		const truthPositive = typeof point.isPositive === 'function' ? !!point.isPositive(item.truth) : undefined;
		rows.push({ pred: out.value, truth: item.truth, adopted: tier === TIER_ACT, positive, truthPositive, agree: sameValue(out.value, item.truth) });
	});
	const metrics = computeMetrics(rows);
	metrics.failed = failed;
	const verdict = passRule(point.kind, metrics);
	return { metrics, passed: verdict.passed, reason: verdict.reason };
}

// 一键校准:pointIds 缺省 = 全部非影子点;progress(pointId, done, total);回整份记录。任何失败只落成该点未过,不抛。
export async function runCalibration({ pointIds, progress, signal } = {}){
	const ids = Array.isArray(pointIds) && pointIds.length ? pointIds : listPoints().map((p)=>p.id);
	const prev = readCalibration();
	const points = prev && prev.points ? { ...prev.points } : {};
	let model = prev ? prev.model : '';
	for(let k = 0; k < ids.length; k += 1){
		const point = getPoint(ids[k]);
		if(typeof progress === 'function'){ try{ progress(ids[k], k, ids.length); }catch(e){ /* noop */ } }
		if(!point){ continue; }
		const items = GOLDEN_SETS[point.goldenId] || [];
		if(!items.length){ points[point.id] = { passed: false, metrics: { n: 0 }, reason: '没有金标集' }; continue; }
		if(signal && signal.aborted){ points[point.id] = { passed: false, metrics: { n: 0 }, reason: '已中止' }; continue; }
		const batch = items.map((it)=>({ state: point.buildState(it.inputs), questions: point.buildQuestions(it.inputs) }));
		const res = await callSystemOneBatch(batch, { mode: 'background', signal });
		if(res.model){ model = res.model; }
		const ev = evaluatePoint(point, items, res.results || []);
		points[point.id] = { passed: ev.passed, metrics: ev.metrics, reason: ev.reason };
	}
	const record = writeCalibration({ model, at: new Date().toISOString(), points, drift: '' });
	clearDrift();
	if(typeof progress === 'function'){ try{ progress('', ids.length, ids.length); }catch(e){ /* noop */ } }
	return record;
}
