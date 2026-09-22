// AI 对话·检查点与回退(A5;借鉴 Gemini CLI / Claude Code 的 checkpoint):每条用户消息落库时带 checkpoint(挂载源/引用/技法/系统提示/覆盖/模型/思考/温度/topP),
// 「回退到此」= 先逐条撤销被删 assistant 消息里的写入动作(新→旧;任一失败即停,不删消息),再删该用户消息及其后所有消息,最后按 checkpoint 恢复设置、清压缩。
// 本文件纯函数零副作用:只算计划,不删不撤(执行住钩子)。绝不 import 工具注册表。
export const CHECKPOINT_VERSION = 1;
export const CHECKPOINT_FIELDS = ['sourceId', 'referenceIds', 'techniqueKeys', 'sessionSystemPrompt', 'techniqueOptionOverrides', 'modelSelection', 'thinkingLevel', 'chatTemperature', 'chatTopP'];

function ts(m){ const c = m && m.createdAt; if(typeof c === 'number'){ return c; } const t = Date.parse(c || ''); return Number.isFinite(t) ? t : 0; }

export function buildCheckpoint(deps){
	const d = deps || {};
	return {
		v: CHECKPOINT_VERSION,
		sourceId: d.selectedSourceId || (d.activeSource && d.activeSource.id) || '',
		referenceIds: Array.isArray(d.referenceIds) ? d.referenceIds.slice(0) : [],
		techniqueKeys: Array.isArray(d.selectedTechniqueKeys) ? d.selectedTechniqueKeys.slice(0) : [],
		sessionSystemPrompt: `${d.sessionSystemPrompt || ''}`,
		techniqueOptionOverrides: d.techniqueOptionOverrides && typeof d.techniqueOptionOverrides === 'object' ? JSON.parse(JSON.stringify(d.techniqueOptionOverrides)) : {},
		modelSelection: `${d.modelSelection || ''}`,
		thinkingLevel: `${d.thinkingLevel || ''}`,
		chatTemperature: d.chatTemperature === undefined ? null : d.chatTemperature,
		chatTopP: d.chatTopP === undefined ? null : d.chatTopP,
	};
}

// 从被删的 assistant 消息轨迹里收集可撤销动作(completed 且带 undo.actionId,未撤销过),新→旧
export function collectUndoActions(removedMessages){
	const out = [];
	(removedMessages || []).slice().sort((a, b)=>ts(b) - ts(a)).forEach((m)=>{
		const t = m && m.agentTrace;
		if(!t || !Array.isArray(t.rounds)){ return; }
		t.rounds.slice().reverse().forEach((r)=>{
			(r.results || []).slice().reverse().forEach((x)=>{
				if(x && x.status === 'completed' && x.undo && x.undo.actionId && !x.undone){ out.push({ actionId: x.undo.actionId, name: x.name, summary: x.summary || '', kind: x.undo.kind || '', messageId: m.id }); }
			});
		});
	});
	return out;
}

// 回退计划:target=用户消息;remove=它及其后所有消息;undoActions 来自被删 assistant;restore=它的 checkpoint;clearCompact=压缩点落在被删区
export function planRewind(messages, targetUserMessageId, compact){
	const list = (messages || []).slice().sort((a, b)=>ts(a) - ts(b));
	const idx = list.findIndex((m)=>m && m.id === targetUserMessageId);
	if(idx < 0){ return null; }
	const target = list[idx];
	if(target.role !== 'user'){ return null; }
	const remove = list.slice(idx);
	const undoActions = collectUndoActions(remove.filter((m)=>m.role === 'assistant'));
	const clearCompact = !!(compact && compact.uptoCreatedAt && ts({ createdAt: compact.uptoCreatedAt }) >= ts(target));
	return { targetId: target.id, remove: remove.map((m)=>m.id), removeCount: remove.length, undoActions, restore: target.checkpoint && typeof target.checkpoint === 'object' ? target.checkpoint : null, clearCompact };
}

// 用 checkpoint 恢复设置:只调存在的 setter;返回恢复了哪些字段
export function applyCheckpoint(checkpoint, setters){
	const cp = checkpoint || {}; const s = setters || {}; const done = [];
	const call = (fn, v, name)=>{ if(typeof fn === 'function'){ fn(v); done.push(name); } };
	if(cp.sourceId !== undefined){ call(s.setSelectedSourceId, cp.sourceId || '', 'sourceId'); }
	if(Array.isArray(cp.referenceIds)){ call(s.setReferenceIds, cp.referenceIds.slice(0), 'referenceIds'); }
	if(Array.isArray(cp.techniqueKeys)){ call(s.setSelectedTechniqueKeys, cp.techniqueKeys.slice(0), 'techniqueKeys'); }
	if(cp.sessionSystemPrompt !== undefined){ call(s.setSessionSystemPrompt, `${cp.sessionSystemPrompt || ''}`, 'sessionSystemPrompt'); }
	if(cp.techniqueOptionOverrides && typeof cp.techniqueOptionOverrides === 'object'){ call(s.setTechniqueOptionOverrides, cp.techniqueOptionOverrides, 'techniqueOptionOverrides'); }
	if(cp.modelSelection){ call(s.setModelSelection, cp.modelSelection, 'modelSelection'); }
	if(cp.thinkingLevel){ call(s.setThinkingLevel, cp.thinkingLevel, 'thinkingLevel'); }
	// [Q-032/M-47] 温度 / top_p:CHECKPOINT_FIELDS 早已声明、buildCheckpoint 也写了,但此前不恢复 = 只写不读。
	//   null 是合法值(=「默认,不下发」),故按 !== undefined 判,不能用真值判。
	if(cp.chatTemperature !== undefined){ call(s.setChatTemperature, cp.chatTemperature, 'chatTemperature'); }
	if(cp.chatTopP !== undefined){ call(s.setChatTopP, cp.chatTopP, 'chatTopP'); }
	return done;
}
