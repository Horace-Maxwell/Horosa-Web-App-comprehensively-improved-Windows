// [S8] 导入三闸纯函数金标:校验矩阵 + 预览↔真实导入恒等式。
// 此前导入零校验零确认:任何含 charts 数组的 JSON 直接灌库、同 cid 静默覆盖不可撤销;
// 交叉选错(事盘备份进命盘口)是静默 imported:0 —— 现在硬拒并给准确指路文案。
import { validateLocalChartsBackup, previewLocalChartsBackup, importLocalChartsBackup, upsertLocalChart, listLocalCharts, exportLocalChartsBackup } from '../localcharts';
import { validateLocalCasesBackup } from '../localcases';

describe('[S8] 闸① 校验矩阵', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	it('非对象/缺清单/交叉信封 → 硬拒且 reason 可判', ()=>{
		expect(validateLocalChartsBackup(null)).toMatchObject({ ok: false, reason: 'not-object' });
		expect(validateLocalChartsBackup('str')).toMatchObject({ ok: false, reason: 'not-object' });
		expect(validateLocalChartsBackup({ format: 'horosa-local-charts', version: 1 })).toMatchObject({ ok: false, reason: 'missing-list' });
		// 🔴 交叉:事盘备份选进命盘口(此前静默 imported:0,现在硬拒给指路文案的判据)
		const casesEnvelope = { format: 'horosa-local-cases', version: 1, cases: [{ cid: 'x' }] };
		expect(validateLocalChartsBackup(casesEnvelope)).toMatchObject({ ok: false, reason: 'format-mismatch', format: 'horosa-local-cases' });
		const chartsEnvelope = { format: 'horosa-local-charts', version: 1, charts: [{ cid: 'x' }] };
		expect(validateLocalCasesBackup(chartsEnvelope)).toMatchObject({ ok: false, reason: 'format-mismatch', format: 'horosa-local-charts' });
	});

	it('缺 format 容忍(手工老文件);version>1 软闸(ok+newer-version)', ()=>{
		expect(validateLocalChartsBackup({ charts: [{ cid: 'a' }] })).toMatchObject({ ok: true, reason: null, count: 1 });
		expect(validateLocalChartsBackup({ format: 'horosa-local-charts', version: 9, charts: [] })).toMatchObject({ ok: true, reason: 'newer-version', version: 9 });
	});
});

describe('[S8] 闸② 预览 ↔ 真实导入恒等式', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	it('🔴 adds/updates/invalid 与 upsert 合并语义逐条一致(含备份内重复 cid 的顺序语义)', ()=>{
		upsertLocalChart({ cid: 'local-exist-1', name: '既有', birth: '1990-01-01 08:00:00', zone: '+08:00', updateTime: '2026-08-01 10:00:00', preserveUpdateTime: true });
		const backup = {
			format: 'horosa-local-charts',
			version: 1,
			charts: [
				{ cid: 'local-exist-1', name: '既有改', updateTime: '2026-08-02 10:00:00' },          // 覆盖既有
				{ cid: 'local-new-1', name: '新甲', birth: '1991-01-01 08:00:00', zone: '+08:00', updateTime: '2026-08-03 10:00:00' },   // 新增
				{ cid: 'local-new-1', name: '新甲重复', updateTime: '2026-08-04 10:00:00' },          // 备份内重复 cid → 顺序语义=覆盖
				{ name: '无cid', birth: '1992-01-01 08:00:00', zone: '+08:00', updateTime: '2026-08-05 10:00:00' },  // 无 cid → upsert 必新建
				'not-an-object',                                                                       // 非法条目
			],
		};
		const preview = previewLocalChartsBackup(backup);
		expect(preview).toMatchObject({ ok: true, adds: 2, updates: 2, invalid: 1, total: 5 });
		const before = listLocalCharts().length;
		const result = importLocalChartsBackup(backup);
		// 恒等式:imported === adds+updates;导入后总数 === 导入前 + adds
		expect(result.imported).toBe(preview.adds + preview.updates);
		expect(result.failed).toBe(0);
		expect(listLocalCharts().length).toBe(before + preview.adds);
		expect(listLocalCharts().find((r)=>r.cid === 'local-new-1').name).toBe('新甲重复');
	});

	it('导入是合并不清库:既有非重叠记录全数保留(误导入兜底语义)', ()=>{
		upsertLocalChart({ cid: 'local-keep-1', name: '保留甲', birth: '1990-01-01 08:00:00', zone: '+08:00', updateTime: '2026-08-01 10:00:00', preserveUpdateTime: true });
		importLocalChartsBackup({ format: 'horosa-local-charts', version: 1, charts: [{ cid: 'local-in-1', name: '导入乙', updateTime: '2026-08-02 10:00:00' }] });
		const names = listLocalCharts().map((r)=>r.name);
		expect(names).toContain('保留甲');
		expect(names).toContain('导入乙');
	});

	it('往返闭环:export 信封直接过 validate+preview(零 adds 全 updates)', ()=>{
		upsertLocalChart({ cid: 'local-rt-1', name: '往返', birth: '1990-01-01 08:00:00', zone: '+08:00', updateTime: '2026-08-01 10:00:00', preserveUpdateTime: true });
		const envelope = exportLocalChartsBackup();
		expect(validateLocalChartsBackup(envelope).ok).toBe(true);
		expect(previewLocalChartsBackup(envelope)).toMatchObject({ adds: 0, updates: 1, invalid: 0 });
	});
});
