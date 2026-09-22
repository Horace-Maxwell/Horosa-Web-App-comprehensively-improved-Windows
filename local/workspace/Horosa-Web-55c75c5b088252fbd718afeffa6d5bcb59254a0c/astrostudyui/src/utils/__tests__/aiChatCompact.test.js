// 对话压缩(A5)合同:applyCompact 只留压缩点之后(无压缩=同引用;分支复制保留 createdAt 自动继承)· 摘要层 key/priority 88 且非 volatile 键 · 压缩输入按时间序折叠工具结果、封顶从最早丢、增量含上次摘要 · 记录归一 · 可压判据 · 自动提醒缺省不提醒。
import { applyCompact, compactLayer, buildCompactInput, compactRecord, canCompact, shouldSuggestCompact, COMPACT_LAYER_PRIORITY, COMPACT_LAYER_KEY, COMPACT_INPUT_MAX_CHARS, clipMessageForCompact, COMPACT_MSG_HEAD_CHARS, COMPACT_MSG_TAIL_CHARS } from '../aiChat/compact';
import { clipContextLayersDetailed, buildContextLayers } from '../aiAnalysisContext';

const msgs = [
	{ id: 'u1', role: 'user', content: '我 1990 年生', createdAt: '2026-09-05T01:00:00Z' },
	{ id: 'a1', role: 'assistant', content: '好的', createdAt: '2026-09-05T01:00:05Z' },
	{ id: 'u2', role: 'user', content: '今年运势', createdAt: '2026-09-05T01:01:00Z' },
	{ id: 'a2', role: 'assistant', content: '平稳', createdAt: '2026-09-05T01:01:05Z', streamStatus: 'done' },
	{ id: 'u3', role: 'user', content: '再说说事业', createdAt: '2026-09-05T01:02:00Z' },
];

describe('applyCompact / compactLayer', ()=>{
	it('🔴 无压缩=原数组同引用;有压缩只留 uptoCreatedAt 之后;摘要层 priority 88、key 固定、非 volatile', ()=>{
		expect(applyCompact(msgs, null)).toBe(msgs);
		expect(applyCompact(msgs, { summary: 's', uptoCreatedAt: '2026-09-05T01:01:05Z' }).map((m)=>m.id)).toEqual(['u3']);
		expect(applyCompact(msgs, { summary: '', uptoCreatedAt: '2026-09-05T01:01:05Z' })).toBe(msgs);
		const layer = compactLayer({ summary: '要点', coveredCount: 4 });
		expect(layer).toEqual({ key: COMPACT_LAYER_KEY, title: '之前的对话摘要(已压缩 4 条)', content: '要点', priority: COMPACT_LAYER_PRIORITY });
		expect(COMPACT_LAYER_PRIORITY).toBe(88);
		expect(compactLayer(null)).toBe(null);
		// 与系统层同进裁剪:88 落在资料(70)与检索(80)之上、模版(90)之下;不属 volatile 键 → 稳定层
		const clip = clipContextLayersDetailed([{ key: 'system', title: 's', content: 'sys', priority: 100 }, layer, { key: 'retrieved-context', title: 'r', content: 'rr', priority: 80 }], { maxChars: 10000 });
		expect(clip.kept.map((l)=>l.key)).toEqual(['system', COMPACT_LAYER_KEY, 'retrieved-context']);
	});
});

describe('buildContextLayers.extraLayers', ()=>{
	it('🔴 摘要层经 extraLayers 进层表并在裁剪后保留(标题进 system 文本);extraLayers 缺省/空/坏项 → 层表与不传时逐字相同', ()=>{
		const base = { sourceContext: null, techniqueContexts: [], materials: [], bundles: [], templates: [], retrievedChunks: [], conversationMessages: [], systemPrompt: '规则' };
		const plain = buildContextLayers(base);
		expect(JSON.stringify(buildContextLayers({ ...base, extraLayers: [] }))).toBe(JSON.stringify(plain));
		expect(JSON.stringify(buildContextLayers({ ...base, extraLayers: [null, { key: 'x' }, { key: 'y', content: '  ', priority: 1 }] }))).toBe(JSON.stringify(plain));
		const withCompact = buildContextLayers({ ...base, extraLayers: [compactLayer({ summary: '命主 1990 年生;关心事业', coveredCount: 8 })] });
		expect(withCompact.some((l)=>l.key === COMPACT_LAYER_KEY)).toBe(true);
		const clip = clipContextLayersDetailed(withCompact, { maxChars: 20000, fairShare: true });
		const joined = clip.kept.map((l)=>`${l.title}\n${l.content}`).join('\n\n');
		expect(joined).toContain('对话摘要');
		expect(joined).toContain('命主 1990 年生');
	});
});

