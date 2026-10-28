// 存储空间告急自愈 ≡ 存储键注册表(单一真值源)的合同:
//   ① 注册表里每个 localStorage 上的 cache 条目都在自愈清理面里(标了 quotaClearable:false 的除外,且必须是 cache);
//   ② 用户数据永远不在清理面里;告急档只许 cache / 设置类;
//   ③ 前缀登记的 cache 族必须声明上限(maxEntries),卦辞缓存写入有界;
//   ④ 设置写入撞配额:第一档清完仍写不进时清告急档(AI 快照可再生)再写,不再直接返回失败;
//   ⑤ 注册表新增字段的取值合法(storage / format / quotaClearable / maxEntries)。
// 此前清理面是 safeStorage 里手抄的前缀表:注册表登记的卦辞缓存从没进过,常用六爻几百次起卦就把存储写满,清理一把也腾不出来。
import fs from 'fs';
import path from 'path';
import { STORAGE_KEY_REGISTRY, classifyStorageKey } from '../storageKeyRegistry';
import {
	safeLocalStorageSet, clearRecoverableCaches, purgeQuotaEmergency, quotaClearTier, QUOTA_TIER_RECOVERABLE, QUOTA_TIER_EMERGENCY,
} from '../safeStorage';
import { writeGuaDescCache, readGuaDescCache, pruneGuaDescCache, GUA_DESC_CACHE_MAX_ENTRIES, __resetGuaDescCacheForTest } from '../guaDescCache';
import { PAGE_SETTINGS_REGISTRY } from '../pageSettingsRegistry';

function quotaError(){
	const e = new Error('The quota has been exceeded.');
	e.name = 'QuotaExceededError';
	return e;
}
// 一个按字符数算配额的假存储(jsdom 的配额太大、填满太慢)
function withQuota(limitChars, fn){
	const original = Storage.prototype.setItem;
	jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v){
		if(this !== window.localStorage){ return original.call(this, k, v); }
		let used = 0;
		for(let i = 0; i < this.length; i++){
			const kk = this.key(i);
			if(kk !== k){ used += kk.length + `${this.getItem(kk)}`.length; }
		}
		if(used + k.length + `${v}`.length > limitChars){ throw quotaError(); }
		return original.call(this, k, v);
	});
	try{ return fn(); }finally{ jest.restoreAllMocks(); }
}
const sampleKeyOf = (e)=>(e.key ? e.key : `${e.prefix}sample`);
const lsKeys = ()=>{ const out = []; for(let i = 0; i < window.localStorage.length; i++){ out.push(window.localStorage.key(i)); } return out; };

beforeEach(()=>{
	window.localStorage.clear();
	__resetGuaDescCacheForTest();
});
afterEach(()=>jest.restoreAllMocks());

