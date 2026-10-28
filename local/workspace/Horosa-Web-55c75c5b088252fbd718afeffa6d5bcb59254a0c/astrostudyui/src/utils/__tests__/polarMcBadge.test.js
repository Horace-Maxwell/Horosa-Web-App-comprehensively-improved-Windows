// 极区天顶徽记:后端 houses[].polarMc(极圈内上中天交点落地平下,MC 一律按上中天取)→ 盘面信息卡与 AI 快照
// 同一标记、同一句说明;没有标记的盘一字不加。
import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { polarMcOf, POLAR_MC_NOTE } from '../wholeSignRulers';
import { buildAstroSnapshotContent, buildPredictiveBirthLines } from '../astroAiSnapshot';
import AstroInfo from '../../components/astro/AstroInfo';

global.React = React;   // AstroInfo 的 JSX 走经典运行时
const REAL = JSON.parse(fs.readFileSync(path.join(__dirname, '../../divination/engine/__tests__/fixtures/realChartResult.json'), 'utf8'));
const POLAR = { ...REAL, chart: { ...REAL.chart, houses: REAL.chart.houses.map((h)=>({ ...h, polarMc: 'upperMeridian' })) } };

describe('极区天顶徽记', ()=>{
	it('polarMcOf 只认 houses[].polarMc', ()=>{
		expect(polarMcOf(REAL.chart)).toBe('');
		expect(polarMcOf(POLAR.chart)).toBe('upperMeridian');
		expect(polarMcOf(null)).toBe('');
	});

	it('AI 快照 [起盘信息] 与推运起盘行:有标记才写说明', ()=>{
		const fields = { hsys: { value: 2 }, zodiacal: { value: 0 } };
		expect(buildAstroSnapshotContent(REAL, fields)).not.toContain(POLAR_MC_NOTE);
		const polarText = buildAstroSnapshotContent(POLAR, fields);
		const base = polarText.split('\n[')[0];
		expect(base).toContain(POLAR_MC_NOTE);
		expect(buildPredictiveBirthLines(REAL)).not.toContain(POLAR_MC_NOTE);
		expect(buildPredictiveBirthLines(POLAR)).toContain(POLAR_MC_NOTE);
	});

	it('盘面信息卡(概览)出「极区天顶」行', ()=>{
		const html = (value)=>renderToStaticMarkup(<AstroInfo value={value} fields={{ hsys: { value: 2 } }} mode="summary" />);
		expect(html(REAL)).not.toContain('极区天顶');
		expect(html(POLAR)).toContain('极区天顶');
	});
});
