// AI 导出 · 各技法的页面内容抽取(星盘 / 六爻 / 六壬 / 金口 / 奇门 / 三式 / 推运各页 / 历法 / 通用)。
// 由 utils/aiExport.js 门面统一对外导出。
import { isAstroLikeExportKey } from './presets';
import { snapshotModuleKeyByContextKey, requestModuleSnapshotRefresh } from './settingsModel';
import { findIndiaActivePane } from './contextResolve';
import { applyAIExportSectionFilterToSnapshot } from './settingsGroups';
import {
	getAstroCachedContent, getModuleCachedContent, getModuleSnapshotPayload, getSanshiDisplayFieldSignature,
	isSanshiSnapshotMatchedCurrent, getIndiaCachedContent,
} from './snapshotLookup';
import { escapeRegExp } from './meaning';
import { normalizeExportKey } from './exportKeys';

// 五个派生键的模块快照(各页出盘即存)优先——此前恒读 astro 单例=
// 本命盘冒充分盘(用户看十三分/调波/龙盘/重置盘,AI 读到的却是本命)。无模块快照(老会话/未出盘)
// 回落单例(旧行为,不硬断)。astrochart_like 聚合键与 locastro(ACG 自有链)不在此列。
const DERIVED_ASTRO_MODULE_KEYS = ['hellenastro', 'dwadasamsa', 'harmonic', 'draconic', 'relocation'];

export async function extractAstroContent(context){
	const isAstroLike = !!(context && isAstroLikeExportKey(context.key));
	const topLabel = context && context.topLabel ? context.topLabel : '';
	const isIndia = (context && context.key === 'indiachart') || topLabel.includes('印度占星') || topLabel.includes('印度律盘');
	if(!isIndia){
		if(context && DERIVED_ASTRO_MODULE_KEYS.indexOf(context.key) >= 0){
			const derived = getModuleCachedContent(context.key);
			if(`${derived || ''}`.trim()){
				return derived;
			}
		}
		// 星盘系导出固定走计算快照，不读取右侧栏目DOM。
		const cached = getAstroCachedContent();
		return cached || '';
	}
	const scopeRoot = context ? context.scopeRoot : null;
	const indiaActive = findIndiaActivePane(scopeRoot);
	// [制度化] 实时取数先行(六爻/紫微同款范式):派发 refresh 事件让印占组件用当前显示的盘现算现写——
	// reload 后未重排时懒存缓存为空,只读缓存会「显示有盘却报没有可导出文本」(用户实机抓获)。
	const refreshed = await requestModuleSnapshotRefresh('indiachart');
	if(refreshed){
		return refreshed;
	}
	const indiaCached = getIndiaCachedContent(indiaActive ? indiaActive.label : '');
	return indiaCached || '';
}

export async function extractSixYaoContent(context){
	void context;
	const refreshedGuazhan = await requestModuleSnapshotRefresh('guazhan');
	if(refreshedGuazhan){
		return refreshedGuazhan;
	}
	const refreshedSixyao = await requestModuleSnapshotRefresh('sixyao');
	if(refreshedSixyao){
		return refreshedSixyao;
	}
	const cached = getModuleCachedContent('guazhan') || getModuleCachedContent('sixyao');
	if(cached){
		return cached;
	}
	// 易卦导出仅使用计算快照，不从右侧DOM复制。
	return '';
}

function hasSectionTitle(content, title){
	const src = `${content || ''}`;
	const target = `${title || ''}`.trim();
	if(!src || !target){
		return false;
	}
	const escaped = escapeRegExp(target);
	const headingPattern = new RegExp(`(?:\\[|【)\\s*${escaped}\\s*(?:\\]|】)`);
	return headingPattern.test(src);
}

function hasAnySectionTitle(content, titles){
	const arr = Array.isArray(titles) ? titles : [titles];
	return arr.some((title)=>hasSectionTitle(content, title));
}

export async function extractLiuRengContent(context){
	void context;
	const refreshedSnapshot = await requestModuleSnapshotRefresh('liureng');
	if(refreshedSnapshot){
		const hasGeJuRef = hasAnySectionTitle(refreshedSnapshot, ['大格', '小局', '参考', '概览']);
		if(hasGeJuRef){
			return refreshedSnapshot;
		}
	}
	const cached = getModuleCachedContent('liureng');
	if(cached){
		const hasGeJuRef = hasAnySectionTitle(cached, ['大格', '小局', '参考', '概览']);
		if(hasGeJuRef){
			return cached;
		}
	}
	const liveSnapshot = (typeof window !== 'undefined' && typeof window.__horosa_liureng_snapshot_text === 'string')
		? `${window.__horosa_liureng_snapshot_text}`.trim()
		: '';
	if(liveSnapshot){
		const hasGeJuRef = hasAnySectionTitle(liveSnapshot, ['大格', '小局', '参考', '概览']);
		if(hasGeJuRef){
			return liveSnapshot;
		}
	}
	if(refreshedSnapshot){
		return refreshedSnapshot;
	}
	if(cached){
		return cached;
	}
	// 六壬导出仅使用计算快照，不从右侧DOM复制。
	return '';
}

