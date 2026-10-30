// 斜杠命令参数合同:参数里的 @ 与正文 @ 同一个解析器(技能类去标记、问句类换回名字;没找到 / 对方不合法只提示不执行);
// /合盘 找人与 @ 同一套规则(精确同名优先);年份写法规整;/help 浮层;每条内置命令都有执行分支。
import React from 'react';
import ReactDOM from 'react-dom';
import fs from 'fs';
import path from 'path';
import { act } from 'react-dom/test-utils';
import { useChatAssist, COMMANDS_ALLOWED_WHILE_SENDING } from '../../components/aianalysis/chat/useChatAssist';
import ChatAssistOverlays from '../../components/aianalysis/chat/ChatAssistOverlays';
import { BUILTIN_COMMANDS } from '../aiChat/commands';
import { BUILTIN_SKILLS, normalizeYearArg, renderSkillPrompt, parseSkillArgs, normalizeArgsSpec } from '../aiChat/skills';
import { resolveMentions, resolveSourceByName } from '../aiChat/mentions';

jest.mock('../aiAgent/goalRunner', ()=>({ createGoalTask: jest.fn(async ({ goal })=>({ id: 't1', title: goal })) }));

const zhang = { id: 'local-1', sourceType: 'chart', title: '张三', record: { name: '张三', updatedAt: '2026-01-01T00:00:00Z' } };
const li = { id: 'local-2', sourceType: 'chart', title: '李四', record: { name: '李四', updatedAt: '2026-01-02T00:00:00Z' } };
const lisi4 = { id: 'local-3', sourceType: 'chart', title: '李四四', record: { name: '李四四', updatedAt: '2026-01-03T00:00:00Z' } };
const li5 = { id: 'local-4', sourceType: 'chart', title: '李五', record: { name: '李五', updatedAt: '2026-01-04T00:00:00Z' } };
// horosa_win_timer_granularity_v1(Windows 侧移植适配;建议上游化):Windows 缺省系统计时器粒度 ≈15.6ms ——
// 本机实测 Node setTimeout(0) 中位 15.5ms(macOS ≈1ms)。带 @ 的技能命令在 handleSend 前要走两拍 setTimeout(0)
// (useChatAssist:runCommand「让切源 / 对方 / 技法落地」+ runSkill「让切源 / 套组合落地」),合计 ≈31ms > 15ms。
// v3.13.0 起上游用下面的 settle() 等「应调用 / 应打开」类断言成立,正向用例的随机红已由上游根治;
// 剩下仍用 flush() 的全是「不应调用 / 恰调用一次」类断言 —— Windows 上 15ms 墙钟可能在产品侧那两拍跑完之前就断言,
// 断言因错误的原因通过。故保留原 15ms 墙钟等待再追加 3 拍宏任务(同时长定时器先进先出,每拍至少放行产品侧一拍
// setTimeout(0),与计时器粒度无关):macOS 上只多等约 3ms,反向断言只会更严,判据零放宽。
const flush = async ()=>{ await new Promise((r)=>setTimeout(r, 15)); for(let i = 0; i < 3; i++){ await new Promise((r)=>setTimeout(r, 0)); } };
// 等到条件成立(最多 2 秒):命令执行链里有几拍 setTimeout,全量并跑抢核时固定 15 ms 会等不到
const settle = async (pred, ms = 2000)=>{ const t0 = Date.now(); while(!pred() && Date.now() - t0 < ms){ await new Promise((r)=>setTimeout(r, 5)); } };
let host;
beforeEach(()=>{ window.localStorage.clear(); host = document.createElement('div'); document.body.appendChild(host); });
afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });

let api = null;
function Harness(props){ api = useChatAssist(props.deps); return null; }
function mount(deps){ act(()=>{ ReactDOM.render(<Harness deps={deps} />, host); }); return api; }
const baseDeps = (extra)=>({ prompt: '', setPrompt: jest.fn(), messages: [], bundles: [], sources: [zhang, li, lisi4, li5], activeSource: zhang, selectedTechniqueKeys: ['bazi'], setSelectedTechniqueKeys: jest.fn(), setSelectedSourceId: jest.fn(), setPartnerSourceId: jest.fn(), handleSend: jest.fn(async ()=>{}), applyBundle: jest.fn(), providerProfiles: [], modelSelection: 'p::m', ...(extra || {}) });

