// 紫微 · 七大分歧点内核 golden(对照古法口径 golden,证明内核正确)+ 笛卡尔压测。
import {
	STEMS, BRANCHES,
	placeHuoLing, resolveLeapMonth, flowMonthSplit,
	isLateZi, resolveLateZi, resolveYearGanzhi,
	placeKongJie, placeTiankongYear, placeJieluKong,
	yinyangGroup, placeShangShi,
	palaceStems, sihuaTable, sihuaOf, laiyinPalaces, isLaiyinPalace,
	SIHUA_SCHOOLS,
} from '../ziweiSchools';

function bdist(a, b){ const d = ((BRANCHES.indexOf(a) - BRANCHES.indexOf(b)) % 12 + 12) % 12; return Math.min(d, 12 - d); }

// ── 1. 火星/铃星 ──────────────────────────────────────────────
describe('火铃起宫(分歧点1)', () => {
	test('全书版子时落起宫本身', () => {
		expect(placeHuoLing('午', '子', 'quanshu')).toEqual({ 火星: '丑', 铃星: '卯' });   // 寅午戌
		expect(placeHuoLing('子', '子', 'quanshu')).toEqual({ 火星: '寅', 铃星: '戌' });   // 申子辰
		expect(placeHuoLing('酉', '子', 'quanshu')).toEqual({ 火星: '卯', 铃星: '戌' });   // 巳酉丑
		expect(placeHuoLing('卯', '子', 'quanshu')).toEqual({ 火星: '酉', 铃星: '戌' });   // 亥卯未
	});
	test('全书==全集 起宫完全相同(关键纠错点)', () => {
		BRANCHES.forEach((yb) => BRANCHES.forEach((hb) => {
			expect(placeHuoLing(yb, hb, 'quanshu')).toEqual(placeHuoLing(yb, hb, 'quanji'));
		}));
	});
	test('壬辰(申子辰)卯时:火巳铃丑', () => {
		expect(placeHuoLing('辰', '卯', 'quanshu')).toEqual({ 火星: '巳', 铃星: '丑' });
	});
	test('南派只按年支(生时固定子)', () => {
		BRANCHES.forEach((hb) => { expect(placeHuoLing('辰', hb, 'nanpai')).toEqual({ 火星: '寅', 铃星: '戌' }); });
	});
});

// ── 2. 闰月 ──────────────────────────────────────────────────
describe('闰月取月(分歧点2)', () => {
	test('非闰月直通', () => { expect(resolveLeapMonth(5, 20, false, 'next')).toEqual({ palaceMonth: 5, starMonth: 5 }); });
	test('六方案', () => {
		expect(resolveLeapMonth(5, 12, true, 'current')).toEqual({ palaceMonth: 5, starMonth: 5 });
		expect(resolveLeapMonth(5, 12, true, 'next')).toEqual({ palaceMonth: 6, starMonth: 6 });
		expect(resolveLeapMonth(5, 12, true, 'split15')).toEqual({ palaceMonth: 5, starMonth: 5 });
		expect(resolveLeapMonth(5, 20, true, 'split15')).toEqual({ palaceMonth: 6, starMonth: 6 });
		expect(resolveLeapMonth(5, 16, true, 'split_days', 30)).toEqual({ palaceMonth: 6, starMonth: 6 });
		expect(resolveLeapMonth(5, 15, true, 'split_days', 30)).toEqual({ palaceMonth: 5, starMonth: 5 });
		// 🔴 [B4] split_days 修真金标:小月(29)半点=14 —— 十五日归**下月**,与 split15(归本月)分道。
		// 旧 floor((d+1)/2) 对 29/30 都得 15=split15 克隆(假选项);修真依据=选项文案「按实际天数取中点」。
		expect(resolveLeapMonth(5, 15, true, 'split_days', 29)).toEqual({ palaceMonth: 6, starMonth: 6 });
		expect(resolveLeapMonth(5, 14, true, 'split_days', 29)).toEqual({ palaceMonth: 5, starMonth: 5 });
		expect(resolveLeapMonth(5, 15, true, 'split15', 29)).toEqual({ palaceMonth: 5, starMonth: 5 });   // 对照:split15 十五仍本月
		expect(resolveLeapMonth(5, 20, true, 'solar_term', 30, true)).toEqual({ palaceMonth: 6, starMonth: 6 });
		expect(resolveLeapMonth(5, 20, true, 'split_star_month')).toEqual({ palaceMonth: 6, starMonth: 5 });   // 命身下月、月系星本月
	});
	test('闰十二作下月→正月', () => { expect(resolveLeapMonth(12, 20, true, 'next')).toEqual({ palaceMonth: 1, starMonth: 1 }); });
	test('推流月切分', () => { expect(flowMonthSplit(15)).toBe(0); expect(flowMonthSplit(16)).toBe(1); });
});

