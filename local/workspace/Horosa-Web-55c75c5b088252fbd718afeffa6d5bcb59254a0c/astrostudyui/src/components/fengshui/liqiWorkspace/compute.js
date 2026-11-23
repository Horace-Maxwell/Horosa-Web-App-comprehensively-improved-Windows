// 按流派分派实时重算、罗盘读数与坐山流年查验
// 从 LiqiWorkspace.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { implOf } from '../liqi/registry';
import { xuankong } from '../xuankong';
import { sanhe } from '../sanhe';
import { zibai } from '../zibai';
import { qiankun } from '../qiankun';
import { bazhai } from '../bazhai';
import { jinsuo } from '../jinsuo';
import { fuxing } from '../fuxing';
import { jingyin } from '../jingyin';
import { dagua } from '../dagua';
import { xingshi } from '../xingshi';
import { dayCourse, zaoMing, yearGods } from '../zeri';
import { xuankongLiufa } from '../xuankongLiufa';
import { mingli } from '../mingli';
import { shanAtDeg, chuanshanAt, toudiAt, fenjinAt, gua64AtDeg, najiaYinYang } from '../liqiCore';
import { SHAN_24, XIU28_RING, NEEDLE_USE, GONG_NAME as GONG_NAME_MAP } from '../fengshuiData';
import { LUOPAN_TYPES, LUOPAN_TYPE_NOTE, LUOPAN_PARTS, TIANXING_JI, TIANXING_BAGUI, TIANXING_NOTE, TIANXING_BAGUI_USE, DIMU9_STARS, DIMU9_NOTE, HUANGQUAN_PAN_NOTE, JIEQI_NOTE, YIPAN_CONTENT, YAO384_NOTE, XIA_LUOPAN_NEI, XIA_LUOPAN_WAI, XIA_LUOPAN_NOTE, LUOPAN_USE_RULES, PAI_NEEDLE_USE } from '../fengshuiLuopanData';
import { fenjinPick, chuanshanPick, jianCheck, magneticWizard, panxiangWizard, LIXIANG_STEPS, LIXIANG_TIYONG, XIANG_IMPORTANCE, JIAN_RULES, JIAN_DEG_RULES } from '../luopanTools';
import { DECLINATION_CITY_COUNT } from '../fengshuiDeclinationData';
import { liqiDefaultState } from './options';

// 参数不全(compute 返回 available:false)时盘区的提示
export const LIQI_UNAVAILABLE_HINT = {
	mingli: '命理派以命配宅:在左栏填写命主出生年(与性别)即排盘',
	default: '左栏参数不全,补齐后即排盘',
};

