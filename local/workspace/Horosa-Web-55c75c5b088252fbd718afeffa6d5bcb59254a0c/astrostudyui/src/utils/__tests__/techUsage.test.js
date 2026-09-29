// [R5 N2] 技法使用频次 + 按频次排序:计数持久化 / 稳定排序语义 / 开关关回原序 / 键数上限 / 坏数据容错
import {
	TECH_USAGE_KEY, readTechniqueUsage, recordTechniqueVisit, orderByUsage, __resetTechniqueUsageForTest,
} from '../techUsage';
import { __engineWarmOrder, registerDataWarmTask, buildRegisteredDataWarmTasks } from '../idleWarmQueue';

describe('[R5 N2] techUsage', ()=>{
	beforeEach(()=>{ __resetTechniqueUsageForTest(); localStorage.removeItem('horosa.perf.usageOrderedPreload'); });

	test('切页计数持久化,坏数据回空', ()=>{
		expect(readTechniqueUsage()).toEqual({});
		recordTechniqueVisit('liureng'); recordTechniqueVisit('liureng'); recordTechniqueVisit('bazi');
		expect(readTechniqueUsage()).toEqual({ liureng: 2, bazi: 1 });
		expect(JSON.parse(localStorage.getItem(TECH_USAGE_KEY))).toEqual({ liureng: 2, bazi: 1 });
		localStorage.setItem(TECH_USAGE_KEY, '[1,2]');
		expect(readTechniqueUsage()).toEqual({});
		localStorage.setItem(TECH_USAGE_KEY, '{"x":"abc","y":-1,"z":3.7}');
		expect(readTechniqueUsage()).toEqual({ z: 3 });
		recordTechniqueVisit(null); recordTechniqueVisit(42);
		expect(readTechniqueUsage()).toEqual({ z: 3 });
	});

	test('稳定排序:计数高在前,同计数 / 无计数保持传入序;开关关 = 原序', ()=>{
		const items = ['a', 'b', 'c', 'd', 'e'];
		expect(orderByUsage(items, (k)=>k, {})).toEqual(items);                       // 全新安装 = 旧序
		expect(orderByUsage(items, (k)=>k, { d: 5, b: 2, e: 2 })).toEqual(['d', 'b', 'e', 'a', 'c']);
		expect(orderByUsage(items, (k)=>k, { d: 5, b: 2, e: 2 })).not.toBe(items);   // 副本
		localStorage.setItem('horosa.perf.usageOrderedPreload', '0');
		expect(orderByUsage(items, (k)=>k, { d: 5 })).toEqual(items);
		localStorage.removeItem('horosa.perf.usageOrderedPreload');
		recordTechniqueVisit('c');
		expect(orderByUsage(items, (k)=>k)).toEqual(['c', 'a', 'b', 'd', 'e']);        // 缺省读存储
		expect(orderByUsage(items, ()=>{ throw new Error('x'); })).toEqual(items);     // keyOf 抛错 = 无计数
	});

	test('键数上限:超 64 个时丢计数最少的', ()=>{
		recordTechniqueVisit('k0'); recordTechniqueVisit('k0');   // 先攒够计数,溢出裁剪时丢的是计数最少的别人
		for(let i = 0; i < 70; i += 1){ recordTechniqueVisit(`k${i}`); }
		const u = readTechniqueUsage();
		expect(Object.keys(u).length).toBeLessThanOrEqual(64);
		expect(u.k0).toBe(3);
		expect(Object.values(u).filter((n)=>n === 1).length).toBeLessThanOrEqual(63);
	});

	test('引擎预热表与数据预热注册表按频次出队;无记录 = 声明序', ()=>{
		const base = __engineWarmOrder({});
		expect(base[0]).toBe('bazi');
		expect(base).toContain('liureng');
		const withUse = __engineWarmOrder({ liureng: 9, cnyibu: 3 });
		expect(withUse[0]).toBe('liureng');
		expect(withUse.slice(1, 5)).toEqual(['cnyibu', 'cnyibu', 'cnyibu', 'cnyibu']);
		expect(withUse.slice().sort()).toEqual(base.slice().sort());                    // 集合不变,只换序
		registerDataWarmTask('zz:one', ()=>Promise.resolve(1));
		registerDataWarmTask('yy:one', ()=>Promise.resolve(2));
		const names0 = buildRegisteredDataWarmTasks({}, {}).map((t)=>t.name);
		expect(names0.indexOf('zz:one')).toBeLessThan(names0.indexOf('yy:one'));
		recordTechniqueVisit('yy');
		const names1 = buildRegisteredDataWarmTasks({}, {}).map((t)=>t.name);
		expect(names1[0]).toBe('yy:one');
	});
});
