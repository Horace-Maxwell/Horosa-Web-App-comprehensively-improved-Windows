// AI 分析挂载上下文 · 技法上下文:单技法构建、带选项取上下文、技法选项清单、串行构建、批量取上下文、时点上下文、按段过滤、源上下文缓存。
// 由 utils/aiAnalysisContext.js 门面统一对外导出。
import { parseDateTimeMs } from '../dateTimeParse';
import {
	applyAIExportSectionFilterToSnapshot, exportSettingKeyForSnapshotModule, applyPlanetInfoFilterByContext,
	requestModuleSnapshotRefresh,
} from '../aiExport';
import { refreshModuleSnapshotSlots, loadFreshModuleAISnapshot } from '../moduleSnapshotRefresh';
import {
	getTechniqueSettingsSchema, mergeOptionsIntoRecord, mergeOptionsIntoPayload, pruneOptionsToNonDefault,
	effectiveMountBaseline, localStorageOverrideMap,
} from '../techniqueMountSettings';
import { buildAstroSnapshotContent } from '../astroAiSnapshot';
// 「列挂载源」及其纯函数助手抽至轻模块 aiAnalysisSources —— 个别页面只需
// 列源,曾因 import 本文件连带整座 AI 核(~50 技法构建器)进自己的 chunk(46/47 回灌案)。
// 此处 import 供本文件其余函数继续使用,listAnalysisSources 在文件尾 re-export 保旧路径兼容。
import { parseRecordPayload } from '../aiAnalysisSources';
import { loadModuleAISnapshot } from '../moduleAiSnapshot';
import { fetchChart } from '../../services/astro';
import { AI_ANALYSIS_STORES, getStoreRecord, putStoreRecord, schedulePruneContextCache } from '../aiAnalysisStore';
import { withGuolaoStoredOverrides } from '../../components/guolao/GuoLaoChartStyle';   // 覆盖作用域
import { sourceContextCacheStamp, ANALYSIS_CHART_TECHNIQUES, ANALYSIS_CASE_TECHNIQUES, TIME_CASTABLE_SET, TIMEPOINT_CASTABLE_SET } from './catalog';
import { buildFieldObject, fieldParams, buildSnapshotMetaFromRecord, saveGeneratedTechniqueSnapshot, canonicalSnapshotText } from './recordFields';
import { generateCaseTechniqueSnapshot, regenerateCaseTechniqueSnapshot } from './regenCase';
import {
	ASTRO_LIKE_DERIVED_MODULES, buildAstroLikeContext, buildAstroLikeSingleContext, relativeSnapshotMatchesRecord,
	regenerateChartTechniqueSnapshot,
} from './regenChart';
import { fetchClassicalAnalysisSection, buildChartContext, buildChartMetaContext, buildCaseContext, buildCaseMetaContext } from './sourceContext';
import { normalizeTechniqueKey, getTechniqueLabel, getTechniqueAliasList } from './techniqueKey';
import {
	pickSnapshotCandidate, getTechniqueSnapshotFromPayload, isCacheSnapshotConfidentMatch,
	getTechniqueSnapshotFromCache, REGENERATED_SNAPSHOT_CACHE, REGENERATED_SNAPSHOT_MAX,
	REGENERATED_SNAPSHOT_TTL_MS, regeneratedSnapshotKey,
} from './snapshotMatch';