describe('注册表 → 自愈清理面', ()=>{
	it('🔴 每个 localStorage 上的 cache 条目都被自愈覆盖(漏一个即红);不许清的必须显式标 quotaClearable:false', ()=>{
		const uncovered = [];
		STORAGE_KEY_REGISTRY.forEach((e)=>{
			if(e.kind !== 'cache' || e.storage === 'session' || e.storage === 'event'){ return; }
			if(e.quotaClearable === false){ return; }
			if(quotaClearTier(classifyStorageKey(sampleKeyOf(e))) === null){ uncovered.push(sampleKeyOf(e)); }
		});
		expect(uncovered).toEqual([]);
		// 行为:每个可清的 cache 条目塞一把键,两档全清之后一把不剩
		STORAGE_KEY_REGISTRY.forEach((e)=>{
			if(e.kind === 'cache' && !e.storage){ window.localStorage.setItem(sampleKeyOf(e), 'x'); }
		});
		purgeQuotaEmergency();
		const left = lsKeys().filter((k)=>quotaClearTier(classifyStorageKey(k)) !== null);
		expect(left).toEqual([]);
		// 标了不许清的还在(多窗口租约 / 待落盘标记)
		STORAGE_KEY_REGISTRY.filter((e)=>e.quotaClearable === false).forEach((e)=>{
			expect(window.localStorage.getItem(sampleKeyOf(e))).toBe('x');
		});
	});

	it('🔴 用户数据永远不在清理面里;告急档只许 cache / 设置类;quotaClearable:false 只用在 cache 上', ()=>{
		STORAGE_KEY_REGISTRY.forEach((e)=>{
			const tier = quotaClearTier(e);
			if(e.kind === 'user-data'){ expect([e.key || e.prefix, tier]).toEqual([e.key || e.prefix, null]); }
			if(tier === QUOTA_TIER_EMERGENCY){ expect(['cache', 'settings']).toContain(e.kind); }
			if(e.kind !== 'cache'){ expect(tier === QUOTA_TIER_RECOVERABLE).toBe(false); }
			if(e.quotaClearable === false){ expect(e.kind).toBe('cache'); }
		});
	});

	it('第一档(错误边界「一键清理缓存」)不动告急档;告急清理两档都清;用户数据 / 普通设置一根不动', ()=>{
		const put = { 'horosa.guadesc.cache.v2.111111': 'g', 'horosa.ai.snapshot.astro.v1': 's', baziInverse: '{}', commtoolstab: 'k', 'horosa.localCharts.v1': '[]', globalSetup: '{}', ziweiSessionTables: '{}', ziweiPreset: 'p' };
		Object.keys(put).forEach((k)=>window.localStorage.setItem(k, put[k]));
		clearRecoverableCaches();
		expect(window.localStorage.getItem('horosa.guadesc.cache.v2.111111')).toBe(null);
		expect(window.localStorage.getItem('ziweiSessionTables')).toBe(null);   // 精确键(cache)优先于紫微前缀(设置)
		expect(window.localStorage.getItem('ziweiPreset')).toBe('p');
		expect(window.localStorage.getItem('horosa.ai.snapshot.astro.v1')).toBe('s');
		expect(window.localStorage.getItem('baziInverse')).toBe('{}');
		purgeQuotaEmergency();
		expect(window.localStorage.getItem('horosa.ai.snapshot.astro.v1')).toBe(null);
		expect(window.localStorage.getItem('baziInverse')).toBe(null);
		expect(window.localStorage.getItem('commtoolstab')).toBe(null);
		expect(window.localStorage.getItem('horosa.localCharts.v1')).toBe('[]');
		expect(window.localStorage.getItem('globalSetup')).toBe('{}');
		expect(window.localStorage.getItem('ziweiPreset')).toBe('p');
	});

	it('🔴 卦辞缓存塞满存储:设置写入先清它腾出空间,写得进', ()=>{
		for(let i = 0; i < 40; i++){ window.localStorage.setItem(`horosa.guadesc.cache.${i}|${i}|${i}`, 'y'.repeat(400)); }
		const ok = withQuota(17000, ()=>safeLocalStorageSet('horosa.ui.script', 'z'.repeat(1000)));
		expect(ok).toBe(true);
		expect(lsKeys().filter((k)=>k.indexOf('horosa.guadesc.cache.') === 0)).toEqual([]);
	});

	it('🔴 AI 快照占满存储:设置写入第一档清完仍写不进 → 清告急档再写,写得进', ()=>{
		window.localStorage.setItem('horosa.ai.snapshot.astro.v1', 's'.repeat(9000));
		window.localStorage.setItem('horosa.ai.snapshot.module.v1.bazi', 's'.repeat(6000));
		const ok = withQuota(16000, ()=>safeLocalStorageSet('horosa.liuyao.settings.v1', 'v'.repeat(3000)));
		expect(ok).toBe(true);
		expect(window.localStorage.getItem('horosa.liuyao.settings.v1')).toBe('v'.repeat(3000));
	});

	it('第一档够用时不动告急档(AI 快照正挂着,能不清就不清)', ()=>{
		window.localStorage.setItem('horosa.ai.snapshot.astro.v1', 's'.repeat(3000));
		window.localStorage.setItem('CalculatorFormula', 'c'.repeat(5000));
		const ok = withQuota(9000, ()=>safeLocalStorageSet('horosa.liuyao.settings.v1', 'v'.repeat(3000)));
		expect(ok).toBe(true);
		expect(window.localStorage.getItem('horosa.ai.snapshot.astro.v1')).toBe('s'.repeat(3000));
		expect(window.localStorage.getItem('CalculatorFormula')).toBe(null);
	});
});

