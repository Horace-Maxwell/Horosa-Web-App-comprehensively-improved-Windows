// 新建定时任务弹窗(P3):类型 + 标题 + 排期(每天/每周/每月/仅一次)+ 命盘/技法 + 提示词 + 错过策略 + 通知;提交即建「已排期」任务(与工具 schedule_task 同一实体形状)。
import React from 'react';
import { snapshotModelSelection } from '../../utils/aiAgent/tasks/modelSnapshot';
import { Modal, Input, InputNumber, Select, Switch, message } from 'antd';
import { createTask } from '../../utils/aiAgent/tasks';
import { SCHEDULE_TYPES, SCHEDULED_KINDS, SCHEDULED_KIND_LABELS, WEEKDAY_LABELS, DAYS_AHEAD_DEFAULT, normalizeSchedule, computeNextRun, describeSchedule } from '../../utils/aiAgent/tasks/schedule';
import { isAgentEnabled, isSchedulerEnabled } from '../../utils/aiAgent/prefs';
import { listAnalysisSources } from '../../utils/aiAnalysisSources';
import { listAnalysisTechniqueOptions } from '../../utils/aiAnalysisContext';

const TYPE_LABELS = { daily: '每天', weekly: '每周', monthly: '每月', once: '仅一次' };
const soft = { color: 'var(--horosa-text-soft, #8a8f99)' };

