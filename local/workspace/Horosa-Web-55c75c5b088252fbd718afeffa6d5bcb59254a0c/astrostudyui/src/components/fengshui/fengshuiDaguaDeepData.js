// 玄空大卦（易经派）深化数据 —— 二元八运 · 六十四卦四数 · 两卦相见四档 · 五种交通。
//
// 🔴 本模块与既有 dagua.js 的「结构推定卦运」是**两套并行口径**，不互相覆盖：
//    dagua.js 的 structYun 只作框架推定（并明说须按实体三元易盘校）；
//    本模块的星运（卦运）依传本给出的**生成规则**逐卦推出，是可自证的封闭体系
//    （八运各恰 8 卦、合计 64，见 __selfCheck）。切档即换判据，不可混算。
import { GUA64_TABLE } from './fengshuiData';

// ── 经卦二进制（[初,二,三]，1=阳）与后天数（洛书数）──────────────────────────
export const GUA8_BIN3 = {
	乾: [1, 1, 1], 兑: [1, 1, 0], 离: [1, 0, 1], 震: [1, 0, 0],
	巽: [0, 1, 1], 坎: [0, 1, 0], 艮: [0, 0, 1], 坤: [0, 0, 0],
};
export const GUA8_LUOSHU = { 坎: 1, 坤: 2, 震: 3, 巽: 4, 乾: 6, 兑: 7, 艮: 8, 离: 9 };
const GUA8 = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
const binKey = (a)=>a.join('');
const BY_BIN = (()=>{ const m = {}; GUA8.forEach((g)=>{ m[binKey(GUA8_BIN3[g])] = g; }); return m; })();
const flipAt = (g, i)=>{ const a = GUA8_BIN3[g].slice(); a[i] = a[i] ? 0 : 1; return BY_BIN[binKey(a)]; };
// 错卦（阴阳全变）＝先天对宫，亦即夫妇正配之偶。
const INVERT8 = (()=>{ const m = {}; GUA8.forEach((g)=>{ m[g] = BY_BIN[binKey(GUA8_BIN3[g].map((v)=>(v ? 0 : 1)))]; }); return m; })();
const name64 = (lower, upper)=>(GUA64_TABLE[lower] || {})[upper] || null;

// ── ① 二元八运（阳爻管 9 年、阴爻管 6 年；运序＝先天卦之后天数；无五运）────────
//    坤1(18) 巽2(24) 离3(24) 兑4(24) ／ 艮6(21) 坎7(21) 震8(21) 乾9(27)
const ERYUAN_ORDER = [
	{ gua: '坤', yun: 1, from: 1864 }, { gua: '巽', yun: 2, from: 1882 },
	{ gua: '离', yun: 3, from: 1906 }, { gua: '兑', yun: 4, from: 1930 },
	{ gua: '艮', yun: 6, from: 1954 }, { gua: '坎', yun: 7, from: 1975 },
	{ gua: '震', yun: 8, from: 1996 }, { gua: '乾', yun: 9, from: 2017 },
];
export const ERYUAN_8YUN = ERYUAN_ORDER.map((e, i)=>{
	const bin = GUA8_BIN3[e.gua];
	const yang = bin.filter((v)=>v).length;
	const yin = 3 - yang;
	// 传本另注乾运管 27 年（末运含闰余），其余诸运恰＝爻年之和。
	const byYao = yang * 9 + yin * 6;
	const next = ERYUAN_ORDER[i + 1];
	const to = next ? next.from - 1 : e.from + byYao - 1;
	return {
		yun: e.yun, gua: e.gua, from: e.from, to, years: to - e.from + 1,
		yang, yin, byYao, yuan: e.yun <= 4 ? '上元' : '下元',
		note: `${e.gua}${e.yun}运：阳爻${yang}×9 + 阴爻${yin}×6 ＝ ${byYao} 年`,
	};
});
export const ERYUAN_NOTE = '二元八运以先天卦之后天数为运序，阳爻管 9 年、阴爻管 6 年，无五运；上四运一二三四为正神（旺）、九八七六为零神（衰），下四运反之。';
// 正神/零神（按上下四运二分）。
export function eryuanZhengLing(yun) {
	const shang = yun <= 4;
	return shang
		? { yuan: '上元', zheng: [1, 2, 3, 4], ling: [9, 8, 7, 6] }
		: { yuan: '下元', zheng: [6, 7, 8, 9], ling: [4, 3, 2, 1] };
}
export function eryuanAt(year) {
	const y = Math.trunc(Number(year));
	return ERYUAN_8YUN.find((e)=>y >= e.from && y <= e.to) || null;
}

