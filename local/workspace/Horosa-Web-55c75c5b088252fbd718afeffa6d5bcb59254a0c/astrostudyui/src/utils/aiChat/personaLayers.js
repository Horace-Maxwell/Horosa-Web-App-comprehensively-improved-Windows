// [批二⑨] 分层口径(借鉴 Claude Code 的 CLAUDE.md 分层:全局 → 项目 → 目录 → 会话):
//   全局 = persona.v1 的文本;命主 = bySubject[cid];技法 = byTechnique[技法键](按本轮已选技法顺序);会话 = 会话记录的 persona 字段(随会话存,不进本键)。
// 键 horosa.ai.persona.layers.v1 = { bySubject:{[cid]:文本}, byTechnique:{[技法键]:文本} };缺省不存在 = 只剩全局层(与批前逐字相同)。
// 四层仍受「启用注入」总开关约束(persona.enabled=false → 一层都不注入 = 缺省零变化);合成后封顶 6000 字,前层优先保留、后层被截。
import { safeJsonParseFromStorage, safeJsonStringifyToStorage, safeLocalStorageRemove } from '../safeStorage';

export const PERSONA_LAYERS_KEY = 'horosa.ai.persona.layers.v1';
export const PERSONA_LAYERS_EVENT = 'horosa:ai-persona-layers-changed';
export const PERSONA_LAYER_TEXT_MAX = 2000;
export const PERSONA_SESSION_TEXT_MAX = 1000;
export const PERSONA_COMPOSED_MAX = 6000;
export const PERSONA_LAYER_ENTRIES_MAX = 200;
export const PERSONA_SCOPES = ['subject', 'technique'];

function cleanMap(raw){
	const out = {};
	if(!raw || typeof raw !== 'object' || Array.isArray(raw)){ return out; }
	Object.keys(raw).slice(0, PERSONA_LAYER_ENTRIES_MAX).forEach((k)=>{
		if(!Object.prototype.hasOwnProperty.call(raw, k) || k === '__proto__' || k === 'constructor' || k === 'prototype'){ return; }
		const t = `${raw[k] == null ? '' : raw[k]}`.trim().slice(0, PERSONA_LAYER_TEXT_MAX);
		if(t){ out[k] = t; }
	});
	return out;
}
export function normalizePersonaLayers(raw){
	const r = raw && typeof raw === 'object' ? raw : {};
	return { bySubject: cleanMap(r.bySubject), byTechnique: cleanMap(r.byTechnique) };
}
export function readPersonaLayers(){ return normalizePersonaLayers(safeJsonParseFromStorage(PERSONA_LAYERS_KEY)); }
function emit(l){
	try{ if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){ window.dispatchEvent(new CustomEvent(PERSONA_LAYERS_EVENT, { detail: l })); } }catch(e){ /* noop */ }
}
// 写一层:空文本=删该条;两表全空=删键(与从未设置同形)
export function writePersonaLayer(scope, id, text){
	const cur = readPersonaLayers();
	if(PERSONA_SCOPES.indexOf(scope) < 0 || !id){ return cur; }
	const map = scope === 'subject' ? cur.bySubject : cur.byTechnique;
	const t = `${text || ''}`.trim().slice(0, PERSONA_LAYER_TEXT_MAX);
	if(t){ map[`${id}`] = t; }else{ delete map[`${id}`]; }
	if(!Object.keys(cur.bySubject).length && !Object.keys(cur.byTechnique).length){ safeLocalStorageRemove(PERSONA_LAYERS_KEY); }
	else{ try{ safeJsonStringifyToStorage(PERSONA_LAYERS_KEY, cur); }catch(e){ /* 配额 */ } }
	emit(cur);
	return cur;
}
export function clearPersonaLayers(){ safeLocalStorageRemove(PERSONA_LAYERS_KEY); const l = normalizePersonaLayers(null); emit(l); return l; }
export function subscribePersonaLayers(fn){
	if(typeof window === 'undefined' || typeof fn !== 'function'){ return ()=>{}; }
	const h = (e)=>fn(normalizePersonaLayers(e && e.detail ? e.detail : readPersonaLayers()));
	window.addEventListener(PERSONA_LAYERS_EVENT, h);
	// [进阶审计 D6·2026-09-07] 跨窗口:另一个窗口写了本键(或整个 storage 被清),本窗口的订阅者也要重读 —— storage 事件只在别的窗口触发,本窗口写入仍走上面的 CustomEvent
	const sh = (e)=>{ const k = e && e.key != null ? `${e.key}` : ''; if(!k || k === PERSONA_LAYERS_KEY){ fn(normalizePersonaLayers(readPersonaLayers())); } };
	window.addEventListener('storage', sh);
	return ()=>{ window.removeEventListener(PERSONA_LAYERS_EVENT, h); window.removeEventListener('storage', sh); };
}
// 合成:全局 → 命主 → 技法(按已选技法顺序,只取有口径的,同键去重)→ 会话;各段带小标题;封顶 6000
export function composePersonaText(globalText, layers, ctx){
	const c = ctx || {};
	const l = normalizePersonaLayers(layers);
	const parts = [];
	const g = `${globalText || ''}`.trim();
	if(g){ parts.push(g); }
	const cid = c.subjectCid == null ? '' : `${c.subjectCid}`;
	if(cid && l.bySubject[cid]){ parts.push(`## 命主口径${c.subjectTitle ? `(${`${c.subjectTitle}`.slice(0, 40)})` : ''}\n${l.bySubject[cid]}`); }
	const seen = new Set();
	(Array.isArray(c.techniqueKeys) ? c.techniqueKeys : []).forEach((k)=>{
		const key = `${k}`;
		if(seen.has(key)){ return; }
		seen.add(key);
		const t = l.byTechnique[key];
		if(t){ parts.push(`## 技法口径·${c.techniqueLabels && c.techniqueLabels[key] ? c.techniqueLabels[key] : key}\n${t}`); }
	});
	const s = `${c.sessionText || ''}`.trim().slice(0, PERSONA_SESSION_TEXT_MAX);
	if(s){ parts.push(`## 本会话口径\n${s}`); }
	return parts.join('\n\n').slice(0, PERSONA_COMPOSED_MAX);
}