describe('前缀 cache 族有界', ()=>{
	it('🔴 每个前缀登记的 cache 族都声明了上限(maxEntries 为非负整数)', ()=>{
		const missing = STORAGE_KEY_REGISTRY.filter((e)=>e.prefix && e.kind === 'cache' && !(Number.isInteger(e.maxEntries) && e.maxEntries >= 0)).map((e)=>e.prefix);
		expect(missing).toEqual([]);
	});

	it('🔴 卦辞缓存:起几百卦(各种本卦 / 变卦 / 互卦组合)键数不超过注册表上限;三卦拼读照常', ()=>{
		const cap = classifyStorageKey('horosa.guadesc.cache.v2.000000').maxEntries;
		expect(cap).toBe(GUA_DESC_CACHE_MAX_ENTRIES);
		// 旧版按三卦组合存的键:写入时清掉
		window.localStorage.setItem('horosa.guadesc.cache.111111|000000|101010', '{"guaOrg":1}');
		const id = (n)=>n.toString(2).padStart(6, '0');
		for(let i = 0; i < 300; i++){
			const ids = { guaOrg: id(i % 64), guaRes: id((i * 7) % 64), guaMiddle: id((i * 13) % 64) };
			writeGuaDescCache(ids, { guaOrg: { name: ids.guaOrg }, guaRes: { name: ids.guaRes }, guaMiddle: { name: ids.guaMiddle } });
		}
		const keys = lsKeys().filter((k)=>k.indexOf('horosa.guadesc.cache.') === 0);
		expect(keys.length).toBeLessThanOrEqual(cap);
		expect(keys.some((k)=>k.indexOf('|') >= 0)).toBe(false);
		expect(readGuaDescCache({ guaOrg: id(5), guaRes: id(35), guaMiddle: id(1) })).toEqual({ guaOrg: { name: id(5) }, guaRes: { name: id(35) }, guaMiddle: { name: id(1) } });
		expect(readGuaDescCache({ guaOrg: id(5), guaRes: 'bad', guaMiddle: id(1) })).toBe(null);
		window.localStorage.setItem('horosa.guadesc.cache.junk', 'x');
		expect(pruneGuaDescCache()).toBe(1);
	});

	it('AI 快照族上限覆盖代码里固定的技法名(新增技法到了上限要回来调)', ()=>{
		const SRC = path.join(__dirname, '..', '..');
		const names = new Set();
		const walk = (dir)=>fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
			const f = path.join(dir, e.name);
			if(e.isDirectory()){ if(['__tests__', 'node_modules', 'test'].indexOf(e.name) < 0){ walk(f); } return; }
			if(!/\.js$/.test(e.name)){ return; }
			const t = fs.readFileSync(f, 'utf8');
			const re = /saveModuleAISnapshot(?:Lazy)?\(\s*['"]([A-Za-z0-9_]+)['"]/g;
			let m = null;
			while((m = re.exec(t)) !== null){ names.add(m[1]); }
		});
		walk(SRC);
		expect(names.size).toBeGreaterThan(20);   // 抽取面塌缩守卫
		expect(names.size + 1).toBeLessThanOrEqual(classifyStorageKey('horosa.ai.snapshot.module.v1.x').maxEntries);
	});

	it('六爻页不再按三卦组合拼缓存键(只经 utils/guaDescCache)', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '../../components/guazhan/GuaZhanMain.js'), 'utf8');
		expect(src).not.toMatch(/['"]horosa\.guadesc\.cache\.['"]\s*\+/);
		expect(src).toContain('writeGuaDescCache(');
		expect(src).toContain('readGuaDescCache(');
	});
});

describe('注册表字段取值合法', ()=>{
	it('storage / format / quotaClearable / maxEntries 只取约定值', ()=>{
		STORAGE_KEY_REGISTRY.forEach((e)=>{
			if(e.storage !== undefined){ expect(['session', 'event']).toContain(e.storage); }
			if(e.format !== undefined){ expect(['json', 'text']).toContain(e.format); }
			if(e.quotaClearable !== undefined){ expect([false, 'emergency']).toContain(e.quotaClearable); }
			if(e.maxEntries !== undefined){ expect(!!e.prefix && e.kind === 'cache').toBe(true); }
			if(e.storage === 'session'){ expect(e.backup).toBe(false); }
		});
	});

	it('🔴 页面排盘设置的落盘键(JSON)都标了 format:json(全量恢复写前据此校验形状)', ()=>{
		const missing = PAGE_SETTINGS_REGISTRY.map((p)=>p.storageKey).filter((k)=>{ const e = classifyStorageKey(k); return !(e && e.format === 'json'); });
		expect(missing).toEqual([]);
		['globalSetup', 'ziweiSihuaCustom', 'ziweiBrightnessCustom', 'horosa.chart.newChartSeeds.v1'].forEach((k)=>expect(classifyStorageKey(k).format).toBe('json'));
	});
});
