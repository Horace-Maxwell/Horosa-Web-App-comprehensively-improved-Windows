// [挂载自检 F-24 金口诀昼夜 / F-25 宿占事盘 options 打底]
jest.mock('../request', () => ({ __esModule: true, default: jest.fn(async () => ({ Result: { chart: { objects: [{ id: 'Sun', lon: 1 }], isDiurnal: false } } })) }));
jest.mock('../localcharts', () => ({ listLocalCharts: jest.fn(() => []), __esModule: true }));
jest.mock('../localcases', () => ({ listLocalCases: jest.fn(() => []), getCaseTypeLabel: jest.fn((t) => t), getCaseTypeMeta: jest.fn(() => ({ module: '', value: '' })), CASE_TYPE_OPTIONS: [], __esModule: true }));
import fs from 'fs';
import path from 'path';
import request from '../request';
import { ensureLiurengChartObjects, suzhanFieldsForRecord } from '../aiAnalysisContext';

beforeEach(()=>{ request.mockClear(); });

it('🔴 六壬/金口诀无头:/liureng/gods 回包缺 isDiurnal → 补一份 /chart 取昼夜(与页面真实地平同口径)', async ()=>{
	const out = await ensureLiurengChartObjects({ liureng: { nongli: { time: '巳' } }, params: { date: '2026-05-15', time: '10:12:00' } });
	expect(out.isDiurnal).toBe(false);
	expect(out.objects.length).toBe(1);
	expect(request).toHaveBeenCalledTimes(1);
});

it('回包已带 objects+isDiurnal → 不再打 /chart(零多余请求);无 liureng → null', async ()=>{
	const base = { liureng: { objects: [{ id: 'Sun' }], isDiurnal: true }, params: {} };
	expect(await ensureLiurengChartObjects(base)).toBe(base.liureng);
	expect(request).not.toHaveBeenCalled();
	expect(await ensureLiurengChartObjects(null)).toBeNull();
});

it('金口诀 regen 把补到的昼夜送进 builder(源码锚:isDiurnal 不再恒 null)', ()=>{
	const src = fs.readFileSync(path.join(__dirname, '..', 'aiAnalysisContext.js'), 'utf8');
	expect(src).toContain('isDiurnal: jkIsDiurnal,');
	expect(src).toContain('const lrChart = await ensureLiurengChartObjects(result);');
});

it('🔴 宿占事盘:payload.options 四键打底进 fields;记录平铺键(齿轮)优先;无 options 零变化', ()=>{
	const rec = { cid: 'c', caseType: 'suzhan', divTime: '2026-05-15 10:12:00', zone: '+08:00', payload: JSON.stringify({ options: { szchart: 'inner', szshape: 'round', doubingSu28: 1, houseStartMode: 1 } }) };
	const fo = suzhanFieldsForRecord(rec);
	expect(fo.szchart.value).toBe('inner');
	expect(fo.szshape.value).toBe('round');
	expect(fo.doubingSu28.value).toBe(1);
	expect(fo.houseStartMode.value).toBe(1);
	const fo2 = suzhanFieldsForRecord({ ...rec, houseStartMode: 0 });
	expect(fo2.houseStartMode.value).toBe(0);
	const fo3 = suzhanFieldsForRecord({ ...rec, payload: JSON.stringify({}) });
	expect(fo3.szchart).toBeUndefined();
	expect(fo3.doubingSu28.value).toBe(0);
});
