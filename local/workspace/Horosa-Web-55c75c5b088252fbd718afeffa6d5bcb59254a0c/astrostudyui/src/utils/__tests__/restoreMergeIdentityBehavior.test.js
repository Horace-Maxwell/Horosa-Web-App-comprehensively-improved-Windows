// 全量恢复按条目并集的「同一条」口径,必须与写入它的 store 自己的口径一致 —— 按注册表逐把键自动生成行为合同:
//   用真 store 写一条(备份那一刻)→ 取原串当备份包 → 用真 store 以同一身份再写一次(store 自己去重,本机只有一条)→
//   mergeListRaw 合并备份 → 同一身份仍只有一条、且是本机那版。
// 由来:择日方案库「同名再存 = 更新这条」(每次换新 id),注册表却按 id 认同一条 —— 恢复后同名两份、旧条件回来了。
// 新登记一把 restoreMerge 键、却没在下面交写入适配器 → 红(合同不能被新键绕过)。
jest.mock('../ziweiCustomTablesPersist', ()=>({
	mirrorZiweiCustomTable: jest.fn(()=>Promise.resolve(null)),
	restoreZiweiCustomTablesOnce: jest.fn(()=>Promise.resolve([])),
}));
import { STORAGE_KEY_REGISTRY } from '../storageKeyRegistry';
import { mergeListRaw } from '../unifiedBackup';
import * as SchemeStore from '../../divination/zeri/schemeStore';
import { SCHEME_RESTORE_MERGE } from '../../divination/zeri/schemeIdentity';
import { appendDailyLog, loadDailyLog, saveDailyLog } from '../../components/tarot/engine/dailyCourse';
import { savePersonalMeaning } from '../../components/tarot/decks/personalMeanings';
import { toggleBookmark } from '../../components/xuanshi/xuanshiBookmarks';
import { pushSearchHistory } from '../../components/xuanshi/XuanShiDesk';
import { saveUserRegion } from '../../divination/data/regionCharts';
import { saveLocalFateEvents } from '../localdeeplearn';
import { pushGeomancyHistory, GEOMANCY_HISTORY_RESTORE_MERGE } from '../../components/geomancy/geomancyHistory';
import { safeLocalStorageSet } from '../safeStorage';

const raw = (k)=>window.localStorage.getItem(k);
const parsed = (k)=>{ try{ return JSON.parse(raw(k)); }catch(e){ return null; } };
const mapCount = (k, id)=>{ const o = parsed(k) || {}; return Object.prototype.hasOwnProperty.call(o, id) ? 1 : 0; };

