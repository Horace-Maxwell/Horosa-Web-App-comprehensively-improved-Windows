// 对话上下文策略·设置卡的纯函数层(零 React、零 IO):预设选项、细项字段描述(档数=FIELD_SPECS.length,面板标题据此计数)、字段→写入补丁、预算文案。
// 写入永远经 aiChatHistory.writeContextPolicy/clearContextPolicy(本文件不碰 localStorage);打开设置卡不写键,只有用户改动才写。
import { CONTEXT_POLICY_PRESETS, DEFAULT_CONTEXT_POLICY, historyTokenBudgetForModel, HISTORY_BUDGET_MIN, HISTORY_BUDGET_MAX } from '../aiChatHistory';
import { mountCharBudgetFor, contextWindowForModel } from '../aiAnalysisProviders';

export const PRESET_OPTIONS = [
	{ value: 'legacy', label: '不裁', help: '旧版行为:不裁历史(历史双发,最费 token);工具轮同样只全文回放最近 2 个带工具回合' },   // [Q-290/PP-21④]
	{ value: 'window', label: '窗口', help: '按模型窗口预算从最新往旧保留,问答对不切断' },
	{ value: 'economy', label: '经济', help: '窗口 + 更早工具轮折叠 + 同参调用去重(省 token、吃缓存)' },
];

// 细项字段(现为十一档;面板标题按 FIELD_SPECS.length 计数,勿在注释里写死档数):key 用点号路径;kind=select|int|intOrNull|intOrInfinity|bool
export const FIELD_SPECS = [
	{ key: 'historyMode', label: '历史裁剪', kind: 'select', options: [{ value: 'legacy', label: '不裁(旧版)' }, { value: 'window', label: '按预算裁' }], help: '「按预算裁」才用到 历史 token 预算 / 最少·最多保留条数 / 保留图片数;「挂载字数预算」与工具轮回放各档两种模式都生效' },   // [AR-33] 逐字段写明适用模式(此前一句「下面的」把挂载字数预算也说成只在窗口模式生效)
	{ key: 'historyTokenBudget', label: '历史 token 预算', kind: 'intOrNull', min: 500, max: 200000, help: '留空=按当前模型窗口自动(卡片上方显示估算)' },
	// [#80] 挂载(命盘/技法快照)字数预算。此前只按模型窗口实算、用户无处可调:模型不在窗口目录表里
	//   (如 gpt-6 系)就回落保底,四技法均分后单家只剩四五千字,整张 Dasha 表/分盘被裁掉。
	{ key: 'mountCharBudget', label: '挂载字数预算', kind: 'intOrNull', min: 2000, max: 400000, help: '留空=按当前模型窗口自动(卡片上方显示估算);填数=固定该字数,不受自动上限封顶;两种历史裁剪模式都生效' },
	{ key: 'historyMinKeep', label: '最少保留条数', kind: 'int', min: 0, max: 200, help: '即使超预算也至少保留这么多条' },
	{ key: 'historyMaxKeep', label: '最多保留条数', kind: 'int', min: 1, max: 400, help: '窗口上限' },
	{ key: 'historyImageKeep', label: '保留图片数', kind: 'intOrInfinity', min: 0, max: 50, help: '不限=全部图片都随历史发送;只在「按预算裁」模式生效(不裁模式历史原样发送)' },
	{ key: 'traceTurnsFull', label: '工具轮全文回放', kind: 'int', min: 0, max: 50, help: '最近 N 个带工具动作的回合按参数+结果原文回放' },
	{ key: 'traceTurnsFolded', label: '工具轮折叠回放', kind: 'int', min: 0, max: 100, help: '再往前 N 个回合只回放折叠后的结果' },
	{ key: 'foldedResultMaxChars.read', label: '折叠上限·只读结果', kind: 'int', min: 100, max: 8000, help: '折叠回放时只读工具结果保留的字数' },
	{ key: 'foldedResultMaxChars.additive', label: '折叠上限·写入结果', kind: 'int', min: 100, max: 8000, help: '折叠回放时写入类结果保留的字数' },
	{ key: 'dedupSameCall', label: '同参调用去重', kind: 'bool', help: '同一 Turn 内同工具同参数的只读调用只执行一次' },
];

