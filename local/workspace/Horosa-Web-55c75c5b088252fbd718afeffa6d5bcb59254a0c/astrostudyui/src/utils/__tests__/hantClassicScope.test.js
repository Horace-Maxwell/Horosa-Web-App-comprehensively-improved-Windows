// 古籍转换档:玄学史古籍原文 / 引文区域(容器带 horosa-script-classic)繁体下「范 / 里」缺省保留原字,
// 只在整词表里取 範 / 裡;界面文案(容器外)逐字不变。
// 曾:通用词典按现代用法缺省 範 / 裡 —— 古籍里姓氏范(范曄 / 范明友)、地名范陽、里坊(昭國里 / 太平里 / 鄰里)都被转错。
import { toHant, toHantClassic } from '../scriptConvert/hantConverter';
import * as conv from '../scriptConvert/hantConverter';
import { applyScriptMode, SCRIPT_HANT, SCRIPT_HANS, __resetScriptModeForTest, __setConverterForTest } from '../scriptMode';

describe('古籍转换档 · 转换器', ()=>{
	test.each([
		['范晔', '范曄'], ['问范曰', '問范曰'], ['范明友', '范明友'], ['范阳', '范陽'], ['吴范', '吳范'],
		['范文正公', '范文正公'], ['能大师范阳人', '能大師范陽人'], ['昭国里', '昭國里'], ['太平里', '太平里'], ['邻里', '鄰里'], ['里中火起', '里中火起'], ['步里客谈', '步里客談'],
	])('%s → %s(姓氏 / 地名 / 里坊保留原字)', (src, want)=>{
		expect(toHantClassic(src)).toBe(want);
	});
	test.each([
		['洪范九畴', '洪範九疇'], ['垂范后世', '垂範後世'], ['范围', '範圍'], ['心里', '心裡'], ['这里', '這裡'], ['宫里', '宮裡'],
	])('整词表:%s → %s', (src, want)=>{
		expect(toHantClassic(src)).toBe(want);
	});
	test('通用档(界面文案)不受影响:时间范围 → 時間範圍;心里 → 心裡', ()=>{
		expect(toHant('时间范围')).toBe('時間範圍');
		expect(toHant('心里')).toBe('心裡');
	});
	test('负孪生:通用档仍按现代用法把古籍里的范 / 里转成 範 / 裡(本档存在的理由)', ()=>{
		expect(toHant('范明友')).toBe('範明友');
		expect(toHant('昭国里')).toBe('昭國裡');
		expect(toHant('步里客谈')).toBe('步裡客談');
	});
});

describe('古籍转换档 · 显示层只作用于古籍容器', ()=>{
	beforeEach(()=>{ __resetScriptModeForTest(); __setConverterForTest(toHant, undefined, conv); document.body.innerHTML = ''; });
	afterAll(()=>{ __resetScriptModeForTest(); });
	test('容器内问范曰 → 問范曰;容器外同字串 → 問範曰(界面通用档不变);切回简体逐字复原', async ()=>{
		document.body.innerHTML = '<div id="ui">问范曰</div><div class="horosa-script-classic"><span id="cl">问范曰，居昭国里</span></div>';
		await applyScriptMode(SCRIPT_HANT);
		expect(document.getElementById('cl').textContent).toBe('問范曰，居昭國里');
		expect(document.getElementById('ui').textContent).toBe('問範曰');
		await applyScriptMode(SCRIPT_HANS);
		expect(document.getElementById('cl').textContent).toBe('问范曰，居昭国里');
	});
});
