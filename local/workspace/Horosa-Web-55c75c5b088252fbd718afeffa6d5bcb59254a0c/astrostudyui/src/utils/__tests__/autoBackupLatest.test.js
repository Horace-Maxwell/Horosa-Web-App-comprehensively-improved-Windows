// 存储被清空后「从最近的自动备份恢复」:取启动之前写的最近一份(之后心跳写的是清空后的残缺状态)
jest.mock('../aiAnalysisDesktop', ()=>({
	isDesktopBridgeAvailable: jest.fn(()=>true),
	invokeDesktopCommand: jest.fn(()=>Promise.resolve()),
}));
import { invokeDesktopCommand } from '../aiAnalysisDesktop';
import { readLatestAutoBackup, backupFileName, parseBackupFileName, isDegradedBackupName, retainBackupSet, gfsRetain, pruneBackups } from '../autoBackup';

test('只取 before 之前最近的一份;没有就回 null', async ()=>{
	const t0 = Date.parse('2026-10-19T08:00:00');
	const names = [backupFileName(t0 - 3600000), backupFileName(t0 - 600000), backupFileName(t0 + 600000)];
	invokeDesktopCommand.mockImplementation((cmd, args)=>{
		if(cmd === 'auto_backup_list_command'){ return Promise.resolve(names); }
		if(cmd === 'auto_backup_read_command'){ return Promise.resolve(Buffer.from(args.fileName).toString('base64')); }
		return Promise.resolve();
	});
	const r = await readLatestAutoBackup({ before: t0 });
	expect(r.name).toBe(names[1]);
	expect(Buffer.from(r.bytes).toString()).toBe(names[1]);
	expect(await readLatestAutoBackup({ before: t0 - 7200000 })).toBe(null);
});

// 来源不健康(AI 工作区读不开 / 记录库坏了从空库开始)之后照常写的心跳备份标 -degraded:
// 修剪永远另留最近一份健康的;「从最近的自动备份恢复」可指定先取健康的
describe('健康 / 降级备份', ()=>{
	const DAY = 24 * 3600 * 1000;
	const now = new Date(2026, 9, 23, 12, 0, 0).getTime();

	test('文件名往返:降级尾巴可解析、可识别;旧名照旧按健康算', ()=>{
		const t = new Date(2026, 9, 20, 8, 30, 15).getTime();
		const n = backupFileName(t, { degraded: true });
		expect(n).toBe('horosa-backup-20261020-083015-degraded.zip');
		expect(parseBackupFileName(n)).toBe(t);
		expect(isDegradedBackupName(n)).toBe(true);
		expect(isDegradedBackupName(backupFileName(t))).toBe(false);
		expect(parseBackupFileName('horosa-backup-20261020-083015-other.zip')).toBe(null);
	});

	test('🔴 修剪:同一天后来的降级包按 GFS 会顶掉出事前的健康包 —— 健康包照样留着', ()=>{
		const healthy = now - 5 * DAY - 6 * 3600 * 1000;   // 5 天前上午:出事前最后一份健康的
		const degradedSameDay = now - 5 * DAY;             // 同一天稍晚:出事之后
		const later = [now - 4 * DAY, now - 3 * DAY, now - 3600 * 1000].map((ts)=>({ ts, degraded: true }));
		const entries = [{ ts: healthy, degraded: false }, { ts: degradedSameDay, degraded: true }, ...later];
		expect(gfsRetain(entries.map((e)=>e.ts), now).has(healthy)).toBe(false);   // 单看 GFS:被同日后来的一份顶掉
		const keep = retainBackupSet(entries, now);
		expect(keep.has(healthy)).toBe(true);
		later.forEach((e)=>expect(keep.has(e.ts)).toBe(true));
		// 全是健康的:与 GFS 完全一样(只多留「最近一份健康的」,它本就在 48 小时内)
		const plain = [now - 1000, now - 5 * DAY, now - 5 * DAY - 3600 * 1000, now - 20 * DAY].map((ts)=>({ ts, degraded: false }));
		expect([...retainBackupSet(plain, now)].sort()).toEqual([...gfsRetain(plain.map((e)=>e.ts), now)].sort());
	});

	test('🔴 修剪落到壳层的删除名单里没有最近那份健康的', async ()=>{
		const names = [
			backupFileName(now - 5 * DAY - 8 * 3600 * 1000),                 // 同一天更早的健康包:GFS 照常淘汰
			backupFileName(now - 5 * DAY - 6 * 3600 * 1000),                 // 出事前最后一份健康的:必须留
			backupFileName(now - 5 * DAY, { degraded: true }),
			backupFileName(now - 3600 * 1000, { degraded: true }),
		];
		let deleted = null;
		invokeDesktopCommand.mockImplementation((cmd, args)=>{
			if(cmd === 'auto_backup_list_command'){ return Promise.resolve(names); }
			if(cmd === 'auto_backup_prune_command'){ deleted = args.deleteNames; return Promise.resolve(); }
			return Promise.resolve();
		});
		await pruneBackups(now);
		expect(deleted).toEqual([names[0]]);
	});

	test('🔴 从最近的自动备份恢复:preferHealthy 时跳过出事之后的降级包;没有健康的才退回最近一份', async ()=>{
		const names = [backupFileName(now - 3 * DAY), backupFileName(now - DAY, { degraded: true }), backupFileName(now - 3600 * 1000, { degraded: true })];
		invokeDesktopCommand.mockImplementation((cmd, args)=>{
			if(cmd === 'auto_backup_list_command'){ return Promise.resolve(names); }
			if(cmd === 'auto_backup_read_command'){ return Promise.resolve(Buffer.from(args.fileName).toString('base64')); }
			return Promise.resolve();
		});
		expect((await readLatestAutoBackup({ before: now, preferHealthy: true })).name).toBe(names[0]);
		expect((await readLatestAutoBackup({ before: now })).name).toBe(names[2]);
		expect((await readLatestAutoBackup({ before: now - 2 * DAY + 1, preferHealthy: true })).name).toBe(names[0]);
		expect((await readLatestAutoBackup({ before: now - 2 * 3600 * 1000, preferHealthy: true })).name).toBe(names[0]);
		const onlyDegraded = names.slice(1);
		invokeDesktopCommand.mockImplementation((cmd, args)=>{
			if(cmd === 'auto_backup_list_command'){ return Promise.resolve(onlyDegraded); }
			if(cmd === 'auto_backup_read_command'){ return Promise.resolve(Buffer.from(args.fileName).toString('base64')); }
			return Promise.resolve();
		});
		expect((await readLatestAutoBackup({ before: now, preferHealthy: true })).name).toBe(onlyDegraded[1]);
	});

	test('坏主存从空库开始的横幅:取发现坏了之前、来源健康的那份(源码合同)', ()=>{
		const fs = require('fs');
		const path = require('path');
		const src = fs.readFileSync(path.join(__dirname, '../../components/common/LocalStoreHealthBanner.js'), 'utf8');
		const block = src.slice(src.indexOf("id: 'corruptReset'"), src.indexOf("const unkeptCount"));
		expect(block).toMatch(/restoreFromLatestAutoBackup\(health\.corruptResetAt \|\| Date\.now\(\), \{ preferHealthy: true \}\)/);
		const store = fs.readFileSync(path.join(__dirname, '../localRecordStore.js'), 'utf8');
		expect(store).toMatch(/corrupt: \{[^}]*at: corruptAt/);
	});
});
