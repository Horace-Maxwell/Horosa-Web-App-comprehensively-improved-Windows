// [批二⑪] 会话 resume(借鉴 Claude Code --continue / /resume):记住上次打开的对话(uiPrefs chatAssist.lastConversationId),
// 开关「启动时继续上次」(uiPrefs chatAssist.resumeLast,缺省关 = 不记、不开 = 零变化);/resume 浮层列最近 5 个对话点一下继续。
// 只在开关开着时才写 lastConversationId(缺省不往 uiPrefs 里塞新字段)。
import { loadUiPrefs, saveUiPrefs } from '../aiAnalysisStore';

export const RESUME_RECENT_MAX = 5;

export function readResumePrefs(){
	try{
		const ui = loadUiPrefs(); const c = ui && ui.chatAssist && typeof ui.chatAssist === 'object' ? ui.chatAssist : {};
		return { resumeLast: c.resumeLast === true, lastConversationId: typeof c.lastConversationId === 'string' ? c.lastConversationId : '' };
	}catch(e){ return { resumeLast: false, lastConversationId: '' }; }
}
function writeChatAssist(mutate){
	let cur = {};
	try{ const ui = loadUiPrefs(); cur = ui && ui.chatAssist && typeof ui.chatAssist === 'object' ? ui.chatAssist : {}; }catch(e){ cur = {}; }
	const next = { ...cur };
	mutate(next);
	saveUiPrefs({ chatAssist: next });
	return next;
}
export function setResumeLast(on){
	return writeChatAssist((n)=>{ if(on){ n.resumeLast = true; }else{ delete n.resumeLast; delete n.lastConversationId; } });
}
// 记住当前对话:只在开关开着时写;空 id 不写
export function rememberLastConversation(id){
	const cid = `${id || ''}`;
	if(!cid || !readResumePrefs().resumeLast){ return false; }
	writeChatAssist((n)=>{ n.lastConversationId = cid; });
	return true;
}
function ts(c){ return Date.parse((c && (c.updatedAt || c.createdAt)) || '') || 0; }
export function recentConversations(conversations, n){
	const max = Number(n) > 0 ? Number(n) : RESUME_RECENT_MAX;
	return (Array.isArray(conversations) ? conversations : []).filter((c)=>c && c.id && !c.archived).slice(0).sort((a, b)=>ts(b) - ts(a)).slice(0, max);
}
// 启动时该继续哪个:上次 id 仍在且未归档 → 它;否则 null(不猜「最近一个」,免得把别的对话当成上次)
export function pickResumeConversation(conversations, lastId){
	const id = `${lastId || ''}`;
	if(!id){ return null; }
	const c = (Array.isArray(conversations) ? conversations : []).find((x)=>x && x.id === id);
	return c && !c.archived ? c : null;
}
