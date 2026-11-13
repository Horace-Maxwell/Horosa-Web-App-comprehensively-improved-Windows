// 「按页面此刻所见重存模块快照」的派发与读取(对话挂载、AI 导出、存案、报告「当前挂载的盘」四条路共用这一处)。
// 页面(技法页 / 择日内嵌页)监听 horosa:refresh-module-snapshot:detail.module 是自己的槽名就按当前盘同步重存,
// 并把正文填进 detail.snapshotText。独立成件(不放进 moduleAiSnapshot):整份替换快照存取的测试桩不会顺带把派发也换掉。
import { loadModuleAISnapshot } from './moduleAiSnapshot';

export const MODULE_SNAPSHOT_REFRESH_EVENT = 'horosa:refresh-module-snapshot';

// 派发一次;返回 detail(页面同步应答时 snapshotText 已填)。派发失败或不在浏览器里回 null。
export function dispatchModuleSnapshotRefresh(moduleName){
	if(!moduleName || typeof window === 'undefined'){
		return null;
	}
	const detail = { module: moduleName, snapshotText: '' };
	try{
		window.dispatchEvent(new CustomEvent(MODULE_SNAPSHOT_REFRESH_EVENT, { detail }));
	}catch(e){
		return null;
	}
	return detail;
}

// 导出前请页面把「页面上还没算、正文却要用」的内容补算齐(异步;与存案前的补算同一个宿主钩子,导出与存案两边一致)。
// 页面监听 horosa:prepare-module-snapshot:detail.module 是自己的槽名就把补算的 Promise 推进 detail.pending。
// 没人监听 / 没有要补的 → 立即返回;最多等 timeoutMs,超时按已有的导出(补不上只少那一段)。
export const MODULE_SNAPSHOT_PREPARE_EVENT = 'horosa:prepare-module-snapshot';
// 补算最多等这么久(导出前补算与存案前补算同一上限):补不上只少那一段,不让导出 / 存案一直挂着
export const MODULE_SNAPSHOT_PREPARE_TIMEOUT_MS = 30000;

// 等一组补算全部落定(失败当作落定),最多等 timeoutMs;返回 true = 全部按时落定
export async function settleWithin(pending, timeoutMs = MODULE_SNAPSHOT_PREPARE_TIMEOUT_MS){
	const list = (Array.isArray(pending) ? pending : [pending]).filter((p)=>p !== undefined && p !== null);
	if(!list.length){
		return true;
	}
	let timer = null;
	const settled = await Promise.race([
		Promise.all(list.map((p)=>Promise.resolve(p).catch(()=>null))).then(()=>true),
		new Promise((resolve)=>{ timer = setTimeout(()=>resolve(false), timeoutMs); }),
	]);
	if(timer){ clearTimeout(timer); }
	return settled;
}

export async function prepareModuleSnapshot(moduleName, timeoutMs = MODULE_SNAPSHOT_PREPARE_TIMEOUT_MS){
	if(!moduleName || typeof window === 'undefined'){
		return;
	}
	const detail = { module: moduleName, pending: [] };
	try{
		window.dispatchEvent(new CustomEvent(MODULE_SNAPSHOT_PREPARE_EVENT, { detail }));
	}catch(e){
		return;
	}
	if(!detail.pending.length){
		return;
	}
	await settleWithin(detail.pending, timeoutMs);
}

// 同步版:只派发一次、不轮询。页面在场且同步应答 → 返回页面此刻的正文(槽也已换成它);
// 页面不在场(无人监听)→ 立即返回 '',零等待。
export function requestModuleSnapshotRefreshSync(moduleName){
	const detail = dispatchModuleSnapshotRefresh(moduleName);
	return detail && typeof detail.snapshotText === 'string' ? `${detail.snapshotText}`.trim() : '';
}

// 对一组槽名逐个同步请页面刷新(派发一次、不轮询)。对话挂载读缓存前、存案前、报告取「当前挂载的盘」前都经这里。
// 返回 { 槽名: 页面同步应答的正文 }(没应答 = '')。
export function refreshModuleSnapshotSlots(slots){
	const out = {};
	(Array.isArray(slots) ? slots : [slots]).forEach((slot)=>{
		if(!slot){ return; }
		try{ out[slot] = requestModuleSnapshotRefreshSync(slot); }catch(e){ out[slot] = ''; /* 页面应答异常 → 按槽里已有的 */ }
	});
	return out;
}

// 先请页面按此刻所见重存,再按槽名顺序(技法别名表的顺序)取第一份有正文的:
//   · 槽里有 → 用槽(读序 = 内存不比存储旧就用内存,见 moduleAiSnapshot);
//   · 槽里没有、但页面同步应答了正文(只应答不写槽的页)→ 用应答正文。
// 返回 { slot, snapshot } 或 null。槽名表由调用方给(报告 / 挂载用技法别名表 getTechniqueAliasList)。
export function loadFreshFirstModuleSnapshot(slots){
	const list = (Array.isArray(slots) ? slots : [slots]).filter(Boolean);
	const answered = refreshModuleSnapshotSlots(list);
	for(let i = 0; i < list.length; i += 1){
		const snap = loadModuleAISnapshot(list[i]);
		if(snap && snap.content){ return { slot: list[i], snapshot: snap }; }
	}
	for(let i = 0; i < list.length; i += 1){
		const text = `${answered[list[i]] || ''}`.trim();
		if(text){ return { slot: list[i], snapshot: { module: list[i], version: 1, createdAt: new Date().toISOString(), meta: {}, content: text } }; }
	}
	return null;
}

// 先请页面按此刻所见重存,再读槽 —— 存案 / 挂载要的是「页面现在显示的这一份」,不是上一次取数时存下的那份
// (只重绘不重取的改动、择日宿主刚出的择时结果,都只在页面应答刷新时才进槽)。页面不在场 → 等同 loadModuleAISnapshot。
export function loadFreshModuleAISnapshot(moduleName){
	refreshModuleSnapshotSlots([moduleName]);
	return loadModuleAISnapshot(moduleName);
}
