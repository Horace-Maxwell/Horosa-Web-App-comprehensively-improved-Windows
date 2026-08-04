// optionDispatchScheduler —— 「选项即发」路径的派发调度(R4-B5b,horosa_option_debounce_v1)。
//
// 病灶:古典参数/流派开关等选项控件 onChange 即 dispatch fetchByFields —— 连改 5 档=5 次
// /chart 全算。时间轴已有 timeDispatchScheduler(180ms 通道),选项面此前裸发。
//
// 形态:leading 立发+trailing 250ms 并帧,独立通道独立计时器(绝不与时间轴互吞)。
// 与 timeDispatchScheduler 的关键差异 —— 【delta 累积 + 发时点 fresh base】:
//   trailing 若发「最后一次调用的快照」,会把快照里的【陈旧时间键】覆盖回去(时间轴的
//   save 落在 fetchByFields effect 内、可能晚于选项点击的 props 快照)——旧行为窗口=0ms
//   的同款既有竞态被 trailing 拉宽到 250ms,不可接受。故本调度器只累积【选项 delta】,
//   派发时点经 getFreshBase() 重取当下最新 fields(类组件 this.props 是 live 引用,
//   trailing 闭包取到的恒为最新),payload = {...fresh, ...delta}:时间键恒最新,选项键恒完整。
// 乱序由 fetchByFields 的 fieldsEpoch 兜(旧响应作废);关开关=每次选项各发各的旧行为。
import { optionDebounceEnabled } from './perfFlags';

const WINDOW_MS = 250;

let trailingTimer = null;
let leadingAt = 0;
let pendingDelta = null;
let pendingFire = null;

function fireNow(dispatchFn, getFreshBase, delta){
	const base = typeof getFreshBase === 'function' ? getFreshBase() : null;
	dispatchFn(base ? { ...base, ...delta } : { ...delta });
}

/**
 * @param {function} dispatchFn 收 payload、执行真派发
 * @param {object} delta 本次变更的字段增量(仅本控件改的键,形如 {key:{value,name}})
 * @param {function} getFreshBase 派发时点重取最新全量 fields(通常 ()=>({...this.props.fields}))
 */
export function scheduleOptionDispatch(dispatchFn, delta, getFreshBase){
	if(!optionDebounceEnabled()){
		fireNow(dispatchFn, getFreshBase, delta || {});
		return;
	}
	const nowTs = Date.now();
	if(!trailingTimer && nowTs - leadingAt > WINDOW_MS){
		leadingAt = nowTs;
		fireNow(dispatchFn, getFreshBase, delta || {});
		return;
	}
	pendingDelta = { ...(pendingDelta || {}), ...(delta || {}) };
	pendingFire = { dispatchFn, getFreshBase };
	if(trailingTimer){
		clearTimeout(trailingTimer);
	}
	trailingTimer = setTimeout(()=>{
		leadingAt = Date.now();
		trailingTimer = null;
		const fire = pendingFire;
		const acc = pendingDelta;
		pendingFire = null;
		pendingDelta = null;
		if(fire){
			fireNow(fire.dispatchFn, fire.getFreshBase, acc || {});
		}
	}, WINDOW_MS);
}

/** 测试用:清调度器内部态,防用例间串扰。 */
export function __resetOptionDispatchScheduler(){
	if(trailingTimer){
		clearTimeout(trailingTimer);
		trailingTimer = null;
	}
	leadingAt = 0;
	pendingDelta = null;
	pendingFire = null;
}
