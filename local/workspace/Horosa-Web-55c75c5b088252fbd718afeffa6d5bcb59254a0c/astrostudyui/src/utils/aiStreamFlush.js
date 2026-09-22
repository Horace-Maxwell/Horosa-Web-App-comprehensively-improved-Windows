// AI 对话流式增量的「合帧」调度器:上游(尤其高吞吐模型)每秒可推送数百个 delta,若每个 delta 都
// 触发一次 React 提交 + 整段 markdown 重解析,主线程会被打满(事件环单次停顿可达秒级,停止按钮/
// 输入框全部失灵)。本器把一个时间窗内的多次 delta 合并成一次 flush;窗口缺省 80ms(≈12 帧/秒的
// 视觉更新率,肉眼无感)。零 React 依赖,便于单测。
//
// 用法:
//   const flusher = createStreamFlusher(()=>setState(bufferRef.current), { intervalMs: 80 });
//   onDelta: bufferRef.current += delta; flusher.schedule();
//   结束/出错/中止: flusher.flush()(同步落最后一帧)或 flusher.cancel()(丢弃未落帧)。
export const STREAM_FLUSH_INTERVAL_MS = 80;

export function createStreamFlusher(flushFn, options){
	const intervalMs = options && Number(options.intervalMs) > 0 ? Number(options.intervalMs) : STREAM_FLUSH_INTERVAL_MS;
	const setTimer = (options && options.setTimer) || ((fn, ms)=>setTimeout(fn, ms));
	const clearTimer = (options && options.clearTimer) || ((id)=>clearTimeout(id));
	let timer = null;
	let pending = false;
	let flushes = 0;
	let scheduled = 0;
	function runFlush(){
		timer = null;
		if(!pending){ return; }
		pending = false;
		flushes += 1;
		flushFn();
	}
	return {
		// 登记一次待落帧;窗口内重复登记只合并,不追加计时器。
		schedule(){
			pending = true;
			scheduled += 1;
			if(timer === null){
				timer = setTimer(runFlush, intervalMs);
			}
		},
		// 立刻同步落帧(若有待落内容),并清掉计时器。结束/出错/中止时调用,保证末尾增量不丢。
		flush(){
			if(timer !== null){ clearTimer(timer); timer = null; }
			if(pending){
				pending = false;
				flushes += 1;
				flushFn();
			}
		},
		// 丢弃待落帧(中止后不再把半截内容写回状态时用)。
		cancel(){
			if(timer !== null){ clearTimer(timer); timer = null; }
			pending = false;
		},
		hasPending(){ return pending; },
		stats(){ return { flushes, scheduled, intervalMs }; },
	};
}
