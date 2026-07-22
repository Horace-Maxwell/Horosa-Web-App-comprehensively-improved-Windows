// horosa_boot_chart_restore_v1 金标(PERF-R10 S2):
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

beforeEach(()=>{
	window.localStorage.clear();
	window.localStorage.removeItem('horosa.perf.bootChartRestore');
	window.__HOROSA_DESKTOP_CONFIG__ = { desktop: true };
});

afterEach(()=>{
	delete window.__HOROSA_DESKTOP_CONFIG__;
});

test('往返:birth/ad/zone 精确;manifest 在场键全随行;memo×8 恒有键', ()=>{
	const snap = buildBootChartRecord(mkFields(), 'ziwei');
	expect(snap.currentTab).toBe('ziwei');
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
	delete window.__HOROSA_DESKTOP_CONFIG__;
	expect(loadBootChartSnapshot()).toBeNull();          // 非桌面壳
	window.__HOROSA_DESKTOP_CONFIG__ = { desktop: true };
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
