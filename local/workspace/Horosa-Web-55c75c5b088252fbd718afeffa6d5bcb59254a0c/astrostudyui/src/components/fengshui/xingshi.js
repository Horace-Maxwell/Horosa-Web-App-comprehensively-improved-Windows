// 形势派（峦头）判定清单（正统体系）· 龙穴砂水向五诀结构化勾选打分。无飞星盘，纯判定流程。
import {
	XINGSHI_9STAR, LONG_RUSHOU_5, LONG_5SHI, XUE_4TYPE, XUE_5STAR, DINGXUE_9, ZHENGXUE_10,
	DAOZHANG_12, SHA_NAMES, SHUICHENG_5, SHUI_12,
} from './fengshuiData';

// 参考表（供左栏清单渲染）。
export const XINGSHI_TABLES = {
	nineStar: XINGSHI_9STAR, ruShou: LONG_RUSHOU_5, wuShi: LONG_5SHI,
	xueType: XUE_4TYPE, xueStar: XUE_5STAR, dingXue: DINGXUE_9, zhengXue: ZHENGXUE_10,
	daoZhang: DAOZHANG_12, sha: SHA_NAMES, shuiCheng: SHUICHENG_5, shui: SHUI_12,
};

function grade(total) {
	if (total >= 7) { return { text: '龙真穴的·上吉之地', jx: 'good' }; }
	if (total >= 3) { return { text: '可用·平结吉地', jx: 'good' }; }
	if (total >= -1) { return { text: '平常/存疑·须细察', jx: 'neutral' }; }
	return { text: '龙虚砂凶水劫·不宜', jx: 'bad' };
}

// 形势判定：selections → 五诀分 + 综合。
//   sel: { longSheng, longStar, boHuan, guoXiaGood, ruShou, wuShi,
//          xueType, xueStar, zhengXue:[], daoZhang,
//          guiSha:[], xiongSha:[], shaYouQing,
//          shuiCheng, laiShuiKai, quShuiGuan,
//          xiangChaoJi, xiangChongSha }
export function xingshi(sel = {}) {
	const s = sel || {};
	const star = XINGSHI_9STAR.find((x)=>x.name === s.longStar) || null;
	const cheng = SHUICHENG_5.find((x)=>x.name === s.shuiCheng) || null;

	const longScore = (s.longSheng ? 2 : (s.longSheng === false ? -2 : 0))
		+ (star ? (star.jx === 'good' ? 2 : star.jx === 'bad' ? -2 : 0) : 0)
		+ (s.boHuan ? 1 : 0) + (s.guoXiaGood ? 1 : 0);
	// 定穴九法与穴形同权（各 +1），证穴十证按数计（封顶 3）。
	const xueScore = (s.xueType ? 1 : 0) + (s.dingXue ? 1 : 0) + (Array.isArray(s.zhengXue) ? Math.min(3, s.zhengXue.length) : 0);
	const shaScore = (Array.isArray(s.guiSha) ? Math.min(3, s.guiSha.length) : 0)
		- (Array.isArray(s.xiongSha) ? Math.min(3, s.xiongSha.length) : 0)
		+ (s.shaYouQing === true ? 1 : (s.shaYouQing === false ? -1 : 0));
	const shuiScore = (cheng ? (cheng.jx === 'good' ? 2 : cheng.jx === 'bad' ? -2 : 0) : 0)
		+ (s.laiShuiKai ? 1 : 0) + (s.quShuiGuan ? 1 : 0);
	const xiangScore = (s.xiangChaoJi ? 1 : 0) - (s.xiangChongSha ? 1 : 0);
	const total = longScore + xueScore + shaScore + shuiScore + xiangScore;

	const jxOf = (n)=>(n > 0 ? 'good' : n < 0 ? 'bad' : 'neutral');
	return {
		available: true,
		long: { score: longScore, jx: jxOf(longScore), star, ruShou: s.ruShou || null, wuShi: s.wuShi || null, sheng: s.longSheng },
		xue: { score: xueScore, jx: jxOf(xueScore), type: s.xueType || null, star: s.xueStar || null, dingXue: s.dingXue || null, zhengCount: (s.zhengXue || []).length, daoZhang: s.daoZhang || null },
		sha: { score: shaScore, jx: jxOf(shaScore), gui: s.guiSha || [], xiong: s.xiongSha || [], youQing: s.shaYouQing },
		shui: { score: shuiScore, jx: jxOf(shuiScore), cheng, laiKai: !!s.laiShuiKai, quGuan: !!s.quShuiGuan },
		xiang: { score: xiangScore, jx: jxOf(xiangScore), chaoJi: !!s.xiangChaoJi, chongSha: !!s.xiangChongSha },
		total, grade: grade(total),
		note: '峦头为体·理气为用;龙穴砂水向逐纲打分,配九星形体/倒杖十二法(参考表)综合定真结',
	};
}
