// AI 对话·事实记忆(A6;借鉴 ChatGPT / Claude 记忆):候选 → 用户确认 → 入库;按主体分组(你本人 / 某命主·事盘 / 全局);只在本机(workspace_meta,id 前缀 aimem:,随 AI 工作区备份;导出会话不带)。
// 三个开关全部缺省关:自动沉淀候选(零 LLM 正则启发式)/ 记忆注入(≤1500 字稳定层 priority 101)/「从本会话提炼」(点一次调一次模型)。
// 纪律:零 aiTools import;写库只经 aiAnalysisStore;记忆与排盘数据冲突时以排盘为准(指令里明写)。
import { AI_ANALYSIS_STORES, putStoreRecord, listStoreRecords, deleteStoreRecord } from '../aiAnalysisStore';
import { MEMORY_LAYER_KEY, MEMORY_LAYER_PRIORITY } from './persona';

export const MEMORY_ID_PREFIX = 'aimem:';
export const MEMORY_TEXT_MAX = 200;
export const MEMORY_CANDIDATE_MAX = 50;
export const MEMORY_DIRECTIVE_MAX = 1500;
export const MEMORY_SUBJECT_TYPES = ['user', 'chart', 'case', 'global'];
export const MEMORY_STATUSES = ['candidate', 'confirmed'];
export const MEMORY_EVENT = 'horosa:ai-memory-changed';
export const MEMORY_DIRECTIVE_TITLE = '【已确认的记忆（本机;与排盘数据冲突时以排盘为准）】';
export const MEMORY_EXTRACT_SYSTEM = [
	'你是记忆提炼器。从下面的对话里提炼出**用户明确说过的、以后对话仍然有用**的事实(关于用户本人、某位命主、或全局偏好),每条 ≤ 60 字。',
	'只输出一个 JSON:{"items":[{"subject":"user|chart|global","text":"…"}]};没有就 {"items":[]}。不要推测,不要把排盘结论当事实。',
].join('\n');

