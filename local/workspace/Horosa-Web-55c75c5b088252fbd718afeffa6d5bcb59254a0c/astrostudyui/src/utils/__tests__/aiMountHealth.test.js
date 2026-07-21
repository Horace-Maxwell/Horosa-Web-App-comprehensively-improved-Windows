// [WP-F] 挂载健康金标:模型上下文预算函数 / CJK token 估算 / 快照↔案例底盘核对 /
// 近期对话 token 预算滚动裁剪。
import { contextWindowForModel, contextCharBudgetForModel, MODEL_CONTEXT_WINDOWS } from '../aiAnalysisProviders';
import {
	estimateTextTokens,
	snapshotSourceMismatch,
	buildContextLayers,
	AI_CONTEXT_MAX_CHARS,
} from '../aiAnalysisContext';

describe('[F2] contextWindowForModel / contextCharBudgetForModel', ()=>{
	test('现役四家命中窗口;未知模型 null', ()=>{
		expect(contextWindowForModel('claude-fable-5')).toBe(200000);
		expect(contextWindowForModel('claude-sonnet-5')).toBe(200000);
		expect(contextWindowForModel('gpt-5.6')).toBe(400000);
		expect(contextWindowForModel('gemini-3.1-pro')).toBe(1048576);
		expect(contextWindowForModel('deepseek-v4-flash')).toBe(131072);
		expect(contextWindowForModel('qwen3:8b')).toBe(131072);
		expect(contextWindowForModel('my-secret-model')).toBe(null);
		expect(contextWindowForModel('')).toBe(null);
	});

	test('未知模型 → 保底(=旧常量,零回归);大窗口 → cap 封顶', ()=>{
		expect(contextCharBudgetForModel('my-secret-model', { floorChars: AI_CONTEXT_MAX_CHARS })).toBe(AI_CONTEXT_MAX_CHARS);
		const big = contextCharBudgetForModel('claude-fable-5', { floorChars: AI_CONTEXT_MAX_CHARS });
		expect(big).toBe(60000);   // 200k 窗口按分摊远超 cap → 封顶
		expect(contextCharBudgetForModel('gemini-3.1-pro', {})).toBe(60000);
	});

	test('Ollama 小窗口按 num_ctx 实算(低于保底,防静默截断)', ()=>{
		const small = contextCharBudgetForModel('qwen3:8b', { numCtx: 8192, floorChars: 20000 });
		// 8192 - 2048 预留 = 6144 × 0.6 × 1.6 ≈ 5898
		expect(small).toBeLessThan(8000);
		expect(small).toBeGreaterThan(3000);
		// num_ctx 优先于目录表(qwen 目录 131072 会给出远大预算)
		expect(small).toBeLessThan(contextCharBudgetForModel('qwen3:8b', {}));
	});

	test('窗口表条目形状守卫', ()=>{
		expect(MODEL_CONTEXT_WINDOWS.length).toBeGreaterThan(8);
		MODEL_CONTEXT_WINDOWS.forEach((e)=>{
			expect(typeof e.match).toBe('string');
			expect(e.tokens).toBeGreaterThan(10000);
		});
	});
});

describe('[F2] estimateTextTokens CJK 双桶', ()=>{
	test('纯中文 ≈ 字数/1.6;纯 ASCII ≈ 字数/4', ()=>{
		const cn = '天地玄黄宇宙洪荒日月盈昃辰宿列张寒来暑往秋收冬藏'; // 24 字
		expect(estimateTextTokens(cn)).toBe(Math.ceil(24 / 1.6));
		const en = 'a'.repeat(400);
		expect(estimateTextTokens(en)).toBe(100);
		expect(estimateTextTokens('')).toBe(0);
		expect(estimateTextTokens(null)).toBe(0);
	});

	test('混排:两桶分算(中文不再被 /4 低估)', ()=>{
		const mixed = '甲子'.repeat(10) + 'x'.repeat(40);   // 20 CJK + 40 ASCII
		expect(estimateTextTokens(mixed)).toBe(Math.ceil(20 / 1.6 + 40 / 4));
	});
});

describe('[F1] snapshotSourceMismatch 宁漏勿误伤', ()=>{
	const rec = { birth: '2000-01-01 12:30:00', zone: 8, lon: 116.4, lat: 39.9 };

	test('同盘(格式噪声容忍):date+time 拼合 / 秒截断 / 数字字符串', ()=>{
		expect(snapshotSourceMismatch({ date: '2000-01-01', time: '12:30', zone: '8', lon: '116.40', lat: '39.90' }, rec)).toBe('match');
		expect(snapshotSourceMismatch({ birth: '2000-01-01 12:30' }, rec)).toBe('match');
	});

	test('异盘确凿:出生时间不同 → mismatch', ()=>{
		expect(snapshotSourceMismatch({ date: '1990-06-06', time: '08:00' }, rec)).toBe('mismatch');
		expect(snapshotSourceMismatch({ birth: '2000-01-01 12:31' }, rec)).toBe('mismatch');
	});

	test('信息不足一律 unknown(事盘 meta 无出生位天然免报)', ()=>{
		expect(snapshotSourceMismatch({}, rec)).toBe('unknown');
		expect(snapshotSourceMismatch(null, rec)).toBe('unknown');
		expect(snapshotSourceMismatch({ source: 'liqi', school: 'sanyuan' }, rec)).toBe('unknown');
		expect(snapshotSourceMismatch({ date: '2000-01-01' }, {})).toBe('unknown');
	});

	test('坐标圆到 1 位小数再比(116.4053 vs 116.4 不误伤)', ()=>{
		expect(snapshotSourceMismatch({ birth: '2000-01-01 12:30', lon: 116.4053, lat: 39.9042 }, rec)).toBe('match');
	});
});

describe('[F4] 近期对话 token 预算滚动裁剪', ()=>{
	const mk = (n, len)=>Array.from({ length: n }, (_, i)=>({
		role: i % 2 ? 'assistant' : 'user',
		content: `${i}`.padEnd(len, '甲'),
	}));

	function historyLayer(messages){
		const layers = buildContextLayers({ conversationMessages: messages });
		return layers.find((l)=>l.key === 'recent-history');
	}

	test('短消息会话可带超过旧 10 条上限(至多 40)', ()=>{
		const layer = historyLayer(mk(60, 20));
		expect(layer).toBeTruthy();
		const rounds = layer.content.split('\n\n').length;
		expect(rounds).toBeGreaterThan(10);
		expect(rounds).toBeLessThanOrEqual(40);
	});

	test('长消息会话被预算截住,但保底 4 条', ()=>{
		const layer = historyLayer(mk(12, 4000));   // 每条 ~2500 tokens
		const rounds = layer.content.split('\n\n').length;
		expect(rounds).toBe(4);
	});

	test('最新消息永在(裁旧不裁新)', ()=>{
		const msgs = mk(12, 4000);
		msgs[11].content = '最新这条必须在';
		const layer = historyLayer(msgs);
		expect(layer.content).toContain('最新这条必须在');
		expect(layer.content).not.toContain(`[${msgs[0].role}] 0`);
	});
});