// ── 3. 晚子时 ────────────────────────────────────────────────
describe('晚子时(分歧点3)', () => {
	test('23点判定', () => { expect(isLateZi(23)).toBe(true); expect(isLateZi(0)).toBe(false); expect(isLateZi(22)).toBe(false); });
	test('三方案', () => {
		const a = resolveLateZi(10, 5, 6, 'day_unchanged');
		expect(a.length).toBe(1); expect(a[0].lunarDay).toBe(10); expect(a[0].dayGz).toBe(5);
		const b = resolveLateZi(10, 5, 6, 'day_advance');
		expect(b[0].lunarDay).toBe(11); expect(b[0].dayGz).toBe(6);
		const c = resolveLateZi(10, 5, 6, 'dual_chart');
		expect(c.length).toBe(2); expect(c[0].lunarDay).toBe(10); expect(c[1].lunarDay).toBe(11);
		a.concat(b).concat(c).forEach((ch) => expect(ch.hourBranch).toBe('子'));
	});
});

// ── 4. 定年界线 ──────────────────────────────────────────────
describe('定年界线(分歧点4)', () => {
	test('立春↔初一之间两法差一年', () => {
		const lichun = 20000204, newyear = 20000210, born = 20000206;   // yyyymmdd 可比整数
		expect(resolveYearGanzhi(born, newyear, lichun, '己卯', '庚辰', 'lunar_new_year')).toBe('己卯');
		expect(resolveYearGanzhi(born, newyear, lichun, '己卯', '庚辰', 'lichun')).toBe('庚辰');
		expect(resolveYearGanzhi(20000210, newyear, lichun, '己卯', '庚辰', 'lunar_new_year')).toBe('庚辰');
	});
});

// ── 5. 空劫 ──────────────────────────────────────────────────
describe('空劫(分歧点5)', () => {
	test('方向与对称', () => {
		expect(placeKongJie('卯', 'modern')).toEqual({ 地劫: '寅', 地空: '申' });
		expect(placeKongJie('子', 'modern')).toEqual({ 地劫: '亥', 地空: '亥' });
		BRANCHES.forEach((hb) => {
			const h = BRANCHES.indexOf(hb); const rr = placeKongJie(hb, 'modern');
			expect(BRANCHES.indexOf(rr.地劫)).toBe((11 + h) % 12);
			expect(BRANCHES.indexOf(rr.地空)).toBe(((11 - h) % 12 + 12) % 12);
		});
		expect(bdist(placeKongJie('卯', 'modern').地劫, placeKongJie('卯', 'modern').地空)).toBe(6);
		expect(bdist(placeKongJie('酉', 'modern').地劫, placeKongJie('酉', 'modern').地空)).toBe(6);
		expect(bdist(placeKongJie('丑', 'modern').地劫, placeKongJie('丑', 'modern').地空)).toBe(2);
	});
	test('古本命名逆行星=天空', () => { expect(placeKongJie('卯', 'book')).toEqual({ 地劫: '寅', 天空: '申' }); });
	test('独立天空=太岁前一位', () => { expect(placeTiankongYear('卯')).toBe('辰'); expect(placeTiankongYear('子')).toBe('丑'); });
	test('截路空亡', () => { expect(placeJieluKong('甲')).toEqual(['申', '酉']); expect(placeJieluKong('癸')).toEqual(['子', '丑']); });
});

