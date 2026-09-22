// [P0-2] 离线线束:合成 45k 字挂载 + 20 Turn(每 Turn ≈1k token 回复 + 3 轮×2 调用×≈6000 字结果的 trace)
// → 用 buildContextLayers/clipContextLayersDetailed(system 组装)+ windowChatMessages(窗口)+ expandHistory(回放)
//   纯函数组合复现每 Turn 首轮请求的总字符;不启动 React、不发请求。
// 断言:window 模式(经济档:折叠回放 + 小预算)第 20 Turn ≤ 1.3 × 第 1 Turn;window 缺省档到平台期后逐 Turn 恒等;
// legacy 模式只打印增长曲线(现状,不断言)。
import { windowChatMessages, normalizeContextPolicy } from '../aiChatHistory';
import { expandHistory } from '../aiAgent/protocol';
import { buildContextLayers, clipContextLayersDetailed } from '../aiAnalysisContext';
import { contextCharBudgetForModel } from '../aiAnalysisProviders';

const MODEL = 'deepseek-v4-flash';
const MOUNT = '甲乙丙丁戊己庚辛壬癸'.repeat(4500);   // 45,000 字挂载(稳定层)
const REPLY = '子丑寅卯辰巳午未申酉戌亥'.repeat(134).slice(0, 1600);   // ≈1000 token 回复
const RESULT = JSON.stringify({ __horosaType: 'toolResult', untrusted: true, ok: true, data: { content: `[段一]\n${'木火土金水'.repeat(1190)}` } });
const joinLayers = (arr)=>arr.map((item)=>`${item.title}\n${item.content}`).join('\n\n').trim();

function mkTrace(turn){
	const rounds = [];
	const tt = String(turn).padStart(2, '0');   // 定宽:各 Turn 的 trace 字节数恒等,平台期恒等断言才成立
	for(let r = 0; r < 3; r++){
		const calls = [0, 1].map((k)=>({ id: `t${tt}r${r}c${k}`, name: 'cast_chart', args: { turn: tt, r, k } }));
		rounds.push({
			index: r,
			text: r === 2 ? REPLY : '',
			toolCalls: calls,
			results: calls.map((c)=>({ callId: c.id, name: c.name, level: 'read', content: RESULT, isError: false })),
		});
	}
	return { version: 1, mode: 'native', rounds };
}

function history(turns){
	const out = [];
	for(let i = 1; i <= turns; i++){
		out.push({ role: 'user', content: `问${String(i).padStart(2, '0')}` });
		out.push({ role: 'assistant', content: REPLY, agentTrace: mkTrace(i) });
	}
	return out;
}

function systemFor(mode, hist){
	const layers = buildContextLayers({
		sourceContext: { title: '经济线束', content: MOUNT, after23NewDay: true, lateZiHourUseNextDay: false },
		techniqueContexts: [], materials: [], bundles: [], templates: [], retrievedChunks: [],
		conversationMessages: mode === 'window' ? [] : hist,
		systemPrompt: 'S',
	});
	const detail = clipContextLayersDetailed(layers, { maxChars: contextCharBudgetForModel(MODEL, { floorChars: 20000 }), fairShare: true });
	return joinLayers(detail.kept);
}

function requestChars(msgs){
	return msgs.reduce((acc, m)=>{
		let n = `${m.content || ''}`.length;
		if(Array.isArray(m.toolCalls)){ n += JSON.stringify(m.toolCalls).length; }
		if(Array.isArray(m.toolResults)){ n += m.toolResults.reduce((a, r)=>a + `${r.content || ''}`.length, 0); }
		return acc + n;
	}, 0);
}

function turnRequestChars(k, rawPolicy){
	const policy = normalizeContextPolicy(rawPolicy);
	const hist = history(k - 1);
	const sys = systemFor(policy.historyMode, hist);
	const chat = [{ role: 'system', content: sys }].concat(hist, [{ role: 'user', content: `问${String(k).padStart(2, '0')}` }]);
	const { messages, meta } = windowChatMessages(chat, { model: MODEL, policy });
	const expanded = expandHistory(messages, { traceTurnsFull: policy.traceTurnsFull, traceTurnsFolded: policy.traceTurnsFolded, foldMaxChars: policy.foldedResultMaxChars });
	return { chars: requestChars(expanded), meta, msgs: expanded.length };
}

const TURNS = [1, 2, 5, 10, 15, 20];

describe('[P0-2] token 经济线束', ()=>{
	test('fixture 量级自证:挂载 45k 字、回复 ≈1k token、结果 ≈6000 字', ()=>{
		expect(MOUNT.length).toBe(45000);
		expect(REPLY.length).toBe(1600);
		expect(RESULT.length).toBeGreaterThan(5900);
		expect(RESULT.length).toBeLessThan(6200);
	});

	test('legacy(现状):只打印增长曲线,不断言', ()=>{
		const curve = TURNS.map((k)=>{ const r = turnRequestChars(k, { historyMode: 'legacy' }); return `T${k}=${r.chars}(${r.msgs}msg)`; });
		// eslint-disable-next-line no-console
		console.log(`[aiTokenEconomy] legacy 增长曲线: ${curve.join(' ')}`);
		expect(curve.length).toBe(TURNS.length);
	});

	test('window 经济档(预算 6000 tok + 最近 1 Turn 折叠回放):第 20 Turn 首轮请求总字符 ≤ 1.3 × 第 1 Turn', ()=>{
		const policy = { historyMode: 'window', historyTokenBudget: 6000, traceTurnsFull: 0, traceTurnsFolded: 1 };
		const t1 = turnRequestChars(1, policy);
		const t20 = turnRequestChars(20, policy);
		const curve = TURNS.map((k)=>`T${k}=${turnRequestChars(k, policy).chars}`);
		// eslint-disable-next-line no-console
		console.log(`[aiTokenEconomy] window(经济档) 曲线: ${curve.join(' ')}`);
		expect(t1.chars).toBeGreaterThan(45000);
		expect(t20.chars).toBeLessThanOrEqual(1.3 * t1.chars);
		expect(t20.meta.mode).toBe('window');
		expect(t20.meta.droppedMsgs).toBeGreaterThan(30);
	});

	test('window 缺省档(模型窗口 10% 预算、最近 2 Turn 原样回放):到平台期后逐 Turn 恒等,且远小于 legacy', ()=>{
		const policy = { historyMode: 'window' };
		const t8 = turnRequestChars(8, policy);
		const t12 = turnRequestChars(12, policy);
		const t20 = turnRequestChars(20, policy);
		expect(t20.chars).toBe(t12.chars);
		expect(t12.chars).toBe(t8.chars);
		const legacy20 = turnRequestChars(20, { historyMode: 'legacy' });
		expect(t20.chars).toBeLessThan(legacy20.chars * 0.75);
		// window 模式 system 不再拼「最近对话」层(去双发):system 长度 = 第 1 Turn 的 system 长度
		const s1 = systemFor('window', history(0));
		const s20 = systemFor('window', history(19));
		expect(s20).toBe(s1);
		expect(systemFor('legacy', history(19)).length).toBeGreaterThan(s1.length);
	});
});
