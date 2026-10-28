// AI 助手·外部智能体桥(页面侧):壳内 MCP 服务把 tools/list · tools/call 经 eval 投递到页面
// (window.__horosaAgentTool 或就绪前的 __horosaPendingAgentTools 队列),页面执行后 invoke 回传。
// 执行分两道:只读面与只读工具走「共享道」(并发 ≤ SHARED_CONCURRENCY,同名工具仍一个一个来);
//   写入与界面类走「独占道」(严格串行)。壳经 window.__horosaAgentToolCancel(id) 通知取消;带 progress:true 的调用给工具 ctx.progress。
// 铁律:本桥零数据层 import(localcharts/localcases/dva 一律不碰),一切经工具注册表;总开关关 → 不挂钩。
import { isAgentEnabled, subscribeAgentPrefs, getExternalPolicy, getToolPolicy } from './prefs';
import { isToolDenied } from './approvalPolicy';
import { requestApproval, approvalReasonOf, buildApprovalPreview } from './approvals';
import { requestElicitation } from './elicitations';
import { subscribeAutomationEvents } from './automation/events';
import { isDesktopBridgeAvailable, invokeDesktopCommand, createAgentNotifier, desktopAgentNotify, desktopMcpServerSetLimits } from '../aiAnalysisDesktop';
import { withTimeout, bridgeTimeoutMs } from './withTimeout';
import { pushNotice } from './tasks/noticeStore';
import { reportBackgroundFailure } from './bgSink';
import { resourceKindOf, resourceKindDenied } from '../aiTools/resourceToolGate';

// 外部客户端的「每次确认」待审 / ask_user 反问此前只进任务中心待办(铃铛 +1),用户没打开任务中心就按超时处理;
//   与目标 / 定时任务同口径推一条 action 级通知(桌面横幅按通知设置);推送失败只留痕,绝不影响审批本身
function noticeExternalWait(kind, clientName, body){
	const title = kind === 'ask' ? '外部客户端向你提问' : '外部客户端等你批准';
	return pushNotice({ level: 'action', title, body: `${clientName || 'external'}:${body || ''}`, link: 'tasks:center' }, { desktop: true }).catch((e)=>reportBackgroundFailure('mcp.notice', e));
}

// 工具目录惰性加载:本桥挂在布局层(首屏 chunk),静态 import 工具目录会把技法上下文引擎整段拖进首屏
// (实测 dist-file 分包形态漂移、preload 注入失败)。只有真要服务外部请求时才动态载入并注册(幂等)。
let toolsPromise = null;
function loadTools(){
	if(!toolsPromise){
		toolsPromise = Promise.all([import('../aiTools/registry'), import('../aiTools'), import('../aiTools/resources'), import('../aiTools/prompts'), import('../aiTools/completions')]).then(([registry, index, res, prompts, completions])=>{
			try{ index.registerBuiltinTools(); }catch(e){ /* 幂等 */ }
			// 桥只取这几件:目录 / 执行 / 工作区 ui 读取(批尾统一选中用,与工具侧 ctxUi 同一来源)+ 资源面 / 提示面
			return {
				exportToolManifest: registry.exportToolManifest,
				runTool: registry.runTool,
				getTool: registry.getTool,   // 工具声明的 timeoutMs 与客户端预算取小(run_analysis 声明 180 s 此前在桥路径不可达)
				peekIdempotent: registry.peekIdempotent,   // 幂等预查(限流与审批之前:回放 / 冲突 / 已撤销不再弹审批、不计写入额度)
				peekNoChange: registry.peekNoChange,       // 无变化预检(审批之前:什么也不会改就不弹审批卡)
				// 目录变更订阅(注册/注销外部工具、功能开关不经此,由 prefs 事件覆盖)→ 本机 MCP 服务推 tools/list_changed
				subscribeToolCatalog: registry.subscribeToolCatalog,
				// 页面登记的 ui 面(AI 分析页在前台才有 selectSource;此前读 bridge.ui 恒 null → 批尾选中从未生效)
				workspaceUi: ()=>{ const ui = typeof index.getWorkspaceUi === 'function' ? index.getWorkspaceUi() : null; return ui && typeof ui.selectSource === 'function' ? ui : null; },
				listResources: res.listResources,
				listResourcesPage: res.listResourcesPage,   // 游标分页(此前硬截 200 条)
				listResourceTemplates: res.listResourceTemplates,
				readResource: res.readResource,
				listPrompts: prompts.listPrompts,
				listPromptsPage: prompts.listPromptsPage,
				getPrompt: prompts.getPrompt,
				completeArgument: completions.completeArgument,   // 资源模版 / 提示参数补全
			};
		}).catch((e)=>{ toolsPromise = null; throw e; });   // 一次 chunk 载入失败不能永久拒绝后续请求
	}
	return toolsPromise;
}

export const MCP_TEXT_HARD_LIMIT = 200000;
// 只读面(资源三 + 提示二 + 参数补全):与 tools/call 同受每分钟限流
export const READ_FACE_METHODS = ['resources/list', 'resources/templates/list', 'resources/read', 'prompts/list', 'prompts/get', 'completion/complete'];
export const MCP_BRIDGE_VERSION = 1;
// 读面五方法此前页面侧无超时而壳侧固定 20 s:壳先回超时、页面串行队列仍被占;页面提前 3 s 收口让队列继续
export const READ_FACE_TIMEOUT_MS = 17000;
function readFace(fn){ return withTimeout(Promise.resolve().then(fn), READ_FACE_TIMEOUT_MS, { code: 'E_TOOL_TIMEOUT', message: `读取超时(${Math.round(READ_FACE_TIMEOUT_MS / 1000)}s),队列已继续` }); }

