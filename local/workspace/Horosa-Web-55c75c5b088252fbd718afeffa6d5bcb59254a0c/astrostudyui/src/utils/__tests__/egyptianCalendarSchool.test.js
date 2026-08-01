// 埃及民用历换算 / Sothic 定位 / 七轴流派单一真值源 —— 金标
// 铁律:默认档必须与改造前逐值一致(零回归),故本文件把「默认档 = 旧口径」逐条钉死。
import {
	julianCalendarJDN, jdFromGregorianYMD,
	EGYPT_CALENDAR_ANCHORS, EGYPT_CALENDAR_ANCHOR_DEFAULT, egyptAnchor,
	egyptCivilFromJD, jdFromEgyptCivil, sothicPosition,
	SOTHIC_CYCLE_YEARS, EGYPT_CIVIL_SEASONS, EGYPT_EPAGOMENAL,
	diagonalStar, transitStar, starClockStar, EGYPT_STAR_CLOCKS, STAR_CLOCK_TRANSIT_OFFSET,
	gregorianFromJD,
	EGYPT_DECANS, decanRulerAt, decanNumberAt,
} from '../../divination/data/egyptianData';
import {
	EGYPT_SCHOOL_AXES, EGYPT_SCHOOL_DEFAULT, normalizeEgyptSchool, isDefaultEgyptSchool,
	egyptSchoolDiff, deriveEgyptView, egyptBirthJD, readEgyptSchool, writeEgyptSchool,
	EGYPT_SCHOOL_STORAGE_KEY,
} from '../../divination/data/egyptianSchools';

describe('儒略日基元', ()=>{
	test('JD 原点自校验:前 4713 年 1 月 1 日儒略历 = JDN 0', ()=>{
		expect(julianCalendarJDN(-4712, 1, 1)).toBe(0);
	});
	test('格里历换算自校验:2000-01-01 = JD 2451544.5(0h)', ()=>{
		expect(jdFromGregorianYMD(2000, 1, 1)).toBe(2451544.5);
	});
	test('三锚点 JD 与独立核算一致', ()=>{
		// 与 Fliegel 儒略历公式手算逐值核对(见 egyptianData 注释)
		expect(EGYPT_CALENDAR_ANCHORS.ce139.jd).toBe(1772028 - 0.5);
		expect(EGYPT_CALENDAR_ANCHORS.nabonassar.jd).toBe(1448638 - 0.5);
		expect(EGYPT_CALENDAR_ANCHORS.philip.jd).toBe(1603398 - 0.5);
	});
	test('锚点默认 = ce139;非法 key 回落默认', ()=>{
		expect(EGYPT_CALENDAR_ANCHOR_DEFAULT).toBe('ce139');
		expect(egyptAnchor('不存在').key).toBe('ce139');
		expect(egyptAnchor(undefined).key).toBe('ce139');
	});
});

