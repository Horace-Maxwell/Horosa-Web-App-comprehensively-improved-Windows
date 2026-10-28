// 统一全量备份全链路:manifest 构建→zip 往返→校验矩阵→预览→恢复(合并/替换/id-并集)。
import JSZip from 'jszip';
import {
	buildUnifiedBackupManifest, parseUnifiedBackupBlob, validateUnifiedBackup,
	previewUnifiedRestore, restoreUnifiedBackup,
	UNIFIED_BACKUP_FORMAT, UNIFIED_MANIFEST_NAME,
} from '../unifiedBackup';
import { upsertLocalChart, listLocalCharts } from '../localcharts';
import { currentZiweiSettings } from '../ziweiRecordSettings';
import { upsertLocalCase, listLocalCases } from '../localcases';

const LIFE_KEY = 'horosa.lc.lifeEvents.v1';
// 回收站条目有 30 天保留期(过期的不算还在回收站里):用例里的删除时刻一律相对今天,不写死日期(写死的会随日子过去变成过期)
const pad2 = (n)=>`${Math.floor(n)}`.padStart(2, '0');
const agoStr = (days)=>{ const d = new Date(Date.now() - days * 86400000); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };

function seedAll(){
	upsertLocalChart({ cid: 'local-u-1', name: '备份甲', birth: '1990-01-01 08:00:00', zone: '+08:00', updateTime: '2026-08-01 10:00:00', preserveUpdateTime: true });
	upsertLocalCase({ cid: 'local-case-u-1', event: '备份课', caseType: 'liuyao', divTime: '2026-01-01 10:00:00', zone: '+08:00', updateTime: '2026-08-01 09:00:00', preserveUpdateTime: true });
	window.localStorage.setItem(LIFE_KEY, JSON.stringify({ 'sig-a': [{ id: 'ev1', date: '2020-01-01', kind: 'good', title: '甲事' }] }));
	window.localStorage.setItem('horosa.ai.export.settings.v1', JSON.stringify({ version: 56, prefs: {} }));
	window.localStorage.setItem('HorosaLocalDeepLearn', JSON.stringify({ 'local-u-1': { a: 1 } }));
}

