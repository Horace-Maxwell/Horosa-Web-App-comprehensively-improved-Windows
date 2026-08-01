import { currentEgyptSchool, egyptSchoolToRecordValues } from '../divination/data/egyptianSchools';

const LocalChartsKey = 'horosa.localCharts.v1';
const AstroAiSnapshotKey = 'horosa.ai.snapshot.astro.v1';
const ModuleAiSnapshotPrefix = 'horosa.ai.snapshot.module.v1.';
let fallbackToMemoryStore = false;
let fallbackWarned = false;
let memoryCharts = [];

function getLocalStorage(){
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			return window.localStorage;
		}
		if(typeof localStorage !== 'undefined'){
			return localStorage;
		}
	}catch(e){
		return null;
	}
	return null;
}

function warnMemoryFallback(){
	if(fallbackWarned){
		return;
	}
	fallbackWarned = true;
	if(typeof console !== 'undefined' && console && typeof console.warn === 'function'){
		console.warn('[horosa] localStorage unavailable, chart data falls back to memory for this session.');
	}
}

function enableMemoryFallback(){
	fallbackToMemoryStore = true;
	warnMemoryFallback();
}

function isQuotaError(err){
	if(!err){
		return false;
	}
	const name = `${err.name || ''}`;
	const code = Number(err.code || 0);
	const message = `${err.message || ''}`.toLowerCase();
	if(code === 22 || code === 1014){
		return true;
	}
	if(name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'){
		return true;
	}
	return message.indexOf('quota') >= 0;
}

function purgeHeavyLocalCache(){
	const storage = getLocalStorage();
	if(!storage){
		return;
	}
	try{
		storage.removeItem(AstroAiSnapshotKey);
	}catch(e){
		// ignore
	}
	const keys = [];
	try{
		for(let i=0; i<storage.length; i++){
			const key = storage.key(i);
			if(key && key.indexOf(ModuleAiSnapshotPrefix) === 0){
				keys.push(key);
			}
		}
	}catch(e){
		return;
	}
	keys.forEach((key)=>{
		try{
			storage.removeItem(key);
		}catch(e){
			// ignore
		}
	});
}

function safeParseJson(txt, defVal){
	if(!txt){
		return defVal;
	}
	try{
		return JSON.parse(txt);
	}catch(e){
		return defVal;
	}
}

