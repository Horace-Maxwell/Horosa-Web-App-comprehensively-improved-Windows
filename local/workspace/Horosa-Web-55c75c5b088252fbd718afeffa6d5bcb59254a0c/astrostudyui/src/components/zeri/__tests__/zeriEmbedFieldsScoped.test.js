// 择日宿主内嵌页左栏亲手改字段:只进宿主的覆盖层,绝不写主盘。
// 此前七个宿主(八字 / 太乙 / 紫微 / 六壬 / 三式 / 七政 / 印度择日)的内嵌页照主页那样派发 astro/save · astro/fetchByFields,
// 把宿主拼的那张 fields(只有择日时刻 / 地点 / 性别几键)整张换进主盘;内嵌盘自己却不变。
import DateTime from '../../comp/DateTime';
import { sendScopedFields, withEmbedPatch, chartParamWithEmbedPatch } from '../../../utils/scopedFieldsSink';
const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

jest.mock('../../../services/astro', ()=>{
	const actual = jest.requireActual('../../../services/astro');
	return { ...actual, fetchChart: jest.fn(()=>new Promise(()=>{})) };
});
jest.mock('../../../utils/storageutil', ()=>{
	const actual = jest.requireActual('../../../utils/storageutil');
	return { ...actual, getStore: jest.fn(()=>null) };
});

function syncSetState(upd, cb){
	const p = typeof upd === 'function' ? upd(this.state, this.props) : upd;
	this.state = { ...this.state, ...(p || {}) };
	if(cb){ cb(); }
}
function dt(text){
	const d = new DateTime();
	return d.parse(text, 'YYYY-MM-DD HH:mm:ss');
}
const MAIN_WRITES = ['astro/save', 'astro/saveUserFields', 'astro/fetchByFields', 'astro/setAfter23BoundaryUserOverrode', 'astro/setLateZiHourUserOverrode', 'astro/setBaziCalibreOverride'];
function mainWrites(dispatch){
	return dispatch.mock.calls.map((c)=>c[0] && c[0].type).filter((t)=>MAIN_WRITES.indexOf(t) >= 0);
}
const HOST_FIELDS = { date: { value: dt('2026-10-01 10:00:00') }, time: { value: dt('2026-10-01 10:00:00') }, zone: { value: '+08:00' }, gender: { value: 1 } };

beforeEach(()=>{
	window.localStorage.clear();
});

describe('共享件', ()=>{
	test('只有择日内嵌(有 scope 且宿主传了接收函数)才交给宿主;瞬态键不进覆盖层', ()=>{
		const sink = jest.fn();
		expect(sendScopedFields({ onScopedFieldsChange: sink }, { a: { value: 1 } })).toBe(false);   // 主页:没有 scope
		expect(sendScopedFields({ techniqueScope: 'qimenzeri' }, { a: { value: 1 } })).toBe(false);   // 与主盘共用 fields 的宿主
		expect(sink).not.toHaveBeenCalled();
		expect(sendScopedFields({ techniqueScope: 'ziweizeri', onScopedFieldsChange: sink }, { a: { value: 1 }, __confirmed: true, __stepHint: { dir: 1 }, nohook: true }, { recompute: false })).toBe(true);
		expect(sink).toHaveBeenCalledWith({ a: { value: 1 } }, { recompute: false, replace: false });
		// 载入存案:覆盖层整个换掉(replace),不并进旧的
		const { mergeEmbedPatch } = require('../../../utils/scopedFieldsSink');
		expect(mergeEmbedPatch({ lon: { value: 'x' } }, { hsys: { value: 1 } })).toEqual({ lon: { value: 'x' }, hsys: { value: 1 } });
		expect(mergeEmbedPatch({ lon: { value: 'x' } }, { hsys: { value: 1 } }, { replace: true })).toEqual({ hsys: { value: 1 } });
	});
	test('覆盖层:空覆盖层原样返回同一对象;底盘请求只改本就有的键,时刻不在这里改', ()=>{
		const base = { a: { value: 1 } };
		expect(withEmbedPatch(base, {})).toBe(base);
		expect(withEmbedPatch(base, { a: { value: 2 } }).a.value).toBe(2);
		const param = chartParamWithEmbedPatch({ date: '2026/10/01', lon: '116e28', gender: 1 }, { lon: { value: '121e30' }, date: { value: 'x' }, hsys: { value: 3 } });
		expect(param).toEqual({ date: '2026/10/01', lon: '121e30', gender: 1 });
	});
});