describe('统一全量备份', ()=>{
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

describe('全量备份 v2:注册表驱动全键面 + 回收站 + AI 工作区 + 敏感剥离', ()=>{
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
			{ cid: 'local-t-local', name: '本机垃圾', deletedAt: agoStr(8) },
		]));
		const m = buildUnifiedBackupManifest();
		expect(m.trash.charts).toContain('local-t-local');
		const manifest = {
			format: UNIFIED_BACKUP_FORMAT,
			version: 2,
			trash: {
				charts: JSON.stringify([
					{ cid: 'local-t-local', name: '备份版(须被本机压住)', deletedAt: agoStr(17) },
					{ cid: 'local-t-in', name: '备份来的垃圾', deletedAt: agoStr(7) },
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

// ---- 行动能力四个新 store 随全量备份走 ----
describe('AI 行动能力四 store 往返 + 集成档案剥密', ()=>{
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

describe('全量恢复的设置面:带「设置面完整」标记的包,本机多出的设置键复位默认;迁移标志随数据走', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	it('导出:本机键面读全了才打 settingsComplete', ()=>{
		window.localStorage.setItem('ziweiHuoling', 'zhongzhou');
		expect(buildUnifiedBackupManifest().settingsComplete).toBe(true);
		const spy = jest.spyOn(Storage.prototype, 'key').mockImplementation(()=>{ throw new Error('blocked'); });
		try{
			expect(buildUnifiedBackupManifest().settingsComplete).toBe(false);
		}finally{
			spy.mockRestore();
		}
	});

	it('🔴 来源机为默认的设置项:本机多出的值删掉复位(紫微设置 / 你的紫微设置 / 新盘种子);用户数据、缓存、设备键不动;确认框逐键列出', async ()=>{
		// 来源机:只改过四化流派
		window.localStorage.setItem('ziweiSihuaSchool', 'zhongzhou');
		const manifest = buildUnifiedBackupManifest();
		// 本机:另改过火铃、存了你的紫微设置与新盘种子,还有用户数据 / 缓存 / 设备键
		window.localStorage.clear();
		window.localStorage.setItem('ziweiHuoling', 'quanshu');
		window.localStorage.setItem('ziweiUserSeed', JSON.stringify({ huoling: 'quanshu' }));
		window.localStorage.setItem('horosa.chart.newChartSeeds.v1', JSON.stringify({ values: { zodiacal: 1 } }));
		window.localStorage.setItem('ziweiBrightnessCustom', '{"x":1}');
		window.localStorage.setItem('horosa.localcalc.foo', 'cache');
		window.localStorage.setItem('horosa.shell.zoom', '1.2');
		const rows = previewUnifiedRestore(manifest);
		['ziweiHuoling', 'ziweiUserSeed', 'horosa.chart.newChartSeeds.v1'].forEach((k)=>{
			expect(rows.find((r)=>r.key === k).detail).toContain('复位默认');
		});
		['ziweiBrightnessCustom', 'horosa.localcalc.foo', 'horosa.shell.zoom'].forEach((k)=>{
			expect(rows.find((r)=>r.key === k)).toBeUndefined();
		});
		const results = await restoreUnifiedBackup(manifest);
		expect(results.every((r)=>r.ok)).toBe(true);
		expect(window.localStorage.getItem('ziweiSihuaSchool')).toBe('zhongzhou');
		expect(window.localStorage.getItem('ziweiHuoling')).toBe(null);
		expect(window.localStorage.getItem('ziweiUserSeed')).toBe(null);
		expect(window.localStorage.getItem('horosa.chart.newChartSeeds.v1')).toBe(null);
		expect(window.localStorage.getItem('ziweiBrightnessCustom')).toBe('{"x":1}');
		expect(window.localStorage.getItem('horosa.localcalc.foo')).toBe('cache');
		expect(window.localStorage.getItem('horosa.shell.zoom')).toBe('1.2');
		// 恢复后的紫微设置 = 来源机
		expect(currentZiweiSettings().huoling).toBe('sanhe');
		expect(currentZiweiSettings().sihuaSchool).toBe('zhongzhou');
	});

	it('🔴 账号宫制迁移标志完整恢复也不复位(复位 = 下次登录把账号里早已迁移过的宫制再改一遍)', async ()=>{
		window.localStorage.setItem('ziweiSihuaSchool', 'zhongzhou');
		const manifest = buildUnifiedBackupManifest();
		window.localStorage.clear();
		window.localStorage.setItem('horosaHouseSystemDefaultsVersion', '2');
		expect(previewUnifiedRestore(manifest).find((r)=>r.key === 'horosaHouseSystemDefaultsVersion')).toBeUndefined();
		await restoreUnifiedBackup(manifest);
		expect(window.localStorage.getItem('horosaHouseSystemDefaultsVersion')).toBe('2');
	});
	it('🔴 旧版导出的包(没有新盘种子并入标志)恢复设置后:清掉本机并入标志,恢复回来的旧版同义存储再并入一次', async ()=>{
		window.localStorage.setItem('horosa.chart.newChartSeeds.legacyMerged.v1', '1');
		const legacy = { format: UNIFIED_BACKUP_FORMAT, version: 2, raw: { horosaGuolaoSu28Mode: '3' } };
		await restoreUnifiedBackup(legacy);
		expect(window.localStorage.getItem('horosa.chart.newChartSeeds.legacyMerged.v1')).toBe(null);
		const seeds = require('../newChartSeeds');
		expect(seeds.newChartSeedValue('doubingSu28')).toBe(3);
		expect(window.localStorage.getItem('horosa.chart.newChartSeeds.legacyMerged.v1')).toBe('1');
		// 包里带着标志 / 没恢复任何设置:不动本机标志
		await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, raw: { horosaGuolaoSu28Mode: '2', 'horosa.chart.newChartSeeds.legacyMerged.v1': '1' } });
		expect(window.localStorage.getItem('horosa.chart.newChartSeeds.legacyMerged.v1')).toBe('1');
		await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, raw: {} });
		expect(window.localStorage.getItem('horosa.chart.newChartSeeds.legacyMerged.v1')).toBe('1');
	});
	it('🔴 宿占起宫冻结值随恢复改变时:本机缺键旧命盘先补成本机原口径;包里的旧盘按包的口径(两个方向)', async ()=>{
		const seeds = require('../newChartSeeds');
		const { getLocalChart } = require('../localcharts');
		const env = (charts)=>({ format: 'horosa-local-charts', version: 1, charts });
		// 方向一:本机升级时偏好是八字(冻结 0),恢复旧版包(偏好上升、无并入标志、无冻结值)
		seeds.__resetNewChartSeedsForTest();
		expect(seeds.newChartSeedRecordMissingValue('houseStartMode')).toBe(0);
		upsertLocalChart({ cid: 'local-old', name: '本机旧盘', birth: '1990-01-01 10:00:00', zone: '+08:00' });
		const oldPkg = { format: UNIFIED_BACKUP_FORMAT, version: 2, charts: env([{ cid: 'pkg-old', name: '包里旧盘', birth: '1991-01-01 10:00:00', zone: '+08:00' }]), raw: { suzhanHouseStartMode: '1' } };
		expect(previewUnifiedRestore(oldPkg).map((r)=>r.key)).toEqual(expect.arrayContaining(['newChartSeeds.backfill.houseStartMode', 'newChartSeeds.remerge']));
		await restoreUnifiedBackup(oldPkg);
		expect(getLocalChart('local-old').houseStartMode).toBe(0);
		expect(getLocalChart('pkg-old').houseStartMode).toBe(1);   // 包里缺键的旧盘导入前按包的口径显式补上
		expect(seeds.newChartSeedRecordMissingValue('houseStartMode')).toBe(1);   // 按包的口径写定
		expect(seeds.newChartSeedValue('houseStartMode')).toBe(1);
		// 方向二:本机冻结 1,恢复新版包(冻结 0、带并入标志)
		window.localStorage.clear();
		seeds.__resetNewChartSeedsForTest();
		window.localStorage.setItem('suzhanHouseStartMode', '1');
		expect(seeds.newChartSeedRecordMissingValue('houseStartMode')).toBe(1);
		upsertLocalChart({ cid: 'a-old', name: 'A 机旧盘', birth: '1992-01-01 10:00:00', zone: '+08:00' });
		const newPkg = { format: UNIFIED_BACKUP_FORMAT, version: 2, charts: env([{ cid: 'b-old', name: 'B 机旧盘', birth: '1993-01-01 10:00:00', zone: '+08:00' }]),
			raw: { 'horosa.chart.newChartSeeds.recordMissing.v1': JSON.stringify({ houseStartMode: 0 }), 'horosa.chart.newChartSeeds.legacyMerged.v1': '1' } };
		await restoreUnifiedBackup(newPkg);
		expect(getLocalChart('a-old').houseStartMode).toBe(1);
		expect(getLocalChart('b-old').houseStartMode).toBe(0);
		expect(seeds.newChartSeedRecordMissingValue('houseStartMode')).toBe(0);
		// 旧版包里没有任何旧仓键(来源机从没改过):不清并入标志;口径 = 缺省(与本机同,不补记),冻结值照样写定;
		// 包的口径已知 → 恒记 pkgCaliber(同 cid 合并时包里那版缺键也按包的口径)
		const plain = seeds.planNewChartSeedsRestore({ ziweiHuoling: 'nanpai' });
		expect(plain).toEqual({ clearFlag: false, refreeze: [], backfill: {}, freeze: { houseStartMode: 0 }, pkgCaliber: { houseStartMode: 0 }, keepLocal: {} });
		// 冻结值坏了(字符串):按种子值覆盖写
		window.localStorage.setItem('horosa.chart.newChartSeeds.recordMissing.v1', JSON.stringify({ houseStartMode: '1' }));
		expect(seeds.newChartSeedRecordMissingValue('houseStartMode')).toBe(seeds.newChartSeedValue('houseStartMode'));
		expect(typeof JSON.parse(window.localStorage.getItem('horosa.chart.newChartSeeds.recordMissing.v1')).houseStartMode).toBe('number');
	});
	it('老包(没有标记)一律不复位;校验和不符被跳过的键算「包里有」,不复位', async ()=>{
		window.localStorage.setItem('ziweiHuoling', 'quanshu');
		const legacy = { format: UNIFIED_BACKUP_FORMAT, version: 2, raw: { ziweiSihuaSchool: 'zhongzhou' } };
		expect(previewUnifiedRestore(legacy).find((r)=>r.key === 'ziweiHuoling')).toBeUndefined();
		await restoreUnifiedBackup(legacy);
		expect(window.localStorage.getItem('ziweiHuoling')).toBe('quanshu');
		// 新包:ziweiHuoling 在包里但该键校验和不符 → 跳过写入,本机值保留
		window.localStorage.setItem('ziweiHuoling', 'sanhe');
		const src = buildUnifiedBackupManifest();
		window.localStorage.setItem('ziweiHuoling', 'quanshu');
		const { buildManifestChecksums } = require('../backupChecksum');
		const checksums = buildManifestChecksums(src);
		checksums.raw.ziweiHuoling = '0'.repeat(64);
		const tampered = { ...src, checksums };
		const results = await restoreUnifiedBackup(tampered);
		expect(results.find((r)=>r.key === 'raw.ziweiHuoling').ok).toBe(false);
		expect(window.localStorage.getItem('ziweiHuoling')).toBe('quanshu');
	});

	it('🔴 晚子时显式选「子初换日(强制)」:迁移标志随包走,新机不再被一次性迁移改成「跟随全局」', async ()=>{
		window.localStorage.setItem('ziweiLateZi', 'zi_chu');
		window.localStorage.setItem('ziweiLateZiMigrated', '1');
		const manifest = buildUnifiedBackupManifest();
		expect(manifest.raw.ziweiLateZiMigrated).toBe('1');
		window.localStorage.clear();   // 新机
		await restoreUnifiedBackup(manifest);
		expect(currentZiweiSettings().lateZi).toBe('zi_chu');
	});

	it('来源机还没迁移的旧默认 zi_chu:包里没有标志 → 本机标志一并复位,仍按旧默认迁移成「跟随全局」', async ()=>{
		window.localStorage.setItem('ziweiLateZi', 'zi_chu');
		const manifest = buildUnifiedBackupManifest();
		expect(manifest.raw.ziweiLateZiMigrated).toBeUndefined();
		window.localStorage.clear();
		window.localStorage.setItem('ziweiLateZiMigrated', '1');   // 本机早迁移过
		await restoreUnifiedBackup(manifest);
		expect(window.localStorage.getItem('ziweiLateZiMigrated')).toBe(null);
		expect(currentZiweiSettings().lateZi).toBe('global');
	});
});

describe('恢复:旧版包的起宫口径 / 删除日志并集 / 补记覆盖面与预览一致', ()=>{
	const seeds = require('../newChartSeeds');
	const lc = require('../localcharts');
	const env = (charts)=>({ format: 'horosa-local-charts', version: 1, charts });
	const LOG = 'horosa.deleted.log.v1';
	beforeEach(()=>{ window.localStorage.clear(); seeds.__resetNewChartSeedsForTest(); });

	test('🔴 本机冻结上升(1),恢复没带起宫键的旧版包(来源机从没改过 = 八字):本机缺键旧盘补成 1,包的口径写定 0', async ()=>{
		window.localStorage.setItem('suzhanHouseStartMode', '1');
		expect(seeds.newChartSeedRecordMissingValue('houseStartMode')).toBe(1);
		upsertLocalChart({ cid: 'mine', name: '本机旧盘', birth: '1990-01-01 10:00:00', zone: '+08:00' });
		const pkg = { format: UNIFIED_BACKUP_FORMAT, version: 2, charts: env([{ cid: 'theirs', name: '包里旧盘', birth: '1991-01-01 10:00:00', zone: '+08:00' }]), raw: { ziweiHuoling: 'nanpai' } };
		expect(previewUnifiedRestore(pkg).map((r)=>r.key)).toContain('newChartSeeds.backfill.houseStartMode');
		await restoreUnifiedBackup(pkg);
		expect(lc.getLocalChart('mine').houseStartMode).toBe(1);
		expect(lc.getLocalChart('theirs').houseStartMode).toBe(0);
		expect(seeds.newChartSeedRecordMissingValue('houseStartMode')).toBe(0);
	});
	test('同 cid:包里那版缺键 → 按包的口径(不留本机补记的值)', async ()=>{
		window.localStorage.setItem('suzhanHouseStartMode', '1');
		seeds.newChartSeedRecordMissingValue('houseStartMode');
		upsertLocalChart({ cid: 'same', name: '同一张', birth: '1990-01-01 10:00:00', zone: '+08:00', updateTime: '2026-01-01 00:00:00', preserveUpdateTime: true });
		const pkg = { format: UNIFIED_BACKUP_FORMAT, version: 2, charts: env([{ cid: 'same', name: '同一张(包里改过名)', birth: '1990-01-01 10:00:00', zone: '+08:00', updateTime: '2026-09-01 00:00:00' }]),
			raw: { 'horosa.chart.newChartSeeds.recordMissing.v1': JSON.stringify({ houseStartMode: 0 }), 'horosa.chart.newChartSeeds.legacyMerged.v1': '1' } };
		await restoreUnifiedBackup(pkg);
		const rec = lc.getLocalChart('same');
		expect(rec.name).toBe('同一张(包里改过名)');
		expect(rec.houseStartMode).toBe(0);
	});
	test('删除日志按条目并集:本机条目保留;包里已在库里的不带回;再恢复同一包不重复', async ()=>{
		window.localStorage.setItem(LOG, JSON.stringify([{ store: 'chart', purgedAt: '2026-09-02 10:00:00', record: { cid: 'local-del', name: '本机删的' } }]));
		upsertLocalChart({ cid: 'back-in-lib', name: '已找回', birth: '1990-01-01 10:00:00', zone: '+08:00' });
		const pkgLog = [
			{ store: 'chart', purgedAt: '2026-09-03 10:00:00', record: { cid: 'pkg-del', name: '包里删的' } },
			{ store: 'chart', purgedAt: '2026-08-01 10:00:00', record: { cid: 'back-in-lib', name: '已找回' } },
			{ store: 'case', purgedAt: '2026-08-02 10:00:00', record: { cid: 'case-del', event: '课' } },
			{ store: 'chart', purgedAt: '2026-08-03 10:00:00' },
		];
		const pkg = { format: UNIFIED_BACKUP_FORMAT, version: 2, raw: { [LOG]: JSON.stringify(pkgLog) } };
		expect(previewUnifiedRestore(pkg).find((r)=>r.key === LOG).detail).toContain('与本机合并');
		await restoreUnifiedBackup(pkg);
		const ids = ()=>JSON.parse(window.localStorage.getItem(LOG)).map((e)=>e.record && e.record.cid);
		expect(ids()).toEqual(['pkg-del', 'local-del', 'case-del']);
		await restoreUnifiedBackup(pkg);
		expect(ids()).toEqual(['pkg-del', 'local-del', 'case-del']);
	});
	test('补记覆盖删除日志里的本库记录;本机一张缺键旧盘都没有时预览不列补记行;预览列了这一行,结果就有这一行(条数同一判据)', async ()=>{
		window.localStorage.setItem('suzhanHouseStartMode', '1');
		seeds.newChartSeedRecordMissingValue('houseStartMode');
		const pkg = { format: UNIFIED_BACKUP_FORMAT, version: 2, raw: { ziweiHuoling: 'nanpai' } };
		expect(previewUnifiedRestore(pkg).map((r)=>r.key)).not.toContain('newChartSeeds.backfill.houseStartMode');
		expect((await restoreUnifiedBackup(pkg)).map((r)=>r.key)).not.toContain('newChartSeeds.backfill.houseStartMode');
		window.localStorage.clear(); seeds.__resetNewChartSeedsForTest();
		window.localStorage.setItem('suzhanHouseStartMode', '1');
		seeds.newChartSeedRecordMissingValue('houseStartMode');
		window.localStorage.setItem(LOG, JSON.stringify([{ store: 'chart', purgedAt: '2026-09-02 10:00:00', record: { cid: 'gone', name: '删了的旧盘' } }, { store: 'case', purgedAt: '2026-09-02 10:00:00', record: { cid: 'c' } }]));
		expect(lc.countLocalChartsMissingField('houseStartMode')).toBe(1);
		expect(previewUnifiedRestore(pkg).map((r)=>r.key)).toContain('newChartSeeds.backfill.houseStartMode');
		const results = await restoreUnifiedBackup(pkg);
		const row = results.find((r)=>r.key === 'newChartSeeds.backfill.houseStartMode');
		expect(row && row.ok).toBe(true);   // 此前结果只数主库(0 张)→ 这一行没有
		expect(row.detail).toContain('本机 1 张旧命盘');
		const log = JSON.parse(window.localStorage.getItem(LOG));
		expect(log.find((e)=>e.record.cid === 'gone').record.houseStartMode).toBe(1);
		expect(log.find((e)=>e.record.cid === 'c').record.houseStartMode).toBeUndefined();   // 事盘库的条目不动
	});
	test('🔴 包里的冻结值不合法:按包的口径(镜像 / 缺省)取值并写定冻结值,坏值不进导入的命盘', async ()=>{
		const bad = { format: UNIFIED_BACKUP_FORMAT, version: 2, charts: env([{ cid: 'imp', name: '导入的旧盘', birth: '1991-01-01 10:00:00', zone: '+08:00' }]),
			raw: { 'horosa.chart.newChartSeeds.recordMissing.v1': JSON.stringify({ houseStartMode: 7 }), 'horosa.chart.newChartSeeds.legacyMerged.v1': '1', suzhanHouseStartMode: '1' } };
		const plan = seeds.planNewChartSeedsRestore(bad.raw);
		expect(plan.pkgCaliber).toEqual({ houseStartMode: 1 });
		expect(plan.freeze).toEqual({ houseStartMode: 1 });
		await restoreUnifiedBackup(bad);
		expect(lc.getLocalChart('imp').houseStartMode).toBe(1);
		expect(seeds.newChartSeedRecordMissingValue('houseStartMode')).toBe(1);
		// 显式 null 同样按包的口径,不写 null 进记录
		const nul = seeds.planNewChartSeedsRestore({ 'horosa.chart.newChartSeeds.recordMissing.v1': JSON.stringify({ houseStartMode: null }), 'horosa.chart.newChartSeeds.legacyMerged.v1': '1' });
		expect(nul.pkgCaliber).toEqual({ houseStartMode: 0 });
		// 合法值路径不变
		expect(seeds.planNewChartSeedsRestore({ 'horosa.chart.newChartSeeds.recordMissing.v1': JSON.stringify({ houseStartMode: 1 }), 'horosa.chart.newChartSeeds.legacyMerged.v1': '1' }).freeze).toEqual({});
	});
	test('同 cid 合并:包的口径等于本机冻结值时,包里那版缺键同样按包的口径(结果不随无关的本机冻结值翻转)', async ()=>{
		// 本机冻结 0 = 包 0;本机同 cid 那张显式带 1(升级后重存过)
		seeds.newChartSeedRecordMissingValue('houseStartMode');
		upsertLocalChart({ cid: 'same2', name: '本机版', birth: '1990-01-01 10:00:00', zone: '+08:00', houseStartMode: 1, updateTime: '2026-01-01 00:00:00', preserveUpdateTime: true });
		const pkg = { format: UNIFIED_BACKUP_FORMAT, version: 2, charts: env([{ cid: 'same2', name: '包里版', birth: '1990-01-01 10:00:00', zone: '+08:00', updateTime: '2026-09-01 00:00:00' }]),
			raw: { 'horosa.chart.newChartSeeds.recordMissing.v1': JSON.stringify({ houseStartMode: 0 }), 'horosa.chart.newChartSeeds.legacyMerged.v1': '1' } };
		await restoreUnifiedBackup(pkg);
		const rec = lc.getLocalChart('same2');
		expect([rec.name, rec.houseStartMode]).toEqual(['包里版', 0]);
	});
	test('设置面没读全的新版包(settingsComplete:false)缺冻结值 / 并入标志:不当旧版包,口径按未知处理(写定本机原来的取值)', ()=>{
		const plan = seeds.planNewChartSeedsRestore({ ziweiHuoling: 'nanpai' }, { settingsComplete: false });
		// 口径未知一律写定本机原来的取值(幂等;本机缺键旧盘不翻),不补记、不记包的口径
		expect(plan.freeze).toEqual({ houseStartMode: seeds.peekNewChartSeedRecordMissingValue('houseStartMode') });
		expect(plan.keepLocal).toEqual({ houseStartMode: true });
		expect(plan.pkgCaliber).toEqual({});
		expect(plan.backfill).toEqual({});
		expect(seeds.planNewChartSeedsRestore({ ziweiHuoling: 'nanpai' }, { settingsComplete: true }).freeze).toEqual({ houseStartMode: 0 });
	});
	test('删除日志并集:本机条目全留,剩余容量才放包里的;回收站同口径', async ()=>{
		const day = (i)=>`2026-0${1 + Math.floor(i / 28) % 9}-${`${1 + i % 28}`.padStart(2, '0')} 10:00:00`;
		const local = Array.from({ length: 495 }, (_, i)=>({ store: 'chart', purgedAt: `2025-01-01 00:${`${Math.floor(i / 60)}`.padStart(2, '0')}:${`${i % 60}`.padStart(2, '0')}`, record: { cid: `L${i}` } }));
		window.localStorage.setItem(LOG, JSON.stringify(local));
		const pkgLog = Array.from({ length: 20 }, (_, i)=>({ store: 'chart', purgedAt: day(i), record: { cid: `P${i}` } }));
		await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, raw: { [LOG]: JSON.stringify(pkgLog) } });
		const ids = JSON.parse(window.localStorage.getItem(LOG)).map((e)=>e.record.cid);
		expect(ids.length).toBe(500);
		expect(ids.filter((x)=>x[0] === 'L').length).toBe(495);   // 此前按时刻截 500:包里 20 条更新的挤掉本机 15 条
		expect(ids.filter((x)=>x[0] === 'P').length).toBe(5);
		const TRASH = 'horosa.localCharts.trash.v1';
		const lt = Array.from({ length: 200 }, (_, i)=>({ cid: `t${i}`, name: `t${i}`, deletedAt: agoStr(5 + i / 100) }));
		window.localStorage.setItem(TRASH, JSON.stringify(lt));
		await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, trash: { charts: JSON.stringify([{ cid: 'new1', name: 'n', deletedAt: agoStr(1) }]) } });
		const tr = JSON.parse(window.localStorage.getItem(TRASH)).map((r)=>r.cid);
		expect(tr.length).toBe(200);
		expect(tr.indexOf('new1')).toBe(-1);
	});
	test('删除日志并集:本机日志里有更晚删除(找回过又删了)的,包里那条不带回;回收站里正躺着的照样带回', async ()=>{
		window.localStorage.setItem('horosa.localCharts.trash.v1', JSON.stringify([{ cid: 'in-trash', name: '回收站里', deletedAt: agoStr(3) }]));
		window.localStorage.setItem(LOG, JSON.stringify([{ store: 'chart', purgedAt: '2026-10-02 10:00:00', record: { cid: 'x' } }]));
		const pkgLog = [
			{ store: 'chart', purgedAt: '2026-09-01 10:00:00', record: { cid: 'x' } },   // 本机 10-02 又删过一次 → 不带回
			{ store: 'chart', purgedAt: '2026-08-01 10:00:00', record: { cid: 'in-trash' } },   // 正在本机回收站里 → 不带回
			{ store: 'chart', purgedAt: '2026-10-05 10:00:00', record: { cid: 'x2' } },
			{ store: 'case', purgedAt: '2026-08-01 10:00:00', record: { cid: 'in-trash' } },   // 事盘库不受命盘回收站影响
		];
		await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, raw: { [LOG]: JSON.stringify(pkgLog) } });
		const got = JSON.parse(window.localStorage.getItem(LOG)).map((e)=>`${e.store}:${e.record.cid}@${e.purgedAt.slice(0, 10)}`);
		// 本机回收站里正躺着的那条不再拦(两边同一条的去重在找回动作时做,日志寿命不被回收站 30 天截短)
		expect(got).toEqual(['chart:x2@2026-10-05', 'chart:x@2026-10-02', 'chart:in-trash@2026-08-01', 'case:in-trash@2026-08-01']);
	});
	test('并集合并写不进(空间不足):结果写「没能保存(可能是存储空间不足)」,不报「数据形状异常」;形状不对照旧', async ()=>{
		const realSet = Storage.prototype.setItem;
		const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v){
			if(k === LOG){ const e = new Error('full'); e.name = 'QuotaExceededError'; e.code = 22; throw e; }
			return realSet.call(this, k, v);
		});
		try{
			const res = await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, raw: { [LOG]: JSON.stringify([{ store: 'chart', purgedAt: '2026-10-05 10:00:00', record: { cid: 'q' } }]) } });
			const row = res.find((r)=>r.key === LOG);
			expect(row.ok).toBe(false);
			expect(row.detail).toBe('没能保存（可能是存储空间不足）');
		}finally{ spy.mockRestore(); }
		const res2 = await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, raw: { [LOG]: '{"not":"array"}' } });
		expect(res2.find((r)=>r.key === LOG).detail).toBe('数据格式不对，已跳过');
	});
	test('补记覆盖历史版本:恢复时本机旧盘的历史快照同样补成本机原口径(「恢复为副本」不改口径)', async ()=>{
		const rv = require('../recordRevisions');
		rv.__resetRevisionsForTests();
		window.localStorage.setItem('suzhanHouseStartMode', '1');
		seeds.newChartSeedRecordMissingValue('houseStartMode');
		upsertLocalChart({ cid: 'hist', name: '有历史的旧盘', birth: '1990-01-01 10:00:00', zone: '+08:00' });
		await rv.pushRecordRevision('chart', { cid: 'hist', name: '有历史的旧盘(旧版)', birth: '1990-01-01 10:00:00' });
		await rv.pushRecordRevision('case', { cid: 'hist', event: '同 cid 的事盘' });
		const pkg = { format: UNIFIED_BACKUP_FORMAT, version: 2, raw: { ziweiHuoling: 'nanpai' } };
		await restoreUnifiedBackup(pkg);
		const revs = await rv.listRecordRevisions('chart', 'hist');
		expect(revs[0].record.houseStartMode).toBe(1);
		const caseRevs = await rv.listRecordRevisions('case', 'hist');
		expect(caseRevs[0].record.houseStartMode).toBeUndefined();
	});
});

