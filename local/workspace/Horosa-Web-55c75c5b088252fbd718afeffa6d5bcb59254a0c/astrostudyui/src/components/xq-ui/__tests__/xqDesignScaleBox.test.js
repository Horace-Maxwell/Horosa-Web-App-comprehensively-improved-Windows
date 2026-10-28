/**
 * HTML 盘「按设计宽排版、栏宽不够时整体等比缩」外框(XQDesignScaleBox)的合同与登记的盘。
 *   ① 纯函数:放得下 / 量不到 = 1;放不下 = 栏宽 / 设计宽
 *   ② 放得下:外框与内框都是 display:contents(不生成盒子,子块直接排在原父级里 —— 与没有这层包裹逐像素相同)
 *   ③ 放不下:内框按设计宽绝对定位(不进祖先的内容最小宽)+ transform 等比缩;外框 width:100%、高 = 子块高 × 比例;挂 scaled 标记
 *   ④ 标记与盘面最小字下限的「HTML 格盘」扫描同一常量(放大档按缩放后的视觉字号反推盘要多宽)
 *   ⑤ 登记的盘都套了外框;被包住的盘根类不许再被子选择器(> .类)直接选中(放得下态外框是 contents,子选择器会落空)
 *   ⑥ 细盘设计宽与样式同值锁(标签列 / 字形最小宽 / 格内距)
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', '..', '..');
const read = (r)=>fs.readFileSync(path.join(SRC, r), 'utf8');
const stripComments = (t)=>t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/[^\n]*/g, '$1');

const { XQDesignScaleBox, designScaleOf, HTML_DESIGN_BOX_ATTR } = require('../XQDesignScaleBox');
const floor = require('../../../utils/chartTextFloor');

function mountIn(width, el){
	const host = document.createElement('div');
	Object.defineProperty(host, 'clientWidth', { get: ()=>width, configurable: true });
	document.body.appendChild(host);
	act(()=>{ ReactDOM.render(el, host); });
	return host;
}

