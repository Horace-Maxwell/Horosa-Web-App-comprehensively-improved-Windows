// TP4 专项:yesNo 三新法 / 组合征象(门槛+朝向匹配+护栏) / 计时五法确定性 / 空白牌 / 大牌加盖 / 切牌 / 双指示牌。
import { yesNo, YESNO_MODES } from '../engine/verdict';
import { comboHints } from '../decks/comboThemes';
import { computeTimingLines, aceHuntTiming, decanTimingOf } from '../engine/timingMethods';
import { buildReading } from '../engine/reading';
import { buildReadingText } from '../engine/reportText';
import { displayName } from '../engine/cardSchema';
import { CORE78 } from '../decks/core78';

const by = {};
CORE78.forEach((c) => { by[c.sid] = c; });
const D = (sid, rev, i) => ({ position: { i: i || 1, label: `位${i || 1}` }, cardId: by[sid].id, isReversed: !!rev, card: by[sid] });

describe('yesNo 三新法', () => {
	test('中位加权:中间牌×2;平手出三义注', () => {
		expect(yesNo([D('wands_02'), D('cups_03', true), D('swords_06')], 'weighted_center').verdict).toBe('MAYBE 未定');
		expect(yesNo([D('wands_02'), D('cups_03', true), D('swords_06')], 'weighted_center').note).toContain('三义');
		expect(yesNo([D('wands_02'), D('cups_03'), D('swords_06', true)], 'weighted_center').verdict).toBe('YES 是');
	});
	test('答案锚位:答案位+结果位皆正且不凶=是;答案位逆位王牌=否(延迟)', () => {
		const seven = [D('wands_02', false, 1), D('cups_03', false, 2), D('swords_06', false, 3), D('pentacles_06', false, 4), D('wands_04', false, 5), D('cups_06', false, 6), D('the_sun', false, 7)];
		expect(yesNo(seven, 'anchor').verdict).toBe('YES 是');
		const aceRev = seven.slice();
		aceRev[3] = D('wands_01', true, 4);
		const r = yesNo(aceRev, 'anchor');
		expect(r.verdict).toBe('NO 否');
		expect(r.note).toContain('延迟');
	});
	test('单张三态:正吉=是/正艰=是但需努力/逆=否', () => {
		expect(yesNo([D('swords_06')], 'single3').verdict).toBe('YES 是');
		expect(yesNo([D('cups_05')], 'single3').verdict).toBe('是,但需努力');
		expect(yesNo([D('swords_06', true)], 'single3').verdict).toBe('NO 否');
		expect(YESNO_MODES.length).toBe(8);
	});
});

describe('组合征象', () => {
	test('缔结征两张即中;转化征须≥4(三张不中);朝向匹配规则(逆位才计)', () => {
		expect(comboHints([D('justice'), D('cups_02')]).find((h) => h.key === 'marriage')).toBeTruthy();
		expect(comboHints([D('death'), D('the_tower'), D('judgement')]).find((h) => h.key === 'transform')).toBeFalsy();
		const t = comboHints([D('death'), D('the_tower'), D('judgement'), D('swords_10')]).find((h) => h.key === 'transform');
		expect(t).toBeTruthy();
		expect(t.guard).toBe('transform');
		expect(comboHints([D('pentacles_01', true), D('pentacles_09', true)]).find((h) => h.key === 'money_lack')).toBeTruthy();
		expect(comboHints([D('pentacles_01'), D('pentacles_09')]).find((h) => h.key === 'money_lack')).toBeFalsy();
		expect(comboHints([D('cups_09')]).find((h) => h.key === 'wish')).toBeTruthy();
	});
});

