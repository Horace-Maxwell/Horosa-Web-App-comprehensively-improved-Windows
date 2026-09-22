// [批二⑦] 行动计划卡(/plan 的浮层):列出规划者给的步骤(带工具标签/写入标记/风险/待确认问题/被剔工具),批准后才发起真正的 Turn。
// data-plan-* 供机读:card/steps/writes/approve/edit/cancel。
import React from 'react';
import { Modal, Button, Tag } from 'antd';
import { toolLabel } from '../../../utils/aiTools/labels';

export default function PlanCard({ open, goal, plan, dropped, busy, onApprove, onEdit, onCancel }){
	if(!open || !plan){ return null; }
	const steps = Array.isArray(plan.steps) ? plan.steps : [];
	const writes = steps.filter((s)=>s && s.writes).length;
	const soft = { color: 'var(--horosa-text-soft, #8a8f99)' };
	return (
		<Modal title="行动计划(批准后才执行)" open visible onCancel={onCancel} width={560} footer={[
			<Button key="cancel" data-plan-cancel="1" onClick={onCancel}>取消</Button>,
			<Button key="edit" data-plan-edit="1" onClick={onEdit}>修改目标</Button>,
			<Button key="ok" type="primary" data-plan-approve="1" loading={!!busy} onClick={onApprove}>批准并执行</Button>,
		]}>
			<div data-plan-card="1" data-plan-steps={steps.length} data-plan-writes={writes} style={{ fontSize: 13, lineHeight: 1.7 }}>
				<div style={{ ...soft, marginBottom: 6 }}>目标:{goal}</div>
				<div style={{ marginBottom: 8 }}>{plan.summary}</div>
				<ol style={{ paddingLeft: 20, margin: 0 }}>
					{steps.map((s, i)=>(
						<li key={i} data-plan-step={i}>
							{s.purpose}
							{s.tool ? <Tag style={{ marginLeft: 6 }}>{toolLabel(s.tool)}</Tag> : null}
							{s.writes ? <Tag color="orange" style={{ marginLeft: 4 }}>写入</Tag> : null}
						</li>
					))}
				</ol>
				{plan.risks && plan.risks.length ? <div style={{ marginTop: 8 }}>风险:{plan.risks.join(';')}</div> : null}
				{plan.questions && plan.questions.length ? <div style={{ marginTop: 6 }}>执行前想先问你:{plan.questions.join(';')}</div> : null}
				{dropped && dropped.length ? <div style={{ ...soft, marginTop: 6 }}>已剔除目录外工具:{dropped.join('、')}</div> : null}
				<div style={{ ...soft, marginTop: 8 }}>批准后 AI 只能在这份计划范围内行动;写入步骤仍按你的审批档确认。</div>
			</div>
		</Modal>
	);
}
