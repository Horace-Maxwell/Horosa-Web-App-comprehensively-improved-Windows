// 七政择日内嵌页起盘参数 = astropy/tests/fixtures/qizheng_zeri_page_params.json(pytest 用同一份参数起页面盘与扫描逐项对拍,
// 见 test_qizheng_zeri_page_parity.py)。宿主底板经七政页同一构参(fieldsToParams);工作台三参数各变体的出参同锁。
jest.mock('../../../services/astro', () => ({ fetchChart: jest.fn(async () => ({ Result: null })) }));
global.React = require('react');
const fs = require('fs');
const path = require('path');
const QizhengZeriMain = require('../QizhengZeriMain').default;
const { fieldsToParams } = require('../../guolao/main/params');

const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', '..', 'astropy', 'tests', 'fixtures', 'qizheng_zeri_page_params.json'), 'utf8'));
const strip = (p)=>{ const { _su28Rev, ...rest } = p; return rest; };   // 缓存代次键不比

function paramsOf(options){
	const h = new QizhengZeriMain({});
	h.state.pickText = '2026-03-01 10:00:00';
	if(options){ h.state.options = { ...h.state.options, ...options }; }
	return strip(fieldsToParams(h.buildFields(false)));
}

beforeEach(()=>{ window.localStorage.clear(); });

describe('七政择日内嵌页起盘参数(与 pytest 对拍同一份)', ()=>{
	test('缺省工作台:逐键等于共享参数', ()=>{
		expect(paramsOf()).toEqual(FIX.params);
	});
	test.each([['su28Mode3', { su28Mode: 3 }], ['nodeTrue', { nodeType: 'true' }], ['lilithTrue', { lilithType: 'true' }]])('工作台变体 %s:出参 = 共享参数 + 变体键', (name, opts)=>{
		expect(paramsOf(opts)).toEqual({ ...FIX.params, ...FIX.variants[name] });
	});
});
