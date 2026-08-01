// 一掌经 QA · 逐开关「真生效」证明（防死开关）。
// 对每个开关，遍历生辰池，断言「存在生辰使切换该开关→输出确变」（计算类）
// 或「显示字段确变而盘算内部键不变」（显示层）。规格对照见各 test 标题。
import { calcYizhangjing, BRANCHES } from '../yizhangjingLocal';
import { buildYizhangjingModel, buildYizhangjingSnapshotText } from '../yizhangjingReport';

// 生辰池（引擎级：年支×月×日×时支×性别）
const YB = BRANCHES;
const MO = [1, 5, 11];
const DA = [7, 17, 26];
const HB = ['子', '卯', '未', '酉'];
const GE = ['男', '女'];
function eachBirth(fn) {
	for (const yb of YB) for (const m of MO) for (const d of DA) for (const hb of HB) for (const g of GE) {
		const r = fn({ yearBranch: yb, month: m, day: d, hourBranch: hb, gender: g });
		if (r === true) return true;
	}
	return false;
}
// 存在生辰使 A/B 两 opts 下 project 不同
function existsCalcDiff(optsA, optsB, project) {
	return eachBirth((b) => {
		const a = calcYizhangjing({ ...b, opts: optsA });
		const c = calcYizhangjing({ ...b, opts: optsB });
		return a && c && project(a) !== project(c);
	});
}
// 对全生辰池：A/B 下 project 恒等（显示层不改盘算）
function alwaysCalcSame(optsA, optsB, project) {
	let ok = true;
	eachBirth((b) => {
		const a = calcYizhangjing({ ...b, opts: optsA });
		const c = calcYizhangjing({ ...b, opts: optsB });
		if (a && c && project(a) !== project(c)) { ok = false; return true; }
		return false;
	});
	return ok;
}

// 合成 bazi（report 级：神煞用 day干/month支，jieqi 用 month支）
function bz(o) {
	return {
		nongli: { yearGZByLunar: o.y, shengXiaoLunar: o.z || '马', monthNum: o.m, dayNum: o.d, leap: !!o.leap, clockTime: o.ct || '1990-01-01 09:00:00' },
		fourColumns: { time: { ganzi: o.t }, day: { ganzi: o.dd || '甲子' }, month: { ganzi: o.mo || '丙午' }, year: { ganzi: o.yy || '庚午' } },
		gender: o.g || 'Male',
	};
}
const snap = (bazi, opts) => buildYizhangjingSnapshotText(buildYizhangjingModel(bazi, opts));

describe('一掌经 QA · 排盘/命宫开关真生效', () => {
	test('顺逆规则：阴年男女下四柱四宫方向不同', () => {
		expect(existsCalcDiff(
			{ shunniRule: 'yangNanYinNv', mingGongMethod: 'shuZhiMao' },
			{ shunniRule: 'menShunNvNi', mingGongMethod: 'shuZhiMao' },
			(m) => m.pillars.map((p) => p.star).join(''),
		)).toBe(true);
	});
	test('命宫定法：时上起命↔数至卯 命宫可不同', () => {
		expect(existsCalcDiff({ mingGongMethod: 'shiShang' }, { mingGongMethod: 'shuZhiMao' }, (m) => m.mingBranch)).toBe(true);
	});
	test('早子调宫：子时盘 时宫随之变', () => {
		expect(existsCalcDiff({ zaoZiAdjust: false }, { zaoZiAdjust: true }, (m) => JSON.stringify(m.fourIdx))).toBe(true);
	});
	test('品级分类：变体(天驿归下)改品级分布/等第/命格', () => {
		expect(existsCalcDiff({ gradeSet: 'standard' }, { gradeSet: 'variant' }, (m) => `${JSON.stringify(m.gradeCount)}|${m.fourPalaceRank}|${m.mingGe}`)).toBe(true);
	});
	test('定月法：农历月↔节气月 月宫起点变(月支异之盘)', () => {
		// 月支=戊辰(辰,jieqi=3月) 而 nongli=5月 → 两法四柱不同
		const bz2 = bz({ y: '丁巳', z: '蛇', m: 5, d: 17, t: '己酉', mo: '戊辰' });
		const n = buildYizhangjingModel(bz2, { dingYue: 'nongli', mingGongMethod: 'shuZhiMao' });
		const j = buildYizhangjingModel(bz2, { dingYue: 'jieqi', mingGongMethod: 'shuZhiMao' });
		expect(n.chart.pillars.map((p) => p.star).join('')).not.toBe(j.chart.pillars.map((p) => p.star).join(''));
	});
	test('闰月细则：十五折半↔夜半折半 —— 闰月十五晚子(00:xx)归属月变', () => {
		const b15 = bz({ y: '丁巳', z: '蛇', m: 5, d: 15, t: '丙子', leap: true, ct: '1990-01-01 00:30:00' });
		const h = buildYizhangjingModel(b15, { leapRule: 'half', mingGongMethod: 'shuZhiMao' });
		const m = buildYizhangjingModel(b15, { leapRule: 'midnight', mingGongMethod: 'shuZhiMao' });
		expect(h.input.month).not.toBe(m.input.month); // 晚子:half=本月/midnight=下月
		// 十五早子(23:xx) 两法应同(早子不进下月)
		const b15e = bz({ y: '丁巳', z: '蛇', m: 5, d: 15, t: '丙子', leap: true, ct: '1990-01-01 23:30:00' });
		const he = buildYizhangjingModel(b15e, { leapRule: 'half', mingGongMethod: 'shuZhiMao' });
		const me = buildYizhangjingModel(b15e, { leapRule: 'midnight', mingGongMethod: 'shuZhiMao' });
		expect(he.input.month).toBe(me.input.month);
	});
});

