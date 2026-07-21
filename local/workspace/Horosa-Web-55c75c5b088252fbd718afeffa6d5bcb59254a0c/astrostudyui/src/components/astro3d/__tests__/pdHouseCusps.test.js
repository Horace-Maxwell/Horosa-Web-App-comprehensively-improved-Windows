// [E1·显示] 后天宫位宫首计算 · 正确性金标(对后端 fixture 逐点核 + 分宫机制 + 对宫不变量)。
import fs from 'fs';
import path from 'path';
import { houseCusps, mcLon, ascLon } from '../pdHouseCusps';

const FX = JSON.parse(fs.readFileSync(path.join(__dirname, '__fixtures__', 'pd3d.alcabitius.json'), 'utf8'));
const RAMC = FX.frame.armc;
const PHI = FX.frame.phi;
const EPS = FX.frame.epsMean;
const ASC_REF = FX.points.N_Asc_0.lon;
const MC_REF = FX.points.N_MC_0.lon;
const d180 = (a, b)=>Math.abs(((a - b + 540) % 360) - 180);

describe('[E1] 后天宫位宫首 · 与后端逐点核 + 分宫机制', ()=>{
	test('🔴 ASC/MC 闭式对后端 N_Asc_0/N_MC_0 逐点吻合(<0.05°)', ()=>{
		expect(d180(mcLon(RAMC, EPS), MC_REF)).toBeLessThan(0.05);
		expect(d180(ascLon(RAMC, PHI, EPS), ASC_REF)).toBeLessThan(0.05);
	});

	// 象限宫制:第1宫≡ASC 且 第10宫≡MC(位置圈/半弧类均须锚回真 ASC/MC);对宫恒 180°。
	const QUADRANT_SYSTEMS = ['porphyry', 'core_alchabitius', 'regiomontanus', 'topocentric', 'placidus'];
	QUADRANT_SYSTEMS.forEach((sys)=>{
		test(`${sys}:12 宫首齐全 + 第1宫≡ASC + 第10宫≡MC + 对宫恒 180°`, ()=>{
			const { cusps, full } = houseCusps(sys, RAMC, PHI, EPS);
			expect(full).toBe(true);
			expect(cusps.length).toBe(12);
			cusps.forEach((c)=>{ expect(Number.isFinite(c)).toBe(true); });
			expect(d180(cusps[0], ASC_REF)).toBeLessThan(0.06);
			expect(d180(cusps[9], MC_REF)).toBeLessThan(0.06);
			for(let i = 0; i < 6; i += 1){ expect(d180(cusps[i], cusps[i + 6])).toBeGreaterThan(180 - 1e-6); }
		});
	});

	test('equal_ecliptic:第1宫≡ASC(MC 不落 10 宫,等宫本义)+ 12 宫齐全 + 对宫 180°', ()=>{
		const { cusps, full } = houseCusps('equal_ecliptic', RAMC, PHI, EPS);
		expect(full).toBe(true);
		cusps.forEach((c)=>{ expect(Number.isFinite(c)).toBe(true); });
		expect(d180(cusps[0], ASC_REF)).toBeLessThan(0.06);
		for(let i = 0; i < 6; i += 1){ expect(d180(cusps[i], cusps[i + 6])).toBeGreaterThan(180 - 1e-6); }
	});

	test('meridian:赤经等分(第10宫≡MC;命宫=赤道升点,不锚 ASC)+ 对宫 180°', ()=>{
		const { cusps, full } = houseCusps('meridian', RAMC, PHI, EPS);
		expect(full).toBe(true);
		expect(d180(cusps[9], MC_REF)).toBeLessThan(0.06);
		for(let i = 0; i < 6; i += 1){ expect(d180(cusps[i], cusps[i + 6])).toBeGreaterThan(180 - 1e-6); }
	});

	test('equal_ecliptic:严格黄道 30° 等分(逐宫差恒 30°)', ()=>{
		const { cusps } = houseCusps('equal_ecliptic', RAMC, PHI, EPS);
		for(let i = 0; i < 12; i += 1){ expect(d180(cusps[i], cusps[0] + i * 30)).toBeLessThan(1e-6); }
	});

	test('porphyry:黄道象限三分(10→1 宫等分 3 段)', ()=>{
		const { cusps } = houseCusps('porphyry', RAMC, PHI, EPS);
		const q = ((cusps[0] - cusps[9] + 360) % 360) / 3;
		expect(d180(cusps[10], cusps[9] + q)).toBeLessThan(1e-6);
		expect(d180(cusps[11], cusps[9] + 2 * q)).toBeLessThan(1e-6);
	});

	test('core_alchabitius(默认)宫首落在合理象限内(11/12宫介于MC与ASC之间的黄经带)', ()=>{
		const { cusps } = houseCusps('core_alchabitius', RAMC, PHI, EPS);
		// 11、12 宫应在 MC→ASC 之间(顺黄经);用「相对 MC 的弧」单调递增判据
		const rel = (x)=>((x - cusps[9] + 360) % 360);
		expect(rel(cusps[10])).toBeGreaterThan(0);
		expect(rel(cusps[10])).toBeLessThan(rel(cusps[11]));
		expect(rel(cusps[11])).toBeLessThan(rel(cusps[0]));   // < 到 ASC 的弧
	});

	test('campanus:暂只四轴(full=false,不臆造中间宫;四轴仍在)', ()=>{
		const { cusps, full } = houseCusps('campanus', RAMC, PHI, EPS);
		expect(full).toBe(false);
		expect(d180(cusps[0], ASC_REF)).toBeLessThan(0.06);
		expect(d180(cusps[9], MC_REF)).toBeLessThan(0.06);
		expect(cusps[10]).toBe(null);
	});
});
