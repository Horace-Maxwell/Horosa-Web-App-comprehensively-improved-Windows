// 设置卡「个人口径」+「记忆」(A6):口径文本框(≤4000,分节模板)+ 启用注入 / 记忆注入 / 自动沉淀候选 三开关(缺省全关)+ /init 生成草稿;
// 记忆:候选区(确认/改文/丢弃)与已入库(按主体分组,停用/删除)+「从本会话提炼」(点一次调一次模型)。打开设置页不写键;只在用户改动时写。
import React from 'react';
import { Input, Switch, Button, message, Select, Tabs, Modal, Tag } from 'antd';
import { readPersona, writePersona, clearPersona, subscribePersona, PERSONA_TEMPLATE, PERSONA_TEXT_MAX } from '../../../utils/aiChat/persona';
import { readPersonaLayers, writePersonaLayer, clearPersonaLayers, subscribePersonaLayers, composePersonaText, PERSONA_LAYER_TEXT_MAX, PERSONA_SESSION_TEXT_MAX } from '../../../utils/aiChat/personaLayers';
import { listAnalysisTechniqueOptions } from '../../../utils/aiAnalysisContext';
import { listMemories, subscribeMemory, confirmMemory, discardCandidate, toggleMemory, deleteMemory, saveMemory, MEMORY_SUBJECT_TYPES } from '../../../utils/aiChat/memory';
import { AdvCard, AdvStatus, ADV_SECTION_IDS, advStyles as styles } from './AdvCard';

const SUBJECT_LABELS = { user: '你本人', chart: '命主', case: '事盘', global: '全局' };

// [Q-294/M-109·AR-08] 候选主体改成「命主」时绑定当前挂载源 id 与标题(注入只收 subject.cid===当前挂载源 id 的命主记忆,
//   此前改成命主后 cid 为空 → 永不注入却显示已入库);无挂载源时「命主」不可选并提示。
function CandidateRow({ m, onChanged, activeSource }){
	const [text, setText] = React.useState(m.text);
	const [type, setType] = React.useState(m.subject.type);
	const srcId = activeSource && activeSource.id ? `${activeSource.id}` : '';
	const subjectFor = (t)=>{
		if(t === 'chart'){ return m.subject.type === 'chart' && m.subject.cid ? { ...m.subject, type: t } : { ...m.subject, type: t, cid: srcId, title: activeSource && activeSource.title ? `${activeSource.title}` : (m.subject.title || '') }; }
		return { ...m.subject, type: t };
	};
	const chartDisabled = type !== 'chart' && !srcId && !(m.subject.type === 'chart' && m.subject.cid);
	return (
		<div data-memory-candidate={m.id} className={styles.listRow}>
			<Select size="small" value={type} onChange={setType} style={{ width: 88 }} data-memory-candidate-type="1" options={MEMORY_SUBJECT_TYPES.filter((t)=>t !== 'case' || m.subject.type === 'case').map((t)=>({ value: t, label: SUBJECT_LABELS[t], disabled: t === 'chart' && chartDisabled, title: t === 'chart' && chartDisabled ? '先在对话页挂载一个命主,才能把记忆绑定到命主' : undefined }))} />
			<Input size="small" value={text} maxLength={200} onChange={(e)=>setText(e.target.value)} style={{ flex: '1 1 auto' }} data-memory-candidate-text="1" />
			<Button size="small" type="primary" data-memory-confirm="1" onClick={async ()=>{ await confirmMemory(m.id, { text, subject: subjectFor(type) }); message.success('已入库'); onChanged(); }}>确认</Button>
			<Button size="small" data-memory-discard="1" onClick={async ()=>{ await discardCandidate(m.id); onChanged(); }}>丢弃</Button>
		</div>
	);
}

