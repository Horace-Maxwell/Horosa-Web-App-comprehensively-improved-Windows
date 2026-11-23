// 盘面细节按表取全表:列定义直接用细节页 tableOf(同一份 render);30 张表全部能出、不带 React 残渣;缺省只出摘要。
import React from 'react';
import { buildChartDetailFullTables, elementText, CHART_DETAIL_TABLE_KEYS } from '../../components/astro/chartDetailTablesText';
import { CHART_DETAIL_TABLES, chartDetailSettingsFor } from '../chartDetails';
import { getTechniqueSettingsSchema } from '../techniqueMountSettings';
import fixture from './__fixtures__/chartDetails_1990.json';

// 细节页 JSX 靠构建期自动注入 React;jest 里补上全局
global.React = React;

describe('盘面细节全表', ()=>{
	test('元素转文字:行内拼、块级换行、空值不出', ()=>{
		expect(elementText(<span>甲<b>乙</b>{null}{false}{3}</span>)).toBe('甲乙3');
		expect(elementText(<div><div>一</div><div>二</div></div>)).toBe('一\n二\n\n');
	});
	test('30 张表逐张出全表,无 React 残渣', ()=>{
		const text = buildChartDetailFullTables(fixture, CHART_DETAIL_TABLE_KEYS, {});
		CHART_DETAIL_TABLES.forEach((t)=>{ expect(text).toContain(`■ 全表·${t.label}`); });
		expect(text).not.toMatch(/\[object Object\]|undefined|NaN/);
		expect(text).not.toContain('(本盘这张表没有内容)');
		expect(text).not.toMatch(/^\[/m);   // 不另起段头,并在「盘面细节」段里
	});
	test('行星细节 14 列与页面同', ()=>{
		const text = buildChartDetailFullTables(fixture, ['planetDetails'], {});
		expect(text).toMatch(/\| 星 \| 星等 \| 亮面 \| 距日 \| 视径 \| 方位 \| 高度 \| 视高度 \| 赤经 \| 赤纬 \| 日速 \| 增减 \| 速度比 \| 比均速 \|/);
		expect(text.split('\n').filter((l)=>l.startsWith('| ')).length).toBeGreaterThan(10);
	});
	test('表前有文字行时空一行,Markdown 才认表', ()=>{
		const lines = buildChartDetailFullTables(fixture, ['fertility'], {}).split('\n');
		const i = lines.findIndex((l)=>l.startsWith('| '));
		expect(lines[i - 1]).toBe('');
	});
	test('齿轮:只认登记的表键、去重;缺省不出全表', ()=>{
		expect(chartDetailSettingsFor({}).detailFullTables).toBeUndefined();
		expect(chartDetailSettingsFor({ detailFullTables: ['persian', 'nope', 'persian'] }).detailFullTables).toEqual(['persian']);
		const f = getTechniqueSettingsSchema('astrochart').fields.find((x)=>x.name === 'detailFullTables');
		expect(f.type).toBe('multiselect');
		expect(f.default).toEqual([]);
		expect(f.options.map((o)=>o.value)).toEqual(CHART_DETAIL_TABLE_KEYS);
	});
	test('空结果 / 空表单 → 空串', ()=>{
		expect(buildChartDetailFullTables(null, ['persian'])).toBe('');
		expect(buildChartDetailFullTables(fixture, [])).toBe('');
	});
});