describe('🔴 内嵌页侧:择日内嵌只交给宿主、不写主盘;主页照常写', ()=>{
	const cases = [
		['紫微', ()=>require('../../ziwei/ZiWeiMain').default, 'onFieldsChange', [{ gender: { value: 0 }, __confirmed: true }], { gender: { value: 0 } }],
		['八字', ()=>require('../../cntradition/BaZi').default, 'onFieldsChange', [{ gender: { value: 0 } }], { gender: { value: 0 } }],
		['太乙', ()=>require('../../taiyi/TaiYiMain').default, 'onFieldsChange', [{ gender: { value: 0 } }], { gender: { value: 0 } }],
		['六壬', ()=>require('../../lrzhan/LiuRengMain').default, 'onFieldsChange', [{ gender: { value: 0 } }], { gender: { value: 0 } }],
		['三式', ()=>require('../../sanshi/SanShiUnitedMain').default, 'onFieldsChange', [{ gender: { value: 0 } }], { gender: { value: 0 } }],
		['三式(只同步显示)', ()=>require('../../sanshi/SanShiUnitedMain').default, 'syncFields', [{ gender: { value: 0 } }], { gender: { value: 0 } }, false],
		['七政', ()=>require('../../guolao/GuoLaoChartMain').default, 'onFieldsChange', [{ gender: { value: 0 } }], { gender: { value: 0 } }],
		['印度', ()=>require('../../astro/IndiaChartMain').default, 'onFieldsChange', [{ gender: 0, confirmed: true }], { gender: { value: 0 } }],
	];
	test.each(cases)('%s', (label, load, method, args, expectedPatch, recompute = true)=>{
		const C = load();
		const dispatch = jest.fn();
		const sink = jest.fn();
		const self = {
			props: { dispatch, fields: HOST_FIELDS, techniqueScope: 'xzeri', onScopedFieldsChange: sink, hook: {} },
			state: { hook: {}, options: {} },
			setState: syncSetState,
			requestZiWei: jest.fn(), prefetchNextStepZiwei: jest.fn(), requestBazi: jest.fn(), requestGods: jest.fn(),
			withIndiaOptionFields: (f)=>f, requestDashaChart: jest.fn(),
		};
		C.prototype[method].apply(self, args);
		expect(mainWrites(dispatch)).toEqual([]);
		expect(sink).toHaveBeenCalledTimes(1);
		expect(sink.mock.calls[0][0]).toEqual(expect.objectContaining(expectedPatch));
		expect(sink.mock.calls[0][1]).toEqual({ recompute, replace: false });
	});

	test('主页(无 scope):照常派发主盘', ()=>{
		[['紫微', require('../../ziwei/ZiWeiMain').default, [{ gender: { value: 0 }, __confirmed: true }]],
			['太乙', require('../../taiyi/TaiYiMain').default, [{ gender: { value: 0 } }]],
			['六壬', require('../../lrzhan/LiuRengMain').default, [{ gender: { value: 0 } }]],
			['三式', require('../../sanshi/SanShiUnitedMain').default, [{ gender: { value: 0 } }]]].forEach(([label, C, args])=>{
			const dispatch = jest.fn();
			const self = { props: { dispatch, fields: HOST_FIELDS, onScopedFieldsChange: jest.fn() }, state: {}, setState: syncSetState, requestZiWei: jest.fn(), prefetchNextStepZiwei: jest.fn(), requestGods: jest.fn() };
			C.prototype.onFieldsChange.apply(self, args);
			expect([label, mainWrites(dispatch).length > 0]).toEqual([label, true]);
		});
	});

	test('六壬「此刻起课」与「起课」(时间草稿):择日内嵌交给宿主', ()=>{
		const C = require('../../lrzhan/LiuRengMain').default;
		const dispatch = jest.fn();
		const sink = jest.fn();
		const self = { props: { dispatch, fields: HOST_FIELDS, techniqueScope: 'liurengzeri', onScopedFieldsChange: sink }, state: {}, startPaiPanByFields: jest.fn() };
		C.prototype.clickStartNowPaiPan.call(self);
		self.pendingFields = { ...HOST_FIELDS, date: { value: dt('2026-10-01 14:00:00') }, time: { value: dt('2026-10-01 14:00:00') } };
		self.getTimeFieldsFromSelector = ()=>null;
		C.prototype.clickStartPaiPan.call(self);
		expect(mainWrites(dispatch)).toEqual([]);
		expect(sink).toHaveBeenCalledTimes(2);
		expect(sink.mock.calls[1][0].date.value.format('HH:mm')).toBe('14:00');
	});

	test('紫微 / 六壬:择日内嵌改子时换日不动主页「左栏改过」标志', ()=>{
		const dispatch = jest.fn();
		const self = { props: { dispatch, fields: HOST_FIELDS, techniqueScope: 'xzeri', onScopedFieldsChange: jest.fn() }, state: {}, requestGods: jest.fn() };
		require('../../ziwei/ZiWeiMain').default.prototype.onFieldsChange.call(self, { after23NewDay: { value: 0 } });
		require('../../lrzhan/LiuRengMain').default.prototype.onFieldsChange.call(self, { after23NewDay: { value: 0 }, lateZiHourUseNextDay: { value: 0 } });
		expect(mainWrites(dispatch)).toEqual([]);
	});

	test('七政:择日内嵌改宿度制 / 命度 / 罗计只归一取值,不写七政页保存值、不记新盘种子', ()=>{
		const C = require('../../guolao/GuoLaoChartMain').default;
		const seeds = require('../../../utils/newChartSeeds');
		seeds.__resetNewChartSeedsForTest();
		const before = { ...window.localStorage };
		const sink = jest.fn();
		const self = { props: { dispatch: jest.fn(), fields: HOST_FIELDS, techniqueScope: 'qizhengzeri', onScopedFieldsChange: sink } };
		C.prototype.onFieldsChange.call(self, { doubingSu28: { value: '5' }, guolaoLifeMode: { value: 'nope' }, guolaoNodeMode: { value: 'nope' } });
		expect({ ...window.localStorage }).toEqual(before);
		expect(seeds.newChartSeedOverrides().doubingSu28).toBeUndefined();
		expect(sink.mock.calls[0][0].doubingSu28.value).toBe(5);
		const Style = require('../../guolao/GuoLaoChartStyle');
		expect(sink.mock.calls[0][0].guolaoLifeMode.value).toBe(Style.normalizeGuolaoLifeMode('nope'));
		// 主页照旧写保存值
		C.prototype.onFieldsChange.call({ props: { dispatch: jest.fn(), fields: HOST_FIELDS } }, { doubingSu28: { value: '5' } });
		expect(Style.getStoredGuolaoSu28Mode()).toBe(5);
	});

	test('八字:择日内嵌改八字选项只改本盘,不写八字页的保存值', ()=>{
		const C = require('../../cntradition/BaZi').default;
		const self = { props: { techniqueScope: 'bazizeri' }, state: { baziOpt: {} }, setState: syncSetState, requestBazi: jest.fn(), effFields: ()=>HOST_FIELDS };
		C.prototype.onBaziOptChange.call(self, { school: 'nayin' });
		expect(window.localStorage.getItem('baziopt')).toBe(null);
		const page = { props: {}, state: { baziOpt: {} }, setState: syncSetState, requestBazi: jest.fn(), effFields: ()=>HOST_FIELDS };
		C.prototype.onBaziOptChange.call(page, { school: 'nayin' });
		expect(JSON.parse(window.localStorage.getItem('baziopt')).school).toBe('nayin');
	});

	test('印度:择日内嵌切子页签不动主页的子页签记忆', ()=>{
		const C = require('../../astro/IndiaChartMain').default;
		const dispatch = jest.fn();
		const hook = { natal: { fun: jest.fn(), fractal: 1 } };
		const self = { props: { dispatch, techniqueScope: 'indiazeri' }, state: { hook }, setState: syncSetState };
		C.prototype.changeTab.call(self, 'natal');
		expect(dispatch).not.toHaveBeenCalled();
		const page = { props: { dispatch }, state: { hook }, setState: syncSetState };
		C.prototype.changeTab.call(page, 'natal');
		expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'astro/save', payload: { currentSubTab: 'natal' } }));
	});
});

