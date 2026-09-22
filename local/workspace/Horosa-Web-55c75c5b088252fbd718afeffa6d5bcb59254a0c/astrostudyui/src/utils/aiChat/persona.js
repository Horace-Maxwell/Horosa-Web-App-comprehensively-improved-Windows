// AI 对话·个人口径文件(A6;借鉴 CLAUDE.md / AGENTS.md / Kiro Steering):一份 ≤4000 字的本机口径(流派偏好/术语/禁忌/输出格式),
// 「启用注入」开时每次对话以稳定层注入(priority 102:在守则之后、系统提示之前,与 memory 101 一起居首,前缀稳定吃缓存)。
// 键 horosa.ai.persona.v1 = { text, enabled:false, memoryInject:false, memoryCapture:false, applyToReport:false };缺省全关=零字节变化。
import { safeJsonParseFromStorage, safeJsonStringifyToStorage, safeLocalStorageRemove } from '../safeStorage';
import { composePersonaText } from './personaLayers';

export const PERSONA_KEY = 'horosa.ai.persona.v1';
export const PERSONA_EVENT = 'horosa:ai-persona-changed';
export const PERSONA_TEXT_MAX = 4000;
export const PERSONA_LAYER_KEY = 'persona';
export const PERSONA_LAYER_PRIORITY = 102;
export const MEMORY_LAYER_KEY = 'memory';
export const MEMORY_LAYER_PRIORITY = 101;
export const PERSONA_DIRECTIVE_TITLE = '【个人口径（本机用户设定，全程遵循）】';
export const PERSONA_TEMPLATE = ['## 流派偏好', '(例:八字用子平法看格局,紫微以三合派为主)', '', '## 术语与称谓', '(例:称我为「命主」;用「大运」不用「大限」指八字)', '', '## 禁忌', '(例:不要给医疗/投资类的确定性建议)', '', '## 输出格式', '(例:先结论后依据;要点式;不超过 500 字)'].join('\n');

export function normalizePersona(raw){
	const r = raw && typeof raw === 'object' ? raw : {};
	return {
		text: `${r.text || ''}`.slice(0, PERSONA_TEXT_MAX),
		enabled: r.enabled === true,
		memoryInject: r.memoryInject === true,
		memoryCapture: r.memoryCapture === true,
		applyToReport: r.applyToReport === true,
	};
}

export function readPersona(){ return normalizePersona(safeJsonParseFromStorage(PERSONA_KEY)); }

function emit(p){
	try{ if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){ window.dispatchEvent(new CustomEvent(PERSONA_EVENT, { detail: p })); } }catch(e){ /* noop */ }
}

// 写:合并;全部缺省(空文本+四关)即删键(与从未设置同形)
export function writePersona(patch){
	const next = normalizePersona({ ...readPersona(), ...(patch || {}) });
	if(!next.text && !next.enabled && !next.memoryInject && !next.memoryCapture && !next.applyToReport){ safeLocalStorageRemove(PERSONA_KEY); emit(next); return next; }
	try{ safeJsonStringifyToStorage(PERSONA_KEY, next); }catch(e){ /* 配额 */ }
	emit(next);
	return next;
}

// [Q-294/M-109·AR-18] 清空口径 = 只清文本与「启用注入」;记忆注入 / 自动沉淀 / 同时用于报告 三开关保留(此前整键删除连带关掉三开关,
//   与按钮文案「记忆不受影响」相悖);三开关本就全关时 writePersona 自然删键(与从未设置同形)。
export function clearPersona(){ return writePersona({ text: '', enabled: false }); }

export function subscribePersona(fn){
	if(typeof window === 'undefined' || typeof fn !== 'function'){ return ()=>{}; }
	const h = (e)=>fn(normalizePersona(e && e.detail ? e.detail : readPersona()));
	window.addEventListener(PERSONA_EVENT, h);
	// [进阶审计 D6·2026-09-07] 跨窗口:另一个窗口写了本键(或整个 storage 被清),本窗口的订阅者也要重读 —— storage 事件只在别的窗口触发,本窗口写入仍走上面的 CustomEvent
	const sh = (e)=>{ const k = e && e.key != null ? `${e.key}` : ''; if(!k || k === PERSONA_KEY){ fn(normalizePersona(readPersona())); } };
	window.addEventListener('storage', sh);
	return ()=>{ window.removeEventListener(PERSONA_EVENT, h); window.removeEventListener('storage', sh); };
}

// 口径指令正文(不带标题;标题由层 title 承担);空文本 → ''

// 口径层:enabled 才产;缺省 null(零变化)。[批二⑨] 带 ctx 时按 全局→命主→技法→会话 合成(ctx.layers/subjectCid/subjectTitle/techniqueKeys/techniqueLabels/sessionText);
// 不带 ctx = 只有全局文本(与批前逐字相同);enabled 但四层全空仍 null。
export function personaLayer(persona, ctx){
	const p = normalizePersona(persona);
	if(!p.enabled){ return null; }
	const content = ctx ? composePersonaText(p.text, ctx.layers, ctx) : p.text.trim();
	if(!content.trim()){ return null; }
	return { key: PERSONA_LAYER_KEY, title: PERSONA_DIRECTIVE_TITLE, content, priority: PERSONA_LAYER_PRIORITY };
}

// /init 草稿输入:最近 N 个会话的用户消息摘录 + 技法频次(纯函数;调用方喂 conversations 与各会话消息)
export const INIT_RECENT_CONVERSATIONS = 30;
export const INIT_SYSTEM = [
	'你是「个人口径」草稿撰写器。根据用户最近的提问方式与常用技法,写一份 ≤ 600 字的个人口径草稿,分四节:流派偏好 / 术语与称谓 / 禁忌 / 输出格式。',
	'只写从材料里能看出来的偏好(用词习惯、常问的角度、反复出现的要求);看不出来的一节写「(待补)」;不要编造事实;不要输出前言后语。',
].join('\n');
export function buildInitDraftInput({ conversations, messagesByConversation, recent }){
	const n = Number(recent) > 0 ? Number(recent) : INIT_RECENT_CONVERSATIONS;
	const convs = (conversations || []).slice().sort((a, b)=>`${b.updatedAt || ''}`.localeCompare(`${a.updatedAt || ''}`)).slice(0, n);
	const freq = {};
	const lines = [];
	convs.forEach((c)=>{
		(Array.isArray(c.techniqueKeys) ? c.techniqueKeys : []).forEach((k)=>{ freq[k] = (freq[k] || 0) + 1; });
		const msgs = (messagesByConversation && messagesByConversation[c.id]) || [];
		msgs.filter((m)=>m && m.role === 'user' && m.content).slice(0, 6).forEach((m)=>{ lines.push(`- ${`${m.content}`.replace(/\s+/g, ' ').slice(0, 160)}`); });
	});
	const top = Object.keys(freq).sort((a, b)=>freq[b] - freq[a]).slice(0, 8).map((k)=>`${k}×${freq[k]}`).join(', ');
	const text = [`【常用技法】${top || '(无)'}`, '', `【最近提问摘录(${lines.length} 条)】`, ...lines.slice(0, 120)].join('\n');
	return { text: text.slice(0, 12000), conversations: convs.length, excerpts: Math.min(lines.length, 120), topTechniques: top };
}
