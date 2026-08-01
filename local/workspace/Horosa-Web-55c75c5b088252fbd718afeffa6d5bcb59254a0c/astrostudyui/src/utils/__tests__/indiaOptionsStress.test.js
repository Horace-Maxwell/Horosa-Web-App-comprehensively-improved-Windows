// 印占 选项穷举压测（QA Step 3）：遍历每个新增/既有选项的每一种取值 + 笛卡尔组合，
// 断言 normalize/流派默认包/AI 快照构建 全程不抛、回退正确、默认零回归。纯函数层，无需 :8899。
import moment from 'moment';
import * as AstroConst from '../../constants/AstroConst';
import { buildJyotishSnapshotLines, fieldsToParams } from '../../components/astro/IndiaChart';
import { getAspectedSignNumbers } from '../../components/astro/IndiaSouthChart';
import { buildLocalChartRecord } from '../localcharts';

// 2026-07-21 KP 补齐:'14' 问事(parashari/tajika/kp)+ '15' 校时(五派全开);五支轮 '16' 纳迪 —— 均为有意的契约变更。
const ALL_TABS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16'];
// LagnaRef 选项是分组结构（{label, options}），压平成 [{value}] 再扫。
const LAGNA_REF_FLAT = AstroConst.INDIA_LAGNA_REF_OPTIONS.reduce((a, g)=>a.concat(g.options || []), []);

