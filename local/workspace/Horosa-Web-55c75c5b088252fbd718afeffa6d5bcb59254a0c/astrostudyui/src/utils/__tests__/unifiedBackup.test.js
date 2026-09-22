// [R3] 统一全量备份全链路:manifest 构建→zip 往返→校验矩阵→预览→恢复(合并/替换/id-并集)。
import JSZip from 'jszip';
import {
	buildUnifiedBackupManifest, parseUnifiedBackupBlob, validateUnifiedBackup,
	previewUnifiedRestore, restoreUnifiedBackup,
	UNIFIED_BACKUP_FORMAT, UNIFIED_MANIFEST_NAME,
} from '../unifiedBackup';
import { upsertLocalChart, listLocalCharts } from '../localcharts';
import { upsertLocalCase, listLocalCases } from '../localcases';

const LIFE_KEY = 'horosa.lc.lifeEvents.v1';

function seedAll(){
	upsertLocalChart({ cid: 'local-u-1', name: '备份甲', birth: '1990-01-01 08:00:00', zone: '+08:00', updateTime: '2026-08-01 10:00:00', preserveUpdateTime: true });
	upsertLocalCase({ cid: 'local-case-u-1', event: '备份课', caseType: 'liuyao', divTime: '2026-01-01 10:00:00', zone: '+08:00', updateTime: '2026-08-01 09:00:00', preserveUpdateTime: true });
	window.localStorage.setItem(LIFE_KEY, JSON.stringify({ 'sig-a': [{ id: 'ev1', date: '2020-01-01', kind: 'good', title: '甲事' }] }));
	window.localStorage.setItem('horosa.ai.export.settings.v1', JSON.stringify({ version: 56, prefs: {} }));
	window.localStorage.setItem('HorosaLocalDeepLearn', JSON.stringify({ 'local-u-1': { a: 1 } }));
}

describe('[R3] 统一全量备份', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	it('manifest:五类数据齐备(命盘/事盘信封嵌套自带 format;raw 只收在场键)', ()=>{
		seedAll();
		const m = buildUnifiedBackupManifest();
		expect(m.format).toBe(UNIFIED_BACKUP_FORMAT);
		expect(m.charts.format).toBe('horosa-local-charts');
		expect(m.charts.total).toBe(1);
		expect(m.cases.format).toBe('horosa-local-cases');
		expect(m.raw[LIFE_KEY]).toBeTruthy();
		expect(m.raw['horosa.ai.export.settings.v1']).toBeTruthy();
		expect(m.raw['HorosaLocalDeepLearn']).toBeTruthy();
		expect(m.raw['horosa.ai.mount.techniqueDefaults.v1']).toBeUndefined();   // 不在场不收
	});

	it('🔴 zip 往返:manifest 打包→解析逐字段等价;缺 manifest/坏 zip → null', async ()=>{
		seedAll();
		const m = buildUnifiedBackupManifest();
		const zip = new JSZip();
		zip.file(UNIFIED_MANIFEST_NAME, JSON.stringify(m));
		const data = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
		const parsed = await parseUnifiedBackupBlob(data);
		expect(parsed).toEqual(m);
		const emptyZip = await new JSZip().generateAsync({ type: 'uint8array' });
		expect(await parseUnifiedBackupBlob(emptyZip)).toBe(null);
		expect(await parseUnifiedBackupBlob(new Uint8Array([1, 2, 3]))).toBe(null);
	});

	it('校验矩阵:AI 工作区 zip 防呆(format 不符拒)/空内容拒/未来版软闸', ()=>{
		expect(validateUnifiedBackup(null)).toMatchObject({ ok: false, reason: 'not-object' });
		expect(validateUnifiedBackup({ format: 'something-else' })).toMatchObject({ ok: false, reason: 'format-mismatch' });
		expect(validateUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 1 })).toMatchObject({ ok: false, reason: 'empty' });
		expect(validateUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 9, charts: { charts: [] } })).toMatchObject({ ok: true, reason: 'newer-version' });
	});

	it('🔴 恢复:命盘/事盘合并导入 + 设置整值替换 + 人生事件 id-并集(同 id 保本机)', async ()=>{
		// 本机现状:一张命盘、sig-a 有 ev1(本机版)
		upsertLocalChart({ cid: 'local-keep', name: '本机保留', birth: '1980-01-01 08:00:00', zone: '+08:00', updateTime: '2026-07-01 10:00:00', preserveUpdateTime: true });
		window.localStorage.setItem(LIFE_KEY, JSON.stringify({ 'sig-a': [{ id: 'ev1', title: '本机版' }] }));
		const manifest = {
			format: UNIFIED_BACKUP_FORMAT,
			version: 1,
			charts: { format: 'horosa-local-charts', version: 1, charts: [{ cid: 'local-in-1', name: '备份来的', updateTime: '2026-08-02 10:00:00' }] },
			cases: { format: 'horosa-local-cases', version: 1, cases: [{ cid: 'local-case-in-1', event: '备份来的课', caseType: 'taiyi', divTime: '2026-02-01 10:00:00', updateTime: '2026-08-02 09:00:00' }] },
			raw: {
				[LIFE_KEY]: JSON.stringify({ 'sig-a': [{ id: 'ev1', title: '备份版' }, { id: 'ev2', title: '新事件' }], 'sig-b': [{ id: 'ev3', title: '乙签名' }] }),
				'horosa.ai.export.settings.v1': '{"version":56,"marker":"from-backup"}',
			},
		};
		const rows = previewUnifiedRestore(manifest);
		expect(rows.find((r)=>r.key === 'charts').detail).toContain('新增 1 条');
		const results = await restoreUnifiedBackup(manifest);
		expect(results.every((r)=>r.ok)).toBe(true);
		// 命盘:合并不删现有
		const names = listLocalCharts().map((r)=>r.name);
		expect(names).toContain('本机保留');
		expect(names).toContain('备份来的');
		expect(listLocalCases().map((r)=>r.event)).toContain('备份来的课');
		// 设置:整值替换
		expect(window.localStorage.getItem('horosa.ai.export.settings.v1')).toContain('from-backup');
		// 人生事件:id-并集,同 id 保本机
		const life = JSON.parse(window.localStorage.getItem(LIFE_KEY));
		expect(life['sig-a'].find((e)=>e.id === 'ev1').title).toBe('本机版');
		expect(life['sig-a'].find((e)=>e.id === 'ev2').title).toBe('新事件');
		expect(life['sig-b'][0].id).toBe('ev3');
	});

	it('人生事件坏形状:跳过不写、诚实上报,其余项照常恢复', async ()=>{
		const manifest = {
			format: UNIFIED_BACKUP_FORMAT,
			version: 1,
			raw: {
				[LIFE_KEY]: '[not-an-object]',
				'HorosaLocalDeepLearn': '{"x":1}',
			},
		};
		const results = await restoreUnifiedBackup(manifest);
		expect(results.find((r)=>r.key === LIFE_KEY).ok).toBe(false);
		expect(results.find((r)=>r.key === 'HorosaLocalDeepLearn').ok).toBe(true);
		expect(window.localStorage.getItem(LIFE_KEY)).toBe(null);
		expect(window.localStorage.getItem('HorosaLocalDeepLearn')).toBe('{"x":1}');
	});
});

