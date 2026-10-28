// 遁甲 / 太乙 / 三式合一(含三家择日里的内嵌盘,同一组件):起盘请求只认最后一次发起的那次 ——
// 先发的晚回,不得盖掉后发那次落屏的盘(也不得把旧盘写进温启状态、旧键写进去重键)。三家写法一致:每个 await 之后判。
jest.mock('../../astro/AstroHelper', ()=>({
	splitDegree: jest.fn(),
	convertLatToStr: (value)=>`${value}`,
	convertLonToStr: (value)=>`${value}`,
}));
jest.mock('../../liureng/ChuangChart', ()=>null);
jest.mock('../../amap/GeoCoordModal', ()=>null);
jest.mock('../../astro/PlusMinusTime', ()=>null);
jest.mock('../../../utils/request', ()=>jest.fn());
jest.mock('../../../utils/moduleAiSnapshot', ()=>({
	saveModuleAISnapshot: jest.fn(),
	saveModuleAISnapshotLazy: jest.fn(),
	loadModuleAISnapshot: jest.fn(()=>null),
}));
const nongliGates = [];
jest.mock('../../../utils/preciseCalcBridge', ()=>({
	fetchPreciseNongli: jest.fn((p)=>new Promise((resolve)=>{ nongliGates.push({ tag: p.tag, resolve }); })),
	fetchPreciseJieqiSeed: jest.fn(()=>Promise.resolve(null)),
}));

import SanShiUnitedMain from '../SanShiUnitedMain';
import DunJiaMain from '../../dunjia/DunJiaMain';
import TaiYiMain from '../../taiyi/TaiYiMain';
import DateTime from '../../comp/DateTime';

const flush = async ()=>{ for(let i = 0; i < 30; i += 1){ await Promise.resolve(); } };

function buildDateTime(text){
	const dt = new DateTime();
	dt.parse(text, 'YYYY-MM-DD HH:mm:ss');
	dt.setZone('+08:00');
	return dt;
}
function buildFields(text, tag){
	const dt = buildDateTime(text);
	return {
		tag,
		date: { value: dt.clone() }, time: { value: dt.clone() }, ad: { value: dt.ad },
		zone: { value: '+08:00' }, lon: { value: '116e24' }, lat: { value: '39n54' },
		gpsLon: { value: '116e24' }, gpsLat: { value: '39n54' },
		zodiacal: { value: 0 }, hsys: { value: 0 }, timeAlg: { value: 0 }, gender: { value: 1 },
	};
}
const FA = ()=>buildFields('2026-03-01 01:00:00', 'A');
const FB = ()=>buildFields('2026-03-01 03:00:00', 'B');

// ── 遁甲 ──
function fakeDunJia(){
	const panGates = [];
	const host = {
		props: {}, unmounted: false, requestSeq: 0, pendingNongli: null, lastNongliKey: '', lastPanSignature: '', jieqiYearSeeds: {}, scope: 'dunjia-latest-test',
		state: { options: { paiPanType: 3, school: '转盘', after23NewDay: 0, timeAlg: 0 }, nongli: null, pan: null, loading: false, hasPlotted: false },
		genParams(f){ return { tag: f.tag }; },
		resolveDisplaySolarTime(){ return Promise.resolve(''); },
		getContext(){ return { isDiurnal: true }; },
		ensureJieqiSeed(){ return Promise.resolve({}); },
		getResolvedPan(flds, nongli, opts){ return new Promise((resolve)=>{ panGates.push({ tag: flds.tag, paiPanType: opts.paiPanType, resolve }); }); },
		applyFaRelatedToPan(){}, boundaryTouchedMap(){ return {}; }, saveLiveSnapshot(){ return ''; },
		setState(p, cb){ this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; if(cb){ cb(); } },
	};
	host.requestNongli = DunJiaMain.prototype.requestNongli.bind(host);
	host.recalc = DunJiaMain.prototype.recalc.bind(host);
	host.onJieqiSeedArrived = DunJiaMain.prototype.onJieqiSeedArrived.bind(host);
	return { host, panGates };
}
const replyNongli = (tag)=>{ const g = nongliGates.find((x)=>x.tag === tag && !x.done); g.done = true; g.resolve({ tag, dayGanZi: '甲子' }); };

