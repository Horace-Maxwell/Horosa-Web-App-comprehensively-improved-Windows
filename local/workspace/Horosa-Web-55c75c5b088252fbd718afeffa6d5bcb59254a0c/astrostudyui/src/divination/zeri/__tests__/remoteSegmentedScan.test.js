// [十二轮] 远端家分段编排契约(七政/印度共用 runSegmentedRemoteScan)——用户实报
// 「395 天被 93 天单请求上限拒」的根修资产。py 端 93 天限保留为单段防呆(段=自然月)。
import { runSegmentedRemoteScan } from '../scanOrchestrator';

const basePayload = {
	startDate: '2026-08-31', startTime: '00:00:00', endDate: '2027-09-29', endTime: '23:59:59',
	zone: '+08:00', gpsLat: 39.9, gpsLon: 116.46, conditions: { type: 'all', conditions: [] },
};

describe('[十二轮] runSegmentedRemoteScan', ()=>{
	it('🔴 395 天 → 十四个自然月段;每段日期归一为 - 分隔且 ≤93 天(py 防呆永不触)', async ()=>{
		const bodies = [];
		const fetchFn = jest.fn(async (body)=>{ bodies.push(body); return { intervals: [], truncated: false, stats: { evalPoints: 10 } }; });
		const out = await runSegmentedRemoteScan({ payload: basePayload, fetchFn });
		expect(fetchFn.mock.calls.length).toBe(14);
		expect(out.stats.segments).toBe(14);
		expect(out.stats.evalPoints).toBe(140);
		bodies.forEach((b)=>{
			expect(b.startDate.indexOf('/')).toBe(-1);
			expect(b.endDate.indexOf('/')).toBe(-1);
			const days = (Date.parse(`${b.endDate}T00:00:00Z`) - Date.parse(`${b.startDate}T00:00:00Z`)) / 86400000;
			expect(days).toBeLessThanOrEqual(93);
			expect(b.zone).toBe('+08:00');
			expect(b.conditions).toBeTruthy();
		});
		expect(bodies[0].startDate).toBe('2026-08-31');
		expect(bodies[0].endDate).toBe('2026-09-01');
		expect(bodies[13].endDate).toBe('2027-09-29');
		expect(bodies[13].endTime).toBe('23:59:59');
	});

	it('🔴 跨段界共点合并(分钟差 ≤1);不相邻不合并;pick 保首段', async ()=>{
		const segRsp = [
			{ intervals: [{ start: '2026-08-31 20:00', end: '2026-09-01 00:00', pick: '2026-08-31 20:01' }] },
			{ intervals: [{ start: '2026-09-01 00:00', end: '2026-09-01 03:00', pick: '2026-09-01 00:01' }, { start: '2026-09-05 10:00', end: '2026-09-05 12:00', pick: '2026-09-05 10:01' }] },
		];
		let i = 0;
		const fetchFn = async ()=>segRsp[Math.min(i++, segRsp.length - 1)];
		const out = await runSegmentedRemoteScan({ payload: { ...basePayload, endDate: '2026-09-29', endTime: '23:59:59' }, fetchFn });
		expect(out.intervals.length).toBe(2);
		expect(out.intervals[0]).toEqual({ start: '2026-08-31 20:00', end: '2026-09-01 03:00', pick: '2026-08-31 20:01' });
		expect(out.intervals[1].start).toBe('2026-09-05 10:00');
	});

	it('总范围 >1830 天拒;结束早于开始拒', async ()=>{
		const fetchFn = jest.fn();
		await expect(runSegmentedRemoteScan({ payload: { ...basePayload, endDate: '2032-01-01' }, fetchFn })).rejects.toThrow('最长支持 1830 天');
		await expect(runSegmentedRemoteScan({ payload: { ...basePayload, endDate: '2026-08-01' }, fetchFn })).rejects.toThrow('时间段无效');
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it('命中达上限截断且停止后续段;进度回调逐段推进', async ()=>{
		const mk = (n, day)=>Array.from({ length: n }, (_, k)=>({ start: `2026-09-${day} 0${k % 10}:00`, end: `2026-09-${day} 0${k % 10}:30`, pick: `2026-09-${day} 0${k % 10}:01` }));
		let call = 0;
		const fetchFn = async ()=>({ intervals: mk(600, call === 0 ? '01' : '15'), truncated: false, stats: {}, _c: call++ });
		const seen = [];
		const out = await runSegmentedRemoteScan({
			payload: { ...basePayload, endDate: '2027-09-29' },
			fetchFn,
			onProgress: (p)=>seen.push([p.done, p.total, p.hits]),
		});
		expect(out.truncated).toBe(true);
		expect(call).toBe(2);	// 第二段已达 1000 上限,后 12 段不再请求
		expect(seen.length).toBe(2);
		expect(seen[1][2]).toBe(1200);
		expect(out.intervals.length).toBeLessThanOrEqual(1000);
	});

	it('abort:段间检查抛 AbortError', async ()=>{
		const ctrl = { aborted: false };
		const fetchFn = async ()=>{ ctrl.aborted = true; return { intervals: [], stats: {} }; };
		await expect(runSegmentedRemoteScan({ payload: basePayload, fetchFn, signal: ctrl })).rejects.toMatchObject({ name: 'AbortError' });
	});
});
