// 量化盘 AI 快照汉堡学派要素段(WP-8)守卫:默认 classic 零回归(空)、介入即附流派/差值/医学/赤纬、医疗免责、禁用词扫描。
import { buildHamburgLines } from '../AstroMidpoint';
import { SUN, MOON, MERCURY, MARS } from '../../../constants/AstroConst';

const BASE = { school: 'classic', showDiffList: false, crossPointer: false, synastryPeople: [], showDeclination: true, diffTargetAge: 30 };

describe('量化盘 汉堡学派快照段(WP-8)', () => {
	it('默认 classic 无开关 → 空数组(既有快照逐字零回归)', () => {
		expect(buildHamburgLines(BASE, [], {}, 1)).toEqual([]);
		expect(buildHamburgLines(BASE, [{ id: SUN, lon: 0 }], { declination: { parallel: [{ a: SUN, b: MOON, delta: 0.1 }] } }, 1)).toEqual([]);
	});

	it('disp 缺失 → 空数组不抛', () => {
		expect(buildHamburgLines(null, [], {}, 1)).toEqual([]);
		expect(buildHamburgLines(undefined, null, null, undefined)).toEqual([]);
	});

	it('非默认流派(纯净派)→ 出[汉堡学派要素]+流派行', () => {
		const lines = buildHamburgLines({ ...BASE, school: 'pure' }, [], {}, 1);
		expect(lines[0]).toBe('[汉堡学派要素]');
		expect(lines.some((l) => l.includes('流派') && l.includes('纯净派'))).toBe(true);
	});

	it('差值表开关(classic 也介入)→ 出差值表段', () => {
		const pts = [{ id: SUN, lon: 0 }, { id: MARS, lon: 30 }, { id: MOON, lon: 120 }];
		const lines = buildHamburgLines({ ...BASE, showDiffList: true }, pts, {}, 1);
		expect(lines[0]).toBe('[汉堡学派要素]');
		expect(lines.some((l) => l.includes('差值表'))).toBe(true);
	});

	// 门控补全:classic 派开映点/中点列表/行星图/和点/差距等用户主动开关 → 应附汉堡段(此前漏触发)。
	it('门控:classic 开 映点/中点列表/行星图/和点/差距 任一 → 出[汉堡学派要素]', () => {
		const triggers = ['showAntiscia', 'showMidpointList', 'showPlanetPicture', 'showSumPoints', 'showArcOpenings'];
		triggers.forEach((key) => {
			const lines = buildHamburgLines({ ...BASE, [key]: true }, [], {}, 1);
			expect(lines[0]).toBe('[汉堡学派要素]');
		});
	});

	// 零回归护栏:classic 默认 showHouseFrames/showDeclination 恒 true,不得进门控(否则默认即触发汉堡段)。
	it('零回归:classic 默认(含 showHouseFrames/showDeclination=true)且无主动开关 → 仍空数组', () => {
		const classicDefault = { ...BASE, showHouseFrames: true, showDeclination: true, showAntiscia: false, showMidpointList: false, showPlanetPicture: false, showSumPoints: false, showArcOpenings: false };
		expect(buildHamburgLines(classicDefault, [], {}, 1)).toEqual([]);
	});

	it('医学四液:本盘因子落 日/火 中点 → 胆汁质 + 免责句', () => {
		// Sun fold 0、Mars fold 20 → 中点折叠位 10;Mercury fold 10 命中。
		const pts = [{ id: SUN, lon: 0 }, { id: MARS, lon: 20 }, { id: MERCURY, lon: 10 }];
		const lines = buildHamburgLines({ ...BASE, school: 'pure' }, pts, {}, 1);
		expect(lines.some((l) => l.includes('胆汁质'))).toBe(true);
		expect(lines.some((l) => l.includes('不替代医疗诊断'))).toBe(true);
	});

	it('医学四液:无因子落中点 → 不报体质(避免静态噪声)', () => {
		const pts = [{ id: SUN, lon: 0 }, { id: MARS, lon: 20 }, { id: MERCURY, lon: 55 }];
		const lines = buildHamburgLines({ ...BASE, school: 'pure' }, pts, {}, 1);
		expect(lines.some((l) => l.includes('胆汁质'))).toBe(false);
	});

	it('赤纬接触:result.declination 有平行 → 出赤纬段', () => {
		const result = { declination: { parallel: [{ a: SUN, b: MOON, delta: 0.1 }], contraParallel: [] } };
		const lines = buildHamburgLines({ ...BASE, school: 'pure' }, [], result, 1);
		expect(lines.some((l) => l.includes('赤纬接触'))).toBe(true);
		expect(lines.some((l) => l.includes('平行'))).toBe(true);
	});

	it('showDeclination=false → 不出赤纬段', () => {
		const result = { declination: { parallel: [{ a: SUN, b: MOON, delta: 0.1 }], contraParallel: [] } };
		const lines = buildHamburgLines({ ...BASE, school: 'pure', showDeclination: false }, [], result, 1);
		expect(lines.some((l) => l.includes('赤纬接触'))).toBe(false);
	});

	it('六宫框:houseFrames.frames.sun.placements → 出太阳局落宫', () => {
		const result = { houseFrames: { frames: { sun: { placements: { [SUN]: 4, [MOON]: 10 } } } } };
		const lines = buildHamburgLines({ ...BASE, school: 'uranian' }, [], result, 1);
		expect(lines.some((l) => l.includes('六宫框') && l.includes('4宫'))).toBe(true);
	});

	it('禁用词扫描:无创始人/软件/书名/§', () => {
		const result = {
			declination: { parallel: [{ a: SUN, b: MOON, delta: 0.1 }], contraParallel: [] },
			houseFrames: { frames: { sun: { placements: { [SUN]: 4 } } } },
		};
		const pts = [{ id: SUN, lon: 0 }, { id: MARS, lon: 20 }, { id: MERCURY, lon: 10 }];
		const text = buildHamburgLines({ ...BASE, school: 'cosmo', showDiffList: true }, pts, result, 1).join('\n');
		const forbidden = ['\u0057\u0069\u0074\u0074\u0065', '\u0045\u0062\u0065\u0072\u0074\u0069\u006e', '\u0042\u0072\u0075\u006d\u006d\u0075\u006e\u0064', '\u0053\u006f\u006c\u0061\u0072\u0020\u0046\u0069\u0072\u0065', '\u0041\u0073\u0074\u0072\u006f\u006c\u006f\u0067'];
		expect(new RegExp(forbidden.join('|') + '|§|《|》').test(text)).toBe(false);
	});
});

