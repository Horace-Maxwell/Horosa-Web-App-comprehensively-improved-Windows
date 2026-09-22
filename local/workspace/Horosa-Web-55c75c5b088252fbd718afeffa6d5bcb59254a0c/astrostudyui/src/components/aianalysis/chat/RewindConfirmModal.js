// 回退确认(A5):三栏——将删除的消息 / 将撤销的 AI 动作(可逐条取消勾选)/ 将恢复的设置;「回退」= 先逐条撤销(任一失败即停、不删消息)→ 删消息 → 恢复设置 → 清压缩;「改为分支」保留原线。
import React from 'react';
import { Modal, Checkbox, Button, Tag } from 'antd';

export default function RewindConfirmModal({ plan, open, onCancel, onConfirm, onBranch, busy }){
	const [skip, setSkip] = React.useState({});
	React.useEffect(()=>{ if(open){ setSkip({}); } }, [open, plan && plan.targetId]);
	if(!plan){ return null; }
	const actions = plan.undoActions || [];
	const chosen = actions.filter((a)=>!skip[a.actionId]);
	const r = plan.restore || {};
	const restoreRows = [
		['挂载源', r.sourceId || '(无)'],
		['技法', Array.isArray(r.techniqueKeys) && r.techniqueKeys.length ? r.techniqueKeys.join(', ') : '(无)'],
		['参考引用', Array.isArray(r.referenceIds) && r.referenceIds.length ? `${r.referenceIds.length} 项` : '(无)'],
		['模型', r.modelSelection || '(不变)'],
		['思考档', r.thinkingLevel || '(不变)'],
	];
	return (
		<Modal title="回退到这一轮" open={!!open} visible={!!open} onCancel={onCancel} width={640} destroyOnClose data-rewind-modal="1"
			footer={[
				<Button key="c" onClick={onCancel}>取消</Button>,
				<Button key="b" onClick={()=>onBranch && onBranch()} disabled={busy} data-rewind-branch="1">改为分支(保留原线)</Button>,
				<Button key="ok" type="primary" danger loading={busy} onClick={()=>onConfirm && onConfirm(chosen.map((a)=>a.actionId))} data-rewind-confirm="1">回退</Button>,
			]}>
			<div data-rewind-plan="1" style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
				<div><b>将删除 {plan.removeCount} 条消息</b>(从这条你的消息起到最后;消息删除不可恢复,建议先「改为分支」)</div>
				<div>
					<b>将撤销的 AI 动作 {chosen.length}/{actions.length}</b>{actions.length ? '(取消勾选=保留该结果)' : '(无)'}
					{actions.map((a)=>(
						<div key={a.actionId} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }} data-rewind-action={a.actionId}>
							<Checkbox checked={!skip[a.actionId]} onChange={(e)=>setSkip((s)=>({ ...s, [a.actionId]: !e.target.checked }))} />
							<Tag style={{ margin: 0 }}>{a.name}</Tag>
							<span style={{ color: 'var(--horosa-text-soft, #8a8f99)' }}>{a.summary}</span>
						</div>
					))}
				</div>
				<div>
					<b>将恢复的设置</b>{plan.restore ? '' : '(这条消息没有存检查点,设置保持现状)'}
					{plan.restore ? restoreRows.map(([k, v])=>(<div key={k} style={{ display: 'flex', gap: 8 }}><span style={{ flex: '0 0 72px', color: 'var(--horosa-text-soft, #8a8f99)' }}>{k}</span><span>{v}</span></div>)) : null}
					{plan.clearCompact ? <div style={{ color: 'var(--horosa-warn, #d48806)' }}>压缩点落在被删区,将一并取消压缩。</div> : null}
				</div>
				<div style={{ color: 'var(--horosa-text-soft, #8a8f99)' }}>顺序:先撤销动作(任一失败即停,不删消息,告诉你哪条没撤成)→ 删消息 → 恢复设置。你手工改过的档不会自动撤,请走档案管理。</div>
			</div>
		</Modal>
	);
}
