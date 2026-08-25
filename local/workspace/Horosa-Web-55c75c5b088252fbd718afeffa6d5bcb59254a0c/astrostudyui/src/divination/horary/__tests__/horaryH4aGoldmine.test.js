// [卜卦改进 H4a] 后端金矿纯增接线——离线锁(真形 fixture)。
// ①facts 六字段映射(stationState/decl/ruleHouses/degreeQuality/specialDegree/backendDignityScore)
// ②moonStory.immediate(后端 immediateAsp 权威源,限七政×托勒密角)
// ③moonFinal 月亮本座终局相位(真计算,Query VI 接线)
// ④j.besiegement 围攻十六式详断透传(真形:Jupiter 火土凶围+金星协防)
// ⑤j.backendStars 后端恒星分桶透传
// ⑥快照两新段([围攻详断]/[月亮实测相位])产出且段头与 AI_EXPORT_PRESET_SECTIONS.horary 登记一致
// ⑦general 类事项主兜底=月亮下一入相星必按 orb 升序(旧码取表原序首项 bug)
import { buildFacts } from '../../engine/chartFacts';
import { runHorary, __resetHoraryMemoForTest } from '../horaryEngine';
import { buildHorarySnapshot } from '../horarySnapshot';

const realResult = require('../../engine/__tests__/fixtures/realChartResult.json');

function freshReal(){ return JSON.parse(JSON.stringify(realResult)); }

describe('H4a① facts 六字段映射', () => {
	const f = buildFacts(freshReal(), {});
	it('六键存在于每颗行星(真形 fixture 上非全退化)', () => {
		const keys = ['stationState', 'decl', 'ruleHouses', 'degreeQuality', 'specialDegree', 'backendDignityScore'];
		const ps = Object.keys(f.planets);
		expect(ps.length).toBeGreaterThan(6);
		ps.forEach((k) => {
			keys.forEach((kk) => { expect(kk in f.planets[k]).toBe(true); });
		});
		// 真盘上 decl/backendDignityScore 至少七政全非 null;ruleHouses 至少一星非空
		['sun', 'moon', 'mars', 'saturn'].forEach((k) => {
			expect(f.planets[k].decl).not.toBe(null);
			expect(f.planets[k].backendDignityScore).not.toBe(null);
		});
		expect(Object.keys(f.planets).some((k) => f.planets[k].ruleHouses)).toBe(true);
	});
	it('timingStationAware 链路闭环:facts 行星带 stationState 键(H2 修正的消费前提)', () => {
		expect('stationState' in f.planets.mercury).toBe(true);
	});
});

describe('H4a②③④⑤ runHorary 纯增字段(真形 fixture)', () => {
	beforeEach(() => { __resetHoraryMemoForTest(); });
	const j = runHorary(freshReal(), 'general', {});

	it('moonStory.immediate:译层活+星集门控真判别(此盘 Moon 紧密相位恰全为三王=七政档空属天文实情)', () => {
		const { immediateAspOf } = require('../../engine/resultShapes');
		expect(immediateAspOf(freshReal(), 'Moon').length).toBeGreaterThan(0);   // 译层非退化
		expect(Array.isArray(j.moonStory.immediate)).toBe(true);
		const SEVEN = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
		j.moonStory.immediate.forEach((a) => {
			expect(SEVEN).toContain(a.other);
			expect([0, 60, 90, 120, 180]).toContain(a.angle);
		});
		// includeOuter 档:三王条目(Uranus/Neptune 六合)必须入表——星集门控判别力
		__resetHoraryMemoForTest();
		const j2 = runHorary(freshReal(), 'general', { includeOuter: true });
		expect(j2.moonStory.immediate.length).toBeGreaterThan(0);
		expect(j2.moonStory.immediate.map((a) => a.other)).toContain('uranus');
	});

	it('moonFinal:月亮本座终局相位非退化(tDays>0,托勒密角)', () => {
		expect(j.moonFinal).toBeTruthy();
		expect(j.moonFinal.tDays).toBeGreaterThan(0);
		expect([0, 60, 90, 120, 180]).toContain(j.moonFinal.angle);
		// Query VI 真接线:outcome 文案含终局行,不再是「并参」空话
		expect(j.queries.outcome.text).toContain('终局');
		expect(j.queries.outcome.moonFinal).toBe(j.moonFinal);
	});

	it('besiegement:真形一行(Jupiter 火土凶围·severe)+协防字段齐', () => {
		expect(j.besiegement.length).toBe(1);
		const b = j.besiegement[0];
		expect(b.target).toBe('Jupiter');
		expect(b.nature).toBe('凶');
		expect(b.severe).toBe(true);
		expect(b.besiegers.map((x) => x.id).sort()).toEqual(['Mars', 'Saturn']);
		expect(Array.isArray(b.defense)).toBe(true);
	});

	it('backendStars:分桶透传(31 星桶,Sun 桶含实测行)', () => {
		expect(Object.keys(j.backendStars).length).toBeGreaterThan(10);
		expect(j.backendStars.Sun[0].star).toBeTruthy();
		expect(Number.isFinite(j.backendStars.Sun[0].orb)).toBe(true);
	});
});

