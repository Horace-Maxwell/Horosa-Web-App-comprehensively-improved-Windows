// 择日宿主:点结果行起的盘与扫描判定同口径(三式阴盘报数 / 六壬日界与晚子时干 / 三式六壬家时柱随奇门的时间算法)、三式工作台时间算法标奇门;
// 「存为事盘」/「编辑」后当前事盘变成另一条 —— 那不是载入(读档去重键只认显式载入),宿主与内嵌页都不据此还原(工作台没重扫的改动不被换回存档值、
// 在途扫描不被取消、盘面选项不被镜像进工作台);
// 奇门择日载入没带地点 / 参数的存案后,主盘播种 / 盘面镜像第一次填进来不亮「结果已过期」。
import fs from 'fs';
import path from 'path';
import { setGlobalStore } from '../../../utils/storageutil';
import { openKentangCaseDrawer } from '../../../utils/kentangCaseSave';
import { newQimenLeaf, newQimenGroup } from '../../../divination/zeri/qimenConditionTypes';

jest.mock('../../../services/astro', () => ({ fetchChart: jest.fn(async () => ({ Result: null })) }));

const read = (rel)=>fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('三式择日点结果行:阴盘报数随起局一起回写三式页', ()=>{
	const { default: SanshiZeriMain } = require('../SanshiZeriMain');
	const run = async (scanOptions)=>{
		let got = null;
		await SanshiZeriMain.prototype.applyWorkbenchCalibre.call({ _scanOptions: scanOptions, state: {}, sanshiHook: { applyOptions: async (p)=>{ got = p; } } });
		// 太乙家锁定三键每次都回写(盘式时计 / 钟表时 / 不用博弈),这里只看奇门报数相关的键
		const { taiyiStyle, taiyiTimeBasis, gameTheory, ...rest } = got;
		expect([taiyiStyle, taiyiTimeBasis, gameTheory]).toEqual([3, 'direct', 0]);
		return rest;
	};
	test('阴盘 + 报数 4:回写报数 4', async ()=>{
		const got = await run({ paiPanType: 3, qijuMethod: 'shuzi', shuziReportNumber: '4', school: '转盘' });
		expect(got).toEqual({ paiPanType: 3, qijuMethod: 'shuzi', shuziReportNumber: '4', school: '转盘' });
	});
	test('阴盘、报数空:回写空(三式页不留自己的报数,与扫描同局)', async ()=>{
		expect((await run({ qijuMethod: 'shuzi', shuziReportNumber: '' })).shuziReportNumber).toBe('');
		expect((await run({ qijuMethod: 'shuzi' })).shuziReportNumber).toBe('');
	});
	test('不是阴盘:不写报数(零回归)', async ()=>{
		expect(await run({ qijuMethod: 'chaibu' })).toEqual({ qijuMethod: 'chaibu' });
	});
});

test('三式择日工作台的时间算法标明是奇门的(六壬家用奇门的时柱,太乙家不收)', ()=>{
	const src = read('SanshiZeriWorkbench.js');
	expect(src).toContain("{ key: 'timeAlg', label: '时间算法(奇门)', dv: 0, options: TIME_ALG_OPTIONS }");
});

