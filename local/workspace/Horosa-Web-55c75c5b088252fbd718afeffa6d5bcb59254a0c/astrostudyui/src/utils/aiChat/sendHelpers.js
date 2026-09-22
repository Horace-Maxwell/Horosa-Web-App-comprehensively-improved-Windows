// [Q-039 / Q-040 / Q-055① 裁决 2026-09-18] AI 对话发送层三个纯函数(从 AIAnalysisMain 抽出以便单测)。
import Mustache from 'mustache';

// [Q-055① 裁决 2026-09-18] 发送层模版变量渲染:只处理含 {{ 的文字模版(JSON 模版的 schema 不动);Mustache 关转义(与预览同);
// 渲染异常(未闭合段标等)回落原文。返回模版副本数组,不改库里的记录。
export function renderTemplatesForSend(templates, vars){
	return (Array.isArray(templates) ? templates : []).map((t)=>{
		if(!t){ return t; }
		const raw = `${t.instructionText || t.content || ''}`;
		if(raw.indexOf('{{') < 0){ return t; }
		try{
			const out = Mustache.render(raw, vars || {}, {}, { escape: (v)=>`${v == null ? '' : v}` });
			return { ...t, instructionText: out, content: t.format === 'json' ? t.content : out };
		}catch(e){
			return t;
		}
	});
}

// [Q-039] JSON 输出模式的显式指令(与 response_format 双保险)
export const JSON_MODE_INSTRUCTION = '[输出格式] 只输出一个合法 JSON 对象：不要解释、不要前后缀、不要 Markdown 代码围栏。';

// [Q-040] 上游错误是否为「拒收图片 / 非视觉模型」:各家措辞不一,按关键词启发式识别
export function isImageRejectionError(text){
	const t = `${text || ''}`.toLowerCase();
	if(!t){ return false; }
	return /image|vision|multimodal|multi-modal|visual|图片|视觉|多模态/.test(t) && /not\s*support|unsupported|invalid|reject|cannot|unable|does not|不支持|无法|拒绝|非法/.test(t);
}
