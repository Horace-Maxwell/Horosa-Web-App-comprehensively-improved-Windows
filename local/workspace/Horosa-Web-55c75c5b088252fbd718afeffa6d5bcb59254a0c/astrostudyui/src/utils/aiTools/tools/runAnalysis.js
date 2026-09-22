// AI 助手·无头分析出口 run_analysis(批三③;借鉴 Codex exec / claude -p 的 JSON 出口):外部客户端经本机 MCP 问一个问题,拿回 {content,usage,model,rounds}。
// 合同:origins:['mcp'](只在 MCP 目录里,页面内模型永远看不到、直呼其名也拒)· 子开关 horosa.ai.tools.headless.enabled 缺省关 · 只读注册表视图(只能调 read 级工具,且不能再调自己)
// · 内存 deps(消息不落库,零会话)· 在途上限 1(第二个并发 → E_LIMIT)· 输出只是文本与用量,不进账本。
import { GUIDE } from './_shared';
import { isHeadlessEnabled } from '../../aiAgent/prefs';
import { readOnlyRegistryView as sharedReadOnlyRegistryView } from '../../aiAgent/readOnlyRegistry';

export const HEADLESS_INFLIGHT_MAX = 1;
export const HEADLESS_QUESTION_MAX = 2000;
let inflight = 0;

// 只读视图([D79] 单源 aiAgent/readOnlyRegistry.js):目录只列 read 级且非本工具;执行时同样只放行 read 级(防模型在无头轮里绕到写入),来源固定 mcp
export function readOnlyRegistryView(reg){
	return sharedReadOnlyRegistryView(reg, { origin: 'mcp', exclude: ['run_analysis'], denyMessage: '无头分析只允许只读工具' });
}

// 内存 deps:消息只活在本次调用里(不落库、不建会话)
export function memoryConversationDeps(){
	const msgs = []; let n = 0;
	return {
		saveConversationMessage: async (m)=>{ const rec = { ...m, id: m.id || `mem-${++n}` }; const i = msgs.findIndex((x)=>x.id === rec.id); if(i >= 0){ msgs[i] = rec; }else{ msgs.push(rec); } return rec; },
		listConversationMessages: async ()=>msgs.slice(),
		messages: msgs,
	};
}

export default {
	name: 'run_analysis',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['mcp'],
	enabled: ()=>isHeadlessEnabled(),
	timeoutMs: 180000,
	description: `无头分析:对指定 recordId 的命盘/事盘(或不挂载)问一个问题,由星阙内置的 AI 配置作答并只返回文本与用量(不进会话、不落库;只能用只读工具)。给外部程序批量/脚本化调用用。${GUIDE}。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['question'],
		properties: {
			question: { type: 'string', minLength: 1, maxLength: HEADLESS_QUESTION_MAX, description: '要问的问题' },
			recordId: { type: 'string', maxLength: 64, description: '命盘/事盘的记录 id(可选;缺省=不挂载)' },
			techniques: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 32 }, description: '要挂载的技法键(可选)' },
		},
	},
	async run(args, ctx){
		if(inflight >= HEADLESS_INFLIGHT_MAX){ return { ok: false, code: 'E_LIMIT', message: `无头分析在途上限 ${HEADLESS_INFLIGHT_MAX},稍后再试` }; }
		inflight += 1;
		try{
			const seam = ctx && ctx.headlessDeps && typeof ctx.headlessDeps === 'object' ? ctx.headlessDeps : {};   // 测试缝:注入假流/假档案
			const [gr, reg, sources] = await Promise.all([import('../../aiAgent/goalRunner'), import('../registry'), import('../../aiAnalysisSources')]);
			const resolved = seam.resolved || await gr.resolveHeadlessProfile({});
			if(!resolved){ return { ok: false, code: 'E_HEADLESS_UNAVAILABLE', message: '没有可用的接口配置/模型' }; }
			const source = args.recordId ? (sources.findAnalysisSourceById(`${args.recordId}`) || null) : null;
			if(args.recordId && !source){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `找不到记录 ${args.recordId} 对应的命盘/事盘` }; }
			const mem = memoryConversationDeps();
			const t0 = Date.now();
			const r = await gr.runHeadlessTurn({
				profile: resolved.profile, model: resolved.model, conversationId: `headless-${t0}`, userText: `${args.question}`, source, techniqueKeys: Array.isArray(args.techniques) ? args.techniques.slice(0, 6) : [],
				systemPrompt: '', origin: 'mcp', signal: ctx && ctx.signal, registry: readOnlyRegistryView(reg),
				deps: { ...seam, saveConversationMessage: mem.saveConversationMessage, listConversationMessages: mem.listConversationMessages },   // deps 是选项对象里的键(内存消息 + 测试缝)
			});
			if(r.error){ return { ok: false, code: 'E_STREAM_ERROR', message: `${r.error}`.slice(0, 200) }; }
			if(r.aborted){ return { ok: false, code: 'E_ABORTED', message: '本次无头分析已被停止' }; }
			const rounds = r.trace && Array.isArray(r.trace.rounds) ? r.trace.rounds.length : 0;
			const calls = r.trace && Array.isArray(r.trace.rounds) ? r.trace.rounds.reduce((n, rd)=>n + ((rd.results || []).length), 0) : 0;
			return { ok: true, data: { content: `${r.content || ''}`, usage: r.usage || null, model: resolved.model, providerType: resolved.profile.providerType, rounds, calls, elapsedMs: Date.now() - t0 }, summary: `无头分析完成:${rounds} 轮 · ${calls} 次工具 · ${`${r.content || ''}`.length} 字` };
		}finally{ inflight -= 1; }
	},
};
export function __resetHeadlessForTests(){ inflight = 0; }
