// 择日载入存案 / 方案库载入:存案里没有可用本命时,本命清空、本命输入框回构造缺省 —— 不把会话里上一位的出生信息
// 挂在这条事盘下面(再存一次就写进去)。矩阵:没有择日数据 / 旧版只认 cfg + tree / 本命坏形(数组 / 字符串 / 数字 / {})
// × 有本命的宿主(八字 / 紫微);印度:本命月宿 / 月座在存案没带时回「未设」(其余没写的参数同样回出厂值,见 zeriFullDefaultsContract)。方案库四个工作台同一校验。
jest.mock('../../../services/astro', () => ({ fetchChart: jest.fn(async () => ({ Result: null })) }));
const fs = require('fs');
const path = require('path');
const { setGlobalStore } = require('../../../utils/storageutil');
const { restoreZeriWorkbenchFromCase } = require('../zeriCaseRestore');
const { zeriNatalInputDefault, normalizeSavedNatal, restoredNatalInput } = require('../zeriNatal');

const SESSION_NATAL = { yearGZ: '上一位', date: '1980-01-01' };
const SESSION_INPUT = { date: '1980-01-01', time: '08:30', zone: '+09:00', gender: 0 };
const CASES = [
	['没有择日数据', undefined],
	['旧版只有 cfg + tree', { cfg: { startDate: '2026-03-01', endDate: '2026-03-02' }, tree: { kind: 'group', joiner: 'all', negate: false, children: [] } }],
	['本命是数组', { pickText: '2026-03-01 10:00:00', natal: [] }],
	['本命是字符串', { pickText: '2026-03-01 10:00:00', natal: '1990-05-18' }],
	['本命是数字', { pickText: '2026-03-01 10:00:00', natal: 19900518 }],
	['本命是空对象', { pickText: '2026-03-01 10:00:00', natal: {} }],
	['本命显式 null', { pickText: '2026-03-01 10:00:00', natal: null }],
];
const store = (scope, zeri)=>setGlobalStore({ user: { caseApplySeq: 1, appliedCaseCid: 'nr-1', currentCase: {
	cid: { value: 'nr-1' }, updateTime: { value: 't' }, caseType: { value: scope }, sourceModule: { value: scope },
	payload: { value: JSON.stringify(zeri === undefined ? { module: scope } : { module: scope, zeri }) } } } });
function mkHost(Cls){
	const h = new Cls({ dispatch: jest.fn() });
	h.setState = function(p, cb){ const patch = typeof p === 'function' ? p(this.state) : p; if(patch){ this.state = { ...this.state, ...patch }; } if(cb){ cb(); } };
	h.replotAfterRestore = ()=>{};
	return h;
}

afterEach(()=>{ setGlobalStore({}); });

describe.each([
	['八字择日', ()=>require('../BaziZeriMain').default, 'bazizeri'],
	['紫微择日', ()=>require('../ZiweiZeriMain').default, 'ziweizeri'],
])('%s', (_n, load, scope)=>{
	test.each(CASES)('%s → 本命清空、输入框回构造缺省', (_c, zeri)=>{
		const h = mkHost(load());
		expect(h.state.natalInput).toEqual(zeriNatalInputDefault());   // 构造缺省单源
		h.state.natal = { ...SESSION_NATAL };
		h.state.natalInput = { ...SESSION_INPUT };
		store(scope, zeri);
		expect(restoreZeriWorkbenchFromCase(h, scope)).toBe(true);
		expect(h.state.natal).toBe(null);
		expect(h.state.natalInput).toEqual(zeriNatalInputDefault());
	});
	test('存案带可用本命与输入框:照存案(输入框缺的项回构造缺省,不留会话的)', ()=>{
		const h = mkHost(load());
		h.state.natalInput = { ...SESSION_INPUT };
		store(scope, { pickText: '2026-03-01 10:00:00', natal: { yearGZ: '庚午' }, natalInput: { date: '1990-05-18' } });
		restoreZeriWorkbenchFromCase(h, scope);
		expect(h.state.natal).toEqual({ yearGZ: '庚午' });
		expect(h.state.natalInput).toEqual({ ...zeriNatalInputDefault(), date: '1990-05-18' });
	});
});

describe('印度择日:本命月宿 / 月座', ()=>{
	const India = ()=>require('../IndiaZeriMain').default;
	test.each([['没有择日数据', undefined], ['存案参数没带这两项', { pickText: '2026-03-01 10:00:00', options: { ayanamsa: 'raman' } }]])('%s → 回「未设」,其余没写的参数也回出厂值(不取会话现值)', (_c, zeri)=>{
		const h = mkHost(India());
		h.state.options = { ...h.state.options, nodeType: 'true', natalMoonNak: 5, natalMoonSign: 3 };
		store('indiazeri', zeri);
		restoreZeriWorkbenchFromCase(h, 'indiazeri');
		expect([h.state.options.natalMoonNak, h.state.options.natalMoonSign]).toEqual([0, 0]);
		expect(h.state.options.nodeType).toBe('mean');   // 存案没写 → 出厂值(会话里改过的不混进来)
		if(zeri){ expect(h.state.options.ayanamsa).toBe('raman'); }
	});
	test('存案带这两项:照存案', ()=>{
		const h = mkHost(India());
		store('indiazeri', { pickText: '2026-03-01 10:00:00', options: { natalMoonNak: 7, natalMoonSign: 2 } });
		restoreZeriWorkbenchFromCase(h, 'indiazeri');
		expect([h.state.options.natalMoonNak, h.state.options.natalMoonSign]).toEqual([7, 2]);
	});
});

describe('方案库载入:四个工作台与载入存案同一校验', ()=>{
	test('判据', ()=>{
		[null, undefined, [], '1990', 1990, {}].forEach((n)=>{ expect(normalizeSavedNatal(n)).toBe(null); });
		expect(normalizeSavedNatal({ yearGZ: '庚午' })).toEqual({ yearGZ: '庚午' });
		expect(restoredNatalInput(undefined)).toEqual(zeriNatalInputDefault());
		expect(restoredNatalInput([1])).toEqual(zeriNatalInputDefault());
		expect(restoredNatalInput({ date: 'x' })).toEqual({ ...zeriNatalInputDefault(), date: 'x' });
	});
	test.each(['BaziZeriWorkbench.js', 'ZiweiZeriWorkbench.js', 'SanshiZeriWorkbench.js', 'LiurengZeriWorkbench.js'])('%s', (f)=>{
		const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
		expect(src).toContain('onRestoreNatal(normalizeSavedNatal(rec.config.natal))');
		expect(src).toContain('onNatalInputChange(restoredNatalInput(rec.config.natalInput))');
		expect(src).not.toContain('rec.config.natal || null');
	});
	test.each(['BaziZeriMain.js', 'ZiweiZeriMain.js', 'SanshiZeriMain.js', 'LiurengZeriMain.js'])('%s 构造缺省出自单源、方案回灌同一校验', (f)=>{
		const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
		expect(src).toContain('natalInput: zeriNatalInputDefault(),');
		expect(src).toContain('onRestoreNatal={(n)=>this.setState({ natal: normalizeSavedNatal(n) })}');
	});
});
