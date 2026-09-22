// AI 助手·行动能力偏好(总开关/审批档/类别收紧/信任档案/外部客户端档)。总开关默认关:仅字符串 '1' 视为开,缺省/其它一律关。
// 这是产品拍板而非实现细节——关=完全现状路径(请求体无 tools、无规则块、无动作条、外部桥不挂)。
// 审批三档:never=全自动(可撤销)/ on-request=每次确认 / read-only=禁止一切写入(只读档);类别档只能比总档更严。
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove, safeJsonParseFromStorage, safeJsonStringifyToStorage } from '../safeStorage';
import { TOOL_CATEGORIES, TOOL_NAME_PATTERN } from '../aiTools/catalog';

export const AGENT_ENABLED_KEY = 'horosa.ai.agent.enabled';
export const AGENT_APPROVAL_KEY = 'horosa.ai.agent.approval';
export const AGENT_APPROVAL_CATEGORIES_KEY = 'horosa.ai.agent.approval.categories.v1';
export const AGENT_TRUSTED_RECORDS_KEY = 'horosa.ai.agent.trust.records.v1';
export const AGENT_EXTERNAL_POLICY_KEY = 'horosa.ai.agent.external.policy.v1';
export const AGENT_GOAL_ENABLED_KEY = 'horosa.ai.tasks.goal.enabled';   // 目标任务(P2)子开关:'1' 才开;缺省关=零路径
export const AGENT_ORCH_ENABLED_KEY = 'horosa.ai.orchestrate.enabled';   // 多技法编排(C7)子开关:'1' 才开;缺省关=/编排 只提示不发请求
export const AGENT_EXTERNAL_TOOLS_KEY = 'horosa.ai.tools.external.enabled';   // 外部 MCP 服务器工具总开关(P6):'1' 才开;关=一个 ext_ 工具都不注册
export const AGENT_WEB_SEARCH_KEY = 'horosa.ai.tools.webSearch.enabled';   // 联网检索(P7)总开关:'1' 才开;关=web_search 不进目录、零出站
export const AGENT_WEB_FETCH_KEY = 'horosa.ai.tools.webFetch.enabled';   // [批三①] 网页读取(出站③)总开关:'1' 才开;关=web_fetch 不进目录、零出站
export const AGENT_HEADLESS_KEY = 'horosa.ai.tools.headless.enabled';   // [批三③] 无头分析出口(run_analysis,只经本机 MCP):'1' 才开;关=不进任何目录
export const AGENT_GOAL_PARALLEL_KEY = 'horosa.ai.tasks.goal.parallel';   // [批三⑤] 目标任务并行上限:0=现状(不排队不限),1..3=同时最多几条,其余排队
export const AGENT_GOAL_PARALLEL_MAX = 3;
export const AGENT_AUTOMATION_KEY = 'horosa.ai.automation.enabled';   // 自动化规则(P4)总开关:'1' 才开;关=事件照发但引擎零动作
export const AGENT_SCHEDULER_ENABLED_KEY = 'horosa.ai.tasks.scheduler.enabled';   // 定时任务(P3)子开关:'1' 才开;缺省关=零定时器零执行
export const AGENT_APPROVAL_MODES = ['never', 'on-request', 'read-only'];   // never=全自动可撤销 / on-request=每次确认 / read-only=只读
export const AGENT_APPROVAL_CATEGORY_MODES = ['inherit', 'never', 'on-request', 'read-only'];
// 类别单源 = 工具目录 TOOL_CATEGORIES(此前这里少了 interactive:反问类工具在类别档上无处收紧)
export const AGENT_APPROVAL_CATEGORIES = TOOL_CATEGORIES.slice();
// [批二②] 按工具名放行/禁用:{ allow:[name], deny:[name] };deny 任何级别都拒且不进工具目录,allow 只对写入类免逐次确认(只读档仍拒)
export const AGENT_TOOL_POLICY_KEY = 'horosa.ai.agent.toolPolicy.v1';
export const AGENT_TOOL_POLICY_MAX = 64;
export const AGENT_EXTERNAL_APPROVALS = ['auto', 'on-request', 'read-only'];
export const AGENT_TRUSTED_RECORDS_MAX = 200;
export const AGENT_PREFS_EVENT = 'horosa:agent-prefs-changed';

export function isAgentEnabled(){
	return safeLocalStorageGet(AGENT_ENABLED_KEY) === '1';
}