describe('[V4] 全量备份 v2:注册表驱动全键面 + 回收站 + AI 工作区 + 敏感剥离', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	it('🔴 导出面=注册表推导:settings/user-data 键全收;cache/device-local 排除;未登记键防呆带走并留痕', ()=>{
		window.localStorage.setItem('horosa.liuyao.settings.v1', '{"a":1}');       // settings
		window.localStorage.setItem('ziweiPreset', 'sanhe');                       // 无前缀历史键(settings 族)
		window.localStorage.setItem('horosa.tarot.personalMeanings', '{"m":1}');   // user-data
		window.localStorage.setItem('horosa.perf.chartSCU', '1');                  // device-local → 排除
		window.localStorage.setItem('horosa.localcalc.nongli.v1', '{"c":1}');      // cache → 排除
		window.localStorage.setItem('some.future.key', 'x');                       // 未登记 → 防呆带走
		const m = buildUnifiedBackupManifest();
		expect(m.version).toBe(2);
		expect(m.raw['horosa.liuyao.settings.v1']).toBe('{"a":1}');
		expect(m.raw['ziweiPreset']).toBe('sanhe');
		expect(m.raw['horosa.tarot.personalMeanings']).toBe('{"m":1}');
		expect(m.raw['horosa.perf.chartSCU']).toBeUndefined();
		expect(m.raw['horosa.localcalc.nongli.v1']).toBeUndefined();
		expect(m.raw['some.future.key']).toBe('x');
		expect(m.unknownKeys).toEqual(['some.future.key']);
	});

	it('🔴 回收站随备份:导出带 trash 段;恢复=按 cid 并集,本机已有保留', async ()=>{
		window.localStorage.setItem('horosa.localCharts.trash.v1', JSON.stringify([
			{ cid: 'local-t-local', name: '本机垃圾', deletedAt: '2026-08-10 10:00:00' },
		]));
		const m = buildUnifiedBackupManifest();
		expect(m.trash.charts).toContain('local-t-local');
		const manifest = {
			format: UNIFIED_BACKUP_FORMAT,
			version: 2,
			trash: {
				charts: JSON.stringify([
					{ cid: 'local-t-local', name: '备份版(须被本机压住)', deletedAt: '2026-08-01 10:00:00' },
					{ cid: 'local-t-in', name: '备份来的垃圾', deletedAt: '2026-08-11 10:00:00' },
				]),
			},
		};
		const results = await restoreUnifiedBackup(manifest);
		expect(results.find((r)=>r.key === 'trash.charts').ok).toBe(true);
		const trash = JSON.parse(window.localStorage.getItem('horosa.localCharts.trash.v1'));
		expect(trash.find((r)=>r.cid === 'local-t-local').name).toBe('本机垃圾');
		expect(trash.find((r)=>r.cid === 'local-t-in').name).toBe('备份来的垃圾');
	});

	it('手改包防呆:cache/device-local 键即使出现在 raw 里也拒写', async ()=>{
		const manifest = {
			format: UNIFIED_BACKUP_FORMAT,
			version: 2,
			raw: {
				'horosa.perf.chartSCU': '0',
				'horosa.liuyao.settings.v1': '{"ok":1}',
			},
		};
		const results = await restoreUnifiedBackup(manifest);
		expect(results.find((r)=>r.key === 'horosa.perf.chartSCU').detail).toContain('跳过');
		expect(window.localStorage.getItem('horosa.perf.chartSCU')).toBe(null);
		expect(window.localStorage.getItem('horosa.liuyao.settings.v1')).toBe('{"ok":1}');
	});

	it('🔴 AI 工作区 dump 剥密:providerProfiles 的 apiKey 绝不入包;恢复同 id 保本机', async ()=>{
		const store = require('../aiAnalysisStore');
		const { collectAiWorkspaceDump, restoreUnifiedBackup: restore2 } = require('../unifiedBackup');
		await store.putStoreRecord(store.AI_ANALYSIS_STORES.providerProfiles, { id: 'prov-1', name: '本机档', apiKey: 'sk-PLAINTEXT-SECRET' }, 'provider');
		const dump = await collectAiWorkspaceDump();
		const profs = dump.stores[store.AI_ANALYSIS_STORES.providerProfiles];
		expect(profs.length).toBe(1);
		expect(profs[0].apiKey).toBe('');
		expect(profs[0].apiKeyRedacted).toBe(true);
		expect(JSON.stringify(dump)).not.toContain('sk-PLAINTEXT-SECRET');
		// 恢复:同 id 保本机(本机 prov-1 不被备份覆盖);新 id 写入
		const manifest = {
			format: UNIFIED_BACKUP_FORMAT,
			version: 2,
			aiWorkspace: { stores: { [store.AI_ANALYSIS_STORES.providerProfiles]: [
				{ id: 'prov-1', name: '备份版(须被本机压住)', apiKey: '', apiKeyRedacted: true },
				{ id: 'prov-2', name: '备份来的档', apiKey: '', apiKeyRedacted: true },
			] } },
		};
		const results = await restore2(manifest);
		const row = results.find((r)=>r.key === 'aiWorkspace');
		expect(row.ok).toBe(true);
		const cur1 = await store.getStoreRecord(store.AI_ANALYSIS_STORES.providerProfiles, 'prov-1');
		expect(cur1.name).toBe('本机档');
		const cur2 = await store.getStoreRecord(store.AI_ANALYSIS_STORES.providerProfiles, 'prov-2');
		expect(cur2.name).toBe('备份来的档');
	});
});

