// [卜卦改进 H7] 裁决双轨——行为级锁。
// ①legacy 档字节形状锚(键集恰等/无 v2 键/summary 形态)——搬家零回归自证
// ②v2 档结构(confidence 0-100/band 合法/profile/证词池新源真出现)
// ③结构性护栏(完成法地板 58/破坏无援天花板 42)
// ④五档→三值投影单调
// ⑤同源去重真生效(同 factor 多条按 30% 折算)
// ⑥矛盾审计:扰动盘族上 legacy 与 v2 不许 yes↔no 强反转(白名单制,现白名单=空)
import { runHorary, __resetHoraryMemoForTest } from '../horaryEngine';
import { buildVerdictLegacy, collectTestimoniesV2, aggregateV2 } from '../verdictScoring';
import { buildMockResult } from '../../election/__tests__/electionFixture';

const realResult = require('../../engine/__tests__/fixtures/realChartResult.json');
function freshReal(){ return JSON.parse(JSON.stringify(realResult)); }

describe('H7① legacy 档零回归锚', () => {
	beforeEach(() => { __resetHoraryMemoForTest(); });
	it('缺省(不传 verdictProfile)verdict 键集恰等旧形状,无 v2 键', () => {
		const j = runHorary(buildMockResult(), 'general', {});
		expect(Object.keys(j.verdict).sort()).toEqual(['leaning', 'negScore', 'negative', 'posScore', 'positive', 'summary']);
		expect(j.verdict.confidence).toBeUndefined();
		expect(j.verdict.profile).toBeUndefined();
		expect(['yes', 'no', 'even']).toContain(j.verdict.leaning);
	});
	it('显式 legacy === 缺省(JSON 全等)', () => {
		const a = runHorary(buildMockResult(), 'general', {});
		__resetHoraryMemoForTest();
		const b = runHorary(buildMockResult(), 'general', { verdictProfile: 'legacy' });
		expect(JSON.stringify(a.verdict)).toEqual(JSON.stringify(b.verdict));
	});
});

describe('H7② v2 档结构与新证词源', () => {
	beforeEach(() => { __resetHoraryMemoForTest(); });
	it('v2:confidence∈[2,98]/band 合法/profile=v2/三值投影在场', () => {
		const j = runHorary(freshReal(), 'general', { verdictProfile: 'v2' });
		const v = j.verdict;
		expect(v.profile).toBe('v2');
		expect(v.confidence).toBeGreaterThanOrEqual(2);
		expect(v.confidence).toBeLessThanOrEqual(98);
		expect(['strong_yes', 'lean_yes', 'uncertain', 'lean_no', 'strong_no']).toContain(v.band);
		expect(['yes', 'no', 'even']).toContain(v.leaning);
		expect(Array.isArray(v.conditions)).toBe(true);
	});
	it('v2 新证词源真出现(真形 fixture:互容 strong+围攻在池)', () => {
		const j = runHorary(freshReal(), 'general', { verdictProfile: 'v2' });
		const all = j.verdict.positive.concat(j.verdict.negative);
		const sources = new Set(all.map((x) => x.source));
		// 真形 fixture 实录:Moon×Venus 双 exalt 互容 → 若两主含其一则 reception 源在;
		// 至少证明池扩容非空(新源种类≥1)且 legacy 四源仍在。
		expect(sources.has('perfection') || sources.has('thirds')).toBe(true);
		const newKinds = ['reception', 'hour', 'star', 'antiscia', 'almuten', 'besiege', 'moon_path', 'natural', 'cosig', 'decl', 'flag', 'moon_flag'];
		expect(newKinds.some((k) => sources.has(k))).toBe(true);
	});
});

