// AI 助手·工作区桥:页面侧把「改当前盘口径的正门」(pages/index.js changeCond)与 dva dispatch
// 注册进来,工具层不直接 import 页面组件;缺桥时相关工具返回 E_BRIDGE_UNAVAILABLE。
let bridge = {};
// [批五] 工作区 ui 面:各页面在挂载时登记自己能做的事(AI 分析页:选源/刷源/内页签;主页:导航/当前路由/路由表;合盘页:配对),
// 卸载时注销自己登记的键(引用未变才删,别删掉别人后来登记的同名键)。工具、桥、自动化经 getWorkspaceUi() 读同一份;
// waitForWorkspaceUi 给「先导航再等目标页登记」用(合盘页首次挂载有加载时间)。事件只在本窗口内广播。
export const WORKSPACE_UI_EVENT = 'horosa:agent-workspace-ui-changed';
function emitUi(){
	if(typeof window === 'undefined' || typeof window.dispatchEvent !== 'function'){ return; }
	try{ window.dispatchEvent(new CustomEvent(WORKSPACE_UI_EVENT)); }catch(e){ /* 无 CustomEvent 的旧环境:轮询读端仍可用 */ }
}

export function registerWorkspaceBridge(partial){
	bridge = { ...bridge, ...(partial || {}) };
	return bridge;
}

export function getWorkspaceBridge(){
	return bridge;
}

export function registerWorkspaceUi(partial){
	const p = partial && typeof partial === 'object' ? partial : {};
	const keys = Object.keys(p);
	bridge = { ...bridge, ui: { ...(bridge.ui || {}), ...p } };
	emitUi();
	return function unregisterWorkspaceUi(){
		const ui = { ...(bridge.ui || {}) };
		keys.forEach((k)=>{ if(ui[k] === p[k]){ delete ui[k]; } });
		bridge = { ...bridge, ui };
		emitUi();
	};
}

export function getWorkspaceUi(){
	return bridge.ui || {};
}
// 调试/端到端判据用:页面里可直接读登记面(只读函数,不暴露写入)
if(typeof window !== 'undefined'){ try{ window.__horosaWorkspaceUiDebug = getWorkspaceUi; }catch(e){ /* noop */ } }

// 等某个 ui 键就绪(函数或对象);超时回 null。就绪立即回,不等事件。
export function waitForWorkspaceUi(key, ms){
	const has = ()=>{ const v = getWorkspaceUi()[key]; return v !== undefined && v !== null ? v : null; };
	const now = has();
	if(now){ return Promise.resolve(now); }
	if(typeof window === 'undefined' || typeof window.addEventListener !== 'function'){ return Promise.resolve(null); }
	return new Promise((resolve)=>{
		let done = false;
		const finish = (v)=>{ if(done){ return; } done = true; window.removeEventListener(WORKSPACE_UI_EVENT, onChange); clearTimeout(timer); resolve(v); };
		const onChange = ()=>{ const v = has(); if(v){ finish(v); } };
		const timer = setTimeout(()=>finish(null), Math.max(0, Number(ms) || 0));
		window.addEventListener(WORKSPACE_UI_EVENT, onChange);
	});
}

export function __resetWorkspaceBridgeForTests(){
	bridge = {};
}