describe('恢复:回收站过期条目不算「还在」/ 只在需要时补口径 / 被上限挡下如实报 / 回收站去向判据', ()=>{
	const seeds = require('../newChartSeeds');
	const lc = require('../localcharts');
	const env = (charts)=>({ format: 'horosa-local-charts', version: 1, charts });
	const LOG = 'horosa.deleted.log.v1';
	const TRASH = 'horosa.localCharts.trash.v1';
	const p2 = (n)=>`${n}`.padStart(2, '0');
	const ago = (days)=>{ const d = new Date(Date.now() - days * 86400000); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; };
	beforeEach(()=>{ window.localStorage.clear(); seeds.__resetNewChartSeedsForTest(); });

	test('🔴 回收站里已过期的条目不挡删除日志:包里那条照样带回(此前被挡下,过期条目随后被清 → 两头都没了)', async ()=>{
		window.localStorage.setItem(TRASH, JSON.stringify([{ cid: 'old', name: '过期的', deletedAt: ago(40) }, { cid: 'live', name: '没过期', deletedAt: ago(3) }]));
		const pkgLog = [
			{ store: 'chart', purgedAt: ago(60), record: { cid: 'old' } },
			{ store: 'chart', purgedAt: ago(60), record: { cid: 'live' } },
		];
		await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, raw: { [LOG]: JSON.stringify(pkgLog) } });
		const ids = JSON.parse(window.localStorage.getItem(LOG)).map((e)=>e.record.cid);
		// 没过期的那条也照样带回(回收站里有不再拦;找回动作时去重)
		expect(ids).toEqual(['old', 'live']);
	});
	test('回收站并集:两边过期的都不计、不占容量;备份里已在库里 / 本机之后彻底删过的不带回', async ()=>{
		const local = Array.from({ length: 150 }, (_, i)=>({ cid: `exp${i}`, name: 'x', deletedAt: ago(40) }))
			.concat(Array.from({ length: 50 }, (_, i)=>({ cid: `l${i}`, name: 'x', deletedAt: ago(5) })));
		window.localStorage.setItem(TRASH, JSON.stringify(local));
		upsertLocalChart({ cid: 'back', name: '已找回', birth: '1990-01-01 10:00:00', zone: '+08:00' });
		window.localStorage.setItem(LOG, JSON.stringify([{ store: 'chart', purgedAt: ago(1), record: { cid: 'purged' } }]));
		const pkgTrash = Array.from({ length: 50 }, (_, i)=>({ cid: `p${i}`, name: 'x', deletedAt: ago(4) }))
			.concat([{ cid: 'back', name: 'x', deletedAt: ago(4) }, { cid: 'purged', name: 'x', deletedAt: ago(4) }, { cid: 'pexp', name: 'x', deletedAt: ago(45) }]);
		const res = await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, trash: { charts: JSON.stringify(pkgTrash) } });
		const tr = JSON.parse(window.localStorage.getItem(TRASH)).map((r)=>r.cid);
		expect(tr.filter((c)=>c[0] === 'p' && c !== 'purged' && c !== 'pexp').length).toBe(50);   // 此前过期的本机条目占住容量,包里 50 条全被挤掉
		expect(tr.filter((c)=>c.indexOf('exp') === 0).length).toBe(0);
		expect(tr).not.toContain('back');
		expect(tr).not.toContain('purged');
		expect(tr).not.toContain('pexp');
		expect(res.find((r)=>r.key === 'trash.charts').ok).toBe(true);
	});
	test('被上限挡下的备份条目:预览与结果都写出条数;不超上限时文案照旧', async ()=>{
		const local = Array.from({ length: 500 }, (_, i)=>({ store: 'chart', purgedAt: ago(1 + i / 1000), record: { cid: `L${i}` } }));
		window.localStorage.setItem(LOG, JSON.stringify(local));
		const pkg = { format: UNIFIED_BACKUP_FORMAT, version: 2, raw: { [LOG]: JSON.stringify([{ store: 'chart', purgedAt: ago(0), record: { cid: 'P1' } }, { store: 'chart', purgedAt: ago(0), record: { cid: 'P2' } }]) } };
		expect(previewUnifiedRestore(pkg).find((r)=>r.key === LOG).detail).toContain('备份里 2 条超出上限未并入');
		const res = await restoreUnifiedBackup(pkg);
		expect(res.find((r)=>r.key === LOG).detail).toContain('备份里 2 条超出上限未并入');
		window.localStorage.setItem(LOG, '[]');
		expect(previewUnifiedRestore(pkg).find((r)=>r.key === LOG).detail).not.toContain('超出上限');
	});
	test('包里自带的重复删除日志条目只进一条', async ()=>{
		const e = { store: 'chart', purgedAt: ago(2), record: { cid: 'dup' } };
		await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, raw: { [LOG]: JSON.stringify([e, e]) } });
		expect(JSON.parse(window.localStorage.getItem(LOG)).length).toBe(1);
	});
	test('🔴 恢复本机自己的备份(口径相同):缺键旧盘不补值、不多出历史版本;同 cid 本机显式带不同值时仍按包的口径', async ()=>{
		const rv = require('../recordRevisions');
		rv.__resetRevisionsForTests();
		seeds.newChartSeedRecordMissingValue('houseStartMode');   // 冻结 0
		['a', 'b', 'c'].forEach((cid)=>upsertLocalChart({ cid, name: cid, birth: '1990-01-01 10:00:00', zone: '+08:00', updateTime: '2026-01-01 00:00:00', preserveUpdateTime: true }));
		const manifest = buildUnifiedBackupManifest();
		const before = (await Promise.all(['a', 'b', 'c'].map((cid)=>rv.listRecordRevisions('chart', cid)))).map((l)=>l.length);
		await restoreUnifiedBackup(manifest);
		const after = (await Promise.all(['a', 'b', 'c'].map((cid)=>rv.listRecordRevisions('chart', cid)))).map((l)=>l.length);
		expect(after).toEqual(before);
		expect(lc.getLocalChart('a').houseStartMode).toBeUndefined();
		// 同 cid 本机显式带 1、包的口径 0 那一格 → 按包
		upsertLocalChart({ cid: 'same3', name: '本机版', birth: '1990-01-01 10:00:00', zone: '+08:00', houseStartMode: 1, updateTime: '2026-01-01 00:00:00', preserveUpdateTime: true });
		await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, charts: env([{ cid: 'same3', name: '包里版', birth: '1990-01-01 10:00:00', zone: '+08:00', updateTime: '2026-09-01 00:00:00' }]),
			raw: { 'horosa.chart.newChartSeeds.recordMissing.v1': JSON.stringify({ houseStartMode: 0 }), 'horosa.chart.newChartSeeds.legacyMerged.v1': '1' } });
		expect(lc.getLocalChart('same3').houseStartMode).toBe(0);
	});
	test('校验和不符的冻结值 / 镜像键不当包的口径;设置面没读全的包不清本机并入标志', ()=>{
		const raw = { 'horosa.chart.newChartSeeds.recordMissing.v1': JSON.stringify({ houseStartMode: 1 }), 'horosa.chart.newChartSeeds.legacyMerged.v1': '1' };
		expect(seeds.planNewChartSeedsRestore(raw, { untrustedKeys: ['horosa.chart.newChartSeeds.recordMissing.v1'] }).pkgCaliber).toEqual({});
		expect(seeds.planNewChartSeedsRestore({ suzhanHouseStartMode: '1' }, { untrustedKeys: ['suzhanHouseStartMode'] }).pkgCaliber).toEqual({});
		expect(seeds.planNewChartSeedsRestore({ suzhanHouseStartMode: '1' }).pkgCaliber).toEqual({ houseStartMode: 1 });
		expect(seeds.planNewChartSeedsRestore({ suzhanHouseStartMode: '1' }, { settingsComplete: false }).clearFlag).toBe(false);
		expect(seeds.planNewChartSeedsRestore({ suzhanHouseStartMode: '1' }).clearFlag).toBe(true);
		// 解析不出的冻结值照旧按旧版包推
		expect(seeds.planNewChartSeedsRestore({ 'horosa.chart.newChartSeeds.recordMissing.v1': '{bad', suzhanHouseStartMode: '1' }).pkgCaliber).toEqual({ houseStartMode: 1 });
	});
	test('补记时回收站 / 删除日志写不进:结果行如实报(主库已补)', async ()=>{
		window.localStorage.setItem('suzhanHouseStartMode', '1');
		seeds.newChartSeedRecordMissingValue('houseStartMode');
		window.localStorage.setItem(LOG, JSON.stringify([{ store: 'chart', purgedAt: ago(2), record: { cid: 'gone' } }]));
		const realSet = Storage.prototype.setItem;
		const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v){
			if(k === LOG && `${v}`.indexOf('houseStartMode') >= 0){ const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; }
			return realSet.call(this, k, v);
		});
		try{
			const res = await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, raw: { ziweiHuoling: 'nanpai' } });
			const row = res.find((r)=>r.key === 'newChartSeeds.backfill.houseStartMode');
			expect(row.ok).toBe(false);
			expect(row.detail).toContain('没写进');
		}finally{ spy.mockRestore(); }
	});
});

