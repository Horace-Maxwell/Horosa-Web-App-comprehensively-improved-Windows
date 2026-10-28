// AI 助手·MCP 提示面(P5):把「技法提示卡」与用户自建模版以 prompts/* 暴露给外部智能体。
// 提示卡只给**怎么问**的指引(要哪些参数、该调哪个工具、结论口径),**不起盘、不产结论**——真值一律走 cast_technique 或资源面。
import { ANALYSIS_TECHNIQUE_LABELS, ANALYSIS_CHART_TECHNIQUES, ANALYSIS_CASE_TECHNIQUES } from '../aiAnalysisContext';
import { AI_ANALYSIS_STORES, listStoreRecords, getStoreRecord } from '../aiAnalysisStore';
import { findAnalysisSourceById } from '../aiAnalysisSources';
import { BUILTIN_SKILLS, skillsOf, renderSkillPrompt, buildSkillDirective, normalizeSkillPack } from '../aiChat/skills';
import { pageOf } from './resources';

export const PROMPT_TECHNIQUE_PREFIX = 'technique:';
export const PROMPT_TEMPLATE_PREFIX = 'tpl:';
// 技能包(内置 /流年 /合盘 /简报 + 用户自建)作提示 skill:<id>;使用指南 guide:horosa(典型流程与该调的工具)
export const PROMPT_SKILL_PREFIX = 'skill:';
export const PROMPT_GUIDE_NAME = 'guide:horosa';
export const PROMPT_LIST_MAX = 100;

function techniqueKeys(){
	return Array.from(new Set(ANALYSIS_CHART_TECHNIQUES.concat(ANALYSIS_CASE_TECHNIQUES)));
}
export function labelOfTechnique(key){ return (ANALYSIS_TECHNIQUE_LABELS && ANALYSIS_TECHNIQUE_LABELS[key]) || `${key}`; }

export const PROMPT_PAGE_SIZE = 100;

// 技能包全集:内置在前,用户自建(组合库里带 skill 字段的)在后;读库失败只剩内置
async function allSkills(){
	let user = [];
	try{ user = skillsOf(await listStoreRecords(AI_ANALYSIS_STORES.bundles)); }catch(e){ user = []; }
	return BUILTIN_SKILLS.map((b)=>({ ...b, skill: normalizeSkillPack(b) })).concat(user);
}
function skillArguments(skill){
	const args = [{ name: 'cid', description: '主角命盘 cid(可选;不给就按问题里写的人或先 list_records 找)', required: false }];
	if(skill.requires === 'two-charts'){ args.push({ name: 'otherCid', description: '对方命盘 cid', required: false }); }
	(skill.argsSpec || []).forEach((a)=>{ args.push({ name: a.name, description: `${a.label || a.name}${a.default ? `(缺省 ${a.default})` : ''}`, required: false }); });
	return args;
}

async function allPrompts(){
	const guide = { name: PROMPT_GUIDE_NAME, description: '星阙使用指南:典型流程(找档 → 起盘 → 分析、合盘、择日、看当前页、读手册)各该调哪个工具 / 读哪个资源', arguments: [] };
	const out = [guide].concat(techniqueKeys().map((k)=>({
		name: `${PROMPT_TECHNIQUE_PREFIX}${k}`,
		description: `${labelOfTechnique(k)}:怎么向星阙要这门技法的分析(要哪些参数、调哪个工具、结论口径)`,
		arguments: [
			{ name: 'cid', description: '命盘/事盘 cid(可选;给了就直接对该盘发问)', required: false },
			{ name: 'question', description: '你要问的问题(可选)', required: false },
		],
	})));
	try{
		(await listStoreRecords(AI_ANALYSIS_STORES.templates)).forEach((t)=>{
			if(!t || !t.id){ return; }
			out.push({ name: `${PROMPT_TEMPLATE_PREFIX}${t.id}`, description: `用户模版·${t.name || t.id}(${t.format === 'json' ? 'JSON 结构化' : '文本'}输出约束)`, arguments: [{ name: 'question', description: '要分析的问题', required: false }] });
		});
	}catch(e){ /* 模版读失败不影响技法提示卡 */ }
	(await allSkills()).forEach((b)=>{
		const sk = b.skill || {};
		out.push({ name: `${PROMPT_SKILL_PREFIX}${b.id}`, description: `技能包·${b.name || b.id}${sk.description ? `:${sk.description}` : ''}`, arguments: skillArguments(sk) });
	});
	return out;
}

export async function listPrompts(opts){
	const limit = Math.max(1, Math.min(PROMPT_LIST_MAX, Number(opts && opts.limit) || PROMPT_LIST_MAX));
	return (await allPrompts()).slice(0, limit);
}

// 分页版(MCP prompts/list 用):技法提示卡 + 用户模版超过 100 条时,此前排在后面的永远列不出来
export async function listPromptsPage(opts){
	return pageOf(await allPrompts(), opts && opts.cursor, PROMPT_PAGE_SIZE);
}

function techniqueMessage(key, args){
	const label = labelOfTechnique(key);
	const cid = `${(args && args.cid) || ''}`.trim();
	const question = `${(args && args.question) || ''}`.trim();
	const lines = [
		`【${label}(${key})提示卡】`,
		// 示例必须与 cast_technique 的 inputSchema 同形:入参是 source:{kind,cid},没有 sourceCid 这个键
		//(schema additionalProperties:false → 照旧文案调用必被守卫拒掉)
		`1. 取真值:调工具 cast_technique({ technique: "${key}", source: { kind: "record", cid: "${cid || '<命盘或事盘 cid>'}" } }) 拿这门技法的排盘快照;` + `或读资源 horosa://chart/<cid>(整盘快照)。`,
		'2. 没有 cid 时先调 list_records 找;人还没建档就问用户出生时间与地点,再调 create_chart_record(只增、可撤销)。',
		'3. 只依据快照里的干支/宫位/星曜作答,快照没有的不要编;各技法时间基准可不同,以快照 [起盘信息] 的自声明为准。',
		'4. 结论先给判断再给依据,不要绝对化、不要宿命化;涉及健康/法律/财务给出「请咨询专业人士」的提醒。',
	];
	if(question){ lines.push('', `【本次问题】${question}`); }
	return lines.join('\n');
}