describe('六壬择日点结果行:起课带工作台的日界 / 晚子时干', ()=>{
	const { default: LiurengZeriMain } = require('../LiurengZeriMain');
	const { default: LiuRengMain } = require('../../lrzhan/LiuRengMain');
	const ctx = (scanOptions, liveOptions)=>({
		state: { pickText: '2026-10-20 23:30:00', geo: { zone: '+08:00', lon: '116e24', lat: '39n54', gpsLon: 116.4, gpsLat: 39.9 }, options: liveOptions || {}, embedPatch: {} },
		_scanGeo: null,
		_scanOptions: scanOptions,
	});
	test('冻结口径 24 点换日:宿主 fields 与起课请求都带 after23NewDay = 0', ()=>{
		const f = LiurengZeriMain.prototype.buildFields.call(ctx({ after23NewDay: 0, lateZiHourUseNextDay: 0 }, { after23NewDay: 1 }), true);
		expect(f.after23NewDay.value).toBe(0);
		expect(f.lateZiHourUseNextDay.value).toBe(0);
		const params = LiuRengMain.prototype.genGodsParams.call({ props: { techniqueScope: 'liurengzeri', fields: f, value: null }, state: {} }, f);
		expect(params.after23NewDay).toBe(0);
		expect(params.lateZiHourUseNextDay).toBe(0);
	});
	test('活值底板用工作台活值;工作台没这两键时与扫描同缺省(晚子时干 = 次日干)', ()=>{
		const live = LiurengZeriMain.prototype.buildFields.call(ctx(null, { after23NewDay: 0 }), false);
		expect(live.after23NewDay.value).toBe(0);
		const bare = LiurengZeriMain.prototype.buildFields.call(ctx(null, {}), false);
		expect(bare.lateZiHourUseNextDay.value).toBe(1);
		expect([0, 1]).toContain(bare.after23NewDay.value);
	});
	test('内嵌页左栏亲手改的日界(覆盖层)仍盖在上面', ()=>{
		const c = ctx({ after23NewDay: 0 });
		c.state.embedPatch = { after23NewDay: { value: 1 } };
		expect(LiurengZeriMain.prototype.buildFields.call(c, true).after23NewDay.value).toBe(1);
	});
});

