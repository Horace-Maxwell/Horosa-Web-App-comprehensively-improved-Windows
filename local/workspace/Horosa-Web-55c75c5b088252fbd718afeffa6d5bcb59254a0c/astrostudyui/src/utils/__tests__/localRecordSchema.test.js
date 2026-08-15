// [S7] 记录级 schemaVersion 行为锁:盖章/宽容读/纯读不回写/lazy 升版/未来版重盖/迁移链恒等。
import { LOCAL_RECORD_SCHEMA_VERSION, applyRecordMigrations } from '../localRecordStore';
import { upsertLocalChart, listLocalCharts } from '../localcharts';
import { upsertLocalCase, listLocalCases } from '../localcases';

const CHARTS_KEY = 'horosa.localCharts.v1';

describe('[S7] 记录 schemaVersion', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	it('upsert 盖当前版(命盘/事盘同点覆盖)', ()=>{
		upsertLocalChart({ cid: 'local-sv-1', name: '版盖', birth: '1990-01-01 08:00:00', zone: '+08:00' });
		upsertLocalCase({ cid: 'local-case-sv-1', event: '版盖课', caseType: 'liuyao', divTime: '2026-01-01 10:00:00', zone: '+08:00' });
		expect(listLocalCharts()[0].schemaVersion).toBe(LOCAL_RECORD_SCHEMA_VERSION);
		expect(listLocalCases()[0].schemaVersion).toBe(LOCAL_RECORD_SCHEMA_VERSION);
	});

	it('🔴 旧记录(无版本字段=隐式 v1):宽容读、纯读不回写;下次 upsert 触碰才升版(lazy)', ()=>{
		const legacy = [{ cid: 'local-old-1', name: '旧档', birth: '1980-01-01 08:00:00', zone: '+08:00', updateTime: '2026-01-01 00:00:00' }];
		window.localStorage.setItem(CHARTS_KEY, JSON.stringify(legacy));
		const before = window.localStorage.getItem(CHARTS_KEY);
		const rec = listLocalCharts()[0];
		expect(rec.schemaVersion).toBeUndefined();
		// 纯读不回写:原串零变(零写放大)
		expect(window.localStorage.getItem(CHARTS_KEY)).toBe(before);
		// lazy 升版:被 upsert 触碰即盖当前版,其余字段保留(合并语义)
		upsertLocalChart({ cid: 'local-old-1', name: '旧档改' });
		const after = listLocalCharts()[0];
		expect(after.schemaVersion).toBe(LOCAL_RECORD_SCHEMA_VERSION);
		expect(after.birth).toBe('1980-01-01 08:00:00');
	});

	it('未来版本记录:读端原样保留不丢弃;被 upsert 重写则重盖当前版(已按当前版语义重写)', ()=>{
		const future = [{ cid: 'local-fut-1', name: '未来档', birth: '1990-01-01 08:00:00', zone: '+08:00', updateTime: '2026-01-01 00:00:00', schemaVersion: 99, futureField: 'keep' }];
		window.localStorage.setItem(CHARTS_KEY, JSON.stringify(future));
		const rec = listLocalCharts()[0];
		expect(rec.schemaVersion).toBe(99);
		expect(rec.futureField).toBe('keep');
		upsertLocalChart({ cid: 'local-fut-1', name: '未来档改' });
		const after = listLocalCharts()[0];
		expect(after.schemaVersion).toBe(LOCAL_RECORD_SCHEMA_VERSION);
		// upsert 合并位保留未知字段({...旧,...next}——next 不含 futureField 则旧值存续)
		expect(after.futureField).toBe('keep');
	});

	it('迁移链空=恒等快路径(返回同一数组引用,零分配)', ()=>{
		const ary = [{ cid: 'x' }];
		expect(applyRecordMigrations(ary)).toBe(ary);
	});
});
