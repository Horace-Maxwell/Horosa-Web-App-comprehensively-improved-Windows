// 三合派 · 双山五行 + 十二长生四大局水法 + 立向收水 + 黄泉八煞 + 拨砂五格 + 线法(穿山透地分金) + 老三合纳音。
// 长生四局表移植 golden(golden 基准);十二向由长生环反推(5.9);黄泉(5.5)/拨砂(5.11)/线法(5.12-14)/老三合(5.15)。
import {
	sanheChangshengTable, sanheStageAt, sanheXiangFaAll,
	huangquanBaYao, huangquanSiDa, boshaWuGe,
	chuanshanAt, toudiAt, fenjinAt, nayinOf,
} from './liqiCore';
import { SANHE_STAGE_JX, SANHE_SHUANGSHAN, SHAN_24, GONG_GUA, ZHI_CHONG, ZHI_SANHE_JU } from './fengshuiData';

// 四大局：由水口(去水方/墓库)定局。火局墓戌·金局墓丑·水局墓辰·木局墓未。
const SHUIKOU_JU = {
	火局: ['辛', '戌', '乾'], 金局: ['癸', '丑', '艮'],
	水局: ['乙', '辰', '巽'], 木局: ['丁', '未', '坤'],
};
const JU_LIST = ['火局', '金局', '水局', '木局'];
const JU_WUXING = { 火局: '火', 金局: '金', 水局: '水', 木局: '木' };
// 后天八卦正五行（拨砂：砂以其所落之卦正五行论）。
const GUA_WUXING = { 坎: '水', 坤: '土', 震: '木', 巽: '木', 离: '火', 兑: '金', 乾: '金', 艮: '土' };
const GUA8 = ['坎', '坤', '震', '巽', '乾', '兑', '艮', '离'];
const ZHI_OF_SHUANGSHAN = (()=>{ const m = {}; Object.keys(SANHE_SHUANGSHAN).forEach((z)=>{ m[SANHE_SHUANGSHAN[z]] = z; }); return m; })();

// 水口 → 局（落墓库组）。
export function juByShuiKou(shuiKou) {
	for (const ju of JU_LIST) { if (SHUIKOU_JU[ju].indexOf(shuiKou) >= 0) { return ju; } }
	return null;
}

// 双山 → 坐山卦（取双山之支所在后天宫之卦）。
function guaOfShuangshan(shuangshan) {
	if (!shuangshan) { return null; }
	const zhi = shuangshan.slice(-1);
	const meta = SHAN_24[zhi];
	return meta ? GONG_GUA[meta[0]] : null;
}

