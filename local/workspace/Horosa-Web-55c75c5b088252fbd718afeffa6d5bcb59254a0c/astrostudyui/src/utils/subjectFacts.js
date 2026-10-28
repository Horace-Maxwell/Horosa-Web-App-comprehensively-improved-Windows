// 命主实况:用户本人为某张命盘填写的真实情况(命盘列表「命主实况」问卷 + 档案的断事日志),整理成给 AI 的一段正文。
// 纯函数单源:对话页(useChatAssist.promptLayerExtras)、无头轮(goalRunner.headlessLayerExtras)、AI 导出(prefs.subjectFacts)、
// 外部客户端读档案详情(get_record_detail)都从这里取,口径一致。
// 发不发按命盘分:键 horosa.ai.subjectFacts.v1 = { bySubject:{[cid]:true} };缺省一张都不发 —— 关着时对话 / 无头 / 导出的内容逐字节不变。
// 只有已存档的命盘有(sourceType === 'chart' 且记录带 cid);事盘、即时起盘、起课时间都没有。
import { FATE_EVENT_GROUPS, readLocalFateValues, FATE_EVENTS_CHANGED_EVENT } from './localdeeplearn';
import { getLocalChart } from './localcharts';
import { safeJsonParseFromStorage, safeJsonStringifyToStorage, safeLocalStorageRemove, noteSettingNotSaved } from './safeStorage';

export const SUBJECT_FACTS_KEY = 'horosa.ai.subjectFacts.v1';
export const SUBJECT_FACTS_PREFS_EVENT = 'horosa:subject-facts-prefs-changed';
export { FATE_EVENTS_CHANGED_EVENT };
export const SUBJECT_FACTS_LAYER_KEY = 'subject-facts';
export const SUBJECT_FACTS_TITLE = '命主实况';
// 介于案例前提(95)与排盘规则(94)之间:紧跟本人的盘面数据,属稳定层(不随问题变,吃前缀缓存)
export const SUBJECT_FACTS_PRIORITY = 94.8;
export const SUBJECT_FACTS_JOURNAL_MAX = 20;
export const SUBJECT_FACTS_JOURNAL_CHARS = 400;
export const SUBJECT_FACTS_TEXT_MAX = 8000;
export const SUBJECT_FACTS_ENTRIES_MAX = 2000;
export const SUBJECT_FACTS_INTRO = '以下是用户本人填写的命主真实情况。分析时用来核对、校准盘面判断;不要复述其中的隐私细节,除非用户问到。';

// 截断口径与外部读档案详情同一份:超长 → 前 n 字 + 「…[截断,原 N 字]」
export function clipText(s, n){
	const t = `${s == null ? '' : s}`;
	return t.length > n ? `${t.slice(0, n)}…[截断,原 ${t.length} 字]` : t;
}

const EMPTY = Object.freeze({ items: [], count: 0, text: '' });

