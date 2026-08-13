// 风水 · 理气深化数据（大玄空/收山出煞/三合深化/八宅法脉…）。
// 🔴 分文件纪律：本文件只 import fengshuiData 底座，**严禁反向**——底座被 golden 逐格对拍钉死，
//    新表一律落此处，保证冻结面（沈氏玄空算法、画布两法、LUOPAN_LAYERS 对拍）不被牵动。
// 出处：古籍地理要籍（三元大玄空一路）；显示层只署公有古籍名。

// ── 大玄空（单盘挨星）────────────────────────────────────────────────────────
// 与沈氏玄空「运/山/向三盘」不同：本派**只用一盘**，以坐山查挨星入中、按元运定顺逆飞布八宫。
// 两派互不覆盖：sanyuan 单盘是另一路口径，沈氏三盘算法与其 golden 在本仓恒不改。

// 阳宅挨星诀（八句，每句三山共一入中星；五黄无对应山 —— 故阳宅入中星永不为 5）。
export const DAXUANKONG_YANG_JUE = [
	{ star: 1, shans: ['甲', '癸', '申'], jue: '甲癸申贪狼一路行' },
	{ star: 2, shans: ['坤', '壬', '乙'], jue: '坤壬乙巨门从头出' },
	{ star: 3, shans: ['子', '卯', '未'], jue: '子卯未三碧禄存到' },
	{ star: 4, shans: ['戌', '乾', '巳'], jue: '戌乾巳文曲共廉次' },
	{ star: 6, shans: ['辰', '巽', '亥'], jue: '辰巽亥尽是武曲位' },
	{ star: 7, shans: ['艮', '丙', '辛'], jue: '艮丙辛位位是破军' },
	{ star: 8, shans: ['寅', '庚', '丁'], jue: '寅庚丁一例作辅星' },
	{ star: 9, shans: ['午', '酉', '丑'], jue: '午酉丑九紫右弼守' },
];

// 24 山 → 阳宅挨星（入中星）。
export const DAXUANKONG_AISTAR_YANG = (()=>{
	const m = {};
	DAXUANKONG_YANG_JUE.forEach((g)=>{ g.shans.forEach((s)=>{ m[s] = g.star; }); });
	return m;
})();

// 阴宅挨星＝父母星（替星）：阳宅挨星「进七位或退四位」。闭式 ((n + 6 − 1) mod 9) + 1。
// 逐山展开与古籍所列八句一致：甲癸申7 / 坤壬乙8 / 子卯未9 / 戌乾巳1 / 辰巽亥3 / 艮丙辛4 / 寅庚丁5 / 午酉丑6。
export const fumuStarOf = (n)=>(((n + 6 - 1) % 9) + 1);
export const DAXUANKONG_AISTAR_YIN = (()=>{
	const m = {};
	Object.keys(DAXUANKONG_AISTAR_YANG).forEach((s)=>{ m[s] = fumuStarOf(DAXUANKONG_AISTAR_YANG[s]); });
	return m;
})();

// 正神/零神（本派按二元划分，与沈氏「当运星为正神、合十为零神」是**两套口径**，不可混用）。
//   上四运（含五运前十年）：1234 为正神＝阳星＝顺飞；9876 为零神＝阴星＝逆飞。
//   下四运（含五运后十年）：6789 为正神＝阳星＝顺飞；4321 为零神＝阴星＝逆飞。
export const DAXUANKONG_ZHENGLING = {
	shang: { zheng: [1, 2, 3, 4], ling: [9, 8, 7, 6] },
	xia: { zheng: [6, 7, 8, 9], ling: [4, 3, 2, 1] },
};
// 🔴 五黄入中（仅阴宅可能出现：寅庚丁 8 → 父母星 5）在古籍正零两列中皆无位。
//    本模块不臆造：标 unknown 并按顺飞出盘，右栏与快照如实注明「五黄入中无正零之属（未载）」。
export const DAXUANKONG_WUHUANG_NOTE = '五黄入中于正零两列皆无位（古籍未载其阴阳），本盘按顺飞出，取用请另参形势。';

export const DAXUANKONG_YUAN_LABEL = { shang: '上元（上四运·含五运前十年）', xia: '下元（下四运·含五运后十年）' };