// 外部客户端档(prefs.getExternalPolicy;缺省 auto=现状):每个限流桶一个滑动窗口计数——
// 每分钟调用上限 / 每小时写入上限;超限回 E_LIMIT 不执行。纯内存,刷新即清。
// 桶键取壳注入的会话身份(req.sessionId,壳在 initialize 时发、请求逐条带上);自报名(clientName)只在无会话时兜底且只作展示标签
//      ——名字由外部客户端自己声明,按名字分桶=换个名字就是一份新额度。桶表 LRU 封顶 BUCKET_MAX,最久未用的先淘汰。
export const BUCKET_MAX = 64;
// 拒绝桶上限:目录外名字/禁用名的拒绝按每分钟 max(5×调用上限, 60) 计,超限 E_LIMIT;与正常 calls 桶互不挤占
export const REJECT_MAX_PER_MINUTE = 60;
const clientBuckets = new Map();
function bucketOf(key){
	const k = `${key || 'external'}`;
	let b = clientBuckets.get(k);
	if(b){ clientBuckets.delete(k); clientBuckets.set(k, b); return b; }   // 刷新 LRU 位次
	b = { calls: [], writes: [], rejected: [] };
	if(clientBuckets.size >= BUCKET_MAX){ clientBuckets.delete(clientBuckets.keys().next().value); }
	clientBuckets.set(k, b);
	return b;
}
function bucketKeyOf(req, clientName){
	const sid = req && req.sessionId ? `${req.sessionId}` : ((req && req.params && req.params.sessionId) ? `${req.params.sessionId}` : '');
	return sid || `${clientName || 'external'}`;
}
function pruneBucket(b, now){
	b.calls = b.calls.filter((t)=>now - t < 60000);
	b.writes = b.writes.filter((t)=>now - t < 3600000);
	if(!Array.isArray(b.rejected)){ b.rejected = []; }
	b.rejected = b.rejected.filter((t)=>now - t < 60000);
}
// level 'rejected':目录外名字 / 按名禁用的拒绝走独立桶(每分钟上限同 calls,不与正常调用互相挤占):
// 此前拒绝不计额且每次都重建整份目录,本机受信进程也能无上限打满页面串行队列(D35)。
export function checkExternalLimits(clientName, level, policy, now){
	const p = policy || getExternalPolicy();
	const b = bucketOf(clientName);
	const t = Number.isFinite(now) ? now : Date.now();
	pruneBucket(b, t);
	if(level === 'rejected'){
		const rejCap = Math.max(Number(p.maxCallsPerMinute) * 5 || 0, REJECT_MAX_PER_MINUTE);
		if(b.rejected.length >= rejCap){ return { ok: false, code: 'E_LIMIT', message: `外部无效调用超过每分钟上限(${rejCap})` }; }
		b.rejected.push(t);
		return { ok: true };
	}
	if(b.calls.length >= p.maxCallsPerMinute){ return { ok: false, code: 'E_LIMIT', message: `外部调用超过每分钟上限(${p.maxCallsPerMinute})` }; }
	if(level === 'additive' && b.writes.length >= p.maxAdditivePerHour){ return { ok: false, code: 'E_LIMIT', message: `外部写入超过每小时上限(${p.maxAdditivePerHour})` }; }
	b.calls.push(t);
	return { ok: true };
}
function noteExternalWrite(clientName, now){
	bucketOf(clientName).writes.push(Number.isFinite(now) ? now : Date.now());
}

// 两道调度(取代此前的全局一条串行队列:一次 120 s 的起盘把之后所有只读查询都堵在后面):
//   共享道 = 只读面方法 + 只读工具(非界面类):并发 ≤ SHARED_CONCURRENCY,同名工具仍按到达序一个一个来;
//   独占道 = 写入(additive)+ 界面类(ui):严格串行,批量建档的批尾选中只算这一道。两道互不等待。
//   目录尚未载入时分不清级别 ⇒ 一律走独占道(保守:宁慢不乱)。
export const SHARED_CONCURRENCY = 3;
export const PROGRESS_MIN_INTERVAL_MS = 250;
const waiting = [];          // 未开跑的请求(先来先排)
const running = new Map();   // 桥 id → 在跑条目
let exclusiveBusy = false;
let toolDeps = null;         // loadTools 成功后的 deps(同步分道用)
function laneOf(req){
	const method = req && req.method ? `${req.method}` : '';
	if(method !== 'tools/call'){ return { lane: 'shared', name: null }; }
	const name = `${(req.params && req.params.name) || ''}`;
	if(!toolDeps || typeof toolDeps.getTool !== 'function'){ return { lane: 'exclusive', name }; }
	const def = toolDeps.getTool(name);
	if(!def){ return { lane: 'shared', name }; }   // 目录外名字秒拒,不必占独占道
	if(def.level === 'additive' || def.category === 'ui'){ return { lane: 'exclusive', name }; }
	return { lane: 'shared', name };
}
function sharedRunningCount(){
	let n = 0;
	running.forEach((e)=>{ if(e.lane === 'shared'){ n += 1; } });
	return n;
}
function nameBusy(entry, beforeIndex){
	if(!entry.name){ return false; }
	let busy = false;
	running.forEach((e)=>{ if(e.lane === 'shared' && e.name === entry.name){ busy = true; } });
	if(busy){ return true; }
	for(let i = 0; i < beforeIndex; i++){ const w = waiting[i]; if(w.lane === 'shared' && w.name === entry.name){ return true; } }
	return false;
}
function pump(){
	let exclusiveSeen = false;
	for(let i = 0; i < waiting.length;){
		const e = waiting[i];
		if(e.lane === 'exclusive'){
			if(!exclusiveSeen && !exclusiveBusy){ waiting.splice(i, 1); startEntry(e); exclusiveSeen = true; continue; }
			exclusiveSeen = true; i += 1; continue;
		}
		if(sharedRunningCount() < SHARED_CONCURRENCY && !nameBusy(e, i)){ waiting.splice(i, 1); startEntry(e); continue; }
		i += 1;
	}
}
function startEntry(e){
	running.set(e.key, e);
	if(e.lane === 'exclusive'){ exclusiveBusy = true; }
	Promise.resolve().then(()=>deliver(e)).catch(()=>{}).then(()=>{
		running.delete(e.key);
		if(e.lane === 'exclusive'){ exclusiveBusy = false; }
		if(e.progressDispose){ e.progressDispose(); }
		pump();
	});
}
// 进度发射器:强制递增(规范 MUST)、≤ 每 250 ms 一帧(窗口内只留最后一条到点补发);了结即停
function makeProgressEmitter(id){
	let last = -Infinity; let lastAt = 0; let timer = null; let queued = null; let closed = false;
	const send = (v)=>{ invokeDesktopCommand('agent_tool_progress_command', { id, ...v }).catch(()=>{}); };
	const emit = (p, total, message)=>{
		if(closed){ return; }
		let value = Number(p);
		if(!Number.isFinite(value)){ value = last === -Infinity ? 0 : last + 1; }
		if(value <= last){ value = last + 0.001; }
		last = value;
		const v = { progress: value };
		if(Number.isFinite(Number(total)) && total !== null && total !== undefined){ v.total = Number(total); }
		if(message){ v.message = `${message}`.slice(0, 200); }
		const now = Date.now();
		if(now - lastAt >= PROGRESS_MIN_INTERVAL_MS){ lastAt = now; queued = null; send(v); return; }
		queued = v;
		if(!timer){ timer = setTimeout(()=>{ timer = null; if(queued && !closed){ lastAt = Date.now(); send(queued); queued = null; } }, Math.max(0, PROGRESS_MIN_INTERVAL_MS - (now - lastAt))); }
	};
	const dispose = ()=>{ closed = true; queued = null; if(timer){ clearTimeout(timer); timer = null; } };
	return { emit, dispose };
}
// 壳经 window.__horosaAgentToolCancel(id) 转来的客户端取消:排队中 ⇒ 直接出队永不执行;在跑 ⇒ 中止信号(工具与审批台据此收口)
export function cancelAgentToolRequest(id){
	const wi = waiting.findIndex((w)=>w.key === id);
	if(wi >= 0){
		const e = waiting.splice(wi, 1)[0];
		e.cancelled = true;
		if(e.lane === 'exclusive'){ settleBatch(toolDeps); }
		pump();
		return true;
	}
	const r = running.get(id);
	if(r){
		r.cancelled = true;
		try{ r.ac.abort(); }catch(err){ /* noop */ }
		return true;
	}
	return false;
}
export function __bridgeLanesForTests(){ return { waiting: waiting.map((w)=>({ key: w.key, lane: w.lane, name: w.name })), running: Array.from(running.values()).map((e)=>({ key: e.key, lane: e.lane, name: e.name })) }; }

