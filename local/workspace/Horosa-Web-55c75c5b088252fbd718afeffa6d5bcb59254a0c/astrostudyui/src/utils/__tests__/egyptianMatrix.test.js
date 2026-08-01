// 埃及压测矩阵 —— 七轴穷举 × 正交性 × 边界盘
// 正交性是本文件的核心:每个轴只应改它该改的面。轴间串扰(改 A 顺手改了 B)
// 在界面上极难看出,只有穷举比对派生结果才抓得到。
import {
	EGYPT_SCHOOL_AXES, EGYPT_SCHOOL_DEFAULT, deriveEgyptView, normalizeEgyptSchool,
} from '../../divination/data/egyptianSchools';
import { EGYPT_DECANS } from '../../divination/data/egyptianData';

// 真实盘形状(与真机同构)
const mkChart = (over = {}) => ({
	egyptianCalendar: { siriusRising: '2026-08-01' },
	chart: {
		geo: { lat: 26.07, lon: 119.32 },
		date: { date: { jdn: 2461247 }, time: { value: 11.5 }, utcoffset: { value: 8 }, jd: 2461246.6478 },
		objects: [
			{ id: 'Sun', lon: 122.5 }, { id: 'Moon', lon: 255.3 }, { id: 'Mercury', lon: 100.1 },
			{ id: 'Venus', lon: 160.9 }, { id: 'Mars', lon: 70.4 }, { id: 'Jupiter', lon: 128.8 },
			{ id: 'Saturn', lon: 18.2 },
		],
		angles: [{ id: 'Asc', lon: 212.0 }, { id: 'MC', lon: 128.0 }],
		...over,
	},
});
const CHART = mkChart();

// 从派生结果里抽出各「面」,用于逐面比对
const faces = (v) => ({
	decanIdentity: v.decans.map((d) => `${d.greek}|${d.signId}${d.decanInSign}|${d.range}`).sort().join(','),
	decanOrderAndNumber: v.decans.map((d) => `${d.number}:${d.greek}`).join(','),
	rulers: v.decans.map((d) => `${d.greek}=${d.ruler}`).sort().join(','),
	names: v.decans.map((d) => `${d.greek}=${d.primaryName}`).sort().join(','),
	pointDecans: v.points.map((p) => `${p.id}=${p.decan ? p.decan.greek : '-'}`).join(','),
	civil: v.civil ? `${v.civil.year}/${v.civil.dayOfYear}/${v.anchor.key}` : '-',
	sothic: v.sothic ? v.sothic.position.toFixed(3) : '-',
	god: `${v.godKey}`,
	clock: v.starClock.key,
	mod: `${v.petosirisMod}`,
});
const FACES = Object.keys(faces(deriveEgyptView(CHART, null)));

// 每轴「允许改变的面」白名单 —— 白名单之外的面必须逐字节不变
const ALLOWED = {
	decanRuler: ['rulers'],
	decanAnchor: ['decanOrderAndNumber'],
	decanNaming: ['names'],
	starClock: ['clock'],
	calendarAnchor: ['civil', 'sothic'],
	petosirisMod: ['mod'],
	godEdition: ['god'],
};

