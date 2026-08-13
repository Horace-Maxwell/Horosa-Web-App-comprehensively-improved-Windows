// TP1 逆位体系专项:13 模式语义锚 + 回退前课链 + 逆位产生三方式(order 恒不变) + 交叉牌三态 + 密度诊断 + 单张逆位占卜。
import { REVERSAL_MODES, REVERSAL_MODE_GROUPS, REVERSAL_TEMPLATES, reversedText } from '../engine/reversalModes';
import { cardMeaning, retreatText } from '../engine/cardSchema';
import { buildReading } from '../engine/reading';
import { synthesize } from '../engine/verdict';
import { shuffle } from '../engine/shuffle';
import { buildReadingText } from '../engine/reportText';
import { CORE78 } from '../decks/core78';
import { reversalHintOf } from '../decks/reversalHints';

const by = {};
CORE78.forEach((c) => { by[c.sid] = c; });
const up = (c) => cardMeaning(c, false, 'manual', 'stored');
const revM = (c, mode) => cardMeaning(c, true, 'manual', mode);

describe('逆位模式 13 式', () => {
	test('注册表:13 模式;分组覆盖全模式;模板型全有 tpl(retreat 为引擎型)', () => {
		expect(REVERSAL_MODES.length).toBe(13);
		const grouped = REVERSAL_MODE_GROUPS.flatMap((g) => g.items).sort();
		expect(grouped).toEqual(REVERSAL_MODES.slice().sort());
		REVERSAL_MODES.filter((m) => m !== 'stored' && m !== 'retreat').forEach((m) => {
			expect(typeof REVERSAL_TEMPLATES[m].tpl).toBe('function');
		});
		expect(REVERSAL_TEMPLATES.retreat.tpl).toBeNull();
	});

	test('模板语义锚:各模式产出含其标志词;opposite 与 stored 必可辨;未知模式回落预存义', () => {
		const c = by.cups_08;
		const u = up(c);
		const storedRev = revM(c, 'stored');
		expect(revM(c, 'blocked')).toContain(u);
		expect(revM(c, 'blocked')).toContain('受阻');
		expect(revM(c, 'delayed')).toContain('延迟');
		expect(revM(c, 'projection')).toContain('投射');
		expect(revM(c, 'misuse')).toContain('用错');
		expect(revM(c, 'negation').startsWith('不是/没有')).toBe(true);
		expect(revM(c, 'breakthrough')).toContain('挣脱');
		expect(revM(c, 're_words')).toContain('回撤');
		// [QA-1] opposite 曾直接返回预存逆位义 → 与 stored 逐字全等,是切了没反应的死开关。
		// 修后它明写「反于正位『…』」的取义框架:与 stored 必不相同,且预存逆位义仍照实并陈。
		expect(revM(c, 'opposite')).not.toBe(storedRev);
		expect(revM(c, 'opposite')).toContain('反于正位');
		expect(revM(c, 'opposite')).toContain(u);
		expect(revM(c, 'opposite')).toContain(storedRev);
		// 无预存逆位义时 stored 落空、opposite 仍成文 —— 这正是两档并存的实质理由
		expect(reversedText(u, '', 'opposite')).toBe(`反于正位「${u}」`);
		expect(reversedText(u, storedRev, 'no_such_mode')).toBe(storedRev);
	});

	test('[QA-1] 十三式两两互异:任何一档都不得与另一档逐字全等(死开关的镜像判据)', () => {
		const c = by.cups_08;
		const outs = REVERSAL_MODES.map((m) => `${m}=${revM(c, m)}`);
		const texts = REVERSAL_MODES.map((m) => revM(c, m));
		const twins = [];
		texts.forEach((a, i) => texts.forEach((b, j) => { if(j > i && a === b){ twins.push(`${REVERSAL_MODES[i]}≡${REVERSAL_MODES[j]}`); } }));
		expect(`孪生档对: ${twins.join(' , ')}`).toBe('孪生档对: ');
		expect(outs.length).toBe(13);
	});

	test('回退前课链:数字回前一号/王牌回十/大牌回前一号/愚人特文/因果之牌照正读/宫廷回落预存义', () => {
		expect(revM(by.cups_08, 'retreat')).toContain('圣杯七');
		expect(revM(by.cups_08, 'retreat')).toContain(up(by.cups_07));
		expect(revM(by.wands_01, 'retreat')).toContain('权杖十');
		expect(revM(by.the_moon, 'retreat')).toContain('星星');
		expect(revM(by.the_fool, 'retreat')).toContain('时机未熟');
		expect(revM(by.justice, 'retreat')).toContain('因果');
		expect(revM(by.justice, 'retreat')).toContain(up(by.justice));
		expect(revM(by.wands_queen, 'retreat')).toBe(revM(by.wands_queen, 'stored'));
		// waite 轨:前一课正位义按 waite 体系取(体系一致性)
		const waiteRetreat = cardMeaning(by.cups_08, true, 'waite', 'retreat');
		expect(waiteRetreat).toContain(cardMeaning(by.cups_07, false, 'waite', 'stored'));
	});

	test('retreatText 直调:与 cardMeaning 分派一致', () => {
		const c = by.swords_05;
		expect(retreatText(c, 'manual', up(c), revM(c, 'stored'))).toBe(revM(c, 'retreat'));
	});
});

