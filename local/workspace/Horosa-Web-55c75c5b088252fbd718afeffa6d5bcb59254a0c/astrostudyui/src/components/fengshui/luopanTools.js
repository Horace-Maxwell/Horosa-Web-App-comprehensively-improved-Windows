// 罗盘工具 —— 分金择优器 · 立向向导 · 判向向导 · 磁偏角换算。
// 🔴 additive：不改 liqiCore 的 fenjinAt/chuanshanAt 本判，只在其上做「可用性筛选与排序」。
import { SHAN_ORDER, SHAN_24, SHAN_CENTER_DEG, FENJIN_GAN_JX } from './fengshuiData';
import { fenjinAt, chuanshanAt, toudiAt } from './liqiCore';
import { declinationOf, trueToMagnetic, DECLINATION_SIGN_NOTE, DECLINATION_EPOCH_NOTE } from './fengshuiDeclinationData';

const norm360 = (d)=>((d % 360) + 360) % 360;

// ── 一、分金择优器 ────────────────────────────────────────────────────────
//   一百二十分金：每山 5 个分金线位（各 3°）。
//   🔴 古籍口径：只有分金的**纳甲为丙、丁、庚、辛者可用**——罗盘面上只标注四十八个线位，
//      其余线位的位置是空的、不宜立向。立向应位于可用线位之内，即左兼或右兼 3°。
export const FENJIN_USABLE_GAN = ['丙', '丁', '庚', '辛'];
export const FENJIN_RULE = '一百二十分金将周天分为 120 分位、每位 3°，以六十甲子表示（恰两轮）。'
	+ '廿四山每山下排 5 个分金，阳干（含乾巽）配阳支、阴干（含艮坤）配阴支。'
	+ '🔴 只有纳甲为丙、丁、庚、辛者可用（全盘仅四十八个线位），其余位置是空的、不宜立向。';

// 🔴 起点之别：liqiCore 的线法层以**壬山初 337.5°**起甲子（通行三合盘一路，其注亦明言「需按门派校」）；
//    而本册明写「甲子始于**子方（子山）**」，两者差一山。故择优器**自算干支**、不复用线法层之干支标注，
//    两说并陈：盘面线法环仍照旧，择优器另按本册口径给出。
//
// 排法之推定依据（可自证，非臆造）：
//   ① 本册明载「阳干（含乾巽）配阳支，阴干（含艮坤）配阴支」「每山五分金」「只有丙丁庚辛可用」
//      「罗盘面上只标注四十八个分金线位」；
//   ② 本册两实例：「子山癸山下面各为丙子、庚子可用」「丑山艮山下面各为丁丑、辛丑可用」，末云「余同」；
//   ③ 由①②唯一齐整解：**每地支配两山**（该支山 + 其顺时针后一山），两山共用同一支之五干。
//      如此 12 支 × 2 山 × 5 干 ＝ 120 位，恰合本册「一百二十分金恰好两个六十甲子」；
//      可用者每山恒 2 位，24 × 2 ＝ 48，恰合「只标注四十八个线位」。三处计数同时自洽。
const YANG_GAN = ['甲', '丙', '戊', '庚', '壬'];
const YIN_GAN = ['乙', '丁', '己', '辛', '癸'];
const ZHI_12 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const ZHI_YANG = new Set(['子', '寅', '辰', '午', '申', '戌']);
// 山 → 所配地支：支山配自身；非支山配其**顺时针前一山**之支（即与前一支山同组）。
export const SHAN_FENJIN_ZHI = (()=>{
	const m = {};
	let cur = null;
	// SHAN_ORDER 自壬起；先绕一圈找到首个支山作起点，保证「前一支山」恒有定义。
	const n = SHAN_ORDER.length;
	const start = SHAN_ORDER.findIndex((s)=>ZHI_12.indexOf(s) >= 0);
	for (let k = 0; k < n; k++) {
		const s = SHAN_ORDER[(start + k) % n];
		if (ZHI_12.indexOf(s) >= 0) { cur = s; }
		m[s] = cur;
	}
	return m;
})();