let bound = false;
let unsubscribe = null;
// 页面策略「每分钟调用上限」→ 壳令牌桶:绑桥时与策略每次改动时同步一次(同值不重发;非桌面/未绑桥零 invoke)
let lastSyncedCallsPerMinute = null;
function syncShellLimits(){
	const n = Number(getExternalPolicy().maxCallsPerMinute);
	if(!Number.isFinite(n) || n === lastSyncedCallsPerMinute){ return; }
	lastSyncedCallsPerMinute = n;
	// invokeOptional 从不 reject(失败回 available:false)⇒ 按结果判:没送到壳就清记忆,下次策略改动再试
	desktopMcpServerSetLimits(n).then((r)=>{ if(!r || r.available === false){ lastSyncedCallsPerMinute = null; } }, ()=>{ lastSyncedCallsPerMinute = null; });
}
export function __lastSyncedCallsPerMinuteForTests(){ return lastSyncedCallsPerMinute; }
// MCP 目录缓存:按「工具名策略 JSON + 目录版本」失效(目录注册/注销 → 版本 +1);此前每次 tools/call 都重建整份目录
let manifestCache = null;
let catalogVersion = 0;
let catalogVersionSubscribed = false;
function mcpManifestOf(d){
	const policyJson = JSON.stringify(getToolPolicy() || {});
	if(manifestCache && manifestCache.fn === d.exportToolManifest && manifestCache.policyJson === policyJson && manifestCache.catalogVersion === catalogVersion){ return manifestCache.man; }
	const man = d.exportToolManifest({ includeExternal: false, origin: 'mcp' }) || [];
	manifestCache = { fn: d.exportToolManifest, policyJson, catalogVersion, man };
	return man;
}
export function __mcpManifestCacheForTests(){ return manifestCache; }
// 外部审批档对一件工具的拒绝(单源):目录不列 与 调用即拒 同一个函数。只读档 = 写入类一律拒
export function externalPolicyBlock(def, policy){
	const p = policy || getExternalPolicy();
	if(def && def.level === 'additive' && p && p.approval === 'read-only'){ return { ok: false, code: 'E_APPROVAL_DENIED', message: '外部客户端审批档为只读,写入动作未执行' }; }
	return null;
}
// tools/list 的目录:按名禁用的不列、外部审批档拒的不列;缓存键 = 工具名策略 + 外部审批档 + 目录版本
let listedCache = null;
function mcpListedTools(d){
	const man = mcpManifestOf(d);
	const policy = getExternalPolicy();
	const key = `${JSON.stringify(getToolPolicy() || {})}|${policy && policy.approval}|${catalogVersion}`;
	if(listedCache && listedCache.man === man && listedCache.key === key){ return listedCache.tools; }
	const toolPolicy = getToolPolicy();
	const tools = man.filter((t)=>t && !isToolDenied(t.name, toolPolicy) && !externalPolicyBlock(t, policy));
	listedCache = { man, key, tools };
	return tools;
}
// 本机 MCP 服务宣告 tools/resources/prompts 三面 listChanged:true、壳有 agent_notify_command,
// 但页面此前从未调用 —— 记录/模版/工具面变了外部客户端永远不知。绑桥时装去抖发射器(桥不可用或总开关关 = 零定时器零 invoke),解绑即拆。
// 触发面:record.saved(数据层事件)与账本变更 → resources;偏好变更(功能开关/禁用名单)与目录注册注销 → tools;模版库写入 → prompts。
// 壳在绑桥时已推过一次 tools/list_changed,绑定本身不再发。
let notifier = null;
let notifyUnsubs = [];
export const LEDGER_CHANGED_DOM_EVENT = 'horosa:agent-ledger-changed';   // 字面量 = ledger.LEDGER_EVENT(jest 锁等);不 import ledger 以免把记录库拖进首屏分包
export const STORE_CHANGED_DOM_EVENT = 'horosa:ai-store-changed';        // 字面量 = aiAnalysisStore.AI_STORE_CHANGED_EVENT(jest 锁等)
function armNotifier(){
	if(notifier){ return; }
	// notify 经模块导出调用(而非发射器内部缺省):jest 可在 aiAnalysisDesktop 命名空间上打桩观察 kind 序列
	notifier = createAgentNotifier({ enabled: ()=>bound && isAgentEnabled() && isDesktopBridgeAvailable(), notify: (kind)=>desktopAgentNotify(kind) });
	notifyUnsubs.push(subscribeAutomationEvents((ev)=>{ if(ev && ev.event === 'record.saved'){ notifier.emit('resources'); } }));
	notifyUnsubs.push(subscribeAgentPrefs(()=>{ if(notifier){ notifier.emit('tools'); } }));
	const w = typeof window !== 'undefined' ? window : null;
	if(w && typeof w.addEventListener === 'function'){
		const onLedger = ()=>{ if(notifier){ notifier.emit('resources'); } };
		const onStore = (e)=>{ const st = e && e.detail ? `${e.detail.store || ''}` : ''; if(st === 'templates' && notifier){ notifier.emit('prompts'); } };
		w.addEventListener(LEDGER_CHANGED_DOM_EVENT, onLedger);
		w.addEventListener(STORE_CHANGED_DOM_EVENT, onStore);
		notifyUnsubs.push(()=>w.removeEventListener(LEDGER_CHANGED_DOM_EVENT, onLedger));
		notifyUnsubs.push(()=>w.removeEventListener(STORE_CHANGED_DOM_EVENT, onStore));
	}
	const mine = notifier;
	// 同 tick 关-开两次:第一份 .then 醒来时 notifier 已换新 ⇒ 不得再往新表里塞订阅(否则重复订阅)
	loadTools().then((d)=>{ if(notifier !== mine){ return; } if(notifier && d && typeof d.subscribeToolCatalog === 'function'){ notifyUnsubs.push(d.subscribeToolCatalog(()=>{ if(notifier){ notifier.emit('tools'); } })); } }).catch(()=>{});
}
function disarmNotifier(){
	notifyUnsubs.forEach((u)=>{ try{ u(); }catch(e){ /* noop */ } });
	notifyUnsubs = [];
	if(notifier){ try{ notifier.dispose(); }catch(e){ /* noop */ } notifier = null; }
}
export function __agentNotifierForTests(){ return notifier; }
export function __notifySubscriptionCountForTests(){ return notifyUnsubs.length; }
// 批量建档抑制(与运行时同一合同):队列里连续多条建档不逐条选中分析源,建档工具经 ctx.deferSelect 只登记 cid,
// 队列排空(pendingCount 归零)时对最后一条成功建档 refreshSources+selectSource 一次。只计独占道(建档都在这一道)。
let pendingCount = 0;   // 独占道已入队未完成的请求数(含正在执行的一条)
let batchSize = 0;      // 本轮排空周期内独占道累计入队数(归零即重置)= 工具侧看到的 batch.total
let batchIndex = 0;     // 本轮排空周期内独占道已投递数
let deferredCid = null; // 本轮最后一条登记待选中的 cid

