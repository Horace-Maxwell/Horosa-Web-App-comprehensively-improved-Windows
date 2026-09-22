// 设置卡「对话上下文策略」(A1a):三预设 + 十档细项 + 当前模型历史预算估算。
// 纪律:打开进阶页不写键(只读 readContextPolicy 渲染);任何写入只发生在用户改动时,且一律经 writeContextPolicy/clearContextPolicy。
import React from 'react';
import { Radio, Select, InputNumber, Switch, Button, Collapse } from 'antd';
import { readCompactAutoTokens, writeCompactAutoTokens, COMPACT_AUTO_TOKENS_MIN, COMPACT_AUTO_TOKENS_MAX } from '../../../utils/aiChat/compactPrefs';
import { readContextPolicy, writeContextPolicy, clearContextPolicy, subscribeContextPolicy, contextPolicyPresetName, hasStoredContextPolicy } from '../../../utils/aiChatHistory';
import { PRESET_OPTIONS, FIELD_SPECS, fieldValue, patchForField, presetPatch, budgetText, mountBudgetText } from '../../../utils/aiChat/policyPanel';
import { AdvCard, AdvRow, AdvStatus, ADV_SECTION_IDS, advStyles as styles } from './AdvCard';

const PRESET_LABEL = { legacy: '不裁', window: '窗口', economy: '经济' };
const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

function FieldRow({ spec, policy }){
	const v = fieldValue(policy, spec.key);
	const write = (val)=>writeContextPolicy(patchForField(policy, spec.key, val));
	let control = null;
	if(spec.kind === 'select'){
		control = <Select size="small" value={v} options={spec.options} style={{ width: 150 }} onChange={write} data-policy-field={spec.key} />;
	}else if(spec.kind === 'bool'){
		control = <Switch size="small" checked={!!v} onChange={write} data-policy-field={spec.key} />;
	}else if(spec.kind === 'intOrInfinity'){
		const unlimited = v === Infinity || v === null || v === undefined;
		control = (
			<span className={styles.inline}>
				<Switch size="small" checked={unlimited} checkedChildren="不限" unCheckedChildren="限" onChange={(on)=>write(on ? Infinity : Math.min(spec.max, 4))} data-policy-field={`${spec.key}.unlimited`} />
				{unlimited ? null : <InputNumber size="small" min={spec.min} max={spec.max} value={v} onChange={(n)=>{ if(Number.isFinite(n)){ write(n); } }} style={{ width: 90 }} data-policy-field={spec.key} />}
			</span>
		);
	}else if(spec.kind === 'intOrNull'){
		control = <InputNumber size="small" min={spec.min} max={spec.max} value={v === null || v === undefined ? undefined : v} placeholder="自动" onChange={(n)=>write(Number.isFinite(n) ? n : null)} style={{ width: 120 }} data-policy-field={spec.key} />;
	}else{
		control = <InputNumber size="small" min={spec.min} max={spec.max} value={v} onChange={(n)=>{ if(Number.isFinite(n)){ write(n); } }} style={{ width: 90 }} data-policy-field={spec.key} />;
	}
	return <AdvRow label={spec.label} help={spec.help}>{control}</AdvRow>;
}

export default function ChatContextPolicyPanel({ model, numCtx }){
	const [policy, setPolicy] = React.useState(()=>readContextPolicy());
	const [autoTokens, setAutoTokens] = React.useState(()=>readCompactAutoTokens());   // [批二⑧] 压缩提醒阈值(uiPrefs;缺省空=不提醒)
	React.useEffect(()=>subscribeContextPolicy((p)=>setPolicy(p)), []);
	const preset = contextPolicyPresetName(policy);
	// [进阶审计 D8] 缺省=窗口(键不存在):状态标「缺省」、「恢复现状」无可恢复 → 禁用;键存在(含用户明确选的窗口档)才可恢复
	const stored = hasStoredContextPolicy();
	const status = !stored
		? <AdvStatus>缺省·{PRESET_LABEL[preset] || preset}</AdvStatus>
		: <AdvStatus on>{preset === 'custom' ? '自定义' : PRESET_LABEL[preset] || preset}</AdvStatus>;
	const fieldCountCn = CN_NUM[FIELD_SPECS.length] || `${FIELD_SPECS.length}`;
	return (
		<AdvCard id={ADV_SECTION_IDS.context} icon="history" title="对话上下文策略" status={status}
			desc="每轮把多少历史与工具动作发给模型。缺省=窗口(按模型窗口裁历史,治历史双发);「不裁」为旧版行为;「经济」再省 token、更吃上游缓存;随时可恢复。"
			actions={<Button size="small" data-policy-restore="1" onClick={()=>clearContextPolicy()} disabled={!stored}>恢复现状</Button>}
			data-chat-context-policy-panel="1" data-preset={preset}>
			<Radio.Group className={styles.segment} size="small" value={preset === 'custom' ? undefined : preset} data-policy-preset="1" onChange={(e)=>{ const patch = presetPatch(e.target.value); if(patch){ writeContextPolicy(patch); } }}>
				{PRESET_OPTIONS.map((o)=>(<Radio.Button key={o.value} value={o.value} title={o.help}>{o.label}</Radio.Button>))}
			</Radio.Group>
			<div className={styles.infoStrip} data-policy-budget="1">{budgetText(policy, model, numCtx)}</div>
			{/* [#80] 挂载预算与历史预算是两套(前者按字数管命盘/技法快照,后者按 token 管真消息),各自显示实算值 */}
			<div className={styles.infoStrip} data-policy-mount-budget="1">{mountBudgetText(policy, model, numCtx)}</div>
			<div className={[styles.infoStrip, styles.inline].join(' ')} data-compact-suggest-row="1">
				<span>压缩提醒阈值</span>
				<InputNumber size="small" min={COMPACT_AUTO_TOKENS_MIN} max={COMPACT_AUTO_TOKENS_MAX} step={1000} value={autoTokens === null ? undefined : autoTokens} placeholder="不提醒" onChange={(n)=>{ const v = writeCompactAutoTokens(n); setAutoTokens(v); }} style={{ width: 120 }} data-policy-field="compactAutoTokens" />
				<span>保留历史 ≥ 这么多 token 时,状态栏提示你 /compact(每会话一次);空=不提醒;绝不自动压缩</span>
			</div>
			<Collapse ghost className={styles.collapse}>
				<Collapse.Panel header={<span data-policy-fields-header="1">{`细项(${fieldCountCn}档;改任一项即为自定义)`}</span>} key="fields">
					<div className={styles.stack}>
						{FIELD_SPECS.map((spec)=>(<FieldRow key={spec.key} spec={spec} policy={policy} />))}
					</div>
				</Collapse.Panel>
			</Collapse>
		</AdvCard>
	);
}