export function fenjinPick(shan) {
	const c = SHAN_CENTER_DEG[shan];
	const zhi = SHAN_FENJIN_ZHI[shan];
	if (c == null || !zhi) { return null; }
	const gans = ZHI_YANG.has(zhi) ? YANG_GAN : YIN_GAN;
	const rows = gans.map((gan, k)=>{
		const d0 = norm360(c - 7.5 + k * 3);
		const usable = FENJIN_USABLE_GAN.indexOf(gan) >= 0;
		const ganJx = FENJIN_GAN_JX[gan] || 'neutral';
		return {
			idx: k, ganzhi: `${gan}${zhi}`, gan, zhi, ganJx,
			deg0: d0, deg1: norm360(d0 + 3), degMid: norm360(d0 + 1.5),
			positional: (k >= 1 && k <= 3) ? '居中三位' : '边位',
			usable,
			why: usable ? `纳甲「${gan}」在丙丁庚辛之列——可用`
				: (ganJx === 'void' ? `纳甲「${gan}」龟甲空亡——不可用`
					: `纳甲「${gan}」不在丙丁庚辛之列——罗盘面上此位是空的，不宜立向`),
		};
	});
	const usable = rows.filter((r)=>r.usable);
	return {
		shan, zhi, center: c, rows, usable,
		best: usable.length ? usable.slice().sort((a, b)=>Math.abs(a.idx - 2) - Math.abs(b.idx - 2))[0] : null,
		count: usable.length, rule: FENJIN_RULE,
		verdict: usable.length
			? { text: `${shan}山（配${zhi}支）可用分金 ${usable.length} 位：${usable.map((r)=>r.ganzhi).join('、')}`, jx: 'good' }
			: { text: `${shan}山无可用分金线位`, jx: 'bad' },
	};
}

// 穿山七十二龙择优：每山三龙，🔴 只有丙子旬、庚子旬（即天干丙、庚者）的分金可用。
export const CHUANSHAN_USABLE_GAN = ['丙', '庚'];
export const CHUANSHAN_RULE = '穿山七十二龙每山排三龙，廿四山共七十二分金，'
	+ '自地盘正针壬位与子位交界处排甲子。🔴 只有丙子旬、庚子旬的分金可用，余不可用。'
	+ '使用时于过峡处下罗盘看过峡穿于何干支；近无过峡者，于入首之后的束咽处定干支。';

// 穿山起点亦从本册：「自地盘正针**壬位与子位交界处**排甲子」＝352.5°（线法层用 337.5°，两说并陈）。
const CHUANSHAN_ORIGIN = 352.5;
const GANZHI_60_LOCAL = (()=>{
	const G = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
	const Z = ZHI_12;
	const out = []; for (let i = 0; i < 60; i++) { out.push(G[i % 10] + Z[i % 12]); } return out;
})();

export function chuanshanPick(shan) {
	const c = SHAN_CENTER_DEG[shan];
	if (c == null) { return null; }
	const rows = [0, 1, 2].map((k)=>{
		const d0 = norm360(c - 7.5 + k * 5);
		const off = norm360(d0 + 2.5 - CHUANSHAN_ORIGIN);
		const info = chuanshanAt(norm360(d0 + 2.5));
		const ganzhi = GANZHI_60_LOCAL[Math.floor(off / 5) % 60];
		const gan = ganzhi[0];
		const usable = CHUANSHAN_USABLE_GAN.indexOf(gan) >= 0;
		return {
			idx: k, ganzhi, gan, deg0: d0, deg1: norm360(d0 + 5), degMid: norm360(d0 + 2.5),
			positional: info.positional, usable,
			why: usable ? `天干「${gan}」属丙子／庚子旬——可用` : `天干「${gan}」不属丙子／庚子旬——不可用`,
		};
	});
	const usable = rows.filter((r)=>r.usable);
	return { shan, rows, usable, count: usable.length, rule: CHUANSHAN_RULE,
		verdict: usable.length ? { text: `${shan}山可用之龙：${usable.map((r)=>r.ganzhi).join('、')}`, jx: 'good' }
			: { text: `${shan}山三龙皆不属丙子／庚子旬，本山不可用`, jx: 'bad' } };
}

