// [D79] 只读注册表视图单源:orchestrator.js 与 aiTools/tools/runAnalysis.js 此前各有一份同名不同实现(前者不限来源,后者硬编 mcp 并排除自身);
//   现在都委托 aiAgent/readOnlyRegistry.js,文案与来源语义按各自选项保持。
import fs from 'fs';
import path from 'path';
import { readOnlyRegistryView } from '../aiAgent/readOnlyRegistry';
import { readOnlyRegistryView as orchView } from '../aiAgent/orchestrator';
import { readOnlyRegistryView as headlessView } from '../aiTools/tools/runAnalysis';

function fakeRegistry(){
	const defs = { list_records: { name: 'list_records', level: 'read' }, run_analysis: { name: 'run_analysis', level: 'read' }, create_chart_record: { name: 'create_chart_record', level: 'additive' } };
	const calls = [];
	return {
		calls,
		getTool: (n)=>defs[n] || null,
		exportToolManifest: (o)=>{ calls.push({ manifest: o }); return Object.values(defs).map((d)=>({ name: d.name, level: d.level })); },
		runTool: async (name, args, ctx)=>{ calls.push({ run: name, ctx }); return { ok: true, data: { name } }; },
	};
}

it('🔴 单源视图:只露 read 级;exclude 剔自身;origin 强制;additive 拒 E_APPROVAL_DENIED 且不进 runTool', async ()=>{
	const reg = fakeRegistry();
	const v = readOnlyRegistryView(reg, { origin: 'mcp', exclude: ['run_analysis'], denyMessage: (n)=>`拒 ${n}` });
	expect(v.readOnly).toBe(true);
	expect(v.exportToolManifest({ origin: 'in-app' }).map((t)=>t.name)).toEqual(['list_records']);
	expect(reg.calls[0].manifest).toEqual({ origin: 'mcp', includeExternal: false });
	expect(v.getTool('create_chart_record')).toBe(null);
	expect(v.getTool('run_analysis')).toBe(null);
	const denied = await v.runTool('create_chart_record', {}, { origin: 'in-app' });
	expect(denied).toEqual({ ok: false, code: 'E_APPROVAL_DENIED', message: '拒 create_chart_record' });
	expect(reg.calls.some((c)=>c.run)).toBe(false);
	const ok = await v.runTool('list_records', {}, { origin: 'in-app', requestId: 'r1' });
	expect(ok.ok).toBe(true);
	expect(reg.calls.find((c)=>c.run).ctx).toEqual({ origin: 'mcp', requestId: 'r1' });
});

it('两个消费方委托单源:编排视图不限来源、文案「子任务只读」;无头视图固定 mcp、排除自身、文案「无头分析只允许只读工具」', async ()=>{
	const r1 = fakeRegistry();
	const o = orchView(r1);
	expect(o.exportToolManifest({ origin: 'orchestrate' }).map((t)=>t.name).sort()).toEqual(['list_records', 'run_analysis']);
	expect(r1.calls[0].manifest).toEqual({ origin: 'orchestrate' });
	expect((await o.runTool('create_chart_record', {}, {})).message).toBe('子任务只读:拒绝执行 create_chart_record');
	const r2 = fakeRegistry();
	const h = headlessView(r2);
	expect(h.exportToolManifest({}).map((t)=>t.name)).toEqual(['list_records']);
	expect(r2.calls[0].manifest).toEqual({ includeExternal: false, origin: 'mcp' });
	expect((await h.runTool('run_analysis', {}, {})).message).toBe('无头分析只允许只读工具');
	await h.runTool('list_records', {}, { origin: 'in-app' });
	expect(r2.calls.find((c)=>c.run).ctx.origin).toBe('mcp');
});

it('源码锁:两处只做委托,不再各自实现过滤', ()=>{
	const src = path.resolve(__dirname, '..');
	const orch = fs.readFileSync(path.join(src, 'aiAgent', 'orchestrator.js'), 'utf8');
	const head = fs.readFileSync(path.join(src, 'aiTools', 'tools', 'runAnalysis.js'), 'utf8');
	expect(orch).toContain("from './readOnlyRegistry'");
	expect(head).toContain("from '../../aiAgent/readOnlyRegistry'");
	expect((orch.match(/const readDef = /g) || []).length).toBe(0);
	expect((head.match(/d\.level === 'read' && d\.name !== 'run_analysis'/g) || []).length).toBe(0);
});

describe('[Q-294/AR-29 裁决 2026-09-18] 只读视图默认排除 ui 类工具', ()=>{
	it('category ui 的 read 级工具在只读视图里不可见 / 不可跑;allowUi:true 才保留', async ()=>{
		const defs = { list_records: { name: 'list_records', level: 'read' }, navigate_to_technique: { name: 'navigate_to_technique', level: 'read', category: 'ui' } };
		const reg = { getTool: (n)=>defs[n] || null, exportToolManifest: ()=>Object.values(defs).map((d)=>({ name: d.name })), runTool: async (n)=>({ ok: true, name: n }) };
		const v = readOnlyRegistryView(reg, {});
		expect(v.exportToolManifest().map((t)=>t.name)).toEqual(['list_records']);
		expect(v.getTool('navigate_to_technique')).toBe(null);
		expect((await v.runTool('navigate_to_technique', {}, {})).ok).toBe(false);
		const v2 = readOnlyRegistryView(reg, { allowUi: true });
		expect(v2.exportToolManifest().map((t)=>t.name)).toEqual(['list_records', 'navigate_to_technique']);
	});
});
