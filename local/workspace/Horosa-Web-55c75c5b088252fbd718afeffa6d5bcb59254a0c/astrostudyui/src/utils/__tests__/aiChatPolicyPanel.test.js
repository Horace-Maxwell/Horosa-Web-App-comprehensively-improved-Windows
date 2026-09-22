// 对话上下文策略设置卡(A1a)合同:纯函数层表驱动 + 渲染判别向量「打开不写键,改动才写,恢复即清」。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { CHAT_CONTEXT_POLICY_KEY, CONTEXT_POLICY_PRESETS, DEFAULT_CONTEXT_POLICY, readContextPolicy, writeContextPolicy, historyTokenBudgetForModel } from '../aiChatHistory';
import { PRESET_OPTIONS, FIELD_SPECS, fieldValue, patchForField, presetPatch, budgetText, modelOfSelection } from '../aiChat/policyPanel';
import ChatContextPolicyPanel from '../../components/aianalysis/chat/ChatContextPolicyPanel';

beforeEach(()=>{ window.localStorage.clear(); });

describe('纯函数层', ()=>{
	it('预设选项 = CONTEXT_POLICY_PRESETS 键集;presetPatch 逐键等于预设;未知名 null', ()=>{
		expect(PRESET_OPTIONS.map((o)=>o.value)).toEqual(Object.keys(CONTEXT_POLICY_PRESETS));
		// [Q-290/PP-21②] 预设补丁不含 mountCharBudget(点预设不再清掉用户填的挂载字数预算)
		Object.keys(CONTEXT_POLICY_PRESETS).forEach((k)=>{ const { mountCharBudget, ...rest } = CONTEXT_POLICY_PRESETS[k]; expect(presetPatch(k)).toEqual(rest); expect(Object.prototype.hasOwnProperty.call(presetPatch(k), 'mountCharBudget')).toBe(false); });
		expect(presetPatch('nope')).toBe(null);
	});
	it('八档字段覆盖策略全部可写键(除嵌套父键),fieldValue 读嵌套/Infinity 原样', ()=>{
		const keys = FIELD_SPECS.map((f)=>f.key.split('.')[0]);
		Object.keys(DEFAULT_CONTEXT_POLICY).forEach((k)=>expect(keys).toContain(k));
		expect(fieldValue(DEFAULT_CONTEXT_POLICY, 'foldedResultMaxChars.read')).toBe(1200);
		expect(fieldValue(DEFAULT_CONTEXT_POLICY, 'historyImageKeep')).toBe(Infinity);
		expect(fieldValue(null, 'historyMode')).toBe('window');
	});
	it('patchForField:嵌套键保留同级;图片 null→Infinity;预算空→null;写入后经 normalize 钳制', ()=>{
		expect(patchForField(DEFAULT_CONTEXT_POLICY, 'foldedResultMaxChars.read', 800)).toEqual({ foldedResultMaxChars: { read: 800, additive: 600 } });
		expect(patchForField(DEFAULT_CONTEXT_POLICY, 'historyImageKeep', null)).toEqual({ historyImageKeep: Infinity });
		expect(patchForField(DEFAULT_CONTEXT_POLICY, 'historyTokenBudget', '')).toEqual({ historyTokenBudget: null });
		expect(patchForField(DEFAULT_CONTEXT_POLICY, 'historyMaxKeep', 12)).toEqual({ historyMaxKeep: 12 });
		const p = writeContextPolicy(patchForField(DEFAULT_CONTEXT_POLICY, 'historyMaxKeep', 99999));
		expect(p.historyMaxKeep).toBe(400);
	});
	it('budgetText:不裁模式一句话;缺省(窗口)给自动预算;固定预算优先;modelOfSelection 取 :: 之后', ()=>{
		expect(budgetText({ ...DEFAULT_CONTEXT_POLICY, historyMode: 'legacy' }, 'deepseek-chat')).toContain('不裁');
		expect(budgetText(DEFAULT_CONTEXT_POLICY, 'deepseek-chat')).toContain('≈');
		expect(budgetText({ ...DEFAULT_CONTEXT_POLICY, historyMode: 'window', historyTokenBudget: 5000 }, 'x')).toContain('5000');
		const auto = budgetText({ ...DEFAULT_CONTEXT_POLICY, historyMode: 'window' }, 'deepseek-chat');
		expect(auto).toContain(`≈${historyTokenBudgetForModel('deepseek-chat')} token`);
		expect(modelOfSelection('l5-openai::mock-model')).toBe('mock-model');
		expect(modelOfSelection('bare')).toBe('bare');
	});
});

