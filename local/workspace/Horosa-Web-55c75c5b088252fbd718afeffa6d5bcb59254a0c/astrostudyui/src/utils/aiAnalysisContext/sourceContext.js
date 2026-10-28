// AI 分析挂载上下文 · 源层上下文:事盘摘要、星盘快照签名比对、古典段、命盘 / 事盘上下文与元信息。
// 由 utils/aiAnalysisContext.js 门面统一对外导出。
import request from '../request';
import * as Constants from '../constants';
import { buildAstroSnapshotContent, loadAstroAISnapshot, buildClassicalAnalysisSection, ASTRO_SNAPSHOT_FORMAT_VERSION } from '../astroAiSnapshot';
import { recordHasCaptureMark } from '../recordFieldsRestore';
import {
	classicalBackendOverridesFromPlain, getClassicalChartGlobals, CLASSICAL_GLOBAL_DEFAULTS,
	classicalSnapshotNeverSig, fixedStarOrbParamsFor,
} from '../classicalChartGlobals';
import { getCaseTypeLabel, getCaseTypeMeta } from '../localcases';
// 「列挂载源」及其纯函数助手抽至轻模块 aiAnalysisSources —— 个别页面只需
// 列源,曾因 import 本文件连带整座 AI 核(~50 技法构建器)进自己的 chunk(46/47 回灌案)。
// 此处 import 供本文件其余函数继续使用,listAnalysisSources 在文件尾 re-export 保旧路径兼容。
import { normalizeTags, extractCaseSnapshotText } from '../aiAnalysisSources';
import { fetchChart } from '../../services/astro';
import { getStore } from '../storageutil';
import { recordClassicalFallback, buildFieldObject, fieldParams, saveGeneratedTechniqueSnapshot } from './recordFields';
import { generateCaseTechniqueSnapshot } from './regenCase';

// (summarizeCasePayload 已迁 aiAnalysisSources.js —— 顶部 import)

function summarizeCaseMeta(record){
	const lines = [];
	const meta = getCaseTypeMeta(record.caseType);
	lines.push(`案例名称：${record.event || '未命名案例'}`);
	lines.push(`案例类型：${getCaseTypeLabel(record.caseType)}`);
	lines.push(`所属模块：${record.sourceModule || meta.module || meta.value || ''}`);
	if(record.divTime){
		lines.push(`占断时间：${record.divTime}`);
	}
	if(record.zone){
		lines.push(`时区：${record.zone}`);
	}
	if(record.pos){
		lines.push(`地点：${record.pos}`);
	}
	const tags = normalizeTags(record.group);
	if(tags.length){
		lines.push(`标签：${tags.join('、')}`);
	}
	return lines.join('\n').trim();
}

// (extractCaseSnapshotText / listAnalysisSources 已迁 aiAnalysisSources.js —— 顶部 import/re-export。)

function parseAstroSnapshotSignature(signature){
	const raw = `${signature || ''}`.trim();
	if(!raw){
		return null;
	}
	const parts = raw.split('|');
	return {
		chartId: `${parts[0] || ''}`.trim(),
		birth: `${parts[1] || ''}`.trim(),
		zone: `${parts[2] || ''}`.trim(),
		lon: `${parts[3] || ''}`.trim(),
		lat: `${parts[4] || ''}`.trim(),
		zodiacal: `${parts[5] || ''}`.trim(),
		hsys: `${parts[6] || ''}`.trim(),
		// parts[7]=isDiurnal、parts[8]=onlyRulerExalt（不参与匹配）；parts[9]=恒星黄道 ayanāṃśa（新增，旧签名缺→''）。
		siderealAyanamsa: `${parts[9] || ''}`.trim(),
		// parts[10]/[11]=宫制/黄道**数字位**(与 record 同数轴,精确失效判定;旧签名缺→''=守卫跳过)。
		// parts[5]/[6] 的文本位是后端 echo(拼写不与前端表同构),仅存展示用途,不参与匹配。
		hsysNum: `${parts[10] || ''}`.trim(),
		zodiacalNum: `${parts[11] || ''}`.trim(),
		// parts[12]/[13]=择宫传统/界系数字位(同范式向后兼容;其余齿轮走覆盖路径
		// 无条件重算,不经本守卫 —— 本守卫只管「默认路径复用已存快照」的失效判定)。
		traditionNum: `${parts[12] || ''}`.trim(),
		termsVariantNum: `${parts[13] || ''}`.trim(),
		// parts[14]=古典口径 overrides JSON 段(签名侧 createAstroSnapshotSignature 同位):
		// 改燃烧上界/空亡口径/三分集等 22 键任一 → 段串变 → 精确失效。旧签名缺位→''=守卫跳过。
		classicalOv: `${parts[14] || ''}`.trim(),
	};
}

