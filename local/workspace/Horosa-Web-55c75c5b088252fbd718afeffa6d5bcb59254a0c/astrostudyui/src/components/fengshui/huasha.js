// 风水 · 改造与化煞引擎（形煞 / 气煞 / 补偏救弊）。
// 🔴 与形势、理气诸派并行：本派**不改任何既有引擎之判**，只据已排之飞星盘与用户登记的实况出化解方案。
// 🔴 传本未给判据者（力士 / 戊己都天 / 暗建煞之表）一律由用户登记宫位，绝不自造规则。
import {
	BUPIAN_5, XINGSHA_20, XINGSHA_LEIBIE, XINGSHA_YUANJIN, XINGSHA_WEIHAI_3,
	QISHA_RIKE, QISHA_LIQI, LINGXING_SHA, QISHA_TRIGGER, QISHA_NOTE,
	HUAJIE_WUPIN, HUASHA_NOTE,
} from './fengshuiHuashaData';
import { xuankong } from './xuankong';
import { yearGods } from './zeri';
import { POS_NAME, GONG_GUA, SHAN_24, ZHI_CHONG } from './fengshuiData';

const GONG8 = [1, 2, 3, 4, 6, 7, 8, 9];
const YIN_STARS = [2, 4, 7, 9];
const fixOf = (item, table)=>{
	if (item.fix) { return item.fix; }
	if (item.fixSameAs) { const src = table.find((x)=>x.key === item.fixSameAs); return src ? (src.fix || []) : []; }
	return [];
};

// 某宫是否命中一组星（山星/向星/运星三者的集合覆盖 combo）。
function comboHit(stars, combo) {
	const pool = stars.slice();
	return combo.every((n)=>{ const i = pool.indexOf(n); if (i < 0) { return false; } pool.splice(i, 1); return true; });
}

