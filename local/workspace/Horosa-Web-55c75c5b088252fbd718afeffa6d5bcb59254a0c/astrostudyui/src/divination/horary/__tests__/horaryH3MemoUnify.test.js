// [卜卦改进 H3] 双实现归一+runHorary memo 单次化。
// ①memo:同 result 引用+同 opts(按值,非引用) → 返回同一对象;不同 opts/reset 后重算;
//   深冻结产出后再次命中不炸(共享对象没人原地改写的自证)。
// ②houseMap 良性锁:裸 result(自建 hmap) vs 盘面回写 houseMap(同法) → facts 产出全等
//   (memo 冻结首跑产出的安全前提:第二条路不会算出不同的盘)。
// ③时主一致单源化:buildHourAgreement 的 bonatti 学理支必须转发 radicality.hourAgreementTest
//   (旧版自算且参照物取上升座元素,与权威实现的命主星落座元素相反,边缘盘结论互斥)。
import fs from 'fs';
import path from 'path';
import { runHorary, __resetHoraryMemoForTest } from '../horaryEngine';
import { buildFacts } from '../../engine/chartFacts';
import { buildMockResult } from '../../election/__tests__/electionFixture';

function deepFreeze(o, seen){
	seen = seen || new Set();
	if(!o || typeof o !== 'object' || seen.has(o)){ return o; }
	seen.add(o);
	Object.getOwnPropertyNames(o).forEach((k) => deepFreeze(o[k], seen));
	return Object.freeze(o);
}

describe('H3① runHorary memo', () => {
	beforeEach(() => { __resetHoraryMemoForTest(); });

	it('同 result 引用+同 opts(每次新建对象) → 返回同一产出对象', () => {
		const r = buildMockResult();
		const a = runHorary(r, 'general', { perfectionStrict: 'standard', includeOuter: false });
		const b = runHorary(r, 'general', { includeOuter: false, perfectionStrict: 'standard' });   // 键序不同也命中
		expect(a).toBe(b);
	});

	it('不同 opts 值 → 重算(不串档);不同 category → 重算', () => {
		const r = buildMockResult();
		const a = runHorary(r, 'general', { includeOuter: false });
		const b = runHorary(r, 'general', { includeOuter: true });
		expect(a).not.toBe(b);
		const c = runHorary(r, 'marriage', { includeOuter: false });
		expect(c).not.toBe(a);
	});

	it('不同 result 对象(同内容) → 各自槽不串盘', () => {
		const a = runHorary(buildMockResult(), 'general', {});
		const b = runHorary(buildMockResult(), 'general', {});
		expect(a).not.toBe(b);
		expect(JSON.stringify(a)).toEqual(JSON.stringify(b));   // 纯函数:内容仍全等
	});

	it('reset 后重算;深冻结产出后同参再取(命中)与重算(reset)皆与首跑全等', () => {
		const r = buildMockResult();
		const a = runHorary(r, 'general', {});
		const snap = JSON.stringify(a);
		deepFreeze(a);   // 若任何消费路径原地改写共享对象,这里冻住后会在 strict 模式抛错
		const hit = runHorary(r, 'general', {});
		expect(hit).toBe(a);
		__resetHoraryMemoForTest();
		const re = runHorary(r, 'general', {});
		expect(re).not.toBe(a);
		expect(JSON.stringify(re)).toEqual(snap);   // 两遍全等:memo 不改变任何产出内容
	});
});

describe('H3② houseMap 有/无两路全等(memo 安全前提)', () => {
	// ⚠ 用真形 fixture 对拍:electionFixture(mock)没模拟 chart.houses,裸路在其上 houses 恒空,
	// 拿它对拍=对着空壳假证。真后端 chart.houses 条目自带 id/sign/lon/ruler/planets 全套,
	// 自建路与盘面 houseMap(同条目引用的懒建缓存)必须同产出——memo 冻结首跑产出才安全。
	const realResult = require('../../engine/__tests__/fixtures/realChartResult.json');
	it('真形 fixture:裸(自建自 chart.houses) vs 盘面回写 houseMap → facts 全等且十二宫齐', () => {
		const bare = JSON.parse(JSON.stringify(realResult));
		delete bare.houseMap;
		const fBare = buildFacts(bare, {});
		expect(Object.keys(fBare.houses).length).toBe(12);   // 自建路真活(空壳 mock 测不出)
		const withMap = JSON.parse(JSON.stringify(realResult));
		const hmap = {};
		((withMap.chart && withMap.chart.houses) || []).forEach((h) => { if(h && h.id){ hmap[h.id] = h; } });
		withMap.houseMap = hmap;   // 盘面组件懒建回写形态(同条目引用)
		const fMap = buildFacts(withMap, {});
		// facts.result 引用不同对象,剥掉后比其余全部
		const strip = (f) => { const { result, ...rest } = f; return JSON.stringify(rest); };
		expect(strip(fMap)).toEqual(strip(fBare));
	});
	it('mock 盘(盘面 houseMap 形态)宫位表照常十二宫', () => {
		const f = buildFacts(buildMockResult(), {});
		expect(Object.keys(f.houses).length).toBe(12);
	});
});

describe('H3③ 时主一致单源化(结构锁)', () => {
	const src = fs.readFileSync(path.join(__dirname, '..', 'horaryEngine.js'), 'utf8')
		.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
	it('bonatti 学理支转发 hourAgreementTest(唯一实现),不再自算', () => {
		expect(src).toContain('hourAgreementTest(facts, opts)');
		expect(src).toMatch(/triplicity_bonatti/);
	});
	it('旧自算元素表(上升座参照物)已删——两实现参照物相反的病灶不许回魂', () => {
		expect(/const ELEM = \{ aries: 'fire'/.test(src)).toBe(false);
		expect(src).not.toContain('落座与上升座同元素');
	});
	it('权威口径文案=命主星落座(文献口径)', () => {
		expect(src).toContain('落座与命主星落座同元素');
	});
});