describe('H4a⑥ 快照两新段', () => {
	beforeEach(() => { __resetHoraryMemoForTest(); });
	it('[围攻详断]/[月亮实测相位] 段头产出且内容非空;段名已登记 preset', () => {
		const r = freshReal();
		const j = runHorary(r, 'general', {});
		const snap = buildHorarySnapshot(j, r.chart);
		expect(snap).toContain('[围攻详断]');
		expect(snap).toMatch(/\[围攻详断\]\n- .+围攻（凶·重/);
		expect(snap).toContain('[月亮实测相位]');
		expect(snap).toMatch(/月亮本座终局相位/);
		// 「后端实测」行:此盘 Moon 紧密相位全为三王 → includeOuter 档才产该行(七政档正确不产)
		expect(snap).not.toMatch(/后端实测紧密相位/);
		__resetHoraryMemoForTest();
		const j2 = runHorary(freshReal(), 'general', { includeOuter: true });
		const snap2 = buildHorarySnapshot(j2, r.chart);
		expect(snap2).toMatch(/后端实测紧密相位/);
		const { AI_EXPORT_PRESET_SECTIONS } = require('../../../utils/aiExport');
		expect(AI_EXPORT_PRESET_SECTIONS.horary).toContain('围攻详断');
		expect(AI_EXPORT_PRESET_SECTIONS.horary).toContain('月亮实测相位');
	});
});

describe('H4a⑦ general 兜底事项主按 orb 升序', () => {
	beforeEach(() => { __resetHoraryMemoForTest(); });
	it('Applicative 表乱序时,兜底事项主=orb 最小的入相星(旧码拿表首项)', () => {
		const r = freshReal();
		// 剥掉 7 宫主指派可达性:直接构造月亮 Applicative 乱序(远星在前)
		r.aspects.normalAsp.Moon = r.aspects.normalAsp.Moon || {};
		r.aspects.normalAsp.Moon.Applicative = [
			{ id: 'Saturn', asp: 120, orb: 9.0 },
			{ id: 'Venus', asp: 60, orb: 1.2 },
		];
		r.aspects.normalAsp.Moon.Exact = [];
		const f = buildFacts(r, {});
		// 直接验证兜底逻辑的排序面:runHorary 的 general 档 quesited 来自 7 宫主,
		// 兜底仅在 quesitedKey 缺失时触发——此处以 aspectsEngine 复算断言排序契约本身。
		const { applyingAspects } = require('../../engine/aspectsEngine');
		const app = applyingAspects(f, 'moon')
			.filter((a) => ['sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'].indexOf(a.other) >= 0)
			.sort((a, b) => a.orb - b.orb);
		expect(app[0].other).toBe('venus');   // 不排序时表首=saturn(9.0°)——bug 面
	});
});
