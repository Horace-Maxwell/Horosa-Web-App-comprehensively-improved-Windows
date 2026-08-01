// 印占 KP 补齐 · 前端契约锁:零 churn / 缓存键 / AI 快照新段。
//
// 🔴 三条铁契约:
// ① 未起卦/未开三旗/默认年长 → fieldsToParams 不含任何新键 → buildIndiaChartCacheKey
//    与改造前**逐字一致**(否则全体用户升级即缓存全废)。
// ② 起卦后 prashna* 键齐且进缓存键(prashnaTime 为冻结字符串,同参数恒同键)。
// ③ AI 快照:payload 有 sensitivePoints/prashna/sarvatobhadra 时对应段出现,
//    段名 ⊆ aiExport indiachart 登记表(aiExportRoundtrip 另有全量前瞻守卫)。
import moment from 'moment';
import { fieldsToParams } from '../../components/astro/IndiaChart';
import { buildJyotishSnapshotLines } from '../../components/astro/IndiaChart';

const baseFields = ()=>({
	date: { value: moment('2000-01-01') },
	time: { value: moment('2000-01-01 12:00:00') },
	ad: { value: 1 },
	zone: { value: 8 },
	lat: { value: 39.9 },
	lon: { value: 116.4 },
	gpsLat: { value: 39.9 },
	gpsLon: { value: 116.4 },
	tradition: { value: false },
	strongRecption: { value: false },
	simpleAsp: { value: false },
	virtualPointReceiveAsp: { value: false },
	name: { value: '' },
	pos: { value: '' },
});

describe('印占 · KP 补齐前端契约', ()=>{
	it('① 零 churn:缺省字段下不出现任何新键(缓存键与改造前逐字同构)', ()=>{
		const p = fieldsToParams(baseFields());
		['dashaYearLength', 'annualChartType', 'tripataki', 'prashnaTime', 'prashnaNumber',
			'prashnaMatter', 'prashnaSchools', 'prashnaCuspMode', 'prashnaPrimaryHouse'].forEach((k)=>{
			expect(p[k]).toBeUndefined();
		});
	});

	it('①b 默认年长 365.25 不下发;非默认才下发', ()=>{
		const f = baseFields();
		f.indiaDashaYearLength = { value: 365.25 };
		expect(fieldsToParams(f).dashaYearLength).toBeUndefined();
		f.indiaDashaYearLength = { value: 360 };
		expect(fieldsToParams(f).dashaYearLength).toBe(360);
	});

	it('①c 年盘口径:varsha 不下发,tithi 下发', ()=>{
		const f = baseFields();
		f.indiaAnnualChartType = { value: 'varsha' };
		expect(fieldsToParams(f).annualChartType).toBeUndefined();
		f.indiaAnnualChartType = { value: 'tithi' };
		expect(fieldsToParams(f).annualChartType).toBe('tithi');
	});

	it('② 起卦后 prashna* 全链下发;时刻为冻结字符串(同参恒同)', ()=>{
		const f = baseFields();
		f.indiaPrashnaTime = { value: '2026/07/21 15:30:00' };
		f.indiaPrashnaNumber = { value: 123 };
		f.indiaPrashnaMatter = { value: 'marriage' };
		f.indiaPrashnaSchools = { value: 'kp,parashari' };
		const p1 = fieldsToParams(f);
		const p2 = fieldsToParams(f);
		expect(p1.prashnaTime).toBe('2026/07/21 15:30:00');
		expect(p1.prashnaNumber).toBe(123);
		expect(p1.prashnaMatter).toBe('marriage');
		expect(JSON.stringify(p1)).toBe(JSON.stringify(p2));   // 冻结 → 恒同
		// cuspMode 默认 asc_driven 不下发(零 churn);time_placidus 才下发
		f.indiaPrashnaCuspMode = { value: 'asc_driven_placidus' };
		expect(fieldsToParams(f).prashnaCuspMode).toBeUndefined();
		f.indiaPrashnaCuspMode = { value: 'time_placidus' };
		expect(fieldsToParams(f).prashnaCuspMode).toBe('time_placidus');
	});

	it('③ AI 快照:敏感点/全吉盘降级免责/问事三段按 payload 出现', ()=>{
		const chartObj = { jyotish: {
			sensitivePoints: {
				available: true,
				beejaKshetra: { beeja: { available: true, rasi: { signLabel: '射手' }, navamsa: { signLabel: '白羊' }, verdictLabel: '中平' },
					kshetra: { available: false } },
				gandanta: { hits: [{ body: 'Moon', bodyLabel: '月亮',
					gandanta: { junctionLabel: '巨蟹↔狮子', arcminToBoundary: 12.3 } }] },
				deathIndicators: { available: true,
					drekkana22: { lordLabel: '木星' },
					navamsa64FromMoon: { lordLabel: '土星' },
					navamsa64FromLagna: { lordLabel: '火星' } },
			},
			sarvatobhadra: { available: true, vedhaEnabled: false, layout: { source: 'placeholder_sequential' } },
			prashna: { available: true, questionTime: '2026-07-21 15:30:00', matter: 'marriage',
				kp: { available: true, number: 123, segment: { starLord: 'Moon', subLord: 'Venus' },
					cuspMode: 'asc_driven_placidus',
					judgement: { chain: ['主判宫 = 第 7 宫'] },
					rulingPlanets: { set: ['Mars'] }, timingWindows: [] } },
		} };
		const out = buildJyotishSnapshotLines(chartObj);
		expect(out['敏感点 Sphuta']).toBeTruthy();
		expect(out['敏感点 Sphuta'].join('\n')).toContain('不构成任何寿命预测');
		// 🔴 降级态只输出一句免责,绝不把占位格位当权威喂给 AI
		expect(out['全吉盘 SBC']).toEqual(
			['SBC 经典环锚待录入,当前为占位布局,Vedha 判定未启用(不作任何克应结论)']);
		expect(out['问事 Praśna'].join('\n')).toContain('KP 问数 123');
		// payload 缺席 → 段不出(零噪音)
		const empty = buildJyotishSnapshotLines({ jyotish: {} });
		expect(empty['敏感点 Sphuta']).toBeUndefined();
		expect(empty['问事 Praśna']).toBeUndefined();
	});
});
