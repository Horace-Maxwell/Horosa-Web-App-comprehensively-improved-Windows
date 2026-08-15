// [V5-D11/D12] 版本历史 + 档案库体检 闸。
import { upsertLocalChart, listLocalCharts } from '../localcharts';
import { pushRecordRevision, listRecordRevisions, __resetRevisionsForTests } from '../recordRevisions';
import { runArchiveHealthCheck } from '../archiveHealthCheck';

describe('[V5-D11] 记录版本历史', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
		__resetRevisionsForTests();
	});

	it('🔴 更新保存自动留旧版;恢复=按快照生成副本,现档不动', async ()=>{
		upsertLocalChart({ cid: 'local-rv-1', name: '原版', birth: '1990-01-01 08:00:00', zone: '+08:00', memo: '第一版备注' });
		upsertLocalChart({ cid: 'local-rv-1', name: '改后', memo: '第二版备注' });
		const revs = await listRecordRevisions('chart', 'local-rv-1');
		expect(revs.length).toBe(1);
		expect(revs[0].record.name).toBe('原版');
		expect(revs[0].record.memo).toBe('第一版备注');
		// 恢复为副本:旧快照去 cid 后 upsert
		const snap = { ...revs[0].record };
		delete snap.cid;
		delete snap.schemaVersion;
		snap.name = `${snap.name}(历史版)`;
		upsertLocalChart(snap);
		const names = listLocalCharts().map((r)=>r.name).sort();
		expect(names).toEqual(['原版(历史版)', '改后']);
	});

	it('等值覆盖(导入恢复场景)不刷版本;每 cid 上限 10 版', async ()=>{
		upsertLocalChart({ cid: 'local-rv-2', name: '甲', birth: '1991-01-01 08:00:00', zone: '+08:00', updateTime: '2026-08-01 10:00:00', preserveUpdateTime: true });
		const same = { ...listLocalCharts()[0], preserveUpdateTime: true };
		upsertLocalChart(same);   // 等值覆盖
		expect((await listRecordRevisions('chart', 'local-rv-2')).length).toBe(0);
		for(let i = 0; i < 15; i++){
			// 直接推快照验上限(绕开 5 分钟去抖)
			// eslint-disable-next-line no-await-in-loop
			await pushRecordRevision('chart', { cid: 'local-rv-3', name: `v${i}`, at: i });
		}
		const capped = await listRecordRevisions('chart', 'local-rv-3');
		expect(capped.length).toBeLessThanOrEqual(10);
	});
});

describe('[V5-D12] 档案库体检', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	it('健康库全绿;坏 payload 被点名', ()=>{
		upsertLocalChart({ cid: 'local-hc-1', name: '健康', birth: '1990-01-01 08:00:00', zone: '+08:00' });
		let rows = runArchiveHealthCheck();
		expect(rows.find((r)=>r.name === '记录完整性').ok).toBe(true);
		expect(rows.find((r)=>r.name === '回收站一致性').ok).toBe(true);
		// 人为咬坏 payload(绕过内核直改储存)
		const raw = JSON.parse(window.localStorage.getItem('horosa.localCharts.v1'));
		raw[0].payload = '{broken json';
		window.localStorage.setItem('horosa.localCharts.v1', JSON.stringify(raw));
		rows = runArchiveHealthCheck();
		const rec = rows.find((r)=>r.name === '记录完整性');
		expect(rec.ok).toBe(false);
		expect(rec.detail).toContain('无法解析');
	});
});
