// AI 快照组装与无头重算(口径行、行运段、附加分盘简表、按字段起盘)
// 从 IndiaChart.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import * as AstroConst from '../../../constants/AstroConst';
import { buildAstroSnapshotContent } from '../../../utils/astroAiSnapshot';
import { jyotishPartialErrors, jyotishPartialErrorLabel } from '../indiaMain/jyotishData';
import { indiaTransitBirthSig, buildTransitEventLines, indiaTransitSnapshotFor, savedTransitSelection, TRANSIT_DEFAULT_SELECTION } from '../../../utils/indiaExtraTables';
import request from '../../../utils/request';
import * as Constants from '../../../utils/constants';
import { resolveIndiaFractal, resolveIndiaLabel, fieldsToParams, localTodaySlash, requestIndiaChartData } from './request';
import { splitSections, ensureSection, buildDashaSnapshotLines } from './dashaLines';
import { buildJyotishSnapshotLines } from './jyotishLines';

// 印占实际口径行:盘按恒星黄道(印占岁差)+ 印度分宫制算,但 buildAstroSnapshotContent 读的是
// fields.zodiacal/hsys(印占 fields 恒 0/1)→ [起盘信息] 印「回归黄道，Alcabitus」与实算相反。与 fieldsToParams 同一派生。
export function indiaCalibreLine(fields, overrides = {}){
	const f = fields || {};
	const hsysVal = overrides.indiaHsys !== undefined && overrides.indiaHsys !== null
		? AstroConst.normalizeIndiaHouseSystem(overrides.indiaHsys)
		: (f.indiaHsys ? AstroConst.normalizeIndiaHouseSystem(f.indiaHsys.value) : AstroConst.INDIA_HOUSE_SYSTEM_DEFAULT);
	const ayan = overrides.indiaAyanamsa !== undefined && overrides.indiaAyanamsa !== null
		? AstroConst.normalizeIndiaAyanamsa(overrides.indiaAyanamsa)
		: (f.indiaAyanamsa ? AstroConst.normalizeIndiaAyanamsa(f.indiaAyanamsa.value) : AstroConst.INDIA_AYANAMSA_DEFAULT);
	const hit = AstroConst.INDIA_HOUSE_SYSTEM_OPTIONS.find((o)=>`${o.value}` === `${hsysVal}`);
	return `${AstroConst.zodiacalDisplayText(1, ayan)}，${hit ? hit.label : `分宫制 ${hsysVal}`}`;
}
export function replaceIndiaCalibreLine(baseInfoLines, calibreLine){
	const lines = Array.isArray(baseInfoLines) ? baseInfoLines.slice() : [];
	const idx = lines.findIndex((l)=>/^(回归黄道|恒星黄道)/.test(`${l}`.trim()));
	if(idx >= 0){ lines[idx] = calibreLine; }else if(calibreLine){ lines.push(calibreLine); }
	return lines;
}

