// AI 助手·自动化事件总线(P4)。🔴 **本文件零 import**:调用点散在数据层(localcharts/localcases)、注册表、任务层、页面,
// 任何一处 import 事件总线都不该反向拖进引擎/存储/运行时——否则数据层会被工具面污染(合同测试锁 `^import` 行数=0)。
// 形态:内存订阅表 + window 事件(便于 devtools 观察);发事件永不抛错、永不阻塞调用点。
export var AUTOMATION_EVENTS = ['app.start', 'record.saved', 'turn.end', 'tool.before', 'tool.after', 'task.done', 'report.done'];
export var AUTOMATION_DOM_EVENT = 'horosa:automation-event';

var subs = [];

export function isAutomationEventName(name){
	return AUTOMATION_EVENTS.indexOf(String(name)) >= 0;
}

export function subscribeAutomationEvents(fn){
	if(typeof fn !== 'function'){ return function(){}; }
	subs.push(fn);
	return function(){ subs = subs.filter(function(f){ return f !== fn; }); };
}

// payload 里的 origin==='automation' 由引擎用于深度守卫(自动化触发的动作不再触发规则)
export function emitAutomationEvent(name, payload){
	if(!isAutomationEventName(name)){ return false; }
	var detail = { event: String(name), payload: payload && typeof payload === 'object' ? payload : {}, at: new Date().toISOString() };
	for(var i = 0; i < subs.length; i++){
		try{ subs[i](detail); }catch(e){ /* 订阅者抛错绝不反噬调用点 */ }
	}
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
			window.dispatchEvent(new CustomEvent(AUTOMATION_DOM_EVENT, { detail: detail }));
		}
	}catch(e){ /* 无 DOM 环境(测试/无头)照常 */ }
	return true;
}

// [批二④] 同步通道(借鉴 Claude Code PreToolUse hooks):tool.before 在工具执行前**同步**问一遍订阅者,任一回 { veto:true } 即否决。
// 与异步总线分列:异步订阅者永远拿不到否决权(事件发完调用点早已继续);同步订阅者绝不能做 IO。
var vetoSubs = [];
export function subscribeAutomationVeto(fn){
	if(typeof fn !== 'function'){ return function(){}; }
	vetoSubs.push(fn);
	return function(){ vetoSubs = vetoSubs.filter(function(f){ return f !== fn; }); };
}
export function emitAutomationEventSync(name, payload){
	if(!isAutomationEventName(name)){ return { vetoed: false }; }
	var detail = { event: String(name), payload: payload && typeof payload === 'object' ? payload : {}, at: new Date().toISOString() };
	for(var i = 0; i < vetoSubs.length; i++){
		try{
			var r = vetoSubs[i](detail);
			if(r && r.veto){ return { vetoed: true, reason: String(r.reason || ''), ruleId: r.ruleId ? String(r.ruleId) : undefined }; }
		}catch(e){ /* 订阅者抛错=不否决,绝不反噬调用点 */ }
	}
	return { vetoed: false };
}

export function __resetAutomationEventsForTests(){ subs = []; vetoSubs = []; }
