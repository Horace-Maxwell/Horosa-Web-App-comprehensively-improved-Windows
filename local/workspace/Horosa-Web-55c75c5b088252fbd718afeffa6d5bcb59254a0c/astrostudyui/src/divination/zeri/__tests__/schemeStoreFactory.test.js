// [方案库压测] 工厂化后 天星/奇门 双实例全操作:保存/同名覆盖/改名(撞名顶旧)/删除/
// 导出(全部+指定)/导入回环/错格式头拒斥/跨技法互导必拒/历史与方案上限/坏数据兜底/双键隔离。
// 天星既有导出函数与奇门实例共用同一工厂,任何一侧回归都在此现形。
import {
	listSchemes, saveScheme, deleteScheme, renameScheme, exportSchemes, importSchemes,
	pushHistory, listHistory, qimenZeriSchemeStore, makeSchemeStore,
} from '../schemeStore';

const TX_KEY = 'horosa.zeri.schemes.v1';
const QM_KEY = 'horosa.zeri.qimen.schemes.v1';

const treeOf = (tag)=>({ kind: 'group', joiner: 'all', negate: false, children: [{ kind: 'leaf', type: 'x', params: { tag } }] });

beforeEach(()=>{
	window.localStorage.clear();
});

describe('基本操作(双实例各自跑)', ()=>{
	const RUNNERS = [
		['天星', { listSchemes, saveScheme, deleteScheme, renameScheme, exportSchemes, importSchemes, pushHistory, listHistory }, TX_KEY],
		['奇门', qimenZeriSchemeStore, QM_KEY],
	];
	test.each(RUNNERS)('%s:保存/列出/同名覆盖/删除', (label, s, key)=>{
		expect(s.saveScheme('', {}, treeOf('a')).ok).toBe(false);
		expect(s.saveScheme('  ', {}, treeOf('a')).ok).toBe(false);
		expect(s.saveScheme('方案A', { c: 1 }, treeOf('a1')).ok).toBe(true);
		expect(s.saveScheme('方案B', { c: 2 }, treeOf('b')).ok).toBe(true);
		expect(s.listSchemes().map((x)=>x.name)).toEqual(['方案B', '方案A']);
		// 同名覆盖:内容更新、条数不变、置顶
		expect(s.saveScheme('方案A', { c: 9 }, treeOf('a2')).ok).toBe(true);
		const list = s.listSchemes();
		expect(list.length).toBe(2);
		expect(list[0].name).toBe('方案A');
		expect(list[0].config.c).toBe(9);
		expect(list[0].tree.children[0].params.tag).toBe('a2');
		// 落在自己的键上
		expect(`${window.localStorage.getItem(key)}`).toContain('方案A');
		s.deleteScheme(list[0].id);
		expect(s.listSchemes().map((x)=>x.name)).toEqual(['方案B']);
	});
	test.each(RUNNERS)('%s:改名(含撞名顶旧/空名/不存在)', (label, s)=>{
		s.saveScheme('甲', {}, treeOf('a'));
		s.saveScheme('乙', {}, treeOf('b'));
		const jia = s.listSchemes().find((x)=>x.name === '甲');
		expect(s.renameScheme(jia.id, '').ok).toBe(false);
		expect(s.renameScheme('no_such_id', '丙').ok).toBe(false);
		expect(s.renameScheme(jia.id, '丙').ok).toBe(true);
		expect(s.listSchemes().map((x)=>x.name).sort()).toEqual(['丙', '乙'].sort());
		// 撞名顶旧:把 丙 改成 乙 → 旧「乙」被顶掉,只剩一个「乙」(id=原丙)
		expect(s.renameScheme(jia.id, '乙').ok).toBe(true);
		const after = s.listSchemes();
		expect(after.length).toBe(1);
		expect(after[0].id).toBe(jia.id);
		expect(after[0].name).toBe('乙');
	});
	test.each(RUNNERS)('%s:导出(全部/指定)+导入回环(同名覆盖语义)', (label, s)=>{
		s.saveScheme('一', { k: 1 }, treeOf('t1'));
		s.saveScheme('二', { k: 2 }, treeOf('t2'));
		const all = s.exportSchemes();
		const one = s.exportSchemes([s.listSchemes().find((x)=>x.name === '一').id]);
		expect(JSON.parse(one).schemes.length).toBe(1);
		// 清库→导入全部→回环
		window.localStorage.clear();
		const r = s.importSchemes(all);
		expect(r.ok).toBe(true);
		expect(r.added).toBe(2);
		expect(s.listSchemes().map((x)=>x.name).sort()).toEqual(['一', '二'].sort());
		// 再导入:同名覆盖,不翻倍
		const r2 = s.importSchemes(all);
		expect(r2.added).toBe(2);
		expect(s.listSchemes().length).toBe(2);
		// 缺 name/tree 的脏条目跳过
		const dirty = JSON.parse(all);
		dirty.schemes.push({ name: '', tree: null }, { name: '三' });
		expect(s.importSchemes(JSON.stringify(dirty)).added).toBe(2);
	});
	test.each(RUNNERS)('%s:导入拒斥(坏 JSON/无格式头)', (label, s)=>{
		expect(s.importSchemes('not json').ok).toBe(false);
		expect(s.importSchemes('{"format":"nope","schemes":[]}').ok).toBe(false);
		expect(s.importSchemes(JSON.stringify({ schemes: [] })).ok).toBe(false);
	});
	test.each(RUNNERS)('%s:历史上限20置顶序', (label, s)=>{
		for(let i = 0; i < 25; i++){
			s.pushHistory({ i }, treeOf(`h${i}`));
		}
		const his = s.listHistory();
		expect(his.length).toBe(20);
		expect(his[0].config.i).toBe(24);
	});
	test.each(RUNNERS)('%s:方案上限60截断', (label, s)=>{
		for(let i = 0; i < 65; i++){
			s.saveScheme(`名${i}`, {}, treeOf(`s${i}`));
		}
		expect(s.listSchemes().length).toBe(60);
		expect(s.listSchemes()[0].name).toBe('名64');
	});
});

