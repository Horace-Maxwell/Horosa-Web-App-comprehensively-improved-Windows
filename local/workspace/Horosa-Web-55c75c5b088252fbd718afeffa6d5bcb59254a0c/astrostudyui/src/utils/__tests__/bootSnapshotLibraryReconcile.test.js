// 温启快照 × 命盘库:快照之后库里那条被换过(全量恢复 / 单库导入整条替换 / 界面外改了档案 / 影子并回),
// 重启后屏幕上的盘必须是库里那一版 —— 否则一保存就把恢复 / 导入改回去。
//   ① 全量恢复写完:待落盘的那份先丢;快照那张盘被恢复换掉 → 按库里那条重放、连记录号的紫微临时表作废;与恢复无关 → 快照原样(仍温启同一张盘);
//   ② 读快照时库里同 cid 那条已不是快照时那一版(比指纹「不等」,整条替换会带回备份里较旧的更新时间)→ 改用库里那条,页签照旧;
//   ③ 没有指纹的旧快照:库里那条更新时间晚于快照时刻才改用;
//   ④ 源码合同:restoreUnifiedBackup 按换掉的记录号结算快照;单库导入 / 影子并回广播带记录号。
jest.mock('../ziweiCustomTablesPersist', ()=>({
	mirrorZiweiCustomTable: jest.fn(()=>Promise.resolve(null)),
	restoreZiweiCustomTablesOnce: jest.fn(()=>Promise.resolve([])),
}));
import fs from 'fs';
import path from 'path';
import {
	buildBootChartRecord, saveBootChartSnapshot, loadBootChartSnapshot, reconcileBootSnapshotWithLibrary, settleBootChartSnapshotAfterRestore, __bootChartStoreKeyForTest,
} from '../bootChartRestore';
import { flushStorageWrites, hasPendingStorageWrite } from '../deferredStorage';
import { upsertLocalChart, getLocalChart, importLocalChartsBackup, exportLocalChartsBackup } from '../localcharts';
import { restoreUnifiedBackup, UNIFIED_BACKUP_FORMAT } from '../unifiedBackup';
import DateTime from '../../components/comp/DateTime';

const KEY = __bootChartStoreKeyForTest();
const SRC = path.resolve(__dirname, '../..');

function mkFields(cid, name){
	const dt = new DateTime();
	dt.parse('1990-05-06 07:08:00', 'YYYY-MM-DD HH:mm:ss');
	dt.ad = 1; dt.zone = '+08:00';
	const v = (x)=>({ value: x });
	return { cid: v(cid), date: { value: dt }, time: { value: dt }, lat: v('26n04'), lon: v('119e19'), name: v(name), pos: v('福州'), hsys: v(1), memoAstro: v('旧备注') };
}

beforeEach(()=>{
	window.localStorage.clear();
	flushStorageWrites();
	window.__TAURI_INTERNALS__ = { invoke(){ return Promise.resolve(null); } };
});
afterEach(()=>{ delete window.__TAURI_INTERNALS__; });

function seedChart(name){
	const saved = upsertLocalChart({ name, birth: '1990-05-06 07:08:00', zone: '+08:00', lat: '26n04', lon: '119e19', pos: '福州', memoAstro: '旧备注' });
	return (saved && saved.cid) || (saved && saved.record && saved.record.cid);
}

