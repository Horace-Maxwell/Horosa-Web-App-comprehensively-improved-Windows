// 「来源出过事」持久标记:重启后(健康态归零)之后写的包照样标 -degraded;修剪另留出事之前最近一份健康包;
// 成功恢复出事的那几部分 / 点「已处理」才清;「从最近的自动备份恢复」每个入口都取健康的。
jest.mock('../aiAnalysisDesktop', ()=>({
	isDesktopBridgeAvailable: jest.fn(()=>true),
	invokeDesktopCommand: jest.fn(()=>Promise.resolve()),
}));
jest.mock('../ziweiCustomTablesPersist', ()=>({
	mirrorZiweiCustomTable: jest.fn(()=>Promise.resolve(null)),
	restoreZiweiCustomTablesOnce: jest.fn(()=>Promise.resolve([])),
}));
import fs from 'fs';
import path from 'path';
import { readBackupIncident, recordBackupIncident, clearBackupIncident, settleBackupIncidentAfterRestore, observeBackupHealth, incidentNeedsAcknowledge, __setIncidentRunIdForTests, BACKUP_INCIDENT_KEY } from '../backupIncident';
import { retainBackupSet, backupFileName, pruneBackups, pickAutoBackupCandidate, PREFER_HEALTHY_WINDOW_MS } from '../autoBackup';
import { invokeDesktopCommand } from '../aiAnalysisDesktop';

const SRC = path.resolve(__dirname, '../..');
const DAY = 24 * 3600 * 1000;

beforeEach(()=>{ window.localStorage.clear(); });

// 一次「运行」= 一套新的模块实例(jest.resetModules:进程内状态全新,存储照旧);corruptMain 时先把命盘主存写坏、读一次
function freshRun(corruptMain){
	jest.resetModules();
	// eslint-disable-next-line global-require
	const lc = require('../localcharts');
	if(corruptMain){
		window.localStorage.setItem('horosa.localCharts.v1', '{broken');
		lc.listLocalCharts();
	}
	const health = lc.getLocalChartsStoreHealth();
	// eslint-disable-next-line global-require
	const out = require('../unifiedBackup').backupDegradedSections({});
	return { out, health };
}

describe('标记跨重启', ()=>{
	it('🔴 主存坏了那次运行标出并记下;重启后(健康态归零)写的包仍标 -degraded', ()=>{
		const r1 = freshRun(true);
		expect(r1.health.corrupt).toBeTruthy();
		expect(r1.out).toEqual(['charts']);
		const inc = readBackupIncident();
		expect(inc.sections).toEqual(['charts']);
		expect(inc.at).toBe(Number(r1.health.corrupt.at));
		// 「重启」:新的模块实例,主存已是一份完好的(从空库开始 / 影子写回),健康态正常 —— 标记仍在,照样标出
		window.localStorage.setItem('horosa.localCharts.v1', '[]');
		const r2 = freshRun(false);
		expect(r2.health.corrupt).toBeFalsy();
		expect(r2.out).toEqual(['charts']);
	});
	it('清掉标记后照常算健康;段取并集、时刻取较早的', ()=>{
		recordBackupIncident(['aiWorkspace'], 2000);
		recordBackupIncident(['charts'], 1000);
		expect(readBackupIncident()).toMatchObject({ at: 1000, sections: ['aiWorkspace', 'charts'], kinds: { aiWorkspace: 'unavailable', charts: 'corrupt' } });
		clearBackupIncident();
		expect(window.localStorage.getItem(BACKUP_INCIDENT_KEY)).toBe(null);
		expect(freshRun(false).out).toEqual([]);
	});
	it('坏档 / 未知段不当标记', ()=>{
		window.localStorage.setItem(BACKUP_INCIDENT_KEY, '{bad');
		expect(readBackupIncident()).toBe(null);
		window.localStorage.setItem(BACKUP_INCIDENT_KEY, JSON.stringify({ at: 5, sections: ['x'] }));
		expect(readBackupIncident()).toBe(null);
	});
});