describe('逆位产生三方式(order 恒不变)', () => {
	const seed = 'tp1-gen-seed';
	test('all:非交叉位全逆;fingers3:全阵逆位数≤3;三方式同 seed 同 order(只换朝向)', () => {
		const base = buildReading('rws', 'celtic', seed, { reversals: true });
		const all = buildReading('rws', 'celtic', seed, { reversals: true, reversalGen: 'all' });
		const f3 = buildReading('rws', 'celtic', seed, { reversals: true, reversalGen: 'fingers3' });
		const ids = (r) => r.draws.map((d) => d.cardId);
		expect(ids(all)).toEqual(ids(base));
		expect(ids(f3)).toEqual(ids(base));
		all.draws.forEach((d) => {
			if(d.position.crossFixed){ expect(d.isReversed).toBe(false); expect(d.crossed).toBe(true); }
			else{ expect(d.isReversed).toBe(true); }
		});
		expect(f3.draws.filter((d) => d.isReversed).length).toBeLessThanOrEqual(3);
		// fingers3 确定性
		const f3b = buildReading('rws', 'celtic', seed, { reversals: true, reversalGen: 'fingers3' });
		expect(f3.draws.map((d) => d.isReversed)).toEqual(f3b.draws.map((d) => d.isReversed));
	});

	test('逆位关时产生方式不生效(全正)', () => {
		const r = buildReading('rws', 'three', seed, { reversals: false, reversalGen: 'all' });
		expect(r.draws.every((d) => !d.isReversed)).toBe(true);
	});
});

describe('交叉牌第三态', () => {
	const seed = 'tp1-cross-seed';
	test('默认开:凯尔特位2 恒正读+crossed 标记;快照正逆列出「横置」', () => {
		const r = buildReading('rws', 'celtic', seed, { reversals: true });
		const d2 = r.draws[1];
		expect(d2.position.crossFixed).toBe(true);
		expect(d2.crossed).toBe(true);
		expect(d2.isReversed).toBe(false);
		expect(buildReadingText(r)).toContain('| 横置 |');
	});
	test('关=旧行为:位2 按洗牌朝向,无 crossed 标记(off 字节恒等锚)', () => {
		const r = buildReading('rws', 'celtic', seed, { reversals: true, crossingUpright: false });
		const raw = shuffle(seed, { size: 78, usesReversals: true, pReversed: 0.5 });
		expect(r.draws[1].crossed).toBeUndefined();
		expect(r.draws[1].isReversed).toBe(raw.reversed[1]);
		expect(buildReadingText(r)).not.toContain('横置');
	});
});

describe('逆位密度诊断 + 单张逆位占卜', () => {
	test('诊断:全逆=all;8/10 逆=high;半数=null', () => {
		const mk = (n, rev) => CORE78.slice(0, n).map((c, i) => ({ card: c, isReversed: i < rev, position: { i: i + 1 } }));
		expect(synthesize(mk(5, 5)).reversalDiagnosis.level).toBe('all');
		expect(synthesize(mk(10, 8)).reversalDiagnosis.level).toBe('high');
		expect(synthesize(mk(10, 5)).reversalDiagnosis).toBeNull();
	});

	test('单张逆位占卜:恰 1 张逆位牌;count 与洗牌序一致;同 seed 复现;逆位关出 error', () => {
		const seed = 'tp1-first-rx';
		const r = buildReading('rws', 'first_reversal', seed, { reversals: true });
		expect(r.draws.length).toBe(1);
		expect(r.draws[0].isReversed).toBe(true);
		const raw = shuffle(seed, { size: 78, usesReversals: true, pReversed: 0.5 });
		let hit = -1;
		for(let i = 0; i < raw.order.length; i++){ if(raw.reversed[i]){ hit = i; break; } }
		expect(r.firstReversal.count).toBe(hit + 1);
		expect(r.draws[0].cardId).toBe(raw.order[hit]);
		expect(['强而活跃', '中等在场', '深藏无意识', '意义有限']).toContain(r.firstReversal.level);
		expect(r.firstReversal.questions.length).toBe(6);
		const r2 = buildReading('rws', 'first_reversal', seed, { reversals: true });
		expect(r2.draws[0].cardId).toBe(r.draws[0].cardId);
		const off = buildReading('rws', 'first_reversal', seed, { reversals: false });
		expect(off.draws.length).toBe(0);
		expect(off.firstReversal.error).toBeTruthy();
		expect(buildReadingText(r)).toContain('单张逆位占卜:翻至第');
	});
});

describe('逆位速查', () => {
	test('静态等待牌/宫廷通则/大牌通则各有实锚', () => {
		expect(reversalHintOf(by.cups_04)).toContain('等待将尽');
		expect(reversalHintOf(by.wands_queen)).toContain('宫廷牌逆位通则');
		expect(reversalHintOf(by.the_fool)).toContain('大牌通则');
		expect(reversalHintOf(by.swords_02)).toContain('位阶通则');
	});
});