// [Q-442/T-405] 六宫框全表(不受汉堡门控)与校时预览段。
describe('量化盘 快照 · 六宫框落宫全表 / 校时预览(Q-442)', () => {
	const { buildHouseFramesSection, buildRectifySection } = require('../AstroMidpoint');
	const { MC, ASC, JUPITER } = require('../../../constants/AstroConst');
	const pts = [{ id: SUN, lon: 10 }, { id: MOON, lon: 100 }, { id: MC, lon: 270 }, { id: ASC, lon: 0 }];
	const eq = (first) => Array.from({ length: 12 }, (_, i) => ((first + i * 30) % 360 + 360) % 360);
	const result = { houseFrames: { frames: {
		meridian: { cusps: eq(0), placements: { [SUN]: 1, [MOON]: 4, [MC]: 10, [ASC]: 1 } },
		sun: { cusps: eq(280) },              // 无 placements → 前端按 cusps 定宫(太阳 10°:宫头 280/310/340/10 → 落 4 宫)
		earth: { cusps: eq(180), placements: { [SUN]: 7 } },
	} } };
	it('页签开着(classic 默认)即出全框×全点表,与汉堡门控无关;placements 缺则按 cusps 定宫', () => {
		const lines = buildHouseFramesSection({ school: 'classic', showHouseFrames: true }, result, pts);
		expect(lines[0]).toBe('[六宫框落宫]');
		expect(lines[2]).toBe('| 点 | 子午局 | 太阳局 | 地球局 |');
		expect(lines).toContain('| 日 | 1 | 4 | 7 |');
		expect(lines).toContain('| 月 | 4 | 7 | 10 |');   // 地球局无该点 placements → 按 cusps 定宫
		expect(buildHamburgLines({ school: 'classic', showHouseFrames: true }, pts, result, 1)).toEqual([]);
	});
	it('页签关(showHouseFrames=false)或无 frames → 空', () => {
		expect(buildHouseFramesSection({ showHouseFrames: false }, result, pts)).toEqual([]);
		expect(buildHouseFramesSection({ showHouseFrames: true }, {}, pts)).toEqual([]);
	});
	it('校时预览:无事件不产段;有事件 → 弧°与命中(轴→因子·角距)与 rectificationHits 同源,命中合计行', () => {
		expect(buildRectifySection({ rectifyEvents: [] }, { date: '1990/01/01', time: '12:00:00' }, pts)).toEqual([]);
		// 出生 1990-01-01,事件 2000-01-01 ≈ 10 年 → Naibod 弧 ≈ 9.86°;MC 270+9.86=279.86 vs 木星 280 → 90°盘角距 0.14 命中
		const p2 = pts.concat([{ id: JUPITER, lon: 280 }]);
		const lines = buildRectifySection({ rectifyEvents: [{ label: '升职', date: '2000-01-01', type: 'career' }], orb: 1, dialBase: 90, saKey: 'naibod' }, { date: '1990/01/01', time: '12:00:00' }, p2);
		expect(lines[0]).toBe('[校时预览]');
		expect(lines).toContainEqual(expect.stringMatching(/^\| 升职 \| 事业 \| 2000-01-01 \| 9\.8\d \| .*MC→木·0\.1\d°/));
		expect(lines[lines.length - 1]).toMatch(/^命中合计：\d+$/);
	});
});