async function buildTechniqueContext(source, techniqueKey, baseSourceContext){
	const key = normalizeTechniqueKey(techniqueKey);
	if(!source || !key){
		return null;
	}
	const label = getTechniqueLabel(key);
	const canReuseBaseSourceContext = baseSourceContext
		&& baseSourceContext.content
		&& !(baseSourceContext.meta && baseSourceContext.meta.metaOnly);
	// 「十三分盘 / 占星地图」聚合键:此前与 astrochart 同分派到 buildChartContext → 提示词标题写着
	// 十三分盘、正文却是 12 宫本命(与 astrochart 同挂时本命重复两份)。现改读辅盘页出盘即存的派生盘模块快照
	// (hellenastro/dwadasamsa/harmonic/draconic/relocation;meta 带生辰签名,只认同一张盘),无匹配=missing+提示,不再冒充。
	if(source.sourceType === 'chart' && key === 'astrochart_like'){
		return buildAstroLikeContext(source, key, label);
	}
	if(source.sourceType === 'chart' && ASTRO_LIKE_DERIVED_MODULES.indexOf(key) >= 0){
		return buildAstroLikeSingleContext(source, key, label);
	}
	if(source.sourceType === 'chart' && key === 'astrochart'){
		const ctx = canReuseBaseSourceContext ? baseSourceContext : await buildChartContext(source);
		return {
			key,
			title: label,
			module: key,
			content: ctx && ctx.content ? ctx.content : '',
			available: !!(ctx && ctx.content),
			status: ctx && ctx.content ? 'ready' : 'missing',
			meta: ctx && ctx.meta ? ctx.meta : {},
		};
	}
	const record = source.record || null;
	const payload = record ? parseRecordPayload(record.payload) : null;
	const fromPayload = getTechniqueSnapshotFromPayload(payload, key, source);
	let generated = null;
	if(source.sourceType === 'timepoint'){
		// 「起课时间」入口：纯时间 + 地点，没有「已存的卦」→ 时间确定式法按默认设置即时起盘；
		// 六爻在此入口走「时间起卦」(确定性，时间即输入)；统摄法等非纯时间可推的不在白名单。
		let timeText = '';
		if(TIMEPOINT_CASTABLE_SET.has(key)){
			timeText = canonicalSnapshotText(await regenerateCaseTechniqueSnapshot(record, key, payload));   // 与存槽同一规范形
			if(timeText){
				saveGeneratedTechniqueSnapshot(key, timeText, record, { generatedFromTimepoint: true });
			}
		}
		return {
			key,
			title: label,
			module: key,
			content: timeText || '',
			available: !!timeText,
			status: timeText ? 'ready' : 'missing',
			meta: timeText ? buildSnapshotMetaFromRecord(record, { generatedFromTimepoint: true }) : {},
		};
	}
	if(source.sourceType === 'case'){
		// 事盘：优先用本案例 payload 重建文本（不读全局模块缓存——那是「上次看过的某一卦」）。
		// 若 payload 未存该技法：时间确定式法（六壬/金口诀/奇门/太乙/三式）按本案例起课时间 + 默认【即时补算】，
		// 像命盘一样而非显示「未挂载」。六爻：已存 payload.gua 优先（generateCaseTechniqueSnapshot 读存卦、不被时间覆盖）；
		// 无存卦时按本案例起课时间【时间起卦】补（用户拍板：时间起卦是六爻确定性合法起法、非伪造摇卦）——故 sixyao 显式纳入
		// 补算条件，但**仍不进 TIME_CASTABLE_DIVINATION**（保 preflight[24] 护栏：防其它批量路径凭空补六爻）。
		if(!(fromPayload && fromPayload.content)){
			let generatedText = generateCaseTechniqueSnapshot(record, key, payload);
			let genFlag = { generatedFromStoredCase: true };
			if(!generatedText && (TIME_CASTABLE_SET.has(key) || key === 'sixyao')){
				generatedText = await regenerateCaseTechniqueSnapshot(record, key, payload);
				genFlag = { regeneratedFromCaseTime: true };
			}
			generatedText = canonicalSnapshotText(generatedText);   // 与存槽同一规范形
			if(generatedText){
				saveGeneratedTechniqueSnapshot(key, generatedText, record, genFlag);
				generated = {
					content: generatedText,
					createdAt: new Date().toISOString(),
					meta: buildSnapshotMetaFromRecord(record, genFlag),
					compatible: true,
					fromPayload: false,
					specificity: 4,
				};
			}
		}
		const pickedCase = pickSnapshotCandidate([fromPayload, generated]);
		return {
			key,
			title: label,
			module: key,
			content: pickedCase && pickedCase.content ? pickedCase.content : '',
			available: !!(pickedCase && pickedCase.content),
			status: pickedCase && pickedCase.content ? 'ready' : 'missing',
			meta: pickedCase && pickedCase.meta ? pickedCase.meta : {},
		};
	}
	// 合盘特判:须两张盘,无法由单命主 record 无头复算 —— 快照单源=合盘页所存模块快照
	// (AstroRelative componentDidUpdate 对 tab/关系/两盘/结果全 watch,选项一改即重存,故不陈旧)。
	// meta 带 chartA/chartB 名,与当前命主是否相关由用户/AI 自辨(快照首段有关系起盘信息)。
	if(key === 'relative'){
		const mounted = loadFreshModuleAISnapshot('relative');   // 先请合盘页按此刻所见重存(页不在场零等待),与导出同源
		let mContent = mounted && mounted.content && `${mounted.content}`.trim() ? mounted.content : ''; // 非空即可(与 getTechniqueSnapshotFromCache 同口径,不设长度阈)
		// 快照 meta 带两盘身份时核对当前命主:不属于 A/B 任一 → 不挂(missing + 提示),绝不把无关合盘喂给 AI。
		const relMeta = (mounted && mounted.meta) || {};
		const relMatch = relativeSnapshotMatchesRecord(relMeta, source.record);
		if(mContent && relMatch === false){
			mContent = '';
		}
		return {
			key,
			title: label,
			module: key,
			content: mContent,
			available: !!mContent,
			status: mContent ? 'ready' : 'missing',
			meta: relMatch === false ? { ...relMeta, mismatch: 'relative-parties', hint: '合盘页当前所存合盘不含本命主,请在合盘页以本命主重新起盘' } : relMeta,
		};
	}
	// 命盘（chart）：payload 命中优先；否则查兼容缓存（A1 已过滤掉不匹配的盘）；
	// 仍无则按本盘出生数据无头复算（Part A）。
	// 缓存认得出是这位命主(要直接用它)时,先请页面按当前所见重存再取(与导出同源):页面在场 → 槽里换成页面此刻的
	// 正文(带本盘出生签名,显示类选项改过也是新口径);页面不在场 → 无人应答、零等待,沿用缓存。重存后是不是这位命主
	// 仍由签名比对判定(页面换了人 → 认不出 → 下面按记录重算)。缓存本就认不出时不派发:反正重算,也免得异步应答的页面白取一次数。
	let fromCache = getTechniqueSnapshotFromCache(key, source);
	if(fromCache && fromCache.content){
		refreshPageSnapshotsBeforeMount(key);
		fromCache = getTechniqueSnapshotFromCache(key, source);
	}
	let genError = null;
	if(!(fromPayload && fromPayload.content) && !(fromCache && fromCache.content)){
		let generatedText = '';
		// [双盘挂载] 重算结果的内存小缓存:页面快照槽是「每技法一个」,本人与对方轮流取同一技法会互相覆盖 → 每次发送两人都重算
		//   (实测:轮流 4 次 = 重算 4 次)。命中 = 同一技法 + 同一份记录 + 同一星盘口径,直接复用、也不再写页面槽
		const regenKey = regeneratedSnapshotKey(key, record);
		const regenHit = regenKey ? REGENERATED_SNAPSHOT_CACHE.get(regenKey) : null;
		const reused = !!(regenHit && Date.now() - regenHit.at < REGENERATED_SNAPSHOT_TTL_MS);
		if(reused){
			generatedText = regenHit.text;
		}else{
			try{
				generatedText = canonicalSnapshotText(await regenerateChartTechniqueSnapshot(record, key, { throwOnError: true }));   // 与存槽同一规范形(第一次起盘与之后读槽逐字相同)
			}catch(e){
				// 后端不可达/排盘抛错 ⇒ 出 status:'error' + meta.error(此前静默成 missing,用户以为该技法没数据)
				genError = e;
				console.warn('[aiAnalysis] 技法快照重算失败', key, e && e.message ? e.message : e);
			}
			if(generatedText && regenKey){
				REGENERATED_SNAPSHOT_CACHE.set(regenKey, { text: generatedText, at: Date.now() });
				while(REGENERATED_SNAPSHOT_CACHE.size > REGENERATED_SNAPSHOT_MAX){ REGENERATED_SNAPSHOT_CACHE.delete(REGENERATED_SNAPSHOT_CACHE.keys().next().value); }
			}
		}
		if(generatedText){
			if(!reused){
				saveGeneratedTechniqueSnapshot(key, generatedText, record, {
					generatedFromChart: true,
				});
			}
			generated = {
				content: generatedText,
				createdAt: new Date().toISOString(),
				meta: buildSnapshotMetaFromRecord(record, {
					generatedFromChart: true,
				}),
				compatible: true,
				fromPayload: false,
				specificity: 5,
			};
		}
	}
	const picked = pickSnapshotCandidate([fromPayload, fromCache, generated]);
	const hasContent = !!(picked && picked.content);
	return {
		key,
		title: label,
		module: key,
		content: hasContent ? picked.content : '',
		available: hasContent,
		status: hasContent ? 'ready' : (genError ? 'error' : 'missing'),
		meta: { ...(picked && picked.meta ? picked.meta : {}), ...(!hasContent && genError ? { error: `${(genError && genError.message) || genError}` } : {}) },
	};
}

