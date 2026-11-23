// AI 助手·MCP 参数补全(completion/complete):资源模版与提示卡的参数,按用户正在输入的片段给候选值。
// 只读、零动作;候选值必须是可以原样填回去的真值(cid / 资料 id),按「名称前缀 > 名称包含 > id 包含」排序,单次 ≤ 100 条。
import { listLocalCharts } from '../localcharts';
import { listLocalCases } from '../localcases';
import { AI_ANALYSIS_STORES, listStoreRecords } from '../aiAnalysisStore';
import { ANALYSIS_CASE_TECHNIQUES, ANALYSIS_CHART_TECHNIQUES } from '../aiAnalysisContext';
import { RESOURCE_SCHEME } from './resources';
import { PROMPT_TECHNIQUE_PREFIX, PROMPT_TECHNIQUE_NAME, PROMPT_TEMPLATE_PREFIX, PROMPT_SKILL_PREFIX, PROMPT_GUIDE_NAME, promptTechniqueKeys, labelOfTechnique } from './prompts';
import { ensureNeutralMatcher, indexNeutral } from '../scriptNeutralMatch';

export const COMPLETION_MAX = 100;

function norm(v){ return `${v == null ? '' : v}`.trim().toLowerCase(); }

// rows: [{ id, label }];value 为空 = 按原序(最近在前)全给
export function rankCandidates(rows, value){
	const q = norm(value);
	const scored = [];
	rows.forEach((r, i)=>{
		if(!r || !r.id){ return; }
		const label = norm(r.label);
		const id = norm(r.id);
		let score = -1;
		if(!q){ score = 0; }
		else{
			// 繁简都认(与 list_records 同一 anyScript 口径;不随界面档位变):外部 AI 用繁体片段也补得出简体档名
			const at = indexNeutral(label, q);
			if(at === 0){ score = 3; }
			else if(at > 0){ score = 2; }
			else if(indexNeutral(id, q) >= 0){ score = 1; }
		}
		if(score >= 0){ scored.push({ id: `${r.id}`, score, i }); }
	});
	scored.sort((a, b)=>(b.score - a.score) || (a.i - b.i));
	const total = scored.length;
	const values = scored.slice(0, COMPLETION_MAX).map((x)=>x.id);
	return { values, total, hasMore: total > values.length };
}

function chartRows(){
	try{ return listLocalCharts({}).map((r)=>({ id: r.cid, label: r.name })); }catch(e){ return []; }
}
function caseRows(){
	try{ return listLocalCases({}).map((r)=>({ id: r.cid, label: r.event })); }catch(e){ return []; }
}
async function materialRows(){
	try{ return (await listStoreRecords(AI_ANALYSIS_STORES.materials)).map((m)=>({ id: m && m.id, label: m && m.name })); }catch(e){ return []; }
}
// 后台任务(新的在前)与技法操作手册(页签键;标签 = 手册标题)
async function taskRows(){
	try{ const { listTasks } = await import('../aiAgent/tasks/taskStore'); return (await listTasks({ limit: 200 })).map((t)=>({ id: t && t.id, label: t && t.title })); }catch(e){ return []; }
}
async function helpRows(){
	try{ const help = await import('./helpText'); return help.listHelpTabs().map((tab)=>({ id: tab, label: help.helpTitleOf(tab) })); }catch(e){ return []; }
}

// 命盘技法给命盘、事盘技法给事盘;两边都有的技法(或未登记 / 没填)两类都给
function cidRowsForTechnique(key){
	const chartish = ANALYSIS_CHART_TECHNIQUES.indexOf(key) >= 0;
	const caseish = ANALYSIS_CASE_TECHNIQUES.indexOf(key) >= 0;
	return (chartish && !caseish) ? chartRows() : ((caseish && !chartish) ? caseRows() : chartRows().concat(caseRows()));
}

// ref:{ type:'ref/resource', uri } | { type:'ref/prompt', name };argument:{ name, value };context = MCP 请求的 context({ arguments:已填的其它参数 })
// 回 { values, total, hasMore };认不出的引用 → null(桥回 -32602);认得出但该参数无可补(自由文本)→ 空表
export async function completeArgument(ref, argument, context){
	const contextArgs = context && context.arguments && typeof context.arguments === 'object' ? context.arguments : {};
	await ensureNeutralMatcher();   // 繁简比对的转换器先载入(没载入 = 按原文比)
	const type = ref && ref.type;
	const argName = `${(argument && argument.name) || ''}`;
	const value = argument && argument.value;
	if(type === 'ref/resource'){
		const uri = `${(ref && ref.uri) || ''}`;
		if(uri.indexOf(RESOURCE_SCHEME) !== 0){ return null; }
		const kind = uri.slice(RESOURCE_SCHEME.length).split('/')[0];
		if(kind === 'chart' && argName === 'cid'){ return rankCandidates(chartRows(), value); }
		if(kind === 'case' && argName === 'cid'){ return rankCandidates(caseRows(), value); }
		if(kind === 'material' && argName === 'id'){ return rankCandidates(await materialRows(), value); }
		if(kind === 'task' && argName === 'id'){ return rankCandidates(await taskRows(), value); }
		if(kind === 'help' && argName === 'tab'){ return rankCandidates(await helpRows(), value); }
		return ['chart', 'case', 'material', 'task', 'help'].indexOf(kind) >= 0 ? { values: [], total: 0, hasMore: false } : null;
	}
	if(type === 'ref/prompt'){
		const name = `${(ref && ref.name) || ''}`;
		// 合成的技法提示卡:technique 补技法键(按中文名 / 键匹配);cid 按已填的技法(context.arguments.technique)分命盘 / 事盘,没填两类都给
		if(name === PROMPT_TECHNIQUE_NAME){
			if(argName === 'technique'){ return rankCandidates(promptTechniqueKeys().map((k)=>({ id: k, label: labelOfTechnique(k) })), value); }
			if(argName !== 'cid'){ return { values: [], total: 0, hasMore: false }; }
			return rankCandidates(cidRowsForTechnique(`${contextArgs.technique || ''}`), value);
		}
		if(name.indexOf(PROMPT_TECHNIQUE_PREFIX) === 0){
			const key = name.slice(PROMPT_TECHNIQUE_PREFIX.length);
			if(argName !== 'cid'){ return { values: [], total: 0, hasMore: false }; }
			return rankCandidates(cidRowsForTechnique(key), value);
		}
		if(name.indexOf(PROMPT_TEMPLATE_PREFIX) === 0){ return { values: [], total: 0, hasMore: false }; }
		// 技能包提示:cid / otherCid 补命盘(技能都以命盘为主角);其余参数是自由文本
		if(name.indexOf(PROMPT_SKILL_PREFIX) === 0){
			if(argName === 'cid' || argName === 'otherCid'){ return rankCandidates(chartRows(), value); }
			return { values: [], total: 0, hasMore: false };
		}
		if(name === PROMPT_GUIDE_NAME){ return { values: [], total: 0, hasMore: false }; }
		return null;
	}
	return null;
}