describe('遁甲', ()=>{
	beforeEach(()=>{ nongliGates.length = 0; });

	test.each([[['B', 'A']], [['A', 'B']]])('连起两盘(改时间),取盘回包顺序 %j:落屏的是后发那次', async (order)=>{
		const { host, panGates } = fakeDunJia();
		// A 已过了取历法、正停在最后一个 await(取盘)上,这时才发 B —— 正是此前漏判的那一段
		host.requestNongli(FA(), true); await flush();
		replyNongli('A'); await flush();
		host.requestNongli(FB(), true); await flush();
		replyNongli('B'); await flush();
		expect(panGates.map((g)=>g.tag)).toEqual(['A', 'B']);
		for(const t of order){ panGates.find((g)=>g.tag === t).resolve({ panTag: t }); await flush(); }
		expect(host.state.pan).toEqual({ panTag: 'B' });
		expect(host.state.nongli.tag).toBe('B');
		expect(host.lastNongliKey).toContain('03:00:00');
		expect(host.state.loading).toBe(false);
	});

	test('改时间的取盘在途时改档(就地重算)后发:在途那次晚回不盖掉改档的盘', async ()=>{
		const { host, panGates } = fakeDunJia();
		host.requestNongli(FA(), true); await flush();
		replyNongli('A'); await flush();
		panGates[0].resolve({ panTag: 'A1' }); await flush();
		// 同一时间再强制起一次(按旧档),在途时改档 → recalc 后发
		host.requestNongli(FA(), true); await flush();
		replyNongli('A'); await flush();
		const inflight = panGates[1];
		host.state.options = { ...host.state.options, paiPanType: 1 };
		host.recalc(FA(), host.state.nongli, host.state.options, ''); await flush();
		panGates[2].resolve({ panTag: 'A-new-option' }); await flush();
		inflight.resolve({ panTag: 'A-old-option' }); await flush();
		expect(host.state.pan).toEqual({ panTag: 'A-new-option' });
	});

	test('同键在途合并不顶替改了档的那次', async ()=>{
		const { host } = fakeDunJia();
		const a = host.requestNongli(FA(), true); await flush();
		host.state.options = { ...host.state.options, paiPanType: 1 };
		const b = host.requestNongli(FA(), true);
		expect(b).not.toBe(a);
	});

	test('种子晚到:屏上农历与当前时间对不上(改时间的取盘在途)时不按新时间 + 旧农历重算', async ()=>{
		const { host, panGates } = fakeDunJia();
		host.state = { ...host.state, hasPlotted: true, nongli: { tag: 'A' }, pan: { panTag: 'A' }, localFields: FB(), options: { ...host.state.options, paiPanType: 1 } };
		host.lastNongliKey = 'stale-key-of-A';
		host.onJieqiSeedArrived();
		await flush();
		expect(panGates).toHaveLength(0);
	});
});

// ── 太乙 ──
function fakeTaiYi(){
	const host = {
		props: {}, unmounted: false, taiyiRequestSeq: 0, _nongliReqSeq: 0,
		state: { options: { style: 3 }, nongli: null },
		genParams(f){ return { tag: f.tag }; },
		setState(p, cb){ this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; if(cb){ cb(); } },
	};
	host.recalc = async function(fields, nongli){
		const s = ++this.taiyiRequestSeq;
		await Promise.resolve();
		if(s !== this.taiyiRequestSeq){ return; }
		this.setState({ pan: { tag: fields.tag, nongliTag: nongli && nongli.tag } });
	};
	host.requestNongli = TaiYiMain.prototype.requestNongli.bind(host);
	return host;
}

describe('太乙', ()=>{
	beforeEach(()=>{ nongliGates.length = 0; });

	test.each([[['B', 'A']], [['A', 'B']]])('连起两局,取历法回包顺序 %j:落屏的是后发那次', async (order)=>{
		const host = fakeTaiYi();
		host.requestNongli({ tag: 'A' }); await flush();
		host.requestNongli({ tag: 'B' }); await flush();
		for(const t of order){ replyNongli(t); await flush(); }
		expect(host.state.pan).toEqual({ tag: 'B', nongliTag: 'B' });
		expect(host.state.nongli.tag).toBe('B');
	});

	test('载入存案推进取历法代次:在途那次回来不重算盖掉存档盘', async ()=>{
		const host = fakeTaiYi();
		host.requestNongli({ tag: 'A' }); await flush();
		host._nongliReqSeq += 1;   // 与 restoreFromCurrentCase 同一步
		host.state.pan = { tag: 'saved' };
		replyNongli('A'); await flush();
		expect(host.state.pan).toEqual({ tag: 'saved' });
	});

	test('存案复原位置确实推进取历法代次', ()=>{
		const t = require('fs').readFileSync(require('path').join(__dirname, '../../taiyi/TaiYiMain.js'), 'utf8');
		expect(t).toContain('this._nongliReqSeq = (this._nongliReqSeq || 0) + 1;   // 在途的取历法作废');
	});
});

