// 手册与代码恒等(读本仓的目录与手册):工具全表逐件在 + 总数句 = 目录件数;事件表 / 动作表 / 类别表与常量 toEqual 级恒等;
// 过期计数与旧口径(「十五件」「六类」「三个动作」)不得回潮。
const fs = require('fs');
const path = require('path');
import { registerBuiltinTools } from '../aiTools';
import { __resetToolsForTests } from '../aiTools/registry';
import { TOOL_CATEGORIES } from '../aiTools/catalog';
import { AUTOMATION_EVENTS } from '../aiAgent/automation/events';
import { AUTOMATION_ACTION_TYPES } from '../aiAgent/automation/actions';

const DOC = path.resolve(__dirname, '..', '..', '..', '..', '..', 'docs', 'AI_AGENT_RUNTIME.md');
const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
// 按渲染后所见来读:去掉 HTML 注释(注释里的文字渲染时不显示,不算手册内容)
const read = ()=>fs.readFileSync(DOC, 'utf8').replace(/<!--[\s\S]*?-->/g, '');

beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); });

it('🔴 手册提到每一件内置工具;总数句 = 目录件数;过期计数「十五件」已清;§6a 在位', ()=>{
	const doc = read();
	const names = registerBuiltinTools().map((t)=>t.name);
	expect(names.length).toBeGreaterThanOrEqual(24);
	const missing = names.filter((n)=>doc.indexOf(`\`${n}\``) < 0);
	expect(missing).toEqual([]);
	expect(doc).toContain(`共 **${names.length} 件**`);
	expect(doc).not.toContain('十五件');
	expect(doc).toContain('## 6a. 操控软件工具集');
});

it('🔴 事件表 / 动作表 / 类别表:每个常量键在手册里以反引号出现,且「N 个 / N 类」计数与常量长度相等', ()=>{
	const doc = read();
	expect(AUTOMATION_EVENTS.filter((e)=>doc.indexOf(`\`${e}\``) < 0)).toEqual([]);
	expect(doc).toContain(`**${CN[AUTOMATION_EVENTS.length]}个事件**`);
	expect(AUTOMATION_ACTION_TYPES.filter((a)=>doc.indexOf(`\`${a}\``) < 0)).toEqual([]);
	expect(doc).toContain(`**${CN[AUTOMATION_ACTION_TYPES.length]}个动作**`);
	const catLine = doc.split('\n').find((l)=>l.indexOf('按类别收紧') >= 0 && l.indexOf('TOOL_CATEGORIES') >= 0) || '';
	expect(catLine).not.toBe('');
	expect(catLine).toContain(`${CN[TOOL_CATEGORIES.length]}类 ${TOOL_CATEGORIES.join('/')} 各`);
	expect(doc).not.toContain('六类 records');
	expect(doc).not.toContain('**三个动作**');
});

it('🔴 手册与无头说明照实写明:终端人工确认与管理令牌不是安全边界(伪终端里的代理 --yes 直接过、管理令牌同账户可读)', ()=>{
	const HEADLESS = path.resolve(path.dirname(DOC), 'HEADLESS.md');
	const readPlain = (p)=>fs.readFileSync(p, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
	[read(), readPlain(HEADLESS)].forEach((doc)=>{
		expect(doc).toMatch(/不是安全边界/);
		expect(doc).toMatch(/伪终端/);
		expect(doc).toMatch(/管理令牌/);
		expect(doc).toMatch(/谁能在你的账户下(执行|跑)命令/);
	});
});
