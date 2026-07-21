// timeDispatchScheduler —— 主盘「未确认时间变更」的派发调度(极速化大修 WP-E)。
//
// 旧式:纯 trailing 180ms 防抖 —— 每一次步进/格子/此刻都白等 180ms 才发请求。
// 新式(horosa.perf.leadingDebounce,默认开):
//   · leading 立发:无在途 trailing 计时器、且距上次 leading 已超窗口 → 立即派发(0ms 起跑);
//   · trailing 合并:窗口内的后续变更并入一个 trailing 计时器,只发最后一份 payload;
//   · 乱序由 fetchByFields 的 epoch 兜(旧响应作废),连发也只有最后一发落地。
// 关开关 = 纯 trailing 旧行为,逐拍一致。
//
// 独立成模块的唯一原因:index.js 里的闭包无法用 fake timers 单测 —— 这里是纯调度,金标可锁。
import { leadingDebounceEnabled } from './perfFlags';

const WINDOW_MS = 180;

let trailingTimer = null;
let leadingAt = 0;

/**
 * @param {function} dispatchFn 收 payload、执行真派发
 * @param {object} payload 本次要发的载荷(trailing 合并时以最后一份为准)
 */
export function scheduleUnconfirmedTimeDispatch(dispatchFn, payload){
	if(leadingDebounceEnabled()){
		const nowTs = Date.now();
		if(!trailingTimer && nowTs - leadingAt > WINDOW_MS){
			leadingAt = nowTs;
			dispatchFn(payload);
			return;
		}
	}
	if(trailingTimer){
		clearTimeout(trailingTimer);
	}
	trailingTimer = setTimeout(()=>{
		leadingAt = Date.now();
		trailingTimer = null;
		dispatchFn(payload);
	}, WINDOW_MS);
}

/**
 * 取消在途 trailing(「确定」等 confirmed 路径立即直发前调)——
 * 不取消则旧 trailing 会在直发【之后】再追一枪陈旧 payload。
 * 不清 leadingAt:confirmed 直发不占 leading 窗口。
 */
export function cancelPendingTimeDispatch(){
	if(trailingTimer){
		clearTimeout(trailingTimer);
		trailingTimer = null;
	}
}

/** 测试用:清调度器内部态(计时器与 leading 锚),防用例间串扰。 */
export function __resetTimeDispatchScheduler(){
	if(trailingTimer){
		clearTimeout(trailingTimer);
		trailingTimer = null;
	}
	leadingAt = 0;
}
