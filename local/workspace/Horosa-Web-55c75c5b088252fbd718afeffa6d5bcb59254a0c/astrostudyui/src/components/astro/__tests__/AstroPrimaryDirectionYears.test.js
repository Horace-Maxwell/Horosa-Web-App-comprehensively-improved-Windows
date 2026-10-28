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
