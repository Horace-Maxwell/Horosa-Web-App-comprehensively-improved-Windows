// [C8e] 内容完备性 gap 棘轮:注册表里 'gap:' 结论的条目集(键.税则)只减不增。
// coverage 锁只保「每键有结论、gap 带说明」,不逼存量——注册表可以在「全绿」下长期吐假文;本锁把
// 「新增一条 gap」变成必须改基线的显式决策,并把存量 gap 数打进测试输出。
import { AI_EXPORT_CONTENT_AUDIT, AI_EXPORT_CONTENT_GAP_BASELINE } from '../aiExportContentAudit';

const RULE_KEYS = ['t1', 't2', 't3', 't5'];

function currentGapEntries(){
	const out = [];
	Object.keys(AI_EXPORT_CONTENT_AUDIT).forEach((k)=>{
		RULE_KEYS.forEach((r)=>{
			const v = `${AI_EXPORT_CONTENT_AUDIT[k][r] || ''}`;
			if(v.startsWith('gap:')){ out.push(`${k}.${r}`); }
		});
	});
	return out.sort();
}

describe('[C8e] 内容完备性 gap 棘轮(只减不增)', ()=>{
	const current = currentGapEntries();
	const baseline = Array.from(new Set(AI_EXPORT_CONTENT_GAP_BASELINE)).sort();

	test('基线条目形态合法(键.税则)且键在注册表', ()=>{
		const bad = baseline.filter((e)=>!/^[a-zA-Z0-9_]+\.t[1235]$/.test(e) || !AI_EXPORT_CONTENT_AUDIT[e.split('.')[0]]);
		expect(bad).toEqual([]);
		expect(baseline.length).toBeGreaterThan(0);
	});

	test('🔴 当前 gap ⊆ 基线(新增 gap 必须显式登记进 AI_EXPORT_CONTENT_GAP_BASELINE)', ()=>{
		const set = new Set(baseline);
		const added = current.filter((e)=>!set.has(e));
		expect(added).toEqual([]);
	});

	test('存量 gap 计数(只减不增;修掉的条目从基线自然收缩)', ()=>{
		const fixed = baseline.filter((e)=>current.indexOf(e) < 0);
		// eslint-disable-next-line no-console
		console.info(`[C8e] 存量 gap ${current.length} 条 / 基线 ${baseline.length} 条 / 已修未清基线 ${fixed.length} 条`);
		expect(current.length).toBeLessThanOrEqual(baseline.length);
	});

	test('注错自证:混入一条不在基线的 gap 必被点名', ()=>{
		const set = new Set(baseline);
		const probe = current.concat(['__probe__.t1']);
		expect(probe.filter((e)=>!set.has(e))).toEqual(['__probe__.t1']);
	});
});