describe('🔴 宿主侧:覆盖层叠到显示盘;点选结果清空;点选后内嵌页改字段仍叠在冻结底板上', ()=>{
	const hosts = [
		['紫微', 'ZiweiZeriMain', 'ziweiHook', 'hook'],
		['八字', 'BaziZeriMain', 'baziHook', 'hook'],
		['太乙', 'TaiyiZeriMain', 'taiyiHook', 'self'],
		['六壬', 'LiurengZeriMain', 'liurengHook', 'chart'],
		['三式', 'SanshiZeriMain', 'sanshiHook', 'chart'],
		['七政', 'QizhengZeriMain', 'qizhengHook', 'chart'],
		['印度', 'IndiaZeriMain', 'indiaHook', 'hook'],
	];
	test.each(hosts)('%s', (label, file, hookName, mode)=>{
		const { fetchChart } = require('../../../services/astro');
		fetchChart.mockClear();
		const H = require(`../${file}`).default;
		const h = new H({ dispatch: jest.fn() });
		h.setState = syncSetState;
		h[hookName].fun = jest.fn();
		h.applyWorkbenchCalibre = ()=>({ then: (f)=>f() });
		const t = dt('2026-10-03 21:30:00');
		h.onEmbedFieldsChange({ date: { value: t }, time: { value: t.clone() }, lon: { value: '121e30' } }, { recompute: true });
		const live = file === 'TaiyiZeriMain' || file === 'QizhengZeriMain' ? h.buildFieldsMemo() : h.buildFields();
		expect(live.date.value.format('YYYY-MM-DD HH:mm')).toBe('2026-10-03 21:30');
		expect(live.lon.value).toBe('121e30');
		expect(h.buildFields(true).lon.value).toBe('121e30');   // 覆盖层恒叠(点选时清空,点选那一刻仍是纯冻结口径)
		if(mode === 'hook'){
			expect(h[hookName].fun).toHaveBeenCalledTimes(1);
			expect(h[hookName].fun.mock.calls[0][0].lon.value).toBe('121e30');
		}else if(mode === 'chart'){
			expect(fetchChart).toHaveBeenCalledTimes(1);
			expect(fetchChart.mock.calls[0][0]).toEqual(expect.objectContaining({ lon: '121e30', date: '2026/10/03', time: '21:30:00' }));
		}else{
			expect(h[hookName].fun).not.toHaveBeenCalled();   // 太乙按 fields 引用自触发重排
		}
		// 输入中(没点确定):只更新显示,不重排
		fetchChart.mockClear();
		h[hookName].fun.mockClear();
		h.onEmbedFieldsChange({ gender: { value: 0 } }, { recompute: false });
		expect(h[hookName].fun).not.toHaveBeenCalled();
		expect(fetchChart).not.toHaveBeenCalled();
		// 点选择时结果起盘:覆盖层清空
		h.onPickInterval({ start: '2026-10-05 08:00', pick: '2026-10-05 08:00:00' });
		expect(h.state.embedPatch).toEqual({});
		expect(h.buildFields().lon.value).not.toBe('121e30');
		// 点选后:工作台地点改了(结果已过期),内嵌页只改性别 → 重排仍按扫描冻结地点(此前回到工作台活值)
		h._scanGeo = { ...(h.state.geo || {}), lon: '113e15' };
		h.setState({ geo: { ...(h.state.geo || {}), lon: '100e00' } });
		h.onPickInterval({ start: '2026-10-05 08:00', pick: '2026-10-05 08:00:00' });
		fetchChart.mockClear();
		h[hookName].fun.mockClear();
		h.onEmbedFieldsChange({ gender: { value: 0 } }, { recompute: true });
		const shown = file === 'TaiyiZeriMain' || file === 'QizhengZeriMain' ? h.buildFieldsMemo() : h.buildFields(!!h._plotFrozen);
		expect(shown.lon.value).toBe('113e15');
		expect(shown.gender.value).toBe(0);
		if(mode === 'chart'){ expect(fetchChart.mock.calls[0][0].lon).toBe('113e15'); }
		if(mode === 'hook'){ expect(h[hookName].fun.mock.calls[0][0].lon.value).toBe('113e15'); }
	});

	test('载入存案:覆盖层换成存案里记的那份(没记 = 清空);存档带上覆盖层', ()=>{
		const storageutil = require('../../../utils/storageutil');
		storageutil.getStore.mockReturnValue({ user: { appliedCaseCid: 'k1', currentCase: { cid: { value: 'k1' }, caseType: { value: 'ziweizeri' }, updateTime: { value: 't' }, payload: { value: JSON.stringify({ zeri: { pickText: '2026-10-09 09:00:00' } }) } } } });
		const { restoreZeriWorkbenchFromCase } = require('../zeriCaseRestore');
		const host = { state: { embedPatch: { lon: { value: '121e30' } }, embedRev: 3 }, setState: syncSetState };
		expect(restoreZeriWorkbenchFromCase(host, 'ziweizeri')).toBe(true);
		expect(host.state.embedPatch).toEqual({});
		expect(host.state.pickText).toBe('2026-10-09 09:00:00');
		// 存档时内嵌页又改过的字段随存案记下,载回照原样还原
		const { buildZeriCasePayload } = require('../zeriCaseRestore');
		const t = dt('2026-10-03 21:30:00');
		const saved = buildZeriCasePayload({ state: { pickText: '2026-10-03 08:00:00', embedPatch: { time: { value: t }, lon: { value: '121e30' } } } });
		expect(saved.embedPatch.lon).toEqual({ v: '121e30' });
		storageutil.getStore.mockReturnValue({ user: { appliedCaseCid: 'k2', currentCase: { cid: { value: 'k2' }, caseType: { value: 'ziweizeri' }, updateTime: { value: 't2' }, payload: { value: JSON.stringify({ zeri: saved }) } } } });
		const host2 = { state: { embedPatch: { gender: { value: 0 } }, embedRev: 1 }, setState: syncSetState };
		expect(restoreZeriWorkbenchFromCase(host2, 'ziweizeri')).toBe(true);
		expect(host2.state.embedPatch.lon.value).toBe('121e30');
		expect(host2.state.embedPatch.time.value.format('YYYY-MM-DD HH:mm')).toBe('2026-10-03 21:30');
		expect(host2.state.embedPatch.gender).toBeUndefined();
		storageutil.getStore.mockReturnValue(null);
	});

	test('紫微 / 八字 / 七政 / 印度择日「存档」的时间地点 = 所见那张盘(叠过覆盖层)', ()=>{
		const kentang = require('../../../utils/kentangCaseSave');
		const spy = jest.spyOn(kentang, 'openKentangCaseDrawer').mockImplementation(()=>{});
		[['ZiweiZeriMain', 'ziweiHook'], ['BaziZeriMain', 'baziHook'], ['QizhengZeriMain', 'qizhengHook'], ['IndiaZeriMain', 'indiaHook']].forEach(([file, hookName])=>{
			spy.mockClear();
			const H = require(`../${file}`).default;
			const h = new H({ dispatch: jest.fn() });
			h.setState = syncSetState;
			h[hookName].fun = jest.fn();
			h.onPickInterval({ start: '2026-10-05 08:00', pick: '2026-10-05 08:00:00' });
			h.onEmbedFieldsChange({ lon: { value: '121e30' } }, { recompute: false });
			h.saveCase();
			expect([file, spy.mock.calls[0][0].fields.lon.value]).toEqual([file, '121e30']);
			expect(spy.mock.calls[0][0].payload.zeri.embedPatch.lon).toEqual({ v: '121e30' });
		});
		spy.mockRestore();
	});
});