describe('民用历换算(游移年)', ()=>{
	const A = EGYPT_CALENDAR_ANCHORS.ce139.jd;

	test('锚点当日 = 1 年 泛滥季第 1 月(Thoth)1 日,旬列 0', ()=>{
		const c = egyptCivilFromJD(A, A);
		expect(c.year).toBe(1);
		expect(c.seasonIndex).toBe(0);
		expect(c.season).toBe('泛滥季');
		expect(c.monthName).toBe('Thoth');
		expect(c.month).toBe(1);
		expect(c.day).toBe(1);
		expect(c.dayOfYear).toBe(1);
		expect(c.decade).toBe(0);
		expect(c.isEpagomenal).toBe(false);
	});

	test('第 360 日 = 收获季第 4 月(Mesore)30 日,旬列 35', ()=>{
		const c = egyptCivilFromJD(A + 359, A);
		expect(c.dayOfYear).toBe(360);
		expect(c.seasonIndex).toBe(2);
		expect(c.monthName).toBe('Mesore');
		expect(c.day).toBe(30);
		expect(c.decade).toBe(35);
	});

	test('第 361–365 日 = 五闰余日,各系一神诞,不属任何旬列', ()=>{
		EGYPT_EPAGOMENAL.forEach(({ day, deity })=>{
			const c = egyptCivilFromJD(A + 359 + day, A);
			expect(c.isEpagomenal).toBe(true);
			expect(c.epagomenal).toBe(day);
			expect(c.deity).toBe(deity);
			expect(c.decade).toBeNull();
			expect(c.dayOfYear).toBe(360 + day);
		});
	});

	test('第 366 日进次年首日', ()=>{
		const c = egyptCivilFromJD(A + 365, A);
		expect(c.year).toBe(2);
		expect(c.dayOfYear).toBe(1);
		expect(c.monthName).toBe('Thoth');
	});

	test('锚点之前:前一日 = 0 年闰余第 5 日(负向 floor 除法正确)', ()=>{
		const c = egyptCivilFromJD(A - 1, A);
		expect(c.year).toBe(0);
		expect(c.dayOfYear).toBe(365);
		expect(c.isEpagomenal).toBe(true);
		expect(c.epagomenal).toBe(5);
	});

	test('负向跨多年仍自洽:锚点前 365 日 = 0 年首日', ()=>{
		const c = egyptCivilFromJD(A - 365, A);
		expect(c.year).toBe(0);
		expect(c.dayOfYear).toBe(1);
	});

	test('全年 365 日:dayOfYear 严格 1..365 且逐日递增无重无缺', ()=>{
		const seen = [];
		for(let i = 0; i < 365; i++){
			const c = egyptCivilFromJD(A + i, A);
			expect(c.year).toBe(1);
			expect(c.dayOfYear).toBe(i + 1);
			seen.push(c.dayOfYear);
		}
		expect(new Set(seen).size).toBe(365);
	});

	test('旬列覆盖:第 1..360 日恰好落 36 个旬列,每列 10 日', ()=>{
		const count = {};
		for(let i = 0; i < 360; i++){
			const c = egyptCivilFromJD(A + i, A);
			expect(c.decade).toBeGreaterThanOrEqual(0);
			expect(c.decade).toBeLessThanOrEqual(35);
			count[c.decade] = (count[c.decade] || 0) + 1;
		}
		expect(Object.keys(count).length).toBe(36);
		Object.keys(count).forEach((k)=>expect(count[k]).toBe(10));
	});

	test('往返恒等:三季×四月×30 日 + 五闰余,全年 365 日逐日 round-trip', ()=>{
		for(let y = -2; y <= 3; y++){
			for(let s = 0; s < 3; s++){
				for(let m = 1; m <= 4; m++){
					for(let d = 1; d <= 30; d++){
						const jd = jdFromEgyptCivil({ year: y, season: s, month: m, day: d }, A);
						const back = egyptCivilFromJD(jd, A);
						expect([back.year, back.seasonIndex, back.month, back.day]).toEqual([y, s, m, d]);
					}
				}
			}
			for(let e = 1; e <= 5; e++){
				const jd = jdFromEgyptCivil({ year: y, epagomenal: e }, A);
				const back = egyptCivilFromJD(jd, A);
				expect([back.year, back.isEpagomenal, back.epagomenal]).toEqual([y, true, e]);
			}
		}
	});

	// 三纪元互校:三者各自的「元年 1 Thoth」本是同一部连续游移历上的 1 Thoth,
	// 故彼此日差必为 365 的整倍数 —— 换锚点只改年号,不改月/日。
	// 这条恒等式反过来独立佐证三个锚点 JD 的相互自洽(任一算错即破)。
	test('三纪元同属一部连续游移历:日差为 365 整倍数(886 年 / 462 年 / 424 年)', ()=>{
		const { ce139, nabonassar, philip } = EGYPT_CALENDAR_ANCHORS;
		expect((ce139.jd - nabonassar.jd) / 365).toBe(886);
		expect((ce139.jd - philip.jd) / 365).toBe(462);
		expect((philip.jd - nabonassar.jd) / 365).toBe(424);
	});

	test('换锚点只改年号、不改月日(故显示层必须标注锚点方能复现)', ()=>{
		const jd = jdFromGregorianYMD(1991, 8, 6);
		const a = egyptCivilFromJD(jd, EGYPT_CALENDAR_ANCHORS.ce139.jd);
		const b = egyptCivilFromJD(jd, EGYPT_CALENDAR_ANCHORS.nabonassar.jd);
		const c = egyptCivilFromJD(jd, EGYPT_CALENDAR_ANCHORS.philip.jd);
		expect(a.monthName).toBe(b.monthName);
		expect(a.day).toBe(b.day);
		expect(a.dayOfYear).toBe(c.dayOfYear);
		expect(b.year - a.year).toBe(886);   // 同一日,那波那萨尔年号比重合纪年大 886
		expect(c.year - a.year).toBe(462);
	});

	test('非法输入不抛,返回 null', ()=>{
		expect(egyptCivilFromJD(NaN, A)).toBeNull();
		expect(egyptCivilFromJD(A, NaN)).toBeNull();
		expect(jdFromEgyptCivil({ year: 'x' }, A)).toBeNull();
		expect(jdFromEgyptCivil({ year: 1, season: 9, month: 9, day: 99 }, A)).toBeNull();
	});

	test('十二月名扁平序与三季四月一致', ()=>{
		const flat = [];
		EGYPT_CIVIL_SEASONS.forEach((s)=>s.months.forEach((m)=>flat.push(m)));
		expect(flat.length).toBe(12);
		for(let i = 0; i < 360; i += 30){
			const c = egyptCivilFromJD(A + i, A);
			expect(c.monthName).toBe(flat[i / 30]);
			expect(c.monthIndex).toBe(i / 30 + 1);
		}
	});
});

