// [2026-09-11] 斜杠命令完备性回归锁:设计承诺的命令 ⊆ 注册表;菜单条数 = 内置数 + 技能触发词数(静默漏项即红);
// 手册「输入区」的命令清单从注册表插值(每条内置命令名与分组名都出现在手册源码或注册表插值路径);/择日 别名表 ≡ 择日子页签集。
const fs = require('fs');
const path = require('path');
import { BUILTIN_COMMANDS, COMMAND_GROUPS, listCommandItems, ZERI_SUBTAB_ALIASES } from '../aiChat/commands';
import { ZERI_SUBTABS } from '../../constants/SubTabRegistry';
import { BUILTIN_SKILLS } from '../aiChat/skills';

const HELP = path.resolve(__dirname, '..', '..', 'components', 'help', 'AIAnalysisHelpDoc.js');
const chart = { id: 'local-1', sourceType: 'chart', title: '张三' };

// 设计承诺的命令清单(/报告 只在含该命令的构建里存在,不在此表;存在时由分组/别名唯一性两条断言一并覆盖)
const PROMISED = ['流年', '合盘', '简报', '择日', '多模型', '审阅', '编排', 'compact', 'side', 'fork', 'goal', 'init', 'status', 'plan', 'resume', 'profile', 'doctor', '命主', '任务'];

it('🔴 设计承诺的命令全部在注册表;名字/别名全局唯一;每条都有 help 与 group', ()=>{
	const names = BUILTIN_COMMANDS.map((c)=>c.name);
	PROMISED.forEach((n)=>expect(names).toContain(n));
	const all = [];
	BUILTIN_COMMANDS.forEach((c)=>{ all.push(c.name.toLowerCase()); (c.aliases || []).forEach((a)=>all.push(`${a}`.toLowerCase())); });
	expect(new Set(all).size).toBe(all.length);
	BUILTIN_COMMANDS.forEach((c)=>{ expect(`${c.help || ''}`.length).toBeGreaterThan(4); expect(COMMAND_GROUPS).toContain(c.group); expect(typeof c.argsHint).toBe('string'); });
	// 三个内置技能各有一条同名命令接线
	BUILTIN_SKILLS.forEach((sk)=>expect(BUILTIN_COMMANDS.find((c)=>c.skill === sk.id)).toBeTruthy());
});

it('🔴 菜单条数 = 内置命令数 + 用户技能触发词数(撞内置的让位不计);单独一个 / 列全部', ()=>{
	const skills = [
		{ id: 'b1', name: '事业', skill: { triggers: ['事业', '财运', '流年'] } },   // 流年撞内置 → 让位
		{ id: 'b2', name: '空', skill: { triggers: [] } },
	];
	const items = listCommandItems({ prefix: '', skills, ctx: { activeSource: chart } });
	expect(items.length).toBe(BUILTIN_COMMANDS.length + 2);
	expect(items.filter((c)=>c.kind === 'skill').map((c)=>c.name)).toEqual(['事业', '财运']);
});

it('🔴 手册真能渲染:每条内置命令名与分组名都出现在渲染文本里,且无 React key 警告', ()=>{
	const React = require('react');
	global.React = React;   // 手册组件按 umi 自动运行时写 JSX、不显式 import React(与其它手册测试同款垫片)
	const { renderToStaticMarkup } = require('react-dom/server');
	// antd Tabs 静态渲染只出活动页签;手册的命令清单在「分析页操作」页签里 → 用「全页签平铺」的 Tabs 替身让每个页签都进渲染文本
	jest.isolateModules(()=>{
		jest.doMock('antd', ()=>{
			const real = jest.requireActual('antd');
			const FlatTabs = ({ children })=>React.createElement('div', null, children);
			FlatTabs.TabPane = ({ tab, children })=>React.createElement('section', null, React.createElement('h4', null, tab), children);
			return { ...real, Tabs: FlatTabs };
		});
	});
	let HelpDoc = null;
	jest.isolateModules(()=>{ HelpDoc = require('../../components/help/AIAnalysisHelpDoc').default; });
	const errors = [];
	const orig = console.error;
	console.error = (...a)=>{ errors.push(a.map((x)=>`${x}`).join(' ')); };
	let html = '';
	try{ html = renderToStaticMarkup(React.createElement(HelpDoc)); }finally{ console.error = orig; }
	BUILTIN_COMMANDS.forEach((c)=>expect(html).toContain(`/${c.name}`));
	COMMAND_GROUPS.slice(0, 3).forEach((g)=>expect(html).toContain(g));
	expect(errors.filter((e)=>e.indexOf('key') >= 0)).toEqual([]);
});

it('🔴 手册从注册表插值渲染命令清单(单源),且解释了 @ 引用;/择日 别名表键集 ≡ ZERI_SUBTABS', ()=>{
	const s = fs.readFileSync(HELP, 'utf8');
	expect(s).toContain("from '../../utils/aiChat/commands'");
	expect(s).toContain('renderCommandList()');
	expect(s).toContain('<b>斜杠命令</b>');
	expect(s).toContain('<b>@ 引用</b>');
	['命盘', '事盘', '资料', '组合', '模板', '技法一条不截', '内容段', '西方占星', '占卜术数', '拼音首字母', '@技法名/'].forEach((g)=>expect(s.indexOf(g) >= 0).toBe(true));
	expect(Object.keys(ZERI_SUBTAB_ALIASES).sort()).toEqual(ZERI_SUBTABS.slice().sort());
	Object.keys(ZERI_SUBTAB_ALIASES).forEach((k)=>expect(ZERI_SUBTAB_ALIASES[k].length).toBeGreaterThanOrEqual(2));
});
