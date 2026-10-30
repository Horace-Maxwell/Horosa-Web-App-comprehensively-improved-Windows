// 主限法 AI 快照 / 导出的「应星扩展 / 迫星扩展」行写面板上的名字(曾写 Desc / stars 等内部键);
// 挂载设置的两组选项与页面扩展面板同一份。
import { buildPrimaryDirectSnapshotText } from '../../components/direction/AstroDirectMain';
import { PD_SIGNIFICATOR_OPTIONS, PD_PROMISSOR_TYPE_OPTIONS, pdExtensionLabels } from '../primaryDirectionSync';
import { getTechniqueSettingsSchema } from '../techniqueMountSettings';

const CHART = {
	params: {
		birth: '1990-05-18 12:00:00', zone: '+08:00', lat: '31N14', lon: '121E28',
		pdMethod: 'core_alchabitius', pdTimeKey: 'Ptolemy', pdtype: 0,
		pdSignificators: ['Desc', 'Stars'], pdPromissorTypes: ['stars', 'cusps'],
	},
	predictives: { primaryDirection: [] },
};

describe('主限法扩展行与挂载选项', ()=>{
	test('快照设置段写面板名字,不写内部键', ()=>{
		const txt = buildPrimaryDirectSnapshotText(CHART);
		expect(txt).toContain('应星扩展：下降 DSC、恒星（王星+比尼）');
		expect(txt).toContain('迫星扩展：恒星、宫始点');
		expect(txt).not.toMatch(/扩展：.*\b(Desc|Stars|stars|cusps)\b/);
	});

	test('未登记的值原样保留(不吞)', ()=>{
		expect(pdExtensionLabels(['Desc', 'Future'], PD_SIGNIFICATOR_OPTIONS)).toEqual(['下降 DSC', 'Future']);
		expect(pdExtensionLabels(undefined, PD_PROMISSOR_TYPE_OPTIONS)).toEqual([]);
	});

	test('挂载设置两组选项与扩展面板同一份', ()=>{
		const fields = getTechniqueSettingsSchema('primarydirect').fields;
		expect(fields.find((f)=>f.name === 'pdSignificators').options).toBe(PD_SIGNIFICATOR_OPTIONS);
		expect(fields.find((f)=>f.name === 'pdPromissorTypes').options).toBe(PD_PROMISSOR_TYPE_OPTIONS);
	});
});
