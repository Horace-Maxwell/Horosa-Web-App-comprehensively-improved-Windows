/**
 * 盘变小时自适应的两件通用件:
 *   · svgDesignBox:按像素绘制的 svg 盘低于设计下限时放大绘制坐标 + viewBox 等比缩回(放得下时不写 viewBox,逐像素不变);
 *     单行 svg 文字超宽按实测长度缩字号。
 *   · boxSizeVars:直接量容器(布局域)写变量 / 开关属性(取代在缩放档按视觉像素评估的容器查询)。
 * 末尾用真绘制验证六爻主盘:窄盘(1.8 档实测 349×428)不再画出非正宽的爻线。
 */
import { fitSvgDesignBox, fitSvgTextWidth } from '../svgDesignBox';
import { applyBoxSizeVars, indiaSquareSizeVars, narrowBoardVars, INDIA_SQUARE_COMPACT_CELL, NARROW_BOARD_WIDTH } from '../boxSizeVars';
import GZChart, { GZ_DESIGN_MIN_W, GZ_DESIGN_MIN_H } from '../../components/guazhan/GZChart';

function sized(tag, w, h){
	const el = document.createElementNS(tag === 'svg' ? 'http://www.w3.org/2000/svg' : 'http://www.w3.org/1999/xhtml', tag);
	Object.defineProperty(el, 'clientWidth', { configurable: true, get: ()=>w });
	Object.defineProperty(el, 'clientHeight', { configurable: true, get: ()=>h });
	return el;
}