// ── 二、三元龙兼线合法性 ──────────────────────────────────────────────────
//   天元与人元阴阳相同，称「顺子」；地元与天元阴阳不同，称「逆子」。
export const JIAN_RULES = [
	{ from: '天', to: '人', ok: true, limit: null, text: '天元父母可兼人元顺子' },
	{ from: '天', to: '地', ok: true, limit: null, text: '天元父母也可兼地元逆子' },
	{ from: '人', to: '天', ok: true, limit: null, text: '人元顺子宜兼天元父母' },
	{ from: '人', to: '地', ok: true, limit: 'few', text: '人元顺子兼地元逆子则不能太多，太多则出卦' },
	{ from: '地', to: '天', ok: true, limit: null, text: '地元逆子可兼天元父母' },
	{ from: '地', to: '人', ok: true, limit: 'few', text: '地元逆子兼人元顺子则不能太多，太多则出卦' },
];
export const JIAN_DEG_RULES = [
	{ school: 'sanhe', text: '三合派一般采用一百二十分金，立向应位于丙丁庚辛线位之内，即左兼或右兼 3°；'
		+ '其余分金线位是空的，不宜立向。', max: 3 },
	{ school: 'xuankong', text: '玄空飞星派在地元龙、天元龙、人元龙左右相兼的原则下，左右相兼一般也在 3° 左右为宜；'
		+ '特别是**人地相兼**线位更应在 3° 以内；**天人相兼**则最多 6.5°。而且不立正线、不立空亡线。',
		maxRenDi: 3, maxTianRen: 6.5 },
];
export const JIAN_ZHENGXIAN_NOTE = '正线指罗盘红色交叉线压着某字的中心、没有丝毫偏离；'
	+ '一般情况下不立正线线位。兼线指压着某字稍偏离中心（或偏左或偏右）。'
	+ '三合派以罗盘红黑字分阴阳，兼向不能阴阳差错、更不能出卦。';
export const JIAN_CHOOSE_NOTE = '在各山兼左还是兼右的选择上，当以来龙或水口定之，或以明堂是否中正为依据——'
	+ '不能在理气上恶左而兼右、或恶右而兼左。';

