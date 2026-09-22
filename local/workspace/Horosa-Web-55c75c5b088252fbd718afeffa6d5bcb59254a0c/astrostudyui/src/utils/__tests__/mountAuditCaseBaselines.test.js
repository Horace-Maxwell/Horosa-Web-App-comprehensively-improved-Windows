// [挂载自检 辅盘 P1·病形①] 卜卦/择日盘 B 类基线锚读存档层(payload.extra.* + 顶层类别键):
// 存了非默认流派/类别的案例,抽屉显示现状、「拨回 schema 默认」是真覆盖(值可表达)。
// 判别向量:去掉 schema 的 baselineSource 即两例「存非默认→拨回默认」红(prune 剪空)。
import { flattenHoraryStored, flattenElectionStored, effectiveMountBaseline, pruneOptionsToNonDefault, mergeOptionsIntoPayload } from '../techniqueMountSettings';

const rec = (payload)=>({ cid: 'c', caseType: 'horary', divTime: '2026-05-15 10:12:00', zone: '+08:00', payload: JSON.stringify(payload) });

it('展平:顶层 questionCategory + extra.horarySchool + extra.horaryOverrides.* → topicId/horarySchool/hp_*', ()=>{
	const out = flattenHoraryStored({ questionCategory: 'marriage', extra: { horarySchool: 'modern', horaryOverrides: { parentHousesVariant: 'modern', includeOuter: 1 } } });
	expect(out).toEqual({ topicId: 'marriage', horarySchool: 'modern', hp_parentHousesVariant: 'modern', hp_includeOuter: 1 });
	const el = flattenElectionStored({ topicId: 'trade', extra: { westSchool: 'hellenistic', tradeSide: 'buy', surgeryPartOpposite: true, electionParams: { lotsReversal: 'never', unused: '' } } });
	expect(el).toEqual({ topicId: 'trade', westSchool: 'hellenistic', tradeSide: 'buy', surgeryPartOpposite: 1, ep_lotsReversal: 'never' });
});

it('🔴 卜卦:存档 modern/marriage,拨回 classical/general(=schema 默认)是真覆盖;拨回存档值不是覆盖', ()=>{
	const r = rec({ questionCategory: 'marriage', extra: { horarySchool: 'modern' } });
	const baseline = effectiveMountBaseline('horary', r);
	expect(baseline.horarySchool).toBe('modern');
	expect(baseline.topicId).toBe('marriage');
	expect(pruneOptionsToNonDefault('horary', { horarySchool: 'classical', topicId: 'general' }, baseline)).toEqual({ horarySchool: 'classical', topicId: 'general' });
	expect(pruneOptionsToNonDefault('horary', { horarySchool: 'modern', topicId: 'marriage' }, baseline)).toEqual({});
	// merge 也按同一锚:拨回默认要落到 payload 顶层(重算读顶层优先)
	const merged = mergeOptionsIntoPayload(JSON.parse(r.payload), 'horary', { horarySchool: 'classical' });
	expect(merged.horarySchool).toBe('classical');
	expect(merged.extra.horarySchool).toBe('modern');
});

it('🔴 择日:存档 hellenistic + ep_lotsReversal=never,拨回 modern_main/随流派 是真覆盖', ()=>{
	const r = { ...rec({ topicId: 'trade', extra: { westSchool: 'hellenistic', electionParams: { lotsReversal: 'never' } } }), caseType: 'election' };
	const baseline = effectiveMountBaseline('election', r);
	expect(baseline.westSchool).toBe('hellenistic');
	expect(baseline.ep_lotsReversal).toBe('never');
	expect(pruneOptionsToNonDefault('election', { westSchool: 'modern_main', ep_lotsReversal: '' }, baseline)).toEqual({ westSchool: 'modern_main', ep_lotsReversal: '' });
	expect(pruneOptionsToNonDefault('election', { westSchool: 'hellenistic', ep_lotsReversal: 'never' }, baseline)).toEqual({});
});

it('无存档层 → 基线回落 schema 默认(旧档零回归)', ()=>{
	const baseline = effectiveMountBaseline('horary', rec({}));
	expect(baseline.horarySchool).toBe('classical');
	expect(baseline.topicId).toBe('general');
});

// [挂载自检 F-22/F-23] 六爻神煞四键展平;kentang 四技法 payload.options 打底。
import { flattenLiuyaoStored, flattenOptionsStored } from '../techniqueMountSettings';

it('🔴 六爻:存档 gua.liuyaoSettings.shensha{on:false,base:year,set}/shenshaEx{on:true} → 基线扁平四键;拨开神煞=真覆盖', ()=>{
	const payload = { gua: { liuyaoSettings: { guirenFa: 'geng_ma_hu', shensha: { on: false, base: 'year', set: ['天乙贵人'] }, shenshaEx: { on: true, set: null } } } };
	const flat = flattenLiuyaoStored(payload);
	expect(flat).toEqual(expect.objectContaining({ guirenFa: 'geng_ma_hu', shenshaOn: false, shenshaBase: 'year', shenshaSet: ['天乙贵人'], shenshaExOn: true }));
	const r = { cid: 'c', caseType: 'sixyao', divTime: '2026-05-15 10:12:00', zone: '+08:00', payload: JSON.stringify(payload) };
	const baseline = effectiveMountBaseline('sixyao', r);
	expect(baseline.shenshaOn).toBe(false);
	expect(baseline.shenshaBase).toBe('year');
	expect(pruneOptionsToNonDefault('sixyao', { shenshaOn: true, shenshaBase: 'day' }, baseline)).toEqual({ shenshaOn: true, shenshaBase: 'day' });
	expect(pruneOptionsToNonDefault('sixyao', { shenshaOn: false, shenshaBase: 'year', shenshaExOn: true }, baseline)).toEqual({});
	expect(flattenLiuyaoStored({})).toBeNull();
});

it('🔴 五兆/太玄/荆诀/神易数:存档 payload.options.* 打底、顶层扁平键覆盖;拨回 schema 默认=真覆盖', ()=>{
	expect(flattenOptionsStored({ module: 'wuzhao', options: { mode: 'zhushu', number: 7 }, snapshot: 'x', pan: {}, shifaVariant: 'gua' }))
		.toEqual({ mode: 'zhushu', number: 7, shifaVariant: 'gua' });
	const r = { cid: 'c', caseType: 'wuzhao', divTime: '2026-05-15 10:12:00', zone: '+08:00', payload: JSON.stringify({ options: { mode: 'zhushu' } }) };
	const baseline = effectiveMountBaseline('wuzhao', r);
	expect(baseline.mode).toBe('zhushu');
	expect(pruneOptionsToNonDefault('wuzhao', { mode: 'ganzhi' }, baseline)).toEqual({ mode: 'ganzhi' });
	expect(pruneOptionsToNonDefault('wuzhao', { mode: 'zhushu' }, baseline)).toEqual({});
	['taixuan', 'jingjue', 'shenyishu'].forEach((k)=>{
		const rr = { ...r, caseType: k, payload: JSON.stringify({ options: { seed: 12345 } }) };
		expect(effectiveMountBaseline(k, rr).seed === undefined || `${effectiveMountBaseline(k, rr).seed}` === '12345').toBe(true);
	});
});