export function buildIndiaSnapshotText(chartObj, fields, chartnum, hook){
	if(!chartObj || !chartObj.chart){
		return '';
	}
	const fractal = resolveIndiaFractal(chartnum, hook);
	const label = resolveIndiaLabel(fractal, hook);
	const astroText = buildAstroSnapshotContent(chartObj, fields) || '';
	const sections = splitSections(astroText);
	const baseInfo = replaceIndiaCalibreLine(sections['起盘信息'] || [], indiaCalibreLine(fields));
	const houseCusps = sections['宫位宫头'] || [];
	const starsAndPoints = sections['星与虚点'] || [];
	const info = sections['信息'] || [];
	const aspects = sections['相位'] || [];
	const planets = sections['行星'] || [];
	const lots = sections['希腊点'] || [];
	const possibility = sections['可能性'] || [];
	// 三段各自成表 / 成段,中间空一行(紧挨着时下游 markdown 会把第二张表的表头当成第一张表的数据行)
	const starInfo = [houseCusps, starsAndPoints, info].filter((part)=>part.length)
		.reduce((acc, part)=>(acc.length ? [...acc, '', ...part] : [...part]), []);

	const lines = [];
	const schoolVal = fields && fields.indiaSchool && fields.indiaSchool.value
		? AstroConst.normalizeIndiaSchool(fields.indiaSchool.value) : AstroConst.INDIA_SCHOOL_DEFAULT;
	const schoolDef = AstroConst.getIndiaSchoolDefaults(schoolVal) || {};
	const schoolOpt = AstroConst.INDIA_SCHOOL_OPTIONS.find((o)=>o.value === schoolVal) || {};
	const PARA_CN = { graha: '七政相映', rasi: '星座相位', tajika: 'Tajika 容许度', kp: 'significator 链', nadi: '同座/交换' };
	const DF_CN = { vimshottari: 'Vimshottari', chara: 'Chara', mudda: 'Mudda(年内)', jupiterProgression: '木星推进' };
	const variantMap = AstroConst.normalizeIndiaDashaVariants(
		fields && fields.indiaDashaVariants ? fields.indiaDashaVariants.value : null);
	const variantKeys = Object.keys(variantMap).sort();
	const variantLine = variantKeys.length
		? [`大运流派开关：已自定义 ${variantKeys.length} 项（${variantKeys.map((k)=>{
			const spec = AstroConst.INDIA_DASHA_VARIANT_SPECS.find((it)=>it.key === k) || {};
			const opt = (spec.options || []).find((o)=>o.value === variantMap[k]) || {};
			return `${spec.label || k}=${(opt.label || variantMap[k]).replace(/（.*?）/g, '')}`;
		}).join('、')}）`]
		: [];
	ensureSection(lines, '起盘信息', [
		`流派：${schoolOpt.label || schoolVal}（相位范式 ${PARA_CN[schoolDef.aspectParadigm] || schoolDef.aspectParadigm || '七政相映'} · 主运取向 ${DF_CN[schoolDef.dashaFocus] || 'Vimshottari'}）`,
		...variantLine,
		`当前分盘：${label}`,
		`分盘：D${fractal}`,
		...baseInfo,
	]);
	ensureSection(lines, '星盘信息', starInfo);
	ensureSection(lines, '信息', info);
	ensureSection(lines, '相位', aspects);
	ensureSection(lines, '行星', planets);
	ensureSection(lines, '希腊点', lots);
	ensureSection(lines, '可能性', possibility);
	const dataSections = buildIndiaSnapshotDataSections(chartObj, fields);
	Object.keys(dataSections).forEach((title)=>{
		ensureSection(lines, title, dataSections[title]);
	});
	const transitLines = indiaTransitSnapshotLines(fields);
	if(transitLines.length){ ensureSection(lines, '穿界时刻', transitLines); }
	return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// 引擎子块失败的落账名(jyotish.partialErrors)→ 快照「未能计算」段(段名表与页面提示共用 indiaMain/jyotishData)。
export function indiaPartialErrorLines(chartObj){
	const names = jyotishPartialErrors(chartObj && chartObj.jyotish).map(jyotishPartialErrorLabel);
	return names.length ? [`以下各段本次未能计算(不是没有,而是没算出来):${names.join('、')}`] : [];
}

// 快照里「随回包数据而变」的全部段(大运 + jyotish 各段),按快照里的先后排。流派开关挂载合同
// (indiaVariantMountContract)直接比这一份:开关改了回包或前端切分,这里必须跟着变。
export function buildIndiaSnapshotDataSections(chartObj, fields){
	const out = {};
	const dashaSystem = fields && fields.indiaDashaSystem ? fields.indiaDashaSystem.value : undefined;
	const dashaLines = buildDashaSnapshotLines(chartObj, dashaSystem, fields);
	if(dashaLines.length){
		out['大运Dasha'] = dashaLines;
	}
	const jyotishSections = buildJyotishSnapshotLines(chartObj, fields);
	Object.keys(jyotishSections).forEach((title)=>{
		if(!(title in out)){ out[title] = jyotishSections[title]; }
	});
	const partial = indiaPartialErrorLines(chartObj);
	if(partial.length){
		out['未能计算'] = partial;
	}
	return out;
}

// 穿界表的请求体(页面与无头复算同一份):只用时区和岁差,时刻由起始日决定,不随本命盘的生时变
export function indiaTransitEventParams(base){
	const { date, time, ad, zone, lat, lon, hsys } = base || {};
	return { date, time, ad, zone, lat, lon, hsys, zodiacal: 1, siderealAyanamsa: base ? base.siderealMode : undefined };
}

function birthSigOfFields(fields){
	try{ return fields ? indiaTransitBirthSig(fieldsToParams(fields)) : ''; }catch(e){ return ''; }
}

// 印占页「行运」页签当前那张穿界表(按所选的星、事件、范围);页面没打开过 / 不是这张盘 → 没有这一段
export function indiaTransitSnapshotLines(fields){
	return buildTransitEventLines(indiaTransitSnapshotFor(birthSigOfFields(fields)));
}

// 无头复算 / 导出补段:所选三项 = 挂载齿轮 → 本机保存值 → 缺省(七星 · 入星座 · 90 天),起始 = 过运日 → 今日。
// 页面上这张盘的穿界表与所选、起始、岁差全对得上就直接用它(省一次请求),否则按所选现取。
// (此前只要齿轮里有值就弃用页面那张,而齿轮缺省本身就带值 —— 页面那张从来用不上,每次都多发一次请求。)
function requestedTransitSelection(fields){
	const saved = savedTransitSelection();
	const given = (name)=>fields && fields[name] && fields[name].value !== undefined && fields[name].value !== null && fields[name].value !== '';
	const pick = (name, key)=>(given(name) ? fields[name].value : (saved[key] !== undefined ? saved[key] : TRANSIT_DEFAULT_SELECTION[key]));
	return {
		transitPlanet: pick('indiaTransitPlanet', 'transitPlanet'),
		transitKind: pick('indiaTransitKind', 'transitKind'),
		transitDays: Number(pick('indiaTransitDays', 'transitDays')) || TRANSIT_DEFAULT_SELECTION.transitDays,
	};
}

function pageTransitEntryMatches(entry, selection, start, ayanamsa){
	return !!entry
		&& `${entry.transitPlanet}` === `${selection.transitPlanet}`
		&& `${entry.transitKind}` === `${selection.transitKind}`
		&& Number(entry.transitDays) === Number(selection.transitDays)
		&& `${entry.start || ''}` === `${start || ''}`
		&& `${entry.ayanamsa || ''}` === `${ayanamsa || ''}`;
}

async function fetchIndiaTransitLinesHeadless(params, fields){
	const start = params.transitDate || localTodaySlash(params.zone);
	const selection = requestedTransitSelection(fields);
	const body = { ...indiaTransitEventParams(params), transitStart: start, ...selection };
	const pageEntry = indiaTransitSnapshotFor(indiaTransitBirthSig(body));
	if(pageTransitEntryMatches(pageEntry, selection, start, body.siderealAyanamsa)){
		return buildTransitEventLines(pageEntry);
	}
	try{
		const data = await request(`${Constants.ServerRoot}/astroextra/transitevents`, { body: JSON.stringify(body), silent: true, timeoutMs: 30000 });
		const result = data && data[Constants.ResultKey];
		if(!result || result.err || !Array.isArray(result.rows)){ return []; }
		return buildTransitEventLines({ start, ...selection, ayanamsa: body.siderealAyanamsa, result });
	}catch(e){
		return [];
	}
}

function hasTransitSection(text){
	const src = `${text || ''}`;
	return src.indexOf('\n[穿界时刻]') >= 0 || src.indexOf('[穿界时刻]') === 0;
}

async function appendTransitSectionWithParams(text, params, fields){
	const src = `${text || ''}`.trim();
	if(!src || hasTransitSection(src)){ return src; }
	const transitLines = await fetchIndiaTransitLinesHeadless(params, fields);
	if(!transitLines.length){ return src; }
	const tail = [];
	ensureSection(tail, '穿界时刻', transitLines);
	return `${src}\n\n${tail.join('\n')}`.replace(/\n{3,}/g, '\n\n').trim();
}

// 印占正文补「穿界时刻」段(AI 导出用):行运页签没打开过时页面快照里没有这段,按页面那张 → 本机保存的所选 → 缺省现取,
// 与挂载无头复算同一取法(此前导出缺这段、挂载却有,两边对不上)。已有该段 / 取不到 → 原样返回。
export async function appendIndiaTransitSection(text, fields, chartnum){
	if(!fields || hasTransitSection(text)){ return `${text || ''}`.trim(); }
	return appendTransitSectionWithParams(text, resolveIndiaHeadlessParams(fields, chartnum), fields);
}

// 供 AI 分析无头复算：按出生字段取印度盘（默认 D1 命盘）并生成快照文本。
// [Windows #80] 无头取盘参数解析单源:整盘快照与附加分盘简表共用一份,免两层各写各的。
export function resolveIndiaHeadlessParams(fields, chartnum){
	const params = fieldsToParams(fields, {});
	// 无头复算:挂载给了 indiaSchool 但未显式给岁差/宫制时,按该派预设补默认(与组件在场同口径)。
	const hlSchool = fields.indiaSchool && fields.indiaSchool.value
		? AstroConst.normalizeIndiaSchool(fields.indiaSchool.value) : null;
	if(hlSchool){
		const hlDef = AstroConst.getIndiaSchoolDefaults(hlSchool) || {};
		if(!(fields.indiaAyanamsa && fields.indiaAyanamsa.value) && hlDef.ayanamsa){
			params.siderealMode = hlDef.ayanamsa;
			params.indiaAyanamsa = hlDef.ayanamsa;
		}
		if(!(fields.indiaHsys && fields.indiaHsys.value !== undefined && fields.indiaHsys.value !== null) && hlDef.hsys !== undefined){
			params.indiaHsys = hlDef.hsys;
			params.hsys = hlDef.hsys;
		}
	}
	if(chartnum){
		params.chartnum = chartnum;
	}
	return params;
}

// [Windows #80] 附加分盘要挂哪几张:归一(值域/去重/上限 4)后再剔掉主盘自身 —— 主盘已有整段,
// 再出一份简表是纯浪费预算。纯函数,便于逐向量判据。
export function planIndiaExtraVargas(mainChartnum, extraVargas){
	const main = resolveIndiaFractal(mainChartnum, null);
	return AstroConst.normalizeIndiaExtraVargas(extraVargas).filter((n)=>n !== main);
}

// [Windows #80] 附加分盘简表:只挑该分盘自己的落宫面(宫位宫头 + 星与虚点 + 行星),
// 不重复大运/瑜伽/相位等段 —— 整张分盘快照约 2.6 万字,N 张全出会把挂载预算吃穿。
// 纯函数(吃已建好的整段快照文本),取数在 buildIndiaSnapshotForFields 里。
export function pickIndiaVargaBriefLines(astroText, chartnum){
	const fractal = resolveIndiaFractal(chartnum, null);
	if(fractal <= 1){
		return [];
	}
	const sections = splitSections(astroText || '');
	const body = [
		...(sections['宫位宫头'] || []),
		...(sections['星与虚点'] || []),
		...(sections['行星'] || []),
	].map((line)=>`${line || ''}`.trimEnd()).filter((line)=>line.trim());
	if(!body.length){
		return [];
	}
	return [`── ${AstroConst.indiaMountVargaLabel(fractal) || `D${fractal}`} ──`, ...body, ''];
}

async function fetchIndiaVargaBriefLines(fields, chartnum){
	const result = await requestIndiaChartData(resolveIndiaHeadlessParams(fields, chartnum));
	if(!result || !result.chart){
		return [];
	}
	return pickIndiaVargaBriefLines(buildAstroSnapshotContent(result, fields) || '', chartnum);
}

export async function buildIndiaSnapshotForFields(fields, chartnum, extraVargas){
	if(!fields){
		return '';
	}
	const params = resolveIndiaHeadlessParams(fields, chartnum);
	const result = await requestIndiaChartData(params);
	if(!result || !result.chart){
		return '';
	}
	const mainFractal = resolveIndiaFractal(params.chartnum || 1, null);
	let text = buildIndiaSnapshotText(result, fields, params.chartnum || 1, null);
	text = await appendTransitSectionWithParams(text, params, fields);
	// 附加分盘:缺省空 ⇒ 一个字节都不变(不发额外请求、不加段)。
	const extras = planIndiaExtraVargas(mainFractal, extraVargas);
	if(!extras.length){
		return text;
	}
	const extraLines = [];
	for(let i = 0; i < extras.length; i += 1){
		// 逐张串行取:每张是一次独立后端请求,并发打后端没必要(缺省不走这条路径)。
		// 先赋值再展开:把 await 直接写进展开实参是合法 JS,但本仓 webpack 的 babel 异步转换吃不下
		// (报 Expected "Expression" got "SpreadElement";jest 走另一套转换照绿 → 单测零判别力)。
		// eslint-disable-next-line no-await-in-loop
		const brief = await fetchIndiaVargaBriefLines(fields, extras[i]);
		extraLines.push(...brief);
	}
	if(!extraLines.length){
		return text;
	}
	const lines = [];
	ensureSection(lines, '附加分盘', [
		'以下为主盘之外另挂的分盘,只列该分盘的宫头与星曜落宫(大运/瑜伽/相位等仍以主盘段为准)。',
		'',
		...extraLines,
	]);
	return `${text}\n\n${lines.join('\n')}`.replace(/\n{3,}/g, '\n\n').trim();
}
