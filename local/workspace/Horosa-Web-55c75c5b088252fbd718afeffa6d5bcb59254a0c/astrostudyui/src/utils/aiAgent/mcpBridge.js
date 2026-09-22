// AI 助手·外部智能体桥(页面侧):壳内 MCP 服务把 tools/list · tools/call 经 eval 投递到页面
// (window.__horosaAgentTool 或就绪前的 __horosaPendingAgentTools 队列),页面串行执行后 invoke 回传。
// 铁律:本桥零数据层 import(localcharts/localcases/dva 一律不碰),一切经工具注册表;总开关关 → 不挂钩。
import { isAgentEnabled, subscribeAgentPrefs, getExternalPolicy, getToolPolicy } from './prefs';
import { isToolDenied } from './approvalPolicy';
import { requestApproval, approvalReasonOf } from './approvals';
import { requestElicitation } from './elicitations';
import { subscribeAutomationEvents } from './automation/events';
import { isDesktopBridgeAvailable, invokeDesktopCommand, createAgentNotifier, desktopAgentNotify, desktopMcpServerSetLimits } from '../aiAnalysisDesktop';
import { withTimeout, bridgeTimeoutMs } from './withTimeout';
import { pushNotice } from './tasks/noticeStore';
import { reportBackgroundFailure } from './bgSink';

// [Q-294/M-109·AR-22] 外部客户端的「每次确认」待审 / ask_user 反问此前只进任务中心待办(铃铛 +1),用户没打开任务中心就按超时处理;
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
		toolsPromise = Promise.all([import('../aiTools/registry'), import('../aiTools'), import('../aiTools/resources'), import('../aiTools/prompts')]).then(([registry, index, res, prompts])=>{
			try{ index.registerBuiltinTools(); }catch(e){ /* 幂等 */ }
			// 桥只取这几件:目录 / 执行 / 工作区 ui 读取(批尾统一选中用,与工具侧 ctxUi 同一来源)+ [P5] 资源面 / 提示面
			return {
				exportToolManifest: registry.exportToolManifest,
				runTool: registry.runTool,
				getTool: registry.getTool,   // [D72] 工具声明的 timeoutMs 与客户端预算取小(run_analysis 声明 180 s 此前在桥路径不可达)
				// [D18] 目录变更订阅(注册/注销外部工具、功能开关不经此,由 prefs 事件覆盖)→ 本机 MCP 服务推 tools/list_changed
				subscribeToolCatalog: registry.subscribeToolCatalog,
				// [批五] 页面登记的 ui 面(AI 分析页在前台才有 selectSource;此前读 bridge.ui 恒 null → 批尾选中从未生效)
				workspaceUi: ()=>{ const ui = typeof index.getWorkspaceUi === 'function' ? index.getWorkspaceUi() : null; return ui && typeof ui.selectSource === 'function' ? ui : null; },
				listResources: res.listResources,
				listResourceTemplates: res.listResourceTemplates,
				readResource: res.readResource,
				listPrompts: prompts.listPrompts,
				getPrompt: prompts.getPrompt,
			};
		}).catch((e)=>{ toolsPromise = null; throw e; });   // 一次 chunk 载入失败不能永久拒绝后续请求
	}
	return toolsPromise;
}

export const MCP_TEXT_HARD_LIMIT = 200000;
// 只读面五方法(资源三 + 提示二):与 tools/call 同受每分钟限流
export const READ_FACE_METHODS = ['resources/list', 'resources/templates/list', 'resources/read', 'prompts/list', 'prompts/get'];
export const MCP_BRIDGE_VERSION = 1;
// [D73] 读面五方法此前页面侧无超时而壳侧固定 20 s:壳先回超时、页面串行队列仍被占;页面提前 3 s 收口让队列继续
export const READ_FACE_TIMEOUT_MS = 17000;
function readFace(fn){ return withTimeout(Promise.resolve().then(fn), READ_FACE_TIMEOUT_MS, { code: 'E_TOOL_TIMEOUT', message: `读取超时(${Math.round(READ_FACE_TIMEOUT_MS / 1000)}s),队列已继续` }); }

