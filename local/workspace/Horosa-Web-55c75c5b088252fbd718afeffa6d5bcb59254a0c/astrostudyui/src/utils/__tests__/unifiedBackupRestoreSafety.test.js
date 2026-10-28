// 全量恢复的几条口径:
//  ① 安全开关缺省每项取本机与备份里较严的一档(备份里较宽的不放宽本机;本机是缺省时按备份收紧);显式 includeSecurity 才整值一并恢复;
//     预览与结果合成一行「AI 助手权限类开关」
//  ② 恢复较早的备份:同一 ID 本机较新的整条保留,预览写明谁胜
//  ③ 旧版本导出的包:紫微晚子时亲手选的「子初换日(强制)」补上升级记号,不被当旧默认改成跟随全局
//  ④ 人生事件:本机删过的不再从备份带回
//  ⑤ 紫微自定义表整值替换后同步 IDB 镜像
//  ⑥ 同一份包恢复两次结果相同(新盘种子并入记号不再一次有、一次无)
//  ⑦ 结果行带中文名;预览不露开发用语
//  ⑧ 用户数据键的坏 JSON 自愈清除前先留档
jest.mock('../ziweiCustomTablesPersist', ()=>({
	mirrorZiweiCustomTable: jest.fn(()=>Promise.resolve(null)),
	restoreZiweiCustomTablesOnce: jest.fn(()=>Promise.resolve([])),
}));
import { mirrorZiweiCustomTable } from '../ziweiCustomTablesPersist';
import * as ub from '../unifiedBackup';
import { upsertLocalChart, getLocalChart } from '../localcharts';
import { getAgentApprovalMode, getExternalPolicy } from '../aiAgent/prefs';
import { safeJsonParseFromStorage } from '../safeStorage';
import { STORAGE_KEY_REGISTRY } from '../storageKeyRegistry';
import * as seeds from '../newChartSeeds';

const FMT = ub.UNIFIED_BACKUP_FORMAT;
const snapshot = ()=>{ const o = {}; for(let i = 0; i < window.localStorage.length; i += 1){ const k = window.localStorage.key(i); o[k] = window.localStorage.getItem(k); } return o; };

