// [Q-231/Q-434/Q-435] 七政 AI 快照 ← 右栏「命身与限度 / 三主·化曜 / 难仇恩用 / 五限 / 行运法」同源事实层:
//  · buildGuolaoMoiraInfoFacts 纯函数可无头调用(命度/身度/宿主/三主/难仇恩用/五限/行运法);
//  · 「命主取法」齿轮改 [三主与化曜] 正文(命主(宫主)↔命主(度主)、难仇恩用度行随之);
//  · 「行运法」齿轮改 [限法实算] 正文(小限/月限/童限/洞微各出实算行,不再只改标签);
//  · [起盘信息] 四行(命度/身度/命度宿主/身度宿主)与 [本命化曜]「命曜落宫」可产出。
import * as AstroConst from '../../../constants/AstroConst';
import { buildGuolaoMoiraInfoFacts } from '../GuoLaoMoiraPanel';
import { buildGuolaoMastersSection, buildGuolaoLimitCalcSection, buildGuolaoBirthStarsSection } from '../GuoLaoChartMain';

const ROOT = { chart: {
	displayCoord: 'ecliptic',
	objects: [
		{ id: AstroConst.LIFEMASTERDEG74, lon: 250.713, house: 'House1' },
		{ id: AstroConst.ASC, lon: 250.713 },
		{ id: AstroConst.MOON, lon: 42.0, lonspeed: 13.1, house: 'House7' },
		{ id: AstroConst.SUN, lon: 75.5, lonspeed: 0.95 },
	],
	fixedStarSu28: [{ name: '角', ra: 0 }, { name: '亢', ra: 30 }, { name: '氐', ra: 60 }, { name: '房', ra: 240 }, { name: '心', ra: 255 }],
	nongli: { bazi: { fourColumns: {
		year: { ganzi: '庚午' }, month: { ganzi: '己丑' }, day: { ganzi: '甲子' }, time: { ganzi: '庚午' },
	} } },
} };
const PARAMS = { date: '1990/01/15', time: '12:00:00' };
const TRANSIT_PARAMS = { date: '2026/09/16', time: '12:00:00' };
const TRANSIT_ROOT = { nongli: { bazi: { fourColumns: { year: { ganzi: '丙午' }, month: { ganzi: '丁酉' } } } } };

function facts(display, extra){
	return buildGuolaoMoiraInfoFacts({
		value: {}, rootValue: ROOT, transitValue: TRANSIT_ROOT, params: PARAMS, transitParams: TRANSIT_PARAMS,
		display: display || {}, fields: {}, ...(extra || {}),
	});
}

describe('七政 · 右栏事实层 buildGuolaoMoiraInfoFacts(无头可算)', ()=>{
	test('命度/身度/宿主/年龄:全部有值,身度=月亮落点', ()=>{
		const f = facts({});
		expect(f.life.longitude).toBeCloseTo(250.713, 3);
		expect(f.life.zi).toBe('寅');           // 250.7° = 人马 → 寅
		expect(f.self.longitude).toBeCloseTo(42.0, 3);
		expect(f.lifeSuHost && f.lifeSuHost.name).toBe('房');   // 240 ≤ 250.7 < 255
		expect(f.selfSuHost && f.selfSuHost.name).toBe('亢');   // 30 ≤ 42 < 60
		expect(f.age).toBe(2026 - 1990 + 1);
		expect(f.transitYearText).toBe('丙午');
	});

	test('命主取法齿轮:gong → 命主(宫主);du → 命主(度主),难仇恩用「度」行主星随宿主曜', ()=>{
		const g = facts({ lifeMasterMode: 'gong' });
		const d = facts({ lifeMasterMode: 'du' });
		expect(g.useDu).toBe(false);
		expect(d.useDu).toBe(true);
		expect(g.masterItems[0].label).toBe('命主(宫主)');
		expect(d.masterItems[0].label).toBe('命主(度主)');
		expect(g.masters.lifeMaster).toBeTruthy();
		expect(d.masters.degMaster).toBeTruthy();
		expect(d.masterItems[0].value).toBe(d.masters.degMaster);
		expect(g.masterItems[0].value).toBe(g.masters.lifeMaster);
		const sg = buildGuolaoMastersSection(g);
		const sd = buildGuolaoMastersSection(d);
		expect(sg).toContain('主宫主');
		expect(sd).toContain('专度主');
		expect(sg).not.toBe(sd);
		expect(sg).toContain('◆ 难仇恩用');
		expect(sg).toMatch(/宫\(.\)：难=/);
	});

	test('五限实算:飞限/小限/限度有值;月限随流年月支(无流年盘则省略)', ()=>{
		const f = facts({});
		expect(f.limits).toBeTruthy();
		const labels = f.limits.items.map((it)=>it.label);
		expect(labels).toEqual(expect.arrayContaining(['飞限', '小限', '限度', '至', '月限']));
		const noTransit = facts({}, { transitValue: null });
		expect(noTransit.limits.items.map((it)=>it.label)).not.toContain('月限');
		const sec = buildGuolaoLimitCalcSection(f);
		expect(sec).toContain('◆ 飞限 · 童限 · 小限 · 月限 · 限度（37 岁 · 丙午年）');
		expect(sec).toMatch(/小限：[子丑寅卯辰巳午未申酉戌亥]/);
	});

	test('行运法齿轮:默认古度限度法不出实算行;minor/month/tong/dongwei 各出实算正文', ()=>{
		const base = buildGuolaoLimitCalcSection(facts({ minorLimitType: '' }));
		expect(base).not.toContain('行运法实算');
		const minor = buildGuolaoLimitCalcSection(facts({ minorLimitType: 'minor' }));
		expect(minor).toContain('◆ 行运法实算 · 小限');
		expect(minor).toMatch(/小限\(37岁\)：.+（[子丑寅卯辰巳午未申酉戌亥]）/);
		const month = buildGuolaoLimitCalcSection(facts({ minorLimitType: 'month' }));
		expect(month).toContain('◆ 行运法实算 · 月限');
		expect(month).toContain('生月12');   // 己丑月 = 十二月(月建口径)
		const tong = buildGuolaoLimitCalcSection(facts({ minorLimitType: 'tong', tongxianBase: 'gu9' }));
		expect(tong).toContain('◆ 行运法实算 · 童限（基数古九岁）');
		expect(tong).toMatch(/童限顺排：.+→.+；出童限\(约\)：[\d.]+ 岁/);
		const dw = buildGuolaoLimitCalcSection(facts({ minorLimitType: 'dongwei' }));
		expect(dw).toContain('◆ 行运法实算 · 洞微大限');
		expect(dw).toMatch(/本年飞星吊度 ≈ [\d.]+°（37 岁）/);
		expect(new Set([base, minor, month, tong, dw]).size).toBe(5);
	});

	test('[本命化曜] 追加「命曜落宫」(rules.natalYearStars),无数据时段文逐字同旧', ()=>{
		const rules = { yearStars: { birth: { yearPole: '庚午', planetRows: [{ star: '日', changeTo: '禄', items: [] }] } } };
		const before = buildGuolaoBirthStarsSection(rules);
		expect(before).not.toContain('命曜落宫');
		const withRows = buildGuolaoBirthStarsSection({ ...rules, natalYearStars: [
			{ name: '天禄', star: '木', shortName: '禄', quality: '吉', zi: '寅', signName: '人马' },
		] });
		expect(withRows).toContain('◆ 命曜落宫');
		expect(withRows).toContain('天禄：木（禄；吉 · 寅 · 人马）');
		expect(withRows.replace(/◆ 命曜落宫\n[^\n]+\n/, '')).toBe(before);
	});
});
