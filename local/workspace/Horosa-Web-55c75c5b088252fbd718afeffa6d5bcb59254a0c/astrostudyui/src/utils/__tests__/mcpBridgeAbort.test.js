// [D72/D73] 外部桥超时必带取消:到点 abort 传给工具的信号(工具不再在后台跑完 = 写入不会在客户端收到超时后落地);
//   执行预算 = 客户端剩余预算 与 工具声明 timeoutMs 取小(run_analysis 声明 180 s 此前在桥路径不可达,缺省 117 s 永远封顶);
//   读面五方法带 17 s 超时(壳侧固定 20 s,页面提前收口让串行队列继续)。
import { handleAgentToolRequest, READ_FACE_TIMEOUT_MS, __resetMcpBridgeForTests } from '../aiAgent/mcpBridge';
import { setAgentEnabled } from '../aiAgent/prefs';
import { withTimeout } from '../aiAgent/withTimeout';

const MAN = [{ name: 'slow_tool', level: 'read', category: 'query' }, { name: 'create_chart_record', level: 'additive', category: 'records' }];

beforeEach(()=>{ window.localStorage.clear(); __resetMcpBridgeForTests(); setAgentEnabled(true); });

it('🔴 工具声明 timeoutMs 小于客户端预算 ⇒ 按声明值超时,且到点 abort 了 ctx.signal(工具据此停下)', async ()=>{
	let seen = null; let abortedAt = 0;
	const runTool = (name, args, ctx)=>new Promise((resolve)=>{
		seen = ctx.signal;
		ctx.signal.addEventListener('abort', ()=>{ abortedAt = Date.now(); resolve({ ok: false, code: 'E_ABORTED', message: '已停止' }); });
		setTimeout(()=>resolve({ ok: true, data: { late: true } }), 5000);
	});
	const t0 = Date.now();
	const r = await handleAgentToolRequest({ id: 1, method: 'tools/call', params: { name: 'slow_tool', arguments: {}, _meta: { timeoutMs: 6000 } } }, { exportToolManifest: ()=>MAN, getTool: ()=>({ timeoutMs: 400 }), runTool });
	const took = Date.now() - t0;
	expect(r.ok).toBe(true);
	expect(r.result.isError).toBe(true);
	expect(r.result.content[0].text).toContain('E_TOOL_TIMEOUT');
	expect(r.result.content[0].text).toContain('已中止');
	expect(took).toBeLessThan(2500);   // 不是等满客户端预算 3 s(6000−3000)
	expect(seen && seen.aborted).toBe(true);
	expect(abortedAt).toBeGreaterThan(0);
});

it('🔴 没有声明 timeoutMs ⇒ 按客户端预算(−3 s)超时,同样 abort;不超时 ⇒ 信号保持未中止', async ()=>{
	let sig = null;
	const slow = (name, args, ctx)=>new Promise((resolve)=>{ sig = ctx.signal; ctx.signal.addEventListener('abort', ()=>resolve({ ok: false, code: 'E_ABORTED' })); setTimeout(()=>resolve({ ok: true }), 5000); });
	const r = await handleAgentToolRequest({ id: 2, method: 'tools/call', params: { name: 'slow_tool', arguments: {}, _meta: { timeoutMs: 4000 } } }, { exportToolManifest: ()=>MAN, runTool: slow });
	expect(r.result.isError).toBe(true);
	expect(sig.aborted).toBe(true);
	let sig2 = null;
	const fast = async (name, args, ctx)=>{ sig2 = ctx.signal; return { ok: true, data: { x: 1 } }; };
	const ok = await handleAgentToolRequest({ id: 3, method: 'tools/call', params: { name: 'slow_tool', arguments: {} } }, { exportToolManifest: ()=>MAN, runTool: fast });
	expect(ok.result.isError).toBe(false);
	expect(sig2 && sig2.aborted).toBe(false);
});

it('withTimeout.onTimeout 到点回调一次,正常完成不回调', async ()=>{
	let n = 0;
	await expect(withTimeout(new Promise(()=>{}), 30, { onTimeout: ()=>{ n += 1; } })).rejects.toMatchObject({ code: 'E_TOOL_TIMEOUT' });
	expect(n).toBe(1);
	await expect(withTimeout(Promise.resolve(7), 30, { onTimeout: ()=>{ n += 1; } })).resolves.toBe(7);
	expect(n).toBe(1);
});

it('🔴 读面五方法带 17 s 超时:resources/list 永不返回 ⇒ -32002,串行队列继续', async ()=>{
	jest.useFakeTimers();
	try{
		const never = ()=>new Promise(()=>{});
		const p = handleAgentToolRequest({ id: 4, method: 'resources/list', params: {} }, { exportToolManifest: ()=>MAN, runTool: async ()=>({ ok: true }), listResources: never });
		for(let i = 0; i < 5; i++){ await Promise.resolve(); }
		jest.advanceTimersByTime(READ_FACE_TIMEOUT_MS + 5);
		const r = await p;
		expect(r.ok).toBe(false);
		expect(r.error.code).toBe(-32002);
		expect(r.error.message).toContain('读取超时');
	}finally{ jest.useRealTimers(); }
	const fine = await handleAgentToolRequest({ id: 5, method: 'prompts/list', params: {} }, { exportToolManifest: ()=>MAN, runTool: async ()=>({ ok: true }), listPrompts: async ()=>[{ name: 'technique:bazi' }] });
	expect(fine.ok).toBe(true);
	expect(fine.result.prompts.length).toBe(1);
});
