// 择日宿主载入存案还原工作台态(共享件):payload.zeri → state 补丁;存档负载补 geo/options/natal/pickText。
import { zeriPayloadToStatePatch, buildZeriCasePayload } from '../zeriCaseRestore';

describe('zeriPayloadToStatePatch', ()=>{
	test('cfg/geo/options/natal/pickText/tree/results 全还原;缺键不写', ()=>{
		const state = { cfg: { startDate: '2026/01/01', startTime: '00:00' }, geo: { zone: '+08:00' }, options: { timeAlg: 1 }, natal: null };
		const zeri = {
			cfg: { startDate: '2026/09/01', endDate: '2026/09/03' },
			geo: { zone: '+09:00', gpsLon: 139.7 },
			options: { timeAlg: 0 },
			natal: { yearGZ: '庚午' },
			pickText: '2026-09-02 13:00:00',
			tree: { children: [{ type: 'x' }] },
			results: [{ start: '2026-09-02 12:00' }],
			truncated: true,
		};
		const next = zeriPayloadToStatePatch(zeri, state);
		expect(next.cfg).toEqual({ startDate: '2026/09/01', startTime: '00:00', endDate: '2026/09/03' });
		expect(next.geo).toEqual({ zone: '+09:00', gpsLon: 139.7 });
		expect(next.options).toEqual({ timeAlg: 0 });
		expect(next.natal).toEqual({ yearGZ: '庚午' });
		expect(next.pickText).toBe('2026-09-02 13:00:00');
		expect(next.tree.children.length).toBe(1);
		expect(next.results.length).toBe(1);
		expect(next.truncated).toBe(true);
		// 没有本命这一项的宿主(黄历 / 印度 / 七政):外来存案里的本命不收(此前收进来,再存一次原样带出去)
		const st2 = { ...state }; delete st2.natal;
		expect(zeriPayloadToStatePatch(zeri, st2)).not.toHaveProperty('natal');
		// 数组形的本命(外来 / 手改档)不当本命收,按「没有本命」清掉会话本命(否则再存一次会把会话本命写进这条存案)
		expect(zeriPayloadToStatePatch({ natal: [], pickText: 'x' }, { ...state, natal: { yearGZ: '甲子' } }).natal).toBe(null);
		expect(zeriPayloadToStatePatch({ natal: [], pickText: 'x' }, st2)).not.toHaveProperty('natal');
	});

	test('旧存档(只有 cfg/tree/results)也可还原;空负载返回 null', ()=>{
		const next = zeriPayloadToStatePatch({ cfg: { startDate: '2026/09/01' }, tree: { children: [] }, results: [] }, {});
		expect(Object.keys(next).sort()).toEqual(['cfg', 'results', 'tree', 'truncated']);
		expect(zeriPayloadToStatePatch(null, {})).toBe(null);
		expect(zeriPayloadToStatePatch({}, {})).toBe(null);
	});
});

describe('buildZeriCasePayload', ()=>{
	test('冻结扫描态优先,补 geo/options/natal/pickText', ()=>{
		const host = {
			state: { cfg: { startDate: 'live' }, tree: { children: ['live'] }, results: [1], truncated: false, geo: { zone: '+08:00' }, options: { timeAlg: 1 }, natal: { a: 1 }, pickText: '2026-09-02 13:00:00' },
			_scanCfg: { startDate: 'frozen' }, _scanUiTree: { children: ['frozen'] }, _scanGeo: { zone: '+00:00' }, _scanOptions: { timeAlg: 0 },
		};
		const p = buildZeriCasePayload(host);
		expect(p.cfg.startDate).toBe('frozen');
		expect(p.tree.children[0]).toBe('frozen');
		expect(p.geo.zone).toBe('+00:00');
		expect(p.options.timeAlg).toBe(0);
		expect(p.natal).toEqual({ a: 1 });
		expect(p.pickText).toBe('2026-09-02 13:00:00');
		expect(p.results).toEqual([1]);
	});
	test('无 geo/options 的宿主(黄历)不产该键', ()=>{
		const p = buildZeriCasePayload({ state: { cfg: { startDate: 'x' }, tree: { children: [] }, results: null } });
		expect(p).not.toHaveProperty('geo');
		expect(p).not.toHaveProperty('options');
		expect(p).not.toHaveProperty('pickText');
	});
});

