// 存储配额防线回归(FL 级事故金标):
// ① safeLocalStorageSet 遇 QuotaExceededError → 清可再生缓存重试,绝不上抛;
// ② clearRecoverableCaches 只清缓存前缀键,用户数据键(localCases 等)一根毫毛不动;
// ③ localCalcCache 写入走 IndexedDB 后端,localStorage 里绝不再出现 horosa.localcalc.* 新写;
//    迁移器把既有 localcalc 键(含 v1 尸键)从 localStorage 清除。
import {
	safeLocalStorageSet,
	clearRecoverableCaches,
	isQuotaError,
} from '../safeStorage';

function quotaError(){
	const e = new Error('The quota has been exceeded.');
	e.name = 'QuotaExceededError';
	return e;
}

describe('存储配额防线(quota 注错)', () => {
	afterEach(() => {
		window.localStorage.clear();
		jest.restoreAllMocks();
	});

	test('isQuotaError 识别 QuotaExceededError/code22/quota 消息', () => {
		expect(isQuotaError(quotaError())).toBe(true);
		expect(isQuotaError({ code: 22 })).toBe(true);
		expect(isQuotaError({ message: 'Storage quota reached' })).toBe(true);
		expect(isQuotaError(new Error('boom'))).toBe(false);
	});

	test('🔴 setItem 抛 quota → 清可再生缓存重试成功,绝不上抛', () => {
		window.localStorage.setItem('horosa.localcalc.nongli.v1', 'x'.repeat(100));
		const original = Storage.prototype.setItem;
		let calls = 0;
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v){
			calls++;
			if(calls === 1){ throw quotaError(); }
			return original.call(this, k, v);
		});
		let ok;
		expect(() => { ok = safeLocalStorageSet('someKey', 'value'); }).not.toThrow();
		expect(ok).toBe(true);
		expect(window.localStorage.getItem('someKey')).toBe('value');
		// 重试前清了可再生缓存
		expect(window.localStorage.getItem('horosa.localcalc.nongli.v1')).toBe(null);
	});

	test('🔴 clearRecoverableCaches 清缓存前缀、保用户数据', () => {
		window.localStorage.setItem('horosa.localcalc.nongli.v1', 'cache');
		window.localStorage.setItem('horosa.localcalc.jieqiYear.v1', 'corpse');
		window.localStorage.setItem('horosa.reader.chapter.book1', 'chapter');
		window.localStorage.setItem('horosa.localCases.v1', 'USER-DATA');
		window.localStorage.setItem('horosa.localCharts.v1', 'USER-DATA');
		window.localStorage.setItem('globalSetup', 'USER-SETTING');
		const cleared = clearRecoverableCaches();
		expect(cleared).toBeGreaterThanOrEqual(3);
		expect(window.localStorage.getItem('horosa.localcalc.nongli.v1')).toBe(null);
		expect(window.localStorage.getItem('horosa.localcalc.jieqiYear.v1')).toBe(null);
		expect(window.localStorage.getItem('horosa.reader.chapter.book1')).toBe(null);
		expect(window.localStorage.getItem('horosa.localCases.v1')).toBe('USER-DATA');
		expect(window.localStorage.getItem('horosa.localCharts.v1')).toBe('USER-DATA');
		expect(window.localStorage.getItem('globalSetup')).toBe('USER-SETTING');
	});
});

describe('localCalcCache 存储分层(不再写 localStorage)', () => {
	afterEach(() => {
		window.localStorage.clear();
		jest.resetModules();
	});

	test('🔴 写入不落 localStorage;迁移器清除既有 localcalc 键(含 v1 尸键)', async () => {
		window.localStorage.setItem('horosa.localcalc.nongli.v1', JSON.stringify({ legacy: { ts: 1, data: { d: 1 } } }));
		window.localStorage.setItem('horosa.localcalc.jieqiYear.v1', '{}');
		jest.resetModules();
		const cache = require('../localCalcCache');
		cache.setNongliLocalCache({ date: '2026/07/12', time: '12:00', zone: '+08:00' }, { ok: 1 });
		// 读路径(内存镜像)立即可用
		expect(cache.getNongliLocalCache({ date: '2026/07/12', time: '12:00', zone: '+08:00' })).toEqual({ ok: 1 });
		// 等异步预载+迁移器跑完(jsdom 无 IndexedDB → idb 层降级 no-op,但迁移清除照跑)
		await new Promise((r) => setTimeout(r, 50));
		expect(window.localStorage.getItem('horosa.localcalc.nongli.v1')).toBe(null);
		expect(window.localStorage.getItem('horosa.localcalc.jieqiYear.v1')).toBe(null);
		// 全程无 horosa.localcalc.* 新写入
		for(let i = 0; i < window.localStorage.length; i++){
			expect(window.localStorage.key(i)).not.toMatch(/^horosa\.localcalc\./);
		}
	});
});
