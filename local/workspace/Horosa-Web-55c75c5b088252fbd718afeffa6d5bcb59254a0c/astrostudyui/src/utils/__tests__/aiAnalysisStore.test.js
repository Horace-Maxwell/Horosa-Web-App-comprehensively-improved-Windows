import {
	AI_ANALYSIS_SCHEMA_VERSION,
	AI_ANALYSIS_STORES,
	buildTimestampLabel,
	loadUiPrefs,
	migrateRecord,
	saveUiPrefs,
} from '../aiAnalysisStore';

describe('aiAnalysisStore ui prefs', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	test('saveUiPrefs merges with existing values', ()=>{
		saveUiPrefs({ innerTab: 'analysis' });
		const merged = saveUiPrefs({ modelSelection: 'provider::model' });
		expect(merged).toEqual({
			innerTab: 'analysis',
			modelSelection: 'provider::model',
		});
		expect(loadUiPrefs()).toEqual(merged);
	});

	test('buildTimestampLabel returns compact local label', ()=>{
		expect(buildTimestampLabel('2026-04-04T12:34:56.000Z')).toMatch(/^2026-04-04 \d{2}:\d{2}$/);
	});

	test('migrateRecord upgrades legacy provider profile with preset defaults', ()=>{
		const migrated = migrateRecord(AI_ANALYSIS_STORES.providerProfiles, {
			id: 'provider-legacy',
			providerType: 'deepseek',
			manualModels: [],
			availableModels: [],
			providerOptions: {},
			schemaVersion: 2,
		});
		expect(migrated.protocolFamily).toBe('openai-compatible');
		expect(migrated.name).toBe('DeepSeek');
		// [C3] 2026-07 现役目录(v4 置顶,别名暂留兼容),迁移取键与 preset 单源;2026-09-11 官方新名 deepseek-flash 置首。
		expect(migrated.chatModelIds).toEqual(['deepseek-flash', 'deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner']);
		expect(migrated.embeddingModelIds).toEqual([]);
		expect(migrated.providerOptions.requestTimeoutMs).toBe(120000);
		expect(migrated.healthStatus).toBe('unknown');
		expect(migrated.schemaVersion).toBe(AI_ANALYSIS_SCHEMA_VERSION);
	});
});

describe('孤儿 streaming 消息降级(压测实抓 R7:流中刷新后气泡永远「生成中」)', ()=>{
	const { reconcileOrphanStreaming, __resetInFlightMessagesForTests, __markInFlightForTests, ORPHAN_STREAMING_CONTENT } = require('../aiAnalysisStore');
	beforeEach(()=>{ __resetInFlightMessagesForTests(); });
	test('库里 streaming 且本会话未登记为在途 → aborted,空正文补说明,其它字段原样', ()=>{
		const fixed = reconcileOrphanStreaming({ id: 'msg-1', role: 'assistant', streamStatus: 'streaming', content: '', agentTrace: { a: 1 } });
		expect(fixed.streamStatus).toBe('aborted');
		expect(fixed.content).toBe(ORPHAN_STREAMING_CONTENT);
		expect(fixed.agentTrace).toEqual({ a: 1 });
		expect(typeof fixed.updatedAt).toBe('string');
		const partial = reconcileOrphanStreaming({ id: 'msg-2', role: 'assistant', streamStatus: 'streaming', content: '片0 片1' });
		expect(partial.content).toBe('片0 片1');
	});
	test('本会话在途消息(已登记)不动;终态消息不动', ()=>{
		__markInFlightForTests('msg-live');
		expect(reconcileOrphanStreaming({ id: 'msg-live', streamStatus: 'streaming', content: '' })).toBeNull();
		expect(reconcileOrphanStreaming({ id: 'msg-done', streamStatus: 'done', content: 'x' })).toBeNull();
		expect(reconcileOrphanStreaming({ id: 'msg-err', streamStatus: 'error', content: '' })).toBeNull();
		expect(reconcileOrphanStreaming(null)).toBeNull();
	});
});
