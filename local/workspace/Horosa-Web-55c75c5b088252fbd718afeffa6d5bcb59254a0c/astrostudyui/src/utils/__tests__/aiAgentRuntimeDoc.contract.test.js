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
const read = ()=>fs.readFileSync(DOC, 'utf8');

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
