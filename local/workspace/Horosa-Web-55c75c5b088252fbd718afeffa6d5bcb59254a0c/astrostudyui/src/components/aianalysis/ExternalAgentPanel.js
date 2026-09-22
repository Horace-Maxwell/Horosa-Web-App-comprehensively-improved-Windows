// AI 助手·外部智能体连接(本机 MCP 服务)子面板:只在总开关开启时由 AgentAbilityPanel 渲染(折叠区「本机 MCP 服务」)。
// 子开关默认关;首开二次确认;状态行;复制三家客户端配置;复制/轮换令牌;显示端点文件路径;通知脚本钩;无头分析出口。
// 复制一律走 copyTextSmart(桌面壳剪贴板优先;禁止裸 writeText)。onStatus:向折叠头上报一句状态(可选)。
import React from 'react';
import { Switch, Button, Modal, message, Tag, Input, Radio, InputNumber } from 'antd';
import { desktopMcpServerStatus, desktopMcpServerSetEnabled, desktopMcpServerRotateToken, desktopMcpServerRevealToken, desktopNotifyHookStatus, desktopNotifyHookSet, desktopNotifyHookRun } from '../../utils/aiAnalysisDesktop';
import { copyTextSmart } from '../../utils/clipboardText';
import { isHeadlessEnabled, setHeadlessEnabled, getExternalPolicy, setExternalPolicy, clearExternalPolicy, DEFAULT_EXTERNAL_POLICY, AGENT_EXTERNAL_APPROVALS, subscribeAgentPrefs } from '../../utils/aiAgent/prefs';
import { AdvSwitchRow, AdvRow, advStyles as styles } from './chat/AdvCard';
import { registerBuiltinTools, listTools } from '../../utils/aiTools';
import { mcpConfirmCopy } from '../../utils/aiTools/abilityCopy';

// [Q-294/M-109·AR-26] 首开确认文案由工具目录生成(与总开关文案 agentAbilityCopyText 同源);此前手写少列了改设置 / 收藏置顶打标签 / 切换界面 / 建任务 / 出网,且称「不会删除或覆盖任何数据」
export function mcpConfirmCopyText(){
	try{ registerBuiltinTools(); }catch(e){ /* 幂等 */ }
	return mcpConfirmCopy(listTools());
}

function codexConfig(st){
	return `codex mcp add horosa --url ${st.url} --bearer-token-env-var HOROSA_MCP_TOKEN\n# 先在 shell 里: export HOROSA_MCP_TOKEN='${st.token}'`;
}
function claudeCodeConfig(st){
	return `claude mcp add --transport http horosa ${st.url} --header "Authorization: Bearer ${st.token}"`;
}
// [批三④] Claude Desktop 只会 stdio:配置指向本 App 二进制 + 端点文件(令牌不进配置文件;代理自己从端点文件读);没有二进制路径时退回 http 形态
export function claudeDesktopConfig(st){
	if(st.binaryPath && st.endpointFile){
		return JSON.stringify({ mcpServers: { horosa: { command: st.binaryPath, args: ['--horosa-mcp-stdio', st.endpointFile] } } }, null, 2);
	}
	return JSON.stringify({ mcpServers: { horosa: { type: 'http', url: st.url, headers: { Authorization: `Bearer ${st.token}` } } } }, null, 2);
}

export const NOTIFY_HOOK_CONFIRM_COPY = '开启后,星阙会在自动化规则命中「运行我的通知脚本」时执行你指定的脚本:脚本只能放在你的用户目录或 /usr/local/bin,必须可执行且不能对所有人可写;每次只传一个 JSON 参数、不经 shell、10 秒超时、与桌面通知同一限流。脚本做什么完全由你负责。';

