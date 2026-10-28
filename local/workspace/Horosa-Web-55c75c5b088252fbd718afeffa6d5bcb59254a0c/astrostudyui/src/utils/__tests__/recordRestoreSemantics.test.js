// 恢复 / 导入的几条口径(全量恢复与单库导入共用的内核):
//  ① AI 助手权限类开关:每项取本机与备份里较严的一档 —— 换新机 / 存储被清后从备份找回时不停在最宽的缺省,本机收紧过的也不被放宽
//  ② 「同一 ID 一律用备份里的」:回退到某份备份可行(缺省仍是较新者整条胜出)
//  ③ 较新的整条替换时,本机的置顶 / 星标 / 归档 / 排序 / 使用足迹留着
//  ④ 被导入 / 恢复整条替换前的本机版本一律留历史(5 分钟内亲手改的那版也留得住)
//  ⑤ 名人库补丁与普通备份条目混在一份文件里:只有补丁按字段合并
//  ⑥ 本机在这份备份之后删掉的(回收站 / 删除日志里)不带回,预览写明
//  ⑦ 恢复预览的行文字不露开发用语;没登记的键只写「其它数据」,键名放悬停提示
jest.mock('../ziweiCustomTablesPersist', ()=>({
	mirrorZiweiCustomTable: jest.fn(()=>Promise.resolve(null)),
	restoreZiweiCustomTablesOnce: jest.fn(()=>Promise.resolve([])),
}));
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import * as ub from '../unifiedBackup';
import { upsertLocalChart, getLocalChart, removeLocalChart, purgeLocalChartTrashItem, importLocalChartsBackup, previewLocalChartsBackup, listLocalChartsTrash } from '../localcharts';
import { listRecordRevisions, __resetRevisionsForTests } from '../recordRevisions';
import { STORAGE_KEY_REGISTRY } from '../storageKeyRegistry';
import { recordImportConfirmText } from '../../components/user/recordListText';
import { RestorePreview } from '../../components/user/unifiedRestoreFlow';