// 外部客户端档(prefs.getExternalPolicy;缺省 auto=现状):每个限流桶一个滑动窗口计数——
// 每分钟调用上限 / 每小时写入上限;超限回 E_LIMIT 不执行。纯内存,刷新即清。
// [R4] 桶键取壳注入的会话身份(req.sessionId,壳在 initialize 时发、请求逐条带上);自报名(clientName)只在无会话时兜底且只作展示标签
//      ——名字由外部客户端自己声明,按名字分桶=换个名字就是一份新额度。桶表 LRU 封顶 BUCKET_MAX,最久未用的先淘汰。
export const BUCKET_MAX = 64;
// [D35] 拒绝桶上限:目录外名字/禁用名的拒绝按每分钟 max(5×调用上限, 60) 计,超限 E_LIMIT;与正常 calls 桶互不挤占
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

let queue = Promise.resolve();
let bound = false;
let unsubscribe = null;
// [D74] 页面策略「每分钟调用上限」→ 壳令牌桶:绑桥时与策略每次改动时同步一次(同值不重发;非桌面/未绑桥零 invoke)
let lastSyncedCallsPerMinute = null;
function syncShellLimits(){
	const n = Number(getExternalPolicy().maxCallsPerMinute);
	if(!Number.isFinite(n) || n === lastSyncedCallsPerMinute){ return; }
	lastSyncedCallsPerMinute = n;
	// invokeOptional 从不 reject(失败回 available:false)⇒ 按结果判:没送到壳就清记忆,下次策略改动再试
	desktopMcpServerSetLimits(n).then((r)=>{ if(!r || r.available === false){ lastSyncedCallsPerMinute = null; } }, ()=>{ lastSyncedCallsPerMinute = null; });
}
export function __lastSyncedCallsPerMinuteForTests(){ return lastSyncedCallsPerMinute; }
// [D35] MCP 目录缓存:按「工具名策略 JSON + 目录版本」失效(目录注册/注销 → 版本 +1);此前每次 tools/call 都重建整份目录
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
// [进阶复查 D18·2026-09-08] 本机 MCP 服务宣告 tools/resources/prompts 三面 listChanged:true、壳有 agent_notify_command,
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
	// [D33] 同 tick 关-开两次:第一份 .then 醒来时 notifier 已换新 ⇒ 不得再往新表里塞订阅(否则重复订阅)
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
// 队列排空(pendingCount 归零)时对最后一条成功建档 refreshSources+selectSource 一次。
let pendingCount = 0;   // 已入队未完成的请求数(含正在执行的一条)
let batchSize = 0;      // 本轮排空周期内累计入队数(归零即重置)= 工具侧看到的 batch.total
let batchIndex = 0;     // 本轮排空周期内已投递数
let deferredCid = null; // 本轮最后一条登记待选中的 cid

export function truncateForMcp(text, limit){
	const s = `${text || ''}`;
	const max = limit || MCP_TEXT_HARD_LIMIT;
	if(s.length <= max){ return { text: s, truncated: false }; }
	return { text: s.slice(0, max) + `\n[truncated: ${s.length - max} chars beyond offset ${max}; 用 maxChars/offset 分页]`, truncated: true };
}