// ---- [压测二轮·D7·K1/K2] 行动能力四个新 store 随全量备份走 ----
describe('[压测二轮] AI 行动能力四 store 往返 + 集成档案剥密', ()=>{
	const store = require('../aiAnalysisStore');
	const { collectAiWorkspaceDump } = require('../unifiedBackup');
	const S = store.AI_ANALYSIS_STORES;
	const NEW_STORES = [S.agentTasks, S.agentNotices, S.automationRules, S.integrationProfiles];

	beforeEach(async ()=>{
		window.localStorage.clear();
		for(let i = 0; i < NEW_STORES.length; i++){
			// eslint-disable-next-line no-await-in-loop
			await store.clearStore(NEW_STORES[i]);
		}
	});

	it('K1 integration_profiles(联网检索档)的 apiKey 绝不入包:dump 里 apiKey==="" 且 apiKeyRedacted===true;恢复同 id 保本机 Key', async ()=>{
		await store.putStoreRecord(S.integrationProfiles, { id: 'websearch-tavily', kind: 'websearch', engine: 'tavily', baseUrl: '', apiKey: 'tvly-PLAINTEXT-SECRET', enabled: true, name: 'Tavily' }, 'integration');
		const dump = await collectAiWorkspaceDump();
		const rows = dump.stores[S.integrationProfiles];
		expect(rows.length).toBe(1);
		expect(rows[0].apiKey).toBe('');
		expect(rows[0].apiKeyRedacted).toBe(true);
		expect(rows[0].engine).toBe('tavily');
		expect(JSON.stringify(dump)).not.toContain('tvly-PLAINTEXT-SECRET');
		// 恢复:同 id 保本机(备份里的空 Key 不许把本机的真 Key 抹掉);新 id 照常写入
		const results = await restoreUnifiedBackup({
			format: UNIFIED_BACKUP_FORMAT, version: 2,
			aiWorkspace: { stores: { [S.integrationProfiles]: [
				{ id: 'websearch-tavily', kind: 'websearch', engine: 'brave', apiKey: '', apiKeyRedacted: true, enabled: true, name: '备份版(须被本机压住)' },
				{ id: 'websearch-searxng', kind: 'websearch', engine: 'searxng', baseUrl: 'http://127.0.0.1:8080', apiKey: '', apiKeyRedacted: true, enabled: false, name: '备份来的自建' },
			] } },
		});
		expect(results.find((r)=>r.key === 'aiWorkspace').ok).toBe(true);
		const mine = await store.getStoreRecord(S.integrationProfiles, 'websearch-tavily');
		expect(mine.name).toBe('Tavily');
		expect(mine.engine).toBe('tavily');
		expect(mine.apiKey).toBe('tvly-PLAINTEXT-SECRET');
		const incoming = await store.getStoreRecord(S.integrationProfiles, 'websearch-searxng');
		expect(incoming.name).toBe('备份来的自建');
		expect(incoming.baseUrl).toBe('http://127.0.0.1:8080');
	});

	it('K2 agent_tasks / agent_notices / automation_rules / integration_profiles 各 3 条:dump → 清库 → 恢复,逐字段相等', async ()=>{
		const seed = {
			[S.agentTasks]: [0, 1, 2].map((i)=>({ id: `task-${i}`, kind: i === 1 ? 'scheduled' : 'goal', status: i === 2 ? 'done' : 'queued', title: `任务 ${i}`, origin: 'in-app', progress: i * 10, spec: { goal: `目标 ${i}` }, log: [{ at: '2026-09-05T00:00:00.000Z', text: `第 ${i} 行` }], nextRunAt: i === 1 ? '2026-09-06T00:00:00.000Z' : null, conversationId: `conv-${i}` })),
			[S.agentNotices]: [0, 1, 2].map((i)=>({ id: `notice-${i}`, level: i === 0 ? 'warn' : 'info', title: `通知 ${i}`, body: `正文 ${i}`, taskId: `task-${i}`, read: i === 2, seq: 1000 + i, createdAt: `2026-09-05T00:0${i}:00.000Z` })),
			[S.automationRules]: [0, 1, 2].map((i)=>({ id: `rule-${i}`, name: `规则 ${i}`, event: ['app.start', 'record.saved', 'task.done'][i], enabled: i !== 1, match: { kind: 'chart' }, actions: [{ type: 'select-source' }], cooldownMs: 60000 * (i + 1), lastFiredAt: '' })),
			[S.integrationProfiles]: [0, 1, 2].map((i)=>({ id: `integ-${i}`, kind: 'websearch', engine: ['tavily', 'brave', 'searxng'][i], baseUrl: i === 2 ? 'http://127.0.0.1:8080' : '', apiKey: '', apiKeyRedacted: true, enabled: i === 0, name: `档 ${i}` })),
		};
		for(let i = 0; i < NEW_STORES.length; i++){
			const name = NEW_STORES[i];
			for(let j = 0; j < seed[name].length; j++){
				// eslint-disable-next-line no-await-in-loop
				await store.putStoreRecord(name, seed[name][j], name);
			}
		}
		const dump = await collectAiWorkspaceDump();
		NEW_STORES.forEach((name)=>{ expect((dump.stores[name] || []).length).toBe(3); });
		// 清库后恢复
		for(let i = 0; i < NEW_STORES.length; i++){
			// eslint-disable-next-line no-await-in-loop
			await store.clearStore(NEW_STORES[i]);
			// eslint-disable-next-line no-await-in-loop
			expect(await store.countStoreRecords(NEW_STORES[i])).toBe(0);
		}
		const results = await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, aiWorkspace: dump });
		expect(results.find((r)=>r.key === 'aiWorkspace').ok).toBe(true);
		for(let i = 0; i < NEW_STORES.length; i++){
			const name = NEW_STORES[i];
			const dumped = dump.stores[name];
			for(let j = 0; j < dumped.length; j++){
				// eslint-disable-next-line no-await-in-loop
				const cur = await store.getStoreRecord(name, dumped[j].id);
				expect(cur).toEqual(expect.objectContaining(dumped[j]));
			}
		}
	});
});