// 判兼线合法性：坐山 + 兼向之山 + 兼出度数。
export function jianCheck(zuoShan, jianShan, jianDeg, school = 'xuankong') {
	const a = SHAN_24[zuoShan]; const b = SHAN_24[jianShan];
	if (!a || !b) { return null; }
	const [gongA, yuanA, yyA] = a; const [gongB, yuanB, yyB] = b;
	const sameGua = gongA === gongB;
	const rule = JIAN_RULES.find((r)=>r.from === yuanA && r.to === yuanB) || null;
	const d = Math.abs(Number(jianDeg) || 0);
	// 度数闸
	let degMax = 3; let degWhy = '';
	if (school === 'sanhe') { degMax = 3; degWhy = '三合派：左右兼 3°（须落在丙丁庚辛分金线位内）'; }
	else {
		const pair = [yuanA, yuanB].sort().join('');
		if (pair === '人天') { degMax = 6.5; degWhy = '玄空：天人相兼最多 6.5°'; }
		else { degMax = 3; degWhy = '玄空：人地相兼应在 3° 以内'; }
	}
	const degOk = d > 0 && d <= degMax;
	const items = [];
	items.push({ key: 'chugua', name: '是否出卦', ok: sameGua,
		text: sameGua ? `${zuoShan}与${jianShan}同属一卦（${gongA}宫），未出卦` : `${zuoShan}与${jianShan}分属两卦，已出卦——不可` });
	items.push({ key: 'yuan', name: '三元龙相兼', ok: !!rule,
		text: rule ? `${yuanA}元兼${yuanB}元：${rule.text}${rule.limit === 'few' ? '（本组有「不能太多」之限）' : ''}`
			: `${yuanA}元兼${yuanB}元：古籍未列此组合，不臆断` });
	items.push({ key: 'yinyang', name: '阴阳差错', ok: yyA === yyB || yuanA === '天' || yuanB === '天',
		text: yyA === yyB ? '兼向两山阴阳相同（顺子），无阴阳差错'
			: '兼向两山阴阳不同（逆子）——三合派忌阴阳差错；三元派天元可兼地元逆子，须按所宗派权衡' });
	items.push({ key: 'deg', name: '兼出度数', ok: degOk,
		text: d === 0 ? '压正线（一般情况下不立正线线位）' : `兼 ${d}°：${degWhy}——${degOk ? '合' : '超限'}` });
	const bad = items.filter((x)=>!x.ok);
	return {
		zuoShan, jianShan, jianDeg: d, school, yuanA, yuanB, sameGua, rule, degMax,
		items, ok: bad.length === 0,
		verdict: bad.length === 0 ? { text: '兼线合法', jx: 'good' }
			: { text: `兼线不合：${bad.map((x)=>x.name).join('、')}`, jx: 'bad' },
		note: `${JIAN_ZHENGXIAN_NOTE}　${JIAN_CHOOSE_NOTE}`,
	};
}

// ── 三、立向向导（形势为体、理气为用）──────────────────────────────────────
export const LIXIANG_STEPS = [
	{ key: 'shunshi', name: '一要顺势立向',
		text: '依据穴场环境，审龙、观砂、看水、认穴，合理确定坐向度数，使龙穴砂水等峦头形势为我所用。'
			+ '应重点把握龙、砂、水、堂局等因素，遵循坐阴向阳、背山面水、前低后高、对称平衡等原则，顺其自然格局确定坐向度数。' },
	{ key: 'jianxian', name: '二要兼线合法',
		text: '依一定时空理气模式立向。立向有正线与兼线之分，一般不立正线；兼线须合三元龙相兼之法与度数之限，'
			+ '不能阴阳差错、更不能出卦。兼左兼右当以来龙或水口定之，或以明堂是否中正为依据。' },
	{ key: 'shoushan', name: '三要收山出煞', text: '主旨在于收三吉五吉之山、三吉五吉之水。' },
];
export const LIXIANG_TIYONG = '以形势立向为体、理气立向为用，两者要相结合。'
	+ '🔴 这一体用关系的根本要求在于：周围形势是立向的根本，要顺其自然之格局来确立坐向，'
	+ '而**绝不能勉立理气上的旺向**；形势与理气两者统一时，这一立向才是正确的。';
export const XIANG_IMPORTANCE = '向是关乎全局的关键，多数情况下一个穴位只有一个坐度分金最吉。'
	+ '坐向一变，或堂局不正，或纳不到生旺之砂水，故准确定坐向至关重要。'
	+ '现代城市阳宅的判向更难于立向——立向容易判向难，一定要准确立向、判向，否则满盘皆错。';

// ── 四、判向向导 ──────────────────────────────────────────────────────────
export const PANXIANG_CONCEPTS = [
	{ key: 'wuxiang', name: '屋向', text: '整栋大厦的向方。向方定了，其反方向（180°）即为坐山。' },
	{ key: 'menxiang', name: '门向', text: '大门的方向。站在大门口、避开磁场干扰，将罗盘与大门线平行，即可测出大门的坐向。' },
	{ key: 'menwei', name: '门位', text: '门所在的方位。以房屋首层平面太极点为中心点下罗盘可测出；'
		+ '或以整栋大楼的坐向为基准在平面图上放出八宫放射线，即知门所在方位。' },
];
export const PANXIANG_CONCEPT_NOTE = '一般情况下屋向与门向一致，但也有不一致的——'
	+ '因消砂纳水、环境所迫，而门向偏左或偏右一点。三者是三个不同概念，不可混为一谈。';

