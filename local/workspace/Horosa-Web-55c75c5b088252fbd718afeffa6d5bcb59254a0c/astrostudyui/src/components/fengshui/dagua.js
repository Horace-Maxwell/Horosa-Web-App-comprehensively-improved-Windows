// 玄空大卦（三元易卦派 · 六十四卦）· 框架版（正统体系）。
// 64卦识别(6.7) + 零正收山出煞(6.3) + 卦气合十/合十五(6.4) + 真假夫妇(6.10) + 三般卦(6.9)。
// 🔴 逐卦「卦运」各门派秘授有别、须以实体三元易盘为准(6.8)：做成 结构推定 / 用户输入 两方案，不臆造单一表。
import { gua64Of, gua64AtDeg, GUAYUN_PAIRS, GUAYUN_YUAN } from './liqiCore';
import {
	ERYUAN_8YUN, eryuanAt, eryuanZhengLing, ERYUAN_NOTE,
	XINGYUN_MAP, HOUTIAN_WEI, GUA8_LUOSHU, xiangJianOf,
	jiaotongWuxing, jiaotongGuayun, jiaotongQinyuan, jiaotongDajie,
	JIAOTONG_5, DAGUA_DEEP_NOTE, GUA8_BIN3,
} from './fengshuiDaguaDeepData';

