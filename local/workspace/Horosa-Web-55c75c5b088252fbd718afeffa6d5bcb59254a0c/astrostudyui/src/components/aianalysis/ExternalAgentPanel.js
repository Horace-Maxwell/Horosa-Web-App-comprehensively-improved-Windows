// AI 助手·外部智能体连接(本机 MCP 服务)子面板:只在总开关开启时由 AgentAbilityPanel 渲染(折叠区「本机 MCP 服务」)。
// 子开关默认关;首开二次确认;状态行;复制三家客户端配置;复制/轮换令牌;显示端点文件路径;REST 接口子开关(缺省关);终端命令垫片(装 / 移除 / 复制示例);通知脚本钩;无头分析出口。
// 复制一律走 copyTextSmart(桌面壳剪贴板优先;禁止裸 writeText)。onStatus:向折叠头上报一句状态(可选)。
import React from 'react';
import { Switch, Button, Modal, message, Tag, Input, Radio, InputNumber } from 'antd';
import { desktopMcpServerStatus, desktopMcpServerSetEnabled, desktopMcpServerSetRestEnabled, desktopCliShimStatus, desktopCliShimInstall, desktopCliShimRemove, desktopMcpServerRotateToken, desktopMcpServerRevealToken, desktopNotifyHookStatus, desktopNotifyHookSet, desktopNotifyHookRun } from '../../utils/aiAnalysisDesktop';
import { copyTextSmart } from '../../utils/clipboardText';
import { isHeadlessEnabled, setHeadlessEnabled, isPrivateReadEnabled, setPrivateReadEnabled, getExternalPolicy, setExternalPolicy, clearExternalPolicy, DEFAULT_EXTERNAL_POLICY, AGENT_EXTERNAL_APPROVALS, subscribeAgentPrefs } from '../../utils/aiAgent/prefs';
import { AdvSwitchRow, AdvRow, advStyles as styles } from './chat/AdvCard';
import { registerBuiltinTools, listTools } from '../../utils/aiTools';
import { mcpConfirmCopy } from '../../utils/aiTools/abilityCopy';

// 首开确认文案由工具目录生成(与总开关文案 agentAbilityCopyText 同源);此前手写少列了改设置 / 收藏置顶打标签 / 切换界面 / 建任务 / 出网,且称「不会删除或覆盖任何数据」
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
// Claude Desktop 只会 stdio:配置指向本 App 二进制 + 端点文件(令牌不进配置文件;代理自己从端点文件读);没有二进制路径时退回 http 形态
export function claudeDesktopConfig(st){
	if(st.binaryPath && st.endpointFile){
		return JSON.stringify({ mcpServers: { horosa: { command: st.binaryPath, args: ['--horosa-mcp-stdio', st.endpointFile] } } }, null, 2);
	}
	return JSON.stringify({ mcpServers: { horosa: { type: 'http', url: st.url, headers: { Authorization: `Bearer ${st.token}` } } } }, null, 2);
}
// horosa_win_shell_copy_v1:Windows 桌面版的终端说法(curl.exe / PATH / horosa.cmd);按 UA 判宿主,macOS 与 jsdom 下逐字节不变
function isWindowsHost(){
	try{ return typeof navigator !== 'undefined' && /Windows NT/.test(navigator.userAgent || ''); }catch(e){ return false; }
}
// Windows PowerShell 5.1 里 curl 是 Invoke-WebRequest 的别名,只认系统自带的 curl.exe(cmd / PowerShell 两用)
const curlCmd = ()=>(isWindowsHost() ? 'curl.exe' : 'curl');
// 本机 REST 接口:curl 示例(读当前上下文,零副作用)与 OpenAPI 地址;令牌按需取、只进剪贴板
export function restCurlExample(st){
	return `${curlCmd()} -s -H "Authorization: Bearer ${st.token}" ${st.restUrl}/context`;
}
export function restOpenApiCurl(st){
	return `${curlCmd()} -s -H "Authorization: Bearer ${st.token}" ${st.restUrl}/openapi.json`;
}
// 终端命令:装了垫片就用 horosa,没装就给二进制全路径(加引号,路径里可能有空格)
export function cliExampleCommand(st){
	if(st && st.installed && st.current){ return 'horosa status'; }
	const bin = st && st.binaryPath ? `${st.binaryPath}` : '';
	return bin ? `"${bin.replace(/"/g, '\\"')}" --horosa-cli status` : '';
}
export function cliShimConfirmCopy(st){
	if(isWindowsHost()){
		return `将把 ${(st && st.path) || '星阙安装目录里的 horosa.cmd'} 所在目录加进当前用户的 PATH:这个小脚本随星阙一起安装,指向本应用的终端命令入口;只改星阙自己的这一条 PATH,随时可在这里移除(卸载时一并移除)。装好后新开一个终端窗口(cmd / PowerShell)即可用 horosa。`;
	}
	return `将写入 ${(st && st.path) || '~/.local/bin/horosa'}:一个两行的小脚本,指向本应用的终端命令入口;只会覆盖星阙自己写的同名文件,随时可在这里移除。终端里找不到 horosa 时,把 ~/.local/bin 加进 PATH。`;
}