function emit(){
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){
			window.dispatchEvent(new CustomEvent(AGENT_PREFS_EVENT, { detail: { enabled: isAgentEnabled(), approval: getAgentApprovalMode(), categories: getAgentApprovalCategories(), trustedRecords: getTrustedRecords(), toolPolicy: getToolPolicy(), external: getExternalPolicy() } }));
		}
	}catch(e){ /* noop */ }
}

export function setAgentEnabled(on){
	safeLocalStorageSet(AGENT_ENABLED_KEY, on ? '1' : '0');
	emit();
	return isAgentEnabled();
}

export function getAgentApprovalMode(){
	const v = safeLocalStorageGet(AGENT_APPROVAL_KEY);
	return AGENT_APPROVAL_MODES.indexOf(v) >= 0 ? v : 'never';
}

export function setAgentApprovalMode(mode){
	if(AGENT_APPROVAL_MODES.indexOf(mode) < 0){ return false; }
	safeLocalStorageSet(AGENT_APPROVAL_KEY, mode);
	emit();
	return true;
}

// 按类别收紧:缺键/坏值一律 inherit(= 跟随总档)。只保留合法类别与合法档位。
export function getAgentApprovalCategories(){
	const raw = safeJsonParseFromStorage(AGENT_APPROVAL_CATEGORIES_KEY);
	const out = {};
	AGENT_APPROVAL_CATEGORIES.forEach((c)=>{
		const v = raw && typeof raw === 'object' ? raw[c] : undefined;
		out[c] = AGENT_APPROVAL_CATEGORY_MODES.indexOf(v) >= 0 ? v : 'inherit';
	});
	return out;
}

export function setAgentApprovalCategory(category, mode){
	if(AGENT_APPROVAL_CATEGORIES.indexOf(category) < 0 || AGENT_APPROVAL_CATEGORY_MODES.indexOf(mode) < 0){ return false; }
	const next = { ...getAgentApprovalCategories(), [category]: mode };
	try{ safeJsonStringifyToStorage(AGENT_APPROVAL_CATEGORIES_KEY, next); }catch(e){ return false; }
	emit();
	return true;
}

// 信任的档案(cid 列表):对这些命盘的载入/查询类写入免逐次确认;建档、改设置永远不因信任放行(判定在 approvalPolicy)。
export function getTrustedRecords(){
	const raw = safeJsonParseFromStorage(AGENT_TRUSTED_RECORDS_KEY);
	if(!Array.isArray(raw)){ return []; }
	return Array.from(new Set(raw.filter((x)=>typeof x === 'string' && x).map((x)=>`${x}`))).slice(0, AGENT_TRUSTED_RECORDS_MAX);
}

export function setTrustedRecords(list){
	const next = Array.from(new Set((Array.isArray(list) ? list : []).filter((x)=>typeof x === 'string' && x))).slice(0, AGENT_TRUSTED_RECORDS_MAX);
	try{ safeJsonStringifyToStorage(AGENT_TRUSTED_RECORDS_KEY, next); }catch(e){ return getTrustedRecords(); }
	emit();
	return next;
}

// 外部客户端(本机 MCP 服务的调用方)档:缺省 auto=现状(令牌持有者=受信本机进程,不过审批档、不限额)。
export const DEFAULT_EXTERNAL_POLICY = Object.freeze({ approval: 'auto', maxCallsPerMinute: 60, maxAdditivePerHour: 100 });
function clampInt(v, min, max, d){
	const n = Number(v);
	if(!Number.isFinite(n)){ return d; }
	return Math.min(max, Math.max(min, Math.round(n)));
}
export function getExternalPolicy(){
	const raw = safeJsonParseFromStorage(AGENT_EXTERNAL_POLICY_KEY);
	const r = raw && typeof raw === 'object' ? raw : {};
	return {
		approval: AGENT_EXTERNAL_APPROVALS.indexOf(r.approval) >= 0 ? r.approval : DEFAULT_EXTERNAL_POLICY.approval,
		maxCallsPerMinute: clampInt(r.maxCallsPerMinute, 1, 600, DEFAULT_EXTERNAL_POLICY.maxCallsPerMinute),
		maxAdditivePerHour: clampInt(r.maxAdditivePerHour, 0, 10000, DEFAULT_EXTERNAL_POLICY.maxAdditivePerHour),
	};
}