function NotifyHookBlock(){
	const [st, setSt] = React.useState({ available: false, loading: true });
	const [path, setPath] = React.useState('');
	const [busy, setBusy] = React.useState(false);
	const refresh = React.useCallback(async ()=>{ const s = await desktopNotifyHookStatus(); setSt({ ...s, loading: false }); if(s && typeof s.path === 'string' && s.path){ setPath(s.path); } }, []);
	React.useEffect(()=>{ refresh(); }, [refresh]);
	if(!st.loading && !st.available){ return null; }
	async function apply(on){
		setBusy(true);
		try{
			const r = await desktopNotifyHookSet(on, path);
			if(r && r.available === false){ message.warning('仅桌面版可用'); return; }
			message.success(on ? '通知脚本钩已启用' : '通知脚本钩已关闭');
		}catch(e){ message.error(`未能启用:${e && e.message ? e.message : e}`); }
		finally{ setBusy(false); refresh(); }
	}
	const stateText = st.killSwitch ? '已被环境变量 HOROSA_NOTIFY_HOOK=0 一票否决' : (st.enabled ? (st.valid ? '已启用' : `已启用但路径无效:${st.reason || ''}`) : '未启用');
	return (
		<div data-notify-hook="1">
			<AdvSwitchRow title="通知脚本钩(自动化动作「运行我的通知脚本」)" desc={stateText} checked={!!st.enabled}
				control={<Switch checked={!!st.enabled} disabled={!!st.killSwitch || busy} data-notify-hook-switch="1" checkedChildren="开" unCheckedChildren="关"
					onChange={(on)=>{ if(!on){ apply(false); return; } if(!`${path || ''}`.trim()){ message.warning('先填脚本的绝对路径'); return; } Modal.confirm({ title: '启用通知脚本钩?', content: NOTIFY_HOOK_CONFIRM_COPY, okText: '启用', cancelText: '取消', onOk: ()=>apply(true) }); }} />}>
				<div className={styles.stack} style={{ marginTop: 8 }}>
					<Input size="small" addonBefore="脚本路径" value={path} onChange={(e)=>setPath(e.target.value)} placeholder="/Users/你/bin/horosa-notify.sh" data-notify-hook-path="1" />
					<div className={styles.inline}>
						<Button size="small" disabled={!st.enabled || busy} data-notify-hook-test="1" onClick={async ()=>{ const r = await desktopNotifyHookRun({ event: 'test', title: '星阙测试', text: '通知脚本钩测试运行', at: new Date().toISOString(), payload: { note: '测试运行:真实事件载荷为 { event, title, at, payload }' } }, true); if(r && r.ran){ message.success(`脚本已运行(exit ${r.exit == null ? '?' : r.exit}${r.timedOut ? ',超时被停' : ''})`); }else{ message.warning(`未运行:${(r && r.reason) || '不可用'}`); } }}>测试运行</Button>
						{st.enabled && `${path || ''}`.trim() !== `${st.path || ''}` ? <Button size="small" disabled={busy} data-notify-hook-save="1" onClick={()=>apply(true)}>保存新路径</Button> : null}
					</div>
				</div>
			</AdvSwitchRow>
		</div>
	);
}

export const EXTERNAL_POLICY_APPROVAL_LABELS = { auto: '全自动(可撤销)', 'on-request': '每次确认', 'read-only': '只读(禁写)' };
// [进阶审计 D2] 外部客户端策略:键 horosa.ai.agent.external.policy.v1 此前被 mcpBridge 每次外部调用消费、手册也写了,
// 界面上却没有任何控件可改(setExternalPolicy 零调用者)。打开不写键;改动才写;「恢复缺省」删键(与从未设置同形)。
// 桌面无关:键在页面侧,浏览器预览也能改;它约束的是外部程序经本机服务发来的调用。
function ExternalPolicyBlock(){
	const [policy, setPolicy] = React.useState(()=>getExternalPolicy());
	React.useEffect(()=>subscribeAgentPrefs(()=>setPolicy(getExternalPolicy())), []);
	const isDefault = policy.approval === DEFAULT_EXTERNAL_POLICY.approval && policy.maxCallsPerMinute === DEFAULT_EXTERNAL_POLICY.maxCallsPerMinute && policy.maxAdditivePerHour === DEFAULT_EXTERNAL_POLICY.maxAdditivePerHour;
	return (
		<div data-external-policy="1" className={styles.stack} style={{ marginTop: 8 }}>
			<AdvRow label="外部客户端审批" help="外部程序经本机服务调用时的写入审批档:全自动=直接执行但可撤销;每次确认=写入前弹到本机审批台;只读=拒绝一切写入。缺省全自动(令牌持有者=受信本机进程)。">
				<Radio.Group className={styles.segment} size="small" value={policy.approval} data-external-policy-approval="1" onChange={(e)=>setExternalPolicy({ approval: e.target.value })}>
					{AGENT_EXTERNAL_APPROVALS.map((v)=>(<Radio.Button key={v} value={v}>{EXTERNAL_POLICY_APPROVAL_LABELS[v] || v}</Radio.Button>))}
				</Radio.Group>
			</AdvRow>
			<AdvRow label="外部调用上限" help="每分钟调用上限(1..600)与每小时写入上限(0..10000);超限的调用回 E_LIMIT、不执行、不进账本。">
				<div className={styles.inline}>
					<InputNumber size="small" min={1} max={600} value={policy.maxCallsPerMinute} data-external-policy-calls="1" addonAfter="次/分钟" onChange={(v)=>{ if(Number.isFinite(v)){ setExternalPolicy({ maxCallsPerMinute: v }); } }} />
					<InputNumber size="small" min={0} max={10000} value={policy.maxAdditivePerHour} data-external-policy-writes="1" addonAfter="写入/小时" onChange={(v)=>{ if(Number.isFinite(v)){ setExternalPolicy({ maxAdditivePerHour: v }); } }} />
					<Button size="small" disabled={isDefault} data-external-policy-reset="1" onClick={()=>{ clearExternalPolicy(); message.success('外部客户端策略已恢复缺省'); }}>恢复缺省</Button>
				</div>
			</AdvRow>
		</div>
	);
}

