// 全站唯一复制入口:三级降级(桌面原生 → navigator.clipboard → execCommand),恒返 boolean、绝不 throw。
// 背景:Tauri WKWebView 里 navigator.clipboard / execCommand 被拦(APP 内静默失败),必须先走桌面桥;
// 浏览器 preview 无 __TAURI__ 时桥返 false,自然落标准剪贴板。组件层禁止再裸用 navigator.clipboard.writeText。
import { copyDesktopClipboard } from './aiAnalysisDesktop';

export async function copyTextSmart(text){
	const val = `${text == null ? '' : text}`;
	// 1) Tauri 桌面剪贴板:原生剪贴板命令(invoke);老壳无命令/非桌面 → false 落下级。
	try{ if(await copyDesktopClipboard(val)){ return true; } }catch(e){ /* 回退 */ }
	// 2) 标准剪贴板(需安全上下文 + 文档焦点;异步后用户手势可能已失效,失败即回退)。
	if(navigator.clipboard && window.isSecureContext){
		try{ await navigator.clipboard.writeText(val); return true; }catch(e){ /* 回退 */ }
	}
	// 3) execCommand 回退:先抢回窗口/选区焦点(复制多由菜单/弹层触发、焦点已散)。
	try{ window.focus(); }catch(e){}
	let ok = false;
	try{
		const ta = document.createElement('textarea');
		ta.value = val;
		ta.setAttribute('readonly', '');
		ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
		document.body.appendChild(ta);
		ta.focus();
		ta.select();
		try{ ta.setSelectionRange(0, ta.value.length); }catch(e){}
		try{ ok = document.execCommand('copy'); }catch(e){ ok = false; }
		document.body.removeChild(ta);
	}catch(e){ ok = false; }
	return ok;
}