// 每个适配器:write(版本) 用真 store 写「同一身份」的一条;count() = 本机按 store 自己的口径数这一身份有几条;
// version() = 现存那条是哪一版。fields 形状按子字段给;skip 必须写理由。
const SCHEME_KEYS = {
	'horosa.zeri.schemes.v1': { saveScheme: SchemeStore.saveScheme, listSchemes: SchemeStore.listSchemes },
	'horosa.zeri.qimen.schemes.v1': SchemeStore.qimenZeriSchemeStore,
	'horosa.zeri.huangli.schemes.v1': SchemeStore.huangliZeriSchemeStore,
	'horosa.zeri.bazi.schemes.v1': SchemeStore.baziZeriSchemeStore,
	'horosa.zeri.taiyi.schemes.v1': SchemeStore.taiyiZeriSchemeStore,
	'horosa.zeri.ziwei.schemes.v1': SchemeStore.ziweiZeriSchemeStore,
	'horosa.zeri.liureng.schemes.v1': SchemeStore.liurengZeriSchemeStore,
	'horosa.zeri.sanshi.schemes.v1': SchemeStore.sanshiZeriSchemeStore,
	'horosa.zeri.qizheng.schemes.v1': SchemeStore.qizhengZeriSchemeStore,
	'horosa.zeri.india.schemes.v1': SchemeStore.indiaZeriSchemeStore,
};
const ADAPTERS = {};
Object.keys(SCHEME_KEYS).forEach((k)=>{
	const st = SCHEME_KEYS[k];
	ADAPTERS[k] = { fields: {
		schemes: {
			write: (v)=>st.saveScheme('婚期', { v }, { v }),
			count: ()=>st.listSchemes().filter((s)=>s.name === '婚期').length,
			version: ()=>(st.listSchemes().find((s)=>s.name === '婚期') || {}).tree.v,
		},
		history: { skip: '最近计算历史是流水:每条一个时刻,store 从不以同一身份再写一条' },
	} };
});
Object.assign(ADAPTERS, {
	'horosa.tarot.dailyLog': {
		write: (v)=>saveDailyLog(appendDailyLog(loadDailyLog(), { d: '2026-10-01', deck: 'rws', sid: v })),
		count: ()=>loadDailyLog().filter((x)=>x.d === '2026-10-01' && x.deck === 'rws').length,
		version: ()=>loadDailyLog().find((x)=>x.d === '2026-10-01').sid,
	},
	'horosa.tarot.personalMeanings': {
		write: (v)=>savePersonalMeaning('m01', v),
		count: ()=>mapCount('horosa.tarot.personalMeanings', 'm01'),
		version: ()=>parsed('horosa.tarot.personalMeanings').m01,
	},
	'horosa.xuanshi.bookmarks.v1': {
		// 同一身份再写一次 = 取消收藏再收藏(新时刻)
		write: (v)=>{ if(v === 'new'){ toggleBookmark({ kind: 'figure', ref: '42' }); } toggleBookmark({ kind: 'figure', ref: '42', title: v }); },
		count: ()=>(parsed('horosa.xuanshi.bookmarks.v1') || []).filter((b)=>b.kind === 'figure' && `${b.ref}` === '42').length,
		version: ()=>(parsed('horosa.xuanshi.bookmarks.v1') || []).find((b)=>`${b.ref}` === '42').title,
		reset: ()=>{ delete window.__horosaXuanshiBM; },
	},
	'horosa.xuanshi.history.v1': {
		write: (v)=>pushSearchHistory(v === 'old' ? '狐' : '狐 ', { tradition: v }),
		count: ()=>(parsed('horosa.xuanshi.history.v1') || []).filter((h)=>`${h.q}`.trim() === '狐').length,
		version: ()=>(parsed('horosa.xuanshi.history.v1') || [])[0].sel.tradition,
	},
	'horosa.mundane.region.user.v1': {
		write: (v)=>saveUserRegion('r1', { name: v }),
		count: ()=>mapCount('horosa.mundane.region.user.v1', 'r1'),
		version: ()=>parsed('horosa.mundane.region.user.v1').r1.name,
	},
	'HorosaLocalDeepLearn': {
		write: (v)=>saveLocalFateEvents({ Cid: 'c1', Val10000: { v } }),
		count: ()=>mapCount('HorosaLocalDeepLearn', 'c1'),
		version: ()=>parsed('HorosaLocalDeepLearn').c1.Val10000.v,
	},
	'horosaGeomancyHistory': {
		// 同一副卦重算(换了时刻)= store 原地替换首条
		write: (v)=>safeLocalStorageSet('horosaGeomancyHistory', JSON.stringify(pushGeomancyHistory(parsed('horosaGeomancyHistory') || [], { seed: 7, castMethod: 'random', castNumbers: null, ts: v === 'old' ? 1000 : 2000, school: v }))),
		count: ()=>(parsed('horosaGeomancyHistory') || []).filter((e)=>e.seed === 7).length,
		version: ()=>(parsed('horosaGeomancyHistory') || []).find((e)=>e.seed === 7).school,
	},
	// 术语表(全局):store 按 term 合并(同一个词条一条)
	'horosa.report.glossary.global.v1': {
		write: (v)=>{ const list = (parsed('horosa.report.glossary.global.v1') || []).filter((e)=>e.term !== '命宫'); list.push({ term: '命宫', def: v }); safeLocalStorageSet('horosa.report.glossary.global.v1', JSON.stringify(list)); },
		count: ()=>(parsed('horosa.report.glossary.global.v1') || []).filter((e)=>e.term === '命宫').length,
		version: ()=>(parsed('horosa.report.glossary.global.v1') || []).find((e)=>e.term === '命宫').def,
	},
});

