// 行为用例:卜类页换了起课时刻 / 地点后,在途 / 取失败时不拿上一课的底盘、农历、课、盘顶这一课;同一课只改设置照旧留存。
// 静态守卫见 divinationCastSourceGuard.test.js。
const gates = [];
jest.mock('../../utils/request', ()=>({ __esModule: true, default: jest.fn((url, opt)=>new Promise((resolve)=>{ gates.push({ url, body: JSON.parse(opt.body), resolve }); })) }));
const kentangGates = [];
const chartGates = [];
jest.mock('../../services/astro', ()=>({ fetchChart: jest.fn(()=>new Promise((resolve, reject)=>{ chartGates.push({ resolve, reject }); })) }));
jest.mock('../../services/kentangPost', ()=>({ postKentang: jest.fn(()=>new Promise((resolve, reject)=>{ kentangGates.push({ resolve, reject }); })) }));
jest.mock('../../utils/moduleAiSnapshot', ()=>({
	saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn(), loadModuleAISnapshot: jest.fn(()=>null), clearModuleAISnapshot: jest.fn(),
}));

const DateTime = require('../comp/DateTime').default;
const { clearModuleAISnapshot } = require('../../utils/moduleAiSnapshot');
const { castSourceKey } = require('../../utils/derivedChartSource');
const LiuRengMain = require('../lrzhan/LiuRengMain').default;
const JinKouMain = require('../jinkou/JinKouMain').default;
const DunJiaMain = require('../dunjia/DunJiaMain').default;
const TaiYiMain = require('../taiyi/TaiYiMain').default;
const TaiXuanMain = require('../taixuan/TaiXuanMain').default;
const LiurengZeriMain = require('../zeri/LiurengZeriMain').default;

const flush = async ()=>{ for(let i = 0; i < 12; i += 1){ await Promise.resolve(); } };
function castFields(text, tag, lon = '116e24'){
	const dt = new DateTime().parse(text, 'YYYY-MM-DD HH:mm:ss');
	dt.setZone('+08:00');
	return { tag, date: { value: dt }, time: { value: dt.clone() }, ad: { value: dt.ad }, zone: { value: '+08:00' }, lon: { value: lon }, lat: { value: '39n54' }, gpsLon: { value: 116.4 }, gpsLat: { value: 39.9 } };
}
// /chart 回包:params 是起盘服务回显的起盘时刻地点
function chartFor(f, extra){
	return { params: { birth: `${f.date.value.format('YYYY-MM-DD')} ${f.time.value.format('HH:mm:ss')}`, zone: '+08:00', lon: f.lon.value, lat: f.lat.value }, chart: { tag: f.tag, isDiurnal: true, nongli: { dayGanZi: '甲子', time: '甲子', clockTime: '' }, ...(extra || {}) } };
}
const A = castFields('2026-10-25 09:00:00', 'A');
const B = castFields('2026-10-25 11:00:00', 'B');