const FMT = ub.UNIFIED_BACKUP_FORMAT;
const env = (charts)=>({ format: 'horosa-local-charts', version: 1, charts });
const pad = (n)=>`${n}`.padStart(2, '0');
const stamp = (msAgo)=>{ const d = new Date(Date.now() - msAgo); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const DAY = 24 * 3600 * 1000;

beforeEach(()=>{
	window.localStorage.clear();
	__resetRevisionsForTests();
});

describe('① AI 助手权限类开关:每项取较严的一档', ()=>{
	it('新机(本机全是缺省)恢复收紧过的包:按备份收紧,不停在全自动 / 外部免确认 / 禁用名单清空;开着的开关不跟着打开', async ()=>{
		const manifest = { format: FMT, version: 2, settingsComplete: true, raw: {
			'horosa.ai.agent.enabled': '1',
			'horosa.ai.agent.approval': 'read-only',
			'horosa.ai.agent.external.policy.v1': JSON.stringify({ approval: 'read-only', maxCallsPerMinute: 10, maxAdditivePerHour: 0, uiConfirm: true }),
			'horosa.ai.agent.toolPolicy.v1': JSON.stringify({ allow: [], deny: ['create_chart_record'] }),
			'horosa.ai.tools.webSearch.enabled': '1',
		} };
		const pre = ub.previewUnifiedRestore(manifest).find((r)=>r.key === 'security');
		expect(pre.label).toBe('AI 助手权限类开关');
		expect(pre.detail).toContain('写入动作审批、按工具名放行 / 禁用、外部客户端审批按备份收紧');
		expect(pre.detail).toContain('AI 助手行动能力');
		await ub.restoreUnifiedBackup(manifest);
		expect(window.localStorage.getItem('horosa.ai.agent.approval')).toBe('read-only');
		expect(JSON.parse(window.localStorage.getItem('horosa.ai.agent.external.policy.v1'))).toEqual({ approval: 'read-only', maxCallsPerMinute: 10, maxAdditivePerHour: 0, uiConfirm: true });
		expect(JSON.parse(window.localStorage.getItem('horosa.ai.agent.toolPolicy.v1')).deny).toEqual(['create_chart_record']);
		expect(window.localStorage.getItem('horosa.ai.agent.enabled')).toBe(null);   // 本机关着(缺省):不随备份打开
		expect(window.localStorage.getItem('horosa.ai.tools.webSearch.enabled')).toBe(null);
	});

	it('设置面完整的包里没有这项 = 来源机为缺省:本机开着的开关按缺省收紧(关);老包里没有这项分不清,本机不动', async ()=>{
		window.localStorage.setItem('horosa.ai.tools.webSearch.enabled', '1');
		await ub.restoreUnifiedBackup({ format: FMT, version: 2, settingsComplete: true, raw: { 'horosa.liuyao.settings.v1': '{}' } });
		expect(window.localStorage.getItem('horosa.ai.tools.webSearch.enabled')).toBe('0');
		window.localStorage.setItem('horosa.ai.tools.webSearch.enabled', '1');
		const rows = ub.previewUnifiedRestore({ format: FMT, version: 2, raw: { 'horosa.liuyao.settings.v1': '{}' } });
		expect(rows.find((r)=>r.key === 'security')).toBeUndefined();
		await ub.restoreUnifiedBackup({ format: FMT, version: 2, raw: { 'horosa.liuyao.settings.v1': '{}' } });
		expect(window.localStorage.getItem('horosa.ai.tools.webSearch.enabled')).toBe('1');
	});

	it('逐项的「严」:开关关 > 开;审批 只读 > 每次确认 > 全自动;类别逐类取严;信任取交集;禁用并集放行交集;外部上限取小', ()=>{
		const st = ub.stricterSecurityValue;
		expect(st('horosa.ai.tools.privateRead.enabled', '1', null)).toBe('0');
		expect(st('horosa.ai.tools.privateRead.enabled', '1', '1')).toBe('1');
		expect(st('horosa.ai.tools.privateRead.enabled', null, '1')).toBe(null);
		expect(st('horosa.ai.agent.approval', 'never', 'on-request')).toBe('on-request');
		expect(st('horosa.ai.agent.approval', 'read-only', 'never')).toBe('read-only');
		expect(st('horosa.ai.agent.approval', null, null)).toBe(null);
		expect(JSON.parse(st('horosa.ai.agent.approval.categories.v1', JSON.stringify({ records: 'inherit', settings: 'read-only' }), JSON.stringify({ records: 'on-request', settings: 'never', tasks: 'inherit' }))))
			.toEqual({ records: 'on-request', settings: 'read-only' });
		const cat = JSON.stringify({ records: 'read-only' });
		expect(st('horosa.ai.agent.approval.categories.v1', cat, JSON.stringify({ records: 'never' }))).toBe(cat);   // 等严 → 原样
		expect(JSON.parse(st('horosa.ai.agent.trust.records.v1', JSON.stringify(['a', 'b']), JSON.stringify(['b', 'c'])))).toEqual(['b']);
		expect(JSON.parse(st('horosa.ai.agent.trust.records.v1', JSON.stringify(['a']), null))).toEqual([]);
		expect(JSON.parse(st('horosa.ai.agent.toolPolicy.v1', JSON.stringify({ allow: ['x', 'y'], deny: ['d1'] }), JSON.stringify({ allow: ['y'], deny: ['x', 'd2'] }))))
			.toEqual({ allow: ['y'], deny: ['d1', 'x', 'd2'] });
		expect(JSON.parse(st('horosa.ai.agent.external.policy.v1', JSON.stringify({ approval: 'on-request', maxCallsPerMinute: 30, maxAdditivePerHour: 50, uiConfirm: false }), JSON.stringify({ approval: 'auto', maxCallsPerMinute: 60, maxAdditivePerHour: 5, uiConfirm: true }))))
			.toEqual({ approval: 'on-request', maxCallsPerMinute: 30, maxAdditivePerHour: 5, uiConfirm: true });
		// 每项都不会比本机更宽
		const ext = JSON.stringify({ approval: 'read-only', maxCallsPerMinute: 1, maxAdditivePerHour: 0, uiConfirm: true });
		expect(st('horosa.ai.agent.external.policy.v1', ext, JSON.stringify({ approval: 'auto' }))).toBe(ext);
	});

	it('校验和不符的安全开关不当备份的值用(本机不动);includeSecurity 时整值写入(无头 --include-security)', async ()=>{
		const m = { format: FMT, version: 2, raw: { 'horosa.ai.agent.approval': 'read-only' } };
		m.checksums = { raw: { 'horosa.ai.agent.approval': 'bad-sum' } };
		await ub.restoreUnifiedBackup(m);
		expect(window.localStorage.getItem('horosa.ai.agent.approval')).toBe(null);
		window.localStorage.setItem('horosa.ai.agent.approval', 'read-only');
		await ub.restoreUnifiedBackup({ format: FMT, version: 2, raw: { 'horosa.ai.agent.approval': 'never' } }, { includeSecurity: true });
		expect(window.localStorage.getItem('horosa.ai.agent.approval')).toBe('never');
	});
});

describe('② 同一 ID 一律用备份里的(回退)', ()=>{
	it('缺省较新者胜:先导出的那份改不回;勾「一律用备份里的」才回到那份的样子,预览如实写', async ()=>{
		upsertLocalChart({ cid: 'x2', name: '本机原版', birth: '1990-01-01 08:00:00', updateTime: '2026-09-01 10:00:00', preserveUpdateTime: true });
		const p0 = ub.buildUnifiedBackupManifest();
		await ub.restoreUnifiedBackup({ format: FMT, version: 2, charts: env([{ cid: 'x2', name: '别机版', birth: '1991-02-02 08:00:00', updateTime: '2026-10-01 10:00:00' }]) });
		expect(getLocalChart('x2').name).toBe('别机版');
		await ub.restoreUnifiedBackup(p0);
		expect(getLocalChart('x2').name).toBe('别机版');   // 较新者胜:P0 较旧
		const row = ub.previewUnifiedRestore(p0, { sameCid: 'backup' }).find((r)=>r.key === 'charts');
		expect(row.detail).toContain('同一 ID 的 1 条一律用备份里的');
		await ub.restoreUnifiedBackup(p0, { sameCid: 'backup' });
		expect(getLocalChart('x2')).toMatchObject({ name: '本机原版', birth: '1990-01-01 08:00:00', updateTime: '2026-09-01 10:00:00' });
		// 被替换的「别机版」留在版本历史里
		const revs = await listRecordRevisions('chart', 'x2');
		expect(revs.map((r)=>r.record.name)).toContain('别机版');
	});

	it('恢复确认框:勾选后预览按「一律用备份里的」重算,并把选择交给确认按钮', ()=>{
		upsertLocalChart({ cid: 'y1', name: '本机新', birth: '1990-01-01 08:00:00', updateTime: '2026-10-10 10:00:00', preserveUpdateTime: true });
		const manifest = { format: FMT, version: 2, charts: env([{ cid: 'y1', name: '备份旧', birth: '1990-01-01 08:00:00', updateTime: '2026-01-01 10:00:00' }]) };
		const host = document.createElement('div');
		document.body.appendChild(host);
		const onChange = jest.fn();
		act(()=>{ ReactDOM.render(<RestorePreview ub={ub} manifest={manifest} check={{ ok: true }} onChange={onChange} />, host); });
		expect(host.textContent).toContain('本机较新或一样新的 1 条保留本机的');
		const box = host.querySelector('input[type="checkbox"]');
		act(()=>{ box.click(); });
		expect(host.textContent).toContain('同一 ID 的 1 条一律用备份里的');
		expect(onChange).toHaveBeenLastCalledWith({ sameCid: 'backup' });
		ReactDOM.unmountComponentAtNode(host);
		host.remove();
	});
});

describe('③ 较新的整条替换:本机的列表状态留着', ()=>{
	it('星标 / 置顶 / 归档 / 排序 / 使用足迹留本机的,内容按备份;勾「一律用备份里的」时整条(含这些)按备份', ()=>{
		upsertLocalChart({ cid: 'm1', name: '甲', birth: '1990-01-01 08:00:00', updateTime: '2026-09-01 10:00:00', preserveUpdateTime: true,
			starred: true, pinTier: 1, pinAt: '2026-09-02 10:00:00', archived: true, orderKey: -5, lastOpenedAt: '2026-09-03 10:00:00', openCount: 4 });
		importLocalChartsBackup(env([{ cid: 'm1', name: '甲(改)', birth: '1990-01-01 09:00:00', updateTime: '2026-10-01 10:00:00' }]));
		expect(getLocalChart('m1')).toMatchObject({ name: '甲(改)', birth: '1990-01-01 09:00:00', updateTime: '2026-10-01 10:00:00',
			starred: true, pinTier: 1, pinAt: '2026-09-02 10:00:00', archived: true, orderKey: -5, lastOpenedAt: '2026-09-03 10:00:00', openCount: 4 });
		importLocalChartsBackup(env([{ cid: 'm1', name: '甲(回退)', birth: '1990-01-01 08:00:00', updateTime: '2026-08-01 10:00:00' }]), { sameCid: 'backup' });
		const rec = getLocalChart('m1');
		expect(rec.name).toBe('甲(回退)');
		expect(rec.starred).toBeUndefined();
		expect(rec.pinTier).toBeUndefined();
	});
});

describe('④ 被外部来源整条替换前的本机版本一律留历史', ()=>{
	it('5 分钟内先亲手改、随即被较新的备份整条替换:「亲手改」那一版在历史里', async ()=>{
		upsertLocalChart({ cid: 'h1', name: '原版', birth: '1990-01-01 08:00:00', updateTime: '2026-09-01 10:00:00', preserveUpdateTime: true });
		upsertLocalChart({ cid: 'h1', name: '亲手改', birth: '1990-01-01 08:00:00' });
		const later = stamp(-60 * 1000);   // 比刚才的亲手改还晚(另一台机器稍后也改了)
		importLocalChartsBackup(env([{ cid: 'h1', name: '别机改', birth: '1990-01-01 08:00:00', updateTime: later }]));
		expect(getLocalChart('h1').name).toBe('别机改');
		const names = (await listRecordRevisions('chart', 'h1')).map((r)=>r.record.name);
		expect(names).toEqual(expect.arrayContaining(['原版', '亲手改']));
	});

	it('连续手改照旧去抖(5 分钟内只留改之前那一版)', async ()=>{
		upsertLocalChart({ cid: 'h2', name: '一', birth: '1990-01-01 08:00:00' });
		upsertLocalChart({ cid: 'h2', name: '二', birth: '1990-01-01 08:00:00' });
		upsertLocalChart({ cid: 'h2', name: '三', birth: '1990-01-01 08:00:00' });
		expect((await listRecordRevisions('chart', 'h2')).map((r)=>r.record.name)).toEqual(['一']);
	});
});

describe('⑤ 名人库补丁与普通条目混在一份文件', ()=>{
	it('只有补丁条目按字段合并;同一文件里较旧的普通条目不盖本机较新的', ()=>{
		upsertLocalChart({ cid: 'adb-1', name: '我改过的名', birth: '1950-01-01 10:00:00', memo: '我的备注', updateTime: '2026-10-01 10:00:00', preserveUpdateTime: true });
		upsertLocalChart({ cid: 'n1', name: '本机新', birth: '1980-05-05 08:00:00', updateTime: '2026-10-01 10:00:00', preserveUpdateTime: true });
		const file = env([
			{ cid: 'adb-1', celebrityId: 'adb-1', birth: '1950-01-01 11:30:00', updateTime: '2026-10-19 10:00:00' },
			{ cid: 'n1', name: '旧名', birth: '1980-05-05 09:00:00', updateTime: '2026-08-01 10:00:00' },
		]);
		const opts = { sameCid: 'merge', mergeCids: ['adb-1'] };
		const p = previewLocalChartsBackup(file, opts);
		expect(p).toMatchObject({ sameCid: 'mixed', merges: 1, updates: 0, keptLocal: 1 });
		expect(recordImportConfirmText(p)).toContain('名人库里已有的 1 条只刷新出生数据');
		const r = importLocalChartsBackup(file, opts);
		expect(r).toMatchObject({ imported: 1, merged: 1, keptLocal: 1 });
		expect(getLocalChart('adb-1')).toMatchObject({ name: '我改过的名', memo: '我的备注', birth: '1950-01-01 11:30:00' });
		expect(getLocalChart('n1')).toMatchObject({ name: '本机新', birth: '1980-05-05 08:00:00', updateTime: '2026-10-01 10:00:00' });
	});
});

describe('⑥ 本机在这份备份之后删掉的不带回', ()=>{
	it('回收站里的、删除日志里的都不带回;在别处删除之后又改过的(包里那版更新)照样带回;预览与结果同数', async ()=>{
		const t0 = stamp(3 * DAY);
		['d1', 'd2', 'd3', 'k1'].forEach((cid)=>upsertLocalChart({ cid, name: `盘${cid}`, birth: '1990-01-01 08:00:00', updateTime: t0, preserveUpdateTime: true }));
		const manifest = ub.buildUnifiedBackupManifest();
		removeLocalChart('d1');                       // 进回收站
		removeLocalChart('d2');
		expect(purgeLocalChartTrashItem('d2')).toBe(true);   // 彻底删除 → 删除日志
		removeLocalChart('d3');
		// 包里 d3 那版是删除之后才改的(另一台机器上又改过)→ 照样带回
		manifest.charts.charts = manifest.charts.charts.map((c)=>(c.cid === 'd3' ? { ...c, name: '别机后改', updateTime: stamp(-3600 * 1000) } : c));
		delete manifest.checksums;
		const row = ub.previewUnifiedRestore(manifest).find((r)=>r.key === 'charts');
		expect(row.detail).toContain('本机在这份备份之后删掉的 2 条不带回');
		const res = await ub.restoreUnifiedBackup(manifest);
		expect(res.find((r)=>r.key === 'charts').detail).toContain('本机在这份备份之后删掉的 2 条没有带回');
		expect(getLocalChart('d1')).toBe(null);
		expect(getLocalChart('d2')).toBe(null);
		expect(getLocalChart('d3')).toMatchObject({ name: '别机后改' });
		expect(getLocalChart('k1')).toBeTruthy();
		expect(listLocalChartsTrash().map((r)=>r.cid)).toContain('d1');   // 还在回收站,照样可以恢复
	});

	it('不带这个选项的导入(名人库 JSON 等)照旧带回', ()=>{
		upsertLocalChart({ cid: 'z1', name: '甲', birth: '1990-01-01 08:00:00', updateTime: stamp(DAY), preserveUpdateTime: true });
		const file = env([getLocalChart('z1')]);
		removeLocalChart('z1');
		expect(previewLocalChartsBackup(file, { respectLocalDeletions: true })).toMatchObject({ adds: 0, skippedDeleted: 1 });
		expect(importLocalChartsBackup(file)).toMatchObject({ imported: 1 });
	});
});

describe('⑦ 恢复预览不露开发用语', ()=>{
	it('会随备份走的键标签里没有缓存结构 / 存储层用语;没登记的键只写「其它数据」,键名放悬停提示', ()=>{
		const JARGON = /FIFO|历史键|族|schema|storageKey|IDB|IndexedDB|apiKey|provider|零注入|壳侧|\/min|\{|=|inherit|on-request|read-only|cid 列表|现状|V5|闸|run_analysis|web_search|create_goal|schedule_task/;
		const bad = STORAGE_KEY_REGISTRY.filter((e)=>e.backup === true && JARGON.test(e.label)).map((e)=>`${e.key || e.prefix}:${e.label}`);
		expect(bad).toEqual([]);
		const rows = ub.previewUnifiedRestore({ format: FMT, version: 2, raw: { 'someUnknownKey.x': '1', 'horosa.deleted.log.v1': '[]' } });
		const unk = rows.find((r)=>r.key === 'someUnknownKey.x');
		expect(unk.label).toBe('其它数据');
		expect(unk.title).toBe('someUnknownKey.x');
		expect(rows.find((r)=>r.key === 'horosa.deleted.log.v1').label).not.toMatch(/FIFO|500/);
		expect(ub.restoreRowLabel('raw.someUnknownKey.x')).toBe('其它数据');
	});
});
