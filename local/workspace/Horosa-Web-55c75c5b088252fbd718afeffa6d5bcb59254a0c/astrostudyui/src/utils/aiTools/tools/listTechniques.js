// AI 助手·技法清单:cast_technique 的 technique 只有键,外部模型不知道每个键是什么、适用哪种来源、能不能现算。
// 本工具把这张表如实给出(只读、零计算):键 / 中文名 / 命盘类还是事盘类 / 适用来源 / 现算或读已存的 / 有几项可调设置。
// 全部由登记表推出(技法登记表、起课时间可起集、挂载设置 schema、只能读页面快照的那一组键),不另手抄。
import { ANALYSIS_CHART_TECHNIQUES, ANALYSIS_CASE_TECHNIQUES, PAGE_SNAPSHOT_ONLY_TECHNIQUES, listAnalysisTechniqueOptions } from '../../aiAnalysisContext';
import { getTechniqueSettingsSchema } from '../../techniqueMountSettings';
import { ensureNeutralMatcher, containsNeutral } from '../../scriptNeutralMatch';
import { GUIDE } from './_shared';

export const TECHNIQUE_SOURCE_KINDS = ['record', 'natal', 'timepoint'];
// 只读已存结果的技法:临时出生资料起不出来,各自该用哪件工具现做
const NOTE_PAGE_ONLY = {
	relative: '只读已存命盘上做过的合盘;两张盘现算合盘请用 cast_relative',
};
const NOTE_PAGE_ONLY_DEFAULT = '内容来自技法页里的操作,只能读用户在页面上做完的那一份';
// cast_technique 报错与清单同一句(只读技法该改用哪件工具)
export function pageOnlyTechniqueNote(key){
	return (Array.isArray(PAGE_SNAPSHOT_ONLY_TECHNIQUES) && PAGE_SNAPSHOT_ONLY_TECHNIQUES.indexOf(key) >= 0) ? (NOTE_PAGE_ONLY[key] || NOTE_PAGE_ONLY_DEFAULT) : '';
}
const NOTE_STORED_CASE = '只能读已存事盘里的起卦结果;要按用户报出的结果新建事盘见 list_divination_casts / cast_divination_case';

function settingCount(key){
	try{
		const sch = getTechniqueSettingsSchema(key);
		return sch && sch.kind !== 'sectionsOnly' && Array.isArray(sch.fields) ? sch.fields.length : 0;
	}catch(e){ return 0; }
}

// 一行:{ key, label, group, sources, compute, settings, note? }
//   sources = 这个技法能用 cast_technique 的哪几种 source.kind 起;compute = 'compute'(按来源现算)| 'stored'(只读已存结果);
//   命盘类:record(已存命盘)与 natal(临时出生资料)都行(只读已存结果的那几个只有 record);事盘类:record(已存事盘)恒行,timepoint 只有时间确定的那些。
export function buildTechniqueRows(){
	const labelOf = {};
	const timepoint = new Set();
	listAnalysisTechniqueOptions({ sourceType: 'chart' }).forEach((o)=>{ labelOf[o.value] = o.label; });
	listAnalysisTechniqueOptions({ sourceType: 'case' }).forEach((o)=>{ labelOf[o.value] = o.label; });
	listAnalysisTechniqueOptions({ sourceType: 'timepoint' }).forEach((o)=>{ labelOf[o.value] = o.label; timepoint.add(o.value); });
	const rows = [];
	const seen = new Set();
	ANALYSIS_CHART_TECHNIQUES.forEach((key)=>{
		if(seen.has(key)){ return; }
		seen.add(key);
		const pageOnly = PAGE_SNAPSHOT_ONLY_TECHNIQUES.indexOf(key) >= 0;
		rows.push({
			key, label: labelOf[key] || key, group: 'chart',
			// 只读已存结果的:临时出生资料(natal)没有可读的那一份,只标已存档案
			sources: pageOnly ? ['record'] : ['record', 'natal'].concat(timepoint.has(key) ? ['timepoint'] : []),
			compute: pageOnly ? 'stored' : 'compute', settings: settingCount(key),
			...(pageOnly ? { note: pageOnlyTechniqueNote(key) } : {}),
		});
	});
	ANALYSIS_CASE_TECHNIQUES.forEach((key)=>{
		if(seen.has(key)){ return; }
		seen.add(key);
		const byTime = timepoint.has(key);
		rows.push({
			key, label: labelOf[key] || key, group: 'case',
			sources: ['record'].concat(byTime ? ['timepoint'] : []),
			compute: byTime ? 'compute' : 'stored', settings: settingCount(key),
			...(byTime ? {} : { note: NOTE_STORED_CASE }),
		});
	});
	// 只在「起课时间可起」集里的键(不在两张登记表里)
	timepoint.forEach((key)=>{
		if(seen.has(key)){ return; }
		seen.add(key);
		rows.push({ key, label: labelOf[key] || key, group: 'case', sources: ['timepoint'], compute: 'compute', settings: settingCount(key) });
	});
	return rows;
}

export default {
	name: 'list_techniques',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	cacheable: true,
	outputSchema: {
		type: 'object', required: ['items', 'total'],
		properties: {
			total: { type: 'integer' },
			items: { type: 'array', items: { type: 'object', required: ['key', 'label', 'group', 'sources', 'compute'], properties: {
				key: { type: 'string' }, label: { type: 'string' }, group: { type: 'string', enum: ['chart', 'case'] },
				sources: { type: 'array', items: { type: 'string', enum: TECHNIQUE_SOURCE_KINDS } },
				compute: { type: 'string', enum: ['compute', 'stored'] }, settings: { type: 'integer' }, note: { type: 'string' },
			} } },
		},
	},
	description: `List every technique key cast_technique accepts, with its Chinese name, which source kinds it works with, and whether it is computed on demand or only read from a saved result. 技法清单:cast_technique 的 technique 可用的全部键 —— 中文名、命盘类(chart)还是事盘类(case)、能用哪种来源起(record=已存档案 / natal=临时出生资料 / timepoint=临时起课时间)、是现算(compute)或读已存结果(stored)、有几项可调设置(具体项用 describe_settings facet=mount 看)。不确定该用哪个键、或某个技法能不能按时间起时先调它;可用 source 只看某种来源能起的、用 query 按键或中文名筛。${GUIDE}:要起盘却不知道技法键时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false,
		properties: {
			source: { type: 'string', enum: TECHNIQUE_SOURCE_KINDS, description: '只列这种来源能起的技法' },
			group: { type: 'string', enum: ['chart', 'case'], description: 'chart=命盘类(按出生资料)/ case=事盘类(占卜、择日)' },
			query: { type: 'string', maxLength: 40, description: '按技法键或中文名包含匹配(如 六壬 / return)' },
		},
	},
	async run(args){
		const q = `${args.query || ''}`.trim();
		if(q){ await ensureNeutralMatcher(); }   // 检索词繁简都认(与其它检索工具同一单源)
		const items = buildTechniqueRows()
			.filter((r)=>!args.source || r.sources.indexOf(args.source) >= 0)
			.filter((r)=>!args.group || r.group === args.group)
			.filter((r)=>!q || containsNeutral(`${r.key} ${r.label}`, q));
		return { ok: true, data: { items, total: items.length }, summary: `技法 ${items.length} 个` };
	},
};
