// [挂载自检 J-1/J-2·P0] 节气盘:jieqi_current 非盘页签真清槽;整年 charts 合并时按种子参数丢弃其它节气旧盘。
import { saveModuleAISnapshot, loadModuleAISnapshot, clearModuleAISnapshot } from '../moduleAiSnapshot';
import { mergeJieQiCharts, isJieQiChartCompatible } from '../../components/jieqi/JieQiChartsMain';
import fs from 'fs';
import path from 'path';

beforeEach(()=>{ window.localStorage.clear(); });

it('🔴 clearModuleAISnapshot:内存/全局/localStorage 三层皆清;save 空文仍不覆盖(旧语义不变)', ()=>{
	saveModuleAISnapshot('jieqi_current', '[春分星盘]\nx', { currentTab: 'chunfen' });
	expect(loadModuleAISnapshot('jieqi_current').content).toContain('春分');
	expect(saveModuleAISnapshot('jieqi_current', '', {})).toBeNull();
	expect(loadModuleAISnapshot('jieqi_current')).toBeTruthy();
	expect(clearModuleAISnapshot('jieqi_current')).toBe(true);
	expect(loadModuleAISnapshot('jieqi_current')).toBeNull();
	expect(window.localStorage.getItem('horosa.ai.snapshot.module.v1.jieqi_current')).toBeNull();
});

it('🔴 mergeJieQiCharts:改年份后其它节气的旧盘被丢,同种子的保留', ()=>{
	const mk = (year)=>({ params: { year, ad: 1, zone: '+08:00', lat: '31n38', lon: '118e27', gpsLat: 31.63, gpsLon: 118.45, hsys: 1, zodiacal: 0, siderealAyanamsa: '', doubingSu28: 2, termsVariant: 0, triplicity: 0, lotReversal: 0, westNodeType: 'mean', sectBuffer: 0, leoBoundFirst: 0 } });
	const prev = { 春分: mk(2025), 夏至: mk(2025), 秋分: mk(2026) };
	const req2026 = mk(2026).params;
	expect(isJieQiChartCompatible(prev.春分, req2026)).toBe(false);
	const merged = mergeJieQiCharts(prev, '冬至', mk(2026), req2026);
	expect(Object.keys(merged).sort()).toEqual(['冬至', '秋分']);
	const same = mergeJieQiCharts(prev, '冬至', mk(2025), mk(2025).params);
	expect(Object.keys(same).sort()).toEqual(['冬至', '夏至', '春分'].sort());
});

it('接线锚:总览页签清槽;合并走 mergeJieQiCharts', ()=>{
	const src = fs.readFileSync(path.join(__dirname, '..', '..', 'components', 'jieqi', 'JieQiChartsMain.js'), 'utf8');
	expect(src).toContain("clearModuleAISnapshot('jieqi_current');");
	expect(src).toContain('charts: mergeJieQiCharts(prevResult.charts, title, chartObj, reqParams),');
});
