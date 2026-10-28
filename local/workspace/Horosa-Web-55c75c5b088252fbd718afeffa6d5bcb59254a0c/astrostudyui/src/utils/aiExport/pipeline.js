// AI 导出 · 编排:候选键与兜底键、按键取内容、拼载荷、当前页导出(供工具调用)、截图附加、导出主流程。
// 由 utils/aiExport.js 门面统一对外导出。
import { getStore } from '../storageutil';
import { copyTextSmart } from '../clipboardText';
import request from '../request';
import * as ExportConstants from '../constants';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../dayBoundary';
import { buildClassicalAnalysisSection } from '../astroAiSnapshot';
import { buildAcgSectionText } from '../acgSnapshot';
import { buildAIExportLegendSection } from '../aiExportLegend';
import { fixedStarOrbParamsFor } from '../classicalChartGlobals';   // 导出 [古典格局] 恒星轨与右栏/挂载同全局仓
import { capturePageScreenshotForExport } from '../pageScreenshot';
import { isAstroLikeExportKey, AI_EXPORT_TECHNIQUES } from './presets';
import {
	uniqueArray, extractSectionTitles, getAIExportFormatPreference, isAIExportScreenshotEnabled, isAIExportLegendEnabled,
	isAIExportSubjectFactsEnabled, snapshotModuleKeyByContextKey, isJieQiSplitSettingKey,
} from './settingsModel';
import {
	stripForbiddenSections, isUserSectionsExplicitlyCleared, applyUserSectionFilterByContext, applyPlanetInfoFilterByContext,
} from './sectionFilter';
import {
	resolveActiveContext, resolveContextByAstroState, withStoreContextFallback,
	detectJieQiSettingKeyByCurrentSnapshot, detectJieQiSettingKeyByScope, resolveExportContextForPayload,
} from './contextResolve';
import { buildSubjectFactsExportSection } from './settingsGroups';
import {
	extractAstroContent, extractSixYaoContent, extractLiuRengContent, extractJinKouContent, extractQiMenContent,
	extractSanShiUnitedContent, extractTongSheFaContent, extractTaiYiContent, extractGermanyContent,
	extractJieQiContent, extractPrimaryDirectContent, extractPrimaryDirChartContent, extractZodialReleaseContent,
	extractFirdariaContent, extractProfectionContent, extractSolarArcContent, extractSolarReturnContent,
	extractLunarReturnContent, extractGivenYearContent, extractDecennialsContent, extractRelativeContent,
	extractSimpleModuleContent, extractOtherBuContent, extractFengShuiContent, extractCalendarContent,
	extractGenericContent, isKentangRawExportKey,
} from './extractors';
import { normalizeText, applyAstroMeaningFilterByContext } from './meaning';
import { normalizeExportKey, isPredictiveExportKey, getTechniqueLabelByKey } from './exportKeys';
import {
	safeFileName, formatDateTime, formatStamp, _pdfExportedViaPrint, _pdfExportedViaVector, exportPdf, exportTxt, exportWord, exportDocx,
} from './output';

function isStrictSpecificExportKey(key){
	const val = normalizeExportKey(key);
	if(!val){
		return false;
	}
	if(val === 'generic' || val === 'cntradition' || val === 'cnyibu'){
		return false;
	}
	return AI_EXPORT_TECHNIQUES.some((item)=>item.key === val);
}

function isAstroFamilyExportKey(key){
	const val = normalizeExportKey(key);
	if(!val){
		return false;
	}
	if(isPredictiveExportKey(val)){
		return true;
	}
	return val === 'astrochart'
		|| isAstroLikeExportKey(val)
		|| val === 'indiachart'
		|| val === 'relative'
		|| val === 'germany'
		|| val === 'jieqi'
		|| val === 'guolao';
}

