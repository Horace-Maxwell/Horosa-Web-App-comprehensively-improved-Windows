// 双盘挂载的合盘段与各自的单盘段同一口径:紫微三盘 / 本次挂载设置(齿轮覆盖)/ 西洋合盘古典口径与自定义岁差 /
// 合婚喜忌按所选用神流派 / 本地八字算不出时出说明 / 标题写清四化表出处 / 组合盘表头写实际宫制。
const { getPairChineseTexts, getPairSynastryText, buildRelativeSnapshotForRecords, __resetPairChineseCacheForTests, __resetPairSynastryCacheForTests, PAIR_BAZI_UNAVAILABLE_NOTE } = require('../aiAnalysisContext');
const rec = (name, birth, gender, extra)=>({ cid: `local-${name}`, name, birth, zone: '+08:00', lon: '121e28', lat: '31n14', gpsLat: 31.23, gpsLon: 121.47, gender, ...(extra || {}) });
const A = rec('张三', '1990-05-18 10:00:00', 1);
const B = rec('李四', '1992-03-07 08:30:00', 0);
const names = { selfName: '张三', otherName: '李四' };

beforeEach(()=>{ __resetPairChineseCacheForTests(); __resetPairSynastryCacheForTests(); window.localStorage.clear(); });

describe('紫微合盘', ()=>{
	test('🔴 记录选了地盘:命宫 / 夫妻宫主星按地盘(与单盘挂载同一转法),标出「地盘」;天盘不标', ()=>{
		const { calcZiwei, deriveSanPan } = require('../../components/ziwei/ZiweiCalc');
		const tian = getPairChineseTexts(A, B, ['ziwei'], names).ziwei;
		expect(tian).toMatch(/本人:命宫/);
		const di = getPairChineseTexts({ ...A, sanPan: 'di' }, B, ['ziwei'], names).ziwei;
		expect(di).toMatch(/本人\(地盘\):命宫/);
		expect(di).toMatch(/对方:命宫/);
		const birth = { date: '1990-05-18', time: '10:00:00', zone: '+08:00', lon: '121e28', lat: '31n14', gpsLon: 121.47, gpsLat: 31.23, ad: 1, gender: 1 };
		const chart = deriveSanPan(calcZiwei(birth, { timeAlg: 0, after23NewDay: 1, lateZiHourUseNextDay: 1, yearBoundary: 'lunar_1_1' }), 'di');
		const ming = chart.houses.find((h)=>`${h.name}`.replace(/宫$/, '') === '命');
		const mingMain = (ming.starsMain || []).map((s)=>s.name).join(' ') || '无主星(借对宫)';
		expect(di).toContain(`本人(地盘):命宫 ${mingMain}`);
	});

	test('🔴 本次挂载设置改了四化流派:合盘段跟着改,标题写「按本次挂载设置的流派」;没覆盖照旧', ()=>{
		const base = getPairChineseTexts(A, B, ['ziwei'], names).ziwei;
		expect(base).toContain('本人记录没存流派,按当前设置');
		const z = getPairChineseTexts(A, B, ['ziwei'], names, { optionsA: { ziwei: { sihuaSchool: 'zhongzhou' } } }).ziwei;
		expect(z).toContain('(四化表:中州派,按本次挂载设置的流派)');
		expect(z).toContain('对方记录没存流派,按当前设置');
		// 覆盖恰等于该盘现状 = 无覆盖(与单盘段同一剪法)
		const same = getPairChineseTexts({ ...A, sihuaSchool: 'zhongzhou' }, B, ['ziwei'], names, { optionsA: { ziwei: { sihuaSchool: 'zhongzhou' } } }).ziwei;
		expect(same).toContain('按本人记录的流派');
	});

	test('记录是自定义流派却没带表:标题写明用的是本机的自定义表', ()=>{
		const z = getPairChineseTexts({ ...A, sihuaSchool: 'custom' }, B, ['ziwei'], names).ziwei;
		expect(z).toContain('按本人记录的流派,自定义表没随盘,用本机的自定义表');
	});
});

