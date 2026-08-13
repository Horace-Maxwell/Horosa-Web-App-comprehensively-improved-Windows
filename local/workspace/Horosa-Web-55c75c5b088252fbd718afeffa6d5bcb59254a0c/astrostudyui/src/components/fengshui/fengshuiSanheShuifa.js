// 三合 · 十三水法（每一坐山十三种去水情况）。
//
// 口径：三合配水以十二长生位论吉凶 —— 水从生、养、冠带、临官、帝旺来为吉、去为凶；
//       从病、死、墓、绝方来为凶、去为吉；从衰、胎、沐浴方来去有吉有凶。
//
// 🔴 传本只给出一山向之全例（壬山丙向／子山午向，即**火局正旺向**），并注明「兹举一山向以例其余」。
//    本表因此这样落地：13 条断语的**结构键**是「去水口所值之长生阶 + 水流方向」，
//    而非某个死字；四局的长生环只是同一环的旋转，故把火局例逐字保全为模板、
//    再按各局自己的双山填字 —— 火局渲染出来与传本逐字相同，其余三局是**机械旋转**、不是新造断语。
// 🔴 本表口径限「向＝帝旺（正旺向一路）」。他向法之十三情况传本未载，不臆造 —— UI 须原样标注。

// 13 条模板。stage＝去水口所值之阶；flow＝'leftToRight'|'rightToLeft'|''(不限)；
//   part＝取该双山之哪一字（'both'两字间／'gan'干维字／'zhi'支字）。
export const SHUIFA_13_TPL = [
	{ no: 1, stage: '墓', flow: 'leftToRight', part: 'both', name: '正旺向',
		tpl: '水从左来倒右，出{S}两字间，谓之正旺向，名三合联珠，合杨公进神水法，生来会旺玉带缠腰，主发富旺丁，若得山肥水聚更美。', jx: 'good' },
	{ no: 2, stage: '衰', flow: 'leftToRight', part: 'both', name: '自旺向',
		tpl: '水从左倒右，水口在{S}两字间，为自旺向，主财丁富贵。', jx: 'good' },
	{ no: 3, stage: '沐浴', flow: 'rightToLeft', part: 'gan', name: '禄存流尽佩金鱼',
		tpl: '水从右倒左，从{G}字沐浴方消水，名禄存流尽佩金鱼，主发富贵旺人丁；若水犯{Z1}{Z2}二字，非淫即绝，不可轻用。', jx: 'good' },
	{ no: 4, stage: '临官', flow: '', part: 'both', name: '冲破向上临官（杀人大黄泉）',
		tpl: '水从{S}方出，为冲破向上临官，犯杀人大黄泉，主丧成才之子，并犯风瘫血症，先伤二房，次及他房。', jx: 'bad', fang: '二房' },
	{ no: 5, stage: '冠带', flow: '', part: 'both', name: '流破向上冠带',
		tpl: '水从{S}方出，流破向上冠带，主伤聪明幼子少女，退败田产，终归败绝。', jx: 'bad' },
	{ no: 6, stage: '养', flow: '', part: 'both', name: '冲破向上养位',
		tpl: '水出{S}方，冲破向上养位，主败绝乏嗣。', jx: 'bad' },
	{ no: 7, stage: '胎', flow: '', part: 'both', name: '冲破胎神',
		tpl: '水出{S}方，冲破胎神，主堕胎伤人，有财无寿。', jx: 'bad' },
	{ no: 8, stage: '绝', flow: '', part: 'both', name: '过宫水',
		tpl: '水出{S}方，名过宫水，主早贫而晚贵多寿。', jx: 'neutral' },
	{ no: 9, stage: '死', flow: '', part: 'both', name: '颜回夭寿水',
		tpl: '水出{S}方，犯颜回夭寿水，虽主幼年稍利，有功名即失血夭亡，终必败绝。', jx: 'bad' },
	{ no: 10, stage: '病', flow: '', part: 'both', name: '短命寡宿水',
		tpl: '水出{S}病方，犯短命寡宿水，主男人短寿，必出寡孀，先败三房，次及别房。', jx: 'bad', fang: '三房' },
	{ no: 11, stage: '长生', flow: '', part: 'both', name: '旺去冲生',
		tpl: '水出{S}方，为旺去冲生，主富而无子，十有九绝。', jx: 'bad' },
	{ no: 12, stage: '帝旺', flow: 'rightToLeft', part: 'gan', name: '胎向胎方出水（出煞）',
		tpl: '右水倒左，从向上{G}字出去，不犯{Z}字，犹须百步关栏，合胎向胎方出水，谓之出煞，不作冲胎论，主大富贵，旺人丁，间有男子短寿，出幼妇寡孀。', jx: 'good' },
	{ no: 13, stage: '帝旺', flow: 'leftToRight', part: 'both', name: '生来破旺',
		tpl: '若左水倒右，出{S}二方，即变为生来破旺，有丁无财，一贫如洗，切不可误作胎向胎方去水。', jx: 'bad' },
];

export const SHUIFA_13_HEAD = '三合配水以十二长生位论吉凶：水从生、养、冠带、临官、帝旺来为吉、去为凶；从病、死、墓、绝方来为凶、去为吉；从衰、胎、沐浴方来去有吉有凶。';
export const SHUIFA_13_JI = '三合水法尤忌黄泉。';
export const SHUIFA_13_XIANGFA_NOTE = '本表为「向＝帝旺（正旺向一路）」之十三情况；他向法之十三情况传本未载，故不列。';
export const SHUIFA_13_DERIVE_NOTE = '火局（壬山丙向／子山午向）为传本原例逐字；其余三局按各局长生环旋转填字，断语结构与用字规则一同。';

// 由某局的长生环生成 13 条具体断语。
//   ring: [{ shuangshan, zhi, stage, jx }]（sanhe 引擎已备）
export function shuifa13(ju, ring) {
	if (!ju || !Array.isArray(ring) || !ring.length) { return null; }
	const at = (stage)=>ring.find((r)=>r.stage === stage) || null;
	const rows = SHUIFA_13_TPL.map((t)=>{
		const hit = at(t.stage);
		if (!hit) { return null; }
		const S = hit.shuangshan;
		const G = S.slice(0, S.length - 1);      // 干／维字
		const Z = hit.zhi;                        // 支字
		let text = t.tpl.replace('{S}', S).replace('{G}', G).replace('{Z}', Z);
		if (t.no === 3) {
			const sheng = at('长生');
			text = text.replace('{Z1}', sheng ? sheng.zhi : '').replace('{Z2}', Z);
		}
		return { ...t, shuangshan: S, gan: G, zhi: Z, text };
	}).filter(Boolean);
	return {
		ju, rows,
		head: SHUIFA_13_HEAD, ji: SHUIFA_13_JI,
		xiangFaNote: SHUIFA_13_XIANGFA_NOTE,
		source: ju === '火局' ? '传本原例（逐字）' : '按本局长生环旋转填字',
		derived: ju !== '火局',
		deriveNote: SHUIFA_13_DERIVE_NOTE,
	};
}

// 当前去水口 + 水流方向 落在 13 条中的哪一条（可能命中 0 或 1 条；帝旺按方向二分）。
export function shuifa13Hit(table, shuiKou, waterFlow) {
	if (!table || !shuiKou) { return null; }
	const cand = table.rows.filter((r)=>r.shuangshan.indexOf(shuiKou) >= 0);
	if (!cand.length) { return null; }
	const byFlow = cand.filter((r)=>!r.flow || r.flow === waterFlow);
	return (byFlow.length ? byFlow : cand)[0];
}

export default shuifa13;
