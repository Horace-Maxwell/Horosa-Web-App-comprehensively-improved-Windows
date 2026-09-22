// [Q-105 裁决 2026-09-18]「按能算即能挂」:小限页 G9「年/月/日小限 + 多起点」纯前端派生此前只住
// AstroProfection.js 组件内 —— 页面能算、AI 挂载/导出快照挂不上。抽成纯工具单源:
//   页面摘要区 / 页面模块快照 / 无头挂载快照(aiAnalysisContext.buildPredictivePeriodSnapshot)
// 三处共用 deriveProfection + buildProfectionSummaryLines;齿轮 profGrain/profStart 与页面控件同值域。
// 算法一字不动(自 AstroProfection.js 迁入;年=365.2422 天、月=年/12、日=2.5 天/座;
// flatlib 后端小限盘连续旋转,此处「年/月/日」为离散古典口径的前端派生,不改后端、不动年盘)。
import * as AstroConst from '../constants/AstroConst';
import * as AstroText from '../constants/AstroText';
import DateTime from '../components/comp/DateTime';
import { SIGNS } from '../divination/data/signs';

export const PROFECTION_GRAIN_OPTIONS = [
	{ value: 'y', label: '年' },
	{ value: 'm', label: '月' },
	{ value: 'd', label: '日' },
];
// 起点:上升(默认)/区分光(昼日夜月)/福点/月/MC 所在座。
export const PROFECTION_START_OPTIONS = [
	{ value: 'asc', label: '上升（默认）' },
	{ value: 'sect', label: '区分光（昼日夜月）' },
	{ value: 'fortune', label: '福点' },
	{ value: 'moon', label: '月亮' },
	{ value: 'mc', label: '天顶' },
];
export const PROFECTION_GRAIN_CN = { y: '年', m: '月', d: '日' };
export const PROFECTION_START_CN = { asc: '上升', sect: '区分光', fortune: '福点', moon: '月亮', mc: '天顶' };
// 座序庙主(domicile)→ 行星 glyph 标识(与 AstroText.AstroMsg 一致)。
const PROFECTION_SIGN_RULER_ID = {
	mars: 'Mars', venus: 'Venus', mercury: 'Mercury', moon: 'Moon', sun: 'Sun',
	jupiter: 'Jupiter', saturn: 'Saturn',
};

export function normalizeProfectionGrain(v){
	return (v === 'm' || v === 'd') ? v : 'y';
}

export function normalizeProfectionStart(v){
	return PROFECTION_START_CN[v] ? v : 'asc';
}

export function profectionPointSignIdx(chartObj, startKey){
	// 从本命盘取起点所在座的序号(0=白羊…11=双鱼);取不到返回 null(降级)。
	const chart = chartObj && chartObj.chart ? chartObj.chart : null;
	if(!chart){ return null; }
	const byId = {};
	(chart.objects || []).forEach((o)=>{ if(o && o.id){ byId[o.id] = o; } });
	(chart.angles || []).forEach((a)=>{ if(a && a.id){ byId[a.id] = a; } });
	let id = AstroConst.ASC;
	if(startKey === 'mc'){ id = AstroConst.MC; }
	else if(startKey === 'moon'){ id = AstroConst.MOON; }
	else if(startKey === 'fortune'){ id = AstroConst.PARS_FORTUNA; }
	else if(startKey === 'sect'){ id = chart.isDiurnal ? AstroConst.SUN : AstroConst.MOON; }
	const o = byId[id];
	if(!o){ return null; }
	if(o.sign && AstroConst.LIST_SIGNS.indexOf(o.sign) >= 0){
		return AstroConst.LIST_SIGNS.indexOf(o.sign);
	}
	if(o.lon != null){ return Math.floor(((o.lon % 360) + 360) % 360 / 30) % 12; }
	return null;
}

export function profectionSignRulerId(signIdx){
	const name = AstroConst.LIST_SIGNS[((signIdx % 12) + 12) % 12];
	const key = name ? name.toLowerCase() : '';
	const dom = SIGNS[key] ? SIGNS[key].domicile : null;
	return PROFECTION_SIGN_RULER_ID[dom] || null;
}