// 挂载读缓存前的页面刷新:对缓存会读的每个槽名(技法别名全集,与 getTechniqueSnapshotFromCache 同一张表)同步派发一次。
// 只用同步应答(不轮询):页面不在场时不白等;异步应答的页面照旧读它已存的缓存。刷新失败不阻断挂载。
function refreshPageSnapshotsBeforeMount(key){
	refreshModuleSnapshotSlots(getTechniqueAliasList(key));   // 与存案 / 报告同一个刷新入口(moduleSnapshotRefresh)
}

function isChartTechnique(key){
	return ANALYSIS_CHART_TECHNIQUES.indexOf(normalizeTechniqueKey(key)) >= 0;
}

// 命盘星盘(astrochart / astrochart_like)按 record(含挂载覆盖字段)强制重起西洋盘 → 出快照正文。
// 不走 buildChartContext 的「已存快照复用」(那会无视新设置)，与 buildChartContext 同一 fetch+build 口径。
async function regenerateAstroChartSnapshot(record){
	const fields = buildFieldObject(record);
	const params = fieldParams(fields);
	const rsp = await fetchChart({
		...params,
		includePrimaryDirection: false,
	}, {
		silent: true,
		timeoutMs: 20000,
	});
	if(!rsp || !rsp.Result){
		return '';
	}
	let content = `${buildAstroSnapshotContent(rsp.Result, fields, { classicalDerived: true }) || ''}`.trim();   // astrochart 挂载齿轮重算同口径(衍化四段)
	// 🔴 与 buildChartContext 同源补齐:默认路径尾部会拼「古典格局派生分析」整段
	// (护卫/优势相位/相位动态/逐题主星/偶然尊贵/恒星/行星时/埃及历/巴比伦),此前齿轮重算
	// 路径漏拼 → 一动挂载设置该整段消失(极易被读成「重算失败」)。
	try{
		const analysisSection = await fetchClassicalAnalysisSection(params);
		if(analysisSection){
			content = `${content}\n\n${analysisSection}`.trim();
		}
	}catch(_e){
		// 派生段失败不阻断主体快照(与默认路径同容错)。
	}
	return content;
}

