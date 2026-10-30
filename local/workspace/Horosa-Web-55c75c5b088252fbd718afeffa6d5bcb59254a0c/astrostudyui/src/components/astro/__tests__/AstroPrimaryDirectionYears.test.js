// 主限法推算年数上限 3000:组件 clamp 与挂载设置元数据同步(防回归:任何一处回落 360 都会让另一处的 3000 选择被截断)。
jest.mock('../../xq-ui', ()=>({
	XQButton: ()=>null,
	XQInput: ()=>null,
	XQInputNumber: ()=>null,
	XQSelect: Object.assign(()=>null, { Option: ()=>null }),
	XQTable: ()=>null,
}));
jest.mock('../../xq-icons', ()=>()=>null);
jest.mock('../../../utils/request', ()=>jest.fn());
jest.mock('../../../utils/moduleAiSnapshot', ()=>({ saveModuleAISnapshot: jest.fn() }));
jest.mock('../../../utils/planetHouseInfo', ()=>({ appendPlanetHouseInfoById: (t)=>t, splitPlanetHouseInfoText: (t)=>({ label: t, info: null }) }));

import AstroPrimaryDirection from '../AstroPrimaryDirection';
import { getTechniqueSettingsSchema } from '../../../utils/techniqueMountSettings';
const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

describe('pdYears 3000 上限全链一致', ()=>{
	test('normalizePdYears 接受 3000、夹断 5000、保底 1/100', ()=>{
		const inst = new AstroPrimaryDirection({});
		expect(inst.normalizePdYears(3000)).toBe(3000);
		expect(inst.normalizePdYears(5000)).toBe(3000);
		expect(inst.normalizePdYears(360)).toBe(360);
		expect(inst.normalizePdYears(0)).toBe(1);
		expect(inst.normalizePdYears('abc')).toBe(100);
	});

	test('挂载设置 pdYears 字段 max 同步为 3000', ()=>{
		const schema = getTechniqueSettingsSchema('primarydirect');
		const fields = (schema && schema.fields) || [];
		const pdYearsField = fields.find((f)=>f && f.name === 'pdYears');
		expect(pdYearsField).toBeTruthy();
		expect(pdYearsField.max).toBe(3000);
	});
});

describe('pdYears 3000 clamp 全前端路径一致(防回落)', ()=>{
	test('三个 normalize 源码上限均为 3000(AstroPrimaryDirection/AstroDirectMain/aiAnalysisContext)', ()=>{
		const fs = require('fs');
		const path = require('path');
		const files = [
			'../../astro/AstroPrimaryDirection.js',
			'../../direction/AstroDirectMain.js',
			'../../../utils/aiAnalysisContext.js',
		].map((rel)=>path.resolve(__dirname, rel));
		files.forEach((f)=>{
			const src = readSource(f);
			expect(src).toMatch(/Math\.min\(3000,\s*n\)/);
			expect(src).not.toMatch(/Math\.min\(360,\s*n\)/);
		});
	});
});

describe('宿命点(Vertex)进 促发/应星 列筛选(v12 应星收尾)', ()=>{
	test('筛选候选 objs 含 Vertex,genStarColFilter 产出该选项且 onFilter 命中 N_Vertex_0 行', ()=>{
		const AstroConst = require('../../../constants/AstroConst');
		const inst = new (require('../AstroPrimaryDirection').default)({});
		inst.planetText = (id)=>id; // 测试环境绕过 JSX 渲染,只验筛选语义
		expect(inst.objs).toContain(AstroConst.VERTEX);
		const col = inst.genStarColFilter('Significator', new Set([AstroConst.VERTEX]));
		expect(col.filters.some((f)=>f.value === AstroConst.VERTEX)).toBe(true);
		expect(col.onFilter(AstroConst.VERTEX, { Significator: 'N_Vertex_0' })).toBe(true);
		expect(col.onFilter(AstroConst.VERTEX, { Significator: 'N_Sun_0' })).toBe(false);
	});
});

