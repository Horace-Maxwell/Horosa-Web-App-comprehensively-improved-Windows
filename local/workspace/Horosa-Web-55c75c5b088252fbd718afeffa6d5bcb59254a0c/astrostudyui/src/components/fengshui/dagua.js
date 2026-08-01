// 玄空大卦（三元易卦派 · 六十四卦）· 框架版（正统体系）。
// 64卦识别(6.7) + 零正收山出煞(6.3) + 卦气合十/合十五(6.4) + 真假夫妇(6.10) + 三般卦(6.9)。
// 🔴 逐卦「卦运」各门派秘授有别、须以实体三元易盘为准(6.8)：做成 结构推定 / 用户输入 两方案，不臆造单一表。
import { gua64Of, gua64AtDeg, GUAYUN_PAIRS, GUAYUN_YUAN } from './liqiCore';

// 错卦（阴阳全变）：先天圆图对宫卦，坐=向之错卦。
const INVERT = { 乾: '坤', 坤: '乾', 兑: '艮', 艮: '兑', 离: '坎', 坎: '离', 震: '巽', 巽: '震' };
const DEG_PER_GUA = 360 / 64;    // 5.625°/卦
const DEG_PER_YAO = 360 / 384;   // 0.9375°/爻

// 三般卦（6.9 江东江西南北；父母三般 147/258/369 为其数字化简，4.17）。
export const SANBAN_GROUPS = [
	{ name: '江东一卦', text: '从来吉·八神四个一·收本元' },
	{ name: '江西一卦', text: '排龙位·八神四个二·收对元' },
	{ name: '南北八神共一卦', text: '端的应无差·父母卦统三元' },
];

// 玄空大卦排盘：向卦(上×下) + 元运 → 坐卦(错) + 卦运 + 零正 + 真假夫妇。
//   { xiangLower, xiangUpper, yun, yunScheme('struct'|'input'), yunOverride:{卦名:运}, xiangYunInput, zuoYunInput, deg }
//   deg（向首度数，6.1 线度分金）：给了就由圆图落卦回填上下卦；不给维持手选（零回归）。
export function dagua({ xiangLower = '乾', xiangUpper = '乾', yun = 9, yunScheme = 'struct', yunOverride = {}, xiangYunInput, zuoYunInput, deg } = {}) {
	let lower = xiangLower; let upper = xiangUpper; let degInfo = null;
	if (deg != null && deg !== '' && !Number.isNaN(Number(deg))) {
		degInfo = gua64AtDeg(Number(deg));
		lower = degInfo.lower; upper = degInfo.upper;
	}
	const xiangLower_ = lower; const xiangUpper_ = upper;
	const xiang = gua64Of(xiangLower_, xiangUpper_);
	if (!xiang) { return { available: false }; }
	const zuo = gua64Of(INVERT[xiangLower_], INVERT[xiangUpper_]);

	const validYun = (v)=>(v != null && v !== '' && !Number.isNaN(+v) && +v >= 1 && +v <= 9);
	const guaYunOf = (g, direct)=>{
		if (yunScheme === 'input') {
			if (validYun(direct)) { return +direct; }               // UI 直填 向/坐 卦运
			if (yunOverride[g.name] != null) { return +yunOverride[g.name]; }
		}
		return g.structYun;   // 结构推定(框架,须按易盘校)
	};
	const xiangYun = guaYunOf(xiang, xiangYunInput); const zuoYun = guaYunOf(zuo, zuoYunInput);

	// 零正（按元运，与飞星同理）：当元 yun 正神宜山宜实;对元(合十)零神宜水宜虚。
	const zhengYun = yun; const lingYun = GUAYUN_PAIRS[yun];
	// 收山出煞（6.3）：向卦运当元=向首得令(旺向);坐卦运当元=收山(旺山)。
	const xiangDeLing = (xiangYun === yun);
	const zuoDeLing = (zuoYun === yun);
	// 真假夫妇（6.10）：向坐卦运合十=真夫妇正配(上吉);否则假夫妇驳杂。
	const zhenFuFu = (xiangYun + zuoYun === 10);
	// 卦气合十/合十五（6.4）：合十=运数和10;合十五(河图合生成)=运数差5(1-6/2-7/3-8/4-9)。
	const heShi = (xiangYun + zuoYun === 10);
	const heShiWu = (Math.abs(xiangYun - zuoYun) === 5);
	// 同元一气：向坐同上元或同下元。
	const yuanOf = (v)=>GUAYUN_YUAN[v];
	const tongYuan = yuanOf(xiangYun) === yuanOf(zuoYun) && yuanOf(xiangYun).indexOf('中') < 0;

	const flags = [];
	if (zhenFuFu) { flags.push({ label: '真夫妇（合十正配）', jx: 'good' }); }
	else { flags.push({ label: '假夫妇（卦运不合十·驳杂）', jx: 'bad' }); }
	if (heShiWu) { flags.push({ label: '合十五（河图合生成）', jx: 'good' }); }
	if (tongYuan) { flags.push({ label: '同元一气·清纯', jx: 'good' }); }
	if (xiangDeLing) { flags.push({ label: '向卦当元得令（旺向）', jx: 'good' }); }
	if (zuoDeLing) { flags.push({ label: '坐卦当元得令（收山）', jx: 'good' }); }

	return {
		available: true, yun, yunScheme, deg: degInfo ? Number(deg) : null, degInfo,
		xiang: { name: xiang.name, lower: xiangLower_, upper: xiangUpper_, xianTianLow: xiang.xianTianLow, xianTianUp: xiang.xianTianUp, yun: xiangYun, pure: xiang.pure, yuan: yuanOf(xiangYun) },
		zuo: { name: zuo.name, lower: INVERT[xiangLower_], upper: INVERT[xiangUpper_], yun: zuoYun, pure: zuo.pure, yuan: yuanOf(zuoYun) },
		zheng: { yun: zhengYun, text: `${zhengYun}运正神·宜山宜实宜高（收山）` },
		ling: { yun: lingYun, text: `${lingYun}运零神(与当元合十)·宜水宜虚宜低（拨水入零堂/出煞）` },
		zhenFuFu, heShi, heShiWu, tongYuan, xiangDeLing, zuoDeLing, flags,
		sanban: SANBAN_GROUPS,
		degPerGua: DEG_PER_GUA, degPerYao: DEG_PER_YAO,
		note: '🔴逐卦卦运须按实体三元易盘(门派秘授);本盘卦运='
			+ (yunScheme === 'input' ? '用户输入' : '结构推定(框架)') + '。零正收山出煞按元运可靠;识卦(6.7)确定。',
	};
}
