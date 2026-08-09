// [首开反卡 2026-08-09] AI 分析页首开「绝不全页转圈」结构金标。
// 病灶(用户 3.7.3 APP 实报):workspaceLoading 的 Spin 包住整个工作区,而 loadWorkspace 串行
// 迁移+8 库全量 getAll —— WKWebView(Mac APP)对大 value store 的 getAll 反序列化极慢且冻主线程,
// 数据逐年累积 → 「打开全页转圈很久」;Chromium(preview)无感 → 典型「preview 好 APP 坏」。
// 根修三件:全页 Spin 摘除 / loadWorkspace 双波(轻库秒收+重库后台) / 重库分批游标+批间让路。
// 本文件把三件锁成机械断言;preflight[206] 绑定同批锚。
import { listStoreRecordsBatched, listStoreRecords, putStoreRecord, AI_ANALYSIS_STORES } from '../aiAnalysisStore';
const fs = require('fs');
const path = require('path');

const MAIN = fs.readFileSync(path.resolve(__dirname, '..', '..', 'components', 'aianalysis', 'AIAnalysisMain.js'), 'utf8');
const strip = (s)=>s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const M = strip(MAIN);

describe('[首开反卡] 结构锁(剥注释)', ()=>{
	test('🔴 全页 Spin 已摘:工作区 Tabs 不得再被 <Spin spinning={workspaceLoading}> 包裹', ()=>{
		expect(M.includes('<Spin spinning={workspaceLoading}>')).toBe(false);
		expect(/\bSpin\b\s*,/.test(M.slice(0, 2000))).toBe(false);   // antd Spin import 已随摘除移除
	});
	test('🔴 loadWorkspace Wave1 不得含重库:materials/conversations 绝不在首波 await 的 Promise.all 里', ()=>{
		const i = M.indexOf('const loadWorkspace');
		const w1End = M.indexOf('setWorkspaceLoading(false)', i);
		const wave1 = M.slice(i, w1End);
		expect(wave1.includes('AI_ANALYSIS_STORES.materials')).toBe(false);
		expect(wave1.includes('AI_ANALYSIS_STORES.conversations')).toBe(false);
		expect(wave1.includes('migrateWorkspaceData')).toBe(false);   // 迁移也不许挡首帧
		// 轻库五件仍在首波(顶栏模型选择/模板/包/夹/组)
		['providerProfiles', 'materialFolders', 'tagGroups', 'templates', 'bundles'].forEach((k)=>{
			expect(wave1.includes(`AI_ANALYSIS_STORES.${k}`)).toBe(true);
		});
	});
	test('🔴 Wave2 序:迁移在 templateVersions 读取之前(migrate 补建版本,先读后迁=模板缺版本)', ()=>{
		const i = M.indexOf('const loadWorkspace');
		const j = M.indexOf('}, [activeConversationId])', i);
		const body = M.slice(i, j);
		const mig = body.indexOf('migrateWorkspaceData()');
		const tv = body.indexOf('AI_ANALYSIS_STORES.templateVersions');
		expect(mig).toBeGreaterThan(-1);
		expect(tv).toBeGreaterThan(mig);
		// 重库走分批游标(WKWebView 反冻关键)
		expect(body.includes('listStoreRecordsBatched(AI_ANALYSIS_STORES.materials')).toBe(true);
	});
});

describe('[首开反卡] listStoreRecordsBatched 行为(内存回退径=与 listStoreRecords 等价)', ()=>{
	test('🔴 分批读与全量读逐条同构;空库返 []', async ()=>{
		const store = AI_ANALYSIS_STORES.materials;
		for(let i = 0; i < 7; i++){
			// eslint-disable-next-line no-await-in-loop
			await putStoreRecord(store, { id: `fo-${i}`, name: `n${i}`, content: 'x'.repeat(100) }, 'material');
		}
		const a = await listStoreRecords(store);
		const b = await listStoreRecordsBatched(store, { batch: 3 });
		const key = (l)=>l.map((r)=>r.id).sort().join(',');
		expect(key(b)).toBe(key(a));
		expect(b.length).toBe(a.length);
	});
});