// ── ② 星运（卦运／后天卦气）：依传本生成规则逐卦推出 ─────────────────────────
//    八纯卦＝父卦＝一运；八纯卦夫妇正配所装之卦及其错卦＝母卦＝九运；
//    父卦之内三爻变出者为江东卦：仅变初爻＝八运、仅变二爻＝七运、仅变三爻＝六运；
//    母卦之内三爻变出者为江西卦：仅变初爻＝二运、仅变二爻＝三运、仅变三爻＝四运。
export const XINGYUN_RULE = [
	{ yun: 1, cls: '父卦（八纯卦）', how: '上下同卦' },
	{ yun: 9, cls: '母卦', how: '八纯卦夫妇正配所装之卦及其错卦' },
	{ yun: 8, cls: '江东卦', how: '父卦仅变初爻' },
	{ yun: 7, cls: '江东卦', how: '父卦仅变二爻' },
	{ yun: 6, cls: '江东卦', how: '父卦仅变三爻' },
	{ yun: 2, cls: '江西卦', how: '母卦仅变初爻' },
	{ yun: 3, cls: '江西卦', how: '母卦仅变二爻' },
	{ yun: 4, cls: '江西卦', how: '母卦仅变三爻' },
];
export const XINGYUN_MAP = (()=>{
	const m = {};
	const put = (lower, upper, yun, cls, from)=>{
		const n = name64(lower, upper);
		if (n && m[n] == null) { m[n] = { yun, cls, from, lower, upper }; }
	};
	// 父卦：八纯 → 一运
	GUA8.forEach((g)=>put(g, g, 1, '父卦', `${g}为体`));
	// 母卦：夫妇正配（上下互为错卦）→ 九运
	GUA8.forEach((g)=>put(g, INVERT8[g], 9, '母卦', `${g}与${INVERT8[g]}夫妇正配`));
	// 江东卦：父卦变内三爻（上卦不动）
	GUA8.forEach((g)=>{
		[[0, 8, '初'], [1, 7, '二'], [2, 6, '三']].forEach(([i, yun, yao])=>{
			put(flipAt(g, i), g, yun, '江东卦', `父卦${g}为体·变${yao}爻`);
		});
	});
	// 江西卦：母卦变内三爻（上卦不动）
	GUA8.forEach((g)=>{
		const up = INVERT8[g];
		[[0, 2, '初'], [1, 3, '二'], [2, 4, '三']].forEach(([i, yun, yao])=>{
			put(flipAt(g, i), up, yun, '江西卦', `母卦${name64(g, up)}·变${yao}爻`);
		});
	});
	return m;
})();

// ── ③ 后天卦位（六十四卦按八宫归类，取该宫之后天数）──────────────────────────
//    乾宫皆 6、兑宫 7、艮宫 8、离宫 9、坎宫 1、坤宫 2、震宫 3、巽宫 4。
export const BAGONG_64 = {
	乾: ['乾为天', '天风姤', '天山遁', '天地否', '风地观', '山地剥', '火地晋', '火天大有'],
	兑: ['兑为泽', '泽水困', '泽地萃', '泽山咸', '水山蹇', '地山谦', '雷山小过', '雷泽归妹'],
	离: ['离为火', '火山旅', '火风鼎', '火水未济', '山水蒙', '风水涣', '天水讼', '天火同人'],
	震: ['震为雷', '雷地豫', '雷水解', '雷风恒', '地风升', '水风井', '泽风大过', '泽雷随'],
	巽: ['巽为风', '风天小畜', '风火家人', '风雷益', '天雷无妄', '火雷噬嗑', '山雷颐', '山风蛊'],
	坎: ['坎为水', '水泽节', '水雷屯', '水火既济', '泽火革', '雷火丰', '地火明夷', '地水师'],
	艮: ['艮为山', '山火贲', '山天大畜', '山泽损', '火泽睽', '天泽履', '风泽中孚', '风山渐'],
	坤: ['坤为地', '地雷复', '地泽临', '地天泰', '雷天大壮', '泽天夬', '水天需', '水地比'],
};
export const HOUTIAN_WEI = (()=>{
	const m = {};
	Object.keys(BAGONG_64).forEach((gong)=>{ BAGONG_64[gong].forEach((n)=>{ m[n] = { gong, num: GUA8_LUOSHU[gong] }; }); });
	return m;
})();
// 后天卦位之阴阳：乾6 坎1 艮8 震3 为阳；巽4 离9 坤2 兑7 为阴。
export const WEI_YANG = new Set([6, 1, 8, 3]);
export const WEI_YIN = new Set([4, 9, 2, 7]);