// [批二⑨] 分层口径页签:命主(bySubject[当前命主 cid])/ 技法(byTechnique[选中技法])/ 会话(随会话记录存);打开不写键,只在「保存」时写
function LayerEditor({ scope, id, title, hint, layers, max, testId }){
	const cur = id ? (scope === 'subject' ? layers.bySubject[id] : layers.byTechnique[id]) || '' : '';
	const [text, setText] = React.useState(cur);
	React.useEffect(()=>{ setText(cur); }, [cur, id]);
	if(!id){ return <div className={styles.soft} data-persona-layer-empty={scope}>{hint}</div>; }
	return (
		<div data-persona-layer={scope} data-persona-layer-id={id} className={styles.stack}>
			<div className={styles.soft}>{title}</div>
			<Input.TextArea rows={4} maxLength={max} value={text} onChange={(e)=>setText(e.target.value)} placeholder="只对这一层生效的补充口径(空=不注入这一层)" data-persona-layer-text={scope} />
			<div className={styles.inline}>
				<Button size="small" type="primary" disabled={text === cur} data-persona-layer-save={scope} onClick={()=>{ writePersonaLayer(scope, id, text); message.success('已保存'); }}>保存</Button>
				{cur ? <Button size="small" danger data-persona-layer-clear={scope} onClick={()=>{ writePersonaLayer(scope, id, ''); message.success('已清除这一层'); }}>清除</Button> : null}
				<span className={styles.soft}>{text.length}/{max}</span>
			</div>
		</div>
	);
}
function SessionEditor({ conversation, onSave }){
	const cur = conversation && conversation.persona ? `${conversation.persona}` : '';
	const [text, setText] = React.useState(cur);
	React.useEffect(()=>{ setText(cur); }, [cur, conversation && conversation.id]);
	if(!conversation){ return <div className={styles.soft} data-persona-layer-empty="session">先打开一个对话,再给它写只对本会话生效的口径。</div>; }
	return (
		<div data-persona-layer="session" data-persona-layer-id={conversation.id} className={styles.stack}>
			<div className={styles.soft}>当前对话:{conversation.title || '(未命名)'}</div>
			<Input.TextArea rows={4} maxLength={PERSONA_SESSION_TEXT_MAX} value={text} onChange={(e)=>setText(e.target.value)} placeholder="例:这次只看 2027 年;用白话,不引古文" data-persona-layer-text="session" />
			<div className={styles.inline}>
				<Button size="small" type="primary" disabled={text === cur} data-persona-layer-save="session" onClick={()=>{ if(typeof onSave === 'function'){ onSave(text); } }}>保存</Button>
				<span className={styles.soft}>{text.length}/{PERSONA_SESSION_TEXT_MAX}</span>
			</div>
		</div>
	);
}