describe('H7③ 结构性护栏', () => {
	const basePool = { positive: [], negative: [] };
	it('完成法命中无破坏:证词再差 confidence ≥58(lean_yes 下限)', () => {
		const pool = { positive: [], negative: [{ text: 'x', weight: 9, source: 'moon', factor: 'a' }, { text: 'y', weight: 9, source: 'condition', factor: 'b' }] };
		const r = aggregateV2(pool, { perf: { perfects: true, destroyed: false } });
		expect(r.confidence).toBeGreaterThanOrEqual(58);
		expect(r.guards).toContain('perfection_floor');
		expect(r.leaning).toBe('yes');
	});
	it('破坏无援:证词再好 confidence ≤42(lean_no 上限)', () => {
		const pool = { positive: [{ text: 'x', weight: 9, source: 'moon', factor: 'a' }, { text: 'y', weight: 9, source: 'condition', factor: 'b' }], negative: [] };
		const r = aggregateV2(pool, { perf: { perfects: false, destroyed: true } });
		expect(r.confidence).toBeLessThanOrEqual(42);
		expect(r.guards).toContain('destruction_ceiling');
		expect(r.leaning).toBe('no');
	});
	it('破坏但有 rescue:天花板不压(可高于 42)', () => {
		const pool = { positive: [{ text: 'x', weight: 9, source: 'moon', factor: 'a' }], negative: [] };
		const r = aggregateV2(pool, { perf: { perfects: false, destroyed: true, rescue: { method: 'translation', by: 'moon' } } });
		expect(r.guards).not.toContain('destruction_ceiling');
	});
	it('无完成无破坏:无护栏,纯数值', () => {
		const r = aggregateV2(basePool, { perf: null });
		expect(r.guards).toEqual([]);
		expect(r.confidence).toBe(50);
		expect(r.band).toBe('uncertain');
	});
});

describe('H7④ 五档→三值投影单调', () => {
	it('strong_yes/lean_yes→yes;uncertain→even;lean_no/strong_no→no(带序单调)', () => {
		const seq = [];
		[95, 65, 50, 35, 10].forEach((c) => {
			const pool = { positive: c > 50 ? [{ text: 'p', weight: (c - 50) / 4.5, source: 's', factor: 'f' }] : [], negative: c < 50 ? [{ text: 'n', weight: (50 - c) / 4.5, source: 's', factor: 'f' }] : [] };
			seq.push(aggregateV2(pool, { perf: null }));
		});
		const projOrder = { yes: 2, even: 1, no: 0 };
		for(let i = 1; i < seq.length; i++){
			expect(seq[i].confidence).toBeLessThanOrEqual(seq[i - 1].confidence);
			expect(projOrder[seq[i].leaning]).toBeLessThanOrEqual(projOrder[seq[i - 1].leaning]);
		}
	});
});

describe('H7⑤ 同源去重', () => {
	it('同 factor 三条(4/3/2) < 三不同 factor 同权重(4/3/2)——30% 折算真生效', () => {
		const same = aggregateV2({ positive: [
			{ text: 'a', weight: 4, source: 's', factor: 'x' },
			{ text: 'b', weight: 3, source: 's', factor: 'x' },
			{ text: 'c', weight: 2, source: 's', factor: 'x' },
		], negative: [] }, { perf: null });
		const diff = aggregateV2({ positive: [
			{ text: 'a', weight: 4, source: 's', factor: 'x' },
			{ text: 'b', weight: 3, source: 's', factor: 'y' },
			{ text: 'c', weight: 2, source: 's', factor: 'z' },
		], negative: [] }, { perf: null });
		expect(same.confidence).toBeLessThan(diff.confidence);
	});
});

describe('H7⑥ 矛盾审计(扰动盘族;白名单=空)', () => {
	// 双轨在同一盘上不许 yes↔no 强反转——分歧只许经「一轨 even」缓冲或护栏解释。
	// 白名单制:若未来学理确认某局面允许反转,须在此显式登记并写明理由。
	const WHITELIST = [];
	it('mock 扰动盘 × 类别族:零强反转', () => {
		const cats = ['general', 'marriage', 'career', 'wealth', 'lost'];
		const mutations = [
			(r) => r,
			(r) => { r.chart.objects.find((o) => o.id === 'Mars').movedir = 'Retrograde'; return r; },
			(r) => { r.chart.objects.find((o) => o.id === 'Venus').lon = 100; return r; },
			(r) => { r.chart.isDiurnal = false; return r; },
		];
		const conflicts = [];
		cats.forEach((cat) => {
			mutations.forEach((mut, mi) => {
				__resetHoraryMemoForTest();
				const ja = runHorary(mut(buildMockResult()), cat, {});
				__resetHoraryMemoForTest();
				const jb = runHorary(mut(buildMockResult()), cat, { verdictProfile: 'v2' });
				if(!ja || !jb){ return; }
				const a = ja.verdict.leaning; const b = jb.verdict.leaning;
				const strongFlip = (a === 'yes' && b === 'no') || (a === 'no' && b === 'yes');
				const key = `${cat}#${mi}`;
				if(strongFlip && WHITELIST.indexOf(key) < 0 && !(jb.verdict.guards || []).length){
					conflicts.push(`${key}: legacy=${a} v2=${b}`);
				}
			});
		});
		expect(conflicts).toEqual([]);
	});
});
