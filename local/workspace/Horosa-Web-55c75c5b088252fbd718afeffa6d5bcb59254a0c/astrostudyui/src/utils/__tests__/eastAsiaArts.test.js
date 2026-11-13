// 东亚诸术:藏历与精确分数计算、245 个独立对照藏历日逐日对照;八卦 / 九宫 / Zurkhai / 洛书 / 易卦的规则。
import golden from './fixtures/tibetanCalendarGolden.json';
import {
	tibetanDateOfDayNumber, tibetanCivilDayNumber, tibetanYearInfo, yearParkha, dayParkha, mewaSet, lunarDayMewa,
	calendarDayMewa, birthMewa, forcesOf, zurkhaiAspect, loshuTransit, kingWen, hexTrigrams, hexName, mergeTrigram,
	degreeHexagram, DEGREE_HEX_RING, ichingRows, ichingProgression, sanmeigaku, nineStarKi, eastAsiaFacts, tenchusatsuYears,
} from '../eastAsiaArts';

describe('藏历', ()=>{
	it('与分数精确计算逐日一致(1800~2100 每 41 日取一日)', ()=>{
		const bad = golden.exact.filter(([jdn, y, m, leap, d, extra])=>{
			const t = tibetanDateOfDayNumber(jdn);
			return t.year !== y || t.month !== m || (t.leap ? 1 : 0) !== leap || t.day !== d || (t.extra ? 1 : 0) !== extra;
		});
		expect(golden.exact.length).toBeGreaterThan(2000);
		expect(bad).toEqual([]);
	});
	it('245 个对照藏历日:日期、闰月、重日、太阴日九宫、历日九宫全对', ()=>{
		const bad = golden.reference.filter(([jd, y, m, leap, d, extra, lnum, dnum])=>{
			const dn = tibetanCivilDayNumber(jd, golden.lonEast);
			const t = tibetanDateOfDayNumber(dn);
			return t.year !== y || t.month !== m || (t.leap ? 1 : 0) !== leap || t.day !== d || (t.extra ? 1 : 0) !== extra
				|| lunarDayMewa(t.month, t.day) !== lnum || calendarDayMewa(dn) !== dnum;
		});
		expect(bad).toEqual([]);
		expect(golden.reference.some((row)=>row[3] === 1)).toBe(true);
		expect(golden.reference.some((row)=>row[5] === 1)).toBe(true);
	});
	it('跳日:一天收两个太阴日时标前一个号,后一个号记为跳过,次日接着后后一个号', ()=>{
		const t = tibetanDateOfDayNumber(2451565);
		expect(t.day).toBe(15);
		expect(t.skippedDay).toBe(16);
		expect(tibetanDateOfDayNumber(2451566).day).toBe(17);
		let flagged = 0;
		for(let dn = 2451545; dn < 2451545 + 3650; dn += 1){ if(tibetanDateOfDayNumber(dn).skippedDay){ flagged += 1; } }
		expect(flagged).toBeGreaterThan(100);       // 十年里约一百三四十个跳日
	});
	it('藏历新年(2019~2026)都落在正月初一', ()=>{
		const jdn = (y, m, d)=>{
			const a = Math.floor((14 - m) / 12); const yy = y + 4800 - a; const mm = m + 12 * a - 3;
			return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
		};
		[[2019, 2, 5], [2020, 2, 24], [2021, 2, 12], [2022, 3, 3], [2023, 2, 21], [2024, 2, 10], [2025, 2, 28], [2026, 2, 18]].forEach(([y, m, d])=>{
			const t = tibetanDateOfDayNumber(jdn(y, m, d));
			expect([t.year, t.month, t.day]).toEqual([y, 1, 1]);
		});
	});
	it('年的五行生肖:2024 木阳龙,1027 火阴兔是第一胜生周第 1 年', ()=>{
		expect(tibetanYearInfo(2024)).toMatchObject({ element: '木', animal: '龙', male: true });
		expect(tibetanYearInfo(1027)).toMatchObject({ element: '火', animal: '兔', male: false, rabjung: 1, rabjungYear: 1 });
	});
});

describe('八卦 Parkha', ()=>{
	it('流年:女命一岁起坎逆行,男命一岁起离顺行(两条对照序列)', ()=>{
		const female = [1, 2, 3, 4, 5, 6, 7, 8].map((a)=>yearParkha(a, false).gua).join('');
		const male = [1, 2, 3, 4, 5, 6, 7, 8].map((a)=>yearParkha(a, true).gua).join('');
		expect(female).toBe('坎乾兑坤离巽震艮');
		expect(male).toBe('离坤兑乾坎艮震巽');
		expect(yearParkha(9, true).gua).toBe('离');
	});
	it('日八卦:正月初一坎,二月初一兑,三月初一离,四月初一震;逐日顺行', ()=>{
		expect([1, 2, 3, 4].map((m)=>dayParkha(m, 1).gua).join('')).toBe('坎兑离震');
		expect([1, 2, 3, 4, 5, 6, 7, 8].map((d)=>dayParkha(2, d).gua).join('')).toBe('兑乾坎艮震巽离坤');
	});
});

