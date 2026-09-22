// 设置卡「技能包」(A3):列出带技能字段的组合(触发词/前提/技法/版本),新建/编辑技能字段、导出 .horosa-skill.json、导入(同名高版本才覆盖,旧版留档)。
// 技能包 = 组合记录 + skill 字段(零新 store);写库经 aiAnalysisStore.putStoreRecord;导入覆盖前调用方 ensureTemplateVersion 留档(此处按组合快照留一份 skillHistory)。
import React from 'react';
import { saveBlobSmart } from '../../../utils/aiAnalysisExport';
import { Button, Input, Select, Modal, Tag, message, Upload } from 'antd';
import { AI_ANALYSIS_STORES, putStoreRecord } from '../../../utils/aiAnalysisStore';
import { normalizeSkillPack, skillsOf, exportSkillPack, planSkillImport, bundleFromSkillPack, SKILL_REQUIRES, SKILL_FILE_EXT, BUILTIN_SKILLS } from '../../../utils/aiChat/skills';
import { triggerConflicts } from '../../../utils/aiChat/commands';
import { listAnalysisTechniqueOptions } from '../../../utils/aiAnalysisContext';
import { AdvCard, AdvStatus, ADV_SECTION_IDS, advStyles as styles } from './AdvCard';

const REQ_LABELS = { chart: '一张命盘', timepoint: '一个时间点', 'two-charts': '两张命盘', any: '任意案例' };

// [Q-410] 单源保存(桌面壳保存桥);失败如实提示,取消不报。
function downloadJson(name, obj){
	try{
		const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
		return saveBlobSmart(name, blob).then((r)=>{ if(r && !r.ok && !r.cancelled){ message.error(`导出失败：${r.error || ''}`); } return r; });
	}catch(e){ message.error('导出失败'); return null; }
}

