// 共享子组件 SectionChecklist(req#2/#3)渲染断言。
// 覆盖:无分组→扁平 / 有分组→组标题+组内勾选 / 选中态 / 工具条按回调有无渲染 / 段名与勾选零改。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SectionChecklist from '../../components/aianalysis/SectionChecklist';

const render = (props)=>renderToStaticMarkup(React.createElement(SectionChecklist, props));
// XQCheckItem 每项恰含一个 xq-check-content;选中项 button 类含 xq-check-item-checked。
const countContent = (html)=>(html.match(/xq-check-content/g) || []).length;
const countChecked = (html)=>(html.match(/xq-check-item-checked/g) || []).length;
// antd 会在两字中文按钮间插空格(全选→「全 选」);断言前去空白容错。
const hasText = (html, s)=>html.replace(/\s+/g, '').includes(s);

describe('SectionChecklist 渲染', ()=>{
	it('无分组(groups=null)→ 扁平勾选,全部段可见,无组标题,选中态正确', ()=>{
		const html = render({ options: ['甲段', '乙段', '丙段'], selected: ['乙段'], groups: null, onToggle: ()=>{} });
		expect(html).toContain('甲段');
		expect(html).toContain('乙段');
		expect(html).toContain('丙段');
		expect(countContent(html)).toBe(3);        // 三段全渲染
		expect(countChecked(html)).toBe(1);         // 仅乙段选中
		expect(html).not.toContain('xq-mount-section-group'); // 无分组包裹
	});

	it('有分组(groups=[...])→ 每组出组标题 + 组内勾选,组标题用传入 className', ()=>{
		const groups = [
			{ title: '甲组', items: ['甲一', '甲二'] },
			{ title: '乙组', items: ['乙一'] },
		];
		const html = render({ options: ['甲一', '甲二', '乙一'], selected: [], groups, onToggle: ()=>{}, groupTitleClassName: 'grp-title' });
		expect(html).toContain('甲组');
		expect(html).toContain('乙组');
		expect(html).toContain('xq-mount-section-group');
		expect(html).toContain('class="grp-title"');
		expect(countContent(html)).toBe(3);         // 组内共三段
	});

	it('工具条:三回调齐→全选/清空/恢复默认;仅 onSelectAll→只全选;无回调→无工具条', ()=>{
		const full = render({ options: ['x'], selected: [], onToggle: ()=>{}, onSelectAll: ()=>{}, onClear: ()=>{}, onReset: ()=>{} });
		expect(hasText(full, '全选')).toBe(true);
		expect(hasText(full, '清空')).toBe(true);
		expect(hasText(full, '恢复默认')).toBe(true);

		const one = render({ options: ['x'], selected: [], onToggle: ()=>{}, onSelectAll: ()=>{} });
		expect(hasText(one, '全选')).toBe(true);
		expect(hasText(one, '清空')).toBe(false);
		expect(hasText(one, '恢复默认')).toBe(false);

		const none = render({ options: ['x'], selected: [], onToggle: ()=>{} });
		expect(hasText(none, '全选')).toBe(false);
		expect(hasText(none, '清空')).toBe(false);
		expect(hasText(none, '恢复默认')).toBe(false);
	});
});