function getCandidateExportKeys(context){
	const keys = [];
	const primary = normalizeExportKey(context && context.key ? context.key : '');
	if(primary){
		keys.push(primary);
	}
	const hasPrimarySpecific = !!primary && primary !== 'generic';
	const stateContext = resolveContextByAstroState();
	const stateKey = normalizeExportKey(stateContext && stateContext.key ? stateContext.key : '');
	const shouldAppendStateKey = !!stateKey && (
		!hasPrimarySpecific
		|| stateKey === primary
		|| !isStrictSpecificExportKey(primary)
	);
	if(shouldAppendStateKey){
		keys.push(stateKey);
	}

	const topInfo = [
		context && context.topLabel ? context.topLabel : '',
		context && context.displayName ? context.displayName : '',
		stateContext && stateContext.displayName ? stateContext.displayName : '',
	].join(' ');
	const predictiveKeys = ['primarydirect', 'primarydirchart', 'zodialrelease', 'firdaria', 'distributions', 'agepoint', 'ephemeris', 'returntimeline', 'prenatalsyzygy', 'profection', 'solararc', 'solarreturn', 'lunarreturn', 'givenyear', 'decennials', 'planetaryages', 'prog', 'vedicprog', 'jaynesprog', 'planetaryarc', 'persiandirected', 'yearsystem129', 'balbillus', 'triplicityrulers', 'keypoints', 'lunationphase', 'extrareturns'];
	const primaryIsPredictive = isPredictiveExportKey(primary);
	const stateIsPredictive = isPredictiveExportKey(stateKey);
	// 仅在上下文无法定位具体推运子模块时，才展开推运候选全量兜底；
	// 避免“太阳弧导出成主限法”这类串台。
	if((topInfo.includes('星运') || topInfo.includes('推运盘') || stateIsPredictive) && !primaryIsPredictive){
		keys.push(...predictiveKeys);
	}
	if(topInfo.includes('三式合一') && !hasPrimarySpecific){
		keys.push('sanshiunited', 'qimen', 'jinkou', 'liureng', 'sixyao', 'tongshefa', 'taiyi');
	}
	// 🔴 「XX择日」上下文不走主技法分支(否则 taiyi/liureng 等旧快照排在 zeri 专名键前,
	// 降级路径串台——审查实抓;zeri 专名链在下方 else-if 梯)。互斥判必须写 indexOf('择日')<0,
	// 勿写 !includes('择日')——preflight [222-229] 用「includes('择日') && !hasPrimarySpecific」
	// 定位裸「择日」分支行号,!includes 形会被子串穿透误定位(踩过)。
	if((topInfo.includes('易与三式') || topInfo.includes('其他术数') || topInfo.includes('六爻')
		|| topInfo.includes('六壬') || topInfo.includes('金口诀') || topInfo.includes('遁甲') || topInfo.includes('太乙')
		|| topInfo.includes('皇极') || topInfo.includes('五兆') || topInfo.includes('太玄') || topInfo.includes('荆诀') || topInfo.includes('神易')) && topInfo.indexOf('择日') < 0 && !hasPrimarySpecific){
		keys.push('suzhan', 'sixyao', 'jinkou', 'liureng', 'qimen', 'taiyi', 'tongshefa', 'huangji', 'wuzhao', 'taixuan', 'jingjue', 'shenyishu');
	}
	if((topInfo.includes('数算') || topInfo.includes('邵子') || topInfo.includes('铁板') || topInfo.includes('鬼谷') || topInfo.includes('北极') || topInfo.includes('南极') || topInfo.includes('蠢子')) && !hasPrimarySpecific){
		keys.push('shaozi', 'tieban', 'fendjing', 'beiji', 'nanji', 'chunzi');
	}
	if((topInfo.includes('演禽') || topInfo.includes('仙禽')) && !hasPrimarySpecific){
		keys.push('xianqin');
	}
	if(topInfo.includes('策天') && !hasPrimarySpecific){
		keys.push('cetian');
	}
	if((topInfo.includes('八字紫微') || topInfo.includes('八字') || topInfo.includes('紫微')) && topInfo.indexOf('择日') < 0 && !hasPrimarySpecific){
		keys.push('bazi', 'ziwei');
	}
	if(topInfo.includes('量化盘') && !hasPrimarySpecific){
		keys.push('germany');
	}
	if(topInfo.includes('卜卦') && !hasPrimarySpecific){
		keys.push('horary');
	}
	if(topInfo.includes('黄历择日') && !hasPrimarySpecific){
		// 「择日」是各子技法名的子串——专属分支必须先行,否则 zeri 页上下文被串成辅盘择日盘
		keys.push('huanglizeri');
	}else if(topInfo.includes('八字择日') && !hasPrimarySpecific){
		keys.push('bazizeri');
	}else if(topInfo.includes('太乙择日') && !hasPrimarySpecific){
		keys.push('taiyizeri');
	}else if(topInfo.includes('紫微择日') && !hasPrimarySpecific){
		keys.push('ziweizeri');
	}else if(topInfo.includes('六壬择日') && !hasPrimarySpecific){
		keys.push('liurengzeri');
	}else if(topInfo.includes('三式择日') && !hasPrimarySpecific){
		keys.push('sanshizeri');
	}else if(topInfo.includes('七政择日') && !hasPrimarySpecific){
		keys.push('qizhengzeri');
	}else if(topInfo.includes('印度择日') && !hasPrimarySpecific){
		keys.push('indiazeri');
	}else if(topInfo.includes('奇门择日') && !hasPrimarySpecific){
		keys.push('qimenzeri');
	}else if(topInfo.includes('天星择日') && !hasPrimarySpecific){
		keys.push('tianxing');
	}else if(topInfo.includes('择日') && !hasPrimarySpecific){
		keys.push('election');
	}
	if(topInfo.includes('世俗') && !hasPrimarySpecific){
		keys.push('mundane');
	}
	if((topInfo.includes('合盘') || topInfo.includes('关系盘')) && !hasPrimarySpecific){
		keys.push('relative');
	}
	if(topInfo.includes('七政四余') && !hasPrimarySpecific){
		keys.push('qizhengkin', 'guolao');
	}
	if(topInfo.includes('节气盘') && !hasPrimarySpecific){
		keys.push('jieqi');
	}
	if((topInfo.includes('印度占星') || topInfo.includes('印度律盘')) && !hasPrimarySpecific){
		keys.push('indiachart');
	}
	if((topInfo.includes('星盘') || topInfo.includes('三维盘') || topInfo.includes('十三分盘') || topInfo.includes('希腊星术') || topInfo.includes('占星地图') || topInfo.includes('星体地图')) && !hasPrimarySpecific){
		keys.push('astrochart', 'astrochart_like');
	}

	// 兜底候选：确保上下文误判时仍能从计算快照抓到内容。
	if(!hasPrimarySpecific){
		keys.push('astrochart', 'astrochart_like', 'indiachart', 'relative', 'germany', 'jieqi', 'guolao', 'qizhengkin', 'bazi', 'ziwei', 'qimen', 'liureng', 'jinkou', 'sanshiunited', 'tongshefa', 'huangji', 'wuzhao', 'taixuan', 'jingjue', 'shenyishu', 'sixyao', 'taiyi', 'shaozi', 'tieban', 'fendjing', 'beiji', 'nanji', 'chunzi', 'xianqin', 'cetian', 'otherbu', 'fengshui');
	}

	return uniqueArray(keys.map((key)=>normalizeExportKey(key)).filter(Boolean));
}