describe('六壬:底盘、起课时刻与课同一次落定', ()=>{
	function fake(props){
		return {
			props: props || {}, unmounted: false,
			state: { wuxingUserSet: true, wuxing: '木', birth: null, liureng: null, runyear: null, guireng: 0, timeAlg: 0, calcFields: null, calcChart: null },
			godsCache: new Map(), godsInflight: new Map(),
			genGodsParams: (f)=>({ tag: f.tag }),
			lessonChartFor: LiuRengMain.prototype.lessonChartFor,
			requestGods: LiuRengMain.prototype.requestGods,
			requestRunYear: ()=>{}, saveLiuRengAISnapshot: ()=>{},
			setState(p, cb){ this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; if(cb){ cb(); } },
		};
	}
	const reply = (g)=>g.resolve({ Result: { liureng: { tag: g.body.tag, nongli: { dayGanZi: '甲子' } } } });

	test('在途期间屏上仍是上一课的整套;回包后底盘 / 时刻 / 课一起换', async ()=>{
		gates.length = 0;
		const inst = fake({ value: chartFor(B) });
		inst.state = { ...inst.state, calcFields: A, calcChart: chartFor(A).chart, liureng: { tag: 'A' } };
		LiuRengMain.prototype.startPaiPanByFields.call(inst, B);
		expect(gates.length).toBe(1);
		expect([inst.state.calcFields.tag, inst.state.calcChart.tag, inst.state.liureng.tag]).toEqual(['A', 'A', 'A']);
		reply(gates[0]); await flush();
		expect([inst.state.calcFields.tag, inst.state.calcChart.tag, inst.state.liureng.tag]).toEqual(['B', 'B', 'B']);
	});
	test('主盘还是上一刻的(对不上起课时刻):不拿它起课', ()=>{
		gates.length = 0;
		const inst = fake({ value: chartFor(A) });
		LiuRengMain.prototype.startPaiPanByFields.call(inst, B);
		expect(gates.length).toBe(0);
		LiuRengMain.prototype.startPaiPanByFields.call(inst, B, chartFor(B));
		expect(gates.length).toBe(1);
	});
	test('换了起课时刻后取失败:上一课清掉(连同快照槽),盘面回到这一刻的底盘;同一组参数之后照常重取', async ()=>{
		gates.length = 0;
		clearModuleAISnapshot.mockClear();
		const inst = fake({ value: chartFor(B) });
		inst.state = { ...inst.state, calcFields: A, calcChart: chartFor(A).chart, liureng: { tag: 'A' } };
		LiuRengMain.prototype.startPaiPanByFields.call(inst, B);
		gates[0].resolve(null); await flush();
		expect(inst.state.liureng).toBeNull();
		expect([inst.state.calcFields.tag, inst.state.calcChart.tag]).toEqual(['B', 'B']);
		expect(clearModuleAISnapshot).toHaveBeenCalledWith('liureng');
		LiuRengMain.prototype.startPaiPanByFields.call(inst, B);
		expect(gates.length).toBe(2);
		reply(gates[1]); await flush();
		expect(inst.state.liureng.tag).toBe('B');
	});
	test('同一课只改设置时取失败:屏上那一课留存', async ()=>{
		gates.length = 0;
		clearModuleAISnapshot.mockClear();
		const inst = fake({ value: chartFor(A) });
		inst.state = { ...inst.state, calcFields: A, calcChart: chartFor(A).chart, liureng: { tag: 'A' } };
		LiuRengMain.prototype.requestGods.call(inst, A);
		gates[0].resolve(null); await flush();
		expect(inst.state.liureng.tag).toBe('A');
		expect(clearModuleAISnapshot).not.toHaveBeenCalled();
	});
});

describe('金口诀:盘面画与课同一次落定的底盘', ()=>{
	function fake(props){
		return {
			props: props || {}, unmounted: false,
			state: { wuxingAuto: true, diFen: '子', diFenAuto: true, liureng: null, runyear: null, birth: null, yueJiang: '', zhanShi: '', timeBasis: 'clock', guireng: 0, calcFields: null, calcChart: null },
			godsCache: new Map(), godsInflight: new Map(),
			genGodsParams: (f)=>({ tag: f.tag }),
			requestRunYear: ()=>{}, saveJinKouSnapshot: ()=>{},
			setState(p, cb){ this.state = { ...this.state, ...p }; if(cb){ cb(); } },
		};
	}
	// 起课之后的金口诀排盘请求(本机计算服务)一律回空:这里只看起课与底盘怎么落定
	const settle = async ()=>{ for(let k = 0; k < 4; k += 1){ gates.slice(1).forEach((g)=>g.resolve({ Result: {} })); kentangGates.forEach((g)=>g.resolve(null)); await flush(); } };

	test('起课时带上同一时刻的底盘(对不上的主盘不进来);昼夜按这一课', async ()=>{
		gates.length = 0;
		const inst = fake({ value: chartFor(A) });
		const p = JinKouMain.prototype.requestGods.call(inst, B);
		gates[0].resolve({ Result: { liureng: { tag: 'B', nongli: { dayGanZi: '甲子', time: '甲子' } } } }); await flush(); await settle(); await p;
		expect(inst.state.calcFields.tag).toBe('B');
		expect(inst.state.calcChart).toBeNull();
		expect(typeof inst.state.calcIsDiurnal).toBe('boolean');
		// 同一课再起一次(这回调用方带上同一时刻的底盘;起课神煞命中本页缓存,不再发请求)
		const p2 = JinKouMain.prototype.requestGods.call(inst, B, chartFor(B));
		await settle(); await p2;
		expect(inst.state.calcChart.chart.tag).toBe('B');
	});
	test('换了起课时刻后取失败:上一课清掉;同一课取失败留存', async ()=>{
		gates.length = 0;
		clearModuleAISnapshot.mockClear();
		const inst = fake({ value: chartFor(B) });
		inst.state = { ...inst.state, calcFields: A, calcChart: chartFor(A), liureng: { tag: 'A' }, jinkouPan: { tag: 'A' } };
		const p = JinKouMain.prototype.requestGods.call(inst, A);
		gates[0].resolve(null); await settle(); await p;
		expect(inst.state.liureng.tag).toBe('A');
		expect(clearModuleAISnapshot).not.toHaveBeenCalled();
		gates.length = 0;
		const p2 = JinKouMain.prototype.requestGods.call(inst, B);
		gates[0].resolve(null); await settle(); await p2;
		expect([inst.state.liureng, inst.state.jinkouPan, inst.state.calcFields.tag]).toEqual([null, null, 'B']);
		expect(inst.state.calcChart.chart.tag).toBe('B');
		expect(clearModuleAISnapshot).toHaveBeenCalledWith('jinkou');
	});
});