// 合局/反局（本派灵魂）：正神方要满要高大；零神方要空要虚低凹，零神方出水。
export const DAXUANKONG_JU_TEXT = {
	he: '合局：正神正位装，拨水入零堂',
	fan: '反局（上山下水）：正神挨到去水口＝山上龙神下水；零神挨到满实高大处＝水里龙神上山',
	fanWarn: '上山下水为本派最凶之局，主损丁、破财、凶灾、绝嗣',
};

// 八方环境录入档（满/空/来水聚水/去水口）。零神方出水为合，五黄方出水为忌。
export const DAXUANKONG_ENV_OPTS = [
	{ value: '', label: '未定' },
	{ value: 'man', label: '满(高大)' },
	{ value: 'kong', label: '空(低虚)' },
	{ value: 'lai', label: '来水/聚水' },
	{ value: 'qu', label: '去水口' },
];
export const DAXUANKONG_ENV_CN = { man: '满实高大', kong: '空虚低凹', lai: '来水聚水', qu: '去水口' };

// 八条断应（古籍原序）。
export const DAXUANKONG_DUANYING = [
	{ key: 'tiyong', title: '峦头为体·理气为用', text: '正神方见满实为吉，但形体破碎则不吉反凶——须见秀丽端圆之山、建筑、高物；零神方见水见空为吉，但水反弓、空地呈冲撞之势亦不吉反凶——须见环抱之水与端圆之空地。' },
	{ key: 'duanren', title: '综合断人', text: '结合八卦类象、九星意象与先后天关系，判断何人应吉、何人应灾。' },
	{ key: 'poling', title: '水破令星', text: '当令之星见去水口，谓之水破令星，一般主损丁。' },
	{ key: 'wuhuang', title: '五黄水法', text: '五黄挨到之处，只可来水或聚水，不可出水；上下元皆同。' },
	{ key: 'quyong', title: '取用优先', text: '有水之宅以水为重；无水之宅以门、路为重。' },
	{ key: 'yingqi', title: '应期', text: '太岁或岁破加临凶方为出灾之应期，故需重视太岁法。' },
	{ key: 'heshu', title: '合十·合生成', text: '合十主财，合生成主文、贵。（如八运：挨星二方见水主财；挨星三方见水主文贵，财亦可）' },
	{ key: 'shutu', title: '书诀图诀并用', text: '本派尚需书诀、图诀综合运用，方为完备。' },
];

export const DAXUANKONG_NOTE = '大玄空（单盘挨星）一路：以坐山查挨星入中，按元运定阳星顺飞/阴星逆飞，一盘即成，不排山向两盘。与沈氏玄空三盘飞星为并行两派，口径不同不可混算。';

// 三合 · 赖公拨砂五行（人盘中针；与「双山正五行」并行两档，不可混）。
// 口诀：比和为旺丁财足，生我为食旺文贵，我克为奴财帛盛，我生为泄渐飘零，克我为煞主祸绝。
export const LAIGONG_BOSHA_WUXING = (()=>{
	const m = {};
	['子', '午', '卯', '酉'].forEach((s)=>{ m[s] = '火'; });          // 太阳火
	['甲', '庚', '丙', '壬'].forEach((s)=>{ m[s] = '火'; });          // 太阴火（同属火，太阳/太阴之别只标注）
	['乾', '坤', '艮', '巽'].forEach((s)=>{ m[s] = '木'; });
	['辰', '戌', '丑', '未'].forEach((s)=>{ m[s] = '金'; });
	['寅', '申', '巳', '亥'].forEach((s)=>{ m[s] = '水'; });
	['乙', '辛', '丁', '癸'].forEach((s)=>{ m[s] = '土'; });
	return m;
})();
export const LAIGONG_BOSHA_SUBLABEL = (()=>{
	const m = {};
	['子', '午', '卯', '酉'].forEach((s)=>{ m[s] = '太阳火'; });
	['甲', '庚', '丙', '壬'].forEach((s)=>{ m[s] = '太阴火'; });
	return m;
})();
export const LAIGONG_BOSHA_NOTE = '赖公拨砂法用人盘中针：以坐山中针之字为「我」，砂峰中针之字为「他」，按拨砂五行论生克。与本模块默认的双山正五行为两套口径，切换即换判据。';