describe('Sothic 周期定位', ()=>{
	const A = EGYPT_CALENDAR_ANCHORS.ce139.jd;

	test('锚点处漂移为 0、周期位置为 0', ()=>{
		const s = sothicPosition(A, A);
		expect(s.driftDays).toBeCloseTo(0, 9);
		expect(s.position).toBeCloseTo(0, 9);
		expect(s.cycleIndex).toBe(0);
	});

	test('漂移律 1 天/4 年:4 儒略年后恰漂 1 日', ()=>{
		const s = sothicPosition(A + 365.25 * 4, A);
		expect(s.driftDays).toBeCloseTo(1, 9);
		const s40 = sothicPosition(A + 365.25 * 40, A);
		expect(s40.driftDays).toBeCloseTo(10, 9);
	});

	test('1460 儒略年后回到周期起点(下一周期)', ()=>{
		const s = sothicPosition(A + 365.25 * SOTHIC_CYCLE_YEARS, A);
		expect(s.position).toBeCloseTo(0, 6);
		expect(s.cycleIndex).toBe(1);
		expect(s.percent).toBeCloseTo(0, 6);
	});

	test('位置恒落 [0,1460),锚点之前也不出负', ()=>{
		[-5000, -1, 0, 1, 700, 1459.9, 3000].forEach((yy)=>{
			const s = sothicPosition(A + 365.25 * yy, A);
			expect(s.position).toBeGreaterThanOrEqual(0);
			expect(s.position).toBeLessThan(SOTHIC_CYCLE_YEARS);
			expect(s.percent).toBeGreaterThanOrEqual(0);
			expect(s.percent).toBeLessThan(100);
		});
	});

	test('民用历 1461 年 ≈ 儒略 1460 年(周期定义自洽)', ()=>{
		// 1461 个 365 日民用年 = 533265 日;1460 个儒略年 = 533265 日
		expect(1461 * 365).toBe(Math.round(SOTHIC_CYCLE_YEARS * 365.25));
	});
});

describe('星钟两法', ()=>{
	test('对角(升起)表:36×12 全格恒落 1..36', ()=>{
		for(let c = 1; c <= 36; c++){
			for(let h = 1; h <= 12; h++){
				const v = diagonalStar(c, h);
				expect(Number.isInteger(v)).toBe(true);
				expect(v).toBeGreaterThanOrEqual(1);
				expect(v).toBeLessThanOrEqual(36);
			}
		}
	});
	test('过中天表:36×12 全格合法,且恰为升起表位移 6 时位', ()=>{
		for(let c = 1; c <= 36; c++){
			for(let h = 1; h <= 12; h++){
				const v = transitStar(c, h);
				expect(v).toBeGreaterThanOrEqual(1);
				expect(v).toBeLessThanOrEqual(36);
				expect(v).toBe(diagonalStar(c, h - STAR_CLOCK_TRANSIT_OFFSET));
			}
		}
	});
	test('两法确有差异(非同一张表)', ()=>{
		let diff = 0;
		for(let c = 1; c <= 36; c++){ for(let h = 1; h <= 12; h++){ if(diagonalStar(c, h) !== transitStar(c, h)){ diff++; } } }
		expect(diff).toBe(36 * 12);
	});
	test('同一列内逐时 +1、同一时逐列 +1(对角推移律)', ()=>{
		expect(diagonalStar(5, 6)).toBe(((diagonalStar(5, 7) + 1 - 1) % 36) + 1);
		expect(diagonalStar(6, 6)).toBe(((diagonalStar(5, 6) + 1 - 1) % 36) + 1);
	});
	test('starClockStar 派发正确,非法 key 回落对角', ()=>{
		expect(starClockStar('diagonal', 3, 4)).toBe(diagonalStar(3, 4));
		expect(starClockStar('transit', 3, 4)).toBe(transitStar(3, 4));
		expect(starClockStar('乱码', 3, 4)).toBe(diagonalStar(3, 4));
		expect(Object.keys(EGYPT_STAR_CLOCKS)).toEqual(['diagonal', 'transit']);
	});
});