describe('① 全量恢复之后的温启快照', ()=>{
	it('🔴 恢复同 cid 的「新」版(一律用备份里的)→ 刷新后按库里那条重放(页签照旧),紫微临时表作废,待落盘的那份不会写回', async ()=>{
		const cid = seedChart('旧');
		// 备份里同 cid 那条叫「新」
		const pkgCharts = exportLocalChartsBackup();
		pkgCharts.charts = pkgCharts.charts.map((r)=>(r.cid === cid ? { ...r, name: '新', updateTime: '2000-01-01 00:00:00' } : r));
		saveBootChartSnapshot(mkFields(cid, '旧'), 'astro', null);
		flushStorageWrites();
		expect(window.localStorage.getItem(KEY)).not.toBe(null);
		window.localStorage.setItem('ziweiSessionTables', JSON.stringify({ cid, sihua: 'x', brightness: null }));
		saveBootChartSnapshot(mkFields(cid, '旧'), 'ziwei', null);   // 还在延迟落盘队列里的一份
		expect(hasPendingStorageWrite(KEY)).toBe(true);
		const res = await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, charts: pkgCharts, raw: {} }, { sameCid: 'backup' });
		expect(res.find((r)=>r.key === 'charts')).toMatchObject({ ok: true, changedCids: [cid] });
		expect(getLocalChart(cid).name).toBe('新');
		expect(hasPendingStorageWrite(KEY)).toBe(false);
		flushStorageWrites();   // 刷新前的 flushAll
		expect(window.localStorage.getItem('ziweiSessionTables')).toBe(null);
		const snap = loadBootChartSnapshot();
		expect(snap.fromLibrary).toBe(true);
		expect(snap.record.name).toBe('新');
		expect(snap.currentTab).toBe('astro');
	});

	it('🔴 恢复不涉及当前盘 → 刷新后仍温启同一张盘(快照与紫微临时表原样)', async ()=>{
		const cid = seedChart('我的盘');
		const pkg = { format: 'horosa-local-charts', version: 1, charts: [{ cid: 'other-1', name: '别人', birth: '1980-01-01 00:00:00', zone: '+08:00', lat: '26n04', lon: '119e19', updateTime: '2001-01-01 00:00:00' }] };
		saveBootChartSnapshot({ ...mkFields(cid, '我的盘'), hsys: { value: 3 } }, 'ziwei', 'liunian');
		flushStorageWrites();
		window.localStorage.setItem('ziweiSessionTables', JSON.stringify({ cid, sihua: 'x', brightness: null }));
		await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, charts: pkg, raw: {} });
		flushStorageWrites();
		const snap = loadBootChartSnapshot();
		expect(snap).not.toBe(null);
		expect(snap.fromLibrary).toBeUndefined();
		expect([snap.record.cid, snap.record.hsys, snap.currentTab, snap.currentSubTab]).toEqual([cid, 3, 'ziwei', 'liunian']);
		expect(window.localStorage.getItem('ziweiSessionTables')).not.toBe(null);
	});

	it('没有指纹的旧快照、恢复带回较旧的一版:照样按库里那条重放(不靠比先后)', async ()=>{
		const cid = seedChart('旧');
		const pkgCharts = exportLocalChartsBackup();
		pkgCharts.charts = pkgCharts.charts.map((r)=>(r.cid === cid ? { ...r, name: '备份里', updateTime: '2000-01-01 00:00:00' } : r));
		const snap0 = buildBootChartRecord(mkFields(cid, '旧'), 'astro');
		delete snap0.libUpdateTime;
		window.localStorage.setItem(KEY, JSON.stringify(snap0));
		await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, charts: pkgCharts, raw: {} }, { sameCid: 'backup' });
		expect(loadBootChartSnapshot().record.name).toBe('备份里');
	});

	it('结算函数本身:丢待写;只动被换掉的那条的快照与临时表', ()=>{
		saveBootChartSnapshot(mkFields('c1', '甲'), 'astro', null);
		flushStorageWrites();
		window.localStorage.setItem('ziweiSessionTables', '{"cid":"c2","sihua":"x"}');
		saveBootChartSnapshot(mkFields('c1', '甲改'), 'astro', null);
		expect(settleBootChartSnapshotAfterRestore(['c2'])).toEqual({ replaced: false });
		expect(hasPendingStorageWrite(KEY)).toBe(false);
		expect(JSON.parse(window.localStorage.getItem(KEY)).record.name).toBe('甲');
		expect(window.localStorage.getItem('ziweiSessionTables')).toBe(null);
		expect(settleBootChartSnapshotAfterRestore(['c1'])).toEqual({ replaced: true });
		expect(JSON.parse(window.localStorage.getItem(KEY)).libUpdateTime).not.toBe(getLocalChart('c1') ? getLocalChart('c1').updateTime : '');
	});
});

