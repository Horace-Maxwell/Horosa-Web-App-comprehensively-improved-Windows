// 全量备份包的形状与完整性 + 延迟写与导出 / 恢复的先后:
//   ① raw 值必须是字符串;注册表标 format:'json' 的键要解析得出 —— 否则按「格式不对」跳过,本机不动
//      (此前对象 / 数字 / null 整值写成 "[object Object]" / "42" / "null":全局设置等于被清成缺省、紫微四化表被换成 42);
//   ② 有 checksums 的包:raw 里多出没有校验和的键、整段的校验和被删掉,都算「校验和不符」(此前只核列了的);
//   ③ 刚改完(还在延迟落盘队列里)立刻导出:包里是新值;恢复写某键前丢掉它的待落盘写,之后刷盘不会把旧值写回。
jest.mock('../ziweiCustomTablesPersist', ()=>({
	mirrorZiweiCustomTable: jest.fn(()=>Promise.resolve(null)),
	restoreZiweiCustomTablesOnce: jest.fn(()=>Promise.resolve([])),
}));
import {
	buildUnifiedBackupManifest, validateUnifiedBackup, previewUnifiedRestore, restoreUnifiedBackup, rawValueShapeOk, UNIFIED_BACKUP_FORMAT,
} from '../unifiedBackup';
import { buildManifestChecksums, verifyManifestChecksums } from '../backupChecksum';
import { scheduleStorageWrite, flushStorageWrites, hasPendingStorageWrite, dropPendingStorageWrite } from '../deferredStorage';

const FMT = UNIFIED_BACKUP_FORMAT;
const row = (rows, k)=>rows.find((r)=>r.key === k);

beforeEach(()=>{
	window.localStorage.clear();
	flushStorageWrites();
});

describe('① raw 值形状', ()=>{
	it('🔴 对象 / null / 数字 / 坏 JSON:预览写「格式不对」、恢复跳过且本机原值不动;合法的照写', async ()=>{
		window.localStorage.setItem('globalSetup', JSON.stringify({ appearanceMode: 'light' }));
		window.localStorage.setItem('ziweiSihuaCustom', JSON.stringify({ a: 1 }));
		window.localStorage.setItem('horosa.ui.script', 'hant');
		window.localStorage.setItem('horosa.liuyao.settings.v1', '{"a":1}');
		const m = { format: FMT, version: 2, raw: {
			globalSetup: { appearanceMode: 'dark' },
			'horosa.ui.script': null,
			ziweiSihuaCustom: 42,
			'horosa.dunjia.settings.v1': '{not json',
			'horosa.ui.lightFlavor': 'classic',
		} };
		expect(validateUnifiedBackup(m).ok).toBe(true);
		const rows = previewUnifiedRestore(m);
		['globalSetup', 'horosa.ui.script', 'ziweiSihuaCustom', 'horosa.dunjia.settings.v1'].forEach((k)=>expect(row(rows, k).detail).toContain('格式不对'));
		expect(row(rows, 'horosa.ui.lightFlavor').detail).toBe('本机无此数据，直接写入');
		const res = await restoreUnifiedBackup(m);
		['globalSetup', 'horosa.ui.script', 'ziweiSihuaCustom', 'horosa.dunjia.settings.v1'].forEach((k)=>{
			expect(row(res, k)).toMatchObject({ ok: false });
			expect(row(res, k).detail).toContain('格式不对');
		});
		expect(window.localStorage.getItem('globalSetup')).toBe(JSON.stringify({ appearanceMode: 'light' }));
		expect(window.localStorage.getItem('ziweiSihuaCustom')).toBe(JSON.stringify({ a: 1 }));
		expect(window.localStorage.getItem('horosa.ui.script')).toBe('hant');
		expect(window.localStorage.getItem('horosa.dunjia.settings.v1')).toBe(null);
		expect(window.localStorage.getItem('horosa.ui.lightFlavor')).toBe('classic');
		expect(row(res, 'horosa.ui.lightFlavor')).toMatchObject({ ok: true });
	});

	it('判据:只认字符串;JSON 形态的键要解析得出;普通文本键不要求 JSON', ()=>{
		expect(rawValueShapeOk('globalSetup', '{"a":1}')).toBe(true);
		expect(rawValueShapeOk('globalSetup', '{a:1}')).toBe(false);
		expect(rawValueShapeOk('globalSetup', { a: 1 })).toBe(false);
		expect(rawValueShapeOk('horosa.ui.script', 'hant')).toBe(true);
		expect(rawValueShapeOk('horosa.ui.script', 1)).toBe(false);
		expect(rawValueShapeOk('future.unregistered.key', 'x')).toBe(true);
	});
});