describe('奇门:昼夜只认同一时刻的参照盘;取失败按是否同一课留存 / 清掉', ()=>{
	const ctxOf = (props, flds)=>DunJiaMain.prototype.getContext.call({ props, state: {}, jieqiYearSeeds: {} }, flds);
	test('参照盘与起课同一时刻 → 用它的昼夜;别的时刻的盘(主盘在途 / 择日宿主传的全局盘)→ 按起课时刻本地算', ()=>{
		const night = castFields('2026-10-25 23:30:00', 'N');
		expect(ctxOf({ value: chartFor(night) }, night).isDiurnal).toBe(true);   // 夹具的参照盘写昼:同一时刻就照用
		expect(ctxOf({ value: chartFor(A) }, night).isDiurnal).toBe(false);   // 别的时刻的盘不认,23:30 本地算 = 夜
		expect(ctxOf({ value: null }, castFields('2026-10-25 12:00:00', 'M')).isDiurnal).toBe(true);
	});
	test('settleCastFailure:同一课留存;换了时刻地点清掉盘与快照槽', ()=>{
		clearModuleAISnapshot.mockClear();
		const inst = { scope: 'qimen', state: { pan: { tag: 'A' }, panSig: castSourceKey(A), loading: true }, lastPanSignature: 'x', setState(p){ this.state = { ...this.state, ...p }; } };
		DunJiaMain.prototype.settleCastFailure.call(inst, A);
		expect([inst.state.pan.tag, inst.state.loading]).toEqual(['A', false]);
		DunJiaMain.prototype.settleCastFailure.call(inst, B);
		expect([inst.state.pan, inst.state.panSig, inst.lastPanSignature]).toEqual([null, '', '']);
		expect(clearModuleAISnapshot).toHaveBeenCalledWith('qimen');
	});
});

describe('太乙:屏上农历只认同一课', ()=>{
	test('换了起课时刻:不拿上一课的农历立这一课;同一课照用', ()=>{
		const inst = { props: { fields: B }, state: { nongli: { tag: 'A' }, nongliSig: castSourceKey(A) } };
		expect(TaiYiMain.prototype.castNongliFor.call(inst, B)).toBeNull();
		expect(TaiYiMain.prototype.castNongliFor.call(inst, A)).toEqual({ tag: 'A' });
		expect(TaiYiMain.prototype.castNongliFor.call({ ...inst, state: { nongli: { tag: 'A' }, nongliSig: '' } }, A)).toBeNull();
	});
});

