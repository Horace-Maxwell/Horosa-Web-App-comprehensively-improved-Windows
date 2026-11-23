// 奇门页状态小件:视口高、格局判读与法奇门问事偏好、在线快照、取盘键、实例态记忆与恢复、择日选项、首屏预热
// 从 DunJiaMain.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { getPageLayoutHeight } from '../../../utils/shellZoom';
import { safeLocalStorageSet } from '../../../utils/safeStorage';
import { buildDunJiaSnapshotText, needJieqiYearSeed } from '../DunJiaCalc';
import { safe, resolveCalcGeo } from '../qimenPageShared';
import { resolveAfter23NewDay, resolveLateZiHourUseNextDay } from '../../../utils/dayBoundaryResolve';
import { fetchPreciseNongli, fetchPreciseJieqiSeed } from '../../../utils/preciseCalcBridge';
import { QIMEN_PATTERN_INTERPRETATION_STORAGE_KEY, DEFAULT_OPTIONS, normalizeKenQimenOptions, DUNJIA_PAGE_SETTINGS } from './options';

// techniqueScope → live 态。keep-alive(FreezeInactive)下独立奇门页与择日页宿主并存,单例必竞写,按 scope 隔离。
const dunJiaLiveStateByScope = Object.create(null);

export function getViewportHeight(){
	// 🔴 innerHeight/documentElement.clientHeight 恒报物理域;壳缩放≠1 时当布局高用会
	// 把整页配矮(底部死带)。走 getLayoutViewportHeight —— 它**直接量** fixed 铺满元素,
	// 不做任何缩放换算,故与引擎的 zoom 语义无关(2026-08-27 根修,见 zoomDomain)。
	if(typeof window !== 'undefined' && Number.isFinite(window.innerHeight) && window.innerHeight > 0){
		// 页面排版视口:地板到工作区包络高 560(工作区按下限排、外层可滚;不地板则盘按矮视口排、与工作区脱节)
		return getPageLayoutHeight();
	}
	if(typeof document !== 'undefined' && document.documentElement){
		return document.documentElement.clientHeight || 900;
	}
	return 900;
}

export function normalizeTimeAlg(value){
	return value === 1 ? 1 : 0;
}

export function getTimeAlgLabel(value){
	return normalizeTimeAlg(value) === 1 ? '直接时间' : '真太阳时';
}

export function loadPatternInterpretationPreference(){
	try{
		if(typeof window === 'undefined' || !window.localStorage){
			return true;
		}
		const val = window.localStorage.getItem(QIMEN_PATTERN_INTERPRETATION_STORAGE_KEY);
		if(val === null || val === undefined || val === ''){
			return true;
		}
		return val !== '0' && val !== 'false';
	}catch(e){
		return true;
	}
}

export function savePatternInterpretationPreference(value){
	safeLocalStorageSet(QIMEN_PATTERN_INTERPRETATION_STORAGE_KEY, value ? '1' : '0');
}

// 法奇门「用神」Tab 的显示层偏好（求测事项 + 当面/网测），存 localStorage、不进 fields、不重排盘。
const QIMEN_FA_ASK_TOPIC_KEY = 'qimenFaAskTopic';
export const FA_ASK_TOPICS = [
	{ key: 'shexin', label: '识破人心' },
	{ key: 'wealth', label: '财富' },
	{ key: 'career', label: '事业' },
	{ key: 'romance', label: '婚恋' },
];
export function loadFaAskTopic(){
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			const v = window.localStorage.getItem(QIMEN_FA_ASK_TOPIC_KEY);
			if(v && FA_ASK_TOPICS.some((t)=>t.key === v)){
				return v;
			}
		}
	}catch(e){
	}
	return 'shexin';
}
export function saveFaAskTopic(value){
	safeLocalStorageSet(QIMEN_FA_ASK_TOPIC_KEY, value);
}

export function saveQimenLiveSnapshot(pan, scope, composer){
	if(!pan || typeof window === 'undefined'){
		return '';
	}
	let snapshotText = '';
	try{
		snapshotText = buildDunJiaSnapshotText(pan);
	}catch(e){
		snapshotText = '';
	}
	// [奇门择日] 宿主可拼接技法附加段(择日三段);composer 异常回退原文,绝不空快照。
	if(snapshotText && typeof composer === 'function'){
		try{
			snapshotText = composer(snapshotText, pan) || snapshotText;
		}catch(e){
		}
	}
	// window 全局快照槽只属独立奇门页(aiExport 活导出兜底读它),其它 scope 绝不竞写。
	if(snapshotText && (scope === undefined || scope === 'qimen')){
		window.__horosa_qimen_snapshot_text = snapshotText;
		window.__horosa_qimen_snapshot_at = Date.now();
	}
	return snapshotText;
}