describe('一掌经 QA · 推运开关真生效', () => {
	test('大限运长：7↔10 大限区间变', () => {
		expect(existsCalcDiff({ dayunLength: 7 }, { dayunLength: 10 }, (m) => m.dayun[1].from)).toBe(true);
	});
	test('大限起运：秘传↔1岁 命宫厄/刃/破/孤 盘首运岁变', () => {
		expect(existsCalcDiff(
			{ dayunStartAge: 'mi', mingGongMethod: 'shuZhiMao' },
			{ dayunStartAge: 'age1', mingGongMethod: 'shuZhiMao' },
			(m) => m.dayun[0].from,
		)).toBe(true);
	});
	test('小限起宫：日柱宫↔月柱宫 起点变', () => {
		expect(existsCalcDiff({ xiaoxianStart: 'ri' }, { xiaoxianStart: 'yue' }, (m) => m.xiaoStartIdx)).toBe(true);
	});
});

describe('一掌经 QA · 显示层开关(只换名不改盘算)', () => {
	test('星名系统 B/C：显示 aliasMap 变，但盘算内部星键(pillars.star)恒不变', () => {
		// 盘算键恒同（显示层不改盘）
		expect(alwaysCalcSame({ starNaming: 'A' }, { starNaming: 'B' }, (m) => m.pillars.map((p) => p.star).join(''))).toBe(true);
		expect(alwaysCalcSame({ starNaming: 'A' }, { starNaming: 'C' }, (m) => m.pillars.map((p) => p.star).join(''))).toBe(true);
		// 显示 aliasMap 确变（B 系有异名）
		const a = buildYizhangjingModel(bz({ y: '丁巳', z: '蛇', m: 5, d: 17, t: '己酉' }), { starNaming: 'A' });
		const b = buildYizhangjingModel(bz({ y: '丁巳', z: '蛇', m: 5, d: 17, t: '己酉' }), { starNaming: 'B' });
		expect(JSON.stringify(a.aliasMap)).not.toBe(JSON.stringify(b.aliasMap));
	});
	test('六道术语 gui/edao：daoRows.term 变，chart.dao(内部)不变', () => {
		expect(alwaysCalcSame({ daoTerm: 'gui' }, { daoTerm: 'edao' }, (m) => m.pillars.map((p) => p.dao).join(''))).toBe(true);
		const a = buildYizhangjingModel(bz({ y: '丁巳', z: '蛇', m: 5, d: 17, t: '己酉' }), { daoTerm: 'gui' });
		const b = buildYizhangjingModel(bz({ y: '丁巳', z: '蛇', m: 5, d: 17, t: '己酉' }), { daoTerm: 'edao' });
		expect(JSON.stringify(a.daoRows.map((d) => d.term))).not.toBe(JSON.stringify(b.daoRows.map((d) => d.term)));
	});
});

