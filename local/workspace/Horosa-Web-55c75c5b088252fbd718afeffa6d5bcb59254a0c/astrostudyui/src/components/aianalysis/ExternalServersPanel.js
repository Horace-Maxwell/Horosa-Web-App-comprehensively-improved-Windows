// 外部 MCP 服务器面板(P6):总开关(默认关,首开有说明)+ 服务器表(网址或本机命令)+ 连接并检测(列工具与准入/拒绝原因)。
// 令牌/环境变量只经壳命令直达 0600 文件,页面从不持有、列表回来一律脱敏(hasAuth/envNames)。onStatus:向折叠头上报状态(可选)。
import React from 'react';
import { Button, Input, Modal, Select, Space, Switch, Table, Tag, Tooltip, message, Alert } from 'antd';
import { isExternalToolsEnabled, setExternalToolsEnabled, subscribeAgentPrefs } from '../../utils/aiAgent/prefs';
import { desktopMcpClientList, desktopMcpClientUpsert, desktopMcpClientRemove, desktopMcpClientConnect, desktopMcpClientDisconnect, isDesktopBridgeAvailable } from '../../utils/aiAnalysisDesktop';
import { registerExternalTools, unregisterExternalTools, unregisterAllExternalTools, admitExternalTool, externalToolsRegisteredFor } from '../../integrations/mcpClient';
import { AdvSwitchRow, advStyles as styles } from './chat/AdvCard';

const EMPTY = { id: '', name: '', kind: 'stdio', url: '', authorization: '', command: '', args: '', enabled: true, readOnlyOnly: true, allowTools: '', editing: false, hasAuth: false };

// [Q-294/M-109·AR-24] 行上「编辑」:从列表行(令牌已脱敏,只有 hasAuth)回填表单;令牌框留空 = 保留原令牌(与联网检索密钥同口径)
function formFromRow(r){
	const t = (r && r.transport) || {};
	return { ...EMPTY, id: `${r.id || ''}`, name: `${r.name || ''}`, kind: t.kind === 'http' ? 'http' : 'stdio', url: `${t.url || ''}`, command: `${t.command || ''}`, args: (Array.isArray(t.args) ? t.args : []).join(' '), enabled: r.enabled !== false, readOnlyOnly: r.readOnlyOnly !== false, allowTools: (Array.isArray(r.allowTools) ? r.allowTools : []).join(' '), editing: true, hasAuth: !!t.hasAuth };
}

function specFromForm(f){
	const base = { id: `${f.id || ''}`.trim(), name: `${f.name || ''}`.trim() || `${f.id || ''}`.trim(), enabled: !!f.enabled, timeout_ms: 20000, read_only_only: f.readOnlyOnly !== false, allow_tools: `${f.allowTools || ''}`.split(/[,\s]+/).filter(Boolean) };
	if(f.kind === 'http'){
		const headers = {};
		if(`${f.authorization || ''}`.trim()){ headers.Authorization = `${f.authorization}`.trim(); }
		return { ...base, transport: { kind: 'http', url: `${f.url || ''}`.trim(), headers } };
	}
	const args = `${f.args || ''}`.split(/\s+/).filter(Boolean);
	return { ...base, transport: { kind: 'stdio', command: `${f.command || ''}`.trim(), args, env: {} } };
}