export function getFieldKey(fields){
	if(!fields || !fields.date || !fields.time){
		return '';
	}
	return [
		fields.date.value.format('YYYY-MM-DD'),
		fields.time.value.format('HH:mm:ss'),
		safe(fields.zone && fields.zone.value),
		safe(fields.lon && fields.lon.value),
		safe(fields.lat && fields.lat.value),
		safe(fields.ad && fields.ad.value),
		safe(fields.gender && fields.gender.value),
	].join('|');
}

function getAfter23NewDayValue(options){
	return resolveAfter23NewDay(options && options.after23NewDay);
}

function getTimeAlgValue(options){
	return normalizeTimeAlg(options && options.timeAlg);
}

export function getNongliRequestKey(fields, options){
	return `${getFieldKey(fields)}|after23NewDay=${getAfter23NewDayValue(options)}|timeAlg=${getTimeAlgValue(options)}`;
}

export function getQimenOptionsKey(options){
	if(!options){
		return '';
	}
	return [
		safe(options.sex),
		safe(options.dateType),
		safe(options.leapMonthType),
		safe(options.xuShiSuiType),
		safe(options.jieQiType),
		safe(options.paiPanType),
		safe(options.zhiShiType),
		safe(options.yueJiaQiJuType),
		safe(options.yearGanZhiType),
		safe(options.monthGanZhiType),
		safe(options.dayGanZhiType),
		safe(options.qijuMethod),
		safe(options.school),
		safe(options.shuziReportNumber),
		safe(options.kongMode),
		safe(options.yimaMode),
		safe(options.shiftPalace),
		getAfter23NewDayValue(options),
		safe(options.lateZiHourUseNextDay),
		getTimeAlgValue(options),
		options.fengJu ? 1 : 0,
		safe(options.zhirunLeapDays),
		// 🔴 缓存键维度完备铁律:凡影响 calcDunJia 输出的 options 键必须全部入键,
		// 漏键=起盘后改档命中旧缓存=死开关(真机实抓:anGanMode 切档盘面纹丝不动)。哨兵测试守。
		safe(options.godsPreset),
		safe(options.jiGongMode),
		safe(options.anGanMode),
		options.showAnZhi ? 1 : 0,
		options.showJiGan ? 1 : 0,
		options.showTianQin ? 1 : 0,
		safe(options.tuiYanView),
		safe(options.tuiYanGong),
		options.showJianChu ? 1 : 0,
		options.fullNameTips ? 1 : 0,
		options.feiXingShun ? 1 : 0,
		options.feiMenShun ? 1 : 0,
		options.feiShenShun ? 1 : 0,
		options.feiMenZhongCan === false ? 0 : 1,
		options.feiMenZhongShow ? 1 : 0,
		safe(options.mixTian),
		safe(options.mixXing),
		safe(options.mixMen),
		safe(options.mixShen),
		options.kongMarkBoth ? 1 : 0,
		options.showAllKong ? 1 : 0,
		safe(options.shiftZhiFuMode),
		safe(options.dayJiaJu),
		safe(options.keJiaFenDun),
		options.keZiZhengHuanShi ? 1 : 0,
		safe(options.jinhanMenPai),
		safe(options.yearJiaJu),
	].join('|');
}

// needJieqiYearSeed 已收编到 DunJiaCalc(独立页/三式/择日单源;补刻家与本地口径非缺省的转盘)。

export function sameRelatedPeople(a, b){
	const aa = Array.isArray(a) ? a : [];
	const bb = Array.isArray(b) ? b : [];
	if(aa.length !== bb.length){
		return false;
	}
	for(let i = 0; i < aa.length; i++){
		const x = aa[i] || {};
		const y = bb[i] || {};
		if(`${x.cid}` !== `${y.cid}` || `${x.yearGan}` !== `${y.yearGan}`){
			return false;
		}
	}
	return true;
}

export function rememberDunJiaLiveState(scope, payload){
	if(!payload || !payload.pan){
		return;
	}
	dunJiaLiveStateByScope[scope || 'qimen'] = {
		fieldKey: payload.fieldKey || '',
		lastNongliKey: payload.lastNongliKey || '',
		lastPanSignature: payload.lastPanSignature || '',
		nongli: payload.nongli || null,
		displaySolarTime: payload.displaySolarTime || '',
		pan: payload.pan,
		options: payload.options ? { ...payload.options } : null,
		// 记住这两键是否被本页左栏显式改过:未改过的下次重建按全局现值,改过的沿用
		boundaryTouched: payload.boundaryTouched && typeof payload.boundaryTouched === 'object' ? { ...payload.boundaryTouched } : {},
		faRelatedPeople: Array.isArray(payload.faRelatedPeople) ? payload.faRelatedPeople : [],
	};
}

export function getRestorableDunJiaLiveState(scope, fields){
	const lastState = dunJiaLiveStateByScope[scope || 'qimen'];
	if(!lastState || !lastState.pan){
		return null;
	}
	const fieldKey = getFieldKey(fields);
	if(lastState.fieldKey && fieldKey && lastState.fieldKey !== fieldKey){
		return null;
	}
	return lastState;
}