describe('印占 选项穷举压测（normalize/默认包/AI 快照 万无一失）', ()=>{
	it('① normalize 各函数：合法值原样保留、非法/空 → 回退合法默认（不抛）', ()=>{
		const cases = [
			[AstroConst.normalizeIndiaAyanamsa, AstroConst.INDIA_AYANAMSA_OPTIONS],
			[AstroConst.normalizeIndiaHouseSystem, AstroConst.INDIA_HOUSE_SYSTEM_OPTIONS],
			[AstroConst.normalizeIndiaNodeType, AstroConst.INDIA_NODE_TYPE_OPTIONS],
			[AstroConst.normalizeIndiaDashaSystem, AstroConst.INDIA_DASHA_SYSTEM_OPTIONS],
			[AstroConst.normalizeIndiaChartStyle, AstroConst.INDIA_CHART_STYLE_OPTIONS],
			[AstroConst.normalizeIndiaLagnaRef, LAGNA_REF_FLAT],
			[AstroConst.normalizeIndiaPlanetDisplay, AstroConst.INDIA_PLANET_DISPLAY_OPTIONS],
			[AstroConst.normalizeIndiaSchool, AstroConst.INDIA_SCHOOL_OPTIONS],
		];
		cases.forEach(([fn, opts])=>{
			opts.forEach((o)=>{ expect(fn(o.value)).toBe(o.value); });          // 合法值原样
			[undefined, null, '', '___garbage___', 99999, {}, []].forEach((bad)=>{
				const r = fn(bad);
				expect(opts.some((o)=>o.value === r)).toBe(true);                 // 回退到某合法值,绝不抛/不返垃圾
			});
		});
	});

	it('② 5 流派默认包：ayanamsa/hsys 自洽、tabs 合法非空；默认 parashari = 全 13 tab（零回归）', ()=>{
		AstroConst.INDIA_SCHOOL_OPTIONS.forEach((s)=>{
			const d = AstroConst.getIndiaSchoolDefaults(s.value);
			expect(d).toBeTruthy();
			expect(AstroConst.normalizeIndiaAyanamsa(d.ayanamsa)).toBe(d.ayanamsa);
			expect(AstroConst.normalizeIndiaHouseSystem(d.hsys)).toBe(d.hsys);
			expect(Array.isArray(d.tabs) && d.tabs.length > 0).toBe(true);
			d.tabs.forEach((t)=>{ expect(ALL_TABS.indexOf(t) >= 0).toBe(true); });
		});
		expect(AstroConst.getIndiaSchoolDefaults('parashari').tabs.length).toBe(16);  // 默认全开(13+问事+校时+纳迪)
		// KP 默认 = Krishnamurti + Placidus(3) + 子集 tab。
		const kp = AstroConst.getIndiaSchoolDefaults('kp');
		expect(kp.ayanamsa).toBe('krishnamurti');
		expect(kp.hsys).toBe(3);
		expect(kp.tabs.length).toBeLessThan(16);
		// '14' 问事:parashari/tajika/kp 有,jaimini/nadi 无('16.3 适用矩阵);'15' 校时:五派全开。
		['parashari', 'tajika', 'kp'].forEach((k)=>{ expect(AstroConst.getIndiaSchoolDefaults(k).tabs).toContain('14'); });
		['jaimini', 'nadi'].forEach((k)=>{ expect(AstroConst.getIndiaSchoolDefaults(k).tabs).not.toContain('14'); });
		AstroConst.INDIA_SCHOOL_OPTIONS.forEach((sch)=>{ expect(AstroConst.getIndiaSchoolDefaults(sch.value).tabs).toContain('15'); });
	});

	it('③ 笛卡尔：school × dasha × node × style × display 全组合 normalize 链不崩、值正确', ()=>{
		let combos = 0;
		AstroConst.INDIA_SCHOOL_OPTIONS.forEach((sc)=>{
			const defaults = AstroConst.getIndiaSchoolDefaults(sc.value);
			AstroConst.INDIA_DASHA_SYSTEM_OPTIONS.forEach((ds)=>{
				AstroConst.INDIA_NODE_TYPE_OPTIONS.forEach((nd)=>{
					AstroConst.INDIA_CHART_STYLE_OPTIONS.forEach((st)=>{
						AstroConst.INDIA_PLANET_DISPLAY_OPTIONS.forEach((pd)=>{
							expect(AstroConst.normalizeIndiaSchool(sc.value)).toBe(sc.value);
							expect(AstroConst.normalizeIndiaDashaSystem(ds.value)).toBe(ds.value);
							expect(AstroConst.normalizeIndiaNodeType(nd.value)).toBe(nd.value);
							expect(AstroConst.normalizeIndiaChartStyle(st.value)).toBe(st.value);
							expect(AstroConst.normalizeIndiaPlanetDisplay(pd.value)).toBe(pd.value);
							expect(defaults.tabs.length).toBeGreaterThan(0);
							combos++;
						});
					});
				});
			});
		});
		// 流派数表驱动(第 6 派 western_sidereal 起不再写死 5;其余维仍锁死防悄扩)
		expect(AstroConst.INDIA_SCHOOL_OPTIONS.length).toBe(6);
		expect(combos).toBe(AstroConst.INDIA_SCHOOL_OPTIONS.length * AstroConst.INDIA_DASHA_SYSTEM_OPTIONS.length * 2 * 3 * 2);
	});

	it('④ Tribhāgī 已并入大运体系选项（P1 新增可选中）', ()=>{
		expect(AstroConst.INDIA_DASHA_SYSTEM_OPTIONS.some((o)=>o.value === 'tribhagi')).toBe(true);
		expect(AstroConst.normalizeIndiaDashaSystem('tribhagi')).toBe('tribhagi');
	});

	it('⑤ AI 快照：全新字段合成对象 → 所有新段齐全；空/部分 → 不抛不出空段', ()=>{
		expect(buildJyotishSnapshotLines(null)).toEqual({});
		expect(buildJyotishSnapshotLines({})).toEqual({});
		expect(buildJyotishSnapshotLines({ jyotish: {} })).toEqual({});
		const full = { jyotish: {
			ashtakavarga: { available: true, sarvaBySign: [{ label: '白羊', bindu: 30 }],
				sodhyaPinda: { Sun: { rasiPinda: 1, grahaPinda: 2, total: 3 } } },
			shadbalaBphs: { Sun: { vimsopaka: { shadvarga: { total: 1 }, saptavarga: { total: 2 }, dasavarga: { total: 3 }, shodasavarga: { total: 4 } } } },
			muhurta: {
				horaTable: { rows: [{ index: 1, period: 'day', lord: 'Sun', lordCN: '太阳', start: '2026-06-23 06:00:00' }] },
				choghadia: { rows: [{ index: 1, period: 'day', cn: '吉', nature: 'good', start: '2026-06-23 06:00:00' }] },
			},
			dasha: { naisargika: { available: true, periods: [{ planetCN: '月', years: 1, startAge: 0, endAge: 1, start: 'a', end: 'b' }] } },
			supplementaryLagnas: { available: true, induLagna: { key: 'induLagna', label: 'Indu 财富上升', sign: 'Aquarius', signLabel: '水瓶', sumKala: 20, stepS: 8 } },
			nadi: { available: true, bhriguBindu: { lon: 240.96, sign: 'Sagittarius', signLabel: '射手', nakshatra: { name: 'Mula', pada: 1 } } },
			ayurdaya: { available: true, pindayu: { baseYears: 98.55, contributions: [{ planetCN: '日', fullYears: 19, years: 16.9 }] }, nisargayu: { naturalYears: [{ planetCN: '日', years: 20 }] } },
		} };
		const out = buildJyotishSnapshotLines(full);
		['Sodhya Pinda 凝量', 'Vimśopaka 分盘 20 分力', 'Hora 行星时', 'Choghadia 民用择时',
			'Naisargika 自然大运', '补充上升（Supplementary Lagnas）', 'Nāḍī · Bhrigu Bindu 福点',
			'Āyurdāya 寿命基础'].forEach((sec)=>{
			expect(Array.isArray(out[sec]) && out[sec].length > 0).toBe(true);
		});
		// 单字段对象只出对应段(无串扰)。
		const onlyNadi = buildJyotishSnapshotLines({ jyotish: { nadi: full.jyotish.nadi } });
		expect(onlyNadi['Nāḍī · Bhrigu Bindu 福点']).toBeTruthy();
		expect(onlyNadi['Hora 行星时']).toBeUndefined();
	});

	it('⑥ AI 快照：本会话新段(特殊上升+Praṇapada / D60 / 分盘变体 / 座运3 / Āyurdāya haraṇa·Nisargāyu·Bharaṇa)齐全、无串扰、不抛', ()=>{
		const sessionNew = { jyotish: {
			upagraha: { available: true, specialLagnas: {
				bhavaLagna: { key: 'BL', label: 'Bhava Lagna', lon: 120.5 },
				horaLagna: { key: 'HL', label: 'Hora Lagna', lon: 200.3 },
				ghatikaLagna: { key: 'GL', label: 'Ghatika Lagna', lon: 50.1 },
				sreeLagna: { key: 'SL', label: 'Sree Lagna', lon: 300.7 },
				pranapada: { key: 'PP', label: 'Praṇapada', lon: 197.3, variantSunrise: 197.3, variantBirth: 197.8 },
			} },
			shashtiamsa: { available: true, beneficCount: 6, maleficCount: 3, planets: [
				{ planet: 'Sun', segment: 16, signLabel: '处女', nature: 'malefic' },
				{ planet: 'Moon', segment: 47, signLabel: '天秤', nature: 'benefic' },
			] },
			vargaVariants: { available: true, charts: [
				{ label: 'D3 Drekkāṇa', variants: [{ label: '标准' }, { label: 'Parivṛtti' }, { label: 'Jagannātha' }],
					planets: [{ differs: true, planet: 'Sun', cells: [{ signLabel: '双子' }, { signLabel: '天秤' }, { signLabel: '天秤' }] }] },
			] },
			ayurdaya: { available: true,
				pindayu: { baseYears: 89.4, contributions: [{ planetCN: '日', fullYears: 19, years: 16.9 }] },
				harana: { available: true, lagnaAyu: 8.2,
					krurodaya: { applies: true, planetCN: '土', mitigated: true, formulaA: 2.84 },
					profiles: [{ key: 'noharana', label: '未减·全期派', savanaYears: 97.6, solarYears: 96.2 },
						{ key: 'harana_a', label: '施减·式A', savanaYears: 80, solarYears: 78.9 }] },
				haranaNisarga: { available: true,
					profiles: [{ key: 'noharana', label: '未减·全期派', savanaYears: 128, solarYears: 126.5 },
						{ key: 'harana_a', label: '施减·式A', savanaYears: 74, solarYears: 73 }] },
				amsayu: { baseYears: 52, bharanaVariants: [
					{ key: 'majority', label: '多数派（svakṣetra×2）', baseYears: 52 },
					{ key: 'bphs', label: 'BPHS-literal（svakṣetra×3）', baseYears: 44 },
					{ key: 'multiply', label: 'Sārāvalī 相乘（×6）', baseYears: 56 }] },
			},
			rasiDasha: {
				sthira: { available: true, mahadashas: [{ rasi: 'Virgo', years: 9 }, { rasi: 'Leo', years: 8 }] },
				yogardha: { available: true, mahadashas: [{ rasi: 'Pisces', years: 9 }] },
				manduka: { available: true, mahadashas: [{ rasi: 'Pisces', years: 9 }] },
			},
		} };
		const out = buildJyotishSnapshotLines(sessionNew);
		// 各新段齐全。
		['特殊上升 Special Lagnas', 'D60 六十分盘吉凶', '分盘变体对照',
			'座运·Sthira-固定', '座运·Yogardha-平均', '座运·Manduka-蛙跳'].forEach((sec)=>{
			expect(Array.isArray(out[sec]) && out[sec].length > 0).toBe(true);
		});
		// 特殊上升含 Praṇapada 双变体两行。
		const spl = out['特殊上升 Special Lagnas'].join('\n');
		expect(spl).toContain('Praṇapada·日出太阳');
		expect(spl).toContain('Praṇapada·出生太阳');
		// Āyurdāya 段含 haraṇa(Piṇḍāyu/Nisargāyu)+ Aṁśāyu Bharaṇa 流派行。
		const ayuSec = (out['Āyurdāya 寿命基础'] || []).join('\n');
		expect(ayuSec).toContain('haraṇa');
		expect(ayuSec).toContain('Nisargāyu haraṇa');
		expect(ayuSec).toContain('Aṁśāyu Bharaṇa 流派');
		// D60 含吉凶统计行。
		expect(out['D60 六十分盘吉凶'].join('\n')).toContain('合计 吉6·凶3');
		// 无串扰:只喂 shashtiamsa → 只出 D60,不出特殊上升/座运。
		const onlyD60 = buildJyotishSnapshotLines({ jyotish: { shashtiamsa: sessionNew.jyotish.shashtiamsa } });
		expect(onlyD60['D60 六十分盘吉凶']).toBeTruthy();
		expect(onlyD60['特殊上升 Special Lagnas']).toBeUndefined();
		expect(onlyD60['座运·Sthira-固定']).toBeUndefined();
		// 空/部分不抛、不出空段。
		expect(()=>buildJyotishSnapshotLines({ jyotish: { vargaVariants: { available: true, charts: [] } } })).not.toThrow();
		expect(buildJyotishSnapshotLines({ jyotish: { vargaVariants: { available: true, charts: [] } } })['分盘变体对照']).toBeUndefined();
		expect(()=>buildJyotishSnapshotLines({ jyotish: { ayurdaya: { available: true, pindayu: { baseYears: 1, contributions: [] } } } })).not.toThrow();
	});

	// ⑦ AI 快照漏透传修复:大运起点/过运日/年度盘/分盘集 4 设置走 record→buildLocalChartRecord 存盘 + fields→fieldsToParams 下发。
	//    缺省 → 落库 undefined + fieldsToParams 不下发(或回退默认) = 零回归;携带 → 存盘+下发,AI 快照与界面盘一致。
	it('⑦ 大运起点/过运日/年度盘/分盘集:落库 round-trip + fieldsToParams 透传(缺省零回归)', ()=>{
		// (a) buildLocalChartRecord 枚举这 4 键:提供则存,缺省则 undefined。
		const stored = buildLocalChartRecord({
			indiaDashaSeed: 'lagna',
			indiaTransitDate: '2026/06/27',
			indiaTajakaYear: 2030,
			indiaVargaSet: '1,9,10',
		});
		expect(stored.indiaDashaSeed).toBe('lagna');
		expect(stored.indiaTransitDate).toBe('2026/06/27');
		expect(stored.indiaTajakaYear).toBe(2030);         // 数字原样,不被 +'' 强转
		expect(stored.indiaVargaSet).toBe('1,9,10');
		const empty = buildLocalChartRecord({});
		expect(empty.indiaDashaSeed).toBeUndefined();
		expect(empty.indiaTransitDate).toBeUndefined();
		expect(empty.indiaTajakaYear).toBeUndefined();
		expect(empty.indiaVargaSet).toBeUndefined();

		// (b) fieldsToParams 读 fields.india{DashaSeed,TransitDate,TajakaYear,VargaSet} 下发后端。
		const baseFields = {
			date: { value: moment('2026-06-27 12:00:00') },
			time: { value: moment('2026-06-27 12:00:00') },
			ad: { value: 1 }, zone: { value: '+08:00' },
			lat: { value: 31.2 }, lon: { value: 121.5 }, gpsLat: { value: 31.2 }, gpsLon: { value: 121.5 },
			tradition: { value: 0 }, strongRecption: { value: 0 }, simpleAsp: { value: 0 }, virtualPointReceiveAsp: { value: 0 },
			name: { value: '' }, pos: { value: '' },
		};
		const withOpts = fieldsToParams({
			...baseFields,
			indiaDashaSeed: { value: 'lagna' },
			indiaTransitDate: { value: '2026/06/27' },
			indiaTajakaYear: { value: 2030 },
			indiaVargaSet: { value: '1,9,10' },
		});
		expect(withOpts.dashaSeed).toBe('lagna');
		expect(withOpts.transitDate).toBe('2026/06/27');
		expect(withOpts.tajakaYear).toBe(2030);
		expect(withOpts.vargaSet).toBe('1,9,10');

		// 缺省零回归:dashaSeed/transitDate/vargaSet 不进请求体;tajakaYear 回退当前年(既有默认行为)。
		const bare = fieldsToParams(baseFields);
		expect(bare.dashaSeed).toBeUndefined();
		expect(bare.transitDate).toBeUndefined();
		expect(bare.vargaSet).toBeUndefined();
		expect(bare.tajakaYear).toBe(new Date().getFullYear());
		// 默认起点 'moon' 也不下发(零 cache churn)。
		expect(fieldsToParams({ ...baseFields, indiaDashaSeed: { value: 'moon' } }).dashaSeed).toBeUndefined();
	});

	// ⑧ aspectParadigm 接线:graha(Parashari 曜相,默认)读 grahaDrishti;rasi(Jaimini 座相)读 jaimini.rasiDrishti。
	//    切派 → 同一源星高亮的星座号集合不同(死选项已激活)。tajika/kp/nadi 无对应真值 → 回退 graha。
	it('⑧ aspectParadigm graha vs rasi:相映高亮星座集合随范式真实切换', ()=>{
		// 火星(Mars)在白羊(Aries,1 号座)。grahaDrishti:火相 4/7/8 宫(整宫非对称)。
		// rasiDrishti:白羊(动)→ 照见定座(金牛除外的固定座) Leo/Scorpio/Aquarius(5/8/11 号座,§4.3)。
		const chartObj = {
			chart: { objects: [{ id: AstroConst.MARS, sign: 'Aries', lon: 5 }] },
			jyotish: {
				grahaDrishti: [
					{ giver: AstroConst.MARS, targetSign: 'Cancer' },   // 4 号座
					{ giver: AstroConst.MARS, targetSign: 'Libra' },    // 7 号座
					{ giver: AstroConst.MARS, targetSign: 'Scorpio' },  // 8 号座
				],
				jaimini: { rasiDrishti: [
					{ sign: 'Aries', aspects: ['Leo', 'Scorpio', 'Aquarius'] },   // 5/8/11 号座
				] },
			},
		};
		const graha = getAspectedSignNumbers(chartObj, AstroConst.MARS, 'graha');
		expect(Array.from(graha).sort((a, b)=>a - b)).toEqual([4, 7, 8]);
		const rasi = getAspectedSignNumbers(chartObj, AstroConst.MARS, 'rasi');
		expect(Array.from(rasi).sort((a, b)=>a - b)).toEqual([5, 8, 11]);
		// 两范式结果不同 = 切派真改高亮(否则死选项)。
		expect(Array.from(graha).sort().join()).not.toBe(Array.from(rasi).sort().join());
		// 五支轮起 tajika/kp/nadi 各有真渲染(非回退):本 fixture 仅单曜/无 kp·nadi 数据 → 三范式空集;
		// 默认 undefined 仍走 graha。tajika 有他曜时按 deeptamsha 命中(见下补例)。
		expect(getAspectedSignNumbers(chartObj, AstroConst.MARS, 'kp').size).toBe(0);
		expect(getAspectedSignNumbers(chartObj, AstroConst.MARS, 'nadi').size).toBe(0);
		expect(getAspectedSignNumbers(chartObj, AstroConst.MARS, 'tajika').size).toBe(0);
		expect(Array.from(getAspectedSignNumbers(chartObj, AstroConst.MARS, undefined)).sort((a, b)=>a - b)).toEqual([4, 7, 8]);
		// tajika 真渲染补例:金星 95°(巨蟹) 与 火星 5° 相距 90°,容许度 (8+7)/2=7.5 内 → 高亮巨蟹(4)。
		const tjObj = { chart: { objects: [
			{ id: AstroConst.MARS, sign: 'Aries', lon: 5 },
			{ id: AstroConst.VENUS, sign: 'Cancer', lon: 95 },
		] }, jyotish: { grahaDrishti: [] } };
		expect(Array.from(getAspectedSignNumbers(tjObj, AstroConst.MARS, 'tajika'))).toEqual([4]);
		// nadi 真渲染补例:同座合 → 高亮该座;交换 → 对方座。
		const ndObj = { chart: { objects: [{ id: AstroConst.MARS, sign: 'Aries', lon: 5 }] },
			jyotish: { nadi: { combinations: [{ sign: 'Aries', planets: [AstroConst.MARS, AstroConst.SUN] }],
				exchanges: [{ a: AstroConst.MARS, b: AstroConst.VENUS, aSign: 'Libra', bSign: 'Aries' }] } } };
		expect(Array.from(getAspectedSignNumbers(ndObj, AstroConst.MARS, 'nadi')).sort((a, b)=>a - b)).toEqual([1, 7]);
		// 无源星 / 无盘 → 空集,不抛。
		expect(getAspectedSignNumbers(chartObj, null, 'rasi').size).toBe(0);
		expect(getAspectedSignNumbers(null, AstroConst.MARS, 'graha').size).toBe(0);
	});
});