function normalizeSnapshotMatchText(value){
	return `${value || ''}`.trim();
}

function hasMatchingSavedAstroSnapshot(record){
	if(!record){
		return null;
	}
	const snapshot = loadAstroAISnapshot();
	if(!snapshot || !snapshot.content){
		return null;
	}
	// [Windows #79] payload 格式版本守卫:拆段/改表后的旧格式快照(version<ASTRO_SNAPSHOT_FORMAT_VERSION 或缺位=1)不得整份复用,
	// 否则挂载仍喂「分宫制宫头当主宰」的旧表。身份签名不动(签名位有钉死测试);最坏多算一次。常量缺位(mock)按 1=不拦。
	const requiredFormat = Number(ASTRO_SNAPSHOT_FORMAT_VERSION) || 1;
	if((Number(snapshot.version) || 1) < requiredFormat){
		return null;
	}
	const parsed = parseAstroSnapshotSignature(snapshot.signature);
	if(!parsed){
		return null;
	}
	const birth = normalizeSnapshotMatchText(record.birth);
	const zone = normalizeSnapshotMatchText(record.zone || '+08:00');
	const lon = normalizeSnapshotMatchText(record.lon);
	const lat = normalizeSnapshotMatchText(record.lat);
	if(parsed.birth && birth && parsed.birth !== birth){
		return null;
	}
	if(parsed.zone && zone && parsed.zone !== zone){
		return null;
	}
	if(parsed.lon && lon && parsed.lon !== lon){
		return null;
	}
	if(parsed.lat && lat && parsed.lat !== lat){
		return null;
	}
	if(!(parsed.birth || parsed.zone || parsed.lon || parsed.lat)){
		return null;
	}
	// 恒星黄道 ayanāṃśa 变更须使旧快照失效：两侧都有非空 ayanāṃśa 且不同 → 不复用（重新抓取）。
	// 仅「都非空且不同」才拦截：旧签名/回归盘/默认恒星 ayanāṃśa 为空 → 跳过 → 向后兼容（最坏多抓一次，绝不误用旧盘）。
	const recAyan = normalizeSnapshotMatchText(record.siderealAyanamsa);
	if(parsed.siderealAyanamsa && recAyan && parsed.siderealAyanamsa !== recAyan){
		return null;
	}
	// 🔴 宫制/黄道入比对(用户实锤根因 B):命盘页按别的宫制画盘落的旧快照曾被整份复用。
	// 比对用签名 parts[10]/[11] 的**数字位**(与 record 同数轴;parts[5]/[6] 文本位是后端 echo,
	// 拼写与前端表不同构不可比)。旧签名无数字位 → '' → 跳过(向后兼容,siderealAyanamsa 同范式;
	// 最坏复用一次旧快照,该盘下一次保存/重算即带新签名进入精确判定)。
	// record 缺省按全站默认归一(hsys 缺省=1/zodiacal 缺省=0),避免「缺省 vs 显式同值」误杀。
	const recHsys = `${record.hsys !== undefined && record.hsys !== null ? record.hsys : 1}`;
	if(parsed.hsysNum && parsed.hsysNum !== recHsys){
		return null;
	}
	const recZodiacal = `${record.zodiacal !== undefined && record.zodiacal !== null ? record.zodiacal : 0}`;
	if(parsed.zodiacalNum && parsed.zodiacalNum !== recZodiacal){
		return null;
	}
	// 择宫传统/界系两键改正文最重(界主/接纳/古典段),同范式比对;record 缺省
	// 归一 0=buildFieldObject 回退与页面初值同源。旧签名缺位 '' 跳过(向后兼容)。
	const recTradition = `${record.tradition !== undefined && record.tradition !== null ? record.tradition : 0}`;
	if(parsed.traditionNum && parsed.traditionNum !== recTradition){
		return null;
	}
	const recTermsVariant = `${record.termsVariant !== undefined && record.termsVariant !== null ? record.termsVariant : recordClassicalFallback(record, 'termsVariant')}`;
	if(parsed.termsVariantNum && parsed.termsVariantNum !== recTermsVariant){
		return null;
	}
	// 古典口径段比对:record 缺键=「随全局」(buildFieldObject 同款回退),故基准=全局仓打底、
	// record 平铺键覆盖,再经请求体单源归一成 JSON 串(两侧同函数产键,插入序固定=串稳定)。
	// 旧签名缺位 ''=跳过(hsysNum 同范式,向后兼容;最坏复用一次,下一次保存即进精确判定)。
	if(parsed.classicalOv){
		// 与 buildFieldObject 同一缺键口径:带标记的盘缺键 = 出厂默认,旧盘 = 全局
		const g = recordHasCaptureMark(record) ? { ...getClassicalChartGlobals(), ...CLASSICAL_GLOBAL_DEFAULTS } : getClassicalChartGlobals();
		const merged = { ...g };
		Object.keys(CLASSICAL_GLOBAL_DEFAULTS).forEach((k) => {
			if(record[k] !== undefined && record[k] !== null){ merged[k] = record[k]; }
		});
		// 随盘界表表体非 spec 键,上面循环带不进——显式 overlay,否则外机自定义表记录
		// 比对侧落到本机仓表,与签名侧(随盘表)恒不等 → 该类记录快照永不命中缓存。
		['customTermsDay', 'customTermsNight'].forEach((k) => {
			if(Array.isArray(record[k])){ merged[k] = record[k]; }
		});
		const recOv = JSON.stringify({
			...classicalBackendOverridesFromPlain(merged),
			...classicalSnapshotNeverSig((k) => merged[k]),
		});
		if(parsed.classicalOv !== recOv){
			return null;
		}
	}
	return snapshot;
}