describe('七轴正交性(每轴只改它该改的面)', ()=>{
	const base = faces(deriveEgyptView(CHART, EGYPT_SCHOOL_DEFAULT));

	// 众神轴的两版只在少数日期段上分歧;要验它「不是死开关」,必须挑一个落在分歧段里的盘,
	// 否则同一日两版判归本就相同 —— 那是数据实情,不是开关失灵。
	const GOD_DIFF_CHART = mkChart({ date: { jd: 2461055.5, utcoffset: { value: 0 } } });   // 2026-01-15,变体版此日无归属
	const chartForAxis = (key)=>(key === 'godEdition' ? GOD_DIFF_CHART : CHART);

	EGYPT_SCHOOL_AXES.forEach((ax)=>{
		ax.options.slice(1).forEach((opt)=>{
			test(`${ax.label}=${opt.label}：只动 [${ALLOWED[ax.key].join('/')}]，其余面逐字节不变`, ()=>{
				const c = chartForAxis(ax.key);
				const b = faces(deriveEgyptView(c, EGYPT_SCHOOL_DEFAULT));
				const v = faces(deriveEgyptView(c, { ...EGYPT_SCHOOL_DEFAULT, [ax.key]: opt.value }));
				FACES.forEach((f)=>{
					if(ALLOWED[ax.key].indexOf(f) >= 0){ return; }
					expect(`${f}:${v[f]}`).toBe(`${f}:${b[f]}`);
				});
				// 该改的面里,至少一个真的改了(否则这轴是死开关)
				const moved = ALLOWED[ax.key].filter((f)=>v[f] !== b[f]);
				expect(moved.length).toBeGreaterThan(0);
			});
		});
	});

	test('众神两版:分歧段内判归不同,分歧段外判归相同(后者是数据实情,不得当成开关失灵)', ()=>{
		const inDiff = ['seamless', 'variant'].map((e)=>deriveEgyptView(GOD_DIFF_CHART, { godEdition: e }).godKey);
		expect(inDiff[0]).not.toBe(inDiff[1]);
		expect(inDiff[1]).toBe('');                       // 变体版该日无归属
		const outDiff = ['seamless', 'variant'].map((e)=>deriveEgyptView(CHART, { godEdition: e }).godKey);
		expect(outDiff[0]).toBe(outDiff[1]);
	});

	test('旬的身份(座/旬内序/度范围)在任何轴任何取值下都不变 —— 落旬是纯几何', ()=>{
		EGYPT_SCHOOL_AXES.forEach((ax)=>{
			ax.options.forEach((opt)=>{
				const v = deriveEgyptView(CHART, { ...EGYPT_SCHOOL_DEFAULT, [ax.key]: opt.value });
				expect(faces(v).decanIdentity).toBe(base.decanIdentity);
				expect(faces(v).pointDecans).toBe(base.pointDecans);
			});
		});
	});

	test('换锚定只重排不增删:36 旬的 greek 集合恒为 1..36', ()=>{
		['greek', 'ancient'].forEach((anchor)=>{
			const v = deriveEgyptView(CHART, { decanAnchor: anchor });
			expect(v.decans.map((d)=>d.greek).sort((a, b)=>a - b)).toEqual(EGYPT_DECANS.map((d)=>d.greek));
			expect(v.decans.map((d)=>d.number)).toEqual(Array.from({ length: 36 }, (_, i)=>i + 1));
		});
	});
});

describe('全轴笛卡尔积 288 组 × 结构完整性', ()=>{
	const vals = EGYPT_SCHOOL_AXES.map((ax)=>ax.options.map((o)=>o.value));
	const combos = [];
	const walk = (i, acc)=>{
		if(i === vals.length){ combos.push(acc); return; }
		vals[i].forEach((val)=>walk(i + 1, { ...acc, [EGYPT_SCHOOL_AXES[i].key]: val }));
	};
	walk(0, {});

	test('组合数 = 各轴取值数之积', ()=>{
		expect(combos.length).toBe(vals.reduce((a, b)=>a * b.length, 1));
		expect(combos.length).toBe(288);
	});

	test('288 组逐组:结构完整、无 NaN、无 undefined 串入文本', ()=>{
		combos.forEach((c)=>{
			const v = deriveEgyptView(CHART, c);
			expect(v.decans.length).toBe(36);
			expect(v.points.length).toBe(9);
			expect(v.ascDecan).toBeTruthy();
			expect(v.civil).toBeTruthy();
			expect(v.civil.text.indexOf('undefined')).toBe(-1);
			expect(v.civil.text.indexOf('NaN')).toBe(-1);
			expect(Number.isFinite(v.sothic.position)).toBe(true);
			expect(Number.isFinite(v.sothic.driftDays)).toBe(true);
			v.decans.forEach((d)=>{
				expect(typeof d.primaryName).toBe('string');
				expect(d.primaryName.length).toBeGreaterThan(0);
				expect(d.altNames.length).toBe(2);
				expect(typeof d.ruler).toBe('string');
				expect(d.number).toBeGreaterThanOrEqual(1);
				expect(d.number).toBeLessThanOrEqual(36);
			});
		});
	});

	test('288 组:diff 条数恒等于与默认档不同的轴数', ()=>{
		combos.forEach((c)=>{
			const v = deriveEgyptView(CHART, c);
			const expected = Object.keys(EGYPT_SCHOOL_DEFAULT).filter((k)=>c[k] !== EGYPT_SCHOOL_DEFAULT[k]).length;
			expect(v.diff.length).toBe(expected);
			expect(v.isDefault).toBe(expected === 0);
		});
	});
});