// AI 挂载「每技法设置」核心入口。
// options 非空 → 强制按新设置重算该技法快照（绕过 payload/cache 命中），返回 status='regenerated' 的技法上下文；
// options 为空 → 直接走原 buildTechniqueContext（默认即现状，一行不改默认路径，守「默认即现状」铁律）。

export async function getAnalysisTechniqueContextWithOptions(source, techniqueKey, options, baseSourceContext){
	const key = normalizeTechniqueKey(techniqueKey);
	if(!source || !key){
		return null;
	}
	const schema = getTechniqueSettingsSchema(key);
	const record = source.record || {};
	// 🔴 覆盖判定的比较锚=盘现状,不再是裸 schema 默认:盘存 hsys=1 时用户选 0(整宫制)
	// =真覆盖 → 必须重算;此前锚 schema 默认(恰为 0)把它当「无覆盖」直接走默认路径(用户实锤)。
	// 锚收敛 effectiveMountBaseline 单源(UI 抽屉与重算入口同一双眼睛):
	// A 类=record 平铺 ?? 现状默认(globalCurrent 种子键读全局现值);B 类=payload 存档段
	// (baselineSource 认存档层,六爻 gua.* 同款);C 类=record 长名 ?? 全局 storageKey 现值;
	// chartRoute(cetian/huangji)=存档段打底+平铺覆盖。四叉此前散在两文件各自实现,漂移即分叉。
	const overrideBaseline = effectiveMountBaseline(key, record);
	const opts = pruneOptionsToNonDefault(key, options || {}, overrideBaseline);
	const hasOverride = opts && Object.keys(opts).length > 0;
	if(!hasOverride || !schema || schema.kind === 'sectionsOnly'){
		return buildTechniqueContext(source, key, baseSourceContext); // 默认路径,零行为变化
	}
	const label = getTechniqueLabel(key);
	let text = '';
	let regenError = null;
	try{
		if(schema.kind === 'localStorage'){
			// C 类:显示选项(builder 自读全局键)的覆盖走 GuoLaoChartStyle 的进程内覆盖作用域强制重算——
			// 此前是「临时写 localStorage + await 后端重算 + finally 还原」:重算途中刷新 / 关窗则 finally
			// 不跑,用户的七政全局设置(命度/罗计/宿度制/身宫/岁差)被永久改成覆盖值;同窗口并发读取也拿到临时值。
			// 现 localStorage 全程不写,覆盖只活在内存作用域里,刷新即失、零残留。
			text = await withGuolaoStoredOverrides(localStorageOverrideMap(key, opts, record),
				() => regenerateChartTechniqueSnapshot(mergeOptionsIntoRecord(record, key, opts), key));
		}else if(isChartTechnique(key)){
			// A 类:把 options merge 进 record.*(buildFieldObject 读)，强制重算。
			// 本分支只查 isChartTechnique、不看 source 类型:事盘源 + 双栖技法(suzhan/huangji)
			// 会走命盘管道、以 divTime 兜底起盘——以事发时刻起盘是卜法正统语义(horary 同构),非缺陷;
			// 快照内由 annotateCaseTimeAsChartBase 自声明起盘方式,防 AI 把事时误读为出生时。
			const mergedRecord = mergeOptionsIntoRecord(record, key, opts);
			if(key === 'astrochart' || key === 'astrochart_like'){
				text = await regenerateAstroChartSnapshot(mergedRecord);
			}else{
				text = await regenerateChartTechniqueSnapshot(mergedRecord, key);
			}
		}else{
			// B 类:把 options 叠进 payload，强制走 regenerateCaseTechniqueSnapshot。
			const payload = record ? parseRecordPayload(record.payload) : null;
			const mergedPayload = mergeOptionsIntoPayload(payload || {}, key, opts);
			text = await regenerateCaseTechniqueSnapshot(record, key, mergedPayload);
		}
	}catch(e){
		// 吞异常曾致「覆盖重算失败」与「本无快照」同貌(status 都落 missing),
		// 排障只能盲猜——留日志+独立 error 态,UI 端据此给「重算失败」而非「自动补生成」提示。
		text = '';
		regenError = e;
		console.warn('[aiAnalysis] 挂载覆盖重算失败', key, e);
	}
	// 🔒 覆盖结果只回传、绝不写共享模块缓存（saveGeneratedTechniqueSnapshot）：否则会污染该技法槽，命盘默认路径
	// buildTechniqueContext(读 getTechniqueSnapshotFromCache，isCacheSnapshotConfidentMatch 只比生辰、不看 mountOverride)
	// 会读到这条旧覆盖、跳过默认重算 → 用户「恢复默认/清除覆盖」后卡片不回退、且连带污染 AI 导出/储存读到的"最近快照"。
	// 覆盖本就每次按 options 无条件重算（上方），不需缓存；与事盘路径"不读全局缓存"口径一致。「设为同类默认」的持久化
	// 走 saveMountTechniqueDefaults(settings) 而非此缓存。改动前先读本注释——别把 save 加回来。
	text = canonicalSnapshotText(text);   // 与默认路径同一规范形(覆盖重算与默认起盘的正文收尾一致)
	return {
		key,
		title: label,
		module: key,
		content: text || '',
		available: !!text,
		status: text ? 'regenerated' : (regenError ? 'error' : 'missing'),
		meta: text ? buildSnapshotMetaFromRecord(record, { mountOverride: true }) : {},
	};
}

