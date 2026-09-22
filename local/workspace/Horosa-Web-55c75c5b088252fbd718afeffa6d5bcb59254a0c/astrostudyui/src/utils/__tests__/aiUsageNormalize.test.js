// [I1] usage 缓存计量归一合同:三家形状 → 同一个 cache_read_input_tokens;已有该键一律不覆盖;非对象不抛。
// 为什么要有:A/B 分析器与费用闸只认 anthropic 的 cache_read_input_tokens;DeepSeek 报 prompt_cache_hit_tokens、
// OpenAI 报 prompt_tokens_details.cached_tokens —— 不归一就永远「无缓存计量 → INCONCLUSIVE」,缺省永远翻不动。
import { normalizeUsage, deriveUsage } from '../aiChat/status';

describe('normalizeUsage', ()=>{
	it('三形状折进同一个 cache_read_input_tokens', ()=>{
		const anth = normalizeUsage({ input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 640 });
		const deep = normalizeUsage({ prompt_tokens: 100, completion_tokens: 10, prompt_cache_hit_tokens: 640, prompt_cache_miss_tokens: 60 });
		const oai = normalizeUsage({ prompt_tokens: 100, completion_tokens: 10, prompt_tokens_details: { cached_tokens: 640, audio_tokens: 0 } });
		expect(anth.cache_read_input_tokens).toBe(640);
		expect(deep.cache_read_input_tokens).toBe(640);
		expect(oai.cache_read_input_tokens).toBe(640);
	});

	it('已有 cache_read_input_tokens 不被别名覆盖(含上游显式报 0)', ()=>{
		const both = normalizeUsage({ cache_read_input_tokens: 7, prompt_cache_hit_tokens: 999, prompt_tokens_details: { cached_tokens: 888 } });
		expect(both.cache_read_input_tokens).toBe(7);
		const zero = normalizeUsage({ cache_read_input_tokens: 0, prompt_cache_hit_tokens: 999 });
		expect(zero.cache_read_input_tokens).toBe(0);
	});

	it('纯函数:不改原对象;两别名并存时 DeepSeek 键优先', ()=>{
		const src = { prompt_cache_hit_tokens: 12, prompt_tokens_details: { cached_tokens: 34 } };
		const out = normalizeUsage(src);
		expect(out).not.toBe(src);
		expect(src.cache_read_input_tokens).toBeUndefined();
		expect(out.cache_read_input_tokens).toBe(12);
	});

	it('无别名/非对象一律原样返回,不抛也不凭空造键', ()=>{
		const plain = { prompt_tokens: 5, completion_tokens: 1 };
		expect(normalizeUsage(plain)).toBe(plain);
		expect('cache_read_input_tokens' in normalizeUsage(plain)).toBe(false);
		// ⚠️ Number(null)===0:null 别名不得被折成 0 写出该键
		expect('cache_read_input_tokens' in normalizeUsage({ prompt_cache_hit_tokens: null })).toBe(false);
		expect('cache_read_input_tokens' in normalizeUsage({ prompt_tokens_details: null })).toBe(false);
		[null, undefined, 0, '', 'usage', [1, 2]].forEach((bad)=>{
			expect(()=>normalizeUsage(bad)).not.toThrow();
			expect(normalizeUsage(bad)).toEqual(bad);
		});
	});

	it('归一后状态栏 deriveUsage 直接读得到命中(DeepSeek 形状原本恒为 0)', ()=>{
		const raw = { providerType: 'openai', model: 'deepseek-chat', input_tokens: 1000, output_tokens: 10, prompt_cache_hit_tokens: 800 };
		expect(deriveUsage(raw).cacheRead).toBe(0);
		expect(deriveUsage(normalizeUsage(raw)).cacheRead).toBe(800);
	});
});
