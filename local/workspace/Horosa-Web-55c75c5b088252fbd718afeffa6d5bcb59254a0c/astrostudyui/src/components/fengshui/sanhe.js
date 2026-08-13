// 三合派 · 双山五行 + 十二长生四大局水法 + 立向收水 + 黄泉八煞 + 拨砂五格 + 线法(穿山透地分金) + 老三合纳音。
// 长生四局表移植 golden(golden 基准);十二向由长生环反推(5.9);黄泉(5.5)/拨砂(5.11)/线法(5.12-14)/老三合(5.15)。
import {
	sanheChangshengTable, sanheStageAt, sanheXiangFaAll,
	huangquanBaYao, huangquanSiDa, boshaWuGe, shanAtDeg,
	chuanshanAt, toudiAt, fenjinAt, nayinOf,
} from './liqiCore';
import { SANHE_STAGE_JX, SANHE_SHUANGSHAN, SHAN_24, GONG_GUA, ZHI_CHONG, ZHI_SANHE_JU,
	SHAN_CENTER_DEG, GONG_CENTER_DEG, HOUTIAN_POS } from './fengshuiData';
import { LAIGONG_BOSHA_WUXING, LAIGONG_BOSHA_SUBLABEL, LAIGONG_BOSHA_NOTE } from './fengshuiLiqiDeepData';
import { shuifa13, shuifa13Hit } from './fengshuiSanheShuifa';

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
export function sanhe({ shuiKou, waterFlow, xiangFaType, zuoDeg, sands = {}, boshaVariant = 'shuangshan',
	zuoShanForBosha = '', laiLong = '' } = {}) {
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
	//    「我」取法三说（古法并陈，切档即换判据，不可混算）：
	//      shuangshan＝以向双山三合五行（默认，通行）
	//      zuo       ＝以坐山（向之对宫）五行
	//      laigong   ＝赖公拨砂法：用**人盘中针**，以坐山中针之字为「我」、砂峰中针之字为「他」，
	//                  按赖公拨砂五行（太阳火/太阴火/木/金/水/土）论生克 —— 与前两档五行表不同源。
	let bosha = null;
	if (boshaVariant === 'laigong' && zuoShanForBosha) {
		// 人盘中针较地盘正针退半山：该度在中针环读到的山 = shanAtDeg(deg + 7.5)。
		const myShan = shanAtDeg(SHAN_CENTER_DEG[zuoShanForBosha] + 7.5);
		const myWuxing = LAIGONG_BOSHA_WUXING[myShan] || null;
		bosha = {
			myWuxing, boshaVariant, myShan, myFrom: '坐山（人盘中针）',
			mySub: LAIGONG_BOSHA_SUBLABEL[myShan] || null,
			note: LAIGONG_BOSHA_NOTE,
			sands: GUA8.map((g)=>{
				const actual = sands[g] || 'flat';
				if (actual !== 'sand') { return { gua: g, actual, wuGe: null }; }
				// 砂峰亦取人盘中针之字（以该卦中心度 +7.5 读中针山）。
				const shaShan = shanAtDeg(GONG_CENTER_DEG[HOUTIAN_POS[g]] + 7.5);
				const shaWuxing = LAIGONG_BOSHA_WUXING[shaShan] || null;
				const wg = (myWuxing && shaWuxing) ? boshaWuGe(myWuxing, shaWuxing) : null;
				return { gua: g, actual, shaShan, shaWuxing, shaSub: LAIGONG_BOSHA_SUBLABEL[shaShan] || null, wuGe: wg };
			}),
		};
	} else if (selected && selected.shuangshan) {
		const xiangZhi = selected.shuangshan.slice(-1);
		const myZhi = boshaVariant === 'zuo' ? (ZHI_CHONG[xiangZhi] || xiangZhi) : xiangZhi;
		const myWuxing = ZHI_SANHE_JU[myZhi] || (ju ? JU_WUXING[ju] : null);
		// 🔴 回落时必须**如实标注实际所用档**：选了赖公却没给坐山，本轮走的是双山表，
		//    若仍回报 'laigong'，右栏会照赖公口径渲染出「·undefined山中针」的假标签。
		const effVariant = boshaVariant === 'zuo' ? 'zuo' : 'shuangshan';
		bosha = {
			myWuxing, boshaVariant: effVariant, myZhi,
			fellBack: boshaVariant === 'laigong' ? '赖公档需坐山（人盘中针），未给 → 本轮按双山三合五行' : null, myFrom: boshaVariant === 'zuo' ? '坐山' : '向',
			sands: GUA8.map((g)=>{
				const actual = sands[g] || 'flat';
				if (actual !== 'sand') { return { gua: g, actual, wuGe: null }; }
				const wg = boshaWuGe(myWuxing, GUA_WUXING[g]);
				return { gua: g, actual, shaWuxing: GUA_WUXING[g], wuGe: wg };
			}),
		};
	}

	// ── 格龙（龙法）：来龙山在本局十二长生环上所值之阶。
	//    古籍口径：三合以四大局起长生，**左旋顺起论水、右旋逆起论龙**——水与龙两套方向，不可混用。
	//    本模块只据长生环如实读出来龙所值阶并标生旺/死绝，不臆造未载的逆行细表。
	let geLong = null;
	if (ring && laiLong) {
		const meta = SHAN_24[laiLong];
		const zhi = meta ? (SANHE_SHUANGSHAN[laiLong] ? laiLong : null) : null;
		// 来龙山 → 其所属双山（山名可能是干/维，取其双山组）。
		const pair = ring.find((r)=>r.shuangshan.indexOf(laiLong) >= 0) || null;
		if (pair) {
			const good = ['长生', '冠带', '临官', '帝旺', '养'].indexOf(pair.stage) >= 0;
			const bad = ['病', '死', '墓', '绝'].indexOf(pair.stage) >= 0;
			geLong = {
				laiLong, shuangshan: pair.shuangshan, stage: pair.stage,
				jx: good ? 'good' : (bad ? 'bad' : 'neutral'),
				text: `来龙${laiLong}（${pair.shuangshan}）在${ju}值「${pair.stage}」——${good ? '生旺之龙，可取' : (bad ? '死绝之龙，不宜' : '平常之阶，须细察')}`,
				note: '三合以四大局起长生：左旋顺起论水、右旋逆起论龙，两套方向不可混用。',
				zhi,
			};
		}
	}

	// ── 十三水法：本局长生环 → 13 条去水情况，并标出当前水口/水流所落之条 ──
	const shuiFa13 = ju ? shuifa13(ju, ring) : null;
	const shuiFa13Cur = shuiFa13 ? shuifa13Hit(shuiFa13, shuiKou, waterFlow) : null;

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
		huangquan, bosha, xianfa, laosanhe, geLong, shuiFa13, shuiFa13Cur,
		note: ju ? `水口落「${shuiKou}」属${ju}(墓库定局)` : '未定局(请选去水方/水口)',
	};
}

export { sanheStageAt, ZHI_OF_SHUANGSHAN };