export function listAnalysisTechniqueOptions(source){
	let keys;
	if(source && source.sourceType === 'timepoint'){
		// 起课时间源:直接展开 TIMEPOINT_CASTABLE_SET 单源(此前手抄清单与集 drift——
		// 小六壬/飞宫在可起集内却不在下拉=「新技法无法挂载」的根因;单源后入集即入下拉,
		// 黄历/通书/扩展技法亦由集内成员自然带出,不再逐处补抄)。
		keys = [...TIMEPOINT_CASTABLE_SET];
	}else if(source && source.sourceType === 'case'){
		keys = ANALYSIS_CASE_TECHNIQUES;
	}else{
		keys = ANALYSIS_CHART_TECHNIQUES;
	}
	return keys.map((key)=>({
		value: key,
		label: getTechniqueLabel(key),
	}));
}

// 技法键 → 中文名映射(口径分层「技法口径·X」小标题用;此前调用方不传 techniqueLabels → 注入时回落英文键)
export function analysisTechniqueLabelMap(keys){
	const out = {};
	(Array.isArray(keys) ? keys : []).forEach((k)=>{ const key = `${k || ''}`.trim(); if(key && !out[key]){ out[key] = getTechniqueLabel(key); } });
	return out;
}

// 组合包用：与 source 无关的「全技法」选项（命盘类 + 事盘类去重），供组合编辑时预选默认挂载技法。
export function listAllAnalysisTechniqueOptions(){
	const seen = new Set();
	const out = [];
	[...ANALYSIS_CHART_TECHNIQUES, ...ANALYSIS_CASE_TECHNIQUES].forEach((key)=>{
		if(seen.has(key)){
			return;
		}
		seen.add(key);
		out.push({ value: key, label: getTechniqueLabel(key) });
	});
	return out;
}

