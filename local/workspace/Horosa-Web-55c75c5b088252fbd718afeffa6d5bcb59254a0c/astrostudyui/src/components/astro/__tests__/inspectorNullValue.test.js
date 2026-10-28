// 星盘右栏各页签组件在「还没有盘」时(value=null)必须能渲染出空态,不许抛错。
// 合盘的组合盘 / 时空中点盘 / 影响盘 / 马克斯盘在两张盘没选齐时把 null 传给内嵌星盘,
// 任何一个页签抛错都会让错误兜底盒替换掉整页。清单 = AstroChartMain 右栏实际挂的组件集(从源码读出,漏挂即红)。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
import path from 'path';

import AstroInfo from '../AstroInfo';
import AstroAspect from '../AstroAspect';
import AstroPlanet from '../AstroPlanet';
import AstroLots from '../AstroLots';
import AstroThemaMundi from '../AstroThemaMundi';
import AstroDerivedHouses from '../AstroDerivedHouses';
import AstroEminence from '../AstroEminence';
import AstroKlimata from '../AstroKlimata';
import AstroPredictPlanetSign from '../AstroPredictPlanetSign';
import AstroAnalysisLab from '../AstroAnalysisLab';
import AstroEgypt from '../AstroEgypt';
import { inspectorEmptyNode } from '../inspectorEmpty';

global.React = React;   // 源码依赖构建期注入的全局 React

const FIELDS = { zone: { value: '+08:00' }, lat: { value: '26n04' }, lon: { value: '119e19' } };

const PANEL = {
	AstroInfo: (v)=><AstroInfo mode="summary" height={600} value={v} fields={FIELDS} />,
	AstroInfoClassical: (v)=><AstroInfo mode="classical" height={600} value={v} fields={FIELDS} />,
	AstroAspect: (v)=><AstroAspect value={v} height={600} />,
	AstroPlanet: (v)=><AstroPlanet value={v} fill={true} planetListStyle="full" />,
	AstroPlanetGlyph: (v)=><AstroPlanet value={v} fill={true} planetListStyle="glyphOnly" />,
	AstroLots: (v)=><AstroLots value={v} fill={true} />,
	AstroThemaMundi: ()=><AstroThemaMundi />,
	AstroDerivedHouses: (v)=><AstroDerivedHouses value={v} />,
	AstroEminence: (v)=><AstroEminence value={v} />,
	AstroKlimata: (v)=><AstroKlimata value={v} fields={FIELDS} />,
	AstroPredictPlanetSign: (v)=><AstroPredictPlanetSign height={600} value={v} fields={FIELDS} />,
	AstroAnalysisLab: (v)=><AstroAnalysisLab value={v} height={600} />,
	AstroEgypt: (v)=><AstroEgypt value={v} height={600} />,
};

describe('右栏页签组件 value=null 不抛错', ()=>{
	Object.keys(PANEL).forEach((name)=>{
		it(name, ()=>{
			expect(()=>renderToStaticMarkup(PANEL[name](null))).not.toThrow();
			expect(()=>renderToStaticMarkup(PANEL[name](undefined))).not.toThrow();
		});
	});
});

it('清单覆盖 AstroChartMain 右栏挂的全部组件(新挂一个必须进清单)', ()=>{
	const src = fs.readFileSync(path.join(__dirname, '..', 'AstroChartMain.js'), 'utf8');
	const start = src.indexOf('renderContentPanel(chartObj');
	expect(start).toBeGreaterThan(0);
	const end = src.indexOf('\n\t}\n', start);
	const body = src.slice(start, end);
	const used = Array.from(new Set((body.match(/<(Astro[A-Za-z0-9]+)\b/g) || []).map((s)=>s.slice(1))));
	expect(used.length).toBeGreaterThanOrEqual(10);
	used.forEach((name)=>{
		expect(Object.keys(PANEL).some((k)=>k === name || k.indexOf(name) === 0)).toBe(true);
	});
});

it('宿主层:没有盘时右栏每个页签内容走空态节点,不把 null 交给盘面组件', ()=>{
	const src = fs.readFileSync(path.join(__dirname, '..', 'AstroChartMain.js'), 'utf8');
	const start = src.indexOf('renderContentPanel(chartObj');
	const end = src.indexOf('\n\t}\n', start);
	const body = src.slice(start, end);
	const panes = body.split('<TabPane').slice(1);
	expect(panes.length).toBeGreaterThanOrEqual(7);
	panes.forEach((p)=>{
		expect(p).toMatch(/chartObj\s*\?|this\.renderInspectorBody\(chartObj/);
	});
	const markup = renderToStaticMarkup(inspectorEmptyNode('先在上方选择星盘 A 与星盘 B,再点「排盘」'));
	expect(markup).toContain('horosa-inspector-empty');
	expect(markup).toContain('星盘 A');
});