export function setExternalPolicy(partial){
	const next = { ...getExternalPolicy(), ...(partial && typeof partial === 'object' ? partial : {}) };
	const norm = {
		approval: AGENT_EXTERNAL_APPROVALS.indexOf(next.approval) >= 0 ? next.approval : DEFAULT_EXTERNAL_POLICY.approval,
		maxCallsPerMinute: clampInt(next.maxCallsPerMinute, 1, 600, DEFAULT_EXTERNAL_POLICY.maxCallsPerMinute),
		maxAdditivePerHour: clampInt(next.maxAdditivePerHour, 0, 10000, DEFAULT_EXTERNAL_POLICY.maxAdditivePerHour),
	};
	try{ safeJsonStringifyToStorage(AGENT_EXTERNAL_POLICY_KEY, norm); }catch(e){ return getExternalPolicy(); }
	emit();
	return norm;
}

// [进阶审计 D2] 恢复缺省 = 删键(与「从未设置」同形;缺省路径不留键)。
export function clearExternalPolicy(){
	safeLocalStorageRemove(AGENT_EXTERNAL_POLICY_KEY);
	emit();
	return getExternalPolicy();
}

export function isGoalEnabled(){
	return safeLocalStorageGet(AGENT_GOAL_ENABLED_KEY) === '1';
}

export function setGoalEnabled(on){
	safeLocalStorageSet(AGENT_GOAL_ENABLED_KEY, on ? '1' : '0');
	emit();
}

// 多技法编排(C7)子开关:'1' 才开;关=/编排 只提示不发任何请求(零路径)
export function isOrchestrateEnabled(){
	return safeLocalStorageGet(AGENT_ORCH_ENABLED_KEY) === '1';
}

export function setOrchestrateEnabled(on){
	safeLocalStorageSet(AGENT_ORCH_ENABLED_KEY, on ? '1' : '0');
	emit();
	return isOrchestrateEnabled();
}

// 外部 MCP 服务器工具(P6)总开关:'1' 才开;关 = 已注册的 ext_ 工具 enabled() 为假(不进 manifest、调用即 E_TOOL_DISABLED)
export function isExternalToolsEnabled(){
	return safeLocalStorageGet(AGENT_EXTERNAL_TOOLS_KEY) === '1';
}

export function setExternalToolsEnabled(on){
	safeLocalStorageSet(AGENT_EXTERNAL_TOOLS_KEY, on ? '1' : '0');
	emit();
	return isExternalToolsEnabled();
}

// 联网检索(P7)总开关:'1' 才开;关 = web_search 工具 enabled() 为假(不进 manifest、调用即 E_TOOL_DISABLED),零出站
export function isWebSearchEnabled(){
	return safeLocalStorageGet(AGENT_WEB_SEARCH_KEY) === '1';
}

export function setWebSearchEnabled(on){
	safeLocalStorageSet(AGENT_WEB_SEARCH_KEY, on ? '1' : '0');
	emit();
	return isWebSearchEnabled();
}

// [批三①] 网页读取(出站③)总开关:'1' 才开;关 = web_fetch 工具 enabled() 为假(不进 manifest、调用即 E_TOOL_DISABLED),零出站
export function isWebFetchEnabled(){
	return safeLocalStorageGet(AGENT_WEB_FETCH_KEY) === '1';
}

export function setWebFetchEnabled(on){
	safeLocalStorageSet(AGENT_WEB_FETCH_KEY, on ? '1' : '0');
	emit();
	return isWebFetchEnabled();
}

// [批三③] 无头分析出口总开关:'1' 才开;关 = run_analysis 不进任何目录(含 MCP)
export function isHeadlessEnabled(){
	return safeLocalStorageGet(AGENT_HEADLESS_KEY) === '1';
}

export function setHeadlessEnabled(on){
	safeLocalStorageSet(AGENT_HEADLESS_KEY, on ? '1' : '0');
	emit();
	return isHeadlessEnabled();
}

// [批三⑤] 目标任务并行上限:0=现状(起跑即跑,不限不排队);1..3=同时最多几条,超出的保持 queued,前一条结束自动起下一条
export function getGoalParallel(){
	const n = Number(safeLocalStorageGet(AGENT_GOAL_PARALLEL_KEY));
	return Number.isFinite(n) && n >= 1 ? Math.min(AGENT_GOAL_PARALLEL_MAX, Math.round(n)) : 0;
}

export function setGoalParallel(n){
	const v = Number(n);
	if(!Number.isFinite(v) || v < 1){ safeLocalStorageRemove(AGENT_GOAL_PARALLEL_KEY); }
	else{ safeLocalStorageSet(AGENT_GOAL_PARALLEL_KEY, `${Math.min(AGENT_GOAL_PARALLEL_MAX, Math.round(v))}`); }
	emit();
	return getGoalParallel();
}