// 三合排盘：水口定局 → 24 山长生环 + 十二向 + 黄泉 + 拨砂 + 线法 + 老三合。
//   shuiKou 去水方山名;waterFlow 左水倒右→旺向/右水倒左→生向;
//   xiangFaType 显式立向法(覆盖 waterFlow);zuoDeg 坐山度数(线法/老三合);sands 八方砂{卦:sand|water|flat};boshaVariant 消砂法。
export function sanhe({ shuiKou, waterFlow, xiangFaType, zuoDeg, sands = {}, boshaVariant = 'shuangshan' } = {}) {
	const ju = shuiKou ? juByShuiKou(shuiKou) : null;
	const table = sanheChangshengTable();
	let ring = null;
	if (ju) {
		ring = table.map((r)=>({ shuangshan: r.shuangshan, zhi: r.zhi, stage: r[ju], jx: SANHE_STAGE_JX[r[ju]] }));
	}

	// ── 十二向（八法）全（5.9）：由长生环反推每向法之向双山 ──
	const xiangFaAll = ju ? sanheXiangFaAll(ring) : [];
	// 选定立向：显式 xiangFaType 优先;否则 waterFlow(左水倒右→正旺、右水倒左→正生)。
	const defType = waterFlow === 'rightToLeft' ? '正生向' : '正旺向';
	const useType = xiangFaType || defType;
	const selected = xiangFaAll.find((x)=>x.type === useType) || null;
	// 兼容旧返回:xiangFa 保留 {type, shuangshan, note}。
	const xiangFa = selected ? { type: selected.type, shuangshan: selected.shuangshan, stage: selected.stage, note: selected.note } : null;

	// ── 黄泉八煞（5.5）：立向后校八曜煞(坐卦)+四大黄泉(向干) ──
	let huangquan = null;
	if (selected && selected.shuangshan) {
		const xiangZhi = selected.shuangshan.slice(-1);
		const zuoZhi = ZHI_CHONG[xiangZhi];
		const zuoGua = guaOfShuangshan(SANHE_SHUANGSHAN[zuoZhi]);
		const baYaoZhi = zuoGua ? huangquanBaYao(zuoGua) : null;   // 坐卦忌方支
		const siDa = selected.shuangshan.split('').map((s)=>({ shan: s, ji: huangquanSiDa(s) })).filter((x)=>x.ji);
		huangquan = {
			zuoGua, zuoShuangshan: SANHE_SHUANGSHAN[zuoZhi],
			baYao: baYaoZhi ? { zuoGua, jiFang: baYaoZhi, text: `坐${zuoGua}忌${baYaoZhi}方见水来/路冲/恶砂(八曜煞大凶)` } : null,
			siDa: siDa.length ? siDa.map((x)=>({ xiang: x.shan, jiFang: x.ji, text: `向${x.shan}忌${x.ji}方水去(四大黄泉，去水大凶/来水或救贫)` })) : null,
		};
	}

	// ── 拨砂五格（5.11）：以「我」之五行量八方砂卦正五行论生克。
	//    「我」取法两说（古法并陈）：shuangshan＝以向双山三合五行（默认，通行）；zuo＝以坐山（向之对宫）五行。
	let bosha = null;
	if (selected && selected.shuangshan) {
		const xiangZhi = selected.shuangshan.slice(-1);
		const myZhi = boshaVariant === 'zuo' ? (ZHI_CHONG[xiangZhi] || xiangZhi) : xiangZhi;
		const myWuxing = ZHI_SANHE_JU[myZhi] || (ju ? JU_WUXING[ju] : null);
		bosha = {
			myWuxing, boshaVariant, myZhi, myFrom: boshaVariant === 'zuo' ? '坐山' : '向',
			sands: GUA8.map((g)=>{
				const actual = sands[g] || 'flat';
				if (actual !== 'sand') { return { gua: g, actual, wuGe: null }; }
				const wg = boshaWuGe(myWuxing, GUA_WUXING[g]);
				return { gua: g, actual, shaWuxing: GUA_WUXING[g], wuGe: wg };
			}),
		};
	}

	// ── 线法（5.12-14）+ 老三合纳音（5.15）：需坐山度数 ──
	let xianfa = null; let laosanhe = null;
	if (zuoDeg != null && zuoDeg !== '' && !Number.isNaN(Number(zuoDeg))) {
		const cs = chuanshanAt(zuoDeg); const td = toudiAt(zuoDeg); const fj = fenjinAt(zuoDeg);
		xianfa = { zuoDeg: Number(zuoDeg), chuanshan: cs, toudi: td, fenjin: fj };
		// 老三合纳音：坐山纳音(取透地龙干支纳音)五行 → 辅断。
		if (td && td.nayin) {
			laosanhe = { zuoNayin: td.nayin.name, zuoNayinWuxing: td.nayin.wuxing, note: `坐山纳音「${td.nayin.name}」属${td.nayin.wuxing}(纳音三合辅断，配水之纳音生克)` };
		}
	}

	return {
		available: !!ju, shuiKou, ju, juWuXing: ju ? JU_WUXING[ju] : null,
		ring, table,
		xiangFa, xiangFaAll, selectedType: useType,
		huangquan, bosha, xianfa, laosanhe,
		note: ju ? `水口落「${shuiKou}」属${ju}(墓库定局)` : '未定局(请选去水方/水口)',
	};
}

export { sanheStageAt, ZHI_OF_SHUANGSHAN };
