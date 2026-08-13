// 【第3步】压力测试矩阵:遍历每个选项的每种取值、牌组×牌阵全笛卡尔、边界/空值/极端/冲突组合。
// 每格断言的是「结构自洽」这一硬口径(而非快照比对),这样任何组合下的崩溃、错位、脏值都会被咬住:
//   ①不抛;②抽牌数=牌位数(池够时)且牌不重复;③关了逆位就不能有逆位牌;
//   ④快照文本非空且不含 undefined/NaN/[object Object]/null 这类脏值;⑤定局/精华/计时三算子在任何组合下都能出结果。
import { buildReading } from '../engine/reading';
import { buildReadingText } from '../engine/reportText';
import { SPREADS } from '../engine/spreads';
import { getDeck, getDeckCards, listDeckIds } from '../engine/deckRegistry';
import { yesNo, quintessence } from '../engine/verdict';
import { computeTimingLines, decanTimingOf } from '../engine/timingMethods';
import { dailyStats } from '../engine/dailyCourse';
import { marseilleNumber, degreeOf } from '../decks/marseilleMeanings';
import { OPTION_SPEC, DECK_SPEC } from './tarotOptionSpec';
import { displayName, displayNameCn, displayNameEn, astroLine, correspondenceSuffix, cardMeaning, isTrumpArcana, isTarotStructured } from '../engine/cardSchema';
import { REVERSAL_MODES } from '../engine/reversalModes';
import { courtSignDetect } from '../decks/courtSystems';

jest.setTimeout(240000);

const DIRT = /(undefined|NaN|\[object Object\])/;