describe('fitSvgDesignBox', () => {
	test('放得下:不写 viewBox,原尺寸', () => {
		const s = sized('svg', 976, 894);
		expect(fitSvgDesignBox(s, 720, 660)).toEqual({ width: 976, height: 894, scale: 1 });
		expect(s.getAttribute('viewBox')).toBeNull();
	});
	test('比下限小:按 k=max(下限宽/宽, 下限高/高) 放大绘制坐标,viewBox 同比例(不变形)', () => {
		const s = sized('svg', 349, 428);
		const r = fitSvgDesignBox(s, 720, 660);
		const k = 720 / 349;
		expect(r.scale).toBeCloseTo(k, 6);
		expect(r.width).toBeCloseTo(349 * k, 1);
		expect(r.height).toBeCloseTo(428 * k, 1);
		expect(s.getAttribute('viewBox')).toBe(`0 0 ${r.width} ${r.height}`);
		expect(s.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
	});
	test('变回放得下:只撤自己写的 viewBox,别人写的不碰', () => {
		let w = 300;
		const s = sized('svg', 0, 0);
		Object.defineProperty(s, 'clientWidth', { configurable: true, get: ()=>w });
		Object.defineProperty(s, 'clientHeight', { configurable: true, get: ()=>w });
		fitSvgDesignBox(s, 600, 600);
		expect(s.getAttribute('viewBox')).not.toBeNull();
		w = 800;
		fitSvgDesignBox(s, 600, 600);
		expect(s.getAttribute('viewBox')).toBeNull();
		const own = sized('svg', 800, 800);
		own.setAttribute('viewBox', '0 0 1000 1000');
		fitSvgDesignBox(own, 600, 600);
		expect(own.getAttribute('viewBox')).toBe('0 0 1000 1000');
	});
});

describe('fitSvgTextWidth', () => {
	const fakeText = (len, size)=>{
		const attrs = { 'font-size': String(size) };
		let cur = len;
		return {
			getAttribute: (k)=>attrs[k] === undefined ? null : attrs[k],
			setAttribute: (k, v)=>{ attrs[k] = String(v); if(k === 'font-size'){ cur = len * Number(v) / size; } },
			getComputedTextLength: ()=>cur,
			attrs,
		};
	};
	test('放得下不动', () => {
		const t = fakeText(300, 16);
		expect(fitSvgTextWidth(t, 320)).toBe(false);
		expect(t.attrs['font-size']).toBe('16');
	});
	test('超宽按比例缩字号到行宽内', () => {
		const t = fakeText(600, 16);
		expect(fitSvgTextWidth(t, 300, 8)).toBe(true);
		expect(Number(t.attrs['font-size'])).toBeLessThanOrEqual(8.01);
		expect(t.getComputedTextLength()).toBeLessThanOrEqual(300.5);
	});
	test('字号到底线仍超宽 → textLength 压字距', () => {
		const t = fakeText(2000, 16);
		fitSvgTextWidth(t, 300, 9);
		expect(t.attrs.textLength).toBe('300');
		expect(t.attrs.lengthAdjust).toBe('spacingAndGlyphs');
	});
	test('没有 getComputedTextLength(jsdom)跳过', () => {
		expect(fitSvgTextWidth({ getAttribute: ()=>null }, 100)).toBe(false);
	});
});

describe('boxSizeVars', () => {
	test('方盘:格边 = 短边 / 4;单盘 < 150、分盘集 < 80 才挂紧凑;盘边 ≤ 360 挂 tiny', () => {
		expect(INDIA_SQUARE_COMPACT_CELL).toBe(150);
		expect(indiaSquareSizeVars(893, 811, null)).toEqual({ vars: { '--isq-cell': '202.8px' }, attrs: { 'data-isq-compact': false, 'data-isq-tiny': false } });
		expect(indiaSquareSizeVars(266, 266, null).attrs).toEqual({ 'data-isq-compact': true, 'data-isq-tiny': true });
		const multi = document.createElement('div');
		multi.className = 'horosa-india-varga-grid-multi';
		const board = document.createElement('div');
		multi.appendChild(board);
		expect(indiaSquareSizeVars(476, 406, board).attrs['data-isq-compact']).toBe(false);   // 分盘集 100% 档格 101px:常规
		expect(indiaSquareSizeVars(259, 231, board).attrs['data-isq-compact']).toBe(true);
	});
	test('窄盘阈值 480', () => {
		expect(NARROW_BOARD_WIDTH).toBe(480);
		expect(narrowBoardVars(479).attrs['data-board-narrow']).toBe(true);
		expect(narrowBoardVars(480).attrs['data-board-narrow']).toBe(false);
	});
	test('applyBoxSizeVars:写变量 / 开关属性;0×0(隐藏页签)保留上次读数', () => {
		let w = 266;
		const el = sized('div', 0, 0);
		Object.defineProperty(el, 'clientWidth', { configurable: true, get: ()=>w });
		Object.defineProperty(el, 'clientHeight', { configurable: true, get: ()=>w });
		applyBoxSizeVars(el, indiaSquareSizeVars);
		expect(el.hasAttribute('data-isq-compact')).toBe(true);
		expect(el.style.getPropertyValue('--isq-cell')).toBe('66.5px');
		w = 0;
		applyBoxSizeVars(el, indiaSquareSizeVars);
		expect(el.hasAttribute('data-isq-compact')).toBe(true);
		w = 893;
		applyBoxSizeVars(el, indiaSquareSizeVars);
		expect(el.hasAttribute('data-isq-compact')).toBe(false);
	});
});

describe('六爻主盘真绘制', () => {
	const drawAt = (w, h)=>{
		document.body.innerHTML = '';
		const svg = sized('svg', w, h);
		svg.setAttribute('id', 'gzTestSvg');
		document.body.appendChild(svg);
		const yao = [1, 0, 1, 1, 0, 0].map((v, i)=>({ value: v, change: i === 2, color: '#000', god: null, name: null, nameColor: null }));
		const chart = new GZChart({ id: 'gzTestSvg', chartObj: {}, fields: {}, yao, nongli: null });
		chart.draw();
		const rects = Array.from(svg.querySelectorAll('rect'));
		return { svg, rects, nonPositive: rects.filter((r)=>!(parseFloat(r.getAttribute('width')) > 0) || !(parseFloat(r.getAttribute('height')) > 0)).length };
	};
	test(`窄盘(349×428 < 设计下限 ${GZ_DESIGN_MIN_W}×${GZ_DESIGN_MIN_H}):viewBox 等比缩、没有非正宽的格 / 爻线`, () => {
		const r = drawAt(349, 428);
		expect(r.svg.getAttribute('viewBox')).not.toBeNull();
		expect(r.rects.length).toBeGreaterThan(10);
		expect(r.nonPositive).toBe(0);
	});
	test('常规盘(976×894):不写 viewBox(按像素绘制,逐像素同旧)', () => {
		const r = drawAt(976, 894);
		expect(r.svg.getAttribute('viewBox')).toBeNull();
		expect(r.nonPositive).toBe(0);
	});
});
