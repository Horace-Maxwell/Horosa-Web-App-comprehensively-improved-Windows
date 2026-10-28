// 奇门择日载入存案:与其它择日宿主同律还原扫描冻结口径(地点 / 参数 / 条件树 / 节气种子),存的一侧冻结值优先;
// 找局途中载入作废这一次;存案没带结果清成「没扫过」。此前只还原状态 —— 判读按本会话上一次的口径(没扫过时全是「未知条件类型」)
import { newQimenLeaf, newQimenGroup } from '../../../divination/zeri/qimenConditionTypes';
jest.mock('../../../divination/zeri/qimenScanEngine', ()=>({
	...jest.requireActual('../../../divination/zeri/qimenScanEngine'),
	scanQimen: jest.fn(async ()=>({ intervals: [{ start: '2025-01-02 10:00', pick: '2025-01-02 10:30:00' }], truncated: false })),
}));

const TREE = { ...newQimenGroup('all'), children: [newQimenLeaf('pattern_ji')] };
import { setGlobalStore } from '../../../utils/storageutil';
const QimenZeriMain = require('../QimenZeriMain').default;
const { SCAN_UNCOMPILED_SENTINEL, scanRunIsCurrent, beginScanRun } = require('../zeriCaseRestore');

const caseOf = (zeri, seq)=>({ user: { caseApplySeq: seq || 1, appliedCaseCid: 'qz1', currentCase: {
	cid: { value: 'qz1' }, updateTime: { value: 't1' }, caseType: { value: 'qimenzeri' }, sourceModule: { value: 'qimenzeri' },
	payload: { value: JSON.stringify({ zeri }) } } } });
function host(state){
	const h = Object.create(QimenZeriMain.prototype);
	h.state = { cfg: { startDate: '2025/01/01', endDate: '2025/02/01' }, geo: { zone: '+09:00', gpsLon: 139.7 }, draftOptions: { a: 'live' }, tree: TREE, results: [{ t: 'session' }], truncated: false, scanning: false, progress: null, scanEpoch: 0, ...(state || {}) };
	h.setState = function(p, cb){ const patch = typeof p === 'function' ? p(this.state) : p; if(patch){ this.state = { ...this.state, ...patch }; } if(cb){ cb(); } };
	h._scanCfg = null; h._scanGeo = null; h._scanOptions = null; h._scanTree = null; h._scanSeeds = null; h._scanUiTree = null; h._scanUiJson = '';
	return h;
}
const ZERI = { cfg: { startDate: '2026/03/01', endDate: '2026/03/10' }, geo: { zone: '+08:00', gpsLon: 116.4, gpsLat: 39.9, lon: '116e24', lat: '39n54' }, options: { a: 'case' }, tree: TREE, results: [{ t: 'case' }], truncated: false };