describe('② 读快照时对照命盘库', ()=>{
	it('🔴 单库导入整条替换成较旧的一版(更新时间更早):指纹不等 → 重放库里那条,页签照旧', ()=>{
		const cid = seedChart('旧');
		saveBootChartSnapshot(mkFields(cid, '旧'), 'ziwei', 'liunian');
		flushStorageWrites();
		const lib = getLocalChart(cid);
		importLocalChartsBackup({ format: 'horosa-local-charts', version: 1, charts: [{ ...lib, name: '新', memoAstro: '新备注', updateTime: '2000-01-01 00:00:00' }] }, { sameCid: 'backup' });
		expect(getLocalChart(cid).name).toBe('新');
		const snap = loadBootChartSnapshot();
		expect(snap.fromLibrary).toBe(true);
		expect(snap.record.name).toBe('新');
		expect(snap.record.memoAstro).toBe('新备注');
		expect(snap.record.cid).toBe(cid);
		expect(snap.currentTab).toBe('ziwei');
		expect(snap.currentSubTab).toBe('liunian');
	});

	it('库里那条没变 → 原样用快照(页面上之后改的选项不被库里那版冲掉)', ()=>{
		const cid = seedChart('旧');
		saveBootChartSnapshot({ ...mkFields(cid, '页面上改了没存'), hsys: { value: 3 } }, 'astro', null);
		flushStorageWrites();
		const snap = loadBootChartSnapshot();
		expect(snap.fromLibrary).toBeUndefined();
		expect(snap.record.name).toBe('页面上改了没存');
		expect(snap.record.hsys).toBe(3);
	});

	it('库里没有这条 / 快照不关联命盘库 → 原样', ()=>{
		const s1 = buildBootChartRecord(mkFields('gone', '甲'), 'astro');
		expect(reconcileBootSnapshotWithLibrary(s1, ()=>null)).toBe(s1);
		const s2 = buildBootChartRecord({ ...mkFields(null, '此刻') }, 'astro');
		expect(reconcileBootSnapshotWithLibrary(s2, ()=>({ birth: 'x', updateTime: 'y' }))).toBe(s2);
	});

	it('③ 没有指纹的旧快照:库里那条更新时间晚于快照时刻才改用', ()=>{
		const rec = { cid: 'k', name: '库里', birth: '1990-05-06 07:08:00', updateTime: '2026-10-01 00:00:00' };
		const old = { at: Date.parse('2026-09-01T00:00:00'), currentTab: 'astro', record: { cid: 'k', name: '快照', birth: '1990-05-06 07:08:00' } };
		expect(reconcileBootSnapshotWithLibrary(old, ()=>rec).record.name).toBe('库里');
		const newer = { ...old, at: Date.parse('2026-10-02T00:00:00') };
		expect(reconcileBootSnapshotWithLibrary(newer, ()=>rec)).toBe(newer);
	});

	it('界面外改了档案(AI 提案采纳只改名字,不重新出盘、快照不重写)→ 重启后显示库里改过的名字', ()=>{
		const cid = seedChart('旧');
		saveBootChartSnapshot(mkFields(cid, '旧'), 'astro', null);
		flushStorageWrites();
		const lib = getLocalChart(cid);
		// 采纳发生在快照之后(更新时间晚一些;同一秒内的写由指纹之外的时间精度决定,这里显式给一个之后的时刻)
		upsertLocalChart({ ...lib, name: '采纳后', updateTime: '2099-01-01 00:00:00', preserveUpdateTime: true });
		expect(loadBootChartSnapshot().record.name).toBe('采纳后');
	});
});