describe('🔴 问题消失即自动清那一段(按出事类型)', ()=>{
	afterEach(()=>{ __setIncidentRunIdForTests(''); });
	it('例 A:AI 工作区读不开 → 之后组装备份时库读得开 → 不再含 aiWorkspace', ()=>{
		jest.resetModules();
		// eslint-disable-next-line global-require
		const ub = require('../unifiedBackup');
		expect(ub.backupDegradedSections({ aiWorkspaceUnavailable: { reason: 'version' } }, { aiObserved: true })).toEqual(['aiWorkspace']);
		expect(readBackupIncident().kinds.aiWorkspace).toBe('unavailable');
		// 没试开 AI 库的观察不算数
		expect(ub.backupDegradedSections({}, {})).toEqual(['aiWorkspace']);
		expect(ub.backupDegradedSections({}, { aiObserved: true })).toEqual([]);
		expect(readBackupIncident()).toBe(null);
	});
	it('例 B:存储只在内存的那次运行 → 重启后存储正常 → 清;同一次运行里看到健康不清', ()=>{
		__setIncidentRunIdForTests('run-1');
		observeBackupHealth({ charts: 'memory' });
		observeBackupHealth({ charts: 'ok' });
		expect(readBackupIncident().sections).toEqual(['charts']);
		__setIncidentRunIdForTests('run-2');
		observeBackupHealth({ charts: 'ok' });
		expect(readBackupIncident()).toBe(null);
	});
	it('例 C:主存坏了只在内存等对账 → 同一次运行里影子写回(健康态正常)→ 不含 charts', ()=>{
		__setIncidentRunIdForTests('run-c');
		observeBackupHealth({ charts: 'corrupt' }, 1000);
		expect(readBackupIncident().kinds.charts).toBe('corrupt');
		observeBackupHealth({ charts: 'ok', cases: 'ok' });
		expect(readBackupIncident()).toBe(null);
	});
	it('判别力:从空库开始过(reset)不自动清;旧版标记(没有类型)按 reset 处理;同一段取更严重的类型', ()=>{
		observeBackupHealth({ charts: 'corrupt' }, 1000);
		observeBackupHealth({ charts: 'reset' });
		observeBackupHealth({ charts: 'ok' });
		expect(readBackupIncident()).toMatchObject({ sections: ['charts'], kinds: { charts: 'reset' } });
		expect(incidentNeedsAcknowledge(readBackupIncident())).toBe(true);
		window.localStorage.setItem(BACKUP_INCIDENT_KEY, JSON.stringify({ at: 5, sections: ['cases'] }));
		expect(readBackupIncident().kinds.cases).toBe('legacy');
		observeBackupHealth({ cases: 'ok' });
		expect(readBackupIncident().sections).toEqual(['cases']);
	});
	it('换了一次运行才看到正常(分不清影子写回还是从空库开始落了盘):照样标出;同一次运行里影子写回的,重启后不标', ()=>{
		const r1 = freshRun(true);
		expect(readBackupIncident().kinds.charts).toBe('corrupt');
		window.localStorage.setItem('horosa.localCharts.v1', '[]');
		expect(freshRun(false).out).toEqual(['charts']);
		clearBackupIncident();
		__setIncidentRunIdForTests('run-x');
		observeBackupHealth({ charts: 'corrupt' }, Number(r1.health.corrupt.at));
		observeBackupHealth({ charts: 'ok' });
		expect(freshRun(false).out).toEqual([]);
	});
});

describe('🔴 「从最近的自动备份恢复」的健康包优先有时间窗', ()=>{
	const DAYMS = 24 * 3600 * 1000;
	it('最近的降级包比最近一份健康包新得不多 → 取健康包;降级包已经连着写了很久 → 取最近一份', ()=>{
		const t0 = 1e12;
		const near = [{ at: t0 + 2 * DAYMS, degraded: true }, { at: t0 + DAYMS, degraded: true }, { at: t0, degraded: false }];
		expect(pickAutoBackupCandidate(near, { preferHealthy: true }).at).toBe(t0);
		const far = [{ at: t0 + 30 * DAYMS, degraded: true }, { at: t0 + 29 * DAYMS, degraded: true }, { at: t0, degraded: false }];
		expect(pickAutoBackupCandidate(far, { preferHealthy: true }).at).toBe(t0 + 30 * DAYMS);
		expect(pickAutoBackupCandidate(far, {}).at).toBe(t0 + 30 * DAYMS);
		expect(pickAutoBackupCandidate([{ at: t0, degraded: true }], { preferHealthy: true }).at).toBe(t0);
		expect(PREFER_HEALTHY_WINDOW_MS).toBe(7 * DAYMS);
	});
	it('读最近一份走同一个挑选函数', ()=>{
		expect(fs.readFileSync(path.join(SRC, 'utils/autoBackup.js'), 'utf8')).toMatch(/const pick = pickAutoBackupCandidate\(candidates, opts\);/);
	});
});

