// [V5-A3] 影子副本闸:白名单/no-op 安全/🔴 恢复语义(仅主存缺失时写回,绝不覆盖存在的主存)
//   + 内核写路径 hook 在位(保存记录 → 镜像 invoke 真的发出)。
jest.mock('../aiAnalysisDesktop', ()=>({
	isDesktopBridgeAvailable: jest.fn(()=>false),
	invokeDesktopCommand: jest.fn(()=>Promise.resolve()),
}));
import { isDesktopBridgeAvailable, invokeDesktopCommand } from '../aiAnalysisDesktop';
import { mirrorShadowWrite, reconcileShadowOnBoot, SHADOW_MIRROR_KEYS } from '../shadowMirror';
import { upsertLocalChart } from '../localcharts';

describe('[V5-A3] 影子副本', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
		jest.clearAllMocks();
		isDesktopBridgeAvailable.mockReturnValue(false);
	});

	it('非桌面环境全程 no-op(不炸、零 invoke)', async ()=>{
		mirrorShadowWrite('horosa.localCharts.v1', '[]');
		const r = await reconcileShadowOnBoot();
		expect(r.checked).toBe(false);
		expect(invokeDesktopCommand).not.toHaveBeenCalled();
	});

	it('白名单外键绝不镜像(防任意键→壳层文件写)', ()=>{
		isDesktopBridgeAvailable.mockReturnValue(true);
		mirrorShadowWrite('horosa.liuyao.settings.v1', '{}');
		mirrorShadowWrite('anything.else', 'x');
		expect(invokeDesktopCommand).not.toHaveBeenCalled();
		expect(SHADOW_MIRROR_KEYS).toEqual([
			'horosa.localCharts.v1', 'horosa.localCases.v1',
			'horosa.localCharts.trash.v1', 'horosa.localCases.trash.v1',
		]);
	});

	it('🔴 内核写路径 hook 在位:保存记录 → shadow_store_write_command 携主库最新串发出', ()=>{
		isDesktopBridgeAvailable.mockReturnValue(true);
		upsertLocalChart({ cid: 'local-sh-1', name: '影子甲', birth: '1990-01-01 08:00:00', zone: '+08:00' });
		const calls = invokeDesktopCommand.mock.calls.filter((c)=>c[0] === 'shadow_store_write_command');
		expect(calls.length).toBeGreaterThan(0);
		const last = calls[calls.length - 1][1];
		expect(last.key).toBe('horosa.localCharts.v1');
		expect(last.text).toContain('影子甲');
		expect(last.text).toBe(window.localStorage.getItem('horosa.localCharts.v1'));
	});

	it('🔴 第二实例(阶梯口)不镜像不对账:独立数据集绝不许覆盖主实例影子(数据混串)', async ()=>{
		isDesktopBridgeAvailable.mockReturnValue(true);
		const orig = window.location;
		delete window.location;
		window.location = { ...orig, port: '38992' };
		mirrorShadowWrite('horosa.localCharts.v1', '[{"cid":"second-instance"}]');
		const r = await reconcileShadowOnBoot();
		expect(invokeDesktopCommand).not.toHaveBeenCalled();
		expect(r.checked).toBe(false);
		window.location = orig;
	});

	it('🔴 对账恢复语义:主存缺失→写回;主存在(哪怕不同)→绝不覆盖只记 diverged', async ()=>{
		isDesktopBridgeAvailable.mockReturnValue(true);
		window.localStorage.setItem('horosa.localCases.v1', '[{"cid":"local-main"}]');
		invokeDesktopCommand.mockResolvedValue({
			'horosa.localCharts.v1': '[{"cid":"local-from-shadow","name":"影子恢复"}]',
			'horosa.localCases.v1': '[{"cid":"local-shadow-old"}]',
		});
		const r = await reconcileShadowOnBoot();
		expect(r.checked).toBe(true);
		expect(r.restored).toEqual(['horosa.localCharts.v1']);
		expect(r.diverged).toEqual(['horosa.localCases.v1']);
		expect(window.localStorage.getItem('horosa.localCharts.v1')).toContain('影子恢复');
		expect(window.localStorage.getItem('horosa.localCases.v1')).toBe('[{"cid":"local-main"}]');
	});
});