// ── 三式合一 ──
describe('三式合一', ()=>{
	const NONGLI = {
		yearJieqi: '丙午', year: '丙午', monthGanZi: '庚寅', dayGanZi: '戊戌', time: '癸丑', jieqi: '雨水',
		jiedelta: '雨水后第11天', birth: '2026-03-01 01:00:00', month: '正月', day: '十三', leap: false,
	};
	function mountLike(component){
		component.setState = (patch, callback)=>{
			const nextPatch = typeof patch === 'function' ? patch(component.state, component.props) : patch;
			component.state = { ...component.state, ...(nextPatch || {}) };
			if(callback){ callback(); }
		};
		component.scheduleSnapshotSave = ()=>{};
		return component;
	}
	const chart = { chartId: 'latest', chart: { objects: [], nongli: { dayGanZi: '戊戌', time: '癸丑' }, isDiurnal: false } };

	test.each([[['B', 'A']], [['A', 'B']]])('连算两盘,奇门 / 太乙后端回包顺序 %j:落屏的是后发那次', async (order)=>{
		const gates = [];
		const component = mountLike(new SanShiUnitedMain({ fields: FA(), chartObj: chart, hook: {} }));
		const gz = { year: '丙午', month: '庚寅', day: '戊戌', time: '癸丑' };
		component.getKinqimenDunJia = (flds)=>new Promise((resolve)=>{ gates.push({ kind: 'qm', tag: flds.tag, resolve: ()=>resolve({ tag: flds.tag, ganzhi: gz }) }); });
		component.getKintaiyiPan = (flds)=>new Promise((resolve)=>{ gates.push({ kind: 'ty', tag: flds.tag, resolve: ()=>resolve({ tag: flds.tag }) }); });
		const a = component.performRecalcByNongli(FA(), NONGLI, null, '');
		const b = component.performRecalcByNongli(FB(), { ...NONGLI, time: '甲寅' }, null, '');
		await flush();
		expect(gates).toHaveLength(4);
		for(const t of order){ gates.filter((g)=>g.tag === t).forEach((g)=>g.resolve()); await flush(); }
		const [ra, rb] = await Promise.all([a, b]);
		expect(component.state.dunjia.tag).toBe('B');
		expect(component.state.taiyi.tag).toBe('B');
		expect(component.state.nongli.time).toBe('甲寅');
		expect(rb).toBe(true);
		expect(ra).toBe(false);
		expect(component.lastRecalcSignature).toContain('03:00:00');
	});

	// 经防抖入口(recalcByNongli):每一次运行只结它开跑时取走的那批调用方 —— 被作废的先发那次回包,
	// 不得把后发那次的调用方提前定成 false(那时后发那次还在途:调用方会收起加载态、放行排队的起盘补发)
	test.each([[['A', 'B']], [['B', 'A']]])('两次重算都在途,回包顺序 %j:各自的调用方只收到自己那次的结果', async (order)=>{
		jest.useFakeTimers();
		try{
			const gates = [];
			const component = mountLike(new SanShiUnitedMain({ fields: FA(), chartObj: chart, hook: {} }));
			const gz = { year: '丙午', month: '庚寅', day: '戊戌', time: '癸丑' };
			component.getKinqimenDunJia = (flds)=>new Promise((resolve)=>{ gates.push({ tag: flds.tag, resolve: ()=>resolve({ tag: flds.tag, ganzhi: gz }) }); });
			component.getKintaiyiPan = (flds)=>new Promise((resolve)=>{ gates.push({ tag: flds.tag, resolve: ()=>resolve({ tag: flds.tag }) }); });
			const done = {};
			component.recalcByNongli(FA(), NONGLI, null, '', { loading: false }).then((v)=>{ done.A = v; });
			jest.advanceTimersByTime(1000); await flush();   // A 已开跑(在途)
			component.recalcByNongli(FB(), { ...NONGLI, time: '甲寅' }, null, '', { loading: false }).then((v)=>{ done.B = v; });
			jest.advanceTimersByTime(1000); await flush();   // B 已开跑(在途)
			expect(gates.map((g)=>g.tag).sort()).toEqual(['A', 'A', 'B', 'B']);
			const first = order[0];
			const second = order[1];
			gates.filter((g)=>g.tag === first).forEach((g)=>g.resolve()); await flush();
			expect(done[second]).toBeUndefined();   // 另一次还在途:它的调用方不得已被定局
			gates.filter((g)=>g.tag === second).forEach((g)=>g.resolve()); await flush();
			expect(component.state.dunjia.tag).toBe('B');
			expect(done.B).toBe(true);
			expect(done.A).toBe(false);   // 先发那次被作废:不落屏,它的调用方照实收到 false
			expect(component.pendingRecalcResolvers).toHaveLength(0);
		}finally{
			jest.useRealTimers();
		}
	});
});