function getRescueExportKeys(context, fallbackStateContext, triedKeys){
	const tried = triedKeys instanceof Set ? triedKeys : new Set();
	const keys = [];
	const push = (...arr)=>{
		arr.forEach((item)=>{
			const key = normalizeExportKey(item);
			if(!key || key === 'generic'){
				return;
			}
			if(tried.has(key)){
				return;
			}
			if(keys.includes(key)){
				return;
			}
			keys.push(key);
		});
	};

	const contextKey = normalizeExportKey(context && context.key ? context.key : '');
	const stateKey = normalizeExportKey(fallbackStateContext && fallbackStateContext.key ? fallbackStateContext.key : '');
	const hasContextSpecific = isStrictSpecificExportKey(contextKey);
	const topInfo = [
		context && context.topLabel ? context.topLabel : '',
		context && context.displayName ? context.displayName : '',
		fallbackStateContext && fallbackStateContext.displayName ? fallbackStateContext.displayName : '',
	].join(' ');

	push(contextKey);
	if(!hasContextSpecific){
		push(stateKey);
	}
	if(hasContextSpecific){
		if(contextKey === 'jieqi'){
			push('jieqi', 'jieqi_current');
			return keys;
		}
		push(contextKey);
		return keys;
	}
	if(topInfo.includes('星运') || topInfo.includes('推运盘') || topInfo.includes('主限法') || topInfo.includes('法达星限')
		|| topInfo.includes('太阳弧') || topInfo.includes('太阳返照') || topInfo.includes('月亮返照')){
		push('primarydirect', 'primarydirchart', 'firdaria', 'zodialrelease', 'profection', 'solararc', 'solarreturn', 'lunarreturn', 'givenyear', 'decennials', 'planetaryages', 'prog', 'vedicprog', 'jaynesprog', 'planetaryarc', 'persiandirected', 'yearsystem129', 'balbillus', 'triplicityrulers', 'keypoints', 'lunationphase', 'extrareturns');
	}
	if(topInfo.includes('三式合一')){
		push('sanshiunited', 'qimen', 'jinkou', 'liureng', 'sixyao', 'tongshefa', 'taiyi', 'astrochart');
	}
	if(topInfo.includes('易与三式') || topInfo.includes('其他术数') || topInfo.includes('六爻')
		|| topInfo.includes('六壬') || topInfo.includes('金口诀') || topInfo.includes('遁甲') || topInfo.includes('太乙')
		|| topInfo.includes('皇极') || topInfo.includes('五兆') || topInfo.includes('太玄') || topInfo.includes('荆诀') || topInfo.includes('神易')){
		push('jinkou', 'liureng', 'qimen', 'sixyao', 'tongshefa', 'huangji', 'wuzhao', 'taixuan', 'jingjue', 'shenyishu', 'taiyi', 'suzhan');
	}
	if(topInfo.includes('数算') || topInfo.includes('邵子') || topInfo.includes('铁板') || topInfo.includes('鬼谷') || topInfo.includes('北极') || topInfo.includes('南极') || topInfo.includes('蠢子')){
		push('shaozi', 'tieban', 'fendjing', 'beiji', 'nanji', 'chunzi');
	}
	if(topInfo.includes('演禽') || topInfo.includes('仙禽')){
		push('xianqin');
	}
	if(topInfo.includes('策天')){
		push('cetian');
	}
	if(topInfo.includes('八字') || topInfo.includes('紫微')){
		push('bazi', 'ziwei');
	}
	if(topInfo.includes('合盘') || topInfo.includes('关系盘')){
		push('relative');
	}
	if(topInfo.includes('量化盘')){
		push('germany');
	}
	if(topInfo.includes('节气盘')){
		push('jieqi');
	}
	if(topInfo.includes('印度占星') || topInfo.includes('印度律盘')){
		push('indiachart', 'astrochart');
	}
	if(topInfo.includes('七政四余')){
		push('qizhengkin', 'guolao', 'astrochart_like', 'astrochart');
	}
	if(topInfo.includes('星盘') || topInfo.includes('十三分盘') || topInfo.includes('希腊星术') || topInfo.includes('占星地图') || topInfo.includes('星体地图') || topInfo.includes('三维盘')){
		push('astrochart', 'astrochart_like', 'indiachart');
	}
	// 终极兜底：按术法族群补全，避免误报“无可导出文本”。
	push(
		'astrochart', 'astrochart_like', 'indiachart',
		'relative', 'germany', 'jieqi',
		'primarydirect', 'primarydirchart', 'zodialrelease', 'firdaria', 'profection', 'solararc', 'solarreturn', 'lunarreturn', 'givenyear', 'decennials',
		'planetaryages', 'prog', 'vedicprog', 'jaynesprog', 'planetaryarc', 'persiandirected', 'yearsystem129', 'balbillus', 'triplicityrulers', 'keypoints', 'lunationphase', 'extrareturns',
		'sanshiunited', 'qimen', 'liureng', 'jinkou', 'sixyao', 'tongshefa', 'huangji', 'wuzhao', 'taixuan', 'jingjue', 'shenyishu', 'taiyi', 'suzhan',
		'guolao', 'qizhengkin', 'shaozi', 'tieban', 'fendjing', 'beiji', 'nanji', 'chunzi', 'xianqin', 'cetian', 'otherbu', 'fengshui',
		'bazi', 'ziwei',
	);
	return keys;
}

// 「简单模块」预测技法：内容来自前端保存的模块快照(saveModuleAISnapshot)而非预测后端 payload。
// 路由与自检共用此单一真值表 —— 防「登记进 predictive 却漏配 extractContentByKey 路由」(extrareturns 曾正是漏此条 → AI导出/挂载拿不到多重回归快照)。
export const AI_EXPORT_SIMPLE_MODULE_KEYS = ['planetaryages', 'ephemeris', 'returntimeline', 'prenatalsyzygy', 'prog', 'vedicprog', 'jaynesprog', 'planetaryarc', 'persiandirected', 'yearsystem129', 'balbillus', 'triplicityrulers', 'keypoints', 'lunationphase', 'extrareturns'];

