// [R5 P0-1] 前端启动账本上报金标:无桥 no-op / 段名合法性 / 每段只记一次 / 有桥时按约定形状 invoke。
jest.mock('../aiAnalysisDesktop', ()=>({
	isDesktopBridgeAvailable: jest.fn(()=>false),
	invokeDesktopCommand: jest.fn(async ()=>true),
}));
import { isDesktopBridgeAvailable, invokeDesktopCommand } from '../aiAnalysisDesktop';
import { markWebLedger, WEB_LEDGER_SEGS, __resetWebLedgerForTest, markStaticCacheStats } from '../startupLedger';

describe('[R5 P0-1] startupLedger', ()=>{
	beforeEach(()=>{ __resetWebLedgerForTest(); isDesktopBridgeAvailable.mockReturnValue(false); invokeDesktopCommand.mockClear(); });

	test('无桥(浏览器 preview / 公网构建):同步 no-op,零 invoke', ()=>{
		expect(markWebLedger('web.umi_exec')).toBe(false);
		expect(invokeDesktopCommand).not.toHaveBeenCalled();
	});

	test('段名必须形如 web.xxx:非法段名不上报(即便有桥)', ()=>{
		isDesktopBridgeAvailable.mockReturnValue(true);
		['rust.emit_ready', 'web.', 'web.Bad-Name', '', null, 'web.' + 'a'.repeat(41)].forEach((bad)=>{
			expect(markWebLedger(bad)).toBe(false);
		});
		expect(invokeDesktopCommand).not.toHaveBeenCalled();
	});

	test('有桥:按约定形状 invoke(seg / atEpochMs / extra.sinceNavMs),同段第二次 no-op', ()=>{
		isDesktopBridgeAvailable.mockReturnValue(true);
		expect(markWebLedger(WEB_LEDGER_SEGS.firstRender, { via: 'probe' })).toBe(true);
		expect(markWebLedger(WEB_LEDGER_SEGS.firstRender)).toBe(false);
		expect(invokeDesktopCommand).toHaveBeenCalledTimes(1);
		const [cmd, args] = invokeDesktopCommand.mock.calls[0];
		expect(cmd).toBe('web_ledger_mark_command');
		expect(args.seg).toBe('web.first_render');
		expect(typeof args.atEpochMs).toBe('number');
		expect(args.extra.via).toBe('probe');
		expect(typeof args.extra.sinceNavMs).toBe('number');
	});

	test('老壳无此命令(invoke 拒绝)不抛', async ()=>{
		isDesktopBridgeAvailable.mockReturnValue(true);
		invokeDesktopCommand.mockRejectedValueOnce(new Error('command not found'));
		expect(markWebLedger('web.nav_interactive')).toBe(true);
		await new Promise((r)=>setTimeout(r, 0));
	});

	test('约定段名全部合法(五段启动时刻 + R5 N2 静态缓存观测段)', ()=>{
		isDesktopBridgeAvailable.mockReturnValue(true);
		const segs = Object.values(WEB_LEDGER_SEGS);
		expect(segs.length).toBe(6);
		expect(segs).toContain('web.static_cache');
		segs.forEach((seg)=>{ expect(markWebLedger(seg)).toBe(true); });
		expect(invokeDesktopCommand).toHaveBeenCalledTimes(segs.length);
	});
});

// [R5 N2] 静态缓存命中观测:同源 js/css 里「零传输、有解码」= 命中;跨源与非静态不计;无 Resource Timing → null
describe('[R5 N2] markStaticCacheStats', ()=>{
	const origGet = performance.getEntriesByType;
	afterEach(()=>{ performance.getEntriesByType = origGet; __resetWebLedgerForTest(); });
	test('统计口径', ()=>{
		const origin = location.origin;
		performance.getEntriesByType = ()=>[
			{ name: `${origin}/umi.js`, transferSize: 0, decodedBodySize: 1000 },
			{ name: `${origin}/p__index.css`, transferSize: 300, decodedBodySize: 900 },
			{ name: `${origin}/fonts/a.woff2`, transferSize: 0, decodedBodySize: 50 },
			{ name: `${origin}/chart`, transferSize: 0, decodedBodySize: 10 },              // 非静态资源
			{ name: 'http://127.0.0.1:9999/x.js', transferSize: 0, decodedBodySize: 10 },   // 跨源
			{ name: `${origin}/empty.js`, transferSize: 0, decodedBodySize: 0 },           // 零解码 = 不算命中
		];
		expect(markStaticCacheStats()).toEqual({ hit: 2, total: 4, cachedBytes: 1050, totalBytes: 1950 });
	});
	test('无 Resource Timing 静默', ()=>{
		performance.getEntriesByType = undefined;
		expect(markStaticCacheStats()).toBeNull();
	});
});