describe('载入存案换覆盖层 / 印度选项进覆盖层 / 三式底盘带黄道宫制', ()=>{
	test('🔴 六壬 / 太乙 / 三式内嵌载入存案:覆盖层换成存案那一刻的时间地点(左栏与之后的重排回到存案);太乙不按宿主时刻重排;六壬直接时间照存档显示、下次起课回真太阳时', ()=>{
		const storageutil = require('../../../utils/storageutil');
		const setGlobalStore = (st)=>storageutil.getStore.mockReturnValue(st && st.user ? st : null);
		const kentang = require('../../../utils/kentangCaseSave');
		const caseTime = dt('2025-03-04 05:06:00');
		const caseFields = (module)=>({ cid: { value: 'k1' }, updateTime: { value: 't1' }, sourceModule: { value: module }, divTime: { value: caseTime }, zone: { value: '+08:00' },
			lon: { value: '121e28' }, lat: { value: '31n14' }, gpsLon: { value: 121.47 }, gpsLat: { value: 31.23 }, pos: { value: '上海' }, gender: { value: 0 },
			payload: { value: JSON.stringify({ module, fieldSnapshot: { after23NewDay: 0 } }) } });
		const LR = require('../../lrzhan/LiuRengMain').default;
		setGlobalStore({ user: { appliedCaseCid: 'k1', currentCase: caseFields('liurengzeri') } });
		const spy = jest.spyOn(kentang, 'getKentangSavedCasePayload');
		spy.mockReturnValue({ caseVersion: 'c1', payload: { timeAlg: 1, guireng: 0 } });
		const sink = jest.fn();
		const lr = { props: { techniqueScope: 'liurengzeri', onScopedFieldsChange: sink }, state: {}, setState: syncSetState };
		expect(LR.prototype.restoreFromCurrentCase.call(lr, true)).toBe(true);
		const [patch, meta] = sink.mock.calls[0];
		expect(meta).toEqual({ recompute: false, replace: true });
		expect(patch.date.value.format('YYYY-MM-DD HH:mm:ss')).toBe('2025-03-04 05:06:00');
		expect(patch).toMatchObject({ zone: { value: '+08:00' }, lon: { value: '121e28' }, pos: { value: '上海' }, gender: { value: 0 }, after23NewDay: { value: 0 } });
		expect(lr.state.timeAlg).toBe(1);   // 照存档显示
		expect(lr._skipNextAfter23Recompute).toBe(true);
		// 存案取不出时间地点(补丁为空):宿主 fields 可能不变,不置跳过标记(否则留到下一次真实变化把那次重起吞掉)
		const kspy = jest.spyOn(kentang, 'getKentangSavedCaseFieldsPatch').mockReturnValue(null);
		spy.mockReturnValue({ caseVersion: 'c1b', payload: { timeAlg: 1 } });
		const lr0 = { props: { techniqueScope: 'liurengzeri', onScopedFieldsChange: jest.fn() }, state: {}, setState: syncSetState };
		LR.prototype.restoreFromCurrentCase.call(lr0, true);
		expect(lr0.props.onScopedFieldsChange).toHaveBeenCalledTimes(1);
		expect(lr0._skipNextAfter23Recompute).toBeFalsy();
		kspy.mockRestore();
		spy.mockReturnValue({ caseVersion: 'c1', payload: { timeAlg: 1, guireng: 0 } });
		const gp = LR.prototype.genGodsParams.call({ ...lr, state: { ...lr.state } }, { date: { value: caseTime }, time: { value: caseTime }, zone: { value: '+08:00' }, lon: { value: '121e28' }, lat: { value: '31n14' } });
		expect(gp.timeAlg).toBe(0);         // 下次起课按真太阳时
		const TY = require('../../taiyi/TaiYiMain').default;
		setGlobalStore({ user: { appliedCaseCid: 'k1', currentCase: caseFields('taiyizeri') } });
		spy.mockReturnValue({ caseVersion: 'c2', payload: { options: {}, pan: null } });
		sink.mockClear();
		const ty = { props: { techniqueScope: 'taiyizeri', onScopedFieldsChange: sink }, state: { options: {} }, setState: syncSetState, taiyiRequestSeq: 0 };
		expect(TY.prototype.restoreFromCurrentCase.call(ty, true)).toBe(true);
		expect(sink.mock.calls[0][0].date.value.format('YYYY-MM-DD HH:mm:ss')).toBe('2025-03-04 05:06:00');
		expect(sink.mock.calls[0][1]).toEqual({ recompute: false, replace: true });
		// 宿主因此重渲染带来的这一次 fields 变化:不按宿主时刻重排
		let req = 0;
		const tyInst = { ...ty, props: { ...ty.props, fields: { ...HOST_FIELDS } }, requestNongli: ()=>{ req += 1; }, ensureBoardObserver: ()=>{}, restoreFromCurrentCase: ()=>false };
		TY.prototype.componentDidUpdate.call(tyInst, { fields: HOST_FIELDS });
		expect(req).toBe(0);
		TY.prototype.componentDidUpdate.call(tyInst, { fields: { ...HOST_FIELDS } });
		expect(req).toBe(1);   // 只跳过那一次
		// 主页(无 scope)不碰覆盖层、时间算法照存档
		spy.mockReturnValue({ caseVersion: 'c3', payload: { timeAlg: 1 } });
		const page = { props: {}, state: {}, setState: syncSetState };
		LR.prototype.restoreFromCurrentCase.call(page, true);
		expect(page.state.timeAlg).toBe(1);
		expect(LR.prototype.genGodsParams.call(page, { date: { value: caseTime }, time: { value: caseTime }, zone: { value: '+08:00' }, lon: { value: '121e28' }, lat: { value: '31n14' } }).timeAlg).toBe(1);
		spy.mockRestore();
		setGlobalStore({});
		// 三式:覆盖层带上存案时刻
		const ss = require('fs').readFileSync(require('path').join(__dirname, '../../sanshi/SanShiUnitedMain.js'), 'utf8');
		expect(ss).toContain('sendScopedFields(this.props, { ...casePatch, ...sharedPatch }, { replace: true })');
	});
	test('🔴 印度择日内嵌改岁差 / 罗计:交给宿主覆盖层(宿主重渲染不再冲回工作台值)', ()=>{
		const C = require('../../astro/IndiaChartMain').default;
		const sink = jest.fn();
		const dispatch = jest.fn();
		const self = { props: { dispatch, techniqueScope: 'indiazeri', onScopedFieldsChange: sink, fields: HOST_FIELDS } };
		C.prototype.persistIndiaOption.call(self, { indiaAyanamsa: 'raman' });
		expect(sink).toHaveBeenCalledWith({ indiaAyanamsa: { value: 'raman' } }, { recompute: false, replace: false });
		expect(mainWrites(dispatch)).toEqual([]);
		const H = require('../IndiaZeriMain').default;
		const h = new H({ dispatch: jest.fn() });
		h.setState = syncSetState;
		h.onEmbedFieldsChange({ indiaAyanamsa: { value: 'raman' } }, { recompute: false });
		expect(h.buildFields().indiaAyanamsa.value).toBe('raman');
	});
	test('三式择日:内嵌改的黄道 / 宫制进底盘请求(宿主请求缺省不带这几键)', ()=>{
		const param = chartParamWithEmbedPatch({ date: '2026/10/01', lon: '116e28' }, { zodiacal: { value: 1 }, hsys: { value: 3 }, foo: { value: 9 } }, { extraKeys: ['zodiacal', 'siderealAyanamsa', 'hsys'] });
		expect(param).toEqual({ date: '2026/10/01', lon: '116e28', zodiacal: 1, hsys: 3 });
		const { fetchChart } = require('../../../services/astro');
		fetchChart.mockClear();
		const H = require('../SanshiZeriMain').default;
		const h = new H({ dispatch: jest.fn() });
		h.setState = syncSetState;
		h.onEmbedFieldsChange({ zodiacal: { value: 1 }, siderealAyanamsa: { value: 'lahiri' }, hsys: { value: 3 } }, { recompute: true });
		expect(fetchChart.mock.calls[0][0]).toEqual(expect.objectContaining({ zodiacal: 1, siderealAyanamsa: 'lahiri', hsys: 3 }));
	});
});