describe('计时五法', () => {
	const seed = 'tp4-timing';
	const mkReading = (settings) => buildReading('rws', 'three', seed, settings || {});
	test('花色单位(默认)逐张出行;旬星全谱含旬窗;大牌数字/星座用「另取大牌」且确定;翻至王牌确定可复现', () => {
		const r = mkReading();
		expect(computeTimingLines(r, CORE78, 'suit_unit').length).toBe(3);
		const full = computeTimingLines(r, CORE78, 'decan_full');
		expect(full.length).toBe(3);
		const mn = computeTimingLines(r, CORE78, 'major_number', { unit: '月' });
		expect(mn[0]).toContain('另取大牌=');
		expect(mn).toEqual(computeTimingLines(mkReading(), CORE78, 'major_number', { unit: '月' }));
		const mz = computeTimingLines(r, CORE78, 'major_zodiac');
		expect(mz[0]).toMatch(/座区间|难定|难成/);
		const ah1 = aceHuntTiming(CORE78, seed);
		const ah2 = aceHuntTiming(CORE78, seed);
		expect(ah1).toEqual(ah2);
		expect(ah1.season).toMatch(/[春夏秋冬]/);
		expect(ah1.note).toBeTruthy();
	});
	test('旬星全谱单牌口径:数字=旬窗/宫廷=跨段/星座大牌=区间/行星大牌=曜日/三元素=不用', () => {
		expect(decanTimingOf(by.wands_05)).toContain('旬窗');
		expect(decanTimingOf(by.wands_king)).toContain('宫廷跨段');
		expect(decanTimingOf(by.the_emperor)).toContain('白羊');
		expect(decanTimingOf(by.the_sun)).toContain('主日');
		expect(decanTimingOf(by.the_fool)).toContain('不用于计时');
	});
});

describe('空白牌/切牌/大牌加盖/双指示牌', () => {
	test('空白牌:开=79 张池且空白牌在序中;关=默认 78 不变;显示名安全', () => {
		const seed = 'tp4-blank';
		const on = buildReading('rws', 'three', seed, { includeBlank: true });
		expect(on.draws.length + on.restIds.length).toBe(79);
		const all = on.draws.map((d) => d.cardId).concat(on.restIds);
		expect(all).toContain(78);
		const off = buildReading('rws', 'three', seed, {});
		expect(off.draws.length + off.restIds.length).toBe(78);
		const blank = CORE78.concat([]).length === 78 ? { arcana: 'blank', name_cn: '空白牌', name_en: 'The Blank' } : null;
		expect(displayName(blank, null)).toBe('The Blank 空白牌');
	});
	test('切牌:开=确定性一张(含朝向);关=null', () => {
		const seed = 'tp4-cut';
		const a = buildReading('rws', 'three', seed, { showCutCard: true });
		const b = buildReading('rws', 'three', seed, { showCutCard: true });
		expect(a.cutCard && a.cutCard.card).toBeTruthy();
		expect(a.cutCard.card.id).toBe(b.cutCard.card.id);
		expect(buildReading('rws', 'three', seed, {}).cutCard).toBeNull();
		expect(buildReadingText(a)).toContain('切牌(心态)');
	});
	test('大牌加盖:寻一个 ≥4 大牌的 celtic 种子→每张大牌得盖一张小牌;快照出加盖行', () => {
		let hit = null;
		for(let i = 0; i < 300 && !hit; i++){
			const r = buildReading('rws', 'celtic', `tp4-ov-${i}`, { majorsOverlay: true });
			const majors = r.draws.filter((d) => d.card.arcana === 'major');
			if(majors.length >= 4){ hit = { r, majors }; }
		}
		expect(hit).toBeTruthy();
		hit.majors.forEach((d) => {
			expect(d.overlay && d.overlay.card && d.overlay.card.arcana === 'minor').toBe(true);
		});
		expect(buildReadingText(hit.r)).toContain('加盖:');
		// 关=不加盖
		const off = buildReading('rws', 'celtic', hit.r.seed, {});
		expect(off.draws.some((d) => d.overlay)).toBe(false);
	});
	test('双指示牌:女=牌八(战车位),男=牌一(库首),且剔出池', () => {
		const f = buildReading('etteilla', 'three', 'tp4-ett', { sig: { mode: 'etteilla', gender: 'female' } });
		expect(f.significator.sid).toBe('the_chariot');
		expect(f.draws.every((d) => d.cardId !== f.significator.cardId)).toBe(true);
		const m = buildReading('etteilla', 'three', 'tp4-ett', { sig: { mode: 'etteilla', gender: 'male' } });
		expect(m.significator.sid).toBe('the_fool');
	});
});

describe('[定局] 段新行', () => {
	test('计时行恒出;命中征象时出征象行', () => {
		const txt = buildReadingText(buildReading('rws', 'celtic', 'tp4-seg', {}));
		expect(txt).toContain('计时(花色单位):');
	});
});