describe('载入存案后宿主重排', ()=>{
	test('🔴 还原后调宿主的 replotAfterRestore(紫微 / 八字 / 七政 / 印度);底板用还原后的工作台活值(不沿用本会话扫描的冻结口径)', ()=>{
		jest.resetModules();
		jest.doMock('../../../utils/storageutil', ()=>({ ...jest.requireActual('../../../utils/storageutil'), getStore: ()=>({ user: { caseApplySeq: 1, appliedCaseCid: 'z1', currentCase: {
			cid: { value: 'z1' }, updateTime: { value: 't' }, caseType: { value: 'ziweizeri' }, sourceModule: { value: 'ziweizeri' },
			payload: { value: JSON.stringify({ zeri: { pickText: '2026-09-02 13:00:00', geo: { zone: '+08:00' } } }) } } } }) }));
		const { restoreZeriWorkbenchFromCase } = require('../zeriCaseRestore');
		let replot = 0;
		const host = { state: { embedPatch: {}, embedRev: 0 }, _plotFrozen: true, setState(p, cb){ this.state = { ...this.state, ...p }; if(cb){ cb(); } }, replotAfterRestore(){ replot += 1; } };
		expect(restoreZeriWorkbenchFromCase(host, 'ziweizeri')).toBe(true);
		expect(host.state.pickText).toBe('2026-09-02 13:00:00');
		expect(host._plotFrozen).toBe(false);
		expect(replot).toBe(1);
		expect(restoreZeriWorkbenchFromCase(host, 'ziweizeri')).toBe(false);   // 同一次载入不重复
		expect(replot).toBe(1);
		jest.dontMock('../../../utils/storageutil');
		const fs = require('fs'); const path = require('path');
		['ZiweiZeriMain', 'BaziZeriMain', 'QizhengZeriMain', 'IndiaZeriMain'].forEach((f)=>{
			expect(fs.readFileSync(path.join(__dirname, `../${f}.js`), 'utf8')).toContain('replotAfterRestore(){');
		});
	});
});

describe('载入存案还原扫描冻结口径', ()=>{
	const mkStore = (zeri)=>({ user: { caseApplySeq: 1, appliedCaseCid: 'z2', currentCase: {
		cid: { value: 'z2' }, updateTime: { value: 't2' }, caseType: { value: 'ziweizeri' }, sourceModule: { value: 'ziweizeri' },
		payload: { value: JSON.stringify({ zeri }) } } } });
	const mkHost = ()=>({
		state: { embedPatch: {}, embedRev: 0, cfg: { startDate: 'live' }, results: [{ t: 'old' }] },
		_scanCfg: { startDate: 'S1' }, _scanGeo: { lon: 'S1' }, _scanOptions: { o: 'S1' }, _scanNatal: null, _scanTree: { old: 1 }, _scanUiJson: 'S1',
		setState(p, cb){ this.state = { ...this.state, ...p }; if(cb){ cb(); } },
		compileScanTree(tree){ return { compiled: tree.children.length }; },
		uiJsonOf(q){ return JSON.stringify({ cfg: q.cfg, geo: q.geo, options: q.options, tree: q.tree }); },
		currentUiJson(){ return this.uiJsonOf(this.state); },
	});
	test('🔴 存案带结果:_scan* 换成存档的扫描口径、条件树按宿主编译器重编,「结果已过期」判据对得上存案', ()=>{
		jest.resetModules();
		const zeri = { cfg: { startDate: '2026-09-01' }, geo: { lon: '121e28', zone: '+08:00' }, options: { gender: 0 }, tree: { op: 'and', children: [{ k: 1 }, { k: 2 }] }, results: [{ t: 'case' }] };
		jest.doMock('../../../utils/storageutil', ()=>({ ...jest.requireActual('../../../utils/storageutil'), getStore: ()=>mkStore(zeri) }));
		const { restoreZeriWorkbenchFromCase } = require('../zeriCaseRestore');
		const host = mkHost();
		expect(restoreZeriWorkbenchFromCase(host, 'ziweizeri')).toBe(true);
		expect(host._scanCfg.startDate).toBe('2026-09-01');
		expect(host._scanGeo.lon).toBe('121e28');
		expect(host._scanOptions.gender).toBe(0);
		expect(host._scanTree).toEqual({ compiled: 2 });
		expect(host._scanUiTree).toEqual(zeri.tree);
		expect(host._scanUiJson).toBe(host.currentUiJson());   // 未改工作台 → 不算过期
		expect(host.state.results).toEqual([{ t: 'case' }]);
		jest.dontMock('../../../utils/storageutil');
	});
	test('存案没带结果:结果列表与扫描冻结一起清空', ()=>{
		jest.resetModules();
		jest.doMock('../../../utils/storageutil', ()=>({ ...jest.requireActual('../../../utils/storageutil'), getStore: ()=>mkStore({ pickText: '2026-09-02 13:00:00', geo: { zone: '+08:00' } }) }));
		const { restoreZeriWorkbenchFromCase } = require('../zeriCaseRestore');
		const host = mkHost();
		expect(restoreZeriWorkbenchFromCase(host, 'ziweizeri')).toBe(true);
		expect(host.state.results).toBeNull();   // 「没扫过」,不是「扫过、0 命中」([] 会显示「无满足条件的时辰」,再存还会固化成扫过)
		expect([host._scanCfg, host._scanGeo, host._scanOptions, host._scanTree, host._scanUiJson]).toEqual([null, null, null, null, '']);
		jest.dontMock('../../../utils/storageutil');
		const fs = require('fs'); const path = require('path');
		['ZiweiZeriMain', 'BaziZeriMain', 'QizhengZeriMain', 'IndiaZeriMain', 'HuangliZeriMain'].forEach((f)=>{
			expect(fs.readFileSync(path.join(__dirname, `../${f}.js`), 'utf8')).toContain('compileScanTree(tree){');
		});
	});
});

