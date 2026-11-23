// 主限法相位集可经挂载齿轮指定(页面起盘表单同九档);缺省恒发托勒密五相(与此前逐字节同)。
import { recordPdAspects, buildFieldObject } from '../aiAnalysisContext/recordFields';
import { DEFAULT_PD_ASPECTS } from '../aiAnalysisContext/catalog';
import { getTechniqueSettingsSchema, PD_ASPECT_CHOICES } from '../techniqueMountSettings';

describe('主限法相位集', ()=>{
	test('缺省 / 空 / 全是坏值 → 托勒密五相', ()=>{
		expect(recordPdAspects({})).toEqual(DEFAULT_PD_ASPECTS);
		expect(recordPdAspects({ pdaspects: [] })).toEqual(DEFAULT_PD_ASPECTS);
		expect(recordPdAspects({ pdaspects: [7, 'x'] })).toEqual(DEFAULT_PD_ASPECTS);
		expect(recordPdAspects(null)).toEqual(DEFAULT_PD_ASPECTS);
	});
	test('合法档去重升序;字符串数字照收', ()=>{
		expect(recordPdAspects({ pdaspects: [180, '45', 0, 45, 999] })).toEqual([0, 45, 180]);
	});
	test('字段对象读记录值', ()=>{
		expect(buildFieldObject({ birth: '1990-01-01 08:00:00', pdaspects: [0, 30] }).pdaspects.value).toEqual([0, 30]);
	});
	test('主限法表齿轮有这一项,档位与页面同九档,缺省 = 托勒密五相', ()=>{
		const f = getTechniqueSettingsSchema('primarydirect').fields.find((x)=>x.name === 'pdaspects');
		expect(f.type).toBe('multiselect');
		expect(f.default).toEqual(DEFAULT_PD_ASPECTS);
		expect(f.options.map((o)=>o.value)).toEqual(PD_ASPECT_CHOICES);
		expect(PD_ASPECT_CHOICES).toEqual([0, 30, 45, 60, 90, 120, 135, 150, 180]);
	});
});
