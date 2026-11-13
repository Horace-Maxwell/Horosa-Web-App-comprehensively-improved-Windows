/**
 * 矮窗口里中栏盘「不用下滑就看全」:
 *   · shortHostVars:宿主高低于阈值挂 data-host-short(样式收紧盘框内边距 / 行距);
 *   · squareGridFitVars:小六壬正方形宫格量出放得下的格高,小于列宽才封顶成矩形;
 *   · boxSizeVarsRef().refit:容器没变、内容变了时重量一次。
 * 末尾是三页(小成图 / 小六壬 / 地占)的接线与样式检查。
 */
import fs from 'fs';
import path from 'path';
import {
	applyBoxSizeVars, boxSizeVarsRef, shortHostVars, squareGridFitVars,
	XCT_HOST_SHORT, GEOMANCY_HOST_SHORT, XLR_HOST_SHORT,
} from '../boxSizeVars';

const SRC = path.resolve(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');

function box(el, dims){
	Object.keys(dims).forEach((k)=>{
		Object.defineProperty(el, k, { configurable: true, get: ()=>(typeof dims[k] === 'function' ? dims[k]() : dims[k]) });
	});
	return el;
}

// 宿主 > 盘框 > 宫格 > 格;chrome = 盘框里宫格以外的高(矮态下样式会收紧 → 变小)
function scene({ hostH, rows, side, chrome, chromeShort }){
	const host = document.createElement('div');
	const board = document.createElement('div'); board.className = 'horosa-cnx-board';
	const grid = document.createElement('div'); grid.className = 'horosa-cnx-grid';
	if(rows){ grid.setAttribute('data-rows', `${rows}`); }
	const cell = document.createElement('div'); cell.className = 'horosa-cnx-cell horosa-cnx-cell-sq';
	grid.appendChild(cell); board.appendChild(grid); host.appendChild(board);
	document.body.appendChild(host);
	grid.style.rowGap = '10px';
	box(host, { clientWidth: 700, clientHeight: hostH });
	const gridH = 400;
	box(grid, { offsetHeight: gridH });
	box(board, { offsetHeight: ()=>gridH + (host.hasAttribute('data-host-short') ? chromeShort : chrome) });
	box(cell, { offsetWidth: side });
	return host;
}

afterEach(()=>{ document.body.innerHTML = ''; });

describe('shortHostVars', ()=>{
	test('低于阈值挂属性,够高撤掉;同一阈值复用同一只函数', ()=>{
		const fn = shortHostVars(660);
		expect(shortHostVars(660)).toBe(fn);
		expect(shortHostVars(640)).not.toBe(fn);
		const el = box(document.createElement('div'), { clientWidth: 600, clientHeight: 613 });
		applyBoxSizeVars(el, fn);
		expect(el.hasAttribute('data-host-short')).toBe(true);
		box(el, { clientHeight: 660 });
		applyBoxSizeVars(el, fn);
		expect(el.hasAttribute('data-host-short')).toBe(false);
	});
	test('阈值常量', ()=>{
		expect(XCT_HOST_SHORT).toBe(660);
		expect(GEOMANCY_HOST_SHORT).toBe(640);
		expect(XLR_HOST_SHORT).toEqual({ 2: 520, 3: 720 });
	});
});

describe('squareGridFitVars', ()=>{
	test('常规高度(九宫):放得下正方形 → 不封顶、不挂矮态', ()=>{
		const host = scene({ hostH: 900, rows: 3, side: 188, chrome: 250, chromeShort: 216 });
		applyBoxSizeVars(host, squareGridFitVars);
		expect(host.hasAttribute('data-cell-capped')).toBe(false);
		expect(host.hasAttribute('data-host-short')).toBe(false);
		expect(host.style.getPropertyValue('--cnx-cell-cap')).toBe('210px');   // (900 − 250 − 20) / 3
	});
	test('矮窗口九宫:先落矮态再量(用收紧后的盘框余量),格高封顶', ()=>{
		const host = scene({ hostH: 613, rows: 3, side: 188, chrome: 250, chromeShort: 216 });
		applyBoxSizeVars(host, squareGridFitVars);
		expect(host.hasAttribute('data-host-short')).toBe(true);
		expect(host.hasAttribute('data-cell-capped')).toBe(true);
		expect(host.style.getPropertyValue('--cnx-cell-cap')).toBe('125px');   // (613 − 216 − 20) / 3
		// 封顶后三行 + 两道行距 + 盘框余量 ≤ 宿主高
		expect(125 * 3 + 20 + 216).toBeLessThanOrEqual(613);
	});
	test('矮窗口六宫:只封顶、不必收紧', ()=>{
		const host = scene({ hostH: 613, rows: 2, side: 188, chrome: 252, chromeShort: 220 });
		applyBoxSizeVars(host, squareGridFitVars);
		expect(host.hasAttribute('data-host-short')).toBe(false);
		expect(host.hasAttribute('data-cell-capped')).toBe(true);
		expect(host.style.getPropertyValue('--cnx-cell-cap')).toBe('175px');   // (613 − 252 − 10) / 2
	});
	test('窗口变回够高:两只开关都撤', ()=>{
		let h = 613;
		const host = scene({ hostH: 0, rows: 3, side: 188, chrome: 250, chromeShort: 216 });
		box(host, { clientHeight: ()=>h });
		applyBoxSizeVars(host, squareGridFitVars);
		expect(host.hasAttribute('data-cell-capped')).toBe(true);
		h = 900;
		applyBoxSizeVars(host, squareGridFitVars);
		expect(host.hasAttribute('data-cell-capped')).toBe(false);
		expect(host.hasAttribute('data-host-short')).toBe(false);
	});
	test('没起课(宿主里没有宫格):清掉开关', ()=>{
		const host = box(document.createElement('div'), { clientWidth: 700, clientHeight: 613 });
		host.setAttribute('data-cell-capped', '');
		host.setAttribute('data-host-short', '');
		applyBoxSizeVars(host, squareGridFitVars);
		expect(host.hasAttribute('data-cell-capped')).toBe(false);
		expect(host.hasAttribute('data-host-short')).toBe(false);
	});
	test('极矮:格高不出负数', ()=>{
		const host = scene({ hostH: 200, rows: 3, side: 188, chrome: 250, chromeShort: 216 });
		applyBoxSizeVars(host, squareGridFitVars);
		expect(host.style.getPropertyValue('--cnx-cell-cap')).toBe('0px');
		expect(host.hasAttribute('data-cell-capped')).toBe(true);
	});
});

describe('boxSizeVarsRef().refit', ()=>{
	test('容器尺寸没变、内容变了:refit 重量一次', ()=>{
		const compute = jest.fn(()=>({ attrs: {} }));
		const ref = boxSizeVarsRef(compute);
		expect(typeof ref.refit).toBe('function');
		const el = box(document.createElement('div'), { clientWidth: 300, clientHeight: 200 });
		ref(el);
		expect(compute).toHaveBeenCalledTimes(1);
		ref.refit();
		expect(compute).toHaveBeenCalledTimes(2);
		ref(null);
		ref.refit();   // 卸载后是空操作
		expect(compute).toHaveBeenCalledTimes(2);
	});
});

describe('三页接线与样式', ()=>{
	test('小成图 / 地占:宿主挂矮态量法', ()=>{
		expect(read('components/xiaochengtu/XiaoChengTuMain.js'))
			.toMatch(/className="horosa-huangji-board-host" ref=\{ownedBoxSizeRef\(this, 'host', shortHostVars\(XCT_HOST_SHORT\)\)\}/);
		expect(read('components/geomancy/GeomancyMain.js'))
			.toMatch(/className="horosa-huangji-board-host" ref=\{ownedBoxSizeRef\(this, 'host', shortHostVars\(GEOMANCY_HOST_SHORT\)\)\}/);
	});
	test('小六壬:宿主挂格高量法、宫格带行数、起课 / 换流派后重量', ()=>{
		const src = read('components/xiaoliuren/XiaoLiuRenMain.js');
		expect(src).toMatch(/className="horosa-huangji-board-host" ref=\{ownedBoxSizeRef\(this, 'host', squareGridFitVars\)\}/);
		expect(src).toMatch(/data-rows=\{ke\.school === 'dao' \? 3 : 2\}/);
		expect(src).toMatch(/prevState\.ke !== this\.state\.ke\)\{\s*\n\s*const hostRef = ownedBoxSizeRef\(this, 'host', squareGridFitVars\);\s*\n\s*if\(hostRef\.refit\)\{ hostRef\.refit\(\); \}/);
	});
	test('样式:封顶走 min-height(内容更高按内容长,不裁);矮态规则只在带属性的宿主下生效', ()=>{
		const cnx = read('layouts/app/19-cnx-divination.less');
		expect(cnx).toMatch(/\.horosa-huangji-board-host\[data-cell-capped\] \.horosa-cnx-cell\.horosa-cnx-cell-sq \{\s*\n\s*aspect-ratio: auto; min-height: var\(--cnx-cell-cap, 0px\);/);
		// 封顶规则里不许出现会把内容裁在格里的 max-height / 定高
		const capped = cnx.slice(cnx.indexOf('[data-cell-capped]'));
		expect(capped.slice(0, capped.indexOf('}'))).not.toMatch(/max-height|[^-]height:/);
		expect((cnx.match(/\.horosa-huangji-board-host\[data-host-short\]/g) || []).length).toBe(8);
		// 矮态格底给吉凶色条(bottom 8px + 高 3px)留位
		expect(cnx).toMatch(/\[data-host-short\] \.horosa-cnx-cell\.horosa-cnx-cell-sq \{ gap: 1px; padding: 5px 8px 13px;/);
		// 传序角标在正方形格里竖着叠(两三传同落一宫时横排会压到居中的「节」名)
		expect(cnx).toMatch(/\.horosa-cnx-cell\.horosa-cnx-cell-sq \.horosa-cnx-cell-seqs \{[^}]*flex-direction: column; align-items: flex-end;/);
		const geo = read('layouts/app/12-india-tarot-geomancy.less');
		expect((geo.match(/\.horosa-geomancy-redesign \.horosa-huangji-board-host\[data-host-short\]/g) || []).length).toBe(3);
	});
});