describe('六壬择日首次挂载载入存案:初排作废、只按存案时刻换底盘、不重起课', ()=>{
	test('🔴 子页还原先于宿主挂载:宿主初排(当前时刻)回来被丢弃;存案时刻的底盘只交给 setChart,不调 fun(不重起课)', async ()=>{
		const { fetchChart } = require('../../../services/astro');
		const gates = [];
		fetchChart.mockReset();
		fetchChart.mockImplementation(()=>new Promise((resolve)=>{ gates.push(resolve); }));
		const H = require('../LiurengZeriMain').default;
		const h = new H({ dispatch: jest.fn() });
		const queued = [];
		h.setState = function(upd, cb){ const p = typeof upd === 'function' ? upd(this.state, this.props) : upd; this.state = { ...this.state, ...p }; if(cb){ queued.push(cb); } };
		h.liurengHook.fun = jest.fn();
		h.liurengHook.setChart = jest.fn();
		const t = dt('2010-06-06 08:00:00');
		// ① 子页 componentDidMount 还原存案:覆盖层换成存案时刻(宿主这次更新要等提交结束才生效)
		h.onEmbedFieldsChange({ date: { value: t }, time: { value: t.clone() }, lon: { value: '121e28' } }, { replace: true, recompute: false });
		// ② 宿主 componentDidMount:初排(此时覆盖层已在 state 里,但真机上初排在这之前已取定当前时刻;这里按发出顺序判)
		h.componentDidMount();
		// ③ 提交结束:宿主 setState 回调
		queued.splice(0).forEach((cb)=>cb());
		expect(fetchChart).toHaveBeenCalledTimes(2);
		expect(fetchChart.mock.calls[1][0]).toEqual(expect.objectContaining({ date: '2010/06/06', lon: '121e28' }));
		const mkRsp = (tag)=>({ Result: { params: { tag }, chart: { tag } } });
		gates[1](mkRsp('case'));
		await Promise.resolve(); await Promise.resolve();
		queued.splice(0).forEach((cb)=>cb());
		gates[0](mkRsp('now'));   // 初排晚到
		await Promise.resolve(); await Promise.resolve();
		queued.splice(0).forEach((cb)=>cb());
		expect(h.liurengHook.fun).not.toHaveBeenCalled();
		expect(h.liurengHook.setChart).toHaveBeenCalledTimes(1);
		expect(h.liurengHook.setChart.mock.calls[0][1].chart.tag).toBe('case');
		expect(h.state.chartValue.chart.tag).toBe('case');
		fetchChart.mockReset();
		fetchChart.mockImplementation(()=>new Promise(()=>{}));
	});
	test('六壬页:登记只换底盘的 hook;「跳过下一次重算」先判后还原(本轮新置的标记留给覆盖层生效那一轮)', ()=>{
		const src = readSource(require('path').join(__dirname, '../../lrzhan/LiuRengMain.js'));
		expect(src).toContain('this.props.hook.setChart = (fields, chartObj)=>{');
		const body = src.slice(src.indexOf('\tcomponentDidUpdate(prevProps'), src.indexOf('\tcomponentWillUnmount(){'));
		expect(body.indexOf('const skipRecompute =')).toBeGreaterThan(0);
		expect(body.indexOf('const skipRecompute =')).toBeLessThan(body.indexOf('this.restoreFromCurrentCase();'));
	});
});