async function extractContentByKey(exportKey, context){
	if(exportKey === 'astrochart' || isAstroLikeExportKey(exportKey) || exportKey === 'indiachart'){
		return extractAstroContent(context);
	}
	if(exportKey === 'germany'){
		return extractGermanyContent(context);
	}
	if(exportKey === 'jieqi' || isJieQiSplitSettingKey(exportKey)){
		return extractJieQiContent(context);
	}
	if(exportKey === 'guice' || exportKey === 'xiaoliuren' || exportKey === 'xiaochengtu' || exportKey === 'feigong'
		|| exportKey === 'geomancy' || exportKey === 'tarot' || exportKey === 'lingqi'
		|| exportKey === 'babylon'
	){
		// 皇极轨策/小六壬/小成图/飞宫/天文地占/塔罗:与卜卦/择日同路 —— 读 saveModuleAISnapshot 存的模块快照
		// (geomancy/tarot 此前无分支 → 落 extractGenericContent 且 generic 亦无其 case → 导出恒空,X1 审计抓出补齐)。
		// (按 exportKey 动态取,勿写死键名 —— 写死会令后加技法全读成别家快照)。
		// 🔴 此行原先误落在 mapLegacySectionTitle(纯「段名→段名」字符串映射器)里 ——
		//    extractSimpleModuleContent 是 async,遂令本技法【每个段名都变成 Promise】:
		//    getAIExportEffectiveSectionsForTechnique('guice') 返 10 个 Promise 而非 10 个段名,
		//    按段过滤拿 Promise 去比字符串 → 恒失配。是文档生成器印出 10 个「[object Promise]」
		//    才露的马脚(段表 grep 得到、四本账测试也绿 —— 它们只查「登记了没」,不查「值是什么」)。
		return extractSimpleModuleContent(exportKey);
	}
	if(exportKey === 'huangli' || exportKey === 'tongshu'){
		// 黄历子 tab 独立导出:两键 preset/挂载早有,extractContentByKey 曾无分支(恒 ''=
		// 设置面可勾恒无效);内容取各自子源模块快照(与挂载 regenerateCaseTechniqueSnapshot 同域)。
		return extractSimpleModuleContent(exportKey === 'huangli' ? 'calendar-huangli' : 'calendar-tongshu');
	}
	if(exportKey === 'horary' || exportKey === 'election' || exportKey === 'mundane' || exportKey === 'tianxing' || exportKey === 'qimenzeri'){
		// 卜卦/择日:读 saveModuleAISnapshot 存的模块快照;世俗:走 refresh-event(DivinationChartShell 写 detail.snapshotText)。
		// extractSimpleModuleContent 先派发 refresh-event 再回落 cached,三者统一覆盖(此前缺分支 → 落 generic / 被辅盘默认串成量化盘)。
		return extractSimpleModuleContent(exportKey);
	}
	if(exportKey === 'primarydirect'){
		return extractPrimaryDirectContent(context);
	}
	if(exportKey === 'primarydirchart'){
		return extractPrimaryDirChartContent(context);
	}
	if(exportKey === 'zodialrelease'){
		return extractZodialReleaseContent(context);
	}
	if(exportKey === 'firdaria'){
		return extractFirdariaContent(context);
	}
	if(exportKey === 'profection'){
		return extractProfectionContent(context);
	}
	if(exportKey === 'solararc'){
		return extractSolarArcContent(context);
	}
	if(exportKey === 'solarreturn'){
		return extractSolarReturnContent(context);
	}
	if(exportKey === 'lunarreturn'){
		return extractLunarReturnContent(context);
	}
	if(exportKey === 'givenyear'){
		return extractGivenYearContent(context);
	}
	if(exportKey === 'decennials'){
		return extractDecennialsContent(context);
	}
	if(exportKey === 'distributions' || exportKey === 'agepoint'){
		// 界推运/年龄推进点：组件内 fetch /predict/dist|agepoint 后经 refresh-event 回写快照(同主限法机制)。
		// 此前缺分支 → 落 extractGenericContent → 导出「无可导出文本」；补齐后与其余推运一致。
		return extractSimpleModuleContent(exportKey);
	}
	if(AI_EXPORT_SIMPLE_MODULE_KEYS.indexOf(exportKey) >= 0){
		return extractSimpleModuleContent(exportKey);
	}
	if(exportKey === 'sixyao'){
		return extractSixYaoContent(context);
	}
	if(exportKey === 'liureng'){
		return extractLiuRengContent(context);
	}
	if(exportKey === 'jinkou'){
		return extractJinKouContent(context);
	}
	if(exportKey === 'qimen'){
		return extractQiMenContent(context);
	}
	if(exportKey === 'sanshiunited'){
		return extractSanShiUnitedContent(context);
	}
	if(exportKey === 'tongshefa'){
		return extractTongSheFaContent(context);
	}
	if(exportKey === 'huangji'){
		return extractSimpleModuleContent('huangji');
	}
	if(exportKey === 'calendar'){
		// 黄历:四子 tab 各自独立模块快照,汇合导出(农历/老黄历/通书择日/日子馆)。
		return extractCalendarContent(context);
	}
	if(exportKey === 'wuzhao' || exportKey === 'taixuan' || exportKey === 'jingjue' || exportKey === 'shenyishu'
		|| exportKey === 'shaozi' || exportKey === 'tieban' || exportKey === 'fendjing' || exportKey === 'beiji'
		|| exportKey === 'nanji' || exportKey === 'chunzi' || exportKey === 'xianqin' || exportKey === 'cetian'
		|| exportKey === 'qizhengkin'){
		return extractSimpleModuleContent(snapshotModuleKeyByContextKey(exportKey));
	}
	if(exportKey === 'taiyi'){
		return extractTaiYiContent(context);
	}
	if(exportKey === 'relative'){
		return extractRelativeContent(context);
	}
	if(exportKey === 'guolao'){
		return extractSimpleModuleContent('guolao');
	}
	if(exportKey === 'suzhan'){
		return extractSimpleModuleContent('suzhan');
	}
	if(exportKey === 'bazi'){
		return extractSimpleModuleContent('bazi');
	}
	if(exportKey === 'ziwei'){
		return extractSimpleModuleContent('ziwei');
	}
	if(exportKey === 'otherbu'){
		return extractOtherBuContent(context);
	}
	if(exportKey === 'fengshui'){
		return extractFengShuiContent(context);
	}
	if(exportKey === 'canping'){
		return extractSimpleModuleContent('canping');
	}
	if(exportKey === 'zhengchuan'){
		return extractSimpleModuleContent('zhengchuan');
	}
	if(exportKey === 'heluo'){
		return extractSimpleModuleContent('heluo');
	}
	if(exportKey === 'yizhangjing'){
		// 一掌经（其他/命）：中栏组件按当前流派即时构建快照，refresh-event → 回退模块缓存。
		return extractSimpleModuleContent('yizhangjing');
	}
	return extractGenericContent(context);
}

