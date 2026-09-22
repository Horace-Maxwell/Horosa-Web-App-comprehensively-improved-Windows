// 宫主派生单源自证(Windows #79 根治):整宫制宫主表必须与后端 ruleHouses(快照 nR 标记)逐宫互为反查,
// 分宫制宫神星表与整宫表在「截段星座」盘上必须分叉(两表 by construction 不同源不同义)。
import fs from 'fs';
import path from 'path';
import {
	buildWholeSignRulerRows, buildHouseSystemRulerRows, resolveHouseSystem, resolveAscSign,
	wholeSignHouseOf, rulerOfSign, signOfLon, houseNumOfId,
	WHOLE_SIGN_RULERS_HEADERS, HOUSE_SYSTEM_RULERS_HEADERS,
} from '../wholeSignRulers';
import { getPlanetHouseInfo } from '../planetHouseInfo';

const REAL = JSON.parse(fs.readFileSync(path.join(__dirname, '../../divination/engine/__tests__/fixtures/realChartResult.json'), 'utf8'));
const BASE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/astroV2Baseline.json'), 'utf8')).chartObj;

describe('整宫制宫主表 ↔ 后端 ruleHouses(nR 宫主标记)逐宫对拍(两夹具)', ()=>{
	[['realChartResult(Regiomontanus,七政皆带 ruleHouses)', REAL], ['astroV2Baseline(Alcabitius,三颗带 ruleHouses)', BASE]].forEach(([name, co])=>{
		it(name, ()=>{
			const rows = buildWholeSignRulerRows(co);
			expect(rows.length).toBe(12);
			expect(rows.map((r)=>r.house)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
			const withRules = co.chart.objects.filter((o)=>Array.isArray(o.ruleHouses));
			expect(withRules.length).toBeGreaterThan(0);
			// 反查①:每颗带 ruleHouses 的行星,后端 nR 集合 == 整宫表里「宫主为它」的宫号集合(外行星 [] == [])。
			withRules.forEach((o)=>{
				const expected = rows.filter((r)=>r.ruler === o.id).map((r)=>r.house);
				expect(getPlanetHouseInfo(o).ruleNums).toEqual(expected);
			});
			// 反查②:整宫表每宫的宫主若带 ruleHouses,则该宫必在其 nR 集合里。
			rows.forEach((r)=>{
				const o = co.chart.objects.find((x)=>x.id === r.ruler);
				if(o && Array.isArray(o.ruleHouses)){
					expect(getPlanetHouseInfo(o).ruleNums).toContain(r.house);
				}
			});
		});
	});

	it('基线盘:整宫 1 宫巨蟹→月落第五宫天蝎;5/10 宫火星(缺分宫落宫)整宫落第九宫双鱼 —— 与分宫表 by construction 不同', ()=>{
		const ws = buildWholeSignRulerRows(BASE);
		const hs = buildHouseSystemRulerRows(BASE);
		expect(ws[0]).toMatchObject({ house: 1, sign: 'Cancer', ruler: 'Moon', rulerFound: true, rulerHouseNum: 5, rulerHouseId: 'House5', rulerSign: 'Scorpio' });
		expect(ws[4]).toMatchObject({ house: 5, sign: 'Scorpio', ruler: 'Mars', rulerFound: true, rulerHouseNum: 9, rulerHouseId: 'House9', rulerSign: 'Pisces' });
		expect(hs[4]).toMatchObject({ house: 5, sign: 'Scorpio', ruler: 'Mars', rulerFound: true, rulerHouseNum: null, rulerHouseId: null, rulerSign: 'Pisces' });
		// 该夹具宫头恰逐座相接 → 前三列两表相等,落宫列不等(整宫按星座、分宫按后端 obj.house)。
		expect(hs.map((r)=>[r.house, r.sign, r.ruler])).toEqual(ws.map((r)=>[r.house, r.sign, r.ruler]));
		expect(hs.map((r)=>r.rulerHouseNum)).not.toEqual(ws.map((r)=>r.rulerHouseNum));
	});
});

// 截段星座判别盘:Asc 巨蟹 25°、2 宫头处女 2°、太阳狮子 28° 落 House1、月巨蟹 10° 落 House12(上升之前)。
const mkSplit = (extra = {})=>({
	chart: {
		hsys: 'Alcabitius',
		houses: [
			{ id: 'House1', sign: 'Cancer', lon: 115 }, { id: 'House2', sign: 'Virgo', lon: 152 }, { id: 'House3', sign: 'Libra', lon: 185 },
			{ id: 'House4', sign: 'Scorpio', lon: 215 }, { id: 'House5', sign: 'Sagittarius', lon: 248 }, { id: 'House6', sign: 'Capricorn', lon: 280 },
			{ id: 'House7', sign: 'Capricorn', lon: 295 }, { id: 'House8', sign: 'Pisces', lon: 332 }, { id: 'House9', sign: 'Aries', lon: 5 },
			{ id: 'House10', sign: 'Taurus', lon: 35 }, { id: 'House11', sign: 'Gemini', lon: 68 }, { id: 'House12', sign: 'Cancer', lon: 100 },
		],
		objects: [
			{ id: 'Asc', sign: 'Cancer', lon: 115 },
			{ id: 'Sun', sign: 'Leo', lon: 148, house: 'House1' },
			{ id: 'Moon', sign: 'Cancer', lon: 100, house: 'House12' },
			{ id: 'Mercury', sign: 'Virgo', lon: 160, house: 'House2' },
			{ id: 'Venus', sign: 'Leo', lon: 130, house: 'House1' },
			{ id: 'Mars', lon: 250, house: 'House5' },                  // 只有 lon 无 sign → 射手
			{ id: 'Jupiter', sign: 'Pisces', lon: 340, house: 'House8' },
			{ id: 'Saturn', sign: 'Capricorn', lon: 290, house: 'House6' },
		],
		...extra,
	},
	params: { hsys: 1 },
	lots: [],
});

describe('截段星座盘:整宫表 vs 分宫表分叉(2 宫=狮子/日 vs 处女/水;月 1 宫 vs 12 宫)', ()=>{
	const ws = buildWholeSignRulerRows(mkSplit());
	const hs = buildHouseSystemRulerRows(mkSplit());
	it('整宫 2 宫=狮子 宫主日 落第二宫(整宫);分宫 2 宫=处女 宫主水 落 House2', ()=>{
		expect(ws[1]).toMatchObject({ house: 2, sign: 'Leo', ruler: 'Sun', rulerHouseNum: 2, rulerSign: 'Leo' });
		expect(hs[1]).toMatchObject({ house: 2, sign: 'Virgo', ruler: 'Mercury', rulerHouseNum: 2, rulerSign: 'Virgo' });
	});
	it('1 宫巨蟹 宫主月:整宫落第一宫(月在上升座),分宫落 House12(后端实际落宫)', ()=>{
		expect(ws[0]).toMatchObject({ house: 1, sign: 'Cancer', ruler: 'Moon', rulerHouseNum: 1 });
		expect(hs[0]).toMatchObject({ house: 1, sign: 'Cancer', ruler: 'Moon', rulerHouseNum: 12 });
	});
	it('宫主只有 lon 无 sign → 由黄经定座(火星 250° → 射手);整宫落宫=射手相对巨蟹=第六宫', ()=>{
		const aries = ws.find((r)=>r.sign === 'Aries');
		expect(aries).toMatchObject({ ruler: 'Mars', rulerSign: 'Sagittarius', rulerHouseNum: 6 });
	});
	it('分宫表:同一星座连占两宫头(6/7 宫皆摩羯)各出一行;宫号按 h.id 真号排序而非数组序', ()=>{
		expect(hs.map((r)=>r.house)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
		expect(hs[5]).toMatchObject({ house: 6, sign: 'Capricorn', ruler: 'Saturn' });
		expect(hs[6]).toMatchObject({ house: 7, sign: 'Capricorn', ruler: 'Saturn' });
	});
	it('表头常量逐字(快照与页面共用)', ()=>{
		expect(WHOLE_SIGN_RULERS_HEADERS).toEqual(['宫', '整宫星座', '宫主', '宫主落宫(整宫)', '宫主落座']);
		expect(HOUSE_SYSTEM_RULERS_HEADERS).toEqual(['宫', '宫头座', '宫主', '宫主落宫', '宫主落座']);
	});
});

describe('resolveHouseSystem 矩阵(只有上升整宫制 0/"Whole Sign" 判真;福点整宫制 24 恒假)', ()=>{
	const cases = [
		[{ params: { hsys: 0 }, chart: {} }, null, '0', true, '整宫制'],
		[{ params: { hsys: '0' }, chart: { hsys: 'Whole Sign' } }, null, '0', true, '整宫制'],
		[{ params: {}, chart: { hsys: 'Whole Sign' } }, null, '0', true, '整宫制'],
		[{ params: {}, chart: { hsys: '整宫制' } }, null, '0', true, '整宫制'],
		[{ params: { hsys: 1 }, chart: { hsys: 'Alcabitius' } }, null, '1', false, 'Alcabitus'],
		[{ params: {}, chart: { hsys: 'Alcabitius' } }, null, '1', false, 'Alcabitus'],
		[{ params: { hsys: 24 }, chart: { hsys: 'Fortuna_Whole' } }, null, '24', false, '福点整宫制'],
		[{ params: {}, chart: { hsys: 'Fortuna_Whole' } }, null, null, false, 'Fortuna_Whole'],
		[{ params: {}, chart: { hsys: '福点整宫制' } }, null, '24', false, '福点整宫制'],
		[{ params: { hsys: 2 }, chart: { hsys: 'Regiomontanus' } }, null, '2', false, 'Regiomontanus'],
		[{ params: {}, chart: { hsys: 'Regiomontanus' } }, null, '2', false, 'Regiomontanus'],
		[{ params: {}, chart: {} }, null, null, false, ''],
		// fields 数字位优先于 params/echo(fields 就是发出去的入参)
		[{ params: { hsys: 1 }, chart: { hsys: 'Alcabitius' } }, { hsys: { value: '0' } }, '0', true, '整宫制'],
		[{ params: { hsys: 0 }, chart: { hsys: 'Whole Sign' } }, { hsys: { value: 3 } }, '3', false, 'Placidus'],
		[{ params: { hsys: 0 }, chart: {} }, { hsys: 24 }, '24', false, '福点整宫制'],
	];
	cases.forEach(([co, fields, num, whole, label], i)=>{
		it(`#${i} params.hsys=${JSON.stringify(co.params.hsys)} chart.hsys=${JSON.stringify(co.chart.hsys)} fields=${JSON.stringify(fields)}`, ()=>{
			expect(resolveHouseSystem(co, fields)).toEqual({ num, label, isAscWholeSign: whole });
		});
	});
});

describe('极区回退与文本兜底撞名消歧(压测实抓)', ()=>{
	const H = (n, sign, size, extra)=>({ id: `House${n}`, sign, lon: 0, size: size === undefined ? 30 : size, ...(extra || {}) });
	it('houses[].hsysFallback(后端极区兜底 Porphyry)→ 表头说真话:Placidus→回退Porphyry;num 仍按请求位', ()=>{
		const co = { params: { hsys: 3 }, chart: { hsys: 'Placidus', houses: [H(1, 'Aries', 40, { hsysFallback: 'Porphyry' }), H(2, 'Taurus', 20, { hsysFallback: 'Porphyry' })] } };
		expect(resolveHouseSystem(co, null)).toEqual({ num: '3', label: 'Placidus→回退Porphyry', isAscWholeSign: false, fallback: 'Porphyry' });
	});
	it('后端回退名是 flatlib 拼写(Porphyrius)也译成选项表标签', ()=>{
		const co = { params: { hsys: 4 }, chart: { houses: [H(1, 'Aries', 40, { hsysFallback: 'Porphyrius' })] } };
		expect(resolveHouseSystem(co, null).label).toBe('Koch→回退Porphyry');
	});
	it('数字位缺失 + 回显 "Whole Sign" 但 House1 星座≠上升星座 → 判 24 福点整宫制(不折叠)', ()=>{
		const co = { params: {}, chart: { hsys: 'Whole Sign', objects: [{ id: 'Asc', sign: 'Aries', lon: 10 }], houses: [H(1, 'Gemini')] } };
		expect(resolveHouseSystem(co, null)).toEqual({ num: '24', label: '福点整宫制', isAscWholeSign: false });
	});
	it('数字位缺失 + 回显 "Whole Sign" 且 House1 星座=上升星座 → 仍是 0 上升整宫制', ()=>{
		const co = { params: {}, chart: { hsys: 'Whole Sign', objects: [{ id: 'Asc', sign: 'Aries', lon: 10 }], houses: [H(1, 'Aries')] } };
		expect(resolveHouseSystem(co, null)).toEqual({ num: '0', label: '整宫制', isAscWholeSign: true });
	});
	it('数字位缺失 + 回显 "Alcabitus" 但 12 宫 size 全 30° → 判 8 天顶为10宫中点等宫制', ()=>{
		const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
		const co = { params: {}, chart: { hsys: 'Alcabitus', houses: signs.map((s, i)=>H(i + 1, s, 30)) } };
		expect(resolveHouseSystem(co, null).num).toBe('8');
		const co2 = { params: {}, chart: { hsys: 'Alcabitus', houses: signs.map((s, i)=>H(i + 1, s, i === 3 ? 42.5 : 30)) } };
		expect(resolveHouseSystem(co2, null).num).toBe('1');
	});
	it('数字位在场时消歧不介入(fields/params 就是发出去的入参)', ()=>{
		const co = { params: { hsys: 0 }, chart: { hsys: 'Whole Sign', objects: [{ id: 'Asc', sign: 'Aries', lon: 10 }], houses: [H(1, 'Gemini')] } };
		expect(resolveHouseSystem(co, null).num).toBe('0');
	});
	it('大小写/空格奇形回显:trim 后精确匹配,认不出=原样标签且不折叠(安全方向)', ()=>{
		expect(resolveHouseSystem({ params: {}, chart: { hsys: 'Placidus ' } }, null)).toEqual({ num: '3', label: 'Placidus', isAscWholeSign: false });
		expect(resolveHouseSystem({ params: {}, chart: { hsys: 'placidus' } }, null)).toEqual({ num: null, label: 'placidus', isAscWholeSign: false });
		expect(resolveHouseSystem({ params: {}, chart: { hsys: 'whole_sign' } }, null)).toEqual({ num: null, label: 'whole_sign', isAscWholeSign: false });
	});
});

describe('边界:上升回退链 / 缺宫主对象 / 无上升空表 / 基础函数', ()=>{
	it('缺 Asc 对象 → House1.sign;再缺 → Asc.lon;再缺 → House1.lon;全缺 → null → 整宫表 []', ()=>{
		expect(resolveAscSign({ chart: { houses: [{ id: 'House1', sign: 'Leo' }], objects: [] } })).toBe('Leo');
		expect(resolveAscSign({ chart: { houses: [], objects: [{ id: 'Asc', lon: 200 }] } })).toBe('Libra');
		expect(resolveAscSign({ chart: { houses: [{ id: 'House1', lon: 359.9 }], objects: [] } })).toBe('Pisces');
		expect(resolveAscSign({ chart: { houses: [], objects: [] } })).toBe(null);
		expect(buildWholeSignRulerRows({ chart: { houses: [], objects: [] } })).toEqual([]);
		expect(buildWholeSignRulerRows(null)).toEqual([]);
		expect(buildHouseSystemRulerRows(null)).toEqual([]);
	});
	it('宫主对象缺 → rulerFound=false(cell 由调用方编码为 —);宫主在但缺 sign/lon/house → 落宫落座 null', ()=>{
		const co = { chart: { houses: [{ id: 'House1', sign: 'Aries' }], objects: [{ id: 'Asc', sign: 'Aries' }, { id: 'Venus' }] } };
		const ws = buildWholeSignRulerRows(co);
		expect(ws[0]).toMatchObject({ house: 1, sign: 'Aries', ruler: 'Mars', rulerFound: false, rulerHouseNum: null, rulerHouseId: null, rulerSign: null });
		expect(ws[1]).toMatchObject({ house: 2, sign: 'Taurus', ruler: 'Venus', rulerFound: true, rulerHouseNum: null, rulerHouseId: null, rulerSign: null });
		const hs = buildHouseSystemRulerRows(co);
		expect(hs).toHaveLength(1);
		expect(hs[0]).toMatchObject({ house: 1, sign: 'Aries', ruler: 'Mars', rulerFound: false });
	});
	it('分宫表:houses 缺 sign 有 lon 兜底定座;缺 id/非法宫号/无效星座 → 跳过', ()=>{
		const co = { chart: { houses: [{ id: 'House2', lon: 40 }, { id: 'House13', sign: 'Leo' }, { sign: 'Leo' }, { id: 'House1', sign: 'Nope' }], objects: [{ id: 'Venus', sign: 'Gemini', house: 'House3' }] } };
		const hs = buildHouseSystemRulerRows(co);
		expect(hs).toEqual([{ house: 2, sign: 'Taurus', ruler: 'Venus', rulerFound: true, rulerHouseNum: 3, rulerHouseId: 'House3', rulerSign: 'Gemini' }]);
	});
	it('wholeSignHouseOf / rulerOfSign / signOfLon / houseNumOfId', ()=>{
		expect(wholeSignHouseOf('Cancer', 'Cancer')).toBe(1);
		expect(wholeSignHouseOf('Gemini', 'Cancer')).toBe(12);
		expect(wholeSignHouseOf('Pisces', 'Cancer')).toBe(9);
		expect(wholeSignHouseOf('Nope', 'Cancer')).toBe(null);
		expect(rulerOfSign('Scorpio')).toBe('Mars');
		expect(rulerOfSign('Aquarius')).toBe('Saturn');
		expect(rulerOfSign('Pisces')).toBe('Jupiter');
		expect(rulerOfSign('Nope')).toBe(null);
		expect(signOfLon(-1)).toBe('Pisces');
		expect(signOfLon(720)).toBe('Aries');
		expect(signOfLon('abc')).toBe(null);
		expect(houseNumOfId('House 12')).toBe(12);
		expect(houseNumOfId('House0')).toBe(null);
		expect(houseNumOfId(null)).toBe(null);
	});
	it('纯函数:不改入参(chartObj 不被挂派生键)', ()=>{
		const co = mkSplit();
		const before = JSON.stringify(co);
		buildWholeSignRulerRows(co);
		buildHouseSystemRulerRows(co);
		resolveHouseSystem(co, null);
		expect(JSON.stringify(co)).toBe(before);
	});
});
