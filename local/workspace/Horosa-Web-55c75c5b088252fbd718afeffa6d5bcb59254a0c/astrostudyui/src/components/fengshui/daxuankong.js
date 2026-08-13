// 风水 · 大玄空（单盘挨星）。古籍三元大玄空一路：坐山查挨星入中 → 元运定阳星顺飞/阴星逆飞 → 一盘八宫。
// 🔴 与沈氏玄空（运/山/向三盘）是**并行两派**：本模块自成一路，不改亦不复用 xuankong.js 的任何判据。
import { GONG_GUA, GONG_NAME, POS_NAME, HOUTIAN_POS, OPP_GONG, SHAN_24, YUN_YEARS } from './fengshuiData';
import {
	DAXUANKONG_AISTAR_YANG, DAXUANKONG_AISTAR_YIN, DAXUANKONG_ZHENGLING, DAXUANKONG_WUHUANG_NOTE,
	DAXUANKONG_YUAN_LABEL, DAXUANKONG_JU_TEXT, DAXUANKONG_ENV_CN, DAXUANKONG_DUANYING, DAXUANKONG_NOTE,
} from './fengshuiLiqiDeepData';

const GONGS = [1, 2, 3, 4, 6, 7, 8, 9];          // 八外宫（中五另计）
const norm9 = (n)=>(((n - 1) % 9 + 9) % 9) + 1;  // 归一到 1..9

// 元属：上四运=上元；下四运=下元；五运前十年归上、后十年归下（本派二元口径）。
export function yuanOf(yun, wuYunHalf) {
	const y = Math.trunc(Number(yun));
	if (y >= 1 && y <= 4) { return 'shang'; }
	if (y >= 6 && y <= 9) { return 'xia'; }
	if (y === 5) { return wuYunHalf === 'second' ? 'xia' : 'shang'; }
	return null;
}

// 星之正零与阴阳（正神＝阳星＝顺飞；零神＝阴星＝逆飞）。五黄两列皆无位 → unknown。
export function starNature(star, yuan) {
	const t = DAXUANKONG_ZHENGLING[yuan];
	if (!t) { return null; }
	if (t.zheng.indexOf(star) >= 0) { return { role: 'zheng', roleName: '正神', yinYang: '阳', forward: true }; }
	if (t.ling.indexOf(star) >= 0) { return { role: 'ling', roleName: '零神', yinYang: '阴', forward: false }; }
	return { role: 'unknown', roleName: '五黄（无正零之属）', yinYang: null, forward: true, unknown: true };
}

// 宫星：入中星 ±(该宫洛书数 − 5)，顺飞取「＋」、逆飞取「−」。
export function palaceStar(center, gong, forward) {
	return norm9(center + (forward ? 1 : -1) * (gong - 5));
}

// 合生成对（河图）：1-6 / 2-7 / 3-8 / 4-9。
const isHeShengCheng = (a, b)=>Math.abs(a - b) === 5 && a >= 1 && b >= 1;