// 古典格局派生分析(analyze_chart)按需 fetch — 与 AI 挂载同源(astroAiSnapshot.buildClassicalAnalysisSection)。
// 仅导出 astrochart/astrochart_like 时拉,优雅降级(失败/无参数返回 '')。~50ms 级,不进每盘预建快照。
async function fetchAstroClassicalAnalysisSectionForExport(){
	try{
		const store = getStore();
		const chartObj = store && store.astro ? store.astro.chartObj : null;
		const raw = chartObj && chartObj.params ? chartObj.params : null;
		if(!raw){
			return '';
		}
		// chartObj.params 用合并的 birth「YYYY-MM-DD HH:mm:ss」,无独立 date/time → 须像 chartParams 那样拆出,
		// 否则 /astroextra/analysis 报 miss.date。无 date 则直接放弃(静默,不发请求、不弹错)。
		const birthParts = `${raw.birth || ''}`.split(' ');
		const params = {
			...raw,
			date: raw.date || birthParts[0],
			time: raw.time || birthParts[1] || '12:00:00',
		};
		// 守 (HIGH-4):缺 date/zone/lat/lon 任一都静默 skip(后端必校验,缺则 4xx)。
		if(!params.date || !params.zone || params.lat === undefined || params.lat === null || params.lon === undefined || params.lon === null){
			return '';
		}
		// 与挂载链 fetchClassicalAnalysisSection 同口径:恒星轨读全局仓(此前硬编 1° → 用户改
		// 恒星轨后导出 [古典格局] 与右栏/挂载三方漂移);voidClassical 同判据条件附(缺键=本座义=现状零回归)。
		// 随盘 starOrb/starOrbMode(chartObj.params 回显)优先,缺则全局仓;档位一并下发。
		const reqBody = { _v: 'cls1', ...params, ...fixedStarOrbParamsFor(params) };   // [SURF] 缓存代次盐
		const st = getStore();
		const app = st && st.app ? st.app : null;
		if(app && (app.voidClassical === 1 || app.voidClassical === '1' || app.voidClassical === true)){
			reqBody.voidClassical = true;
		}
		const data = await request(`${ExportConstants.ServerRoot}/astroextra/analysis`, {
			body: JSON.stringify(reqBody),
			silent: true,
			timeoutMs: 20000,
		});
		const analysis = data && data.Result ? data.Result : data;
		return buildClassicalAnalysisSection(analysis) || '';
	}catch(e){
		return '';
	}
}