describe('存为事盘后不把刚存的那条当载入还原', ()=>{
	const { restoreZeriWorkbenchFromCase } = require('../zeriCaseRestore');
	const ZERI = { cfg: { startDate: '2026/10/01', endDate: '2026/10/31' }, geo: { zone: '+08:00', pos: '北京' }, options: { timeAlg: 0 }, tree: { children: [{ type: 'frozen' }] }, results: [{ start: '2026-10-02 10:00' }] };
	// applied:显式载入的那条(applyCase 写的 appliedCaseCid);缺省 = 就是这条;null = 没有显式载入(存为事盘 / 编辑换上来的)
	const userWith = (cid, seq, applied)=>({ user: { caseApplySeq: seq, appliedCaseCid: applied === undefined ? cid : applied, currentCase: {
		cid: { value: cid }, updateTime: { value: `t-${cid}` }, caseType: { value: 'bazizeri' }, sourceModule: { value: 'bazizeri' },
		payload: { value: JSON.stringify({ zeri: ZERI }) } } } });
	function host(state){
		const h = { state: { cfg: { startDate: '2026/10/01', endDate: '2026/11/30' }, geo: { zone: '+09:00', pos: '东京' }, options: { timeAlg: 1 }, tree: { children: [{ type: 'frozen' }, { type: 'added' }] }, results: [{ start: 'x' }], scanning: false, scanEpoch: 0, ...(state || {}) } };
		h.setState = function(p, cb){ const patch = typeof p === 'function' ? p(this.state) : p; if(patch){ this.state = { ...this.state, ...patch }; } if(cb){ cb(); } };
		h.replotted = 0;
		h.replotAfterRestore = ()=>{ h.replotted += 1; };
		h.cancelled = 0;
		h.cancelScan = ()=>{ h.cancelled += 1; };
		return h;
	}
	afterEach(()=>{ setGlobalStore({}); });

	test('🔴 择日宿主:存完不还原(工作台改动留着、在途扫描不取消);之后在列表里载入这条照常还原', ()=>{
		setGlobalStore({ user: { caseApplySeq: 3, currentCase: null } });
		const h = host();
		expect(restoreZeriWorkbenchFromCase(h, 'bazizeri')).toBe(false);   // 挂载
		const dispatch = jest.fn();
		openKentangCaseDrawer({ dispatch, fields: {}, module: 'bazizeri', label: '八字择日', payload: { zeri: ZERI } });
		expect(dispatch).toHaveBeenCalledTimes(1);
		h.state.scanning = true;
		setGlobalStore(userWith('new1', 3, null));   // addCase → 当前事盘换成刚存的那条(代次不变、不是显式载入)
		expect(restoreZeriWorkbenchFromCase(h, 'bazizeri')).toBe(false);
		expect(h.state.tree.children.length).toBe(2);
		expect(h.state.geo.pos).toBe('东京');
		expect([h.replotted, h.cancelled, h.state.scanning]).toEqual([0, 0, true]);
		// 再来一次更新:仍不还原
		expect(restoreZeriWorkbenchFromCase(h, 'bazizeri')).toBe(false);
		// 用户在列表里点这条(载入代次 +1):还原
		h.state.scanning = false;
		setGlobalStore(userWith('new1', 4));
		expect(restoreZeriWorkbenchFromCase(h, 'bazizeri')).toBe(true);
		expect(h.state.tree.children.length).toBe(1);
		expect(h.state.geo.pos).toBe('北京');
		expect(h.replotted).toBe(1);
	});
	test('存完之后载入了别的记录:照常还原', ()=>{
		setGlobalStore({ user: { caseApplySeq: 0, currentCase: null } });
		const h = host();
		restoreZeriWorkbenchFromCase(h, 'bazizeri');
		setGlobalStore(userWith('mine', 0, null));
		expect(restoreZeriWorkbenchFromCase(h, 'bazizeri')).toBe(false);
		setGlobalStore(userWith('other', 1));
		expect(restoreZeriWorkbenchFromCase(h, 'bazizeri')).toBe(true);
	});
	test('载入 A 后点 B 的「编辑」、保存编辑:工作台仍是 A', ()=>{
		const h = host();
		setGlobalStore(userWith('a1', 2));
		expect(restoreZeriWorkbenchFromCase(h, 'bazizeri')).toBe(true);
		h.state.geo = { zone: '+09:00', pos: '东京' };
		setGlobalStore(userWith('b1', 2, 'a1'));   // 编辑 B
		expect(restoreZeriWorkbenchFromCase(h, 'bazizeri')).toBe(false);
		const edited = userWith('a1', 2);
		edited.user.currentCase.updateTime = { value: 't-edited' };   // 保存编辑 A:更新时间换了
		setGlobalStore(edited);
		expect(restoreZeriWorkbenchFromCase(h, 'bazizeri')).toBe(false);
		expect(h.state.geo.pos).toBe('东京');
	});
	test('新挂载的宿主:刚存下(没有显式载入)的那条不还原;显式载入的那条照常还原', ()=>{
		setGlobalStore(userWith('new2', 2, null));
		expect(restoreZeriWorkbenchFromCase(host(), 'bazizeri')).toBe(false);
		setGlobalStore(userWith('new2', 3));
		expect(restoreZeriWorkbenchFromCase(host(), 'bazizeri')).toBe(true);
	});

	test('🔴 奇门择日宿主:存完不还原;载入照常', ()=>{
		const QimenZeriMain = require('../QimenZeriMain').default;
		const TREE = { ...newQimenGroup('all'), children: [newQimenLeaf('pattern_ji')] };
		const caseOf = (cid, seq, applied)=>({ user: { caseApplySeq: seq, appliedCaseCid: applied === undefined ? cid : applied, currentCase: {
			cid: { value: cid }, updateTime: { value: 't' }, caseType: { value: 'qimenzeri' }, sourceModule: { value: 'qimenzeri' },
			payload: { value: JSON.stringify({ zeri: { cfg: { startDate: '2026/03/01', endDate: '2026/03/10' }, geo: { zone: '+08:00' }, options: { a: 'case' }, tree: TREE, results: [{ t: 'case' }] } }) } } } });
		const h = Object.create(QimenZeriMain.prototype);
		h.state = { cfg: { startDate: '2025/01/01', endDate: '2025/02/01' }, geo: { zone: '+09:00' }, draftOptions: { a: 'live' }, tree: TREE, results: [{ t: 'session' }], truncated: false, scanning: true, progress: { done: 1 }, scanEpoch: 0 };
		h.setState = function(p, cb){ const patch = typeof p === 'function' ? p(this.state) : p; if(patch){ this.state = { ...this.state, ...patch }; } if(cb){ cb(); } };
		let cancelled = 0;
		h.cancelScan = ()=>{ cancelled += 1; };
		setGlobalStore({ user: { caseApplySeq: 5, currentCase: null } });
		h.restoreWorkbenchFromCase(true);   // 挂载
		setGlobalStore(caseOf('qz-new', 5, null));   // 存为事盘
		h.restoreWorkbenchFromCase();
		expect([h.state.draftOptions.a, h.state.scanning, cancelled]).toEqual(['live', true, 0]);
		h.state.scanning = false;
		setGlobalStore(caseOf('qz-new', 6));
		h.restoreWorkbenchFromCase();
		expect(h.state.draftOptions.a).toBe('case');
		expect(h.state.results).toEqual([{ t: 'case' }]);
	});
});

