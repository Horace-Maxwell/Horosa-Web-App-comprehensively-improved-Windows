// AI 助手·模型清单与续聊
// · list_models:用户已配置的接口档案 × 模型(不含密钥),selection 可传给 run_analysis / chat_in_conversation 的 model。
// · chat_in_conversation:往用户的一段已有对话里续问一句,星阙内置 AI 作答,一问一答落进这段对话(消息带外部来源标记;
//   只新增,绝不改已有消息)。能写就等于能读回 → 受「私人内容可读」门控;与 run_analysis 同受「无头分析」开关、同一只读工具视图。
import { AI_ANALYSIS_STORES, listStoreRecords, getStoreRecord, saveConversationMessage, listConversationMessages } from '../../aiAnalysisStore';
import { isHeadlessEnabled, isPrivateReadEnabled } from '../../aiAgent/prefs';
import { readOnlyRegistryView } from './runAnalysis';
import { GUIDE } from './_shared';
import { switchHintText } from '../switchHints';

const CHAT_QUESTION_MAX = 2000;

// 已配置的档案 × 模型(启用的档案;对话模型 + 手填模型),当前选择打标
export async function configuredModels(){
	const profiles = ((await listStoreRecords(AI_ANALYSIS_STORES.providerProfiles)) || []).filter((p)=>p && p.enabled !== false);
	const { loadUiPrefs } = await import('../../aiAnalysisStore');
	const cur = `${((loadUiPrefs && loadUiPrefs()) || {}).modelSelection || ''}`;
	const out = [];
	profiles.forEach((p)=>{
		const models = Array.from(new Set([...(p.chatModelIds || []), ...(p.manualModels || [])].filter(Boolean)));
		models.forEach((m)=>{ const selection = `${p.id}::${m}`; out.push({ selection, profileName: p.name || p.id, providerType: p.providerType || '', model: m, current: selection === cur }); });
	});
	return out;
}
// 校验调用方给的 model(只能在已配置清单里选);回 { ok, selection? }
export async function checkModelSelection(model){
	if(!model){ return { ok: true }; }
	const list = await configuredModels();
	const hit = list.find((x)=>x.selection === `${model}` || x.model === `${model}`);
	return hit ? { ok: true, selection: hit.selection } : { ok: false, code: 'E_ARGS_INVALID', message: `没有这个模型(只能在已配置的里选,用 list_models 查):${`${model}`.slice(0, 80)}` };
}

export const listModelsTool = {
	name: 'list_models',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	outputSchema: { type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'object' } } } },
	description: `列出用户已配置的 AI 接口档案与模型(不含密钥),selection 可传给 run_analysis / chat_in_conversation 的 model;current 标出界面当前选的那个。${GUIDE}:要指定用哪个模型作答前调用。`,
	inputSchema: { type: 'object', additionalProperties: false, properties: {} },
	async run(){
		const items = await configuredModels();
		return { ok: true, data: { items }, summary: `模型 ${items.length} 个` };
	},
};

export const chatInConversationTool = {
	name: 'chat_in_conversation',
	level: 'additive',
	category: 'records',
	undoKind: 'none',
	origins: ['mcp'],
	enabled: ()=>isHeadlessEnabled() && isPrivateReadEnabled(),
	disabledHint: ()=>switchHintText(['headless', 'privateRead']),
	timeoutMs: 180000,
	outputSchema: { type: 'object', required: ['content', 'conversationId'], properties: { content: { type: 'string' }, conversationId: { type: 'string' }, model: { type: 'string' }, usage: { type: ['object', 'null'] } } },
	description: `在用户的一段已有对话里续问一句(conversationId 用 list_conversations 查),由星阙内置 AI 接着这段对话作答;这一问一答会落进该对话,标明来自外部 AI,不改已有消息。可用 model 指定模型(list_models 查)。只能用只读工具。${GUIDE}:用户说「在那段对话里接着问」时调用。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['conversationId', 'question'], properties: {
		conversationId: { type: 'string', minLength: 1, maxLength: 80 },
		question: { type: 'string', minLength: 1, maxLength: CHAT_QUESTION_MAX },
		model: { type: 'string', maxLength: 160, description: 'list_models 的 selection(缺省 = 界面当前选的)' },
	} },
	preview(args){ return { title: '在对话里续问', before: '', after: `${`${args.question || ''}`.slice(0, 200)}\n(一问一答会落进这段对话,标明来自外部 AI)` }; },
	async run(args, ctx){
		const conv = await getStoreRecord(AI_ANALYSIS_STORES.conversations, args.conversationId);
		if(!conv){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `没有这段对话:${`${args.conversationId}`.slice(0, 80)}` }; }
		const m = await checkModelSelection(args.model);
		if(!m.ok){ return m; }
		const [gr, reg] = await Promise.all([import('../../aiAgent/goalRunner'), import('../registry')]);
		const resolved = await gr.resolveHeadlessProfile(m.selection ? { modelSelection: m.selection } : {});
		if(!resolved){ return { ok: false, code: 'E_HEADLESS_UNAVAILABLE', message: '没有可用的接口配置 / 模型' }; }
		// 只新增:本轮建的消息才放行写入(已有消息 id 一律拒),新消息带来源标记
		const before = new Set(((await listConversationMessages(conv.id)) || []).map((x)=>x && x.id).filter(Boolean));
		const mine = new Set();
		const client = `${(ctx && ctx.clientName) || 'external'}`.slice(0, 60);
		const saveMsg = async (rec)=>{
			if(rec && rec.id && before.has(rec.id) && !mine.has(rec.id)){ throw new Error('chat_in_conversation 不改已有消息'); }
			const saved = await saveConversationMessage({ ...rec, conversationId: conv.id, origin: 'mcp', client, createdBy: 'ai-assistant' });
			if(saved && saved.id){ mine.add(saved.id); }
			return saved;
		};
		const r = await gr.runHeadlessTurn({
			profile: resolved.profile, model: resolved.model, conversationId: conv.id, userText: `${args.question}`.trim(), source: null, techniqueKeys: [],
			systemPrompt: '', origin: 'mcp', signal: ctx && ctx.signal, registry: readOnlyRegistryView(reg),
			deps: { saveConversationMessage: saveMsg, listConversationMessages },
		});
		if(r.error){ return { ok: false, code: 'E_STREAM_ERROR', message: `${r.error}`.slice(0, 200) }; }
		if(r.aborted){ return { ok: false, code: 'E_ABORTED', message: '本次续问已被停止' }; }
		return { ok: true, data: { content: `${r.content || ''}`, conversationId: conv.id, model: resolved.model, providerType: resolved.profile.providerType, usage: r.usage || null, messageIds: Array.from(mine) },
			summary: `续问「${conv.title || conv.id}」`, message: `已在对话「${conv.title || conv.id}」里续问,一问一答已落库(标明来自外部 AI)` };
	},
};