// 紫微(四化流派 / 自定义表 / 引擎开关)与七政(进程内显示选项覆盖)的构造在 await 期间改写全局单例:同技法的两次构造不可交错
// (双盘挂载时本人与对方的预览同时起;此前单盘只会一张盘一次)。按技法排队,其余技法不经这里(零变化)。
const SERIAL_TECHNIQUE_KEYS = { ziwei: 1, guolao: 1 };
const SERIAL_TECHNIQUE_CHAINS = new Map();
export function withSerialTechniqueBuild(key, fn){
	if(!SERIAL_TECHNIQUE_KEYS[key]){ return fn(); }
	const prev = SERIAL_TECHNIQUE_CHAINS.get(key) || Promise.resolve();
	const run = prev.then(()=>fn());
	const tail = run.then(()=>undefined, ()=>undefined);
	SERIAL_TECHNIQUE_CHAINS.set(key, tail);
	tail.then(()=>{ if(SERIAL_TECHNIQUE_CHAINS.get(key) === tail){ SERIAL_TECHNIQUE_CHAINS.delete(key); } });
	return run;
}

export async function getAnalysisTechniqueContexts(source, techniqueKeys, options = {}){
	if(!source){
		return [];
	}
	const keys = Array.from(new Set((techniqueKeys || []).map((item)=>normalizeTechniqueKey(item)).filter(Boolean)));
	if(!keys.length){
		return [];
	}
	const baseSourceContext = options.sourceContext || null;
	// 「每技法设置」覆盖映射 {[key]:optionsObj}。某技法有非默认覆盖 → 走强制重算入口；否则走默认 buildTechniqueContext。
	const techniqueOptions = options.techniqueOptions && typeof options.techniqueOptions === 'object'
		? options.techniqueOptions : null;
	const results = [];
	for(let i = 0; i < keys.length; i += 1){
		const k = keys[i];
		const overrideOpts = techniqueOptions && techniqueOptions[k] && typeof techniqueOptions[k] === 'object'
			? techniqueOptions[k] : null;
		// 逐技法隔离:一处抛出不再让整组挂载失败(该技法落 error,兄弟技法照常)
		let context = null;
		try{
			// 用全局单例做临时覆盖的技法(紫微 / 七政)同技法排队串行(双盘时两人的预览会同时构造;不同技法照旧并行)
			// eslint-disable-next-line no-await-in-loop
			context = await withSerialTechniqueBuild(k, ()=>(overrideOpts
				? getAnalysisTechniqueContextWithOptions(source, k, overrideOpts, baseSourceContext)
				: buildTechniqueContext(source, k, baseSourceContext)));
		}catch(e){
			console.warn('[aiAnalysis] 技法上下文构造失败', k, e && e.message ? e.message : e);
			context = { key: k, title: getTechniqueLabel(k), module: k, content: '', available: false, status: 'error', meta: { error: `${(e && e.message) || e}` } };
		}
		if(context){
			// AI 挂载复用「AI导出设置」的按技法选段（达成四同步）。仅当用户显式自定义该技法段时才过滤，否则原样（默认即现状）。
			if(context.content){
				try{
					const before = context.content;
					const filterKey = context.key || k;
					// 段过滤后串「星曜后天信息」开关(与导出主链同序同语义;非 planetInfo 技法原样)。
					context.content = applyPlanetInfoFilterByContext(
						applyAIExportSectionFilterToSnapshot(filterKey, context.content), filterKey);
					// 原文非空但过滤后为空 = 用户在「纳入内容」显式全清 → 打标供挂载卡诚实提示
					// (区别于「快照缺失」),内容置空自然不进 AI prompt(buildContextLayers 跳空 content)。
					if(`${before || ''}`.trim() && !`${context.content || ''}`.trim()){
						context.sectionsCleared = true;
					}
				}catch(e){ /* 过滤失败保持原文 */ }
			}
			results.push(context);
		}
	}
	return results;
}