// G10 空亡古典义:读 app 全局态(星盘设置「空亡古典义(30°内)」开关,非命盘 record 字段),与 AstroAnalysisLab.load
// 透传 voidClassical 同口径 → AI 快照[古典格局]·相位动态·空亡 行与右栏一致。默认 0(开关随重启保留,与同抽屉兄弟项同)
// 等价于不发该参(后端缺键即本座义)→ 默认/未开用户字节级零回归。读态失败一律回 0(降级)。
function liveVoidClassical(){
	try{
		const st = getStore();
		const app = st && st.app ? st.app : null;
		return app && (app.voidClassical === 1 || app.voidClassical === '1' || app.voidClassical === true) ? 1 : 0;
	}catch(e){
		return 0;
	}
}

// 古典格局派生分析(analyze_chart)按需 fetch — 优雅降级(失败/异常返回 '',不影响 AI 主体)。
// ~50ms 级(仅极区 heliacal 才慢),只在 AI 实际取数时拉,绝不进每盘预建快照 → 信息tab 不受拖累。
export async function fetchClassicalAnalysisSection(params){
	// 守 (HIGH-5):缺 date/zone/lat/lon 任一都静默 skip,后端必校验,缺则 4xx 易经 silent 漏到顶栏。
	if(!params || !params.date || !params.zone || params.lat === undefined || params.lat === null || params.lon === undefined || params.lon === null){
		return '';
	}
	try{
		// voidClassical 默认 0 → 与 AstroAnalysisLab 同参;后端缺键=本座义=现状,默认用户零回归。
		const vc = liveVoidClassical();
		// 恒星轨读全局仓(此前硬编 1° → 用户在星盘设置改恒星轨后,AI 古典段与主盘恒星集漂移)。
		// 随盘 starOrb/starOrbMode 优先(record 挂载齿轮/存档回显),缺则全局仓;档位一并下发。
		const reqBody = { _v: 'cls1', ...params, ...fixedStarOrbParamsFor(params) };   // [SURF] 缓存代次盐
		if(vc){ reqBody.voidClassical = true; }
		const data = await request(`${Constants.ServerRoot}/astroextra/analysis`, {
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

export async function buildChartContext(source){
	const record = source && source.record ? source.record : null;
	if(!record){
		throw new Error('chart.source.required');
	}
	const fields = buildFieldObject(record);
	const params = fieldParams(fields);
	let content;
	let meta;
	const saved = hasMatchingSavedAstroSnapshot(record);
	if(saved){
		content = `${saved.content || ''}`.trim();
		meta = {
			sourceType: 'chart',
			sourceId: source.id,
			birth: record.birth || '',
			zone: record.zone || '',
			reusedStoredSnapshot: true,
		};
	}else{
		// 修(HIGH-6):fetchChart 失败时不再 throw(原代码 throw 上传至 AI 主流程 → 红屏「构造命盘上下文失败」)。
		// 优雅退化:返回空 content + reused-snapshot-style meta,AI 可降级使用既有片段或提示用户。
		let rsp = null;
		try{
			rsp = await fetchChart({ ...params, includePrimaryDirection: false }, { silent: true, timeoutMs: 20000 });
		}catch(e){
			rsp = null;
		}
		if(!(rsp && rsp.Result)){
			// 静默退化仍留痕:无 Result 的形态(undefined=请求层吞错/信封=后端业务错)是排障第一线索。
			try{ console.warn('[aiAnalysis] astrochart 起盘无 Result', rsp === undefined ? 'undefined' : (rsp === null ? 'null' : JSON.stringify(rsp).slice(0, 200))); }catch(_e){ /* noop */ }
		}
		content = (rsp && rsp.Result) ? `${buildAstroSnapshotContent(rsp.Result, fields, { classicalDerived: true }) || ''}`.trim() : '';   // astrochart 挂载与本命保存链同口径(衍化四段)
		if(rsp && rsp.Result && !content){
			console.warn('[aiAnalysis] astrochart 有 Result 但快照构造为空', Object.keys(rsp.Result).slice(0, 12).join(','));
		}
		meta = {
			sourceType: 'chart',
			sourceId: source.id,
			birth: record.birth || '',
			zone: record.zone || '',
			chartFetchFailed: !(rsp && rsp.Result),
		};
	}
	// 古典格局派生分析(护卫/优势相位/相位动态/逐题主星/偶然尊贵/恒星/行星时/埃及历/巴比伦)按需拼入 → AI 挂载不遗漏。
	const analysisSection = await fetchClassicalAnalysisSection(params);
	if(analysisSection){
		content = `${content}\n\n${analysisSection}`.trim();
	}
	return {
		content,
		title: source.title,
		module: 'astrochart',
		meta,
		// 🔴 激活 dayBoundaryRule 强制层的死分支:该层「优先用案例自带开关值」的读取点
		// (sourceContext.after23NewDay)此前无任何 builder 供给 → 恒回退全局 localStorage ——
		// 盘存非默认日界时,强制层标注与正文四柱口径分叉(对 AI 撒谎)。现按 record 实值供给。
		...(record.after23NewDay !== undefined && record.after23NewDay !== null ? { after23NewDay: record.after23NewDay } : {}),
		...(record.lateZiHourUseNextDay !== undefined && record.lateZiHourUseNextDay !== null ? { lateZiHourUseNextDay: record.lateZiHourUseNextDay } : {}),
	};
}

export function buildChartMetaContext(source){
	const record = source && source.record ? source.record : null;
	if(!record){
		throw new Error('chart.source.required');
	}
	const lines = [];
	lines.push(`命盘名称：${source.title || record.name || '未命名命盘'}`);
	lines.push('案例类型：命盘');
	if(record.birth){
		lines.push(`出生时间：${record.birth}`);
	}
	if(record.zone){
		lines.push(`时区：${record.zone}`);
	}
	if(record.lon || record.lat){
		lines.push(`经纬度：${record.lon || ''} ${record.lat || ''}`.trim());
	}
	if(record.pos){
		lines.push(`地点：${record.pos}`);
	}
	const tags = normalizeTags(record.group);
	if(tags.length){
		lines.push(`标签：${tags.join('、')}`);
	}
	return {
		content: lines.join('\n').trim(),
		title: source.title,
		module: 'chart_meta',
		meta: {
			sourceType: 'chart',
			sourceId: source.id,
			birth: record.birth || '',
			zone: record.zone || '',
			metaOnly: true,
		},
		// meta 模式(挂了技法)同供随盘日界口径,与 full 模式 buildChartContext 同源
		...(record.after23NewDay !== undefined && record.after23NewDay !== null ? { after23NewDay: record.after23NewDay } : {}),
		...(record.lateZiHourUseNextDay !== undefined && record.lateZiHourUseNextDay !== null ? { lateZiHourUseNextDay: record.lateZiHourUseNextDay } : {}),
	};
}

export async function buildCaseContext(source){
	const record = source && source.record ? source.record : null;
	if(!record){
		throw new Error('case.source.required');
	}
	const extracted = extractCaseSnapshotText(record);
	if(extracted.content && extracted.snapshotStatus === 'ready'){
		return {
			content: extracted.content,
			title: source.title,
			module: extracted.moduleName,
			meta: {
				sourceType: 'case',
				sourceId: source.id,
				caseType: record.caseType,
				divTime: record.divTime,
			},
		};
	}
	// Part F：事盘只从自身 payload 重建文本（用起盘结果，不碰时间），不读全局模块缓存
	// （那是「上次看过的某一卦」，会挂出与所选事盘对不上的内容），也不按时间重新起盘。
	const generated = generateCaseTechniqueSnapshot(record, extracted.moduleName, extracted.payload);
	if(generated){
		saveGeneratedTechniqueSnapshot(extracted.moduleName, generated, record);
		return {
			content: generated,
			title: source.title,
			module: extracted.moduleName,
			meta: {
				sourceType: 'case',
				sourceId: source.id,
				caseType: record.caseType,
				divTime: record.divTime,
				generatedFromStoredCase: true,
			},
		};
	}
	// 事盘侧同供日界口径(payload.fieldSnapshot 是存案时的口径快照,存案保真战役已接):
	// 让 dayBoundaryRule 强制层读到该盘存档口径而非全局现值。
	let dayRule = {};
	try{
		const pl = typeof record.payload === 'string' ? JSON.parse(record.payload) : record.payload;
		const fs = pl && pl.fieldSnapshot && typeof pl.fieldSnapshot === 'object' ? pl.fieldSnapshot : null;
		if(fs){
			dayRule = {
				...(fs.after23NewDay !== undefined && fs.after23NewDay !== null ? { after23NewDay: fs.after23NewDay } : {}),
				...(fs.lateZiHourUseNextDay !== undefined && fs.lateZiHourUseNextDay !== null ? { lateZiHourUseNextDay: fs.lateZiHourUseNextDay } : {}),
			};
		}
	}catch(_e){
		dayRule = {};
	}
	return {
		content: extracted.content,
		title: source.title,
		module: extracted.moduleName,
		meta: {
			sourceType: 'case',
			sourceId: source.id,
			caseType: record.caseType,
			divTime: record.divTime,
		},
		...dayRule,
	};
}

export function buildCaseMetaContext(source){
	const record = source && source.record ? source.record : null;
	if(!record){
		throw new Error('case.source.required');
	}
	// meta 模式同供存档日界口径(payload.fieldSnapshot),与 full 模式 buildCaseContext 同源
	let dayRule = {};
	try{
		const pl = typeof record.payload === 'string' ? JSON.parse(record.payload) : record.payload;
		const fs = pl && pl.fieldSnapshot && typeof pl.fieldSnapshot === 'object' ? pl.fieldSnapshot : null;
		if(fs){
			dayRule = {
				...(fs.after23NewDay !== undefined && fs.after23NewDay !== null ? { after23NewDay: fs.after23NewDay } : {}),
				...(fs.lateZiHourUseNextDay !== undefined && fs.lateZiHourUseNextDay !== null ? { lateZiHourUseNextDay: fs.lateZiHourUseNextDay } : {}),
			};
		}
	}catch(_e){
		dayRule = {};
	}
	return {
		content: summarizeCaseMeta(record),
		title: source.title,
		module: source.module || record.sourceModule || getCaseTypeMeta(record.caseType).module,
		meta: {
			sourceType: 'case',
			sourceId: source.id,
			caseType: record.caseType,
			divTime: record.divTime,
			metaOnly: true,
		},
		...dayRule,
	};
}
