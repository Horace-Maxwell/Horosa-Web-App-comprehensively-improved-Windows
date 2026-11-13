// 东亚中栏:排不出(公元前等)时中栏也写原因,不留整块空白;蒙古对冲虚线两端收在支圈外沿。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import EastAsiaBoard from '../EastAsiaBoard';
import { buildEastAsiaModel } from '../../../utils/eastAsiaSnapshot';

const NOW = Date.UTC(2026, 10, 7, 12);

describe('东亚中栏', ()=>{
	test('没有模型时写出原因', ()=>{
		const html = renderToStaticMarkup(<EastAsiaBoard model={null} tab="tibetan" emptyReason="公元前出生暂不排东亚诸术:干支历只覆盖公元 1 年以后。" />);
		expect(html).toContain('公元前出生暂不排东亚诸术');
		expect(renderToStaticMarkup(<EastAsiaBoard model={null} tab="tibetan" />)).toBe('');
	});
	test('蒙古连线两端离支圈圆心 ≥ 34(圈半径 30),不压圈里的字', ()=>{
		// 年支午、月支亥,隔四支(虚线曾压住「亥」「午」圈里的字)
		const model = buildEastAsiaModel({ date: '2026/11/09', time: '02:00:00', zone: '+08:00', lat: '26n04', lon: '119e19', gender: 1 }, null, {}, NOW);
		const html = renderToStaticMarkup(<EastAsiaBoard model={model} tab="zurkhai" />);
		const line = html.match(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/);
		expect(line).toBeTruthy();
		const circles = [...html.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="30"/g)].map((m)=>[Number(m[1]), Number(m[2])]);
		const ends = [[Number(line[1]), Number(line[2])], [Number(line[3]), Number(line[4])]];
		ends.forEach(([x, y])=>{
			const nearest = Math.min(...circles.map(([cx, cy])=>Math.hypot(cx - x, cy - y)));
			expect(nearest).toBeGreaterThanOrEqual(33.9);
		});
	});
	test('流年早于出生:洛书中栏写明,不画负岁九格', ()=>{
		const model = buildEastAsiaModel({ date: '1975/02/10', time: '21:15:00', zone: '-08:00', lat: '47n36', lon: '122w20', gender: 0 }, null, { flowYear: 1900 }, NOW);
		const html = renderToStaticMarkup(<EastAsiaBoard model={model} tab="loshu" />);
		expect(html).toContain('1900 年早于出生');
		expect(renderToStaticMarkup(<EastAsiaBoard model={model} tab="tibetan" />)).toContain('早于出生,无流年八卦');
	});
});