test('🔴 存案带结果:冻结口径换成存案的,条件树按奇门编译器重编,节气种子按存案年份,「未过期」', ()=>{
	setGlobalStore(caseOf(ZERI, 1));
	const h = host();
	h.restoreWorkbenchFromCase();
	expect(h.state.results).toEqual([{ t: 'case' }]);
	expect(h._scanCfg.startDate).toBe('2026/03/01');
	expect(h._scanGeo.gpsLon).toBe(116.4);
	expect(h._scanOptions).toEqual({ a: 'case' });
	expect(h._scanTree).toBeTruthy();
	expect(h._scanSeeds && typeof h._scanSeeds).toBe('object');
	expect(h._scanUiJson).toBe(h.currentUiJson());
});
test('存案没带结果:结果清成「没扫过」,冻结一起清', ()=>{
	setGlobalStore(caseOf({ ...ZERI, results: undefined }, 2));
	const h = host({ results: [{ t: 'session' }] });
	h._scanCfg = { startDate: 'S' }; h._scanUiJson = 'S';
	h.restoreWorkbenchFromCase();
	expect(h.state.results).toBeNull();
	expect([h._scanCfg, h._scanTree, h._scanUiJson]).toEqual([null, null, '']);
});
test('找局途中载入:取消、作废运行代次、收起找局态', ()=>{
	setGlobalStore(caseOf(ZERI, 3));
	const h = host({ scanning: true, progress: { done: 1 } });
	let cancelled = 0;
	h.cancelScan = ()=>{ cancelled += 1; };
	const run = beginScanRun(h);
	h.restoreWorkbenchFromCase();
	expect(cancelled).toBe(1);
	expect(scanRunIsCurrent(h, run)).toBe(false);
	expect([h.state.scanning, h.state.progress]).toEqual([false, null]);
});
test('条件树编译不出:过期指纹永不相等', ()=>{
	setGlobalStore(caseOf({ ...ZERI, tree: { kind: 'group', joiner: 'all', negate: false, children: [{ kind: 'leaf', type: '__gone__' }] } }, 4));
	const h = host();
	h.restoreWorkbenchFromCase();
	expect(h._scanTree).toBeNull();
	expect(h._scanUiJson).toBe(SCAN_UNCOMPILED_SENTINEL);
});
test('存的一侧冻结值优先(结果行按它找的);没找过 = 当前值', ()=>{
	const h = host();
	expect(h.casePayloadExtra().zeri.geo.zone).toBe('+09:00');
	h._scanCfg = { startDate: '2026/03/01' }; h._scanGeo = { zone: '+08:00' }; h._scanOptions = { a: 'frozen' }; h._scanUiTree = TREE;
	const z = h.casePayloadExtra().zeri;
	expect([z.cfg.startDate, z.geo.zone, z.options.a]).toEqual(['2026/03/01', '+08:00', 'frozen']);
});
test('找局回调判运行代次(源码锚)', ()=>{
	const src = require('fs').readFileSync(require('path').join(__dirname, '../QimenZeriMain.js'), 'utf8');
	const body = src.slice(src.indexOf('async runSearch(){'), src.indexOf('cancelScan(){'));
	expect(body).toContain('const run = beginScanRun(this);');
	expect((body.match(/scanRunIsCurrent\(this, run\)/g) || []).length).toBe(3);
});

test('载入存案:扫描代次换代;内嵌遁甲页还原这条存案的盘面选项(带「载入存案、同一条」标记)不镜像进工作台,不论早晚到;亲手改盘面照常镜像', async ()=>{
	setGlobalStore(caseOf(ZERI, 9));
	const h = host({ scanEpoch: 2 });
	h.restoreWorkbenchFromCase();
	expect(h.state.scanEpoch).toBe(3);
	const ver = h.lastRestoredCaseId;
	expect(ver).toMatch(/^qimenzeri\|qz1\|/);
	h.onBoardOptionsChange({ a: 'board' }, { source: 'case', caseVersion: ver });
	expect(h.state.draftOptions).toEqual({ a: 'case' });
	// 取盘回来后才到的还原镜像(此前只忽略同一拍,晚到的照样改写工作台参数)
	await new Promise((r)=>setTimeout(r, 5));
	h.onBoardOptionsChange({ a: 'board-late' }, { source: 'case', caseVersion: ver });
	expect(h.state.draftOptions).toEqual({ a: 'case' });
	// 别的存案(旧的那一条)还原镜像不在豁免之列;亲手改盘面(无标记)照常镜像
	h.onBoardOptionsChange({ a: 'other' }, { source: 'case', caseVersion: 'qz0|t0' });
	expect(h.state.draftOptions).toEqual({ a: 'other' });
	h.onBoardOptionsChange({ a: 'hand' });
	expect(h.state.draftOptions).toEqual({ a: 'hand' });
	// 遁甲页那一侧:还原存案的那次 onOptionsChange 带标记,命盘还原 / 亲手改不带
	const dj = require('fs').readFileSync(require('path').join(__dirname, '../../dunjia/DunJiaMain.js'), 'utf8');
	expect((dj.match(/onOptionsChange\(\{ \.\.\.nextOptions \}, \{ source: 'case', caseVersion \}\)/g) || []).length).toBe(1);
	const restoreBody = dj.slice(dj.indexOf('\trestoreOptionsFromCurrentCase(force){'), dj.indexOf('\trestoreOptionsFromCurrentCase(force){') + 6000);
	expect(restoreBody.startsWith('\trestoreOptionsFromCurrentCase(force){')).toBe(true);
	expect(restoreBody).toContain("{ source: 'case', caseVersion }");
});

