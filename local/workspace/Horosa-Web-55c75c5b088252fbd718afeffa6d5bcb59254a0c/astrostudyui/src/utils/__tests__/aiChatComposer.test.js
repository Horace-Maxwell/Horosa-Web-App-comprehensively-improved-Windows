// 命令面板与执行(A3)合同:ComposerAssist 用 capture 阶段原生 keydown 拦 ↑↓/Enter/Tab/Esc(菜单开时)与 Enter(输入是完整命令时),IME 组合期不拦,非命令不拦;
// useChatAssist.interceptSend:命令 → 执行并吞掉发送(handleSend 收到渲染后的模板与口径指令);非命令 → false;/goal 门未开只提示;/合盘 找对方并带合盘数据。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import ComposerAssist from '../../components/aianalysis/chat/ComposerAssist';
import { useChatAssist } from '../../components/aianalysis/chat/useChatAssist';
import { listCommandItems } from '../aiChat/commands';
import { setAgentEnabled, setGoalEnabled } from '../aiAgent/prefs';
import { writePersona } from '../aiChat/persona';

jest.mock('../aiAnalysisContext', ()=>({ ...jest.requireActual('../aiAnalysisContext'), buildRelativeSnapshotForRecords: jest.fn(async ()=>'【两盘】张三×李四 合盘快照') }));
jest.mock('../aiAgent/goalRunner', ()=>({ createGoalTask: jest.fn(async ({ goal })=>({ id: 't1', title: goal })) }));
const { createGoalTask } = require('../aiAgent/goalRunner');

const chart = { id: 'local-1', sourceType: 'chart', title: '张三', record: { name: '张三' } };
const other = { id: 'local-2', sourceType: 'chart', title: '李四', record: { name: '李四' } };
const flush = ()=>new Promise((r)=>setTimeout(r, 15));
let host;
beforeEach(()=>{ window.localStorage.clear(); host = document.createElement('div'); document.body.appendChild(host); });
afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });

function key(el, k, extra){ const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...(extra || {}) }); el.dispatchEvent(e); return e; }

