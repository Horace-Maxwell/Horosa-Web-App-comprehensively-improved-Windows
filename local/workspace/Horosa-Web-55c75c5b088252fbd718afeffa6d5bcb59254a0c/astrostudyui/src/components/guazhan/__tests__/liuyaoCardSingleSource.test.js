// 六爻右栏两页(断诀 / 占类)的小标题卡片单一来源:断诀页导出 Card,占类页 import。
import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Card } from '../LiuYaoDuanJueView';

describe('六爻卡片单一来源', ()=>{
	test('卡片渲染:标题 + 正文', ()=>{
		const html = renderToStaticMarkup(React.createElement(Card, { title: '标题甲' }, '正文乙'));
		expect(html).toContain('标题甲');
		expect(html).toContain('正文乙');
		expect(html).toContain('var(--horosa-accent, #e7bd75)');
		expect(html).toContain('var(--horosa-astro-line, rgba(215,173,105,0.18))');
	});
	test('源码:占类页不再自带一份', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '..', 'LiuYaoZhanLeiView.js'), 'utf8');
		expect(src).toContain("import { Card } from './LiuYaoDuanJueView';");
		expect(src).not.toContain('function Card(');
	});
});
