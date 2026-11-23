import { landingGreetingPrefix, landingTitle, landingHint } from '../aiChat/landingGreeting';

describe('AI 分析空态问候', ()=>{
	test('问候随时辰变:每个整点都落在六档之一,边界钟点各归各档', ()=>{
		const want = { 0: '夜深了', 4: '夜深了', 5: '早上好', 8: '早上好', 9: '上午好', 11: '上午好', 12: '中午好', 13: '中午好', 14: '下午好', 17: '下午好', 18: '晚上好', 22: '晚上好', 23: '夜深了' };
		Object.keys(want).forEach((h)=>expect(landingGreetingPrefix(Number(h))).toBe(want[h]));
		const all = new Set();
		for(let h = 0; h < 24; h++){ all.add(landingGreetingPrefix(h)); }
		expect([...all].sort()).toEqual(['上午好', '下午好', '中午好', '夜深了', '早上好', '晚上好'].sort());
	});
	test('钟点给坏值不抛错:非数字按正午,越界按 24 小时折回', ()=>{
		expect(landingGreetingPrefix(undefined)).toBe('中午好');
		expect(landingGreetingPrefix('abc')).toBe('中午好');
		expect(landingGreetingPrefix(25)).toBe('夜深了');
		expect(landingGreetingPrefix(-1)).toBe('夜深了');
	});
	test('标题:没挂案例问看哪张盘,挂了案例问问些什么', ()=>{
		expect(landingTitle({ hour: 23, hasSource: false })).toBe('夜深了，想看哪张盘？');
		expect(landingTitle({ hour: 10, hasSource: true })).toBe('上午好，想问些什么？');
	});
	test('说明行:缺模型先说缺什么;有模型时挂了案例报案例名,没挂提示选案例', ()=>{
		expect(landingHint({ hasModel: false, sourceTitle: '张三' })).toBe('接好模型、选好案例，就能开始。');
		expect(landingHint({ hasModel: true, sourceTitle: ' 张三 ' })).toBe('已挂上「张三」，直接问。');
		expect(landingHint({ hasModel: true })).toBe('选好案例，直接问。');
	});
});
