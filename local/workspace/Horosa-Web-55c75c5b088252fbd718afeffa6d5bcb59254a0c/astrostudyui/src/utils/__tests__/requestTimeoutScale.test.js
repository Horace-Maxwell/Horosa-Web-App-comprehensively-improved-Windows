// 单次请求等待时间的放大倍数:只有无头批量在慢机器上才设;浏览器 / 桌面里没人设 = 1(行为不变)。
import fs from 'fs';
import path from 'path';
import { requestTimeoutScale } from '../request';

describe('请求时限放大倍数', ()=>{
	afterEach(()=>{ delete globalThis.__HOROSA_REQUEST_TIMEOUT_SCALE__; });
	it('🔴 没人设时是 1(浏览器 / 桌面的请求时限一丝不变)', ()=>{
		expect(requestTimeoutScale()).toBe(1);
	});
	it('设了就用;出界 / 不是数 = 1', ()=>{
		globalThis.__HOROSA_REQUEST_TIMEOUT_SCALE__ = 5; expect(requestTimeoutScale()).toBe(5);
		globalThis.__HOROSA_REQUEST_TIMEOUT_SCALE__ = 2.5; expect(requestTimeoutScale()).toBe(2.5);
		[0, 0.5, -3, 101, NaN, 'abc', null, {}].forEach((bad)=>{ globalThis.__HOROSA_REQUEST_TIMEOUT_SCALE__ = bad; expect(requestTimeoutScale()).toBe(1); });
		globalThis.__HOROSA_REQUEST_TIMEOUT_SCALE__ = '3'; expect(requestTimeoutScale()).toBe(3);
	});
	it('🔴 时限归一的唯一入口乘上它;批量按「每技法时限 ÷ 缺省 120 秒」设它', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '../request.js'), 'utf8');
		expect(src).toMatch(/return Math\.max\(500, Math\.floor\(n \* requestTimeoutScale\(\)\)\);/);
		expect((src.match(/function normalizeTimeoutMs\(/g) || []).length).toBe(1);
		const batch = fs.readFileSync(path.join(__dirname, '../../../headless/batch.js'), 'utf8');
		expect(batch).toMatch(/globalThis\.__HOROSA_REQUEST_TIMEOUT_SCALE__ = Math\.max\(1, init\.timeoutMs \/ DEFAULT_TIMEOUT_MS\);/);
	});
});