// 「起课时间」源的前提上下文：纯时间 + 地点的简短说明（技法快照各自携带正文）。
function buildTimepointContext(source){
	const record = source && source.record ? source.record : {};
	const lines = ['起课时间盘（按所选时间 + 默认设置即时起盘）'];
	if(record.divTime){ lines.push(`起课时间：${record.divTime}`); }
	if(record.zone){ lines.push(`时区：${record.zone}`); }
	if(record.lon || record.lat){ lines.push(`地点：经 ${record.lon || '—'} / 纬 ${record.lat || '—'}`); }
	return {
		content: lines.join('\n').trim(),
		title: source.title,
		module: 'timepoint',
		meta: buildSnapshotMetaFromRecord(record, { sourceType: 'timepoint', sourceId: source.id }),
	};
}

// 源上下文(full 模式)也过「纳入内容」段过滤 —— 补上此前的裸奔面:
// 无挂载技法时事盘/命盘走 source 前提层全文直发,用户在「纳入内容」取消的段照喂 AI(设置形同虚设)。
// 过滤採「读出后过滤」:contextCache 永远存原文,返回前按**当下**设置过滤 → 改设置即刻生效、
// 缓存零失效问题(与技法层 getAnalysisTechniqueContexts 同款成功模式);meta/timepoint 模式无段语义不滤。
function filterSourceContextBySections(ctx, source, mode){
	if(!ctx || !ctx.content || mode === 'meta' || (source && source.sourceType === 'timepoint')){
		return ctx;
	}
	const key = exportSettingKeyForSnapshotModule(ctx.module);
	if(!key){
		return ctx;
	}
	try{
		const before = ctx.content;
		const filtered = applyPlanetInfoFilterByContext(applyAIExportSectionFilterToSnapshot(key, before), key);
		if(filtered === before){
			return ctx;
		}
		const out = { ...ctx, content: filtered };
		// 原文非空但过滤后空 = 显式全清 → 打标供卡片诚实提示(与技法卡同语义)。
		if(`${before || ''}`.trim() && !`${filtered || ''}`.trim()){
			out.sectionsCleared = true;
		}
		return out;
	}catch(e){
		return ctx;
	}
}