export function truncateForMcp(text, limit){
	const s = `${text || ''}`;
	const max = limit || MCP_TEXT_HARD_LIMIT;
	if(s.length <= max){ return { text: s, truncated: false }; }
	return { text: s.slice(0, max) + `\n[truncated: ${s.length - max} chars beyond offset ${max}; 用 maxChars/offset 分页]`, truncated: true };
}

// 资源面 / 提示面:只读、零动作、不进账本;内容单源在页面(命盘/事盘快照·资料正文·技法提示卡·用户模版);每次读带 17 s 超时
// 列表类分页:游标对壳不透明、只在页面编解码;坏游标 = -32602(规范);缺省页大小由各列表定
function pagedResult(key, page){
	return { ok: true, result: { [key]: page.items, ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) } };
}
function badCursor(e){ return e && e.code === 'E_BAD_CURSOR' ? { ok: false, error: { code: -32602, message: 'invalid cursor' } } : null; }

// kindDenied(kind):该类资源对应的工具被用户按名禁用 → 资源面同样不列 / 不读 / 不补全(缺省 = 都不禁)
async function readFaceDispatch(method, reqParams, d, kindDenied){
	const denied = typeof kindDenied === 'function' ? kindDenied : ()=>false;
	const visible = (list, keyOf)=>(Array.isArray(list) ? list.filter((x)=>!(x && denied(resourceKindOf(keyOf(x))))) : list);
	if(method === 'resources/list'){
		if(typeof d.listResourcesPage === 'function'){
			try{
				const page = await readFace(()=>d.listResourcesPage({ cursor: reqParams.cursor }));
				return pagedResult('resources', { ...page, items: visible(page && page.items, (x)=>x.uri) });
			}catch(e){ const b = badCursor(e); if(b){ return b; } throw e; }
		}
		return { ok: true, result: { resources: visible(await readFace(()=>d.listResources({ limit: reqParams.limit })), (x)=>x.uri) } };
	}
	if(method === 'resources/templates/list'){
		return { ok: true, result: { resourceTemplates: visible(await readFace(()=>d.listResourceTemplates()), (x)=>x.uriTemplate) } };
	}
	if(method === 'resources/read'){
		const uri = `${reqParams.uri || ''}`;
		if(denied(resourceKindOf(uri))){ return { ok: false, error: { code: -32602, message: `resource disabled by user (tool disabled): ${uri.slice(0, 200)}` } }; }
		let one = null;
		try{ one = await readFace(()=>d.readResource(uri)); }catch(e){ if(e && e.code === 'E_TOOL_TIMEOUT'){ throw e; } one = null; }   // 坏 URI 一律 -32602,不让整条请求 reject 成 -32603
		if(!one){ return { ok: false, error: { code: -32602, message: `unknown or empty resource: ${uri.slice(0, 200)}` } }; }
		const cut = truncateForMcp(one.text, MCP_TEXT_HARD_LIMIT);
		return { ok: true, result: { contents: [{ ...one, text: cut.text, ...(cut.truncated ? { _meta: { truncated: true } } : {}) }] } };
	}
	if(method === 'prompts/list'){
		if(typeof d.listPromptsPage === 'function'){
			try{ return pagedResult('prompts', await readFace(()=>d.listPromptsPage({ cursor: reqParams.cursor }))); }catch(e){ const b = badCursor(e); if(b){ return b; } throw e; }
		}
		return { ok: true, result: { prompts: await readFace(()=>d.listPrompts({ limit: reqParams.limit })) } };
	}
	if(method === 'prompts/get'){
		const params = reqParams;
		const got = await readFace(()=>d.getPrompt(`${params.name || ''}`, params.arguments || {}));
		if(!got){ return { ok: false, error: { code: -32602, message: `unknown prompt: ${params.name || ''}` } }; }
		return { ok: true, result: { description: got.description, messages: (got.messages || []).map((m)=>({ ...m, content: { ...m.content, text: truncateForMcp(m.content && m.content.text, MCP_TEXT_HARD_LIMIT).text } })) } };
	}
	if(method === 'completion/complete'){
		if(typeof d.completeArgument !== 'function'){ return { ok: true, result: { completion: { values: [], total: 0, hasMore: false } } }; }
		const ref = reqParams.ref && typeof reqParams.ref === 'object' ? reqParams.ref : null;
		const arg = reqParams.argument && typeof reqParams.argument === 'object' ? reqParams.argument : null;
		if(!ref || !arg || typeof arg.name !== 'string'){ return { ok: false, error: { code: -32602, message: 'completion/complete needs ref and argument.name' } }; }
		if(ref.type === 'ref/resource' && denied(resourceKindOf(ref.uri))){ return { ok: true, result: { completion: { values: [], total: 0, hasMore: false } } }; }
		const got = await readFace(()=>d.completeArgument(ref, arg, reqParams.context || {}));
		if(!got){ return { ok: false, error: { code: -32602, message: 'unknown completion reference' } }; }
		return { ok: true, result: { completion: got } };
	}
	return { ok: false, error: { code: -32601, message: `method not found: ${method}` } };
}

