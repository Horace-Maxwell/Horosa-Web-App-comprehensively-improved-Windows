// 形势派（峦头）判定清单（正统体系）· 龙穴砂水向五诀结构化勾选打分。无飞星盘，纯判定流程。
import {
	XINGSHI_9STAR, LONG_RUSHOU_5, LONG_5SHI, XUE_4TYPE, XUE_5STAR, DINGXUE_9, ZHENGXUE_10,
	DAOZHANG_12, SHA_NAMES, SHUICHENG_5, SHUI_12,
} from './fengshuiData';
import {
	DINGXUE_13, ZHENGXUE_13, SISHA_4, SANSHI_XUE, JIUXING_BIANXUE_8, JIEXUE_5JU, GUAIXUE_8, ZHENXUE_3,
	MINGTANG_JI_9, MINGTANG_XIONG_9, MINGTANG_4YAO, LONGHU_DUAN_15, LONGHU_6JI, LONGHU_BUCHANG,
	SHUIKOU_5SHA, SHUIKOU_3GUAN, SHUI_5JU, SHUICHENG_SUB, SANHE_SANTANG, QIANPANGHOU_HE,
	SHUI_4ZHONG, YUANCHEN_10ZI, ZIRAN_SHUIFA, SHANXUE_4JI, LINTOU_FANGFEN, ZHIJIAO_4GE, KAIZHANG_3,
	GUOXIA_4, HEXING_41, LONG_ERFEN, SHA_XING_3DUI, ANSHAN_RULES, CHAOSHAN_2, GUILEGUANYAO,
	JIUXING_BIANTI, XUNXUE_QIAOMEN, SANDA_GANLONG, LONGMAI_CHAIN, TAIXI_YUNYU, ZHENJIA_LONG,
	SHUIFA_WEIGHT, CHAOSHAN_WEIGHT,
} from './fengshuiXingshiData';

// 参考表（供左栏清单渲染）。
export const XINGSHI_TABLES = {
	nineStar: XINGSHI_9STAR, ruShou: LONG_RUSHOU_5, wuShi: LONG_5SHI,
	xueType: XUE_4TYPE, xueStar: XUE_5STAR, dingXue: DINGXUE_9, zhengXue: ZHENGXUE_10,
	daoZhang: DAOZHANG_12, sha: SHA_NAMES, shuiCheng: SHUICHENG_5, shui: SHUI_12,
	// 九纲口径新增（古籍另一路枚举，与上列并存不合并）。
	dingXue13: DINGXUE_13, zhengXue13: ZHENGXUE_13, sisha: SISHA_4, sanshiXue: SANSHI_XUE,
	bianXue8: JIUXING_BIANXUE_8, jieXue5: JIEXUE_5JU, guaiXue8: GUAIXUE_8, zhenXue3: ZHENXUE_3,
	mingtangJi: MINGTANG_JI_9, mingtangXiong: MINGTANG_XIONG_9, mingtang4: MINGTANG_4YAO,
	longhuDuan: LONGHU_DUAN_15, longhu6ji: LONGHU_6JI,
	shuikou5: SHUIKOU_5SHA, shuikou3guan: SHUIKOU_3GUAN,
	shui5ju: SHUI_5JU, shuichengSub: SHUICHENG_SUB, santang: SANHE_SANTANG, qphHe: QIANPANGHOU_HE,
	shui4zhong: SHUI_4ZHONG, yuanchen10: YUANCHEN_10ZI, ziranShuifa: ZIRAN_SHUIFA,
	shanxue4ji: SHANXUE_4JI, lintou: LINTOU_FANGFEN,
	zhijiao4: ZHIJIAO_4GE, kaizhang3: KAIZHANG_3, guoxia4: GUOXIA_4, hexing: HEXING_41,
	longErfen: LONG_ERFEN, shaXing3: SHA_XING_3DUI, anshan: ANSHAN_RULES, chaoshan2: CHAOSHAN_2,
	guileguanyao: GUILEGUANYAO, jiuxingBianti: JIUXING_BIANTI, xunxue: XUNXUE_QIAOMEN,
	sandaGanlong: SANDA_GANLONG, longmaiChain: LONGMAI_CHAIN, taixi: TAIXI_YUNYU,
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

	const jxOf = (n)=>(n > 0 ? 'good' : n < 0 ? 'bad' : 'neutral');
	const base = {
		available: true,
		long: { score: longScore, jx: jxOf(longScore), star, ruShou: s.ruShou || null, wuShi: s.wuShi || null, sheng: s.longSheng },
		xue: { score: xueScore, jx: jxOf(xueScore), type: s.xueType || null, star: s.xueStar || null, dingXue: s.dingXue || null, zhengCount: (s.zhengXue || []).length, daoZhang: s.daoZhang || null },
		sha: { score: shaScore, jx: jxOf(shaScore), gui: s.guiSha || [], xiong: s.xiongSha || [], youQing: s.shaYouQing },
		shui: { score: shuiScore, jx: jxOf(shuiScore), cheng, laiKai: !!s.laiShuiKai, quGuan: !!s.quShuiGuan },
		xiang: { score: xiangScore, jx: jxOf(xiangScore), chaoJi: !!s.xiangChaoJi, chongSha: !!s.xiangChongSha },
	};

	// 🔴 零回归闸：不显式传 scoreMode:'nine' 时，输出与九纲版落地前逐字节相同
	//    （形势图判工作台等既有消费方不受影响；其零回归锚测试守之）。
	if (s.scoreMode !== 'nine') {
		const total = longScore + xueScore + shaScore + shuiScore + xiangScore;
		return { ...base, total, grade: grade(total),
			note: '峦头为体·理气为用;龙穴砂水向逐纲打分,配九星形体/倒杖十二法(参考表)综合定真结' };
	}
	return nineGang(s, base, jxOf);
}

