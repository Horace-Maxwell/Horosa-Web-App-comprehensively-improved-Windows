// 八重合页的取数:旧盘的分不能留在页面和快照里,男方跟盘走。
global.React = require('react');

jest.mock('../../../utils/request', ()=>({ __esModule: true, default: jest.fn() }));

const request = require('../../../utils/request').default;
const Constants = require('../../../utils/constants');
const AstroAshtakoota = require('../AstroAshtakoota').default;

const PAIR_A = { inner: { date: '2000/01/01' }, outer: { date: '2001/01/01' }, hsys: 0, relative: 0, siderealAyanamsa: '' };
const PAIR_B = { ...PAIR_A, outer: { date: '2002/02/02' } };
const score = (total)=>({ [Constants.ResultKey]: { rows: [], total, classicTotal: total, max: 36, ayanamsa: 'Lahiri' } });

function deferred(){
	let resolve;
	let reject;
	const promise = new Promise((ok, no)=>{ resolve = ok; reject = no; });
	return { promise, resolve, reject };
}

function page(props){
	const inst = new AstroAshtakoota({ onResult: jest.fn(), ...props });
	inst.setState = (patch)=>{ inst.state = { ...inst.state, ...patch }; };
	inst.forceUpdate = ()=>{};
	inst._mounted = true;
	inst._pairKey = inst.pairKey();
	return inst;
}

const settle = ()=>new Promise((resolve)=>setTimeout(resolve, 0));

beforeEach(()=>{ request.mockReset(); });

describe('八重合取数', ()=>{
	test('切页签不重算', async ()=>{
		request.mockResolvedValue(score(20));
		const inst = page({ params: PAIR_A });
		await inst.load();
		inst.componentDidUpdate();
		inst.props = { ...inst.props, params: { ...PAIR_A, relative: 2 } };
		inst.componentDidUpdate();
		await settle();
		expect(request).toHaveBeenCalledTimes(1);
		expect(JSON.parse(request.mock.calls[0][1].body).relative).toBeUndefined();
	});

	test('换盘时旧回包不算数', async ()=>{
		const first = deferred();
		request.mockReturnValueOnce(first.promise);
		const inst = page({ params: PAIR_A });
		const pending = inst.load();
		inst.props = { ...inst.props, params: PAIR_B };
		first.resolve(score(20));
		await pending;
		expect(inst.shown()).toBe(null);
		inst.report();
		expect(inst.props.onResult).not.toHaveBeenCalledWith(expect.objectContaining({ total: 20 }));
	});

	test('新盘失败时不留旧分,快照也清掉', async ()=>{
		request.mockResolvedValueOnce(score(20));
		const inst = page({ params: PAIR_A });
		await inst.load();
		inst.report();
		expect(inst.props.onResult).toHaveBeenLastCalledWith(expect.objectContaining({ total: 20 }));
		inst.props = { ...inst.props, params: PAIR_B };
		request.mockRejectedValueOnce(new Error('down'));
		inst.componentDidUpdate();
		await settle();
		expect(inst.shown()).toBe(null);
		expect(inst.state.failed).toBe(true);
		inst.report();
		expect(inst.props.onResult).toHaveBeenLastCalledWith(null);
		clearTimeout(inst._retryTimer);
	});

	test('换男方后旧分不显示', async ()=>{
		request.mockResolvedValueOnce(score(20));
		const inst = page({ params: PAIR_A });
		await inst.load();
		inst.state.maleSide = 'outer';
		expect(inst.shown()).toBe(null);
	});

	test('清空星盘后不显示分数', async ()=>{
		request.mockResolvedValueOnce(score(20));
		const inst = page({ params: PAIR_A });
		await inst.load();
		inst.props = { ...inst.props, params: null };
		expect(inst.shown()).toBe(null);
	});
});

describe('男方', ()=>{
	test('缺省跟记录性别', ()=>{
		expect(JSON.parse(JSON.stringify(page({ params: PAIR_A, maleDefault: 'outer' }).body())).maleSide).toBe('outer');
	});

	test('手动改过之后优先,换盘回到缺省', ()=>{
		const inst = page({ params: PAIR_A, maleDefault: 'inner' });
		inst.state.maleSide = 'outer';
		expect(inst.body().maleSide).toBe('outer');
		inst.props = { ...inst.props, params: PAIR_B };
		inst.componentDidUpdate();
		expect(inst.state.maleSide).toBe(null);
		expect(inst.body().maleSide).toBe('inner');
	});
});

describe('存盘快照', ()=>{
	const SRC = require('fs').readFileSync(require('path').join(__dirname, '../../astro/AstroRelative.js'), 'utf8');
	test('八重合结果被清掉时,存盘的旧分一并清掉', ()=>{
		const body = SRC.slice(SRC.indexOf('saveRelativeSnapshot(){'), SRC.indexOf('const params = this.genParams() || {};', SRC.indexOf('saveRelativeSnapshot(){')));
		expect(body).toMatch(/if\(!result\)\{[\s\S]*currentTab === 'Ashtakoota'[\s\S]*clearModuleAISnapshot\('relative'\)/);
	});
});