describe('年份参数规整', ()=>{
	const now = new Date(2026, 5, 1);
	test('数字 / 带「年」/ 中文数字 / 相对年 / 公元前;认不出原样', ()=>{
		expect(normalizeYearArg('2027', now)).toBe('2027');
		expect(normalizeYearArg('2027年', now)).toBe('2027');
		expect(normalizeYearArg(' 2027 年 ', now)).toBe('2027');
		expect(normalizeYearArg('二〇二七年', now)).toBe('2027');
		expect(normalizeYearArg('今年', now)).toBe('2026');
		expect(normalizeYearArg('明年', now)).toBe('2027');
		expect(normalizeYearArg('后年', now)).toBe('2028');
		expect(normalizeYearArg('去年', now)).toBe('2025');
		expect(normalizeYearArg('前年', now)).toBe('2024');
		expect(normalizeYearArg('前5年', now)).toBe('公元前5');
		expect(normalizeYearArg('属马那年', now)).toBe('属马那年');
		expect(normalizeYearArg('', now)).toBe('');
	});
	test('/流年 模板不再拼出「2027年 年」「后年 年」;参数类型随包保留、缺省 text 不写键', ()=>{
		const sk = BUILTIN_SKILLS.find((b)=>b.id === 'builtin:liunian').skill;
		const render = (argsText)=>renderSkillPrompt(sk, parseSkillArgs(sk.argsSpec, argsText), { activeSource: { title: '李四' } });
		expect(render('2027年')).toContain('李四在 2027 年的流年');
		expect(render('2027年')).not.toContain('2027年 年');
		expect(render('后年')).toContain(`在 ${new Date().getFullYear() + 2} 年`);
		expect(normalizeArgsSpec([{ name: 'year', type: 'year' }, { name: 'q', type: 'text' }, { name: 'x', type: 'bogus' }])).toEqual([
			{ name: 'year', label: 'year', default: '', type: 'year' }, { name: 'q', label: 'q', default: '' }, { name: 'x', label: 'x', default: '' },
		]);
	});
});

describe('找人单源(@ 与 /合盘 同一规则)', ()=>{
	test('精确同名优先;只有包含命中且多张 = 歧义且非精确;同名多张 = 取最近保存且标精确', ()=>{
		const r1 = resolveSourceByName([li, lisi4], '李四');
		expect(r1.hit).toBe(li); expect(r1.ambiguous).toBe(false); expect(r1.exact).toBe(true);
		const r2 = resolveSourceByName([li, li5], '李');
		expect(r2.ambiguous).toBe(true); expect(r2.exact).toBe(false); expect(r2.pool.map((x)=>x.title)).toEqual(['李四', '李五']);
		const dup = { ...li, id: 'local-9', record: { updatedAt: '2026-02-01T00:00:00Z' } };
		const r3 = resolveSourceByName([li, dup], '李四');
		expect(r3.hit).toBe(dup); expect(r3.ambiguous).toBe(true); expect(r3.exact).toBe(true);
		expect(resolveSourceByName([li], '王五').hit).toBe(null);
	});
	test('两盘命令参数里只有一张命盘 = 它是对方(不切当前案例);两张 = 第一张本人、第二张对方', ()=>{
		const one = resolveMentions([{ type: 'chart', name: '李四', raw: '@[命盘:李四]' }], { sources: [zhang, li] }, { twoCharts: true });
		expect(one.selectSource).toBe(null); expect(one.partnerSource).toBe(li);
		const two = resolveMentions([{ type: 'chart', name: '张三', raw: 'a' }, { type: 'chart', name: '李四', raw: 'b' }], { sources: [zhang, li] }, { twoCharts: true });
		expect(two.selectSource).toBe(zhang); expect(two.partnerSource).toBe(li);
		const plain = resolveMentions([{ type: 'chart', name: '李四', raw: 'c' }], { sources: [zhang, li] });
		expect(plain.selectSource).toBe(li); expect(plain.partnerSource).toBe(null);
	});
});