export default function ExternalAgentPanel({ onStatus }){
	const [headlessOn, setHeadlessOn] = React.useState(()=>isHeadlessEnabled());   // [批三③] 无头分析出口(只经 MCP)
	React.useEffect(()=>subscribeAgentPrefs(()=>setHeadlessOn(isHeadlessEnabled())), []);   // [AR-32] 跨窗口改键后重读(此前只挂载时读一次)
	const [status, setStatus] = React.useState({ available: false, loading: true });
	const [busy, setBusy] = React.useState(false);

	const refresh = React.useCallback(async ()=>{
		const st = await desktopMcpServerStatus();
		setStatus({ ...st, loading: false });
	}, []);
	React.useEffect(()=>{ refresh(); }, [refresh]);

	async function setEnabled(on){
		setBusy(true);
		try{
			const r = await desktopMcpServerSetEnabled(on);
			if(!r.available){ message.warning('当前环境无法启动外部智能体服务'); }
		}finally{
			setBusy(false);
			refresh();
		}
	}
	function onToggle(on){
		if(!on){ setEnabled(false); return; }
		Modal.confirm({ title: '开启外部智能体连接?', content: mcpConfirmCopyText(), okText: '开启', cancelText: '取消', onOk: ()=>setEnabled(true) });
	}
	async function copy(text, label){
		const ok = await copyTextSmart(text);
		if(ok){ message.success(`${label}已复制`); }else{ message.error('复制失败'); }
	}
	// 令牌不随状态轮询下发(缩小暴露面),复制时按需向壳取一次再拼配置
	async function copyWithToken(build, label){
		const r = await desktopMcpServerRevealToken();
		const token = r && r.available && r.token ? `${r.token}` : '';
		if(!token){ message.error('服务未运行或无法取得令牌'); return; }
		await copy(build({ ...status, token }), label);
	}

	const running = !!(status.available && status.running);
	const enabled = !!(status.available && status.enabled);
	const stateText = status.loading ? '读取状态…' : (!status.available ? '仅桌面版可用' : (running ? `运行中 · ${status.url}` : (enabled ? '已开启,等待启动…' : '未开启:开启后本机上的 Codex / Claude Code / Claude Desktop 可经回环地址凭令牌接入')));
	React.useEffect(()=>{
		if(typeof onStatus !== 'function'){ return; }
		if(status.loading){ onStatus({ on: false, text: '读取中' }); return; }
		if(!status.available){ onStatus({ on: false, text: '仅桌面版' }); return; }
		if(running){ onStatus({ on: true, tone: 'good', text: `运行中 · 端口 ${status.port}` }); return; }
		onStatus(enabled ? { on: true, tone: 'warn', text: '已开启,等待启动' } : { on: false, text: '未开启' });
	}, [onStatus, status.loading, status.available, status.port, running, enabled]);
	return (
		<div data-external-agent-panel="1" className={styles.subPanel}>
			<AdvSwitchRow title="外部智能体连接(本机 MCP 服务)" desc={stateText} checked={enabled}
				control={<Switch checked={enabled} disabled={!status.available || busy} loading={busy} onChange={onToggle} data-mcp-server-switch="1" checkedChildren="开" unCheckedChildren="关" />}>
				{running ? (
					<div className={styles.stack} style={{ marginTop: 8 }}>
						<div className={styles.inline}>
							<Tag style={{ margin: 0 }}>端口 {status.port}</Tag>
							<Button size="small" data-mcp-copy="codex" onClick={()=>copyWithToken(codexConfig, 'Codex 接入命令')}>复制 Codex 命令</Button>
							<Button size="small" data-mcp-copy="claude-code" onClick={()=>copyWithToken(claudeCodeConfig, 'Claude Code 接入命令')}>复制 Claude Code 命令</Button>
							<Button size="small" data-mcp-copy="claude-desktop" onClick={()=>copyWithToken(claudeDesktopConfig, 'Claude Desktop 配置')}>复制 Claude Desktop 配置</Button>
						</div>
						<div className={styles.inline}>
							<Button size="small" data-mcp-copy="token" onClick={()=>copyWithToken((st)=>st.token, '令牌')}>复制令牌</Button>
							<Button size="small" data-mcp-rotate="1" onClick={async ()=>{ const r = await desktopMcpServerRotateToken(); if(r.available){ message.success('令牌已轮换,旧令牌立即失效'); refresh(); } }}>轮换令牌</Button>
							<Button size="small" data-mcp-refresh="1" onClick={refresh}>刷新状态</Button>
						</div>
						{status.endpointFile ? <div className={styles.soft} data-mcp-endpoint="1">端点文件:{status.endpointFile}</div> : null}
					</div>
				) : null}
			</AdvSwitchRow>
			<NotifyHookBlock />
			<ExternalPolicyBlock />
			<div data-headless-exit="1">
				<AdvSwitchRow title="无头分析出口(run_analysis)" desc="开启后外部程序可经本机 MCP 调 run_analysis:用你现有的接口配置作答,只回文本与用量,不进会话、不落库、只能用只读工具、同时只跑一个。页面内的 AI 永远看不到它。" checked={headlessOn}
					control={<Switch checked={headlessOn} data-headless-switch="1" onChange={(v)=>{ setHeadlessEnabled(!!v); setHeadlessOn(!!v); }} checkedChildren="开" unCheckedChildren="关" />} />
			</div>
		</div>
	);
}
