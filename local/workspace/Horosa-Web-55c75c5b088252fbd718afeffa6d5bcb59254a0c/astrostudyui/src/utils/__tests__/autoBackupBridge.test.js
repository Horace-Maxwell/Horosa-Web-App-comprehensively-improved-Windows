// [FL-20260902-1] 壳→页面事件桥死开关:打包版无 window.__TAURI__(withGlobalTauri 默认 false)且无 capabilities
// → `__TAURI__.event.listen` 永远挂不上,壳侧每 30 分钟的自动备份 tick 从未被接收。
// 判别向量:只模拟打包版真实全局(有 __TAURI_INTERNALS__、无 __TAURI__),改前红改后绿。
import * as desktop from '../aiAnalysisDesktop';
import { bindAutoBackupTicks } from '../autoBackup';

describe('自动备份 tick 桥(打包版真实全局:仅 __TAURI_INTERNALS__)', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
		delete window.__TAURI__;
		window.__TAURI_INTERNALS__ = { invoke: jest.fn(async ()=>({})) };
		delete window.__horosaAutoBackupTick;
		delete window.__horosaPendingAutoBackupTicks;
		jest.restoreAllMocks();
	});
	afterEach(()=>{ delete window.__TAURI_INTERNALS__; });

	it('🔴 绑定后壳侧 tick 回调必须存在(不能依赖 __TAURI__.event.listen)', ()=>{
		bindAutoBackupTicks();
		expect(typeof window.__horosaAutoBackupTick).toBe('function');
	});
	it('🔴 tick 到达 → 跑一轮(trigger=timer 带 tick);绑定前的 pending tick 只补跑一轮且清空队列', async ()=>{
		const runner = jest.fn(async ()=>({ ok: true }));
		window.__horosaPendingAutoBackupTicks = [{ seq: 1 }, { seq: 2 }, { seq: 3 }];
		bindAutoBackupTicks({ runner });
		await new Promise((r)=>setTimeout(r, 5));
		expect(runner).toHaveBeenCalledTimes(1);
		expect(runner.mock.calls[0][0]).toEqual({ trigger: 'timer', tick: { seq: 3 }, pendingCount: 3 });
		expect(window.__horosaPendingAutoBackupTicks.length).toBe(0);
		window.__horosaAutoBackupTick({ seq: 4 });
		await new Promise((r)=>setTimeout(r, 5));
		expect(runner).toHaveBeenCalledTimes(2);
		expect(runner.mock.calls[1][0]).toEqual({ trigger: 'timer', tick: { seq: 4 } });
		// 壳侧投递脚本的同构模拟:无回调时入队(壳 auto_backup_tick_script 同语义)
		delete window.__horosaAutoBackupTick;
		const script = (payload)=>`(function(){var t=${JSON.stringify(payload)};if(typeof window.__horosaAutoBackupTick==='function'){try{window.__horosaAutoBackupTick(t);}catch(e){}}else{var q=window.__horosaPendingAutoBackupTicks=window.__horosaPendingAutoBackupTicks||[];q.push(t);if(q.length>8){q.splice(0,q.length-8);}}})();`;
		for(let i = 0; i < 12; i++){ window.eval(script({ seq: 100 + i })); }
		expect(window.__horosaPendingAutoBackupTicks.length).toBe(8);   // 上限 8
		bindAutoBackupTicks({ runner });
		await new Promise((r)=>setTimeout(r, 5));
		expect(runner).toHaveBeenCalledTimes(3);
		expect(runner.mock.calls[2][0].tick.seq).toBe(111);
	});
	it('默认 runner 就是真备份入口(接线不是空壳):无 runner 注入时回调触发 invokeDesktopCommand 链路或诚实落 lastResult', async ()=>{
		jest.spyOn(desktop, 'invokeDesktopCommand').mockResolvedValue([]);
		bindAutoBackupTicks();
		window.__horosaAutoBackupTick({ seq: 9 });
		await new Promise((r)=>setTimeout(r, 200));
		const last = JSON.parse(window.localStorage.getItem('horosa.backup.lastResult') || 'null');
		expect(last && typeof last === 'object').toBe(true);   // 跑到了备份本体(成功或诚实失败均写 lastResult)
		expect(last.trigger).toBe('timer');
	});
	it('非桌面环境(两全局皆无)不挂回调', ()=>{
		delete window.__TAURI_INTERNALS__;
		bindAutoBackupTicks();
		expect(window.__horosaAutoBackupTick).toBeUndefined();
	});
});
