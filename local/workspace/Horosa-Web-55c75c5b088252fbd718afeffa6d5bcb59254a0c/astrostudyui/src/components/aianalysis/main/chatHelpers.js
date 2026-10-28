// AI 分析主页 · 对话助手:流式错误分类、异步输入 / 确认弹窗、会话标题、压缩区判定、引用条目解析与去重。
// 只被 components/aianalysis/AIAnalysisMain.js 引用。
import { parseDateTimeMs } from '../../../utils/dateTimeParse';
import React from 'react';
import { Input as AntdInput, Modal as AntdModal } from 'antd';
import { message } from 'antd';

// 错误分类：把上游异常拆成「类别 + 简短中文 + 可重试」三段，给消息底部 Alert 用。
export function classifyStreamError(rawMsg){
	const txt = `${rawMsg || ''}`;
	const lower = txt.toLowerCase();
	const m = lower.match(/(?:status|http|code|error)[^\d]{0,8}(\d{3})/);
	const status = m ? parseInt(m[1], 10) : 0;
	let category = 'server';
	let hint = '请稍后重试，或检查模型/参数。';
	let retriable = true;
	if(status === 401 || status === 403 || /api[\s_-]?key|unauthor|invalid[\s_-]?key/.test(lower)){
		category = 'auth'; hint = '凭证问题——请到「设置」检查 API Key / Base URL。'; retriable = false;
	}else if(status === 429 || /rate\s*limit|too many requests|quota/.test(lower)){
		category = 'rate'; hint = '上游限流——稍候再试（建议降低并发或换模型）。'; retriable = true;
	}else if(status === 400 || /not\s*support|unsupported|invalid\s*model|invalid\s*param|response_format/.test(lower)){
		category = 'model'; hint = '参数/模型问题——检查模型选择、思考档或 JSON/停止序列等参数。'; retriable = false;
	}else if(/network|fetch|ECONN|ETIMEDOUT|timeout|aborted|disconnect/.test(lower)){
		category = 'network'; hint = '网络问题——检查 baseUrl 可达性 / 代理 / 防火墙。'; retriable = true;
	}else if(status >= 500 && status < 600){
		category = 'server'; hint = '上游服务异常——稍后重试。'; retriable = true;
	}
	return { category, status, message: txt.slice(0, 400), hint, retriable };
}

// 异步输入框 — 替代 window.prompt（Tauri/桌面壳 不支持原生 prompt）。
// 返回 Promise<string|null>：用户点「确定」返回输入值（含空串），点「取消」/关闭返回 null。
export function asyncInput({ title = '请输入', defaultValue = '', placeholder = '', multiline = false, okText = '确定', cancelText = '取消', maxLength } = {}){
	return new Promise((resolve)=>{
		let current = `${defaultValue || ''}`;
		const modal = AntdModal.confirm({
			title,
			icon: null,
			okText,
			cancelText,
			centered: true,
			width: multiline ? 560 : 420,
			content: React.createElement(AntdInput.Group, { compact: false },
				multiline
					? React.createElement(AntdInput.TextArea, {
						defaultValue: current,
						placeholder,
						autoSize: { minRows: 3, maxRows: 12 },
						autoFocus: true,
						maxLength,
						onChange: (e)=>{ current = e.target.value; },
						onPressEnter: (e)=>{ if(!e.shiftKey){ e.preventDefault(); modal.destroy(); resolve(current); } },
					})
					: React.createElement(AntdInput, {
						defaultValue: current,
						placeholder,
						autoFocus: true,
						maxLength,
						onChange: (e)=>{ current = e.target.value; },
						onPressEnter: ()=>{ modal.destroy(); resolve(current); },
					})
			),
			onOk: ()=>{ resolve(current); },
			onCancel: ()=>{ resolve(null); },
		});
	});
}

// 异步确认 — 替代 window.confirm。返回 Promise<boolean>。
export function asyncConfirm({ title = '确认操作？', content = '', okText = '确定', cancelText = '取消', okType = 'primary', danger = false } = {}){
	return new Promise((resolve)=>{
		AntdModal.confirm({
			title,
			content,
			okText,
			cancelText,
			centered: true,
			okType: danger ? 'danger' : okType,
			onOk: ()=>resolve(true),
			onCancel: ()=>resolve(false),
		});
	});
}

export function buildConversationTitle(prompt, source){
	const trimmed = `${prompt || ''}`.trim();
	if(source && source.title){
		if(!trimmed){
			return `${source.title} 分析`;
		}
		return `${source.title} · ${trimmed.slice(0, 24)}`;
	}
	return trimmed ? trimmed.slice(0, 24) : '未命名对话';
}

// 压缩区判定:消息 createdAt ≤ compact.uptoCreatedAt 即在压缩摘要覆盖区内。
export function compactCoversMessage(compact, msg){
	if(!compact || !compact.uptoCreatedAt || !compact.summary || !msg){ return false; }
	const t = (v)=>{ if(typeof v === 'number'){ return v; } const n = parseDateTimeMs(v || ''); return Number.isFinite(n) ? n : 0; };
	return t(msg.createdAt) <= t(compact.uptoCreatedAt);
}
export function isInsideCompactRegion(conversation, msg){
	if(!conversation || !compactCoversMessage(conversation.compact, msg)){ return false; }
	message.warning('该提问已在压缩摘要之内,重答会没有用户消息可发 —— 请先用 /compact 撤销压缩再重答');
	return true;
}

export function resolveReferenceItems(referenceIds, materials, bundles, templates){
	const refs = Array.isArray(referenceIds) ? referenceIds : [];
	const bundleItems = [];
	const materialItems = [];
	const templateItems = [];
	refs.forEach((id)=>{
		const text = `${id || ''}`;
		if(text.indexOf('bundle:') === 0){
			const bundle = bundles.find((item)=>item.id === text.replace('bundle:', ''));
			if(bundle){
				bundleItems.push(bundle);
				if(bundle.templateId){
					const template = templates.find((item)=>item.id === bundle.templateId);
					if(template){
						templateItems.push(template);
					}
				}
			}
			return;
		}
		if(text.indexOf('material:') === 0){
			const material = materials.find((item)=>item.id === text.replace('material:', ''));
			if(material){
				materialItems.push(material);
			}
			return;
		}
		// @模板 写入 template:<id>,此前唯一解析器不认 → 模板正文不进上下文、只剩模板名。
		if(text.indexOf('template:') === 0){
			const template = templates.find((item)=>item.id === text.replace('template:', ''));
			if(template){
				templateItems.push(template);
			}
		}
	});
	const bundleMaterialIds = bundleItems.flatMap((bundle)=>bundle.defaultMaterialIds && bundle.defaultMaterialIds.length ? bundle.defaultMaterialIds : (bundle.materialIds || []));
	const bundleMaterials = bundleMaterialIds.map((id)=>materials.find((item)=>item.id === id)).filter(Boolean);
	return {
		bundles: bundleItems,
		materials: uniqueById(materialItems.concat(bundleMaterials)),
		templates: uniqueById(templateItems),
		// 组合系统提示**只走独立层**(buildContextLayers 的 bundle-system 层)。此前这里还拼一份进
		// 「系统提示」层,加上「一键应用」写进会话规则的那份 —— 一键应用后同一段话在提示词里出现 3 次、
		// 只「加入参考」也有 2 次(白烧 token、还会被模型当成刻意强调)。
		systemPrompt: '',
	};
}

function uniqueById(list){
	const seen = new Set();
	return (list || []).filter((item)=>{
		if(!item || !item.id || seen.has(item.id)){
			return false;
		}
		seen.add(item.id);
		return true;
	});
}
