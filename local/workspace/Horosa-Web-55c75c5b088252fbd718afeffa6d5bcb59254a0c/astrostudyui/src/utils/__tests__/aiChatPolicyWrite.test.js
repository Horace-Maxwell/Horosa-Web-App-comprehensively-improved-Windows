// 对话上下文策略·写入方/预设/订阅合同 + 运行时缺省副本 lockstep 锁。
import {
	CHAT_CONTEXT_POLICY_KEY, DEFAULT_CONTEXT_POLICY, CONTEXT_POLICY_PRESETS,
	readContextPolicy, writeContextPolicy, clearContextPolicy, subscribeContextPolicy, contextPolicyPresetName, normalizeContextPolicy,
} from '../aiChatHistory';
import { DEFAULT_AGENT_CONTEXT_POLICY } from '../aiAgent/runtime';

beforeEach(()=>{ window.localStorage.clear(); });

describe('contextPolicy 写入方', ()=>{
	test('缺键 = 缺省(现状);写后读回幂等,再写同值字节不变', ()=>{
		expect(window.localStorage.getItem(CHAT_CONTEXT_POLICY_KEY)).toBe(null);
		expect(readContextPolicy()).toEqual(normalizeContextPolicy(null));
		const a = writeContextPolicy({ historyMode: 'window', historyMaxKeep: 12 });
		expect(a.historyMode).toBe('window');
		expect(a.historyMaxKeep).toBe(12);
		expect(readContextPolicy()).toEqual(a);
		const raw1 = window.localStorage.getItem(CHAT_CONTEXT_POLICY_KEY);
		writeContextPolicy({ historyMode: 'window', historyMaxKeep: 12 });
		expect(window.localStorage.getItem(CHAT_CONTEXT_POLICY_KEY)).toBe(raw1);
	});

	test('越界值钳制、非法值回缺省;Infinity 图片保留数不进 JSON 但读回仍为不限', ()=>{
		const p = writeContextPolicy({ historyMaxKeep: 99999, historyMinKeep: -5, historyMode: 'bogus', traceTurnsFolded: 'x' });
		expect(p.historyMaxKeep).toBe(400);
		expect(p.historyMinKeep).toBe(0);
		expect(p.historyMode).toBe('window');
		expect(p.traceTurnsFolded).toBe(DEFAULT_CONTEXT_POLICY.traceTurnsFolded);
		expect(window.localStorage.getItem(CHAT_CONTEXT_POLICY_KEY)).not.toContain('Infinity');
		expect(readContextPolicy().historyImageKeep).toBe(Infinity);
	});

	test('clear 删键回缺省(不是写缺省对象)', ()=>{
		writeContextPolicy({ historyMode: 'window' });
		const p = clearContextPolicy();
		expect(window.localStorage.getItem(CHAT_CONTEXT_POLICY_KEY)).toBe(null);
		expect(p).toEqual(normalizeContextPolicy(null));
	});

	test('写入广播事件,订阅者收到归一后的策略;退订后不再收', ()=>{
		const seen = [];
		const off = subscribeContextPolicy((p)=>seen.push(p.historyMode));
		writeContextPolicy({ historyMode: 'legacy' });
		clearContextPolicy();   // 清键 = 回缺省(2026-09-07 起缺省 window)
		off();
		writeContextPolicy({ historyMode: 'legacy' });
		expect(seen).toEqual(['legacy', 'window']);
	});

	test('三档预设全部可归一且互异;预设名判定 legacy/window/economy/custom', ()=>{
		const names = Object.keys(CONTEXT_POLICY_PRESETS);
		expect(names).toEqual(['legacy', 'window', 'economy']);
		names.forEach((n)=>{
			const p = CONTEXT_POLICY_PRESETS[n];
			expect(normalizeContextPolicy(p)).toEqual(expect.objectContaining({ historyMode: p.historyMode }));
			expect(contextPolicyPresetName(p)).toBe(n);
		});
		expect(contextPolicyPresetName(null)).toBe('window');   // 缺省=窗口
		expect(contextPolicyPresetName({ historyMode: 'window', historyMaxKeep: 12 })).toBe('custom');
		expect(new Set(names.map((n)=>JSON.stringify(normalizeContextPolicy(CONTEXT_POLICY_PRESETS[n])))).size).toBe(3);
	});

	test('🔴 lockstep:运行时兜底副本 DEFAULT_AGENT_CONTEXT_POLICY 与 DEFAULT_CONTEXT_POLICY 四键逐值相等(翻转缺省必须两处同改)', ()=>{
		['traceTurnsFull', 'traceTurnsFolded', 'dedupSameCall'].forEach((k)=>{
			expect(DEFAULT_AGENT_CONTEXT_POLICY[k]).toEqual(DEFAULT_CONTEXT_POLICY[k]);
		});
		expect({ ...DEFAULT_AGENT_CONTEXT_POLICY.foldedResultMaxChars }).toEqual({ ...DEFAULT_CONTEXT_POLICY.foldedResultMaxChars });
	});
});
