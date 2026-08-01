// 开钥（Opening of the Key）五操作引擎守卫:计数值/朝向/环形计数/首尾配对/五操作确定性 + 指示牌必选。
import { CORE78 } from '../decks/core78.js';
import { openingOfKey, countingValueOf, facingOf, countChain, pairing } from '../engine/openingOfKey.js';
import { buildReading } from '../engine/reading.js';

const byId = (sid) => CORE78.find((c) => c.sid === sid);
const SIG = byId('wands_king').id;

describe('开钥计数值 / 朝向', () => {
	test('计数值默认走 card.countingValue(King=4,Ace=5,数字=面值)', () => {
		expect(countingValueOf(byId('cups_king'))).toBe(4);
		expect(countingValueOf(byId('cups_01'))).toBe(5);
		expect(countingValueOf(byId('cups_07'))).toBe(7);
	});
	test('计数值质点版:King=2/Queen=3/Prince(knight)=6/Princess(page)=9', () => {
		expect(countingValueOf(byId('cups_king'), 'sephira')).toBe(2);
		expect(countingValueOf(byId('cups_queen'), 'sephira')).toBe(3);
		expect(countingValueOf(byId('cups_knight'), 'sephira')).toBe(6);
		expect(countingValueOf(byId('cups_page'), 'sephira')).toBe(9);
	});
	test('朝向:Queen/Princess 右+1、King/Knight 左−1、逆位反向、非宫廷+1', () => {
		expect(facingOf(byId('cups_queen'), false)).toBe(1);
		expect(facingOf(byId('cups_page'), false)).toBe(1);
		expect(facingOf(byId('cups_king'), false)).toBe(-1);
		expect(facingOf(byId('cups_knight'), false)).toBe(-1);
		expect(facingOf(byId('cups_queen'), true)).toBe(-1);
		expect(facingOf(byId('the_sun'), false)).toBe(1);
	});
});

describe('开钥环形计数 / 首尾配对', () => {
	const pile = CORE78.slice(0, 8).map((c, i) => ({ card: c, isReversed: false }));
	test('countChain 从 sigIndex 起、成链、seen 去重', () => {
		const chain = countChain(pile, 0, {});
		expect(chain[0].card.id).toBe(pile[0].card.id);
		expect(chain.length).toBeGreaterThanOrEqual(1);
		const ids = chain.map((c) => c.card.id);
		expect(new Set(ids).size).toBe(ids.length); // 无重复(seen 去重)
	});
	test('pairing 首尾向中央配对、每对带尊位', () => {
		const pairs = pairing(pile);
		expect(pairs.length).toBe(4); // 8 张 → 4 对
		expect(pairs[0].a.id).toBe(pile[0].card.id);
		expect(pairs[0].b.id).toBe(pile[7].card.id);
		expect(pairs.every((p) => p.strength !== undefined)).toBe(true);
	});
});

describe('开钥五操作', () => {
	test('指示牌必选:无 sig → error', () => {
		expect(openingOfKey(CORE78, null, 's').error).toBeTruthy();
	});
	test('sig 不在牌组 → error', () => {
		expect(openingOfKey(CORE78, 999999, 's').error).toBeTruthy();
	});
	test('有 sig → 4 操作,各操作 sig 落堆+计数链+配对', () => {
		const r = openingOfKey(CORE78, SIG, 'seed-A');
		expect(r.operations.length).toBe(4);
		r.operations.forEach((op) => {
			expect(op.pileSize).toBeGreaterThan(0);
			expect(op.chain.length).toBeGreaterThanOrEqual(1);
			expect(op.chain[0].card.id).toBe(SIG); // 每操作从 sig 起数
			expect(op.pairs.length).toBeGreaterThanOrEqual(1);
		});
		expect(r.op5.summary).toContain('四元素');
	});
	test('确定性:同种子同结果、异种子异结果', () => {
		const a = openingOfKey(CORE78, SIG, 'seed-A');
		const b = openingOfKey(CORE78, SIG, 'seed-A');
		const c = openingOfKey(CORE78, SIG, 'seed-B');
		expect(a.op5.summary).toBe(b.op5.summary);
		expect(a.op5.summary).not.toBe(c.op5.summary);
	});
	test('操作1分4堆(YHVH四界)、sig 堆约 19-20 张', () => {
		const r = openingOfKey(CORE78, SIG, 'seed-A');
		expect(r.operations[0].pileSize).toBeGreaterThanOrEqual(15);
		expect(r.operations[0].pileLabel).toContain('界');
	});
});

describe('开钥接线 buildReading', () => {
	test('golden_dawn opening_of_key + sig → reading.ook 有 4 操作', () => {
		const r = buildReading('golden_dawn', 'opening_of_key', 'ook-seed', { sig: { mode: 'manual', manualId: 'wands_king' } });
		expect(r.ook && r.ook.operations && r.ook.operations.length).toBe(4);
		expect(r.significator.sid).toBe('wands_king');
	});
	test('无指示牌 → reading.ook.error', () => {
		const r = buildReading('golden_dawn', 'opening_of_key', 'ook-seed', { sig: { mode: 'none' } });
		expect(r.ook.error).toBeTruthy();
	});
	test('rws(caps.ook=false)不产 ook', () => {
		const r = buildReading('rws', 'opening_of_key', 'x', { sig: { mode: 'manual', manualId: 'wands_king' } });
		expect(r.ook).toBeFalsy();
	});
});
