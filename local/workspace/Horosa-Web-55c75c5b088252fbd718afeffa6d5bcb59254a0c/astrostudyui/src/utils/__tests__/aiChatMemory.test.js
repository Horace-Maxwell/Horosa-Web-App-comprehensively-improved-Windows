// 事实记忆(A6)合同:启发式候选(我是/我妻子/以后都/不要再/记住 命中;普通句不命中;≤6 条)· 候选入库去重与 FIFO 50 · 确认/停用/删除 · 注入指令只取已确认且启用且主体匹配(本人/全局/当前命主),封顶 1500 · 提炼 JSON → 候选 · 零 aiTools import。
import fs from 'fs';
import path from 'path';
import { extractCandidatesHeuristic, addCandidates, listMemories, confirmMemory, toggleMemory, deleteMemory, buildMemoryDirective, memoryLayer, candidatesFromExtraction, MEMORY_CANDIDATE_MAX, MEMORY_DIRECTIVE_MAX } from '../aiChat/memory';
import { clearStore, AI_ANALYSIS_STORES } from '../aiAnalysisStore';

beforeEach(async ()=>{ await clearStore(AI_ANALYSIS_STORES.workspaceMeta); });

describe('启发式候选', ()=>{
	it('🔴 命中五类句式并分主体;普通提问不命中;同文去重;最多 6 条', ()=>{
		const c = extractCandidatesHeuristic('我是 1990 年生的,我妻子叫李四,以后都用子平法看八字。今年运势如何?');
		expect(c.map((x)=>x.subject.type)).toEqual(['user', 'user', 'global']);
		expect(c[0].text).toContain('我是 1990 年生的');
		expect(c[1].text).toContain('我妻子叫李四');
		expect(c[2].text).toContain('以后都用子平法');
		expect(extractCandidatesHeuristic('帮我看看今年的事业运势')).toEqual([]);
		expect(extractCandidatesHeuristic('记住不要再给我推荐投资。记住不要再给我推荐投资。').length).toBe(1);
		expect(extractCandidatesHeuristic('x'.repeat(5000))).toEqual([]);
	});
});

describe('入库/确认/注入', ()=>{
	it('候选入库去重;FIFO 超 50 丢最旧候选;确认后进已确认;停用不注入;删除即无', async ()=>{
		await addCandidates([{ text: '我妻子叫李四', subject: { type: 'user' } }, { text: '我妻子叫李四', subject: { type: 'user' } }]);
		expect((await listMemories()).length).toBe(1);
		const first = (await listMemories())[0];
		const confirmed = await confirmMemory(first.id, { text: '我妻子叫李四(1990 年生)' });
		const many = Array.from({ length: 55 }, (_, i)=>({ text: `候选${i}`, subject: { type: 'global' } }));
		await addCandidates(many);
		const all = await listMemories();
		expect(all.filter((m)=>m.status === 'candidate').length).toBe(MEMORY_CANDIDATE_MAX);
		expect(all.some((m)=>m.id === first.id)).toBe(true);   // 已确认的不参与候选 FIFO
		expect(confirmed.status).toBe('confirmed');
		expect(buildMemoryDirective(await listMemories())).toBe('- [本人] 我妻子叫李四(1990 年生)');
		await toggleMemory(first.id, false);
		expect(buildMemoryDirective(await listMemories())).toBe('');
		await toggleMemory(first.id, true);
		await deleteMemory(first.id);
		expect((await listMemories()).some((m)=>m.id === first.id)).toBe(false);
	});
	it('🔴 注入指令:只取已确认+启用;命主类只在 subjectCid 匹配时;封顶 1500 从最旧丢;memoryLayer 空 → null;提炼 JSON → 候选(chart 无 cid 回全局)', ()=>{
		const mk = (i, over)=>({ id: `aimem:${i}`, text: `事实${i}`, status: 'confirmed', enabled: true, subject: { type: 'global' }, updatedAt: `2026-09-0${(i % 9) + 1}`, ...over });
		const list = [mk(1), mk(2, { status: 'candidate' }), mk(3, { enabled: false }), mk(4, { subject: { type: 'chart', cid: 'local-1', title: '张三' } }), mk(5, { subject: { type: 'chart', cid: 'local-2' } }), mk(6, { subject: { type: 'user' } })];
		const d = buildMemoryDirective(list, { subjectCid: 'local-1' });
		expect(d.split('\n').sort()).toEqual(['- [全局] 事实1', '- [张三] 事实4', '- [本人] 事实6'].sort());
		expect(buildMemoryDirective(list, {})).not.toContain('事实4');
		const big = Array.from({ length: 100 }, (_, i)=>mk(i + 10, { text: 'y'.repeat(100), updatedAt: `2026-01-${(i % 28) + 1 < 10 ? '0' : ''}${(i % 28) + 1}` }));
		expect(buildMemoryDirective(big).length).toBeLessThanOrEqual(MEMORY_DIRECTIVE_MAX);
		expect(memoryLayer([])).toBe(null);
		expect(memoryLayer(list, { subjectCid: 'local-1' }).priority).toBe(101);
		const cands = candidatesFromExtraction({ items: [{ subject: 'user', text: '我住在上海' }, { subject: 'chart', text: '命主是老师' }, { text: '' }, null] }, { subjectCid: '', subjectTitle: '' });
		expect(cands.map((c)=>c.subject.type)).toEqual(['user', 'global']);
		expect(candidatesFromExtraction({ items: [{ subject: 'chart', text: '命主是老师' }] }, { subjectCid: 'local-1', subjectTitle: '张三' })[0].subject).toEqual({ type: 'chart', cid: 'local-1', title: '张三' });
	});
	it('memory.js / persona.js 零 aiTools import(口径记忆不得成为工具面)', ()=>{
		const dir = path.resolve(__dirname, '..', 'aiChat');
		['memory.js', 'persona.js'].forEach((f)=>{ const src = fs.readFileSync(path.join(dir, f), 'utf8'); expect(/aiTools\//.test(src)).toBe(false); expect(/registerTool\(/.test(src)).toBe(false); });
	});
});