describe('隔离与兜底', ()=>{
	test('跨技法互导必拒(格式头不同,mismatch 文案各自明确)', ()=>{
		saveScheme('天星方案', {}, treeOf('tx'));
		qimenZeriSchemeStore.saveScheme('奇门方案', {}, treeOf('qm'));
		const txExport = exportSchemes();
		const qmExport = qimenZeriSchemeStore.exportSchemes();
		const r1 = qimenZeriSchemeStore.importSchemes(txExport);
		expect(r1.ok).toBe(false);
		expect(r1.msg).toContain('奇门择日');
		const r2 = importSchemes(qmExport);
		expect(r2.ok).toBe(false);
		expect(r2.msg).toContain('天星择日');
	});
	test('双键隔离:两库互不污染、键名各归各', ()=>{
		saveScheme('只在天星', {}, treeOf('tx'));
		qimenZeriSchemeStore.saveScheme('只在奇门', {}, treeOf('qm'));
		expect(listSchemes().map((x)=>x.name)).toEqual(['只在天星']);
		expect(qimenZeriSchemeStore.listSchemes().map((x)=>x.name)).toEqual(['只在奇门']);
		expect(`${window.localStorage.getItem(TX_KEY)}`).toContain('只在天星');
		expect(`${window.localStorage.getItem(TX_KEY)}`).not.toContain('只在奇门');
		expect(`${window.localStorage.getItem(QM_KEY)}`).toContain('只在奇门');
		expect(`${window.localStorage.getItem(QM_KEY)}`).not.toContain('只在天星');
		qimenZeriSchemeStore.deleteScheme(qimenZeriSchemeStore.listSchemes()[0].id);
		expect(listSchemes().length).toBe(1);
	});
	test('坏数据兜底:键上是垃圾时按空库起步不抛', ()=>{
		window.localStorage.setItem(QM_KEY, '{"broken":');
		expect(qimenZeriSchemeStore.listSchemes()).toEqual([]);
		window.localStorage.setItem(QM_KEY, JSON.stringify({ version: 1, schemes: 'nope', history: [] }));
		expect(qimenZeriSchemeStore.listSchemes()).toEqual([]);
		expect(qimenZeriSchemeStore.saveScheme('新起', {}, treeOf('x')).ok).toBe(true);
		expect(qimenZeriSchemeStore.listSchemes().length).toBe(1);
	});
	test('工厂新实例即开即用(第三键不串两家)', ()=>{
		const third = makeSchemeStore({ storageKey: 'horosa.test.third.v1', exportFormat: 'horosa-test-third', mismatchMsg: '不是测试导出' });
		third.saveScheme('第三家', {}, treeOf('t'));
		expect(third.listSchemes().length).toBe(1);
		expect(listSchemes().length).toBe(0);
		expect(qimenZeriSchemeStore.listSchemes().length).toBe(0);
		expect(third.importSchemes(exportSchemes()).ok).toBe(false);
	});
});