describe('HTML 盘设计宽等比缩外框', ()=>{
	afterEach(()=>{ document.body.innerHTML = ''; });

	test('① 比例纯函数', ()=>{
		expect(designScaleOf(500, 400)).toBe(1);
		expect(designScaleOf(400, 400)).toBe(1);
		expect(designScaleOf(0, 400)).toBe(1);
		expect(designScaleOf(200, 400)).toBe(0.5);
		expect(designScaleOf(246, 640)).toBeCloseTo(0.3843, 4);
		expect(designScaleOf(300, 0)).toBe(1);
	});

	test('② 放得下:外框 / 内框都是 display:contents,子块原样', ()=>{
		const host = mountIn(500, <XQDesignScaleBox designWidth={400}><div className="kid">盘</div></XQDesignScaleBox>);
		const outer = host.firstElementChild;
		expect(outer.getAttribute(HTML_DESIGN_BOX_ATTR)).toBe('fit');
		expect(outer.style.display).toBe('contents');
		expect(outer.firstElementChild.style.display).toBe('contents');
		expect(outer.firstElementChild.style.transform).toBe('');
		expect(host.querySelector('.kid').textContent).toBe('盘');
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
	});

	test('③ 放不下:内框按设计宽绝对定位 + 等比缩,外框挂 scaled', ()=>{
		const host = mountIn(200, <XQDesignScaleBox designWidth={400} designHeight={300}><div className="kid">盘</div></XQDesignScaleBox>);
		const outer = host.firstElementChild;
		const inner = outer.firstElementChild;
		expect(outer.getAttribute(HTML_DESIGN_BOX_ATTR)).toBe('scaled');
		expect(outer.style.width).toBe('100%');
		expect(outer.style.position).toBe('relative');
		expect(outer.style.height).toBe('150px');   // 设计高 300 × 0.5
		expect(inner.style.position).toBe('absolute');
		expect(inner.style.width).toBe('400px');
		expect(inner.style.transform).toBe('scale(0.5)');
		expect(inner.style.transformOrigin).toBe('0 0');
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
	});

	test('③b 两侧留白:缩放态按「设计宽 + 两侧留白」整体缩,内框左右内距 = 留白(分界仍按设计宽)', ()=>{
		const host = mountIn(220, <XQDesignScaleBox designWidth={400} designHeight={300} designGutter={20}><div className="kid">盘</div></XQDesignScaleBox>);
		const inner = host.firstElementChild.firstElementChild;
		expect(inner.style.width).toBe('440px');
		expect(inner.style.padding).toBe('0px 20px');
		expect(inner.style.transform).toBe('scale(0.5)');
		expect(host.firstElementChild.style.height).toBe('150px');
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		const fit = mountIn(400, <XQDesignScaleBox designWidth={400} designGutter={20}><div className="kid">盘</div></XQDesignScaleBox>);
		expect(fit.firstElementChild.getAttribute(HTML_DESIGN_BOX_ATTR)).toBe('fit');
		act(()=>{ ReactDOM.unmountComponentAtNode(fit); });
	});

	test('④ 标记与盘面最小字下限同一常量;「HTML 格盘」扫描认缩放态外框、观察器认标记翻转', ()=>{
		expect(HTML_DESIGN_BOX_ATTR).toBe(floor.HTML_DESIGN_BOX_ATTR);
		expect(floor.HTML_FLOOR_BOARD_SELECTOR).toContain(`[${floor.HTML_DESIGN_BOX_ATTR}="scaled"]`);
		const t = stripComments(read('utils/chartTextFloor.js'));
		expect(t).toMatch(/querySelectorAll\(HTML_FLOOR_BOARD_SELECTOR\)/);
		expect(t).toMatch(/attributeFilter: \['viewBox', 'class', HTML_DESIGN_BOX_ATTR\]/);
	});

	// 登记表:盘 → [文件, 被包住的盘根类]
	const BOARDS = [
		['components/geomancy/GeomancyMain.js', 'horosa-geomancy-square', /<XQDesignScaleBox designWidth=\{GEOMANCY_SQUARE_DESIGN_W\} designHeight=\{GEOMANCY_SQUARE_DESIGN_H\}>\s*<div className="horosa-geomancy-square">/],
		['components/geomancy/GeomancyMain.js', 'horosa-geomancy-polychart', /<XQDesignScaleBox designWidth=\{GEOMANCY_POLY_DESIGN_W\} designHeight=\{GEOMANCY_POLY_DESIGN_H\} designGutter=\{16\}>\s*<div className=\{`horosa-geomancy-polychart /],
		['components/yizhangjing/YiZhangJingMain.js', 'horosa-yizhangjing-board', /<XQDesignScaleBox designWidth=\{YIZHANGJING_BOARD_DESIGN_W\}>\s*<div className="horosa-yizhangjing-board">/],
		['components/cntradition/BaZiFineChart.js', 'horosa-bazi-fine-chart', /<XQDesignScaleBox designWidth=\{baziFineDesignWidth\(cols\.length, isSimple\)\}>\s*<div className=\{`horosa-bazi-fine-chart /],
		['components/cntradition/BaZiAncientChart.js', 'horosa-bazi-anc-table', /<XQDesignScaleBox designWidth=\{BAZI_ANCIENT_TABLE_DESIGN_W\}>\s*<div className="horosa-bazi-anc-table">/],
	];
	test('⑤ 登记的盘都套了外框;盘根类不许被子选择器直接选中(地占舞台的子选择器同时认放得下态外框里的盘)', ()=>{
		BOARDS.forEach(([f, , re])=>{ expect([f, re.test(read(f))]).toEqual([f, true]); });
		const lessFiles = [];
		(function walk(d){ fs.readdirSync(d).forEach((n)=>{ const p = path.join(d, n); if(n === '__tests__' || n === 'node_modules'){ return; } if(fs.statSync(p).isDirectory()){ walk(p); }else if(/\.less$/.test(n)){ lessFiles.push(p); } }); })(path.join(SRC, 'components'));
		(function walk(d){ fs.readdirSync(d).forEach((n)=>{ const p = path.join(d, n); if(fs.statSync(p).isDirectory()){ walk(p); }else if(/\.less$/.test(n)){ lessFiles.push(p); } }); })(path.join(SRC, 'layouts'));
		const bad = [];
		lessFiles.forEach((f)=>{
			const t = stripComments(fs.readFileSync(f, 'utf8'));
			BOARDS.forEach(([, cls])=>{ if(new RegExp(`>\\s*\\.${cls}(?![\\w-])`).test(t)){ bad.push(`${path.relative(SRC, f)}: > .${cls}`); } });
		});
		expect(bad).toEqual([]);
		const g = stripComments(read('components/geomancy/GeomancyMain.less'));
		const stageRules = g.match(/\.horosa-geomancy-board-stage \{\s*>[^{]*\{/g) || [];
		expect(stageRules.length).toBeGreaterThanOrEqual(2);
		stageRules.forEach((r)=>{ expect(r).toMatch(/> \*, > \[data-horosa-html-design-box="fit"\] > \* > \*/); });
	});

	test('⑥ 细盘设计宽与样式同值', ()=>{
		// eslint-disable-next-line global-require
		const { baziFineDesignWidth, BAZI_FINE_LABEL_COL, BAZI_FINE_GLYPH_MIN, BAZI_FINE_CELL_PAD_X } = require('../../cntradition/BaZiFineChart');
		const less = stripComments(read('layouts/app/03-bazi.less'));
		expect(less).toMatch(new RegExp(`\\.horosa-bazi-fine-row \\{[^}]*grid-template-columns: ${BAZI_FINE_LABEL_COL}px repeat\\(6`));
		expect(less).toMatch(new RegExp(`\\.horosa-bazi-fine-glyph \\{[^}]*min-width: ${BAZI_FINE_GLYPH_MIN.fine}px`));
		expect(less).toMatch(new RegExp(`\\.horosa-bazi-fine-chart-simple \\.horosa-bazi-fine-glyph \\{[^}]*min-width: ${BAZI_FINE_GLYPH_MIN.simple}px`));
		expect(less).toMatch(new RegExp(`\\.horosa-bazi-fine-cell \\{[^}]*padding: 10px ${BAZI_FINE_CELL_PAD_X}px`));
		expect(baziFineDesignWidth(6, false)).toBe(62 + 6 * 58 + 2);
		expect(baziFineDesignWidth(4, false)).toBe(62 + 4 * 58 + 2);
		expect(baziFineDesignWidth(6, true)).toBe(62 + 6 * 48 + 2);
	});
});