test('内嵌遁甲页随外部性别同步(gender-sync):工作台只跟 sex 这一项;已相同不动;工作台参数还没有时整份镜像', ()=>{
	const h = host({ draftOptions: { a: 'case', sex: 1 } });
	h.onBoardOptionsChange({ a: 'board', sex: 0 }, { source: 'gender-sync' });
	expect(h.state.draftOptions).toEqual({ a: 'case', sex: 0 });
	const before = h.state;
	h.onBoardOptionsChange({ a: 'board2', sex: 0 }, { source: 'gender-sync' });
	expect(h.state).toBe(before);
	// 工作台还没开过(参数为空):整份镜像,之后打开工作台照常有完整参数(此前只剩 {sex},打开时不再从主盘播种)
	const h2 = host({ draftOptions: null });
	h2.onBoardOptionsChange({ a: 'board', school: '飞盘', sex: 0 }, { source: 'gender-sync' });
	expect(h2.state.draftOptions).toEqual({ a: 'board', school: '飞盘', sex: 0 });
});

test('存案没带工作台参数 / 地点(没开过工作台就存):载入清掉本会话的,内嵌页还原镜像照常进来;不论谁先还原都跟随存案盘面', ()=>{
	setGlobalStore(caseOf({ ...ZERI, options: null, geo: null, results: undefined }, 21));
	const h = host({ draftOptions: { a: 'session' }, geo: { zone: '+09:00' } });
	h.restoreWorkbenchFromCase();
	expect(h.state.draftOptions).toBeNull();
	expect(h.state.geo).toBeNull();
	h.onBoardOptionsChange({ a: 'case-board' }, { source: 'case', caseVersion: h.lastRestoredCaseId });
	expect(h.state.draftOptions).toEqual({ a: 'case-board' });
	// 内嵌页先还原(镜像先到)、宿主后还原:宿主清成空,打开工作台时从主盘播种
	setGlobalStore(caseOf({ ...ZERI, options: null, geo: null, results: undefined }, 22));
	const h3 = host({ draftOptions: { a: 'session' } });
	h3.onBoardOptionsChange({ a: 'case-board' }, { source: 'case', caseVersion: 'qimenzeri|qz1|22' });
	h3.restoreWorkbenchFromCase();
	expect(h3.state.draftOptions).toBeNull();
	// 带工作台参数的存案照旧以存案为准
	setGlobalStore(caseOf(ZERI, 23));
	const h4 = host();
	h4.restoreWorkbenchFromCase();
	h4.onBoardOptionsChange({ a: 'board' }, { source: 'case', caseVersion: h4.lastRestoredCaseId });
	expect(h4.state.draftOptions).toEqual({ a: 'case' });
	expect(h4.state.geo.zone).toBe('+08:00');
});

test('遁甲页还原回调按提交后的最终选项重排(同批外部性别同步叠上的 sex 已在里面)(源码锚)', ()=>{
	const src = require('fs').readFileSync(require('path').join(__dirname, '../../dunjia/DunJiaMain.js'), 'utf8');
	expect((src.match(/const finalOptions = this\.state\.options \|\| nextOptions;/g) || []).length).toBe(2);
	expect(src).not.toContain('this.state.nongli, nextOptions, this.state.displaySolarTime');
});

