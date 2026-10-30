import * as AstroConst from '../../constants/AstroConst';
import { evaluateFormula, solveFormula, formulaHitText } from '../uranianFormula';

const P = [
	{ id: AstroConst.SUN, lon: 10 },
	{ id: AstroConst.MOON, lon: 100 },
	{ id: AstroConst.MARS, lon: 350 },
	{ id: AstroConst.SATURN, lon: 200 },
	{ id: AstroConst.ASC, lon: 125 },
	{ id: AstroConst.MC, lon: 35 },
	{ id: AstroConst.CUPIDO, lon: 290 },
];

describe('公式求值', ()=>{
	it('和差:日+月−火 = 10 + 100 − 350 ≡ 120', ()=>{
		const r = evaluateFormula('日+月−火', P);
		expect(r.ok).toBe(true);
		expect(r.lon).toBeCloseTo(120, 9);
		expect(r.used).toEqual([AstroConst.SUN, AstroConst.MOON, AstroConst.MARS]);
	});
	it('中点:日/月 = 55(近轴);火/日 跨 0° 取 0', ()=>{
		expect(evaluateFormula('日/月', P).lon).toBeCloseTo(55, 9);
		expect(evaluateFormula('火/日', P).lon).toBeCloseTo(0, 9);
	});
	it('全名 / 英文 id / 缩写 / 度数 / 括号 混写等价', ()=>{
		const a = evaluateFormula('太阳+月亮-火星', P).lon;
		expect(evaluateFormula('Sun + moon - MARS', P).lon).toBeCloseTo(a, 9);
		expect(evaluateFormula('Su+Mo-Ma', P).lon).toBeCloseTo(a, 9);
		// 火 350 / 土 200 的近轴中点 = 275(离火 75°,不翻转),再加 15°30′
		expect(evaluateFormula('(火/土)+15°30′', P).lon).toBeCloseTo(290.5, 9);
		expect(evaluateFormula('上升+天顶-日', P).lon).toBeCloseTo(150, 9);
		expect(evaluateFormula('Cu-12.5', P).lon).toBeCloseTo(277.5, 9);
	});
	it('出错时给原因,不抛异常', ()=>{
		expect(evaluateFormula('日+', P)).toMatchObject({ ok: false });
		expect(evaluateFormula('日+冥王星', P).error).toMatch(/盘上没有/);
		expect(evaluateFormula('日+xyz', P).error).toMatch(/认不出/);
		expect(evaluateFormula('(日+月', P).error).toMatch(/括号/);
		expect(evaluateFormula('', P)).toEqual({ ok: false, error: '' });
	});
});

describe('公式求解命中', ()=>{
	it('按盘基折叠找落点:90° 盘上 120 ≡ 30,MC 35 差 5 不中、容许 5 才中', ()=>{
		expect(solveFormula('日+月−火', P, 90, 1).hits.length).toBe(0);
		const r = solveFormula('日+月−火', P, 90, 5);
		expect(r.hits.map(formulaHitText)).toContain('天顶 5.00°');
	});
	it('中点命中与聚焦因子', ()=>{
		// 加一颗木星在 55° = 日 10 / 月 100 的中点:木星本身与 日/月 中点同时命中
		const pts = P.concat([{ id: AstroConst.JUPITER, lon: 55 }]);
		const r = solveFormula('木', pts, 360, 0.01);
		expect(r.hits.map(formulaHitText)).toEqual(['木星 0.00°', '太阳/月亮 0.00°']);
		// 聚焦因子:只留含月亮的命中
		const focused = solveFormula('木', pts, 360, 0.01, { focus: AstroConst.MOON }).hits;
		expect(focused.map(formulaHitText)).toEqual(['太阳/月亮 0.00°']);
	});
});

describe('公式求解 · 繁体界面照屏幕输入', () => {
  it('「太陽+月亮−火星」折回简体后与简体写法同值', () => {
    const { toMatchKey } = require('../scriptConvert/hantConverter');
    const { evaluateFormula } = require('../uranianFormula');
    const pts = [{ id: 'Sun', lon: 10 }, { id: 'Moon', lon: 50 }, { id: 'Mars', lon: 100 }];
    const hans = evaluateFormula('太阳+月亮−火星', pts);
    const hant = evaluateFormula('太陽+月亮−火星', pts, { fold: toMatchKey });
    expect(hans.ok).toBe(true);
    expect(hant).toEqual(hans);
    expect(evaluateFormula('太陽+月亮−火星', pts, { fold: (s) => s }).ok).toBe(false);
  });
});