export default function PersonaMemoryPanel({ onInit, initDraft, onExtract, extracting, activeSource, activeConversation, selectedTechniqueKeys, onSaveSessionPersona }){
	const [persona, setPersona] = React.useState(()=>readPersona());
	const [text, setText] = React.useState(()=>readPersona().text);
	React.useEffect(()=>subscribePersona((p)=>{ setPersona(p); setText(p.text); }), []);
	const [layers, setLayers] = React.useState(()=>readPersonaLayers());
	React.useEffect(()=>subscribePersonaLayers(setLayers), []);
	const techniqueOptions = React.useMemo(()=>{ try{ return listAnalysisTechniqueOptions(activeSource || { sourceType: 'chart' }) || []; }catch(e){ return []; } }, [activeSource && activeSource.id, activeSource && activeSource.sourceType]);
	const techniqueChoices = React.useMemo(()=>{
		const seen = new Set(); const out = [];
		(techniqueOptions || []).forEach((o)=>{ if(o && o.value && !seen.has(o.value)){ seen.add(o.value); out.push({ value: o.value, label: o.label || o.value }); } });
		Object.keys(layers.byTechnique).forEach((k)=>{ if(!seen.has(k)){ seen.add(k); out.push({ value: k, label: k }); } });
		return out;
	}, [techniqueOptions, layers]);
	const [techKey, setTechKey] = React.useState('');
	const techId = techKey || (Array.isArray(selectedTechniqueKeys) && selectedTechniqueKeys[0]) || (techniqueChoices[0] ? techniqueChoices[0].value : '');
	const techLabel = (techniqueChoices.find((o)=>o.value === techId) || {}).label || techId;
	const layerCount = Object.keys(layers.bySubject).length + Object.keys(layers.byTechnique).length + (activeConversation && activeConversation.persona ? 1 : 0);
	const [memories, setMemories] = React.useState([]);
	const [manual, setManual] = React.useState('');
	const reload = React.useCallback(()=>{ listMemories().then(setMemories).catch(()=>setMemories([])); }, []);
	React.useEffect(()=>{ reload(); return subscribeMemory(reload); }, [reload]);
	const candidates = memories.filter((m)=>m.status === 'candidate');
	const confirmed = memories.filter((m)=>m.status === 'confirmed');
	const groups = ['user', 'chart', 'case', 'global'].map((t)=>({ type: t, items: confirmed.filter((m)=>m.subject.type === t) })).filter((g)=>g.items.length);
	const dirty = text !== persona.text;
	// [Q-294/M-109·AR-19] 状态按「当前挂载源下四层合成是否非空」判(与 useChatAssist.promptLayerExtras 同一合成函数);此前只看全局文本,
	//   全局空、命主/技法/会话层有字时照样注入却显示「未注入」
	const composed = persona.enabled ? composePersonaText(persona.text, layers, { subjectCid: activeSource ? activeSource.id : '', subjectTitle: activeSource ? activeSource.title : '', techniqueKeys: Array.isArray(selectedTechniqueKeys) ? selectedTechniqueKeys : [], sessionText: activeConversation ? activeConversation.persona : '' }) : '';
	const injecting = !!composed.trim();
	// 分层页签依赖「全局」页签的「启用注入」总开关:关着时写了也不注入 → 三个分层页签各挂一条提示
	const layersGate = persona.enabled ? null : (
		<div className={styles.infoStrip} data-persona-layers-gated="1">分层口径同样受「全局」页签的「启用注入」总开关约束;当前总开关关闭,这里保存的内容不会注入,打开后才生效。</div>
	);
	async function addManual(){
		if(!manual.trim()){ return; }
		await saveMemory({ text: manual.trim(), subject: { type: 'user' }, status: 'confirmed', source: 'manual' });
		setManual('');
	}
	return (
		<AdvCard id={ADV_SECTION_IDS.persona} icon="user" title="个人口径与记忆" status={injecting ? <AdvStatus on>注入中</AdvStatus> : <AdvStatus>未注入</AdvStatus>}
			desc="你的流派偏好 / 术语 / 禁忌 / 输出格式;启用后每次对话放在系统提示最前(守则之后),连续多轮字节一致不断缓存。记忆只在本机,随 AI 工作区备份;与排盘数据冲突时以排盘为准。"
			actions={(
				<>
					<Button size="small" data-persona-template="1" onClick={()=>{ if(!text.trim()){ setText(PERSONA_TEMPLATE); } }} disabled={!!text.trim()}>套模板</Button>
					<Button size="small" data-persona-init="1" loading={!!(initDraft && initDraft.busy)} onClick={()=>{ if(typeof onInit === 'function'){ onInit(); } }}>/init 生成草稿</Button>
					{/* 清空全部口径:全局 + 命主/技法/会话分层一并清(此前 clearPersona/clearPersonaLayers 两件 API 无按钮;逐层「清除」只清一层)。取消不写键。 */}
					<Button size="small" danger data-persona-clear-all="1" onClick={()=>{
						Modal.confirm({
							title: '清空全部口径?',
							// [Q-294/M-109·AR-18] 如实描述:会话口径存在各对话记录里,这里不清;三开关与记忆保留
							content: '将删除全局口径文本与命主 / 技法分层口径,并关闭「启用注入」;记忆与「记忆注入 / 自动沉淀 / 同时用于报告」开关不受影响。会话口径保存在各对话里,请到「会话」页签逐个清除。此操作不可撤销。',
							okText: '清空', okType: 'danger', cancelText: '取消',
							onOk: ()=>{ clearPersona(); clearPersonaLayers(); setText(''); message.success('已清空全部口径'); },
						});
					}}>清空全部口径</Button>
				</>
			)}
			data-persona-memory-panel="1">
			<Tabs size="small" data-persona-tabs="1" tabBarExtraContent={<span className={styles.soft}>{layerCount ? `分层口径 ${layerCount} 条` : '全局→命主→技法→会话 逐层叠加'}</span>}>
				<Tabs.TabPane tab="全局" key="global">
			<div className={styles.textarea}>
				<Input.TextArea rows={6} maxLength={PERSONA_TEXT_MAX} value={text} onChange={(e)=>setText(e.target.value)} placeholder={PERSONA_TEMPLATE} data-persona-text="1" />
			</div>
			{initDraft && initDraft.text ? (
				<div data-persona-draft="1" className={styles.infoStrip}>
					<div className={styles.subhead}><b>草稿(按最近 {initDraft.conversations || 0} 个对话生成)</b><Button size="small" type="primary" data-persona-draft-apply="1" onClick={()=>{ setText(initDraft.text); if(typeof initDraft.onDismiss === 'function'){ initDraft.onDismiss(); } }}>填入文本框</Button></div>
					<div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{initDraft.text}</div>
				</div>
			) : null}
			<div className={styles.chips}>
				<span className={styles.chip}>启用注入 <Switch size="small" checked={persona.enabled} data-persona-enabled="1" onChange={(v)=>writePersona({ enabled: !!v })} /></span>
				<span className={styles.chip}>记忆注入 <Switch size="small" checked={persona.memoryInject} data-persona-memory-inject="1" onChange={(v)=>writePersona({ memoryInject: !!v })} /></span>
				<span className={styles.chip}>自动沉淀候选(不用 AI) <Switch size="small" checked={persona.memoryCapture} data-persona-memory-capture="1" onChange={(v)=>writePersona({ memoryCapture: !!v })} /></span>
				<span className={styles.spacer} />
				<Button size="small" type="primary" disabled={!dirty} data-persona-save="1" onClick={()=>{ writePersona({ text }); message.success('口径已保存'); }}>保存口径</Button>
			</div>
				</Tabs.TabPane>
				<Tabs.TabPane tab="命主" key="subject">
					{layersGate}
					<LayerEditor scope="subject" id={activeSource ? activeSource.id : ''} title={activeSource ? `当前命主/案例:${activeSource.title || ''}` : ''} hint="先在对话页挂载一个命主/案例,再给它写只对这个人生效的口径(如:此人是我父亲,称呼用「令尊」)。" layers={layers} max={PERSONA_LAYER_TEXT_MAX} />
					{Object.keys(layers.bySubject).length ? <div className={styles.soft}>已有命主口径 {Object.keys(layers.bySubject).length} 条(按命主档案 id 存,删档不自动清)</div> : null}
				</Tabs.TabPane>
				<Tabs.TabPane tab="技法" key="technique">
					{layersGate}
					<div className={styles.inline}>
						<span className={styles.soft}>技法</span>
						<Select size="small" style={{ minWidth: 160 }} value={techId || undefined} options={techniqueChoices} onChange={setTechKey} data-persona-technique-select="1" showSearch optionFilterProp="label" />
					</div>
					<LayerEditor scope="technique" id={techId} title={techId ? `${techLabel}:只在这一技法参与本轮时注入` : ''} hint="没有可选技法。" layers={layers} max={PERSONA_LAYER_TEXT_MAX} />
				</Tabs.TabPane>
				<Tabs.TabPane tab="会话" key="session">
					{layersGate}
					<SessionEditor conversation={activeConversation} onSave={onSaveSessionPersona} />
				</Tabs.TabPane>
			</Tabs>
			<div className={styles.divider} />
			<div className={styles.subhead}>
				<div className={styles.subtitle}>记忆 <span className={styles.soft}>候选 {candidates.length} · 已入库 {confirmed.length}</span></div>
				<Button size="small" data-memory-extract="1" loading={!!extracting} onClick={()=>{ if(typeof onExtract === 'function'){ onExtract(); } }}>从本会话提炼</Button>
			</div>
			{candidates.length ? <div className={styles.stack}>{candidates.map((m)=>(<CandidateRow key={m.id} m={m} onChanged={reload} activeSource={activeSource} />))}</div> : null}
			<div className={styles.inline}>
				<Input size="small" placeholder="手工加一条记忆(如:我妻子叫李四,1990 年生)" value={manual} maxLength={200} onChange={(e)=>setManual(e.target.value)} data-memory-manual="1" style={{ flex: '1 1 auto', minWidth: 160 }} onPressEnter={addManual} />
				<Button size="small" data-memory-add="1" onClick={addManual}>加入</Button>
			</div>
			{groups.map((g)=>(
				<div key={g.type} className={styles.memoryList}>
					<div className={styles.groupLabel}>{SUBJECT_LABELS[g.type]}</div>
					{g.items.map((m)=>(
						<div key={m.id} data-memory-item={m.id} className={[styles.memoryItem, m.enabled ? '' : styles.memoryItemOff].filter(Boolean).join(' ')}>
							<Switch size="small" checked={m.enabled} data-memory-toggle={m.id} onChange={(v)=>toggleMemory(m.id, !!v)} />
							<span className={styles.spacer}>{m.subject.title ? `[${m.subject.title}] ` : ''}{(m.subject.type === 'chart' || m.subject.type === 'case') && !m.subject.cid ? <Tag color="orange" style={{ marginRight: 4 }}>未绑定命主,不会注入</Tag> : null}{m.text}</span>
							<Button size="small" type="link" danger data-memory-delete={m.id} onClick={()=>deleteMemory(m.id)}>删除</Button>
						</div>
					))}
				</div>
			))}
		</AdvCard>
	);
}
