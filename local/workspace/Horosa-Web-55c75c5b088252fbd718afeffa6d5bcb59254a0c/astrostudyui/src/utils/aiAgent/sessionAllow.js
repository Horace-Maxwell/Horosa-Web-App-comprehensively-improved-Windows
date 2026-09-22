// AI 助手·会话内放行集(P1「允许并本会话不再问」):纯内存、零 import、页面会话生命周期(刷新即清)。
// 只影响审批判定的「询问」分支(deny / 只读档永远优先);永久放行走 prefs.setToolPolicy({ allow }),不在这里。
// [AR-31·2026-09-17] 按**对话 id** 分集合:按钮写的是「本会话不再问」,界面里「会话」指一个对话;此前一个页面级集合跨所有对话生效。
//   作用域由 useChatAssist 随当前对话切换时 setSessionAllowScope(convId) 设定;无作用域(尚未建对话)时落在 '' 集合,
//   新对话首条消息发送中建立记录后作用域随之切换——发送前点过的放行只对该新对话有效。
const allowed = new Set();
let scope = '';
const keyOf = (name)=>`${scope}\u0000${name}`;

export function setSessionAllowScope(convId){
	scope = `${convId || ''}`;
}
export function __getSessionAllowScopeForTests(){
	return scope;
}
export function allowToolForSession(name){
	const n = `${name || ''}`.trim();
	if(!n){ return false; }
	allowed.add(keyOf(n));
	return true;
}
export function isToolSessionAllowed(name){
	return allowed.has(keyOf(`${name || ''}`));
}
export function listSessionAllowed(){
	const prefix = keyOf('');
	return Array.from(allowed.values()).filter((k)=>k.indexOf(prefix) === 0).map((k)=>k.slice(prefix.length));
}
export function __resetSessionAllowForTests(){ allowed.clear(); scope = ''; }
