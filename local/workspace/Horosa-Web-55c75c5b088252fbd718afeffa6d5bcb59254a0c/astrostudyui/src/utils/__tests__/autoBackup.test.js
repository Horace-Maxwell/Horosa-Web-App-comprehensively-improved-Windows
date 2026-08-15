// [V5-B] 自动备份体系闸:sha256 金标/分段校验和/GFS 表驱动/文件名往返/版本协商/坏段隔离。
jest.mock('../aiAnalysisDesktop', ()=>({
	isDesktopBridgeAvailable: jest.fn(()=>false),
	invokeDesktopCommand: jest.fn(()=>Promise.resolve()),
}));
import { isDesktopBridgeAvailable } from '../aiAnalysisDesktop';
import { sha256Hex, buildManifestChecksums, verifyManifestChecksums } from '../backupChecksum';
import { gfsRetain, backupFileName, parseBackupFileName, runAutoBackupOnce } from '../autoBackup';
import {
	buildFullUnifiedManifest, validateUnifiedBackup, restoreUnifiedBackup, UNIFIED_BACKUP_FORMAT,
} from '../unifiedBackup';

const DAY = 24 * 3600 * 1000;

describe('[V5-B5] sha256 与分段校验和', ()=>{
	it('🔴 sha256 标准测试向量(FIPS 180-4 金标,实现错一位都过不了)', ()=>{
		expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
		expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
		expect(sha256Hex('中文校验')).toBe(sha256Hex('中文校验'));   // 幂等
		expect(sha256Hex('a')).not.toBe(sha256Hex('b'));
	});

	it('🔴 分段校验和往返:未动=全过;篡改某段=指认该段(而非整包拒收)', async ()=>{
		window.localStorage.clear();
		window.localStorage.setItem('horosa.liuyao.settings.v1', '{"a":1}');
		const m = await buildFullUnifiedManifest();
		expect(verifyManifestChecksums(m)).toMatchObject({ ok: true, badSections: [] });
		const tampered = JSON.parse(JSON.stringify(m));
		tampered.raw['horosa.liuyao.settings.v1'] = '{"a":2}';
		const v = verifyManifestChecksums(tampered);
		expect(v.ok).toBe(false);
		expect(v.badSections).toEqual(['raw.horosa.liuyao.settings.v1']);
		// 无 checksums 的老包宽容
		expect(verifyManifestChecksums({ raw: {} })).toMatchObject({ ok: true, legacy: true });
	});

	it('🔴 恢复坏段隔离:坏键跳过+如实上报,好键照常写入', async ()=>{
		window.localStorage.clear();
		window.localStorage.setItem('horosa.liuyao.settings.v1', '{"a":1}');
		window.localStorage.setItem('horosa.lingqi.settings.v1', '{"b":1}');
		const m = await buildFullUnifiedManifest();
		window.localStorage.clear();
		const tampered = JSON.parse(JSON.stringify(m));
		tampered.raw['horosa.liuyao.settings.v1'] = '{"a":666}';   // 传输途中被咬坏
		const results = await restoreUnifiedBackup(tampered);
		const badRow = results.find((r)=>r.key === 'raw.horosa.liuyao.settings.v1');
		expect(badRow.ok).toBe(false);
		expect(badRow.detail).toContain('校验和不符');
		expect(window.localStorage.getItem('horosa.liuyao.settings.v1')).toBe(null);      // 坏键拒写
		expect(window.localStorage.getItem('horosa.lingqi.settings.v1')).toBe('{"b":1}'); // 好键照常
	});
});

describe('[V5-B7] 版本协商', ()=>{
	it('🔴 minReaderVersion 高于本 app → 明确拒读指引升级,绝不静默丢段', ()=>{
		const v = validateUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 9, minReaderVersion: 9, charts: { charts: [] } });
		expect(v).toMatchObject({ ok: false, reason: 'reader-too-old' });
		const soft = validateUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 9, minReaderVersion: 1, charts: { charts: [] } });
		expect(soft).toMatchObject({ ok: true, reason: 'newer-version' });
	});
});

describe('[V5-B3] GFS 梯度保留(纯函数表驱动)', ()=>{
	const now = new Date(2026, 7, 14, 12, 0, 0).getTime();

	it('近 48 小时全保', ()=>{
		const ts = [now - 1000, now - 3600 * 1000, now - DAY, now - 1.9 * DAY];
		const keep = gfsRetain(ts, now);
		ts.forEach((t)=>expect(keep.has(t)).toBe(true));
	});

	it('🔴 2-14 天每天只保最新一份', ()=>{
		const dayBase = now - 5 * DAY;
		const a = dayBase - 1000;
		const b = dayBase - 3600 * 1000;   // 同一天更早
		const keep = gfsRetain([a, b], now);
		expect(keep.has(a)).toBe(true);    // 同桶第一个(排序后最新)保
		expect(keep.has(b)).toBe(false);
	});

	it('周/月梯度:8 周内每周一份、12 月内每月一份、更老全弃', ()=>{
		const w = now - 30 * DAY;          // 周桶
		const m = now - 100 * DAY;         // 月桶
		const old = now - 400 * DAY;       // 超 12 月
		const keep = gfsRetain([w, w - 3600 * 1000, m, m - 3600 * 1000, old], now);
		expect(keep.has(w)).toBe(true);
		expect(keep.has(w - 3600 * 1000)).toBe(false);
		expect(keep.has(m)).toBe(true);
		expect(keep.has(m - 3600 * 1000)).toBe(false);
		expect(keep.has(old)).toBe(false);
	});
});

describe('[V5-B1] 自动备份执行器', ()=>{
	it('文件名 ↔ 时间戳往返;非法名拒解析', ()=>{
		const at = new Date(2026, 7, 14, 9, 30, 5).getTime();
		const name = backupFileName(at);
		expect(name).toBe('horosa-backup-20260814-093005.zip');
		expect(parseBackupFileName(name)).toBe(at);
		expect(parseBackupFileName('evil-../../etc.zip')).toBe(null);
		expect(parseBackupFileName('horosa-backup-2026.zip')).toBe(null);
	});

	it('非桌面环境 no-op(不炸、不写)', async ()=>{
		isDesktopBridgeAvailable.mockReturnValue(false);
		const r = await runAutoBackupOnce({ trigger: 'timer' });
		expect(r.skipped).toBe(true);
	});
});