describe('七轴流派:默认档零回归', ()=>{
	test('轴清单 7 条,每轴首项 = 默认值', ()=>{
		expect(EGYPT_SCHOOL_AXES.length).toBe(7);
		EGYPT_SCHOOL_AXES.forEach((ax)=>{
			expect(ax.options.length).toBeGreaterThanOrEqual(2);
			expect(ax.options[0].value).toBe(EGYPT_SCHOOL_DEFAULT[ax.key]);
			ax.options.forEach((o)=>{ expect(typeof o.label).toBe('string'); expect(o.label.length).toBeGreaterThan(0); });
		});
	});

	test('默认档 = 改造前固定口径:主星=面主、旬序=黄道序、主显名=埃及本名', ()=>{
		const d = EGYPT_SCHOOL_DEFAULT;
		EGYPT_DECANS.forEach((dec)=>{
			expect(decanRulerAt(dec, d.decanRuler)).toBe(dec.face);
			expect(decanNumberAt(dec, d.decanAnchor)).toBe(dec.greek);
		});
		expect(d.starClock).toBe('diagonal');
		expect(d.petosirisMod).toBe(29);
		expect(d.godEdition).toBe('seamless');
		expect(d.calendarAnchor).toBe('ce139');
		expect(d.decanNaming).toBe('egypt');
	});

	test('normalize:垃圾输入/缺键/null 全回落默认档', ()=>{
		[null, undefined, 0, 'x', [], { decanRuler: '乱码', petosirisMod: 7 }].forEach((raw)=>{
			expect(normalizeEgyptSchool(raw)).toEqual(EGYPT_SCHOOL_DEFAULT);
		});
		expect(isDefaultEgyptSchool(null)).toBe(true);
	});

	test('normalize:petosirisMod 接受字符串数字(控件/存储回灌)', ()=>{
		expect(normalizeEgyptSchool({ petosirisMod: '30' }).petosirisMod).toBe(30);
		expect(normalizeEgyptSchool({ petosirisMod: '31' }).petosirisMod).toBe(29);
	});

	test('每轴每个合法取值都可被 normalize 保留(全取值遍历)', ()=>{
		EGYPT_SCHOOL_AXES.forEach((ax)=>{
			ax.options.forEach((o)=>{
				expect(normalizeEgyptSchool({ [ax.key]: o.value })[ax.key]).toBe(o.value);
			});
		});
	});

	test('diff 只列非默认轴', ()=>{
		expect(egyptSchoolDiff(EGYPT_SCHOOL_DEFAULT)).toEqual([]);
		const d = egyptSchoolDiff({ decanRuler: 'triplicity', starClock: 'transit' });
		expect(d.map((x)=>x.key).sort()).toEqual(['decanRuler', 'starClock']);
		expect(isDefaultEgyptSchool({ decanRuler: 'triplicity' })).toBe(false);
	});
});