// 理气各派一次排盘(纯函数;页面与 AI 工具 cast_fengshui 同一份)。S = 各派参数状态(与页面左栏同形,缺的取 liqiDefaultState())。
export function computeLiqi(school, state, env){
	const S = { ...liqiDefaultState(), ...(state || {}) };
	const { xiangShan, yun, year, month, jian, tiVariant, zuoGua, ming, shuiKou, waterFlow, sectors, waters, zhaiMode, sanheDeep, sands, bazhaiDeep, xkDeep, zbDate, fx, fxWaters, jy, dg, xs, zr, jsDeep, jsShans, jsXings, lf, ml, lp, regStates } = S;
	const geo = env && env.geo ? env.geo : null;
	const impl = implOf(school);
	if (impl) { return impl.compute({ ...impl.defaults, ...(regStates[school] || {}) }, { geo }); }
	switch (school) {
		case 'xuankong': return xuankong(yun, xiangShan, { year, month: month || undefined, jian, tiVariant, deg: xkDeep.deg, yinYangZhai: xkDeep.yinYangZhai, school: xkDeep.school, jianBoundary: xkDeep.jianBoundary, wuHuangSplit: xkDeep.wuHuangSplit, shousha: xkDeep.shousha });
		case 'sanhe': return sanhe({ shuiKou, waterFlow, xiangFaType: sanheDeep.xiangFaType, zuoDeg: sanheDeep.zuoDeg, sands,
			boshaVariant: sanheDeep.boshaVariant, zuoShanForBosha: sanheDeep.zuoShanForBosha, laiLong: sanheDeep.laiLong });
		case 'zibai': return zibai({ year, month: month || undefined, date: (zbDate.m && zbDate.d) ? { y: year, m: +zbDate.m, d: +zbDate.d, hour: zbDate.hour !== '' ? +zbDate.hour : undefined } : undefined });
		case 'qiankun': return qiankun({ zuoGua, waters });
		case 'bazhai': return bazhai({ zuoGua, ming, mode: zhaiMode, doorGua: bazhaiDeep.doorGua || undefined, mainGua: bazhaiDeep.mainGua || undefined, stoveGua: bazhaiDeep.stoveGua || undefined, zhaiType: bazhaiDeep.zhaiType,
			faMai: bazhaiDeep.faMai, lunMing: bazhaiDeep.lunMing, yun });
		case 'jinsuo': return jinsuo({ sectors, yun: jsDeep.yun, year: jsDeep.year,
			shans: jsDeep.gran === 'shan24' ? jsShans : null, xings: jsXings });
		case 'fuxing': return fuxing({ benGua: fx.benGua, qiFrom: fx.qiFrom, waters: fxWaters });
		case 'jingyin': return jingyin(jy);
		case 'dagua': return dagua({ xiangLower: dg.lower, xiangUpper: dg.upper, yun, yunScheme: dg.yunScheme, xiangYunInput: dg.xiangYun, zuoYunInput: dg.zuoYun, deg: dg.deg,
			showDeep: dg.showDeep, longLower: dg.longLower, longUpper: dg.longUpper, chouYao: dg.chouYao, year });
		case 'xingshi': return xingshi(xs);
		// 月/日两框非空即渲染期取数:月 0/13、日 32(含键入「03」的首个「0」)使日期库抛错且无 try → 整页错误卡。
		// 改:月日在 1~12 / 1~31 内才起日课,否则视为未填;并包 try(同类紫白已包)。
		case 'zeri': { const _m = +zr.m, _d = +zr.d; const _ok = !!zr.m && !!zr.d && Number.isInteger(_m) && Number.isInteger(_d) && _m >= 1 && _m <= 12 && _d >= 1 && _d <= 31;
			let _course = null, _zm = null;
			if(_ok){ try{ _course = dayCourse(zr.year, _m, _d); }catch(e){ _course = null; } }
			if(_ok){ try{ _zm = zaoMing({ zuoShan: zr.zuoShan, y: zr.year, m: _m, d: _d,
				laiLong: zr.laiLong || undefined, zhuMing: zr.zhuYear ? { year: +zr.zhuYear, isMale: zr.zhuMale } : undefined,
				showDeep: zr.showDeep, yongShi: zr.yongShi, hourGanZhi: zr.hourGanZhi, yun: zr.yun,
				zibaiA: zr.zibaiA, zibaiB: zr.zibaiB, chongFuStar: zr.chongFuStar, chongFuGong: zr.chongFuGong, dongCombo: zr.dongCombo }); }catch(e){ _zm = null; } }
			const _yg = yearGods(zr.year);
			return { available: true, isZeri: true, yg: _yg, course: _course, zaoming: _zm, zuoShan: zr.zuoShan, zuoShanCheck: zuoShanYearCheck(zr.zuoShan, _yg) }; }
		case 'liufa': return xuankongLiufa({ yun: lf.yun, zuoShan: lf.zuoShan, xiangShan: lf.xiangShan, year: lf.year });
		case 'mingli': return mingli({ mingYear: ml.mingYear, isMale: ml.isMale, zhaiZuoGua: ml.zhaiZuoGua });
		case 'luopan': return luopanReading(lp);
		default: return null;
	}
}