// 化煞主入口。
//   zhaiType: 'yang'|'yin'；xingSha: [{key, gong}]；env: {gong: 'jing'|'dong'|'eshan'}
//   盘：给 zuoShan+yun 即内部排飞星盘取山向运三星；也可直接给 palaces。
//   日课：给 year 则算岁破/三煞/太岁并五黄/五黄逢劫煞；lishiGong/duTianGong/anJianGong 为用户登记宫。
//   令星：lingXingUse ∈ {'zao','wei','chu'}（阳宅），lingXingShangShan（阴宅当令向星上山）。
export function huasha({
	zhaiType = 'yang', xiangShan = '', yun = 9, palaces: palacesIn = null,
	xingSha = [], env = {}, year = null,
	lishiGong = 0, duTianGong = 0, anJianGong = 0,
	zuoShanForRike = '', lingXingUse = '', lingXingShangShan = false,
} = {}) {
	const isYin = zhaiType === 'yin';
	// ── 盘：山星/向星/运星逐宫 ──
	let pan = null;
	if (Array.isArray(palacesIn) && palacesIn.length) { pan = palacesIn; }
	else if (xiangShan) {
		const xk = xuankong(yun, xiangShan, {});
		pan = xk && xk.available ? xk.palaces : null;
	}

	// ── ① 形煞 ──
	const xing = (Array.isArray(xingSha) ? xingSha : []).map((s)=>{
		const meta = XINGSHA_20.find((x)=>x.key === (s && s.key));
		if (!meta) { return null; }
		const gong = Math.trunc(Number(s.gong)) || 0;
		const p = gong && pan ? pan.find((x)=>x.gong === gong) : null;
		return {
			...meta, gong: gong || null, dir: gong ? POS_NAME[gong] : null,
			gua: gong ? GONG_GUA[gong] : null,
			// 「冲入何卦宫多应此卦宫所主之人」——只在登记了受煞方时才给出，未登记不臆断。
			ying: (meta.gong && gong) ? `冲入${GONG_GUA[gong]}宫，多应此卦宫所主之人`
				+ (p ? `；该宫飞星组合 山${p.shan}·向${p.xiang}（${p.combo ? p.combo.note : ''}），可结合其星气卦象细推` : '') : null,
			fixList: fixOf(meta, XINGSHA_20),
		};
	}).filter(Boolean);

	// ── ② 气煞·日课类 ──
	const rike = [];
	const yg = year ? yearGods(Number(year)) : null;
	// 显式传 null/字符串会打穿默认值（默认值只在 undefined 时生效）—— 此处硬归一。
	const envMap = (env && typeof env === 'object') ? env : {};
	const envOf = (g)=>envMap[g] || '';
	const pushRike = (key, gong, extra)=>{
		const meta = QISHA_RIKE.find((x)=>x.key === key);
		if (!meta) { return; }
		rike.push({
			...meta, gong: gong || null, dir: gong ? POS_NAME[gong] : null,
			trigger: gong ? envOf(gong) : '',
			fires: gong ? ['dong', 'eshan'].indexOf(envOf(gong)) >= 0 : false,
			fixList: fixOf(meta, QISHA_RIKE), ...extra,
		});
	};
	if (yg) {
		// 岁破：坐山与太岁对冲（登记了坐山才判山，方位恒判）。
		const zuoZhi = zuoShanForRike && SHAN_24[zuoShanForRike] ? zuoShanForRike : '';
		const zuoIsSuiPo = !!zuoZhi && ZHI_CHONG[yg.yearZhi] === zuoZhi;
		pushRike('suipo', yg.suipo.gong, { hit: true, zuoHit: zuoIsSuiPo,
			detail: `${yg.yearGanZhi}年太岁在${yg.yearZhi}，岁破在${yg.suipo.zhi}（${yg.suipo.dir}）`
				+ (zuoZhi ? `；所登记坐山${zuoZhi}${zuoIsSuiPo ? '正犯岁破' : '不犯岁破'}` : '') });
		// 三煞：三方。
		const sanshaGongs = yg.sansha.list.map((s)=>s.gong).filter(Boolean);
		sanshaGongs.forEach((g, i)=>pushRike('sansha', g, { hit: true,
			detail: `${yg.sansha.ju}三煞之${yg.sansha.list[i].name}（${yg.sansha.list[i].zhi}）在${POS_NAME[g]}` }));
		// 太岁并五黄：年五黄之宫与太岁同宫。
		if (yg.wuHuang.gong && yg.wuHuang.gong === yg.taisui.gong) {
			pushRike('taisuiWuhuang', yg.wuHuang.gong, { hit: true, detail: `年五黄与太岁同临${yg.wuHuang.dir}` });
		}
		// 五黄逢劫煞：劫煞为三煞之首（岁之阴神）。
		const jie = yg.sansha.list.find((s)=>s.name === '劫煞');
		if (jie && yg.wuHuang.gong && jie.gong === yg.wuHuang.gong) {
			pushRike('wuhuangJiesha', jie.gong, { hit: true, detail: `年五黄与劫煞（${jie.zhi}）同临${POS_NAME[jie.gong]}` });
		}
		// 力士 / 戊己都天 / 暗建：判据传本未载 → 只在用户登记宫位时判，且如实标注。
		[['wuhuangLishi', lishiGong], ['duTianWuhuang', duTianGong]].forEach(([k, g])=>{
			const gg = Math.trunc(Number(g)) || 0;
			if (!gg) { return; }
			const hit = yg.wuHuang.gong === gg;
			pushRike(k, gg, { hit, detail: hit ? `年五黄与所登记之神同临${POS_NAME[gg]}` : `所登记之宫（${POS_NAME[gg]}）与年五黄（${yg.wuHuang.dir}）不同宫，不成此煞` });
		});
	}
	const anGong = Math.trunc(Number(anJianGong)) || 0;
	if (anGong) { pushRike('anjian', anGong, { hit: true, detail: `所登记暗建煞在${POS_NAME[anGong]}；单独出现不为大害，须与它煞同参` }); }

	// ── ③ 气煞·理气类（飞星组合）──
	const liqi = [];
	if (pan) {
		GONG8.forEach((g)=>{
			const p = pan.find((x)=>x.gong === g);
			if (!p) { return; }
			const stars = [p.shan, p.xiang, p.yun].filter((n)=>n != null);
			const trig = envOf(g);
			const fires = ['dong', 'eshan'].indexOf(trig) >= 0;
			QISHA_LIQI.forEach((s)=>{
				let hit = false;
				// 🔴 阴神满地按「相异」阴星计：传本所列化解全是相异两星之配（4-2/2-7/4-7/2-9/4-9），
				//    同一颗星重复出现（如山9向9）不作两颗 —— 真机上曾据此误报一次。
				if (s.yinShen) { hit = new Set(stars.filter((n)=>YIN_STARS.indexOf(n) >= 0)).size >= 2; }
				else if (s.anyOf) { hit = s.anyOf.some((c)=>comboHit(stars, c)); }
				else if (s.combo) { hit = comboHit(stars, s.combo); }
				if (!hit) { return; }
				// 木煞须「失令」：三碧四绿于当运非当令、非生气时方论。
				if (s.needShiLing) {
					const sheng = (yun % 9) + 1;
					if ([3, 4].some((n)=>n === yun || n === sheng)) { return; }
				}
				liqi.push({
					key: s.key, name: s.name, label: s.label, def: s.def, harm: s.harm,
					conflict: s.conflict || null,
					gong: g, dir: POS_NAME[g], gua: GONG_GUA[g],
					stars: { shan: p.shan, xiang: p.xiang, yun: p.yun },
					trigger: trig, fires,
					fixList: fixOf(s, QISHA_LIQI),
				});
			});
		});
	}

	// ── ④ 令星煞 ──
	let lingXing = null;
	if (pan) {
		const wangXiang = pan.find((x)=>x.xiang === yun && x.gong !== 5) || null;   // 当令向星所居之宫
		const use = LINGXING_SHA.yangUses.find((u)=>u.key === lingXingUse) || null;
		const yinHit = isYin && lingXingShangShan;
		const yangHit = !isYin && !!use;
		lingXing = {
			...LINGXING_SHA,
			gong: wangXiang ? wangXiang.gong : null,
			dir: wangXiang ? POS_NAME[wangXiang.gong] : null,
			wangXiangStar: yun, use: use ? use.label : null,
			hit: yinHit || yangHit,
			verdict: yinHit ? { text: '阴宅当令向星上山，水神错位成煞', jx: 'bad' }
				: (yangHit ? { text: `阳宅当令向星所居之宫用作${use.label}，水神错位成煞`, jx: 'bad' }
					: { text: '未登记令星错位之用（阳宅选厨灶/卫生间/储藏间，阴宅勾「当令向星上山」）', jx: 'neutral' }),
			fixList: isYin ? LINGXING_SHA.fixYin : LINGXING_SHA.fixYang,
		};
	}

	// ── 汇总 ──
	const firedRike = rike.filter((r)=>r.hit !== false && r.fires);
	const firedLiqi = liqi.filter((r)=>r.fires);
	const total = xing.length + rike.filter((r)=>r.hit !== false).length + liqi.length + (lingXing && lingXing.hit ? 1 : 0);
	const wupinKeys = new Set();
	HUAJIE_WUPIN.forEach((w)=>{
		const all = xing.concat(liqi).concat(rike).map((x)=>(x.fixList || []).join('　')).join('　')
			+ (lingXing && lingXing.hit ? (lingXing.fixList || []).join('　') : '');
		if (all.indexOf(w.name.split('／')[0]) >= 0) { wupinKeys.add(w.key); }
	});

	return {
		available: true, zhaiType, isYin, yun, xiangShan: xiangShan || null, hasPan: !!pan,
		xingSha: xing, qiShaRike: rike, qiShaLiqi: liqi, lingXing,
		yearGods: yg, year: yg ? yg.year : null,
		firedRike, firedLiqi, total,
		buPian: BUPIAN_5,
		wupin: HUAJIE_WUPIN.filter((w)=>wupinKeys.has(w.key)),
		wupinAll: HUAJIE_WUPIN,
		leibie: XINGSHA_LEIBIE, yuanJin: XINGSHA_YUANJIN, weiHai3: XINGSHA_WEIHAI_3,
		trigger: QISHA_TRIGGER,
		verdict: total === 0
			? { text: '未登记任何煞——左栏勾形煞、填盘与八方实况后出化解方案', jx: 'neutral' }
			: ((firedRike.length + firedLiqi.length) === 0
				? { text: `共 ${total} 项煞在册；所临之方均安静无动象，一般不会出灾（仍宜按化解法预为之备）`, jx: 'neutral' }
				: { text: `共 ${total} 项煞在册，其中 ${firedRike.length + firedLiqi.length} 项所临之方有动象或恶山恶水——须即化解`, jx: 'bad' }),
		note: HUASHA_NOTE, qiShaNote: QISHA_NOTE,
	};
}

export default huasha;