describe('奇门择日:载入没带地点 / 参数的存案,第一次播种 / 镜像不亮「结果已过期」', ()=>{
	const QimenZeriMain = require('../QimenZeriMain').default;
	const TREE = { ...newQimenGroup('all'), children: [newQimenLeaf('pattern_ji')] };
	afterEach(()=>{ setGlobalStore({}); });
	function loaded(){
		setGlobalStore({ user: { caseApplySeq: 7, appliedCaseCid: 'old1', currentCase: {
			cid: { value: 'old1' }, updateTime: { value: 't' }, caseType: { value: 'qimenzeri' }, sourceModule: { value: 'qimenzeri' },
			payload: { value: JSON.stringify({ zeri: { cfg: { startDate: '2026/03/01', endDate: '2026/03/10' }, geo: {}, options: {}, tree: TREE, results: [{ t: 'case' }] } }) } } } });
		const h = Object.create(QimenZeriMain.prototype);
		h.state = { cfg: { startDate: '2025/01/01', endDate: '2025/02/01' }, geo: { zone: '+09:00' }, draftOptions: { a: 'live' }, tree: TREE, results: null, truncated: false, scanning: false, scanEpoch: 0 };
		h.setState = function(p, cb){ const patch = typeof p === 'function' ? p(this.state) : p; if(patch){ this.state = { ...this.state, ...patch }; } if(cb){ cb(); } };
		h.dunjiaRef = { getScanContext: ()=>({ params: { zone: '+08:00', lat: '39n54', lon: '116e24', gpsLat: 39.9, gpsLon: 116.4, ad: 1 }, fields: { pos: { value: '北京' } }, options: { timeAlg: 0, school: '转盘' } }) };
		h.restoreWorkbenchFromCase();
		const stale = ()=>!!(h._scanUiJson && h.currentUiJson() !== h._scanUiJson);
		return { h, stale };
	}
	test('🔴 盘面镜像填参数、打开工作台播种地点:都不算过期', ()=>{
		const { h, stale } = loaded();
		expect([h.state.geo, h.state.draftOptions, stale()]).toEqual([null, null, false]);
		h.onBoardOptionsChange({ timeAlg: 0, school: '转盘' }, {});
		expect(h.state.draftOptions).toEqual({ timeAlg: 0, school: '转盘' });
		expect(stale()).toBe(false);
		h.openSearch();
		expect(h.state.geo.pos).toBe('北京');
		expect(stale()).toBe(false);
	});
	test('填进来之后再改:照常过期', ()=>{
		const { h, stale } = loaded();
		h.openSearch();   // 地点、参数一起从主盘播种
		expect(stale()).toBe(false);
		h.onGeoChange({ zone: '+07:00' });
		expect(stale()).toBe(true);
	});
	test('先改了条件再播种:照常过期(不吞掉真改动)', ()=>{
		const { h, stale } = loaded();
		h.setState({ cfg: { ...h.state.cfg, endDate: '2026/04/01' } });
		expect(stale()).toBe(true);
		h.openSearch();
		expect(stale()).toBe(true);
	});
});

