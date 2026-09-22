// AI 助手·行动能力设置面(挂在 AI 分析「进阶」页末尾,整宽「危险区」卡):
// 顶部总开关(默认关)→ 开启后才出现:审批三档 / 按类别收紧 / 按工具名放行禁用 / 信任的档案 / 重新探测模型工具能力 / 目标·定时·编排三子开关
// / 五个子面板(本机 MCP 服务 · 外部服务器 · 联网检索 · 自动规则 · 动作账本)收进折叠区,缺省全部收起、头部显示状态与计数,
// 导轨/胶囊跳到子分区时(horosa:adv-open)自动展开对应面板。关闭时子项整体不渲染;由开→关时同步关掉外部智能体服务(壳侧命令不可用时静默)。
import React from 'react';
import { Switch, Radio, Button, Select, Collapse, message } from 'antd';
import {
	isAgentEnabled, setAgentEnabled, getAgentApprovalMode, setAgentApprovalMode, subscribeAgentPrefs,
	getAgentApprovalCategories, setAgentApprovalCategory, getTrustedRecords, setTrustedRecords, AGENT_APPROVAL_CATEGORIES, getToolPolicy, setToolPolicy,
	isGoalEnabled, setGoalEnabled, isSchedulerEnabled, setSchedulerEnabled, isOrchestrateEnabled, setOrchestrateEnabled } from '../../utils/aiAgent/prefs';
import { resetToolCapabilities } from '../../utils/aiAgent/caps';
import { registerBuiltinTools, listTools } from '../../utils/aiTools';
import { toolLabel } from '../../utils/aiTools/labels';
import { agentAbilityCopy } from '../../utils/aiTools/abilityCopy';
import { listActions, subscribeLedger } from '../../utils/aiTools/ledger';
import { desktopSetAgentEnabled, desktopSetSchedulerEnabled } from '../../utils/aiAnalysisDesktop';
import ExternalAgentPanel from './ExternalAgentPanel';
import ExternalServersPanel from './ExternalServersPanel';
import WebSearchPanel from './WebSearchPanel';
import AutomationRulesPanel from './AutomationRulesPanel';
import ActionLedgerPanel from './ActionLedgerPanel';
import { AdvCard, AdvRow, AdvStatus, AdvSwitchRow, AdvSubHead, ADV_SECTION_IDS, advStyles as styles } from './chat/AdvCard';
import { ADV_OPEN_EVENT } from './chat/AdvSectionNav';
import { openTaskCenter } from './TaskCenterBell';

// [D42] 总开关文案从目录派生(abilityCopy 单源;手册同句由合同测试锁定):此前手写停在批五前四项,新工具进目录后文案继续撒谎
export function agentAbilityCopyText(){
	try{ registerBuiltinTools(); }catch(e){ /* 幂等 */ }
	return `开启后,${agentAbilityCopy(listTools())}。默认关闭。`;
}
// [D12] 四个纯读类别(查询/外部/反问/界面)只认显式设置:每次确认=每次调用先问;只读=外部不出网·反问不弹·界面不动(查询照常)
const CATEGORY_LABELS = { records: '建档(命盘/事盘)', settings: '改设置', workspace: '载入工作区', tasks: '任务', query: '查询(只读)', external: '外部工具(出网)', interactive: '反问 / 进度', ui: '界面操作' };
// 工具名选项:内置目录(幂等注册后读)+ 当前已接入的外部工具;标签走单源
function toolOptions(){
	try{ registerBuiltinTools(); }catch(e){ /* 幂等 */ }
	return listTools().map((d)=>({ value: d.name, label: `${toolLabel(d.name)}(${d.name})` }));
}
// [Q-294/M-109·AR-17] 类别只能比总档更严(approvalPolicy 取秩更高者):「全自动」秩 0 在任何总档下都等于「跟随总档」→ 撤下无效档
const CATEGORY_MODE_OPTIONS = [
	{ value: 'inherit', label: '跟随总档' }, { value: 'on-request', label: '每次确认' }, { value: 'read-only', label: '只读' },
];
// 折叠面板 key ↔ 分区锚 id(导轨/胶囊跳转时按锚找面板自开)
const SUB_PANELS = [
	{ key: 'mcp-server', id: ADV_SECTION_IDS.agentMcp, title: '本机 MCP 服务', desc: '外部智能体(Codex / Claude Code / Claude Desktop)接入 · 通知脚本钩 · 无头分析出口' },
	{ key: 'servers', id: ADV_SECTION_IDS.agentServers, title: '外部服务器', desc: '接别人的 MCP 工具(只读准入)' },
	{ key: 'web', id: ADV_SECTION_IDS.agentWeb, title: '联网检索 · 网页读取', desc: '出站两道子开关,默认全关' },
	{ key: 'rules', id: ADV_SECTION_IDS.agentRules, title: '自动规则', desc: '当 X 发生,自动做 Y' },
	{ key: 'ledger', id: ADV_SECTION_IDS.agentLedger, title: '助手动作账本', desc: '写入动作一览,可撤销' },
];
const KEY_BY_ID = SUB_PANELS.reduce((m, p)=>{ m[p.id] = p.key; return m; }, {});

