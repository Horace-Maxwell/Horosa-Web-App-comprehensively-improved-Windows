// 模型代际判定按数字比较(新一代上线即认),前后端共用一份对拍用例表(fixtures/openaiReasoningGenerationCases.tsv;
// 后端 JUnit OpenAIReasoningGenerationParityTest 读同一份文件)。此前前后端各写死 gpt-5/6/7、o1/3–7 名单,gpt-8 / o8 上线即漏判。
import fs from 'fs';
import path from 'path';
import { isOpenAIReasoningModel, isReasoningModel, applyThinkingLevel, anthropicThinkingMode, gptMajorOf, ANTHROPIC_FAMILY_RE } from '../aiAnalysisProviders';

const CASES = fs.readFileSync(path.join(__dirname, 'fixtures', 'openaiReasoningGenerationCases.tsv'), 'utf8')
	.split('\n').map((l)=>l.trim()).filter((l)=>l && !l.startsWith('#')).map((l)=>{ const [m, v] = l.split('\t'); return [m, v === 'true']; });

describe('OpenAI 推理代际按数字比较(与后端共用用例表)', ()=>{
	it('用例表能读到(判据有对象)', ()=>{ expect(CASES.length).toBeGreaterThan(20); });
	CASES.forEach(([model, want])=>{
		it(`${model} → ${want}`, ()=>{
			expect(isOpenAIReasoningModel(model)).toBe(want);
			if(want){ expect(isReasoningModel(model)).toBe(true); }
		});
	});
	it('思考档的 OpenAI 分支与代际判据同源(未来代号也写 reasoning_effort)', ()=>{
		const o = applyThinkingLevel({}, 'high', 'openai', 'gpt-8', 4096);
		expect(o.reasoning_effort).toBe('high');
		const p = applyThinkingLevel({}, 'high', 'openai', 'gpt-4o', 4096);
		expect(p.reasoning_effort).toBeUndefined();
	});
});

// Anthropic 思考形态族:前后端同一张用例表(fixtures/anthropicThinkingModeCases.tsv;后端 JUnit AnthropicThinkingModeParityTest 读同一份)
const ANTH = fs.readFileSync(path.join(__dirname, 'fixtures', 'anthropicThinkingModeCases.tsv'), 'utf8')
	.split('\n').filter((l)=>l.trim() && !l.startsWith('#')).map((l)=>l.split('\t'));
describe('Anthropic 思考形态族(与后端共用用例表)', ()=>{
	it('用例表能读到,且收了日期型号与网关前缀形', ()=>{
		expect(ANTH.length).toBeGreaterThanOrEqual(15);
		expect(ANTH.some((r)=>r[0] === 'claude-opus-4-20250514' && r[1] === 'budget')).toBe(true);
		expect(ANTH.some((r)=>/\//.test(r[0]))).toBe(true);
	});
	ANTH.forEach(([model, want, note])=>{
		it(`${model || '(空)'} → ${want}(${note})`, ()=>{ expect(anthropicThinkingMode(model)).toBe(want); });
	});
	it('🔴 开思考档时日期型号 Opus 4 发预算形态(enabled + budget_tokens),不发 adaptive', ()=>{
		const o = applyThinkingLevel({}, 'medium', 'anthropic', 'claude-opus-4-20250514', 8192);
		expect(o.thinking && o.thinking.type).toBe('enabled');
		expect(o.output_config).toBeUndefined();
	});
	it('🔴 前后端同一条正则(后端源码里的 ANTHROPIC_FAMILY_RE 与前端逐字相同)', ()=>{
		const java = fs.readFileSync(path.join(__dirname, '../../../../astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/service/AIAnalysisProxyService.java'), 'utf8');
		const m = /ANTHROPIC_FAMILY_RE = java\.util\.regex\.Pattern\.compile\("([^"]+)"\)/.exec(java);
		expect(m).toBeTruthy();
		expect(m[1].replace(/\\\\/g, '\\')).toBe(ANTHROPIC_FAMILY_RE.source);
	});
});

describe('gpt 主版本规范化(Azure 去点写法)', ()=>{
	it('🔴 gpt-35* = 3.5 代(非推理);两位代际只认 1 开头;三位不认', ()=>{
		expect(gptMajorOf('gpt-35-turbo')).toBe(3);
		expect(gptMajorOf('gpt-4o')).toBe(4);
		expect(gptMajorOf('gpt-10-preview')).toBe(10);
		expect(gptMajorOf('gpt-400')).toBe(null);
		expect(isReasoningModel('gpt-35-turbo-16k')).toBe(false);
		const o = applyThinkingLevel({}, 'high', 'openai', 'gpt-35-turbo', 4096);
		expect(o.reasoning_effort).toBeUndefined();
	});
});
