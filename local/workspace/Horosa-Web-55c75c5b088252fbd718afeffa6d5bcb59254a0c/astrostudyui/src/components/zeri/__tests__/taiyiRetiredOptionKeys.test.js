// 太乙已剔除的死键(十精 / 转盘:后端不读、无人消费)不得再随方案 / 历史 / 存案流转:
// 载入方案或历史、点结果行回写、载入存案,三路都把它们去掉;页面口径登记表里不再有它们(登记表的键必须是太乙页真实的设置键)。
jest.mock('../../../services/astro', ()=>({ fetchChart: jest.fn(async ()=>({ Result: null })) }));
jest.mock('../../../utils/request', ()=>jest.fn(()=>new Promise(()=>{})));
global.React = require('react');
const calibre = require('../../../divination/zeri/zeriPageCalibre');
const { TAIYI_PAGE_SCAN_KEYS, TAIYI_RETIRED_OPTION_KEYS, withoutKeys } = calibre;

const flush = async ()=>{ for(let i = 0; i < 5; i += 1){ await Promise.resolve(); } };

test('登记表:太乙页面口径键都是太乙页真实的设置键;已剔除的死键不在其中', ()=>{
	const { TAIYI_PAGE_SETTINGS } = require('../../taiyi/TaiYiMain');
	const real = Object.keys(TAIYI_PAGE_SETTINGS.defaults());
	TAIYI_PAGE_SCAN_KEYS.forEach((k)=>{ expect([k, real.indexOf(k) >= 0]).toEqual([k, true]); });
	TAIYI_RETIRED_OPTION_KEYS.forEach((k)=>{
		expect(TAIYI_PAGE_SCAN_KEYS).not.toContain(k);
		expect(real).not.toContain(k);
	});
});

test('withoutKeys:去掉给定键、不动原对象;非对象原样返回', ()=>{
	const o = { a: 1, tenching: 2 };
	expect(withoutKeys(o, ['tenching'])).toEqual({ a: 1 });
	expect(o).toEqual({ a: 1, tenching: 2 });
	expect(withoutKeys(null, ['x'])).toBeNull();
});

test('载入旧方案 / 历史:死键既不进工作台参数,也不写进内嵌太乙页', async ()=>{
	const Host = require('../TaiyiZeriMain').default;
	const applied = [];
	const h = { state: { options: { tn: 0 } }, unmounted: false, props: {},
		taiyiHook: { applyOptions: (p)=>{ applied.push(p); return Promise.resolve(); }, fun: jest.fn() } };
	h.setState = function(p, cb){ this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; if(cb){ cb(); } };
	Object.getOwnPropertyNames(Host.prototype).forEach((n)=>{ if(n !== 'constructor' && typeof Host.prototype[n] === 'function'){ h[n] = Host.prototype[n].bind(h); } });
	h.replotEmbedded = jest.fn();
	h.onWorkbenchOptionsChange({ tn: 2, school: { zhuSuan: 'b' }, tenching: 1, rotation: 'ccw' }, { source: 'scheme' });
	await flush();
	expect(h.state.options).toEqual({ tn: 2 });
	expect(applied).toEqual([{ school: { zhuSuan: 'b' } }]);
});

describe('内嵌太乙页', ()=>{
	const TaiYiMain = require('../../taiyi/TaiYiMain').default;
	function mkPage(){
		const hook = {};
		const page = new TaiYiMain({ hook, techniqueScope: 'taiyizeri', fields: null });
		page.setState = function(p, cb){ this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; if(cb){ cb(); } };
		return { page, hook };
	}
	test('点结果行的回写(applyOptions)不收死键', async ()=>{
		const { page, hook } = mkPage();
		page.state = { ...page.state, options: { ...page.state.options, tenching: 9 } };
		await hook.applyOptions({ tn: 1, tenching: 1, rotation: 'ccw' });
		expect(page.state.options.tn).toBe(1);
		TAIYI_RETIRED_OPTION_KEYS.forEach((k)=>{ expect(page.state.options).not.toHaveProperty(k); });
	});
	test('载入存案:存案 options 里的死键去掉(本页 options 里残留的也一并去掉)', ()=>{
		jest.resetModules();
		jest.doMock('../../../utils/kentangCaseSave', ()=>({
			...jest.requireActual('../../../utils/kentangCaseSave'),
			getKentangSavedCasePayload: ()=>({ caseVersion: 'v1', payload: { options: { tn: 2, tenching: 1, rotation: 'ccw' }, pan: null, nongli: null } }),
			getKentangSavedCaseFieldsPatch: ()=>({}),
		}));
		const Fresh = require('../../taiyi/TaiYiMain').default;
		const page = new Fresh({ hook: {}, techniqueScope: 'taiyizeri', fields: null });
		page.setState = function(p, cb){ this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; if(cb){ cb(); } };
		page.state = { ...page.state, options: { ...page.state.options, rotation: 'cw' } };
		expect(page.restoreFromCurrentCase(true)).toBe(true);
		expect(page.state.options.tn).toBe(2);
		TAIYI_RETIRED_OPTION_KEYS.forEach((k)=>{ expect(page.state.options).not.toHaveProperty(k); });
		jest.dontMock('../../../utils/kentangCaseSave');
	});
});
