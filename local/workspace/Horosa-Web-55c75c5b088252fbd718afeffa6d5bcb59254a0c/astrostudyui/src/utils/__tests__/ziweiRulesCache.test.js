jest.mock('../request', ()=>jest.fn());

import request from '../request';
import { ziweirulesCached, clearZiweiRulesCache } from '../../services/rules';

// 紫微 rules 会话缓存自检:命中只发一次、inflight 去重、失败不缓存、按 body 分键、kill-switch 直通。
describe('ziweirulesCached 会话缓存', ()=>{
	beforeEach(()=>{
		request.mockReset();
		clearZiweiRulesCache();
		window.localStorage.clear();
	});

	it('同 body 多次调用只发一次请求,结果一致', async ()=>{
		request.mockResolvedValue({ Result: { rules: ['r1'] } });
		const a = await ziweirulesCached({});
		const b = await ziweirulesCached({});
		expect(request).toHaveBeenCalledTimes(1);
		expect(a).toBe(b);
	});

	it('并发首排 inflight 去重:resolve 前两次调用仍只发一次', async ()=>{
		let resolveFn;
		request.mockReturnValue(new Promise((res)=>{ resolveFn = res; }));
		const p1 = ziweirulesCached({});
		const p2 = ziweirulesCached({});
		expect(request).toHaveBeenCalledTimes(1);
		resolveFn({ Result: {} });
		await Promise.all([p1, p2]);
	});

	it('失败不缓存:第一次 reject 后再次调用照常重试', async ()=>{
		request.mockRejectedValueOnce(new Error('network down'));
		await expect(ziweirulesCached({})).rejects.toThrow('network down');
		request.mockResolvedValueOnce({ Result: { ok: 1 } });
		const r = await ziweirulesCached({});
		expect(r.Result.ok).toBe(1);
		expect(request).toHaveBeenCalledTimes(2);
	});

	it('🔴 吞错型失败(resolve undefined)同样不缓存:抛错+下次重试(防会话投毒)', async ()=>{
		// request() 网络层失败会吞错 resolve undefined(非 reject);若被当成功缓存,
		// App 启动 prime(后端温启动中)一次失败即毒化整个会话——紫微选项永远选不中。
		request.mockResolvedValueOnce(undefined);
		await expect(ziweirulesCached({})).rejects.toThrow('响应为空');
		request.mockResolvedValueOnce({ Result: { ok: 2 } });
		const r = await ziweirulesCached({});
		expect(r.Result.ok).toBe(2);
		expect(request).toHaveBeenCalledTimes(2);   // 第二次真发了请求 = 未被投毒
	});

	it('不同 body 分键缓存(后端将来带参也天然正确)', async ()=>{
		request.mockResolvedValue({ Result: {} });
		await ziweirulesCached({});
		await ziweirulesCached({ school: 'x' });
		expect(request).toHaveBeenCalledTimes(2);
	});

	it('clearZiweiRulesCache 失效缓存', async ()=>{
		request.mockResolvedValue({ Result: {} });
		await ziweirulesCached({});
		clearZiweiRulesCache();
		await ziweirulesCached({});
		expect(request).toHaveBeenCalledTimes(2);
	});

	it('kill-switch(horosa.perf.ziweiRulesCache=0) → 每次直通请求', async ()=>{
		window.localStorage.setItem('horosa.perf.ziweiRulesCache', '0');
		try{
			request.mockResolvedValue({ Result: {} });
			await ziweirulesCached({});
			await ziweirulesCached({});
			expect(request).toHaveBeenCalledTimes(2);
		}finally{
			window.localStorage.removeItem('horosa.perf.ziweiRulesCache');
		}
	});
});