describe('扩展面板:回调可脱离实例调用 + 应星 / 迫星扩展随 props 回填', ()=>{
	const syncState = (inst)=>{
		inst.setState = (o)=>{ inst.state = { ...inst.state, ...(typeof o === 'function' ? o(inst.state) : o) }; };
		return inst;
	};

	test('勾选回调以方法引用传出也不丢 this(此前一勾选应星 / 迫星即 TypeError)', ()=>{
		const inst = syncState(new AstroPrimaryDirection({}));
		const { handlePdSignificatorsChange, handlePdPromissorTypesChange, handlePdExtraSettingChange } = inst;
		handlePdSignificatorsChange(['Desc']);
		handlePdPromissorTypesChange(['cusps']);
		handlePdExtraSettingChange('pdGeometry', 'classic');
		expect(inst.state.pdSignificatorsValue).toEqual(['Desc']);
		expect(inst.state.pdPromissorTypesValue).toEqual(['cusps']);
		expect(inst.state.pdExtraValue.pdGeometry).toBe('classic');
	});

	test('别处(3D 天球)改了应星 / 迫星扩展与自定义钥匙率 → 表格本地状态跟着回填', ()=>{
		const prevProps = { pdSignificators: ['Desc'], pdPromissorTypes: ['cusps'], pdTimeKeyCustom: 0 };
		const inst = syncState(new AstroPrimaryDirection(prevProps));
		expect(inst.state.pdPromissorTypesValue).toEqual(['cusps']);
		inst.props = { pdSignificators: [], pdPromissorTypes: [], pdTimeKeyCustom: 1.2 };
		inst.componentDidUpdate(prevProps);
		expect(inst.state.pdSignificatorsValue).toEqual([]);
		expect(inst.state.pdPromissorTypesValue).toEqual([]);
		expect(inst.state.pdTimeKeyCustomValue).toBe(1.2);
	});

	test('props 未变时保留本地未提交的勾选', ()=>{
		const props = { pdPromissorTypes: ['cusps'] };
		const inst = syncState(new AstroPrimaryDirection(props));
		inst.handlePdPromissorTypesChange(['cusps', 'stars']);
		inst.props = { pdPromissorTypes: ['cusps'] };
		inst.componentDidUpdate(props);
		expect(inst.state.pdPromissorTypesValue).toEqual(['cusps', 'stars']);
	});
});

describe('悬停透镜 / 极点列的请求跟着全套设置走', ()=>{
	const chart = { params: {
		birth: '1990-01-01 12:00:00', zone: '+08:00', lat: '39n54', lon: '116e23', hsys: 0,
		pdMethod: 'core_alchabitius', pdTimeKey: 'Ptolemy', pdtype: 1, pdProjection: 'regiomontanus', pdFrame: 'alcabitius',
		pdSignificators: ['Desc'], pdPromissorTypes: ['stars'], pdIgnoreSigLat: 1,
	} };

	test('宿主给了构参函数 → 透镜请求就是它的输出(与主限天球同一个)', ()=>{
		const built = { date: '1990/01/01', time: '12:00:00', pdPromissorTypes: ['stars'] };
		const buildRequest = jest.fn(()=>({ ...built }));
		const inst = new AstroPrimaryDirection({ value: chart, buildRequest });
		expect(inst.lensRequest()).toEqual(built);
		expect(buildRequest).toHaveBeenCalledWith(chart);
		inst.lensSignature(); inst.lensSignature();
		expect(buildRequest).toHaveBeenCalledTimes(1);   // 同一份 props 只构一次
		inst.props = { value: chart, buildRequest: ()=>({ ...built, pdPromissorTypes: [] }) };
		expect(inst.lensSignature()).not.toBe(JSON.stringify(built));
	});

	test('独立挂载时自拼的请求带上应星 / 迫星扩展、投影与取点设置', ()=>{
		const req = new AstroPrimaryDirection({ value: chart }).lensRequest();
		expect(req).toMatchObject({
			pdtype: 1, pdProjection: 'regiomontanus', pdFrame: 'alcabitius',
			pdSignificators: ['Desc'], pdPromissorTypes: ['stars'], pdIgnoreSigLat: 1,
		});
	});

	test('极点列请求带非缺省的取点设置(改了忽略应星黄纬 → 键变 → 重取)', ()=>{
		const on = new AstroPrimaryDirection({ value: chart }).pdPolesRequestBody();
		expect(on.pdIgnoreSigLat).toBe(1);
		const off = new AstroPrimaryDirection({ value: { params: { ...chart.params, pdIgnoreSigLat: 0 } } }).pdPolesRequestBody();
		expect(off.pdIgnoreSigLat).toBeUndefined();
	});
});

describe('流派预设第九维:相位点黄纬随档写入扩展设置', ()=>{
	test('选 Gouchon → 相位点黄纬 = 合冲带黄纬且反查命中;改选星阙 → 回缺省;其他扩展项不动', ()=>{
		const inst = new AstroPrimaryDirection({ pdExtra: { pdAspectSide: 2 } });
		inst.setState = (u)=>{ inst.state = { ...inst.state, ...(typeof u === 'function' ? u(inst.state) : u) }; };
		inst.handlePdPresetChange('gouchon');
		expect(inst.state.pdExtraValue.pdPromAspectLat).toBe(1);
		expect(inst.state.pdExtraValue.pdAspectSide).toBe(2);
		expect(inst.state.pdTimeKeyValue).toBe('TrueSolarArc');
		expect(inst.getSelectedPdPreset()).toBe('gouchon');
		inst.handlePdPresetChange('horosa');
		expect(inst.state.pdExtraValue.pdPromAspectLat).toBe(0);
		expect(inst.state.pdExtraValue.pdAspectSide).toBe(2);
		expect(inst.getSelectedPdPreset()).toBe('horosa');
		inst.setState((st)=>({ pdExtraValue: { ...st.pdExtraValue, pdPromAspectLat: 3 } }));
		expect(inst.getSelectedPdPreset()).toBe('custom');
	});
});