// opts.omitSubjectFacts:外部客户端读「当前页正文」时不附命主实况(私人内容只经「私人内容可读」那条路给)
async function buildPayload(opts){
	const context = resolveExportContextForPayload(withStoreContextFallback(resolveActiveContext()));
	const exportKey = normalizeExportKey(context.key);
	const now = new Date();

	let content = '';
	let usedExportKey = exportKey;
	const fallbackStateContext = resolveContextByAstroState();
	const fallbackStateKey = normalizeExportKey(fallbackStateContext && fallbackStateContext.key ? fallbackStateContext.key : '');
	const candidateKeys = getCandidateExportKeys(context);

	for(let i=0; i<candidateKeys.length; i++){
		const key = candidateKeys[i];
		const candidateContext = (fallbackStateKey && key === fallbackStateKey)
			? { ...context, ...fallbackStateContext }
			: context;
		const txt = await extractContentByKey(key, candidateContext);
		if(txt && `${txt}`.trim()){
			content = txt;
			usedExportKey = key;
			break;
		}
	}
	if(!content){
		content = await extractContentByKey(usedExportKey, context);
	}
	if(!`${content || ''}`.trim()){
		const tried = new Set(candidateKeys.map((key)=>normalizeExportKey(key)).filter(Boolean));
		const rescueKeys = getRescueExportKeys(context, fallbackStateContext, tried);
		for(let i=0; i<rescueKeys.length; i++){
			const key = rescueKeys[i];
			const candidateContext = (fallbackStateKey && key === fallbackStateKey)
				? { ...context, ...fallbackStateContext }
				: context;
			// eslint-disable-next-line no-await-in-loop
			const txt = await extractContentByKey(key, candidateContext);
			if(txt && `${txt}`.trim()){
				content = txt;
				usedExportKey = key;
				break;
			}
		}
	}

	// 古典格局派生分析按需拼入,置于段过滤前 → 受「古典格局」导出段开关控制、不遗漏。
	// [YD 口径修] 改变黄道读数框架的派生盘(十三/十二分盘/调波/龙盘)跳过:后端 /astroextra/analysis
	// 按常规黄道以本命参数重算,挂到这些盘上=本命结论冒充派生盘结论(审计实锚:13分盘导出的
	// 「古典格局」实为本命口径)。占星地图/重置盘保留(本命语义仍成立)。
	const CLASSICAL_SKIP_KEYS = ['hellenastro', 'dwadasamsa', 'harmonic', 'draconic'];
	const CLASSICAL_SKIP_DERIVED = ['十三分', '十二分', '调波', '谐波', '龙盘', '黄道分盘'];
	const derivedName = `${(context && context.displayName) || ''}`;
	const skipClassical = CLASSICAL_SKIP_KEYS.includes(usedExportKey)
		|| (usedExportKey === 'astrochart_like' && CLASSICAL_SKIP_DERIVED.some((word)=>derivedName.includes(word)));
	if((usedExportKey === 'astrochart' || isAstroLikeExportKey(usedExportKey)) && !skipClassical){
		const classicalAnalysis = await fetchAstroClassicalAnalysisSectionForExport();
		if(classicalAnalysis){
			content = `${`${content || ''}`.trim()}\n\n${classicalAnalysis}`.trim();
		}
	}
	// 占星地图专属真值(仅当前上下文=占星地图 tab):最近一次地图状态(口径/线经度/CCG/关系盘/落点),
	// 单一真值源=后端 ACGraph 响应;置于段过滤前 → 受「占星地图」导出段开关控制。无快照优雅降级。
	if(usedExportKey === 'locastro' || (usedExportKey === 'astrochart_like' && context && context.displayName === '占星地图')){
		try{
			const acgSection = buildAcgSectionText();
			if(acgSection){
				content = `${`${content || ''}`.trim()}\n\n${acgSection}`.trim();
			}
		}catch(e){ /* graceful */ }
	}
	const exportFormat = getAIExportFormatPreference();
	const rawSnapshotContent = stripForbiddenSections(content, usedExportKey);
	content = applyUserSectionFilterByContext(rawSnapshotContent, usedExportKey);
	let planetSettingKey = usedExportKey;
	if(usedExportKey === 'jieqi' || isJieQiSplitSettingKey(usedExportKey)){
		planetSettingKey = isJieQiSplitSettingKey(usedExportKey)
			? usedExportKey
			: (detectJieQiSettingKeyByScope(context.scopeRoot) || detectJieQiSettingKeyByCurrentSnapshot() || 'jieqi');
	}
	content = applyPlanetInfoFilterByContext(content, planetSettingKey);
	const normalizeDomain = isKentangRawExportKey(usedExportKey) ? 'kentang_raw' : context.domain;
	content = normalizeText(content, normalizeDomain, exportFormat);
	content = applyAstroMeaningFilterByContext(content, planetSettingKey)
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	// 显式全清 → 不进兜底(用户刚取消的内容不得被复活);链异常才回退原文。
	if(!content && rawSnapshotContent && !isUserSectionsExplicitlyCleared(usedExportKey)){
		// 兜底：设置过滤链条异常时，回退到计算快照原文，避免“无可导出文本”误报。
		content = applyAstroMeaningFilterByContext(normalizeText(rawSnapshotContent, normalizeDomain, exportFormat), planetSettingKey)
			.replace(/\n{3,}/g, '\n\n')
			.trim();
	}
	// 导出范围统计(先于 [图例] 追加,图例属附注不计入):让 AI/读者知道内容是否被「AI导出设置」裁剪过。
	const totalSectionCount = extractSectionTitles(rawSnapshotContent).length;
	const keptSectionCount = extractSectionTitles(content).length;
	// 「附命主实况」:段筛选与范围统计之后追加(不吃段勾选、不计入导出范围;不进 builder / 挂载 / 储存);缺省关 = 字节不变
	if(content && !(opts && opts.omitSubjectFacts) && isAIExportSubjectFactsEnabled()){
		const sfSection = buildSubjectFactsExportSection(usedExportKey);
		if(sfSection){
			content = `${content}\n\n${sfSection}`;
		}
	}
	// [图例] 段(payload 层拼装,不进 builder/挂载/储存;注册表空 → 天然无输出)。
	if(exportFormat === 'v2' && content && isAIExportLegendEnabled()){
		const legendSection = buildAIExportLegendSection(usedExportKey);
		if(legendSection){
			content = `${content}\n\n${legendSection}`;
		}
	}
	const displayName = getTechniqueLabelByKey(usedExportKey) || context.displayName || '当前技术';
	const stamp = formatStamp(now);
	const time = formatDateTime(now);
	const filenameBase = `horosa_${safeFileName(displayName)}_${stamp}`;
	// v2.2.1:把「日界点·晚子时」排盘规则写进导出头,让 AI 知道四柱按哪种换日/起时干规则计算。
	// 🔴 取值源修正:此前直读全局设置,而正文四柱是按当前盘 fields 实值算的 ——
	// 盘存非默认日界时导出头对 AI 撒谎。改为当前盘 fields 优先,全局兜底(与正文同源)。
	const st = getStore();
	const dayRuleFields = st && st.astro && st.astro.fields ? st.astro.fields : null;
	// 八字页本页口径覆盖层(仅当前页=八字时)优先:导出头与页面所见 / 正文四柱同源。
	const baziCalibreOv = (st && st.astro && st.astro.currentTab === 'bazi' && st.astro.baziCalibreOverride) ? st.astro.baziCalibreOverride : {};
	const fv = (name)=>(baziCalibreOv[name] !== undefined && baziCalibreOv[name] !== null ? baziCalibreOv[name]
		: (dayRuleFields && dayRuleFields[name] && dayRuleFields[name].value !== undefined && dayRuleFields[name].value !== null ? dayRuleFields[name].value : undefined));
	const a23 = fv('after23NewDay') !== undefined ? fv('after23NewDay') : defaultAfter23NewDay();
	const lzh = fv('lateZiHourUseNextDay') !== undefined ? fv('lateZiHourUseNextDay') : defaultLateZiHourUseNextDay();
	const dayRule = `排盘规则: 日界点【${a23 === 0 ? '24点算第二天·日柱守今' : '23点算第二天·日柱进位次日'}】, 晚子时·时柱起干【${lzh === 0 ? '按当日柱·今日干起子时' : '按次日柱·次日干起子时'}】(仅 23:00–23:59 影响日柱/时柱)`;
	// 元数据头(纯增行,v1 头逐字不变):格式版本锚 + 导出范围(防"AI 不知道内容被裁剪");
	// 盘主/生辰不进头(正文 [起盘信息] 已有,跨段去重原则)。
	const headerLines = [];
	if(exportFormat === 'v2'){
		headerLines.push('格式: horosa-ai-export/2');
	}
	headerLines.push(`技术: ${displayName}`);
	headerLines.push(`导出时间: ${time}`);
	headerLines.push(`页面: ${window.location.href}`);
	if(exportFormat === 'v2' && totalSectionCount > 0){
		// 少段两因(用户裁剪/默认关段)统一一句,指路设置面即可。
		headerLines.push(`导出范围: ${keptSectionCount}/${totalSectionCount} 段${keptSectionCount < totalSectionCount ? '（部分段未纳入，可在「AI导出设置」调整）' : '（未裁剪）'}`);
	}
	headerLines.push('说明: 当前激活技术面板专属导出；符号已转为AI可识别文本。');
	// 头行「排盘规则」取当前导出技法的实际口径:①正文自带换日 / 日界口径(奇门 / 太乙 / 三式 / 紫微等左栏各自设置)→
	// 头行指向正文,不再按共享 fields 另写一套(此前头写「23点」正文写「24点」自相矛盾);②不涉日柱的西占等导出不写此行。
	const bodyHasOwnDayRule = /(^|\n)\s*换日[:：]|日界点?[:：]|晚子时[:：]/.test(content);
	const involvesPillars = /四柱|日柱|时柱|干支|换日|日界/.test(content);
	if(involvesPillars){
		headerLines.push(bodyHasOwnDayRule ? '排盘规则: 以正文自带的「换日 / 日界 / 晚子时」口径为准（本技法在左栏单独设置）' : dayRule);
	}
	headerLines.push('');
	headerLines.push('========== 内容开始 ==========');
	const header = headerLines.join('\n');
	const text = `${header}\n${content}\n========== 内容结束 ==========`;

	return {
		tech: displayName,
		content,
		text,
		filenameBase,
		// 供 runAIExport 区分「页面没算出结果」与「用户在 AI导出设置里把本技法分段全清空」两种空内容。
		clearedByUser: !content && !!rawSnapshotContent && isUserSectionsExplicitlyCleared(usedExportKey),
		exportKey: usedExportKey,
	};
}