// ── 九纲口径（古籍全参）──────────────────────────────────────────────────────
// 在五诀之外另立四纲：明堂 / 龙虎 / 水口 / 太极(穴证)，并施三条古籍权重调制。
function grade9(total) {
	if (total >= 12) { return { text: '龙真穴的·上格大地', jx: 'good' }; }
	if (total >= 6) { return { text: '合法可用·中格吉地', jx: 'good' }; }
	if (total >= 1) { return { text: '小结可用·须细察取裁', jx: 'neutral' }; }
	if (total >= -3) { return { text: '平常存疑·非真结', jx: 'neutral' }; }
	return { text: '龙虚砂凶水劫·不宜', jx: 'bad' };
}

function nineGang(s, base, jxOf) {
	// —— 明堂纲：吉九格 +2 / 凶九格 −2；四要求各 +1（封顶 4）。
	const mtJi = MINGTANG_JI_9.find((x)=>x.name === s.mingtangJi) || null;
	const mtXiong = MINGTANG_XIONG_9.find((x)=>x.name === s.mingtangXiong) || null;
	const mt4 = Array.isArray(s.mingtang4) ? s.mingtang4.filter((k)=>MINGTANG_4YAO.some((y)=>y.name === k)) : [];
	const mingtangScore = (mtJi ? 2 : 0) - (mtXiong ? 2 : 0) + Math.min(4, mt4.length);

	// —— 龙虎纲：《龙虎断》形态断语 ±2；六忌每中一条 −1（封顶 −3）；缺失补偿救回 +1。
	const lhDuan = LONGHU_DUAN_15.find((x)=>x.xing === s.longhuXing) || null;
	const lhJi = Array.isArray(s.longhu6ji) ? s.longhu6ji.filter((k)=>LONGHU_6JI.indexOf(k) >= 0) : [];
	const lhBuchang = !!s.longhuBuchang;      // 无龙水饶左 / 无虎水归右
	const longhuScore = (lhDuan ? (lhDuan.jx === 'good' ? 2 : lhDuan.jx === 'bad' ? -2 : 0) : 0)
		- Math.min(3, lhJi.length) + (lhBuchang ? 1 : 0);

	// —— 水口纲：五砂 +2（罗星/北辰/华表/捍门/鱼袋玉印禽星）；三关每重 +1（封顶 3）；关锁不成 −2。
	const skSha = SHUIKOU_5SHA.find((x)=>x.name === s.shuikouSha) || null;
	const skGuan = Array.isArray(s.shuikouGuan) ? s.shuikouGuan.filter((k)=>SHUIKOU_3GUAN.indexOf(k) >= 0) : [];
	const skLock = s.shuikouLock;             // true=关锁紧闭 / false=旷荡不关 / null=未定
	const shuikouScore = (skSha ? 2 : 0) + Math.min(3, skGuan.length)
		+ (skLock === true ? 1 : (skLock === false ? -2 : 0));

	// —— 太极纲（穴证）：证穴十三法命中数（主法 +1/条，特法 +0.5 折半计入，封顶 5）；
	//    定穴十三法 +1；结穴局势 +1；怪穴按扦法可取 +1；否决条款各 −2。
	const zx13 = Array.isArray(s.zhengXue13) ? s.zhengXue13.filter((k)=>ZHENGXUE_13.some((z)=>z.key === k || z.name === k)) : [];
	const zxMain = zx13.filter((k)=>ZHENGXUE_13.some((z)=>(z.key === k || z.name === k) && z.main)).length;
	const zxSpec = zx13.length - zxMain;
	const dx13 = DINGXUE_13.find((x)=>x.name === s.dingXue13) || null;
	const jieJu = JIEXUE_5JU.indexOf(s.jieXueJu) >= 0 ? s.jieXueJu : null;
	const guaiXue = GUAIXUE_8.find((x)=>x.name === s.guaiXue) || null;
	const vetoList = [];
	if (s.mingtangQingxie === true) { vetoList.push('明堂倾泻倒侧·真气不融必无好穴'); }
	if (s.fenHe === false) { vetoList.push('有合无分/有分无合·非富贵之穴'); }
	if (s.chunZhan === false) { vetoList.push('真龙结穴必有唇毡·今无'); }
	if (s.dixinQue === true) { vetoList.push('地心十道四应有空缺'); }
	const taijiScore = Math.min(5, zxMain + zxSpec * 0.5) + (dx13 ? 1 : 0) + (jieJu ? 1 : 0)
		+ (guaiXue ? 1 : 0) - vetoList.length * 2;

	// ── 三条古籍权重调制 ──────────────────────────────────────────────────
	const mods = [];
	// ① 真假龙覆盖：辨别关键在入首近穴数节；入首不合格＝假龙，纵远龙美亦无穴。
	let longScore = base.long.score;
	let capped = false;
	if (s.ruShouGe === false) {
		mods.push({ key: 'jiaLong', text: `${ZHENJIA_LONG.cases[1].when} → ${ZHENJIA_LONG.cases[1].then}；${ZHENJIA_LONG.text}`, jx: 'bad' });
		longScore = Math.min(longScore, -2);
		capped = true;
	} else if (s.ruShouGe === true) {
		mods.push({ key: 'zhenLong', text: `${ZHENJIA_LONG.cases[0].when} → ${ZHENJIA_LONG.cases[0].then}`, jx: 'good' });
		longScore += 2;
	}
	// ② 砂受龙格调制：龙贱则砂虽贵反为凶；龙贵则砂贱亦不为凶（砂不可独立计分）。
	let shaScore = base.sha.score;
	const longGrade = s.longGuiJian;          // 'gui' | 'jian' | null
	if (longGrade === 'jian' && shaScore > 0) {
		mods.push({ key: 'shaByLong', text: '龙贱若还砂遇贵，反变为凶具 → 砂之吉分不予计入', jx: 'bad' });
		shaScore = -Math.abs(shaScore);
	} else if (longGrade === 'gui' && shaScore < 0) {
		mods.push({ key: 'shaByLong', text: '砂贱若还遇贵龙，砂亦不为凶 → 砂之凶分归零', jx: 'good' });
		shaScore = 0;
	}
	// ③ 朝山权重低于龙穴：龙真穴的无朝亦贵（无案朝但逆水朝入/堂有聚水则豁免）。
	let xiangScore = base.xiang.score;
	if (s.wuAnChao === true) {
		if (s.niShuiOrJuShui === true) {
			mods.push({ key: 'wuAnMianZe', text: ANSHAN_RULES.mianze, jx: 'neutral' });
		} else {
			mods.push({ key: 'wuAnChao', text: `${CHAOSHAN_WEIGHT}（无案无朝且无逆水聚水 → 向纲减分）`, jx: 'bad' });
			xiangScore -= 1;
		}
	}

	const total = longScore + base.xue.score + shaScore + base.shui.score + xiangScore
		+ mingtangScore + longhuScore + shuikouScore + taijiScore;

	return {
		...base,
		scoreMode: 'nine',
		long: { ...base.long, score: longScore, jx: jxOf(longScore), guiJian: longGrade || null, ruShouGe: s.ruShouGe, capped },
		sha: { ...base.sha, score: shaScore, jx: jxOf(shaScore) },
		xiang: { ...base.xiang, score: xiangScore, jx: jxOf(xiangScore) },
		mingtang: { score: mingtangScore, jx: jxOf(mingtangScore), ji: mtJi, xiong: mtXiong, yao: mt4 },
		longhu: { score: longhuScore, jx: jxOf(longhuScore), duan: lhDuan, ji: lhJi, buchang: lhBuchang, buchangText: lhBuchang ? LONGHU_BUCHANG.join('；') : null },
		shuikou: { score: shuikouScore, jx: jxOf(shuikouScore), sha: skSha, guan: skGuan, lock: skLock },
		taiji: { score: taijiScore, jx: jxOf(taijiScore), zhengCount: zx13.length, zhengMain: zxMain, zhengSpec: zxSpec,
			dingXue: dx13, jieJu, guaiXue, veto: vetoList },
		modulation: mods,
		total, grade: grade9(total),
		weightNote: SHUIFA_WEIGHT,
		note: '九纲口径：龙穴砂水向 + 明堂龙虎水口太极；砂受龙格调制、入首定真假龙、朝山权重低于龙穴（古籍权重规则，非线性叠加）',
	};
}
