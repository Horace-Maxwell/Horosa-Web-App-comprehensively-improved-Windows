// 状态栏(A2)合同:纯展示组件——数字原样上屏、data-* 机读、超预算/裁剪着色、开关关=渲染 null、点击芯片调回调;费用格式。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import ChatStatusBar, { fmtCost, PRESET_LABELS, APPROVAL_LABELS } from '../../components/aianalysis/chat/ChatStatusBar';
import { CONTEXT_POLICY_PRESETS } from '../aiChatHistory';
import { AGENT_APPROVAL_MODES } from '../aiAgent/prefs';

let host;
beforeEach(()=>{ host = document.createElement('div'); document.body.appendChild(host); });
afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });

const render = (props)=>act(()=>{ ReactDOM.render(<ChatStatusBar {...props} />, host); });
const bar = ()=>host.querySelector('[data-chat-status-bar]');

describe('ChatStatusBar', ()=>{
	it('标签表覆盖全部预设名与审批档(缺一即上屏裸键)', ()=>{
		Object.keys(CONTEXT_POLICY_PRESETS).concat(['custom']).forEach((k)=>expect(PRESET_LABELS[k]).toBeTruthy());
		AGENT_APPROVAL_MODES.forEach((k)=>expect(APPROVAL_LABELS[k]).toBeTruthy());
		expect(fmtCost(null)).toBe('—');
		expect(fmtCost(0.0042)).toBe('$0.0042');
		expect(fmtCost(1.234)).toBe('$1.23');
	});
	it('数字上屏 + data-* 机读;行动关/审批档两态;命主芯片', ()=>{
		render({ model: 'deepseek-chat', agentEnabled: false, mount: { kept: 1200, raw: 1200, budget: 20000, clipped: 0, dropped: 0 }, session: { costUsd: 0.012, turns: 3 }, cachePct: 64, contextPct: 23, presetName: 'window', subjectTitle: '张三' });
		const b = bar();
		expect(b.getAttribute('data-model')).toBe('deepseek-chat');
		expect(b.getAttribute('data-approval')).toBe('off');
		expect(b.getAttribute('data-mount-state')).toBe('ok');
		expect(b.getAttribute('data-cache-pct')).toBe('64');
		expect(b.getAttribute('data-context-pct')).toBe('23');
		expect(b.getAttribute('data-preset')).toBe('window');
		expect(b.textContent).toContain('行动关');
		expect(b.textContent).toContain('挂载 1200 字 / 20000');
		expect(b.textContent).toContain('$0.01');
		expect(b.textContent).toContain('缓存 64%');
		expect(b.textContent).toContain('≈23%');
		expect(b.textContent).toContain('策略·窗口');
		expect(b.textContent).toContain('张三 ▸');
		render({ model: 'm', agentEnabled: true, approvalMode: 'read-only', session: {}, presetName: 'legacy' });
		expect(bar().getAttribute('data-approval')).toBe('read-only');
		expect(bar().textContent).toContain('审批·只读');
		expect(bar().textContent).toContain('本会话 —');
		expect(bar().textContent).toContain('命主 ▸');
	});
	it('🔴 超预算→over(红);裁剪/丢层→clipped(橙);上下文≥90 红 ≥70 橙', ()=>{
		render({ model: 'm', mount: { kept: 20000, raw: 26000, budget: 20000, clipped: 2, dropped: 0 }, session: {}, contextPct: 92 });
		expect(bar().getAttribute('data-mount-state')).toBe('over');
		expect(host.querySelector('[data-chip="mount"]').getAttribute('data-tone')).toBe('danger');
		expect(host.querySelector('[data-chip="context"]').getAttribute('data-tone')).toBe('danger');
		render({ model: 'm', mount: { kept: 18000, raw: 19000, budget: 20000, clipped: 1, dropped: 0 }, session: {}, contextPct: 75 });
		expect(bar().getAttribute('data-mount-state')).toBe('clipped');
		expect(host.querySelector('[data-chip="mount"]').getAttribute('data-tone')).toBe('warn');
		expect(host.querySelector('[data-chip="context"]').getAttribute('data-tone')).toBe('warn');
	});
	it('visible=false 渲染 null;点击挂载/命主芯片调回调', ()=>{
		render({ visible: false, model: 'm', session: {} });
		expect(bar()).toBe(null);
		const onOpenMount = jest.fn(); const onOpenSubject = jest.fn();
		render({ model: 'm', session: {}, onOpenMount, onOpenSubject });
		act(()=>{ host.querySelector('[data-chip="mount"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		act(()=>{ host.querySelector('[data-chip="subject"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		expect(onOpenMount).toHaveBeenCalledTimes(1);
		expect(onOpenSubject).toHaveBeenCalledTimes(1);
	});
	it('🔴 [2026-09-11] 压缩芯片:给了 onViewCompact → 文案「查看」且点击走 onViewCompact(不再直接取消);没给 → 退化为「取消」走 onUncompact', ()=>{
		const onViewCompact = jest.fn(); const onUncompact = jest.fn();
		render({ model: 'm', compact: { summary: '要点', coveredCount: 4 }, onViewCompact, onUncompact });
		const chip = host.querySelector('[data-chip="compact"]');
		expect(chip.textContent).toContain('已压缩 4 条 · 查看');
		act(()=>{ chip.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		expect(onViewCompact).toHaveBeenCalledTimes(1);
		expect(onUncompact).not.toHaveBeenCalled();
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		render({ model: 'm', compact: { summary: '要点', coveredCount: 4 }, onUncompact });
		const chip2 = host.querySelector('[data-chip="compact"]');
		expect(chip2.textContent).toContain('已压缩 4 条 · 取消');
		act(()=>{ chip2.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		expect(onUncompact).toHaveBeenCalledTimes(1);
	});
});