describe('ComposerAssist 键盘', ()=>{
	function mount(prompt, setPrompt, onRun){
		const items = listCommandItems({ prefix: prompt.startsWith('/') ? prompt.slice(1).trim() : '', ctx: { activeSource: chart } });
		act(()=>{ ReactDOM.render(<div><ComposerAssist prompt={prompt} setPrompt={setPrompt} items={items} onRun={onRun} /><textarea /></div>, host); });
		return host.querySelector('textarea');
	}
	it('🔴 菜单开:↓ 移动高亮、Enter 选中带参命令 → setPrompt("/流年 ")、Esc 清空;IME 组合期不拦;菜单项 data-available 标注', ()=>{
		const setPrompt = jest.fn(); const onRun = jest.fn();
		const ta = mount('/', setPrompt, onRun);
		expect(host.querySelector('[data-composer-assist]').getAttribute('data-composer-assist')).toBe('menu');
		const first = host.querySelector('[role="option"]');
		expect(first.getAttribute('data-command-item')).toBe('流年');
		expect(first.getAttribute('data-available')).toBe('1');
		// [2026-09-11] 分组小标题 + 脚注(条数 = 全部内置命令)
		expect([...host.querySelectorAll('[data-command-group]')].map((x)=>x.getAttribute('data-command-group'))).toEqual(['盘面与分析', '会话', '模型与协作']);
		expect(host.querySelector('[data-command-foot]').textContent).toContain(`共 ${listCommandItems({ ctx: { activeSource: chart } }).length} 条`);
		expect(host.querySelector('[role="listbox"]').getAttribute('data-command-count')).toBe(`${listCommandItems({ ctx: { activeSource: chart } }).length}`);
		const down = key(ta, 'ArrowDown');
		expect(down.defaultPrevented).toBe(true);
		const opts = host.querySelectorAll('[role="option"]');
		expect(opts[1].getAttribute('aria-selected')).toBe('true');
		key(ta, 'ArrowUp');
		expect(host.querySelectorAll('[role="option"]')[0].getAttribute('aria-selected')).toBe('true');
		const enter = key(ta, 'Enter');
		expect(enter.defaultPrevented).toBe(true);
		expect(setPrompt).toHaveBeenCalledWith('/流年 ');
		expect(onRun).not.toHaveBeenCalled();
		const ime = key(ta, 'Enter', { isComposing: true });
		expect(ime.defaultPrevented).toBe(false);
		const esc = key(ta, 'Escape');
		expect(esc.defaultPrevented).toBe(true);
		expect(setPrompt).toHaveBeenCalledWith('');
		// 带前缀:不分组、按命中质量排,Enter 落在第一行(resume 无 argsHint → 直接 onRun)
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		const ta3 = mount('/re', setPrompt, onRun);
		expect(host.querySelectorAll('[data-command-group]').length).toBe(0);
		expect(host.querySelector('[data-composer-assist="menu"]').style.getPropertyValue('--horosa-scroll-safe-bottom')).toBe('4px');
		expect(host.querySelector('[role="option"]').getAttribute('data-command-item')).toBe('resume');
		key(ta3, 'Enter');
		expect(onRun).toHaveBeenCalledWith('/resume');
	});
	it('🔴 菜单关(输入是完整命令):Enter → onRun(整句) 且不发送;Shift+Enter 不拦;非命令文本 Enter 不拦(页面照常)', ()=>{
		const setPrompt = jest.fn(); const onRun = jest.fn();
		const ta = mount('/流年 2027', setPrompt, onRun);
		expect(host.querySelector('[data-composer-assist]').getAttribute('data-composer-assist')).toBe('idle');
		const enter = key(ta, 'Enter');
		expect(enter.defaultPrevented).toBe(true);
		expect(onRun).toHaveBeenCalledWith('/流年 2027');
		expect(key(ta, 'Enter', { shiftKey: true }).defaultPrevented).toBe(false);
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		const ta2 = mount('今年运势如何', setPrompt, onRun);
		expect(key(ta2, 'Enter').defaultPrevented).toBe(false);
	});
});