describe('④ 源码合同', ()=>{
	const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');
	it('restoreUnifiedBackup 写完之后按换掉的记录号结算温启快照', ()=>{
		const s = read('utils/unifiedBackup.js');
		const start = s.indexOf('export async function restoreUnifiedBackup(');
		const end = s.indexOf('\n}\n', start);
		expect(start).toBeGreaterThan(0);
		expect(s.slice(start, end)).toMatch(/settleBootChartSnapshotAfterRestore\(/);
	});
	it('loadBootChartSnapshot 经库里对照;单库导入 / 影子并回广播带记录号', ()=>{
		expect(read('utils/bootChartRestore.js')).toMatch(/normalizeLegacyBootSnapshot\(reconcileBootSnapshotWithLibrary\(snap\)\)/);
		expect(read('components/user/ChartList.js')).toMatch(/emitRecordsChanged\(\{ store: 'chart', cids: result\.changedCids/);
		expect(read('components/user/CaseList.js')).toMatch(/emitRecordsChanged\(\{ store: 'case', cids: result\.changedCids/);
		expect(read('components/common/StorageHealthModal.js')).toMatch(/emitRecordsChanged\(\{ source: 'shadow-merge', cids \}\)/);
		expect(read('components/common/LocalStoreHealthBanner.js')).toMatch(/emitRecordsChanged\(\{ source: 'shadow-merge', cids \}\)/);
	});
	it('导入回报列出被替换的记录号', ()=>{
		const cid = seedChart('甲');
		const lib = getLocalChart(cid);
		const r = importLocalChartsBackup({ format: 'horosa-local-charts', version: 1, charts: [{ ...lib, name: '乙', updateTime: '2099-01-01 00:00:00' }] });
		expect(r.changedCids).toEqual([cid]);
	});
});

describe('⑤ 本次运行内:一批记录被换过,当前载入的正是其中一条 → 按库里新版重设', ()=>{
	const drive = (gen, feed)=>{ let st = gen.next(); const out = []; while(!st.done){ out.push(st.value); st = gen.next(feed ? feed(st.value) : undefined); } return { puts: out }; };
	const userModel = require('../../models/user').default;
	const run = (payload, state)=>{
		const gen = userModel.effects.syncRecordFromStore.call(userModel, { payload }, { put: (a)=>a, select: (fn)=>fn({ user: state }) });
		return drive(gen, (v)=>(v && v.type ? undefined : v)).puts.filter((p)=>p && p.type).map((p)=>p);
	};
	it('单库导入带 cids:命中当前那条才重设;不在名单里不动', ()=>{
		const cid = seedChart('新');
		const state = { currentChart: { cid: { value: cid }, updateTime: { value: 'old' } } };
		const hit = run({ store: 'chart', cids: [cid], source: 'import' }, state);
		expect(hit.map((p)=>p.type)).toEqual(['fetchCharts', 'setCurrentChart']);
		expect(hit[1].payload.name).toBe('新');
		const miss = run({ store: 'chart', cids: ['other'], source: 'import' }, state);
		expect(miss.map((p)=>p.type)).toEqual(['fetchCharts']);
	});
	it('影子并回不分库:命盘、事盘两边都对照', ()=>{
		const cid = seedChart('并回后');
		const state = { currentChart: { cid: { value: cid }, updateTime: { value: 'old' } }, currentCase: null, currentCaseRecord: null };
		const types = run({ source: 'shadow-merge', cids: [cid] }, state).map((p)=>p.type);
		expect(types).toEqual(['fetchCharts', 'setCurrentChart', 'fetchCases']);
	});
});

describe('⑥ 旧版快照(没有 pinned)cid 空:按页签分事盘与此刻盘', ()=>{
	const { normalizeLegacyBootSnapshot, DIVINATION_TAB_KEYS } = require('../bootChartRestore');
	const legacy = (tab)=>({ at: Date.now(), currentTab: tab, record: { cid: null, birth: '1990-01-01 23:30:00', after23NewDay: 0, lateZiHourUseNextDay: 0, timeAlg: 1 } });
	it('卜类页签(事盘)→ 维持原样(三键是事盘自己的口径)', ()=>{
		const s = legacy('liureng');
		expect(normalizeLegacyBootSnapshot(s)).toBe(s);
	});
	it('命类页签(此刻 / 新命盘)→ 不钉住', ()=>{
		const out = normalizeLegacyBootSnapshot(legacy('bazi'));
		expect(out.pinned).toBe(false);
		expect(out.record.after23NewDay).toBeUndefined();
		expect(out.unpinnedTimeAlg).toBe(1);
	});
	it('「卜」组页签清单与导航一致', ()=>{
		const src = fs.readFileSync(path.join(SRC, 'pages/index.js'), 'utf8');
		const block = src.slice(src.indexOf('const navigationPages = ['), src.indexOf('];', src.indexOf('const navigationPages = [')));
		const keys = [];
		const re = /key: '([^']+)'[^}]*group: '卜'/g;
		let m;
		while((m = re.exec(block))){ keys.push(m[1]); }
		expect(keys.length).toBeGreaterThan(5);
		expect([...DIVINATION_TAB_KEYS].sort()).toEqual(keys.sort());
	});
});