describe('渲染判别向量', ()=>{
	let host;
	beforeEach(()=>{ host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });

	it('🔴 打开设置卡不写键;点「不裁」才写;改细项=自定义;恢复现状清键回缺省(窗口)', ()=>{
		act(()=>{ ReactDOM.render(<ChatContextPolicyPanel model="deepseek-chat" />, host); });
		expect(window.localStorage.getItem(CHAT_CONTEXT_POLICY_KEY)).toBe(null);
		const panel = host.querySelector('[data-chat-context-policy-panel]');
		expect(panel.getAttribute('data-preset')).toBe('window');   // 缺省=窗口
		expect(host.querySelector('[data-policy-budget]').textContent).toContain('≈');
		// [D8] 缺省(键不存在)时「恢复现状」无可恢复 → 禁用;状态标「缺省·窗口」
		const restoreBtn = ()=>Array.from(host.querySelectorAll('button')).find((b)=>b.textContent.indexOf('恢复现状') >= 0);
		expect(restoreBtn().disabled).toBe(true);
		expect(host.textContent).toContain('缺省·窗口');
		const radios = Array.from(host.querySelectorAll('input[type="radio"]'));
		const legacy = radios.find((r)=>r.value === 'legacy');
		act(()=>{ legacy.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		expect(readContextPolicy().historyMode).toBe('legacy');
		// [D8] 不裁档已写键 → 可恢复(修前按 preset==='legacy' 禁用 = 反了)
		expect(restoreBtn().disabled).toBe(false);
		expect(host.textContent).not.toContain('缺省·');
		expect(host.querySelector('[data-chat-context-policy-panel]').getAttribute('data-preset')).toBe('legacy');
		expect(host.querySelector('[data-policy-budget]').textContent).toContain('不裁');
		act(()=>{ writeContextPolicy({ historyMaxKeep: 7 }); });   // 细项改动(经同一写入方)→ 自定义
		expect(host.querySelector('[data-chat-context-policy-panel]').getAttribute('data-preset')).toBe('custom');
		const restore = Array.from(host.querySelectorAll('button')).find((b)=>b.textContent.indexOf('恢复现状') >= 0);
		act(()=>{ restore.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		expect(window.localStorage.getItem(CHAT_CONTEXT_POLICY_KEY)).toBe(null);
		expect(host.querySelector('[data-chat-context-policy-panel]').getAttribute('data-preset')).toBe('window');
		expect(restoreBtn().disabled).toBe(true);
		// 用户先点「不裁」再点「窗口」(与缺省同值但键已写)→ 仍可恢复(点已选中的单选是空操作,须经另一档切回)
		act(()=>{ legacy.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		const win = radios.find((r)=>r.value === 'window');
		act(()=>{ win.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		expect(readContextPolicy().historyMode).toBe('window');
		expect(window.localStorage.getItem(CHAT_CONTEXT_POLICY_KEY)).not.toBe(null);
		expect(restoreBtn().disabled).toBe(false);
	});
});

// ---- [进阶审计 D5] 细项档数由 FIELD_SPECS.length 派生:注释/手册写死「八档」曾与十档面板漂移 ----
describe('[D5] 细项档数单源', ()=>{
	it('🔴 FIELD_SPECS 现为十一档;面板标题按长度计数为「十一档」;纯函数层源码不再写死「八档」', ()=>{
		const fs = require('fs'); const path = require('path');
		expect(FIELD_SPECS.length).toBe(11);   // [#80] +挂载字数预算
		const src = fs.readFileSync(path.join(__dirname, '../aiChat/policyPanel.js'), 'utf8');
		expect(src.indexOf('八档')).toBe(-1);
		const host = document.createElement('div'); document.body.appendChild(host);
		act(()=>{ ReactDOM.render(<ChatContextPolicyPanel model="deepseek-chat" />, host); });
		expect(host.textContent).toContain('细项(十一档');
		act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove();
	});
});

it('🔴 [AR-33] 细项帮助按字段写明适用模式:历史裁剪不再笼统说「下面的」都只在窗口模式生效;挂载字数预算注明两模式都生效;保留图片数注明只在按预算裁生效', ()=>{
	const { FIELD_SPECS } = require('../aiChat/policyPanel');
	const spec = (k)=>FIELD_SPECS.find((f)=>f.key === k);
	expect(spec('historyMode').help).not.toContain('下面的');
	expect(spec('historyMode').help).toContain('两种模式都生效');
	expect(spec('mountCharBudget').help).toContain('两种历史裁剪模式都生效');
	expect(spec('historyImageKeep').help).toContain('只在「按预算裁」模式生效');
});
