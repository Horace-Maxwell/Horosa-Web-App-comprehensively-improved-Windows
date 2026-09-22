// [Q-039 / Q-040 / Q-055① / Q-053② 裁决 2026-09-18] 发送层三纯函数 + JSON 文本框规则。
import { renderTemplatesForSend, isImageRejectionError, JSON_MODE_INSTRUCTION } from '../aiChat/sendHelpers';
import { jsonTextProblem, JSON_TEXT_RULE } from '../../components/aianalysis/MonacoField';

describe('renderTemplatesForSend(Q-055①)', ()=>{
	const vars = { user_prompt: '问A', source_context: '前提<b>', retrieved_context: '片段', conversation_history: '[user] 上句', system_prompt: '系统' };
	it('文字模版按本轮真实值渲染,不转义 HTML;未知占位留空;无占位符 / JSON 模版原样', ()=>{
		const out = renderTemplatesForSend([
			{ id: 't1', format: 'text', instructionText: 'Q:{{user_prompt}} S:{{source_context}} R:{{retrieved_context}} H:{{conversation_history}} P:{{system_prompt}} X:{{nope}}' },
			{ id: 't2', format: 'text', instructionText: '无变量' },
			{ id: 't3', format: 'json', instructionText: '说明 {{user_prompt}}', jsonSchema: '{"type":"object"}', content: '{"type":"object"}' },
		], vars);
		expect(out[0].instructionText).toBe('Q:问A S:前提<b> R:片段 H:[user] 上句 P:系统 X:');
		expect(out[0].content).toBe(out[0].instructionText);
		expect(out[1].instructionText).toBe('无变量');
		expect(out[2].instructionText).toBe('说明 问A');
		expect(out[2].content).toBe('{"type":"object"}');   // JSON 模版 content(schema)不动
	});
	it('渲染失败(未闭合段标)回落原文;空 / 非数组安全', ()=>{
		const bad = '{{#open}} 没闭合';
		expect(renderTemplatesForSend([{ id: 'x', instructionText: bad }], vars)[0].instructionText).toBe(bad);
		expect(renderTemplatesForSend(null, vars)).toEqual([]);
		expect(renderTemplatesForSend([null], vars)).toEqual([null]);
	});
});

describe('isImageRejectionError(Q-040) / JSON_MODE_INSTRUCTION(Q-039)', ()=>{
	it('拒图措辞命中;普通错误不命中', ()=>{
		expect(isImageRejectionError('400 Invalid content type: image input is not supported by this model')).toBe(true);
		expect(isImageRejectionError('This model does not support vision inputs')).toBe(true);
		expect(isImageRejectionError('该模型不支持图片输入')).toBe(true);
		expect(isImageRejectionError('rate limit exceeded')).toBe(false);
		expect(isImageRejectionError('image generated successfully')).toBe(false);
		expect(isImageRejectionError('')).toBe(false);
	});
	it('JSON 模式指令文本固定,含「只输出一个合法 JSON 对象」', ()=>{
		expect(JSON_MODE_INSTRUCTION).toMatch(/只输出一个合法 JSON 对象/);
	});
});

describe('MonacoField JSON 规则(Q-053②)', ()=>{
	it('空=通过;合法 JSON 通过;非法 JSON 拒绝并带原因', async ()=>{
		expect(jsonTextProblem('')).toBe('');
		expect(jsonTextProblem('{"a":1}')).toBe('');
		expect(jsonTextProblem('{a:1}')).not.toBe('');
		await expect(JSON_TEXT_RULE.validator(null, '')).resolves.toBeUndefined();
		await expect(JSON_TEXT_RULE.validator(null, '[1,2]')).resolves.toBeUndefined();
		await expect(JSON_TEXT_RULE.validator(null, '{oops')).rejects.toThrow(/不是合法 JSON/);
	});
});

describe('[Q-048④ 裁决 2026-09-18] 占位文字不进历史', ()=>{
	it('两句占位逐字命中;正文 / 空串不命中', ()=>{
		const { isPlaceholderAssistantContent, ASSISTANT_PLACEHOLDERS } = require('../../components/aianalysis/chat/useChatAssist');
		expect(ASSISTANT_PLACEHOLDERS).toEqual(['已停止生成。', '模型未返回可用内容']);
		expect(isPlaceholderAssistantContent('已停止生成。')).toBe(true);
		expect(isPlaceholderAssistantContent('  模型未返回可用内容 ')).toBe(true);
		expect(isPlaceholderAssistantContent('已停止生成。但这里有正文')).toBe(false);
		expect(isPlaceholderAssistantContent('')).toBe(false);
	});
});
