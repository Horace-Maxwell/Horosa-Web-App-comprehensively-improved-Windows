// 奇门挂载 relatedRecordIds(法奇门「相关人员」)= 命盘档案 id 逗号分隔;重算按页面同一函数(birthToYearGan)取生年干、覆盖存档名单;
// 取不到的档案跳过;空 = 随存档。
jest.mock('../preciseCalcBridge', ()=>{
	const actual = jest.requireActual('../preciseCalcBridge');
	return { ...actual, fetchPreciseNongli: jest.fn(async (p)=>({ birth: `${p.date} ${p.time}`, bazi: {} })) };
});
jest.mock('../../components/dunjia/DunJiaCalc', ()=>{
	const actual = jest.requireActual('../../components/dunjia/DunJiaCalc');
	return { ...actual, calcDunJia: jest.fn(()=>({})) };
});
jest.mock('../aiAnalysisSources', ()=>{
	const actual = jest.requireActual('../aiAnalysisSources');
	const charts = { 'c-a': { name: '甲某', birth: '1984-06-01 08:00:00' }, 'c-b': { name: '乙某', birth: '1990-03-10 10:00:00' } };
	return { __esModule: true, ...actual, findAnalysisSourceById: (id)=>(charts[id] ? { id, sourceType: 'chart', title: charts[id].name, record: { cid: id, ...charts[id] } } : null) };
});
import { computeQimenPanForCase } from '../aiAnalysisContext/regenDivination';
import { birthToYearGan } from '../../components/dunjia/DunJiaCalc';
import { getTechniqueSettingsSchema } from '../techniqueMountSettings';

const rec = { cid: 'q1', divTime: '2026-11-20 10:00:00', zone: '+08:00', lat: '39n54', lon: '116e23', gpsLat: 39.9, gpsLon: 116.4, gender: 1 };
const stored = [{ cid: 'old', name: '存档人', yearGan: '丙' }];

test('不给 → 随存档名单;给了 → 按命盘取生年干覆盖,取不到的跳过', async ()=>{
	const a = await computeQimenPanForCase(rec, { options: {}, faRelatedPeople: stored });
	expect(a.faRelatedPeople).toEqual(stored);
	const b = await computeQimenPanForCase(rec, { options: { relatedRecordIds: 'c-a, c-b,nope' }, faRelatedPeople: stored });
	expect(b.faRelatedPeople).toEqual([
		{ cid: 'c-a', name: '甲某', yearGan: birthToYearGan('1984-06-01 08:00:00') },
		{ cid: 'c-b', name: '乙某', yearGan: birthToYearGan('1990-03-10 10:00:00') },
	]);
	expect(b.faRelatedPeople[0].yearGan).toBe('甲');   // 1984 甲子年
});

test('挂载 schema:奇门与三式合一的奇门子组都有这一项,缺省空', ()=>{
	['qimen', 'sanshiunited'].forEach((k)=>{
		const f = ((getTechniqueSettingsSchema(k) || {}).fields || []).find((x)=>x.name === 'relatedRecordIds');
		expect(`${k}:${!!f}`).toBe(`${k}:true`);
		expect(f.default).toBe('');
	});
});
