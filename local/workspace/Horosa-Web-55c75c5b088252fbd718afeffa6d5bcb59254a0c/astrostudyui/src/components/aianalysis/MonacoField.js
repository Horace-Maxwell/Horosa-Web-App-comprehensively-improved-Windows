// [Q-053② 裁决 2026-09-18] 九个 JSON 编辑框此前用 @monaco-editor/loader 从 CDN 拉 monaco:桌面壳 CSP 拦下 → 永远
// 「编辑器加载中...」遮罩、无法编辑(真壳实况)。改为零新依赖的等宽 TextArea + 即时 JSON 体检(下方一行提示,不拦输入),
// 保存时由各 Form.Item 的 JSON_TEXT_RULE 校验(不是合法 JSON 不给存)。文件名 / 默认导出名保留(九处调用点零改动;
// beforeMount / options 等 monaco 专属 props 忽略)。
import React from 'react';
import { Input } from 'antd';

export function jsonTextProblem(text){
	const t = `${text == null ? '' : text}`.trim();
	if(!t){ return ''; }
	try{ JSON.parse(t); return ''; }catch(e){ return `${(e && e.message) || 'JSON 无法解析'}`; }
}

// antd Form 规则:空 = 通过(是否必填由各字段自己的 required 规则决定);非空必须是合法 JSON。
export const JSON_TEXT_RULE = {
	validator: (_rule, value)=>{
		const problem = jsonTextProblem(value);
		return problem ? Promise.reject(new Error(`不是合法 JSON：${problem}`)) : Promise.resolve();
	},
};

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

function MonacoField(props){
	const {
		value,
		onChange,
		defaultLanguage = 'plaintext',
		language,
		height = '200px',
		options = {},
		placeholder,
	} = props || {};
	const lang = language || defaultLanguage;
	const text = value == null ? '' : `${value}`;
	const problem = lang === 'json' ? jsonTextProblem(text) : '';
	const px = parseInt(`${height}`, 10);
	const rows = Number.isFinite(px) && px > 0 ? Math.max(4, Math.round(px / 22)) : 8;
	return (
		<div>
			<Input.TextArea
				value={text}
				onChange={(e)=>{ if(typeof onChange === 'function'){ onChange(e && e.target ? e.target.value : ''); } }}
				rows={rows}
				spellCheck={false}
				readOnly={!!(options && options.readOnly)}
				placeholder={placeholder || (lang === 'json' ? '{ }' : '')}
				style={{ fontFamily: MONO, fontSize: 13, lineHeight: 1.5, resize: 'vertical' }}
			/>
			{problem ? (
				<div style={{ color: 'var(--horosa-danger, #e5484d)', fontSize: 12, marginTop: 4 }}>JSON 未闭合或有误：{problem}</div>
			) : null}
		</div>
	);
}

export default MonacoField;
