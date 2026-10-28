// horosa_boot_chart_restore_v1 金标:
//   ① 快照↔record 往返:birth/ad/zone 精确、manifest 选项键随行、memo×8 恒有键(空串);
//   ② 门:非桌面壳 / 开关关 / 超 7 天 / 坏档 → 一律 null(启动回空白默认态,零风险);
//   ③ 键单一事实源:快照包含 RECORD_FIELDS_RESTORE_MANIFEST 里出现在 fields 的每个键。
import {
	buildBootChartRecord, saveBootChartSnapshot, loadBootChartSnapshot, __bootChartStoreKeyForTest,
} from '../bootChartRestore';
import { flushStorageWrites } from '../deferredStorage';
import { RECORD_FIELDS_RESTORE_MANIFEST } from '../recordFieldsRestore';
import DateTime from '../../components/comp/DateTime';

const KEY = __bootChartStoreKeyForTest();

function mkFields(){
	const dt = new DateTime();
	dt.parse('2026-07-21 08:30:00', 'YYYY-MM-DD HH:mm:ss');
	dt.ad = 1; dt.zone = '+08:00';
	const v = (x)=>({ value: x });
	return {
		date: { value: dt }, time: { value: dt },
		lat: v('26n04'), lon: v('119e19'), gpsLat: v(26.07), gpsLon: v(119.31),
		name: v('测'), pos: v('福州'), hsys: v(1), zodiacal: v(0), gender: v(1),
		after23NewDay: v(1), lateZiHourUseNextDay: v(1), timeAlg: v(0),
		memoAstro: v('备注A'),
	};
}

function enterDesktopShell(){ window.__TAURI_INTERNALS__ = { invoke(){ return Promise.resolve(null); } }; }
function leaveDesktopShell(){ delete window.__TAURI_INTERNALS__; }

beforeEach(()=>{
	window.localStorage.clear();
	window.localStorage.removeItem('horosa.perf.bootChartRestore');
	enterDesktopShell();
});

afterEach(()=>{
	leaveDesktopShell();
});

test('往返:birth/ad/zone 精确;manifest 在场键全随行;memo×8 恒有键', ()=>{
	const snap = buildBootChartRecord({ ...mkFields(), cid: { value: 'rec-9' } }, 'ziwei', 'liunian', { dayBoundaryPinned: true });
	expect(snap.currentTab).toBe('ziwei');
	expect(snap.currentSubTab).toBe('liunian');
	expect(snap.record.cid).toBe('rec-9');           // 保留记录关联
	expect(buildBootChartRecord(mkFields(), 'ziwei').record.cid).toBeNull();
	expect(snap.record.birth).toBe('2026-07-21 08:30:00');
	expect(snap.record.ad).toBe(1);
	expect(snap.record.zone).toBe('+08:00');
	expect(snap.record.lat).toBe('26n04');
	RECORD_FIELDS_RESTORE_MANIFEST.forEach(({ key })=>{
		if(mkFields()[key] !== undefined){
			expect(snap.record).toHaveProperty(key);
		}
	});
	['memo74','memoBaZi','memoZiWei','memoAstro','memoGua','memoLiuReng','memoQiMeng','memoSuZhan']
		.forEach((k)=> expect(snap.record).toHaveProperty(k));
	expect(snap.record.memoAstro).toBe('备注A');
	expect(snap.record.memo74).toBe('');
});

test('🔴 没钉住口径的盘(此刻 / 新命盘):快照不带日界 / 晚子时 / 时间算法,重启后照旧跟随全局;钉住的照带', ()=>{
	const { recordPinsDayBoundary } = require('../baziCalibreScope');
	const f = { ...mkFields(), after23NewDay: { value: 1 }, lateZiHourUseNextDay: { value: 1 }, timeAlg: { value: 0 } };
	const loose = buildBootChartRecord(f, 'bazi').record;
	['after23NewDay', 'lateZiHourUseNextDay', 'timeAlg'].forEach((k)=>expect(loose).not.toHaveProperty(k));
	expect(recordPinsDayBoundary(loose)).toBe(false);
	const pinned = buildBootChartRecord(f, 'bazi', null, { dayBoundaryPinned: true }).record;
	expect(pinned.after23NewDay).toBe(1);
	expect(recordPinsDayBoundary(pinned)).toBe(true);
});

test('构不出合法 birth(无 date)→ null,不落快照', ()=>{
	expect(buildBootChartRecord({ name: { value: 'x' } }, 'bazi')).toBeNull();
	saveBootChartSnapshot({}, 'bazi');
	flushStorageWrites();
	expect(window.localStorage.getItem(KEY)).toBeNull();
});

test('save→load 闭环(经 deferredStorage 空闲写,flush 后可读)', ()=>{
	saveBootChartSnapshot(mkFields(), 'astrochart');
	flushStorageWrites();
	const snap = loadBootChartSnapshot();
	expect(snap).not.toBeNull();
	expect(snap.record.birth).toBe('2026-07-21 08:30:00');
	expect(snap.currentTab).toBe('astrochart');
});

test('门:非桌面壳 / kill-switch / 7 天窗 / 坏档 → null', ()=>{
	saveBootChartSnapshot(mkFields(), 'bazi');
	flushStorageWrites();
	leaveDesktopShell();
	expect(loadBootChartSnapshot()).toBeNull();          // 非桌面壳
	enterDesktopShell();
	window.localStorage.setItem('horosa.perf.bootChartRestore', '0');
	expect(loadBootChartSnapshot()).toBeNull();          // 开关关
	window.localStorage.removeItem('horosa.perf.bootChartRestore');
	const snap = JSON.parse(window.localStorage.getItem(KEY));
	snap.at = Date.now() - 8 * 24 * 60 * 60 * 1000;
	window.localStorage.setItem(KEY, JSON.stringify(snap));
	expect(loadBootChartSnapshot()).toBeNull();          // 超 7 天
	window.localStorage.setItem(KEY, '{broken');
	expect(loadBootChartSnapshot()).toBeNull();          // 坏档
});

