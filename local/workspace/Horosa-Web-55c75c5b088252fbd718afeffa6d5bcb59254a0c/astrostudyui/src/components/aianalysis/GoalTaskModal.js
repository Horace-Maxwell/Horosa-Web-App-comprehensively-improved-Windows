// 新建目标任务弹窗(P2):一句话目标 + 完成判据 + 预算四维 + 挂载源/技法;提交即建任务并开跑(经 goalRunner.createGoalTask,与工具同一入口)。
import React from 'react';
import { Modal, Input, InputNumber, Select, message } from 'antd';
import { createGoalTask, resolveHeadlessProfile } from '../../utils/aiAgent/goalRunner';
import { estimateUsageCost } from '../../utils/aiAnalysisProviders';
import { DEFAULT_TASK_BUDGET } from '../../utils/aiAgent/tasks';
import { isAgentEnabled, isGoalEnabled } from '../../utils/aiAgent/prefs';
import { listAnalysisSources } from '../../utils/aiAnalysisSources';
import { listAnalysisTechniqueOptions } from '../../utils/aiAnalysisContext';

export default function GoalTaskModal({ open, onClose, onCreated }){
	const [goal, setGoal] = React.useState('');
	const [criteria, setCriteria] = React.useState('');
	const [budget, setBudget] = React.useState({ ...DEFAULT_TASK_BUDGET });
	const [sourceCid, setSourceCid] = React.useState(undefined);
	const [techniques, setTechniques] = React.useState([]);
	const [busy, setBusy] = React.useState(false);
	const sources = React.useMemo(()=>{ try{ return listAnalysisSources() || []; }catch(e){ return []; } }, [open]);
	const source = sources.find((s)=>s.id === sourceCid) || null;
	const techOptions = React.useMemo(()=>{ try{ return (listAnalysisTechniqueOptions(source || { sourceType: 'chart' }) || []).map((o)=>({ value: o.value, label: o.label || o.value })); }catch(e){ return []; } }, [source]);
	const gated = !(isAgentEnabled() && isGoalEnabled());
	// [Q-294/M-109·AR-10] 建任务时判当前模型是否有计价表:无价时费用维永不触发,弹窗明说而不是显示「$0.000/上限」
	const [unpricedModel, setUnpricedModel] = React.useState('');
	React.useEffect(()=>{
		if(!open){ return undefined; }
		let alive = true;
		(async ()=>{
			try{
				const r = await resolveHeadlessProfile(null);
				const m = r && r.model ? `${r.model}` : '';
				const priced = m ? estimateUsageCost(m, 1000, 1000) : null;
				if(alive){ setUnpricedModel(m && !priced ? m : ''); }
			}catch(e){ if(alive){ setUnpricedModel(''); } }
		})();
		return ()=>{ alive = false; };
	}, [open]);
	async function submit(){
		if(!goal.trim()){ message.warning('请先写一句话目标'); return; }
		if(gated){ message.warning('请先在「AI 助手行动能力」里打开总开关和「目标任务」'); return; }
		setBusy(true);
		try{
			const t = await createGoalTask({ goal: goal.trim(), successCriteria: criteria.trim(), budget, sourceCid: sourceCid || null, techniques, autoStart: true, origin: 'in-app' });
			message.success(`目标任务「${t.title}」已开始`);
			if(typeof onCreated === 'function'){ onCreated(t); }
			setGoal(''); setCriteria('');
			onClose();
		}catch(e){ message.error(`建任务失败:${e && e.message ? e.message : e}`); }
		finally{ setBusy(false); }
	}
	return (
		<Modal title="新建目标任务" open={open} visible={open} onCancel={onClose} onOk={submit} okText="开始" confirmLoading={busy} destroyOnClose>
			<div data-goal-task-modal="1" style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
				{gated ? <div style={{ color: 'var(--horosa-warn, #d48806)' }}>目标任务需要先打开「AI 助手行动能力」总开关与「目标任务」子开关(进阶 → AI 助手行动能力)。</div> : null}
				<div><div>目标(一句话,能判断做完没有)</div><Input.TextArea data-goal-input="1" rows={3} maxLength={2000} value={goal} onChange={(e)=>setGoal(e.target.value)} placeholder="例:把资料库《名单》里的 6 个人建成命盘,各起一份八字快照,最后列出谁的命宫在午宫" /></div>
				<div><div>完成判据(可选)</div><Input maxLength={1000} value={criteria} onChange={(e)=>setCriteria(e.target.value)} placeholder="例:6 个人都建了命盘并各有一份八字快照" /></div>
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
					<span>预算:</span>
					<span>轮数 <InputNumber size="small" min={1} max={20} value={budget.maxTurns} onChange={(v)=>setBudget((b)=>({ ...b, maxTurns: v || 1 }))} style={{ width: 70 }} /></span>
					<span>调用 <InputNumber size="small" min={1} max={200} value={budget.maxCalls} onChange={(v)=>setBudget((b)=>({ ...b, maxCalls: v || 1 }))} style={{ width: 80 }} /></span>
					<span title={unpricedModel ? `模型「${unpricedModel}」不在计价表里,费用预算不会触发停止;请用轮数 / 调用次数上限约束` : undefined}>费用$ <InputNumber size="small" min={0.1} max={50} step={0.5} value={budget.maxCostUsd} disabled={!!unpricedModel} onChange={(v)=>setBudget((b)=>({ ...b, maxCostUsd: v || 0.1 }))} style={{ width: 80 }} />{unpricedModel ? <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>(该模型无计价表,费用预算不可用)</span> : null}</span>
					<span>分钟 <InputNumber size="small" min={1} max={120} value={budget.maxWallMinutes} onChange={(v)=>setBudget((b)=>({ ...b, maxWallMinutes: v || 1 }))} style={{ width: 70 }} /></span>
				</div>
				<div style={{ display: 'flex', gap: 8 }}>
					<Select size="small" allowClear placeholder="挂载命盘/事盘(可选)" value={sourceCid} onChange={setSourceCid} style={{ flex: '1 1 50%' }} showSearch optionFilterProp="label"
						options={sources.slice(0, 200).map((s)=>({ value: s.id, label: `${s.title}${s.sourceType === 'case' ? '(事盘)' : ''}` }))} />
					<Select size="small" mode="multiple" placeholder="技法(可选,≤6)" value={techniques} onChange={(v)=>setTechniques((v || []).slice(0, 6))} style={{ flex: '1 1 50%' }} options={techOptions} maxTagCount={3} />
				</div>
				<div style={{ color: 'var(--horosa-text-soft, #8a8f99)' }}>写入策略跟随「AI 助手行动能力」审批档:每次确认时任务会停在待办等你点允许(30 分钟不理视为跳过)。所有写入进账本可撤销。</div>
			</div>
		</Modal>
	);
}