describe('命令参数里的 @', ()=>{
	it('🔴 /流年 @[命盘:李四] 2027年 → 切到李四、模板里是「李四在 2027 年」,不含原始标记', async ()=>{
		const deps = baseDeps();
		const a = mount(deps);
		expect(a.interceptSend('/流年 @[命盘:李四] 2027年')).toBe(true);
		await settle(()=>deps.handleSend.mock.calls.length > 0);
		expect(deps.setSelectedSourceId).toHaveBeenCalledWith(li.id);
		expect(deps.handleSend).toHaveBeenCalledTimes(1);
		const text = deps.handleSend.mock.calls[0][0];
		expect(text).toContain('李四在 2027 年的流年');
		expect(text).not.toContain('@[');
		expect(text).not.toContain('张三');
	});
	it('🔴 @ 的命盘没找到 → 只提示、不执行、输入保留(不会按当前这张盘照跑)', async ()=>{
		const deps = baseDeps();
		const a = mount(deps);
		expect(a.interceptSend('/流年 @[命盘:王五] 2027')).toBe(true);
		await flush();
		expect(deps.handleSend).not.toHaveBeenCalled();
		expect(deps.setPrompt).not.toHaveBeenCalledWith('');
	});
	it('🔴 /合盘 李四 在有「李四四」时挂李四(此前报歧义);/合盘 李 对上多张 → 列候选不执行;对方是当前这张 → 不执行', async ()=>{
		const deps = baseDeps();
		const a = mount(deps);
		expect(a.interceptSend('/合盘 李四')).toBe(true);
		await settle(()=>deps.handleSend.mock.calls.length > 0);
		expect(deps.setPartnerSourceId).toHaveBeenLastCalledWith(li.id);
		expect(deps.handleSend).toHaveBeenCalledTimes(1);
		expect(a.interceptSend('/合盘 李')).toBe(true);
		await flush();
		expect(deps.handleSend).toHaveBeenCalledTimes(1);
		expect(a.interceptSend('/合盘 @[命盘:张三]')).toBe(true);
		await flush();
		expect(deps.handleSend).toHaveBeenCalledTimes(1);
	});
	it('问句类命令(/side)把标记换回名字;前提按 @ 后生效的案例判(无当前案例时 @ 一张命盘也能 /流年)', async ()=>{
		const deps = baseDeps({ activeSource: null });
		const a = mount(deps);
		expect(a.interceptSend('/side @[命盘:李四] 的事业怎样')).toBe(true);
		await settle(()=>api.overlays.side.open === true);
		expect(api.overlays.side.open).toBe(true);
		expect(api.overlays.side.initialQuestion).toBe('李四 的事业怎样');
		expect(a.interceptSend('/流年 @[命盘:李四] 明年')).toBe(true);
		await settle(()=>deps.handleSend.mock.calls.length > 0);
		expect(deps.setSelectedSourceId).toHaveBeenLastCalledWith(li.id);
		expect(deps.handleSend).toHaveBeenCalledTimes(1);
		expect(deps.handleSend.mock.calls[0][0]).toContain(`李四在 ${new Date().getFullYear() + 1} 年`);
	});
});

describe('/help', ()=>{
	it('/help 打开浮层(列全部命令);/help 合盘 只看那一条;点一条填进输入框;生成中也能用', async ()=>{
		const deps = baseDeps({ sending: true });
		const a = mount(deps);
		expect(a.interceptSend('/help')).toBe(true);
		await settle(()=>api.overlays.help.open === true);
		expect(api.overlays.help.open).toBe(true);
		expect(api.overlays.help.items.length).toBeGreaterThanOrEqual(BUILTIN_COMMANDS.length);
		const box = document.createElement('div'); document.body.appendChild(box);
		act(()=>{ ReactDOM.render(<ChatAssistOverlays help={{ ...api.overlays.help, focus: '合盘' }} />, box); });
		const items = Array.from(document.body.querySelectorAll('[data-command-help-item]')).map((el)=>el.getAttribute('data-command-help-item'));
		expect(items).toEqual(['合盘']);
		act(()=>{ document.body.querySelector('[data-command-help-item="合盘"]').click(); });
		expect(deps.setPrompt).toHaveBeenCalledWith('/合盘 ');
		act(()=>{ ReactDOM.unmountComponentAtNode(box); }); box.remove();
	});
});

describe('每条内置命令都有执行分支', ()=>{
	test('命令表即处理器表:非技能内置命令都有处理器、处理器没有多余的;技能命令有内置技能;生成中放行名单由声明推出且 ⊆ 注册表', ()=>{
		const a = mount(baseDeps());
		const handled = new Set(a.commandHandlerNames);
		const builtin = BUILTIN_COMMANDS.filter((c)=>!c.skill).map((c)=>c.name);
		builtin.forEach((n)=>expect(handled.has(n)).toBe(true));
		a.commandHandlerNames.forEach((n)=>expect(builtin).toContain(n));
		BUILTIN_COMMANDS.filter((c)=>c.skill).forEach((c)=>expect(BUILTIN_SKILLS.find((s)=>s.id === c.skill)).toBeTruthy());
		expect(COMMANDS_ALLOWED_WHILE_SENDING).toEqual(BUILTIN_COMMANDS.filter((c)=>c.allowWhileSending).map((c)=>c.name));
		const names = BUILTIN_COMMANDS.map((c)=>c.name);
		COMMANDS_ALLOWED_WHILE_SENDING.forEach((n)=>expect(names).toContain(n));
		// 执行侧不再有按名字的 if 串(第三份手抄名单的病根)
		const src = fs.readFileSync(path.join(__dirname, '../../components/aianalysis/chat/useChatAssist.js'), 'utf8');
		expect(src.indexOf("if(cmd.name === '")).toBe(-1);
	});
});
