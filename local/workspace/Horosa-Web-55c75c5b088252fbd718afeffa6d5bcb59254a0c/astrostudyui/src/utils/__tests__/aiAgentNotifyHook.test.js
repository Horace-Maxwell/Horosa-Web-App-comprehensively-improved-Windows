// [批三④⑥] 通知脚本钩 + stdio 代理配置合同:动作表含 notify-script;非桌面运行器回 ok:false 且不抛;deps.notifyScript 非桌面抛错;载荷形状(event/title/at/payload,无路径无令牌);
// 面板标签在位;Claude Desktop 配置在有 binaryPath+endpointFile 时用 command/args 形态且不含令牌,否则回落 http。
import { AUTOMATION_ACTION_TYPES, buildActionRunners } from '../aiAgent/automation/actions';
import { buildDefaultAutomationDeps } from '../aiAgent/automation/deps';
import { claudeDesktopConfig } from '../../components/aianalysis/ExternalAgentPanel';

it('动作表含 notify-script;非桌面运行器回不可用而不抛;桌面 deps 走 notifyScript 并整理载荷', async ()=>{
	expect(AUTOMATION_ACTION_TYPES).toContain('notify-script');
	const none = buildActionRunners({});
	const r0 = await none['notify-script']({ type: 'notify-script' }, { name: 'record.saved', payload: { cid: 'c1' } });
	expect(r0.ok).toBe(false);
	expect(r0.reason).toContain('桌面');
	const seen = [];
	const ok = buildActionRunners({ notifyScript: async (p)=>{ seen.push(p); return { ran: true, exit: 0, timedOut: false }; } });
	const r1 = await ok['notify-script']({ type: 'notify-script', title: '建档了' }, { name: 'record.saved', payload: { cid: 'c1', title: '张三' } });
	expect(r1.ok).toBe(true);
	expect(r1.summary).toContain('exit 0');
	expect(seen[0].event).toBe('record.saved');
	expect(seen[0].title).toBe('建档了');
	expect(seen[0].payload).toEqual({ cid: 'c1', title: '张三' });
	expect(typeof seen[0].at).toBe('string');
	const held = buildActionRunners({ notifyScript: async ()=>({ ran: false, reason: 'rate_limited' }) });
	const r2 = await held['notify-script']({ type: 'notify-script' }, { name: 'x', payload: {} });
	expect(r2.ok).toBe(false); expect(r2.reason).toBe('rate_limited');
	// 非桌面环境的缺省 deps:notifyScript 抛「仅桌面版」
	const deps = buildDefaultAutomationDeps();
	await expect(deps.notifyScript({ title: 't' })).rejects.toThrow(/桌面/);
});

it('Claude Desktop 配置:有 binaryPath+endpointFile → command/args 形态且不含令牌;否则 http 形态', ()=>{
	const stdio = JSON.parse(claudeDesktopConfig({ url: 'http://127.0.0.1:39991/mcp', token: 'SECRET-TOKEN-0000', binaryPath: '/Applications/Horosa.app/Contents/MacOS/Horosa', endpointFile: '/Users/me/Library/Application Support/x/mcp-endpoint.json' }));
	expect(stdio.mcpServers.horosa.command).toBe('/Applications/Horosa.app/Contents/MacOS/Horosa');
	expect(stdio.mcpServers.horosa.args).toEqual(['--horosa-mcp-stdio', '/Users/me/Library/Application Support/x/mcp-endpoint.json']);
	expect(JSON.stringify(stdio)).not.toContain('SECRET-TOKEN');
	const http = JSON.parse(claudeDesktopConfig({ url: 'http://127.0.0.1:39991/mcp', token: 'SECRET-TOKEN-0000' }));
	expect(http.mcpServers.horosa.type).toBe('http');
	expect(http.mcpServers.horosa.headers.Authorization).toBe('Bearer SECRET-TOKEN-0000');
});
