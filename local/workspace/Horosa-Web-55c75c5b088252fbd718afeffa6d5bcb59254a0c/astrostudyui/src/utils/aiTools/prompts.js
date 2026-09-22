// AI 助手·MCP 提示面(P5):把「技法提示卡」与用户自建模版以 prompts/* 暴露给外部智能体。
// 提示卡只给**怎么问**的指引(要哪些参数、该调哪个工具、结论口径),**不起盘、不产结论**——真值一律走 cast_technique 或资源面。
import { ANALYSIS_TECHNIQUE_LABELS, ANALYSIS_CHART_TECHNIQUES, ANALYSIS_CASE_TECHNIQUES } from '../aiAnalysisContext';
import { AI_ANALYSIS_STORES, listStoreRecords, getStoreRecord } from '../aiAnalysisStore';

export const PROMPT_TECHNIQUE_PREFIX = 'technique:';
export const PROMPT_TEMPLATE_PREFIX = 'tpl:';
export const PROMPT_LIST_MAX = 100;

function techniqueKeys(){
	return Array.from(new Set(ANALYSIS_CHART_TECHNIQUES.concat(ANALYSIS_CASE_TECHNIQUES)));
}
export function labelOfTechnique(key){ return (ANALYSIS_TECHNIQUE_LABELS && ANALYSIS_TECHNIQUE_LABELS[key]) || `${key}`; }

export async function listPrompts(opts){
	const limit = Math.max(1, Math.min(PROMPT_LIST_MAX, Number(opts && opts.limit) || PROMPT_LIST_MAX));
	const out = techniqueKeys().map((k)=>({
		name: `${PROMPT_TECHNIQUE_PREFIX}${k}`,
		description: `${labelOfTechnique(k)}:怎么向星阙要这门技法的分析(要哪些参数、调哪个工具、结论口径)`,
		arguments: [
			{ name: 'cid', description: '命盘/事盘 cid(可选;给了就直接对该盘发问)', required: false },
			{ name: 'question', description: '你要问的问题(可选)', required: false },
		],
	}));
	try{
		(await listStoreRecords(AI_ANALYSIS_STORES.templates)).forEach((t)=>{
			if(!t || !t.id){ return; }
			out.push({ name: `${PROMPT_TEMPLATE_PREFIX}${t.id}`, description: `用户模版·${t.name || t.id}(${t.format === 'json' ? 'JSON 结构化' : '文本'}输出约束)`, arguments: [{ name: 'question', description: '要分析的问题', required: false }] });
		});
	}catch(e){ /* 模版读失败不影响技法提示卡 */ }
	return out.slice(0, limit);
}

function techniqueMessage(key, args){
	const label = labelOfTechnique(key);
	const cid = `${(args && args.cid) || ''}`.trim();
	const question = `${(args && args.question) || ''}`.trim();
	const lines = [
		`【${label}(${key})提示卡】`,
		// [Q-334] 示例必须与 cast_technique 的 inputSchema 同形:入参是 source:{kind,cid},没有 sourceCid 这个键
		//(schema additionalProperties:false → 照旧文案调用必被守卫拒掉)
		`1. 取真值:调工具 cast_technique({ technique: "${key}", source: { kind: "record", cid: "${cid || '<命盘或事盘 cid>'}" } }) 拿这门技法的排盘快照;` + `或读资源 horosa://chart/<cid>(整盘快照)。`,
		'2. 没有 cid 时先调 list_records 找;人还没建档就问用户出生时间与地点,再调 create_chart_record(只增、可撤销)。',
		'3. 只依据快照里的干支/宫位/星曜作答,快照没有的不要编;各技法时间基准可不同,以快照 [起盘信息] 的自声明为准。',
		'4. 结论先给判断再给依据,不要绝对化、不要宿命化;涉及健康/法律/财务给出「请咨询专业人士」的提醒。',
	];
	if(question){ lines.push('', `【本次问题】${question}`); }
	return lines.join('\n');
}

// 未知 name / 模版不存在 → null(调用方回 -32602)
export async function getPrompt(name, args){
	const n = `${name == null ? '' : name}`.trim();
	if(n.indexOf(PROMPT_TECHNIQUE_PREFIX) === 0){
		const key = n.slice(PROMPT_TECHNIQUE_PREFIX.length);
		if(techniqueKeys().indexOf(key) < 0){ return null; }
		return { description: `${labelOfTechnique(key)} 提示卡`, messages: [{ role: 'user', content: { type: 'text', text: techniqueMessage(key, args) } }] };
	}
	if(n.indexOf(PROMPT_TEMPLATE_PREFIX) === 0){
		const id = n.slice(PROMPT_TEMPLATE_PREFIX.length);
		let rec = null;
		try{ rec = await getStoreRecord(AI_ANALYSIS_STORES.templates, id); }catch(e){ rec = null; }
		if(!rec){ return null; }
		// [Q-333] JSON 模版此前只取 Schema、把说明文字整段丢掉(外部客户端拿到的约束比对话页少一半)。
		// 与对话页 aiAnalysisContext 组模版层同式:说明 + 空行 + 「JSON Schema:」+ Schema。
		const body = (rec.format === 'json'
			? [rec.instructionText, rec.jsonSchema && `JSON Schema：\n${rec.jsonSchema}`].filter(Boolean).join('\n\n')
			: (rec.instructionText || rec.content)) || '';
		const question = `${(args && args.question) || ''}`.trim();
		const text = [`【用户模版·${rec.name || id}】按下面的约束输出:`, body.trim(), question ? `\n【本次问题】${question}` : ''].filter(Boolean).join('\n');
		return { description: `用户模版 ${rec.name || id}`, messages: [{ role: 'user', content: { type: 'text', text } }] };
	}
	return null;
}
