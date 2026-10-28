// 自动化规则面板(P4;默认关、默认零规则):「当 X 发生,自动做 Y」。
// 四道防失控在引擎里(总开关 / 深度守卫 / 每事件三条 / 每条冷却);面板只负责编辑与开关。onStatus:向折叠头上报状态(可选)。
import React from 'react';
import { Button, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, message } from 'antd';
import { isAutomationEnabled, setAutomationEnabled, subscribeAgentPrefs } from '../../utils/aiAgent/prefs';
import { AUTOMATION_EVENTS } from '../../utils/aiAgent/automation/events';
import { actionTypesForEvent } from '../../utils/aiAgent/automation/actions';
import { listToolNameOptions } from '../../utils/aiTools';
import { listRules, saveRule, removeRule, RULE_COOLDOWN_DEFAULT_MS, RULES_MAX } from '../../utils/aiAgent/automation/ruleStore';
import { MAX_CHAIN_DEPTH, MAX_RULES_PER_EVENT } from '../../utils/aiAgent/automation/engine';   // 文案数字与引擎常量同源
import { AdvSwitchRow, advStyles as styles } from './chat/AdvCard';
import { scriptFilterBy } from '../../utils/scriptMode';

const EVENT_LABELS = {
	'app.start': '软件启动',
	'record.saved': '存了命盘或事盘',
	'turn.end': '一轮对话结束(对话页)',
	'tool.before': 'AI 要执行某工具之前(可拒绝)',
	'tool.after': 'AI 做了写入',
	'task.done': '任务完成',
};
const ACTION_LABELS = {
	'select-source': '把这个档设为当前分析源',
	'start-brief': '自动生成一份简报',
	'archive-idle-conversations': '归档很久没动的对话',
	'deny': '拒绝执行(只对「执行某工具之前」生效)',
	'notify-script': '运行我的通知脚本(桌面版;先在「外部连接」里启用)',
};
// 编辑时的动作初值:存档动作在当前事件上不可选(此版本没有 / 配不上)→ 落到该事件第一个可选动作,不把裸键塞进下拉
function editableActionType(r){
	const t = `${((r && r.actions && r.actions[0]) || {}).type || ''}`;
	const ok = actionTypesForEvent(r && r.event);
	return ok.indexOf(t) >= 0 ? t : (ok[0] || 'select-source');
}
const EMPTY = { name: '', event: 'record.saved', actionType: 'select-source', enabled: true, cooldownMs: RULE_COOLDOWN_DEFAULT_MS, matchKind: '', days: 30, matchToolName: '' };

