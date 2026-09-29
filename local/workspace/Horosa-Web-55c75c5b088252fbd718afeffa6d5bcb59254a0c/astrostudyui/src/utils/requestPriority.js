// [R5 T5] 请求优先级车道 · 前端侧标记单源。
// 后端(排盘引擎)对带 X-Horosa-Priority: prefetch 的请求只做一件事:排在正在等待的用户请求之后再拿计算锁;
// 不改任何计算 / 输出。哪些请求算「后台」:
//   ① 步进预取作用域内同步起调的请求(stepPrefetch.isInPrefetchScope);
//   ② 空闲预热队列执行任务的同步阶段(idleWarmQueue 经 runInBackgroundScope 包住 task());
//   ③ 调用方显式 options.priority === 'prefetch'。
// 三者之外一律前台 = 旧行为。kill-switch:horosa.perf.requestPriorityLane(关=永不加头)。
import { flagEnabled } from './perfFlags';

export const PRIORITY_HEADER = 'X-Horosa-Priority';
let backgroundDepth = 0;

export function runInBackgroundScope(fn){
	backgroundDepth += 1;
	try{
		return fn();
	}finally{
		backgroundDepth -= 1;
	}
}

export function isInBackgroundScope(){
	return backgroundDepth > 0;
}

export function requestPriorityLaneEnabled(){
	return flagEnabled('horosa.perf.requestPriorityLane');
}

/** 给 fetch options 打优先级头(返回新对象;非后台 / 开关关 = 原样返回)。 */
export function tagRequestPriority(options, inPrefetchScope){
	if(!requestPriorityLaneEnabled()){
		// 显式 priority:'prefetch' 是本模块的内部约定,不是 fetch 的 RequestInit.priority(合法值 high / low / auto,
		// 'prefetch' 会被引擎按非法枚举拒收)—— 关闸时也剥掉这个字段,其余原样
		if(options && options.priority === 'prefetch'){
			const bare = { ...options };
			delete bare.priority;
			return bare;
		}
		return options;
	}
	const explicit = options && options.priority === 'prefetch';
	if(!(explicit || inPrefetchScope || backgroundDepth > 0)){ return options; }
	const next = { ...(options || {}) };
	if(next.priority !== undefined){ delete next.priority; }
	next.headers = { ...(next.headers || {}), [PRIORITY_HEADER]: 'prefetch' };
	return next;
}

/** 测试用 */
export function __resetRequestPriorityForTest(){
	backgroundDepth = 0;
}