describe('太玄(随机起式类同形):取失败不留上一课', ()=>{
	test('同一时刻同一种子取失败 → 留存;换了时刻取失败 → 清掉(连同快照槽)', async ()=>{
		kentangGates.length = 0;
		clearModuleAISnapshot.mockClear();
		const inst = { unmounted: false, requestSeq: 0, state: { pan: { tag: 'A' }, panSig: `${castSourceKey(A)}#7`, seed: 7, loading: false }, setState(p){ this.state = { ...this.state, ...p }; } };
		const p1 = TaiXuanMain.prototype.fetchPan.call(inst, A);
		kentangGates[0].reject(new Error('x')); await flush(); await p1;
		expect(inst.state.pan.tag).toBe('A');
		expect(clearModuleAISnapshot).not.toHaveBeenCalled();
		const p2 = TaiXuanMain.prototype.fetchPan.call(inst, B);
		kentangGates[1].reject(new Error('x')); await flush(); await p2;
		expect([inst.state.pan, inst.state.panSig]).toEqual([null, '']);
		expect(clearModuleAISnapshot).toHaveBeenCalledWith('taixuan');
	});
});

describe('择日六壬宿主:取这一刻的底盘失败 → 盘区留空(换了时刻地点清掉上一课;同一课只改设置留存)', ()=>{
	test('内嵌六壬页:换了起课时刻清掉课与底盘、作废在途、清快照槽;同一课留存', ()=>{
		clearModuleAISnapshot.mockClear();
		const inst = { props: { techniqueScope: 'liurengzeri' }, state: { calcFields: A, calcChart: chartFor(A).chart, liureng: { tag: 'A' }, runyear: { y: 1 } }, _godsReqSeq: 3, _runYearReqSeq: 5,
			setState(p){ this.state = { ...this.state, ...p }; } };
		LiuRengMain.prototype.settleCastChartFailure.call(inst, A);
		expect([inst.state.liureng.tag, inst.state.calcChart.tag, inst._godsReqSeq]).toEqual(['A', 'A', 3]);
		expect(clearModuleAISnapshot).not.toHaveBeenCalled();
		LiuRengMain.prototype.settleCastChartFailure.call(inst, B);
		expect([inst.state.liureng, inst.state.runyear, inst.state.calcChart, inst.state.calcFields.tag]).toEqual([null, null, null, 'B']);
		expect([inst._godsReqSeq, inst._runYearReqSeq]).toEqual([4, 6]);
		expect(clearModuleAISnapshot).toHaveBeenCalledWith('liurengzeri');
	});
	function host(){
		const calls = [];
		return {
			calls, unmounted: false, state: { pickText: '2026-10-25 11:00:00', geo: { zone: '+08:00', lon: '116e24', lat: '39n54' }, options: {}, embedPatch: {} },
			buildFields: ()=>B,
			liurengHook: { chartUnavailable: (f)=>calls.push(['unavailable', f.tag]), fun: (f)=>calls.push(['fun', f.tag]), setChart: (f)=>calls.push(['setChart', f.tag]) },
			setState(p, cb){ this.state = { ...this.state, ...p }; if(cb){ cb(); } },
		};
	}
	test('宿主:底盘取失败 / 回包不成形 → 告诉内嵌页这一刻没有底盘;被更晚的请求作废 / 载入存案只换底盘的那条 → 不清', async ()=>{
		chartGates.length = 0;
		const h = host();
		LiurengZeriMain.prototype.requestChartAndPlot.call(h, false);
		chartGates[0].reject(new Error('down')); await flush();
		expect(h.calls).toEqual([['unavailable', 'B']]);
		LiurengZeriMain.prototype.requestChartAndPlot.call(h, false);
		chartGates[1].resolve({ Result: null }); await flush();
		expect(h.calls).toEqual([['unavailable', 'B'], ['unavailable', 'B']]);
		h.calls.length = 0;
		LiurengZeriMain.prototype.requestChartAndPlot.call(h, false);
		LiurengZeriMain.prototype.requestChartAndPlot.call(h, false);   // 更晚的一次把前一次作废
		chartGates[2].reject(new Error('down')); await flush();
		expect(h.calls).toEqual([]);
		chartGates[3].resolve({ Result: { params: chartFor(B).params, chart: chartFor(B).chart } }); await flush();
		expect(h.calls).toEqual([['fun', 'B']]);
		h.calls.length = 0;
		LiurengZeriMain.prototype.requestChartAndPlot.call(h, false, { chartOnly: true });
		chartGates[4].reject(new Error('down')); await flush();
		expect(h.calls).toEqual([]);
	});
});