// ── 6. 天伤天使 ──────────────────────────────────────────────
describe('天伤天使(分歧点6)', () => {
	test('阴阳归类', () => {
		expect(yinyangGroup('壬', '男')).toBe('阳男阴女');
		expect(yinyangGroup('乙', '女')).toBe('阳男阴女');
		expect(yinyangGroup('乙', '男')).toBe('阴男阳女');
		expect(yinyangGroup('壬', '女')).toBe('阴男阳女');
	});
	test('固定法落宫', () => { expect(placeShangShi('寅', '壬', '男', 'fixed')).toEqual({ 天伤: '未', 天使: '酉' }); });
	test('恒夹迁移(命-6)·天伤≠天使', () => {
		BRANCHES.forEach((ming) => {
			const qianyi = BRANCHES[((BRANCHES.indexOf(ming) - 6) % 12 + 12) % 12];
			['fixed', 'yinyang_swap'].forEach((rule) => ['壬', '乙'].forEach((ys) => ['男', '女'].forEach((g) => {
				const r = placeShangShi(ming, ys, g, rule);
				expect(bdist(r.天伤, qianyi)).toBe(1);
				expect(bdist(r.天使, qianyi)).toBe(1);
				expect(r.天伤).not.toBe(r.天使);
			})));
		});
	});
	test('仅阴男阳女互换(据古法纠错:非阳男阴女)', () => {
		const fixed = placeShangShi('寅', '壬', '男', 'fixed');
		expect(placeShangShi('寅', '壬', '男', 'yinyang_swap')).toEqual(fixed);   // 阳男:不变
		expect(placeShangShi('寅', '乙', '男', 'yinyang_swap')).toEqual({ 天伤: fixed.天使, 天使: fixed.天伤 });   // 阴男:对调
	});
});

// ── 7. 宫干 + 四化 ───────────────────────────────────────────
describe('宫干+四化(分歧点7)', () => {
	test('五虎遁', () => {
		const ps = palaceStems('壬');
		expect(ps['寅']).toBe('壬');
		expect(ps['子']).toBe(ps['寅']);
		expect(ps['丑']).toBe(ps['卯']);
		expect(palaceStems('甲')['寅']).toBe('丙');
		expect(palaceStems('己')['寅']).toBe('丙');
		expect(palaceStems('癸')['寅']).toBe('甲');
	});
	test('来因宫(🔴 子丑借干宫不作来因 —— 与盘面 drawLaiYing 同口径,快照/报告曾不排致辛壬年双来因)', () => {
		const ps = palaceStems('庚'); const ly = laiyinPalaces('庚');
		expect(ly.every((b) => ps[b] === '庚')).toBe(true);
		expect(ly.length).toBeGreaterThanOrEqual(1);
		// 负锚:壬年丑借卯之干、辛年子借寅之干 —— 排除后每干来因恰一宫且永不含子丑
		'甲乙丙丁戊己庚辛壬癸'.split('').forEach((stem) => {
			const one = laiyinPalaces(stem);
			expect(one.length).toBe(1);
			expect(one).not.toContain('子');
			expect(one).not.toContain('丑');
			expect(isLaiyinPalace(`${stem}${one[0]}`, stem)).toBe(true);
		});
		expect(isLaiyinPalace('壬子', '壬')).toBe(false);   // 借干宫被谓词拒绝
		expect(isLaiyinPalace('辛丑', '辛')).toBe(false);
	});
	test('七干各派一致', () => {
		'甲乙丙丁己辛癸'.split('').forEach((stem) => {
			const vals = new Set(SIHUA_SCHOOLS.map((s) => sihuaTable(s)[stem].join(',')));
			expect(vals.size).toBe(1);
		});
	});
	test('通行四化值', () => {
		expect(sihuaOf('庚', 'tongxing')).toEqual({ 禄: '太阳', 权: '武曲', 科: '太阴', 忌: '天同' });
		expect(sihuaOf('壬', 'tongxing')).toEqual({ 禄: '天梁', 权: '紫微', 科: '左辅', 忌: '武曲' });
		expect(sihuaOf('甲', 'tongxing')).toEqual({ 禄: '廉贞', 权: '破军', 科: '武曲', 忌: '太阳' });
	});
	test('庚干四派两两不同', () => {
		const g = {}; ['tongxing', 'quanshu', 'zhongzhou', 'beipai'].forEach((s) => { g[s] = sihuaTable(s)['庚'].join(','); });
		expect(g.tongxing).toBe('太阳,武曲,太阴,天同');
		expect(g.quanshu).toBe('太阳,武曲,天同,太阴');
		expect(g.zhongzhou).toBe('太阳,武曲,天府,天同');
		expect(g.beipai).toBe('太阳,武曲,天同,天相');   // 北派 天相忌独有
		expect(new Set(Object.values(g)).size).toBe(4);
	});
	test('壬戊化科各派', () => {
		expect(sihuaTable('tongxing')['壬'][2]).toBe('左辅');
		expect(sihuaTable('quanshu')['壬'][2]).toBe('天府');
		expect(sihuaTable('zhongzhou')['壬'][2]).toBe('天府');
		expect(sihuaTable('tongxing')['戊'][2]).toBe('右弼');
		expect(sihuaTable('zhongzhou')['戊'][2]).toBe('太阳');
	});
	test('中州派辅弼不化科', () => {
		const z = sihuaTable('zhongzhou');
		['戊', '庚', '壬'].forEach((stem) => { expect(['左辅', '右弼'].indexOf(z[stem][2])).toBe(-1); });
	});
});