describe('奇门择日「存为事盘」后:内嵌奇门页不还原刚存的那条,也不把盘面镜像进工作台', ()=>{
	const QimenZeriMain = require('../QimenZeriMain').default;
	const DunJiaMain = require('../../dunjia/DunJiaMain').default;
	const TREE = { ...newQimenGroup('all'), children: [newQimenLeaf('pattern_ji')] };
	const BOARD = { paiPanType: 3, qijuMethod: 'zhirun', school: '转盘', timeAlg: 0 };   // 左栏盘面
	const DRAFT = { paiPanType: 3, qijuMethod: 'chaibu', school: '飞盘', timeAlg: 1 };   // 工作台参数(与左栏不同)
	afterEach(()=>{ setGlobalStore({}); });
	// applied:显式载入的 cid(缺省 = 没有显式载入:存为事盘换上来的);载入这条 = 'qz-new'
	const savedCase = (seq, h, applied)=>({ user: { caseApplySeq: seq, appliedCaseCid: applied === undefined ? null : applied, currentCase: {
		cid: { value: 'qz-new' }, updateTime: { value: 't1' }, caseType: { value: 'qimenzeri' }, sourceModule: { value: 'qimenzeri' },
		payload: { value: JSON.stringify({ module: 'qimenzeri', options: { ...BOARD, chartCategory: 'shi' }, zeri: { cfg: h.state.cfg, geo: h.state.geo, options: { ...DRAFT }, tree: TREE, results: h.state.results } }) } } } });
	function mkHost(){
		const h = Object.create(QimenZeriMain.prototype);
		h.state = { cfg: { startDate: '2026/03/01', endDate: '2026/03/10' }, geo: { zone: '+08:00', pos: '北京' }, draftOptions: { ...DRAFT }, tree: TREE, results: [{ start: '2026-03-02 10:00' }], truncated: false, scanning: false, scanEpoch: 1 };
		h.setState = function(p, cb){ const patch = typeof p === 'function' ? p(this.state) : p; if(patch){ this.state = { ...this.state, ...patch }; } if(cb){ cb(); } };
		h.cancelScan = ()=>{};
		setGlobalStore({ user: { caseApplySeq: 5, currentCase: null } });
		h.restoreWorkbenchFromCase(true);   // 挂载
		h.restoreScanFreeze(true);          // 按 DRAFT 扫过一次
		return h;
	}
	function mkBoard(onOptionsChange){
		const dj = Object.create(DunJiaMain.prototype);
		dj.scope = 'qimenzeri';
		dj.state = { options: { ...BOARD }, faRelatedPeople: [], hasPlotted: false, localFields: null, chartCategory: 'shi' };
		dj.props = { fields: null, onOptionsChange };
		dj.deferred = [];
		dj.setStateCalls = 0;
		dj.setState = function(p, cb){ this.setStateCalls += 1; this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; if(cb){ this.deferred.push(cb.bind(this)); } };
		return dj;
	}
	const stale = (h)=>!!(h._scanUiJson && h.currentUiJson() !== h._scanUiJson);

	test('🔴 整条链(子先 didUpdate、父后 didUpdate、子回调在后):存完工作台参数原样、不亮「结果已过期」', ()=>{
		const h = mkHost();
		const dj = mkBoard((o, m)=>h.onBoardOptionsChange(o, m));
		dj.restoreOptionsFromCurrentCase(true);   // 挂载(没有当前事盘)
		expect(stale(h)).toBe(false);
		setGlobalStore(savedCase(5, h));          // addCase → 当前事盘换成刚存的(载入代次不变、不是显式载入)
		dj.restoreOptionsFromCurrentCase();
		h.restoreWorkbenchFromCase();
		dj.deferred.forEach((f)=>f());
		expect(h.state.draftOptions).toEqual(DRAFT);
		expect(stale(h)).toBe(false);
	});
	test('🔴 宿主:存完不还原;之后亲手改盘面照常镜像', ()=>{
		const h = mkHost();
		setGlobalStore(savedCase(5, h));
		h.restoreWorkbenchFromCase();
		expect(h.state.draftOptions).toEqual(DRAFT);
		expect(stale(h)).toBe(false);
		h.onBoardOptionsChange({ ...BOARD }, {});
		expect(h.state.draftOptions).toEqual(BOARD);
	});
	test('🔴 内嵌奇门页:刚存的那条不还原不镜像;之后在列表里载入这条(代次 +1)照常还原', ()=>{
		const mirrored = [];
		const dj = mkBoard((o, m)=>mirrored.push(m));
		setGlobalStore(savedCase(5, mkHost()));
		dj.state.options = { ...DRAFT };
		dj.restoreOptionsFromCurrentCase();
		dj.deferred.forEach((f)=>f());
		expect([dj.setStateCalls, mirrored.length]).toEqual([0, 0]);
		expect(dj.state.options).toEqual(DRAFT);
		setGlobalStore(savedCase(6, mkHost(), 'qz-new'));
		dj.restoreOptionsFromCurrentCase();
		dj.deferred.forEach((f)=>f());
		expect(dj.state.options.qijuMethod).toBe('zhirun');
		expect(mirrored).toEqual([{ source: 'case', caseVersion: 'qimenzeri|qz-new|6' }]);
	});
	test('内嵌奇门页新挂载(force):刚存下(没有显式载入)的那条也不还原;显式载入的照常', ()=>{
		const dj = mkBoard(()=>{});
		setGlobalStore(savedCase(5, mkHost()));
		dj.state.options = { ...DRAFT };
		dj.restoreOptionsFromCurrentCase(true);
		expect(dj.state.options.qijuMethod).toBe('chaibu');
		setGlobalStore(savedCase(5, mkHost(), 'qz-new'));
		dj.restoreOptionsFromCurrentCase(true);
		expect(dj.state.options.qijuMethod).toBe('zhirun');
	});
	test('独立奇门页同理:读档去重键出自共用件(只认显式载入)', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '../../dunjia/DunJiaMain.js'), 'utf8');
		expect(src).toContain('const caseVersion = caseRestoreKey(this.scope, userState);');
	});
});