describe('② 校验和缺条目 = 不符', ()=>{
	it('🔴 有 checksums 的包:raw 里事后追加的键算坏、跳过', async ()=>{
		const base = { format: FMT, version: 2, raw: { 'horosa.tz.cnUnified': '1' } };
		base.checksums = buildManifestChecksums(base);
		base.raw['horosa.ui.lightFlavor'] = 'classic';
		const v = validateUnifiedBackup(base);
		expect(v).toMatchObject({ ok: true, reason: 'checksum-bad' });
		expect(v.badSections).toEqual(['raw.horosa.ui.lightFlavor']);
		await restoreUnifiedBackup(base);
		expect(window.localStorage.getItem('horosa.ui.lightFlavor')).toBe(null);
		expect(window.localStorage.getItem('horosa.tz.cnUnified')).toBe('1');
	});

	it('🔴 整段的校验和被删掉再改内容:算坏', ()=>{
		const env = { format: 'horosa-local-charts', version: 1, charts: [{ cid: 'c1', name: 'A', birth: '2000-01-01 00:00:00' }] };
		const m = { format: FMT, version: 2, charts: env, raw: {} };
		m.checksums = buildManifestChecksums(m);
		delete m.checksums.charts;
		m.charts.charts[0].name = '被改过';
		expect(verifyManifestChecksums(m).badSections).toEqual(['charts']);
	});

	it('正常导出的包原样通过;没有 checksums 的老包照旧宽容', ()=>{
		window.localStorage.setItem('horosa.liuyao.settings.v1', '{"a":1}');
		const m = buildUnifiedBackupManifest();
		m.checksums = buildManifestChecksums(m);
		expect(verifyManifestChecksums(m)).toMatchObject({ ok: true, badSections: [] });
		expect(verifyManifestChecksums({ raw: { a: '1' } })).toMatchObject({ ok: true, legacy: true });
	});
});

describe('③ 延迟写与导出 / 恢复', ()=>{
	it('🔴 刚改完(还在延迟落盘队列)立刻导出:包里是新值', ()=>{
		window.localStorage.setItem('horosa.lingqi.settings.v1', '{"v":"old"}');
		scheduleStorageWrite('horosa.lingqi.settings.v1', ()=>'{"v":"new"}');
		expect(hasPendingStorageWrite('horosa.lingqi.settings.v1')).toBe(true);
		const m = buildUnifiedBackupManifest();
		expect(m.raw['horosa.lingqi.settings.v1']).toBe('{"v":"new"}');
	});

	it('🔴 恢复写这把键前丢掉它的待落盘写:之后刷盘(关窗 / 空闲)不把恢复前的内存态写回', async ()=>{
		scheduleStorageWrite('horosa.lingqi.settings.v1', ()=>'{"v":"stale-memory"}');
		await restoreUnifiedBackup({ format: FMT, version: 2, raw: { 'horosa.lingqi.settings.v1': '{"v":"restored"}' } });
		expect(hasPendingStorageWrite('horosa.lingqi.settings.v1')).toBe(false);
		flushStorageWrites();
		expect(window.localStorage.getItem('horosa.lingqi.settings.v1')).toBe('{"v":"restored"}');
	});

	it('复位到默认的键(设置面完整的包里没有)同样丢掉待落盘写', async ()=>{
		window.localStorage.setItem('horosa.lingqi.settings.v1', '{"v":"local"}');
		scheduleStorageWrite('horosa.lingqi.settings.v1', ()=>'{"v":"stale-memory"}');
		await restoreUnifiedBackup({ format: FMT, version: 2, settingsComplete: true, raw: { 'horosa.tz.cnUnified': '1' } });
		flushStorageWrites();
		expect(window.localStorage.getItem('horosa.lingqi.settings.v1')).toBe(null);
	});

	it('丢弃时回调调用方(撤掉它另记的待落盘态);没有待落盘的键丢弃是空操作', ()=>{
		const onDrop = jest.fn();
		scheduleStorageWrite('horosa.lingqi.settings.v1', ()=>'x', undefined, { onDrop });
		expect(dropPendingStorageWrite('horosa.lingqi.settings.v1')).toBe(true);
		expect(onDrop).toHaveBeenCalledTimes(1);
		expect(dropPendingStorageWrite('horosa.lingqi.settings.v1')).toBe(false);
		expect(onDrop).toHaveBeenCalledTimes(1);
	});
});