// 取消竞速:调用方的取消信号一到即落定 E_CANCELLED(工具本体随 ac.abort 自行收口;已落地的写入照常进账本、可撤销)
function raceCancel(promise, signal){
	if(!signal){ return promise; }
	if(signal.aborted){ return Promise.resolve({ ok: false, code: 'E_CANCELLED', message: '外部客户端已取消这次调用' }); }
	return Promise.race([promise, new Promise((resolve)=>{ signal.addEventListener('abort', ()=>resolve({ ok: false, code: 'E_CANCELLED', message: '外部客户端已取消这次调用' }), { once: true }); })]);
}

// 一次投递 → 一个 MCP 结果(与 tools/call 结果形状同构)
// deps:{ exportToolManifest, runTool, ui?, workspaceUi? };ctxExtra:队列层附加进 runTool ctx 的键(batch / deferSelect),直接调用可省略
export async function handleAgentToolRequest(req, deps, ctxExtra){
	const d = deps || await loadTools();
	const method = req && req.method ? `${req.method}` : '';
	if(!isAgentEnabled()){
		return { ok: false, error: { code: -32001, message: 'agent ability disabled' } };
	}
	if(method === 'tools/list'){
		// 外部客户端接入的工具(origin external)永不再经本机服务导出——防再导出回环
		// 用户「按工具名禁用」此前只在对话路径过滤;外部客户端同样不列(手册合同:deny 任何路径都拒且不进目录)
		// 外部审批档「只读」下写入工具不列(与调用时的拒绝同一判据 externalPolicyBlock:列出来的 ⇔ 调用不被审批档拒)
		return { ok: true, result: { tools: mcpListedTools(d) } };   // origins:['mcp'] 的工具只在这里出现
	}
	const reqParams = req && req.params && typeof req.params === 'object' ? req.params : {};
	const clientName = `${(req && req.clientName) || reqParams.clientName || 'external'}`;
	const bucketKey = bucketKeyOf(req, clientName);
	// 资源面 / 提示面同样受限流(与 tools/call 同一分钟桶):外部客户端不能把 resources/read 当无限带宽的读盘接口打
	if(READ_FACE_METHODS.indexOf(method) >= 0){
		const lim = checkExternalLimits(bucketKey, 'read', getExternalPolicy());
		if(!lim.ok){ return { ok: false, error: { code: -32004, message: lim.message } }; }
		// 「按工具名禁用」同样管资源面(与下面 tools/call 的 isToolDenied 同一份策略):禁了 list_records / cast_technique 等,
		// 对应类别的资源不列、不读、不补全 —— 否则换条资源路照样读到同一份内容
		const toolPolicy = getToolPolicy();
		const kindDenied = (kind)=>resourceKindDenied(kind, (n)=>isToolDenied(n, toolPolicy));
		try{ return await readFaceDispatch(method, reqParams, d, kindDenied); }catch(e){ return { ok: false, error: { code: -32002, message: e && e.message ? e.message : '读取超时' } }; }
	}
	// 资源面 / 提示面:只读、零动作、不进账本;内容单源在页面(命盘/事盘快照·资料正文·技法提示卡·用户模版)
	if(method === 'tools/call'){
		const params = req.params || {};
		const name = `${params.name || ''}`;
		const args = params.arguments && typeof params.arguments === 'object' ? params.arguments : {};
		// 调度层给的取消信号(壳转来的客户端取消)与进度回调(仅本次请求有自己的响应流时);两者都不原样透给工具
		const { cancelSignal, progress: reportProgress, ...extraForTool } = ctxExtra || {};
		let declaredOutput = false;
		let r;
		try{
			// 桥是全局串行队列:任一工具永不 settle(如后端无内超时的起盘)会让之后所有外部调用永远排队,
			// 而壳侧 PageBridge 超时只回它自己的调用者、看不见页面队列已卡死 → 页面侧必须自带超时让队列继续。
			const ms = bridgeTimeoutMs(params._meta, 120000);
			const callId = `mcp-${req.id}`;
			// 目录版本两路作废:注册 / 注销,以及任一 AI 助手开关变化(无头分析 / 私人内容可读 / 网页读取 / 目标任务 / 定时……)——
			// 开关只改 enabled() 不注册注销,此前开了开关 tools/list 已见新工具、tools/call 却按旧缓存回「未知工具」,直到别的注册事件把缓存刷掉
			if(!catalogVersionSubscribed && typeof d.subscribeToolCatalog === 'function'){ catalogVersionSubscribed = true; try{ d.subscribeToolCatalog(()=>{ catalogVersion += 1; }); subscribeAgentPrefs(()=>{ catalogVersion += 1; }); }catch(e){ catalogVersionSubscribed = false; } }
			const man = mcpManifestOf(d);
			const def = man.find((t)=>t && t.name === name);
			declaredOutput = !!(def && def.outputSchema);
			const policy = getExternalPolicy();
			// 目录成员与按名禁用先于一切计数:
			//  · 不在 MCP 目录里的名字 ⇒ E_TOOL_NOT_FOUND(含 ext_* 外部工具:它们被排除出 tools/list 防再导出回环,此前却可按名直呼,且 level=null 绕过写入桶与审批分支);
			//  · 用户「按工具名禁用」此前只在对话路径生效 ⇒ 外部客户端同拒。类别档/信任档案仍不作用于桥(设计边界:令牌持有者=受信本机进程)。
			if(!def || isToolDenied(name, getToolPolicy())){
				// 拒绝走独立 rejected 桶:超限回 E_LIMIT(不执行),否则按原因出码
				const rej = checkExternalLimits(bucketKey, 'rejected', policy);
				if(!rej.ok){ r = rej; }
				else if(!def){ r = { ok: false, code: 'E_TOOL_NOT_FOUND', message: `未知工具: ${name.slice(0, 64)}` }; }
				else{ r = { ok: false, code: 'E_APPROVAL_DENIED', message: `工具 ${name} 已被用户禁用,未执行` }; }
			}else{
				const level = def.level;
				// 幂等键:客户端在 _meta 里带(idempotencyKey 或 io.horosa/idempotencyKey),同键重试不重复写(见 registry.runTool)
				const meta = params._meta && typeof params._meta === 'object' ? params._meta : {};
				const idemRaw = meta.idempotencyKey !== undefined ? meta.idempotencyKey : meta['io.horosa/idempotencyKey'];
				const idemCtx = { origin: 'mcp', clientName, ...(idemRaw !== undefined && idemRaw !== null ? { idempotencyKey: idemRaw } : {}) };
				// 幂等预查先于限流与审批(与 runTool 同一份判定 peekIdempotent):同键同参的重试回放第一次的结果 / 在途就等它,
				//   同键异参直接冲突、第一次已被撤销直接回明确码 —— 都不再弹审批、不计写入额度(此前重试再弹一次审批,用户点跳过客户端就以为没写成)
				const idem = level === 'additive' && idemCtx.idempotencyKey !== undefined && typeof d.peekIdempotent === 'function' ? await d.peekIdempotent(name, args, idemCtx) : { state: 'none' };
				// 外部客户端档:限流 → 只读档直拒写入 → 每次确认档弹到本机审批台(用户不允许=跳过;到点=超时且审批台自撤)
				const lim = idem.state !== 'none' ? checkExternalLimits(bucketKey, idem.state === 'hit' ? 'read' : 'rejected', policy) : checkExternalLimits(bucketKey, level, policy);
				const blocked = externalPolicyBlock(def, policy);
				if(!lim.ok){
					r = lim;
				}else if(idem.state !== 'none'){
					r = idem.result;
				}else if(blocked){
					r = blocked;
				}else{
					let allowed = true;
					let reason = null;
					let spentMs = 0;
					let precheck = null;   // 审批前就落定的结果(无变化 / 预览自报必拒):不执行
					// 「界面类也要确认」(外部策略 uiConfirm,缺省关):界面类动作同样先弹本机审批台(读级,不受写入审批档与写入桶影响)
					const needUiConfirm = def.category === 'ui' && policy.uiConfirm === true;
					if((level === 'additive' && policy.approval === 'on-request') || needUiConfirm){
						// 带 timeoutMs:审批台到点按「未允许」落定并自撤(此前只靠外层 withTimeout,超时后动作条残留「允许/跳过」死按钮)
						const t0 = Date.now();
						const key = `mcp:${clientName}`;
						// 客户端取消 = 待审条目随之撤台(审批台按 abort 落定,动作条不留死按钮)
						// 写前预览(与对话路径同一个 buildApprovalPreview):审批卡上看得到「这次会写成什么样」再决定
						const previewDef = typeof d.getTool === 'function' ? d.getTool(name) : null;
						// 无变化预检(与执行前同一个 def.noChange):什么也不会改 → 直接回该结果,不弹审批卡
						const noChange = level === 'additive' && typeof d.peekNoChange === 'function' ? await d.peekNoChange(name, args, { origin: 'mcp', clientName, ...(d.ui && typeof d.ui === 'object' ? { ui: d.ui } : {}) }) : null;
						const preview = level === 'additive' && !noChange ? await buildApprovalPreview(previewDef, args, { origin: 'mcp', clientName }) : null;
						if(noChange){
							precheck = noChange;
						}else if(preview && preview.reject){
							// 工具自报执行必拒:不挂审批台,直接按该码回(永不在没有审批的情况下进 runTool),与对话路径同
							precheck = { ok: false, code: preview.reject.code, message: preview.reject.message };
						}else{
						const approvalP = requestApproval(key, { callId, name, args, level, ...(preview ? { preview } : {}), ...(cancelSignal ? { signal: cancelSignal } : {}) }, { timeoutMs: ms }).catch(()=>false);
						noticeExternalWait('approve', clientName, `${name} 请求${level === 'additive' ? '写入' : '操作界面'}(${Math.round(ms / 1000)} 秒内未处理按未允许)`);
						if(reportProgress){ reportProgress(0, undefined, level === 'additive' ? '等待你在星阙里确认这次写入' : '等待你在星阙里确认这次界面操作'); }
						allowed = await approvalP;
						// 按审批台的落定原因出码(到点前点「跳过」但回调排在 ms 之后,此前会被「耗时 ≥ 预算」猜成超时 → 客户端重试被明确拒绝的写入)
						reason = approvalReasonOf(key, callId);
						}
						spentMs = Date.now() - t0;
					}
					// 执行预算 = 客户端预算 − 审批已耗:此前审批等满 ms 后执行又给一份 ms(最坏 2·ms),壳侧早已向客户端回超时而动作照常执行(客户端重试=重复建档)
					const remainMs = ms - spentMs;
					if(precheck){
						r = precheck;
					}else if(cancelSignal && cancelSignal.aborted){
						r = { ok: false, code: 'E_CANCELLED', message: '外部客户端已取消这次调用,未执行' };
					}else if(!allowed){
						r = reason === 'timeout' ? { ok: false, code: 'E_TOOL_TIMEOUT', message: '等待用户确认超时' } : { ok: false, code: 'E_USER_SKIPPED', message: level === 'additive' ? '用户未允许这次外部写入' : '用户未允许这次外部界面操作' };
					}else if(remainMs <= 0){
						r = { ok: false, code: 'E_TOOL_TIMEOUT', message: '审批耗尽了本次调用的时间预算,未执行' };
					}else{
						// 超时必带取消:此前 withTimeout 只让队列继续、工具在后台跑完(写入在客户端已收 E_TOOL_TIMEOUT 后仍落地 = 重试即重复建档;
						//   run_analysis 在途 1 被占到跑完);预算 = 客户端剩余预算 与 工具声明 timeoutMs 取小(run_analysis 声明的 180 s 此前在桥路径不可达)
						const ac = typeof AbortController === 'function' ? new AbortController() : null;
						const declared = typeof d.getTool === 'function' ? Number(((d.getTool(name) || {}).timeoutMs)) : NaN;
						const budgetMs = Number.isFinite(declared) && declared > 0 ? Math.min(remainMs, declared) : remainMs;
						// 客户端取消 → 同一个中止信号(工具据此停下;反问待办随之落定)
						if(cancelSignal && ac){ cancelSignal.addEventListener('abort', ()=>{ try{ ac.abort(); }catch(e){ /* noop */ } }, { once: true }); }
						const ctx = {
							origin: 'mcp', requestId: callId, clientName,
							...(idemCtx.idempotencyKey !== undefined ? { idempotencyKey: idemCtx.idempotencyKey } : {}),
							// 反问通道:外部客户端的 ask_user 同样弹到本机界面(消息键 mcp:<client>,任务中心待办渲染)
							// 带本次调用的中止信号:桥超时中止后反问待办随之落定(此前挂到它自己的 5 分钟超时,作答已无处送达);并推一条通知
							elicit: (q)=>{ noticeExternalWait('ask', clientName, `${(q && q.question) || ''}`); return requestElicitation(`mcp:${clientName}`, { ...(q || {}), callId, name, ...(ac ? { signal: ac.signal } : {}) }); },
							...(d.ui && typeof d.ui === 'object' ? { ui: d.ui } : {}), ...extraForTool,
							// 长工具可报进度(ctx.progress(已完成量, 总量?, 说明?));没有响应流的调用不给这个键
							...(reportProgress ? { progress: reportProgress } : {}),
								...(ac ? { signal: ac.signal } : {}),
						};
						if(reportProgress){ reportProgress(0, undefined, `开始执行 ${name}`); }
						r = await raceCancel(withTimeout(d.runTool(name, args, ctx), budgetMs, { code: 'E_TOOL_TIMEOUT', message: `工具执行超时(${Math.round(budgetMs / 1000)}s),已中止,队列已继续`, onTimeout: ()=>{ if(ac){ try{ ac.abort(); }catch(e){ /* noop: abort 抛错不影响超时落定 */ } } } }), cancelSignal);
						if(r && r.ok && level === 'additive' && !r.replayed && !r.noChange){ noteExternalWrite(bucketKey); }   // 幂等回放 / 无变化不是新写入,不占写入额度
					}
				}
			}
		}catch(e){
			r = { ok: false, code: e && e.code ? e.code : 'E_TOOL_THREW', message: e && e.message ? e.message : `${e}` };
		}
		// ledgerLost:动作已落地但账本提交失败(不可撤销)——外部客户端也要知道
		const text = truncateForMcp(JSON.stringify({ ok: !!r.ok, code: r.code, message: r.message, assumptions: r.assumptions, data: r.data, undo: r.undo, ledgerLost: r.ledgerLost === true ? true : undefined, replayed: r.replayed === true ? true : undefined, noChange: r.noChange === true ? true : undefined }));
		// 声明了 outputSchema 的工具:成功必带 structuredContent(规范 MUST;这类工具的 data 有界,不随正文截断丢掉)
		// 失败一律不带:客户端 SDK 见到 structuredContent 就按 outputSchema 校验,失败时的 data(候选 / 可用技法表等)形状不合 → 整条调用变协议错,
		//   模型连错误说明都拿不到;失败的 data 已在正文 JSON 里
		const hasData = !!(r.data && typeof r.data === 'object');
		const structured = hasData && r.ok && (declaredOutput || !text.truncated) ? r.data : undefined;
		return { ok: true, result: { content: [{ type: 'text', text: text.text }], structuredContent: structured, isError: !r.ok } };
	}
	return { ok: false, error: { code: -32601, message: `method not found: ${method}` } };
}