describe('deriveEgyptView 单一真值源', ()=>{
	const CHART = {
		date: { year: 1991, month: 8, day: 6 },
		egyptianCalendar: { siriusRising: '1991-08-06', decanIndex: 11 },
		chart: {
			objects: [
				{ id: 'Sun', lon: 133.5 }, { id: 'Moon', lon: 12.0 }, { id: 'Mercury', lon: 150.2 },
				{ id: 'Venus', lon: 95.0 }, { id: 'Mars', lon: 200.0 }, { id: 'Jupiter', lon: 129.9 },
				{ id: 'Saturn', lon: 310.4 },
			],
			angles: [{ id: 'Asc', lon: 25.0 }, { id: 'MC', lon: 295.0 }],
		},
	};

	test('默认档:旬表 36 行、编号 = 黄道序、主星 = 面主、主显名 = 埃及本名', ()=>{
		const v = deriveEgyptView(CHART, null);
		expect(v.isDefault).toBe(true);
		expect(v.decans.length).toBe(36);
		v.decans.forEach((d)=>{
			expect(d.number).toBe(d.greek);
			expect(d.ruler).toBe(d.face);
			expect(d.primaryName).toBe(d.egyptName);
			expect(d.altNames.length).toBe(2);
		});
		expect(v.decans.map((d)=>d.greek)).toEqual(EGYPT_DECANS.map((d)=>d.greek));
	});

	test('本盘落旬:上升 25° → 白羊第 3 旬(第 3 旬)', ()=>{
		const v = deriveEgyptView(CHART, null);
		expect(v.asc.id).toBe('Asc');
		expect(v.ascDecan.greek).toBe(3);
		expect(v.ascDecan.signId).toBe('aries');
		expect(v.ascDecan.decanInSign).toBe(3);
		expect(v.ascTalisman).toBeTruthy();
		expect(v.points.length).toBe(9);
		v.points.forEach((p)=>{ expect(p.decan).toBeTruthy(); });
	});

	test('切旬主星制 → 各点主星随变,落旬本身不变(锚定/落旬与主星制正交)', ()=>{
		const a = deriveEgyptView(CHART, null);
		const b = deriveEgyptView(CHART, { decanRuler: 'triplicity' });
		expect(b.points.map((p)=>p.decan.greek)).toEqual(a.points.map((p)=>p.decan.greek));
		const changed = b.decans.filter((d, i)=>d.ruler !== a.decans[i].ruler).length;
		expect(changed).toBeGreaterThan(0);
	});

	test('切旬序锚定 → 表序与编号改变,greek 标识不丢', ()=>{
		const v = deriveEgyptView(CHART, { decanAnchor: 'ancient' });
		expect(v.decans.length).toBe(36);
		expect(v.decans.map((d)=>d.number)).toEqual(Array.from({ length: 36 }, (_, i)=>i + 1));
		expect(new Set(v.decans.map((d)=>d.greek)).size).toBe(36);
		expect(v.decans.map((d)=>d.greek)).not.toEqual(EGYPT_DECANS.map((d)=>d.greek));
	});

	test('切名录传统 → 主显名与副名互换,且三名并集恒定', ()=>{
		const a = deriveEgyptView(CHART, null);
		const c = deriveEgyptView(CHART, { decanNaming: 'coptic' });
		expect(c.decans[0].primaryName).toBe(EGYPT_DECANS[0].copticGreek);
		expect(c.decans[0].altNames).toContain(EGYPT_DECANS[0].egyptName);
		const setA = new Set([a.decans[0].primaryName, ...a.decans[0].altNames]);
		const setC = new Set([c.decans[0].primaryName, ...c.decans[0].altNames]);
		expect([...setA].sort()).toEqual([...setC].sort());
	});

	test('民用历/Sothic 随锚点变;天狼偕日升只回显 Python 值不自算', ()=>{
		const a = deriveEgyptView(CHART, null);
		expect(a.anchor.key).toBe('ce139');
		expect(a.civil).toBeTruthy();
		expect(a.civil.year).toBeGreaterThan(1);
		expect(a.sothic.driftDays).toBeGreaterThan(0);
		expect(a.sirius.date).toBe('1991-08-06');
		expect(a.sirius.deltaDays).toBe(0);  // 出生日恰为该年偕日升日
		const b = deriveEgyptView(CHART, { calendarAnchor: 'philip' });
		expect(b.civil.year).not.toBe(a.civil.year);
		expect(b.anchor.key).toBe('philip');
	});

	test('众神:1991-08-06 落无缺口版的 Horus 段(8/12–8/19)之前 → Sekhmet 段', ()=>{
		const v = deriveEgyptView(CHART, null);
		expect(v.godKey).toBe('Sekhmet');
		expect(v.god.cn).toBe('塞赫麦特');
	});

	test('缺日期/空盘不抛,派生降级为 null', ()=>{
		const v = deriveEgyptView({}, null);
		expect(v.points.length).toBe(0);
		expect(v.ascDecan).toBeNull();
		expect(v.civil).toBeNull();
		expect(v.sothic).toBeNull();
		expect(v.godKey).toBe('');
		expect(v.decans.length).toBe(36);   // 静态表仍在
		expect(deriveEgyptView(null, null).points.length).toBe(0);
		expect(deriveEgyptView(undefined, { decanRuler: '乱' }).isDefault).toBe(true);
	});

	test('egyptBirthJD:对象日期与字符串日期两路都认,非法返回 null', ()=>{
		expect(egyptBirthJD({ date: { year: 2000, month: 1, day: 1 } }).jd).toBe(2451544.5);
		expect(egyptBirthJD({ dateText: '2000-01-01 12:00' }).jd).toBe(2451544.5);
		expect(egyptBirthJD({ date: { year: 2000, month: 13, day: 1 } })).toBeNull();
		expect(egyptBirthJD({})).toBeNull();
		expect(egyptBirthJD(null)).toBeNull();
	});

	// ↓ 真机抓出的接线缺口:真实盘的日期在 chart.date.jd(世界时)+utcoffset,
	//   不是 {year,month,day}。曾因此整卡降级为「本盘无可用出生日期」。
	test('egyptBirthJD:认真实盘结构 chart.date{jd,utcoffset},按当地日界取整日', ()=>{
		// 真机实测样本:2026-07-25 11:32 (+8) → jd(UT)=2461246.6478、当地 JDN=2461247
		const real = { chart: { date: { date: { jdn: 2461247 }, time: { value: 11.547 }, utcoffset: { value: 8 }, jd: 2461246.6478009257 } } };
		const b = egyptBirthJD(real);
		expect(b).toBeTruthy();
		expect([b.year, b.month, b.day]).toEqual([2026, 7, 25]);
		expect(b.jd).toBe(2461246.5);                       // 当地民用日 0h
	});

	test('egyptBirthJD:时区偏移真的参与日界判定(同一 UT 时刻,东西两区落不同民用日)', ()=>{
		const utNight = 2461246.9;                          // 该 UT 时刻在东区已过日界、西区未到
		const east = egyptBirthJD({ chart: { date: { jd: utNight, utcoffset: { value: 14 } } } });
		const west = egyptBirthJD({ chart: { date: { jd: utNight, utcoffset: { value: -11 } } } });
		expect(east.day - west.day).toBe(1);
	});

	test('egyptBirthJD:无 jd 时回落后端已给的当地 JDN', ()=>{
		const b = egyptBirthJD({ chart: { date: { date: { jdn: 2451545 } } } });
		expect([b.year, b.month, b.day]).toEqual([2000, 1, 1]);
	});

	test('gregorianFromJD 与 jdFromGregorianYMD 互逆(跨世纪/闰年/多锚点)', ()=>{
		[[2000, 1, 1], [1900, 3, 1], [2026, 7, 25], [1600, 2, 29], [1583, 1, 1], [2400, 12, 31]].forEach(([y, m, d])=>{
			const jd = jdFromGregorianYMD(y, m, d);
			expect(gregorianFromJD(jd)).toEqual({ year: y, month: m, day: d });
		});
		expect(gregorianFromJD(NaN)).toBeNull();
	});

	test('gregorianFromJD:逐日连续 800 天无跳日、无重日', ()=>{
		const start = jdFromGregorianYMD(2023, 11, 20);
		const seen = new Set();
		for(let i = 0; i < 800; i++){
			const g = gregorianFromJD(start + i);
			const key = `${g.year}-${g.month}-${g.day}`;
			expect(seen.has(key)).toBe(false);
			seen.add(key);
			expect(jdFromGregorianYMD(g.year, g.month, g.day)).toBe(start + i);
		}
	});

	test('全轴笛卡尔积(2×2×3×2×3×2×2=288 组)皆不抛且结构完整', ()=>{
		let n = 0;
		const vals = EGYPT_SCHOOL_AXES.map((ax)=>ax.options.map((o)=>o.value));
		const walk = (i, acc)=>{
			if(i === vals.length){
				const v = deriveEgyptView(CHART, acc);
				expect(v.decans.length).toBe(36);
				expect(v.points.length).toBe(9);
				expect(v.anchor).toBeTruthy();
				expect(v.starClock).toBeTruthy();
				expect([29, 30]).toContain(v.petosirisMod);
				expect(v.diff.length).toBe(Object.keys(EGYPT_SCHOOL_DEFAULT)
					.filter((k)=>acc[k] !== EGYPT_SCHOOL_DEFAULT[k]).length);
				n++;
				return;
			}
			vals[i].forEach((val)=>walk(i + 1, { ...acc, [EGYPT_SCHOOL_AXES[i].key]: val }));
		};
		walk(0, {});
		expect(n).toBe(288);
	});
});