describe('遁甲页:外部性别同步叠在同一批的还原之上(载入性别不同的存案,盘面选项不被冲回旧值)', ()=>{
	const DunJiaMain = require('../../dunjia/DunJiaMain').default;
	const mk = (options)=>{
		const d = Object.create(DunJiaMain.prototype);
		d.state = { options, hasPlotted: false };
		d.props = {};
		const queue = [];
		d.setState = function(p, cb){ queue.push([p, cb]); };
		// 与 React 同批语义一致:更新器拿到的是叠完前面各条的待提交 state;this.state 要到整批提交后才换
		d.flush = function(){
			const cbs = [];
			let pending = this.state;
			queue.splice(0).forEach(([p, cb])=>{ const patch = typeof p === 'function' ? p(pending, this.props) : p; if(patch){ pending = { ...pending, ...patch }; } if(cb){ cbs.push(cb); } });
			this.state = pending;
			cbs.forEach((cb)=>cb());
		};
		return d;
	};
	test('🔴 同一批先排了「还原成存案的飞盘」再同步性别:最终 = 存案的盘面选项 + 新性别(此前按还原前的旧值拼回转盘)', ()=>{
		const d = mk({ school: '转盘', sex: 1 });
		const mirrors = [];
		d.props = { onOptionsChange: (o, meta)=>mirrors.push([o, meta]) };
		d.replotAfterOptionChange = ()=>{};
		d.setState({ options: { school: '飞盘', sex: 1 } });   // 载入存案的还原(同一批)
		d.syncSexFromFields(0);
		d.flush();
		expect(d.state.options.school).toBe('飞盘');
		expect(d.state.options.sex).toBe(0);
		expect(mirrors.length).toBe(1);
		expect(mirrors[0][1]).toEqual({ source: 'gender-sync' });
	});
	test('已是同一性别:不改、不镜像、不重排', ()=>{
		const d = mk({ school: '转盘', sex: 0 });
		let n = 0;
		d.props = { onOptionsChange: ()=>{ n += 1; } };
		d.replotAfterOptionChange = ()=>{ n += 1; };
		d.syncSexFromFields(0);
		d.flush();
		expect(n).toBe(0);
		expect(d.state.options).toEqual({ school: '转盘', sex: 0 });
	});
	test('componentDidUpdate 的性别同步走函数式那一路(源码锚)', ()=>{
		const src = require('fs').readFileSync(require('path').join(__dirname, '../../dunjia/DunJiaMain.js'), 'utf8');
		const du = src.slice(src.indexOf('\tcomponentDidUpdate(prevProps){'), src.indexOf('\tcomponentWillUnmount(){'));
		expect(du).toContain('this.syncSexFromFields(nextG);');
		expect(du).not.toContain("this.onOptionChange('sex'");
	});
});

