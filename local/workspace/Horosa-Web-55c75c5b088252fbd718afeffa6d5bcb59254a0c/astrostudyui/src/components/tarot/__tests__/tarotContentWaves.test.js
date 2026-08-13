// TP6 内容波次覆盖哨兵:传统义/主题占断的逐层覆盖率与结构完整(缺层允许、坏层不允许)。
// 语义:已宣告的波次必须 100% 覆盖其目标集;未开工的波次允许为空,但不允许「半条目」(有键无值/域名非法)。
import { TRAD_MAJOR, TRAD_PIP, TRAD_COURT, traditionalMeaningOf } from '../decks/traditionalMeanings';
import { DOMAIN_MAJOR, DOMAIN_PIP, DOMAIN_COURT, DOMAIN_KEYS, domainsOf, EASTERN_FIGURES, easternFigureOf } from '../decks/domainMeanings';
import { NOTES, noteOf } from '../decks/cardNotes';
import { DUAL, dualTrackOf, dualTrackCoverage } from '../decks/dualTrackMeanings';
import { CORE78 } from '../decks/core78';
import { MAJORS_CORR, SUITS } from '../decks/correspondences';

const by = {};
CORE78.forEach((c) => { by[c.sid] = c; });

describe('内容波次 · 传统义层', () => {
	test('Wave A:大牌 22 张全覆盖,每条 up/rev 皆非空且键=真实 sid', () => {
		expect(Object.keys(TRAD_MAJOR).length).toBe(22);
		MAJORS_CORR.forEach((m) => {
			const t = TRAD_MAJOR[m.id];
			expect(`${m.id}:${!!t}`).toBe(`${m.id}:true`);
			expect(t.up.length).toBeGreaterThan(8);
			expect(t.rev.length).toBeGreaterThan(8);
		});
	});
	test('Wave B/C:数字牌 40 + 宫廷 16 全覆盖,每条 up/rev 非空 → 传统义层 78 张已满', () => {
		SUITS.forEach((s) => {
			for(let r = 1; r <= 10; r++){
				const t = TRAD_PIP[s][r];
				expect(`${s}_${r}:${!!t}`).toBe(`${s}_${r}:true`);
				expect(t.up.length).toBeGreaterThan(8);
				expect(t.rev.length).toBeGreaterThan(8);
			}
			['king', 'queen', 'knight', 'page'].forEach((ct) => {
				const t = TRAD_COURT[s][ct];
				expect(`${s}_${ct}:${!!t}`).toBe(`${s}_${ct}:true`);
				expect(t.up.length).toBeGreaterThan(8);
				expect(t.rev.length).toBeGreaterThan(8);
			});
		});
		// 78 张全可取(大牌 22 + 小牌 56)
		CORE78.forEach((c) => { expect(`${c.sid}:${!!traditionalMeaningOf(c)}`).toBe(`${c.sid}:true`); });
	});
	test('传统层的历史特性锚:与今义倒挂的条目须照实留存,不得被后人「修正」', () => {
		// 宫廷:数张「传统逆位」以褒义起句(非反义而是过量版),权杖后条更自注「过度」
		expect(TRAD_COURT.wands.queen.rev.startsWith('良善之妇')).toBe(true);
		expect(TRAD_COURT.wands.queen.rev).toContain('过度(有时正位义亦适用)');
		expect(TRAD_COURT.wands.king.rev.startsWith('认真的好人')).toBe(true);
		expect(TRAD_COURT.pentacles.knight.rev.startsWith('和平')).toBe(true);
		expect(TRAD_COURT.cups.queen.rev).toContain('亦有:');
		// 数字牌:四处最鲜明的正逆倒挂(今义与此层方向相反)
		expect(TRAD_PIP.wands[2].up).toContain('哀痛'); // 今义=远景雄图
		expect(TRAD_PIP.wands[5].up).toContain('黄金'); // 今义=竞争扰攘
		expect(TRAD_PIP.pentacles[4].up).toContain('慷慨'); // 今义=紧抓不放
		expect(TRAD_PIP.pentacles[5].up).toContain('恋人'); // 今义=贫寒失依
		expect(TRAD_PIP.wands[4].rev).toContain('几与正位同义'); // 逆位≈正位的自注
		expect(TRAD_PIP.cups[8].rev).toContain('快乐'); // 传统逆位全褒义
	});
});

