// AI 助手·动作账本(本机撤销栈):键 horosa.ai.agent.ledger.v1,200 条 FIFO。
// 写失败**不再静默**:注册表跑 additive 工具前先 reserveAction 占位,写不进去就拒绝执行
// (E_LEDGER_UNAVAILABLE,零写入)——「可一键撤销」是对用户的承诺,不因存储配额满而悄悄降级;配额失败先裁半重试。
// 撤销只由 UI(动作条/外部动作记录面板)调用 undoAction;不是工具、不进注册表、AI 不可达。
// 记录类撤销 = 移入回收站(30 天可恢复);设置类撤销 = 恢复写前快照。
import { parseLocalDateTimeMs } from '../dateTimeParse';
import { safeJsonParseFromStorage, safeJsonStringifyToStorage } from '../safeStorage';
import { listLocalCharts, removeLocalChart } from '../localcharts';
import { listLocalCases, removeLocalCase } from '../localcases';
import { getStore } from '../storageutil';
import { getWorkspaceBridge, getWorkspaceUi } from './workspaceBridge';
import { restoreSettingsSnapshot } from './settingsFacets';
import { parseDateTimeMs } from '../dateTimeParse';

export const LEDGER_KEY = 'horosa.ai.agent.ledger.v1';
export const LEDGER_MAX = 200;
export const LEDGER_EVENT = 'horosa:agent-ledger-changed';
// 配额满裁掉了还能撤销的较早动作(撤销承诺缩水):派此事件,通知中心如实告诉用户(此前静默裁掉)
export const LEDGER_TRIMMED_EVENT = 'horosa:agent-ledger-trimmed';

function readAll(){
	const v = safeJsonParseFromStorage(LEDGER_KEY);
	return Array.isArray(v) ? v : [];
}
// 写账本:配额满时先让幂等回放内容让位(条目上 idem.reply 去掉;同键重试照样判得出「已写过」、只是回放退成摘要),
// 仍写不进再裁半重试(保留最新的一半——账本本身太大导致的失败只有这样才救得回来);全部失败回 false。
// 裁掉的较早条目里有还能撤销的 → 派 LEDGER_TRIMMED_EVENT(撤销承诺缩水要让用户知道,不静默)。
// 调用方据返回值定夺:写前预留失败 = 拒绝执行;提交失败 = 留痕不阻断(记录已落库,不能再收回)。
export const LEDGER_HALVING_MAX_ROUNDS = 12;
function stripReplay(list){
	let changed = false;
	const out = list.map((a)=>{
		if(!a || !a.idem || a.idem.reply === undefined){ return a; }
		changed = true;
		const { reply, ...idem } = a.idem;
		void reply;
		return { ...a, idem };
	});
	return changed ? out : null;
}
function undoableCount(list){
	return list.filter((a)=>a && !a.pending && !a.undone && a.undo && a.undo.kind && a.undo.kind !== 'none').length;
}
function emitTrimmed(dropped){
	const undoable = undoableCount(dropped);
	if(!undoable){ return; }
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
			window.dispatchEvent(new CustomEvent(LEDGER_TRIMMED_EVENT, { detail: { dropped: dropped.length, undoable } }));
		}
	}catch(e){ /* noop */ }
}
function writeAll(list){
	const full = Array.isArray(list) ? list.slice(0, LEDGER_MAX) : [];
	let cur = full;
	let stripped = false;
	// 一次写入点(裸调、看 === true);写不进先让回放内容让位(只一次),再逐轮裁半
	for(let round = 0; round <= LEDGER_HALVING_MAX_ROUNDS; round++){
		const ok = safeJsonStringifyToStorage(LEDGER_KEY, cur) === true;
		if(ok){
			if(cur.length < full.length){ emitTrimmed(full.slice(cur.length)); }
			return true;
		}
		if(!stripped){
			stripped = true;
			const lean = stripReplay(cur);
			if(lean){ cur = lean; continue; }
		}
		if(cur.length <= 1){ return false; }
		cur = cur.slice(0, Math.ceil(cur.length / 2));
	}
	return false;
}
// 对外可见的账本 = 去掉写前占位(pending)的条目
function readVisible(){ return readAll().filter((a)=>a && !a.pending); }
// 账本变化广播(动作账本面板/任务中心据此刷新;失败静默)
function emitLedger(){
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){
			window.dispatchEvent(new CustomEvent(LEDGER_EVENT, { detail: { size: readAll().length } }));
		}
	}catch(e){ /* noop */ }
}
export function subscribeLedger(fn){
	if(typeof window === 'undefined' || typeof fn !== 'function'){ return ()=>{}; }
	const h = (e)=>fn(e && e.detail ? e.detail : {});
	window.addEventListener(LEDGER_EVENT, h);
	return ()=>window.removeEventListener(LEDGER_EVENT, h);
}