describe('三式合一页(含三式择日内嵌):存为事盘后不把刚存的那条当载入还原(与奇门页同步)', ()=>{
	const SanShiUnitedMain = require('../../sanshi/SanShiUnitedMain').default;
	afterEach(()=>{ setGlobalStore({}); });
	const caseOf = (scope, cid, seq, applied)=>({ user: { caseApplySeq: seq, appliedCaseCid: applied === undefined ? cid : applied, currentCase: {
		cid: { value: cid }, updateTime: { value: 't' }, caseType: { value: scope }, sourceModule: { value: scope },
		payload: { value: JSON.stringify({ module: scope, options: { timeAlg: 0, school: '转盘', qijuMethod: 'zhirun' } }) } } } });
	function mk(scope){
		const c = Object.create(SanShiUnitedMain.prototype);
		c.state = { options: { timeAlg: 1, school: '飞盘', qijuMethod: 'chaibu' } };
		c.props = { techniqueScope: scope === 'sanshiunited' ? undefined : scope, fields: {} };
		c.lastRestoredCaseId = null;
		c.calls = [];
		c.getActiveFields = ()=>({});
		c.onFieldsChange = ()=>{ c.calls.push('fields'); };
		c.refreshAll = ()=>{ c.calls.push('refresh'); };
		c.recalcByNongli = ()=>{ c.calls.push('recalc'); };
		c.setState = function(p, cb){ this.calls.push('setState'); this.state = { ...this.state, ...p }; if(cb){ cb(); } };
		return c;
	}
	test.each([['三式合一页', 'sanshiunited'], ['三式择日内嵌', 'sanshizeri']])('🔴 %s:存完不还原、不重排(挂载也一样);载入这条(代次 +1)照常还原', (_n, scope)=>{
		const c = mk(scope);
		setGlobalStore(caseOf(scope, 'ss-new', 2, null));   // 存为事盘
		c.restoreOptionsFromCurrentCase();
		expect(c.calls).toEqual([]);
		expect(c.state.options.school).toBe('飞盘');
		setGlobalStore(caseOf(scope, 'ss-new', 3));
		c.restoreOptionsFromCurrentCase();
		expect(c.calls).toContain('setState');
		expect(c.state.options.school).toBe('转盘');
		expect(c.lastRestoredCaseId).toBe(`${scope}|ss-new|3`);
		const m = mk(scope);
		setGlobalStore(caseOf(scope, 'ss-new2', 4, null));
		m.restoreOptionsFromCurrentCase(true);
		expect(m.state.options.school).toBe('飞盘');
	});
	test('读档去重键出自共用件(源码锚)', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '../../sanshi/SanShiUnitedMain.js'), 'utf8');
		expect(src).toContain('const caseVersion = caseRestoreKey(scope, userState);');
	});
});