// 批尾选中用的 ui:deps.ui 显式注入优先,否则取工具目录侧的工作区桥 ui(与工具内 ctxUi 同源);两者皆无 → null
function resolveBridgeUi(d){
	const injected = d && d.ui && typeof d.ui === 'object' ? d.ui : null;
	const workspace = d && typeof d.workspaceUi === 'function' ? d.workspaceUi() : null;
	if(!injected && !workspace){ return null; }
	return { ...(workspace || {}), ...(injected || {}) };
}

// 一条请求完成 → 计数减一;归零=本轮排空:对登记的最后一条成功建档统一刷新并选中,然后重置本轮计数
function settleBatch(d){
	pendingCount = Math.max(0, pendingCount - 1);
	if(pendingCount > 0){ return; }
	const cid = deferredCid;
	deferredCid = null; batchSize = 0; batchIndex = 0;
	if(!cid){ return; }
	const ui = resolveBridgeUi(d);
	if(!ui || typeof ui.selectSource !== 'function'){ return; }
	try{ ui.refreshSources && ui.refreshSources(); ui.selectSource(cid); }catch(e){ /* UI 回调不反噬 */ }
}

async function deliver(e){
	const req = e.req;
	const id = req && req.id;
	const exclusive = e.lane === 'exclusive';
	const batch = exclusive ? { index: batchIndex, total: batchSize, isLast: pendingCount === 1 } : undefined;
	if(exclusive){ batchIndex += 1; }
	let d = null;
	let out;
	try{
		d = await loadTools();
		if(!toolDeps){ toolDeps = d; }
		const extra = { cancelSignal: e.ac.signal, ...(e.progress ? { progress: e.progress } : {}) };
		if(exclusive){ extra.batch = batch; extra.deferSelect = (cid)=>{ deferredCid = cid; }; }
		out = await handleAgentToolRequest(req, d, extra);
	}catch(err){
		out = { ok: false, error: { code: -32603, message: err && err.message ? err.message : `${err}` } };
	}
	// 已取消 = 壳早已了结这次调用(回 -32800 或关流),再回也无人收
	if(!e.cancelled){
		try{
			await invokeDesktopCommand('agent_tool_result_command', { id, ok: !!out.ok, result: out.ok ? out.result : undefined, error: out.ok ? undefined : out.error });
		}catch(err){ /* 壳不在:无处可回 */ }
	}
	if(exclusive){ settleBatch(d); }
}