describe('流派持久化', ()=>{
	const mem = ()=>{
		const box = {};
		return { getItem: (k)=>(k in box ? box[k] : null), setItem: (k, v)=>{ box[k] = v; }, box };
	};
	test('写入后读回一致;键名固定', ()=>{
		const st = mem();
		const s = { decanRuler: 'triplicity', calendarAnchor: 'philip' };
		writeEgyptSchool(st, s);
		expect(st.box[EGYPT_SCHOOL_STORAGE_KEY]).toBeTruthy();
		const back = readEgyptSchool(st);
		expect(back.decanRuler).toBe('triplicity');
		expect(back.calendarAnchor).toBe('philip');
		expect(back.godEdition).toBe(EGYPT_SCHOOL_DEFAULT.godEdition);
	});
	test('损坏 JSON / 无 storage / 抛异常的 storage 一律回默认档,不抛', ()=>{
		const bad = { getItem: ()=>'{不是JSON', setItem: ()=>{} };
		expect(readEgyptSchool(bad)).toEqual(EGYPT_SCHOOL_DEFAULT);
		expect(readEgyptSchool(null)).toEqual(EGYPT_SCHOOL_DEFAULT);
		const boom = { getItem: ()=>{ throw new Error('quota'); }, setItem: ()=>{ throw new Error('quota'); } };
		expect(readEgyptSchool(boom)).toEqual(EGYPT_SCHOOL_DEFAULT);
		expect(()=>writeEgyptSchool(boom, {})).not.toThrow();
		expect(()=>writeEgyptSchool(null, {})).not.toThrow();
	});
});

