import { createStreamFlusher, STREAM_FLUSH_INTERVAL_MS } from '../aiStreamFlush';

// 可控计时器:不依赖 jest fake timers,直接手动推进。
function makeClock(){
	const timers = new Map();
	let seq = 0;
	return {
		setTimer: (fn, ms)=>{ const id = ++seq; timers.set(id, { fn, ms }); return id; },
		clearTimer: (id)=>{ timers.delete(id); },
		fire(){ const entries = [...timers.entries()]; timers.clear(); entries.forEach(([, t])=>t.fn()); },
		size(){ return timers.size; },
	};
}

describe('aiStreamFlush · 流式增量合帧', ()=>{
	test('一个窗口内的 N 次 delta 只落一帧,且只挂一个计时器', ()=>{
		const clock = makeClock();
		let buf = '';
		const seen = [];
		const f = createStreamFlusher(()=>seen.push(buf), { setTimer: clock.setTimer, clearTimer: clock.clearTimer });
		for(let i = 0; i < 300; i++){ buf += 'x'; f.schedule(); }
		expect(clock.size()).toBe(1);
		expect(seen).toEqual([]);
		clock.fire();
		expect(seen).toEqual(['x'.repeat(300)]);
		expect(f.stats()).toEqual({ flushes: 1, scheduled: 300, intervalMs: STREAM_FLUSH_INTERVAL_MS });
	});

	test('flush() 同步落末帧并清计时器;无待落内容时不重复触发', ()=>{
		const clock = makeClock();
		let buf = '';
		const seen = [];
		const f = createStreamFlusher(()=>seen.push(buf), { setTimer: clock.setTimer, clearTimer: clock.clearTimer });
		buf = 'a'; f.schedule();
		buf = 'ab'; f.schedule();
		f.flush();
		expect(seen).toEqual(['ab']);
		expect(clock.size()).toBe(0);
		f.flush();
		expect(seen).toEqual(['ab']);
		clock.fire();
		expect(seen).toEqual(['ab']);
	});

	test('cancel() 丢弃待落帧;之后 schedule 仍可正常工作', ()=>{
		const clock = makeClock();
		let buf = '';
		const seen = [];
		const f = createStreamFlusher(()=>seen.push(buf), { setTimer: clock.setTimer, clearTimer: clock.clearTimer });
		buf = 'half'; f.schedule();
		f.cancel();
		expect(f.hasPending()).toBe(false);
		clock.fire();
		expect(seen).toEqual([]);
		buf = 'again'; f.schedule();
		clock.fire();
		expect(seen).toEqual(['again']);
	});

	test('窗口落帧后再来的 delta 开新窗口(两窗口=两帧)', ()=>{
		const clock = makeClock();
		let buf = '';
		const seen = [];
		const f = createStreamFlusher(()=>seen.push(buf), { intervalMs: 10, setTimer: clock.setTimer, clearTimer: clock.clearTimer });
		buf = '1'; f.schedule(); clock.fire();
		buf = '12'; f.schedule(); buf = '123'; f.schedule(); clock.fire();
		expect(seen).toEqual(['1', '123']);
		expect(f.stats().intervalMs).toBe(10);
	});

	test('缺省走真实 setTimeout,80ms 内合并', async ()=>{
		let buf = '';
		const seen = [];
		const f = createStreamFlusher(()=>seen.push(buf));
		for(let i = 0; i < 50; i++){ buf += 'y'; f.schedule(); }
		await new Promise((r)=>setTimeout(r, STREAM_FLUSH_INTERVAL_MS + 40));
		expect(seen).toEqual(['y'.repeat(50)]);
	});
});