function localInputValue(d){
	const p = (n)=>(n < 10 ? '0' : '') + n;
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function ScheduledTaskModal({ open, onClose, onCreated }){
	const [kind, setKind] = React.useState('daily-brief');
	const [title, setTitle] = React.useState('');
	const [type, setType] = React.useState('daily');
	const [time, setTime] = React.useState('08:00');
	const [weekday, setWeekday] = React.useState(1);
	const [day, setDay] = React.useState(1);
	const [at, setAt] = React.useState(()=>localInputValue(new Date(Date.now() + 60 * 60 * 1000)));
	const [sourceCid, setSourceCid] = React.useState(undefined);
	const [techniques, setTechniques] = React.useState([]);
	const [prompt, setPrompt] = React.useState('');
	const [missedPolicy, setMissedPolicy] = React.useState('skip');
	const [notify, setNotify] = React.useState(true);
	const [daysAhead, setDaysAhead] = React.useState(DAYS_AHEAD_DEFAULT);
	const [busy, setBusy] = React.useState(false);
	const sources = React.useMemo(()=>{ try{ return listAnalysisSources() || []; }catch(e){ return []; } }, [open]);
	const source = sources.find((s)=>s.id === sourceCid) || null;
	const techOptions = React.useMemo(()=>{ try{ return (listAnalysisTechniqueOptions(source || { sourceType: 'chart' }) || []).map((o)=>({ value: o.value, label: o.label || o.value })); }catch(e){ return []; } }, [source]);
	const gated = !(isAgentEnabled() && isSchedulerEnabled());
	const schedule = normalizeSchedule(type === 'once' ? { type, at } : { type, time, weekday, day });
	const next = schedule ? computeNextRun(schedule, new Date()) : null;
	const aiKind = kind === 'daily-brief' || kind === 'monthly-fortune' || kind === 'custom-prompt';
	async function submit(){
		if(gated){ message.warning('请先在「AI 助手行动能力」里打开总开关和「定时任务」'); return; }
		if(!next){ message.warning(type === 'once' ? '仅一次的时刻必须在未来' : '排期不合法(时间需 HH:mm)'); return; }
		if(kind === 'custom-prompt' && !prompt.trim()){ message.warning('自定义提示词不能为空'); return; }
		setBusy(true);
		try{
			const t = await createTask({
				kind: 'scheduled', status: 'scheduled', title: title.trim().slice(0, 80) || SCHEDULED_KIND_LABELS[kind], origin: 'in-app', nextRunAt: next, missedPolicy, notify,
				spec: { kind, schedule, modelSelection: snapshotModelSelection() || undefined, sourceCid: aiKind ? (sourceCid || null) : null, techniques: aiKind ? techniques.slice(0, 6) : [], prompt: kind === 'custom-prompt' ? prompt.trim().slice(0, 2000) : '', daysAhead: kind === 'zeri-reminder' ? daysAhead : undefined },
			});
			message.success(`定时任务「${t.title}」已排期:${describeSchedule(schedule)}`);
			if(typeof onCreated === 'function'){ onCreated(t); }
			setTitle(''); setPrompt('');
			onClose();
		}catch(e){ message.error(`建任务失败:${e && e.message ? e.message : e}`); }
		finally{ setBusy(false); }
	}
	return (
		<Modal title="新建定时任务" open={open} visible={open} onCancel={onClose} onOk={submit} okText="排期" confirmLoading={busy} destroyOnClose>
			<div data-scheduled-task-modal="1" style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
				{gated ? <div style={{ color: 'var(--horosa-warn, #d48806)' }}>定时任务需要先打开「AI 助手行动能力」总开关与「定时任务」子开关(进阶 → AI 助手行动能力)。</div> : null}
				<div style={{ display: 'flex', gap: 8 }}>
					<Select size="small" value={kind} onChange={setKind} style={{ flex: '0 0 160px' }} data-scheduled-kind="1" options={SCHEDULED_KINDS.map((k)=>({ value: k, label: SCHEDULED_KIND_LABELS[k] }))} />
					<Input size="small" maxLength={80} value={title} onChange={(e)=>setTitle(e.target.value)} placeholder={`标题(缺省:${SCHEDULED_KIND_LABELS[kind]})`} style={{ flex: '1 1 auto' }} />
				</div>
				<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
					<span>排期:</span>
					<Select size="small" value={type} onChange={setType} style={{ width: 90 }} data-schedule-type="1" options={SCHEDULE_TYPES.map((t)=>({ value: t, label: TYPE_LABELS[t] }))} />
					{type === 'weekly' ? <Select size="small" value={weekday} onChange={setWeekday} style={{ width: 90 }} options={WEEKDAY_LABELS.map((w, i)=>({ value: i, label: `周${w}` }))} /> : null}
					{type === 'monthly' ? <span>每月 <InputNumber size="small" min={1} max={28} value={day} onChange={(v)=>setDay(v || 1)} style={{ width: 64 }} /> 日</span> : null}
					{type === 'once'
						? <input type="datetime-local" className="horosa-native-date" value={at} onChange={(e)=>setAt(e.target.value)} data-schedule-at="1" style={{ fontSize: 12 }} />
						: <input type="time" className="horosa-native-date" value={time} onChange={(e)=>setTime(e.target.value)} data-schedule-time="1" style={{ fontSize: 12 }} />}
					<span style={soft} data-schedule-next={next || ''}>{next ? `下次:${new Date(next).toLocaleString()}` : (type === 'once' ? '时刻须在未来' : '时间格式 HH:mm')}</span>
				</div>
				{aiKind ? (
					<div style={{ display: 'flex', gap: 8 }}>
						<Select size="small" allowClear placeholder="挂载命盘/事盘(不挂=通用天象简报/月运)" value={sourceCid} onChange={setSourceCid} style={{ flex: '1 1 50%' }} showSearch optionFilterProp="label"
							options={sources.slice(0, 200).map((s)=>({ value: s.id, label: `${s.title}${s.sourceType === 'case' ? '(事盘)' : ''}` }))} />
						<Select size="small" mode="multiple" placeholder="技法(可选,≤6)" value={techniques} onChange={(v)=>setTechniques((v || []).slice(0, 6))} style={{ flex: '1 1 50%' }} options={techOptions} maxTagCount={3} />
					</div>
				) : null}
				{kind === 'custom-prompt' ? <Input.TextArea rows={3} maxLength={2000} value={prompt} onChange={(e)=>setPrompt(e.target.value)} placeholder="到点要问 AI 的话,例:结合我的命盘,今天开会谈合作要注意什么?" data-schedule-prompt="1" /> : null}
				{kind === 'zeri-reminder' ? <div>提前 <InputNumber size="small" min={1} max={30} value={daysAhead} onChange={(v)=>setDaysAhead(v || 1)} style={{ width: 64 }} /> 天提醒已存的择日方案(按方案窗口起始日;不用 AI)</div> : null}
				<div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
					<span>错过时:<Select size="small" value={missedPolicy} onChange={setMissedPolicy} style={{ width: 150 }} data-missed-policy="1" options={[{ value: 'skip', label: '跳过' }, { value: 'catch-up', label: '下次打开补跑一次' }]} /></span>
					<span>完成后通知 <Switch size="small" checked={notify} onChange={setNotify} /></span>
				</div>
				<div style={soft}>软件开着时每分钟检查一次到期任务;没开就错过了,下次打开按上面的策略处理。到点任务用创建时的接口配置与模型,一次只跑一个。</div>
			</div>
		</Modal>
	);
}
