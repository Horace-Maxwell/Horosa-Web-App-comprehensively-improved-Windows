// 合盘五个盘面子页(比较盘 / 组合盘 / 影响盘 / 时空中点盘 / 马克斯盘)没排盘时:
// 中栏正中一句纯文字提示,同一个组件出,不留整块空画布。
import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import RelativeStageEmpty from '../RelativeStageEmpty';

const { jsxNodes } = require('../../../utils/__tests__/helpers/jsxProps');   // 按 AST 认元素 / 属性 / 子节点

const read = (name)=>fs.readFileSync(path.resolve(__dirname, '..', name), 'utf8');

describe('合盘盘面空态', ()=>{
	test('空态外框定高 + flex,里面是全站同款舞台空态', ()=>{
		const html = renderToStaticMarkup(<RelativeStageEmpty height={480}>提示</RelativeStageEmpty>);
		expect(html).toMatch(/class="horosa-relative-stage-empty"/);
		expect(html).toMatch(/height:480px/);
		expect(html).toMatch(/display:flex/);
		expect(html).toMatch(/class="xq-stage-empty"/);
		expect(html).toMatch(/提示/);
		expect(html).not.toMatch(/ant-empty/);
	});

	test.each([
		['AstroCompare.js', '比较盘', 2],
		['AstroSynastry.js', '影响盘', 2],
		['AstroMarks.js', '马克斯盘', 2],
		['AstroComposite.js', '组合盘', 1],
		['AstroTimeSpace.js', '时空中点盘', 1],
	])('%s 没排盘走同一空态', (file, name, uses)=>{
		const src = read(file);
		expect(src).toMatch(/import RelativeStageEmpty from '\.\/RelativeStageEmpty';/);
		const hits = jsxNodes(src, 'RelativeStageEmpty').filter((n)=>n.attrs.height && n.children === `选好星盘 A 与星盘 B 并排盘后显示${name}`);
		expect(hits.length).toBe(uses >= 2 && file === 'AstroCompare.js' ? 1 : uses);
		// 不各写各的空态
		expect(jsxNodes(src, 'XQStageEmpty')).toEqual([]);
		expect(jsxNodes(src, 'Empty')).toEqual([]);
	});

	test('比较盘:两张盘都有才画双盘', ()=>{
		const src = read('AstroCompare.js');
		expect(src).toMatch(/const canRender = !!\(resobj\.outer && resobj\.inner\);/);
		expect((src.match(/\{canRender \? \(/g) || []).length).toBe(2);
		expect((src.match(/\) : empty\}/g) || []).length).toBe(2);
	});

	test('组合盘 / 时空中点盘:没有结果先给空态,不把空值交给盘组件', ()=>{
		['AstroComposite.js', 'AstroTimeSpace.js'].forEach((file)=>{
			const src = read(file);
			const at = src.indexOf('if(!resobj){');
			expect(at).toBeGreaterThan(0);
			expect(at).toBeLessThan(src.indexOf('<AstroChartMain'));
		});
	});
});