export function fieldValue(policy, key){
	const p = policy || DEFAULT_CONTEXT_POLICY;
	const parts = `${key}`.split('.');
	let v = p;
	for(let i = 0; i < parts.length; i++){ v = v && typeof v === 'object' ? v[parts[i]] : undefined; }
	return v;
}

// 字段改动 → writeContextPolicy 的补丁(嵌套键保留同级另一个值;Infinity/null 语义原样)
export function patchForField(policy, key, value){
	const p = policy || DEFAULT_CONTEXT_POLICY;
	if(key === 'foldedResultMaxChars.read' || key === 'foldedResultMaxChars.additive'){
		const sub = key.split('.')[1];
		return { foldedResultMaxChars: { ...(p.foldedResultMaxChars || DEFAULT_CONTEXT_POLICY.foldedResultMaxChars), [sub]: value } };
	}
	if(key === 'historyImageKeep'){ return { historyImageKeep: value === null || value === undefined || value === '' ? Infinity : value }; }
	if(key === 'historyTokenBudget'){ return { historyTokenBudget: value === '' || value === undefined ? null : value }; }
	if(key === 'mountCharBudget'){ return { mountCharBudget: value === '' || value === undefined ? null : value }; }
	return { [key]: value };
}

// [Q-290/M-105·PP-21②] 预设是整组写入,此前含 mountCharBudget:null → 用户为治挂载被裁填了挂载字数预算后点「经济」,挂载预算被清回自动
//   (卡片说明称挂载预算与历史预算是两套)。预设补丁不含 mountCharBudget。
export function presetPatch(name){
	const preset = CONTEXT_POLICY_PRESETS[name];
	if(!preset){ return null; }
	const { mountCharBudget, ...rest } = preset;
	return { ...rest };
}

// 「当前模型历史预算≈N」:固定预算优先;否则按模型窗口估算(未知模型=缺省值)
export function budgetText(policy, model, numCtx){
	const p = policy || DEFAULT_CONTEXT_POLICY;
	if(p.historyMode !== 'window'){ return '不裁模式:全部真消息随每轮发送(旧版行为,最费 token)'; }
	if(Number.isFinite(p.historyTokenBudget) && p.historyTokenBudget > 0){ return `历史预算固定为 ${p.historyTokenBudget} token`; }
	const n = historyTokenBudgetForModel(model || '', { numCtx });
	return `当前模型「${model || '未选'}」历史预算≈${n} token(按模型窗口 10% 取,夹在 ${HISTORY_BUDGET_MIN}–${HISTORY_BUDGET_MAX})`;
}

// [#80] 「当前模型挂载预算≈N 字」:固定值优先;否则按模型窗口实算(未知模型=保底)。
export function mountBudgetText(policy, model, numCtx){
	const p = policy || DEFAULT_CONTEXT_POLICY;
	if(Number.isFinite(p.mountCharBudget) && p.mountCharBudget > 0){ return `挂载预算固定为 ${p.mountCharBudget} 字`; }
	const n = mountCharBudgetFor(model || '', { numCtx });
	const known = contextWindowForModel(model || '') || (Number(numCtx) > 0 ? Number(numCtx) : 0);
	return known
		? `当前模型「${model || '未选'}」挂载预算≈${n} 字(按窗口 ${known} token 实算)`
		: `当前模型「${model || '未选'}」不在窗口目录表里,挂载预算按保底 ${n} 字 —— 内容被裁时可在此填一个更大的数`;
}

// modelSelection 形如 profileId::model
export function modelOfSelection(selection){
	const s = `${selection || ''}`;
	const i = s.indexOf('::');
	return i >= 0 ? s.slice(i + 2) : s;
}
