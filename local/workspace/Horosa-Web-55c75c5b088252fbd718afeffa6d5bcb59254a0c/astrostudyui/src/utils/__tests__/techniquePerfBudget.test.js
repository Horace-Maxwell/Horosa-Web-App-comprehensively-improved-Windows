// 技法交互性能预算哨兵(WS-3f:只测 utils 层,不 import 页面组件)。
// 语义:瞬时化主干的三级缓存/签名机制本身必须是「近零成本」——命中路径若劣化到
// 可感知(如深拷贝换成慢实现/签名算法回归),此处先红,不用等用户抱怨「切设置变卡」。
// 预算数值给足余量(CI 慢机不误报),抓的是数量级回归而非微抖动。
import { dedupedRequest, __clearDedupe } from '../requestDedupe';
import { createSignatureMemo, stableSignature } from '../memoBySignature';

beforeEach(() => {
	__clearDedupe();
});

const URL = 'http://127.0.0.1:9999/chart';

function bigPayload(){
	const objects = [];
	for(let i = 0; i < 200; i += 1){
		objects.push({ id: `obj${i}`, lon: i * 1.7, lat: i * 0.3, speed: i % 7, sign: i % 12, house: i % 12 });
	}
	return { Result: { chart: { objects, houses: objects.slice(0, 12) } } };
}

describe('techniquePerfBudget', () => {
	it('L1 命中(含深拷贝隔离)100 次 ≤ 250ms(单次 ≈ ≤2.5ms)', async () => {
		const payload = bigPayload();
		await dedupedRequest(URL, { body: '{"q":1}' }, () => Promise.resolve(payload));
		const t0 = Date.now();
		for(let i = 0; i < 100; i += 1){
			// eslint-disable-next-line no-await-in-loop
			await dedupedRequest(URL, { body: '{"q":1}' }, () => Promise.reject(new Error('必须不发网络')));
		}
		const elapsed = Date.now() - t0;
		expect(elapsed).toBeLessThanOrEqual(250);
	});

	it('L2 命中回填路径 50 次 ≤ 250ms', async () => {
		const { __ageEntries } = require('../requestDedupe');
		const payload = bigPayload();
		const t0 = Date.now();
		for(let i = 0; i < 50; i += 1){
			// eslint-disable-next-line no-await-in-loop
			await dedupedRequest(URL, { body: `{"q":${i}}` }, () => Promise.resolve(payload));
			__ageEntries(60 * 1000);   // L1 过期 → 下一轮同键将走 L2
		}
		const t1 = Date.now();
		// 只回读「累计老化仍 <10min 窗」的近期键(i=49 老化 1×60s … i=41 老化 9×60s)
		for(let i = 49; i >= 41; i -= 1){
			// eslint-disable-next-line no-await-in-loop
			await dedupedRequest(URL, { body: `{"q":${i}}` }, () => Promise.reject(new Error('必须走 L2')));
		}
		expect(Date.now() - t1).toBeLessThanOrEqual(250);
		expect(t1 - t0).toBeLessThanOrEqual(2000);
	});

	it('memoBySignature 命中 1000 次 ≤ 50ms;stableSignature 大对象 200 次 ≤ 200ms', () => {
		const memo = createSignatureMemo(8);
		const value = bigPayload();
		memo.set('k', value);
		let t0 = Date.now();
		for(let i = 0; i < 1000; i += 1){
			if(memo.get('k') !== value){ throw new Error('memo 命中必须返回同引用'); }
		}
		expect(Date.now() - t0).toBeLessThanOrEqual(50);
		const fields = { date: '1990/06/22', time: '12:30', zone: '+08:00', flags: { a: 1, b: 2, c: [1, 2, 3] } };
		t0 = Date.now();
		for(let i = 0; i < 200; i += 1){
			stableSignature(fields, 'school', i % 4);
		}
		expect(Date.now() - t0).toBeLessThanOrEqual(200);
	});
});
