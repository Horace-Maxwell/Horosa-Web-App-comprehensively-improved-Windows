// cast_fengshui:与风水页理气工作台同一份计算 / 正文;参数按键合并、未用到的键回报、参数不全给提示。
import castFengshui, { FENGSHUI_SCHOOLS, LIQI_SCHOOL_KEYS, mergeLiqiState } from '../aiTools/tools/castFengshui';
import { LIQI_SCHOOLS } from '../../components/fengshui/FengShuiMain';
import { computeLiqi, liqiDefaultState, buildSnapshot } from '../../components/fengshui/LiqiWorkspace';
import { implOf } from '../../components/fengshui/liqi/registry';

describe('cast_fengshui', ()=>{
	test('流派枚举与风水页一致,未登记的派都有键表', ()=>{
		expect(FENGSHUI_SCHOOLS).toEqual(LIQI_SCHOOLS);
		LIQI_SCHOOLS.forEach((s)=>{ expect(!!implOf(s) || Array.isArray(LIQI_SCHOOL_KEYS[s])).toBe(true); });
	});
	test('嵌套参数按键合并,未知键回报', ()=>{
		const { state, unknown } = mergeLiqiState(liqiDefaultState(), { xkDeep: { school: 'zhong' }, nope: 1 });
		expect(state.xkDeep.school).toBe('zhong');
		expect(state.xkDeep.jianBoundary).toBe(3);
		expect(unknown).toEqual(['nope']);
	});
	test('玄空与页面同一份正文', async ()=>{
		const res = await castFengshui.run({ school: 'xuankong', params: { yun: 8, xiangShan: '子', year: 2020 } });
		const r = computeLiqi('xuankong', { ...liqiDefaultState(), yun: 8, xiangShan: '子', year: 2020 }, { geo: null });
		expect(res.ok).toBe(true);
		expect(res.data.content).toBe(buildSnapshot('xuankong', r));
		expect(res.data.content).not.toMatch(/逐宫：$/m);
	});
	test('别派的键记为未用到', async ()=>{
		const res = await castFengshui.run({ school: 'jingyin', params: { yun: 8 } });
		expect(res.ok).toBe(true);
		expect(res.data.ignoredParams).toEqual(['yun']);
	});
	test('命理派缺命主年 → 参数不全提示;补上即起局', async ()=>{
		const bad = await castFengshui.run({ school: 'mingli' });
		expect(bad.ok).toBe(false);
		expect(bad.code).toBe('E_ARGS_INVALID');
		const ok = await castFengshui.run({ school: 'mingli', params: { ml: { mingYear: 1990 } } });
		expect(ok.ok).toBe(true);
		expect(ok.data.content).toMatch(/命主 1990年/);
	});
	test('登记派参数直接给;showDefaults 只列该派的键', async ()=>{
		const d = await castFengshui.run({ school: 'zibai', showDefaults: true });
		expect(Object.keys(d.data.defaults).sort()).toEqual(['month', 'year', 'zbDate']);
		const reg = await castFengshui.run({ school: 'daxuankong' });
		expect(reg.ok).toBe(true);
		expect(reg.data.content).toMatch(/大玄空/);
	});
	test('18 派缺省参数都不抛错', async ()=>{
		for(const s of FENGSHUI_SCHOOLS){
			const res = await castFengshui.run({ school: s });
			expect(res.ok || res.code === 'E_ARGS_INVALID').toBe(true);
		}
	});
});
