// 几何口径(改进 / 经典)不单设控件:「弧算法」下拉里受影响的方法各列「（改进）」「（经典）」两项。
// 哪些组合受影响 = PD_GEOMETRY_APPLIES,与 Python pd_geometry.APPLIES 同表(后者有引擎实测测试)。
import fs from 'fs';
import path from 'path';
import {
	PD_GEOMETRY_APPLIES, pdGeometryApplies, pdProjectionChoiceOptions, pdProjectionChoiceValue,
	parsePdProjectionChoice, pdProjectionLabelWithGeometry, PD_EXTRA_SETTING_SPECS,
} from '../primaryDirectionSync';
import { buildPrimaryDirectSnapshotText } from '../../components/direction/AstroDirectMain';
import { getTechniqueSettingsSchema } from '../techniqueMountSettings';
import AstroPrimaryDirection from '../../components/astro/AstroPrimaryDirection';

jest.mock('../request', ()=>jest.fn());

const PY = path.join(__dirname, '..', '..', '..', '..', 'astropy', 'astrostudy', 'pd_geometry.py');

describe('几何口径并入弧算法下拉', ()=>{
	test('受影响组合表与 Python pd_geometry.APPLIES 逐项相同', ()=>{
		const src = fs.readFileSync(PY, 'utf8');
		const block = src.slice(src.indexOf('APPLIES = ('), src.indexOf('def applies'));
		const py = [];
		const re = /\((\d), '([\w]+)', '([\w*]+)', (True|False)\)/g;
		let m;
		while((m = re.exec(block)) !== null){ py.push([Number(m[1]), m[2], m[3], m[4] === 'True']); }
		expect(py.length).toBeGreaterThan(10);
		expect(PD_GEOMETRY_APPLIES).toEqual(py);
	});

	test('In Zodiaco:Placidus 列两项,Ptolemy / Morinus 一项', ()=>{
		const opts = pdProjectionChoiceOptions({ pdtype: 0, pdFrame: 'alcabitius', pdParallel: 0 });
		const labels = opts.map((o)=>o.label);
		expect(labels).toContain('Placidus（半弧严密）（改进）');
		expect(labels).toContain('Placidus（半弧严密）（经典）');
		expect(opts.filter((o)=>o.value.indexOf('ptolemy') === 0)).toEqual([{ value: 'ptolemy', label: 'Ptolemy（半弧）' }]);
		expect(opts.filter((o)=>o.value.indexOf('morinus') === 0).length).toBe(1);
	});

	test('In Mundo:Ptolemy 是否列两项随宫制与平行变', ()=>{
		const ptolemy = (ctx)=>pdProjectionChoiceOptions(ctx).filter((o)=>o.value.indexOf('ptolemy') === 0).length;
		expect(ptolemy({ pdtype: 1, pdFrame: 'alcabitius' })).toBe(2);
		expect(ptolemy({ pdtype: 1, pdFrame: 'meridian', pdParallel: 0 })).toBe(1);
		expect(ptolemy({ pdtype: 1, pdFrame: 'meridian', pdParallel: 1 })).toBe(2);
		expect(ptolemy({ pdtype: 1, pdFrame: 'wholesign', pdParallel: 1 })).toBe(1);
		expect(pdGeometryApplies({ pdtype: 1, pdProjection: 'morinus', pdParallel: 1 })).toBe(true);
		expect(pdGeometryApplies({ pdtype: 1, pdProjection: 'morinus', pdParallel: 0 })).toBe(false);
	});

	test('选中值与解析往返;只列一项的方法口径回缺省', ()=>{
		const ctx = { pdtype: 0, pdProjection: 'regiomontanus', pdFrame: 'alcabitius' };
		expect(pdProjectionChoiceValue(ctx, 'classic')).toBe('regiomontanus|classic');
		expect(parsePdProjectionChoice('regiomontanus|classic')).toEqual({ pdProjection: 'regiomontanus', pdGeometry: 'classic' });
		expect(pdProjectionChoiceValue({ ...ctx, pdProjection: 'morinus' }, 'classic')).toBe('morinus');
		expect(parsePdProjectionChoice('morinus')).toEqual({ pdProjection: 'morinus', pdGeometry: 'improved' });
		// 黄道 Topocentric 两档有别(经典 = 极的东西按字面判定),列两项
		expect(pdProjectionChoiceValue({ ...ctx, pdProjection: 'topocentric' }, 'classic')).toBe('topocentric|classic');
		expect(pdProjectionLabelWithGeometry({ ...ctx }, 'classic')).toBe('Regiomontanus（经典）');
		expect(pdProjectionLabelWithGeometry({ ...ctx, pdProjection: 'ptolemy' }, 'classic')).toBe('Ptolemy（半弧）');
	});

	test('表格下拉选中即同时写弧算法与口径', ()=>{
		const inst = new AstroPrimaryDirection({});
		inst.setState = (o)=>{ inst.state = { ...inst.state, ...(typeof o === 'function' ? o(inst.state) : o) }; };
		inst.handlePdProjectionChoiceChange('campanus|classic');
		expect(inst.state.pdProjectionValue).toBe('campanus');
		expect(inst.state.pdExtraValue.pdGeometry).toBe('classic');
		inst.handlePdProjectionChoiceChange('morinus');
		expect(inst.state.pdProjectionValue).toBe('morinus');
		expect(inst.state.pdExtraValue.pdGeometry).toBe('improved');
	});

	test('扩展面板不再列几何口径;AI 自陈并进弧算法那一行', ()=>{
		expect(PD_EXTRA_SETTING_SPECS.find((s)=>s.key === 'pdGeometry').inProjection).toBe(true);
		const txt = buildPrimaryDirectSnapshotText({
			params: { birth: '1990-05-18 12:00:00', zone: '+08:00', lat: '31N14', lon: '121E28', pdMethod: 'core_alchabitius',
				pdTimeKey: 'Ptolemy', pdtype: 0, pdProjection: 'placidus', pdFrame: 'alcabitius', pdGeometry: 'classic' },
			predictives: { primaryDirection: [] },
		});
		expect(txt).toContain('弧算法（投影）：Placidus（半弧严密）（经典）');
		expect(txt).not.toContain('几何口径：');
	});

	test('AI 挂载设置:几何口径只在受影响组合下列出', ()=>{
		const f = getTechniqueSettingsSchema('primarydirect').fields.find((x)=>x.name === 'pdGeometry');
		expect(f.showWhen({ pdtype: 0, pdProjection: 'ptolemy' })).toBe(false);
		expect(f.showWhen({ pdtype: 0, pdProjection: 'placidus' })).toBe(true);
		expect(f.showWhen({ pdtype: 1, pdProjection: 'ptolemy', pdFrame: 'porphyry' })).toBe(true);
	});
});