function CliShimBlock(){
	const [st, setSt] = React.useState({ available: false, loading: true });
	const [busy, setBusy] = React.useState(false);
	const refresh = React.useCallback(async ()=>{ const r = await desktopCliShimStatus(); setSt({ ...r, loading: false }); }, []);
	React.useEffect(()=>{ refresh(); }, [refresh]);
	async function act(fn, okText){
		setBusy(true);
		try{
			const r = await fn();
			if(r && r.available){ message.success(okText); }else{ message.error(`没做成:${(r && r.reason) || '当前环境不支持'}`); }
		}finally{
			setBusy(false);
			refresh();
		}
	}
	function onInstall(){
		Modal.confirm({ title: '安装终端命令 horosa?', content: cliShimConfirmCopy(st), okText: '安装', cancelText: '取消', onOk: ()=>act(desktopCliShimInstall, '终端命令已安装:在终端里试 horosa status') });
	}
	async function onCopy(){
		const cmd = cliExampleCommand(st);
		if(!cmd){ message.error('取不到本程序路径'); return; }
		const ok = await copyTextSmart(cmd);
		if(ok){ message.success('示例命令已复制'); }else{ message.error('复制失败'); }
	}
	const text = st.loading ? '读取状态…' : (!st.available ? '仅桌面版可用' : (st.foreign ? `${st.path} 已被别的程序占用,星阙不会覆盖` : (st.installed ? (st.current ? `已安装 · ${st.path}` : '已安装,但指向旧位置的星阙:点「更新」') : '未安装:装好后在终端里直接用 horosa(用法见帮助)')));
	return (
		<div data-cli-shim-row="1">
			<AdvRow label="终端命令 horosa" help={text}>
				<div className={styles.inline}>
					<Button size="small" data-cli-shim="install" disabled={!st.available || busy || st.foreign || (st.installed && st.current)} onClick={onInstall}>{st.installed && !st.current ? '更新' : '安装'}</Button>
					<Button size="small" data-cli-shim="remove" disabled={!st.available || busy || !st.installed} onClick={()=>act(desktopCliShimRemove, '终端命令已移除')}>移除</Button>
					<Button size="small" data-cli-shim="copy" disabled={!st.available} onClick={onCopy}>复制示例命令</Button>
				</div>
			</AdvRow>
		</div>
	);
}

