// 演禽先秦法快照:deriveLocalNongliAsync 是 async 函数,调用只会返回 Promise、错误走 reject 由 .catch 接住,
// 外层同步 try 走不到,已去。
import fs from 'fs';
import path from 'path';
import { deriveLocalNongliAsync } from '../../../utils/divinationTimeDraft';

const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'KinAstroMain.js'), 'utf8')
	.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('演禽 先秦法 月份补算', () => {
	test('坏输入也只得到 Promise(不同步抛)', async () => {
		let p = null;
		expect(() => { p = deriveLocalNongliAsync({ date: { value: { format: () => { throw new Error('x'); } } } }); }).not.toThrow();
		expect(p).toBeInstanceOf(Promise);
		await p.catch(() => null);
	});
	test('源码:.then/.catch 链外不再包 try', () => {
		expect(SRC).toMatch(/\t\tderiveLocalNongliAsync\(fields\)\.then\(\(nl\)=>\{/);
		expect(SRC).not.toMatch(/try\s*\{\s*deriveLocalNongliAsync\(fields\)\.then/);
	});
});