function enqueue(req){
	const { lane, name } = laneOf(req);
	const ac = typeof AbortController === 'function' ? new AbortController() : { signal: undefined, abort(){} };
	const wantsProgress = !!(req && req.method === 'tools/call' && req.params && req.params.progress === true);
	const emitter = wantsProgress ? makeProgressEmitter(req.id) : null;
	const entry = { key: req && req.id, req, lane, name, ac, cancelled: false, progress: emitter ? emitter.emit : null, progressDispose: emitter ? emitter.dispose : null };
	if(lane === 'exclusive'){ pendingCount += 1; batchSize += 1; }
	waiting.push(entry);
	pump();
	return entry;
}

// 在途队列里的请求 = 页面桥未就绪期间壳投递的;壳在收到「桥就绪」时已把它们判成 -32003 让客户端重试,
// 页面若再执行等于重复执行(写入类工具会建两条)——只丢弃、不执行。
function discardPending(){
	const w = typeof window !== 'undefined' ? window : null;
	if(!w || !Array.isArray(w.__horosaPendingAgentTools)){ return 0; }
	const n = w.__horosaPendingAgentTools.length;
	w.__horosaPendingAgentTools.length = 0;
	return n;
}

// 幂等:总开关开且桌面壳在 → 挂钩并通知壳「桥就绪」(壳把在途请求以 -32003 reloaded 回复);关 → 卸钩。
export function bindMcpBridge(){
	if(typeof window === 'undefined'){ return ()=>{}; }
	const apply = ()=>{
		const on = isAgentEnabled() && isDesktopBridgeAvailable();
		if(on){ syncShellLimits(); }
		if(on && !bound){
			bound = true;
			loadTools().then((d)=>{ if(!toolDeps){ toolDeps = d; } }).catch(()=>{});   // 目录到手即可按级别分道
			armNotifier();
			discardPending();
			window.__horosaAgentTool = (req)=>{ enqueue(req); return true; };
			window.__horosaAgentToolCancel = (id)=>cancelAgentToolRequest(id);   // 壳转来的客户端取消
			invokeDesktopCommand('agent_bridge_ready_command', { version: MCP_BRIDGE_VERSION, ready: true }).catch(()=>{});
		}else if(!on && bound){
			bound = false;
			disarmNotifier();
			try{ delete window.__horosaAgentTool; }catch(e){ window.__horosaAgentTool = undefined; }
			try{ delete window.__horosaAgentToolCancel; }catch(e){ window.__horosaAgentToolCancel = undefined; }
			discardPending();
			invokeDesktopCommand('agent_bridge_ready_command', { version: MCP_BRIDGE_VERSION, ready: false }).catch(()=>{});
		}
	};
	apply();
	if(!unsubscribe){ unsubscribe = subscribeAgentPrefs(apply); }
	return ()=>{ if(unsubscribe){ unsubscribe(); unsubscribe = null; } };
}

export function __resetMcpBridgeForTests(){
	manifestCache = null; catalogVersion = 0; catalogVersionSubscribed = false; lastSyncedCallsPerMinute = null;
	clientBuckets.clear();
	disarmNotifier();
	bound = false;
	waiting.length = 0; running.clear(); exclusiveBusy = false; toolDeps = null;
	pendingCount = 0; batchSize = 0; batchIndex = 0; deferredCid = null;
	if(unsubscribe){ unsubscribe(); unsubscribe = null; }
	if(typeof window !== 'undefined'){ try{ delete window.__horosaAgentTool; }catch(e){ /* noop */ } try{ delete window.__horosaAgentToolCancel; }catch(e){ /* noop */ } window.__horosaPendingAgentTools = undefined; }
}
