// AI 对话·压缩(A5;借鉴 Codex /compact、Claude Code /compact):把压缩点之前的对话压成一段摘要,之后只发「摘要层 + 压缩点之后的消息」。
// 数据:conversations.compact = { summary, uptoCreatedAt, coveredCount, model, inputHash, at };消息从不删除,取消压缩=清字段即恢复原样。
// 纯函数:压缩输入组装(工具结果折叠、封顶 24k、增量含前摘要)/ 主线视图 applyCompact / 摘要层(priority 88:资料后·检索前,非 volatile → 落缓存断点之前)。
import { foldToolResultContent } from '../aiAgent/protocol';

export const COMPACT_LAYER_KEY = 'compact-summary';
export const COMPACT_LAYER_PRIORITY = 88;
export const COMPACT_INPUT_MAX_CHARS = 24000;
export const COMPACT_SUMMARY_MAX_CHARS = 4000;
export const COMPACT_MIN_MESSAGES = 4;
export const COMPACT_SYSTEM = [
	'你是对话压缩器。把下面这段命理分析对话压成一段摘要,供后续对话作为「之前的对话摘要」使用。',
	'必须保留:① 关键判断与结论(含依据要点)② 命主事实(生辰/地点/关系/已确认的信息)③ 用户的约束与偏好(流派/口径/不要做什么)④ 未决问题 ⑤ 已经做过的动作(建档/改设置等)。',
	'去掉:寒暄、重复、过程性措辞。用要点式,不超过 600 字;不要编造对话里没有的内容;不要输出前言后语。',
].join('\n');

// [批二⑧] /compact <指令>:用户附加要求(≤300 字)追加在固定压缩规则之后——优先满足,但不得违背保留清单;空指令 = 与 COMPACT_SYSTEM 逐字相同(缺省零变化)
export const COMPACT_INSTRUCTION_MAX = 300;
export function buildCompactSystem(instruction){
	const ins = `${instruction || ''}`.replace(/\s+/g, ' ').trim().slice(0, COMPACT_INSTRUCTION_MAX);
	return ins ? `${COMPACT_SYSTEM}\n用户对这次压缩的附加要求(优先满足,但不得违背上面的保留清单):${ins}` : COMPACT_SYSTEM;
}

