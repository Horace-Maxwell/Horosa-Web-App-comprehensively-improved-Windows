// 本轮请求(命令 / 技能显式传参)合同:形状规整;技能技法只作用本轮;命令芯片与「保留为挂载」;编辑过正文的命令轮去掉芯片;
// 参数补全(年份 / 另一张命盘 / 择日子技法 / 模型方案 / 命令名;可选参数先打字才列,必填参数空着就列)与命令面板键位。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { normalizeTurnRequest, turnTechniqueKeysFor, turnCommandText, sameTechniqueSet, TURN_TECHNIQUE_MAX } from '../aiChat/turnRequest';
import { listCommandArgItems, findCommand } from '../aiChat/commands';
import { buildEditBranchMessages } from '../aiConversationBranch';
import ComposerAssist from '../../components/aianalysis/chat/ComposerAssist';
import UserTurnBody from '../../components/aianalysis/chat/UserTurnBody';

let host;
beforeEach(()=>{ host = document.createElement('div'); document.body.appendChild(host); });
afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });
function key(el, k, extra){ const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...(extra || {}) }); el.dispatchEvent(e); return e; }

describe('本轮请求形状', ()=>{
	test('规整:空 / 非对象 = null;命令名必填;技法去重封顶;对方 id 去空白', ()=>{
		expect(normalizeTurnRequest(null)).toBe(null);
		expect(normalizeTurnRequest([])).toBe(null);
		expect(normalizeTurnRequest({ command: { name: '' }, techniqueKeys: [] })).toBe(null);
		expect(normalizeTurnRequest({ command: { name: '流年', argsText: ' 2027 ' } })).toEqual({ command: { name: '流年', label: '流年', argsText: '2027' } });
		const many = Array.from({ length: 20 }).map((_, i)=>`k${i}`);
		expect(normalizeTurnRequest({ techniqueKeys: ['bazi', 'bazi', ' ziwei ', ...many] }).techniqueKeys.length).toBe(TURN_TECHNIQUE_MAX);
		expect(normalizeTurnRequest({ partnerSourceId: ' local-2 ' })).toEqual({ partnerSourceId: 'local-2' });
	});
	test('本轮技法:给了就用本轮的(按可挂集过滤、保持顺序),没给 = 会话挂载;命令文字;同一组判定顺序无关', ()=>{
		expect(turnTechniqueKeysFor(null, ['astrochart'], null)).toEqual({ keys: ['astrochart'], turnOnly: false });
		expect(turnTechniqueKeysFor({ techniqueKeys: ['ziwei', 'bazi', 'liureng'] }, ['astrochart'], ['bazi', 'ziwei', 'astrochart'])).toEqual({ keys: ['ziwei', 'bazi'], turnOnly: true });
		expect(turnCommandText({ command: { name: '流年', label: '流年', argsText: '2027' } })).toBe('流年 2027');
		expect(turnCommandText({ techniqueKeys: ['bazi'] })).toBe('');
		expect(sameTechniqueSet(['bazi', 'ziwei'], ['ziwei', 'bazi'])).toBe(true);
		expect(sameTechniqueSet(['bazi'], ['bazi', 'ziwei'])).toBe(false);
	});
	test('编辑过正文的命令轮去掉命令芯片、保留本轮技法;正文没改 / 没有本轮请求 = 形状不变', ()=>{
		const user = { id: 'u1', role: 'user', content: '请结合八字……', turn: { command: { name: '流年', label: '流年', argsText: '2027' }, techniqueKeys: ['bazi', 'ziwei'] } };
		const edited = buildEditBranchMessages([user], 0, user, '改过的问题', 'b1').pop();
		expect(edited.turn).toEqual({ techniqueKeys: ['bazi', 'ziwei'] });
		const same = buildEditBranchMessages([user], 0, user, user.content, 'b1').pop();
		expect(same.turn).toEqual(user.turn);
		const plain = buildEditBranchMessages([{ id: 'u2', role: 'user', content: 'x' }], 0, { id: 'u2', role: 'user', content: 'x' }, 'y', 'b1').pop();
		expect(Object.prototype.hasOwnProperty.call(plain, 'turn')).toBe(false);
	});
});