describe('三式择日:点结果行起出的三式盘六壬层与扫描判的是同一时柱(时间算法随奇门)', ()=>{
	const { splitSanshiOptions } = require('../../../divination/zeri/sanshiOptionSplit');
	const { computeSanshiScanPan } = require('../../../divination/zeri/sanshiZeriScanEngine');
	const { computeLiurengScanPan } = require('../../../divination/zeri/liurengZeriScanEngine');
	const { buildQimenScanSeeds } = require('../../../divination/zeri/qimenScanEngine');
	const { liurengZeriDefaultOptions } = require('../LiurengZeriMain');
	const GEO = { zone: '+08:00', lon: '116e24', lat: '39n54', gpsLon: 116.4, gpsLat: 39.9, ad: 1, gender: 1 };
	const OPTS = { guirengType: 2, yueMode: 'zhongqi', taiyiAccum: 0, after23NewDay: 0, lateZiHourUseNextDay: 1 };
	const seeds = buildQimenScanSeeds(2026, 2026, '+08:00');
	const timeGz = (pan)=>{ const t = pan.fourColumns.time; return t.ganzi || t.ganZhi; };
	test('拆分器:时间算法交给六壬、奇门两家,太乙不收', ()=>{
		const s = splitSanshiOptions({ timeAlg: 1 });
		expect([s.liureng.timeAlg, s.qimen.timeAlg, s.taiyi.timeAlg]).toEqual([1, 1, undefined]);
	});
	test('🔴 直接时间:六壬家时柱 = 奇门家时柱(三式页六壬层取的就是它);真太阳时同理(缺省零变化)', ()=>{
		const direct = computeSanshiScanPan({ seeds }, GEO, { ...OPTS, timeAlg: 1 }, '2026-02-11', '11:20:00');
		expect(timeGz(direct.liureng)).toBe(direct.qimen.ganzhi.time);
		expect(direct.qimen.ganzhi.time).toBe('甲午');
		const solar = computeSanshiScanPan({ seeds }, GEO, { ...OPTS, timeAlg: 0 }, '2026-02-11', '11:20:00');
		expect(timeGz(solar.liureng)).toBe(solar.qimen.ganzhi.time);
		expect(timeGz(solar.liureng)).toBe('癸巳');
	});
	test('独立六壬择日不变:工作台缺省参数不带时间算法,恒真太阳时', ()=>{
		expect(liurengZeriDefaultOptions()).not.toHaveProperty('timeAlg');
		const p = computeLiurengScanPan(GEO, { ...liurengZeriDefaultOptions(), after23NewDay: 0 }, '2026-02-11', '11:20:00');
		expect(timeGz(p)).toBe('癸巳');
	});
});