export const REST_CONFIRM_COPY = '开启后,持有令牌的本机程序(curl、脚本、自动化工具)也能用普通 HTTP 请求调用与 MCP 相同的工具:同一令牌、同一套工具,审批、调用上限与写入上限都按「外部客户端策略」。只接受本机回环地址;关掉立即失效。';

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
// 外部客户端策略:键 horosa.ai.agent.external.policy.v1 此前被 mcpBridge 每次外部调用消费、手册也写了,
// 界面上却没有任何控件可改(setExternalPolicy 零调用者)。打开不写键;改动才写;「恢复缺省」删键(与从未设置同形)。
// 桌面无关:键在页面侧,浏览器预览也能改;它约束的是外部程序经本机服务发来的调用。
function ExternalPolicyBlock(){
	const [policy, setPolicy] = React.useState(()=>getExternalPolicy());
	React.useEffect(()=>subscribeAgentPrefs(()=>setPolicy(getExternalPolicy())), []);
	const isDefault = policy.approval === DEFAULT_EXTERNAL_POLICY.approval && policy.maxCallsPerMinute === DEFAULT_EXTERNAL_POLICY.maxCallsPerMinute && policy.maxAdditivePerHour === DEFAULT_EXTERNAL_POLICY.maxAdditivePerHour && policy.uiConfirm === DEFAULT_EXTERNAL_POLICY.uiConfirm;
	return (
		<div data-external-policy="1" className={styles.stack} style={{ marginTop: 8 }}>
			<AdvRow label="外部客户端审批" help="外部程序经本机服务调用时的写入审批档:全自动=直接执行但可撤销;每次确认=写入前弹到本机审批台;只读=拒绝一切写入。缺省全自动(令牌持有者=受信本机进程)。">
				<Radio.Group className={styles.segment} size="small" value={policy.approval} data-external-policy-approval="1" onChange={(e)=>setExternalPolicy({ approval: e.target.value })}>
					{AGENT_EXTERNAL_APPROVALS.map((v)=>(<Radio.Button key={v} value={v}>{EXTERNAL_POLICY_APPROVAL_LABELS[v] || v}</Radio.Button>))}
				</Radio.Group>
			</AdvRow>
			<AdvRow label="界面类也要确认" help="开启后外部程序的界面类动作(切换技法页、合盘配对、设置对话挂载)也先弹到本机审批台,你允许才执行;缺省关 = 界面动作直接执行(动作条可回退)。">
				<Switch size="small" checked={!!policy.uiConfirm} data-external-ui-confirm-switch="1" onChange={(v)=>setExternalPolicy({ uiConfirm: !!v })} checkedChildren="开" unCheckedChildren="关" />
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
	const [headlessOn, setHeadlessOn] = React.useState(()=>isHeadlessEnabled());   // 无头分析出口(只经 MCP)
	const [privateReadOn, setPrivateReadOn] = React.useState(()=>isPrivateReadEnabled());   // 私人内容可读(只经 MCP,缺省关)
	React.useEffect(()=>subscribeAgentPrefs(()=>{ setHeadlessOn(isHeadlessEnabled()); setPrivateReadOn(isPrivateReadEnabled()); }), []);   // 跨窗口改键后重读(此前只挂载时读一次)
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

	async function setRestEnabled(on){
		setBusy(true);
		try{
			const r = await desktopMcpServerSetRestEnabled(on);
			if(!r.available){ message.warning('当前环境无法切换 REST 接口'); }
		}finally{
			setBusy(false);
			refresh();
		}
	}
	function onToggleRest(on){
		if(!on){ setRestEnabled(false); return; }
		Modal.confirm({ title: '开启本机 REST 接口?', content: REST_CONFIRM_COPY, okText: '开启', cancelText: '取消', onOk: ()=>setRestEnabled(true) });
	}

	const running = !!(status.available && status.running);
	const enabled = !!(status.available && status.enabled);
	const restOn = !!(status.available && status.restEnabled);
	const restText = !enabled ? '随本机服务运行:先开启上面的外部智能体连接' : (restOn ? (running && status.restUrl ? `已开启 · ${status.restUrl}` : '已开启,等待服务启动…') : '缺省关:开启后本机脚本可用 HTTP 调同一套工具(同一令牌、同一策略)');
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
							<Button size="small" data-mcp-copy="claude-desktop" onClick={()=>copyWithToken(claudeDesktopConfig, 'MCP 客户端配置')}>复制 Claude Desktop / Cursor 等配置</Button>
						</div>
						<div className={styles.inline}>
							<Button size="small" data-mcp-copy="token" onClick={()=>copyWithToken((st)=>st.token, '令牌')}>复制令牌</Button>
							<Button size="small" data-mcp-rotate="1" onClick={async ()=>{ const r = await desktopMcpServerRotateToken(); if(r.available){ message.success('令牌已轮换,旧令牌立即失效'); refresh(); } }}>轮换令牌</Button>
							<Button size="small" data-mcp-refresh="1" onClick={refresh}>刷新状态</Button>
						</div>
						{status.endpointFile ? <div className={styles.soft} data-mcp-endpoint="1">端点文件:{status.endpointFile}</div> : null}
						{/* 各家客户端的 mcpServers JSON 同一形状:一行提示,详细接入说明在 AI 分析帮助「本机服务 / 接入客户端」 */}
						<div className={styles.soft}>Cursor / Windsurf / Cline / Gemini CLI 等用「Claude Desktop / Cursor 等配置」那段 JSON(接入说明见帮助)</div>
					</div>
				) : null}
			</AdvSwitchRow>
			<div data-mcp-rest="1">
				<AdvSwitchRow title="REST 接口(/api/v1)" desc={restText} checked={restOn}
					control={<Switch checked={restOn} disabled={!status.available || !enabled || busy} loading={busy} onChange={onToggleRest} data-mcp-rest-switch="1" checkedChildren="开" unCheckedChildren="关" />}>
					{restOn && running && status.restUrl ? (
						<div className={styles.inline} style={{ marginTop: 8 }}>
							<Button size="small" data-mcp-rest-copy="curl" onClick={()=>copyWithToken(restCurlExample, 'curl 示例')}>复制 curl 示例</Button>
							<Button size="small" data-mcp-rest-copy="openapi" onClick={()=>copyWithToken(restOpenApiCurl, '接口文档命令')}>复制接口文档命令</Button>
						</div>
					) : null}
				</AdvSwitchRow>
			</div>
			<CliShimBlock />
			<NotifyHookBlock />
			<ExternalPolicyBlock />
			<div data-headless-exit="1">
				<AdvSwitchRow title="无头分析出口(run_analysis)" desc="开启后外部程序可经本机 MCP 调 run_analysis:用你现有的接口配置作答,只回文本与用量,不进会话、不落库、只能用只读工具、同时只跑一个。页面内的 AI 永远看不到它。" checked={headlessOn}
					control={<Switch checked={headlessOn} data-headless-switch="1" onChange={(v)=>{ setHeadlessEnabled(!!v); setHeadlessOn(!!v); }} checkedChildren="开" unCheckedChildren="关" />} />
			</div>
			<div data-private-read="1">
				<AdvSwitchRow title="私人内容可读" desc="开启后外部程序可经本机 MCP 读你与星阙 AI 的对话记录、档案备注与断事日志、档案之间的关系(只读)。缺省关。" checked={privateReadOn}
					control={<Switch checked={privateReadOn} data-private-read-switch="1" onChange={(v)=>{ setPrivateReadEnabled(!!v); setPrivateReadOn(!!v); }} checkedChildren="开" unCheckedChildren="关" />} />
			</div>
		</div>
	);
}