describe('恢复预览与结果同口径(超上限条数)/ 回收站缺删除时刻 / 坏镜像键 / 补记只算没过期的 / 影子副本', ()=>{
	const seeds = require('../newChartSeeds');
	const LOG = 'horosa.deleted.log.v1';
	const TRASH = 'horosa.localCharts.trash.v1';
	const p2 = (n)=>`${Math.floor(n)}`.padStart(2, '0');
	const ago = (days)=>{ const d = new Date(Date.now() - days * 86400000); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; };
	const env = (charts)=>({ format: 'horosa-local-charts', version: 1, charts });
	const local499 = ()=>Array.from({ length: 499 }, (_, i)=>({ store: 'chart', purgedAt: ago(1 + i / 1000), record: { cid: `L${i}` } }));
	const pkgLogXY = ()=>JSON.stringify([{ store: 'chart', purgedAt: ago(0), record: { cid: 'X' } }, { store: 'chart', purgedAt: ago(0), record: { cid: 'Y' } }]);
	const logDetail = (rows)=>rows.find((r)=>r.key === LOG).detail;
	beforeEach(()=>{ window.localStorage.clear(); seeds.__resetNewChartSeedsForTest(); });

	test('🔴 包里回收站条目被回收站容量挡下:它不在回收站里,日志那条照样要占位 —— 预览与结果都写「1 条超出上限」', async ()=>{
		window.localStorage.setItem(LOG, JSON.stringify(local499()));
		window.localStorage.setItem(TRASH, JSON.stringify(Array.from({ length: 200 }, (_, i)=>({ cid: `t${i}`, name: 'x', deletedAt: ago(2 + i / 1000) }))));
		const pkg = { format: UNIFIED_BACKUP_FORMAT, version: 2, trash: { charts: JSON.stringify([{ cid: 'X', name: 'x', deletedAt: ago(1) }]) }, raw: { [LOG]: pkgLogXY() } };
		const pv = logDetail(previewUnifiedRestore(pkg));
		const res = logDetail(await restoreUnifiedBackup(pkg));
		expect(res).toContain('备份里 1 条超出上限未并入');
		expect(pv).toContain('备份里 1 条超出上限未并入');   // 此前预览把包里每条回收站条目都当「在回收站里」,写 0 条
	});
	test('🔴 回收站段校验和不符(整段跳过):预览同样不算它在回收站里', async ()=>{
		window.localStorage.setItem(LOG, JSON.stringify(local499()));
		const { buildManifestChecksums } = require('../backupChecksum');
		const base = { format: UNIFIED_BACKUP_FORMAT, version: 2, trash: { charts: JSON.stringify([{ cid: 'X', name: 'x', deletedAt: ago(1) }]) }, raw: { [LOG]: pkgLogXY() } };
		const checksums = buildManifestChecksums(base);
		checksums.trash = '0'.repeat(64);
		const pkg = { ...base, checksums };
		const pv = logDetail(previewUnifiedRestore(pkg));
		const res = logDetail(await restoreUnifiedBackup(pkg));
		expect(res).toContain('备份里 1 条超出上限未并入');
		expect(pv).toContain('备份里 1 条超出上限未并入');
	});
	test('🔴 包里命盘与本机同名同生辰被跳过(不在库里):预览同样不算它已在库里', async ()=>{
		window.localStorage.setItem(LOG, JSON.stringify(local499()));
		upsertLocalChart({ cid: 'mine', name: '同名', birth: '1990-01-01 08:00:00', zone: '+08:00' });
		const pkg = { format: UNIFIED_BACKUP_FORMAT, version: 2, charts: env([{ cid: 'X', name: '同名', birth: '1990-01-01 08:00:00', zone: '+08:00' }]), raw: { [LOG]: pkgLogXY() } };
		const pv = logDetail(previewUnifiedRestore(pkg));
		const res = logDetail(await restoreUnifiedBackup(pkg));
		expect(listLocalCharts().map((r)=>r.cid)).not.toContain('X');
		expect(res).toContain('备份里 1 条超出上限未并入');
		expect(pv).toContain('备份里 1 条超出上限未并入');
	});
	test('对照:回收站没满、没有坏段、没被跳过 —— 预览与结果都不写超上限', async ()=>{
		// 本机 498 条 + 包里两条 = 500(回收站里有的那条不再拦,照样进日志)
		window.localStorage.setItem(LOG, JSON.stringify(local499().slice(1)));
		const pkg = { format: UNIFIED_BACKUP_FORMAT, version: 2, trash: { charts: JSON.stringify([{ cid: 'X', name: 'x', deletedAt: ago(1) }]) }, raw: { [LOG]: pkgLogXY() } };
		expect(logDetail(previewUnifiedRestore(pkg))).not.toContain('超出上限');
		expect(logDetail(await restoreUnifiedBackup(pkg))).not.toContain('超出上限');
	});
	test('本机回收站里缺删除时刻 / null 的条目:与回收站清理同口径算过期 —— 不占容量、不挡包里同 cid 的活条目', async ()=>{
		const local = Array.from({ length: 198 }, (_, i)=>({ cid: `l${i}`, name: 'x', deletedAt: ago(3) }))
			.concat([{ cid: 'nodel', name: '缺删除时刻' }, { cid: 'x', name: '本机缺时刻的 x' }, { name: '没 cid、缺时刻' }, null, { name: '没 cid、时刻在期内', deletedAt: ago(2) }]);
		window.localStorage.setItem(TRASH, JSON.stringify(local));
		const res = await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, trash: { charts: JSON.stringify([{ cid: 'x', name: '包里活的 x', deletedAt: ago(1) }]) } });
		const tr = JSON.parse(window.localStorage.getItem(TRASH));
		expect(tr.filter((r)=>r && r.cid === 'x').map((r)=>r.name)).toEqual(['包里活的 x']);
		expect(tr.some((r)=>r && r.cid === 'nodel')).toBe(false);
		expect(tr.some((r)=>r && r.name === '没 cid、缺时刻')).toBe(false);
		expect(tr.some((r)=>r && r.name === '没 cid、时刻在期内')).toBe(true);   // 回收站清理也留着它:同样留着、同样占位
		expect(tr.length).toBe(200);
		expect(res.find((r)=>r.key === 'trash.charts').detail).not.toContain('超出上限');
		// 与打开回收站后的样子一致(打开时不再清掉什么)
		expect(require('../localcharts').listLocalChartsTrash()).toEqual(tr);
	});
	test('冻结值不合法、镜像键那一段也校验和不符:推不出包的口径(不拿坏段补导入的盘;冻结值写定为本机原来的取值);只有坏镜像键的旧版包不清并入标志', ()=>{
		const raw = { 'horosa.chart.newChartSeeds.recordMissing.v1': JSON.stringify({ houseStartMode: 7 }), suzhanHouseStartMode: '1', 'horosa.chart.newChartSeeds.legacyMerged.v1': '1' };
		const bad = seeds.planNewChartSeedsRestore(raw, { untrustedKeys: ['suzhanHouseStartMode'] });
		expect(bad.pkgCaliber).toEqual({});
		expect(bad.freeze).toEqual({ houseStartMode: seeds.newChartSeedRecordMissingValue('houseStartMode') });
		// 对照:镜像键可信 → 按它推、写定冻结值
		const good = seeds.planNewChartSeedsRestore(raw);
		expect(good.pkgCaliber).toEqual({ houseStartMode: 1 });
		expect(good.freeze).toEqual({ houseStartMode: 1 });
		expect(seeds.planNewChartSeedsRestore({ suzhanHouseStartMode: '1' }, { untrustedKeys: ['suzhanHouseStartMode'] }).clearFlag).toBe(false);
		expect(seeds.planNewChartSeedsRestore({ suzhanHouseStartMode: '1' }).clearFlag).toBe(true);
	});
	test('补记的计数只数回收站里没过期的条目;写入全补(30 天线上 / 时钟回拨时不留没补的盘)', ()=>{
		const lc = require('../localcharts');
		window.localStorage.setItem(TRASH, JSON.stringify([{ cid: 'old', name: '过期', deletedAt: ago(40) }, { cid: 'live', name: '没过期', deletedAt: ago(3) }]));
		expect(lc.countLocalChartsMissingField('houseStartMode')).toBe(1);
		expect(lc.backfillLocalChartsMissingField('houseStartMode', 1)).toBe(0);
		const tr = JSON.parse(window.localStorage.getItem(TRASH));
		expect(tr.find((r)=>r.cid === 'live').houseStartMode).toBe(1);
		expect(tr.find((r)=>r.cid === 'old').houseStartMode).toBe(1);
	});
	test('口径未知(冻结值不合法 + 镜像段坏 / 旧版包镜像段坏 / 冻结值整值不可用):冻结值写定为本机原来的取值,本机缺键旧盘恢复后不翻', async ()=>{
		const FROZEN = 'horosa.chart.newChartSeeds.recordMissing.v1';
		const FLAG = 'horosa.chart.newChartSeeds.legacyMerged.v1';
		const { buildManifestChecksums } = require('../backupChecksum');
		// 本机冻结值 1、镜像 / 种子缺省 0:能区分「保住本机」与「按种子重冻」
		const setLocal = ()=>{ window.localStorage.clear(); seeds.__resetNewChartSeedsForTest(); window.localStorage.setItem(FROZEN, JSON.stringify({ houseStartMode: 1 })); window.localStorage.setItem('suzhanHouseStartMode', '0'); };
		setLocal();
		const plan = seeds.planNewChartSeedsRestore({ [FROZEN]: JSON.stringify({ houseStartMode: 7 }), suzhanHouseStartMode: '0' }, { untrustedKeys: ['suzhanHouseStartMode'] });
		expect(plan.freeze).toEqual({ houseStartMode: 1 });
		expect(plan.keepLocal).toEqual({ houseStartMode: true });
		expect([plan.pkgCaliber, plan.backfill]).toEqual([{}, {}]);
		const legacy = seeds.planNewChartSeedsRestore({ suzhanHouseStartMode: '0', ziweiHuoling: 'nanpai' }, { untrustedKeys: ['suzhanHouseStartMode'], settingsComplete: true });
		expect(legacy.freeze).toEqual({ houseStartMode: 1 });
		// 走一遍真实恢复(冻结值不合法 + 镜像段坏):终态冻结值仍是本机的 1,缺键旧盘读到 1
		const run = async (raw, badRaw)=>{
			const base = { format: UNIFIED_BACKUP_FORMAT, version: 2, settingsComplete: true, raw };
			const checksums = buildManifestChecksums(base);
			(badRaw || []).forEach((k)=>{ checksums.raw[k] = '0'.repeat(64); });
			return restoreUnifiedBackup({ ...base, checksums });
		};
		setLocal();
		upsertLocalChart({ cid: 'oldA', name: '缺键旧盘', birth: '1990-01-01 10:00:00', zone: '+08:00' });
		let res = await run({ [FROZEN]: JSON.stringify({ houseStartMode: 7 }), suzhanHouseStartMode: '0', [FLAG]: '1' }, ['suzhanHouseStartMode']);
		expect(JSON.parse(window.localStorage.getItem(FROZEN)).houseStartMode).toBe(1);
		expect(seeds.newChartSeedRecordMissingValue('houseStartMode')).toBe(1);
		expect(res.find((r)=>r.key === FROZEN).detail).toBe('备份里这项不可用，已保留本机原来的取值');
		// 冻结值整值不可用(解析不出 / null / 没有这一键)、校验和对得上、带并入标志:同样保住本机(此前整值写回后按种子 0 重冻)
		for(const bad of ['{bad', 'null', JSON.stringify({ foo: 1 })]){
			setLocal();
			const pv = previewUnifiedRestore({ format: UNIFIED_BACKUP_FORMAT, version: 2, settingsComplete: true, raw: { [FROZEN]: bad, [FLAG]: '1' } });
			expect([bad, pv.find((r)=>r.key === FROZEN).detail]).toEqual([bad, '备份里这项不可用，保留本机原来的取值']);
			res = await run({ [FROZEN]: bad, [FLAG]: '1' });
			expect([bad, seeds.newChartSeedRecordMissingValue('houseStartMode')]).toEqual([bad, 1]);
		}
	});
	test('冻结值整值写回成功、紧接着的写定写不进(空间不足):冻结值那一行写失败,不写「已保留本机原来的取值」', async ()=>{
		const FROZEN = 'horosa.chart.newChartSeeds.recordMissing.v1';
		const FLAG = 'horosa.chart.newChartSeeds.legacyMerged.v1';
		window.localStorage.clear(); seeds.__resetNewChartSeedsForTest();
		window.localStorage.setItem(FROZEN, JSON.stringify({ houseStartMode: 1 }));
		const orig = Storage.prototype.setItem;
		let n = 0;
		const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v){
			if(k === FROZEN){ n += 1; if(n > 1){ const e = new Error('quota'); e.name = 'QuotaExceededError'; e.code = 22; throw e; } }
			return orig.call(this, k, v);
		});
		let res;
		try{
			res = await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, settingsComplete: true, raw: { [FROZEN]: 'null', [FLAG]: '1' } });
		}finally{ spy.mockRestore(); }
		const row = res.find((r)=>r.key === FROZEN);
		expect(n).toBeGreaterThan(1);
		expect(row.ok).toBe(false);
		expect(row.detail).toBe('没能保存（可能是存储空间不足），本机缺这一项的旧命盘可能改按新盘缺省显示');
		// 写得进时照旧
		window.localStorage.clear(); seeds.__resetNewChartSeedsForTest();
		window.localStorage.setItem(FROZEN, JSON.stringify({ houseStartMode: 1 }));
		res = await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, settingsComplete: true, raw: { [FROZEN]: 'null', [FLAG]: '1' } });
		expect(res.find((r)=>r.key === FROZEN)).toMatchObject({ ok: true, detail: '备份里这项不可用，已保留本机原来的取值' });
		expect(seeds.newChartSeedRecordMissingValue('houseStartMode')).toBe(1);
	});
	test('冻结值键每次都写不进:那一键只出一行(整值写回已失败的行补半句,不另起一行);终态仍是本机合法值时写仍按本机原来的取值显示', async ()=>{
		const FROZEN = 'horosa.chart.newChartSeeds.recordMissing.v1';
		const run = async (raw)=>{
			window.localStorage.clear(); seeds.__resetNewChartSeedsForTest();
			window.localStorage.setItem(FROZEN, JSON.stringify({ houseStartMode: 1 }));
			upsertLocalChart({ cid: 'oldQ', name: '缺键旧盘', birth: '1990-01-01 10:00:00', zone: '+08:00' });
			const orig = Storage.prototype.setItem;
			const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v){
				if(k === FROZEN){ const e = new Error('quota'); e.name = 'QuotaExceededError'; e.code = 22; throw e; }
				return orig.call(this, k, v);
			});
			try{ return (await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, settingsComplete: true, raw })).filter((r)=>r.key === FROZEN); }finally{ spy.mockRestore(); }
		};
		// 包里冻结值坏(写回与写定都写不进,终态是本机原来的 1)
		let rows = await run({ [FROZEN]: JSON.stringify({ houseStartMode: 7 }) });
		expect(rows).toMatchObject([{ key: FROZEN, ok: false, detail: '没能保存（可能是存储空间不足）；这一项也没能保存，缺这一项的旧命盘仍按本机原来的取值显示' }]);
		expect(JSON.parse(window.localStorage.getItem(FROZEN))).toEqual({ houseStartMode: 1 });
		// 旧版包(包里没有冻结值;恢复时本机冻结值复位,写定写不进):改写结果里那一行(复位行),终态没有冻结值 → 旧盘读时按新盘缺省重冻
		rows = await run({ suzhanHouseStartMode: '0' });
		expect(rows).toMatchObject([{ key: FROZEN, ok: false, detail: '没能保存（可能是存储空间不足），本机缺这一项的旧命盘可能改按新盘缺省显示' }]);
		// 整值写回写进了包里的坏值(第一次写得进),之后的写定写不进:终态是坏值、读时重冻 → 不能说仍按本机原来的取值显示
		window.localStorage.clear(); seeds.__resetNewChartSeedsForTest();
		window.localStorage.setItem(FROZEN, JSON.stringify({ houseStartMode: 1 }));
		const orig2 = Storage.prototype.setItem;
		let n2 = 0;
		const spy2 = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v){
			if(k === FROZEN){ n2 += 1; if(n2 > 1){ const e = new Error('quota'); e.name = 'QuotaExceededError'; e.code = 22; throw e; } }
			return orig2.call(this, k, v);
		});
		try{ rows = (await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, settingsComplete: true, raw: { [FROZEN]: JSON.stringify({ houseStartMode: 7 }) } })).filter((r)=>r.key === FROZEN); }finally{ spy2.mockRestore(); }
		expect(rows).toMatchObject([{ key: FROZEN, ok: false, detail: '没能保存（可能是存储空间不足），本机缺这一项的旧命盘可能改按新盘缺省显示' }]);
	});
	test('冻结值里有几个键、有的保留本机有的按备份推出:那一行逐键写;全保留 / 全写定照旧', ()=>{
		const { relabelFrozenSeedRow } = require('../unifiedBackup');
		const FROZEN = 'horosa.chart.newChartSeeds.recordMissing.v1';
		const row = (plan, preview, applied)=>{ const rows = [{ key: FROZEN, ok: true, detail: 'x' }, { key: 'other', ok: true, detail: 'y' }]; relabelFrozenSeedRow(rows, plan, preview, applied); return rows; };
		const mixed = { freeze: { houseStartMode: 1, k2: 0 }, keepLocal: { houseStartMode: true } };
		expect(row(mixed, true)[0].detail).toBe('「宿占人事十二宫起宫」备份里不可用，保留本机原来的取值；「k2」按备份里的设置定下来');
		expect(row(mixed, false)[0].detail).toBe('「宿占人事十二宫起宫」备份里不可用，已保留本机原来的取值；「k2」已按备份里的设置定下来');
		expect(row({ freeze: { houseStartMode: 1, k2: 0 }, keepLocal: { houseStartMode: true, k2: true } }, true)[0].detail).toBe('备份里这项不可用，保留本机原来的取值');
		expect(row({ freeze: { houseStartMode: 1 }, keepLocal: {} }, false)[0].detail).toBe('已按备份里的设置定下来');
		expect(row(mixed, false)[1].detail).toBe('y');
		// 写定失败:那一行 ok 置否;结果里没有这一行时补一行失败;预览不看执行回报
		const f = row(mixed, false, { freezeFailed: ['k2'] });
		expect(f[0]).toMatchObject({ ok: false, detail: '没能保存（可能是存储空间不足），本机缺「k2」的旧命盘可能改按新盘缺省显示' });
		const rows2 = [];
		relabelFrozenSeedRow(rows2, { freeze: { houseStartMode: 1 }, keepLocal: {} }, false, { freezeFailed: ['houseStartMode'] });
		expect(rows2).toMatchObject([{ key: FROZEN, ok: false, detail: '没能保存（可能是存储空间不足），本机缺这一项的旧命盘可能改按新盘缺省显示' }]);
		expect(row(mixed, true, { freezeFailed: ['k2'] })[0].ok).toBe(true);
	});
	test('补记在真实恢复里同样补到回收站里已过期的缺键条目(计数为 0 也调,时钟回拨后不翻)', async ()=>{
		const lc = require('../localcharts');
		window.localStorage.setItem('suzhanHouseStartMode', '1');
		expect(seeds.newChartSeedRecordMissingValue('houseStartMode')).toBe(1);
		window.localStorage.setItem(TRASH, JSON.stringify([{ cid: 'expired', name: '只在回收站里、已过期', deletedAt: ago(31) }]));
		expect(lc.countLocalChartsMissingField('houseStartMode')).toBe(0);
		const res = await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, raw: { 'horosa.chart.newChartSeeds.recordMissing.v1': JSON.stringify({ houseStartMode: 0 }), 'horosa.chart.newChartSeeds.legacyMerged.v1': '1' } });
		expect(JSON.parse(window.localStorage.getItem(TRASH)).find((r)=>r.cid === 'expired').houseStartMode).toBe(1);
		expect(res.some((r)=>r.key === 'newChartSeeds.backfill.houseStartMode')).toBe(false);   // 计数为 0:结果行照旧不列
	});
	test('回收站并集写成功后补写影子副本(此前直写主键,主存丢了启动对账会还原成恢复前的回收站)', async ()=>{
		const sm = require('../shadowMirror');
		const spy = jest.spyOn(sm, 'mirrorShadowWrite');
		try{
			await restoreUnifiedBackup({ format: UNIFIED_BACKUP_FORMAT, version: 2, trash: { charts: JSON.stringify([{ cid: 'in', name: 'x', deletedAt: ago(1) }]) } });
			const call = spy.mock.calls.find((c)=>c[0] === TRASH);
			expect(call).toBeTruthy();
			expect(JSON.parse(call[1]).map((r)=>r.cid)).toEqual(['in']);
		}finally{ spy.mockRestore(); }
	});
});