describe('太乙择日已挂着时载入存案:宿主请内嵌太乙还原', ()=>{
	test('显式载入一换(载入的 cid / 载入代次)请一次;没换不请;编辑 / 存为事盘 / 保存编辑不请;太乙页登记了 restoreCase', ()=>{
		const storageutil = require('../../../utils/storageutil');
		const H = require('../TaiyiZeriMain').default;
		const h = new H({ dispatch: jest.fn() });
		h.taiyiHook.restoreCase = jest.fn(()=>true);
		const user = { currentCase: { cid: { value: 'ty-1' }, updateTime: { value: 't1' } }, caseApplySeq: 1, appliedCaseCid: 'ty-1' };
		storageutil.getStore.mockReturnValue({ user });
		h.componentDidUpdate();
		h.componentDidUpdate();
		expect(h.taiyiHook.restoreCase).toHaveBeenCalledTimes(1);
		storageutil.getStore.mockReturnValue({ user: { ...user, caseApplySeq: 2 } });   // 同一条再载入一次
		h.componentDidUpdate();
		expect(h.taiyiHook.restoreCase).toHaveBeenCalledTimes(2);
		storageutil.getStore.mockReturnValue({ user: { ...user, caseApplySeq: 2, currentCase: { cid: { value: 'ty-1' }, updateTime: { value: 't2' } } } });   // 保存编辑
		h.componentDidUpdate();
		storageutil.getStore.mockReturnValue({ user: { ...user, caseApplySeq: 2, currentCase: { cid: { value: 'ty-2' }, updateTime: { value: 't1' } } } });   // 编辑另一条 / 存为事盘
		h.componentDidUpdate();
		expect(h.taiyiHook.restoreCase).toHaveBeenCalledTimes(2);
		storageutil.getStore.mockReturnValue({ user: {} });
		h.componentDidUpdate();
		expect(h.taiyiHook.restoreCase).toHaveBeenCalledTimes(2);
		storageutil.getStore.mockReturnValue(null);
		const src = require('fs').readFileSync(require('path').join(__dirname, '../../taiyi/TaiYiMain.js'), 'utf8');
		expect(src).toContain('this.props.hook.restoreCase = () => (this.unmounted ? false : this.restoreFromCurrentCase(false));');
	});
});

