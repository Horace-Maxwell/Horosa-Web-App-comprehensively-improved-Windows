// 全量恢复:用户资产列表 / 映射按条目并集(注册表 restoreMerge 声明),不整值替换 ——
// 恢复较早的包不再冲掉之后新增的择日方案 / 塔罗日志 / 书签 / 地占记录…;预览与执行同一个函数。
// 合同:随备份走的 user-data 键必须声明 restoreMerge 或写明 restoreReplace 理由(新加列表类键不声明即红)。
jest.mock('../ziweiCustomTablesPersist', ()=>({
	mirrorZiweiCustomTable: jest.fn(()=>Promise.resolve(null)),
	restoreZiweiCustomTablesOnce: jest.fn(()=>Promise.resolve([])),
}));
import { STORAGE_KEY_REGISTRY, classifyStorageKey } from '../storageKeyRegistry';
import { restoreUnifiedBackup, previewUnifiedRestore, mergeListRaw, UNIFIED_BACKUP_FORMAT } from '../unifiedBackup';

// 由专用并集处理(人生事件 / 删除记录 / 删除日志)
const BUILTIN_MERGE = new Set(['horosa.lc.lifeEvents.v1', 'horosa.lc.lifeEvents.deleted.v1', 'horosa.deleted.log.v1']);

export function undeclaredUserAssets(registry){
	return registry
		.filter((e)=>e.kind === 'user-data' && e.backup === true)
		.filter((e)=>!(e.restoreMerge && typeof e.restoreMerge === 'object') && !(typeof e.restoreReplace === 'string' && e.restoreReplace.trim()))
		.filter((e)=>!BUILTIN_MERGE.has(e.key))
		.map((e)=>e.key || `${e.prefix}*`);
}

beforeEach(()=>{ window.localStorage.clear(); });
const pkg = (raw)=>({ format: UNIFIED_BACKUP_FORMAT, version: 2, raw });

describe('合同', ()=>{
	it('🔴 随备份走的用户资产键都声明了并集规格或整值替换理由', ()=>{
		expect(undeclaredUserAssets(STORAGE_KEY_REGISTRY)).toEqual([]);
	});
	it('判别力:去掉一把的声明立即红;规格只取约定形状', ()=>{
		const reg = STORAGE_KEY_REGISTRY.map((e)=>(e.key === 'horosa.tarot.dailyLog' ? { ...e, restoreMerge: undefined } : e));
		expect(undeclaredUserAssets(reg)).toEqual(['horosa.tarot.dailyLog']);
		STORAGE_KEY_REGISTRY.forEach((e)=>{
			if(!e.restoreMerge){ return; }
			expect(['array', 'map', 'fields']).toContain(e.restoreMerge.shape);
			expect(e.format).toBe('json');
			if(e.restoreMerge.order !== undefined){ expect(['newest-first', 'oldest-first']).toContain(e.restoreMerge.order); }
		});
	});
});

describe('🔴 旧包 + 本机之后新增的条目 → 两边都在', ()=>{
	it('择日方案(对象里的两个列表各自并集,同 id 保本机)', async ()=>{
		const K = 'horosa.zeri.qimen.schemes.v1';
		window.localStorage.setItem(K, JSON.stringify({ version: 1, schemes: [{ id: 's_new', name: '本机新方案', savedAt: '2026-10-20T00:00:00Z' }, { id: 's_old', name: '本机改过名', savedAt: '2026-01-01T00:00:00Z' }], history: [] }));
		const raw = { [K]: JSON.stringify({ version: 1, schemes: [{ id: 's_old', name: '备份里的旧名', savedAt: '2026-01-01T00:00:00Z' }, { id: 's_bak', name: '只在备份里', savedAt: '2026-02-01T00:00:00Z' }], history: [{ at: '2026-02-01T00:00:00Z' }] }) };
		const rows = previewUnifiedRestore(pkg(raw));
		expect(rows.find((r)=>r.key === K).detail).toContain('与本机合并');
		await restoreUnifiedBackup(pkg(raw));
		const v = JSON.parse(window.localStorage.getItem(K));
		expect(v.schemes.map((x)=>x.id)).toEqual(['s_new', 's_bak', 's_old']);
		expect(v.schemes.find((x)=>x.id === 's_old').name).toBe('本机改过名');
		expect(v.history.length).toBe(1);
	});
	it('塔罗每日日志(同日同牌组一条;按日期升序)', async ()=>{
		const K = 'horosa.tarot.dailyLog';
		window.localStorage.setItem(K, JSON.stringify([{ d: '2026-10-01', deck: 'rws', sid: 'a' }]));
		await restoreUnifiedBackup(pkg({ [K]: JSON.stringify([{ d: '2026-09-01', deck: 'rws', sid: 'b' }, { d: '2026-10-01', deck: 'rws', sid: 'zz' }]) }));
		const v = JSON.parse(window.localStorage.getItem(K));
		expect(v.map((x)=>`${x.d}:${x.sid}`)).toEqual(['2026-09-01:b', '2026-10-01:a']);
	});
	it('玄史书签(上限 300:本机先占,剩余容量取备份里较新的)', ()=>{
		const K = 'horosa.xuanshi.bookmarks.v1';
		const local = Array.from({ length: 299 }, (_, i)=>({ kind: 'p', ref: `L${i}`, ts: 1000 + i }));
		window.localStorage.setItem(K, JSON.stringify(local));
		const incoming = [{ kind: 'p', ref: 'B1', ts: 5 }, { kind: 'p', ref: 'B2', ts: 9 }];
		const dry = mergeListRaw(K, JSON.stringify(incoming), { dryRun: true });
		expect(dry).toMatchObject({ status: 'ok', dropped: 1 });
		const r = mergeListRaw(K, JSON.stringify(incoming));
		expect(r.dropped).toBe(1);
		const v = JSON.parse(window.localStorage.getItem(K));
		expect(v.length).toBe(300);
		expect(v.some((x)=>x.ref === 'B2')).toBe(true);
		expect(v.some((x)=>x.ref === 'B1')).toBe(false);
		expect(local.every((l)=>v.some((x)=>x.ref === l.ref))).toBe(true);
	});
	it('映射类(个人牌义):按键并集,同键保本机', async ()=>{
		const K = 'horosa.tarot.personalMeanings';
		window.localStorage.setItem(K, JSON.stringify({ a: '本机', c: '本机新' }));
		await restoreUnifiedBackup(pkg({ [K]: JSON.stringify({ a: '备份', b: '只在备份' }) }));
		expect(JSON.parse(window.localStorage.getItem(K))).toEqual({ a: '本机', b: '只在备份', c: '本机新' });
	});
	it('坏形状:跳过不写,本机不动;整值替换类(紫微表)照旧整值写', async ()=>{
		const K = 'horosa.xuanshi.history.v1';
		window.localStorage.setItem(K, JSON.stringify([{ q: '本机', ts: 1 }]));
		const res = await restoreUnifiedBackup(pkg({ [K]: JSON.stringify({ not: 'array' }), ziweiSihuaCustom: '{"x":1}' }));
		expect(res.find((r)=>r.key === K)).toMatchObject({ ok: false });
		expect(JSON.parse(window.localStorage.getItem(K))).toEqual([{ q: '本机', ts: 1 }]);
		expect(window.localStorage.getItem('ziweiSihuaCustom')).toBe('{"x":1}');
		expect(classifyStorageKey('ziweiSihuaCustom').restoreReplace).toBeTruthy();
	});
});
