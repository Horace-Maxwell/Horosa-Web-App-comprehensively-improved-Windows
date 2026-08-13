// 阳宅判断与选择 · 三方合参引擎（峦头断 / 理气断 / 客星断）。
// 🔴 合参之序：形、气为主，客星为用 —— 客星须以「形气」为主体方产生吉凶，
//    只凭流年九星飞临就断吉凶是片面做法。故客星段恒标注此告诫，且不单独出总断。
// 🔴 本派不改任何既有引擎之判：飞星盘照 xuankong 取，年神照 zeri 取。
import {
	WAI_LIUSHI_YAO, ZHAI_XING_8, XIONGGE_10, WAI_JU_6, NEI_JU_5, NEI_JU_NOTE,
	NEIWAI_4, NEIWAI_NOTE, DUAN_3, KEXING_JUE, KEXING_ZHUCI, KEXING_SHENGKE, KEXING_ZHUCI2,
	WUHUANG_RULE, TAISUI_RULE, FEITAISUI_RULE, FEITAISUI_HOW, TESHU_XINGSHI,
	XUANZHAI_5, BIKAI_CHANGSUO_10, NEIJU_XINGXING_10, NEIJU_LIQI_2, ZHAIDUAN_NOTE,
} from './fengshuiZhaiduanData';
import { xuankong } from './xuankong';
import { yearGods } from './zeri';
import { zibaiYearCenter } from './liqiCore';
import { POS_NAME, GONG_GUA, ZHI_TO_GONG, ZIBAI_STAR } from './fengshuiData';
import { neijuDetect } from './neijuGeometry';

const GONG8 = [1, 2, 3, 4, 6, 7, 8, 9];
const OPP = { 1: 9, 9: 1, 2: 8, 8: 2, 3: 7, 7: 3, 4: 6, 6: 4 };
const flyStar = (center)=>{ const pan = {}; const f = (n)=>(n - 5 + 9) % 9; for (let g = 1; g <= 9; g++) { pan[g] = (center - 1 + f(g)) % 9 + 1; } return pan; };

// 飞太岁：以流年地支所对之宫为数，取流年紫白盘中「该数」所飞到的宫位。
//   古籍算例：2013 癸巳（巳属巽宫数四，五黄入中，四绿到巽）→ 巽宫；2014 甲午 → 坎宫；2015 乙未 → 巽宫。
export function feiTaiSui(year, yearZhi) {
	const y = Math.trunc(Number(year));
	if (!y || !yearZhi || !ZHI_TO_GONG[yearZhi]) { return null; }
	const num = ZHI_TO_GONG[yearZhi];                 // 流年地支所对之宫 → 数
	const pan = flyStar(zibaiYearCenter(y));
	let gong = null;
	for (let g = 1; g <= 9; g++) { if (pan[g] === num) { gong = g; break; } }
	if (!gong) { return null; }
	return {
		year: y, zhi: yearZhi, num, gong, dir: POS_NAME[gong] || '中',
		gua: GONG_GUA[gong], star: ZIBAI_STAR[num],
		text: `${yearZhi}属${GONG_GUA[num]}宫数${num}，${y}年${ZIBAI_STAR[num]}到${POS_NAME[gong] || '中宫'}，即飞太岁临方`,
		rule: FEITAISUI_RULE, how: FEITAISUI_HOW,
	};
}

const isSheng = (star, yun)=>(star === yun || star === ((yun % 9) + 1) || star === (((yun + 1) % 9) + 1));