function statusPill(s){
	if(!s || !s.text){ return null; }
	return <AdvStatus on={!!s.on} tone={s.tone}>{s.text}</AdvStatus>;
}

export default function AgentAbilityPanel(){
	const [enabled, setEnabled] = React.useState(()=>isAgentEnabled());
	const [approval, setApproval] = React.useState(()=>getAgentApprovalMode());
	const [categories, setCategories] = React.useState(()=>getAgentApprovalCategories());
	const [trusted, setTrusted] = React.useState(()=>getTrustedRecords());
	const [toolPolicy, setToolPolicyState] = React.useState(()=>getToolPolicy());
	const [toolOpts, setToolOpts] = React.useState(null);
	const [charts, setCharts] = React.useState(null);
	const [goalOn, setGoalOn] = React.useState(()=>isGoalEnabled());
	const [schedOn, setSchedOn] = React.useState(()=>isSchedulerEnabled());
	const [orchOn, setOrchOn] = React.useState(()=>isOrchestrateEnabled());
	const [open, setOpen] = React.useState([]);            // 折叠区:缺省全收起;不持久化
	const [sub, setSub] = React.useState({});              // 各子面板上报的状态摘要 {key:{on,tone,text,count}}
	const [ledgerCount, setLedgerCount] = React.useState(()=>{ try{ return listActions().length; }catch(e){ return 0; } });
	React.useEffect(()=>subscribeAgentPrefs((d)=>{
		setEnabled(!!(d && d.enabled));
		setApproval(d && d.approval ? d.approval : 'never');
		if(d && d.categories){ setCategories(d.categories); }
		if(d && Array.isArray(d.trustedRecords)){ setTrusted(d.trustedRecords); }
		if(d && d.toolPolicy){ setToolPolicyState(d.toolPolicy); }
		// [AR-32] 三个子开关此前只在挂载时读一次:另一窗口改了键(storage 事件 → 本窗口重发偏好事件)显示仍陈旧
		setGoalOn(isGoalEnabled()); setSchedOn(isSchedulerEnabled()); setOrchOn(isOrchestrateEnabled());
	}), []);
	// 账本面板不能加 prop(它的 JSX 字面是哨兵锚,须恰一处),头部计数在这里自取
	React.useEffect(()=>subscribeLedger(()=>{ try{ setLedgerCount(listActions().length); }catch(e){ /* noop */ } }), []);
	// 导轨/胶囊跳到子分区:自动展开对应折叠面板(锚在面板头,展开后正文才可见)
	React.useEffect(()=>{
		const onOpen = (e)=>{ const id = e && e.detail && e.detail.id; const key = KEY_BY_ID[id]; if(key){ setOpen((prev)=>(prev.indexOf(key) >= 0 ? prev : prev.concat([key]))); } };
		window.addEventListener(ADV_OPEN_EVENT, onOpen);
		return ()=>window.removeEventListener(ADV_OPEN_EVENT, onOpen);
	}, []);
	const report = React.useCallback((key, s)=>{ setSub((prev)=>{ const cur = prev[key]; if(cur && s && cur.on === s.on && cur.tone === s.tone && cur.text === s.text && cur.count === s.count){ return prev; } return { ...prev, [key]: s }; }); }, []);
	const reportMcp = React.useCallback((s)=>report('mcp-server', s), [report]);
	const reportServers = React.useCallback((s)=>report('servers', s), [report]);
	const reportWeb = React.useCallback((s)=>report('web', s), [report]);
	const reportRules = React.useCallback((s)=>report('rules', s), [report]);

	async function toggle(on){
		setAgentEnabled(on);
		setEnabled(!!on);
		try{ await desktopSetAgentEnabled(!!on); }catch(e){ /* 非桌面壳/旧壳:静默 */ }
		// [Q-294/AR-28 裁决 2026-09-18] 关总开关只停服(壳按 agent_enabled && mcp_server_enabled 判停)不再把「本机 MCP 服务」子偏好永久置关 —— 重开总开关时子偏好原样恢复
	}

	// 信任档案候选:惰性载入命盘列表(设置面首帧不碰数据层)
	async function loadCharts(){
		if(charts){ return; }
		try{
			const mod = await import('../../utils/localcharts');
			const list = (mod.listLocalCharts({ includeArchived: false }) || []).slice(0, 200).map((r)=>({ value: r.cid, label: `${r.name || '未命名'}${r.birth ? ` · ${r.birth}` : ''}` }));
			setCharts(list);
		}catch(e){ setCharts([]); }
	}

	const approvalStatus = approval === 'read-only' ? <AdvStatus tone="good">只读</AdvStatus> : (approval === 'on-request' ? <AdvStatus on>每次确认</AdvStatus> : <AdvStatus tone="danger">全自动</AdvStatus>);
	return (
		<AdvCard span2 id={ADV_SECTION_IDS.agent} tone="danger" icon="quickAi" title="AI 助手行动能力" status={enabled ? <AdvStatus on>已开启</AdvStatus> : <AdvStatus>默认关闭</AdvStatus>}
			desc={agentAbilityCopyText()}
			actions={<Switch checked={enabled} data-agent-master-switch="1" onChange={(v)=>{ toggle(v); }} checkedChildren="开" unCheckedChildren="关" />}
			data-agent-ability-panel="1">
			{enabled ? (
				<div className={styles.nested}>
					<AdvRow label="写入动作审批" help="全自动=直接执行但每个动作可撤销;每次确认=写入前弹审批;只读=禁止一切写入。只约束应用内(对话 / 任务 / 自动化)的调用;外部客户端(本机 MCP 服务)另有独立审批档,见下方「本机 MCP 服务」。">
						<Radio.Group className={styles.segment} size="small" value={approval} data-approval-mode="1" onChange={(e)=>{ setAgentApprovalMode(e.target.value); setApproval(e.target.value); }}>
							<Radio.Button value="never">全自动(可撤销)</Radio.Button>
							<Radio.Button value="on-request">每次确认</Radio.Button>
							<Radio.Button value="read-only">只读(禁写)</Radio.Button>
						</Radio.Group>
						{approvalStatus}
						<Button size="small" data-caps-reset="1" onClick={()=>{ resetToolCapabilities(); message.success('已清空模型工具能力记忆,下次对话重新探测'); }}>重新探测模型工具能力</Button>
					</AdvRow>
					<div data-agent-inline-collapse="1" style={{ display: 'contents' }}>
					<Collapse ghost className={styles.collapse} onChange={(keys)=>{ if((keys || []).indexOf('trust') >= 0){ loadCharts(); } if((keys || []).indexOf('toolPolicy') >= 0 && toolOpts === null){ setToolOpts(toolOptions()); } }}>
						<Collapse.Panel header="按类别收紧审批(写入类只能比总档更严;查询/外部/反问/界面四类只认显式设置:每次确认=每次调用先问,只读=外部不出网·反问不弹·界面不动,查询照常)" key="categories">
							<div className={styles.catGrid}>
								{AGENT_APPROVAL_CATEGORIES.map((c)=>(
									<div key={c} className={styles.kv}>
										<span className={styles.kvLabel}>{CATEGORY_LABELS[c] || c}</span>
										<Select size="small" value={categories[c] || 'inherit'} options={CATEGORY_MODE_OPTIONS} className={styles.kvControl} data-approval-category={c}
											onChange={(v)=>{ setAgentApprovalCategory(c, v); setCategories((prev)=>({ ...prev, [c]: v })); }} />
									</div>
								))}
							</div>
						</Collapse.Panel>
						<Collapse.Panel header="按工具名放行 / 禁用(禁用:任何档位都不执行、不进工具目录;放行:写入类免逐次确认,只读档仍拒)" key="toolPolicy">
							<div className={styles.stack}>
								<div className={styles.kv}>
									<span className={styles.kvLabel}>禁用</span>
									<Select mode="multiple" size="small" className={styles.kvControl} placeholder="选工具(禁用优先于放行)" value={toolPolicy.deny} options={toolOpts || []} showSearch optionFilterProp="label" maxTagCount={6} data-tool-policy="deny"
										onChange={(v)=>{ setToolPolicyState(setToolPolicy({ deny: v })); }} />
								</div>
								<div className={styles.kv}>
									<span className={styles.kvLabel}>放行</span>
									<Select mode="multiple" size="small" className={styles.kvControl} placeholder="选写入类工具" value={toolPolicy.allow} options={toolOpts || []} showSearch optionFilterProp="label" maxTagCount={6} data-tool-policy="allow"
										onChange={(v)=>{ setToolPolicyState(setToolPolicy({ allow: v })); }} />
								</div>
							</div>
						</Collapse.Panel>
						<Collapse.Panel header="信任的档案(载入/查询免逐次确认;建档与改设置永不因信任放行)" key="trust">
							<Select mode="multiple" size="small" style={{ width: '100%' }} placeholder={charts === null ? '载入中…' : '选择命盘'} value={trusted}
								options={charts || []} loading={charts === null} showSearch optionFilterProp="label" maxTagCount={6} data-trust-records="1"
								onChange={(v)=>{ setTrusted(setTrustedRecords(v)); }} />
						</Collapse.Panel>
					</Collapse>
					</div>
					<AdvSwitchRow title="目标任务" desc="开启后 AI 可把多步长活建成目标任务在任务中心自动逐轮推进(每轮自检;预算四维封顶;写入按审批档;可暂停/纠偏/取消)。"
						checked={goalOn} control={<Switch checked={goalOn} data-goal-switch="1" onChange={(v)=>{ setGoalEnabled(!!v); setGoalOn(!!v); }} checkedChildren="开" unCheckedChildren="关" />}>
						{/* [2026-09-11] 任务中心此前只有右下角铃铛一个入口(进阶页零入口);这里与定时任务行各给一个直达按钮(输入框 /任务 同效) */}
						<Button size="small" data-open-task-center="goal" style={{ marginTop: 6 }} onClick={()=>{ openTaskCenter(); }}>打开任务中心(新建目标 / 看进度)</Button>
					</AdvSwitchRow>
					<AdvSwitchRow title="定时任务" desc="开启后可在任务中心「新建定时」(每日简报/每月月运/自定义提示词/择日到期提醒),AI 也可替你排期(可撤销);壳 60 秒心跳,错过按策略补跑。"
						checked={schedOn} control={<Switch checked={schedOn} data-scheduler-switch="1" onChange={(v)=>{ setSchedulerEnabled(!!v); setSchedOn(!!v); desktopSetSchedulerEnabled(!!v).catch(()=>{}); }} checkedChildren="开" unCheckedChildren="关" />}>
						<Button size="small" data-open-task-center="scheduler" style={{ marginTop: 6 }} onClick={()=>{ openTaskCenter(); }}>打开任务中心(新建定时 / 看下次运行)</Button>
					</AdvSwitchRow>
					<AdvSwitchRow title="多技法并行分析" desc={<span>开启后输入 <code>/编排 问题</code>:先拆成最多 4 个「技法 × 子问题」,每个子任务只挂该技法的排盘数据、只读不写,末轮汇总并标出分歧。</span>}
						checked={orchOn} control={<Switch checked={orchOn} data-orchestrate-switch="1" onChange={(v)=>{ setOrchestrateEnabled(!!v); setOrchOn(!!v); }} checkedChildren="开" unCheckedChildren="关" />} />
					<div className={styles.groupLabel}>外部连接 · 自动化 · 账本(缺省收起;点头部展开)</div>
					<div className={styles.agentCollapse} data-agent-collapse="1">
						<Collapse expandIconPosition="end" activeKey={open} onChange={(k)=>setOpen(Array.isArray(k) ? k : [k].filter(Boolean))}>
							<Collapse.Panel forceRender key="mcp-server" header={<AdvSubHead id={SUB_PANELS[0].id} title={SUB_PANELS[0].title} desc={SUB_PANELS[0].desc} status={statusPill(sub['mcp-server'])} />}>
								<ExternalAgentPanel onStatus={reportMcp} />
							</Collapse.Panel>
							<Collapse.Panel forceRender key="servers" header={<AdvSubHead id={SUB_PANELS[1].id} title={SUB_PANELS[1].title} desc={SUB_PANELS[1].desc} status={statusPill(sub.servers)} count={sub.servers && sub.servers.count ? sub.servers.count : null} />}>
								<ExternalServersPanel onStatus={reportServers} />
							</Collapse.Panel>
							<Collapse.Panel forceRender key="web" header={<AdvSubHead id={SUB_PANELS[2].id} title={SUB_PANELS[2].title} desc={SUB_PANELS[2].desc} status={statusPill(sub.web)} />}>
								<WebSearchPanel onStatus={reportWeb} />
							</Collapse.Panel>
							<Collapse.Panel forceRender key="rules" header={<AdvSubHead id={SUB_PANELS[3].id} title={SUB_PANELS[3].title} desc={SUB_PANELS[3].desc} status={statusPill(sub.rules)} count={sub.rules && sub.rules.count ? sub.rules.count : null} />}>
								<AutomationRulesPanel onStatus={reportRules} />
							</Collapse.Panel>
							<Collapse.Panel forceRender key="ledger" header={<AdvSubHead id={SUB_PANELS[4].id} title={SUB_PANELS[4].title} desc={SUB_PANELS[4].desc} count={ledgerCount || null} />}>
								<ActionLedgerPanel />
							</Collapse.Panel>
						</Collapse>
					</div>
				</div>
			) : null}
		</AdvCard>
	);
}
