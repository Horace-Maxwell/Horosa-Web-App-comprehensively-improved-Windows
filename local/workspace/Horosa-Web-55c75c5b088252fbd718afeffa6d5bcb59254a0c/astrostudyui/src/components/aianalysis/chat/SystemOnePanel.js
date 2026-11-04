// 设置卡「决策层(实验)」:TypeSafe System One 的总开关(首开有知情提示)+ 档案(基址 / 模型别名 / 密钥;密钥加密存集成档案、不回显)
// + 测试连接 + 一键校准(随包金标集打用户自己的 key,成绩按真实模型号钉住)+ 每个接入点的分开关(关 / 用 / 影子)+ 阈值 + 用量与决策日志。
// 纪律:打开本卡不写任何键(只订阅、只读);总开关关着时连 IndexedDB 都不读(关路径零 IO);每个接入点「用」还要过校准与档案两道,卡上如实标状态。
import React from 'react';
import { Button, Input, InputNumber, Modal, Radio, Select, Switch, Tag, Tooltip, message } from 'antd';
import { AdvCard, AdvStatus, AdvSwitchRow, ADV_SECTION_IDS, advStyles as styles } from './AdvCard';
import { isSystemOneEnabled, setSystemOneEnabled, subscribeSystemOnePrefs, getPointMode, setPointMode, readThresholds, setThresholds, isDisclosureAcknowledged, acknowledgeDisclosure, pointOn, pointShadow, isSystemOneProfilePresent } from '../../../utils/systemOne/prefs';
import { listPoints, POINT_GROUPS, KIND_LABELS } from '../../../utils/systemOne/registry';
import { getSystemOneProfile, saveSystemOneProfile, removeSystemOneProfile, SYSTEMONE_DEFAULT_BASE_URL } from '../../../integrations/systemOne';
import { SYSTEMONE_MODEL_ALIASES, SYSTEMONE_DEFAULT_MODEL, SYSTEMONE_PRICE_USD_PER_MTOK_INPUT } from '../../../utils/systemOne/wire';
import { smokeTestSystemOne } from '../../../utils/systemOne/client';
import { runCalibration, CALIBRATION_MIN_ITEMS } from '../../../utils/systemOne/calibration';
import { readCalibration, subscribeCalibration, clearCalibration } from '../../../utils/systemOne/calibrationStore';
import { readStats, resetStats, listDecisions, clearDecisions, agreementByPoint, subscribeSystemOneLog } from '../../../utils/systemOne/log';
import { DEFAULT_TIER_THRESHOLDS } from '../../../utils/systemOne/gate';

export const SYSTEMONE_LOG_ROWS = 20;
// 接入点表头(短标签,窄栏下不折成竖排)
const TABLE_HEADS = ['接入点', '分组', '类型', '分开关', '状态', '校准', '一致率'];
const GROUP_LABEL = {};
POINT_GROUPS.forEach((g)=>{ GROUP_LABEL[g.key] = g.label; });

// 接入点分开关的锚
function modeAnchor(point){
	return { 'data-systemone-point-mode': point.id };
}

export function effectiveThresholds(point){
	return { ...DEFAULT_TIER_THRESHOLDS, ...((point && point.defaultThresholds) || {}), ...readThresholds(point ? point.id : '') };
}

// 纯函数:一行接入点在卡上显示的状态(与 pointOn / pointShadow 同口径,只是把「为什么没生效」说出来)
export function pointStateText(point, { enabled, profile, calibration }){
	const mode = getPointMode(point.id);
	if(mode === 'off'){ return '关'; }
	if(!enabled){ return '总开关关'; }
	if(!profile){ return '缺档案'; }
	if(mode === 'shadow'){ return '影子中'; }
	const rec = calibration && calibration.points ? calibration.points[point.id] : null;
	if(calibration && calibration.drift){ return '模型号漂移,需重校准'; }
	if(!rec){ return '待校准'; }
	return rec.passed ? '生效' : `校准未过:${rec.reason || ''}`;
}

