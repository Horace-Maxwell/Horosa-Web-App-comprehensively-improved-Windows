// 世俗盘·压力矩阵(全功能排查轮):组合×边界×垃圾值穷举。
// 单功能行为各有专门 golden;本文件专攻缺口:流派×主管制 16 组合/求根种子边界/
// 黄经边界与负值/空输入风暴/跨 0° 宫框/象限边界。
import { rulesetConfig, hiddenBodiesFor } from '../../divination/mundane/ruleset';
import { ingressGovernance } from '../../divination/mundane/momentPipeline';
import { computeConjunctionEras, detectMarsSaturnCancer } from '../../divination/mundane/conjunctionEras';
import { ayanamsaAt, computeCurrentAge } from '../../divination/mundane/greatYear';
import { sarosNodeType } from '../../divination/mundane/saros';
import { computeAngularity, isDormantChart, mundoPositionOf, describeSolunar, SOLUNAR_TYPES } from '../../divination/mundane/solunar';
import { vimshottariFromMoon, kpSubLordAt, munthaSign, garbhaDeliveryDate, varaLordOf, buildSaptaNadi } from '../../divination/mundane/vedicMundane';
import { describeWarQuestion, describeWeatherQuestion, describePriceQuestion } from '../../divination/mundane/mundaneHorary';
import { describeQuadrantNations } from '../../divination/mundane/omenology';
import { describeChorography } from '../../divination/mundane/chorography';

describe('① 流派 × 主管制 × 模态 全组合(4 规则集 × 3 模态 × 直选 3 制)', () => {
	test('quarterly 按模态分 3/6/12;aries_annual/capricorn_year 恒 12;全组合不炸且语义正确', () => {
		const signs = { cardinal: 'aries', fixed: 'taurus', mutable: 'gemini' };
		['ptolemaic', 'medieval', 'modern', 'barbault'].forEach((rk) => {
			const rule = rulesetConfig(rk).ingressRule;
			Object.keys(signs).forEach((mod) => {
				const g = ingressGovernance(signs[mod], rule);
				expect(g.spanMonths).toBeGreaterThan(0);
				if(rule === 'quarterly'){
					expect(g.spanMonths).toBe(mod === 'cardinal' ? 3 : (mod === 'mutable' ? 6 : 12));
				}else{
					expect(g.spanMonths).toBe(12);
				}
			});
		});
		['quarterly', 'aries_annual', 'capricorn_year'].forEach((rule) => {
			Object.keys(signs).forEach((mod) => {
				const g = ingressGovernance(signs[mod], rule);
				expect(g.rule).toBe(rule);
				if(rule === 'capricorn_year'){ expect(g.note).toContain('冬至'); }
			});
		});
		// 垃圾输入回落
		expect(ingressGovernance(null, 'garbage').spanMonths).toBe(12);
		expect(ingressGovernance('nonsense', 'quarterly').spanMonths).toBe(3);   // 未知座模态 null → cardinal 支
	});
});

describe('② 黄经边界与负值风暴(Vimshottari/KP/宿)', () => {
	test('kpSubLordAt:0°/360°/720°/负值/宿界精确点全部有解且 360≡0', () => {
		[0, 360, 720, -360].forEach((lon) => {
			expect(kpSubLordAt(lon).subLord).toBe(kpSubLordAt(0).subLord);
		});
		expect(kpSubLordAt(-0.001).nakIdx).toBe(26);                   // 负小量→末宿
		const atBoundary = kpSubLordAt(13 + 20 / 60);                   // 宿 2 起点
		expect(atBoundary.nakIdx).toBe(1);
		expect(atBoundary.subLord).toBe('venus');                       // 宿 2 主金,首副=金
	});
	test('vimshottariFromMoon:359.999°(末宿末端)余额→0;跨 360 归一', () => {
		const nearEnd = vimshottariFromMoon(359.999, '2000-01-01', 365.2425);
		expect(nearEnd.nakIdx).toBe(26);
		expect(nearEnd.balanceRatio).toBeLessThan(0.001);
		expect(vimshottariFromMoon(370, '2000-01-01', 365.2425).nakIdx).toBe(vimshottariFromMoon(10, '2000-01-01', 365.2425).nakIdx);
	});
	test('munthaSign/garbha/varaLord 垃圾输入安全', () => {
		expect(munthaSign('nonsense', 3)).toBeNull();
		expect(munthaSign('aries', -1)).toBeNull();
		expect(garbhaDeliveryDate('not-a-date')).toBeNull();
		expect(varaLordOf('garbage')).toBeNull();
	});
});