describe('择日点选后改工作台没重排就存案:存案的底板按所见那张盘;点选那一拍内嵌页就拿冻结 fields', ()=>{
	test('🔴 紫微 / 八字 / 七政 / 印度:点选(冻结 A)→ 改工作台地点(没重排)→ 存案的地点仍是 A(此前记成活值)', async ()=>{
		global.React = require('react');   // render() 只建元素树(不挂载),用来走一遍 render 里翻冻结标记的那段
		const kentang = require('../../../utils/kentangCaseSave');
		const spy = jest.spyOn(kentang, 'openKentangCaseDrawer').mockImplementation(()=>{});
		const { fetchChart } = require('../../../services/astro');
		for(const [file, hookName] of [['ZiweiZeriMain', 'ziweiHook'], ['BaziZeriMain', 'baziHook'], ['QizhengZeriMain', 'qizhengHook'], ['IndiaZeriMain', 'indiaHook']]){
			spy.mockClear();
			fetchChart.mockReset();
			fetchChart.mockImplementation(async ()=>({ Result: { params: {}, chart: {} } }));
			const H = require(`../${file}`).default;
			const h = new H({ dispatch: jest.fn() });
			h.setState = syncSetState;
			h[hookName].fun = jest.fn();
			h.applyWorkbenchCalibre = ()=>({ then: (f)=>f() });
			h.state = { ...h.state, geo: { ...(h.state.geo || {}), lon: '116e23', lat: '39n54', zone: '+08:00' } };
			h._scanGeo = { ...h.state.geo };
			h._scanOptions = { ...(h.state.options || {}) };
			h.onPickInterval({ start: '2026-10-05 08:00', pick: '2026-10-05 08:00:00' });
			await Promise.resolve(); await Promise.resolve();
			h.state = { ...h.state, geo: { ...h.state.geo, lon: '121e30' } };   // 改工作台地点,没重排
			h.render();   // render 里冻结标记翻成活值
			h.saveCase();
			expect([file, spy.mock.calls[0][0].fields.lon.value]).toEqual([file, '116e23']);
		}
		fetchChart.mockReset();
		fetchChart.mockImplementation(()=>new Promise(()=>{}));
		spy.mockRestore();
	});
	test('点选:setState 之前冻结标记已置(那一拍渲染就把冻结 fields 交给内嵌页)', ()=>{
		[['ZiweiZeriMain', 'ziweiHook'], ['BaziZeriMain', 'baziHook'], ['IndiaZeriMain', 'indiaHook'], ['LiurengZeriMain', 'liurengHook'], ['SanshiZeriMain', 'sanshiHook']].forEach(([file, hookName])=>{
			const H = require(`../${file}`).default;
			const h = new H({ dispatch: jest.fn() });
			let frozenAtRender = null;
			h.setState = function(upd, cb){ const p = typeof upd === 'function' ? upd(this.state, this.props) : upd; this.state = { ...this.state, ...p }; frozenAtRender = this._plotFrozen; };
			h[hookName].fun = jest.fn();
			h.onPickInterval({ start: '2026-10-05 08:00', pick: '2026-10-05 08:00:00' });
			expect([file, frozenAtRender]).toEqual([file, true]);
			expect(h._plotBaseKey).toBe(JSON.stringify([h.state.pickText, h.state.geo, h.state.options]));
		});
	});
});