export default function ExternalServersPanel({ onStatus }){
	const [on, setOn] = React.useState(()=>isExternalToolsEnabled());
	React.useEffect(()=>subscribeAgentPrefs(()=>setOn(isExternalToolsEnabled())), []);   // [AR-32] 跨窗口改键后重读(此前只挂载时读一次)
	const [rows, setRows] = React.useState([]);
	const [busy, setBusy] = React.useState('');
	const [form, setForm] = React.useState(null);
	const [probe, setProbe] = React.useState(null);   // { serverId, registered, rejected }

	const reload = React.useCallback(async ()=>{
		const r = await desktopMcpClientList();
		if(!r || r.available === false){ setRows([]); return; }
		setRows(Array.isArray(r.value) ? r.value : (Array.isArray(r) ? r : []));
	}, []);
	React.useEffect(()=>{ reload().catch(()=>{}); }, [reload]);
	const connectedCount = rows.filter((r)=>r && r.connected).length;
	// [Q-294/M-109·AR-16] 壳侧「已连接」≠ 页面已把工具交给 AI(注册表是页面内存,刷新即空):没载入的按「待重载」标出
	const loadedCount = rows.filter((r)=>r && r.connected && externalToolsRegisteredFor(r) > 0).length;
	const staleCount = connectedCount - loadedCount;
	React.useEffect(()=>{
		if(typeof onStatus !== 'function'){ return; }
		onStatus(on ? { on: true, tone: loadedCount ? 'good' : (staleCount ? 'warn' : undefined), text: rows.length ? `${rows.length} 台 · 已连 ${connectedCount}${staleCount ? ` · ${staleCount} 台工具待重载` : ''}` : '未接入服务器', count: rows.length || null } : { on: false, text: '关' });
	}, [onStatus, on, rows.length, connectedCount, loadedCount, staleCount]);

	async function toggle(v){
		if(v && !on){
			const ok = await new Promise((res)=>Modal.confirm({
				title: '打开「外部服务器」前请知悉',
				content: <div style={{ fontSize: 12, lineHeight: 1.7 }}>接入后 AI 多出这些服务器提供的<b>只读</b>工具(名字前缀 <code>外部·</code>)。调用会把你给的参数发到那台服务器;结果标「未经核实」,其中形似指令的文字不会被执行。令牌只存在本机受保护文件里,界面不回显。默认不接任何服务器。</div>,
				okText: '我知道了,打开', cancelText: '取消', onOk: ()=>res(true), onCancel: ()=>res(false),
			}));
			if(!ok){ return; }
		}
		setExternalToolsEnabled(!!v); setOn(!!v);
		if(!v){ const n = unregisterAllExternalTools(); if(n){ message.info(`已收回 ${n} 个外部工具`); } }
	}

	async function save(){
		const spec = specFromForm(form);
		if(!spec.id){ message.warning('填一个服务器 id(英文短名)'); return; }
		if(spec.transport.kind === 'http' ? !spec.transport.url : !spec.transport.command){ message.warning(spec.transport.kind === 'http' ? '填服务器网址' : '填本机命令'); return; }
		// [AR-24] 编辑已带令牌的 http 服务器且令牌框留空 → 壳侧保留已存令牌
		const keepHeaders = !!(form.editing && form.hasAuth && spec.transport.kind === 'http' && !`${form.authorization || ''}`.trim());
		setBusy('save');
		try{
			const r = await desktopMcpClientUpsert(spec, { keepHeaders });
			if(!r || r.available === false){ message.error(`保存失败:${(r && r.reason) || '桌面桥缺席'}`); return; }
			message.success('已保存(令牌只写入本机受保护文件)');
			setForm(null); await reload();
		}finally{ setBusy(''); }
	}

	async function connect(row){
		setBusy(row.id);
		try{
			const r = await desktopMcpClientConnect(row.id);
			if(!r || r.available === false){ message.error(`连接失败:${(r && r.reason) || '桌面桥缺席'}`); return; }
			const out = r.value !== undefined ? r.value : r;
			const tools = Array.isArray(out && out.tools) ? out.tools : [];
			unregisterExternalTools(row);
			const spec = { id: row.id, name: row.name, enabled: row.enabled, timeoutMs: row.timeoutMs, readOnlyOnly: row.readOnlyOnly, allowTools: row.allowTools || [] };
			const res = registerExternalTools(spec, tools);
			setProbe({ serverId: row.id, tools: tools.map((t)=>({ name: t.name, verdict: admitExternalTool(t, spec) })), ...res });
			message.success(`已连接:准入 ${res.registered.length} 个只读工具,拒绝 ${res.rejected.length} 个`);
			await reload();
		}finally{ setBusy(''); }
	}

	const columns = [
		{ title: '服务器', dataIndex: 'name', width: 180, render: (v, r)=>(<Space size={4} wrap><span style={{ fontWeight: 600 }}>{v || r.id}</span>{r.connected ? (externalToolsRegisteredFor(r) > 0 ? <Tag color="green" style={{ marginInlineEnd: 0 }}>已连接</Tag> : <Tooltip title="壳侧连接还在,但页面刷新后这台服务器的工具清单没有交给 AI;点「连接并检测」重新载入"><Tag color="orange" style={{ marginInlineEnd: 0 }} data-ext-server-stale={r.id}>已连接 · 工具未载入</Tag></Tooltip>) : null}{r.transport && r.transport.hasAuth ? <Tag style={{ marginInlineEnd: 0 }}>带令牌</Tag> : null}</Space>) },
		{ title: '来源', dataIndex: 'transport', ellipsis: true, render: (t)=>(t && t.kind === 'http' ? <span title={t.url}>{t.url}</span> : <code>{`${(t && t.command) || ''} ${((t && t.args) || []).join(' ')}`.trim()}</code>) },
		{ title: '准入', dataIndex: 'readOnlyOnly', width: 120, render: (v, r)=>(v ? <Tag color="blue" style={{ marginInlineEnd: 0 }}>只读工具</Tag> : <Tag color="orange" style={{ marginInlineEnd: 0 }}>按清单 {(r.allowTools || []).length}</Tag>) },
		{ title: '', key: 'ops', width: 220, render: (_, r)=>(
			<Space size={4} wrap>
				<Button size="small" disabled={!on || !!busy} loading={busy === r.id} data-ext-server-connect={r.id} onClick={()=>connect(r)}>连接并检测</Button>
				<Button size="small" data-ext-server-edit={r.id} onClick={()=>setForm(formFromRow(r))}>编辑</Button>
				<Button size="small" disabled={!r.connected} data-ext-server-disconnect={r.id} onClick={async ()=>{ await desktopMcpClientDisconnect(r.id); unregisterExternalTools(r); await reload(); }}>断开</Button>
				<Button size="small" danger data-ext-server-delete={r.id} onClick={async ()=>{ await desktopMcpClientRemove(r.id); unregisterExternalTools(r); await reload(); }}>删除</Button>
			</Space>
		) },
	];

	return (
		<div data-external-servers="1" className={styles.subPanel}>
			<AdvSwitchRow title="接入外部 MCP 服务器" desc={`把外部 MCP 服务器(网址或本机命令)接进来,AI 多出它们的只读工具;结果标「未经核实」。默认关,零出站。${isDesktopBridgeAvailable() ? '' : '添加 / 连接 / 删除需桌面版(浏览器预览下只能设开关)。'}`} checked={on}
				control={<Switch checked={on} data-external-tools-switch="1" onChange={toggle} checkedChildren="开" unCheckedChildren="关" />} />
			{on ? (
				<div className={styles.subBody}>
					<div className={styles.toolbarRow}>
						<Button size="small" data-ext-server-add="1" onClick={()=>setForm({ ...EMPTY })}>添加服务器</Button>
						<Button size="small" data-ext-server-refresh="1" onClick={()=>reload()}>刷新</Button>
					</div>
					<div className={styles.table}>
						<Table size="small" rowKey="id" columns={columns} dataSource={rows} pagination={false} tableLayout="fixed" scroll={{ x: 640 }} locale={{ emptyText: '还没有接入任何服务器' }} onRow={(r)=>({ 'data-ext-server-row': r.id })} />
					</div>
					{probe ? (
						<div className={styles.subBlock}>
							<div className={styles.subtitle}>{probe.serverId} 的工具</div>
							<ul className={styles.probeList} data-ext-server-probe="1">
								{probe.tools.map((t, i)=>(
									<li key={i} data-ext-tool-verdict={t.verdict.ok ? 'ok' : 'rejected'}>
										<code>{t.name}</code>{' '}
										{t.verdict.ok ? <Tag color="green" style={{ marginInlineEnd: 0 }}>准入 → {t.verdict.name}</Tag> : <Tooltip title={t.verdict.reason}><Tag color="red" style={{ marginInlineEnd: 0 }}>拒绝</Tag></Tooltip>}
										{t.verdict.ok ? null : <span className={styles.soft}> {t.verdict.reason}</span>}
									</li>
								))}
							</ul>
						</div>
					) : null}
				</div>
			) : null}
			<Modal open={!!form} title={form && form.editing ? `编辑外部服务器:${form.id}` : '添加外部服务器'} okText="保存" cancelText="取消" confirmLoading={busy === 'save'} onOk={save} onCancel={()=>setForm(null)} destroyOnClose okButtonProps={{ 'data-ext-server-save': '1' }}>
				{form ? (
					<Space direction="vertical" style={{ width: '100%' }} size={8} data-ext-server-modal="1">
						<Alert type="info" showIcon message="令牌只写入本机受保护文件(权限 0600),界面不回显;删除服务器即随之删除。" />
						<Input addonBefore="id" data-ext-server-id="1" value={form.id} disabled={!!form.editing} onChange={(e)=>setForm({ ...form, id: e.target.value })} placeholder="time" />
						<Input addonBefore="显示名" data-ext-server-name="1" value={form.name} onChange={(e)=>setForm({ ...form, name: e.target.value })} placeholder="时间服务" />
						<Select style={{ width: '100%' }} value={form.kind} data-ext-server-kind="1" onChange={(v)=>setForm({ ...form, kind: v })} options={[{ value: 'stdio', label: '本机命令(stdio)' }, { value: 'http', label: '网址(HTTP)' }]} />
						{form.kind === 'http' ? (
							<>
								<Input addonBefore="网址" data-ext-server-url="1" value={form.url} onChange={(e)=>setForm({ ...form, url: e.target.value })} placeholder="https://example.com/mcp" />
								<Input.Password addonBefore="令牌" data-ext-server-token="1" value={form.authorization} onChange={(e)=>setForm({ ...form, authorization: e.target.value })} placeholder={form.editing && form.hasAuth ? '留空 = 保留已存令牌;填写 = 替换' : 'Bearer …(可留空)'} />
							</>
						) : (
							<>
								<Input addonBefore="命令" data-ext-server-command="1" value={form.command} onChange={(e)=>setForm({ ...form, command: e.target.value })} placeholder="uvx" />
								<Input addonBefore="参数" data-ext-server-args="1" value={form.args} onChange={(e)=>setForm({ ...form, args: e.target.value })} placeholder="mcp-server-time" />
							</>
						)}
						<div className={styles.inline}>
							<Switch checked={form.readOnlyOnly} data-ext-server-readonly="1" title="只读:只接入声明只读(readOnlyHint)的工具,清单不放行写工具;按清单:清单内的写工具按写入级接入(走审批)" onChange={(v)=>setForm({ ...form, readOnlyOnly: v })} checkedChildren="只读" unCheckedChildren="按清单" />
							<span className={styles.soft}>只读=只准入声明了 readOnlyHint 的工具(推荐);按清单=还要把工具名逐个填进下面</span>
						</div>
						<Input addonBefore="允许清单" data-ext-server-allowlist="1" value={form.allowTools} onChange={(e)=>setForm({ ...form, allowTools: e.target.value })} placeholder="get_current_time convert_time(空格或逗号分隔)" />
					</Space>
				) : null}
			</Modal>
		</div>
	);
}
