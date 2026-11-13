// 同一排的控件同高、空态居中、带内层页签的右栏页签条不随内容滚走 —— 四处曾经各自跑偏的地方。
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..', '..', '..');
const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');
const { readSource, sourceSetFiles } = require('../../../utils/__tests__/helpers/sourceSet');
const { importsName } = require('../../../utils/__tests__/helpers/importSpecs');
const { jsxElements, jsxNodesInFile } = require('../../../utils/__tests__/helpers/jsxProps');

describe('搜索框(带清除钮)与搜索钮同高、暗色不发灰', ()=>{
	const less = read('components/xq-ui/styles.less');
	it('外框取统一控件高、不再叠加上下内边距;里面的 input 不各自撑高', ()=>{
		const at = less.indexOf('.xq-search.ant-input-search .ant-input-affix-wrapper {');
		expect(at).toBeGreaterThan(0);
		const rule = less.slice(at, less.indexOf('}', at));
		expect(rule).toMatch(/min-height: var\(--horosa-control-height\);/);
		expect(rule).toMatch(/padding-top: 0;/);
		expect(rule).toMatch(/padding-bottom: 0;/);
		const inner = less.slice(less.indexOf('.xq-search.ant-input-search .ant-input-affix-wrapper > .ant-input {'));
		expect(inner.slice(0, inner.indexOf('}'))).toMatch(/min-height: 0;/);
	});
	it('搜索钮图标色随主题;暗色下搜索钮是平底', ()=>{
		expect(less).toMatch(/\.xq-search\.ant-input-search > \.ant-input-group > \.ant-input-group-addon:last-child \.ant-input-search-button:not\(\.ant-btn-primary\) \{\s*color: var\(--horosa-text-soft\);/);
		expect(less).toMatch(/:root\[data-horosa-appearance='dark'\] \.xq-search\.ant-input-search \.ant-input-group-addon \.ant-btn:not\(\.ant-btn-primary\) \{\s*background: var\(--horosa-astro-panel, #090b0e\);/);
	});
});

describe('AI 分析页四个列表页的空态都居中', ()=>{
	const mainFile = path.join(SRC, 'components', 'aianalysis', 'AIAnalysisMain.js');
	it('模版 / 设置:没有条目时容器换成居中容器,不把空态塞进卡片网格的第一格', ()=>{
		expect(sourceSetFiles(mainFile).length).toBeGreaterThan(1);
		const classes = jsxNodesInFile(mainFile, 'div').map((n)=>`${n.attrs.className || ''}`);
		expect(classes).toContain('filteredTemplates.length === 0 ? styles.materialEmpty : styles.templateGrid');
		expect(classes).toContain('filteredProfiles.length === 0 ? styles.materialEmpty : styles.settingsGrid');
		// 没有哪处还把网格类无条件挂在这两个容器上
		expect(classes).not.toContain('styles.templateGrid');
		expect(classes).not.toContain('styles.settingsGrid');
		expect(readSource(mainFile)).toContain('暂无模版或组合');
	});
});

describe('风水理气工作台的数字框与同栏下拉同高', ()=>{
	const src = read('components/fengshui/LiqiWorkspace.js');
	it('走全站数字输入组件(统一控件高),不用小号的组件库原件', ()=>{
		expect(importsName(src, { name: 'XQInputNumber', from: '../xq-ui' })).toBe(true);
		expect(importsName(src, { name: 'InputNumber', from: 'antd' })).toBe(false);
		const fields = jsxElements(src, 'XQInputNumber');
		expect(fields.length).toBeGreaterThanOrEqual(1);
		fields.forEach((f)=>{ expect(f.size).toBeUndefined(); });
		expect(jsxElements(src, 'InputNumber')).toEqual([]);
	});
});

describe('紫微「资料参考」内层页签条吸顶', ()=>{
	it('组件打类,样式给吸顶与面板底色', ()=>{
		expect(jsxElements(read('components/ruleziwei/ZWRuleMain.js'), 'Tabs').map((t)=>t.className)).toContain('horosa-zw-rule-tabs');
		const less = read('layouts/app/22-tail-fixes.less');
		const at = less.indexOf('.horosa-workspace-shell .horosa-zw-rule-tabs > .ant-tabs-nav {');
		expect(at).toBeGreaterThan(0);
		const rule = less.slice(at, less.indexOf('}', at));
		expect(rule).toMatch(/position: sticky;/);
		expect(rule).toMatch(/top: 0;/);
		expect(rule).toMatch(/background: var\(--horosa-astro-panel/);
	});
});
