// AI 分析主页 · 模版:JSON 校验器、模版预览、版本快照、Monaco 配置。
// 只被 components/aianalysis/AIAnalysisMain.js 引用。
import Mustache from 'mustache';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { safeParseJson } from './providerForm';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);


export function buildTemplatePreview(template){
	const sampleData = safeParseJson(template.exampleInput, {
		user_prompt: '请分析此案例',
		source_context: '这是案例前提',
		retrieved_context: '这是检索到的资料片段',
		conversation_history: '[user] 上一句问题',
		system_prompt: '系统提示',
	});
	if(template.format === 'json'){
		const schema = safeParseJson(template.jsonSchema, null);
		const output = safeParseJson(template.exampleOutput, null);
		let schemaErrors = [];
		if(schema){
			try{
				const validate = ajv.compile(schema);
				if(output){
					validate(output);
				}
				schemaErrors = validate.errors || [];
			}catch(e){
				schemaErrors = [{ message: e.message }];
			}
		}else{
			schemaErrors = [{ message: 'JSON Schema 解析失败' }];
		}
		return {
			text: JSON.stringify(output || sampleData, null, 2),
			errors: schemaErrors,
		};
	}
	// 预览在 render 期间跑 Mustache,此前无 try/catch:模版里出现未闭合 / 错配的段标签
	// (照常见模板语法写的 `{{#if x}}…{{/if}}` 就会)直接抛错,冒到应用级错误边界 → **整页**换成错误卡。
	// 另:Mustache 缺省 HTML 转义,预览里 `<` `&` `"` 显示成实体 —— 预览是给人看原文的,关掉转义。
	try{
		const rendered = Mustache.render(template.instructionText || template.content || '', sampleData, {}, { escape: (v)=>`${v == null ? '' : v}` });
		return { text: rendered, errors: [] };
	}catch(e){
		return {
			text: `${template.instructionText || template.content || ''}`,
			errors: [{ message: `模版语法错误:${(e && e.message) || e}(下面显示的是未渲染的原文)` }],
		};
	}
}

export function buildTemplateVersionSnapshot(values){
	return {
		format: values.format,
		instructionText: values.instructionText || '',
		jsonSchema: values.jsonSchema || '',
		exampleInput: values.exampleInput || '',
		exampleOutput: values.exampleOutput || '',
		content: values.format === 'text' ? (values.instructionText || '') : (values.jsonSchema || ''),
		name: values.name || '',
	};
}

export function configureMonaco(monaco){
	if(monaco && monaco.languages && monaco.languages.json){
		monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
			validate: true,
			allowComments: false,
			schemas: [
				{
					uri: 'horosa://json-template-schema.json',
					fileMatch: ['*'],
					schema: {
						type: 'object',
						properties: {
							type: { type: 'string' },
							properties: { type: 'object' },
							required: {
								type: 'array',
								items: { type: 'string' },
							},
							additionalProperties: { type: 'boolean' },
						},
					},
				},
			],
		});
	}
}
