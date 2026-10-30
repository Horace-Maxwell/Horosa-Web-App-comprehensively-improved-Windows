// 量化盘 AI 快照汉堡学派要素段(WP-8)守卫:默认 classic 零回归(空)、介入即附流派/差值/医学、医疗免责、禁用词扫描;
// 赤纬接触已拆成独立段(不受汉堡门控),守卫见文末。
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

	it('赤纬接触不再混在汉堡段里(独立段只列一次,不随流派门控)', () => {
		const result = { declination: { parallel: [{ a: SUN, b: MOON, delta: 0.1 }], contraParallel: [] } };
		const lines = buildHamburgLines({ ...BASE, school: 'pure' }, [], result, 1);
		expect(lines[0]).toBe('[汉堡学派要素]');
		expect(lines.some((l) => l.includes('赤纬'))).toBe(false);
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

// 六宫框全表(不受汉堡门控)与校时预览段。
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

// 赤纬接触独立段:与 90°中点盘右栏同一开关(缺省开)、同一份后端数据,缺省流派也进快照;关 = 无段。
describe('量化盘 快照 · 赤纬接触独立段', () => {
	const { buildDeclinationSection, buildGermanySnapshotText, germanyMidpointRequestParams } = require('../AstroMidpoint');
	const { JUPITER, SATURN, VENUS } = require('../../../constants/AstroConst');
	const par = (a, b, decA, decB) => ({ a, b, decA, decB, delta: Math.abs(decA - decB) });
	const decl = {
		parallel: [par(SUN, MOON, 20.1, 20.4), par(MARS, JUPITER, -5.48, -5.51), par(VENUS, SATURN, 1, 1.2), par(SUN, MARS, 3, 3.5), par(MOON, VENUS, 7, 7.1), par(MERCURY, SATURN, 9, 9.9), par(MERCURY, MOON, 11, 11.2)],
		contraParallel: [{ a: SATURN, b: JUPITER, decA: -22.1, decB: 22.5, delta: 0.4 }],
	};
	it('缺省 classic、开关开 → 出段,平行 / 反平行全部列出(不截前 6 对)', () => {
		const lines = buildDeclinationSection({ school: 'classic', showDeclination: true }, { declination: decl });
		expect(lines[0]).toBe('[赤纬接触]');
		expect(lines.filter((l) => /^\| 平行 \|/.test(l)).length).toBe(7);
		expect(lines.filter((l) => /^\| 反平行 \|/.test(l)).length).toBe(1);
		expect(lines).toContain('| 平行 | 火 ∥ 木 | -5.48° / -5.51° | 0.03° |');
		expect(lines).toContain('| 反平行 | 土 ⥮ 木 | -22.10° / +22.50° | 0.40° |');
	});
	it('开关缺省(undefined)= 开;关(false)= 无段;后端没给该字段 = 无段;给了但无接触 = 段头 + 「暂无」', () => {
		expect(buildDeclinationSection({}, { declination: decl })[0]).toBe('[赤纬接触]');
		expect(buildDeclinationSection({ showDeclination: false }, { declination: decl })).toEqual([]);
		expect(buildDeclinationSection({ showDeclination: true }, {})).toEqual([]);
		expect(buildDeclinationSection(null, { declination: decl })).toEqual([]);
		expect(buildDeclinationSection({ showDeclination: true }, { declination: { parallel: [], contraParallel: [] } })).toEqual(['[赤纬接触]', expect.stringMatching(/^（平行≈合/), '容许度内暂无平行 / 反平行']);
	});
	it('整份快照:同一份后端结果,开 / 关的正文差且只差这一段;缺省流派不出汉堡段', () => {
		const params = { date: '1990/05/18', time: '10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', zodiacal: 0, hsys: 1 };
		const result = { midpoints: [], aspects: {}, tnp: [], declination: decl };
		const on = buildGermanySnapshotText(params, null, result, {}, null, { school: 'classic', showDeclination: true });
		const off = buildGermanySnapshotText(params, null, result, {}, null, { school: 'classic', showDeclination: false });
		expect(on).toContain('\n[赤纬接触]\n');
		expect(off).not.toContain('赤纬接触');
		expect(on).not.toContain('[汉堡学派要素]');
		expect(on.replace(/\n\n\[赤纬接触\][\s\S]*?(?=\n\n\[|$)/, '')).toBe(off);
	});
	it('出参单源:赤纬键随开关下发(缺省开 = true),页面与无头重算同一函数', () => {
		expect(germanyMidpointRequestParams({}).declination).toBe(true);
		expect(germanyMidpointRequestParams({ showDeclination: false }).declination).toBe(false);
		expect(germanyMidpointRequestParams({ showHouseFrames: false, showEastPoint: true }).frames).toBe(true);
		expect(germanyMidpointRequestParams({ showHouseFrames: false }).frames).toBe(false);
		expect(germanyMidpointRequestParams({ strictFactors: true }).strictFactors).toBe(true);
		expect(germanyMidpointRequestParams({}, { date: 'x' }).davison).toEqual({ date: 'x' });
		const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'AstroMidpoint.js'), 'utf8');
		const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
		const code = strip(src);
		// 本命中点请求两条路(页面 requestChart / 无头 buildGermanySnapshotForFields)都经单源;伙伴盘那一路只要流派口径
		expect((code.match(/germanyMidpointRequestParams\(/g) || []).length).toBeGreaterThanOrEqual(2);   // 页面 + 无头(定义在 UranianSchools)
		expect(code).not.toMatch(/declination:\s*d(isp|ispReq)\.showDeclination/);
	});
});

// 页面中点页签:显示偏好里要后端重算的项变了 → 重取(重取后自存);只是正文口径项变了 → 只重存。
describe('量化盘 中点页 · 显示偏好变化的快照刷新', () => {
	beforeEach(() => { jest.useFakeTimers(); try{ localStorage.clear(); }catch(e){ /* ignore */ } });
	afterEach(() => { jest.useRealTimers(); });
	const mount = () => {
		const AstroMidpoint = require('../AstroMidpoint').default;
		const inst = new AstroMidpoint({ fields: null });
		inst.requestChartObj = jest.fn();
		inst.saveGermanySnapshot = jest.fn();
		inst.componentDidMount();
		inst.saveGermanySnapshot.mockClear();
		inst._lastDisplaySig = JSON.stringify(inst.midpointDisplayParams());   // 等同已按当前偏好取过一次
		return inst;
	};
	it('关赤纬 / 关六宫框 / 换流派 → 重取,不拿旧数据重存', () => {
		const { saveUranianDisplay } = require('../UranianDialStyle');
		[{ showDeclination: false }, { showHouseFrames: false }, { school: 'cosmo' }].forEach((patch) => {
			const inst = mount();
			saveUranianDisplay(patch);
			jest.advanceTimersByTime(300);
			expect(inst.requestChartObj).toHaveBeenCalledTimes(1);
			expect(inst.saveGermanySnapshot).not.toHaveBeenCalled();
			inst.componentWillUnmount();
			localStorage.clear();
		});
	});
	it('只改正文口径(校时事件)→ 只重存', () => {
		const { saveUranianDisplay } = require('../UranianDialStyle');
		const inst = mount();
		saveUranianDisplay({ rectifyEvents: [{ label: 'a', date: '2000-01-01', type: 'career' }] });
		jest.advanceTimersByTime(300);
		expect(inst.requestChartObj).not.toHaveBeenCalled();
		expect(inst.saveGermanySnapshot).toHaveBeenCalledTimes(1);
		inst.componentWillUnmount();
	});
});

describe('公式求解段(写了公式才进,不受汉堡门控)', ()=>{
	const { buildFormulaSection } = require('../AstroMidpoint');
	const AC = require('../../../constants/AstroConst');
	const pts = [{ id: AC.SUN, lon: 10 }, { id: AC.MOON, lon: 100 }, { id: AC.MARS, lon: 350 }, { id: AC.MC, lon: 30.4 }];
	it('缺省(没写公式)不成段', ()=>{
		expect(buildFormulaSection({ school: 'classic' }, pts)).toEqual([]);
		expect(buildFormulaSection({ school: 'classic', formula: '  ' }, pts)).toEqual([]);
	});
	it('写了公式:敏感点 + 落点,与盘面同一函数(90° 盘 120 ≡ 30,天顶 30.4 差 0.4)', ()=>{
		const lines = buildFormulaSection({ school: 'classic', formula: '日+月−火', dialBase: 90, orb: 1 }, pts);
		expect(lines[0]).toBe('[公式求解]');
		expect(lines[1]).toBe('公式：日+月−火 → 敏感点 120.00° · 盘基 H4 90° · 容许 1°');
		expect(lines[2]).toBe('落点：天顶 0.40°');
	});
	it('写错时照实报原因', ()=>{
		expect(buildFormulaSection({ formula: '日+' }, pts)[1]).toMatch(/无法求值/);
	});
});

describe('中点坐标段(选了赤经 / 赤纬且后端按该坐标回数才进)', ()=>{
	const { buildCoordMidpointSection } = require('../AstroMidpoint');
	const result = { coordMidpoints: { coord: 'decl', midpoints: [], contacts: [{ idA: 'Sun', idB: 'Moon', id: 'Mars', aspect: 'contraParallel', delta: 0.31 }] } };
	it('缺省黄经 / 坐标不符 / 没有数据都不成段', ()=>{
		expect(buildCoordMidpointSection({ mpCoord: 'lon' }, result)).toEqual([]);
		expect(buildCoordMidpointSection({ mpCoord: 'ra' }, result)).toEqual([]);
		expect(buildCoordMidpointSection({ mpCoord: 'decl' }, {})).toEqual([]);
	});
	it('赤纬:逐条列接触', ()=>{
		const lines = buildCoordMidpointSection({ mpCoord: 'decl' }, result);
		expect(lines[0]).toBe('[中点坐标]');
		expect(lines[1]).toMatch(/^坐标：赤纬/);
		expect(lines[2]).toMatch(/反平行 .*\/.* · 差 0\.31°$/);
	});
});
