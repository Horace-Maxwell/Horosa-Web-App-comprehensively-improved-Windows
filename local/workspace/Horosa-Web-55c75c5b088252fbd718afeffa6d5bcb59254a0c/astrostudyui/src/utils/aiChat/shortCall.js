// AI 对话·非流式短调用薄封装(对话压缩摘要 / 个人口径草稿 / 记忆提炼 三种辅助调用共用)。
// 与自动命名同路径(services/aianalysis.requestAIAnalysisChat);system 首行固定带调用类型标记,
// 让 假上游按 system 特征把它识别为辅助请求(不计入场景轮计划),也让 requestTelemetry 留痕可分类。
// 全部只由用户显式动作触发(按钮/命令),不在任何自动路径上花钱。
import { requestAIAnalysisChat } from '../../services/aianalysis';
import { applyThinkingLevel } from '../aiAnalysisProviders';

export const SHORT_CALL_MARKERS = Object.freeze({
	compact: '【对话压缩】',
	init: '【口径草稿】',
	memory: '【记忆提炼】',
	plan: '【行动计划】',   // [批二⑦] /plan 规划调用:只看工具目录摘要列步骤,不执行任何工具
});
export const SHORT_CALL_DEFAULT_TIMEOUT_MS = 30000;

export function shortCallSystem(kind, system){
	const marker = SHORT_CALL_MARKERS[kind];
	if(!marker){ throw new Error(`[aiChat] 未知短调用类型: ${kind}`); }
	const body = `${system || ''}`.trim();
	return body ? `${marker}\n${body}` : marker;
}

// 返回 { ok, content, usage, raw, error };绝不抛(调用方按 ok 分支给 UI 文案)。
export async function requestShortCompletion({ profile, model, kind, system, user, timeoutMs, signal }){
	if(!profile || !model){ return { ok: false, content: '', usage: null, raw: null, error: 'no_provider' }; }
	let sys;
	try{ sys = shortCallSystem(kind, system); }catch(e){ return { ok: false, content: '', usage: null, raw: null, error: e && e.message ? e.message : 'bad_kind' }; }
	try{
		const opts = applyThinkingLevel({ ...(profile.providerOptions || {}) }, 'off', profile.providerType, model);
		const rsp = await requestAIAnalysisChat({
			providerType: profile.providerType,
			apiKey: profile.apiKey,
			baseUrl: profile.baseUrl,
			model,
			providerOptions: { ...(opts || {}), requestTimeoutMs: Number(timeoutMs) > 0 ? Number(timeoutMs) : SHORT_CALL_DEFAULT_TIMEOUT_MS },
			messages: [
				{ role: 'system', content: sys },
				{ role: 'user', content: `${user || ''}` },
			],
			signal,
		});
		const result = rsp && rsp.Result ? rsp.Result : null;
		const content = result && result.content ? `${result.content}` : '';
		return { ok: !!content, content, usage: result && result.usage ? result.usage : null, raw: rsp, error: content ? null : 'empty' };
	}catch(e){
		return { ok: false, content: '', usage: null, raw: null, error: e && e.message ? e.message : `${e}` };
	}
}

// 从短调用回复里取 JSON 对象(剥 ```json 围栏、取首个 {…});解析失败返回 null。
export function parseShortCallJson(text){
	const s = `${text || ''}`.replace(/```(?:json)?/gi, '').trim();
	const i = s.indexOf('{');
	const j = s.lastIndexOf('}');
	if(i < 0 || j <= i){ return null; }
	try{
		const v = JSON.parse(s.slice(i, j + 1));
		return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
	}catch(e){ return null; }
}
