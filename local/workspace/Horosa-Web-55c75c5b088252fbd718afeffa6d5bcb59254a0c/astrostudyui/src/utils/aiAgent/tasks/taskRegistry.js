// 运行中任务的控制器登记(纯内存;刷新即清,持久态由 taskStore/reconcile 负责)。
const running = new Map();   // taskId → { cancel, pause, resume, startedAt }

// [压测二轮·S46] 窗口身份:同一标签页刷新后保持(sessionStorage),新开的标签页各一枚——
// 任务记录里的 runner.owner 就是它:启动对账据此分辨「本页刷新前留下的死循环」与「另一窗口正在跑的活任务」。
export const WINDOW_ID_KEY = 'horosa.ai.window.id';
function makeWindowId(){ return `win-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
export const WINDOW_ID = (()=>{
	try{
		if(typeof window !== 'undefined' && window.sessionStorage){
			const cur = window.sessionStorage.getItem(WINDOW_ID_KEY);
			if(cur){ return cur; }
			const id = makeWindowId();
			window.sessionStorage.setItem(WINDOW_ID_KEY, id);
			return id;
		}
	}catch(e){ /* 无 sessionStorage(隐私模式/无头)→ 进程内随机 */ }
	return makeWindowId();
})();

export function registerRunning(taskId, controller){
	if(!taskId){ return ()=>{}; }
	running.set(`${taskId}`, { ...(controller || {}), startedAt: Date.now() });
	return ()=>unregisterRunning(taskId);
}

export function unregisterRunning(taskId){
	return running.delete(`${taskId}`);
}

export function controllerOf(taskId){
	return running.get(`${taskId}`) || null;
}

export function listRunningIds(){
	return Array.from(running.keys());
}

export function __resetTaskRegistryForTests(){
	running.clear();
}
