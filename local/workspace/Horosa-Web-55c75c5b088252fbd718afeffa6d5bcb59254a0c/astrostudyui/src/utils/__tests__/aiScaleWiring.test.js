// [P1-S1] 规模面调用点接线的判别向量:光有 store 层的索引删除/清空/上限能力不够——
// 页面(AIAnalysisMain)与统一备份必须真的用上,否则「改了没生效」。
// 一半行为断言(备份采集/恢复真跳过派生缓存),一半源码结构锁(主页组件 AIAnalysisMain 无法在 jsdom 里渲染)。
import fs from 'fs';
import path from 'path';
import { AI_ANALYSIS_STORES, AI_BACKUP_EXCLUDED_STORES, putStoreRecord, listStoreRecords, clearStore } from '../aiAnalysisStore';
import { collectAiWorkspaceDump } from '../unifiedBackup';

const SRC = path.resolve(__dirname, '..', '..');
const readSrc = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');
// 哨兵一律先剥单行注释:注释里复写同一字面量会让否定式假红、肯定式假绿。
const stripComments = (text)=>text.split('\n').map((line)=>line.replace(/\/\/.*$/, '')).join('\n');

describe('[P1-S1] 备份排除派生缓存(行为)', ()=>{
	beforeEach(async ()=>{
		await clearStore(AI_ANALYSIS_STORES.contextCache);
		await clearStore(AI_ANALYSIS_STORES.conversations);
	});

	test('排除集只含 context_cache,且是冻结常量', ()=>{
		expect(AI_BACKUP_EXCLUDED_STORES).toEqual([AI_ANALYSIS_STORES.contextCache]);
		expect(Object.isFrozen(AI_BACKUP_EXCLUDED_STORES)).toBe(true);
	});

	test('🔴 collectAiWorkspaceDump 收会话、不收 context_cache(派生缓存不进备份包)', async ()=>{
		await putStoreRecord(AI_ANALYSIS_STORES.conversations, { id: 'conv-scale-1', title: '规模面' }, 'conv');
		await putStoreRecord(AI_ANALYSIS_STORES.contextCache, { id: 'chart:local-1:full', content: 'x'.repeat(2048) }, 'ctx');
		const dump = await collectAiWorkspaceDump();
		expect(dump).toBeTruthy();
		expect((dump.stores[AI_ANALYSIS_STORES.conversations] || []).length).toBe(1);
		expect(dump.stores[AI_ANALYSIS_STORES.contextCache]).toBeUndefined();
		// 本机缓存不因导出被动过
		expect((await listStoreRecords(AI_ANALYSIS_STORES.contextCache)).length).toBe(1);
	});
});

describe('[P1-S1] 页面与统一备份的接线(源码结构锁)', ()=>{
	const main = stripComments(readSrc('components/aianalysis/AIAnalysisMain.js'));
	const backup = stripComments(readSrc('utils/unifiedBackup.js'));

	test('🔴 按会话/材料/模板删除一律带索引提示(否则退回全表 getAll)', ()=>{
		expect(main).toContain("{ index: 'conversationId', value: conversationId }");
		expect((main.match(/\{ index: 'materialId', value: material/g) || []).length).toBe(4);
		expect(main).toContain("{ index: 'templateId', value: templateId }");
		// 负锚:不得再有「无提示」的同款删除
		expect(main).not.toContain('deleteWhere(AI_ANALYSIS_STORES.messages, (item)=>item.conversationId === conversationId);');
		expect(main).not.toContain('deleteWhere(AI_ANALYSIS_STORES.templateVersions, (item)=>item.templateId === templateId);');
	});

	test('🔴 全清走 clearStore;不再「全表读出逐条删」;[D54] 恢复走 aiWorkspaceRestore(只动包内存在的店)', ()=>{
		const restore = fs.readFileSync(path.resolve(__dirname, '..', 'aiWorkspaceRestore.js'), 'utf8');
		expect(restore).toContain('await d.clearStore(name);');
		expect(main).toContain('restoreWorkspaceStores(plan, { clearStore, bulkPutStoreRecords, listStoreRecords, putStoreRecord');
		expect(main).not.toContain('await clearStore(storeName);');   // 旧循环(对每个已知店一律清)不得回潮
		expect(main).not.toContain('await deleteWhere(storeName, ()=>true);');
	});

	test('🔴 导出/恢复两处都过排除集;统一备份采集与恢复同款', ()=>{
		expect((main.match(/AI_BACKUP_EXCLUDED_STORES\.indexOf\(name\) < 0/g) || []).length).toBe(2);
		expect(backup).toContain('AI_BACKUP_EXCLUDED_STORES.indexOf(n) < 0');
		expect(backup).toContain('AI_BACKUP_EXCLUDED_STORES.indexOf(name) >= 0');
	});

	test('手动「刷新案例」按钮绕过指纹缓存(force),其余读走缓存', ()=>{
		expect(main).toContain('onClick={()=>setSources(listAnalysisSources({ force: true }))}');
		expect(main).toContain('handleClearContextCache');
		expect(main).toContain('countStoreRecords(AI_ANALYSIS_STORES.contextCache)');
	});
});