export default function SystemOnePanel(){
	const [on, setOn] = React.useState(()=>isSystemOneEnabled());
	const [tick, setTick] = React.useState(0);
	const bump = React.useCallback(()=>setTick((t)=>t + 1), []);
	React.useEffect(()=>subscribeSystemOnePrefs(()=>{ setOn(isSystemOneEnabled()); bump(); }), [bump]);
	React.useEffect(()=>subscribeCalibration(bump), [bump]);
	React.useEffect(()=>subscribeSystemOneLog(bump), [bump]);
	const [profile, setProfile] = React.useState(null);
	const [form, setForm] = React.useState({ baseUrl: '', model: SYSTEMONE_DEFAULT_MODEL, apiKey: '' });
	const [busy, setBusy] = React.useState('');
	const [probe, setProbe] = React.useState(null);
	const [progress, setProgress] = React.useState(null);
	const [thPoint, setThPoint] = React.useState('');
	// 先发后回只认最新一次:档案读 / 写 / 删共用一个代次(读档在途时删了或存了,旧回包不再盖回去);
	// 保存 / 测试 / 校准共用一个(同一时刻只许一个在跑,其余按钮置灰);开关的知情确认框单独一个
	const profileSeq = React.useRef(0);
	const opSeq = React.useRef(0);
	const toggleSeq = React.useRef(0);

	const reload = React.useCallback(async ()=>{
		const seq = ++profileSeq.current;
		const p = await getSystemOneProfile();
		if(seq !== profileSeq.current){ return; }
		setProfile(p);
		if(p){ setForm({ baseUrl: p.baseUrl || '', model: p.model || SYSTEMONE_DEFAULT_MODEL, apiKey: '' }); }
	}, []);
	// 关路径零 IO:总开关关着时不读 IndexedDB
	React.useEffect(()=>{ if(on){ reload().catch(()=>{}); } }, [on, reload]);

	async function toggle(v){
		const seq = ++toggleSeq.current;
		if(v && !on && !isDisclosureAcknowledged()){
			const ok = await new Promise((res)=>Modal.confirm({
				title: '打开「决策层」前请知悉',
				content: <div style={{ fontSize: 12, lineHeight: 1.7 }}>开启后,你逐个打开的接入点会把<b>最小必要字段</b>(如你已发出的提问原文、被检索到的资料片段、工具名与去掉出生资料的参数)发给 TypeSafe(第三方)做类型化判断;绝不发密钥、档案 id、文件路径、出生资料。密钥加密存在本机,只在发请求时随请求带上,后端不落库、不写日志。任何失败、超时或低置信度都回到现状路径;每个接入点各有分开关,且要先在你的模型号上通过校准才会生效。</div>,
				okText: '我知道了,打开', cancelText: '取消', onOk: ()=>res(true), onCancel: ()=>res(false),
			}));
			if(!ok || seq !== toggleSeq.current){ return; }
			acknowledgeDisclosure();
		}
		setSystemOneEnabled(!!v); setOn(!!v);
	}

	const formDirty = !profile || `${form.baseUrl || ''}`.trim() !== `${profile.baseUrl || ''}`.trim() || form.model !== (profile.model || SYSTEMONE_DEFAULT_MODEL) || !!`${form.apiKey || ''}`.trim();
	async function save(){
		const seq = ++opSeq.current;
		setBusy('save');
		try{
			const r = await saveSystemOneProfile({ apiKey: form.apiKey, baseUrl: form.baseUrl, model: form.model });
			if(seq !== opSeq.current){ return; }
			if(!r.ok){ message.warning(r.reason === 'need-key' ? '填入 TypeSafe 的 API 密钥' : '保存失败'); return; }
			message.success('已保存(密钥加密存本机)');
			setForm((f)=>({ ...f, apiKey: '' }));
			await reload();
		}finally{ if(seq === opSeq.current){ setBusy(''); } }
	}
	async function test(){
		const seq = ++opSeq.current;
		setBusy('test'); setProbe(null);
		try{
			const r = await smokeTestSystemOne();
			if(seq !== opSeq.current){ return; }
			setProbe(r);
			if(r.ok){ message.success(`连接成功:模型 ${r.model || '?'} · ${r.latencyMs} ms`); }
			else{ message.error(`连接失败:${r.reason}${r.status ? ` · HTTP ${r.status}` : ''}${r.code ? ` · ${r.code}` : ''}`); }
		}finally{ if(seq === opSeq.current){ setBusy(''); } }
	}
	async function calibrate(){
		const seq = ++opSeq.current;
		setBusy('calibrate'); setProgress({ done: 0, total: 0, pointId: '' });
		try{
			await runCalibration({ progress: (pointId, done, total)=>{ if(seq === opSeq.current){ setProgress({ pointId, done, total }); } } });
			message.success('校准完成');
		}catch(e){ message.error(`校准失败:${e && e.message ? e.message : e}`); }
		finally{ if(seq === opSeq.current){ setBusy(''); setProgress(null); } }
	}
	async function removeProfile(){
		const seq = ++profileSeq.current;
		await removeSystemOneProfile();
		message.success('已删除');
		if(seq !== profileSeq.current){ return; }
		setProfile(null); setProbe(null);
	}

	const points = listPoints();
	const calibration = readCalibration();
	const agg = agreementByPoint();
	const stats = readStats();
	const log = listDecisions().slice(0, SYSTEMONE_LOG_ROWS);
	const hasProfile = !!profile && isSystemOneProfilePresent();
	const thTarget = points.find((p)=>p.id === thPoint) || null;
	const th = thTarget ? effectiveThresholds(thTarget) : null;
	const thStored = thTarget ? readThresholds(thTarget.id) : {};
	const status = !on ? <AdvStatus>关</AdvStatus> : (hasProfile ? <AdvStatus on tone={calibration && !calibration.drift ? 'good' : 'warn'}>{calibration && !calibration.drift ? `开 · 已校准 ${calibration.model}` : '开 · 待校准'}</AdvStatus> : <AdvStatus on tone="warn">开 · 未配置</AdvStatus>);

	return (
		<AdvCard id={ADV_SECTION_IDS.systemone} icon="target" title="决策层(实验)" status={status} span2
			desc="把一部分「小判断」(该不该拦、像不像软件求助、该不该带帮助文档、资料片段相不相关…)交给专门做类型化判断的模型,回答本身仍由你的聊天模型生成。缺省关 = 与现状逐字节相同;每个接入点各有分开关,失败一律回落原路径。"
			data-systemone-panel="1" data-tick={tick}>
			<AdvSwitchRow title="启用决策层" desc={`开启后按接入点逐个生效(下表);只发最小字段,不发密钥与出生资料;按输入 token 计费(约 $${SYSTEMONE_PRICE_USD_PER_MTOK_INPUT} / 百万 token)。`} checked={on}
				control={<Switch checked={on} data-systemone-switch="1" onChange={toggle} checkedChildren="开" unCheckedChildren="关" />} />
			{on ? (
				<div className={styles.subBody}>
					<div className={styles.groupLabel}>档案</div>
					<div className={styles.inline}>
						<Select size="small" style={{ width: 160 }} value={form.model} data-systemone-model="1" onChange={(v)=>setForm({ ...form, model: v })} options={SYSTEMONE_MODEL_ALIASES.map((m)=>({ value: m, label: m }))} />
						{profile ? <Tag color="green" style={{ marginInlineEnd: 0 }} data-systemone-status="configured">已配置 · {profile.model}</Tag> : <Tag style={{ marginInlineEnd: 0 }} data-systemone-status="none">未配置</Tag>}
					</div>
					<Input size="small" addonBefore="服务地址" data-systemone-baseurl="1" value={form.baseUrl} onChange={(e)=>setForm({ ...form, baseUrl: e.target.value })} placeholder={`留空 = ${SYSTEMONE_DEFAULT_BASE_URL}`} />
					<Input.Password size="small" addonBefore="密钥" data-systemone-apikey="1" value={form.apiKey} onChange={(e)=>setForm({ ...form, apiKey: e.target.value })} placeholder={profile ? '已存(留空=不改)' : '粘贴 TypeSafe API Key'} />
					<div className={styles.inline}>
						<Button size="small" type="primary" loading={busy === 'save'} disabled={!!busy && busy !== 'save'} data-systemone-save="1" onClick={save}>保存</Button>
						<Button size="small" loading={busy === 'test'} disabled={!profile || formDirty || (!!busy && busy !== 'test')} title={!profile ? '先保存一份配置' : (formDirty ? '测试用的是已保存的配置:表单有未保存改动,请先保存' : '用已保存的配置发一次最小请求')} data-systemone-test="1" onClick={test}>测试连接</Button>
						{profile && formDirty ? <span className={styles.soft} data-systemone-dirty="1">表单有未保存改动,测试前请先保存</span> : null}
						{profile ? <Button size="small" danger data-systemone-delete="1" onClick={removeProfile}>删除配置</Button> : null}
					</div>
					{probe ? <div className={styles.soft} data-systemone-probe={probe.ok ? 'ok' : 'fail'}>{probe.ok ? `连接成功:模型 ${probe.model} · ${probe.latencyMs} ms · 输入 ${probe.usage ? probe.usage.inputTokens : 0} token` : `连接失败:${probe.reason}${probe.status ? ` · HTTP ${probe.status}` : ''}${probe.code ? ` · ${probe.code}` : ''}`}</div> : null}

					<div className={styles.groupLabel}>校准</div>
					<div className={styles.soft}>用随包金标集(每点 ≥ {CALIBRATION_MIN_ITEMS} 条)打你自己的密钥,按真实模型号记成绩;没通过的接入点即使打开也走原路径;回体模型号变了会自动作废、提示重校准。</div>
					<div className={styles.inline}>
						<Button size="small" loading={busy === 'calibrate'} disabled={!hasProfile || (!!busy && busy !== 'calibrate')} data-systemone-calibrate="1" onClick={calibrate}>一键校准</Button>
						{calibration ? <Button size="small" data-systemone-calibration-clear="1" onClick={()=>{ clearCalibration(); message.success('已清除校准记录'); }}>清除校准</Button> : null}
						{progress ? <span className={styles.soft} data-systemone-progress="1">{progress.done}/{progress.total}{progress.pointId ? ` · ${progress.pointId}` : ''}</span> : null}
						{calibration ? <span className={styles.soft} data-systemone-calibration={calibration.drift ? 'drift' : 'ok'}>模型 {calibration.model || '?'} · {calibration.at ? calibration.at.slice(0, 16).replace('T', ' ') : ''}</span> : null}
					</div>
					{calibration && calibration.drift ? <div className={styles.infoStrip} data-systemone-drift="1">回体里出现了别的模型号「{calibration.drift}」:所有接入点已视为未校准并回落原路径,请重新校准。</div> : null}

					<div className={styles.groupLabel}>接入点</div>
					<div className={styles.table}>
						<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, lineHeight: '20px' }}>
							<thead><tr style={{ textAlign: 'left' }}>{TABLE_HEADS.map((h)=><th key={h} style={{ whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
							<tbody>
								{points.map((p)=>{
									const mode = getPointMode(p.id);
									const rec = calibration && calibration.points ? calibration.points[p.id] : null;
									const a = agg[p.id];
									const state = pointStateText(p, { enabled: on, profile: hasProfile, calibration });
									const live = mode === 'on' ? pointOn(p.id) : (mode === 'shadow' ? pointShadow(p.id) : false);
									return (
										<tr key={p.id} data-systemone-point={p.id} data-systemone-point-state={live ? 'live' : 'idle'}>
											<td><Tooltip title={<div>{p.help}<div style={{ marginTop: 4, opacity: 0.8 }}>外发:{(p.sends || []).join(' / ')}</div></div>}><span>{p.id} · {p.title}</span></Tooltip></td>
											<td>{GROUP_LABEL[p.group] || p.group}</td>
											<td>{KIND_LABELS[p.kind] || p.kind}</td>
											<td>
												<Radio.Group className={styles.segment} size="small" value={mode} {...modeAnchor(p)} onChange={(e)=>{ setPointMode(p.id, e.target.value); bump(); }}>
													<Radio.Button value="off">关</Radio.Button>
													{p.shadowOnly ? null : <Radio.Button value="on">用</Radio.Button>}
													<Radio.Button value="shadow">影子</Radio.Button>
												</Radio.Group>
											</td>
											<td className={live ? '' : styles.soft}>{state}</td>
											<td className={styles.soft}>{rec ? (rec.passed ? '通过' : (rec.reason || '未过')) : '—'}</td>
											<td className={styles.soft}>{a && a.total ? `${a.agreed}/${a.total}` : '—'}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					<div className={styles.groupLabel}>阈值</div>
					<div className={styles.inline}>
						<Select size="small" style={{ width: 260 }} placeholder="选一个接入点调阈值" value={thPoint || undefined} data-systemone-threshold-point="1" onChange={(v)=>setThPoint(v)} options={points.map((p)=>({ value: p.id, label: `${p.id} · ${p.title}` }))} />
						{th ? (
							<>
								<span className={styles.soft}>直接采纳 ≥</span>
								<InputNumber size="small" min={0} max={1} step={0.05} value={th.act} data-systemone-threshold-act="1" onChange={(v)=>{ setThresholds(thTarget.id, { act: v }); bump(); }} />
								<span className={styles.soft}>先确认 ≥</span>
								<InputNumber size="small" min={0} max={1} step={0.05} value={th.confirm} data-systemone-threshold-confirm="1" onChange={(v)=>{ setThresholds(thTarget.id, { confirm: v }); bump(); }} />
								<Button size="small" disabled={!Object.keys(thStored).length} data-systemone-threshold-reset="1" onClick={()=>{ setThresholds(thTarget.id, { act: null, confirm: null }); bump(); }}>恢复默认</Button>
							</>
						) : null}
					</div>

					<div className={styles.groupLabel}>用量与日志</div>
					<div className={styles.inline} data-systemone-stats="1">
						<span className={styles.soft}>调用 {stats.calls} 次 · 条目 {stats.items} · 失败 {stats.errors} · 输入 {stats.inputTokens} token · 估算 ${stats.estCostUsd.toFixed(4)}{stats.lastModel ? ` · 最近模型 ${stats.lastModel}` : ''}</span>
						<Button size="small" data-systemone-stats-reset="1" onClick={()=>{ resetStats(); bump(); }}>清零</Button>
						<Button size="small" disabled={!log.length} data-systemone-log-clear="1" onClick={()=>{ clearDecisions(); bump(); }}>清日志</Button>
					</div>
					<ul className={styles.probeList} data-systemone-log="1">
						{log.map((r, i)=>(<li key={`${r.at}-${i}`} className={styles.mono}>{r.at.slice(11, 19)} {r.pointId} {r.source}{r.confidence !== null ? ` c=${r.confidence.toFixed(2)}` : ''}{r.agree === null ? '' : (r.agree ? ' 同' : ' 异')}{r.reason ? ` ${r.reason}` : ''} {r.latencyMs !== null ? `${r.latencyMs}ms` : ''}</li>))}
						{!log.length ? <li className={styles.soft}>本次会话还没有决策记录(日志只在内存,不存 state 原文)</li> : null}
					</ul>
				</div>
			) : null}
		</AdvCard>
	);
}
