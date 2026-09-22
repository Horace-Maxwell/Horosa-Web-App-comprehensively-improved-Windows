// [挂载自检·卜族小修] 塔罗无头不回落页面当前事盘(T-1);奇门保存前刷槽;天星衍化四块入快照;风水阳宅判断伪段头。
import fs from 'fs';
import path from 'path';
const UI = path.join(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(UI, rel), 'utf8');

jest.mock('../kentangCaseSave', () => ({
	getKentangSavedCasePayload: jest.fn(() => ({ payload: { options: { deckId: 'rws', spreadType: 'three', seed: '77', question: '别人的问题' } }, caseVersion: 'tarot|other|x' })),
	parseKentangCasePayload: jest.fn((p) => p), openKentangCaseDrawer: jest.fn(), caseFieldSnapshot: jest.fn(() => ({})), caseGenderValue: jest.fn(() => 1), caseApplySeqSuffix: jest.fn(() => '|0'),
}));
import { buildTarotSnapshotForFields } from '../../components/tarot/TarotMain';

it('🔴 塔罗:无 seed 且 noPageFallback → ""(不读页面当前事盘);页面自身导出路径仍可兜底', async ()=>{
	const fields = { date: { value: { format: ()=>'2026-05-15' } }, time: { value: { format: ()=>'10:12:00' } } };
	const headless = await buildTarotSnapshotForFields(fields, { noPageFallback: true });
	expect(headless).toBe('');
	const page = await buildTarotSnapshotForFields(fields, {});
	expect(`${page}`.length).toBeGreaterThan(0);
	expect(page).toContain('别人的问题');
	const ctx = read('utils/aiAnalysisContext.js');
	expect(ctx).toContain("buildTarotSnapshotForFields(buildFieldObject(record), { ...tOpts, noPageFallback: true })");
});

it('奇门/奇门择日 保存事盘前先刷槽(源码锚:saveLiveSnapshot 在 loadModuleAISnapshot(this.scope) 之前)', ()=>{
	const src = read('components/dunjia/DunJiaMain.js');
	const i = src.indexOf("if(this.state.pan){ try{ this.saveLiveSnapshot(this.state.pan); }");
	const j = src.indexOf('const snapshot = loadModuleAISnapshot(this.scope);');
	expect(i).toBeGreaterThan(0);
	expect(j).toBeGreaterThan(i);
});

it('天星择日 [选中时刻星盘] 带古典衍化(classicalDerived:true)', ()=>{
	expect(read('divination/zeri/tianxingSnapshot.js')).toContain('{ headerless: true, classicalDerived: true }');
});

it('风水阳宅判断无整行【…】伪段头(段头正则 ^【(.+)】$ 会把它当一段)', ()=>{
	const src = read('components/fengshui/liqi/zhaiduanSchool.js');
	expect(src).not.toMatch(/L\.push\(`【[^`]*】`\);/);
	expect(src).toContain('（几何检测未判 ${r.geoScan.skipped.length} 项');
});

// [挂载自检 F-48] 地占无头同病同修:缺问句 + noPageFallback → ''(不读页面当前事盘);不带旗仍可兜底(页面导出路径)。
describe('地占无头不回落页面当前事盘', ()=>{
	it('🔴 noPageFallback:缺 question → ""; 无旗 → 走 getKentangSavedCasePayload 兜底', async ()=>{
		const { buildGeomancySnapshotForFields } = require('../../components/geomancy/GeomancyMain');
		const { getKentangSavedCasePayload } = require('../kentangCaseSave');
		getKentangSavedCasePayload.mockImplementation(() => ({ payload: { options: { question: '别人的问题', questionType: 'custom', seedMode: 'manual', seed: 7, tradition: 'european_classical' } } }));
		const fields = { date: { value: '2026-05-15' }, time: { value: '10:12:00' }, zone: { value: '+08:00' }, lon: { value: '120e00' }, lat: { value: '30n00' } };
		getKentangSavedCasePayload.mockClear();
		const headless = await buildGeomancySnapshotForFields(fields, { noPageFallback: true });
		expect(headless).toBe('');
		expect(getKentangSavedCasePayload).not.toHaveBeenCalled();
		const src = read('utils/aiAnalysisContext.js');
		const i = src.indexOf("case 'geomancy':");
		expect(src.slice(i, i + 600)).toContain('noPageFallback: true');
	});
});