export async function extractJinKouContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('jinkou');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('jinkou');
	if(cached){
		return cached;
	}
	// 金口诀导出不能回退到六壬，避免内容串台。
	return '';
}

export async function extractQiMenContent(context){
	void context;
	const refreshedSnapshot = await requestModuleSnapshotRefresh('qimen');
	if(refreshedSnapshot){
		const hasYiGua = hasSectionTitle(refreshedSnapshot, '奇门演卦');
		const hasBaGong = hasSectionTitle(refreshedSnapshot, '八宫详解');
		if(hasYiGua && hasBaGong){
			return refreshedSnapshot;
		}
	}
	const cached = getModuleCachedContent('qimen');
	if(cached){
		const hasYiGua = hasSectionTitle(cached, '奇门演卦');
		const hasBaGong = hasSectionTitle(cached, '八宫详解');
		if(hasYiGua && hasBaGong){
			return cached;
		}
	}
	const liveSnapshot = (typeof window !== 'undefined' && typeof window.__horosa_qimen_snapshot_text === 'string')
		? `${window.__horosa_qimen_snapshot_text}`.trim()
		: '';
	if(liveSnapshot){
		const hasYiGua = hasSectionTitle(liveSnapshot, '奇门演卦');
		const hasBaGong = hasSectionTitle(liveSnapshot, '八宫详解');
		if(hasYiGua && hasBaGong){
			return liveSnapshot;
		}
	}
	if(refreshedSnapshot){
		return refreshedSnapshot;
	}
	if(liveSnapshot){
		return liveSnapshot;
	}
	if(cached){
		return cached;
	}
	// 遁甲导出仅使用计算快照，不从右侧DOM复制。
	return '';
}

export async function extractSanShiUnitedContent(context){
	void context;
	const isCompleteSnapshot = (txt)=>{
		const src = `${txt || ''}`;
		if(!src){
			return false;
		}
		const hasLiuRengRef = hasAnySectionTitle(src, ['六壬大格', '六壬小局', '六壬参考', '六壬概览']);
		const hasBaGong = hasSectionTitle(src, '八宫详解');
		return hasLiuRengRef && hasBaGong;
	};
	const getSanshiSnapshotMeta = ()=>{
		const payload = getModuleSnapshotPayload('sanshiunited');
		if(payload && payload.meta && typeof payload.meta === 'object'){
			return payload.meta;
		}
		return null;
	};
	const canUseSnapshot = (txt, meta, preferComplete = false)=>{
		const src = `${txt || ''}`.trim();
		if(!src){
			return false;
		}
		const complete = isCompleteSnapshot(src);
		const matched = isSanshiSnapshotMatchedCurrent(src, meta, currentSig);
		if(strictMatch){
			// 严格模式下以当前盘签名匹配为准，命中即可导出，避免误报“无可导出文本”。
			return matched;
		}
		if(preferComplete){
			return complete;
		}
		return true;
	};
	const currentSig = getSanshiDisplayFieldSignature(context && context.scopeRoot ? context.scopeRoot : null);
	const strictMatch = !!(currentSig.date && currentSig.time);

	const refreshedSnapshot = await requestModuleSnapshotRefresh('sanshiunited');
	const refreshedMeta = getSanshiSnapshotMeta();
	if(canUseSnapshot(refreshedSnapshot, refreshedMeta, true)){
		// 优先信任“本次刷新”结果：由三式合一组件当场生成，最贴近当前盘面。
		return refreshedSnapshot;
	}

	const cached = getModuleCachedContent('sanshiunited');
	const cachedPayload = getModuleSnapshotPayload('sanshiunited');
	if(canUseSnapshot(cached, cachedPayload && cachedPayload.meta, true)){
		return cached;
	}

	if(strictMatch){
		const retrySnapshot = await requestModuleSnapshotRefresh('sanshiunited');
		const retryMeta = getSanshiSnapshotMeta();
		if(canUseSnapshot(retrySnapshot, retryMeta, false)){
			return retrySnapshot;
		}
		// 最后再尝试一次已取到的快照，避免“刷新回调无新文本”导致误空。
		if(canUseSnapshot(refreshedSnapshot, refreshedMeta, false)){
			return refreshedSnapshot;
		}
		if(canUseSnapshot(cached, cachedPayload && cachedPayload.meta, false)){
			return cached;
		}
		// 最后兜底：即便签名不匹配，也优先导出当前可见盘面的最新快照，避免误报空导出。
		if(`${retrySnapshot || ''}`.trim()){
			return retrySnapshot;
		}
		if(`${refreshedSnapshot || ''}`.trim()){
			return refreshedSnapshot;
		}
		if(`${cached || ''}`.trim()){
			return cached;
		}
		return '';
	}

	if(canUseSnapshot(cached, cachedPayload && cachedPayload.meta, false)){
		return cached;
	}
	if(canUseSnapshot(refreshedSnapshot, refreshedMeta, false)){
		return refreshedSnapshot;
	}
	return '';
}