describe('全量恢复口径', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
		jest.clearAllMocks();
		seeds.__resetNewChartSeedsForTest();
	});

	it('① 安全开关:本机收紧过的不被放宽(包里较宽的不写入、本机多出的不复位);预览与结果各一行', async ()=>{
		window.localStorage.setItem('horosa.ai.agent.approval', 'read-only');
		window.localStorage.setItem('horosa.ai.agent.external.policy.v1', JSON.stringify({ approval: 'read-only', maxCallsPerMinute: 10, maxAdditivePerHour: 0, uiConfirm: true }));
		window.localStorage.setItem('horosa.ai.agent.toolPolicy.v1', JSON.stringify({ allow: [], deny: ['create_chart_record'] }));
		const manifest = { format: FMT, version: 2, settingsComplete: true, raw: {
			'horosa.ai.agent.approval': 'never',
			'horosa.ai.tools.webSearch.enabled': '1',
			'horosa.liuyao.settings.v1': '{}',
		} };
		const rows = ub.previewUnifiedRestore(manifest);
		const sec = rows.find((r)=>r.key === 'security');
		expect(sec.label).toBe('AI 助手权限类开关');
		expect(sec.detail.indexOf('每项取本机与备份里较严的一档，不会放宽本机')).toBe(0);
		expect(sec.detail).toContain('写入动作审批');
		expect(sec.detail).not.toMatch(/[：:].*[：:].*[：:]/);   // 一行里不叠三个冒号
		expect(rows.filter((r)=>ub.BACKUP_SECURITY_KEYS.indexOf(r.key) >= 0)).toEqual([]);
		const res = await ub.restoreUnifiedBackup(manifest);
		expect(getAgentApprovalMode()).toBe('read-only');
		expect(getExternalPolicy().approval).toBe('read-only');
		expect(JSON.parse(window.localStorage.getItem('horosa.ai.agent.toolPolicy.v1')).deny).toEqual(['create_chart_record']);
		expect(window.localStorage.getItem('horosa.ai.tools.webSearch.enabled')).toBe(null);
		expect(res.find((r)=>r.key === 'security')).toMatchObject({ ok: true, label: 'AI 助手权限类开关' });
		expect(window.localStorage.getItem('horosa.liuyao.settings.v1')).toBe('{}');
	});

	it('① 显式 includeSecurity:一并恢复(无头 --include-security 走这条)', async ()=>{
		window.localStorage.setItem('horosa.ai.agent.approval', 'read-only');
		const manifest = { format: FMT, version: 2, raw: { 'horosa.ai.agent.approval': 'on-request' } };
		expect(ub.previewUnifiedRestore(manifest, { includeSecurity: true }).find((r)=>r.key === 'security')).toBeUndefined();
		await ub.restoreUnifiedBackup(manifest, { includeSecurity: true });
		expect(getAgentApprovalMode()).toBe('on-request');
	});

	it('② 恢复较早的备份:本机之后改过的盘整条保留,预览写「本机较新或一样新…保留本机的」', async ()=>{
		upsertLocalChart({ cid: 'same-1', name: '旧名', birth: '1990-01-01 08:00:00', zone: '+08:00', updateTime: '2026-08-01 10:00:00', preserveUpdateTime: true });
		const manifest = ub.buildUnifiedBackupManifest();
		upsertLocalChart({ cid: 'same-1', name: '新名', birth: '1990-01-01 09:30:00', pdMethod: 'placidus', memo: '本机后写的备注' });
		const before = getLocalChart('same-1');
		const row = ub.previewUnifiedRestore(manifest).find((r)=>r.key === 'charts');
		expect(row.detail).toContain('本机较新或一样新的 1 条保留本机的');
		await ub.restoreUnifiedBackup(manifest);
		const after = getLocalChart('same-1');
		expect({ name: after.name, birth: after.birth, memo: after.memo, updateTime: after.updateTime }).toEqual({ name: before.name, birth: before.birth, memo: before.memo, updateTime: before.updateTime });
	});

	it('③ 旧版本导出的包(没有设置面完整字段、晚子时默认改版之后导出):补上紫微晚子时升级记号;更早的包 / 新版包不补', async ()=>{
		await ub.restoreUnifiedBackup({ format: FMT, version: 2, exportedAt: '2026-09-20T10:00:00.000Z', raw: { ziweiLateZi: 'zi_chu' } });
		expect(window.localStorage.getItem('ziweiLateZiMigrated')).toBe('1');
		window.localStorage.clear();
		await ub.restoreUnifiedBackup({ format: FMT, version: 2, exportedAt: '2026-07-01T10:00:00.000Z', raw: { ziweiLateZi: 'zi_chu' } });
		expect(window.localStorage.getItem('ziweiLateZiMigrated')).toBe(null);
		window.localStorage.clear();
		await ub.restoreUnifiedBackup({ format: FMT, version: 2, settingsComplete: true, exportedAt: '2026-10-19T10:00:00.000Z', raw: { ziweiLateZi: 'zi_chu' } });
		expect(window.localStorage.getItem('ziweiLateZiMigrated')).toBe(null);
		expect(ub.lateZiFlagNeeded({ exportedAt: '2026-09-20T10:00:00.000Z', raw: { ziweiLateZi: 'global' } })).toBe(false);
	});

	it('⑤ 紫微自定义表整值替换后同步 IDB 镜像', async ()=>{
		await ub.restoreUnifiedBackup({ format: FMT, version: 2, raw: { ziweiSihuaCustom: '{"b":2}', ziweiBrightnessCustom: '{"a":1}' } });
		expect(mirrorZiweiCustomTable.mock.calls.map((c)=>c[0]).sort()).toEqual(['brightness', 'sihua']);
		expect(mirrorZiweiCustomTable).toHaveBeenCalledWith('sihua', '{"b":2}');
	});

	it('⑥ 同一份「有种子、无并入记号、设置面完整」的包恢复两次:两次之后各键一致', async ()=>{
		const manifest = { format: FMT, version: 2, settingsComplete: true, raw: { 'horosa.chart.newChartSeeds.v1': JSON.stringify({ hsys: 0 }) },
			charts: { format: 'horosa-local-charts', version: 1, charts: [{ cid: 'k1', name: '甲', birth: '1990-01-01 08:00:00', updateTime: '2026-08-01 10:00:00' }] } };
		window.localStorage.setItem('horosaGuolaoSu28Mode', '3');   // 本机有旧版同义存储(读种子时会并入并补写并入记号)
		await ub.restoreUnifiedBackup(JSON.parse(JSON.stringify(manifest)));
		const a = snapshot();
		await ub.restoreUnifiedBackup(JSON.parse(JSON.stringify(manifest)));
		const b = snapshot();
		const changed = Object.keys({ ...a, ...b }).filter((k)=>a[k] !== b[k] && k !== 'horosa.localCharts.v1');
		expect(changed).toEqual([]);
	});

	it('⑦ 结果行都带中文名(失败提示列中文名,不露内部键名)', async ()=>{
		const res = await ub.restoreUnifiedBackup({ format: FMT, version: 2, raw: { 'horosa.liuyao.settings.v1': '{}' }, charts: { format: 'wrong', charts: [] } });
		res.forEach((r)=>{ expect(typeof r.label).toBe('string'); expect(r.label.length).toBeGreaterThan(0); });
		expect(res.find((r)=>r.key === 'charts')).toMatchObject({ ok: false, label: '命盘' });
		expect(ub.restoreRowLabel('newChartSeeds.backfill.houseStartMode')).toBe('本机旧命盘');
		expect(ub.restoreRowLabel('raw.horosa.liuyao.settings.v1')).toBe('六爻设置');
	});

	it('⑦ 会随备份走的键标签不露开发用语', ()=>{
		const JARGON = /新盘种子|冻结|写定|历史无前缀键|迁移标志|未登记|登记后|并集|信封/;
		const bad = STORAGE_KEY_REGISTRY.filter((e)=>(e.backup === true || e.key === 'Token') && JARGON.test(e.label)).map((e)=>`${e.key || e.prefix}:${e.label}`);
		expect(bad).toEqual([]);
		const rows = ub.previewUnifiedRestore({ format: FMT, version: 2, raw: { 'horosa.chart.newChartSeeds.v1': '{}', 'horosa.chart.newChartSeeds.legacyMerged.v1': '1', aspects: '[]', Token: 'x' } });
		rows.forEach((r)=>{ expect(`${r.label}：${r.detail}`).not.toMatch(JARGON); });
	});

	it('⑧ 用户数据键的坏 JSON:自愈清除前原串留档;设置 / 缓存键照旧只清不留', ()=>{
		window.localStorage.setItem('horosa.zeri.schemes.v1', '{"schemes":[');
		expect(safeJsonParseFromStorage('horosa.zeri.schemes.v1')).toBe(null);
		expect(window.localStorage.getItem('horosa.zeri.schemes.v1')).toBe(null);
		const arch = Object.keys(window.localStorage).filter((k)=>k.indexOf('horosa.corrupt.horosa.zeri.schemes.v1.') === 0);
		expect(arch.map((k)=>window.localStorage.getItem(k))).toEqual(['{"schemes":[']);
		window.localStorage.setItem('horosa.liuyao.settings.v1', '{bad');
		safeJsonParseFromStorage('horosa.liuyao.settings.v1');
		expect(Object.keys(window.localStorage).filter((k)=>k.indexOf('horosa.corrupt.') === 0).length).toBe(1);
	});
});
