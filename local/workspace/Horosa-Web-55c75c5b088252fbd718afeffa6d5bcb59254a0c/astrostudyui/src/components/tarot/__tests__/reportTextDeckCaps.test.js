// [Q-222/T-185] 快照 [定局] 与「变体」按 deck.caps 门控(与页面同源):雷诺曼读法牌组不出 [定局],无变体能力牌组不写「变体 A」。
import { buildReading } from '../engine/reading.js';
import { getDeck } from '../engine/deckRegistry.js';
import { buildReadingText } from '../engine/reportText.js';

describe('buildReadingText × deck.caps 门控', () => {
	test('雷诺曼 / 基帕:无 [定局] 段、无 Yes/No、设置行无「变体」', () => {
		['lenormand', 'kipper'].forEach((id) => {
			const d = getDeck(id);
			expect(d.caps.readingMethod).toBe('lenormand');
			const r = buildReading(id, 'lenormand_3', 'caps-seed', {});
			const t = buildReadingText(r, '测试');
			expect(t).not.toContain('[定局]');
			expect(t).not.toMatch(/Yes\/No=/);
			expect(t).not.toMatch(/设置:[^\n]*变体/);
			expect(t).toContain('[牌阵综览]');
		});
	});
	test('塔罗核心牌组:仍有 [定局] 与「变体」(零回归)', () => {
		const r = buildReading('rws', 'three', 'caps-seed', { reversals: true });
		const t = buildReadingText(r, '测试');
		expect(t).toContain('[定局]');
		expect(t).toMatch(/Yes\/No=/);
		expect(t).toMatch(/设置:[^\n]*变体 [ABC]/);
	});
	test('扑克 / 西比拉(cartomancy 读法):无变体能力 → 不写「变体」,但保留 [定局]', () => {
		['cartomancy', 'sibilla'].forEach((id) => {
			const d = getDeck(id);
			expect(d.caps.variant).toBe(false);
			const r = buildReading(id, 'three', 'caps-seed', {});
			const t = buildReadingText(r, '测试');
			expect(t).not.toMatch(/设置:[^\n]*变体/);
			expect(t).toContain('[定局]');
		});
	});
});

// [Q-223/T-189·FT-31/FT-33] 快照标注:定局口径中文标签 / 设置行补非缺省口径 / 牌间关系与澄清牌 / 「个月」。
describe('[Q-223/T-189] 塔罗快照标注', () => {
	const { buildReading } = require('../engine/reading');
	const { buildReadingText } = require('../engine/reportText');
	const { computeTimingLines } = require('../engine/timingMethods');
	test('定局口径写中文(不再直出 weighted_center);相邻串/镜像对/桥接进 [定局];澄清牌只在 opts.clarifier 时写', () => {
		const r = buildReading('rws', 'three', 'q223-seed', { verdictMode: 'weighted_center' });
		const t = buildReadingText(r, '测试');
		expect(t).toContain('(中位加权,score ');
		expect(t).not.toContain('weighted_center');
		expect(t).toMatch(/相邻串:.+×/);
		expect(t).toMatch(/桥接\(首尾\):/);
		expect(t).not.toContain('澄清牌:');
		const t2 = buildReadingText(r, '测试', { clarifier: true });
		expect(t2).toContain('澄清牌:');
	});
	test('设置行:缺省口径不写(零回归);非缺省牌义/逆位读法/逆位产生/交叉牌/宫廷体系逐项写', () => {
		const base = buildReadingText(buildReading('rws', 'three', 'q223-seed', {}), '');
		expect(base.split('\n').find((l) => l.startsWith('设置:'))).not.toMatch(/牌义|逆位读法|逆位产生|交叉牌|宫廷/);
		const r = buildReading('rws', 'three', 'q223-seed', { reversals: true, meaningSystem: 'waite', reversalMode: 'blocked', reversalGen: 'all', crossingUpright: false, courtElementSystem: 'alt', courtZodiacSystem: 'simple' });
		const line = buildReadingText(r, '').split('\n').find((l) => l.startsWith('设置:'));
		expect(line).toContain('牌义 Waite 1911');
		expect(line).toContain('逆位读法 受阻/压抑');
		expect(line).toContain('逆位产生 全逆');
		expect(line).toContain('交叉牌不横置');
		expect(line).toContain('宫廷元素 位阶制');
		expect(line).toContain('宫廷星座 单座制');
	});
	test('大牌数字法单位「月」→「约 N 个月内」', () => {
		const { getDeckCards } = require('../engine/deckRegistry');
		const r = buildReading('rws', 'three', 'q223-seed', { timingMethod: 'major_number', timingUnit: '月' });
		const lines = computeTimingLines(r, getDeckCards('rws'), 'major_number', { unit: '月' });
		const hit = lines.find((l) => /约 \d+ /.test(l));
		if (hit) { expect(hit).toMatch(/约 \d+ 个月内/); }
	});
});