// 上下文缓存命中触摸:context_cache 有条数上限(按 updatedAt 最旧先裁),命中的记录若超过
// 24h 未触摸就把 updatedAt 推到现在(fire-and-forget,不阻塞返回),常用盘的缓存不会因「写得早」被裁掉;
// 24h 内再次命中不写,避免每次命中都多一次写事务。updatedAt 不可解析时不写(交给裁剪按缺席键处理)。
const CONTEXT_CACHE_TOUCH_INTERVAL_MS = 24 * 60 * 60 * 1000;
function touchContextCacheRecord(cached){
	if(!cached || !cached.id){
		return false;
	}
	const age = Date.now() - parseDateTimeMs(cached.updatedAt || '');
	if(!(age > CONTEXT_CACHE_TOUCH_INTERVAL_MS)){
		return false;
	}
	Promise.resolve()
		.then(()=>putStoreRecord(AI_ANALYSIS_STORES.contextCache, { ...cached, updatedAt: new Date().toISOString() }, 'ctx'))
		.catch(()=>{ /* 触摸失败无害:下次命中再试 */ });
	return true;
}

export async function getAnalysisSourceContext(source, options = {}){
	if(!source){
		return null;
	}
	const mode = options.mode === 'meta' ? 'meta' : 'full';
	const cacheId = `${source.sourceType}:${source.id}:${mode}`;
	const preferCache = options.preferCache !== false;
	const shouldPreferCache = preferCache
		&& source.sourceType !== 'timepoint'
		&& !(source.sourceType === 'case' && source.snapshotStatus !== 'ready');
	// 缓存命中维度补「快照格式版本 + 全局口径签名」:此前只比 sourceUpdatedAt,改了星盘设置全局口径或升级拆段后,
	// 档案没改就继续喂旧文本(只能手动清缓存)。旧记录无两键 → 视为未命中重建一次(预期内)。
	const { formatVersion, calibreSig } = sourceContextCacheStamp();
	if(shouldPreferCache){
		const cached = await getStoreRecord(AI_ANALYSIS_STORES.contextCache, cacheId);
		if(cached && cached.sourceUpdatedAt === source.updatedAt && cached.content
			&& cached.formatVersion === formatVersion && (!calibreSig || cached.calibreSig === calibreSig)){
			touchContextCacheRecord(cached);
			return filterSourceContextBySections(cached, source, mode);
		}
	}
	let built;
	if(source.sourceType === 'timepoint'){
		built = buildTimepointContext(source);
	}else if(mode === 'meta'){
		built = source.sourceType === 'chart' ? buildChartMetaContext(source) : buildCaseMetaContext(source);
	}else{
		built = source.sourceType === 'chart' ? await buildChartContext(source) : await buildCaseContext(source);
	}
	const next = {
		id: cacheId,
		sourceId: source.id,
		sourceType: source.sourceType,
		title: source.title,
		module: built.module,
		content: built.content,
		meta: built.meta || {},
		// 随盘日界/晚子时口径:builder(buildChartContext/buildCaseContext/两 meta builder)供了值,此前重组缓存记录时被丢
		// → dayBoundaryRule 强制层恒按全局标注,23:00–23:59 生辰或存档口径≠全局的盘,四柱按记录口径、规则说明按全局(对 AI 撒谎)。
		...(built.after23NewDay !== undefined && built.after23NewDay !== null ? { after23NewDay: built.after23NewDay } : {}),
		...(built.lateZiHourUseNextDay !== undefined && built.lateZiHourUseNextDay !== null ? { lateZiHourUseNextDay: built.lateZiHourUseNextDay } : {}),
		sourceUpdatedAt: source.updatedAt || '',
		formatVersion,
		calibreSig,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
	await putStoreRecord(AI_ANALYSIS_STORES.contextCache, next, 'ctx');
	schedulePruneContextCache();   // 写计数触发的条数上限裁剪(fire-and-forget,不等待)
	return filterSourceContextBySections(next, source, mode);
}