// ── ④ 两卦相见四档（后天卦位）────────────────────────────────────────────────
const pairKey = (a, b)=>[a, b].sort((x, y)=>x - y).join('-');
export const XIANGJIAN_4 = [
	{ rank: 1, name: '夫妇正配', jx: 'good', text: '阴阳正配，最吉',
		pairs: [[6, 2], [3, 4], [9, 1], [8, 7]] },
	{ rank: 2, name: '阴阳相见·五行相生或比和', jx: 'good', text: '次吉',
		pairs: [[1, 4], [1, 7], [2, 8], [3, 9], [6, 7], [8, 9]] },
	{ rank: 3, name: '阴阳相见但五行相战', jx: 'bad', text: '不吉',
		pairs: [[1, 2], [2, 3], [3, 7], [4, 8], [6, 9]] },
];
export const XIANGJIAN_CHENG = { rank: 4, name: '阴阳相乘（纯阳或纯阴相见）', jx: 'bad', text: '凶' };
const XJ_INDEX = (()=>{
	const m = {};
	XIANGJIAN_4.forEach((g)=>{ g.pairs.forEach(([a, b])=>{ m[pairKey(a, b)] = g; }); });
	return m;
})();
export function xiangJianOf(numA, numB) {
	if (!numA || !numB) { return null; }
	const hit = XJ_INDEX[pairKey(numA, numB)];
	if (hit) { return { ...hit, a: numA, b: numB }; }
	const bothYang = WEI_YANG.has(numA) && WEI_YANG.has(numB);
	const bothYin = WEI_YIN.has(numA) && WEI_YIN.has(numB);
	if (bothYang || bothYin) { return { ...XIANGJIAN_CHENG, a: numA, b: numB, pure: bothYang ? '纯阳' : '纯阴' }; }
	return { rank: 0, name: '传本未列之组合', jx: 'neutral', text: '传本四档未列，不臆断', a: numA, b: numB };
}

// ── ⑤ 综卦（倒象）与七星打劫二十八对 ────────────────────────────────────────
//    一卦之综卦即其倒象，六十四卦成 32 对；除乾坤颐大过坎离中孚小过八个自综卦，
//    余二十八对即构成七星打劫之交通关系。
export const ZONG_SELF_8 = ['乾为天', '坤为地', '山雷颐', '泽风大过', '坎为水', '离为火', '风泽中孚', '雷山小过'];
const lines6 = (lower, upper)=>GUA8_BIN3[lower].concat(GUA8_BIN3[upper]);          // 初→上
const from6 = (a)=>({ lower: BY_BIN[binKey(a.slice(0, 3))], upper: BY_BIN[binKey(a.slice(3))] });
export function zongOf(lower, upper) {
	const r = lines6(lower, upper).slice().reverse();
	const { lower: l2, upper: u2 } = from6(r);
	return { lower: l2, upper: u2, name: name64(l2, u2) };
}
export const QIXING_DAJIE_28 = (()=>{
	const out = []; const seen = new Set();
	GUA8.forEach((lower)=>GUA8.forEach((upper)=>{
		const n = name64(lower, upper);
		if (!n || ZONG_SELF_8.indexOf(n) >= 0) { return; }
		const z = zongOf(lower, upper);
		const k = [n, z.name].sort().join('|');
		if (seen.has(k)) { return; }
		seen.add(k); out.push({ a: n, b: z.name });
	}));
	return out;
})();
const DAJIE_INDEX = (()=>{ const m = {}; QIXING_DAJIE_28.forEach((p)=>{ m[`${p.a}|${p.b}`] = true; m[`${p.b}|${p.a}`] = true; }); return m; })();

