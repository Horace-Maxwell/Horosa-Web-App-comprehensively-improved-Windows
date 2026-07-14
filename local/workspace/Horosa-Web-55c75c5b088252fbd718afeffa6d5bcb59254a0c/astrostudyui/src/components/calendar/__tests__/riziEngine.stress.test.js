// 日子馆个性化择日 · 穷举压力测试（每事项 × 性别 × 多命主 × 显示全部/Top20 × 边界）。
// buildPersonalizedDates 全年扫描重但有 memo（同年复用）；本套主用 2026 复用，仅边界少量跨年。
import { personBazi, hehunPair, buildPersonalizedDates } from '../riziEngine';
import { EVENT_CATEGORIES } from '../tongshuData';

const P = (date, gender)=> personBazi({ date, time: `${date} 10:00:00`, gender });
const A = P('1984-06-01', 1);   // 甲子·鼠
const B = P('1990-08-01', 0);   // 庚午·马（冲子）
const C = P('1988-06-01', 0);   // 戊辰·龙（申子辰三合子）
const CHONG = { 子: '午', 午: '子', 卯: '酉', 酉: '卯', 寅: '申', 申: '寅', 巳: '亥', 亥: '巳', 辰: '戌', 戌: '辰', 丑: '未', 未: '丑' };

function personsOf(...arr){ return arr.map(([role, name, gender, bazi])=> ({ role, name, gender, bazi })); }
function assertOrdered(list){ for (let i = 1; i < list.length; i++) { expect(list[i].score).toBeLessThanOrEqual(list[i - 1].score); } }

describe('日子馆压测 · 全 8 事项 × 单命主（有序 + 无冲本命 + 明细完整）', () => {
	EVENT_CATEGORIES.forEach((cat)=>{
		test(`事项「${cat.label}」(${cat.key})：有序·冲本命淘汰·每日含本人评分`, () => {
			const persons = personsOf(['self', '本人', 1, A]);
			const r = buildPersonalizedDates({ event: cat.key, persons, year: 2026, topN: 20 });
			expect(r.list.length).toBeGreaterThan(0);
			expect(r.count).toBeGreaterThanOrEqual(r.list.length);
			assertOrdered(r.list);
			r.list.forEach((d)=>{
				expect(d.ganzhi[1]).not.toBe(CHONG[A.yearZhi]);   // 冲本命年支(午)之日不入
				expect(Array.isArray(d.perPerson)).toBe(true);
				expect(d.perPerson[0].shengxiao).toBe(A.shengxiao);
			});
		});
	});
});

describe('日子馆压测 · 性别（婚嫁男≠女）× 多年', () => {
	[2024, 2026, 2028].forEach((year)=>{
		test(`${year} 婚嫁：同命主男≠女 20 榜位次不同`, () => {
			const m = buildPersonalizedDates({ event: 'marriage', persons: personsOf(['self', 'M', 1, A]), year, topN: 20 });
			const f = buildPersonalizedDates({ event: 'marriage', persons: personsOf(['self', 'F', 0, A]), year, topN: 20 });
			expect(JSON.stringify(m.list.map((x)=> x.score))).not.toBe(JSON.stringify(f.list.map((x)=> x.score)));
		});
	});
});

describe('日子馆压测 · 多命主取交集（冲任一人本命即淘汰）', () => {
	test('本人(子) + 配偶(午·冲子) + 家人(辰)：结果无冲子、无冲午、无冲辰之日', () => {
		const persons = personsOf(['self', 'A', 1, A], ['spouse', 'B', 0, B], ['family', 'C', 0, C]);
		const r = buildPersonalizedDates({ event: 'marriage', persons, year: 2026, topN: 30 });
		r.list.forEach((d)=>{
			[A, B, C].forEach((p)=>{ expect(d.ganzhi[1]).not.toBe(CHONG[p.yearZhi]); });
			expect(d.perPerson.length).toBe(3);
		});
	});
	test('加配偶后候选数 ≤ 单人候选数（交集只会更少或相等）', () => {
		const solo = buildPersonalizedDates({ event: 'start', persons: personsOf(['self', 'A', 1, A]), year: 2026, topN: 366 });
		const duo = buildPersonalizedDates({ event: 'start', persons: personsOf(['self', 'A', 1, A], ['spouse', 'B', 0, B]), year: 2026, topN: 366 });
		expect(duo.count).toBeLessThanOrEqual(solo.count);
	});
});

describe('日子馆压测 · 显示全部 vs Top20', () => {
	test('topN=366 返回全部候选（count 一致），topN=20 截断', () => {
		const all = buildPersonalizedDates({ event: 'marriage', persons: personsOf(['self', 'A', 1, A]), year: 2026, topN: 366 });
		const top = buildPersonalizedDates({ event: 'marriage', persons: personsOf(['self', 'A', 1, A]), year: 2026, topN: 20 });
		expect(all.count).toBe(top.count);
		expect(all.list.length).toBe(all.count);
		expect(top.list.length).toBe(Math.min(20, top.count));
		// 全部榜的前 20 == Top20 榜（同排序）
		expect(JSON.stringify(all.list.slice(0, 20).map((x)=> x.ymd))).toBe(JSON.stringify(top.list.map((x)=> x.ymd)));
	});
});

describe('日子馆压测 · 边界/健壮（空/无bazi/strongOnly）', () => {
	test('空命主数组：不抛，返回通书基线榜', () => {
		expect(()=> buildPersonalizedDates({ event: 'marriage', persons: [], year: 2026, topN: 10 })).not.toThrow();
		const r = buildPersonalizedDates({ event: 'marriage', persons: [], year: 2026, topN: 10 });
		expect(r.list.length).toBeGreaterThan(0);
	});
	test('命主无 bazi（null）：跳过评分不阻断', () => {
		expect(()=> buildPersonalizedDates({ event: 'start', persons: personsOf(['self', 'X', 1, null]), year: 2026, topN: 10 })).not.toThrow();
	});
	test('strongOnly：只留 ≥8 分日', () => {
		const r = buildPersonalizedDates({ event: 'marriage', persons: personsOf(['self', 'A', 1, A]), year: 2026, topN: 366, strongOnly: true });
		r.list.forEach((d)=>{ expect(d.score).toBeGreaterThanOrEqual(8); });
	});
	test('合婚 hehunPair 全 12×12 年支组合合法 + 冲对称', () => {
		const Z = '子丑寅卯辰巳午未申酉戌亥'.split('');
		const mk = (zhi)=> ({ yearZhi: zhi, yearGZ: '甲' + zhi, nayinYear: '', nayinYearWx: '木' });
		Z.forEach((a)=> Z.forEach((b)=>{
			const r = hehunPair(mk(a), mk(b));
			expect(['good', 'bad', 'neutral']).toContain(r.jx);
			expect(hehunPair(mk(b), mk(a)).chong).toBe(r.chong);
		}));
	});
});