const MERGE_KEYS = STORAGE_KEY_REGISTRY.filter((e)=>e.key && e.restoreMerge && typeof e.restoreMerge === 'object').map((e)=>e.key);
const specOf = (k)=>STORAGE_KEY_REGISTRY.find((e)=>e.key === k).restoreMerge;

beforeEach(()=>{ window.localStorage.clear(); delete window.__horosaXuanshiBM; });

describe('🔴 每把 restoreMerge 键:同一身份再写一次 → 恢复合并后不重复', ()=>{
	it('每把键(及 fields 的每个子字段)都交了写入适配器或带理由的 skip', ()=>{
		const missing = [];
		MERGE_KEYS.forEach((k)=>{
			const a = ADAPTERS[k];
			const spec = specOf(k);
			if(!a){ missing.push(k); return; }
			if(spec.shape === 'fields'){
				Object.keys(spec.fields || {}).forEach((f)=>{
					const fa = a.fields && a.fields[f];
					if(!fa || !(fa.write || (typeof fa.skip === 'string' && fa.skip.trim()))){ missing.push(`${k}.${f}`); }
				});
			}else if(typeof a.write !== 'function'){ missing.push(k); }
		});
		expect(missing).toEqual([]);
	});
	const cases = [];
	MERGE_KEYS.forEach((k)=>{
		const a = ADAPTERS[k];
		if(!a){ return; }
		if(a.fields){ Object.keys(a.fields).forEach((f)=>{ if(a.fields[f].write){ cases.push([`${k}.${f}`, k, a.fields[f], a]); } }); }
		else{ cases.push([k, k, a, a]); }
	});
	it.each(cases)('%s', (_label, key, ad, top)=>{
		const reset = top.reset || ad.reset;
		ad.write('old');
		const backupRaw = raw(key);
		expect(backupRaw).toBeTruthy();
		if(reset){ reset(); }
		ad.write('new');
		expect(ad.count()).toBe(1);   // store 自己按这一身份去重
		const r = mergeListRaw(key, backupRaw);
		expect(r.status).toBe('ok');
		if(reset){ reset(); }
		expect([key, ad.count()]).toEqual([key, 1]);
		expect(ad.version()).toBe('new');
	});
});

describe('择日方案:身份出自方案库单源', ()=>{
	it('十把键的并集规格就是方案库导出的那一份(不在注册表里另写)', ()=>{
		Object.keys(SCHEME_KEYS).forEach((k)=>{ expect(specOf(k)).toBe(SCHEME_RESTORE_MERGE); });
		expect(SchemeStore.SCHEME_RESTORE_MERGE).toBe(SCHEME_RESTORE_MERGE);
		expect(specOf('horosaGeomancyHistory')).toBe(GEOMANCY_HISTORY_RESTORE_MERGE);
	});
	it('改过名的同一条(id 相同)也不出两份;同名换了 id 的同一条不出两份;真不同的两条都在', ()=>{
		const st = SchemeStore.qimenZeriSchemeStore;
		const K = 'horosa.zeri.qimen.schemes.v1';
		st.saveScheme('甲', {}, { v: 1 });
		const idA = st.listSchemes()[0].id;
		st.saveScheme('乙', {}, { v: 2 });
		const backupRaw = raw(K);
		st.renameScheme(idA, '甲改');
		st.saveScheme('乙', {}, { v: 3 });
		st.saveScheme('丙', {}, { v: 4 });
		mergeListRaw(K, backupRaw);
		expect(st.listSchemes().map((s)=>s.name).sort()).toEqual(['丙', '乙', '甲改']);
	});
	it('导入方案的名字按同一口径去空白(「婚期 」与「婚期」是同一条)', ()=>{
		const st = SchemeStore.baziZeriSchemeStore;
		st.saveScheme('婚期', {}, { v: 1 });
		st.importSchemes(JSON.stringify({ format: 'horosa-bazi-zeri-schemes', schemes: [{ name: '婚期 ', tree: { v: 2 } }] }));
		expect(st.listSchemes().map((s)=>s.name)).toEqual(['婚期']);
	});
});
