// [V5-D 小批] 记录生命周期扩展闸:归档三态/星标/使用足迹/删除日志找回/导入去重第四闸。
import {
	upsertLocalChart, listLocalCharts, flagLocalChart, touchLocalChart,
	removeLocalChart, purgeLocalChartTrashItem, importLocalChartsBackup, exportLocalChartsBackup,
} from '../localcharts';
import { safeLocalStorageGet } from '../safeStorage';

function seed(cid, name, birth){
	upsertLocalChart({ cid, name, birth, zone: '+08:00', updateTime: '2026-08-01 10:00:00', preserveUpdateTime: true });
}

describe('[V5-D1/D2] 归档与星标', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	it('🔴 归档三态:默认列表不含已归档;archivedOnly 只看归档;includeArchived 全含;取消归档回默认列表', ()=>{
		seed('local-ar-1', '甲', '1990-01-01 08:00:00');
		seed('local-ar-2', '乙', '1991-01-01 08:00:00');
		flagLocalChart('local-ar-1', 'archived', true);
		expect(listLocalCharts().map((r)=>r.cid)).toEqual(['local-ar-2']);
		expect(listLocalCharts({ archivedOnly: true }).map((r)=>r.cid)).toEqual(['local-ar-1']);
		expect(listLocalCharts({ includeArchived: true }).length).toBe(2);
		flagLocalChart('local-ar-1', 'archived', false);
		expect(listLocalCharts().length).toBe(2);
		expect('archived' in listLocalCharts().find((r)=>r.cid === 'local-ar-1')).toBe(false);   // false=删键零体积
	});

	it('星标筛选维度 + 归档/星标经导出导入保真(未知键保全链)', ()=>{
		seed('local-st-1', '丙', '1992-01-01 08:00:00');
		seed('local-st-2', '丁', '1993-01-01 08:00:00');
		flagLocalChart('local-st-1', 'starred', true);
		flagLocalChart('local-st-2', 'archived', true);
		expect(listLocalCharts({ starredOnly: true }).map((r)=>r.cid)).toEqual(['local-st-1']);
		const backup = exportLocalChartsBackup();
		window.localStorage.clear();
		importLocalChartsBackup(backup);
		expect(listLocalCharts({ starredOnly: true })[0].starred).toBe(true);
		expect(listLocalCharts({ archivedOnly: true })[0].archived).toBe(true);
	});

	it('🔴 归档/星标/足迹都不刷新 updateTime(不扰排序数轴)', ()=>{
		seed('local-tm-1', '戊', '1994-01-01 08:00:00');
		flagLocalChart('local-tm-1', 'starred', true);
		touchLocalChart('local-tm-1');
		const rec = listLocalCharts()[0];
		expect(rec.updateTime).toBe('2026-08-01 10:00:00');
		expect(rec.openCount).toBe(1);
		expect(typeof rec.lastOpenedAt).toBe('string');
		touchLocalChart('local-tm-1');
		expect(listLocalCharts()[0].openCount).toBe(2);
	});
});

describe('[V5-D5] 删除日志(永久删除最后防线)', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	it('🔴 彻底删除进日志;按日志记录 upsert 即找回(字段保真)', ()=>{
		seed('local-dl-1', '己', '1995-01-01 08:00:00');
		upsertLocalChart({ cid: 'local-dl-1', memo: '要找回的备注', future_dl_key: 'v99' });
		removeLocalChart('local-dl-1');
		purgeLocalChartTrashItem('local-dl-1');
		const log = JSON.parse(safeLocalStorageGet('horosa.deleted.log.v1'));
		expect(log.length).toBe(1);
		expect(log[0].store).toBe('chart');
		expect(log[0].record.cid).toBe('local-dl-1');
		expect(log[0].record.memo).toBe('要找回的备注');
		expect(log[0].record.future_dl_key).toBe('v99');
		// 找回=按日志 upsert 回灌
		upsertLocalChart({ ...log[0].record });
		const back = listLocalCharts().find((r)=>r.cid === 'local-dl-1');
		expect(back.memo).toBe('要找回的备注');
		expect(back.future_dl_key).toBe('v99');
	});
});

describe('[V5-D6] 导入去重第四闸', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	it('🔴 同名同生辰(分钟级)不同 cid:默认跳过并如实计数;同 cid 照旧合并覆盖', ()=>{
		seed('local-dup-a', '庚', '1996-06-06 12:30:00');
		const r = importLocalChartsBackup({
			format: 'horosa-local-charts',
			version: 1,
			charts: [
				{ cid: 'local-dup-other', name: '庚', birth: '1996-06-06 12:30:59', updateTime: '2026-08-02 10:00:00' },   // 同分钟=精确重
				{ cid: 'local-dup-a', name: '庚(改)', birth: '1996-06-06 12:30:00', updateTime: '2026-08-02 10:00:00' },   // 同 cid=合并
				{ cid: 'local-dup-new', name: '辛', birth: '1997-01-01 08:00:00', updateTime: '2026-08-02 10:00:00' },
			],
		});
		expect(r.dupSkipped).toBe(1);
		expect(r.imported).toBe(2);
		const names = listLocalCharts().map((x)=>x.name).sort();
		expect(names).toEqual(['庚(改)', '辛']);
	});
});
