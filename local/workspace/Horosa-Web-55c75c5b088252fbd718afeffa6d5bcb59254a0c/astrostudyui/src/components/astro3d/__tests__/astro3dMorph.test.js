// 3D 星盘 WS-1b 金标:改时间滑移补间 —— 最短弧纯数学 + easeInOutCubic + flag 分支静态哨兵。
// ⚠️ Astro3D 本体依赖 WebGL/DOM(jsdom 不可实例化),补间数学抽 morphMath 纯模块直测;
//    setParams 的 flag 门/旧路径兜底由源码静态哨兵钉住(与 astro3dWs0.test 同范式)。
import fs from 'fs';
import path from 'path';
import { norm360, shortestArcDelta, easeInOutCubic } from '../morphMath';

const SRC = fs.readFileSync(path.join(__dirname, '..', 'Astro3D.js'), 'utf8');
const FLAGS = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'utils', 'perfFlags.js'), 'utf8');

describe('最短弧 shortestArcDelta(黄经差取劣弧,跨 0°/360° 不绕远)', () => {
	test('359° → 1°:走 +2°,不走 −358°', () => {
		expect(shortestArcDelta(359, 1)).toBe(2);
	});
	test('1° → 359°:走 −2°', () => {
		expect(shortestArcDelta(1, 359)).toBe(-2);
	});
	test('180° 边界:对跖点两向等距,|Δ|=180 且取值确定(−180)', () => {
		expect(Math.abs(shortestArcDelta(0, 180))).toBe(180);
		expect(Math.abs(shortestArcDelta(90, 270))).toBe(180);
		expect(shortestArcDelta(0, 180)).toBe(shortestArcDelta(30, 210));
	});
	test('同点 Δ=0;劣弧内保号', () => {
		expect(shortestArcDelta(100, 100)).toBe(0);
		expect(shortestArcDelta(10, 100)).toBe(90);
		expect(shortestArcDelta(100, 10)).toBe(-90);
	});
	test('全域抽样:|Δ|≤180 且 起点+Δ ≡ 终点 (mod 360)', () => {
		for(let i = 0; i < 48; i += 1){
			const from = (i * 37.5) % 360;
			const to = (i * 91.25 + 13.3) % 360;
			const d = shortestArcDelta(from, to);
			expect(Math.abs(d)).toBeLessThanOrEqual(180);
			expect(norm360(from + d)).toBeCloseTo(norm360(to), 9);
		}
	});
	test('norm360 归一化到 [0,360)', () => {
		expect(norm360(-30)).toBe(330);
		expect(norm360(360)).toBe(0);
		expect(norm360(725)).toBe(5);
	});
});

describe('easeInOutCubic(滑移补间缓动)', () => {
	test('端点/中点', () => {
		expect(easeInOutCubic(0)).toBe(0);
		expect(easeInOutCubic(1)).toBe(1);
		expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 12);
	});
	test('单调不减(缓动无回摆)', () => {
		let prev = -1;
		for(let k = 0; k <= 20; k += 1){
			const v = easeInOutCubic(k / 20);
			expect(v).toBeGreaterThanOrEqual(prev);
			prev = v;
		}
	});
});

describe('flag 分支静态哨兵(horosa.perf.astro3dMorph=0 时 setParams 走旧全量重建)', () => {
	test('setParams 补间分支被 astro3dMorphEnabled() 门控且可整体短路', () => {
		expect(SRC).toMatch(/astro3dMorphEnabled\(\)\s*&&\s*this\.canMorph\(option\)\s*&&\s*this\.updateFromChart\(/);
	});
	test('flag 关时旧路径在位:disposeMesh+initOption 全量重建仍是 setParams 兜底', () => {
		const idx = SRC.indexOf('setParams(option){');
		expect(idx).toBeGreaterThan(-1);
		const body = SRC.slice(idx, idx + 1800);
		expect(body).toContain('this.disposeMesh()');
		expect(body).toContain('this.initOption(option)');
		// 补间门必须先于全量重建(否则 flag 无从短路)
		expect(body.indexOf('astro3dMorphEnabled()')).toBeLessThan(body.indexOf('this.disposeMesh()'));
	});
	test('perfFlags 提供 astro3dMorphEnabled,默认开(flagEnabled 语义:仅显式 0 关)', () => {
		expect(FLAGS).toMatch(/export function astro3dMorphEnabled\(\)\{[\s\S]*?flagEnabled\('horosa\.perf\.astro3dMorph'\)/);
	});
	test('坐标语义变化仍走全量重建:canMorph 核对 zodiacal/hsys/southchart', () => {
		const idx = SRC.indexOf('canMorph(option){');
		expect(idx).toBeGreaterThan(-1);
		const seg = SRC.slice(idx, idx + 1800);
		expect(seg).toContain("'zodiacal'");
		expect(seg).toContain("'hsys'");
		expect(seg).toContain("'southchart'");
	});
	test('补间挂按需渲染:startMorph 置 _tweenActive(WS-0 needsFrames 已消费该位)', () => {
		const idx = SRC.indexOf('startMorph(plan){');
		expect(idx).toBeGreaterThan(-1);
		const seg = SRC.slice(idx, SRC.indexOf('finishMorph(plan, token){'));
		expect(seg).toContain('this._tweenActive = true');
		expect(seg).toContain('easeInOutCubic(');
	});
	test('恒星/28宿层不入补间计划(它们不随时间变,只随 ASC 整组旋转)', () => {
		const idx = SRC.indexOf('buildMorphPlan(oldChart, newChart, newFields){');
		expect(idx).toBeGreaterThan(-1);
		const seg = SRC.slice(idx, SRC.indexOf('applyMorphFrame(plan, e){'));
		expect(seg).not.toContain('starMap');
		expect(seg).not.toContain('su28Map');
		expect(seg).not.toContain('beidouMap');
	});
});
