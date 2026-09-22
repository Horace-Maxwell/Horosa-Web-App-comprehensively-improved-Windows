// [Q-169 裁决 2026-09-18] 界系是全局设定 → 主限法工具条「计算」所选界系覆写全局:
// buildPrimaryDirectionFetchFields 回写 fields.termsVariant(排盘真值;归一化与 app 仓/请求体同律:1..4 有效,其余 0)。
import { buildPrimaryDirectionFetchFields } from '../../components/direction/AstroDirectMain';

const CHART = { params: { birth: '1990-05-18 12:00:00', zone: '+08:00', lat: '31N14', lon: '121E28' } };
const BASE = { termsVariant: { name: ['termsVariant'], value: 1 } };

describe('Q-169 主限法工具条界系回写排盘字段', ()=>{
	it('opt.termsVariant 2 → fields.termsVariant.value 2(其余 pd 维照旧回写)', ()=>{
		const f = buildPrimaryDirectionFetchFields(BASE, CHART, 'alcabitius', 'ptolemy', 100, { termsVariant: 2, terms: true });
		expect(f.termsVariant.value).toBe(2);
		expect(f.termsVariant.name).toEqual(['termsVariant']);
		expect(f.pdTerms.value).toBe(1);
	});
	it('越界值(9 / -1 / "x")归 0=埃及;字符串 "3" 归数字 3', ()=>{
		expect(buildPrimaryDirectionFetchFields(BASE, CHART, 'alcabitius', 'ptolemy', 100, { termsVariant: 9 }).termsVariant.value).toBe(0);
		expect(buildPrimaryDirectionFetchFields(BASE, CHART, 'alcabitius', 'ptolemy', 100, { termsVariant: -1 }).termsVariant.value).toBe(0);
		expect(buildPrimaryDirectionFetchFields(BASE, CHART, 'alcabitius', 'ptolemy', 100, { termsVariant: 'x' }).termsVariant.value).toBe(0);
		expect(buildPrimaryDirectionFetchFields(BASE, CHART, 'alcabitius', 'ptolemy', 100, { termsVariant: '3' }).termsVariant.value).toBe(3);
	});
	it('opt 不带 termsVariant → 字段不动(既有值保留 / 缺席仍缺席)', ()=>{
		expect(buildPrimaryDirectionFetchFields(BASE, CHART, 'alcabitius', 'ptolemy', 100, {}).termsVariant.value).toBe(1);
		expect(buildPrimaryDirectionFetchFields({}, CHART, 'alcabitius', 'ptolemy', 100, {}).termsVariant).toBeUndefined();
	});
	it('源码哨兵:computePrimaryDirections 在值真变时写全局仓(setClassicalChartGlobal)并调度主盘重算', ()=>{
		const fs = require('fs'); const path = require('path');
		const src = fs.readFileSync(path.join(__dirname, '../../components/direction/AstroDirectMain.js'), 'utf8');
		expect(src).toMatch(/Number\(classicalGlobalValue\('termsVariant'\)\) !== tv/);
		expect(src).toMatch(/setClassicalChartGlobal\('termsVariant', tv\)/);
		expect(src).toMatch(/scheduleOptionDispatch\(\(payload\)=>\{\s*this\.props\.dispatch\(\{ type: 'astro\/fetchByFields', payload \}\);/);
	});
});
