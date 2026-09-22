// [P0-1 计量底座] 稳定层指纹:同一 fixture 两次 buildContextLayers(Date.now 打桩不同时刻、对话历史与检索片段不同)
// → 非挥发层 join 逐字节相等且 hashPromptText 相等(=上游前缀缓存可命中的单元),挥发层不同;
// hashPromptText 为纯函数(FNV-1a 32 位,8 位 hex,已知向量钉死);发送路径的稳定/挥发划分字面哨兵锁死。
import fs from 'fs';
import path from 'path';
import {
	AI_CONTEXT_MAX_CHARS,
	buildContextLayers,
	clipContextLayersDetailed,
	hashPromptText,
} from '../aiAnalysisContext';

// 与 AIAnalysisMain.buildResolvedPrompt 同一划分与同一 join 式
const VOLATILE_KEYS = { 'retrieved-context': 1, 'recent-history': 1 };
const joinLayers = (arr)=>arr.map((item)=>`${item.title}\n${item.content}`).join('\n\n').trim();

function buildOnce({ now, history, chunks }){
	const spy = jest.spyOn(Date, 'now').mockReturnValue(now);
	try{
		const layers = buildContextLayers({
			sourceContext: { title: '测试案例', content: '[起盘信息]\n甲子年乙丑月丙寅日丁卯时\n[四柱]\n甲子 乙丑 丙寅 丁卯', after23NewDay: true, lateZiHourUseNextDay: false },
			techniqueContexts: [
				{ key: 'bazi', title: '八字', content: '[命局]\n八字快照正文。'.repeat(40) },
				{ key: 'ziwei', title: '紫微斗数', content: '[命宫]\n紫微快照正文。'.repeat(40) },
			],
			materials: [{ id: 'm1', name: '资料一', extractedText: '资料正文。'.repeat(30), retrievedOnly: false }],
			bundles: [{ id: 'b1', name: '组合甲', defaultSystemPrompt: '组合系统提示' }],
			templates: [{ id: 't1', name: '回复模版', format: 'text', content: '请按以下结构输出' }],
			retrievedChunks: chunks,
			conversationMessages: history,
			systemPrompt: '你是测试系统提示',
		});
		const detail = clipContextLayersDetailed(layers, { maxChars: AI_CONTEXT_MAX_CHARS, fairShare: true });
		return {
			stable: detail.kept.filter((item)=>!VOLATILE_KEYS[item.key]),
			volatile: detail.kept.filter((item)=>VOLATILE_KEYS[item.key]),
		};
	}finally{
		spy.mockRestore();
	}
}

describe('[P0-1] 稳定层指纹', ()=>{
	test('同 fixture 两次构层(不同时刻/历史/检索):稳定层逐字节相等且指纹相等;挥发层不同', ()=>{
		const a = buildOnce({
			now: 1_700_000_000_000,
			history: [{ role: 'user', content: '第一问' }, { role: 'assistant', content: '第一答' }],
			chunks: [{ materialName: '资料一', content: '命中片段甲' }],
		});
		const b = buildOnce({
			now: 1_700_009_999_999,
			history: [{ role: 'user', content: '第一问' }, { role: 'assistant', content: '第一答' }, { role: 'user', content: '追问二' }, { role: 'assistant', content: '再答二' }],
			chunks: [{ materialName: '资料一', content: '命中片段乙(不同)' }],
		});
		const stableA = joinLayers(a.stable);
		const stableB = joinLayers(b.stable);
		expect(stableA.length).toBeGreaterThan(1000);
		expect(stableA).toBe(stableB);
		expect(hashPromptText(stableA)).toBe(hashPromptText(stableB));
		expect(a.stable.map((l)=>l.key)).toEqual(b.stable.map((l)=>l.key));
		// 挥发层:检索命中与近期对话各在,内容不同
		expect(a.volatile.map((l)=>l.key).sort()).toEqual(['recent-history', 'retrieved-context']);
		expect(b.volatile.map((l)=>l.key).sort()).toEqual(['recent-history', 'retrieved-context']);
		const volA = joinLayers(a.volatile);
		const volB = joinLayers(b.volatile);
		expect(volA).not.toBe(volB);
		expect(hashPromptText(volA)).not.toBe(hashPromptText(volB));
		// 稳定层里绝不夹带挥发内容
		expect(stableA.indexOf('命中片段')).toBe(-1);
		expect(stableA.indexOf('第一问')).toBe(-1);
	});

	test('window 模式(空 conversationMessages)只有检索层是挥发层;无检索时挥发层为空,稳定层仍逐字节相同', ()=>{
		const a = buildOnce({ now: 1, history: [], chunks: [] });
		const b = buildOnce({ now: 2, history: [], chunks: [{ materialName: '资料一', content: '命中片段' }] });
		expect(a.volatile).toEqual([]);
		expect(b.volatile.map((l)=>l.key)).toEqual(['retrieved-context']);
		expect(joinLayers(a.stable)).toBe(joinLayers(b.stable));
	});

	test('hashPromptText:FNV-1a 32 位纯函数,8 位 hex,已知向量钉死,不同输入不同值', ()=>{
		expect(hashPromptText('')).toBe('811c9dc5');
		expect(hashPromptText('a')).toBe('e40c292c');
		expect(hashPromptText('foobar')).toBe('bf9cf968');
		expect(hashPromptText(null)).toBe('811c9dc5');
		expect(hashPromptText(undefined)).toBe('811c9dc5');
		const cjk = '甲子年乙丑月丙寅日丁卯时,命宫在午。'.repeat(100);
		const h1 = hashPromptText(cjk);
		expect(h1).toMatch(/^[0-9a-f]{8}$/);
		expect(hashPromptText(cjk)).toBe(h1);
		expect(hashPromptText(`${cjk} `)).not.toBe(h1);
		expect(hashPromptText('ab')).not.toBe(hashPromptText('ba'));
	});

	// [Q-061] 组合系统提示此前三通道注入(一键应用写会话规则 + resolveReferenceItems 拼进系统提示层 + 独立层)
	// ⇒ 一键应用后同一段话在提示词里出现 3 次、只「加入参考」也 2 次。现在只留独立层一条,且与会话规则去重。
	test('🔴 组合系统提示只注入一次:已在会话规则里就不再出独立层', ()=>{
		const BP = '你是子平派命理师,先看格局再看用神。';
		const bundle = { id: 'b1', name: '子平组合', defaultSystemPrompt: BP };
		const base = { sourceContext: null, techniqueContexts: [], materials: [], templates: [], retrievedChunks: [], conversationMessages: [] };
		// 「一键应用」= 会话规则里已有这段 → 不再出 bundle-system 层
		const applied = buildContextLayers({ ...base, bundles: [bundle], systemPrompt: BP });
		expect(applied.filter((l)=>l.key === 'bundle-system:b1').length).toBe(0);
		expect(applied.map((l)=>`${l.content}`).join('\n').split(BP).length - 1).toBe(1);
		// 判别向量:只「加入参考」(会话规则是别的话)→ 独立层照出,且全篇仍只一份
		const refOnly = buildContextLayers({ ...base, bundles: [bundle], systemPrompt: '你是星阙助手。' });
		expect(refOnly.filter((l)=>l.key === 'bundle-system:b1').length).toBe(1);
		expect(refOnly.map((l)=>`${l.content}`).join('\n').split(BP).length - 1).toBe(1);
	});

});