// 全局 fields.gender(0 女 / 1 男,'0'/'1' 兼容)→ 奇门标签型 sex;无值/未知 → null(不动现值)。
export function syncedSexFromFields(fields){
	const g = fields && fields.gender ? fields.gender.value : null;
	if(g === 0 || g === '0'){ return 0; }
	if(g === 1 || g === '1'){ return 1; }
	return null;
}

// —— R4-B3:遁甲 stage-1 构参的模块级纯函数(组件方法 genParams 纯委托于此)。
//    抽出来的唯一目的:预热要在【组件之外】构出与首点逐字节同键的 body ——
//    差一个字节缓存就不是同一条,预热白打。语义与抽出前逐字节一致。
export function buildDunJiaNongliParamsPure(flds, options){
	if(!flds){
		return null;
	}
	const opts = options || DEFAULT_OPTIONS;
	const genderValue = (flds.gender && flds.gender.value !== undefined && flds.gender.value !== null)
		? flds.gender.value
		: opts.sex;
	const zoneValue = flds.zone && flds.zone.value !== undefined && flds.zone.value !== null
		? flds.zone.value
		: 8;
	const adValue = flds.ad && flds.ad.value !== undefined && flds.ad.value !== null
		? flds.ad.value
		: 1;
	const calcGeo = resolveCalcGeo(flds, opts);
	return {
		date: flds.date.value.format('YYYY-MM-DD'),
		time: flds.time.value.format('HH:mm:ss'),
		zone: zoneValue,
		lon: calcGeo.lon,
		lat: calcGeo.lat,
		gpsLat: calcGeo.gpsLat,
		gpsLon: calcGeo.gpsLon,
		ad: adValue,
		gender: genderValue,
		timeAlg: normalizeTimeAlg(opts.timeAlg),
		after23NewDay: getAfter23NewDayValue(opts),
		// v2.2.1: 透传时柱开关给后端 /nongli/time;后端 NongliController 已读入并传给 OnlyFourColumns。
		lateZiHourUseNextDay: resolveLateZiHourUseNextDay(opts && opts.lateZiHourUseNextDay),
	};
}

// R4-B3(数据层空闲预热的权威入口):遁甲 stage-1 = /nongli/time(真太阳时+四柱)
// + /jieqi/year(节气种子,仅该流派需要时)。两者是【确定性历法计算】,同参恒同果、无随机、
// 不依赖「现在」。options 取 normalizeKenQimenOptions(上次亲手设的排盘口径) —— 与组件构造时的初始选项同一口径
// (未从既有盘恢复时;没存过 = 出厂值),故 key/body 与用户首点逐字节一致。口径现在跨会话保留:预热若仍按出厂值构键,
// 存过「直接时间」之类的用户预热的就是一把用不上的键,首开反而白跑一趟。
// 🔴 绝不预热 /qimen/pan 本身:它吃 stage-1 结果 + 组件态(流派/排盘法),提前构不出同键。
// silent(两个 fetch 内置)、丢结果、绝不 dispatch/setState;失败静默。
// AI 助手·奇门择日的盘面口径:与内嵌奇门页(及奇门择日工作台首开播种)同一口径 —— 上次亲手设的排盘设置,没存过 = 出厂值
export function dunjiaZeriOptions(){
	return normalizeKenQimenOptions(DUNJIA_PAGE_SETTINGS.loadSaved());
}

export async function warmDunJiaStage1(fields){
	try{
		if(!fields || !fields.date || !fields.date.value || !fields.date.value.format){
			return null;
		}
		const options = normalizeKenQimenOptions(DUNJIA_PAGE_SETTINGS.loadSaved());
		const params = buildDunJiaNongliParamsPure(fields, options);
		if(!params){
			return null;
		}
		const jobs = [Promise.resolve(fetchPreciseNongli(params)).catch(()=>null)];
		const fixedOptions = {
			...options,
			jieQiType: 1,
			yearGanZhiType: 2,
			monthGanZhiType: 1,
			dayGanZhiType: 1,
		};
		if(needJieqiYearSeed(fixedOptions)){
			const year = parseInt(fields.date.value.format('YYYY'), 10);
			if(year && !Number.isNaN(year)){
				const calcGeo = resolveCalcGeo(fields, options);
				const seedParams = {
					year: `${year}`,
					ad: fields.ad ? fields.ad.value : 1,
					zone: fields.zone.value,
					lon: calcGeo.lon,
					lat: calcGeo.lat,
					gpsLat: calcGeo.gpsLat,
					gpsLon: calcGeo.gpsLon,
					timeAlg: normalizeTimeAlg(options.timeAlg),
					hsys: 0,
					zodiacal: 0,
					doubingSu28: false,
				};
				jobs.push(Promise.resolve(fetchPreciseJieqiSeed(seedParams)).catch(()=>null));
			}
		}
		await Promise.all(jobs);
		return true;
	}catch(e){
		return null;   // 预热失败静默:首点回到冷即付的现状
	}
}