describe('命令气泡', ()=>{
	test('芯片 + 本轮技法;与会话挂载不同才给「保留为挂载」;全文可展开', ()=>{
		const onKeep = jest.fn();
		const item = { id: 'u1', role: 'user', content: '完整模板正文', turn: { command: { name: '流年', label: '流年', argsText: '2027' }, techniqueKeys: ['bazi', 'ziwei'] } };
		act(()=>{ ReactDOM.render(<UserTurnBody item={item} labelOf={(k)=>({ bazi: '八字', ziwei: '紫微斗数' }[k])} sessionKeys={['astrochart']} onKeep={onKeep} />, host); });
		expect(host.querySelector('[data-turn-command]').textContent).toBe('/流年 2027');
		expect(host.textContent).toContain('本轮按 八字 + 紫微斗数');
		expect(host.querySelector('[data-turn-full]')).toBe(null);
		act(()=>{ host.querySelector('[data-turn-expand]').click(); });
		expect(host.querySelector('[data-turn-full]').textContent).toBe('完整模板正文');
		act(()=>{ host.querySelector('[data-turn-keep]').click(); });
		expect(onKeep).toHaveBeenCalledWith(['bazi', 'ziwei']);
		act(()=>{ ReactDOM.render(<UserTurnBody item={item} labelOf={(k)=>k} sessionKeys={['ziwei', 'bazi']} onKeep={onKeep} />, host); });
		expect(host.querySelector('[data-turn-keep]')).toBe(null);
	});
});

describe('参数补全候选', ()=>{
	const now = new Date(2026, 5, 1);
	const zhang = { id: 'local-0001', sourceType: 'chart', title: '张三', record: { birth: '1990-05-18 10:00:00' } };
	const li = { id: 'local-0002', sourceType: 'chart', title: '李四', record: { birth: '1992-03-07 08:30:00' } };
	const liDup = { id: 'local-0003', sourceType: 'chart', title: '李四', record: { birth: '1993-01-01 00:00:00' } };
	const wang = { id: 'local-0004', sourceType: 'chart', title: '王五', record: {} };
	const kase = { id: 'local-0005', sourceType: 'case', title: '李家搬迁', record: {} };
	test('可选参数(/流年)先打字才列;必填参数(/合盘)空着就列', ()=>{
		expect(listCommandArgItems({ cmd: findCommand('流年'), argsText: '', ctx: { now } }).items).toEqual([]);
		expect(listCommandArgItems({ cmd: findCommand('流年'), argsText: '20', ctx: { now } }).items.map((x)=>x.value)).toEqual(['2026', '2027', '2028', '2025']);
		expect(listCommandArgItems({ cmd: findCommand('流年'), argsText: '明', ctx: { now } }).items).toEqual([{ value: '2027', label: '2027', hint: '明年' }]);
		expect(listCommandArgItems({ cmd: findCommand('流年'), argsText: '2031', ctx: { now } }).items[0].value).toBe('2031');
		expect(listCommandArgItems({ cmd: findCommand('合盘'), argsText: '', ctx: { sources: [zhang, li, wang, kase], activeSource: zhang } }).items.map((x)=>x.label)).toEqual(['李四', '王五']);
		expect(listCommandArgItems({ cmd: findCommand('简报'), argsText: 'x', ctx: {} }).items).toEqual([]);
	});
	test('另一张命盘:不含当前这张与事盘;同名带尾号用 @ 标记精确指定;已挂的对方排第一;参数里已有 @ 标记 → 交给 @ 菜单', ()=>{
		const r = listCommandArgItems({ cmd: findCommand('合盘'), argsText: '李', ctx: { sources: [zhang, li, liDup, kase], activeSource: zhang, partnerSource: liDup } });
		expect(r.items.map((x)=>x.value)).toEqual(['@[命盘:李四#0003]', '@[命盘:李四#0002]']);
		expect(r.items[0].hint).toContain('已挂的合盘对方');
		expect(listCommandArgItems({ cmd: findCommand('合盘'), argsText: '@[命盘:李', ctx: { sources: [zhang, li] } }).items).toEqual([]);
	});
	test('择日子技法 / 模型方案 / 命令名', ()=>{
		expect(listCommandArgItems({ cmd: findCommand('择日'), argsText: '奇', ctx: {} }).items.map((x)=>x.value)).toEqual(['奇门']);
		expect(listCommandArgItems({ cmd: findCommand('profile'), argsText: '省', ctx: { profiles: ['省钱', '强力'] } }).items.map((x)=>x.value)).toEqual(['省钱']);
		expect(listCommandArgItems({ cmd: findCommand('help'), argsText: '合', ctx: {} }).items.map((x)=>x.value)).toEqual(['合盘']);
	});
});

