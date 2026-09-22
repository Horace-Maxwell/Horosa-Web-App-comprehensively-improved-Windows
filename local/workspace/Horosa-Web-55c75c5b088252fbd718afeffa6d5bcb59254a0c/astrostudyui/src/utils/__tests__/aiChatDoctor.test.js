// [批二⑫] /doctor 合同:纯函数全缺不抛;脱敏(sk-/Bearer/长随机串 → ***,baseUrl 只留 origin);定级(上游错误 bad / 全自动审批 warn / 围栏模式 warn / 心跳过期 warn / 后台失败 warn);文本可复制;浮层行 data-doctor-row。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { buildDoctorReport, redactSecrets, originOnly, DOCTOR_HEARTBEAT_STALE_MS } from '../aiChat/doctor';
import { BUILTIN_COMMANDS } from '../aiChat/commands';
import DoctorPanel from '../../components/aianalysis/chat/DoctorPanel';

it('脱敏:密钥形状一律 ***;baseUrl 只留 origin;uuid 不误伤', ()=>{
	expect(redactSecrets('key sk-abcdefghijklmnop and Bearer abcdefghijklmnop.xyz')).toBe('key *** and ***');
	expect(redactSecrets('id 0123456789abcdef0123456789abcdef')).toBe('id 0123456789abcdef0123456789abcdef');
	expect(originOnly('https://api.example.com/v1/chat?key=sk-abcdefghijklmnop')).toBe('https://api.example.com');
	expect(originOnly('')).toBe('');
});

it('全缺不抛;定级规则;文本每行 [级别] 标签:值', ()=>{
	const empty = buildDoctorReport();
	expect(empty.rows.length).toBeGreaterThan(8);
	expect(empty.worst).toBe('bad');   // 未选择模型
	expect(empty.text.split('\n')[1]).toMatch(/^\[(ok|warn|bad|info)\] /);
	const now = Date.parse('2026-09-06T00:00:00Z');
	const r = buildDoctorReport({
		nowMs: now,
		backend: { root: 'http://127.0.0.1:9999', lastError: '' },
		desktop: { bridge: true },
		model: { profileName: 'DS', providerType: 'openai', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1?k=sk-abcdefghijklmnop' },
		caps: { native: 'native' },
		agent: { enabled: true, approval: 'on-request', goal: true, scheduler: true, automation: false, external: false, webSearch: false, toolPolicy: { allow: [], deny: ['set_settings'] } },
		mcp: { available: true, running: true, url: 'http://127.0.0.1:18090/mcp?token=abcdefghijklmnopqrstuvwxyz012345' },
		heartbeat: { lastTickAt: now - 60000, schedulerEnabled: true },
		idb: { stats: { indexCursor: 3, reads: 10 } },
		conversations: { count: 4, activeId: 'c1' },
		persona: { enabled: true, layers: { bySubject: { a: 'x' }, byTechnique: {} } },
		routes: { hasRoutes: false, hasRouteOptions: true },
		contextPolicy: 'window',
		bgFailures: [],
	});
	const byKey = Object.fromEntries(r.rows.map((x)=>[x.key, x]));
	expect(byKey.backend.level).toBe('ok');
	expect(byKey.model.value).toBe('DS · openai · deepseek-chat · https://api.deepseek.com');
	expect(byKey.agent.level).toBe('info');
	expect(byKey.subswitches.value).toBe('目标任务 · 定时任务');
	expect(byKey.toolPolicy.value).toBe('禁用 1 · 放行 0');
	expect(byKey.mcp.value).toBe('运行中 · http://127.0.0.1:18090');
	expect(byKey.heartbeat.value).toBe('1 分钟前');
	expect(byKey.heartbeat.level).toBe('info');
	expect(byKey.persona.value).toBe('注入中 · 分层 1 条');
	expect(byKey.routes.value).toBe('已设槽思考档');
	expect(byKey.bgFailures.level).toBe('ok');
	expect(r.worst).toBe('ok');
	expect(r.text.indexOf('sk-')).toBe(-1);
	// 判别向量:上游错误 → bad;全自动审批 → warn;围栏模式 → warn;心跳过期 → warn;后台失败 → warn
	const bad = buildDoctorReport({ nowMs: now, backend: { root: 'http://x', lastError: 'HTTP 401 Bearer abcdefghijklmnop' }, model: { model: 'm' }, agent: { enabled: true, approval: 'never' }, caps: { native: 'text' }, heartbeat: { lastTickAt: now - DOCTOR_HEARTBEAT_STALE_MS - 1, schedulerEnabled: true }, bgFailures: [{ tag: 'goal', message: 'boom sk-abcdefghijklmnop' }] });
	const bk = Object.fromEntries(bad.rows.map((x)=>[x.key, x]));
	expect(bk.backendError.level).toBe('bad');
	expect(bk.backendError.value).toBe('HTTP 401 ***');
	expect(bk.agent.level).toBe('warn');
	expect(bk.caps.level).toBe('warn');
	expect(bk.heartbeat.level).toBe('warn');
	expect(bk.bgFailures.level).toBe('warn');
	expect(bk.bgFailures.value).toBe('1 条;最近:goal boom ***');
	expect(bad.worst).toBe('bad');
	expect(BUILTIN_COMMANDS.find((c)=>c.name === 'doctor').aliases).toEqual(['诊断']);
});

describe('浮层', ()=>{
	let host;
	beforeEach(()=>{ host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });
	it('每行 data-doctor-row + data-level;复制按钮在位;无 report 渲染 null', ()=>{
		act(()=>{ ReactDOM.render(<DoctorPanel open report={null} onClose={()=>{}} />, host); });
		expect(document.querySelector('[data-doctor-panel]')).toBe(null);
		const rep = buildDoctorReport({ model: { model: 'm' }, bgFailures: [{ tag: 't', message: 'x' }] });
		act(()=>{ ReactDOM.render(<DoctorPanel open report={rep} onClose={()=>{}} />, host); });
		const rows = Array.from(document.querySelectorAll('[data-doctor-row]'));
		expect(rows.length).toBe(rep.rows.length);
		expect(document.querySelector('[data-doctor-row="bgFailures"]').getAttribute('data-level')).toBe('warn');
		expect(document.querySelector('[data-doctor-panel]').getAttribute('data-doctor-worst')).toBe('warn');
		expect(document.querySelector('[data-doctor-copy="1"]')).toBeTruthy();
	});
});