// 阳宅判断主入口。
//   外局：waiJu = { [gong]: 'shan'|'shui'|'' }（该方为高起之物 / 属水之物）；qiaoGong=峤星所在宫。
//   内局：neiJu = { menhu, wofang, chufang, keting, yuce } 各为宫号（0=未定）。
//   凶格：xiongGe=[key]；室内凶局：neiXiong={ [条key]: [原子项索引] }。
//   客星：year（出年神、飞太岁）。
//   几何：geo={ rect, outline, markers, gongAt }（画布户型图，可选）——
//     🔴 只出**建议**，绝不并入 neiXiong、绝不计入 neiBad、绝不动总断。
//     理由同图像分析一贯口径：机器所见不能替人下判，须用户逐条过目认可（一键采纳后方计入）。
//     不传 geo 时全链恒等于未加此功能之前（新增项一律走此闸）。
export function zhaiduan({
	xiangShan = '', yun = 9, palaces: palacesIn = null,
	waiJu = {}, qiaoGong = 0, neiJu = {}, xiongGe = [], neiXiong = {}, year = null,
	isCity = true, geo = null,
} = {}) {
	let pan = null; let xk = null;
	if (Array.isArray(palacesIn) && palacesIn.length) { pan = palacesIn; }
	else if (xiangShan) { xk = xuankong(yun, xiangShan, {}); pan = (xk && xk.available) ? xk.palaces : null; }
	const at = (g)=>(pan ? pan.find((x)=>x.gong === g) : null) || null;
	const wj = (waiJu && typeof waiJu === 'object') ? waiJu : {};
	const nj = (neiJu && typeof neiJu === 'object') ? neiJu : {};
	const nx = (neiXiong && typeof neiXiong === 'object') ? neiXiong : {};

	// ── ① 峦头断：凶格图解逐条 ──
	const ge = (Array.isArray(xiongGe) ? xiongGe : [])
		.map((k)=>XIONGGE_10.find((x)=>x.key === k)).filter(Boolean);

	// ── ② 理气断 · 外局：高起之物应在山星生旺方、属水之物应在向星生旺方 ──
	const waiRows = GONG8.map((g)=>{
		const kind = wj[g] || '';
		if (kind !== 'shan' && kind !== 'shui') { return null; }
		const p = at(g);
		if (!p) { return { gong: g, dir: POS_NAME[g], kind, ok: null, text: '未排盘，无法判生旺' }; }
		const star = kind === 'shan' ? p.shan : p.xiang;
		const ok = isSheng(star, yun);
		return {
			gong: g, dir: POS_NAME[g], gua: GONG_GUA[g], kind, star, ok,
			text: kind === 'shan'
				? `高起之物在${POS_NAME[g]}，山星${star}${ok ? '生旺——合收山' : '衰死——不合收山'}`
				: `属水之物在${POS_NAME[g]}，向星${star}${ok ? '生旺——合出煞' : '衰死——不合出煞'}`,
		};
	}).filter(Boolean);
	// 峤星：回风返气强化**对宫**之气。
	let qiao = null;
	const qg = Math.trunc(Number(qiaoGong)) || 0;
	if (qg && GONG8.indexOf(qg) >= 0) {
		const here = at(qg); const there = at(OPP[qg]);
		const shanOk = here ? isSheng(here.shan, yun) : null;
		const xiangOk = there ? isSheng(there.xiang, yun) : null;
		qiao = {
			gong: qg, dir: POS_NAME[qg], oppGong: OPP[qg], oppDir: POS_NAME[OPP[qg]],
			shanStar: here ? here.shan : null, oppXiangStar: there ? there.xiang : null,
			shanOk, xiangOk,
			verdict: (shanOk === null || xiangOk === null) ? { text: '未排盘，无法判峤星', jx: 'neutral' }
				: (shanOk && xiangOk ? { text: '峤星在山星生旺方、对宫又是向星生旺方——最吉', jx: 'good' }
					: (!shanOk && !xiangOk ? { text: '峤星在山星衰死方、对宫向星亦不当令——凶', jx: 'bad' }
						: { text: '峤星一合一不合，须参其远近细酌', jx: 'neutral' })),
			note: `${GONG_GUA[qg]}宫有峤星，回风返气强化对宫${GONG_GUA[OPP[qg]]}之气；是否回风返气还要看峤星远近。`,
		};
	}

	// ── ③ 理气断 · 内局：内六事逐事 ──
	const neiRows = NEI_JU_5.map((n)=>{
		const g = Math.trunc(Number(nj[n.key])) || 0;
		if (!g || GONG8.indexOf(g) < 0) { return { ...n, gong: null, ok: null, verdict: '未登记方位' }; }
		const p = at(g);
		if (!p) { return { ...n, gong: g, dir: POS_NAME[g], ok: null, verdict: '未排盘，无法判' }; }
		const shanOk = isSheng(p.shan, yun); const xiangOk = isSheng(p.xiang, yun);
		let ok = null; let verdict = '';
		if (n.key === 'menhu' || n.key === 'keting') { ok = xiangOk; verdict = `向星${p.xiang}${xiangOk ? '生旺·合' : '衰死·不合'}`; }
		else if (n.key === 'wofang') { ok = shanOk; verdict = `山星${p.shan}${shanOk ? '生旺·合' : '衰死·不合'}`; }
		else if (n.key === 'chufang') {
			ok = [3, 4, 8, 1].indexOf(p.shan) >= 0;
			verdict = `山星${p.shan}${ok ? '属木/土/一白·合' : '非木土一白·不合（忌金方火方与二黑五黄，二五运除外）'}`;
		} else {   // 浴厕：宜失令且组合不佳；忌生旺；尤忌一四、一六
			const pair = [p.shan, p.xiang].sort((a, b)=>a - b).join('');
			const wenchang = (pair === '14' || pair === '16');
			ok = !(shanOk || xiangOk) && !wenchang;
			verdict = wenchang ? `山向${p.shan}${p.xiang}为一四/一六——压制文昌，尤忌`
				: ((shanOk || xiangOk) ? `山${p.shan}向${p.xiang}尚在生旺——忌置浴厕` : `山${p.shan}向${p.xiang}失令·合`);
		}
		return { ...n, gong: g, dir: POS_NAME[g], gua: GONG_GUA[g], shan: p.shan, xiang: p.xiang, ok, verdict };
	});

	// ── ④ 室内凶局逐项 ──
	const neiXiongRows = NEIJU_XINGXING_10.concat(NEIJU_LIQI_2).map((c)=>{
		const picked = Array.isArray(nx[c.key]) ? nx[c.key].filter((i)=>c.atoms[i] != null) : [];
		if (!picked.length) { return null; }
		return { key: c.key, name: c.name, text: c.text, hits: picked.map((i)=>c.atoms[i]), n: picked.length,
			cls: NEIJU_LIQI_2.some((x)=>x.key === c.key) ? '理气不合' : '宅形不利' };
	}).filter(Boolean);
	const neiXiongN = neiXiongRows.reduce((a, x)=>a + x.n, 0);

	// ── ④b 几何自动检测（只出建议；已人工勾选者标为「已采纳」，不重复催促）──
	let geoScan = null;
	if (geo && typeof geo === 'object') {
		const zg = Math.trunc(Number(geo.zuoGong)) || (xk && xk.available ? (Math.trunc(Number(xk.gZuo)) || 0) : 0);
		const d = neijuDetect({ ...geo, zuoGong: zg });
		const rows = d.hits.map((h)=>{
			const c = NEIJU_XINGXING_10.find((x)=>x.key === h.key) || null;
			const taken = Array.isArray(nx[h.key]) && nx[h.key].indexOf(h.idx) >= 0;
			return { ...h, name: c ? c.name : h.key, taken };
		});
		geoScan = { ...d, rows, zuoGong: zg,
			newN: rows.filter((x)=>!x.taken).length, takenN: rows.filter((x)=>x.taken).length };
	}

	// ── ⑤ 内外局四象限 ──
	const waiOk = waiRows.filter((r)=>r.ok === true).length;
	const waiBad = waiRows.filter((r)=>r.ok === false).length + ge.length;
	const neiOk = neiRows.filter((r)=>r.ok === true).length;
	const neiBad = neiRows.filter((r)=>r.ok === false).length + neiXiongN;
	const innerGood = neiOk >= neiBad;
	const outerGood = waiOk >= waiBad;
	const quad = NEIWAI_4.find((q)=>q.inner === (innerGood ? 'good' : 'bad') && q.outer === (outerGood ? 'good' : 'bad')) || null;

	// ── ⑥ 客星断（形气为主，客星为用）──
	const yg = year ? yearGods(Number(year)) : null;
	const fts = yg ? feiTaiSui(Number(year), yg.yearZhi) : null;
	let keXing = null;
	if (yg) {
		const menGong = Math.trunc(Number(nj.menhu)) || 0;
		const wuAtMen = !!menGong && yg.wuHuang.gong === menGong;
		const taiAtMen = !!menGong && yg.taisui.gong === menGong;
		keXing = {
			year: yg.year, ganZhi: yg.yearGanZhi,
			taisui: yg.taisui, suipo: yg.suipo, wuHuang: yg.wuHuang, sansha: yg.sansha,
			feiTaiSui: fts,
			menGong: menGong || null, menDir: menGong ? POS_NAME[menGong] : null,
			wuAtMen, taiAtMen,
			menWarn: (wuAtMen && taiAtMen) ? { text: '太岁并五黄正临大门（动口）——灾不能免', jx: 'bad' }
				: (wuAtMen ? { text: '年五黄加临大门（动口）——多应灾', jx: 'bad' }
					: (taiAtMen ? { text: '太岁临大门（动口）——如有冲射主凶', jx: 'bad' }
						: (menGong ? { text: '大门未逢太岁或年五黄', jx: 'neutral' } : { text: '未登记入户门方位', jx: 'neutral' }))),
			jue: KEXING_JUE, shengKe: KEXING_SHENGKE,
			zhuCi: KEXING_ZHUCI, zhuCi2: KEXING_ZHUCI2,
			wuHuangRule: WUHUANG_RULE, taiSuiRule: TAISUI_RULE, teShu: TESHU_XINGSHI,
		};
	}

	// ── 总断（形气为主）──
	const verdict = !pan
		? { text: '未排盘——请先设向首与元运（客星只作用，不能单独定吉凶）', jx: 'neutral' }
		: (quad ? { text: `${quad.text}（外局合 ${waiOk} 违 ${waiBad}；内局合 ${neiOk} 违 ${neiBad}）`, jx: quad.jx }
			: { text: '未登记内外六事，无从合参', jx: 'neutral' });

	return {
		available: true, yun, xiangShan: xiangShan || null, hasPan: !!pan, isCity,
		ge, xiongGeAll: XIONGGE_10,
		waiRows, qiao, waiJuKinds: WAI_JU_6, waiYao: WAI_LIUSHI_YAO, zhaiXing8: ZHAI_XING_8,
		neiRows, neiJuNote: NEI_JU_NOTE,
		neiXiongRows, neiXiongN, neiXiongAll: NEIJU_XINGXING_10, neiXiongLiqi: NEIJU_LIQI_2, geoScan,
		quad, neiWaiNote: NEIWAI_NOTE, waiOk, waiBad, neiOk, neiBad,
		duan3: DUAN_3,
		// 首重向首：向首一星即向宫之向星（有盘才给）。
		xiangShou: (pan && xk && xk.available) ? {
			gong: xk.gXiang || null, dir: POS_NAME[xk.gXiang] || null,
			star: (at(xk.gXiang) || {}).xiang || null,
			deLing: (at(xk.gXiang) || {}) .xiang != null ? isSheng(at(xk.gXiang).xiang, yun) : null,
			ge: xk.ge || null,
		} : null,
		keXing, xuanZhai5: XUANZHAI_5, biKai10: BIKAI_CHANGSUO_10,
		verdict, note: ZHAIDUAN_NOTE,
	};
}

export default zhaiduan;