// 判屋向三法（有优先级：以水 > 以明堂 > 以大门）。
export const PANXIANG_WUXIANG = [
	{ rank: 1, key: 'shui', name: '以水为向',
		when: '房屋前方有大海、江、河、湖泊、大池塘等真水',
		text: '山为阴、水为阳，山静水动，以有水之方为向。' },
	{ rank: 2, key: 'mingtang', name: '以明堂为向',
		when: '房屋前面没有水，但有广场、街道、公园、停车场、较大平地',
		text: '以该方为向。🔴 且此方气场须大大超过其他三方，并此方开有较大窗户时，才用此法定向。' },
	{ rank: 3, key: 'damen', name: '以大门为向',
		when: '房屋外局四面形势差不多（山、水、明堂、街道、邻屋的间隔距离都差不多）',
		text: '以大门为向。如有两个以上大门，则以较大的门或出入人流较多的一边为向。' },
];

// 城市单元住宅定向三法。
export const PANXIANG_DANYUAN = [
	{ key: 'yiyang', name: '以阳定向法', main: true,
		text: '楼下大门坐向一般情况下不能当作每个单元住宅的坐向，而开在楼梯间的入户门不能算正门、只是一个出入口，'
			+ '所以要以阳取向——即以大阳台、窗户最多最大、采光最多的一面为向。' },
	{ key: 'rumen', name: '以入户门定向法', main: false, text: '以入户门之朝向定坐向。' },
	{ key: 'louxia', name: '以楼下大门定向法', main: false, text: '以楼下大门之坐向定坐向。' },
];
// 以阳定向的三种内外局权衡。
export const YIYANG_WEIGH = [
	{ key: 'yizhi', when: '内局与外局一致（室内阳面刚好在室外也是最空旷的一面）',
		then: '这种格局最纯正——吉则更吉，凶则更凶。', jx: 'good' },
	{ key: 'buyizhi', when: '外局与内局不一致（室内阳面在室外并非最空旷，而与坐山方的空旷程度差不多）',
		then: '这样还是要以**内局的阳面**取向。', jx: 'neutral' },
	{ key: 'waiqiang', when: '外局气场明显十分强大（虽然室内阳面不在这一方）',
		then: '此时应以**外局**定向。', jx: 'neutral' },
];