describe('黄历择日载入存案:跳回存案那一天', ()=>{
	test('还原工作台后按存案时刻跳到所选日', ()=>{
		jest.resetModules();
		const DateTime = require('../../comp/DateTime').default;
		const dv = new DateTime().parse('2026-11-08 12:00:00', 'YYYY-MM-DD HH:mm:ss');
		jest.doMock('../../../utils/storageutil', ()=>({ ...jest.requireActual('../../../utils/storageutil'), getStore: ()=>({ user: { caseApplySeq: 1, appliedCaseCid: 'hl1', currentCase: {
			cid: { value: 'hl1' }, updateTime: { value: 't' }, caseType: { value: 'huanglizeri' }, sourceModule: { value: 'huanglizeri' }, divTime: { value: dv },
			payload: { value: JSON.stringify({ zeri: { cfg: { startDate: '2026-11-01' }, tree: { op: 'and', children: [] }, results: [] } }) } } } }) }));
		const H = require('../HuangliZeriMain').default;
		const h = new H({ dispatch: jest.fn() });
		h.setState = function(p, cb){ this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; if(cb){ cb(); } };
		const picked = [];
		h.huangliRef = { pickAuspiciousDay: (ymd)=>picked.push(ymd) };
		h.componentDidMount();
		expect(picked).toEqual(['2026-11-08']);
		jest.dontMock('../../../utils/storageutil');
	});
});