// 大玄空主入口。
//   { zuoShan, yun, wuYunHalf:'first'|'second', zhaiType:'yang'|'yin', envs:{gong:'man'|'kong'|'lai'|'qu'}, year }
export function daxuankong({ zuoShan = '子', yun = 9, wuYunHalf = 'first', zhaiType = 'yang', envs = {}, year } = {}) {
	const table = zhaiType === 'yin' ? DAXUANKONG_AISTAR_YIN : DAXUANKONG_AISTAR_YANG;
	const center = table[zuoShan];
	const yuan = yuanOf(yun, wuYunHalf);
	if (!center || !yuan) { return { available: false }; }

	const nature = starNature(center, yuan);
	const forward = nature.forward;
	const meta = SHAN_24[zuoShan] || [];
	const zuoGong = meta[0] || null;
	const xiangGong = zuoGong ? OPP_GONG[zuoGong] : null;

	// 八宫出盘 + 逐宫合反判定。
	const palaces = GONGS.map((gong)=>{
		const star = palaceStar(center, gong, forward);
		const nat = starNature(star, yuan);
		const env = envs[gong] || '';
		const waterLike = env === 'kong' || env === 'lai' || env === 'qu';
		let verdict = null; let jx = 'neutral';
		if (env) {
			if (nat.role === 'zheng') {
				if (env === 'man') { verdict = '正神得满·合局'; jx = 'good'; }
				else if (waterLike) { verdict = '正神临水空·山上龙神下水（反局）'; jx = 'bad'; }
			} else if (nat.role === 'ling') {
				if (waterLike) { verdict = '零神得水空·合局（拨水入零堂）'; jx = 'good'; }
				else if (env === 'man') { verdict = '零神临满实·水里龙神上山（反局）'; jx = 'bad'; }
			}
		}
		// 五黄水法：五黄所到只可来水聚水，不可出水（上下元同）。
		let wuHuangWarn = null;
		if (star === 5) {
			if (env === 'qu') { wuHuangWarn = '五黄方出水·大忌'; jx = 'bad'; verdict = verdict || wuHuangWarn; }
			else if (env === 'lai') { wuHuangWarn = '五黄方来水聚水·可'; }
			else { wuHuangWarn = '五黄方忌出水'; }
		}
		// 水破令星：当令之星见去水口，主损丁。
		const poLing = (star === Math.trunc(Number(yun)) && env === 'qu');
		if (poLing) { verdict = '水破令星·主损丁'; jx = 'bad'; }
		// 合十主财 / 合生成主文贵（挨星与当令运数相较）。
		const heShi = (star + Math.trunc(Number(yun))) === 10;
		const heSC = isHeShengCheng(star, Math.trunc(Number(yun)));
		return {
			gong, gua: GONG_GUA[gong], dir: POS_NAME[gong] || GONG_NAME[gong], star,
			role: nat.role, roleName: nat.roleName, yinYang: nat.yinYang,
			env, envCn: DAXUANKONG_ENV_CN[env] || '', verdict, jx,
			wuHuangWarn, poLing, heShi, heSC,
			isZuo: gong === zuoGong, isXiang: gong === xiangGong,
		};
	});

	const filled = palaces.filter((p)=>p.env);
	const goodN = filled.filter((p)=>p.jx === 'good').length;
	const badN = filled.filter((p)=>p.jx === 'bad').length;
	const ju = !filled.length ? { key: 'none', text: '未录八方环境——合局/反局须以形势实况判定', jx: 'neutral' }
		: badN === 0 && goodN > 0 ? { key: 'he', text: DAXUANKONG_JU_TEXT.he, jx: 'good' }
			: badN > goodN ? { key: 'fan', text: `${DAXUANKONG_JU_TEXT.fan}——${DAXUANKONG_JU_TEXT.fanWarn}`, jx: 'bad' }
				: { key: 'mixed', text: `合${goodN}·反${badN}，吉凶参半，取用须以峦头轻重定夺`, jx: 'neutral' };

	const zuoP = palaces.find((p)=>p.isZuo) || null;
	const xiangP = palaces.find((p)=>p.isXiang) || null;

	return {
		available: true, isDaxuankong: true,
		zuoShan, zuoGong, zuoGua: zuoGong ? GONG_GUA[zuoGong] : null,
		xiangGong, xiangGua: xiangGong ? GONG_GUA[xiangGong] : null,
		yun: Math.trunc(Number(yun)), yunRange: YUN_YEARS[Math.trunc(Number(yun))] || null,
		wuYunHalf: Math.trunc(Number(yun)) === 5 ? wuYunHalf : null,
		yuan, yuanLabel: DAXUANKONG_YUAN_LABEL[yuan],
		zhaiType, center, centerNature: nature, forward,
		zhengStars: DAXUANKONG_ZHENGLING[yuan].zheng, lingStars: DAXUANKONG_ZHENGLING[yuan].ling,
		palaces, zuo: zuoP, xiang: xiangP, ju, goodN, badN,
		wuHuangUnknown: !!nature.unknown, wuHuangNote: nature.unknown ? DAXUANKONG_WUHUANG_NOTE : null,
		year: year || null,
		duanying: DAXUANKONG_DUANYING,
		note: DAXUANKONG_NOTE,
	};
}

export default daxuankong;