describe('八字合婚', ()=>{
	test('🔴 喜忌按所选用神流派(调候派与扶抑派取用不同时文本随之),标出派别;没选 = 扶抑派', ()=>{
		const t0 = getPairChineseTexts(A, B, ['bazi'], names).bazi;
		expect(t0).toContain('[喜忌互补](喜用取法:本人扶抑派;对方扶抑派)');
		const t1 = getPairChineseTexts({ ...A, school: 'tiaohou' }, B, ['bazi'], names).bazi;
		expect(t1).toContain('喜用取法:本人调候派;对方扶抑派');
		const t2 = getPairChineseTexts({ ...A, school: 'mangpai' }, B, ['bazi'], names).bazi;
		expect(t2).toContain('本人扶抑派(所选流派不单列喜忌)');
		// 挂载齿轮选流派同样生效
		const t3 = getPairChineseTexts(A, B, ['bazi'], names, { optionsA: { bazi: { school: 'tiaohou' } } }).bazi;
		expect(t3).toContain('喜用取法:本人调候派');
	});

	test('本地八字算不出(抛错):出一行说明,不静默消失', ()=>{
		const lunar = require('../baziLunarLocal');
		const spy = jest.spyOn(lunar, 'buildLocalBaziResult').mockImplementation(()=>{ throw new Error('range'); });
		try{
			expect(getPairChineseTexts(A, B, ['bazi'], names).bazi).toBe(PAIR_BAZI_UNAVAILABLE_NOTE);
		}finally{ spy.mockRestore(); }
	});
});

describe('西洋合盘', ()=>{
	test('🔴 请求带古典口径段与自定义岁差;表头写岁差与「两盘统一按星盘A」;本次挂载改了宫制 → 请求与缓存键跟着变', async ()=>{
		const req = require('../request');
		const bodies = [];
		const spy = jest.spyOn(req, 'default').mockImplementation(async (url, opts)=>{
			bodies.push({ url, body: JSON.parse(opts.body) });
			return { Result: { inToOutAsp: [], outToInAsp: [] } };
		});
		try{
			const a = { ...A, termsVariant: 2, siderealAyanamsa: 'lahiri', zodiacal: 1 };
			const text = await buildRelativeSnapshotForRecords(a, B);
			const rel = bodies.filter((b)=>/\/modern\/relative$/.test(b.url));
			expect(rel.length).toBe(3);
			rel.forEach((b)=>{ expect(b.body.termsVariant).toBe(2); expect(b.body.siderealAyanamsa).toBe('lahiri'); expect(b.body.zodiacal).toBe(1); });
			expect(text).toContain('口径：两盘统一按星盘A的宫制 / 黄道 / 古典口径起盘');
			bodies.length = 0;
			const t1 = await getPairSynastryText(A, B, { optionsA: { astrochart: { hsys: 0 } } });
			expect(`${t1}`.length).toBeGreaterThan(0);
			expect(bodies.filter((b)=>/\/modern\/relative$/.test(b.url)).every((b)=>b.body.hsys === 0)).toBe(true);
			bodies.length = 0;
			await getPairSynastryText(A, B);   // 没覆盖:另一把缓存键,重新取(宫制按记录 / 缺省)
			expect(bodies.filter((b)=>/\/modern\/relative$/.test(b.url)).every((b)=>b.body.hsys === 1)).toBe(true);
		}finally{ spy.mockRestore(); }
	});

	test('组合盘回落时表头写「所选 X,本盘实际 Y」', ()=>{
		const { buildRelativeSnapshotText } = require('../../components/astro/AstroRelative');
		const t = buildRelativeSnapshotText({ currentTab: 'Composite', params: { hsys: 24, zodiacal: 0 }, result: { compositeHouseNote: '福点整宫制合不出,改用上升整宫', params: { hsys: 1 }, chart: { objects: [], houses: [] } }, chartA: { record: A }, chartB: { record: B } });
		expect(t).toMatch(/宫制：所选 .+,本盘实际 /);
		const t2 = buildRelativeSnapshotText({ currentTab: 'Comp', params: { hsys: 24, zodiacal: 0 }, result: {}, chartA: { record: A }, chartB: { record: B } });
		expect(t2).not.toContain('本盘实际');
	});
});
