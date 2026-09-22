// [Q-444/T-407] 世俗盘右栏卡 → 快照段:与 render*Card 同源纯函数;按盘型产段;按需拉取物随 state 成段;段名全登记 preset。
import { buildMundaneCardSections } from '../MundaneMain';
import { buildMockResult } from '../../../divination/election/__tests__/electionFixture';
import { buildFacts } from '../../../divination/engine/chartFacts';
import { describeSpecialAxes, mundaneFixedStarHits, buildMundaneStarPoints } from '../../../divination/mundane/describe';
import { mundaneDistribution } from '../../../divination/mundane/patterns';
import { AI_EXPORT_PRESET_SECTIONS } from '../../../utils/aiExport';

const heads = (secs) => secs.map((s) => s.split('\n')[0]);

describe('世俗盘 快照 · 右栏卡折入(Q-444)', () => {
	const chart = buildMockResult();
	const facts = buildFacts(chart);
	it('入宫盘:年盘概要/天气占星/四轴特殊点/盘型格局/(恒星命中)/(会合指示)按数据产段,值与 describe 同源', () => {
		const secs = buildMundaneCardSections(chart, { mundaneType: 'ingress', ingressMoment: '2026-03-20 17:46', ingressYear: 2026, ingressTerm: '春分' }, {}, facts);
		const hs = heads(secs);
		expect(hs).toContain('[年盘概要]');
		expect(hs).toContain('[天气占星]');
		expect(hs).toContain('[盘型格局]');
		const sp = describeSpecialAxes(facts);
		if (sp) {
			expect(hs).toContain('[四轴特殊点]');
			const sec = secs[hs.indexOf('[四轴特殊点]')];
			if (sp.vertex != null) { expect(sec).toContain(`天顶点 Vertex：`); }
		}
		const dist = mundaneDistribution(facts, true);
		const dsec = secs[hs.indexOf('[盘型格局]')];
		expect(dsec).toContain(`元素偏盛 ${dist.domElementCn}象（火${dist.elements.fire}·土${dist.elements.earth}·风${dist.elements.air}·水${dist.elements.water}）`);
		const hits = mundaneFixedStarHits(buildMundaneStarPoints(facts), 2026, 1.5);
		expect(hs.indexOf('[世运恒星命中]') >= 0).toBe(hits.length > 0);
		secs.forEach((s) => expect(s).not.toMatch(/undefined|NaN/));
	});
	it('按需拉取物:四季种子/相位格局算过才成段;未算不产', () => {
		const ex = { mundaneType: 'ingress', ingressYear: 2026, ingressTerm: '春分' };
		const base = heads(buildMundaneCardSections(chart, ex, {}, facts));
		expect(base).not.toContain('[四季入境盘]');
		const withSeed = heads(buildMundaneCardSections(chart, ex, { seasonSeedYear: 2026, seasonSeed: { 春分: { time: '2026-03-20 17:46:00' }, 夏至: { time: '2026-06-21 16:24:00' } } }, facts));
		expect(withSeed).toContain('[四季入境盘]');
	});
	it('日食盘:日食图判读/食族 Saros/天象占参考;地区盘:12世俗宫表+时刻校正;吠陀:年度盘/世运大运/KP;周期盘:大年时代恒出、木土纪元随 state', () => {
		const ecl = heads(buildMundaneCardSections(chart, { mundaneType: 'solecl', selectedMoment: '2026-08-12 17:46', scanYear: 2026 }, {}, facts));
		expect(ecl).toContain('[日食图判读]');
		expect(ecl).toContain('[食族 Saros]');
		expect(ecl).toContain('[天象占参考]');
		const reg = buildMundaneCardSections(chart, { mundaneType: 'region', regionCn: '某地' }, {}, facts);
		const rh = heads(reg);
		expect(rh).toContain('[地区盘·12世俗宫]（某地）');
		expect(rh).toContain('[时刻校正]');
		expect(reg[rh.indexOf('[地区盘·12世俗宫]（某地）')].split('\n').length).toBe(15);
		const ved = heads(buildMundaneCardSections(chart, { mundaneType: 'vedicmundane', vedicYear: 2026 }, {}, facts));
		expect(ved).toContain('[吠陀世运·年度盘]');
		expect(ved).toContain('[世运大运]');
		expect(ved).toContain('[KP 副主链]');
		const cyc0 = heads(buildMundaneCardSections(chart, { mundaneType: 'cycles' }, {}, facts));
		expect(cyc0).toContain('[大年时代]');
		expect(cyc0).not.toContain('[木土纪元]');
		const cyc1 = heads(buildMundaneCardSections(chart, { mundaneType: 'cycles' }, { gcResults: [{ year: 2020, month: 12, sign: 10, lon: 300.5 }], gcMode: 'flat', gcPair: 'jupiter-saturn', gcAspect: 0, gcStart: 1900, gcEnd: 2100 }, facts));
		expect(cyc1).toContain('[木土纪元]');
	});
	it('所有实产段名 ⊆ preset.mundane(前缀匹配含括注)', () => {
		const all = [];
		['ingress', 'newmoon', 'solecl', 'lunecl', 'region', 'solunar', 'vedicmundane', 'mundanehorary', 'cycles'].forEach((t) => {
			all.push(...heads(buildMundaneCardSections(chart, { mundaneType: t, ingressMoment: 'x', selectedMoment: 'x', ingressYear: 2026, regionCn: 'R' }, { gcResults: [{ year: 2020, month: 12, sign: 10 }], gcMode: 'flat' }, facts)));
		});
		const preset = AI_EXPORT_PRESET_SECTIONS.mundane;
		all.forEach((h) => { const name = h.replace(/^\[([^\]]+)\].*$/, '$1'); expect(preset).toContain(name); });
	});
});