// 外部 AI 读「当前页面的 AI 导出正文」(read_current_page):与「AI导出」按钮同一份 payload(同一过滤链 / 段设置 / 导出头),
//   只取文本 —— 不落盘、不进剪贴板、不截图。
export async function buildCurrentPageExportForTool(){
	const p = await buildPayload({ omitSubjectFacts: true });
	return { technique: p.tech, exportKey: p.exportKey, content: p.content || '', text: p.text || '', clearedByUser: !!p.clearedByUser };
}

// Word/PDF 动作前按设置抓「当前页面截图」(三栏整页)。失败/降级恒 null——绝不阻断导出;
// note 用于 toast 说明(如 WebGL 页降级)。copy/txt 不抓(纯文本形态无附图位,免无谓开销)。
// 复制成功 toast 附「盘面时间」:用户先复制、后改盘重排、再拿旧文本对照新盘,会误判
// 「导出与盘对不上」(2026-07-11 实测复盘:导出恒与复制那一刻的盘面一致,属时序误会)。
// toast 直接亮出所复制盘的时刻,新旧一眼可辨。键优先级:会随改盘变动的时刻行优先——
// 推运时间(推运族目标时刻)>起课时间(卜类)>日期/时间(命盘起盘信息);出生时间仅最后兜底
// (YB 补厚后推运快照首段是 [本命盘配置] 含出生时间,平铺首匹配会恒显不变的出生时刻,失去分辨力——独立复核咬出)。
function chartMomentSuffix(content){
	const txt = `${content || ''}`;
	const keys = ['推运时间', '起课时间', '日期', '时间', '出生时间'];
	for(let i = 0; i < keys.length; i += 1){
		const m = txt.match(new RegExp(`^${keys[i]}：([^\n]+)$`, 'm'));
		if(m && m[1] && `${m[1]}`.trim()){
			return `（盘面时间 ${m[1].trim()}）`;
		}
	}
	return '';
}

async function attachScreenshotIfEnabled(payload, action){
	if(action !== 'pdf' && action !== 'word' && action !== 'all'){
		return '';
	}
	try{
		if(!isAIExportScreenshotEnabled()){
			return '';
		}
		const { shot, note } = await capturePageScreenshotForExport();
		if(shot){
			payload.screenshot = shot;
		}
		return note || '';
	}catch(e){
		return '';
	}
}

// Word 动作:v2 = 真 docx(失败降级经典 .doc 壳);v1 = 经典 .doc(字节级不变)。
async function exportWordByFormat(payload){
	// docx 三态:'cancelled' 绝不降级 .doc;.doc 落盘结果如实回传(取消 / 失败 → ok:false)。
	if(getAIExportFormatPreference() === 'v2'){
		const docxOk = await exportDocx(payload);
		if(docxOk === 'cancelled'){ return { ok: false, cancelled: true, label: 'Word(docx)' }; }
		if(docxOk){ return { ok: true, label: 'Word(docx)' }; }
		const r = await exportWord(payload);
		return { ok: !!(r && r.ok), cancelled: !!(r && r.cancelled), error: r && r.error, label: 'Word(.doc 兼容格式)' };
	}
	const r = await exportWord(payload);
	return { ok: !!(r && r.ok), cancelled: !!(r && r.cancelled), error: r && r.error, label: 'Word' };
}

