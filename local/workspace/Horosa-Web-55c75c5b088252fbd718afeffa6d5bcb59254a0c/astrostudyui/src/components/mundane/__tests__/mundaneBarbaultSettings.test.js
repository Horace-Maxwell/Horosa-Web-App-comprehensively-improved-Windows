// Barbault 指数:慢星组合与谐波跨会话保留;快照写「算图时」的组合,不写下拉此刻的值。
import fs from 'fs';
import path from 'path';
import { MUNDANE_PAGE_SETTINGS, buildMundaneCardSections } from '../MundaneMain';
import { buildMockResult } from '../../../divination/election/__tests__/electionFixture';
import { buildFacts } from '../../../divination/engine/chartFacts';

const src = fs.readFileSync(path.resolve(__dirname, '../MundaneMain.js'), 'utf8');

describe('Barbault 两项口径进本页设置', ()=>{
	test('schema 有 bbSet / bbHarm,缺省 = 五慢星 / 原指数', ()=>{
		expect(MUNDANE_PAGE_SETTINGS.fields).toEqual(expect.arrayContaining(['bbSet', 'bbHarm']));
		expect(MUNDANE_PAGE_SETTINGS.defaults().bbSet).toBe('slow5');
		expect(MUNDANE_PAGE_SETTINGS.defaults().bbHarm).toBe(1);
	});
	test('下拉亲手改即落盘,构造时读回', ()=>{
		expect(src).toContain('MUNDANE_PAGE_SETTINGS.save({ bbSet: v })');
		expect(src).toContain('MUNDANE_PAGE_SETTINGS.save({ bbHarm: v })');
		expect(src).toMatch(/bbSet: savedBb\.bbSet, bbHarm: savedBb\.bbHarm/);
	});
});

describe('Barbault 快照取算图时的组合', ()=>{
	const chart = buildMockResult();
	const facts = buildFacts(chart);
	const points = [{ year: 1990, month: 1, index: 300 }, { year: 2000, month: 1, index: 100 }];
	test('下拉改成别的组合、没重画:快照仍写画图时的组合与年段', ()=>{
		const st = { bbSet: 'slow5', bbStart: 1800, bbEnd: 2100, bbData: { points, harm: 2, setKey: 'outer3', startYear: 1900, endYear: 2050 } };
		const secs = buildMundaneCardSections(chart, { mundaneType: 'cycles', mundaneRuleset: 'modern' }, st, facts);
		const sec = secs.find((s)=>s.startsWith('[Barbault 聚散指数]'));
		expect(sec).toContain('仅外三星');
		expect(sec).toContain('2 次谐波');
		expect(sec).toContain('1900–2050');
		expect(sec).not.toContain('五慢星');
	});
});