describe('ComposerAssist @引用', ()=>{
	it('🔴 光标处 @查询 → 候选菜单;↓ 选第二项;Enter 插入 @[命盘:…] 标记并把光标放到标记后;Esc 关闭;非 @ 不开', ()=>{
		const setPrompt = jest.fn();
		const pool = [{ kind: 'source', type: 'chart', id: 'local-1', name: '张三', suffix: '', label: '张三', group: '命盘' }, { kind: 'source', type: 'chart', id: 'local-2', name: '张三丰', suffix: '', label: '张三丰', group: '命盘' }, { kind: 'technique', type: 'technique', id: 'sixyao', key: 'sixyao', name: '六爻张', suffix: '', label: '六爻张', group: '技法', available: false, why: '需事盘案例' }];
		// mentionItems 可返回 { items, hiddenCount, total }(脚注用)
		const mentionItems = jest.fn((q)=>{ const items = pool.filter((x)=>x.name.indexOf(q) >= 0); return { items, hiddenCount: 5, total: items.length + 5 }; });
		act(()=>{ ReactDOM.render(<div><ComposerAssist prompt="看看 @张" setPrompt={setPrompt} items={[]} onRun={()=>{}} mentionItems={mentionItems} /><textarea defaultValue="看看 @张" /></div>, host); });
		const ta = host.querySelector('textarea');
		ta.setSelectionRange(5, 5);
		act(()=>{ ta.dispatchEvent(new Event('keyup', { bubbles: true })); });
		expect(host.querySelector('[data-composer-assist]').getAttribute('data-composer-assist')).toBe('mention');
		// [2026-09-12 复查三] 菜单宿主把页级滚动安全区变量压到 4px(AI 页全局规则给 inline overflow-y:auto 的元素加 82px 底衬,弹出菜单不该吃)
		expect(host.querySelector('[data-composer-assist]').style.getPropertyValue('--horosa-scroll-safe-bottom')).toBe('4px');
		expect(host.querySelectorAll('[data-mention-item]').length).toBe(3);
		expect([...host.querySelectorAll('[data-mention-group]')].map((x)=>x.getAttribute('data-mention-group'))).toEqual(['命盘', '技法']);
		expect(host.querySelector('[data-mention-item="sixyao"]').getAttribute('data-available')).toBe('0');
		expect(host.querySelector('[data-mention-item="sixyao"]').textContent).toContain('需事盘案例');
		expect(host.querySelector('[data-mention-item="local-1"]').getAttribute('data-available')).toBe('1');
		expect(host.querySelector('[data-mention-foot]').textContent).toContain('还有 5 条未显示,再多打几个字筛选');   // 带关键字:未显示的是命中总数超上限的部分,不再说「命盘 / 资料等」
		expect(host.querySelector('[data-mention-foot]').textContent).toContain('技法可搜中文');   // 带关键字:列表是筛过的,不说「已全部列出」
		expect(host.querySelector('[data-mention-foot]').textContent).toContain('灰色 = 当前案例不适用');
		key(ta, 'ArrowDown');
		expect(host.querySelectorAll('[role="option"]')[1].getAttribute('aria-selected')).toBe('true');
		const enter = key(ta, 'Enter');
		expect(enter.defaultPrevented).toBe(true);
		expect(setPrompt).toHaveBeenCalledWith('看看 @[命盘:张三丰] ');
		const esc = key(ta, 'Escape');
		expect(esc.defaultPrevented).toBe(true);
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		act(()=>{ ReactDOM.render(<div><ComposerAssist prompt="mail a@b" setPrompt={setPrompt} items={[]} onRun={()=>{}} mentionItems={mentionItems} /><textarea defaultValue="mail a@b" /></div>, host); });
		const ta2 = host.querySelector('textarea'); ta2.setSelectionRange(8, 8);
		act(()=>{ ta2.dispatchEvent(new Event('keyup', { bubbles: true })); });
		expect(host.querySelector('[data-composer-assist]').getAttribute('data-composer-assist')).toBe('idle');
	});
	it('🔴 [2026-09-12 复查] 带关键字时默认高亮落在 bestIndex(最佳命中),Enter 插入它而不是第一组的包含命中', ()=>{
		const setPrompt = jest.fn();
		const items = [{ kind: 'source', type: 'chart', id: 'local-9', name: '李八字', suffix: '', label: '李八字', group: '命盘', groupRank: 0 }, { kind: 'technique', type: 'technique', id: 'bazi', key: 'bazi', name: '八字', suffix: '', label: '八字', group: '技法', groupRank: 10, available: true }];
		const mentionItems = jest.fn(()=>({ items, hiddenCount: 0, total: 2, bestIndex: 1 }));
		act(()=>{ ReactDOM.render(<div><ComposerAssist prompt="@八字" setPrompt={setPrompt} items={[]} onRun={()=>{}} mentionItems={mentionItems} /><textarea defaultValue="@八字" /></div>, host); });
		const ta = host.querySelector('textarea'); ta.setSelectionRange(3, 3);
		act(()=>{ ta.dispatchEvent(new Event('keyup', { bubbles: true })); });
		expect(host.querySelector('[data-mention-item="bazi"]').getAttribute('aria-selected')).toBe('true');
		expect(host.querySelector('[data-mention-item="local-9"]').getAttribute('aria-selected')).toBe('false');
		key(ta, 'Enter');
		expect(setPrompt).toHaveBeenCalledWith('@[技法:八字] ');
	});
});