describe('命令面板参数菜单键位', ()=>{
	function mount(prompt, setPrompt, onRun, argItems){
		act(()=>{ ReactDOM.render(<div><ComposerAssist prompt={prompt} setPrompt={setPrompt} items={[]} onRun={onRun} argItems={argItems} /><textarea defaultValue={prompt} /></div>, host); });
		const ta = host.querySelector('textarea');
		ta.setSelectionRange(prompt.length, prompt.length);
		act(()=>{ ta.dispatchEvent(new Event('keyup', { bubbles: true })); });
		return ta;
	}
	const items = [{ value: '李四', label: '李四', hint: '1992-03-07' }, { value: '王五', label: '王五', hint: '' }];
	test('↓ 移动、Enter 填入高亮候选(不执行);参数已是候选值时 Enter 执行;Esc 关掉后同一段文字不再弹', ()=>{
		const setPrompt = jest.fn(); const onRun = jest.fn();
		const argItems = jest.fn((t)=>({ cmd: { name: '合盘' }, items, prefix: '/合盘 ', argsText: t.slice(4) }));
		const ta = mount('/合盘 ', setPrompt, onRun, argItems);
		expect(host.querySelector('[data-composer-assist]').getAttribute('data-composer-assist')).toBe('args');
		expect(host.querySelector('[data-command-arg-of]').getAttribute('data-command-arg-of')).toBe('合盘');
		key(ta, 'ArrowDown');
		expect(host.querySelectorAll('[data-command-arg]')[1].getAttribute('aria-selected')).toBe('true');
		const enter = key(ta, 'Enter');
		expect(enter.defaultPrevented).toBe(true);
		expect(setPrompt).toHaveBeenCalledWith('/合盘 王五');
		expect(onRun).not.toHaveBeenCalled();
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		const ta2 = mount('/合盘 李四', setPrompt, onRun, argItems);
		key(ta2, 'Enter');
		expect(onRun).toHaveBeenCalledWith('/合盘 李四');
		const esc = key(ta2, 'Escape');
		expect(esc.defaultPrevented).toBe(true);
		expect(host.querySelector('[data-composer-assist]').getAttribute('data-composer-assist')).toBe('idle');
	});
	test('没有参数候选 / 不是命令 → 不弹(页面照常)', ()=>{
		const setPrompt = jest.fn(); const onRun = jest.fn();
		mount('/流年 ', setPrompt, onRun, ()=>null);
		expect(host.querySelector('[data-composer-assist]').getAttribute('data-composer-assist')).toBe('idle');
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		const argItems = jest.fn(()=>({ cmd: { name: 'x' }, items, prefix: '', argsText: '' }));
		mount('今年运势', setPrompt, onRun, argItems);
		expect(argItems).not.toHaveBeenCalled();
	});
});