// DOM 抓取时代的统摄法选择解析族(parseTongSheFaBaguaKey/hasTongSheFaSelection/
// extractTongSheFaSelection ~100 行)已删:现役 extractTongSheFaContent 只走 refresh 事件+模块缓存,零调用点。

export async function extractTongSheFaContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('tongshefa');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('tongshefa');
	if(cached){
		return cached;
	}
	return '';
}

export async function extractTaiYiContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('taiyi');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('taiyi');
	if(cached){
		return cached;
	}
	return '';
}

export async function extractGermanyContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('germany');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('germany');
	if(cached){
		return cached;
	}
	return '';
}

export async function extractJieQiContent(context){
	void context;
	// 整键「节气盘」= 整年快照([节气盘参数] + 已算各盘各段,与 preset 13 段同构);此前优先取「当前页签那一盘」
	// → 整键 preset 摆着 13 段,实际只导得出 1 段(星盘页签下)。当前盘由四个分键(春分/夏至/秋分/冬至)各自承担。
	const refreshed = await requestModuleSnapshotRefresh('jieqi');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('jieqi');
	if(cached){
		return cached;
	}
	const refreshedCurrent = await requestModuleSnapshotRefresh('jieqi_current');
	if(refreshedCurrent){
		return refreshedCurrent;
	}
	const cachedCurrent = getModuleCachedContent('jieqi_current');
	if(cachedCurrent){
		return cachedCurrent;
	}
	return '';
}

export async function extractPrimaryDirectContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('primarydirect');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('primarydirect');
	if(cached){
		return cached;
	}
	return '';
}

export async function extractPrimaryDirChartContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('primarydirchart');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('primarydirchart');
	if(cached){
		return cached;
	}
	return '';
}

export async function extractZodialReleaseContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('zodialrelease');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('zodialrelease');
	if(cached){
		return cached;
	}
	return '';
}

export async function extractFirdariaContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('firdaria');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('firdaria');
	if(cached){
		return cached;
	}
	return '';
}

export async function extractProfectionContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('profection');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('profection');
	if(cached){
		return cached;
	}
	return '';
}

export async function extractSolarArcContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('solararc');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('solararc');
	if(cached){
		return cached;
	}
	return '';
}

export async function extractSolarReturnContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('solarreturn');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('solarreturn');
	if(cached){
		return cached;
	}
	return '';
}

export async function extractLunarReturnContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('lunarreturn');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('lunarreturn');
	if(cached){
		return cached;
	}
	return '';
}

export async function extractGivenYearContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('givenyear');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('givenyear');
	if(cached){
		return cached;
	}
	return '';
}

export async function extractDecennialsContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('decennials');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('decennials');
	if(cached){
		return cached;
	}
	return '';
}

export async function extractRelativeContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('relative');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('relative');
	if(cached){
		return cached;
	}
	return '';
}

export async function extractSimpleModuleContent(moduleName){
	const refreshed = await requestModuleSnapshotRefresh(moduleName);
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent(moduleName);
	if(cached){
		return cached;
	}
	return '';
}

export async function extractOtherBuContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('otherbu');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('otherbu');
	if(cached){
		return cached;
	}
	return '';
}

export async function extractFengShuiContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('fengshui');
	let base = refreshed || getModuleCachedContent('fengshui') || '';
	return base;
}

