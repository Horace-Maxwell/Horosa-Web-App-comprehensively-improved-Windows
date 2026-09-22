// [进阶复查 D18·2026-09-08] 本机 MCP 服务 list_changed 发射器:去抖(同 kind 合一)、未启用零定时器零 invoke、dispose 即停、坏 kind 拒。
import { createAgentNotifier, desktopAgentNotify, AGENT_NOTIFY_KINDS } from '../aiAnalysisDesktop';

const sleep = (ms)=>new Promise((r)=>setTimeout(r, ms));

it('🔴 去抖:同 kind 三连只 invoke 一次;不同 kind 各一次;enabled=false 零定时器;dispose 后不再发;坏 kind 拒', async ()=>{
	const notify = jest.fn(async ()=>({ available: true }));
	let on = true;
	const n = createAgentNotifier({ enabled: ()=>on, delayMs: 30, notify });
	expect(n.emit('resources')).toBe(true); expect(n.emit('resources')).toBe(true); expect(n.emit('resources')).toBe(true);
	expect(n.emit('tools')).toBe(true);
	expect(n.emit('bogus')).toBe(false);
	expect(n.pending().sort()).toEqual(['resources', 'tools']);
	await sleep(90);
	expect(notify.mock.calls.map((c)=>c[0]).sort()).toEqual(['resources', 'tools']);
	on = false;
	expect(n.emit('prompts')).toBe(false);
	expect(n.pending()).toEqual([]);
	on = true;
	n.emit('prompts');
	n.dispose();
	await sleep(90);
	expect(notify).toHaveBeenCalledTimes(2);
	expect(n.emit('tools')).toBe(false);
	expect(AGENT_NOTIFY_KINDS).toEqual(['tools', 'resources', 'prompts']);
});

it('到点时若已不启用则不发(启用判定在定时器到点再问一次);enabled 抛错=不发', async ()=>{
	const notify = jest.fn(async ()=>({ available: true }));
	let on = true;
	const n = createAgentNotifier({ enabled: ()=>on, delayMs: 30, notify });
	n.emit('tools');
	on = false;
	await sleep(90);
	expect(notify).not.toHaveBeenCalled();
	const n2 = createAgentNotifier({ enabled: ()=>{ throw new Error('x'); }, delayMs: 10, notify });
	expect(n2.emit('tools')).toBe(false);
	await sleep(40);
	expect(notify).not.toHaveBeenCalled();
});

it('desktopAgentNotify:坏 kind 不 invoke(bad-kind);非桌面壳 available:false', async ()=>{
	expect((await desktopAgentNotify('nope')).reason).toBe('bad-kind');
	expect((await desktopAgentNotify('tools')).available).toBe(false);
});