describe('③ 会合分期/大年 边界', () => {
	test('computeConjunctionEras:空/单行/乱序输入安全;乱序自动按年排序', () => {
		expect(computeConjunctionEras([]).marks).toEqual([]);
		expect(computeConjunctionEras([{ year: 2000, sign: 'taurus' }]).marks).toEqual([]);
		const shuffled = [
			{ year: 2040, sign: 'libra' }, { year: 2000, sign: 'taurus' },
			{ year: 2020, sign: 'aquarius' }, { year: 2060, sign: 'gemini' },
		];
		const r = computeConjunctionEras(shuffled);
		expect(r.rows.map((x) => x.year)).toEqual([2000, 2020, 2040, 2060]);
		expect(r.marks.find((m) => m.year === 2020)).toBeTruthy();
	});
	test('detectMarsSaturnCancer 空/无巨蟹安全;ayanamsaAt 极端年不炸且单调', () => {
		expect(detectMarsSaturnCancer([])).toEqual([]);
		expect(ayanamsaAt(3000, 'fagan')).toBeGreaterThan(ayanamsaAt(-3000, 'fagan'));
		const far = computeCurrentAge(-3000, 'lahiri');
		expect(far.sign).toBeTruthy();   // 远古时代仍有解
	});
});

describe('④ mundoscope 跨 0° 宫框与缺数据', () => {
	test('跨 0° 宫(宫头 340°,下宫头 10°):宫内插值连续', () => {
		const houses = {};
		for(let i = 1; i <= 12; i++){ houses[i] = { lon: (340 + (i - 1) * 30) % 360 }; }   // 宫1头=340
		const atHead = mundoPositionOf({ lon: 340, house: 1 }, houses);
		const atMid = mundoPositionOf({ lon: 355, house: 1 }, houses);
		const nearEnd = mundoPositionOf({ lon: 9, house: 1 }, houses);
		expect(atHead).toBeCloseTo(0, 6);
		expect(atMid).toBeCloseTo(15, 6);
		expect(nearEnd).toBeCloseTo(29, 6);
	});
	test('缺 houses/缺行星/极地纬度安全', () => {
		expect(computeAngularity({ planets: {}, houses: null })).toBeNull();
		expect(isDormantChart({ planets: { sun: { lon: 5 } }, houses: {} }, 3)).toBe(true);   // 无可算行星=无入角
		expect(mundoPositionOf(null, {})).toBeNull();
	});
	test('8 盘种 × 2 口径 describeSolunar 全组合有权重', () => {
		SOLUNAR_TYPES.forEach((t) => {
			['scheme_a', 'scheme_b'].forEach((w) => {
				const d = describeSolunar(t.key, w);
				expect(d.weight).toBeGreaterThanOrEqual(1);
				expect(d.weight).toBeLessThanOrEqual(4);
			});
		});
	});
});

describe('⑤ 三类问/象限/食族/分野 空输入风暴', () => {
	test('全描述函数对 null/空 facts 返回 null 不炸', () => {
		[describeWarQuestion, describeWeatherQuestion, describePriceQuestion, describeQuadrantNations, sarosNodeType].forEach((fn) => {
			expect(fn(null)).toBeNull();
			expect(fn({})).toBeNull();
		});
		expect(describeChorography(null, 'modern')).toBeNull();
	});
	test('象限边界:食点恰在 ASC/IC/DSC/MC 上归属稳定(半开区间)', () => {
		const facts = { meta: { ascLon: 0, mcLon: 270 }, planets: {} };
		expect(describeQuadrantNations(facts, 0).quadrant).toBe('east');     // ASC 起点含
		expect(describeQuadrantNations(facts, 90).quadrant).toBe('south');   // IC 起点含
		expect(describeQuadrantNations(facts, 180).quadrant).toBe('west');
		expect(describeQuadrantNations(facts, 270).quadrant).toBe('north');
		expect(describeQuadrantNations(facts, 359.999).quadrant).toBe('north');
	});
	test('七潮盘幂等(两次构建同构);隐星集对四流派幂等', () => {
		expect(JSON.stringify(buildSaptaNadi())).toBe(JSON.stringify(buildSaptaNadi()));
		['ptolemaic', 'medieval'].forEach((k) => expect(hiddenBodiesFor(k)).toEqual(['Uranus', 'Neptune', 'Pluto']));
	});
});