describe('奇门择日:工作台开着时载入没带地点 / 参数的存案 / 整段没有 zeri 的事盘 / 性别同步按待提交草稿', ()=>{
	const caseRaw = (payload, seq)=>({ user: { caseApplySeq: seq, appliedCaseCid: 'qz9', currentCase: {
		cid: { value: 'qz9' }, updateTime: { value: 't9' }, caseType: { value: 'qimenzeri' }, sourceModule: { value: 'qimenzeri' },
		payload: { value: JSON.stringify(payload) } } } });
	test('存案的地点 / 参数是空对象:当没有(清成 null、不设忽略标记),冻结口径为 null(回落活值)', ()=>{
		setGlobalStore(caseRaw({ zeri: { ...ZERI, geo: {}, options: {}, results: undefined } }, 31));
		const h = host({ geo: { zone: '+09:00' }, draftOptions: { a: 'session' } });
		h.restoreWorkbenchFromCase();
		expect([h.state.geo, h.state.draftOptions, h._zeriRestoredCaseVersion]).toEqual([null, null, null]);
		// 带结果、地点 / 参数为空:冻结 null,不是 {}
		setGlobalStore(caseRaw({ zeri: { ...ZERI, geo: null, options: null } }, 32));
		const h2 = host();
		h2.restoreWorkbenchFromCase();
		expect([h2._scanGeo, h2._scanOptions]).toEqual([null, null]);
	});
	test('整段没有 zeri 的奇门择日事盘:结果清成没扫过、冻结清空、扫描代次换代、地点 / 参数清掉', ()=>{
		setGlobalStore(caseRaw({ module: 'qimenzeri' }, 33));
		const h = host({ results: [{ t: 'session' }], scanEpoch: 5, geo: { zone: '+09:00' } });
		h._scanCfg = { startDate: 'S' }; h._scanUiJson = 'S';
		h.restoreWorkbenchFromCase();
		expect(h.state.results).toBeNull();
		expect(h.state.scanEpoch).toBe(6);
		expect([h.state.geo, h.state.draftOptions]).toEqual([null, null]);
		expect([h._scanCfg, h._scanUiJson]).toEqual([null, '']);
	});
	const NY = ()=>({ getScanContext: ()=>({ params: { zone: '-05:00', lat: '40n42', lon: '74w00', gpsLat: 40.7, gpsLon: -74, ad: 1 }, fields: { pos: { value: '纽约' } }, options: { school: '飞盘' } }) });
	// 与 React 同批语义:setState 先排队,整批提交后 this.state 才换
	const batched = (h)=>{
		const queue = [];
		h.setState = function(p, cb){ queue.push([p, cb]); };
		return ()=>{ const cbs = []; let pending = h.state; queue.splice(0).forEach(([p, cb])=>{ const patch = typeof p === 'function' ? p(pending) : p; if(patch){ pending = { ...pending, ...patch }; } if(cb){ cbs.push(cb); } }); h.state = pending; cbs.forEach((cb)=>cb()); };
	};
	test('播种返回当场算出的值;🔴 找局按它冻结,提交后指纹 = 当前工作台(不一找完就亮「结果已过期」)', async ()=>{
		const h = host({ geo: null, draftOptions: null });
		const flush = batched(h);
		h.dunjiaRef = NY();
		const seeded = h.seedFromBoard(false);
		expect(seeded.geo.zone).toBe('-05:00');
		expect(seeded.draftOptions).toEqual({ school: '飞盘' });
		flush();
		const h2 = host({ geo: null, draftOptions: null });
		const flush2 = batched(h2);
		h2.dunjiaRef = NY();
		const run = h2.runSearch();
		flush2();
		await run;
		flush2();
		expect(h2._scanGeo.zone).toBe('-05:00');
		expect(h2._scanOptions).toEqual({ school: '飞盘' });
		expect(h2.state.geo.zone).toBe('-05:00');
		expect(h2.state.results.length).toBe(1);
		expect(h2._scanUiJson).toBe(h2.currentUiJson());
	});
	test('🔴 有结果、地点 / 参数为空的存案:结果行小盘照出(参数回落活值);判读 / 预览的节气种子按活值时区现建;点选两边都空时先从主盘取', ()=>{
		const { buildQimenScanSeeds } = require('../../../divination/zeri/qimenScanEngine');
		setGlobalStore(caseOf({ ...ZERI, geo: null, options: null }, 41));
		const h = host({ geo: { zone: '-05:00', gpsLon: -74, gpsLat: 40.7 }, draftOptions: { school: '飞盘' } });
		h.restoreWorkbenchFromCase();
		expect([h._scanGeo, h._scanOptions]).toEqual([null, null]);
		h.state = { ...h.state, geo: { zone: '-05:00', gpsLon: -74, gpsLat: 40.7 }, draftOptions: { school: '飞盘' } };
		const pv = h.previewContext();
		expect(pv && pv.options).toEqual({ school: '飞盘' });
		expect(pv.geoParams.zone).toBe('-05:00');
		expect(pv.seeds).toEqual(buildQimenScanSeeds(2026, 2026, '-05:00'));
		expect(pv.seeds).not.toEqual(buildQimenScanSeeds(2026, 2026, '+08:00'));
		expect(h.frozenSeeds()).toBe(pv.seeds);   // 年份 + 时区记忆化
		// 判读同一份种子、同一时区
		const eng = require('../../../divination/zeri/qimenScanEngine');
		const spy = jest.spyOn(eng, 'explainQimenAt').mockImplementation(()=>({}));
		h.explainRowSync({ start: '2026-03-02 10:00', pick: '2026-03-02 10:30:00' });
		expect(spy.mock.calls[0][0].jieqiYearSeeds).toBe(pv.seeds);
		expect(spy.mock.calls[0][0].geoParams.zone).toBe('-05:00');
		spy.mockRestore();
		// 冻结地点在:照用找局时那份
		h._scanGeo = { zone: '+08:00' }; h._scanSeeds = { frozen: 1 };
		expect(h.frozenSeeds()).toEqual({ frozen: 1 });
		// 没有结果(没找过):没有小盘
		const h0 = host();
		expect(h0.previewContext()).toBeNull();
		// 点选:冻结与活值地点都为空 → 从主盘取(纽约、飞盘),不按 +08:00、不带地点回写
		setGlobalStore(caseOf({ ...ZERI, geo: null, options: null }, 42));
		const h3 = host({ geo: null, draftOptions: null });
		h3.restoreWorkbenchFromCase();
		h3.state = { ...h3.state, geo: null, draftOptions: null };
		const flush3 = batched(h3);
		let patch = null;
		h3.dunjiaRef = { ...NY(), applyExternalPlot: (p)=>{ patch = p; } };
		const pv3 = h3.previewContext();
		expect([pv3.geoParams.zone, pv3.seeds]).toEqual(['-05:00', buildQimenScanSeeds(2026, 2026, '-05:00')]);   // 点选前的小盘与点选同一口径
		expect(pv3.options).toEqual({ school: '飞盘' });
		// 判读与 AI 快照段头同一口径(主盘地点 / 参数)
		const eng3 = require('../../../divination/zeri/qimenScanEngine');
		const spy3 = jest.spyOn(eng3, 'explainQimenAt').mockImplementation(()=>({}));
		h3.explainRowSync({ start: '2026-03-02 10:00', pick: '2026-03-02 10:30:00' });
		expect([spy3.mock.calls[0][0].geoParams.zone, spy3.mock.calls[0][0].options]).toEqual(['-05:00', { school: '飞盘' }]);
		spy3.mockRestore();
		expect(h3.composeAiSnapshot('BASE')).toContain('纽约');
		expect(h3.composeAiSnapshot('BASE')).toContain('飞盘（飞宫）');   // 段头参数行同样回落到主盘参数
		// 没有结果(没找过、没开过工作台):段头照旧写「未设」,不替用户写主盘地点
		const h0b = host({ geo: null, draftOptions: null, results: null });
		h0b.dunjiaRef = NY();
		expect(h0b._scanUiJson).toBe('');
		expect(h0b.composeAiSnapshot('BASE')).toContain('地点：未设');
		expect(h0b.composeAiSnapshot('BASE')).not.toContain('参数：');   // 也不替用户写主盘参数
		// 开过工作台、没找过:段头写工作台此刻的地点与参数(不回落主盘,也不丢)
		const h0c = host({ geo: { zone: '+09:00', pos: '东京' }, draftOptions: { school: '飞盘' }, results: null });
		h0c.dunjiaRef = NY();
		expect(h0c.composeAiSnapshot('BASE')).toContain('地点：东京　时区：+09:00');
		expect(h0c.composeAiSnapshot('BASE')).toContain('飞盘（飞宫）');
		// 内嵌页取不到上下文(抛错):按没有处理,不让渲染跟着抛
		const ref3 = h3.dunjiaRef;
		h3.dunjiaRef = { getScanContext: ()=>{ throw new Error('boom'); } };
		expect(()=>h3.previewContext()).not.toThrow();
		h3.dunjiaRef = ref3;
		const json3 = h3.currentUiJson();
		h3.onPickInterval({ start: '2026-03-02 10:00', pick: '2026-03-02 10:30:00' });
		expect(patch.zone).toBe('-05:00');
		expect([patch.gpsLon, patch.gpsLat, patch.pos]).toEqual([-74, 40.7, '纽约']);
		expect(patch.options).toEqual({ school: '飞盘' });
		// 只读主盘、不播种进工作台:提交这一拍后工作台地点 / 参数仍为空,「结果已过期」的判据不变
		flush3();
		expect([h3.state.geo, h3.state.draftOptions]).toEqual([null, null]);
		expect(h3.currentUiJson()).toBe(json3);
		// 改活值时区:种子换成按新时区现建的那一份
		h.state = { ...h.state, geo: { zone: '+09:00', gpsLon: 139.7, gpsLat: 35.7 } };
		h._scanGeo = null;
		const s9 = h.frozenSeeds();
		expect(s9).toEqual(buildQimenScanSeeds(2026, 2026, '+09:00'));
		expect(s9).not.toEqual(buildQimenScanSeeds(2026, 2026, '-05:00'));
	});
	test('🔴 同一批先到整份镜像(命盘还原)、再到性别同步:工作台 = 整份镜像 + 新性别(此前按已提交的旧草稿并 sex,吞掉整份镜像)', ()=>{
		const h = host({ draftOptions: { school: '转盘', sex: 1 } });
		const queue = [];
		h.setState = function(p){ queue.push(p); };
		h.onBoardOptionsChange({ school: '飞盘', sex: 1 });
		h.onBoardOptionsChange({ school: '飞盘', sex: 0 }, { source: 'gender-sync' });
		let pending = h.state;
		queue.forEach((p)=>{ const patch = typeof p === 'function' ? p(pending) : p; if(patch){ pending = { ...pending, ...patch }; } });
		expect(pending.draftOptions).toEqual({ school: '飞盘', sex: 0 });
	});
});