describe('一掌经 QA · 快照层开关真生效(右栏/AI 同源)', () => {
	const B = { y: '丁巳', z: '蛇', m: 5, d: 17, t: '己酉' };
	test('逐年法互斥：xiaoxian 出小限藏流年神；liunian 反之', () => {
		const sx = snap(bz(B), { annualMethod: 'xiaoxian', mingGongMethod: 'shuZhiMao' });
		const sl = snap(bz(B), { annualMethod: 'liunian', mingGongMethod: 'shuZhiMao' });
		expect(sx).not.toBe(sl);
		expect(sx).toMatch(/小限一宫一年/);
		expect(sx).not.toMatch(/流年十二神（/);
		expect(sl).toMatch(/流年十二神（/);
		expect(sl).not.toMatch(/小限一宫一年/);
	});
	test('小限顺逆：随盘向↔一律顺行 小限行确变', () => {
		let found = false;
		eachBirth((b) => {
			const bazi = bz({ y: b.yearBranch, z: '马', m: b.month, d: b.day, t: '己' + b.hourBranch, g: b.gender === '男' ? 'Male' : 'Female' });
			const c = snap(bazi, { annualMethod: 'xiaoxian', xiaoxianDir: 'chart', mingGongMethod: 'shuZhiMao' });
			const a = snap(bazi, { annualMethod: 'xiaoxian', xiaoxianDir: 'always', mingGongMethod: 'shuZhiMao' });
			if (c !== a) { found = true; return true; }
			return false;
		});
		expect(found).toBe(true);
	});
	test('流年十二神 A/B/C：值神段确变', () => {
		const sA = snap(bz(B), { annualMethod: 'liunian', flowShenSet: 'A', mingGongMethod: 'shuZhiMao' });
		const sB = snap(bz(B), { annualMethod: 'liunian', flowShenSet: 'B', mingGongMethod: 'shuZhiMao' });
		expect(sA).not.toBe(sB);
	});
	test('神煞合参层：关↔开 快照【神煞合参】段隐现', () => {
		const off = snap(bz(B), { shenshaLayer: false, mingGongMethod: 'shuZhiMao' });
		const on = snap(bz(B), { shenshaLayer: true, mingGongMethod: 'shuZhiMao' });
		expect(off).not.toMatch(/【神煞合参】/);
		expect(on).toMatch(/【神煞合参】/);
	});
	test('童限开关：有童限盘 关→不出【童限】、开→出（tongxianShow 真门控，非死开关）', () => {
		let checked = false;
		for (const yb of YB) {
			for (const hb of YB) {
				const bazi = bz({ y: yb, z: '马', m: 1, d: 1, t: '己' + hb });
				const on = buildYizhangjingModel(bazi, { dayunStartAge: 'mi', mingGongMethod: 'shuZhiMao', tongxianShow: true });
				if (on && on.chart.startAge > 1 && on.tongxian.length > 0) {
					const off = buildYizhangjingModel(bazi, { dayunStartAge: 'mi', mingGongMethod: 'shuZhiMao', tongxianShow: false });
					expect(off.tongxian.length).toBe(0);
					expect(buildYizhangjingSnapshotText(off)).not.toMatch(/【童限】/);
					expect(buildYizhangjingSnapshotText(on)).toMatch(/【童限】/);
					checked = true;
					break;
				}
			}
			if (checked) break;
		}
		expect(checked).toBe(true);
	});
	test('童限：命宫厄/刃/破/孤(秘传起运>1岁)出【童限】段', () => {
		// 遍历找 startAge>1 的盘
		let sawTong = false;
		for (const yb of YB) {
			for (const hb of HB) {
				const bazi = bz({ y: yb, z: '马', m: 1, d: 1, t: '己' + hb });
				const m = buildYizhangjingModel(bazi, { dayunStartAge: 'mi', mingGongMethod: 'shuZhiMao' });
				if (m && m.chart.startAge > 1) { sawTong = buildYizhangjingSnapshotText(m).indexOf('【童限】') >= 0; if (sawTong) break; }
			}
			if (sawTong) break;
		}
		expect(sawTong).toBe(true);
	});
	test('重犯口诀 alpha/beta：有重犯盘速断组确变', () => {
		// 遍历找有重犯的盘
		let found = false;
		for (const yb of YB) {
			for (const hb of HB) {
				const bazi = bz({ y: yb, z: '马', m: 1, d: 1, t: '己' + hb });
				const m = buildYizhangjingModel(bazi, { mingGongMethod: 'shuZhiMao' });
				if (m && m.chart.repeats.length > 0) {
					const a = snap(bazi, { chongfanKou: 'alpha', mingGongMethod: 'shuZhiMao' });
					const b = snap(bazi, { chongfanKou: 'beta', mingGongMethod: 'shuZhiMao' });
					if (a !== b) { found = true; break; }
				}
			}
			if (found) break;
		}
		expect(found).toBe(true);
	});
});