describe('扫描途中载入存案 / 本命口径 / 条件树编译不出', ()=>{
	const mkStore = (zeri)=>({ user: { caseApplySeq: 7, appliedCaseCid: 'z9', currentCase: {
		cid: { value: 'z9' }, updateTime: { value: 't9' }, caseType: { value: 'ziweizeri' }, sourceModule: { value: 'ziweizeri' },
		payload: { value: JSON.stringify({ zeri }) } } } });
	const mkHost = (extra)=>({
		state: { embedPatch: {}, embedRev: 0, cfg: { startDate: 'live' }, results: [{ t: 'old' }], natal: { yearGZ: '会话里的' }, scanning: false, progress: null, ...(extra || {}) },
		_scanCfg: null, _scanGeo: null, _scanOptions: null, _scanNatal: null, _scanTree: null, _scanUiJson: '',
		setState(p, cb){ this.state = { ...this.state, ...p }; if(cb){ cb(); } },
		compileScanTree(tree){ return { compiled: tree.children.length }; },
		uiJsonOf(q){ return JSON.stringify({ cfg: q.cfg, natal: q.natal, tree: q.tree }); },
		currentUiJson(){ return this.uiJsonOf(this.state); },
	});
	const load = (zeri)=>{
		jest.resetModules();
		jest.doMock('../../../utils/storageutil', ()=>({ ...jest.requireActual('../../../utils/storageutil'), getStore: ()=>mkStore(zeri) }));
		const mod = require('../zeriCaseRestore');
		jest.dontMock('../../../utils/storageutil');
		return mod;
	};
	test('🔴 正在扫描时载入存案:取消在途扫描、作废运行代次、收起扫描态;之后那次扫描的进度 / 结果判为过时', ()=>{
		const mod = load({ cfg: { startDate: '2026-09-01' }, tree: { children: [{ k: 1 }] }, results: [{ t: 'case' }] });
		let cancelled = 0;
		const host = { ...mkHost({ scanning: true, progress: { done: 3 } }), cancelScan(){ cancelled += 1; } };
		const run = mod.beginScanRun(host);
		expect(mod.restoreZeriWorkbenchFromCase(host, 'ziweizeri')).toBe(true);
		expect(cancelled).toBe(1);
		expect(mod.scanRunIsCurrent(host, run)).toBe(false);
		expect([host.state.scanning, host.state.progress]).toEqual([false, null]);
		expect(host.state.results).toEqual([{ t: 'case' }]);
		expect(mod.scanRunIsCurrent(host, mod.beginScanRun(host))).toBe(true);   // 之后新开的扫描照常
	});
	test('五个宿主的扫描回调都判运行代次(进度 / 结果 / 收尾)', ()=>{
		const fs = require('fs'); const path = require('path');
		['BaziZeriMain', 'ZiweiZeriMain', 'HuangliZeriMain', 'QizhengZeriMain', 'IndiaZeriMain'].forEach((f)=>{
			const src = fs.readFileSync(path.join(__dirname, `../${f}.js`), 'utf8');
			const body = src.slice(src.indexOf('async runSearch(){'), src.indexOf('cancelScan(){'));
			expect([f, body.includes('const run = beginScanRun(this);')]).toEqual([f, true]);
			expect([f, (body.match(/scanRunIsCurrent\(this, run\)/g) || []).length]).toEqual([f, 3]);
		});
	});
	test('存案显式记了「没有本命」:清空会话里的本命;没有本命这一项的宿主不写', ()=>{
		const { zeriPayloadToStatePatch } = load({});
		expect(zeriPayloadToStatePatch({ natal: null, pickText: 'x' }, { natal: { a: 1 } }).natal).toBeNull();
		expect(zeriPayloadToStatePatch({ natal: null, pickText: 'x' }, {})).not.toHaveProperty('natal');
		// 旧存案没写这个键:同样清空(会话里上一位的本命不挂到这条下面)
		expect(zeriPayloadToStatePatch({ pickText: 'x' }, { natal: { a: 1 } }).natal).toBeNull();
	});
	test('存的本命 = 扫描冻结值(结果按它扫的);没扫过 = 当前值;没有本命 = 显式 null', ()=>{
		const { buildZeriCasePayload } = load({});
		const base = { state: { cfg: {}, tree: { children: [] }, results: [], natal: { yearGZ: '改过的' } } };
		expect(buildZeriCasePayload({ ...base, _scanUiJson: 'S', _scanNatal: { yearGZ: '扫描时的' } }).natal).toEqual({ yearGZ: '扫描时的' });
		expect(buildZeriCasePayload({ ...base, _scanUiJson: 'S', _scanNatal: null }).natal).toBeNull();
		expect(buildZeriCasePayload({ ...base, _scanUiJson: '' , _scanNatal: { yearGZ: '扫描时的' } }).natal).toEqual({ yearGZ: '改过的' });
		expect(buildZeriCasePayload({ state: { ...base.state, natal: null } }).natal).toBeNull();
	});
	test('条件树编译不出(条件类型改名 / 下线):「结果已过期」照出(指纹永不相等),不静默成「未过期」', ()=>{
		const mod = load({ cfg: { startDate: '2026-09-01' }, tree: { children: [{ k: 'gone' }] }, results: [{ t: 'case' }] });
		const host = { ...mkHost(), compileScanTree(){ throw new Error('未知条件类型'); } };
		expect(mod.restoreZeriWorkbenchFromCase(host, 'ziweizeri')).toBe(true);
		expect(host._scanTree).toBeNull();
		expect(host._scanUiJson).toBe(mod.SCAN_UNCOMPILED_SENTINEL);
		expect(host._scanUiJson).not.toBe(host.currentUiJson());
	});
});

