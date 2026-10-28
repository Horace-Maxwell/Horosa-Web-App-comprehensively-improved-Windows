// AI 对话·本轮请求(纯):命令 / 技能产出,随发送显式交给页面发送口(handleSend 第三参),并随用户消息落库(重答 / 重试照样还原)。
// 此前技能先 setSelectedTechniqueKeys 改页面状态、再等一拍读最新的发送函数:时序耦合,而且技能带的技法会永久替换会话挂载
// (/流年 之后用户原来挂的西洋盘就悄悄没了)。现在技能的技法只作用本轮;要留下来,在气泡上点「保留为挂载」。
// 形状:{ command?: { name, label, argsText }, techniqueKeys?: string[](只作用本轮), partnerSourceId?: string(本轮的合盘对方,页面状态下一拍才更新时先按它) }
// 缺省 / 全空 = null(发送口按 null 走此前路径,逐字节不变)。
export const TURN_TECHNIQUE_MAX = 12;

const cleanText = (v, n)=>`${v == null ? '' : v}`.replace(/\s+/g, ' ').trim().slice(0, n);

export function normalizeTurnRequest(raw){
	if(!raw || typeof raw !== 'object' || Array.isArray(raw)){ return null; }
	const out = {};
	if(raw.command && typeof raw.command === 'object'){
		const name = cleanText(raw.command.name, 32);
		if(name){
			out.command = { name, label: cleanText(raw.command.label, 40) || name, argsText: cleanText(raw.command.argsText, 200) };
		}
	}
	if(Array.isArray(raw.techniqueKeys)){
		const keys = Array.from(new Set(raw.techniqueKeys.map((k)=>`${k == null ? '' : k}`.trim()).filter(Boolean))).slice(0, TURN_TECHNIQUE_MAX);
		if(keys.length){ out.techniqueKeys = keys; }
	}
	const pid = cleanText(raw.partnerSourceId, 80);
	if(pid){ out.partnerSourceId = pid; }
	return Object.keys(out).length ? out : null;
}

// 本轮实际挂的技法:本轮给了就用本轮的(按当前案例可挂集过滤、保持本轮顺序);没给 = 会话挂载
export function turnTechniqueKeysFor(turn, sessionKeys, allowedKeys){
	const own = turn && Array.isArray(turn.techniqueKeys) && turn.techniqueKeys.length ? turn.techniqueKeys : null;
	if(!own){ return { keys: Array.isArray(sessionKeys) ? sessionKeys : [], turnOnly: false }; }
	const allowed = Array.isArray(allowedKeys) ? new Set(allowedKeys) : null;
	const keys = own.filter((k)=>!allowed || allowed.has(k));
	return { keys, turnOnly: true };
}

// 对话标题 / 气泡芯片的命令文字:「流年 2027」;不是命令 = ''
export function turnCommandText(turn){
	const c = turn && turn.command;
	if(!c || !c.name){ return ''; }
	return `${c.label || c.name}${c.argsText ? ` ${c.argsText}` : ''}`;
}

// 两组技法是否同一组(顺序无关):本轮技法与会话挂载相同时气泡上不必再给「保留为挂载」
export function sameTechniqueSet(a, b){
	const x = Array.isArray(a) ? Array.from(new Set(a)).sort() : [];
	const y = Array.isArray(b) ? Array.from(new Set(b)).sort() : [];
	return x.length === y.length && x.every((k, i)=>k === y[i]);
}