describe('buildCompactInput / compactRecord / canCompact', ()=>{
	it('按时间序、角色前缀;封顶从最早丢(记 dropped);增量带上次摘要;uptoCreatedAt=最后一条;inputHash 稳定', ()=>{
		const a = buildCompactInput(msgs.slice().reverse(), {});
		expect(a.text.split('\n')[1]).toBe('用户:我 1990 年生');
		expect(a.count).toBe(5);
		expect(a.dropped).toBe(0);
		expect(a.uptoCreatedAt).toBe('2026-09-05T01:02:00Z');
		expect(buildCompactInput(msgs, {}).inputHash).toBe(a.inputHash);
		const b = buildCompactInput(msgs, { maxChars: 40 });
		expect(b.dropped).toBeGreaterThan(0);
		expect(b.kept).toBeLessThan(5);
		const c = buildCompactInput(msgs, { prevSummary: '上次:命主 1990 年生' });
		expect(c.text.indexOf('【上次摘要】')).toBe(0);
		expect(c.inputHash).not.toBe(a.inputHash);
		expect(COMPACT_INPUT_MAX_CHARS).toBe(24000);
		// 工具结果信封折叠成摘要而非原样长串
		const tool = [{ role: 'assistant', content: JSON.stringify({ __horosaType: 'toolResult', ok: true, code: null, data: { big: 'x'.repeat(5000) } }), createdAt: '2026-09-05T01:00:00Z' }];
		expect(buildCompactInput(tool, {}).text.length).toBeLessThan(2000);
	});
	it('记录归一:空摘要/无 uptoCreatedAt → null;摘要截 4000;canCompact 主线 ≥4 条;自动提醒阈值缺省不提醒', ()=>{
		expect(compactRecord({ summary: '', uptoCreatedAt: 'x' })).toBe(null);
		expect(compactRecord({ summary: 's', uptoCreatedAt: null })).toBe(null);
		const rec = compactRecord({ summary: 'y'.repeat(5000), uptoCreatedAt: '2026-09-05T01:01:05Z', coveredCount: 4, model: 'm', inputHash: 'h' });
		expect(rec.summary.length).toBe(4000);
		expect(rec.coveredCount).toBe(4);
		expect(typeof rec.at).toBe('string');
		expect(canCompact(msgs, null)).toBe(true);
		expect(canCompact(msgs, { summary: 's', uptoCreatedAt: '2026-09-05T01:01:05Z' })).toBe(false);
		expect(shouldSuggestCompact({ historyTokens: 99999, threshold: null })).toBe(false);
		expect(shouldSuggestCompact({ historyTokens: 5000, threshold: 4000 })).toBe(true);
		expect(shouldSuggestCompact({ historyTokens: 3000, threshold: 4000 })).toBe(false);
	});
});