// 自动化规则(P4)总开关:'1' 才开;关 = 引擎收到事件也零动作(规则表可以先建好再打开)
export function isAutomationEnabled(){
	return safeLocalStorageGet(AGENT_AUTOMATION_KEY) === '1';
}

export function setAutomationEnabled(on){
	safeLocalStorageSet(AGENT_AUTOMATION_KEY, on ? '1' : '0');
	emit();
	return isAutomationEnabled();
}

export function normalizeToolPolicy(raw){
	const pick = (list)=>{
		const out = [];
		(Array.isArray(list) ? list : []).forEach((x)=>{ const n = `${x == null ? '' : x}`.trim(); if(TOOL_NAME_PATTERN.test(n) && out.indexOf(n) < 0 && out.length < AGENT_TOOL_POLICY_MAX){ out.push(n); } });
		return out;
	};
	const o = raw && typeof raw === 'object' ? raw : {};
	const deny = pick(o.deny);
	const allow = pick(o.allow).filter((n)=>deny.indexOf(n) < 0);   // 同名同时出现:禁用优先
	return { allow, deny };
}
export function getToolPolicy(){
	return normalizeToolPolicy(safeJsonParseFromStorage(AGENT_TOOL_POLICY_KEY));
}
export function setToolPolicy(partial){
	const cur = getToolPolicy();
	const next = normalizeToolPolicy({ ...cur, ...(partial && typeof partial === 'object' ? partial : {}) });
	try{ safeJsonStringifyToStorage(AGENT_TOOL_POLICY_KEY, next); }catch(e){ return cur; }
	emit();
	return next;
}

// 跨窗口同步:另一个窗口写了任一 horosa.ai.* 键(storage 事件只在**其它**窗口触发)→ 本窗口重发 AGENT_PREFS_EVENT,订阅方按需重读。幂等绑定。
let crossWindowBound = false;
export function bindCrossWindowPrefs(){
	if(typeof window === 'undefined' || typeof window.addEventListener !== 'function' || crossWindowBound){ return ()=>{}; }
	crossWindowBound = true;
	// 只认本模块管的键(不写前缀字面:注册表穷举哨兵会把半截键当未登记键);key 为空 = 整个 storage 被清也重发
	const mine = [AGENT_ENABLED_KEY, AGENT_APPROVAL_KEY, AGENT_APPROVAL_CATEGORIES_KEY, AGENT_TRUSTED_RECORDS_KEY, AGENT_EXTERNAL_POLICY_KEY, AGENT_GOAL_ENABLED_KEY, AGENT_ORCH_ENABLED_KEY, AGENT_EXTERNAL_TOOLS_KEY, AGENT_WEB_SEARCH_KEY, AGENT_WEB_FETCH_KEY, AGENT_HEADLESS_KEY, AGENT_GOAL_PARALLEL_KEY, AGENT_AUTOMATION_KEY, AGENT_SCHEDULER_ENABLED_KEY, AGENT_TOOL_POLICY_KEY];
	const h = (e)=>{ const k = e && e.key != null ? `${e.key}` : ''; if(!k || mine.indexOf(k) >= 0){ emit(); } };
	window.addEventListener('storage', h);
	return ()=>{ window.removeEventListener('storage', h); crossWindowBound = false; };
}

export function subscribeAgentPrefs(fn){
	if(typeof window === 'undefined' || typeof fn !== 'function'){ return ()=>{}; }
	const h = (e)=>fn(e && e.detail ? e.detail : { enabled: isAgentEnabled(), approval: getAgentApprovalMode(), categories: getAgentApprovalCategories(), trustedRecords: getTrustedRecords(), toolPolicy: getToolPolicy(), external: getExternalPolicy() });
	window.addEventListener(AGENT_PREFS_EVENT, h);
	return ()=>window.removeEventListener(AGENT_PREFS_EVENT, h);
}

// 定时任务(P3)子开关:'1' 才开;关=schedule_task 不进工具目录、心跳到了也零执行、非桌面不起页面定时器
export function isSchedulerEnabled(){
	return safeLocalStorageGet(AGENT_SCHEDULER_ENABLED_KEY) === '1';
}

export function setSchedulerEnabled(on){
	safeLocalStorageSet(AGENT_SCHEDULER_ENABLED_KEY, on ? '1' : '0');
	emit();
	return isSchedulerEnabled();
}