function nowStr(){
	const dt = new Date();
	const y = dt.getFullYear();
	const m = String(dt.getMonth() + 1).padStart(2, '0');
	const d = String(dt.getDate()).padStart(2, '0');
	const hh = String(dt.getHours()).padStart(2, '0');
	const mm = String(dt.getMinutes()).padStart(2, '0');
	const ss = String(dt.getSeconds()).padStart(2, '0');
	return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function normalizeGroup(group){
	if(group === undefined || group === null || group === ''){
		return null;
	}
	if(group instanceof Array){
		return JSON.stringify(group);
	}
	if(typeof group === 'string'){
		const parsed = safeParseJson(group, null);
		if(parsed instanceof Array){
			return JSON.stringify(parsed);
		}
		return group;
	}
	return JSON.stringify([group]);
}

function normalizePayload(payload){
	if(payload === undefined || payload === null){
		return null;
	}
	if(typeof payload === 'string'){
		return payload;
	}
	try{
		return JSON.stringify(payload);
	}catch(e){
		return `${payload}`;
	}
}

function sortByUpdateTimeDesc(list){
	return list.sort((a, b)=>{
		const ta = Date.parse(a.updateTime || '') || 0;
		const tb = Date.parse(b.updateTime || '') || 0;
		return tb - ta;
	});
}

function readRawCharts(){
	if(fallbackToMemoryStore){
		return memoryCharts.slice();
	}
	const storage = getLocalStorage();
	if(!storage){
		enableMemoryFallback();
		return memoryCharts.slice();
	}
	let raw = null;
	try{
		raw = storage.getItem(LocalChartsKey);
	}catch(e){
		enableMemoryFallback();
		return memoryCharts.slice();
	}
	const ary = safeParseJson(raw, []);
	if(!(ary instanceof Array)){
		return [];
	}
	memoryCharts = ary.slice();
	return ary;
}

function writeRawCharts(list){
	const next = list instanceof Array ? list.slice() : [];
	memoryCharts = next;
	if(fallbackToMemoryStore){
		return true;
	}
	const storage = getLocalStorage();
	if(!storage){
		enableMemoryFallback();
		return true;
	}
	const text = JSON.stringify(next);
	try{
		storage.setItem(LocalChartsKey, text);
		return true;
	}catch(e){
		if(isQuotaError(e)){
			purgeHeavyLocalCache();
			try{
				storage.setItem(LocalChartsKey, text);
				return true;
			}catch(e2){
				// ignore and fallback below
			}
		}
		enableMemoryFallback();
		return true;
	}
}

export function listLocalCharts(filter){
	let list = readRawCharts();
	if(filter && filter.name){
		const name = (filter.name + '').trim().toLowerCase();
		if(name !== ''){
			list = list.filter((item)=>{
				const txt = item && item.name ? (item.name + '').toLowerCase() : '';
				return txt.indexOf(name) >= 0;
			});
		}
	}
	if(filter && filter.tag){
		const tag = filter.tag + '';
		if(tag !== ''){
			list = list.filter((item)=>{
				const grp = safeParseJson(item.group, []);
				return grp instanceof Array && grp.indexOf(tag) >= 0;
			});
		}
	}
	return sortByUpdateTimeDesc(list);
}

export function getPagedLocalCharts(params){
	const pidx = params && params.PageIndex ? parseInt(params.PageIndex + '', 10) : 1;
	const psz = params && params.PageSize ? parseInt(params.PageSize + '', 10) : 30;
	const list = listLocalCharts(params || {});
	const start = (pidx - 1) * psz;
	const end = start + psz;
	return {
		List: list.slice(start, end),
		Total: list.length,
		PageIndex: pidx,
		PageSize: psz,
	};
}

export function buildLocalChartRecord(values){
	const cid = values && values.cid ? values.cid : `local-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
	let birth = values.birth;
	if(birth && typeof birth.format === 'function'){
		birth = birth.format('YYYY-MM-DD HH:mm:ss');
	}
	const sourceModule = values.sourceModule ? values.sourceModule : null;
	// 埃及流派七轴随盘保真:values 显式提供(挂载 merge 场景)优先;否则捕获「当前全局非默认」的轴
	// (全默认不落键 = 旧记录语义与体积不变,零回归)。回放经 recordFieldsRestore 七键进 fields,
	// 快照链 egyptSchoolFromFields 优先消费 —— 同一命例重开【埃及历】段不随全局漂移。
	const egyptGlobal = egyptSchoolToRecordValues(currentEgyptSchool());
	const egyptVal = (k) => (values[k] !== undefined && values[k] !== null && values[k] !== '' ? values[k] : egyptGlobal[k]);
	const record = {
		cid: cid,
		name: values.name ? values.name : '',
		birth: birth ? birth : nowStr(),
		// 🔴 ad 权威 = birth 串前导负号(birth 由 date.value.format 产出,必然反映真实公元前后)。
		// values.ad 可能与 birth 不同步(调用方 fields.ad 未随 date.value.ad 更新 → BC 误存 ad:1,
		// 载入端 setAd(1) 把 BC 强转 AD → "载入无反应")。故负号优先纠正,只有非负号才回退 values.ad。
		ad: (birth && `${birth}`.trim().charAt(0) === '-') ? -1 : (values.ad !== undefined ? values.ad : 1),
		zone: values.zone !== undefined && values.zone !== null ? values.zone : '+08:00',
		lat: values.lat,
		lon: values.lon,
		gpsLat: values.gpsLat,
		gpsLon: values.gpsLon,
		pos: values.pos ? values.pos : '',
		gender: values.gender !== undefined && values.gender !== null ? parseInt(values.gender + '', 10) : -1,
		isPub: values.isPub !== undefined && values.isPub !== null ? parseInt(values.isPub + '', 10) : 0,
		doubingSu28: values.doubingSu28 !== undefined && values.doubingSu28 !== null ? Number(values.doubingSu28) : undefined,
		// 宿占人事十二宫起宫(ASC/八字公式):存盘落库,否则重开/挂载回退默认(与保存时盘面不符)。
		houseStartMode: values.houseStartMode !== undefined && values.houseStartMode !== null ? Number(values.houseStartMode) : undefined,
		group: normalizeGroup(values.group),
		creator: values.creator ? values.creator : 'local',
		updateTime: values.preserveUpdateTime && values.updateTime ? values.updateTime : nowStr(),
		memoAstro: values.memoAstro ? values.memoAstro : null,
		memoBaZi: values.memoBaZi ? values.memoBaZi : null,
		memoZiWei: values.memoZiWei ? values.memoZiWei : null,
		memo74: values.memo74 ? values.memo74 : null,
		memoGua: values.memoGua ? values.memoGua : null,
		memoLiuReng: values.memoLiuReng ? values.memoLiuReng : null,
		memoQiMeng: values.memoQiMeng ? values.memoQiMeng : null,
		memoSuZhan: values.memoSuZhan ? values.memoSuZhan : null,
		payload: normalizePayload(values.payload),
		sourceModule: sourceModule,
		chartType: values.chartType ? values.chartType : sourceModule,
		// 非地点/坐标参数: 必须随命盘存档,否则下次打开会被全局默认覆盖,导致日柱/时柱计算与保存时不一致。
		after23NewDay: values.after23NewDay !== undefined && values.after23NewDay !== null
			? parseInt(values.after23NewDay + '', 10)
			: (values.after23NewDay === undefined ? undefined : 1),
		orbs: (values.orbs && typeof values.orbs === 'object' && Object.keys(values.orbs).length) ? values.orbs : undefined,
		orbScale: (values.orbScale !== undefined && values.orbScale !== null && values.orbScale !== 1) ? values.orbScale : undefined,
		lateZiHourUseNextDay: values.lateZiHourUseNextDay !== undefined && values.lateZiHourUseNextDay !== null
			? parseInt(values.lateZiHourUseNextDay + '', 10)
			: undefined,
		timeAlg: values.timeAlg !== undefined && values.timeAlg !== null
			? parseInt(values.timeAlg + '', 10)
			: undefined,
		// 主限法视图配置(方法/时间换算/方向类型/顺逆/映点/界):随命盘存档,AI 挂载时 recordToFields 复原,
		// 否则重新打开/挂载会回退默认 Alcabitius+Ptolemy+黄道,与保存时的推运视图不一致。仅在 values 提供时落库。
		pdMethod: values.pdMethod !== undefined && values.pdMethod !== null ? values.pdMethod : undefined,
		pdTimeKey: values.pdTimeKey !== undefined && values.pdTimeKey !== null ? values.pdTimeKey : undefined,
		pdtype: values.pdtype !== undefined && values.pdtype !== null ? parseInt(values.pdtype + '', 10) : undefined,
		pdDirect: values.pdDirect !== undefined && values.pdDirect !== null ? parseInt(values.pdDirect + '', 10) : undefined,
		pdConverse: values.pdConverse !== undefined && values.pdConverse !== null ? parseInt(values.pdConverse + '', 10) : undefined,
		pdAntiscia: values.pdAntiscia !== undefined && values.pdAntiscia !== null ? parseInt(values.pdAntiscia + '', 10) : undefined,
		pdTerms: values.pdTerms !== undefined && values.pdTerms !== null ? parseInt(values.pdTerms + '', 10) : undefined,
		// P0 解耦补齐九键(存了必还原;recordFieldsRestore manifest 成对):
		pdProjection: values.pdProjection !== undefined && values.pdProjection !== null ? values.pdProjection : undefined,
		pdFrame: values.pdFrame !== undefined && values.pdFrame !== null ? values.pdFrame : undefined,
		pdFramework: values.pdFramework !== undefined && values.pdFramework !== null ? values.pdFramework : undefined,
		pdParallel: values.pdParallel !== undefined && values.pdParallel !== null ? parseInt(values.pdParallel + '', 10) : undefined,
		pdRaptParallel: values.pdRaptParallel !== undefined && values.pdRaptParallel !== null ? parseInt(values.pdRaptParallel + '', 10) : undefined,
		pdTimeKeyCustom: values.pdTimeKeyCustom !== undefined && values.pdTimeKeyCustom !== null ? Number(values.pdTimeKeyCustom) : undefined,
		pdSignificators: Array.isArray(values.pdSignificators) && values.pdSignificators.length ? values.pdSignificators : undefined,
		pdPromissorTypes: Array.isArray(values.pdPromissorTypes) && values.pdPromissorTypes.length ? values.pdPromissorTypes : undefined,
		termsVariant: values.termsVariant !== undefined && values.termsVariant !== null ? parseInt(values.termsVariant + '', 10) : undefined,
		// AI 挂载「每技法设置」可调的占星排盘开关 + 数算/八字取用 + 七政命度模式:仅在 values 提供时落库
		// (present 才落库,对齐 pd* 写法),否则 buildFieldObject 回退现状默认 → 不破坏既有命盘。
		hsys: values.hsys !== undefined && values.hsys !== null ? values.hsys : undefined,
		zodiacal: values.zodiacal !== undefined && values.zodiacal !== null ? parseInt(values.zodiacal + '', 10) : undefined,
		siderealAyanamsa: values.siderealAyanamsa !== undefined && values.siderealAyanamsa !== null ? (values.siderealAyanamsa + '') : undefined,
		tradition: values.tradition !== undefined && values.tradition !== null ? parseInt(values.tradition + '', 10) : undefined,
		// 界系变体 + 古典占星(希腊化)参数:界主/三分集/西占交点真平/区分缓冲/狮子土星界优先/福点反转。
		// 这些已在 astro 模型 fields(随保存表单 ChartAddFormComp 流入 values)、且 buildFieldObject(aiAnalysisContext)
		// 读回 → fieldsToParams 条件透传,但此前 buildLocalChartRecord 未枚举 → 存盘即丢、重开/挂载回退默认(界系尊贵/福点
		// 与保存时盘面不一致)。仅在 values 提供时落库(present 才落,对齐 hsys/pd* 写法),否则 buildFieldObject 回退现状默认。
		termsVariant: values.termsVariant !== undefined && values.termsVariant !== null ? parseInt(values.termsVariant + '', 10) : undefined,
		geminiBoundEmended: values.geminiBoundEmended !== undefined && values.geminiBoundEmended !== null ? parseInt(values.geminiBoundEmended + '', 10) : undefined,
		// 2026-07 二批九键(落宫/三态/空亡/恒星/映点):present 才落库,与 termsVariant 同纪律。
		houseCuspAdvance: values.houseCuspAdvance !== undefined && values.houseCuspAdvance !== null ? parseInt(values.houseCuspAdvance + '', 10) : undefined,
		cazimiOrb: values.cazimiOrb !== undefined && values.cazimiOrb !== null ? Number(values.cazimiOrb) : undefined,
		combustOrb: values.combustOrb !== undefined && values.combustOrb !== null ? Number(values.combustOrb) : undefined,
		underBeamsOrb: values.underBeamsOrb !== undefined && values.underBeamsOrb !== null ? Number(values.underBeamsOrb) : undefined,
		vocMode: values.vocMode !== undefined && values.vocMode !== null ? (values.vocMode + '') : undefined,
		vocIncludeOuter: values.vocIncludeOuter !== undefined && values.vocIncludeOuter !== null ? parseInt(values.vocIncludeOuter + '', 10) : undefined,
		fixedStarOrb: values.fixedStarOrb !== undefined && values.fixedStarOrb !== null ? Number(values.fixedStarOrb) : undefined,
		fixedStarOrbMode: values.fixedStarOrbMode !== undefined && values.fixedStarOrbMode !== null ? (values.fixedStarOrbMode + '') : undefined,
		antisciaOrb: values.antisciaOrb !== undefined && values.antisciaOrb !== null ? Number(values.antisciaOrb) : undefined,
		// 2026-07 四批:燃烧之路边界档(排盘键,present 才落库;partileDef 纯前端显示键有意不随盘存)。
		viaCombustaVariant: values.viaCombustaVariant !== undefined && values.viaCombustaVariant !== null ? (values.viaCombustaVariant + '') : undefined,
		westNodeType: values.westNodeType !== undefined && values.westNodeType !== null ? (values.westNodeType + '') : undefined,
		sectBuffer: values.sectBuffer !== undefined && values.sectBuffer !== null ? (values.sectBuffer + '') : undefined,
		leoBoundFirst: values.leoBoundFirst !== undefined && values.leoBoundFirst !== null ? parseInt(values.leoBoundFirst + '', 10) : undefined,
		triplicity: values.triplicity !== undefined && values.triplicity !== null ? (values.triplicity + '') : undefined,
		lotReversal: values.lotReversal !== undefined && values.lotReversal !== null ? parseInt(values.lotReversal + '', 10) : undefined,
		// 希腊补齐三开关(点公式文档口径/交点旺/土星旺20°):present 才落库,老盘结构零变;
		// 缺此三行 = 存盘再载入后开关静默丢失、盘变样(与既有六键同一范式)。
		lotsDocReverse: values.lotsDocReverse !== undefined && values.lotsDocReverse !== null ? parseInt(values.lotsDocReverse + '', 10) : undefined,
		nodeExaltation: values.nodeExaltation !== undefined && values.nodeExaltation !== null ? parseInt(values.nodeExaltation + '', 10) : undefined,
		saturnExalt20: values.saturnExalt20 !== undefined && values.saturnExalt20 !== null ? parseInt(values.saturnExalt20 + '', 10) : undefined,
		strongRecption: values.strongRecption !== undefined && values.strongRecption !== null ? parseInt(values.strongRecption + '', 10) : undefined,
		simpleAsp: values.simpleAsp !== undefined && values.simpleAsp !== null ? parseInt(values.simpleAsp + '', 10) : undefined,
		virtualPointReceiveAsp: values.virtualPointReceiveAsp !== undefined && values.virtualPointReceiveAsp !== null ? parseInt(values.virtualPointReceiveAsp + '', 10) : undefined,
		southchart: values.southchart !== undefined && values.southchart !== null ? parseInt(values.southchart + '', 10) : undefined,
		phaseType: values.phaseType !== undefined && values.phaseType !== null ? parseInt(values.phaseType + '', 10) : undefined,
		godKeyPos: values.godKeyPos !== undefined && values.godKeyPos !== null ? values.godKeyPos : undefined,
		adjustJieqi: values.adjustJieqi !== undefined && values.adjustJieqi !== null ? parseInt(values.adjustJieqi + '', 10) : undefined,
		guolaoLifeMode: values.guolaoLifeMode !== undefined && values.guolaoLifeMode !== null ? values.guolaoLifeMode : undefined,
		// 七政四余身宫模式:astro 模型 fields.guolaoBodyMode + buildFieldObject 读回(:411),但此前未落库 → 与 lifeMode/nodeMode
		// 同源却独漏,存盘丢失重开回退默认。仅在 values 提供时落库。
		guolaoBodyMode: values.guolaoBodyMode !== undefined && values.guolaoBodyMode !== null ? values.guolaoBodyMode : undefined,
		// 七政四余 G6/G10/G11/G12/WP-D 起盘设置:报时星太阳时 / 罗计真平 / 月孛真平 / 恒星黄道岁差 / 授时古法推变·古宿岁差·赤道锚点。
		// 这些均在 astro 模型 fields(随 ChartAddFormComp.clickOk 拷 fields.*.value 流入 values)、且 GuoLaoChartMain
		// 的 guolaoFieldValue/guolaoAyanamsaFromFields/fieldsToParams 据 fields 读回算盘,但此前 buildLocalChartRecord 未枚举
		// → 存盘即丢、重开/AI 挂载回退全局 localStorage 默认(与保存时盘面不一致,同 termsVariant/guolaoBodyMode 旧坑)。
		// 仅在 values 提供时落库(present 才落,对齐 guolaoBodyMode 写法);buildFieldObject 配套读回供 builder 取盘。
		guolaoTrueSolarTime: values.guolaoTrueSolarTime !== undefined && values.guolaoTrueSolarTime !== null ? values.guolaoTrueSolarTime : undefined,
		guolaoNodeType: values.guolaoNodeType !== undefined && values.guolaoNodeType !== null ? values.guolaoNodeType : undefined,
		guolaoLilithType: values.guolaoLilithType !== undefined && values.guolaoLilithType !== null ? values.guolaoLilithType : undefined,
		guolaoAyanamsa: values.guolaoAyanamsa !== undefined && values.guolaoAyanamsa !== null ? (values.guolaoAyanamsa + '') : undefined,
		guolaoTuibianMethod: values.guolaoTuibianMethod !== undefined && values.guolaoTuibianMethod !== null ? values.guolaoTuibianMethod : undefined,
		guolaoGufaPrecess: values.guolaoGufaPrecess !== undefined && values.guolaoGufaPrecess !== null ? parseInt(values.guolaoGufaPrecess + '', 10) : undefined,
		guolaoEqTropicalAnchor: values.guolaoEqTropicalAnchor !== undefined && values.guolaoEqTropicalAnchor !== null ? values.guolaoEqTropicalAnchor : undefined,
		indiaHsys: values.indiaHsys !== undefined && values.indiaHsys !== null ? values.indiaHsys : undefined,
		indiaAyanamsa: values.indiaAyanamsa !== undefined && values.indiaAyanamsa !== null ? (values.indiaAyanamsa + '') : undefined,
		// 印占交点真平 / 大运体系 / Sthira 起座:buildFieldObject 读回(:415/:416/:419)+ 有挂载「每技法设置」schema,
		// 与 indiaHsys/indiaAyanamsa 同源却独漏落库 → 存盘/挂载回退默认(大运体系回退 Vimshottari、Sthira 回退 lagna)。
		// 仅在 values 提供时落库(对齐 indiaHsys/indiaAyanamsa 写法)。
		indiaNodeType: values.indiaNodeType !== undefined && values.indiaNodeType !== null ? (values.indiaNodeType + '') : undefined,
		indiaDashaSystem: values.indiaDashaSystem !== undefined && values.indiaDashaSystem !== null ? (values.indiaDashaSystem + '') : undefined,
		indiaSthiraStart: values.indiaSthiraStart !== undefined && values.indiaSthiraStart !== null ? (values.indiaSthiraStart + '') : undefined,
		// 大运起点 seed / 过运日期 / 年度盘年份 / 分盘集:与 indiaDashaSystem/indiaSthiraStart 同源,buildFieldObject 读回供
		// snapshot fieldsToParams 透传后端。漏落库 → 存盘/挂载这 4 设置回退默认、AI 与盘不一致。仅在 values 提供时落库。
		// 注:tajakaYear 数字、vargaSet 数组或 "1,9,10" 串、transitDate 日期串 → 一律原样存(不 +'' 强转,避免破坏非字符串类型)。
		indiaDashaSeed: values.indiaDashaSeed !== undefined && values.indiaDashaSeed !== null ? values.indiaDashaSeed : undefined,
		indiaTransitDate: values.indiaTransitDate !== undefined && values.indiaTransitDate !== null ? values.indiaTransitDate : undefined,
		indiaTajakaYear: values.indiaTajakaYear !== undefined && values.indiaTajakaYear !== null ? values.indiaTajakaYear : undefined,
		indiaVargaSet: values.indiaVargaSet !== undefined && values.indiaVargaSet !== null ? values.indiaVargaSet : undefined,
		// 大运年长 / 年盘口径(G5/G13):同上成对入库,restore + aiAnalysisContext 读回。年长存数值原样。
		indiaDashaYearLength: values.indiaDashaYearLength !== undefined && values.indiaDashaYearLength !== null ? values.indiaDashaYearLength : undefined,
		indiaAnnualChartType: values.indiaAnnualChartType !== undefined && values.indiaAnnualChartType !== null ? (values.indiaAnnualChartType + '') : undefined,
		// 流派(五支软预设包;数值层由 ayanamsa/hsys 承载,此键供摘要/快照语境层)。
		indiaSchool: values.indiaSchool !== undefined && values.indiaSchool !== null ? (values.indiaSchool + '') : undefined,
		// W1 三设置:分盘变体(JSON 串原样)/卡拉卡方案/星曜战判据,restore + aiAnalysisContext 读回。
		indiaVargaVariant: values.indiaVargaVariant !== undefined && values.indiaVargaVariant !== null ? values.indiaVargaVariant : undefined,
		indiaDashaVariants: values.indiaDashaVariants !== undefined && values.indiaDashaVariants !== null ? values.indiaDashaVariants : undefined,
		indiaVarshaLat: values.indiaVarshaLat !== undefined && values.indiaVarshaLat !== null ? values.indiaVarshaLat : undefined,
		indiaVarshaLon: values.indiaVarshaLon !== undefined && values.indiaVarshaLon !== null ? values.indiaVarshaLon : undefined,
		indiaKarakaScheme: values.indiaKarakaScheme !== undefined && values.indiaKarakaScheme !== null ? (values.indiaKarakaScheme + '') : undefined,
		indiaYuddhaCriterion: values.indiaYuddhaCriterion !== undefined && values.indiaYuddhaCriterion !== null ? (values.indiaYuddhaCriterion + '') : undefined,
		guolaoNodeMode: values.guolaoNodeMode !== undefined && values.guolaoNodeMode !== null ? values.guolaoNodeMode : undefined,
		// 紫微四化流派 + 10 传本/排盘开关:buildChartZiweiParams(aiAnalysisContext:1133-1142)据 record.sihuaSchool / record.<传本键>
		// 临时切 ZWSchool/ZWEngineOptions 重算供 buildZiweiSnapshotForParams;techniqueMountSettings.ziwei schema 也暴露这些为
		// 「每技法设置」可调项。但此前 buildLocalChartRecord 未枚举 → 存盘即丢、重开/AI 挂载回退全局单例默认(与保存时排盘方案不符,
		// 同 termsVariant/guolao* 旧坑)。仅在 values 提供时落库(present 才落,对齐 guolao* 写法);缺省 undefined → builder 回退全局
		// 单例 = 现状字节级一致(零回归)。后端 /ziwei/birth 不读这些键(本地引擎消费)。
		sihuaSchool: values.sihuaSchool !== undefined && values.sihuaSchool !== null ? values.sihuaSchool : undefined,
		daxianSpan: values.daxianSpan !== undefined && values.daxianSpan !== null ? values.daxianSpan : undefined,
		tianmaBasis: values.tianmaBasis !== undefined && values.tianmaBasis !== null ? values.tianmaBasis : undefined,
		starSet: values.starSet !== undefined && values.starSet !== null ? values.starSet : undefined,
		sanPan: values.sanPan !== undefined && values.sanPan !== null ? values.sanPan : undefined,
		shangShi: values.shangShi !== undefined && values.shangShi !== null ? values.shangShi : undefined,
		leapMonth: values.leapMonth !== undefined && values.leapMonth !== null ? values.leapMonth : undefined,
		lateZi: values.lateZi !== undefined && values.lateZi !== null ? values.lateZi : undefined,
		yearBoundary: values.yearBoundary !== undefined && values.yearBoundary !== null ? values.yearBoundary : undefined,
		huoling: values.huoling !== undefined && values.huoling !== null ? values.huoling : undefined,
		kongNaming: values.kongNaming !== undefined && values.kongNaming !== null ? values.kongNaming : undefined,
		// 星曜亮度 + 六个流派叠层开关 + 太岁关系人:buildChartZiweiParams 早就按 record.<key> 重算,
		// techniqueMountSettings 也全暴露为可调项,唯独此处没枚举 → 存盘即丢,重开/挂载回退默认。
		brightnessSource: values.brightnessSource !== undefined && values.brightnessSource !== null ? values.brightnessSource : undefined,
		childLimit: values.childLimit !== undefined && values.childLimit !== null ? values.childLimit : undefined,
		zhongxian: values.zhongxian !== undefined && values.zhongxian !== null ? values.zhongxian : undefined,
		huoPan: values.huoPan !== undefined && values.huoPan !== null ? values.huoPan : undefined,
		qishuWei: values.qishuWei !== undefined && values.qishuWei !== null ? values.qishuWei : undefined,
		borrowPalace: values.borrowPalace !== undefined && values.borrowPalace !== null ? values.borrowPalace : undefined,
		taiSuiRuGua: values.taiSuiRuGua !== undefined && values.taiSuiRuGua !== null ? values.taiSuiRuGua : undefined,
		taiSuiRelatives: values.taiSuiRelatives !== undefined && values.taiSuiRelatives !== null ? values.taiSuiRelatives : undefined,
		// 八字断命流派:buildChartBaziParams(aiAnalysisContext:1047)据 record.school 切 buildBaziSnapshotText 的「当前主用流派」标注;
		// techniqueMountSettings.bazi schema 暴露为可调项。漏落库 → 存盘/挂载回退默认「传统综合」、与保存时标注不一致。仅在 values
		// 提供时落库;缺省 undefined → builder 回退默认 = 现状字节级一致(各派对照数据恒全算,此项只切主标注,零回归)。
		school: values.school !== undefined && values.school !== null ? values.school : undefined,
		coordSystem: values.coordSystem !== undefined && values.coordSystem !== null ? (values.coordSystem + '') : undefined,
		windowMonths: values.windowMonths !== undefined && values.windowMonths !== null ? parseInt(values.windowMonths + '', 10) : undefined,
		marketPreset: values.marketPreset !== undefined && values.marketPreset !== null ? (values.marketPreset + '') : undefined,
		// 埃及七键逐行登记于字面量内(recordFieldsRestore 三清单守卫按 ^\t\t(\w+): 静态扫描)
		egypt_decanRuler: egyptVal('egypt_decanRuler'),
		egypt_decanAnchor: egyptVal('egypt_decanAnchor'),
		egypt_decanNaming: egyptVal('egypt_decanNaming'),
		egypt_starClock: egyptVal('egypt_starClock'),
		egypt_calendarAnchor: egyptVal('egypt_calendarAnchor'),
		egypt_petosirisMod: egyptVal('egypt_petosirisMod'),
		egypt_godEdition: egyptVal('egypt_godEdition'),
	};
	return record;
}

export function upsertLocalChart(values){
	const list = readRawCharts();
	const cid = values && values.cid ? values.cid : null;
	const idx = cid ? list.findIndex((item)=> item.cid === cid) : -1;
	const base = idx >= 0 ? list[idx] : {};
	const next = buildLocalChartRecord({
		...base,
		...(values || {}),
	});
	if(idx >= 0){
		list[idx] = {
			...list[idx],
			...next,
		};
	}else{
		list.push(next);
	}
	const saved = writeRawCharts(sortByUpdateTimeDesc(list));
	if(!saved){
		throw new Error('local.chart.save.failed');
	}
	return next;
}

export function removeLocalChart(cid){
	const list = readRawCharts();
	const next = list.filter((item)=> item.cid !== cid);
	const saved = writeRawCharts(next);
	if(!saved){
		throw new Error('local.chart.delete.failed');
	}
}

export function exportLocalChartsBackup(){
	const charts = sortByUpdateTimeDesc(readRawCharts().slice());
	return {
		format: 'horosa-local-charts',
		version: 1,
		exportedAt: nowStr(),
		total: charts.length,
		charts: charts,
	};
}

export function importLocalChartsBackup(payload){
	if(!payload || typeof payload !== 'object'){
		return { imported: 0, total: readRawCharts().length };
	}
	const incoming = payload.charts;
	if(!(incoming instanceof Array)){
		return { imported: 0, total: readRawCharts().length };
	}
	let imported = 0;
	incoming.forEach((item)=>{
		if(!item || typeof item !== 'object'){
			return;
		}
		upsertLocalChart({
			...item,
			preserveUpdateTime: true,
		});
		imported += 1;
	});
	const total = readRawCharts().length;
	return { imported, total };
}