describe('温启快照的页签 = 上次停留(切页签也重落快照)', ()=>{
	test('pages/index.js:出盘 chartId 换代 与 切页签 两个效果都调用 saveBootChartSnapshot,后者依赖 [currentTab, currentSubTab] 且未出盘不写', ()=>{
		const fs = require('fs');
		const path = require('path');
		const src = fs.readFileSync(path.join(__dirname, '..', '..', 'pages', 'index.js'), 'utf8');
		const calls = src.split('saveBootChartSnapshot(fields, currentTab, currentSubTab, { dayBoundaryPinned: !!_dayBoundaryRecordPinned, dayBoundaryUserOverride: { after23: !!_after23BoundaryUserOverrode, lateZi: !!_lateZiHourUserOverrode } })').length - 1;
		expect(calls).toBeGreaterThanOrEqual(2);
		const depsAt = src.indexOf('}, [currentTab, currentSubTab]);');
		expect(depsAt).toBeGreaterThan(0);
		const effectStart = src.lastIndexOf('React.useEffect(', depsAt);
		const body = src.slice(effectStart, depsAt);
		expect(body).toContain('saveBootChartSnapshot(fields, currentTab, currentSubTab, { dayBoundaryPinned: !!_dayBoundaryRecordPinned, dayBoundaryUserOverride: { after23: !!_after23BoundaryUserOverrode, lateZi: !!_lateZiHourUserOverrode } })');
		expect(body).toContain('chartObj.chartId');
	});
});

// 新快照显式写 pinned:钉住的与旧版快照(恒带三键、没有这个标志)同形,载入端靠它分得出
test('🔴 快照显式记钉没钉住;旧版快照(无标志)不关联命盘库 → 按不钉住还原(去三键、时间算法另记);关联命盘库的照旧', ()=>{
	const { normalizeLegacyBootSnapshot } = require('../bootChartRestore');
	expect(buildBootChartRecord(mkFields(), 'astrochart', null, { dayBoundaryPinned: true }).pinned).toBe(true);
	expect(buildBootChartRecord(mkFields(), 'astrochart', null, { dayBoundaryPinned: false }).pinned).toBe(false);
	// 旧版(发布版)快照:无 pinned、cid 空、带三键
	const legacy = { at: Date.now(), currentTab: 'astrochart', record: { cid: null, birth: '2026-07-21 08:30:00', after23NewDay: 1, lateZiHourUseNextDay: 1, timeAlg: 2 } };
	const n = normalizeLegacyBootSnapshot(legacy);
	expect(n.pinned).toBe(false);
	expect(n.unpinnedTimeAlg).toBe(2);
	['after23NewDay', 'lateZiHourUseNextDay', 'timeAlg'].forEach((k)=>expect(n.record[k]).toBeUndefined());
	expect(legacy.record.timeAlg).toBe(2);   // 不改原对象
	// 关联命盘库的旧快照:那张盘的口径随记录,维持原样
	const linked = { ...legacy, record: { ...legacy.record, cid: 'c1' } };
	expect(normalizeLegacyBootSnapshot(linked)).toBe(linked);
	// 新快照原样(钉住的照样带三键)
	const pinnedNew = { ...legacy, pinned: true };
	expect(normalizeLegacyBootSnapshot(pinnedNew)).toBe(pinnedNew);
	// 读取端经它:落一份旧版快照,读出来已按不钉住
	enterDesktopShell();
	try{
		window.localStorage.setItem(KEY, JSON.stringify(legacy));
		const got = loadBootChartSnapshot();
		expect(got.pinned).toBe(false);
		expect(got.record.after23NewDay).toBeUndefined();
		expect(got.unpinnedTimeAlg).toBe(2);
	}finally{ leaveDesktopShell(); window.localStorage.removeItem(KEY); }
});

test('旧版快照关联命盘库:库里那条不带三键 = 当时没钉住 → 按不钉住还原;带三键 / 库里没有 → 维持原样', ()=>{
	const { normalizeLegacyBootSnapshot } = require('../bootChartRestore');
	const legacy = { at: Date.now(), record: { cid: 'c9', birth: '2026-07-21 08:30:00', after23NewDay: 1, lateZiHourUseNextDay: 1, timeAlg: 0 } };
	const n = normalizeLegacyBootSnapshot(legacy, ()=>({ cid: 'c9', name: '库里的', birth: '2026-07-21 08:30:00' }));
	expect([n.pinned, n.record.after23NewDay, n.unpinnedTimeAlg]).toEqual([false, undefined, 0]);
	// 出生时刻对不上(事盘叠在命盘之上,三键是事盘自己的口径)→ 维持原样
	expect(normalizeLegacyBootSnapshot(legacy, ()=>({ cid: 'c9', name: '库里的', birth: '1990-01-01 10:00:00' }))).toBe(legacy);
	expect(normalizeLegacyBootSnapshot(legacy, ()=>({ cid: 'c9', after23NewDay: 0 }))).toBe(legacy);
	expect(normalizeLegacyBootSnapshot(legacy, ()=>null)).toBe(legacy);
});