// [P5] 资源面 / 提示面:只读、零动作、不进账本;内容单源在页面(命盘/事盘快照·资料正文·技法提示卡·用户模版);[D73] 每次读带 17 s 超时
async function readFaceDispatch(method, reqParams, d){
	if(method === 'resources/list'){
		return { ok: true, result: { resources: await readFace(()=>d.listResources({ limit: reqParams.limit })) } };
	}
	if(method === 'resources/templates/list'){
		return { ok: true, result: { resourceTemplates: await readFace(()=>d.listResourceTemplates()) } };
	}
	if(method === 'resources/read'){
		const uri = `${reqParams.uri || ''}`;
		let one = null;
		try{ one = await readFace(()=>d.readResource(uri)); }catch(e){ if(e && e.code === 'E_TOOL_TIMEOUT'){ throw e; } one = null; }   // [R2] 坏 URI 一律 -32602,不让整条请求 reject 成 -32603
		if(!one){ return { ok: false, error: { code: -32602, message: `unknown or empty resource: ${uri.slice(0, 200)}` } }; }
		const cut = truncateForMcp(one.text, MCP_TEXT_HARD_LIMIT);
		return { ok: true, result: { contents: [{ ...one, text: cut.text, ...(cut.truncated ? { _meta: { truncated: true } } : {}) }] } };
	}
	if(method === 'prompts/list'){
		return { ok: true, result: { prompts: await readFace(()=>d.listPrompts({ limit: reqParams.limit })) } };
	}
	if(method === 'prompts/get'){
		const params = reqParams;
		const got = await readFace(()=>d.getPrompt(`${params.name || ''}`, params.arguments || {}));
		if(!got){ return { ok: false, error: { code: -32602, message: `unknown prompt: ${params.name || ''}` } }; }
		return { ok: true, result: { description: got.description, messages: (got.messages || []).map((m)=>({ ...m, content: { ...m.content, text: truncateForMcp(m.content && m.content.text, MCP_TEXT_HARD_LIMIT).text } })) } };
	}
	return { ok: false, error: { code: -32601, message: `method not found: ${method}` } };
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
		// [进阶复查 D13·2026-09-08] 用户「按工具名禁用」此前只在对话路径过滤;外部客户端同样不列(手册合同:deny 任何路径都拒且不进目录)
		const denyList = getToolPolicy().deny;
		return { ok: true, result: { tools: (d.exportToolManifest({ includeExternal: false, origin: 'mcp' }) || []).filter((t)=>t && denyList.indexOf(t.name) < 0) } };   // [批三③] origins:['mcp'] 的工具只在这里出现
	}
	const reqParams = req && req.params && typeof req.params === 'object' ? req.params : {};
	const clientName = `${(req && req.clientName) || reqParams.clientName || 'external'}`;
	const bucketKey = bucketKeyOf(req, clientName);
	// [R3] 资源面 / 提示面同样受限流(与 tools/call 同一分钟桶):外部客户端不能把 resources/read 当无限带宽的读盘接口打
	if(READ_FACE_METHODS.indexOf(method) >= 0){
		const lim = checkExternalLimits(bucketKey, 'read', getExternalPolicy());
		if(!lim.ok){ return { ok: false, error: { code: -32004, message: lim.message } }; }
		try{ return await readFaceDispatch(method, reqParams, d); }catch(e){ return { ok: false, error: { code: -32002, message: e && e.message ? e.message : '读取超时' } }; }
	}
	// [P5] 资源面 / 提示面:只读、零动作、不进账本;内容单源在页面(命盘/事盘快照·资料正文·技法提示卡·用户模版)
	if(method === 'tools/call'){
		const params = req.params || {};
		const name = `${params.name || ''}`;
		const args = params.arguments && typeof params.arguments === 'object' ? params.arguments : {};
		let r;
		try{
			// 桥是全局串行队列:任一工具永不 settle(如后端无内超时的起盘)会让之后所有外部调用永远排队,
			// 而壳侧 PageBridge 超时只回它自己的调用者、看不见页面队列已卡死 → 页面侧必须自带超时让队列继续。
			const ms = bridgeTimeoutMs(params._meta, 120000);
			const callId = `mcp-${req.id}`;
			if(!catalogVersionSubscribed && typeof d.subscribeToolCatalog === 'function'){ catalogVersionSubscribed = true; try{ d.subscribeToolCatalog(()=>{ catalogVersion += 1; }); }catch(e){ catalogVersionSubscribed = false; } }
			const man = mcpManifestOf(d);
			const def = man.find((t)=>t && t.name === name);
			const policy = getExternalPolicy();
			// [进阶复查 D13·2026-09-08] 目录成员与按名禁用先于一切计数:
			//  · 不在 MCP 目录里的名字 ⇒ E_TOOL_NOT_FOUND(含 ext_* 外部工具:它们被排除出 tools/list 防再导出回环,此前却可按名直呼,且 level=null 绕过写入桶与审批分支);
			//  · 用户「按工具名禁用」此前只在对话路径生效 ⇒ 外部客户端同拒。类别档/信任档案仍不作用于桥(设计边界:令牌持有者=受信本机进程)。
			if(!def || isToolDenied(name, getToolPolicy())){
				// [D35] 拒绝走独立 rejected 桶:超限回 E_LIMIT(不执行),否则按原因出码
				const rej = checkExternalLimits(bucketKey, 'rejected', policy);
				if(!rej.ok){ r = rej; }
				else if(!def){ r = { ok: false, code: 'E_TOOL_NOT_FOUND', message: `未知工具: ${name.slice(0, 64)}` }; }
				else{ r = { ok: false, code: 'E_APPROVAL_DENIED', message: `工具 ${name} 已被用户禁用,未执行` }; }
			}else{
				const level = def.level;
				// 外部客户端档:限流 → 只读档直拒写入 → 每次确认档弹到本机审批台(用户不允许=跳过;到点=超时且审批台自撤)
				const lim = checkExternalLimits(bucketKey, level, policy);
				if(!lim.ok){
					r = lim;
				}else if(level === 'additive' && policy.approval === 'read-only'){
					r = { ok: false, code: 'E_APPROVAL_DENIED', message: '外部客户端审批档为只读,写入动作未执行' };
				}else{
					let allowed = true;
					let reason = null;
					let spentMs = 0;
					if(level === 'additive' && policy.approval === 'on-request'){
						// [D13] 带 timeoutMs:审批台到点按「未允许」落定并自撤(此前只靠外层 withTimeout,超时后动作条残留「允许/跳过」死按钮)
						const t0 = Date.now();
						const key = `mcp:${clientName}`;
						const approvalP = requestApproval(key, { callId, name, args, level }, { timeoutMs: ms }).catch(()=>false);
						noticeExternalWait('approve', clientName, `${name} 请求写入(${Math.round(ms / 1000)} 秒内未处理按未允许)`);   // [AR-22]
						allowed = await approvalP;
						// [D32] 按审批台的落定原因出码(到点前点「跳过」但回调排在 ms 之后,此前会被「耗时 ≥ 预算」猜成超时 → 客户端重试被明确拒绝的写入)
						reason = approvalReasonOf(key, callId);
						spentMs = Date.now() - t0;
					}
					// [D25] 执行预算 = 客户端预算 − 审批已耗:此前审批等满 ms 后执行又给一份 ms(最坏 2·ms),壳侧早已向客户端回超时而动作照常执行(客户端重试=重复建档)
					const remainMs = ms - spentMs;
					if(!allowed){
						r = reason === 'timeout' ? { ok: false, code: 'E_TOOL_TIMEOUT', message: '等待用户确认超时' } : { ok: false, code: 'E_USER_SKIPPED', message: '用户未允许这次外部写入' };
					}else if(remainMs <= 0){
						r = { ok: false, code: 'E_TOOL_TIMEOUT', message: '审批耗尽了本次调用的时间预算,未执行' };
					}else{
						// [D72] 超时必带取消:此前 withTimeout 只让队列继续、工具在后台跑完(写入在客户端已收 E_TOOL_TIMEOUT 后仍落地 = 重试即重复建档;
						//   run_analysis 在途 1 被占到跑完);预算 = 客户端剩余预算 与 工具声明 timeoutMs 取小(run_analysis 声明的 180 s 此前在桥路径不可达)
						const ac = typeof AbortController === 'function' ? new AbortController() : null;
						const declared = typeof d.getTool === 'function' ? Number(((d.getTool(name) || {}).timeoutMs)) : NaN;
						const budgetMs = Number.isFinite(declared) && declared > 0 ? Math.min(remainMs, declared) : remainMs;
						const ctx = {
							origin: 'mcp', requestId: callId, clientName,
							// 反问通道:外部客户端的 ask_user 同样弹到本机界面(消息键 mcp:<client>,任务中心待办渲染)
							// [AR-22] 带本次调用的中止信号:桥超时中止后反问待办随之落定(此前挂到它自己的 5 分钟超时,作答已无处送达);并推一条通知
							elicit: (q)=>{ noticeExternalWait('ask', clientName, `${(q && q.question) || ''}`); return requestElicitation(`mcp:${clientName}`, { ...(q || {}), callId, name, ...(ac ? { signal: ac.signal } : {}) }); },
							...(d.ui && typeof d.ui === 'object' ? { ui: d.ui } : {}), ...(ctxExtra || {}),
								...(ac ? { signal: ac.signal } : {}),
						};
						r = await withTimeout(d.runTool(name, args, ctx), budgetMs, { code: 'E_TOOL_TIMEOUT', message: `工具执行超时(${Math.round(budgetMs / 1000)}s),已中止,队列已继续`, onTimeout: ()=>{ if(ac){ try{ ac.abort(); }catch(e){ /* noop: abort 抛错不影响超时落定 */ } } } });
						if(r && r.ok && level === 'additive'){ noteExternalWrite(bucketKey); }
					}
				}
			}
		}catch(e){
			r = { ok: false, code: e && e.code ? e.code : 'E_TOOL_THREW', message: e && e.message ? e.message : `${e}` };
		}
		// [D17] ledgerLost:动作已落地但账本提交失败(不可撤销)——外部客户端也要知道
		const text = truncateForMcp(JSON.stringify({ ok: !!r.ok, code: r.code, message: r.message, assumptions: r.assumptions, data: r.data, undo: r.undo, ledgerLost: r.ledgerLost === true ? true : undefined }));
		return { ok: true, result: { content: [{ type: 'text', text: text.text }], structuredContent: r.data && typeof r.data === 'object' && !text.truncated ? r.data : undefined, isError: !r.ok } };
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

async function deliver(req){
	const id = req && req.id;
	const batch = { index: batchIndex, total: batchSize, isLast: pendingCount === 1 };
	batchIndex += 1;
	let d = null;
	let out;
	try{
		d = await loadTools();
		out = await handleAgentToolRequest(req, d, { batch, deferSelect: (cid)=>{ deferredCid = cid; } });
	}catch(e){
		out = { ok: false, error: { code: -32603, message: e && e.message ? e.message : `${e}` } };
	}
	try{
		await invokeDesktopCommand('agent_tool_result_command', { id, ok: !!out.ok, result: out.ok ? out.result : undefined, error: out.ok ? undefined : out.error });
	}catch(e){ /* 壳不在:无处可回 */ }
	settleBatch(d);
}

function enqueue(req){
	pendingCount += 1;
	batchSize += 1;
	queue = queue.then(()=>deliver(req)).catch(()=>{});
	return queue;
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
			loadTools().catch(()=>{});
			armNotifier();
			discardPending();
			window.__horosaAgentTool = (req)=>{ enqueue(req); return true; };
			invokeDesktopCommand('agent_bridge_ready_command', { version: MCP_BRIDGE_VERSION, ready: true }).catch(()=>{});
		}else if(!on && bound){
			bound = false;
			disarmNotifier();
			try{ delete window.__horosaAgentTool; }catch(e){ window.__horosaAgentTool = undefined; }
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
	queue = Promise.resolve();
	pendingCount = 0; batchSize = 0; batchIndex = 0; deferredCid = null;
	if(unsubscribe){ unsubscribe(); unsubscribe = null; }
	if(typeof window !== 'undefined'){ try{ delete window.__horosaAgentTool; }catch(e){ /* noop */ } window.__horosaPendingAgentTools = undefined; }
}