// 结构自洽总检:任何组合、任何牌组牌阵都要过。返回 '' 表示通过,否则返回失败原因。
function auditReading(r, tag, settings){
	if(!r){ return `${tag}: buildReading 返回空`; }
	const spread = SPREADS[r.spreadType];
	if(!spread){ return `${tag}: spreadType 非法 ${r.spreadType}`; }
	const draws = r.draws || [];
	// 牌位数:池不足时允许少发(降级),但绝不允许多发
	if(draws.length > spread.positions.length){ return `${tag}: 抽牌数 ${draws.length} > 牌位数 ${spread.positions.length}`; }
	// 不重复(同一张牌不得出现在两个位置)
	const ids = draws.filter((d) => d.card).map((d) => d.card.id);
	if(new Set(ids).size !== ids.length){ return `${tag}: 有重复牌 ${ids.join(',')}`; }
	// 每个 draw 结构完整
	for(let i = 0; i < draws.length; i++){
		const d = draws[i];
		if(!d.position || d.position.i === undefined){ return `${tag}: draw[${i}] 缺 position`; }
		if(d.card && d.card.id === undefined){ return `${tag}: draw[${i}] 牌缺 id`; }
		if(typeof d.isReversed !== 'boolean'){ return `${tag}: draw[${i}].isReversed 非布尔(${d.isReversed})`; }
	}
	// 关了逆位就不能有逆位牌
	if(settings && settings.reversals === false && draws.some((d) => d.isReversed)){ return `${tag}: 逆位已关却出现逆位牌`; }
	// 指示牌若已选定,不得又出现在阵中
	if(r.significator && r.significator.card){
		const sigId = r.significator.card.id;
		if(ids.indexOf(sigId) >= 0){ return `${tag}: 指示牌 ${sigId} 未从池中剔除,又被抽到阵中`; }
	}
	// 快照文本:非空、无脏值
	let text = '';
	try{ text = buildReadingText(r); }catch(e){ return `${tag}: buildReadingText 抛错 ${e && e.message}`; }
	if(!text || text.length < 10){ return `${tag}: 快照文本过短(${text.length})`; }
	// 种子是用户原样输入的字符串:用户把种子填成 'NaN'/'undefined' 时,标题行照实回显是正确行为,不算脏值。
	const dirty = text.split('\n').filter((ln) => !/\(种子:/.test(ln)).filter((ln) => DIRT.test(ln));
	if(dirty.length){ return `${tag}: 快照含脏值 → ${dirty.slice(0, 2).join(' / ')}`; }
	return '';
}

function runOne(deckId, spreadType, seed, settings){
	const r = buildReading(deckId, spreadType, seed, settings);
	const tag = `${deckId}/${spreadType}/${JSON.stringify(settings).slice(0, 120)}`;
	const bad = auditReading(r, tag, settings);
	if(bad){ return bad; }
	// 三算子在任何组合下都要能出结果(不抛、不返 undefined)
	try{
		const cards = getDeckCards(deckId);
		const v = yesNo(r.draws, settings.verdictMode);
		if(!v || typeof v.verdict !== 'string'){ return `${tag}: yesNo 无判词`; }
		const q = quintessence(r.draws, cards, undefined, settings.quintMode);
		if(q === undefined){ return `${tag}: quintessence 返回 undefined`; }
		const t = computeTimingLines(r, cards, settings.timingMethod, { unit: settings.timingUnit });
		if(!Array.isArray(t)){ return `${tag}: computeTimingLines 非数组`; }
		if(t.some((ln) => DIRT.test(`${ln}`))){ return `${tag}: 计时行含脏值 → ${t.filter((ln) => DIRT.test(`${ln}`))[0]}`; }
	}catch(e){ return `${tag}: 判读算子抛错 ${e && e.message}`; }
	return '';
}

describe('压力矩阵 · 牌组×牌阵全笛卡尔', () => {
	test('每个牌组的每个可用牌阵都能起盘且结构自洽(不抛/不重复/不多发/快照无脏值)', () => {
		const fails = [];
		let cells = 0;
		listDeckIds().forEach((deckId) => {
			const deck = getDeck(deckId);
			const allowed = (deck.caps && deck.caps.spreads) || Object.keys(SPREADS);
			allowed.filter((k) => SPREADS[k]).forEach((spreadType) => {
				cells++;
				const bad = runOne(deckId, spreadType, `mx-${deckId}-${spreadType}`, {});
				if(bad){ fails.push(bad); }
			});
		});
		expect(`格数=${cells} 失败=${fails.length}: ${fails.slice(0, 5).join(' ;; ')}`).toBe(`格数=${cells} 失败=0: `);
		expect(cells).toBeGreaterThan(150);
	});
	test('牌组清单与规格登记一致(新增牌组必须同步登记,漏登即咬)', () => {
		const ids = listDeckIds().slice().sort();
		const spec = DECK_SPEC.map((d) => d.id).sort();
		expect(ids.join(',')).toBe(spec.join(','));
		DECK_SPEC.forEach((d) => {
			const deck = getDeck(d.id);
			expect(`${d.id}.size:${deck.size}`).toBe(`${d.id}.size:${d.size}`);
			expect(`${d.id}.method:${(deck.caps || {}).readingMethod}`).toBe(`${d.id}.method:${d.method}`);
		});
	});
});

describe('压力矩阵 · 逐键逐值(每个选项的每一种取值都跑一遍)', () => {
	test('27 键 × 全部取值 × 三种牌阵规模,恒结构自洽', () => {
		const fails = [];
		let cells = 0;
		const scales = ['one', 'three', 'celtic']; // 单张/三张/十张三档规模
		OPTION_SPEC.forEach((spec) => {
			spec.values.forEach((v, vi) => {
				scales.forEach((sp) => {
					const deckId = spec.ctx.deckId;
					const deck = getDeck(deckId);
					const allowed = (deck.caps && deck.caps.spreads) || Object.keys(SPREADS);
					const spreadType = allowed.indexOf(sp) >= 0 ? sp : spec.ctx.spreadType;
					const settings = { ...spec.ctx, [spec.key]: v };
					delete settings.deckId; delete settings.spreadType;
					cells++;
					const bad = runOne(deckId, spreadType, `kv-${spec.key}-${vi}-${sp}`, settings);
					if(bad){ fails.push(bad); }
				});
			});
		});
		expect(`格数=${cells} 失败=${fails.length}: ${fails.slice(0, 5).join(' ;; ')}`).toBe(`格数=${cells} 失败=0: `);
	});
});

describe('压力矩阵 · 边界值与空值', () => {
	const EDGE_SEEDS = ['', '0', '-1', '-99999', '0.0000001', '1e308', 'NaN', 'null', 'undefined',
		'　', '🂠🃏♠︎', 'a'.repeat(4096), '2026-08-11|13:13:38|26n04|119e19', '{"json":"like"}'];
	test('极端种子(空串/负数/科学计数/NaN 字面量/超长/表情/结构串)皆不炸且确定性可复现', () => {
		const fails = [];
		EDGE_SEEDS.forEach((seed, i) => {
			const bad = runOne('rws', 'celtic', seed, {});
			if(bad){ fails.push(`seed[${i}] ${bad}`); return; }
			// 确定性:同种子两次全等
			const a = buildReading('rws', 'celtic', seed, {});
			const b = buildReading('rws', 'celtic', seed, {});
			const sigA = a.draws.map((d) => `${d.cardId}${d.isReversed}`).join('|');
			const sigB = b.draws.map((d) => `${d.cardId}${d.isReversed}`).join('|');
			if(sigA !== sigB){ fails.push(`seed[${i}]=${JSON.stringify(seed).slice(0, 30)} 两次不一致`); }
		});
		expect(`失败=${fails.length}: ${fails.slice(0, 4).join(' ;; ')}`).toBe('失败=0: ');
	});
	test('空值/缺参:settings 传 null/undefined/空对象/含 undefined 值的键,恒回落默认不炸', () => {
		const cases = [null, undefined, {}, { reversals: undefined, meaningSystem: undefined, verdictMode: undefined },
			{ sig: null }, { birth: null }, { sig: {} }, { sig: { mode: 'auto' } }, { sig: { mode: 'manual' } }];
		const fails = [];
		cases.forEach((st, i) => {
			try{
				const r = buildReading('rws', 'celtic', `nul-${i}`, st);
				const bad = auditReading(r, `null[${i}]`, st || {});
				if(bad){ fails.push(bad); }
			}catch(e){ fails.push(`null[${i}] 抛错 ${e && e.message}`); }
		});
		expect(`失败=${fails.length}: ${fails.slice(0, 4).join(' ;; ')}`).toBe('失败=0: ');
	});
	test('非法枚举值(拼错的档位名/数字/对象)不得使任一算子崩,应回落默认档', () => {
		const junk = ['', 'no_such_mode', 0, 1, true, {}, [], 'STORED'];
		const fails = [];
		junk.forEach((j, i) => {
			const st = { meaningSystem: j, reversalMode: j, verdictMode: j, quintMode: j, timingMethod: j, timingUnit: j,
				variant: j, edVersion: j, ookTable: j, reversalGen: j, courtElementSystem: j, courtZodiacSystem: j };
			const bad = runOne('golden_dawn', 'celtic', `junk-${i}`, st);
			if(bad){ fails.push(`junk[${i}]=${JSON.stringify(j)} ${bad}`); }
		});
		expect(`失败=${fails.length}: ${fails.slice(0, 4).join(' ;; ')}`).toBe('失败=0: ');
	});
	test('所问之事的极端输入(超长/换行/管道符/HTML/反引号)不得破坏快照的表格结构', () => {
		// 快照 [逐牌详解] 是 markdown 表格,所问若原样带入管道符会把表格撑歪 → 必须被转义或隔离
		const qs = ['a'.repeat(3000), '第一行\n第二行\n第三行', 'A|B|C 管道符', '<script>x</script>', '`反引号` **粗体**', '   ', '|---|---|'];
		const fails = [];
		qs.forEach((q, i) => {
			const r = buildReading('rws', 'three', `q-${i}`, {});
			let text = '';
			try{ text = buildReadingText(r, q); }catch(e){ fails.push(`q[${i}] 抛错 ${e && e.message}`); return; }
			if(DIRT.test(text)){ fails.push(`q[${i}] 快照含脏值`); return; }
			// 表格行(以 | 开头)的列数必须恒定 —— 所问串入表格即会改变列数
			const rows = text.split('\n').filter((ln) => ln.startsWith('|'));
			const widths = new Set(rows.map((ln) => ln.split('|').length));
			if(widths.size > 3){ fails.push(`q[${i}] 表格列数不齐(${[...widths].join('/')}) → 所问污染了表格`); }
		});
		expect(`失败=${fails.length}: ${fails.slice(0, 4).join(' ;; ')}`).toBe('失败=0: ');
	});
	test('生命牌的边界生日(0月/13月/32日/负年/闰日/超长年)不炸且不产生脏值', () => {
		const births = [{ year: 0, month: 0, day: 0 }, { year: 1990, month: 13, day: 32 }, { year: -44, month: 3, day: 15 },
			{ year: 2000, month: 2, day: 29 }, { year: 99999, month: 12, day: 31 }, { year: '', month: '', day: '' },
			{ year: '1990', month: '6', day: '15' }];
		const fails = [];
		births.forEach((b, i) => {
			const bad = runOne('rws', 'three', `b-${i}`, { birth: { ...b, refYear: 2026 } });
			if(bad){ fails.push(`birth[${i}] ${bad}`); }
		});
		expect(`失败=${fails.length}: ${fails.slice(0, 4).join(' ;; ')}`).toBe('失败=0: ');
	});
});

describe('压力矩阵 · 互相冲突的组合', () => {
	// 每格都是「设置说 A、上下文说不能 A」的对撞;要求恒不炸且降级合理。
	const CONFLICTS = [
		{ n: '关逆位却选回退式逆位读法', d: 'rws', s: 'celtic', st: { reversals: false, reversalMode: 'retreat' } },
		{ n: '关逆位却选全逆产生方式', d: 'rws', s: 'celtic', st: { reversals: false, reversalGen: 'all' } },
		{ n: '关逆位却要交叉牌横置', d: 'rws', s: 'celtic', st: { reversals: false, crossingUpright: true } },
		{ n: '22张牌组要空白牌', d: 'wirth', s: 'three', st: { includeBlank: true } },
		{ n: '22张牌组用翻至王牌计时(无王牌)', d: 'wirth', s: 'three', st: { timingMethod: 'ace_hunt' } },
		{ n: '22张牌组求宫廷精华牌', d: 'egyptian', s: 'three', st: { quintMode: 'fool22' } },
		{ n: '非塔罗牌组开元素尊位', d: 'lenormand', s: 'three', st: { dignities: true, edVersion: 'mathers' } },
		{ n: '非塔罗牌组用马赛数字度牌义', d: 'cartomancy', s: 'three', st: { meaningSystem: 'degrees' } },
		{ n: '非开钥阵设开钥计数表', d: 'golden_dawn', s: 'three', st: { ookTable: 'sephira' } },
		{ n: '非凯尔特阵设交叉牌横置', d: 'rws', s: 'one', st: { crossingUpright: false } },
		{ n: '非三张阵用愚人廿二分组加法', d: 'rws', s: 'celtic', st: { quintMode: 'fool22' } },
		{ n: '大牌数字法但阵中可能无大牌', d: 'rws', s: 'one', st: { timingMethod: 'major_number', timingUnit: '月' } },
		{ n: '大牌加盖但余牌不足(21张大阵)', d: 'rws', s: 'zodiac12', st: { majorsOverlay: true } },
		{ n: '纯大牌子集阵还要空白牌', d: 'rws', s: 'seven_cups', st: { includeBlank: true } },
		{ n: '纯大牌子集阵开元素尊位(大牌无花色)', d: 'thoth', s: 'seven_cups', st: { dignities: true } },
		{ n: '指示牌剔除后再要牌底牌与切牌', d: 'rws', s: 'celtic', st: { sig: { mode: 'manual', manualId: 'cups_queen' }, showBottomCard: true, showCutCard: true } },
		{ n: '指示牌手动指定不存在的牌', d: 'rws', s: 'three', st: { sig: { mode: 'manual', manualId: 'no_such_card' } } },
		{ n: '自动指示牌但星座留空', d: 'rws', s: 'three', st: { sig: { mode: 'auto', gender: 'female', age: 0, sign: '' } } },
		{ n: '非此制牌组用双指示牌', d: 'rws', s: 'three', st: { sig: { mode: 'etteilla', gender: 'female' } } },
		{ n: '不支持变体的牌组设变体C', d: 'lenormand', s: 'three', st: { variant: 'C', showCorrespondences: true } },
		{ n: '不支持历史牌序的牌组设牌序', d: 'rws', s: 'three', st: { dummettOrder: 'A' } },
		{ n: '全开:所有布尔项同时为真', d: 'golden_dawn', s: 'celtic', st: { reversals: true, dignities: true, showCorrespondences: true, suitElementSwap: true, astroModern: true, majorsOverlay: true, showCutCard: true, showBottomCard: true, includeBlank: true, crossingUpright: true } },
		{ n: '全关:所有布尔项同时为假', d: 'golden_dawn', s: 'celtic', st: { reversals: false, dignities: false, showCorrespondences: false, suitElementSwap: false, astroModern: false, majorsOverlay: false, showCutCard: false, showBottomCard: false, includeBlank: false, crossingUpright: false } },
	];
	CONFLICTS.forEach((c) => {
		test(`冲突组合:${c.n}`, () => {
			const bad = runOne(c.d, c.s, `cf-${c.n}`, c.st);
			expect(bad || '通过').toBe('通过');
		});
	});
	test('最大阵位 × 最小牌池:池不足时只能少发,绝不重复发牌', () => {
		// 找位数最多的牌阵,配 22 张的牌组(其允许列表内),看降级是否守规矩
		const biggest = Object.keys(SPREADS).sort((a, b) => SPREADS[b].positions.length - SPREADS[a].positions.length)[0];
		const fails = [];
		['wirth', 'egyptian'].forEach((deckId) => {
			const deck = getDeck(deckId);
			const allowed = (deck.caps && deck.caps.spreads) || Object.keys(SPREADS);
			const sp = allowed.indexOf(biggest) >= 0 ? biggest : allowed.sort((a, b) => SPREADS[b].positions.length - SPREADS[a].positions.length)[0];
			const r = buildReading(deckId, sp, 'pool-limit', { sig: { mode: 'manual', manualId: 'cups_queen' }, includeBlank: true });
			const bad = auditReading(r, `${deckId}/${sp}`, {});
			if(bad){ fails.push(bad); }
			const ids = r.draws.filter((d) => d.card).map((d) => d.card.id);
			if(new Set(ids).size !== ids.length){ fails.push(`${deckId}/${sp} 池不足时发了重复牌`); }
		});
		expect(`失败=${fails.length}: ${fails.join(' ;; ')}`).toBe('失败=0: ');
	});
});

describe('压力矩阵 · 随机组合遍历(确定性伪随机,复跑同结果)', () => {
	test('600 组随机多键组合 × 随机牌组牌阵,恒结构自洽', () => {
		// 27 键全笛卡尔不可行(>10^12 格);用确定性 LCG 抽 600 组多键组合覆盖交互面。
		let s = 20260811;
		const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
		const pick = (arr) => arr[Math.floor(rnd() * arr.length) % arr.length];
		const ids = listDeckIds();
		const fails = [];
		for(let i = 0; i < 600; i++){
			const deckId = pick(ids);
			const deck = getDeck(deckId);
			const allowed = ((deck.caps && deck.caps.spreads) || Object.keys(SPREADS)).filter((k) => SPREADS[k]);
			const spreadType = pick(allowed);
			const st = {};
			OPTION_SPEC.forEach((spec) => { if(rnd() < 0.5){ st[spec.key] = pick(spec.values); } });
			const bad = runOne(deckId, spreadType, `rnd-${i}`, st);
			if(bad){ fails.push(`#${i} ${bad}`); }
		}
		expect(`失败=${fails.length}: ${fails.slice(0, 5).join(' ;; ')}`).toBe('失败=0: ');
	});
});

describe('压力矩阵 · 显示层全牌穷举(本轮判据改动的误伤面)', () => {
	// [QA-5/6 复核] 王牌判据与「塔罗结构」判据一改,受影响的是所有牌组的所有牌的显示函数。
	// 此处不抽样:14 牌组 × 全部牌 × 5 个显示函数 × 变体/宫廷视角组合,逐格检查输出无脏值、非空。
	const VIEWS = [
		{ variant: 'A', modern: false, court: { elementSystem: 'gd', zodiacSystem: 'gd_span' } },
		{ variant: 'B', modern: true, court: { elementSystem: 'alt', zodiacSystem: 'simple' } },
		{ variant: 'C', modern: false, court: { elementSystem: 'alt', zodiacSystem: 'gd_span' } },
	];
	test('displayName / displayNameCn / displayNameEn:全牌组全牌无脏值且非空', () => {
		const bad = [];
		listDeckIds().forEach((deckId) => {
			const deck = getDeck(deckId);
			getDeckCards(deckId).forEach((c) => {
				[['displayName', displayName(c, deck)], ['displayNameCn', displayNameCn(c, deck)], ['displayNameEn', displayNameEn(c, deck)]]
					.forEach(([fn, out]) => {
						if(DIRT.test(`${out}`)){ bad.push(`${deckId}/${c.sid}/${fn} → ${out}`); }
						if(!`${out}`.trim()){ bad.push(`${deckId}/${c.sid}/${fn} → 空`); }
					});
			});
		});
		expect(`脏值/空名 ${bad.length} 处: ${bad.slice(0, 6).join(' ;; ')}`).toBe('脏值/空名 0 处: ');
	});
	test('astroLine / correspondenceSuffix:全牌组全牌 × 三视角无脏值', () => {
		const bad = [];
		listDeckIds().forEach((deckId) => {
			const deck = getDeck(deckId);
			getDeckCards(deckId).forEach((c) => {
				VIEWS.forEach((v) => {
					const a = astroLine(c, deck, v.variant, v.modern, v.court);
					if(DIRT.test(`${a}`) || !`${a}`.trim()){ bad.push(`${deckId}/${c.sid}/astroLine(${v.variant}) → ${a}`); }
					const s2 = correspondenceSuffix(c, v.variant);
					if(DIRT.test(`${s2}`)){ bad.push(`${deckId}/${c.sid}/corrSuffix(${v.variant}) → ${s2}`); }
				});
			});
		});
		expect(`脏值 ${bad.length} 处: ${bad.slice(0, 6).join(' ;; ')}`).toBe('脏值 0 处: ');
	});
	test('cardMeaning:全牌组全牌 × 三牌义轨 × 十三逆位式无脏值且非空', () => {
		const bad = [];
		const systems = ['manual', 'waite', 'degrees'];
		listDeckIds().forEach((deckId) => {
			getDeckCards(deckId).forEach((c) => {
				systems.forEach((sys) => {
					REVERSAL_MODES.forEach((rm) => {
						[false, true].forEach((rev) => {
							const m = cardMeaning(c, rev, sys, rm);
							if(DIRT.test(`${m}`)){ bad.push(`${deckId}/${c.sid}/${sys}/${rm}/${rev ? '逆' : '正'} → ${`${m}`.slice(0, 60)}`); }
						});
					});
				});
			});
		});
		expect(`脏值 ${bad.length} 处: ${bad.slice(0, 6).join(' ;; ')}`).toBe('脏值 0 处: ');
	});
	test('王牌判据改动的正向证据:各牌组王牌数与其体系相符,且王牌不落进数字牌分支', () => {
		const expectTrumps = { rws: 22, tdm: 22, thoth: 22, golden_dawn: 22, wirth: 22, bota: 22, egyptian: 22,
			etteilla: 22, minchiate: 41, visconti: 22, lenormand: 0, kipper: 0, sibilla: 0, cartomancy: 0 };
		Object.keys(expectTrumps).forEach((deckId) => {
			const trumps = getDeckCards(deckId).filter((c) => isTrumpArcana(c.arcana));
			expect(`${deckId} 王牌数:${trumps.length}`).toBe(`${deckId} 王牌数:${expectTrumps[deckId]}`);
			// 王牌必须走王牌分支:中文短名恒等于牌自身的 name_cn(小牌分支会拼成「花色+序数」),
			// 全名以该中文名收尾。判据直接对应本轮修复点,不用「含 of」这种粗筛
			// —— 命运之轮 Wheel of Fortune 的牌名本身就含 of,粗筛会自造假报。
			const deck = getDeck(deckId);
			const misrouted = trumps.filter((c) => displayNameCn(c, deck) !== c.name_cn || !displayName(c, deck).endsWith(c.name_cn));
			expect(`${deckId} 未走王牌分支的王牌:${misrouted.map((c) => `${c.sid}→${displayName(c, deck)}`).join(',')}`).toBe(`${deckId} 未走王牌分支的王牌:`);
		});
	});
	test('[QA-8] 变体口径一致性:大陆派(C)下占象行与对应后缀都不得出现 GD 路径,A/B 档则必须有', () => {
		const bad = [];
		listDeckIds().forEach((deckId) => {
			const deck = getDeck(deckId);
			getDeckCards(deckId).filter((c) => isTrumpArcana(c.arcana)).forEach((c) => {
				const lineC = astroLine(c, deck, 'C', false, null);
				const sufC = correspondenceSuffix(c, 'C');
				if(/路径/.test(`${lineC}${sufC}`)){ bad.push(`${deckId}/${c.sid} C 档仍出路径 → ${lineC}${sufC}`); }
			});
		});
		expect(`C 档路径泄漏 ${bad.length} 处: ${bad.slice(0, 4).join(' ;; ')}`).toBe('C 档路径泄漏 0 处: ');
		// 反向:A 档的标准大牌必须仍有路径(别把功能改没了)
		const rws = getDeck('rws');
		const fool = getDeckCards('rws').find((c) => c.sid === 'the_fool');
		expect(/路径/.test(astroLine(fool, rws, 'A', false, null))).toBe(true);
		expect(correspondenceSuffix(fool, 'A')).toContain('路径连');
		expect(correspondenceSuffix(fool, 'B')).toContain('路径连');
	});
	test('[QA-9] 历史体系牌组(米兰凯特/维斯康蒂)的王牌在各下游功能里都被当作王牌 —— 五处漏判的守门锚', () => {
		// 这五处曾各自写死 arcana==='major',于是这两副的王牌在下游被当成数字牌:
		// 计时两法报「余牌中无大牌可取(异常牌组)」/ 对读大牌部分恒空 / 日课大牌占比恒 0 / 详情面板走小牌分支。
		// 判据取「功能真的出结果」,不是「代码里写了 isTrumpArcana」。
		const bad = [];
		['visconti', 'minchiate'].forEach((deckId) => {
			const cards = getDeckCards(deckId);
			const deck = getDeck(deckId);
			const allowed = (deck.caps && deck.caps.spreads) || Object.keys(SPREADS);
			const sp = allowed.indexOf('celtic') >= 0 ? 'celtic' : allowed[0];
			// 找一个阵内确有王牌的种子
			let r = null;
			for(let i = 0; i < 40 && !r; i++){
				const cand = buildReading(deckId, sp, `trump-${deckId}-${i}`, {});
				if(cand.draws.some((d) => d.card && isTrumpArcana(d.card.arcana))){ r = cand; }
			}
			if(!r){ bad.push(`${deckId}: 40 轮未抽到王牌(样本不足,非缺陷)`); return; }
			// ① 计时两法必须给出真结果,不得回落「异常牌组」
			['major_number', 'major_zodiac'].forEach((tm) => {
				const t = computeTimingLines(r, cards, tm, { unit: '周' });
				if(!t.length || t.some((ln) => /异常牌组|无大牌可取/.test(`${ln}`))){
					bad.push(`${deckId}/${tm} → ${JSON.stringify(t).slice(0, 70)}`);
				}
			});
			// ② 对读大牌部分:不仅要有行,每行还必须真出对子 ——
			//    只断言「有行」曾放过一次半截修复(段出得来、每行都是「—」,因为底层 marseilleNumber/decadePartner
			//    也各写死 'major')。判据必须落到最终文案上。
			if(!r.pairs || !r.pairs.majors || !r.pairs.majors.length){ bad.push(`${deckId}: 对读大牌部分为空`); }
			else{
				const empty = r.pairs.majors.filter((m) => !m.text || m.text === '—');
				if(empty.length){ bad.push(`${deckId}: 大牌对流有行无对子 → ${empty.map((m) => m.name).join(',')}`); }
				const noDec = r.pairs.majors.filter((m) => !/十进对|和21补牌/.test(m.text || ''));
				if(noDec.length){ bad.push(`${deckId}: 大牌对流缺十进对/和21 → ${noDec.map((m) => m.name).join(',')}`); }
			}
			// ③ 王牌的旬星计时文案走王牌分支(不得拿花色旬星硬套)
			const trump = r.draws.find((d) => d.card && isTrumpArcana(d.card.arcana)).card;
			const dt = decanTimingOf(trump);
			if(dt && /旬|Lord of/.test(`${dt}`)){ bad.push(`${deckId}/${trump.sid} 王牌被按小牌旬星计时 → ${dt}`); }
		});
		expect(`下游漏判 ${bad.length} 处: ${bad.join(' ;; ')}`).toBe('下游漏判 0 处: ');
	});
	test('[QA-9] 日课统计的大牌占比认 *_trump(否则该两副恒 0)', () => {
		const rows = getDeckCards('visconti').filter((c) => isTrumpArcana(c.arcana)).slice(0, 5).map((c) => ({ sid: c.sid, rev: false }));
		const st = dailyStats(rows.map((x) => ({ ...x, deckId: 'visconti' })));
		// dailyStats 以 CORE78 索引 sid;维斯康蒂王牌 sid 与之同源,故应全部计入大牌
		expect(`大牌计数:${st.suitCount.major}/${st.total}`).toBe(`大牌计数:${st.total}/${st.total}`);
	});
	test('[规格自证] 规格表写的两条核心约定必须与代码实际行为相符(写错规格=后续全部哨兵一起假绿)', () => {
		// 约定①「逆位开关只掩朝向,不改抽到的牌」——若破坏,用户一勾逆位整盘重抽,是严重回归。
		// 约定②「逆位产生三档 order 恒同,只换朝向」——同理。
		const bad = [];
		for(let i = 0; i < 20; i++){
			const seed = `spec-${i}`;
			const ids = (r) => r.draws.map((d) => (d.card ? d.card.id : 'x')).join(',');
			const on = buildReading('rws', 'celtic', seed, { reversals: true });
			const off = buildReading('rws', 'celtic', seed, { reversals: false });
			if(ids(on) !== ids(off)){ bad.push(`seed${i}: 逆位开关改变了抽到的牌 ${ids(on)} vs ${ids(off)}`); }
			const gens = ['shuffle', 'fingers3', 'all'].map((g) => buildReading('rws', 'celtic', seed, { reversals: true, reversalGen: g }));
			const uniq = new Set(gens.map(ids));
			if(uniq.size !== 1){ bad.push(`seed${i}: 逆位产生三档改变了抽到的牌 ${[...uniq].join(' | ')}`); }
			// 三档的朝向不得全同(否则是死开关) —— 至少有一档不同
			const orients = new Set(gens.map((r) => r.draws.map((d) => (d.isReversed ? 'R' : 'U')).join('')));
			if(orients.size === 1 && i === 0){ bad.push('逆位产生三档朝向恒同(死开关嫌疑)'); }
		}
		// 约定③「指示牌选定后自池中剔除」——已在 auditReading 逐格守;此处再单点确证一次
		const rs = buildReading('rws', 'celtic', 'spec-sig', { sig: { mode: 'manual', manualId: 'wands_king' } });
		if(rs.significator && rs.significator.card){
			const inSpread = rs.draws.some((d) => d.card && d.card.sid === 'wands_king');
			if(inSpread){ bad.push('指示牌未从池中剔除,又被抽进阵中'); }
		}else{ bad.push('手动指示牌未生效'); }
		expect(`规格与实现不符 ${bad.length} 处: ${bad.slice(0, 3).join(' ;; ')}`).toBe('规格与实现不符 0 处: ');
	});
	test('[QA-9] 马赛换号对历史牌组同样生效:力量=XI · 正义=VIII(底层 marseilleNumber 漏判即咬)', () => {
		['rws', 'tdm', 'visconti', 'minchiate'].forEach((deckId) => {
			const cards = getDeckCards(deckId);
			const strength = cards.find((c) => c.sid === 'strength');
			const justice = cards.find((c) => c.sid === 'justice');
			if(!strength || !justice){ return; }
			expect(`${deckId} 力量马赛号:${marseilleNumber(strength)}`).toBe(`${deckId} 力量马赛号:11`);
			expect(`${deckId} 正义马赛号:${marseilleNumber(justice)}`).toBe(`${deckId} 正义马赛号:8`);
			// 度值同步(对读的度关系引擎建立在此)
			expect(`${deckId} 力量度:${degreeOf(strength)}`).toBe(`${deckId} 力量度:1`);
			expect(`${deckId} 正义度:${degreeOf(justice)}`).toBe(`${deckId} 正义度:8`);
		});
	});
	test('非塔罗结构牌组的识别面恒定(改判据即咬):雷诺曼/吉普赛/扑克全员非塔罗结构,塔罗系全员是', () => {
		const nonTarot = { lenormand: 36, kipper: 36, sibilla: 52, cartomancy: 52 };
		listDeckIds().forEach((deckId) => {
			const cards = getDeckCards(deckId);
			const n = cards.filter((c) => !isTarotStructured(c)).length;
			expect(`${deckId} 非塔罗结构:${n}`).toBe(`${deckId} 非塔罗结构:${nonTarot[deckId] || 0}`);
		});
	});
	test('宫廷指认的适用面恒定:塔罗系宫廷牌全员入,扑克体系全员不入(过滤面漂移即咬)', () => {
		const expectPass = { rws: 16, tdm: 16, thoth: 16, golden_dawn: 16, bota: 16, etteilla: 16, minchiate: 16, visconti: 16,
			wirth: 0, egyptian: 0, lenormand: 0, kipper: 0, sibilla: 0, cartomancy: 0 };
		listDeckIds().forEach((deckId) => {
			const draws = getDeckCards(deckId).map((c, i) => ({ card: c, position: { i: i + 1 } }));
			const got = courtSignDetect(draws).length;
			expect(`${deckId} 入宫廷指认:${got}`).toBe(`${deckId} 入宫廷指认:${expectPass[deckId]}`);
			// 入选者的三则必须都取到(不得再有 undefined 拼进文案)
			courtSignDetect(draws).forEach((c) => {
				expect(`${deckId}/${c.sid} age:${!!c.age} app:${!!c.appearance}`).toBe(`${deckId}/${c.sid} age:true app:true`);
			});
		});
	});
});