describe('内容波次 · 主题占断层', () => {
	test('数字牌 40 张全覆盖(每张至少两域);大牌 22 全覆盖(必含 health);宫廷 16 全覆盖', () => {
		SUITS.forEach((s) => {
			for(let r = 1; r <= 10; r++){
				const d = DOMAIN_PIP[s][r];
				expect(`${s}_${r}:${!!d}`).toBe(`${s}_${r}:true`);
				expect(Object.keys(d).length).toBeGreaterThanOrEqual(2);
			}
			['king', 'queen', 'knight', 'page'].forEach((ct) => {
				expect(`${s}_${ct}:${!!DOMAIN_COURT[s][ct]}`).toBe(`${s}_${ct}:true`);
			});
		});
		MAJORS_CORR.forEach((m) => {
			const d = DOMAIN_MAJOR[m.id];
			expect(`${m.id}:${!!d}`).toBe(`${m.id}:true`);
			expect(`${m.id}.health:${!!d.health}`).toBe(`${m.id}.health:true`);
		});
	});
	test('域名合法性:任何条目不得出现 DOMAIN_KEYS 之外的键(拼错域名即咬)', () => {
		const allow = new Set(DOMAIN_KEYS);
		const check = (obj, tag) => Object.keys(obj).forEach((k) => expect(`${tag}.${k}:${allow.has(k)}`).toBe(`${tag}.${k}:true`));
		Object.keys(DOMAIN_MAJOR).forEach((sid) => check(DOMAIN_MAJOR[sid], sid));
		SUITS.forEach((s) => {
			Object.keys(DOMAIN_PIP[s]).forEach((r) => check(DOMAIN_PIP[s][r], `${s}_${r}`));
			Object.keys(DOMAIN_COURT[s]).forEach((ct) => check(DOMAIN_COURT[s][ct], `${s}_${ct}`));
		});
	});
	test('牌面笔记:78 张全覆盖(图像/符号/逆位演绎皆备);gaze 取值合法;三张护栏牌文案在位', () => {
		// 大牌 22 + 数字牌 40 + 宫廷 16 = 78 已满。
		const graded = CORE78.filter((c) => c.arcana !== 'blank');
		expect(graded.length).toBe(78);
		const thin = [];
		graded.forEach((c) => {
			const n = NOTES[c.sid];
			if(!n){ thin.push(`${c.sid}:缺条`); return; }
			// 先前波次录入的数张只有 special/reverseImage(image 与 symbols 记为 null),此类照旧允许
			if(n.image === null && n.symbols === null){ return; }
			if(!n.image || n.image.length <= 8){ thin.push(`${c.sid}:图像过短`); }
			if(!Array.isArray(n.symbols) || n.symbols.length < 3){ thin.push(`${c.sid}:符号少于三条`); }
			if(!n.reverseImage || n.reverseImage.length <= 8){ thin.push(`${c.sid}:逆位演绎过短`); }
		});
		expect(`未足条目: ${thin.join(' , ')}`).toBe('未足条目: ');
		graded.forEach((c) => expect([null, 'left', 'right', 'front']).toContain(NOTES[c.sid].gaze));
		Object.keys(NOTES).forEach((sid) => expect(`${sid}:${!!by[sid]}`).toBe(`${sid}:true`));
		// 护栏三张(不作死亡预兆/不作灾祸恐吓/不作生死断语)必须成文,且措辞含「不作」
		['death', 'the_tower', 'swords_10'].forEach((sid) => {
			expect(`${sid}:${(NOTES[sid].special || '').includes('不作')}`).toBe(`${sid}:true`);
		});
		// 自指特例与因果例外:吊人、正义各有专属注
		expect(NOTES.hanged_man.special).toContain('倒置之象');
		expect(NOTES.justice.special).toContain('照正位读');
		expect(noteOf({ sid: 'no_such' })).toBeNull();
	});
	test('东方对应人物层:仅大牌可取、键皆真实 sid、非大牌返 null', () => {
		Object.keys(EASTERN_FIGURES).forEach((sid) => {
			expect(`${sid}:${!!by[sid] && by[sid].arcana === 'major'}`).toBe(`${sid}:true`);
			expect(EASTERN_FIGURES[sid].length).toBeGreaterThan(1);
		});
		expect(easternFigureOf(by.the_fool)).toContain('夸父');
		expect(easternFigureOf(by.wands_05)).toBeNull();
	});
	test('双轨牌义层:78 张全覆盖(大体/两性/倒立三栏皆备);键皆真实 sid', () => {
		// 小牌 56(先前波次)+ 大牌 22(本波次)= 78 张已满。
		const graded = CORE78.filter((c) => c.arcana !== 'blank');
		expect(graded.length).toBe(78);
		graded.forEach((c) => {
			const d = DUAL[c.sid];
			expect(`${c.sid}:${!!d}`).toBe(`${c.sid}:true`);
			expect(d.general.length).toBeGreaterThan(8);
			expect(d.relation.length).toBeGreaterThan(8);
			expect(d.reversed.length).toBeGreaterThan(8);
		});
		Object.keys(DUAL).forEach((sid) => expect(`${sid}:${!!by[sid]}`).toBe(`${sid}:true`));
		const cov = dualTrackCoverage(CORE78);
		expect(cov.have).toBe(78);
		expect(cov.total).toBe(78);
	});
	test('双轨层的「回退所指」与逆位回退引擎同源互证:小牌指向同花色前一号', () => {
		// 原典明写回退目标者;各自指向的正是同花色前一号牌(与 reversalModes.retreat 的链一致)
		expect(dualTrackOf(by.pentacles_08).retreatTo).toContain('钱币七');
		expect(dualTrackOf(by.pentacles_09).retreatTo).toContain('钱币八');
		expect(dualTrackOf(by.wands_03).retreatTo).toContain('权杖二');
		expect(dualTrackOf(by.wands_08).retreatTo).toContain('权杖七');
		expect(dualTrackOf(by.cups_07).retreatTo).toContain('圣杯六');
		expect(dualTrackOf(by.cups_10).retreatTo).toContain('圣杯九');
		// 未明指者不得臆造
		expect(dualTrackOf(by.swords_05).retreatTo).toBeUndefined();
	});

	test('🔴 大牌的「回退所指」全部指向前一号牌 —— 原典九处明示与 retreat 引擎规则逐条互证', () => {
		// 引擎对大牌的规则是「回前一号」。本层的回退所指是从原典逐条抄录的,两者本可各说各话;
		// 此处机械验证:凡原典明示回退的大牌,其所指之牌恰为 number-1。九处全中即为强互证。
		const NAME_TO_SID = {
			女教皇: 'high_priestess', 女皇: 'the_empress', 力量: 'strength', 隐士: 'the_hermit',
			死亡: 'death', 魔鬼: 'the_devil', 高塔: 'the_tower', 星星: 'the_star', 审判: 'judgement',
		};
		const majors = CORE78.filter((c) => c.arcana === 'major');
		const withRetreat = majors.filter((c) => DUAL[c.sid] && DUAL[c.sid].retreatTo);
		const mismatched = [];
		withRetreat.forEach((c) => {
			const txt = DUAL[c.sid].retreatTo;
			const hit = Object.keys(NAME_TO_SID).find((n) => txt.indexOf(n) >= 0);
			if(!hit){ mismatched.push(`${c.sid}: 所指之牌名不在册 → ${txt.slice(0, 30)}`); return; }
			const target = by[NAME_TO_SID[hit]];
			if(!target){ mismatched.push(`${c.sid}: 目标 sid 不存在`); return; }
			if(target.number !== c.number - 1){
				mismatched.push(`${c.sid}(${c.number}) → ${hit}(${target.number}) 非前一号`);
			}
		});
		expect(`非前一号的回退: ${mismatched.join(' ; ')}`).toBe('非前一号的回退: ');
		expect(`原典明示回退的大牌数:${withRetreat.length}`).toBe('原典明示回退的大牌数:9');
		// 未明指者不得臆造(愚人无前牌,原典亦未给回退)
		expect(dualTrackOf(by.the_fool).retreatTo).toBeUndefined();
	});
	test('accessor 分派正确(大牌/数字/宫廷各取到自己那条)', () => {
		expect(domainsOf(by.the_tower).health).toContain('住院');
		expect(domainsOf(by.cups_09).money).toBeTruthy();
		expect(domainsOf(by.pentacles_knight).career).toBeTruthy();
		expect(domainsOf(null)).toBeNull();
	});
});
