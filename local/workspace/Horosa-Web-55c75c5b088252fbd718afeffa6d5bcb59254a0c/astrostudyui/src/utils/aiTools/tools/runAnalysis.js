// AI 助手·无头分析出口 run_analysis(批三③):外部客户端经本机 MCP 问一个问题,拿回 {content,usage,model,rounds}。
// 合同:origins:['mcp'](只在 MCP 目录里,页面内模型永远看不到、直呼其名也拒)· 子开关 horosa.ai.tools.headless.enabled 缺省关 · 只读注册表视图(只能调 read 级工具,且不能再调自己)
// · 内存 deps(消息不落库,零会话)· 在途上限 1(第二个并发 → E_LIMIT)· 输出只是文本与用量,不进账本。
import { GUIDE, SOURCE_SCHEMA } from './_shared';
import { isHeadlessEnabled } from '../../aiAgent/prefs';
import { readOnlyRegistryView as sharedReadOnlyRegistryView } from '../../aiAgent/readOnlyRegistry';

export const HEADLESS_INFLIGHT_MAX = 1;
export const HEADLESS_QUESTION_MAX = 2000;
let inflight = 0;

// 只读视图(单源 aiAgent/readOnlyRegistry.js):目录只列 read 级且非本工具;执行时同样只放行 read 级(防模型在无头轮里绕到写入),来源固定 mcp
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
	description: `无头分析:对指定档案(recordId,或 source:起课时间 / 临时出生资料)问一个问题,由星阙内置的 AI 配置作答并只返回文本与用量(不进会话、不落库;只能用只读工具)。可带合盘对方(partnerRecordId)与技能包(skill + skillArgs,如 builtin:liunian)。给外部程序批量/脚本化调用用。${GUIDE}。`,
	inputSchema: {
		type: 'object', additionalProperties: false,   // question 与 skill 至少给一个(run 里判;不用 anyOf —— Ajv removeAdditional 的形状陷阱)
		properties: {
			question: { type: 'string', minLength: 1, maxLength: HEADLESS_QUESTION_MAX, description: '要问的问题' },
			recordId: { type: 'string', maxLength: 64, description: '命盘/事盘的记录 id(可选;缺省=不挂载)' },
			// 起课时间 / 临时出生资料(与 cast_technique 同一形状);给了就不看 recordId
			source: { ...SOURCE_SCHEMA, description: '挂载源(可选):record=已存档案 / timepoint=起课时间(事盘类技法)/ natal=临时出生资料;给了就不看 recordId' },
			partnerRecordId: { type: 'string', maxLength: 64, description: '合盘对方命盘的记录 id(可选;本人也须是命盘)' },
			skill: { type: 'string', maxLength: 80, description: '技能包 id(可选,如 builtin:liunian;用户自建技能包 id 见 prompts/list 的 skill:<id>):带上它的技法、口径与输出格式,问题按模板生成' },
			skillArgs: { type: 'object', additionalProperties: true, description: '技能包参数(如 { "year": "2027" })' },
			techniques: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 32 }, description: '要挂载的技法键(可选;给了技能包而这里留空 = 用技能包的技法)' },
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
			const question = `${args.question || ''}`.trim();
			if(!question && !args.skill){ return { ok: false, code: 'E_ARGS_INVALID', message: 'question 与 skill 至少给一个' }; }
			// 挂载源:source(record / timepoint / natal,与 cast_technique 同一合成)优先,否则 recordId
			let source = null;
			let assumptions = [];
			if(args.source){
				const { buildSourceFromArgs } = await import('./castTechnique');
				const built = await buildSourceFromArgs(args.source);
				if(built.error){ return built.error; }
				source = built.source; assumptions = built.assumptions || [];
			}else if(args.recordId){
				source = sources.findAnalysisSourceById(`${args.recordId}`) || null;
				if(!source){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `找不到记录 ${args.recordId} 对应的命盘/事盘` }; }
			}
			// 合盘对方:本人与对方都必须是命盘、且不是同一张
			let partnerSource = null;
			if(args.partnerRecordId){
				partnerSource = sources.findAnalysisSourceById(`${args.partnerRecordId}`) || null;
				if(!partnerSource){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `找不到合盘对方 ${args.partnerRecordId}` }; }
				if(!source || source.sourceType !== 'chart' || partnerSource.sourceType !== 'chart' || partnerSource.id === source.id){
					return { ok: false, code: 'E_TECHNIQUE_NOT_ALLOWED', message: '合盘需要本人与对方都是命盘,且不是同一张' };
				}
			}
			// 技能包:带上它的技法(没另给 techniques 时)、口径与输出格式(进系统指令),问题按模板生成
			let techniqueKeys = Array.isArray(args.techniques) ? args.techniques.slice(0, 6) : [];
			let systemPrompt = '';
			let userText = question;
			if(args.skill){
				const sk = await import('../../aiChat/skills');
				const store = await import('../../aiAnalysisStore');
				let user = [];
				try{ user = sk.skillsOf(await store.listStoreRecords(store.AI_ANALYSIS_STORES.bundles)); }catch(e){ user = []; }
				const all = sk.BUILTIN_SKILLS.map((b)=>({ ...b, skill: sk.normalizeSkillPack(b) })).concat(user);
				const b = all.find((x)=>x && `${x.id}` === `${args.skill}`);
				if(!b){ return { ok: false, code: 'E_ARGS_INVALID', message: `没有这个技能包:${`${args.skill}`.slice(0, 80)}(列表见 prompts/list 的 skill:<id>)` }; }
				const skill = b.skill || {};
				if(!techniqueKeys.length){ techniqueKeys = (skill.techniqueKeys || []).slice(0, 6); }
				systemPrompt = sk.buildSkillDirective(skill);
				const given = args.skillArgs && typeof args.skillArgs === 'object' ? args.skillArgs : {};
				const vars = {};
				(skill.argsSpec || []).forEach((x)=>{ vars[x.name] = given[x.name] !== undefined && given[x.name] !== null && `${given[x.name]}` !== '' ? `${given[x.name]}` : (x.default || ''); });
				const rendered = sk.renderSkillPrompt(skill, vars, { activeSource: source, otherSource: partnerSource });
				userText = [rendered, question].filter(Boolean).join('\n\n');
			}
			const mem = memoryConversationDeps();
			const t0 = Date.now();
			// 外部客户端要了进度才有 ctx.progress:每轮(与每次工具调用)报一次,说明里带最近调用的工具名
			const report = ctx && typeof ctx.progress === 'function' ? ctx.progress : null;
			if(report){ report(0, undefined, '准备上下文'); }
			const onTrace = report ? (t)=>{
				try{
					const rs = (t && Array.isArray(t.rounds)) ? t.rounds : [];
					const calls = rs.reduce((n, rd)=>n + ((rd.toolCalls || []).length), 0);
					const last = rs.length ? rs[rs.length - 1] : null;
					const lastTool = last && Array.isArray(last.toolCalls) && last.toolCalls.length ? last.toolCalls[last.toolCalls.length - 1].name : '';
					report(rs.length * 100 + calls, undefined, `第 ${Math.max(1, rs.length)} 轮${lastTool ? `:调用 ${lastTool}` : ''}`);
				}catch(e){ /* 进度回报失败不影响分析本身 */ }
			} : undefined;
			const r = await gr.runHeadlessTurn({
				profile: resolved.profile, model: resolved.model, conversationId: `headless-${t0}`, userText, source, techniqueKeys,
				systemPrompt, origin: 'mcp', signal: ctx && ctx.signal, registry: readOnlyRegistryView(reg), ...(onTrace ? { onTrace } : {}), ...(partnerSource ? { partnerSource } : {}),
				deps: { ...seam, saveConversationMessage: mem.saveConversationMessage, listConversationMessages: mem.listConversationMessages },   // deps 是选项对象里的键(内存消息 + 测试缝)
			});
			if(r.error){ return { ok: false, code: 'E_STREAM_ERROR', message: `${r.error}`.slice(0, 200) }; }
			if(r.aborted){ return { ok: false, code: 'E_ABORTED', message: '本次无头分析已被停止' }; }
			const rounds = r.trace && Array.isArray(r.trace.rounds) ? r.trace.rounds.length : 0;
			const calls = r.trace && Array.isArray(r.trace.rounds) ? r.trace.rounds.reduce((n, rd)=>n + ((rd.results || []).length), 0) : 0;
			return { ok: true, ...(assumptions.length ? { assumptions } : {}), data: { content: `${r.content || ''}`, usage: r.usage || null, model: resolved.model, providerType: resolved.profile.providerType, rounds, calls, elapsedMs: Date.now() - t0 }, summary: `无头分析完成:${rounds} 轮 · ${calls} 次工具 · ${`${r.content || ''}`.length} 字` };
		}finally{ inflight -= 1; }
	},
};
export function __resetHeadlessForTests(){ inflight = 0; }
