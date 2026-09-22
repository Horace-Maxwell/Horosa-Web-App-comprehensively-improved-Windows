// [Q-107 A 裁决 2026-09-18] 三式合一·太乙区补「时间基准」(与独立太乙页同源;缺省 direct=此前钉死值)。
import fs from 'fs';
import path from 'path';
import { getTechniqueSettingsSchema } from '../techniqueMountSettings';
import { TIME_BASIS_OPTIONS } from '../../components/taiyi/TaiYiCalc';

describe('Q-107 A 三式太乙时间基准', ()=>{
	it('齿轮:sanshiunited 含 taiyiTimeBasis(select,缺省 direct,选项=太乙页同源 direct/trueSolar)', ()=>{
		const fields = (getTechniqueSettingsSchema('sanshiunited') || {}).fields || [];
		const f = fields.find((x)=>x.name === 'taiyiTimeBasis');
		expect(f).toBeTruthy();
		expect(f.type).toBe('select');
		expect(f.default).toBe('direct');
		expect((f.options || []).map((o)=>o.value)).toEqual(TIME_BASIS_OPTIONS.map((o)=>o.value));
		expect(fields.some((x)=>x.name === 'timeBasis')).toBe(false);   // 三式子组只用改名后的键
	});
	it('源码哨兵:页面控件 / 请求透传 / 存案还原 / 挂载重算映射 四处齐', ()=>{
		const main = fs.readFileSync(path.join(__dirname, '../../components/sanshi/SanShiUnitedMain.js'), 'utf8');
		expect(main).toMatch(/onOptionChange\('taiyiTimeBasis', v\)/);
		expect(main).toMatch(/timeBasis: options && options\.taiyiTimeBasis === 'trueSolar' \? 'trueSolar' : 'direct'/);
		expect(main).toMatch(/options\.taiyiTimeBasis = payload\.options\.taiyiTimeBasis/);
		expect(main).toMatch(/'gameTheory', 'taiyiTimeBasis'/);
		const ctx = fs.readFileSync(path.join(__dirname, '../aiAnalysisContext.js'), 'utf8');
		expect(ctx).toMatch(/po\.taiyiTimeBasis !== undefined\)\{ options\.timeBasis = po\.taiyiTimeBasis; \}/);
	});
});