function SkillEditor({ open, bundle, bundles, onClose, onSaved }){
	const base = React.useMemo(()=>normalizeSkillPack(bundle) || { version: 1, triggers: [], requires: 'chart', techniqueKeys: [], promptTemplate: '', argsSpec: [], outputFormat: '', schoolNote: '', description: '' }, [bundle]);
	const [name, setName] = React.useState(bundle ? bundle.name : '');
	const [triggers, setTriggers] = React.useState(base.triggers.join(' '));
	const [requires, setRequires] = React.useState(base.requires);
	const [techniqueKeys, setTechniqueKeys] = React.useState(base.techniqueKeys);
	const [promptTemplate, setPromptTemplate] = React.useState(base.promptTemplate);
	const [argsSpecText, setArgsSpecText] = React.useState(base.argsSpec.map((a)=>`${a.name}${a.label && a.label !== a.name ? `:${a.label}` : ''}${a.default ? `=${a.default}` : ''}`).join(' '));
	const [outputFormat, setOutputFormat] = React.useState(base.outputFormat);
	const [schoolNote, setSchoolNote] = React.useState(base.schoolNote);
	const [description, setDescription] = React.useState(base.description);
	React.useEffect(()=>{ if(open){ setName(bundle ? bundle.name : ''); setTriggers(base.triggers.join(' ')); setRequires(base.requires); setTechniqueKeys(base.techniqueKeys); setPromptTemplate(base.promptTemplate); setArgsSpecText(base.argsSpec.map((a)=>`${a.name}${a.label && a.label !== a.name ? `:${a.label}` : ''}${a.default ? `=${a.default}` : ''}`).join(' ')); setOutputFormat(base.outputFormat); setSchoolNote(base.schoolNote); setDescription(base.description); } }, [open, bundle, base]);
	// [Q-401 裁决 2026-09-18] 技法候选随「前提」过滤:命盘 / 两张命盘 → 命盘类技法;时间点 → 起课类技法;任意 → 两类并集(去重)。此前恒只列命盘类。
	const techOptions = React.useMemo(()=>{
		const pick = (st)=>{ try{ return (listAnalysisTechniqueOptions({ sourceType: st }) || []).map((o)=>({ value: o.value, label: o.label || o.value })); }catch(e){ return []; } };
		if(requires === 'timepoint'){ return pick('timepoint'); }
		if(requires === 'any'){ const seen = new Set(); return pick('chart').concat(pick('timepoint')).filter((o)=>{ if(seen.has(o.value)){ return false; } seen.add(o.value); return true; }); }
		return pick('chart');
	}, [requires]);
	async function save(){
		const trig = triggers.split(/[\s,，]+/).map((t)=>t.replace(/^\//, '').trim()).filter(Boolean);
		if(!name.trim()){ message.warning('技能包需要名字'); return; }
		if(!trig.length){ message.warning('至少一个触发词,例:事业'); return; }
		const conflicts = triggerConflicts(trig);
		if(conflicts.length){ message.warning(`触发词与内置命令冲突:${conflicts.join('、')}`); return; }
		const dup = (bundles || []).find((b)=>b && b.id !== (bundle && bundle.id) && b.skill && (b.skill.triggers || []).some((t)=>trig.indexOf(`${t}`.replace(/^\//, '')) >= 0));
		if(dup){ message.warning(`触发词已被技能「${dup.name}」使用`); return; }
		if(!promptTemplate.trim()){ message.warning('提示词模板不能为空(可用 {{参数名}}、{{source}})'); return; }
		const argsSpec = argsSpecText.split(/\s+/).filter(Boolean).map((tok)=>{ const m = /^([^:=]+)(?::([^=]+))?(?:=(.*))?$/.exec(tok); return m ? { name: m[1], label: m[2] || m[1], default: m[3] || '' } : null; }).filter(Boolean);
		const prevSkill = normalizeSkillPack(bundle);
		const skill = normalizeSkillPack({ skill: { version: prevSkill ? prevSkill.version + 1 : 1, triggers: trig, requires, techniqueKeys, promptTemplate, argsSpec, outputFormat, schoolNote, description } });
		const rec = { ...(bundle || {}), name: name.trim(), skill, defaultTechniqueKeys: techniqueKeys, skillHistory: (bundle && Array.isArray(bundle.skillHistory) ? bundle.skillHistory : []).concat(prevSkill ? [{ at: new Date().toISOString(), skill: prevSkill }] : []).slice(-5) };
		try{ await putStoreRecord(AI_ANALYSIS_STORES.bundles, rec, 'bundle'); message.success(`技能「${rec.name}」已保存(v${skill.version})`); if(typeof onSaved === 'function'){ onSaved(); } onClose(); }
		catch(e){ message.error(`保存失败:${e && e.message ? e.message : e}`); }
	}
	return (
		<Modal title={bundle ? `编辑技能:${bundle.name}` : '新建技能包'} open={open} visible={open} onCancel={onClose} onOk={save} okText="保存" destroyOnClose width={640} okButtonProps={{ 'data-skill-save': '1' }}>
			<div data-skill-editor="1" style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
				<Input size="small" placeholder="名字(如:事业)" value={name} onChange={(e)=>setName(e.target.value)} data-skill-name="1" />
				<div style={{ display: 'flex', gap: 8 }}>
					<Input size="small" placeholder="触发词(空格分隔;打 /事业 即用)" value={triggers} onChange={(e)=>setTriggers(e.target.value)} data-skill-triggers="1" style={{ flex: '1 1 50%' }} />
					<Select size="small" value={requires} onChange={setRequires} style={{ flex: '0 0 150px' }} data-skill-requires="1" options={SKILL_REQUIRES.map((r)=>({ value: r, label: `需要:${REQ_LABELS[r]}` }))} />
				</div>
				<Select size="small" mode="multiple" placeholder="技法(用技能时只改本次对话的挂载技法)" data-skill-techniques="1" value={techniqueKeys} onChange={(v)=>setTechniqueKeys((v || []).slice(0, 12))} options={techOptions} maxTagCount={4} />
				<Input.TextArea rows={4} placeholder="提示词模板:可用 {{year}} 这类参数、{{source}} 命盘名;例:分析{{source}}在 {{year}} 年的事业…" value={promptTemplate} onChange={(e)=>setPromptTemplate(e.target.value)} data-skill-template="1" />
				<Input size="small" placeholder="参数(空格分隔):year:年份=今年 target:目标" data-skill-args="1" value={argsSpecText} onChange={(e)=>setArgsSpecText(e.target.value)} />
				<Input size="small" placeholder="输出格式(可选,只随触发技能的那一条消息发送)" data-skill-output="1" value={outputFormat} onChange={(e)=>setOutputFormat(e.target.value)} />
				<Input size="small" placeholder="口径备注(可选,只随触发的那一条发送;流派/术语约定)" data-skill-note="1" value={schoolNote} onChange={(e)=>setSchoolNote(e.target.value)} />
				<Input size="small" placeholder="一句话说明(菜单里显示)" data-skill-description="1" value={description} onChange={(e)=>setDescription(e.target.value)} />
				<div className={styles.soft}>保存即版本 +1(旧版留档 5 份);用技能只改本次对话的挂载技法与会话系统提示(口径备注 / 输出格式只随触发的那一条发送);会记住你上次用的技法作为界面偏好,不改其它全局设置。   {/* [Q-294/AR-20] 文案如实 */}</div>
			</div>
		</Modal>
	);
}

export default function SkillPackPanel({ bundles, materials, reloadBundles }){
	const [editing, setEditing] = React.useState(null);
	const [editorOpen, setEditorOpen] = React.useState(false);
	const skills = React.useMemo(()=>skillsOf(bundles), [bundles]);
	const materialsById = React.useMemo(()=>{ const m = {}; (materials || []).forEach((x)=>{ if(x && x.id){ m[x.id] = x; } }); return m; }, [materials]);
	async function onImportText(text){
		const plan = planSkillImport(text, bundles);
		if(!plan.ok){ message.error(`导入失败:${plan.reason}`); return; }
		if(plan.conflicts && plan.conflicts.length){ message.error(`导入被拒:触发词「${plan.conflicts.join('、')}」与内置命令冲突,请改名后再导入`); return; }
		if(plan.action === 'skip'){ message.info(plan.reason); return; }
		const base = plan.action === 'replace' ? { ...plan.existing, skillHistory: (plan.existing.skillHistory || []).concat([{ at: new Date().toISOString(), skill: normalizeSkillPack(plan.existing) }]).slice(-5) } : {};
		const rec = bundleFromSkillPack(plan.pack, base);
		try{ await putStoreRecord(AI_ANALYSIS_STORES.bundles, rec, 'bundle'); message.success(plan.action === 'replace' ? `已覆盖技能「${rec.name}」(旧版已留档)` : `已导入技能「${rec.name}」`); if(typeof reloadBundles === 'function'){ reloadBundles(); } }
		catch(e){ message.error(`导入失败:${e && e.message ? e.message : e}`); }
	}
	const builtin = BUILTIN_SKILLS.map((b)=>`/${b.trigger || b.name || b}`).join(' ');
	return (
		<AdvCard id={ADV_SECTION_IDS.skills} icon="tools" title="技能包" status={skills.length ? <AdvStatus on>{skills.length} 个自定义</AdvStatus> : <AdvStatus>内置 {BUILTIN_SKILLS.length}</AdvStatus>}
			desc={`把「技法 + 口径 + 输出格式 + 提示词模板 + 参数」打成一个包:输入框打 / 触发词一键使用;可导出分享、导入(同名高版本才覆盖)。内置:${builtin}`}
			actions={(
				<>
					<Upload accept=".json" showUploadList={false} beforeUpload={(file)=>{ const r = new FileReader(); r.onload = ()=>onImportText(`${r.result || ''}`); r.readAsText(file); return false; }}>
						<Button size="small" data-skill-import="1">导入</Button>
					</Upload>
					<Button size="small" type="primary" data-skill-new="1" onClick={()=>{ setEditing(null); setEditorOpen(true); }}>新建技能</Button>
				</>
			)}
			data-skill-pack-panel="1">
			{skills.length ? skills.map((b)=>(
				<div key={b.id} data-skill-row={b.id} className={styles.listRow}>
					<div className={styles.listMain}>
						<span style={{ fontWeight: 600 }}>{b.name}</span>
						<span className={styles.mono}>{b.skill.triggers.map((t)=>`/${t}`).join(' ')}</span>
						<Tag style={{ margin: 0 }}>需要:{REQ_LABELS[b.skill.requires] || b.skill.requires}</Tag>
						{(()=>{ const conf = triggerConflicts(b.skill.triggers); return conf.length ? <Tag color="warning" style={{ margin: 0 }} title="内置命令后来占用了同名触发词;菜单里内置优先,这个触发词已让位——改个触发词即可">触发词 {conf.map((x)=>`/${x}`).join(' ')} 与内置冲突</Tag> : null; })()}
						<span className={styles.soft}>{b.skill.techniqueKeys.length ? `技法 ${b.skill.techniqueKeys.length}` : '技法跟随当前'} · v{b.skill.version}</span>
					</div>
					<Button size="small" data-skill-edit={b.id} onClick={()=>{ setEditing(b); setEditorOpen(true); }}>编辑</Button>
					<Button size="small" data-skill-export={b.id} onClick={()=>{ const pack = exportSkillPack(b, materialsById); if(pack){ downloadJson(`${b.name}${SKILL_FILE_EXT}`, pack); } }}>导出</Button>
				</div>
			)) : <div className={styles.infoStrip}>还没有自定义技能。点「新建技能」,或从别人分享的 {SKILL_FILE_EXT} 文件导入。</div>}
			<SkillEditor open={editorOpen} bundle={editing} bundles={bundles} onClose={()=>setEditorOpen(false)} onSaved={()=>{ if(typeof reloadBundles === 'function'){ reloadBundles(); } }} />
		</AdvCard>
	);
}
