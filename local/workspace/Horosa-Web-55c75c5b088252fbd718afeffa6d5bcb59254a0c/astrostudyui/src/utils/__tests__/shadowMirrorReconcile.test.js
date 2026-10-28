// 影子副本启动对账的两条补强:
//  ① 主存在、内容却坏了(解析不出)而影子完好 → 主存原串留档后用影子写回(此前只记「不一致」,下一次保存把完好的影子一起盖掉)
//  ② 两边不同、影子里有主存没有 / 更新的记录(保存后立刻退出、主存没落盘)→ 暂停镜像这把键(下一次保存不盖影子),
//     用户可并回或以本机为准;主存缺失则判「存储被清空过」
jest.mock('../aiAnalysisDesktop', ()=>({
	isDesktopBridgeAvailable: jest.fn(()=>true),
	invokeDesktopCommand: jest.fn(()=>Promise.resolve()),
}));
import { invokeDesktopCommand } from '../aiAnalysisDesktop';
import { reconcileShadowOnBoot, mirrorShadowWrite, mergeShadowAhead, releaseShadowHold, getShadowMirrorStatus, __resetShadowMirrorForTests } from '../shadowMirror';

const CHARTS = 'horosa.localCharts.v1';
const CASES = 'horosa.localCases.v1';
const TRASH = 'horosa.localCharts.trash.v1';
const writes = ()=>invokeDesktopCommand.mock.calls.filter((c)=>c[0] === 'shadow_store_write_command').map((c)=>c[1]);

describe('影子副本对账补强', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
		jest.clearAllMocks();
		__resetShadowMirrorForTests();
	});

	it('① 主存坏了:原串留档、影子写回,记 restored + corrupt;不算「存储被清空」', async ()=>{
		window.localStorage.setItem(CHARTS, '[{"cid":"a"');   // 截断
		invokeDesktopCommand.mockResolvedValueOnce({ [CHARTS]: '[{"cid":"a","name":"完好"}]' });
		const r = await reconcileShadowOnBoot();
		expect(r.restored).toEqual([CHARTS]);
		expect(r.corrupt).toEqual([CHARTS]);
		expect(r.storageCleared).toBe(false);
		expect(window.localStorage.getItem(CHARTS)).toBe('[{"cid":"a","name":"完好"}]');
		const arch = Object.keys(window.localStorage).filter((k)=>k.indexOf(`horosa.corrupt.${CHARTS}.`) === 0);
		expect(arch.map((k)=>window.localStorage.getItem(k))).toEqual(['[{"cid":"a"']);
	});

	it('主存缺失 → 写回并判「存储被清空过」(横幅给从自动备份恢复的入口)', async ()=>{
		invokeDesktopCommand.mockResolvedValueOnce({ [CHARTS]: '[{"cid":"s"}]' });
		const r = await reconcileShadowOnBoot();
		expect(r.restored).toEqual([CHARTS]);
		expect(r.storageCleared).toBe(true);
	});

	it('② 影子里有本机没有 / 更新的记录:暂停镜像这把键,下一次保存不盖影子;并回后恢复镜像', async ()=>{
		window.localStorage.setItem(CHARTS, JSON.stringify([{ cid: 'm1', name: '旧', updateTime: '2026-10-01 10:00:00' }]));
		const shadow = [
			{ cid: 'last-save', name: '退出前刚存的', updateTime: '2026-10-19 10:00:00' },
			{ cid: 'm1', name: '改过的', updateTime: '2026-10-19 09:00:00' },
		];
		invokeDesktopCommand.mockResolvedValueOnce({ [CHARTS]: JSON.stringify(shadow) });
		const r = await reconcileShadowOnBoot();
		expect(r.diverged).toEqual([CHARTS]);
		expect(r.ahead).toEqual({ [CHARTS]: 2 });
		expect(getShadowMirrorStatus().held).toEqual([CHARTS]);
		invokeDesktopCommand.mockClear();
		mirrorShadowWrite(CHARTS, '[{"cid":"m1"}]');
		expect(writes()).toEqual([]);   // 影子里那份留着
		expect(mergeShadowAhead(CHARTS)).toBe(2);
		const now = JSON.parse(window.localStorage.getItem(CHARTS));
		expect(now.map((x)=>`${x.cid}:${x.name}`).sort()).toEqual(['last-save:退出前刚存的', 'm1:改过的']);
		expect(getShadowMirrorStatus().held).toEqual([]);
		expect(writes().map((w)=>w.key)).toEqual([CHARTS]);
	});

	it('以本机为准:恢复镜像并立刻用主存刷新影子', async ()=>{
		window.localStorage.setItem(CASES, '[]');
		invokeDesktopCommand.mockResolvedValueOnce({ [CASES]: '[{"cid":"c1","updateTime":"2026-10-19 10:00:00"}]' });
		await reconcileShadowOnBoot();
		invokeDesktopCommand.mockClear();
		releaseShadowHold(CASES);
		expect(writes()).toEqual([{ key: CASES, text: '[]' }]);
	});

	it('影子里多出来的只是本机已删进回收站的:不算「更新」,照旧以本机为准、不暂停镜像', async ()=>{
		window.localStorage.setItem(CHARTS, '[]');
		window.localStorage.setItem(TRASH, JSON.stringify([{ cid: 'gone', deletedAt: '2026-10-19 10:00:00' }]));
		invokeDesktopCommand.mockResolvedValueOnce({ [CHARTS]: '[{"cid":"gone"}]', [TRASH]: JSON.stringify([{ cid: 'gone', deletedAt: '2026-10-19 10:00:00' }]) });
		const r = await reconcileShadowOnBoot();
		expect(r.diverged).toEqual([CHARTS]);
		expect(r.ahead).toEqual({});
		expect(getShadowMirrorStatus().held).toEqual([]);
	});
});