describe('全量恢复:命盘 / 事盘信封与预览同一判据', ()=>{
	beforeEach(()=>{ window.localStorage.clear(); });
	test('信封 format 写错:预览「将跳过」,恢复同样跳过(此前照导,超上限条数也随之对不上);正常信封照导', async ()=>{
		const bad = { format: UNIFIED_BACKUP_FORMAT, version: 2, charts: { format: 'horosa-local-cases', version: 1, charts: [{ cid: 'X', name: 'x', birth: '1990-01-01 08:00:00', zone: '+08:00' }] } };
		expect(previewUnifiedRestore(bad).find((r)=>r.key === 'charts').detail).toBe('备份里这一部分格式不对，将跳过');
		const res = await restoreUnifiedBackup(bad);
		expect(res.find((r)=>r.key === 'charts')).toEqual({ key: 'charts', ok: false, detail: '备份里这一部分格式不对，已跳过', label: '命盘' });
		expect(listLocalCharts().map((r)=>r.cid)).not.toContain('X');
		const good = { ...bad, charts: { ...bad.charts, format: 'horosa-local-charts' } };
		const res2 = await restoreUnifiedBackup(good);
		expect(res2.find((r)=>r.key === 'charts').ok).toBe(true);
		expect(listLocalCharts().map((r)=>r.cid)).toContain('X');
		const badCase = { format: UNIFIED_BACKUP_FORMAT, version: 2, cases: { format: 'horosa-local-charts', version: 1, cases: [{ cid: 'C', event: 'e', divTime: '2020-01-01 10:00:00', zone: '+08:00' }] } };
		const res3 = await restoreUnifiedBackup(badCase);
		expect(res3.find((r)=>r.key === 'cases').detail).toBe('备份里这一部分格式不对，已跳过');
		expect(listLocalCases().map((r)=>r.cid)).not.toContain('C');
	});
});

