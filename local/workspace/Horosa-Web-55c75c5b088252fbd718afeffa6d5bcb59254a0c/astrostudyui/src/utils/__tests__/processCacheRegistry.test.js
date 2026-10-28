// 进程内结果缓存登记处:捕获点之上的结果缓存都要登记清空函数,设置差分闸才能每次取样都真算一遍
// (没登记 = 缺省两遍请求数对不上 → 差分闸仪器自检判红;本文件锁住登记处本身与差分闸的接线)。
import fs from 'fs';
import path from 'path';
import { registerProcessCache, clearRegisteredProcessCaches, registeredProcessCacheNames } from '../processCacheRegistry';
import '../aiAnalysisContext';
import { REGENERATED_SNAPSHOT_CACHE } from '../aiAnalysisContext/snapshotMatch';

describe('进程内结果缓存登记处', ()=>{
	it('挂载链会经过的结果缓存全部登记在册', ()=>{
		const names = registeredProcessCacheNames();
		const expected = [
			'aiAnalysis.regeneratedSnapshot',   // 挂载重算结果(同记录同口径整份正文复用)
			'services.requestCache', 'services.astro.chart', 'requestDedupe', 'kentang',
			'india.chart', 'preciseCalc.nongliJieqi', 'localCalc.memory', 'huangji.classicFull', 'divinationTimeDraft.remoteNongli',
		];
		expected.forEach((n)=>expect(names).toContain(n));
	});
	it('一次清空全部登记缓存;单个清空函数抛错不影响其余', ()=>{
		REGENERATED_SNAPSHOT_CACHE.set('k', { text: 'x', at: Date.now() });
		const hit = jest.fn();
		registerProcessCache('test.throws', ()=>{ throw new Error('boom'); });
		registerProcessCache('test.ok', hit);
		clearRegisteredProcessCaches();
		expect(REGENERATED_SNAPSHOT_CACHE.size).toBe(0);
		expect(hit).toHaveBeenCalledTimes(1);
		registerProcessCache('', ()=>{});
		registerProcessCache('test.notfn', 'x');
		expect(registeredProcessCacheNames()).not.toContain('');
		expect(registeredProcessCacheNames()).not.toContain('test.notfn');
	});
	it('设置差分闸:每次取样前经登记处清空;缺省两遍端点多重集不一致即判红(不许静默当噪声)', ()=>{
		const src = fs.readFileSync(path.join(__dirname, 'mountSettingsDiffAll.test.js'), 'utf8');
		expect(src).toMatch(/function resetRequestCaches\(\)\{\s*clearRegisteredProcessCaches\(\);\s*\}/);
		expect((src.match(/resetRequestCaches\(\)/g) || []).length).toBeGreaterThanOrEqual(3);   // 定义 + runCtx + runBase 事盘兜底
		expect((src.match(/baselineLeak\(b1, b2\)/g) || []).length).toBeGreaterThanOrEqual(2);   // 盘变体基线 + 扫描点基线
		expect(src).not.toMatch(/if\(baselineLeak\(b1, b2\)\)\{\s*b1 = /);   // 不许「不一致就重取」:重取时两遍都命中缓存会洗成假一致
		expect(src).toMatch(/expect\(\[\.\.\.bad\.map\([^\n]*\.\.\.leaks\]\)\.toEqual\(\[\]\)/);
	});
});