describe('边界盘与垃圾输入', ()=>{
	const CASES = [
		['极区北', mkChart({ geo: { lat: 78.2, lon: 15.6 } })],
		['极区南', mkChart({ geo: { lat: -77.8, lon: 166.7 } })],
		['赤道', mkChart({ geo: { lat: 0, lon: 0 } })],
		['无 geo', mkChart({ geo: undefined })],
		['无 angles', mkChart({ angles: [] })],
		['空 objects', mkChart({ objects: [] })],
		['0°与360°边界', mkChart({ objects: [{ id: 'Sun', lon: 0 }, { id: 'Moon', lon: 359.999 }] })],
		['负黄经', mkChart({ objects: [{ id: 'Sun', lon: -30 }] })],
		['超 360 黄经', mkChart({ objects: [{ id: 'Sun', lon: 725 }] })],
		['lon 为 null', mkChart({ objects: [{ id: 'Sun', lon: null }, { id: 'Moon', lon: 10 }] })],
	];
	CASES.forEach(([name, chart])=>{
		test(`${name}:默认档与全非默认档都不抛、无 NaN`, ()=>{
			[null, { decanRuler: 'triplicity', decanAnchor: 'ancient', decanNaming: 'hermes', starClock: 'transit', calendarAnchor: 'philip', petosirisMod: 30, godEdition: 'variant' }].forEach((sch)=>{
				const v = deriveEgyptView(chart, sch);
				expect(v.decans.length).toBe(36);
				v.points.forEach((p)=>{
					expect(Number.isFinite(p.lon)).toBe(true);
					expect(p.lon).toBeGreaterThanOrEqual(0);
					expect(p.lon).toBeLessThan(360);
					expect(p.decan).toBeTruthy();
				});
				if(v.civil){ expect(v.civil.text.indexOf('NaN')).toBe(-1); }
			});
		});
	});

	test('闰余日盘:落在年内第 361..365 日时旬列为 null 且不误报旬列号', ()=>{
		// 锚点 + 360..364 天 → 闰余 1..5
		const anchorJD = 1772027.5;
		for(let e = 1; e <= 5; e++){
			const jd = anchorJD + 359 + e;
			const c = mkChart({ date: { jd: jd + 0.5, utcoffset: { value: 0 } } });
			const v = deriveEgyptView(c, null);
			expect(v.civil.isEpagomenal).toBe(true);
			expect(v.civil.epagomenal).toBe(e);
			expect(v.civil.decade).toBeNull();
			expect(v.civil.text).toContain('闰余');
		}
	});

	test('垃圾 school:任意乱值都回默认档,派生结果与默认档逐面一致', ()=>{
		const base = faces(deriveEgyptView(CHART, EGYPT_SCHOOL_DEFAULT));
		[{ decanRuler: 123 }, { decanAnchor: [] }, { starClock: {} }, { calendarAnchor: 'ce140' },
			{ petosirisMod: '31' }, { godEdition: null }, { 未知键: 'x' }, 'string', 42, []].forEach((junk)=>{
			expect(normalizeEgyptSchool(junk)).toEqual(EGYPT_SCHOOL_DEFAULT);
			expect(faces(deriveEgyptView(CHART, junk))).toEqual(base);
		});
	});

	test('冲突组合:恒星序锚定 + 三分性主星 + 校勘名 + 过中天 + 腓力纪元 同开仍自洽', ()=>{
		const v = deriveEgyptView(CHART, {
			decanRuler: 'triplicity', decanAnchor: 'ancient', decanNaming: 'coptic',
			starClock: 'transit', calendarAnchor: 'philip', petosirisMod: 30, godEdition: 'variant',
		});
		expect(v.diff.length).toBe(7);
		expect(v.decans.length).toBe(36);
		expect(v.decans.map((d)=>d.number)).toEqual(Array.from({ length: 36 }, (_, i)=>i + 1));
		// 落旬仍是纯几何:上升 212° → 第 22 旬
		expect(v.ascDecan.greek).toBe(22);
		expect(v.civil.year).toBeGreaterThan(0);
	});
});