// 综合罗经：当前度数的逐层读数（正针/中针/缝针三针 + 线法三层 + 64卦 + 28宿 + 卦宫元龙）。
//   中针较正针退半山 → 该度在中针环读到的山 = shanAtDeg(deg + 7.5)；缝针进半山 → shanAtDeg(deg − 7.5)。
export function luopanReading(lp) {   // 具名导出供快照单测(页面调用不变)
	const d = ((Number(lp.deg) % 360) + 360) % 360;
	const zheng = shanAtDeg(d);
	const meta = SHAN_24[zheng] || [];
	const xiu = XIU28_RING.find((c)=>((d - c.deg0) % 360 + 360) % 360 < (((c.deg1 - c.deg0) % 360 + 360) % 360 || 360)) || null;
	return {
		available: true, isLuopan: true, deg: d, layers: lp.layers, zuoShan: lp.zuoShan, xiangShan: lp.xiangShan,
		needles: [
			{ key: 'zheng', name: '地盘正针', shan: zheng, use: NEEDLE_USE.zheng, offset: 0 },
			{ key: 'ren', name: '人盘中针', shan: shanAtDeg(d + 7.5), use: NEEDLE_USE.ren, offset: -7.5 },
			{ key: 'feng', name: '天盘缝针', shan: shanAtDeg(d - 7.5), use: NEEDLE_USE.feng, offset: 7.5 },
		],
		chuanshan: chuanshanAt(d), toudi: toudiAt(d), fenjin: fenjinAt(d), gua64: gua64AtDeg(d),
		xiu: xiu ? { name: xiu.label, xiang: xiu.xiang, jx: xiu.jx } : null,
		gong: meta[0] || null, gongName: meta[0] ? GONG_NAME_MAP[meta[0]] : null,
		yuanlong: meta[1] || null, yinyang: meta[2] === 1 ? '阳' : (meta[2] === -1 ? '阴' : null),
		jingYinYang: najiaYinYang(zheng),
		// ── 罗盘升级（additive）──────────────────────────────────────────
		// 🔴 盘式决定层集：三元盘（蒋盘）明载「没有人盘中针廿四山和天盘缝针廿四山，
		//    也没有七十二龙、一百二十龙、六十龙分金」——切档时这些层必须真的消失。
		panType: lp.panType || 'zonghe',
		panTypeMeta: LUOPAN_TYPES.find((t)=>t.key === (lp.panType || 'zonghe')) || null,
		panTypeNote: LUOPAN_TYPE_NOTE, parts: LUOPAN_PARTS,
		effLayers: (()=>{
			const t = LUOPAN_TYPES.find((x)=>x.key === (lp.panType || 'zonghe'));
			const want = lp.layers || [];
			if (!t || t.has == null) { return want; }
			return want.filter((k)=>t.not.indexOf(k) < 0);
		})(),
		droppedLayers: (()=>{
			const t = LUOPAN_TYPES.find((x)=>x.key === (lp.panType || 'zonghe'));
			if (!t || t.has == null) { return []; }
			return (lp.layers || []).filter((k)=>t.not.indexOf(k) >= 0);
		})(),
		fenjinPick: fenjinPick(zheng), chuanshanPick: chuanshanPick(zheng),
		jian: (lp.jianShan && SHAN_24[lp.jianShan])
			? jianCheck(lp.zuoShan, lp.jianShan, lp.jianDeg, lp.jianSchool) : null,
		magnetic: (lp.trueDeg !== '' && lp.trueDeg != null)
			? magneticWizard({ trueDeg: lp.trueDeg, city: lp.city, source: lp.decSource }) : null,
		panxiang: panxiangWizard({
			isDanyuan: lp.isDanyuan, hasWater: lp.hasWater, hasMingtang: lp.hasMingtang,
			mingtangDominant: lp.mingtangDominant, fourSidesSimilar: lp.fourSidesSimilar,
			innerOuterMatch: lp.innerOuterMatch, outerStrong: lp.outerStrong }),
		lixiang: { steps: LIXIANG_STEPS, tiyong: LIXIANG_TIYONG, importance: XIANG_IMPORTANCE,
			jianRules: JIAN_RULES, jianDegRules: JIAN_DEG_RULES },
		tianxing: { ji: TIANXING_JI, baGui: TIANXING_BAGUI, note: TIANXING_NOTE, use: TIANXING_BAGUI_USE },
		dimu9: { stars: DIMU9_STARS, note: DIMU9_NOTE },
		huangquanNote: HUANGQUAN_PAN_NOTE, jieqiNote: JIEQI_NOTE,
		yipan: YIPAN_CONTENT, yao384Note: YAO384_NOTE,
		xiaLuopan: { nei: XIA_LUOPAN_NEI, wai: XIA_LUOPAN_WAI, note: XIA_LUOPAN_NOTE },
		useRules: LUOPAN_USE_RULES, paiNeedle: PAI_NEEDLE_USE,
		cityCount: DECLINATION_CITY_COUNT,
	};
}

// 择日「坐山·本年可动否」:按年神即时判(不依赖月日),面板卡与快照同源。
export function zuoShanYearCheck(zuoShan, yg) {
	const meta = SHAN_24[zuoShan] || [];
	const g = meta[0];
	if (!g || !yg) { return null; }
	const hits = [];
	if (yg.suipo && yg.suipo.gong === g) { hits.push('犯岁破（大凶忌动）'); }
	if (yg.taisui && yg.taisui.gong === g) { hits.push('坐太岁（可向不宜坐犯）'); }
	if (((yg.sansha && yg.sansha.list) || []).some((s)=>s.gong === g)) { hits.push(`犯三煞（${yg.sansha.ju}）`); }
	if (yg.wuHuang && yg.wuHuang.gong === g) { hits.push('年五黄飞临（忌动土）'); }
	return { gong: g, gongName: GONG_NAME_MAP[g] || '—', hits, text: hits.length ? hits.join('；') : '不犯岁破/太岁/三煞/年五黄' };
}