export default function AutomationRulesPanel({ onStatus }){
	const [on, setOn] = React.useState(()=>isAutomationEnabled());
	React.useEffect(()=>subscribeAgentPrefs(()=>setOn(isAutomationEnabled())), []);   // 跨窗口改键后重读(此前只挂载时读一次)
	const [rows, setRows] = React.useState([]);
	const [form, setForm] = React.useState(null);
	const [busy, setBusy] = React.useState(false);

	const reload = React.useCallback(async ()=>{ setRows(await listRules()); }, []);
	React.useEffect(()=>{ reload().catch(()=>{}); }, [reload]);
	// 此版本不会触发的规则(listRules 已标 wontFire 并排在最后)不算启用;它们仍计入 RULES_MAX(存储上限)
	const enabledCount = rows.filter((r)=>r && r.enabled && !r.wontFire).length;
	const idleCount = rows.filter((r)=>r && r.wontFire).length;
	React.useEffect(()=>{
		if(typeof onStatus !== 'function'){ return; }
		onStatus(on ? { on: true, tone: enabledCount ? 'good' : undefined, text: rows.length ? `${enabledCount}/${rows.length} 条启用` : '没有规则', count: rows.length || null } : { on: false, text: rows.length ? `关 · ${rows.length} 条待用` : '关', count: rows.length || null });
	}, [onStatus, on, rows.length, enabledCount]);

	async function save(){
		if(!form){ return; }
		setBusy(true);
		try{
			const action = { type: form.actionType };
			if(form.actionType === 'archive-idle-conversations'){ action.days = form.days; }
			await saveRule({ id: form.id, name: form.name || `${EVENT_LABELS[form.event] || form.event} → ${ACTION_LABELS[form.actionType] || form.actionType}`,
				event: form.event, enabled: form.enabled !== false, cooldownMs: form.cooldownMs,
				// kind 与 toolName 同样按事件守卫:此前先挑「只有命盘」再改事件,隐藏的 matchKind 仍写进 match →
				//   其余事件载荷无 kind(task.done 的 kind 是任务类别)→ 规则永不匹配(含「拒绝执行」安全规则)
				match: { ...(form.event === 'record.saved' && form.matchKind ? { kind: form.matchKind } : {}), ...(form.event === 'tool.before' && form.matchToolName ? { toolName: form.matchToolName } : {}) }, actions: [action] });
			message.success('已保存');
			setForm(null); await reload();
		}catch(e){ message.error(`保存失败:${(e && e.message) || e}`); }
		finally{ setBusy(false); }
	}

	const columns = [
		{ title: '规则', dataIndex: 'name', width: 200, ellipsis: true, render: (v, r)=>(<Space size={4} wrap><span style={{ fontWeight: 600 }} title={v}>{v}</span>{r.wontFire ? <Tag color="orange" style={{ marginInlineEnd: 0 }} data-rule-wontfire={r.wontFire.code} title={r.wontFire.reason}>此版本不会触发</Tag> : (r.enabled ? <Tag color="green" style={{ marginInlineEnd: 0 }}>启用</Tag> : <Tag style={{ marginInlineEnd: 0 }}>停用</Tag>)}{r.wontFire ? <span className={styles.soft} data-rule-wontfire-reason="1">{r.wontFire.reason}</span> : null}</Space>) },
		// 此版本没有的事件 / 动作:界面只写一句中文说明,原始名放悬停提示(表格里不露内部事件名)
		{ title: '当', dataIndex: 'event', ellipsis: true, render: (v, r)=>(r.orphanEvent ? <span data-rule-orphan-event="1" title={`${r.orphanEvent}`}>(此版本没有的事件,不会触发,可删)</span> : `${EVENT_LABELS[v] || v}${r.match && r.match.kind ? `(仅${r.match.kind === 'chart' ? '命盘' : '事盘'})` : ''}`) },
		{ title: '就', dataIndex: 'actions', ellipsis: true, render: (a)=>{
			const list = Array.isArray(a) ? a : [];
			if(!list.length){ return '—'; }
			const labelOf = (x)=>(x && Object.prototype.hasOwnProperty.call(ACTION_LABELS, x.type) ? ACTION_LABELS[x.type] : '');
			const unknown = list.filter((x)=>!labelOf(x)).map((x)=>`${(x && x.type) || ''}`);
			const text = list.map((x)=>labelOf(x) || '(此版本没有的动作)').join('、');
			return unknown.length ? <span data-rule-orphan-action="1" title={unknown.join('、')}>{text}</span> : text;
		} },
		{ title: '冷却', dataIndex: 'cooldownMs', width: 80, render: (v)=>(v ? `${Math.round(v / 1000)} 秒` : '不冷却') },
		{ title: '', key: 'ops', width: 200, render: (_, r)=>(
			<Space size={4} wrap>
				{/* 事件此版本没有 → 只能删;其余「不会触发」(动作没有 / 配不上)可编辑改好,启停无意义 */}
				<Button size="small" data-rule-edit={r.id} disabled={!!r.orphanEvent} title={r.orphanEvent ? '此版本没有这个事件,只能删除' : undefined} onClick={()=>setForm({ id: r.id, name: r.name, event: r.event, actionType: editableActionType(r), enabled: r.enabled, cooldownMs: r.cooldownMs, matchKind: (r.match || {}).kind || '', matchToolName: (r.match || {}).toolName || '', days: (r.actions[0] || {}).days || 30 })}>编辑</Button>
				<Button size="small" data-rule-toggle={r.id} disabled={!!r.wontFire} title={r.orphanEvent ? '此版本没有这个事件,只能删除' : (r.wontFire ? `${r.wontFire.reason};改好动作或删除` : undefined)} onClick={async ()=>{
					try{ await saveRule({ ...r, enabled: !r.enabled }); }catch(e){ message.error(`${r.enabled ? '停用' : '启用'}失败:${(e && e.message) || e}`); }
					await reload();
				}}>{r.enabled ? '停用' : '启用'}</Button>
				<Button size="small" danger data-rule-delete={r.id} onClick={async ()=>{ await removeRule(r.id); await reload(); }}>删除</Button>
			</Space>
		) },
	];

	return (
		<div data-automation-rules="1" className={styles.subPanel}>
			<AdvSwitchRow title="自动规则" desc={`「当 X 发生,自动做 Y」。规则全部你自己设,默认一条都没有;规则触发的动作最多再连带一层规则(链深 ${MAX_CHAIN_DEPTH},不会无限连锁),每个事件最多触发 ${MAX_RULES_PER_EVENT} 条,每条有冷却。`} checked={on}
				control={<Switch checked={on} data-automation-switch="1" onChange={(v)=>{ setAutomationEnabled(!!v); setOn(!!v); }} checkedChildren="开" unCheckedChildren="关" />} />
			<div className={styles.subBody}>
				<div className={styles.toolbarRow}>
					<Button size="small" data-rule-new="1" onClick={()=>setForm({ ...EMPTY })}>新建规则</Button>
					<Button size="small" data-rule-refresh="1" onClick={()=>reload()}>刷新</Button>
					{idleCount ? <span className={styles.soft} data-rule-wontfire-hint="1">有 {idleCount} 条此版本不会触发的规则(排在最后,原因见各行);它们仍占 {RULES_MAX} 条上限里的名额,可删</span> : null}
				</div>
				<div className={styles.table}>
					<Table size="small" rowKey="id" columns={columns} dataSource={rows} pagination={false} tableLayout="fixed" scroll={{ x: 720 }} locale={{ emptyText: '还没有规则' }} onRow={(r)=>({ 'data-rule-row': r.id })} />
				</div>
			</div>
			<Modal open={!!form} title="自动规则" okText="保存" cancelText="取消" confirmLoading={busy} onOk={save} onCancel={()=>setForm(null)} destroyOnClose okButtonProps={{ 'data-rule-save': '1' }}>
				{form ? (
					<Space direction="vertical" style={{ width: '100%' }} size={8} data-rule-modal="1">
						<Input addonBefore="名称" data-rule-name="1" value={form.name} onChange={(e)=>setForm({ ...form, name: e.target.value })} placeholder="留空自动生成" />
						<div>当:<Select style={{ width: '100%', marginTop: 4 }} value={form.event} data-rule-event="1" onChange={(v)=>{ const okTypes = actionTypesForEvent(v); setForm({ ...form, event: v, ...(okTypes.indexOf(form.actionType) < 0 ? { actionType: okTypes[0] || '' } : {}), ...(v !== 'record.saved' ? { matchKind: '' } : {}), ...(v !== 'tool.before' ? { matchToolName: '' } : {}) }); }} options={AUTOMATION_EVENTS.map((e)=>({ value: e, label: EVENT_LABELS[e] || e }))} /></div>   {/* 切换事件清掉不适用的匹配项 */}
						{form.event === 'tool.before' ? (
							<div>只对工具:<Select filterOption={scriptFilterBy('label')} style={{ width: '100%', marginTop: 4 }} value={form.matchToolName} onChange={(v)=>setForm({ ...form, matchToolName: v })} showSearch optionFilterProp="label" data-rule-tool-name="1"
								options={[{ value: '', label: '任何工具' }].concat(listToolNameOptions())} /></div>
						) : null}
						{form.event === 'record.saved' ? (
							<div>只在:<Select style={{ width: '100%', marginTop: 4 }} value={form.matchKind} data-rule-kind="1" onChange={(v)=>setForm({ ...form, matchKind: v })} options={[{ value: '', label: '命盘或事盘都算' }, { value: 'chart', label: '只有命盘' }, { value: 'case', label: '只有事盘' }]} /></div>
						) : null}
						<div>就:<Select style={{ width: '100%', marginTop: 4 }} value={form.actionType} data-rule-action="1" onChange={(v)=>setForm({ ...form, actionType: v })} options={actionTypesForEvent(form.event).map((t)=>({ value: t, label: ACTION_LABELS[t] || t }))} /> <span className={styles.soft}>{/* 只列这个事件上可达的动作 */}只列在「{EVENT_LABELS[form.event] || form.event}」上会真正执行的动作</span></div>
						{form.actionType === 'archive-idle-conversations' ? (
							<div>多久没动算「久」:<InputNumber min={1} max={365} value={form.days} data-rule-days="1" onChange={(v)=>setForm({ ...form, days: v })} addonAfter="天" style={{ marginLeft: 6 }} /></div>
						) : null}
						<div>冷却:<InputNumber min={0} max={86400} value={Math.round((form.cooldownMs || 0) / 1000)} data-rule-cooldown="1" onChange={(v)=>setForm({ ...form, cooldownMs: Math.max(0, Number(v) || 0) * 1000 })} addonAfter="秒" style={{ marginLeft: 6 }} /> <span className={styles.soft}>0 = 不冷却</span></div>
						<div>启用:<Switch checked={form.enabled !== false} data-rule-enabled="1" onChange={(v)=>setForm({ ...form, enabled: v })} style={{ marginLeft: 6 }} /></div>
					</Space>
				) : null}
			</Modal>
		</div>
	);
}