describe('修剪:出事之前最近一份健康包留着', ()=>{
	it('🔴 出事后(重启后没标出的)「健康」包很多,出事前那份照样留', ()=>{
		const now = new Date(2026, 9, 23, 12, 0, 0).getTime();
		const incidentAt = now - 5 * DAY;
		const before = incidentAt - 3 * 3600 * 1000;   // 出事当天早些时候的好包
		const entries = [{ ts: before, degraded: false }];
		for(let i = 0; i < 5 * 24; i += 1){ entries.push({ ts: incidentAt + i * 3600 * 1000 + 60000, degraded: false }); }
		expect(retainBackupSet(entries, now).has(before)).toBe(false);   // 没有标记:按天被顶掉
		expect(retainBackupSet(entries, now, { incidentAt }).has(before)).toBe(true);
	});
	it('pruneBackups 带上标记时刻:删除名单不含出事前那份', async ()=>{
		const now = new Date(2026, 9, 23, 12, 0, 0).getTime();
		const incidentAt = now - 5 * DAY;
		const beforeName = backupFileName(incidentAt - 3 * 3600 * 1000);
		const names = [beforeName];
		for(let i = 0; i < 24; i += 1){ names.push(backupFileName(incidentAt + i * 1800 * 1000 + 60000)); }
		recordBackupIncident(['charts'], incidentAt);
		let deleted = null;
		invokeDesktopCommand.mockImplementation((cmd, args)=>{
			if(cmd === 'auto_backup_list_command'){ return Promise.resolve(names); }
			if(cmd === 'auto_backup_prune_command'){ deleted = args.deleteNames; }
			return Promise.resolve();
		});
		await pruneBackups(now);
		expect(Array.isArray(deleted)).toBe(true);
		expect(deleted).not.toContain(beforeName);
	});
});

describe('清掉的时机', ()=>{
	it('出事的那几部分都成功写回磁盘才清;只进了内存 / 缺这一段 / 失败都不清', ()=>{
		recordBackupIncident(['charts', 'aiWorkspace'], 1000);
		expect(settleBackupIncidentAfterRestore([{ key: 'charts', ok: true }])).toBe(false);
		expect(settleBackupIncidentAfterRestore([{ key: 'charts', ok: false, sessionOnly: true }, { key: 'aiWorkspace', ok: true }])).toBe(false);
		expect(readBackupIncident()).not.toBe(null);
		expect(settleBackupIncidentAfterRestore([{ key: 'charts', ok: true }, { key: 'aiWorkspace', ok: true }])).toBe(true);
		expect(readBackupIncident()).toBe(null);
	});
});

describe('源码合同 / 提示', ()=>{
	const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');
	it('🔴 「从最近的自动备份恢复」每个调用点都带 preferHealthy', ()=>{
		const s = read('components/common/LocalStoreHealthBanner.js');
		const calls = s.split('\n').filter((l)=>/restoreFromLatestAutoBackup\(/.test(l) && !/export async function restoreFromLatestAutoBackup/.test(l));
		expect(calls.length).toBeGreaterThanOrEqual(3);
		calls.forEach((c)=>expect(c).toMatch(/restoreFromLatestAutoBackup\([^;]*preferHealthy:\s*true/));
	});
	it('恢复写完结清标记;修剪读标记;横幅记标记并给「已处理」', ()=>{
		expect(read('utils/unifiedBackup.js')).toMatch(/settleBackupIncidentAfterRestore\(results\)/);
		expect(read('utils/autoBackup.js')).toMatch(/retainBackupSet\(withTs, now \|\| Date\.now\(\), \{ incidentAt:/);
		const banner = read('components/common/LocalStoreHealthBanner.js');
		expect(banner).toMatch(/observeBackupHealth\(h\.observed/);
		expect(banner).toMatch(/label: '已处理'/);
		expect(read('components/common/StorageHealthModal.js')).toMatch(/clearBackupIncident\(\)/);
	});
	it('持久提示写明出事的部分', ()=>{
		const { incidentNoticeText } = require('../../components/common/LocalStoreHealthBanner');
		const t = incidentNoticeText({ at: Date.parse('2026-10-20T09:00:00'), sections: ['charts', 'aiWorkspace'] });
		expect(t).toContain('命盘库、AI 分析工作区');
		expect(t).toContain('出事之前');
		expect(incidentNoticeText({ at: 1, sections: ['charts'], kinds: { charts: 'reset' } })).toContain('当时从空库开始');
		expect(incidentNoticeText({ at: 1, sections: ['aiWorkspace'], kinds: { aiWorkspace: 'unavailable' } })).toContain('问题消失后会自动清掉');
	});
});
