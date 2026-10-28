// 神数正传条文库载入器:一次载入失败后,下一次调用必须重新载入(不许把失败的 Promise 缓存成整个会话的结果)。
// 页面侧「失败清在途标记、下次重试」的修复建立在「载入器能重试」这个前提上;只用模拟载入器测页面看不出载入器本身的缓存。
let mockTiebanFails = 1;
let mockShaoziFails = 1;
jest.mock('../data/zhengchuanTiebanVerses.json', ()=>{
	if(mockTiebanFails > 0){ mockTiebanFails -= 1; throw new Error('chunk 503'); }
	return { a: 'tieban-verse' };
});
jest.mock('../data/zhengchuanShaoziVerses.json', ()=>{
	if(mockShaoziFails > 0){ mockShaoziFails -= 1; throw new Error('chunk 503'); }
	return { a: 'shaozi-verse' };
});

describe('正传条文库载入器失败后可重试', ()=>{
	it('铁板:第一次失败、第二次成功', async ()=>{
		const { loadTiebanVerses } = require('../zhengchuanTiebanLocal');
		await expect(loadTiebanVerses()).rejects.toThrow('chunk 503');
		const v = await loadTiebanVerses();
		expect(v.a).toBe('tieban-verse');
		expect(loadTiebanVerses()).toBe(loadTiebanVerses());   // 成功后缓存同一个 Promise
	});
	it('邵子:第一次失败、第二次成功', async ()=>{
		const { loadShaoziVerses } = require('../zhengchuanShaoziLocal');
		await expect(loadShaoziVerses()).rejects.toThrow('chunk 503');
		const v = await loadShaoziVerses();
		expect(v.a).toBe('shaozi-verse');
	});
});