describe('九宫 Mewa', ()=>{
	it('1963 年本命一白;生命力 −3、个人力 +3', ()=>{
		expect(birthMewa(1963)).toBe(1);
		expect(mewaSet(1963, 2026)).toMatchObject({ birth: 1, vitality: 7, power: 4 });
	});
	it('下降九宫:阴年同本命,阳年按 1946 起数', ()=>{
		expect(mewaSet(1975, 2026).descending).toBe(birthMewa(1975));
		expect(mewaSet(1964, 2026).descending).toBe(9);
	});
});

describe('魂命煞', ()=>{
	it('鼠年:魂曜水(星期三)、命曜火、煞曜土', ()=>{
		const rows = forcesOf(0);
		expect(rows.length).toBe(9);
		expect(rows[0].value).toContain('水曜');
		expect(rows[1].value).toContain('火曜');
		expect(rows[2].value).toContain('土曜');
		expect(rows[3].value).toContain('箕');
	});
});

describe('Zurkhai', ()=>{
	it('相距位数 + 1,同支为 0(12 个对照例)', ()=>{
		[['丑', '子', 2], ['卯', '辰', 2], ['辰', '申', 5], ['巳', '子', 6], ['未', '辰', 4], ['申', '申', 0], ['酉', '子', 4], ['亥', '巳', 7], ['子', '申', 5], ['卯', '巳', 3]]
			.forEach(([y, m, v])=>expect(zurkhaiAspect(y, m)).toBe(v));
	});
});

describe('洛书流年', ()=>{
	it('8 年一循环,九格一律减 9,不出 0 和重复数', ()=>{
		for(let y = 2020; y < 2036; y += 1){
			const t = loshuTransit(1975, y);
			const values = t.cells.map((c)=>c.value);
			expect(new Set(values).size).toBe(9);
			expect(values.every((v)=>v >= 1 && v <= 9)).toBe(true);
			expect(t.cells.filter((c)=>c.active).length).toBe(1);
			expect(loshuTransit(1975, y + 8).cells.map((c)=>c.value)).toEqual(values);
		}
	});
});

describe('易卦星盘', ()=>{
	it('文王卦序:乾上坤下 12 否,坤上乾下 11 泰,离上坎下 64 未济', ()=>{
		expect(kingWen(7, 0)).toBe(12);
		expect(kingWen(0, 7)).toBe(11);
		expect(kingWen(5, 2)).toBe(64);
		expect(hexName(1)).toContain('乾');
		expect(hexName(2)).toContain('坤');
		expect(hexTrigrams(63)).toEqual({ upper: 2, lower: 5 });
	});
	it('度卦环 64 格两两不同,0° 是 19 临', ()=>{
		expect(new Set(DEGREE_HEX_RING).size).toBe(64);
		expect(degreeHexagram(0)).toBe(19);
		expect(degreeHexagram(359.99)).toBe(13);
		// 先天圆图:乾止于夏至、姤紧随其后;坤止于冬至、复紧随其后;乾坤正对
		expect(degreeHexagram(89.9)).toBe(1);
		expect(degreeHexagram(90.1)).toBe(44);
		expect(degreeHexagram(269.9)).toBe(2);
		expect(degreeHexagram(270.1)).toBe(24);
		expect(Math.abs(DEGREE_HEX_RING.indexOf(1) - DEGREE_HEX_RING.indexOf(2))).toBe(32);
	});
	it('星的三爻逐爻异或:地平上合上卦,地平下合下卦', ()=>{
		const [above] = ichingRows([{ id: 'Sun', lon: 1, house: 10 }], 'horizon');
		const [below] = ichingRows([{ id: 'Sun', lon: 1, house: 2 }], 'horizon');
		expect(above.toUpper).toBe(true);
		expect(below.toUpper).toBe(false);
		expect(above.degreeMerged).toBe(mergeTrigram(19, 7, true));
		expect(below.degreeMerged).toBe(mergeTrigram(19, 7, false));
		expect(ichingRows([{ id: 'Uranus', lon: 1, house: 2 }], 'horizon')).toEqual([]);
	});
	it('推运环位:出生当日 62,逐日前进', ()=>{
		expect(ichingProgression(0).position).toBe(62);
		expect(ichingProgression(3).position).toBe(1);
	});
});

describe('算命学 / 九星气学(取干支历的同一核心)', ()=>{
	const facts = eastAsiaFacts({ date: '1975/02/10', time: '21:15:00', zone: '-08:00', lat: '47n36', lon: '122w20' });
	it('三柱与节入日数', ()=>{
		expect(facts).toBeTruthy();
		const s = sanmeigaku(facts, 'common');
		expect(s.pillars.map((p)=>p.label)).toEqual(['日', '月', '年']);
		expect(s.pillars[2].gz).toBe('乙卯');           // 立春后,乙卯年
		expect(s.pillars[1].zhi).toBe('寅');
		expect(s.tenchusatsu.length).toBe(2);
		expect(s.hidden.every((h)=>h.ruler)).toBe(true);
	});
	it('本命星按立春年:1975 年七赤', ()=>{
		const k = nineStarKi(facts);
		expect(k.honmei).toBe(7);
		expect(k.monthIndex).toBe(1);
	});
	it('天中殺年按流年地支取', ()=>{
		const years = tenchusatsuYears(['子', '丑'], 2026, 4);
		expect(years.map((y)=>y.zhi).every((z)=>z === '子' || z === '丑')).toBe(true);
		expect(years[0].year).toBe(2032);
	});
});