// 计算所选粒度/起点的离散小限派生结果。
// 入:本命 birth(DateTime) + 目标 datetime(DateTime) + grain('y'|'m'|'d') + startKey + 本命盘。
// 出:{ ageYears, startSignIdx, yearSignIdx, yearHouse, signIdx, house, rulerId, monthsIntoYear } 或 null。
export function deriveProfection(birthDt, targetDt, grain, startKey, chartObj){
	const startSignIdx = profectionPointSignIdx(chartObj, startKey);
	if(startSignIdx === null || !birthDt || !targetDt){ return null; }
	const birthJdn = birthDt.jdn || (birthDt.calcJdn ? birthDt.calcJdn() : 0);
	const targetJdn = targetDt.jdn || (targetDt.calcJdn ? targetDt.calcJdn() : 0);
	let days = targetJdn - birthJdn;
	if(!(days >= 0)){ days = 0; }
	const YEAR_DAYS = 365.2422;
	const age = Math.floor(days / YEAR_DAYS);               // 已满整岁(12/24/36 岁回上升)
	const yearSignIdx = (startSignIdx + age) % 12;          // 当年小限座
	const yearHouse = (age % 12) + 1;                        // 当年小限宫
	const daysIntoYear = days - age * YEAR_DAYS;            // 当年周年以来天数(月/日推进用)
	const MONTH_DAYS = YEAR_DAYS / 12.0;                    // ≈30.4368 天/月
	let monthsIntoYear = Math.floor(daysIntoYear / MONTH_DAYS);
	monthsIntoYear = Math.max(0, Math.min(11, monthsIntoYear));
	const monthSignIdx = (yearSignIdx + monthsIntoYear) % 12;
	const daysIntoMonth = daysIntoYear - monthsIntoYear * MONTH_DAYS;
	const DAY_STEP = 2.5;                                   // 360/12/12=2.5 天/座
	let daysAdv = Math.floor(daysIntoMonth / DAY_STEP);
	daysAdv = Math.max(0, Math.min(11, daysAdv));
	const daySignIdx = (monthSignIdx + daysAdv) % 12;
	let signIdx = yearSignIdx;
	let house = yearHouse;
	if(grain === 'm'){ signIdx = monthSignIdx; house = ((monthSignIdx - startSignIdx + 12) % 12) + 1; }
	else if(grain === 'd'){ signIdx = daySignIdx; house = ((daySignIdx - startSignIdx + 12) % 12) + 1; }
	return {
		ageYears: age,
		startSignIdx,
		yearSignIdx,
		yearHouse,
		signIdx,
		house,
		rulerId: profectionSignRulerId(signIdx),
		monthsIntoYear,
	};
}

// 页面 / 无头共用的时刻规整(单一代码路径,两侧同数):
//   出生 = params.date + time(不挂时区,与页面既有写法同);
//   目标 = params.datetime —— 页面态是响应后的 DateTime(已 setZone(dirZone));
//          无头态是 'YYYY-MM-DD HH:mm' 字符串 → 补秒解析后挂 dirZone,与页面响应后 setZone 同律。
export function profectionDateTimesFromParams(params){
	const p = params || {};
	let birthDt = null;
	if(p.date){
		birthDt = new DateTime();
		try{ birthDt.parse(`${p.date} ${p.time || '12:00:00'}`, 'YYYY-MM-DD HH:mm:ss'); }
		catch(e){ try{ birthDt.parse(p.date, 'YYYY-MM-DD'); }catch(e2){ birthDt = null; } }
	}
	let targetDt = null;
	if(p.datetime instanceof DateTime){
		targetDt = p.datetime;
	}else if(typeof p.datetime === 'string' && p.datetime.trim()){
		let s = p.datetime.trim();
		if(/^-?\d{1,4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)){ s = `${s}:00`; }
		targetDt = new DateTime();
		try{
			targetDt.parse(s, 'YYYY-MM-DD HH:mm:ss');
			if(p.dirZone){ targetDt.setZone(p.dirZone); }
		}catch(e){ targetDt = null; }
	}
	return { birthDt, targetDt };
}

// 快照文本行(纯文字,无字形字体;信息与页面摘要区同项同序)。算不出(未排盘/缺起点)→ []。
export function buildProfectionSummaryLines(chartObj, params, grain, startKey){
	const g = normalizeProfectionGrain(grain);
	const s = normalizeProfectionStart(startKey);
	const { birthDt, targetDt } = profectionDateTimesFromParams(params);
	const info = deriveProfection(birthDt, targetDt, g, s, chartObj);
	if(!info){ return []; }
	const signCn = (idx)=>{
		const name = AstroConst.LIST_SIGNS[((idx % 12) + 12) % 12];
		return AstroText.AstroTxtMsg[name] || name;
	};
	const planetCn = (id)=> (id ? (AstroText.AstroTxtMsg[id] || id) : '—');
	const lines = [];
	lines.push(`${PROFECTION_GRAIN_CN[g]}小限（自${PROFECTION_START_CN[s]}）：${signCn(info.signIdx)} · 第 ${info.house} 宫（自${PROFECTION_START_CN[s]}所在星座起数）`);
	lines.push(`小限主星：${planetCn(info.rulerId)}`);
	lines.push(`已满 ${info.ageYears} 岁${g !== 'y' ? `　当年第 ${info.monthsIntoYear + 1} 月` : ''}`);
	if(g !== 'y'){
		lines.push(`年级参照：${signCn(info.yearSignIdx)} · 第 ${info.yearHouse} 宫（自${PROFECTION_START_CN[s]}所在星座起数）`);
	}
	return lines;
}