test('全量恢复预览:命盘 / 事盘导入预览各只算一遍(行与模拟共用),结果不变', ()=>{
	window.localStorage.clear();
	const lc = require('../localcharts');
	const lcs = require('../localcases');
	const a = jest.spyOn(lc, 'previewLocalChartsBackup');
	const b = jest.spyOn(lcs, 'previewLocalCasesBackup');
	try{
		const pkg = { format: UNIFIED_BACKUP_FORMAT, version: 2,
			charts: { format: 'horosa-local-charts', version: 1, charts: [{ cid: 'p1', name: 'p', birth: '1990-01-01 08:00:00', zone: '+08:00' }] },
			cases: { format: 'horosa-local-cases', version: 1, cases: [{ cid: 'c1', event: 'e', divTime: '2020-01-01 10:00:00', zone: '+08:00' }] },
			trash: { charts: JSON.stringify([{ cid: 't1', name: 't', deletedAt: new Date(Date.now() - 86400000).toISOString().slice(0, 19).replace('T', ' ') }]) } };
		const rows = previewUnifiedRestore(pkg);
		expect(a).toHaveBeenCalledTimes(1);
		expect(b).toHaveBeenCalledTimes(1);
		expect(rows.find((r)=>r.key === 'charts').detail).toContain('新增 1 条');
		expect(rows.find((r)=>r.key === 'trash.charts').detail).toContain('与本机合并');
	}finally{ a.mockRestore(); b.mockRestore(); }
});
