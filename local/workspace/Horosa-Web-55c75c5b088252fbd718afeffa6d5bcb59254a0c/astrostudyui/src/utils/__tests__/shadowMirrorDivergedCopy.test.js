// 影子副本启动对账:主存与影子两边不一致时,先请壳层把影子那份另存一份(shadow/<键>.diverged-<时刻>.json),
// 之后不论是「以本机为准」还是下一次保存覆盖影子,对账那一刻的影子内容都还在。两边相同 / 主存缺失写回时不另存。
jest.mock('../aiAnalysisDesktop', ()=>({
	isDesktopBridgeAvailable: jest.fn(()=>true),
	invokeDesktopCommand: jest.fn(()=>Promise.resolve()),
}));
import { invokeDesktopCommand } from '../aiAnalysisDesktop';
import { reconcileShadowOnBoot, __resetShadowMirrorForTests } from '../shadowMirror';

const CHARTS = 'horosa.localCharts.v1';
const CASES = 'horosa.localCases.v1';
const TRASH = 'horosa.localCases.trash.v1';
const calls = (cmd)=>invokeDesktopCommand.mock.calls.filter((c)=>c[0] === cmd).map((c)=>c[1]);

describe('影子副本:两边不一致先另存影子那份', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
		jest.clearAllMocks();
		__resetShadowMirrorForTests();
	});

	it('不一致的键(不论影子里有没有更新的条目)各请壳层另存一次;相同 / 写回的键不另存', async ()=>{
		window.localStorage.setItem(CHARTS, JSON.stringify([{ cid: 'm1', updateTime: '2026-10-01 10:00:00' }]));
		window.localStorage.setItem(CASES, JSON.stringify([{ cid: 'c1', updateTime: '2026-10-19 10:00:00' }]));
		window.localStorage.setItem(TRASH, '[]');
		invokeDesktopCommand.mockResolvedValueOnce({
			[CHARTS]: JSON.stringify([{ cid: 'm1', updateTime: '2026-10-19 09:00:00' }]),   // 影子更新
			[CASES]: JSON.stringify([{ cid: 'c1', updateTime: '2026-10-01 10:00:00' }]),    // 本机更新
			[TRASH]: '[]',                                                                  // 相同
			'horosa.localCharts.trash.v1': '[{"cid":"t"}]',                                 // 主存缺失 → 写回
		});
		const r = await reconcileShadowOnBoot();
		expect(r.diverged.sort()).toEqual([CASES, CHARTS].sort());
		expect(calls('shadow_store_keep_diverged_command').map((a)=>a.key).sort()).toEqual([CASES, CHARTS].sort());
	});

	it('壳层另存失败不影响对账结果(静默)', async ()=>{
		window.localStorage.setItem(CHARTS, '[{"cid":"a"}]');
		invokeDesktopCommand.mockImplementation((cmd)=>(cmd === 'shadow_store_read_all_command'
			? Promise.resolve({ [CHARTS]: '[{"cid":"b"}]' })
			: Promise.reject(new Error('no such command'))));
		const r = await reconcileShadowOnBoot();
		expect(r.checked).toBe(true);
		expect(r.diverged).toEqual([CHARTS]);
		await Promise.resolve();
		expect(window.localStorage.getItem(CHARTS)).toBe('[{"cid":"a"}]');
	});
});
