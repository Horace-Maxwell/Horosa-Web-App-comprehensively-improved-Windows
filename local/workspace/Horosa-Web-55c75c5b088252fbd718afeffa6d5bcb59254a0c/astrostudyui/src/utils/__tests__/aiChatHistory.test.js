// [P0-2] 对话上下文策略与真消息窗口:缺省 legacy=原数组同引用(现状);window 模式的预算/保底/上限/对齐/图片/trace 估算;
// 策略读取坏 JSON 回缺省;历史 token 预算三档。
import {
	CHAT_CONTEXT_POLICY_KEY,
	DEFAULT_CONTEXT_POLICY,
	HISTORY_IMAGE_TOKENS,
	normalizeContextPolicy,
	readContextPolicy,
	historyTokenBudgetForModel,
	windowChatMessages,
} from '../aiChatHistory';
import { estimateTextTokens } from '../aiAnalysisContext';

beforeEach(()=>{ window.localStorage.clear(); });

const cjk = (n)=>'命'.repeat(n);   // n 字 ≈ n/1.6 token
function mkTurns(n, replyChars){
	const out = [];
	for(let i = 1; i <= n; i++){
		out.push({ role: 'user', content: `问${i}` });
		out.push({ role: 'assistant', content: `答${i}${cjk(replyChars)}` });
	}
	return out;
}
const SYS = { role: 'system', content: 'S' };
const WIN = (extra)=>({ historyMode: 'window', ...(extra || {}) });

describe('策略读取', ()=>{
	test('缺键 → 缺省;坏 JSON → 缺省;非对象 → 缺省;越界/非法值钳制;window 被认', ()=>{
		expect(readContextPolicy()).toEqual({ ...DEFAULT_CONTEXT_POLICY, foldedResultMaxChars: { read: 1200, additive: 600 } });
		window.localStorage.setItem(CHAT_CONTEXT_POLICY_KEY, '{bad json');
		expect(readContextPolicy().historyMode).toBe('window');
		expect(readContextPolicy().historyMinKeep).toBe(4);
		window.localStorage.setItem(CHAT_CONTEXT_POLICY_KEY, '[1,2]');
		expect(readContextPolicy()).toEqual(readContextPolicy());
		expect(readContextPolicy().historyMode).toBe('window');
		window.localStorage.setItem(CHAT_CONTEXT_POLICY_KEY, JSON.stringify({ historyMode: 'window', historyMinKeep: -5, historyMaxKeep: 2, historyTokenBudget: 'abc', historyImageKeep: 'x', traceTurnsFull: 99, foldedResultMaxChars: { read: 5 } }));
		const p = readContextPolicy();
		expect(p.historyMode).toBe('window');
		expect(p.historyMinKeep).toBe(0);
		expect(p.historyMaxKeep).toBe(2);
		expect(p.historyTokenBudget).toBe(null);
		expect(p.historyImageKeep).toBe(Infinity);
		expect(p.traceTurnsFull).toBe(50);
		expect(p.foldedResultMaxChars).toEqual({ read: 100, additive: 600 });
		// maxKeep 不小于 minKeep;幂等
		const q = normalizeContextPolicy({ historyMinKeep: 10, historyMaxKeep: 3 });
		expect(q.historyMaxKeep).toBe(10);
		expect(normalizeContextPolicy(q)).toEqual(q);
		expect(normalizeContextPolicy({ historyMode: 'bogus' }).historyMode).toBe('window');
	});

	test('缺省值:MIN 4 / MAX 40 / legacy / 图片不限 / trace 2+0', ()=>{
		expect(DEFAULT_CONTEXT_POLICY.historyMode).toBe('window');
		expect(DEFAULT_CONTEXT_POLICY.historyMinKeep).toBe(4);
		expect(DEFAULT_CONTEXT_POLICY.historyMaxKeep).toBe(40);
		expect(DEFAULT_CONTEXT_POLICY.historyImageKeep).toBe(Infinity);
		expect(DEFAULT_CONTEXT_POLICY.traceTurnsFull).toBe(2);
		expect(DEFAULT_CONTEXT_POLICY.traceTurnsFolded).toBe(0);
		expect(DEFAULT_CONTEXT_POLICY.dedupSameCall).toBe(false);
		expect(CHAT_CONTEXT_POLICY_KEY).toBe('horosa.ai.chat.contextPolicy.v1');
	});
});