// 判向向导：按登记的实况给出应采之法。
export function panxiangWizard({ hasWater = null, hasMingtang = null, mingtangDominant = null,
	fourSidesSimilar = null, isDanyuan = false, innerOuterMatch = null, outerStrong = null } = {}) {
	const steps = [];
	let pick = null;
	if (isDanyuan) {
		// 城市单元住宅：以阳定向为主，另按内外局权衡。
		pick = PANXIANG_DANYUAN[0];
		let weigh = null;
		if (outerStrong === true) { weigh = YIYANG_WEIGH[2]; }
		else if (innerOuterMatch === true) { weigh = YIYANG_WEIGH[0]; }
		else if (innerOuterMatch === false) { weigh = YIYANG_WEIGH[1]; }
		steps.push({ name: '定向法', text: `${pick.name}——${pick.text}`, jx: 'good' });
		if (weigh) { steps.push({ name: '内外局权衡', text: `【${weigh.when}】${weigh.then}`, jx: weigh.jx }); }
		else { steps.push({ name: '内外局权衡', text: '未登记内外局实况——请补「内局阳面与外局空旷面是否一致」「外局气场是否明显强大」', jx: 'neutral' }); }
		return { isDanyuan: true, pick, steps, all: PANXIANG_DANYUAN, weigh: YIYANG_WEIGH,
			concepts: PANXIANG_CONCEPTS, conceptNote: PANXIANG_CONCEPT_NOTE };
	}
	// 单门独户：三法按优先级
	if (hasWater === true) { pick = PANXIANG_WUXIANG[0]; }
	else if (hasMingtang === true && mingtangDominant === true) { pick = PANXIANG_WUXIANG[1]; }
	else if (fourSidesSimilar === true) { pick = PANXIANG_WUXIANG[2]; }
	PANXIANG_WUXIANG.forEach((m)=>{
		const on = pick && pick.key === m.key;
		steps.push({ name: `${m.rank}. ${m.name}`, text: `【${m.when}】${m.text}`, jx: on ? 'good' : '' });
	});
	if (hasMingtang === true && mingtangDominant === false) {
		steps.push({ name: '注意', text: '有明堂但其气场未大大超过其他三方（或该方无较大窗户）——不宜用「以明堂为向」', jx: 'bad' });
	}
	return { isDanyuan: false, pick, steps, all: PANXIANG_WUXIANG,
		concepts: PANXIANG_CONCEPTS, conceptNote: PANXIANG_CONCEPT_NOTE,
		verdict: pick ? { text: `应采「${pick.name}」`, jx: 'good' }
			: { text: '实况登记不足，无法判定应采何法——请补登记前方有无真水／有无明堂及其气场／四面形势是否相当', jx: 'neutral' } };
}

// ── 五、磁偏角换算（真方位角 → 罗盘磁向 → 落山）────────────────────────────
export function degToShan(deg) {
	const d = norm360(deg);
	// 🔴 SHAN_ORDER 自壬起、壬在 345°——索引须以 345° 为基准，直接用 d/15 会整体偏一山。
	const idx = Math.floor(norm360(d - 345 + 7.5) / 15) % 24;
	const shan = SHAN_ORDER[idx];
	const center = SHAN_CENTER_DEG[shan];
	let off = d - center;
	if (off > 180) { off -= 360; }
	if (off < -180) { off += 360; }
	return { shan, center, offset: Math.round(off * 100) / 100 };
}

export function magneticWizard({ trueDeg, city = '', decOverride = null, source = 'book' } = {}) {
	const t = Number(trueDeg);
	if (!Number.isFinite(t)) { return null; }
	const hit = decOverride == null ? declinationOf(city) : null;
	const dec = decOverride == null ? (hit ? hit.dec : null) : Number(decOverride);
	if (dec == null || !Number.isFinite(dec)) {
		return { trueDeg: t, city, dec: null,
			verdict: { text: '未查到该地磁偏角——请从表中选城市，或直接填入磁偏角数值', jx: 'neutral' },
			signNote: DECLINATION_SIGN_NOTE, epochNote: DECLINATION_EPOCH_NOTE };
	}
	const conv = trueToMagnetic(t, dec, source);
	const at = degToShan(conv.magnetic);
	return {
		trueDeg: t, city: hit ? hit.city : city, prov: hit ? hit.prov : '', dec, source,
		magnetic: Math.round(conv.magnetic * 100) / 100, applied: conv.applied, applyNote: conv.note,
		shan: at.shan, offset: at.offset,
		verdict: { text: `真方位角 ${t}° ＋ 磁偏角 ${conv.applied}° ＝ 罗盘 ${Math.round(conv.magnetic * 100) / 100}°，`
			+ `落 ${at.shan} 山${at.offset === 0 ? '（正线）' : `（偏 ${at.offset > 0 ? '右' : '左'} ${Math.abs(at.offset)}°）`}`, jx: 'good' },
		signNote: DECLINATION_SIGN_NOTE, epochNote: DECLINATION_EPOCH_NOTE,
	};
}

export { toudiAt, FENJIN_GAN_JX };
