// [批二⑧] 压缩提醒阈值:存 uiPrefs(horosa.ai.analysis.ui.v3)嵌套 chatAssist.compactAutoTokens;缺省 null=不提醒。只提醒、绝不自动压缩(压缩要花一次短调用的钱)。
// 策略卡写 → 派发 UI_PREFS_CHANGED_EVENT → 对话页状态栏重读(两棵 React 树之间没有共同父级,靠窗口事件同步)。
import { loadUiPrefs, saveUiPrefs } from '../aiAnalysisStore';

export const UI_PREFS_CHANGED_EVENT = 'horosa:ui-prefs-changed';
export const COMPACT_AUTO_TOKENS_MIN = 2000;
export const COMPACT_AUTO_TOKENS_MAX = 400000;

export function normalizeCompactAutoTokens(v){
	const n = Number(v);
	if(!Number.isFinite(n) || n <= 0){ return null; }
	return Math.min(COMPACT_AUTO_TOKENS_MAX, Math.max(COMPACT_AUTO_TOKENS_MIN, Math.round(n)));
}
export function readCompactAutoTokens(){
	try{ const ui = loadUiPrefs(); return normalizeCompactAutoTokens(ui && ui.chatAssist ? ui.chatAssist.compactAutoTokens : null); }catch(e){ return null; }
}
export function writeCompactAutoTokens(v){
	const n = normalizeCompactAutoTokens(v);
	let cur = {};
	try{ const ui = loadUiPrefs(); cur = ui && ui.chatAssist && typeof ui.chatAssist === 'object' ? ui.chatAssist : {}; }catch(e){ cur = {}; }
	const next = { ...cur };
	if(n === null){ delete next.compactAutoTokens; }else{ next.compactAutoTokens = n; }
	saveUiPrefs({ chatAssist: next });
	try{ window.dispatchEvent(new CustomEvent(UI_PREFS_CHANGED_EVENT, { detail: { key: 'chatAssist.compactAutoTokens', value: n } })); }catch(e){ /* 非浏览器环境 */ }
	return n;
}