// ── ⑥ 五种交通方式 ──────────────────────────────────────────────────────────
export const JIAOTONG_5 = [
	{ key: 'wuxing', name: '五行交通', ge: ['一卦纯清', '合中（合五／合十／合十五）', '合生成'] },
	{ key: 'guayun', name: '卦运交通', ge: ['同运', '合中', '合生成', '合相通'] },
	{ key: 'qinyuan', name: '亲缘交通', ge: ['一家骨肉（父母子女／兄弟姐妹／夫妇）'] },
	{ key: 'dajie', name: '七星打劫', ge: ['综卦（倒象）二十八对'] },
	{ key: 'houtian', name: '后天卦位交通', ge: ['夫妇正配', '阴阳相见'] },
];
export const HETU_SHENGCHENG = [[1, 6], [2, 7], [3, 8], [4, 9], [5, 10]];
const heZhong = (a, b)=>{
	const s = a + b;
	if (s === 5) { return '合五'; }
	if (s === 10) { return '合十'; }
	if (s === 15) { return '合十五'; }
	return null;
};
const heShengCheng = (a, b)=>HETU_SHENGCHENG.some(([x, y])=>(a === x && b === y) || (a === y && b === x));
// 五行（先天卦气＝上卦洛书数）交通判定。
export function jiaotongWuxing(qiA, qiB) {
	if (!qiA || !qiB) { return null; }
	if (qiA === qiB) { return { ge: '一卦纯清', jx: 'good', text: `先天卦气同为 ${qiA}，一卦纯清` }; }
	const hz = heZhong(qiA, qiB);
	if (hz) { return { ge: `合中·${hz}`, jx: 'good', text: `${qiA}与${qiB}${hz}` }; }
	if (heShengCheng(qiA, qiB)) { return { ge: '合生成', jx: 'good', text: `${qiA}与${qiB}合生成（河图）` }; }
	return { ge: '不合', jx: 'bad', text: `${qiA}与${qiB}不合一卦纯清／合中／合生成` };
}
// 卦运（星运）交通判定。
// 🔴「合相通」传本只列其名、未给判据 —— 本模块据实标为「未给判据」，不自造规则。
export const HEXIANGTONG_UNDEFINED = '传本列「合相通」为卦运交通四吉格之一，但未给出判据，故本模块不作自动判定。';
export function jiaotongGuayun(yunA, yunB) {
	if (!yunA || !yunB) { return null; }
	if (yunA === yunB) { return { ge: '同运', jx: 'good', text: `同为 ${yunA} 运` }; }
	const hz = heZhong(yunA, yunB);
	if (hz) { return { ge: `合中·${hz}`, jx: 'good', text: `${yunA}运与${yunB}运${hz}` }; }
	if (heShengCheng(yunA, yunB)) { return { ge: '合生成', jx: 'good', text: `${yunA}运与${yunB}运合生成` }; }
	return { ge: '不合', jx: 'bad', text: `${yunA}运与${yunB}运不合同运／合中／合生成`, undefinedGe: HEXIANGTONG_UNDEFINED };
}
// 亲缘交通：同宫（一家骨肉）。
export function jiaotongQinyuan(nameA, nameB) {
	const a = HOUTIAN_WEI[nameA]; const b = HOUTIAN_WEI[nameB];
	if (!a || !b) { return null; }
	return a.gong === b.gong
		? { ge: '一家骨肉', jx: 'good', text: `同属${a.gong}宫，血脉相连` }
		: { ge: '非一家', jx: 'neutral', text: `${a.gong}宫与${b.gong}宫，非一家骨肉` };
}
// 七星打劫：互为综卦（倒象）。
export function jiaotongDajie(nameA, nameB) {
	if (!nameA || !nameB) { return null; }
	if (ZONG_SELF_8.indexOf(nameA) >= 0 || ZONG_SELF_8.indexOf(nameB) >= 0) {
		return { ge: '无打劫', jx: 'neutral', text: '八自综卦（乾坤颐大过坎离中孚小过）不入二十八对' };
	}
	return DAJIE_INDEX[`${nameA}|${nameB}`]
		? { ge: '七星打劫', jx: 'good', text: `${nameA}与${nameB}互为综卦（倒象），成打劫之交通` }
		: { ge: '无打劫', jx: 'neutral', text: '两卦非互为综卦' };
}

// ── 自证：星运八运各恰 8 卦、合计 64；八宫各 8 卦、合计 64 ────────────────────
export const __selfCheck = (()=>{
	const byYun = {};
	Object.keys(XINGYUN_MAP).forEach((n)=>{ const y = XINGYUN_MAP[n].yun; byYun[y] = (byYun[y] || 0) + 1; });
	return {
		total: Object.keys(XINGYUN_MAP).length,
		byYun,
		gongTotal: Object.keys(HOUTIAN_WEI).length,
		dajiePairs: QIXING_DAJIE_28.length,
	};
})();

export const DAGUA_DEEP_NOTE = '玄空大卦四数：先天卦气＝上卦洛书数（即玄空五行）、先天卦位＝下卦洛书数、星运（卦运）＝父母卦爻变所定、后天卦位＝八宫之后天数。';