// ---- 发送开关(按命盘) ----
function cleanBySubject(raw){
	const out = {};
	if(!raw || typeof raw !== 'object' || Array.isArray(raw)){ return out; }
	Object.keys(raw).slice(0, SUBJECT_FACTS_ENTRIES_MAX).forEach((k)=>{
		if(!Object.prototype.hasOwnProperty.call(raw, k) || k === '__proto__' || k === 'constructor' || k === 'prototype' || !k){ return; }
		if(raw[k] === true){ out[k] = true; }
	});
	return out;
}
export function normalizeSubjectFactsPrefs(raw){
	const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
	return { bySubject: cleanBySubject(r.bySubject) };
}
export function readSubjectFactsPrefs(){ return normalizeSubjectFactsPrefs(safeJsonParseFromStorage(SUBJECT_FACTS_KEY)); }
export function isSubjectFactsEnabled(cid){
	const id = `${cid == null ? '' : cid}`;
	return !!(id && readSubjectFactsPrefs().bySubject[id] === true);
}
function emitPrefs(prefs){
	try{ if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){ window.dispatchEvent(new CustomEvent(SUBJECT_FACTS_PREFS_EVENT, { detail: prefs })); } }catch(e){ /* noop */ }
}
// 开 / 关一张命盘;全关 = 删键(与从未设置同形)。回存储里实际的偏好:没写进(存储满)→ 不改、按实际值广播并提示没能保存
export function setSubjectFactsEnabled(cid, on){
	const id = `${cid == null ? '' : cid}`;
	const cur = readSubjectFactsPrefs();
	if(!id){ return cur; }
	if(on){ cur.bySubject[id] = true; }else{ delete cur.bySubject[id]; }
	let ok = true;
	if(!Object.keys(cur.bySubject).length){ safeLocalStorageRemove(SUBJECT_FACTS_KEY); }
	else{ ok = safeJsonStringifyToStorage(SUBJECT_FACTS_KEY, cur) === true; }
	const out = ok ? cur : readSubjectFactsPrefs();
	if(!ok){ noteSettingNotSaved(SUBJECT_FACTS_KEY); }
	emitPrefs(out);
	return out;
}
// 订阅:发送开关变了 / 问卷保存了 / 档案变了 / 别的窗口改了存储 → 回调(调用方自行重读)
export function subscribeSubjectFacts(fn){
	if(typeof window === 'undefined' || typeof fn !== 'function'){ return ()=>{}; }
	const h = ()=>fn();
	const sh = (e)=>{ const k = e && e.key != null ? `${e.key}` : ''; if(!k || k === SUBJECT_FACTS_KEY || k === 'HorosaLocalDeepLearn'){ fn(); } };
	window.addEventListener(SUBJECT_FACTS_PREFS_EVENT, h);
	window.addEventListener(FATE_EVENTS_CHANGED_EVENT, h);
	window.addEventListener('horosa:records-changed', h);
	window.addEventListener('storage', sh);
	return ()=>{
		window.removeEventListener(SUBJECT_FACTS_PREFS_EVENT, h);
		window.removeEventListener(FATE_EVENTS_CHANGED_EVENT, h);
		window.removeEventListener('horosa:records-changed', h);
		window.removeEventListener('storage', sh);
	};
}

// ---- 取数 ----
// 挂载源 → 命盘 cid:只认已存档的命盘(即时起盘的「命盘时间」源记录没有 cid)
export function subjectFactsCid(source){
	if(!source || source.sourceType !== 'chart' || !source.record){ return ''; }
	return source.record.cid ? `${source.record.cid}` : '';
}
// 记录(或挂载源)→ 本机库里的最新那条(断事日志以库里为准);库里没有就用传进来的
function resolveChartRecord(input){
	if(!input || typeof input !== 'object'){ return null; }
	let rec = input;
	if(input.sourceType !== undefined){
		if(!subjectFactsCid(input)){ return null; }
		rec = input.record;
	}
	if(!rec || !rec.cid){ return null; }
	if(rec.caseType || (rec.divTime && !rec.birth)){ return null; }   // 事盘
	let fresh = null;
	try{ fresh = getLocalChart(rec.cid); }catch(e){ fresh = null; }
	return fresh && fresh.cid === rec.cid ? fresh : rec;
}

// 问卷:是 / 否题只发答「是」的(「否」与没填分不出);数值题只发不等于缺省的(年龄类缺省 100 = 未发生)
function questionnaireGroups(cid){
	const saved = readLocalFateValues(cid);
	if(!saved){ return []; }
	const groups = [];
	FATE_EVENT_GROUPS.forEach((g)=>{
		const vals = saved[`Val${g.id}`];
		if(!vals || typeof vals !== 'object'){ return; }
		const entries = [];
		Object.keys(g.events || {}).forEach((id)=>{
			const cfg = g.events[id];
			if(!cfg || !Object.prototype.hasOwnProperty.call(vals, id)){ return; }
			const raw = vals[id];
			if(raw === undefined || raw === null || raw === ''){ return; }
			const n = Number(raw);
			if(!Number.isFinite(n)){ return; }
			const def = Number(cfg.defval !== undefined ? cfg.defval : 0);
			if(cfg.type === 0){
				if(n === 1){ entries.push({ id, label: `${cfg.label}`, value: 1, display: '是' }); }
				return;
			}
			if(cfg.type === 1 && n !== def){ entries.push({ id, label: `${cfg.label}`, value: n, display: `${n}` }); }
		});
		if(entries.length){ groups.push({ key: `questionnaire:${g.id}`, kind: 'questionnaire', title: g.title, total: entries.length, entries }); }
	});
	return groups;
}