const GUIDE_TEXT = [
	'【星阙(Horosa)使用指南】',
	'一、先取真值再下结论',
	'· 找人:list_records(按姓名 / 事件);没有档案就问用户出生时间与地点,再 create_chart_record(只增、可撤销)。',
	'· 起盘:cast_technique({ technique, source:{ kind:"record", cid } });各技法怎么问见提示卡 technique:<技法键>;内容长时用 sections 按段取。',
	'· 合盘:cast_relative({ a, b, modes:["western","bazi","ziwei"] })(西洋比较盘 / 组合盘 / 影响盘、八字合婚对照、紫微合盘对照)。',
	'· 择日:list_election_conditions 查条件类 → search_election(时间段 + 地点 + 条件树)→ explain_election(某一刻逐条判读)。',
	'· 看用户眼前这一页:read_current_page(与页面「AI导出」同一份正文;只在桌面 App 里有)。',
	'· 史料:search_xuanshi → get_xuanshi_item(引用写明出处)。',
	'二、让星阙自己的 AI 来分析:run_analysis(桌面 App:用户在「外部连接」里开「无头分析出口」;无头模式:用户跑 ./horosa config headless-analysis on 并配好模型接口;可带合盘对方与技能包)。',
	'三、长任务(桌面 App 里才有建任务的工具):create_goal_task / schedule_task 建任务,建好后要用户在任务中心点开始;list_tasks / get_task(或资源 horosa://task/<id>)看进度与结果。',
	'四、先学会功能:资源 horosa://help/<页签键> 是各技法页的操作手册(每个输入 / 设置项怎么影响排盘);resources/templates/list 列全部资源模版。',
	'五、写入规矩:只在用户明确要求时写;一切写入只增不删、记入动作记录、用户可撤销(桌面 App 动作记录里一键撤销;无头模式 ./horosa undo <动作id>)。',
	'六、口径:各技法的时间基准可以不同,以快照 [起盘信息] 的自声明为准;结论先给判断再给依据,不绝对化、不宿命化;健康 / 法律 / 财务提醒咨询专业人士。',
	'七、工具清单以 tools/list 为准:上面提到而清单里没有的工具,就是当前环境(桌面 App / 无头模式)或用户的开关不提供,不要硬调。',
].join('\n');

async function skillMessage(b, args){
	const sk = b.skill || {};
	const a = args && typeof args === 'object' ? args : {};
	const src = a.cid ? findAnalysisSourceById(`${a.cid}`) : null;
	const other = a.otherCid ? findAnalysisSourceById(`${a.otherCid}`) : null;
	const vars = {};
	(sk.argsSpec || []).forEach((x)=>{ vars[x.name] = a[x.name] !== undefined && a[x.name] !== null && `${a[x.name]}` !== '' ? `${a[x.name]}` : (x.default || ''); });
	const rendered = renderSkillPrompt(sk, vars, { activeSource: src ? { title: src.title } : null, otherSource: other ? { title: other.title } : null });
	const keys = Array.isArray(sk.techniqueKeys) ? sk.techniqueKeys : [];
	const lines = [`【技能包·${b.name || b.id}】${sk.description || ''}`.trim()];
	if(sk.requires === 'two-charts'){
		lines.push(`1. 取真值:两张命盘${src ? `(本人「${src.title}」cid ${src.id}` : '(本人'}${other ? `,对方「${other.title}」cid ${other.id})` : ',对方)'}先调 cast_relative 取合盘数据${keys.length ? `,再对两人分别 cast_technique 取:${keys.map(labelOfTechnique).join('、')}` : ''}。`);
	}else if(keys.length){
		lines.push(`1. 取真值:对${src ? `「${src.title}」(cid ${src.id})` : '这张命盘(cid 未给就先 list_records 找)'}依次调 cast_technique 取:${keys.map(labelOfTechnique).join('、')}。`);
	}else{
		lines.push('1. 取真值:按问题需要调 cast_technique 取对应技法的快照,快照没有的不要编。');
	}
	const directive = buildSkillDirective(sk);
	if(directive){ lines.push(`2. ${directive.replace(/\n/g, ';')}`); }
	lines.push('3. 只依据快照作答;结论先给判断再给依据,不要绝对化。');
	if(rendered){ lines.push('', `【本次问题】${rendered}`); }
	return lines.join('\n');
}

// 未知 name / 模版不存在 → null(调用方回 -32602)
export async function getPrompt(name, args){
	const n = `${name == null ? '' : name}`.trim();
	if(n === PROMPT_GUIDE_NAME){
		return { description: '星阙使用指南', messages: [{ role: 'user', content: { type: 'text', text: GUIDE_TEXT } }] };
	}
	if(n.indexOf(PROMPT_SKILL_PREFIX) === 0){
		const id = n.slice(PROMPT_SKILL_PREFIX.length);
		const b = (await allSkills()).find((x)=>x && `${x.id}` === id);
		if(!b){ return null; }
		return { description: `技能包 ${b.name || b.id}`, messages: [{ role: 'user', content: { type: 'text', text: await skillMessage(b, args) } }] };
	}
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
		// JSON 模版此前只取 Schema、把说明文字整段丢掉(外部客户端拿到的约束比对话页少一半)。
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