// 黄历:四子 tab(农历/老黄历/通书择日/日子馆)各自独立模块快照;导出汇合已挂载(用户访问过)的子 tab。
// 各子 tab 组件监听 refresh-event 按当前状态即时构建,未挂载的子 tab 返回空被跳过。
// calendar 聚合导出的四个子源标签(产出形态=整行【X】,经 parseSectionTitleLine 归一为段名):
// 必须登记进 calendar preset,否则用户自定义段后标签行被过滤删除、同名段(今日宜忌等
// huangli/calendar 双方都有)无法分辨来源。preset 保持字面量(供哨兵源扫),两处一致由单源锁测试看死。
export const CALENDAR_SUB_SOURCE_LABELS = ['农历', '老黄历', '通书择日', '日子馆'];

export async function extractCalendarContent(context){
	void context;
	const subs = [
		{ mod: 'calendar', label: CALENDAR_SUB_SOURCE_LABELS[0] },
		{ mod: 'calendar-huangli', label: CALENDAR_SUB_SOURCE_LABELS[1] },
		{ mod: 'calendar-tongshu', label: CALENDAR_SUB_SOURCE_LABELS[2] },
		{ mod: 'calendar-rizi', label: CALENDAR_SUB_SOURCE_LABELS[3] },
	];
	const parts = [];
	for(let i = 0; i < subs.length; i++){
		// eslint-disable-next-line no-await-in-loop
		const text = await extractSimpleModuleContent(subs[i].mod);
		const t = `${text || ''}`.trim();
		if(t){ parts.push(`【${subs[i].label}】\n${t}`); }
	}
	return parts.join('\n\n');
}

export async function extractGenericContent(context){
	if(context.key === 'suzhan'){
		const cached = getModuleCachedContent('suzhan');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'guolao'){
		// 实时取数先行(印占/六爻同款范式):果老页有 refresh 监听却不在
		// 名单,导出只读懒存缓存——阶段一裸拍冻结的缺 Moira 段快照被直接吃走。先 refresh 现算现写。
		const refreshed = await requestModuleSnapshotRefresh('guolao');
		if(refreshed){
			return refreshed;
		}
		const cached = getModuleCachedContent('guolao');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'bazi'){
		const cached = getModuleCachedContent('bazi');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'ziwei'){
		const cached = getModuleCachedContent('ziwei');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'germany'){
		const cached = getModuleCachedContent('germany');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'jieqi'){
		const cachedCurrent = getModuleCachedContent('jieqi_current');
		if(cachedCurrent){
			return cachedCurrent;
		}
		const cached = getModuleCachedContent('jieqi');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'zodialrelease'){
		const cached = getModuleCachedContent('zodialrelease');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'decennials'){
		const cached = getModuleCachedContent('decennials');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'planetaryages' || context.key === 'prog' || context.key === 'vedicprog' || context.key === 'jaynesprog'
		|| context.key === 'planetaryarc' || context.key === 'persiandirected' || context.key === 'yearsystem129'
		|| context.key === 'balbillus' || context.key === 'triplicityrulers' || context.key === 'keypoints'
		|| context.key === 'lunationphase' || context.key === 'extrareturns'){
		const cached = getModuleCachedContent(context.key);
		if(cached){
			return cached;
		}
	}
	if(context.key === 'relative'){
		const cached = getModuleCachedContent('relative');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'otherbu'){
		const cached = getModuleCachedContent('otherbu');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'qimen'){
		const cached = getModuleCachedContent('qimen');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'sanshiunited'){
		const cached = getModuleCachedContent('sanshiunited');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'tongshefa'){
		const cached = getModuleCachedContent('tongshefa');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'huangji'){
		const cached = getModuleCachedContent('huangji');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'wuzhao' || context.key === 'taixuan' || context.key === 'jingjue' || context.key === 'shenyishu'
		|| context.key === 'shaozi' || context.key === 'tieban' || context.key === 'fendjing' || context.key === 'beiji'
		|| context.key === 'nanji' || context.key === 'chunzi' || context.key === 'xianqin' || context.key === 'cetian'
		|| context.key === 'qizhengkin'){
		const cached = getModuleCachedContent(snapshotModuleKeyByContextKey(context.key));
		if(cached){
			return cached;
		}
	}
	if(context.key === 'sixyao'){
		const cached = getModuleCachedContent('guazhan');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'jinkou'){
		const cached = getModuleCachedContent('jinkou');
		if(cached){
			return cached;
		}
	}

	void context;
	return '';
}

export function isKentangRawExportKey(key){
	const val = normalizeExportKey(key);
	return [
		'huangji',
		'wuzhao',
		'taixuan',
		'jingjue',
		'shenyishu',
		'shaozi',
		'tieban',
		'fendjing',
		'beiji',
		'nanji',
		'chunzi',
		'xianqin',
		'cetian',
		'qizhengkin',
	].indexOf(val) >= 0;
}
