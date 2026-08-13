// TP2 马赛读法体系专项:数字度第三轨 + deck 吸附 + 对读引擎 + 数值加法(愚人廿二) + 牌底牌 + [对读]段。
import { cardMeaning } from '../engine/cardSchema';
import { resolveSettings, buildReading } from '../engine/reading';
import { getDeck } from '../engine/deckRegistry';
import { quintessence, theosophicalGroups } from '../engine/verdict';
import { decadePartner, sum21Partner, coupleOf, degreeRelation, buildPairReading } from '../engine/pairReading';
import { degreesMeaningOf, degreeOf } from '../decks/marseilleMeanings';
import { buildReadingText } from '../engine/reportText';
import { CORE78 } from '../decks/core78';
import { shuffle } from '../engine/shuffle';

const by = {};
CORE78.forEach((c) => { by[c.sid] = c; });
const D = (sid) => ({ position: { i: 1 }, cardId: by[sid].id, isReversed: false, card: by[sid] });

describe('数字度第三轨', () => {
	test('度义结构:数字=第N度+危险;宫廷=四阶;大牌=马赛关键词;40+16+22 全覆盖', () => {
		expect(cardMeaning(by.swords_05, false, 'degrees')).toContain('第5度');
		expect(cardMeaning(by.swords_05, false, 'degrees')).toContain('危险');
		expect(degreesMeaningOf(by.cups_knight)).toContain('使者');
		expect(degreesMeaningOf(by.the_fool)).toContain('自由');
		CORE78.forEach((c) => { expect(degreesMeaningOf(c)).toBeTruthy(); });
	});
	test('manual/waite 两轨不受扰(字节恒等)', () => {
		expect(cardMeaning(by.cups_08, false, 'manual')).toBe(by.cups_08.meaningsManual.up);
		expect(cardMeaning(by.cups_08, false, 'waite')).toBe(by.cups_08.meanings.up.join('、'));
	});
	test('deck 吸附:tdm 系缺省=degrees,rws=manual,显式选择优先', () => {
		expect(resolveSettings(getDeck('tdm'), {}).meaningSystem).toBe('degrees');
		expect(resolveSettings(getDeck('wirth'), {}).meaningSystem).toBe('degrees');
		expect(resolveSettings(getDeck('rws'), {}).meaningSystem).toBe('manual');
		expect(resolveSettings(getDeck('tdm'), { meaningSystem: 'manual' }).meaningSystem).toBe('manual');
	});
	test('度值(马赛编号框架):力量=XI→第1度;正义=VIII↔月亮XVIII 同度;愚人/世界周期外;宫廷无度', () => {
		expect(degreeOf(by.the_magician)).toBe(1);
		expect(degreeOf(by.strength)).toBe(1); // 马赛 XI → 第1度(与魔术师同度)
		expect(degreeOf(by.justice)).toBe(degreeOf(by.the_moon)); // VIII 与 XVIII 同度
		expect(degreeOf(by.the_fool)).toBeNull();
		expect(degreeOf(by.the_world)).toBeNull();
		expect(degreeOf(by.wands_king)).toBeNull();
	});
});

describe('对读引擎', () => {
	test('十进对/和21补牌/配偶/度关系 语义锚(马赛编号:力量XI↔魔术师I)', () => {
		expect(decadePartner(by.strength).partner.sid).toBe('the_magician'); // XI↔I
		expect(decadePartner(by.justice).partner.sid).toBe('the_moon'); // VIII↔XVIII
		expect(decadePartner(by.the_fool).partner.sid).toBe('the_world');
		expect(sum21Partner(by.the_emperor).partner.sid).toBe('the_star'); // 4+17=21
		expect(sum21Partner(by.strength).partner.sid).toBe('wheel_of_fortune'); // 21-11=10
		expect(coupleOf(by.the_magician, by.strength)).toBeTruthy();
		expect(coupleOf(by.strength, by.the_magician)).toBeTruthy(); // 顺序无关
		expect(degreeRelation(by.swords_04, by.swords_05).kind).toBe('evolve');
		expect(degreeRelation(by.swords_05, by.swords_04).kind).toBe('regress');
		expect(degreeRelation(by.wands_03, by.the_empress).kind).toBe('resonance'); // 第3度跨大小牌共振
		expect(degreeRelation(by.wands_king, by.swords_02)).toBeNull();
	});
	test('buildPairReading:同阵相会高亮 + 配偶命中', () => {
		const pr = buildPairReading([D('the_magician'), D('strength')]);
		expect(pr.majors.find((m) => m.sid === 'the_magician').text).toContain('同阵相会');
		expect(pr.couples.length).toBe(1);
	});
	test('reading.pairs 仅塔罗读法牌组挂载(雷诺曼 null)', () => {
		const t = buildReading('rws', 'three', 'tp2-pairs', {});
		expect(t.pairs === null || typeof t.pairs === 'object').toBe(true);
		const l = buildReading('lenormand', 'lenormand_3', 'tp2-pairs', {});
		expect(l.pairs).toBeNull();
	});
});

describe('数值加法(愚人廿二)与牌底牌', () => {
	test('quintessence 两口径:standard 愚人计0;fool22 愚人计22', () => {
		const draws = [D('the_fool'), D('the_magician')];
		expect(quintessence(draws, CORE78).number).toBe(1); // 0+1=1 魔术师
		expect(quintessence(draws, CORE78, undefined, 'fool22').number).toBe(5); // 22+1=23→5 教皇
	});
	test('分组加法书源锚:13+18+12 → 总和43→7 战车;仅三张时产出', () => {
		const draws = [D('death'), D('the_moon'), D('hanged_man')];
		const g = theosophicalGroups(draws, CORE78);
		expect(g.total.number).toBe(7);
		expect(g.left.number).toBe(4); // 13+18=31→4
		expect(g.right.number).toBe(3); // 18+12=30→3
		expect(g.outer.number).toBe(7); // 13+12=25→7
		expect(theosophicalGroups([D('death')], CORE78)).toBeNull();
	});
	test('牌底牌:开=剔指示牌后底张(含朝向,确定性);关=null', () => {
		const seed = 'tp2-bottom';
		const on = buildReading('rws', 'three', seed, { showBottomCard: true });
		const off = buildReading('rws', 'three', seed, {});
		expect(off.bottomCard).toBeNull();
		const raw = shuffle(seed, { size: 78, usesReversals: true, pReversed: 0.5 });
		expect(on.bottomCard.card.id).toBe(raw.order[77]);
		expect(on.bottomCard.isReversed).toBe(raw.reversed[77]);
		expect(buildReadingText(on)).toContain('牌底牌(基调)');
	});
});

describe('[对读] 快照段', () => {
	test('阵含大牌时产 [对读] 段;fool22 时定局含数值加法行', () => {
		let seed = 'tp2-seg';
		let r = buildReading('rws', 'celtic', seed, {});
		// 找一个含大牌的种子(celtic 10 张,含大牌概率极高;不含则换种子)
		let guard = 0;
		while(!r.draws.some((d) => d.card.arcana === 'major') && guard < 20){ guard++; seed = `tp2-seg-${guard}`; r = buildReading('rws', 'celtic', seed, {}); }
		expect(r.draws.some((d) => d.card.arcana === 'major')).toBe(true);
		expect(buildReadingText(r)).toContain('[对读]');
		const three = buildReading('rws', 'three', 'tp2-f22', { quintMode: 'fool22' });
		expect(buildReadingText(three)).toContain('数值加法:');
	});
});