// ---- [压测二轮·D6·X2] 回退之后再旁问:提示词装配链在「历史被清空 + 压缩点悬空」下不得抛 ----
describe('X2 回退后的提示词装配', ()=>{
	const { planRewind } = require('../aiChat/checkpoint');
	const base = { sourceContext: null, techniqueContexts: [], materials: [], bundles: [], templates: [], retrievedChunks: [], systemPrompt: '【口径】子平' };

	it('X2 回退到第一条 → 主线清空、压缩点悬空:compact/层表/裁剪全链不抛,system 层仍在', ()=>{
		const list = msgs.map((m)=>({ ...m }));
		const compact = { summary: '之前聊过命局', uptoCreatedAt: '2026-09-05T01:01:05Z', coveredCount: 4 };
		const plan = planRewind(list, 'u1', compact);
		expect(plan.removeCount).toBe(list.length);
		expect(plan.clearCompact).toBe(true);
		const remaining = list.filter((m)=>plan.remove.indexOf(m.id) < 0);
		expect(remaining).toEqual([]);
		// 回退把压缩点清掉 → 旁问按「无压缩」装配
		expect(()=>applyCompact(remaining, null)).not.toThrow();
		expect(applyCompact(remaining, null)).toBe(remaining);
		expect(compactLayer(null)).toBe(null);
		const input = buildCompactInput(remaining, {});
		expect(input.count).toBe(0);
		expect(input.uptoCreatedAt).toBe(null);
		expect(canCompact(remaining, null)).toBe(false);
		const layers = buildContextLayers({ ...base, conversationMessages: remaining, extraLayers: [compactLayer(null)] });
		const clip = clipContextLayersDetailed(layers, { maxChars: 20000, fairShare: true });
		expect(clip.kept.some((l)=>l.key === 'system')).toBe(true);
		expect(clip.kept.some((l)=>l.key === COMPACT_LAYER_KEY)).toBe(false);
		expect(clip.kept.map((l)=>`${l.title}\n${l.content}`).join('\n\n')).toContain('子平');
	});

	it('X2b 悬空压缩点(指向已被删掉的消息):主线视图为空但不抛,层表照常可建', ()=>{
		const dangling = { summary: '悬空摘要', uptoCreatedAt: '2026-09-05T09:99:99Z', coveredCount: 4 };
		expect(()=>applyCompact([], dangling)).not.toThrow();
		expect(applyCompact([], dangling)).toEqual([]);
		const stillCompact = { summary: '悬空摘要', uptoCreatedAt: '2026-09-05T23:59:59Z', coveredCount: 4 };
		expect(applyCompact(msgs, stillCompact)).toEqual([]);   // 压缩点在所有消息之后 → 主线空
		const layers = buildContextLayers({ ...base, conversationMessages: [], extraLayers: [compactLayer(stillCompact)] });
		expect(()=>clipContextLayersDetailed(layers, { maxChars: 20000, fairShare: true })).not.toThrow();
		expect(clipContextLayersDetailed(layers, { maxChars: 20000, fairShare: true }).kept.some((l)=>l.key === COMPACT_LAYER_KEY)).toBe(true);
	});
});

// [Q-287/M-102 ④] 压缩输入的每条截断:此前一律 600 字且只留开头 → 长回答的结论(在末尾)永远进不了摘要。
describe('[Q-287] 压缩输入按「留头 + 留尾」截断', ()=>{
	it('短消息原样;长消息头尾都在、中间标注省略字数', ()=>{
		expect(clipMessageForCompact('短')).toBe('短');
		const body = `${'头'.repeat(3000)}结论在最后一句`;
		const out = clipMessageForCompact(body);
		expect(out.slice(0, COMPACT_MSG_HEAD_CHARS)).toBe('头'.repeat(COMPACT_MSG_HEAD_CHARS));
		expect(out.endsWith('结论在最后一句')).toBe(true);
		expect(out).toContain('中间省略');
		expect(out.length).toBeLessThan(COMPACT_MSG_HEAD_CHARS + COMPACT_MSG_TAIL_CHARS + 40);
	});
	it('🔴 buildCompactInput 里长回答的末尾结论仍在(旧实现 600 字硬切后恒丢)', ()=>{
		const msgs = [
			{ id: 'u1', role: 'user', content: '问题', createdAt: '2026-01-01T00:00:00.000Z' },
			{ id: 'a1', role: 'assistant', content: `${'甲'.repeat(2000)}【结论】宜守不宜攻`, createdAt: '2026-01-01T00:01:00.000Z' },
		];
		const out = buildCompactInput(msgs, {});
		expect(out.text).toContain('【结论】宜守不宜攻');
	});
	it('工具结果信封仍走折叠(不按头尾截),普通 JSON 文本不误判', ()=>{
		const envelope = JSON.stringify({ __horosaType: 'toolResult', ok: true, code: 'OK', message: 'm', data: { a: 'x'.repeat(3000) } });
		const folded = clipMessageForCompact(envelope);   // 纯函数不折叠(折叠在 foldSafe 里)
		expect(typeof folded).toBe('string');
		const out = buildCompactInput([{ id: 't', role: 'assistant', content: envelope, createdAt: '2026-01-01T00:00:00.000Z' }], {});
		expect(out.text).toContain('folded');
		const plainJson = JSON.stringify({ a: 'y'.repeat(3000) });
		const out2 = buildCompactInput([{ id: 'p', role: 'assistant', content: plainJson, createdAt: '2026-01-01T00:00:00.000Z' }], {});
		expect(out2.text).toContain('中间省略');
	});
});

