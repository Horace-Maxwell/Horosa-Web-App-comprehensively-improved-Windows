// TP5 牌阵扩容哨兵:注册完备/分组覆盖(双向)/matrix 结构/大牌子集阵/双读位义/锚位联动。
import { SPREADS, TAROT_SPREADS, TAROT_SPREADS_78_EXTRA, SPREAD_GROUPS } from '../engine/spreads';
import { getDeck } from '../engine/deckRegistry';
import { buildReading } from '../engine/reading';
import { yesNo } from '../engine/verdict';

describe('注册与分组覆盖', () => {
	test('TAROT_SPREADS + 78 家族三阵全部真实存在于 SPREADS', () => {
		TAROT_SPREADS.concat(TAROT_SPREADS_78_EXTRA).forEach((k) => {
			expect(SPREADS[k] && SPREADS[k].positions && SPREADS[k].positions.length).toBeTruthy();
		});
	});
	test('分组表双向覆盖:组内项都存在;通用清单+三阵+开钥+单张逆位+雷诺曼 无一漏组(加阵忘登分组=此处咬)', () => {
		const grouped = new Set(SPREAD_GROUPS.flatMap((g) => g.items));
		grouped.forEach((k) => expect(SPREADS[k]).toBeTruthy());
		const mustCover = TAROT_SPREADS.concat(TAROT_SPREADS_78_EXTRA)
			.concat(['opening_of_key', 'first_reversal', 'lenormand_3', 'lenormand_box9', 'grand_tableau']);
		mustCover.forEach((k) => {
			expect(`${k}:${grouped.has(k)}`).toBe(`${k}:true`);
		});
	});
	test('matrix 阵结构:张数与 row/col 完备', () => {
		const expects = { world15: 15, hero22: 22, choice22: 22, latent26: 26, calendar31: 31, problem_solving9: 9 };
		Object.keys(expects).forEach((k) => {
			const sp = SPREADS[k];
			expect(sp.layout).toBe('matrix');
			expect(sp.positions.length).toBe(expects[k]);
			sp.positions.forEach((p) => {
				expect(typeof p.row).toBe('number');
				expect(typeof p.col).toBe('number');
				expect(p.col).toBeLessThan(sp.matrix.cols);
				expect(p.row).toBeLessThan(sp.matrix.rowLabels.length);
			});
		});
	});
});

describe('大牌子集阵(因果七杯)', () => {
	test('七张全为大牌;确定可复现;空白牌开着也不入子集;78 家族有此阵而 22 大牌组无', () => {
		const seed = 'tp5-causal';
		const r = buildReading('rws', 'causal7', seed, { includeBlank: true });
		expect(r.draws.length).toBe(7);
		r.draws.forEach((d) => expect(d.card.arcana).toBe('major'));
		expect(r.draws.length + r.restIds.length).toBe(22);
		const r2 = buildReading('rws', 'causal7', seed, { includeBlank: true });
		expect(r.draws.map((d) => d.cardId)).toEqual(r2.draws.map((d) => d.cardId));
		expect(getDeck('rws').caps.spreads).toContain('causal7');
		expect(getDeck('bota').caps.spreads).toContain('causal7');
		expect(getDeck('wirth').caps.spreads).not.toContain('causal7');
		expect(getDeck('rws').caps.spreads).toContain('latent26');
		expect(getDeck('rws').caps.spreads).toContain('calendar31');
		expect(getDeck('wirth').caps.spreads).toContain('hero22'); // 22 张阵=22 大牌组可行
	});
});

describe('位义细节', () => {
	test('悬吊之局六位皆「外:…内:…」双读;七张V核心位带 anchor;四元素位带 slotElement', () => {
		SPREADS.hanged6.positions.forEach((p) => {
			expect(p.meaning).toContain('外:');
			expect(p.meaning).toContain('内:');
		});
		expect(SPREADS.seven_v.positions[3].anchor).toBe(true);
		expect(SPREADS.elements4.positions.map((p) => p.slotElement)).toEqual(['fire', 'water', 'air', 'earth']);
	});
	test('答案锚位定局法吃 seven_v 的 anchor 标记(锚=第4位)', () => {
		const r = buildReading('rws', 'seven_v', 'tp5-anchor', {});
		const v = yesNo(r.draws, 'anchor');
		expect(v.note).toContain(r.draws[3].card.name_cn);
	});
});
