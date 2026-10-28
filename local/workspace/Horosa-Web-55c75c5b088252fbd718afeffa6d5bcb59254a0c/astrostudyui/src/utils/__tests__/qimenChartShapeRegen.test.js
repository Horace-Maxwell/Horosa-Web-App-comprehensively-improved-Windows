// 奇门存成命盘(设置在 payload.qimen.options、齿轮覆盖在 payload.options)时的挂载重算:
// 取农历与排局同一份设置(齿轮也进农历参数);命盘没有起课时刻,按出生时刻起局(不退到记录最后修改的时刻)。
const cap = { params: [], options: [] };
jest.mock('../preciseCalcBridge', ()=>{
	const actual = jest.requireActual('../preciseCalcBridge');
	return { ...actual, fetchPreciseNongli: jest.fn(async (p)=>{ cap.params.push(p); return { birth: `${p.date} ${p.time}`, bazi: {} }; }) };
});
jest.mock('../../components/dunjia/DunJiaCalc', ()=>{
	const actual = jest.requireActual('../../components/dunjia/DunJiaCalc');
	return { ...actual, calcDunJia: jest.fn((f, n, o)=>{ cap.options.push({ ...o, _date: f.date.value.format('YYYY-MM-DD HH:mm') }); return {}; }), buildDunJiaSnapshotText: ()=>'SNAP' };
});

const ctx = require('../aiAnalysisContext');
const TMS = require('../techniqueMountSettings');

const savedOpts = { paiPanType: 3, school: '转盘', timeAlg: 0, after23NewDay: 0, lateZiHourUseNextDay: 0 };
const gear = { timeAlg: 1, after23NewDay: 1 };
const base = { cid: 'c1', zone: '+08:00', lat: '39n54', lon: '116e23', gpsLat: 39.9, gpsLon: 116.4, gender: 1, updateTime: '2026-10-01 08:00:00' };

async function regen(rec){
	cap.params.length = 0; cap.options.length = 0;
	const payload = JSON.parse(rec.payload);
	const pruned = TMS.pruneOptionsToNonDefault('qimen', gear, TMS.effectiveMountBaseline('qimen', rec));
	await ctx.regenerateCaseTechniqueSnapshot(rec, 'qimen', TMS.mergeOptionsIntoPayload(payload, 'qimen', pruned));
	return { params: cap.params.map((p)=>({ a23: p.after23NewDay, t: p.timeAlg, at: `${p.date} ${p.time}` })), opts: cap.options.map((o)=>({ a23: o.after23NewDay, t: o.timeAlg, at: o._date, cat: o.chartCategory })) };
}

describe('奇门命盘结构挂载重算', ()=>{
	test('齿轮的日界 / 时间算法同时进农历与排局(此前命盘结构下农历只读存档设置)', async ()=>{
		const ming = await regen({ ...base, birth: '2020-01-01 23:30:00', divTime: '2020-01-01 23:30:00', payload: JSON.stringify({ qimen: { options: savedOpts } }) });
		expect(ming.params[0]).toMatchObject({ a23: 1, t: 1 });
		expect(ming.opts[0]).toMatchObject({ a23: 1, t: 1 });
		const evt = await regen({ ...base, divTime: '2020-01-01 23:30:00', payload: JSON.stringify({ options: savedOpts }) });
		expect(evt.params[0]).toMatchObject({ a23: 1, t: 1 });
		expect(evt.opts[0]).toMatchObject({ a23: 1, t: 1 });
	});
	test('命盘没有起课时刻:按出生时刻起局;事盘照旧按起课时刻', async ()=>{
		const ming = await regen({ ...base, birth: '1990-05-06 07:08:00', payload: JSON.stringify({ qimen: { options: savedOpts } }) });
		expect(ming.params[0].at).toBe('1990-05-06 07:08:00');
		expect(ming.opts[0].at).toBe('1990-05-06 07:08');
		const evt = await regen({ ...base, birth: '1990-05-06 07:08:00', divTime: '2026-03-04 05:06:00', payload: JSON.stringify({ options: savedOpts }) });
		expect(evt.params[0].at).toBe('2026-03-04 05:06:00');
	});
	test('存成命盘的盘类:没记这一项时按命局(基线与重算同);事盘照旧事局', async ()=>{
		const ming = await regen({ ...base, birth: '1990-05-06 07:08:00', payload: JSON.stringify({ qimen: { options: savedOpts } }) });
		expect(ming.opts[0].cat).toBe('ming');
		expect(TMS.effectiveMountBaseline('qimen', { ...base, payload: JSON.stringify({ qimen: { options: savedOpts } }) }).chartCategory).toBe('ming');
		const evt = await regen({ ...base, divTime: '2026-03-04 05:06:00', payload: JSON.stringify({ options: savedOpts }) });
		expect(evt.opts[0].cat).not.toBe('ming');
		const src = require('fs').readFileSync(require('path').join(__dirname, '../../components/dunjia/DunJiaMain.js'), 'utf8');
		expect(src).toContain("options: { ...fixedOptions, chartCategory: 'ming' },");
	});
});