// 断事日志:档案上的 journal(新在前),条数与每条字数封顶
function journalGroup(rec){
	const list = (Array.isArray(rec && rec.journal) ? rec.journal : []).filter((j)=>j && `${j.text || ''}`.trim());
	if(!list.length){ return null; }
	const entries = list.slice(0, SUBJECT_FACTS_JOURNAL_MAX).map((j)=>({ at: `${j.at || ''}`, text: clipText(`${j.text}`.trim(), SUBJECT_FACTS_JOURNAL_CHARS) }));
	return { key: 'journal', kind: 'journal', title: '断事日志', total: list.length, entries };
}

// 另挂的分组(排在问卷之后、断事日志之前);每项 (rec) → 分组或 null
const EXTRA_GROUP_BUILDERS = [];


function groupLines(g){
	const head = g.total > g.entries.length ? `[${SUBJECT_FACTS_TITLE}·${g.title}](共 ${g.total} 条,只列最近 ${g.entries.length} 条)` : `[${SUBJECT_FACTS_TITLE}·${g.title}]`;
	if(g.kind === 'journal'){ return [`${head}(新在前)`, ...g.entries.map((e)=>`${e.at ? `${e.at}：` : ''}${e.text}`)]; }
	return [head, ...g.entries.map((e)=>`${e.label}：${e.display}`)];
}

// 记录(或挂载源)→ { items:分组, count:问卷项 + 其余各组条数(按总数,不按封顶后), text:给 AI 的正文 };没有 → 全空
export function buildSubjectFacts(input){
	const rec = resolveChartRecord(input);
	if(!rec){ return EMPTY; }
	const items = questionnaireGroups(rec.cid);
	EXTRA_GROUP_BUILDERS.forEach((build)=>{
		let g = null;
		try{ g = build(rec); }catch(e){ g = null; }
		if(g && g.entries && g.entries.length){ items.push(g); }
	});
	const j = journalGroup(rec);
	if(j){ items.push(j); }
	if(!items.length){ return EMPTY; }
	const count = items.reduce((n, g)=>n + (g.total || g.entries.length), 0);
	const body = [SUBJECT_FACTS_INTRO];
	items.forEach((g)=>{ body.push(groupLines(g).join('\n')); });
	return { items, count, text: clipText(body.join('\n'), SUBJECT_FACTS_TEXT_MAX) };
}

// 挂载源的预览(界面用):{ cid, enabled, facts };不是已存命盘 → cid 空、facts 空
export function subjectFactsPreview(source){
	const cid = subjectFactsCid(source);
	if(!cid){ return { cid: '', enabled: false, facts: EMPTY }; }
	return { cid, enabled: isSubjectFactsEnabled(cid), facts: buildSubjectFacts(source) };
}

// 对话 / 无头轮的稳定层:这张盘开了发送且有内容才产层;关着时连问卷都不读(上下文逐字节不变)
export function subjectFactsLayer(source){
	const cid = subjectFactsCid(source);
	if(!cid || !isSubjectFactsEnabled(cid)){ return null; }
	const facts = buildSubjectFacts(source);
	if(!facts.count || !facts.text){ return null; }
	const name = `${(source && source.title) || ''}`.replace(/\s+/g, ' ').trim();
	return { key: SUBJECT_FACTS_LAYER_KEY, title: name ? `${SUBJECT_FACTS_TITLE}：${name}` : SUBJECT_FACTS_TITLE, priority: SUBJECT_FACTS_PRIORITY, content: facts.text };
}