function hash32(str){
	let h = 0x811c9dc5;
	for(let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
	return h.toString(16).padStart(8, '0');
}

export function messageTime(m){
	const c = m && m.createdAt;
	if(typeof c === 'number'){ return c; }
	const t = Date.parse(c || '');
	return Number.isFinite(t) ? t : 0;
}

// 主线视图:压缩点(uptoCreatedAt)之后的消息;无压缩=原数组同引用(零变化)
export function applyCompact(list, compact){
	if(!Array.isArray(list) || !compact || !compact.uptoCreatedAt || !compact.summary){ return list; }
	const upto = messageTime({ createdAt: compact.uptoCreatedAt });
	return list.filter((m)=>messageTime(m) > upto);
}

// 摘要层(稳定层:落缓存断点之前;与 system/source 等同为非 volatile)
export function compactLayer(compact){
	if(!compact || !compact.summary){ return null; }
	return { key: COMPACT_LAYER_KEY, title: `之前的对话摘要(已压缩 ${compact.coveredCount || 0} 条)`, content: `${compact.summary}`.slice(0, COMPACT_SUMMARY_MAX_CHARS), priority: COMPACT_LAYER_PRIORITY };
}

// [Q-287/M-102 ④] 压缩输入里每条消息的截断:此前一律走工具折叠的 600 字上限、且只留开头 ——
//   长回答的**结论在末尾**,压缩摘要因此永远看不到结论(用户感觉「压完就忘了刚说定的事」)。
//   现在:工具结果信封仍按 600 字折叠(它的价值在 code/message/摘要,尾部无意义);
//   普通正文改「留头 + 留尾」,总量放到 1800 字,中间标注省略了多少。
export const COMPACT_MSG_HEAD_CHARS = 1200;
export const COMPACT_MSG_TAIL_CHARS = 600;
export function clipMessageForCompact(content){
	const t = `${content == null ? '' : content}`;
	const max = COMPACT_MSG_HEAD_CHARS + COMPACT_MSG_TAIL_CHARS;
	if(t.length <= max){ return t; }
	return `${t.slice(0, COMPACT_MSG_HEAD_CHARS)}…(中间省略 ${t.length - max} 字)…${t.slice(t.length - COMPACT_MSG_TAIL_CHARS)}`;
}
function isToolEnvelope(text){
	const s = `${text == null ? '' : text}`;
	if(s.indexOf('__horosaType') < 0){ return false; }
	try{ const o = JSON.parse(s); return !!(o && typeof o === 'object' && o.__horosaType === 'toolResult'); }catch(e){ return false; }
}
function foldSafe(content){
	const raw = `${content == null ? '' : content}`;
	if(isToolEnvelope(raw)){
		try{ const r = foldToolResultContent(raw, { maxChars: 600 }); return typeof r === 'string' ? r : raw; }
		catch(e){ return raw; }
	}
	return clipMessageForCompact(raw);
}

// 压缩输入:要压缩的消息(按时间序;工具结果折叠)+ 上次摘要(增量);封顶 maxChars(超出从最早的开始丢,记 dropped)
export function buildCompactInput(messages, opts){
	const o = opts || {};
	const cap = Number(o.maxChars) > 0 ? Number(o.maxChars) : COMPACT_INPUT_MAX_CHARS;
	const list = (messages || []).filter((m)=>m && (m.role === 'user' || m.role === 'assistant') && m.streamStatus !== 'streaming').slice().sort((a, b)=>messageTime(a) - messageTime(b));
	const lines = list.map((m)=>`${m.role === 'user' ? '用户' : '助手'}:${foldSafe(m.content).replace(/\s+/g, ' ').trim()}`);
	const prev = o.prevSummary ? `【上次摘要】\n${`${o.prevSummary}`.slice(0, COMPACT_SUMMARY_MAX_CHARS)}\n\n` : '';
	let budget = cap - prev.length;
	let dropped = 0;
	const kept = [];
	for(let i = lines.length - 1; i >= 0; i--){
		if(lines[i].length + 1 > budget){ dropped = i + 1; break; }
		kept.unshift(lines[i]); budget -= lines[i].length + 1;
	}
	const text = `${prev}【对话】\n${kept.join('\n')}`;
	return { text, count: list.length, kept: kept.length, dropped, uptoCreatedAt: list.length ? (list[list.length - 1].createdAt || null) : null, inputHash: hash32(text) };
}

// 压缩记录(落 conversations.compact)
export function compactRecord({ summary, uptoCreatedAt, coveredCount, model, inputHash }){
	const s = `${summary || ''}`.trim().slice(0, COMPACT_SUMMARY_MAX_CHARS);
	if(!s || !uptoCreatedAt){ return null; }
	return { summary: s, uptoCreatedAt, coveredCount: Number(coveredCount) || 0, model: `${model || ''}`, inputHash: `${inputHash || ''}`, at: new Date().toISOString() };
}

// 能否压缩:主线消息(压缩点之后)至少 COMPACT_MIN_MESSAGES 条
export function canCompact(list, compact){
	const live = applyCompact(list, compact).filter((m)=>m && (m.role === 'user' || m.role === 'assistant') && m.streamStatus !== 'streaming');
	return live.length >= COMPACT_MIN_MESSAGES;
}

// 自动提醒阈值(uiPrefs chatAssist.compactAutoTokens,缺省 null=不提醒;绝不自动花钱)
export function shouldSuggestCompact({ historyTokens, threshold }){
	const t = Number(threshold);
	if(!Number.isFinite(t) || t <= 0){ return false; }
	return Number(historyTokens) >= t;
}