/* ============================================================
 * AI 段端到端:buildEgyptSectionLines 与页面同源、随流派、默认档零变
 * (四链的①导出/③挂载共用此函数,故此处即为两链的内容判据)
 * ============================================================ */
describe('AI 埃及历段', ()=>{
	// 真实盘形状(与真机实测同构):日期在 chart.date、点在 chart.objects/angles
	const CHART = {
		egyptianCalendar: { siriusRising: '2026-08-01' },
		chart: {
			date: { date: { jdn: 2461247 }, time: { value: 11.5 }, utcoffset: { value: 8 }, jd: 2461246.6478 },
			objects: [{ id: 'Sun', lon: 122.5 }, { id: 'Moon', lon: 255.3 }, { id: 'Saturn', lon: 12.0 }],
			angles: [{ id: 'Asc', lon: 205.0 }],
		},
	};
	// eslint-disable-next-line global-require
	const { buildEgyptSectionLines } = require('../../components/astro/AstroEgypt');

	test('默认档:出段且不写「所用口径」行(零回归 —— 与流派功能上线前同形)', ()=>{
		const lines = buildEgyptSectionLines(CHART, null);
		expect(lines.length).toBeGreaterThan(0);
		expect(lines.some((l)=>l.indexOf('所用口径') >= 0)).toBe(false);
		expect(lines[0]).toBe('◆ 各行星落旬');
	});

	test('默认档含民用历三事实:埃及民用日(带锚点)/Sothic 定位/天狼偕日升', ()=>{
		const lines = buildEgyptSectionLines(CHART, null);
		const txt = lines.join('\n');
		expect(txt).toContain('◆ 埃及民用历');
		expect(txt).toContain('锚点：公元 139 年重合点');
		expect(txt).toContain('Sothic 周期');
		expect(txt).toContain('天狼偕日升：2026-08-01');
		expect(txt).toContain('本盘生日距其 -7 日');   // 生日 7/25 在偕日升 8/1 之前
	});

	test('非默认档:首行写明所用口径,且落旬主星随之改变', ()=>{
		const lines = buildEgyptSectionLines(CHART, { decanRuler: 'triplicity', calendarAnchor: 'philip' });
		expect(lines[0].indexOf('◆ 所用口径')).toBe(0);
		expect(lines[0]).toContain('旬主星制');
		expect(lines[0]).toContain('历法锚点');
		expect(lines.join('\n')).toContain('锚点：腓力纪元');
	});

	test('换旬序锚定 → 段内旬号整体改变(不是只改标签)', ()=>{
		const a = buildEgyptSectionLines(CHART, null).filter((l)=>l.indexOf('第') === 0 || l.indexOf('：第') > 0);
		const b = buildEgyptSectionLines(CHART, { decanAnchor: 'ancient' }).filter((l)=>l.indexOf('第') === 0 || l.indexOf('：第') > 0);
		expect(a.length).toBe(b.length);
		expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
	});

	test('无点位 → 返回空数组(不产空段)', ()=>{
		expect(buildEgyptSectionLines({}, null)).toEqual([]);
		expect(buildEgyptSectionLines(null, null)).toEqual([]);
	});

	test('段内不出现章节号与「手册」字样(公开技法红线)', ()=>{
		const txt = buildEgyptSectionLines(CHART, { decanNaming: 'hermes', starClock: 'transit' }).join('\n');
		expect(txt.indexOf('§')).toBe(-1);
		expect(txt.indexOf('手册')).toBe(-1);
	});
});