// 六爻二进制（初→上）与卦名互转，供些子法抽爻换象。
const GUA8_BY_BIN = (()=>{ const m = {}; Object.keys(GUA8_BIN3).forEach((g)=>{ m[GUA8_BIN3[g].join('')] = g; }); return m; })();
const linesOf = (lower, upper)=>GUA8_BIN3[lower].concat(GUA8_BIN3[upper]);
const guaFromLines = (a)=>({ lower: GUA8_BY_BIN[a.slice(0, 3).join('')], upper: GUA8_BY_BIN[a.slice(3).join('')] });
// 抽第 n 爻（1..6，自初爻起数）：该爻阴阳互换。
function chouYaoAt(lower, upper, n) {
	const i = Math.trunc(Number(n)) - 1;
	if (!(i >= 0 && i <= 5)) { return { lower, upper }; }
	const a = linesOf(lower, upper); a[i] = a[i] ? 0 : 1;
	return guaFromLines(a);
}
// 一卦四数：先天卦气(上卦洛书数)/先天卦位(下卦洛书数)/星运(卦运)/后天卦位。
function siShuOf(lower, upper) {
	const g = gua64Of(lower, upper);
	if (!g) { return null; }
	const xy = XINGYUN_MAP[g.name] || null;
	const hw = HOUTIAN_WEI[g.name] || null;
	return {
		name: g.name, lower, upper,
		xianTianQi: GUA8_LUOSHU[upper],        // 先天卦气＝玄空五行
		xianTianWei: GUA8_LUOSHU[lower],
		xingYun: xy ? xy.yun : null, xingYunCls: xy ? xy.cls : null, xingYunFrom: xy ? xy.from : null,
		houTianWei: hw ? hw.num : null, gong: hw ? hw.gong : null,
	};
}
// 两卦交通全判（五行/卦运/亲缘/打劫/后天卦位）。
function jiaoTongPair(a, b, label) {
	if (!a || !b) { return null; }
	const wuxing = jiaotongWuxing(a.xianTianQi, b.xianTianQi);
	const guayun = jiaotongGuayun(a.xingYun, b.xingYun);
	const qinyuan = jiaotongQinyuan(a.name, b.name);
	const dajie = jiaotongDajie(a.name, b.name);
	const houtian = xiangJianOf(a.houTianWei, b.houTianWei);
	const okN = [wuxing, guayun, houtian].filter((x)=>x && x.jx === 'good').length
		+ [qinyuan, dajie].filter((x)=>x && x.jx === 'good').length;
	return { label, a: a.name, b: b.name, wuxing, guayun, qinyuan, dajie, houtian, okN };
}

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
export function dagua({ xiangLower = '乾', xiangUpper = '乾', yun = 9, yunScheme = 'struct', yunOverride = {}, xiangYunInput, zuoYunInput, deg,
	longLower = '', longUpper = '', chouYao = 0, year, showDeep = false } = {}) {
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

	// ── 深化层（additive；showDeep 关时下列一律为 null，缺省逐字段零回归）──────
	//   星运（卦运）在此层依传本生成规则逐卦推出，与上面的 structYun 是**两套并行口径**，
	//   互不覆盖：上面照旧出 xiangYun/zuoYun，此处另出 siShu.xingYun 供对照。
	let deep = null;
	if (showDeep) {
		const nChou = Math.trunc(Number(chouYao)) || 0;
		const hasLong = !!(longLower && longUpper && gua64Of(longLower, longUpper));
		// 山＝向之错卦、水＝龙之错卦（抽爻在四卦同位进行，错卦关系不变）。
		const pre = {
			xiang: { lower: xiangLower_, upper: xiangUpper_ },
			shan: { lower: INVERT[xiangLower_], upper: INVERT[xiangUpper_] },
			long: hasLong ? { lower: longLower, upper: longUpper } : null,
			shui: hasLong ? { lower: INVERT[longLower], upper: INVERT[longUpper] } : null,
		};
		const post = {};
		Object.keys(pre).forEach((k)=>{ post[k] = pre[k] ? (nChou ? chouYaoAt(pre[k].lower, pre[k].upper, nChou) : pre[k]) : null; });
		const sq = (o)=>(o ? siShuOf(o.lower, o.upper) : null);
		const before = { xiang: sq(pre.xiang), shan: sq(pre.shan), long: sq(pre.long), shui: sq(pre.shui) };
		const after = { xiang: sq(post.xiang), shan: sq(post.shan), long: sq(post.long), shui: sq(post.shui) };
		// 些子法三校：①讲雌雄(后天卦位夫妇正配/阴阳相见) ②求生旺(先天卦气与卦运对正神零神) ③龙山向水交通
		const zl = eryuanZhengLing(yun);
		const shengWang = (x)=>(x ? {
			name: x.name,
			qi: zl.zheng.indexOf(x.xianTianQi) >= 0 ? '正神(旺)' : (zl.ling.indexOf(x.xianTianQi) >= 0 ? '零神(衰)' : '—'),
			yun: x.xingYun == null ? '—'
				: (x.xingYun === 1 && zl.yuan === '下元' ? '一运卦在下元不旺亦不衰'
					: (x.xingYun === 9 && zl.yuan === '上元' ? '九运卦在上元不旺亦不衰'
						: (zl.zheng.indexOf(x.xingYun) >= 0 ? '正神(旺)' : (zl.ling.indexOf(x.xingYun) >= 0 ? '零神(衰)' : '—')))),
		} : null);
		const pairs = [jiaoTongPair(after.long, after.shan, '龙与山'), jiaoTongPair(after.xiang, after.shui, '向与水')].filter(Boolean);
		deep = {
			eryuan: { list: ERYUAN_8YUN, cur: year ? eryuanAt(year) : null, zhengLing: zl, note: ERYUAN_NOTE },
			siShu: { before, after, changed: nChou > 0 },
			chouYao: nChou,
			ciXiong: pairs.map((p)=>({ label: p.label, verdict: p.houtian })),
			shengWang: ['xiang', 'shan', 'long', 'shui'].map((k)=>({ role: k, ...(shengWang(after[k]) || {}) })).filter((x)=>x.name),
			jiaoTong: pairs, jiaoTongKinds: JIAOTONG_5,
			verdict: pairs.length
				? (pairs.every((p)=>p.okN >= 3) ? { text: `抽${nChou || 0}爻：龙山向水三校俱合，合些子法`, jx: 'good' }
					: (pairs.some((p)=>p.okN === 0) ? { text: `抽${nChou || 0}爻：有一路全不交通，雌雄不交`, jx: 'bad' }
						: { text: `抽${nChou || 0}爻：交通有合有不合，须逐条权衡`, jx: 'neutral' }))
				: { text: '未设来龙卦——些子法须龙山向水四卦俱全', jx: 'neutral' },
			note: DAGUA_DEEP_NOTE,
			luopanNote: '传本明言：罗盘所标可抽之爻与实算合法之爻未必一致，「罗盘内容不可尽信」——故本器以实算三校为准，罗盘标注仅供对照。',
			yaoXuNote: '爻序约定：本器「抽第 n 爻」＝自初爻起数、该爻阴阳互换。以传本算例（姤龙·复水·大过山·颐向）实算，'
				+ '恰在「抽二爻」得龙 6／山 7／向 8／水 2，与传本所载数字逐一相同，而传本称此结果为「抽三爻」；'
				+ '差异出在爻序称法，非判据不同 —— 按原书图示核对时请留意。',
		};
	}

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
		zhenFuFu, heShi, heShiWu, tongYuan, xiangDeLing, zuoDeLing, flags, deep,
		sanban: SANBAN_GROUPS,
		degPerGua: DEG_PER_GUA, degPerYao: DEG_PER_YAO,
		note: '🔴逐卦卦运须按实体三元易盘(门派秘授);本盘卦运='
			+ (yunScheme === 'input' ? '用户输入' : '结构推定(框架)') + '。零正收山出煞按元运可靠;识卦(6.7)确定。',
	};
}