// 撤销处理器注册(按 undo.kind):任务类撤销(cancel-task)由任务模块登记,账本本身不认识任务表——
// 仍是 UI 专用路径:注册的是「怎么撤」,谁能触发不变(用户按钮)。
const undoHandlers = new Map();
export function registerUndoHandler(kind, fn){
	if(typeof fn !== 'function'){ throw new Error('[aiTools] registerUndoHandler: fn 须为函数'); }
	undoHandlers.set(`${kind}`, fn);
}

export function newActionId(){
	return `act-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

// 落一条动作:同 id 的写前占位在原位替换,否则插到最前;写不进去回 null(调用方决定怎么留痕)
export function appendAction(entry){
	const list = readAll();
	const rec = { undone: false, ...(entry || {}), at: (entry && entry.at) || new Date().toISOString() };
	delete rec.pending;
	const idx = rec.id ? list.findIndex((a)=>a && a.id === rec.id && a.pending) : -1;
	if(idx >= 0){ list[idx] = rec; }else{ list.unshift(rec); }
	if(!writeAll(list)){ return null; }
	emitLedger();
	return rec;
}

// 写前预留(注册表在跑 additive 工具**之前**调用):先把一条占位记录写进账本——写不进去就拒绝执行。
// 占位不进 listActions/getAction;run 成功 → appendAction 同 id 原位替换;run 失败 → discardReserved 收回。
export function reserveAction(entry){
	const list = readAll();
	const rec = { undone: false, ...(entry || {}), pending: true, at: (entry && entry.at) || new Date().toISOString() };
	list.unshift(rec);
	if(!writeAll(list)){ return null; }
	return rec;
}

export function discardReserved(actionId){
	const list = readAll();
	const next = list.filter((a)=>!(a && a.id === actionId && a.pending));
	if(next.length === list.length){ return false; }
	return writeAll(next);
}

export function listActions(limit){
	const list = readVisible();
	return typeof limit === 'number' ? list.slice(0, limit) : list;
}

export function getAction(actionId){
	return readVisible().find((a)=>a.id === actionId) || null;
}

// 幂等键随账本落盘(条目上的 idem:{ slot, argsKey, … }):进程重启 / 页面重载 / 无头换进程之后,同键重试照样按第一次的结果回放。
// 只认 ttlMs 内的已落定条目(写前占位不算);同槽取最新一条
export function findActionByIdempotencySlot(slot, ttlMs, now){
	if(!slot){ return null; }
	const t = Number.isFinite(now) ? now : Date.now();
	const hit = readVisible().find((a)=>a && a.idem && a.idem.slot === slot);
	if(!hit){ return null; }
	const at = parseDateTimeMs(hit.at || '') || 0;
	if(Number.isFinite(ttlMs) && ttlMs > 0 && (!at || t - at > ttlMs)){ return null; }
	return hit;
}

function markUndone(actionId){
	const list = readAll();
	const idx = list.findIndex((a)=>a && a.id === actionId && !a.pending);
	if(idx < 0){ return false; }
	list[idx] = { ...list[idx], undone: true, undoneAt: new Date().toISOString() };
	const ok = writeAll(list);
	if(ok){ emitLedger(); }
	return ok;
}

function clearCurrentIfMatches(store, kind, cid){
	try{
		const bridge = getWorkspaceBridge();
		const dispatch = bridge && bridge.dispatch;
		if(!dispatch){ return; }
		void store;
		if(kind === 'chart'){
			// 与界面删除同一入口(models/user detachCurrentChartIfRemoved:按字符串比 cid,盘留在屏幕上、脱离记录)
			dispatch({ type: 'user/detachCurrentChartIfRemoved', payload: { cids: [cid] } });
		}else{
			// 与界面删除同一入口(models/user clearCurrentCaseIfRemoved:按字符串比 cid,currentCase 与原样记录一起清)
			dispatch({ type: 'user/clearCurrentCaseIfRemoved', payload: { cids: [cid] } });
		}
	}catch(e){ /* noop */ }
}

// 撤销(UI 专用)。返回 { ok, code?, kind, data? }
export function undoAction(actionId, { restoreSettings } = {}){
	const action = getAction(actionId);
	if(!action){
		return { ok: false, code: 'E_ACTION_NOT_FOUND' };
	}
	// 已撤销过的再点一次:如实说「已撤销」,不说「账本里没有」(动作条据此给对的提示)
	if(action.undone){
		return { ok: false, code: 'E_UNDO_ALREADY', kind: action.undo && action.undo.kind ? action.undo.kind : 'none' };
	}
	const undo = action.undo || {};
	if(undo.kind === 'trash-record'){
		const { store, cid } = undo.payload || {};
		const list = store === 'case' ? listLocalCases({ includeArchived: true }) : listLocalCharts({ includeArchived: true });
		const rec = list.find((r)=>r.cid === cid);
		if(!rec || !rec.aiOrigin || rec.aiOrigin.actionId !== actionId){
			return { ok: false, code: 'E_UNDO_NOT_APPLICABLE', kind: undo.kind };
		}
		// 用户手工改过(内核 updateTime 晚于动作时间;载入/置顶/星标不刷新 updateTime)→ 不自动撤:
		// 撤销的合同是「收回 AI 的动作」,不是「丢掉用户后来的编辑」;要删请走档案管理。
		const editedAt = parseLocalDateTimeMs(rec.updateTime || '') || 0;
		const actedAt = parseLocalDateTimeMs(action.at || '') || 0;
		if(editedAt && actedAt && editedAt > actedAt + 2000){
			return { ok: false, code: 'E_UNDO_RECORD_EDITED', kind: undo.kind, message: '该记录在助手建档后被手工修改过,不自动撤销;如需删除请到档案管理操作' };
		}
		const w = store === 'case' ? removeLocalCase(cid) : removeLocalChart(cid);
		// 删除没写进(配额满):记录还在,不记已撤销、不清当前盘(此前照报撤销成功,再点又报「已撤销」)
		if(w && w.persisted === false && w.reason === 'quota'){
			return { ok: false, code: 'E_STORE_QUOTA', kind: undo.kind, message: '本地存储空间不足,这条记录没能移进回收站;先导出清理后再撤销' };
		}
		clearCurrentIfMatches(getStore(), store === 'case' ? 'case' : 'chart', cid);
		markUndone(actionId);
		// 撤销后档案列表/AI 分析页源列表必须跟着刷新,否则仍显示已进回收站的记录
		try{
			const b = getWorkspaceBridge() || {};
			if(typeof b.dispatch === 'function'){ b.dispatch({ type: store === 'case' ? 'user/fetchCases' : 'user/fetchCharts', payload: {} }); }
			// 源列表刷新走页面登记的 ui 面(此前读 b.ui,而生产从未登记过 ui → 这一行从未跑到)
			const ui = getWorkspaceUi() || {};
			if(typeof ui.refreshSources === 'function'){ ui.refreshSources(); }
		}catch(e){ /* noop */ }
		const persisted = !(w && w.persisted === false);
		// 存储将满时删除照样生效,但这条可能只进了删除日志(keptIn:'log'),也可能连删除日志都没写进(unkept:横幅已给「导出这些记录」)
		const keptIn = w && w.unkept ? 'none' : (w && w.keptIn === 'log' ? 'log' : 'trash');
		const keptNote = keptIn === 'log' ? '本机存储空间不足,这条没进回收站,已记进删除日志(可从删除日志找回)'
			: (keptIn === 'none' ? '本机存储空间不足,这条既没进回收站也没进删除日志;界面横幅里可以「导出这些记录」留底' : '');
		const message = !persisted ? '已移进回收站,但本机存储不可用,只在本次运行有效:重启后这条还会在列表里' : keptNote;
		return { ok: true, kind: undo.kind, data: { trashedCid: cid, store, persisted, keptIn }, ...(message ? { message } : {}) };
	}
	if(undo.kind === 'restore-settings'){
		const fn = typeof restoreSettings === 'function' ? restoreSettings : restoreSettingsSnapshot;
		const r = fn(undo.payload || {});
		if(r && r.ok === false){ return { ok: false, code: r.code || 'E_UNDO_NOT_APPLICABLE', kind: undo.kind }; }
		markUndone(actionId);
		return { ok: true, kind: undo.kind, data: { restoredTo: undo.payload && undo.payload.snapshot } };
	}
	const handler = undoHandlers.get(`${undo.kind || ''}`);
	if(handler){
		let r = null;
		try{ r = handler(action, undo); }catch(e){ r = { ok: false, code: 'E_UNDO_NOT_APPLICABLE', message: e && e.message ? e.message : `${e}` }; }
		if(r && r.ok){
			// 异步撤销(任务类):处理器附 settle 承诺——真落定才标 undone;失败把返回对象翻成失败(调用方按同一对象读结果)
			if(r.settle && typeof r.settle.then === 'function'){
				const out = { ok: true, kind: undo.kind, data: r.data, pending: true };
				r.settle.then((s)=>{
					out.pending = false;
					if(s && s.ok){ markUndone(actionId); return; }
					out.ok = false; out.code = (s && s.code) || 'E_UNDO_NOT_APPLICABLE'; out.message = s && s.message ? s.message : undefined;
				}).catch((e)=>{ out.pending = false; out.ok = false; out.code = 'E_UNDO_NOT_APPLICABLE'; out.message = e && e.message ? e.message : `${e}`; });
				return out;
			}
			markUndone(actionId);
			return { ok: true, kind: undo.kind, data: r.data };
		}
		return { ok: false, code: (r && r.code) || 'E_UNDO_NOT_APPLICABLE', kind: undo.kind, message: r && r.message ? r.message : undefined };
	}
	return { ok: false, code: 'E_UNDO_NOT_APPLICABLE', kind: undo.kind || 'none' };
}

export function __resetLedgerForTests(){
	writeAll([]);
}