/* ============================================================
 * 随盘保真(G8):存盘捕获 → 回放 fields → 快照优先级
 * ============================================================ */
describe('埃及流派随盘保真(record 七键)', ()=>{
	const { egyptSchoolToRecordValues, egyptSchoolFromFields, EGYPT_RECORD_KEYS } = require('../../divination/data/egyptianSchools');
	const { buildLocalChartRecord } = require('../localcharts');
	const { applyRecordToFields } = require('../recordFieldsRestore');
	const { writeEgyptSchool, EGYPT_SCHOOL_STORE } = require('../../divination/data/egyptianSchools');

	afterEach(()=>{ writeEgyptSchool(EGYPT_SCHOOL_STORE, null); });   // 还原全局默认档

	it('捕获:全默认 → {}(零键,旧记录语义不变);非默认 → 仅差异轴落键', ()=>{
		expect(egyptSchoolToRecordValues(null)).toEqual({});
		const v = egyptSchoolToRecordValues({ decanRuler: 'triplicity', petosirisMod: 30 });
		expect(v).toEqual({ egypt_decanRuler: 'triplicity', egypt_petosirisMod: 30 });
	});

	it('存盘:全局默认档 → 七键全 undefined;全局非默认 → 对应键入 record', ()=>{
		const base = { birth: '1991-08-06 12:00:00', name: 'T' };
		const r0 = buildLocalChartRecord(base);
		EGYPT_RECORD_KEYS.forEach((k)=>expect(r0[k]).toBeUndefined());
		writeEgyptSchool(EGYPT_SCHOOL_STORE, { calendarAnchor: 'philip' });
		const r1 = buildLocalChartRecord(base);
		expect(r1.egypt_calendarAnchor).toBe('philip');
		expect(r1.egypt_decanRuler).toBeUndefined();
	});

	it('values 显式提供(挂载 merge 场景)优先于全局', ()=>{
		writeEgyptSchool(EGYPT_SCHOOL_STORE, { calendarAnchor: 'philip' });
		const r = buildLocalChartRecord({ birth: '1991-08-06 12:00:00', egypt_calendarAnchor: 'nabonassar' });
		expect(r.egypt_calendarAnchor).toBe('nabonassar');
	});

	it('回放:record 七键经 applyRecordToFields 进 fields;egyptSchoolFromFields 组回流派', ()=>{
		const fields = applyRecordToFields({}, { egypt_decanRuler: 'triplicity', egypt_petosirisMod: 30 });
		const s = egyptSchoolFromFields(fields);
		expect(s.decanRuler).toBe('triplicity');
		expect(s.petosirisMod).toBe(30);
		expect(s.godEdition).toBe('seamless');   // 缺轴回默认
	});

	it('fields 无任何 egypt_* 键 → null(调用方回落全局,零回归)', ()=>{
		expect(egyptSchoolFromFields({})).toBeNull();
		expect(egyptSchoolFromFields({ termsVariant: { value: 1 } })).toBeNull();
		expect(egyptSchoolFromFields(null)).toBeNull();
	});

	it('AI 段三级优先:fields 键在 → 按盘;不在 → 全局(与 astroAiSnapshot 接线同构)', ()=>{
		const { currentEgyptSchool } = require('../../divination/data/egyptianSchools');
		writeEgyptSchool(EGYPT_SCHOOL_STORE, { starClock: 'transit' });
		const fromFields = egyptSchoolFromFields({ egypt_starClock: { value: 'diagonal' } });
		const resolved = fromFields || currentEgyptSchool();
		expect(resolved.starClock).toBe('diagonal');   // 盘键赢
		const resolved2 = egyptSchoolFromFields({}) || currentEgyptSchool();
		expect(resolved2.starClock).toBe('transit');   // 回落全局
	});
});