describe('useChatAssist 命令执行', ()=>{
	let api = null;
	function Harness(props){ api = useChatAssist(props.deps); return null; }
	function mount(deps){ act(()=>{ ReactDOM.render(<Harness deps={deps} />, host); }); return api; }
	const baseDeps = ()=>({ prompt: '', setPrompt: jest.fn(), messages: [], bundles: [], sources: [chart, other], activeSource: chart, selectedTechniqueKeys: ['bazi'], setSelectedTechniqueKeys: jest.fn(), handleSend: jest.fn(async ()=>{}), applyBundle: jest.fn(), providerProfiles: [], modelSelection: 'p::m' });
	it('🔴 /流年 2027 → 吞掉发送;技法改为 bazi+ziwei;handleSend 收到含 2027 与命盘名的模板 + 口径指令;非命令 → false 不动', async ()=>{
		const deps = baseDeps();
		const a = mount(deps);
		expect(a.interceptSend('今年运势')).toBe(false);
		expect(a.interceptSend('/流年 2027')).toBe(true);
		await flush();
		expect(deps.setPrompt).toHaveBeenCalledWith('');
		expect(deps.setSelectedTechniqueKeys).toHaveBeenCalledWith(['bazi', 'ziwei']);
		expect(deps.handleSend).toHaveBeenCalledTimes(1);
		const [text, extra] = deps.handleSend.mock.calls[0];
		expect(text).toContain('2027');
		expect(text).toContain('张三');
		expect(extra).toContain('【输出格式】');
	});
	it('/合盘 李四 → 找到对方、带【合盘数据】进系统上下文;/合盘 无名 → 只提示不发;/goal 门未开 → 提示不建;门开 → createGoalTask', async ()=>{
		const deps = baseDeps();
		const a = mount(deps);
		expect(a.interceptSend('/合盘 李四')).toBe(true);
		await flush();
		expect(deps.handleSend).toHaveBeenCalledTimes(1);
		expect(deps.handleSend.mock.calls[0][0]).toContain('李四');
		expect(deps.handleSend.mock.calls[0][1]).toContain('【合盘数据】');
		expect(a.interceptSend('/合盘')).toBe(true);
		await flush();
		expect(deps.handleSend).toHaveBeenCalledTimes(1);
		expect(a.interceptSend('/goal 把三个人建档')).toBe(true);
		await flush();
		expect(createGoalTask).not.toHaveBeenCalled();
		setAgentEnabled(true); setGoalEnabled(true);
		expect(a.interceptSend('/goal 把三个人建档')).toBe(true);
		await flush();
		expect(createGoalTask).toHaveBeenCalledWith(expect.objectContaining({ goal: '把三个人建档', sourceCid: 'local-1', autoStart: true }));
		expect(deps.handleSend).toHaveBeenCalledTimes(1);
	});
	it('用户技能:触发词命中 → applyBundle + 技法 + 模板渲染;/编排 开关未开只提示(不发送);未知命令只提示;/择日 派发 horosa:navigate(带子页签)', async ()=>{
		const deps = baseDeps();
		deps.bundles = [{ id: 'b1', name: '事业', skill: { triggers: ['事业'], requires: 'chart', techniqueKeys: ['ziwei'], promptTemplate: '看{{source}}{{year}}年事业', argsSpec: [{ name: 'year', default: '今年' }] } }];
		const a = mount(deps);
		const seen = []; const onNav = (e)=>seen.push(e.detail); window.addEventListener('horosa:navigate', onNav);
		expect(a.interceptSend('/事业 2028')).toBe(true);
		await flush();
		expect(deps.applyBundle).toHaveBeenCalledWith(expect.objectContaining({ id: 'b1' }));
		expect(deps.setSelectedTechniqueKeys).toHaveBeenCalledWith(['ziwei']);
		expect(deps.handleSend.mock.calls[0][0]).toBe('看张三2028年事业');
		deps.setPrompt.mockClear();
		expect(a.interceptSend('/编排 问题')).toBe(true);
		await flush();
		expect(deps.handleSend).toHaveBeenCalledTimes(1);   // 子开关未开 → 只提示,不发送
		expect(deps.setPrompt).not.toHaveBeenCalledWith('');   // [2026-09-12 复查二] 开关门未开同样保留输入(此前先清空再判,「问题」白打)
		expect(a.interceptSend('/plan 把三个人建档')).toBe(true);
		await flush();
		expect(deps.setPrompt).not.toHaveBeenCalledWith('');
		deps.setPrompt.mockClear();
		expect(a.interceptSend('/nope')).toBe(true);
		await flush();
		expect(deps.setPrompt).not.toHaveBeenCalledWith('');   // 未知命令 / 前提不满足:输入保留(只提示)
		deps.activeSource = null;
		expect(a.interceptSend('/命主')).toBe(true);
		await flush();
		expect(deps.setPrompt).not.toHaveBeenCalledWith('');
		deps.activeSource = chart;
		expect(a.interceptSend('/择日 开业')).toBe(true);
		await flush();
		expect(deps.handleSend).toHaveBeenCalledTimes(1);
		expect(seen).toEqual([{ key: 'zeri', subTab: undefined, args: '开业' }]);
		// [2026-09-11] 参数=择日子技法 → subTab 直达(此前 args 只派发不消费)
		expect(a.interceptSend('/择日 奇门')).toBe(true);
		await flush();
		expect(seen[1]).toEqual({ key: 'zeri', subTab: 'qimenzeri', args: '奇门' });
		window.removeEventListener('horosa:navigate', onNav);
	});
	it('🔴 [2026-09-11] /合盘 @[命盘:李四] 的 @ 语法可用;/命主 打开命主工作区;/任务 派发 horosa:task-center', async ()=>{
		const deps = baseDeps();
		const a = mount(deps);
		expect(a.interceptSend('/合盘 @[命盘:李四] 看看')).toBe(true);
		await flush();
		expect(deps.handleSend).toHaveBeenCalledTimes(1);
		expect(deps.handleSend.mock.calls[0][0]).toContain('李四');
		expect(deps.handleSend.mock.calls[0][1]).toContain('【合盘数据】');
		expect(a.overlays.subject.open).toBe(false);
		expect(a.interceptSend('/命主')).toBe(true);
		await flush();
		expect(api.overlays.subject.open).toBe(true);
		const seen = []; const onTc = (e)=>seen.push(e.detail); window.addEventListener('horosa:task-center', onTc);
		expect(a.interceptSend('/任务')).toBe(true);
		await flush();
		expect(seen).toEqual([{ open: true }]);
		window.removeEventListener('horosa:task-center', onTc);
		expect(deps.handleSend).toHaveBeenCalledTimes(1);
	});
	it('🔴 @引用发送:@[命盘:李四] 切源、@[资料:…] 进参考、@[技法段:八字/四柱] 进技法+段过滤;正文去标记重发;filterTechniqueSections 只动选过段的技法', async ()=>{
		const deps = baseDeps();
		deps.sources = [chart, other];
		deps.materials = [{ id: 'm1', name: '名单.txt' }];
		deps.setSelectedSourceId = jest.fn(); deps.setReferenceIds = jest.fn(); deps.referenceIds = [];
		const a = mount(deps);
		expect(a.interceptSend('@[命盘:李四] @[资料:名单.txt] @[技法段:八字/四柱] 今年如何')).toBe(true);
		await flush();
		expect(deps.setSelectedSourceId).toHaveBeenCalledWith('local-2');
		expect(deps.setReferenceIds).toHaveBeenCalledWith(['material:m1']);
		expect(deps.setSelectedTechniqueKeys).toHaveBeenCalledWith(['bazi']);
		expect(deps.handleSend).toHaveBeenCalledWith('李四 名单.txt 八字/四柱 今年如何');
		const ctxs = [{ key: 'bazi', title: '八字', content: '【四柱】\n甲子\n\n【神煞】\n贵人' }, { key: 'ziwei', title: '紫微', content: '【命宫】\n紫微' }];
		const out = a.filterTechniqueSections(ctxs);
		expect(out[0].content).toContain('四柱');
		expect(out[0].content).not.toContain('神煞');
		expect(out[1]).toBe(ctxs[1]);
		expect(a.filterTechniqueSections([])).toEqual([]);
		expect(a.interceptSend('普通问题')).toBe(false);
	});
	it('🔴 [2026-09-12 复查] 同句「切源 + 技法」按切换后的源判可用性:命盘案例下 @[事盘:X] @[技法:六爻] 挂上六爻不提示;无源时 @[命盘:张三] @[技法:八字] 挂上八字', async ()=>{
		const kase = { id: 'local-3', sourceType: 'case', title: '搬家事盘', record: { name: '搬家事盘' } };
		const deps = baseDeps();
		deps.sources = [chart, other, kase]; deps.selectedTechniqueKeys = []; deps.setSelectedSourceId = jest.fn();
		const a = mount(deps);
		expect(a.interceptSend('@[事盘:搬家事盘] @[技法:六爻] 这事成不成')).toBe(true);
		await flush();
		expect(deps.setSelectedSourceId).toHaveBeenCalledWith('local-3');
		expect(deps.setSelectedTechniqueKeys).toHaveBeenCalledWith(['sixyao']);
		expect(deps.handleSend).toHaveBeenCalledWith('搬家事盘 六爻 这事成不成');
		deps.setSelectedTechniqueKeys.mockClear(); deps.setSelectedSourceId.mockClear();
		deps.activeSource = null;
		expect(a.interceptSend('@[命盘:张三] @[技法:八字] 看看')).toBe(true);
		await flush();
		expect(deps.setSelectedSourceId).toHaveBeenCalledWith('local-1');
		expect(deps.setSelectedTechniqueKeys).toHaveBeenCalledWith(['bazi']);
		// 反例仍成立:命盘案例下不切源直接 @[技法:六爻] → 不挂
		deps.setSelectedTechniqueKeys.mockClear(); deps.activeSource = chart;
		expect(a.interceptSend('@[技法:六爻] 看看')).toBe(true);
		await flush();
		expect(deps.setSelectedTechniqueKeys).not.toHaveBeenCalled();
	});
	it('🔴 [2026-09-12 复查] 技法段过滤:新对话首条发送建立会话(id \'\' → 新 id)不清过滤;从一个已有会话切到另一个才清', async ()=>{
		const deps = baseDeps();
		deps.activeConversationId = '';
		const a = mount(deps);
		expect(a.interceptSend('@[技法段:八字/四柱] 看看')).toBe(true);
		await flush();
		const ctxs = [{ key: 'bazi', title: '八字', content: '【四柱】\n甲子\n\n【神煞】\n贵人' }];
		expect(a.filterTechniqueSections(ctxs)[0].content).not.toContain('神煞');
		deps.activeConversationId = 'c1'; mount(deps);   // 发送中会话记录建立
		expect(api.filterTechniqueSections(ctxs)[0].content).not.toContain('神煞');
		deps.activeConversationId = 'c2'; mount(deps);   // 切到别的会话
		expect(api.filterTechniqueSections(ctxs)).toBe(ctxs);
	});
	it('🔴 口径/记忆层:缺省 promptLayerExtras 为空;口径启用后首层 persona(102);/init 无档案只提示不调模型;/compact 少于 4 条只提示', async ()=>{
		const deps = baseDeps();
		deps.providerProfiles = []; deps.modelSelection = '';
		const a = mount(deps);
		expect(a.promptLayerExtras()).toEqual([]);
		await act(async ()=>{ writePersona({ text: '先结论后依据', enabled: true }); await flush(); });
		const layers = a.promptLayerExtras();
		expect(layers.length).toBe(1);
		expect(layers[0].key).toBe('persona');
		expect(layers[0].priority).toBe(102);
		expect(layers[0].content).toBe('先结论后依据');
		expect(a.interceptSend('/init')).toBe(true);
		await flush();
		expect(deps.handleSend).not.toHaveBeenCalled();
		expect(a.interceptSend('/compact')).toBe(true);
		await flush();
		expect(deps.handleSend).not.toHaveBeenCalled();
	});
});