describe('historyTokenBudgetForModel', ()=>{
	test('deepseek 13107 / unknown 6000 / numCtx 8192 → 4000 保底 / 大窗口 16000 封顶', ()=>{
		expect(historyTokenBudgetForModel('deepseek-v4-flash', {})).toBe(13107);
		expect(historyTokenBudgetForModel('my-secret-model', {})).toBe(6000);
		expect(historyTokenBudgetForModel('', undefined)).toBe(6000);
		expect(historyTokenBudgetForModel('qwen3:8b', { numCtx: 8192 })).toBe(4000);
		expect(historyTokenBudgetForModel('claude-sonnet-5', {})).toBe(16000);
		// numCtx 优先于目录表
		expect(historyTokenBudgetForModel('deepseek-v4-flash', { numCtx: 8192 })).toBe(4000);
	});
});

describe('windowChatMessages', ()=>{
	test('缺省=窗口(2026-09-07 翻缺省);legacy 显式/存储:原数组同引用,零裁剪', ()=>{
		const msgs = [SYS].concat(mkTurns(30, 3000), [{ role: 'user', content: '最新' }]);
		const r = windowChatMessages(msgs, { model: 'deepseek-v4-flash' });   // 未传 policy、无存储 → 缺省=窗口
		expect(r.meta.mode).toBe('window');
		expect(r.messages).not.toBe(msgs);
		const r2 = windowChatMessages(msgs, { model: 'deepseek-v4-flash', policy: { historyMode: 'legacy' } });
		expect(r2.messages).toBe(msgs);
		expect(r2.meta.mode).toBe('legacy');
		expect(r2.meta.droppedMsgs).toBe(0);
		window.localStorage.setItem(CHAT_CONTEXT_POLICY_KEY, JSON.stringify({ historyMode: 'legacy' }));
		const r3 = windowChatMessages(msgs, { model: 'deepseek-v4-flash' });   // 未传 policy → 读存储(legacy)
		expect(r3.meta.mode).toBe('legacy');
		expect(r3.messages).toBe(msgs);
	});

	test('末条 user 超预算也保留;system 不计预算且恒在 index0', ()=>{
		const huge = { role: 'user', content: cjk(50000) };
		const sys = { role: 'system', content: cjk(200000) };
		const r = windowChatMessages([sys].concat(mkTurns(3, 10), [huge]), { model: 'x', policy: WIN({ historyTokenBudget: 500, historyMinKeep: 0 }) });
		expect(r.messages[0]).toBe(sys);
		expect(r.messages[r.messages.length - 1]).toBe(huge);
		expect(r.meta.keptTokens).toBe(estimateTextTokens(huge.content));   // system 与被丢历史都不计
		expect(r.meta.droppedMsgs).toBe(6);
		expect(r.meta.stoppedBy).toBe('budget');
	});

	test('保底 minKeep:预算再紧也带最近 4 条(对齐后首条 user);上限 maxKeep=40 且首条必为 user', ()=>{
		const tight = windowChatMessages([SYS].concat(mkTurns(10, 4000), [{ role: 'user', content: '新问' }]), { model: 'x', policy: WIN({ historyTokenBudget: 500 }) });
		const body = tight.messages.slice(1);
		// 由新到旧取 4 条 = 新问/答10/问10/答9 → 对齐到 user 开头丢掉「答9」
		expect(body.map((m)=>m.content.slice(0, 3))).toEqual(['问10', '答10'.slice(0, 3), '新问'].map((s, i)=>(i === 1 ? body[1].content.slice(0, 3) : s)));
		expect(body[0].role).toBe('user');
		expect(body.length).toBe(3);
		// minKeep=5 → 5 条恰以 user 开头不再对齐丢弃
		const five = windowChatMessages([SYS].concat(mkTurns(10, 4000), [{ role: 'user', content: '新问' }]), { model: 'x', policy: WIN({ historyTokenBudget: 500, historyMinKeep: 5 }) });
		expect(five.messages.length - 1).toBe(5);
		expect(five.messages[1].role).toBe('user');
		// maxKeep:短消息、预算充裕,60 条历史只留 ≤40 且首条 user
		const many = windowChatMessages([SYS].concat(mkTurns(30, 2), [{ role: 'user', content: '新问' }]), { model: 'x', policy: WIN({ historyTokenBudget: 400000 }) });
		const mb = many.messages.slice(1);
		expect(mb.length).toBeLessThanOrEqual(40);
		expect(mb.length).toBeGreaterThanOrEqual(39);
		expect(mb[0].role).toBe('user');
		expect(many.meta.stoppedBy).toBe('maxKeep');
		expect(many.meta.droppedMsgs).toBe(61 - mb.length);
	});

	test('预算截断后首条必为 user 且不拆问答对;窗口内保序;未触界时不动', ()=>{
		const turns = mkTurns(20, 1000);   // 每答 ≈ 626 token
		const r = windowChatMessages([SYS].concat(turns, [{ role: 'user', content: '新问' }]), { model: 'x', policy: WIN({ historyTokenBudget: 3000 }) });
		const body = r.messages.slice(1);
		expect(body[0].role).toBe('user');
		expect(body[body.length - 1].content).toBe('新问');
		// 问答对成对:user 后必跟 assistant(除末条新问)
		for(let i = 0; i + 1 < body.length - 1; i += 2){
			expect(body[i].role).toBe('user');
			expect(body[i + 1].role).toBe('assistant');
		}
		expect(r.meta.keptTokens).toBeLessThanOrEqual(3000 + 700);   // 保底条数可略超预算
		// 窗口内是原对象且保持原相对顺序
		const idx = body.map((m)=>turns.indexOf(m)).filter((i)=>i >= 0);
		expect(idx).toEqual(idx.slice().sort((a, b)=>a - b));
		// 未触界:全保留,零丢弃
		const small = windowChatMessages([SYS].concat(mkTurns(2, 10), [{ role: 'user', content: '新问' }]), { model: 'x', policy: WIN() });
		expect(small.messages.length).toBe(1 + 4 + 1);
		expect(small.meta.droppedMsgs).toBe(0);
		expect(small.meta.stoppedBy).toBe(null);
	});

	test('图片按平价计入预算;historyImageKeep 只保留最近 N 条带图消息的图(更旧的剥图留文)', ()=>{
		const img = 'data:image/png;base64,xx';
		const r = windowChatMessages([SYS, { role: 'user', content: 'x', images: [img, img] }], { model: 'x', policy: WIN() });
		expect(r.meta.keptTokens).toBe(estimateTextTokens('x') + 2 * HISTORY_IMAGE_TOKENS);
		const msgs = [SYS,
			{ role: 'user', content: '旧图', images: [img] }, { role: 'assistant', content: '答1' },
			{ role: 'user', content: '次图', images: [img] }, { role: 'assistant', content: '答2' },
			{ role: 'user', content: '新图', images: [img] },
		];
		const keep1 = windowChatMessages(msgs, { model: 'x', policy: WIN({ historyImageKeep: 1 }) });
		const b = keep1.messages.slice(1);
		expect(b[4].images).toEqual([img]);       // 最新一条带图
		expect(b[2].images).toBeUndefined();      // 更旧的剥图
		expect(b[0].images).toBeUndefined();
		expect(b[2].content).toBe('次图');
		expect(msgs[3].images).toEqual([img]);    // 原对象不被改写
		// 缺省 Infinity → 全保留
		const keepAll = windowChatMessages(msgs, { model: 'x', policy: WIN() });
		expect(keepAll.messages[1].images).toEqual([img]);
	});

	test('带 trace 的 assistant 计入回放估算:最近 traceTurnsFull 个按结果原文,再 traceTurnsFolded 个按折叠上限,更早 0', ()=>{
		const big = JSON.stringify({ __horosaType: 'toolResult', untrusted: true, ok: true, data: { text: 'x'.repeat(4000) } });
		const trace = { mode: 'native', rounds: [{ index: 0, text: '', toolCalls: [{ id: 'c1', name: 'list_records', args: {} }], results: [{ callId: 'c1', name: 'list_records', level: 'read', content: big, isError: false }] }, { index: 1, text: 'done', toolCalls: [], results: [] }] };
		const msgs = [SYS,
			{ role: 'user', content: 'q1' }, { role: 'assistant', content: 'a1', agentTrace: trace },
			{ role: 'user', content: 'q2' }, { role: 'assistant', content: 'a2', agentTrace: trace },
			{ role: 'user', content: 'q3' }, { role: 'assistant', content: 'a3', agentTrace: trace },
			{ role: 'user', content: 'q4' },
		];
		const full2 = windowChatMessages(msgs, { model: 'x', policy: WIN({ historyTokenBudget: 400000, traceTurnsFull: 2, traceTurnsFolded: 0 }) });
		expect(full2.meta.replayChars).toBeGreaterThanOrEqual(2 * big.length);
		expect(full2.meta.replayChars).toBeLessThan(3 * big.length);
		const full1fold1 = windowChatMessages(msgs, { model: 'x', policy: WIN({ historyTokenBudget: 400000, traceTurnsFull: 1, traceTurnsFolded: 1, foldedResultMaxChars: { read: 300, additive: 300 } }) });
		expect(full1fold1.meta.replayChars).toBeGreaterThanOrEqual(big.length + 300);
		expect(full1fold1.meta.replayChars).toBeLessThan(big.length + 300 + 100);
		const none = windowChatMessages(msgs, { model: 'x', policy: WIN({ historyTokenBudget: 400000, traceTurnsFull: 0, traceTurnsFolded: 0 }) });
		expect(none.meta.replayChars).toBe(0);
		// 回放估算真的参与预算:预算只够正文时,带大 trace 的气泡把窗口顶到保底即止
		const tight = windowChatMessages(msgs, { model: 'x', policy: WIN({ historyTokenBudget: 200, historyMinKeep: 0 }) });
		expect(tight.messages.slice(1).map((m)=>m.content)).toEqual(['q4']);
		expect(tight.meta.stoppedBy).toBe('budget');
		// [Q-287/PP-12] 行动能力关(replayTrace:false):NULL_AGENT 只发正文 → 不计回放量,同预算保住全部历史
		const off = windowChatMessages(msgs, { model: 'x', replayTrace: false, policy: WIN({ historyTokenBudget: 200, historyMinKeep: 0 }) });
		expect(off.meta.replayChars).toBe(0);
		expect(off.messages.slice(1).map((m)=>m.content)).toEqual(['q1', 'a1', 'q2', 'a2', 'q3', 'a3', 'q4']);
	});

	test('非法输入:空/非数组不抛;无 system 时不凭空造 system', ()=>{
		expect(windowChatMessages(null, { policy: WIN() }).messages).toEqual([]);
		expect(windowChatMessages(undefined, {}).messages).toEqual([]);   // 缺省=窗口路径:空输入回 [](legacy 显式时原样回传)
		expect(windowChatMessages(undefined, { policy: { historyMode: 'legacy' } }).messages).toBe(undefined);
		const r = windowChatMessages([{ role: 'user', content: 'only' }], { policy: WIN() });
		expect(r.messages).toEqual([{ role: 'user', content: 'only' }]);
		expect(r.meta.keptMsgs).toBe(1);
	});
});

// [Q-290/M-105·PP-21①] 策略归一与面板同值域
describe('[Q-290/PP-21] 策略值域', ()=>{
	const { normalizeContextPolicy, HISTORY_TOKEN_BUDGET_MAX, HISTORY_IMAGE_KEEP_MAX } = require('../aiChatHistory');
	const { FIELD_SPECS } = require('../aiChat/policyPanel');
	it('历史 token 预算钳到面板上限 200000;保留图片数钳到 50;面板 max 与归一常量同值', ()=>{
		const p = normalizeContextPolicy({ historyTokenBudget: 300000, historyImageKeep: 999 });
		expect(p.historyTokenBudget).toBe(HISTORY_TOKEN_BUDGET_MAX);
		expect(p.historyImageKeep).toBe(HISTORY_IMAGE_KEEP_MAX);
		expect(FIELD_SPECS.find((f)=>f.key === 'historyTokenBudget').max).toBe(HISTORY_TOKEN_BUDGET_MAX);
		expect(FIELD_SPECS.find((f)=>f.key === 'historyImageKeep').max).toBe(HISTORY_IMAGE_KEEP_MAX);
		expect(normalizeContextPolicy({ historyImageKeep: Infinity }).historyImageKeep).toBe(Infinity);
	});
});
