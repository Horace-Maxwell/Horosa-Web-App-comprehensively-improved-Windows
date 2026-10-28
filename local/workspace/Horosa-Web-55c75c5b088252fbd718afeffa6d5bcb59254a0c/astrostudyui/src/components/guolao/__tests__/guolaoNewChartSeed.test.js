// 七政:每张新开 / 未存的盘都按本机仓补空(不只本实例首开一次);自定命宫(地支)不播;
// 坚七政样式切到别的样式时补一次;恒星岁差空档如实显示「随本机（档名）」。
import fs from 'fs';
import path from 'path';
import { readSource } from '../../../utils/__tests__/helpers/sourceSet';   // 拆成子模块的大文件按「门面 + 子模块」全集读

beforeEach(()=>{ window.localStorage.clear(); });

function setup(){
	require('../../../models/astro');   // 注册 schema 初值工厂(判「仍是初值」要用)
	const { fieldsSchemaBaseline } = require('../../../utils/recordFieldsRestore');
	const base = fieldsSchemaBaseline();
	return (over)=>({ ...base, ...(over || {}) });
}

describe('七政 · 新盘补空', ()=>{
	it('本次运行里后来新开的盘也补(补空在每次 fields 变化时判,幂等)', ()=>{
		const mk = setup();
		const GuoLaoChartMain = require('../GuoLaoChartMain').default;
		const { setStoredGuolaoNodeType } = require('../GuoLaoChartStyle');
		setStoredGuolaoNodeType('true');
		const calls = [];
		const fake = { props: { fields: mk(), dispatch: ()=>{}, techniqueScope: 'guolao' }, onFieldsChange: (p)=>calls.push(p) };
		const ensure = GuoLaoChartMain.prototype.ensureGuolaoDefaults;
		expect(ensure.call(fake)).toBe(true);                         // 首开那张
		fake.props = { ...fake.props, fields: mk({ guolaoNodeType: { value: 'true', name: ['guolaoNodeType'] } }) };
		expect(ensure.call(fake)).toBe(false);                        // 补过了:幂等,不再派发
		fake.props = { ...fake.props, fields: mk() };                 // 后来新开的一张(回到 schema 初值)
		expect(ensure.call(fake)).toBe(true);
		expect(calls.length).toBe(2);
		expect(calls[1].guolaoNodeType).toEqual({ value: 'true' });
		fake.props = { ...fake.props, fields: mk({ cid: { value: 'rec-9', name: ['cid'] } }) };   // 载入记录:不补
		expect(ensure.call(fake)).toBe(false);
	});
	it('自定命宫(某个地支)不播给新盘;口径类命度法照播', ()=>{
		const mk = setup();
		const { computeGuolaoSeedPatch } = require('../GuoLaoChartMain');
		const { setStoredGuolaoLifeMode, GUOLAO_LIFE_MODE_YUMAO } = require('../GuoLaoChartStyle');
		setStoredGuolaoLifeMode('子');
		expect(computeGuolaoSeedPatch(mk()).guolaoLifeMode).toBeUndefined();
		setStoredGuolaoLifeMode(GUOLAO_LIFE_MODE_YUMAO);
		expect(computeGuolaoSeedPatch(mk()).guolaoLifeMode).toEqual({ value: GUOLAO_LIFE_MODE_YUMAO });
	});
	it('坚七政样式切到别的样式时补一次(fields 没变也补)', ()=>{
		const src = readSource(path.resolve(__dirname, '../GuoLaoChartMain.js'));
		expect(src).toMatch(/prevState\.engineMode === 'kinastro'/);
		expect(src).toMatch(/\(prevProps\.fields !== this\.props\.fields \|\| leftKinastro\) && this\.ensureGuolaoDefaults\(\)/);
		expect(src).not.toMatch(/guolaoDefaultsEnsured/);   // 不许回到「本实例只补一次」
	});
});

describe('七政 · 恒星岁差空档如实显示', ()=>{
	it('盘上空档跟本机 → 「随本机」档;盘上选了 → 那档;本机也空 → 郑式', ()=>{
		const { guolaoAyanamsaSelectValue, GUOLAO_AYAN_FOLLOW_LOCAL } = require('../GuoLaoInput');
		const { setStoredGuolaoAyanamsa } = require('../GuoLaoChartStyle');
		expect(guolaoAyanamsaSelectValue({ guolaoAyanamsa: { value: '' } })).toBe('');
		setStoredGuolaoAyanamsa('lahiri');
		expect(guolaoAyanamsaSelectValue({ guolaoAyanamsa: { value: '' } })).toBe(GUOLAO_AYAN_FOLLOW_LOCAL);
		expect(guolaoAyanamsaSelectValue({ guolaoAyanamsa: { value: 'raman' } })).toBe('raman');
		expect(guolaoAyanamsaSelectValue({ guolaoAyanamsa: { value: '' }, guolaoAyanamsaPageOnly: { value: 1 } })).toBe('');
	});
});