// ── 集成 + 压测 ──────────────────────────────────────────────
describe('集成+笛卡尔压测', () => {
	test('集成:壬辰闰5月20卯时阳男·中州派', () => {
		expect(placeHuoLing('辰', '卯', 'quanshu')).toEqual({ 火星: '巳', 铃星: '丑' });
		expect(resolveLeapMonth(5, 20, true, 'split15').palaceMonth).toBe(6);
		expect(sihuaOf('壬', 'zhongzhou').忌).toBe('武曲');
		expect(yinyangGroup('壬', '男')).toBe('阳男阴女');
	});
	test('火铃:全年支×全时支×3版,九宫合法不抛', () => {
		['quanshu', 'quanji', 'nanpai'].forEach((hl) => BRANCHES.forEach((yb) => BRANCHES.forEach((hb) => {
			const r = placeHuoLing(yb, hb, hl);
			expect(BRANCHES.indexOf(r.火星)).toBeGreaterThanOrEqual(0);
			expect(BRANCHES.indexOf(r.铃星)).toBeGreaterThanOrEqual(0);
		})));
	});
	test('四化:6派×10干 均产出4星合法', () => {
		const allStars = new Set();
		Object.values(sihuaTable('tongxing')).forEach((t) => t.forEach((s) => allStars.add(s)));
		SIHUA_SCHOOLS.forEach((sc) => STEMS.forEach((st) => {
			const r = sihuaOf(st, sc);
			['禄', '权', '科', '忌'].forEach((k) => expect(typeof r[k]).toBe('string'));
		}));
	});
	test('天伤天使:全命宫×2法×全年干×双性别 夹迁移不变式', () => {
		BRANCHES.forEach((ming) => STEMS.forEach((ys) => ['男', '女'].forEach((g) => ['fixed', 'yinyang_swap'].forEach((rule) => {
			const r = placeShangShi(ming, ys, g, rule);
			const qianyi = BRANCHES[((BRANCHES.indexOf(ming) - 6) % 12 + 12) % 12];
			expect(bdist(r.天伤, qianyi)).toBe(1);
			expect(bdist(r.天使, qianyi)).toBe(1);
		}))));
	});
	test('宫干:10年干 子==寅、丑==卯 循环不变式', () => {
		STEMS.forEach((ys) => { const ps = palaceStems(ys); expect(ps['子']).toBe(ps['寅']); expect(ps['丑']).toBe(ps['卯']); });
	});
});
