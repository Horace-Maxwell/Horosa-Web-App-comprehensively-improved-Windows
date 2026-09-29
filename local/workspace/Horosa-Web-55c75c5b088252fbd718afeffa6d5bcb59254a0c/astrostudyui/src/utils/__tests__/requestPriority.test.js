// [R5 T5] 前端优先级头金标:三种后台判定各自打头;前台不打;开关关不打;显式 priority 字段不外泄。
import { tagRequestPriority, runInBackgroundScope, isInBackgroundScope, PRIORITY_HEADER, __resetRequestPriorityForTest } from '../requestPriority';

describe('[R5 T5] requestPriority', ()=>{
	beforeEach(()=>{ __resetRequestPriorityForTest(); window.localStorage.removeItem('horosa.perf.requestPriorityLane'); });

	test('前台请求:原样返回(同一对象,零改动)', ()=>{
		const o = { method: 'POST', headers: { A: '1' } };
		expect(tagRequestPriority(o, false)).toBe(o);
		expect(tagRequestPriority(undefined, false)).toBe(undefined);
	});

	test('步进预取作用域:加头,不动原对象', ()=>{
		const o = { headers: { A: '1' } };
		const t = tagRequestPriority(o, true);
		expect(t).not.toBe(o);
		expect(t.headers).toEqual({ A: '1', [PRIORITY_HEADER]: 'prefetch' });
		expect(o.headers).toEqual({ A: '1' });
	});

	test('空闲预热作用域:同步阶段内加头,离开后不加', ()=>{
		let inside = null;
		runInBackgroundScope(()=>{ inside = tagRequestPriority({}, false); });
		expect(inside.headers[PRIORITY_HEADER]).toBe('prefetch');
		expect(isInBackgroundScope()).toBe(false);
		expect(tagRequestPriority({}, false).headers).toBeUndefined();
	});

	test('显式 priority: prefetch 加头且字段不外泄;其它值不加', ()=>{
		const t = tagRequestPriority({ priority: 'prefetch', body: 'x' }, false);
		expect(t.headers[PRIORITY_HEADER]).toBe('prefetch');
		expect(t.priority).toBeUndefined();
		expect(tagRequestPriority({ priority: 'high' }, false).headers).toBeUndefined();
	});

	test('perfFlag 关:任何情况都不加头', ()=>{
		window.localStorage.setItem('horosa.perf.requestPriorityLane', '0');
		expect(tagRequestPriority({ priority: 'prefetch' }, true).headers).toBeUndefined();
	});

	test('perfFlag 关:显式 priority:prefetch 字段同样剥掉(不外泄进 fetch init);其它对象原样', ()=>{
		window.localStorage.setItem('horosa.perf.requestPriorityLane', '0');
		const t = tagRequestPriority({ priority: 'prefetch', body: 'x' }, false);
		expect(t.priority).toBeUndefined();
		expect(t.body).toBe('x');
		const o = { body: 'y' };
		expect(tagRequestPriority(o, true)).toBe(o);
		window.localStorage.removeItem('horosa.perf.requestPriorityLane');
	});

	test('request() 入口在去重分流与任何 await 之前打头(可去重端点也吃到后台优先级)', ()=>{
		const fs = require('fs');
		const path = require('path');
		const src = fs.readFileSync(path.join(__dirname, '..', 'request.js'), 'utf8');
		const start = src.indexOf('export default async function request(url, options) {');
		const end = src.indexOf('async function requestCore(url, options) {');
		expect(start).toBeGreaterThan(-1);
		expect(end).toBeGreaterThan(start);
		const body = src.slice(start, end);
		const tagAt = body.indexOf('options = tagRequestPriority(options, isInPrefetchScope());');
		const dedupeAt = body.indexOf('if (dedupeEligible(url, options)) {');
		expect(tagAt).toBeGreaterThan(-1);
		expect(dedupeAt).toBeGreaterThan(tagAt);
		// 只看代码:剥掉行注释(注释里写着「任何 await 之前」)
		const codeBefore = body.slice(0, tagAt).replace(/(^|[ \t])\/\/.*$/gm, '$1');
		expect(/\bawait\b/.test(codeBefore)).toBe(false);
	});
});