export function normalizeMemory(raw){
	const r = raw && typeof raw === 'object' ? raw : {};
	const subject = r.subject && typeof r.subject === 'object' ? r.subject : {};
	const type = MEMORY_SUBJECT_TYPES.indexOf(subject.type) >= 0 ? subject.type : 'global';
	return {
		...r,
		id: r.id && `${r.id}`.indexOf(MEMORY_ID_PREFIX) === 0 ? `${r.id}` : `${MEMORY_ID_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
		subject: { type, cid: type === 'chart' || type === 'case' ? `${subject.cid || ''}` : '' , title: `${subject.title || ''}`.slice(0, 60) },
		text: `${r.text || ''}`.replace(/\s+/g, ' ').trim().slice(0, MEMORY_TEXT_MAX),
		status: MEMORY_STATUSES.indexOf(r.status) >= 0 ? r.status : 'candidate',
		enabled: r.enabled !== false,
		source: `${r.source || 'manual'}`,
		createdAt: r.createdAt || new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
}

function emit(){ try{ if(typeof window !== 'undefined'){ window.dispatchEvent(new CustomEvent(MEMORY_EVENT)); } }catch(e){ /* noop */ } }
export function subscribeMemory(fn){ if(typeof window === 'undefined' || typeof fn !== 'function'){ return ()=>{}; } const h = ()=>fn(); window.addEventListener(MEMORY_EVENT, h); return ()=>window.removeEventListener(MEMORY_EVENT, h); }

export async function listMemories(){
	const all = (await listStoreRecords(AI_ANALYSIS_STORES.workspaceMeta)) || [];
	return all.filter((r)=>r && `${r.id || ''}`.indexOf(MEMORY_ID_PREFIX) === 0).map((r)=>normalizeMemory(r)).sort((a, b)=>`${b.updatedAt}`.localeCompare(`${a.updatedAt}`));
}

// 候选 FIFO 50:超出丢最旧候选;同文(同主体)不重复
export async function addCandidates(items, source){
	const existing = await listMemories();
	const out = [];
	for(let i = 0; i < (items || []).length; i++){
		const it = normalizeMemory({ ...(items[i] || {}), status: 'candidate', source: source || (items[i] && items[i].source) || 'heuristic' });
		if(!it.text){ continue; }
		const dup = existing.concat(out).find((m)=>m.text === it.text && m.subject.type === it.subject.type && m.subject.cid === it.subject.cid);
		if(dup){ continue; }
		// eslint-disable-next-line no-await-in-loop
		out.push(await putStoreRecord(AI_ANALYSIS_STORES.workspaceMeta, { ...it, key: it.id }, 'aimem'));
	}
	const cands = existing.filter((m)=>m.status === 'candidate').concat(out).sort((a, b)=>`${a.createdAt}`.localeCompare(`${b.createdAt}`));
	while(cands.length > MEMORY_CANDIDATE_MAX){ const old = cands.shift(); /* eslint-disable-next-line no-await-in-loop */ await deleteStoreRecord(AI_ANALYSIS_STORES.workspaceMeta, old.id); }
	if(out.length){ emit(); }
	return out;
}

export async function saveMemory(mem){
	const rec = normalizeMemory(mem);
	const saved = await putStoreRecord(AI_ANALYSIS_STORES.workspaceMeta, { ...rec, key: rec.id }, 'aimem');
	emit();
	return saved;
}
export async function confirmMemory(id, patch){ const all = await listMemories(); const m = all.find((x)=>x.id === id); if(!m){ return null; } return saveMemory({ ...m, ...(patch || {}), status: 'confirmed' }); }
export async function toggleMemory(id, enabled){ const all = await listMemories(); const m = all.find((x)=>x.id === id); if(!m){ return null; } return saveMemory({ ...m, enabled: enabled !== false }); }
export async function deleteMemory(id){ await deleteStoreRecord(AI_ANALYSIS_STORES.workspaceMeta, id); emit(); return true; }
export async function discardCandidate(id){ return deleteMemory(id); }

// 零 LLM 启发式:我是/我叫/我今年/我的…是 → user;我妻子/丈夫/儿子/女儿/父母/老板… → user(关系事实);以后都/不要再/记住/别再 → global 偏好
const HEURISTICS = [
	{ re: /(?:^|[,,。;;\s])(我(?:是|叫|今年|属|生于|住在|在.{1,8}工作|做.{1,8}的)[^,,。;;!!??\n]{1,60})/g, type: 'user', conf: 0.7 },
	{ re: /(?:^|[,,。;;\s])(我(?:的)?(?:妻子|老婆|丈夫|老公|儿子|女儿|父亲|母亲|爸爸|妈妈|哥哥|姐姐|弟弟|妹妹|老板|搭档|合伙人)[^,,。;;!!??\n]{1,60})/g, type: 'user', conf: 0.65 },
	{ re: /(?:^|[,,。;;\s])((?:以后都|以后一律|记住|请记住|别再|不要再|从今以后)[^,,。;;!!??\n]{2,60})/g, type: 'global', conf: 0.75 },
];
export function extractCandidatesHeuristic(text){
	const s = `${text == null ? '' : text}`;
	const out = [];
	if(!s.trim() || s.length > 4000){ return out; }
	HEURISTICS.forEach((h)=>{
		h.re.lastIndex = 0;
		let m;
		while((m = h.re.exec(s))){
			const t = `${m[1]}`.trim();
			if(t.length >= 4 && !out.some((x)=>x.text === t)){ out.push({ text: t, subject: { type: h.type }, confidence: h.conf, source: 'heuristic' }); }
			if(out.length >= 6){ break; }
		}
	});
	return out;
}

// 注入指令:当前命主 + 你本人 + 全局 的已确认且启用的记忆;封顶 1500 字(超出从最旧的丢)
export function buildMemoryDirective(memories, { subjectCid } = {}){
	const list = (memories || []).filter((m)=>m && m.status === 'confirmed' && m.enabled !== false && m.text)
		.filter((m)=>m.subject.type === 'user' || m.subject.type === 'global' || ((m.subject.type === 'chart' || m.subject.type === 'case') && subjectCid && m.subject.cid === subjectCid))
		.sort((a, b)=>`${b.updatedAt}`.localeCompare(`${a.updatedAt}`));
	const label = (m)=>(m.subject.type === 'user' ? '本人' : (m.subject.type === 'global' ? '全局' : (m.subject.title || '命主')));
	const lines = [];
	let used = 0;
	for(let i = 0; i < list.length; i++){
		const line = `- [${label(list[i])}] ${list[i].text}`;
		if(used + line.length + 1 > MEMORY_DIRECTIVE_MAX){ break; }
		lines.push(line); used += line.length + 1;
	}
	return lines.join('\n');
}

export function memoryLayer(memories, opts){
	const content = buildMemoryDirective(memories, opts);
	if(!content){ return null; }
	return { key: MEMORY_LAYER_KEY, title: MEMORY_DIRECTIVE_TITLE, content, priority: MEMORY_LAYER_PRIORITY };
}

// 「从本会话提炼」的 JSON 结果 → 候选项
export function candidatesFromExtraction(parsed, { subjectCid, subjectTitle } = {}){
	const items = parsed && Array.isArray(parsed.items) ? parsed.items : [];
	return items.map((it)=>{
		if(!it || !it.text){ return null; }
		const type = it.subject === 'user' ? 'user' : (it.subject === 'chart' && subjectCid ? 'chart' : 'global');
		return { text: `${it.text}`, subject: { type, cid: type === 'chart' ? subjectCid : '', title: type === 'chart' ? subjectTitle || '' : '' }, source: 'extract' };
	}).filter(Boolean).slice(0, 20);
}
