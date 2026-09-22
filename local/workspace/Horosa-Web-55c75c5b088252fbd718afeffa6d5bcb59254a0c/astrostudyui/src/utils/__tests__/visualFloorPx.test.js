/**
 * 视觉像素底线(visualFloorPx)—— 2026-09-17 真机 1.8 档实报「盘面最小 560px」把整个列撑爆之后的制度化护栏:
 * ① 折算语义:z=1 恒等;放大档按 1/z 缩(1.8 → 311),缩小档放大(0.7 → 800);非法缩放回退原值。
 * ② 站点不腐烂:18 处(三个推运页 2026-09-18 改为 100% 定高链,不再需要底线)「Math.max(常数, 容器推导值)」底线全部走 visualFloorPx,谁把它改回裸常数这里先红。
 */
const fs = require('fs');
const path = require('path');
import { visualFloorRatio, visualFloorPx, getDeclaredZoom } from '../zoomDomain';

const SITES = [
	['components/auxchart/AuxChartMain.js', 1],
	['components/germany/AstroGermany.js', 1],
	['components/babylon/BabylonMain.js', 1],
	['components/astro/AstroChartMain.js', 1],
	['components/astro3d/AstroChartMain3D.js', 1],
	['components/germany/UranianDialMain.js', 2],
	['components/germany/UranianHouseFrames.js', 2],
	['components/guolao/GuoLaoChart.js', 1],
	['components/suzhan/SuZhanChart.js', 1],
	['components/lrzhan/RengChart.js', 1],
	['components/suzhan/SuZhanMain.js', 1],
	['components/jinkou/JinKouMain.js', 1],
	['components/guazhan/GuaZhanMain.js', 2],
	['components/cntradition/BaZi.js', 1],   // 流年槽 220 底线;盘槽改由主栈网格行单源定高(滚动盒 100% 贴槽),不再需要 360 底线
	['components/sanshi/SanShiUnitedMain.js', 3],   // 2026-09-18 +方盘 380 底线(calcBoardSize)
	['components/guolao/GuoLaoMoiraWheel.js', 1],
	['components/guolao/GuoLaoMoiraPickWheel.js', 1],
];

describe('visualFloorPx · 视觉像素底线折算', () => {
	afterEach(() => { document.documentElement.style.zoom = ''; });

	test('缺省档(无声明 / z=1)恒等于原值', () => {
		document.documentElement.style.zoom = '';
		expect(visualFloorPx(560)).toBe(560);
		document.documentElement.style.zoom = '1';
		expect(visualFloorPx(560)).toBe(560);
	});

	test('放大档按 1/z 折算,缩小档放大(1.8 → 311;0.7 → 800)', () => {
		document.documentElement.style.zoom = '1.8';
		expect(getDeclaredZoom()).toBe(1.8);
		expect(visualFloorPx(560)).toBe(311);
		document.documentElement.style.zoom = '0.7';
		expect(visualFloorPx(560)).toBe(800);
		expect(visualFloorPx(420)).toBe(600);
	});

	test('非法声明值回退原值', () => {
		document.documentElement.style.zoom = 'abc';
		expect(visualFloorPx(420)).toBe(420);
	});
});

describe('visualFloorRatio · 比例版同一法则(盘面缩放系数下限)', () => {
	afterEach(() => { document.documentElement.style.zoom = ''; });

	test('缺省 / z=1 / 缩小档原样返回;放大档 ÷z 不取整', () => {
		document.documentElement.style.zoom = '';
		expect(visualFloorRatio(0.58)).toBe(0.58);
		document.documentElement.style.zoom = '0.7';
		expect(visualFloorRatio(0.58)).toBe(0.58);
		document.documentElement.style.zoom = '1.8';
		expect(visualFloorRatio(0.58)).toBeCloseTo(0.58 / 1.8, 6);
		document.documentElement.style.zoom = 'abc';
		expect(visualFloorRatio(0.58)).toBe(0.58);
	});

	test('遁甲 boardScale 下限经 visualFloorRatio(1.8 档 361×440 中栏不再被 0.58 撑出)', () => {
		const src = fs.readFileSync(path.resolve(__dirname, '../../', 'components/dunjia/DunJiaMain.js'), 'utf8');
		expect(src).toContain('visualFloorRatio(DUNJIA_SCALE_MIN)');
		expect(src).not.toMatch(/clamp\(rawScale,\s*DUNJIA_SCALE_MIN,/);
	});
});

describe('visualFloorPx · 站点不腐烂(21 处底线全部折算)', () => {
	test.each(SITES)('%s 至少 %d 处 visualFloorPx(', (rel, n) => {
		const src = fs.readFileSync(path.resolve(__dirname, '../../', rel), 'utf8');
		const hits = (src.match(/visualFloorPx\(/g) || []).length;
		expect(hits).toBeGreaterThanOrEqual(n);
		expect(src).toMatch(/import \{[^}]*visualFloorPx[^}]*\} from '(\.\.\/)+utils\/zoomDomain'/);
	});
});
