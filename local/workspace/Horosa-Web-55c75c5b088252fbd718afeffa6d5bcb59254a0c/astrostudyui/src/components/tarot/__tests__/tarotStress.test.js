// 塔罗穷尽压测:buildReading(中右栏单一真值源)× 全 14 牌组 × 各牌组合法牌阵(caps.spreads)× 逆位/尊位/变体/指示牌/裁决
//   → ①不抛 ②结构完整(draws 数=牌阵位数、每 draw 有 card、summary 齐) ③同 seed 可复现 ④单次<阈值。
//   纯前端生成(无 byte-perfect golden;确定性靠 seed)。registry 驱动:增删牌组/牌阵自动纳入。
import { buildReading } from '../engine/reading.js';
import { listDeckIds, getDeck, getDeckCards } from '../engine/deckRegistry.js';
import { SPREADS } from '../engine/spreads.js';
import { yesNo, birthCards, yearCard } from '../engine/verdict.js';

const DECK_IDS = listDeckIds();
const VERDICT_MODES = ['majority', 'orientation', 'single', 'numeric', 'polarity'];

function readingOk(r, expectN){
	if(!r || !Array.isArray(r.draws)){ return false; }
	if(typeof expectN === 'number' && r.draws.length !== expectN){ return false; }
	if(!r.draws.every((d)=> d && d.card && d.position)){ return false; }
	if(!r.summary || typeof r.summary.total !== 'number'){ return false; }
	return !!(r.deckId && r.spreadType && r.settings);
}

