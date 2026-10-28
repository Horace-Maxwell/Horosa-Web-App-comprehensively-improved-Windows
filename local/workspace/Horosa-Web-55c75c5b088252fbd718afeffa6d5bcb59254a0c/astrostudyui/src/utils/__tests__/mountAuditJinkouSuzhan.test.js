jest.mock('../request', () => ({ __esModule: true, default: jest.fn(async () => ({ Result: { chart: { objects: [{ id: 'Sun', lon: 1 }], isDiurnal: false } } })) }));
jest.mock('../localcharts', () => ({ listLocalCharts: jest.fn(() => []), __esModule: true }));
jest.mock('../localcases', () => ({ listLocalCases: jest.fn(() => []), getCaseTypeLabel: jest.fn((t) => t), getCaseTypeMeta: jest.fn(() => ({ module: '', value: '' })), CASE_TYPE_OPTIONS: [], __esModule: true }));
import fs from 'fs';
import path from 'path';
import request from '../request';
import { ensureLiurengChartObjects, suzhanFieldsForRecord } from '../aiAnalysisContext';
const { readSource } = require('./helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

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
	const src = readSource(path.join(__dirname, '..', 'aiAnalysisContext.js'));
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

it('🔴 宿占事盘:覆盖里显式带存档的宿法、另有别的覆盖 → 起盘请求的宿法 = 存档宿法(与基线、快照文字同源;宿法被剪掉时起盘不回落荀爽)', async ()=>{
	const { getAnalysisTechniqueContextWithOptions } = require('../aiAnalysisContext');
	const { mergeOptionsIntoRecord, effectiveMountBaseline, pruneOptionsToNonDefault } = require('../techniqueMountSettings');
	const sentSu = async (rec, pack)=>{
		request.mockClear();
		await getAnalysisTechniqueContextWithOptions({ record: rec, sourceType: 'case', id: rec.cid }, 'suzhan', pack).catch(()=>null);
		const chartCalls = request.mock.calls.filter((c)=>/\/chart$/.test(`${c[0]}`));
		const last = chartCalls[chartCalls.length - 1];
		return last ? JSON.parse(last[1].body).doubingSu28 : 'no-request';
	};
	for(const su of [4, 1]){
		const rec = { cid: `c${su}`, caseType: 'suzhan', divTime: '2026-05-15 10:12:00', zone: '+08:00', lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63, payload: JSON.stringify({ options: { szchart: 0, szshape: 0, doubingSu28: su, houseStartMode: 0 } }) };
		for(const pack of [{ doubingSu28: su, hsys: 0 }, { hsys: 0 }, { zodiacal: 1, doubingSu28: su }]){
			expect([su, pack, Number(await sentSu(rec, pack))]).toEqual([su, pack, su]);
			const merged = mergeOptionsIntoRecord(rec, 'suzhan', pruneOptionsToNonDefault('suzhan', pack, effectiveMountBaseline('suzhan', rec)));
			expect([su, pack, Number(merged.doubingSu28), suzhanFieldsForRecord(merged).doubingSu28.value]).toEqual([su, pack, su, su]);
		}
		// 选回荀爽照样作为覆盖发出(不被补回存档宿法)
		expect(Number(await sentSu(rec, { doubingSu28: 0 }))).toBe(0);
	}
	// 命盘(顶层带宿法)照用顶层,payload 里另有的宿法不补
	const natal = { cid: 'n1', birth: '1990-05-18 10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63, gender: 1, doubingSu28: 1, payload: JSON.stringify({ options: { doubingSu28: 4 } }) };
	expect(Number(await sentSu(natal, { hsys: 0 }))).toBe(1);
});