export async function runAIExport(action){
	try{
		const payload = await buildPayload();
		const pure = (payload.content || '').replace(/\s/g, '');
		if(!pure){
			// 显式全清是合法设置,但导出报「没有可导出文本」会被误读成页面没算出结果 → 分开说。
			if(payload.clearedByUser){
				return { ok: false, message: `本技法的导出分段已在「AI导出设置」里全部取消勾选,故无内容可导出;去设置里勾回需要的段即可（${payload.tech || ''}）。` };
			}
			return { ok: false, message: '当前页面没有可导出文本。' };
		}
		const shotNote = await attachScreenshotIfEnabled(payload, action);
		const shotSuffix = shotNote ? `（${shotNote}）` : '';

		if(action === 'copy'){
			const ok = await copyTextSmart(payload.text);
			if(ok){ return { ok: true, message: `AI纯文字已复制。${chartMomentSuffix(payload.content)}` }; }
			// 剪贴板不可用(桌面 webview / 非聚焦 / 安全上下文)→ 自动导出 TXT,用户必有产物。取消 / 失败如实报。
			const rt = await exportTxt(payload);
			if(rt && rt.cancelled){ return { ok: false, message: '剪贴板不可用，改为导出 TXT，但已取消保存。' }; }
			if(!(rt && rt.ok)){ return { ok: false, message: `剪贴板不可用，且 TXT 保存失败：${(rt && rt.error) || '未知错误'}` }; }
			return { ok: true, message: `剪贴板不可用，已自动导出 TXT 文件。${rt.path ? `（${rt.path}）` : ''}` };
		}
		if(action === 'txt'){
			const rt = await exportTxt(payload);
			if(rt && rt.cancelled){ return { ok: false, message: '已取消保存。' }; }
			if(!(rt && rt.ok)){ return { ok: false, message: `TXT 保存失败：${(rt && rt.error) || '未知错误'}` }; }
			return { ok: true, message: `TXT 已导出。${rt.path ? `（${rt.path}）` : ''}` };
		}
		if(action === 'word'){
			const word = await exportWordByFormat(payload);
			if(word.cancelled){ return { ok: false, message: '已取消保存。' }; }
			if(!word.ok){ return { ok: false, message: `${word.label} 保存失败：${word.error || '未知错误'}` }; }
			return { ok: true, message: `${word.label} 已导出。${shotSuffix}` };
		}
		if(action === 'pdf'){
			const ok = await exportPdf(payload);
			if(ok === 'cancelled'){ return { ok: false, message: '已取消保存。' }; }
			if(ok){
				let msg = `PDF 已导出。${shotSuffix}`;
				if(_pdfExportedViaVector){ msg = `PDF 已导出（文字可选中·可搜索，已弹出「保存」可选位置与文件名）。${shotSuffix}`; }
				else if(_pdfExportedViaPrint){ msg = `已打开系统打印窗口，请选择『存储为 PDF』——文字可选中、自动分页不截断。${shotSuffix}`; }
				return { ok: true, message: msg };
			}
			// PDF 生成失败(渲染空白/异常)→ 自动导出 TXT,用户必有产物(同 copy 分支降级先例)。取消 / 失败如实报。
			const rt2 = await exportTxt(payload);
			if(rt2 && rt2.cancelled){ return { ok: false, message: 'PDF 生成失败，改为导出 TXT，但已取消保存。' }; }
			if(!(rt2 && rt2.ok)){ return { ok: false, message: `PDF 生成失败，且 TXT 保存失败：${(rt2 && rt2.error) || '未知错误'}` }; }
			return { ok: true, message: 'PDF 生成失败，已自动导出 TXT（内容相同，可改用 Word）。' };
		}
		if(action === 'all'){
			const copied = await copyTextSmart(payload.text);
			// 桌面壳逐格式弹保存框;任一格式取消即停,不报「已导出」。
			const rtAll = await exportTxt(payload);
			if(rtAll && rtAll.cancelled){ return { ok: false, message: '已取消保存（后续格式未导出）。' }; }
			const word = await exportWordByFormat(payload);
			if(word.cancelled){ return { ok: false, message: 'TXT 已导出；Word 已取消保存（PDF 未导出）。' }; }
			// 「导出全部」是打包下载,不弹打印窗口(allowPrint:false 走栅格自动落盘);
			// 需可选中文字 PDF 请用独立「导出 PDF」按钮(打印路径)。
			const pdfOk = await exportPdf(payload, { allowPrint: false });
			if(pdfOk === 'cancelled'){ return { ok: false, message: `已导出 TXT / ${word.label}；PDF 已取消保存。` }; }
			const got = (rtAll && rtAll.ok ? ['TXT'] : []).concat(word.ok ? [word.label] : []).concat(pdfOk ? ['PDF'] : []);
			let message = `已导出 ${got.join(' / ')}${copied ? '，并复制到剪贴板' : ''}。`;
			if(!copied){ message += '（剪贴板不可用，全文已在 TXT 内）'; }
			if(!pdfOk){ message += '（PDF 生成失败，可用 Word）'; }
			if(shotSuffix){ message += shotSuffix; }
			return { ok: true, message };
		}
		return { ok: false, message: '未知导出动作。' };
	}catch(e){
		const msg = e && e.message ? e.message : 'AI导出异常，请重试。';
		return { ok: false, message: msg };
	}
}