describe('塔罗穷尽压测 · 全牌组 × 全牌阵 × 全设置', ()=>{
	test('14 牌组登记齐全 + 每组牌数与 caps 自洽', ()=>{
		expect(DECK_IDS.length).toBe(14);
		DECK_IDS.forEach((id)=>{
			const d = getDeck(id);
			const cards = getDeckCards(id);
			expect(cards.length).toBe(d.size);
			expect(Array.isArray(d.caps.spreads)).toBe(true);
			expect(d.caps.spreads.length).toBeGreaterThan(0);
		});
	});

	// 主笛卡尔:每牌组 × 其全部合法牌阵 × (逆位 on/off) × (尊位 on/off,牌组支持时) → 不抛 + 结构齐。
	test('全牌组 × 各组合法牌阵 × 逆位×尊位:buildReading 不抛 + draws 数=牌阵位数 + 每张有 card', ()=>{
		let n = 0;
		DECK_IDS.forEach((id)=>{
			const deck = getDeck(id);
			deck.caps.spreads.forEach((sp)=>{
				const spDef = SPREADS[sp];
				[true, false].forEach((reversals)=>{
					// 单张逆位占卜特例:逆位开=恰 1 张(第一张逆位牌);逆位关=0 张+error 提示。
					const posN = spDef.firstReversal ? (reversals ? 1 : 0) : spDef.positions.length;
					[true, false].forEach((dignities)=>{
						let r = null;
						const settings = { reversals, dignities, seed: undefined };
						expect(()=>{ r = buildReading(id, sp, `seed-${id}-${sp}-${reversals}-${dignities}`, settings); }).not.toThrow();
						expect(readingOk(r, posN)).toBe(true);
						// 逆位关 → 无任何逆位牌
						if(!reversals){ expect(r.draws.every((d)=> d.isReversed === false)).toBe(true); }
						// 尊位开且牌组支持 → 每 draw 带 dignity
						if(dignities && deck.dignities){ expect(r.draws.every((d)=> d.dignity)).toBe(true); }
						n++;
					});
				});
			});
		});
		// 至少跑满 14 牌组的全牌阵 × 4 设置组合
		const totalSpreadPairs = DECK_IDS.reduce((acc, id)=> acc + getDeck(id).caps.spreads.length, 0);
		expect(n).toBe(totalSpreadPairs * 4);
	});

	// 变体 A/B/C × 指示牌(none/auto) × 支持指示牌的 78 张牌组:不抛 + 指示牌从牌池剔除(draws 不含指示牌 id)。
	test('变体ABC × 指示牌(none/auto)× 支持牌组:不抛 + 指示牌剔除池 + draws 张数不变', ()=>{
		const sigDecks = DECK_IDS.filter((id)=> getDeck(id).caps.significator);
		expect(sigDecks.length).toBeGreaterThan(0);
		let n = 0;
		sigDecks.forEach((id)=>{
			['A', 'B', 'C'].forEach((variant)=>{
				[{ mode: 'none' }, { mode: 'auto', gender: 'female', age: 30, sign: 'Aries' }].forEach((sig)=>{
					let r = null;
					expect(()=>{ r = buildReading(id, 'three', `${id}-${variant}-${sig.mode}`, { variant, sig, showCorrespondences: true }); }).not.toThrow();
					expect(readingOk(r, 3)).toBe(true);
					if(sig.mode === 'auto' && r.significator){
						// 指示牌已从池剔除:draws 不含同 id
						expect(r.draws.every((d)=> d.cardId !== r.significator.cardId)).toBe(true);
					}
					n++;
				});
			});
		});
		expect(n).toBe(sigDecks.length * 3 * 2);
	});

	test('同 seed 完全可复现(确定性):同参两次 draws 序列与逆位逐张一致', ()=>{
		DECK_IDS.forEach((id)=>{
			const sp = getDeck(id).caps.spreads[0];
			const a = buildReading(id, sp, 'repro-seed-42', { reversals: true });
			const b = buildReading(id, sp, 'repro-seed-42', { reversals: true });
			expect(a.draws.map((d)=> d.cardId)).toEqual(b.draws.map((d)=> d.cardId));
			expect(a.draws.map((d)=> d.isReversed)).toEqual(b.draws.map((d)=> d.isReversed));
		});
	});

	test('不同 seed 改抽(改池):同牌组同牌阵两不同 seed 序列应不同', ()=>{
		// 用张数较多的牌阵以避免偶然相同
		const a = buildReading('rws', 'celtic', 'seed-AAA', { reversals: true });
		const b = buildReading('rws', 'celtic', 'seed-BBB', { reversals: true });
		expect(a.draws.map((d)=> d.cardId)).not.toEqual(b.draws.map((d)=> d.cardId));
	});

	test('Lenormand 读法牌组(lenormand/kipper):Grand Tableau/9宫/成句 挂 reading.lenormand + 全程上位', ()=>{
		['lenormand', 'kipper'].forEach((id)=>{
			const gt = buildReading(id, 'grand_tableau', `${id}-gt`, {});
			expect(gt.lenormand).toBeTruthy();
			expect(gt.lenormand.kind).toBe('gt');
			expect(gt.draws.length).toBe(SPREADS.grand_tableau.positions.length);
			// Lenormand 永远正位
			expect(gt.draws.every((d)=> d.isReversed === false)).toBe(true);
			const box = buildReading(id, 'lenormand_box9', `${id}-box`, {});
			expect(box.lenormand.kind).toBe('box9');
			const pair = buildReading(id, 'lenormand_3', `${id}-pair`, {});
			expect(pair.lenormand.kind).toBe('pair');
		});
	});

	test('裁决全模式(5)对 three 牌阵不抛 + 产出判词;生命牌/年牌边界(闰年/月末)不抛', ()=>{
		const r = buildReading('rws', 'three', 'verdict-seed', { reversals: true });
		VERDICT_MODES.forEach((mode)=>{
			let v = null;
			expect(()=>{ v = yesNo(r.draws, mode); }).not.toThrow();
			expect(v && v.verdict).toBeTruthy();
		});
		// 生命牌/年牌:闰年 2/29、年末 12/31、年初 1/1
		[[2000, 2, 29], [1999, 12, 31], [2024, 1, 1]].forEach(([y, m, d])=>{
			expect(()=> birthCards(y, m, d)).not.toThrow();
			expect(()=> yearCard(m, d, y)).not.toThrow();
			const bc = birthCards(y, m, d);
			expect(typeof bc.personality === 'number' || typeof bc.personality === 'object').toBe(true);
		});
	});

	test('本地引擎单次耗时<阈值(期望<500ms,>1s 标红):最大牌阵 grand_tableau 计时', ()=>{
		const t0 = Date.now();
		buildReading('lenormand', 'grand_tableau', 'perf-seed', {});
		expect(Date.now() - t0).toBeLessThan(1000);
	});
});
