// [批二⑧] /compact <指令> + 阈值提醒合同:空指令=与固定规则逐字相同;指令去多余空白并截 300;阈值偏好归一/读写/事件;状态栏芯片 data-suggest-compact 与两回调;策略卡数值框打开不写键。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { buildCompactSystem, COMPACT_SYSTEM, COMPACT_INSTRUCTION_MAX, shouldSuggestCompact } from '../aiChat/compact';
import { readCompactAutoTokens, writeCompactAutoTokens, normalizeCompactAutoTokens, UI_PREFS_CHANGED_EVENT, COMPACT_AUTO_TOKENS_MIN, COMPACT_AUTO_TOKENS_MAX } from '../aiChat/compactPrefs';
import { loadUiPrefs, saveUiPrefs } from '../aiAnalysisStore';
import ChatStatusBar from '../../components/aianalysis/chat/ChatStatusBar';
import ChatContextPolicyPanel from '../../components/aianalysis/chat/ChatContextPolicyPanel';

beforeEach(()=>{ window.localStorage.clear(); });

it('buildCompactSystem:空=逐字 COMPACT_SYSTEM;有指令=追加一行并截 300;换行折成空格', ()=>{
	expect(buildCompactSystem('')).toBe(COMPACT_SYSTEM);
	expect(buildCompactSystem(undefined)).toBe(COMPACT_SYSTEM);
	expect(buildCompactSystem('   ')).toBe(COMPACT_SYSTEM);
	const s = buildCompactSystem('只保留\n事业相关的结论');
	expect(s.startsWith(COMPACT_SYSTEM)).toBe(true);
	expect(s.split('\n').pop()).toBe('用户对这次压缩的附加要求(优先满足,但不得违背上面的保留清单):只保留 事业相关的结论');
	const long = buildCompactSystem('甲'.repeat(COMPACT_INSTRUCTION_MAX + 50));
	expect(long.split('\n').pop().length).toBe('用户对这次压缩的附加要求(优先满足,但不得违背上面的保留清单):'.length + COMPACT_INSTRUCTION_MAX);
});

it('阈值偏好:缺省 null;归一夹在 [MIN,MAX];写入嵌套 uiPrefs 不碰同级键;清空删键;派发变更事件', ()=>{
	expect(readCompactAutoTokens()).toBe(null);
	expect(normalizeCompactAutoTokens('abc')).toBe(null);
	expect(normalizeCompactAutoTokens(0)).toBe(null);
	expect(normalizeCompactAutoTokens(1)).toBe(COMPACT_AUTO_TOKENS_MIN);
	expect(normalizeCompactAutoTokens(1e9)).toBe(COMPACT_AUTO_TOKENS_MAX);
	saveUiPrefs({ chatAssist: { statusBar: false }, other: 1 });
	const seen = [];
	const on = (e)=>seen.push(e.detail);
	window.addEventListener(UI_PREFS_CHANGED_EVENT, on);
	expect(writeCompactAutoTokens(8000)).toBe(8000);
	expect(readCompactAutoTokens()).toBe(8000);
	expect(loadUiPrefs().chatAssist).toEqual({ statusBar: false, compactAutoTokens: 8000 });
	expect(loadUiPrefs().other).toBe(1);
	expect(writeCompactAutoTokens(null)).toBe(null);
	expect(loadUiPrefs().chatAssist).toEqual({ statusBar: false });
	window.removeEventListener(UI_PREFS_CHANGED_EVENT, on);
	expect(seen).toEqual([{ key: 'chatAssist.compactAutoTokens', value: 8000 }, { key: 'chatAssist.compactAutoTokens', value: null }]);
	expect(shouldSuggestCompact({ historyTokens: 8001, threshold: 8000 })).toBe(true);
});

describe('渲染', ()=>{
	let host;
	beforeEach(()=>{ host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });
	it('状态栏:无 suggestCompact 零新节点;有则出芯片 data-suggest-compact 且点击走两回调', ()=>{
		act(()=>{ ReactDOM.render(<ChatStatusBar model="m" session={{}} />, host); });
		expect(host.querySelector('[data-suggest-compact]')).toBe(null);
		const calls = [];
		act(()=>{ ReactDOM.render(<ChatStatusBar model="m" session={{}} suggestCompact={{ tokens: 9000, threshold: 8000, onRun: ()=>calls.push('run'), onDismiss: ()=>calls.push('dismiss') }} />, host); });
		const chip = host.querySelector('[data-suggest-compact="1"]');
		expect(chip).toBeTruthy();
		expect(chip.getAttribute('data-suggest-tokens')).toBe('9000');
		expect(chip.getAttribute('data-tone')).toBe('warn');
		act(()=>{ chip.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		act(()=>{ host.querySelector('[data-chip="suggest-compact-dismiss"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		expect(calls).toEqual(['run', 'dismiss']);
	});
	it('策略卡:阈值框在位、打开不写 uiPrefs;打开时读到已存值', ()=>{
		act(()=>{ ReactDOM.render(<ChatContextPolicyPanel model="deepseek-chat" />, host); });
		const box = host.querySelector('[data-policy-field="compactAutoTokens"]');
		expect(box).toBeTruthy();
		expect(loadUiPrefs().chatAssist).toBe(undefined);
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		writeCompactAutoTokens(12000);
		act(()=>{ ReactDOM.render(<ChatContextPolicyPanel model="deepseek-chat" />, host); });
		const input = host.querySelector('[data-policy-field="compactAutoTokens"] input') || host.querySelector('input[data-policy-field="compactAutoTokens"]');
		expect(input && `${input.value}`.replace(/,/g, '')).toBe('12000');
	});
});