describe('载入存案:按行号缓存的判读换代 / 草稿不随存案 / 本命输入框随存案', ()=>{
	const mkStore = (zeri)=>({ user: { caseApplySeq: 11, appliedCaseCid: 'z11', currentCase: {
		cid: { value: 'z11' }, updateTime: { value: 't11' }, caseType: { value: 'qizhengzeri' }, sourceModule: { value: 'qizhengzeri' },
		payload: { value: JSON.stringify({ zeri }) } } } });
	const load = (zeri)=>{
		jest.resetModules();
		jest.doMock('../../../utils/storageutil', ()=>({ ...jest.requireActual('../../../utils/storageutil'), getStore: ()=>mkStore(zeri) }));
		const mod = require('../zeriCaseRestore');
		jest.dontMock('../../../utils/storageutil');
		return mod;
	};
	const mkHost = (extra)=>({
		state: { embedPatch: {}, embedRev: 0, cfg: { startDate: 'live' }, results: [{ t: 'old' }], scanEpoch: 3, natal: null, natalInput: { date: '会话', time: '12:00' }, ...(extra || {}) },
		_snapshotExplains: [{ old: 1 }], _explainEpoch: 5, _scanNatalInput: null,
		setState(p, cb){ this.state = { ...this.state, ...p }; if(cb){ cb(); } },
		compileScanTree(tree){ return { n: tree.children.length }; },
		uiJsonOf(q){ return JSON.stringify({ cfg: q.cfg }); },
		currentUiJson(){ return this.uiJsonOf(this.state); },
	});
	test('🔴 扫描代次换代(工作台「详情」缓存键随之换);预取缓存作废并按存案结果重新预取;没结果时宿主重存本槽快照', ()=>{
		const mod = load({ cfg: { startDate: '2026-09-01' }, tree: { children: [{ k: 1 }] }, results: [{ t: 'case' }] });
		const host = mkHost();
		const pre = [];
		host.prefetchSnapshotExplains = (rows)=>pre.push(rows);
		expect(mod.restoreZeriWorkbenchFromCase(host, 'qizhengzeri')).toBe(true);
		expect(host.state.scanEpoch).toBe(4);
		expect(host._snapshotExplains).toBeNull();
		expect(host._explainEpoch).toBe(6);
		expect(pre).toEqual([[{ t: 'case' }]]);
		const mod2 = load({ pickText: '2026-09-02 13:00:00' });
		const h2 = mkHost();
		let resaved = 0;
		h2.prefetchSnapshotExplains = ()=>{ throw new Error('不该预取'); };
		h2.composeAiSnapshot = ()=>{ resaved += 1; return '三段'; };   // 内嵌页不应答 → 写宿主三段(经 composeAiSnapshot)
		expect(mod2.restoreZeriWorkbenchFromCase(h2, 'qizhengzeri')).toBe(true);
		expect(resaved).toBe(1);
	});
	test('本命输入框随存案(扫描时那一份);旧存案没写这个键照旧不动', ()=>{
		const mod = load({ pickText: 'x', natal: { yearGZ: '庚午' }, natalInput: { date: '1990-05-18', time: '10:00' } });
		const host = mkHost();
		mod.restoreZeriWorkbenchFromCase(host, 'qizhengzeri');
		expect(host.state.natalInput).toEqual({ date: '1990-05-18', time: '10:00', zone: '+08:00', gender: 1 });   // 叠在构造缺省上
		const p = mod.buildZeriCasePayload({ state: { cfg: {}, tree: { children: [] }, results: [], natal: null, natalInput: { date: '改过的' } }, _scanUiJson: 'S', _scanNatalInput: { date: '扫描时的' } });
		expect(p.natalInput).toEqual({ date: '扫描时的' });
		// 旧存案没写这个键:输入框回构造缺省(不留会话里上一位的)
		expect(mod.zeriPayloadToStatePatch({ pickText: 'x' }, { natalInput: { date: 'a' } }).natalInput).toEqual({ date: '', time: '12:00', zone: '+08:00', gender: 1 });
	});
	test('🔴 存案记了「没有本命」又带本命输入框:本命照样清空、输入框随存案(两件互不挤掉)', ()=>{
		const st = { natal: { yearGZ: '会话' }, natalInput: { date: '会话' } };
		const next = require('../zeriCaseRestore').zeriPayloadToStatePatch({ pickText: 'x', natal: null, natalInput: { date: '1990-05-18' } }, st);
		expect(next).toHaveProperty('natal', null);
		expect(next.natalInput).toEqual({ date: '1990-05-18', time: '12:00', zone: '+08:00', gender: 1 });
		const mod = load({ pickText: 'x', natal: null, natalInput: { date: '1990-05-18', time: '10:00' } });
		const host = mkHost({ natal: { yearGZ: '会话' } });
		mod.restoreZeriWorkbenchFromCase(host, 'qizhengzeri');
		expect(host.state.natal).toBeNull();
		expect(host.state.natalInput).toEqual({ date: '1990-05-18', time: '10:00', zone: '+08:00', gender: 1 });
	});
	test('整段没有 zeri 的本宿主事盘(手建 / 改类型 / AI 建档):按空存案处理 —— 结果清成没扫过、扫描代次换代、冻结清空、没有本命', ()=>{
		const mod = load(undefined);
		const host = mkHost({ natal: { yearGZ: '会话里的' } });
		host._scanCfg = { startDate: 'S' }; host._scanUiJson = 'S';
		expect(mod.restoreZeriWorkbenchFromCase(host, 'qizhengzeri')).toBe(true);
		expect(host.state.results).toBeNull();
		expect(host.state.scanEpoch).toBe(4);
		expect(host._scanUiJson).toBe('');
		expect(host.state.natal).toBeNull();   // 会话里上一位的本命不留给这条(再存一次就写进去)
		// 没有本命这一项的宿主不加这个键
		const h2 = mkHost();
		delete h2.state.natal;
		mod.restoreZeriWorkbenchFromCase(h2, 'qizhengzeri');
		expect(h2.state).not.toHaveProperty('natal');
	});
	test('zeri 里只有内嵌页覆盖层(认得的键一个都没有):本命清掉,覆盖层照样还原', ()=>{
		const mod = load({ embedPatch: { gender: { v: 0 } } });
		const host = mkHost({ natal: { yearGZ: '会话里的' }, embedPatch: {}, embedRev: 0 });
		mod.restoreZeriWorkbenchFromCase(host, 'qizhengzeri');
		expect(host.state.natal).toBeNull();
		expect(host.state.embedPatch).toEqual({ gender: { value: 0 } });
	});
	test('zeri 在但一个认得的键都没有(只有版本号 / 数组 / 字符串):同样按空存案处理、清掉本命;认得的存案照旧', ()=>{
		for(const zeri of [{ version: 1 }, [], 'x', null]){
			const mod = load(zeri);
			const host = mkHost({ natal: { yearGZ: '会话里的' } });
			mod.restoreZeriWorkbenchFromCase(host, 'qizhengzeri');
			expect([JSON.stringify(zeri), host.state.natal, host.state.results]).toEqual([JSON.stringify(zeri), null, null]);
		}
		// 旧版存案(只有 cfg + tree,当年不存本命):本命与输入框同样清 / 回构造缺省(会话里上一位的不挂到这条下面)
		const mod = load({ cfg: { startDate: '2026-09-01' }, tree: { children: [] } });
		const host = mkHost({ natal: { yearGZ: '会话里的' } });
		mod.restoreZeriWorkbenchFromCase(host, 'qizhengzeri');
		expect(host.state.natal).toBeNull();
		expect(host.state.natalInput).toEqual({ date: '', time: '12:00', zone: '+08:00', gender: 1 });
	});
	test('带结果的存案也先重存一次本槽快照(0 命中 / 判读行数 0 时预取直接返回、不重存),再按结果预取', ()=>{
		const mod = load({ cfg: { startDate: '2026-09-01' }, tree: { children: [{ k: 1 }] }, results: [] });
		const host = mkHost();
		const order = [];
		host.composeAiSnapshot = ()=>{ order.push('resave'); return '三段'; };
		host.prefetchSnapshotExplains = (rows)=>order.push(['prefetch', rows.length]);
		mod.restoreZeriWorkbenchFromCase(host, 'qizhengzeri');
		expect(order).toEqual(['resave', ['prefetch', 0]]);
	});
	test('覆盖层里与所见那张盘不同的键(没确定、没上盘的草稿)不随存案;与所见相同的照记;取不到所见时照旧整份记', ()=>{
		const { buildZeriCasePayload } = load({});
		const DT = require('../../comp/DateTime').default;
		const mk = (s)=>{ const d = new DT(); return d.parse(s, 'YYYY-MM-DD HH:mm:ss'); };
		const st = { cfg: {}, tree: { children: [] }, results: [], embedPatch: { date: { value: mk('2001-02-03 04:05:06') }, gender: { value: 0 } } };
		const plotted = { date: { value: mk('2026-01-01 10:00:00') }, gender: { value: 0 } };
		const p = buildZeriCasePayload({ state: st }, plotted);
		expect(Object.keys(p.embedPatch)).toEqual(['gender']);
		expect(Object.keys(buildZeriCasePayload({ state: st }).embedPatch).sort()).toEqual(['date', 'gender']);
	});
});
