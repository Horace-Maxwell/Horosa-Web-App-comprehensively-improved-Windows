/**
 * HTML 盘「按设计宽排版、栏宽不够时整体等比缩」外框(XQDesignScaleBox)的合同与登记的盘。
 *   ① 纯函数:放得下 / 量不到 = 1;放不下 = 栏宽 / 设计宽
 *   ② 放得下:外框与内框都是 display:contents(不生成盒子,子块直接排在原父级里 —— 与没有这层包裹逐像素相同)
 *   ③ 放不下:内框按设计宽绝对定位(不进祖先的内容最小宽)+ transform 等比缩;外框 width:100%、高 = 子块高 × 比例;挂 scaled 标记
 *   ④ 标记与盘面最小字下限的「HTML 格盘」扫描同一常量(放大档按缩放后的视觉字号反推盘要多宽)
 *   ⑤ 登记的盘都套了外框;被包住的盘根类不许再被子选择器(> .类)直接选中(放得下态外框是 contents,子选择器会落空)
 *   ⑥ 细盘设计宽与样式同值锁(标签列 / 字形最小宽 / 格内距)
 *   ⑦ 按可用高适配(fitHeight):可用高不足设计高时取「宽比 ∧ 高比」、高说了算时水平居中;比例有下限;放大档不按高缩;不开的盘行为不变
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', '..', '..');
const read = (r)=>fs.readFileSync(path.join(SRC, r), 'utf8');
const stripComments = (t)=>t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/[^\n]*/g, '$1');

const { XQDesignScaleBox, designScaleOf, designHeightScaleOf, FIT_HEIGHT_MIN_SCALE, HTML_DESIGN_BOX_ATTR } = require('../XQDesignScaleBox');
const floor = require('../../../utils/chartTextFloor');
const { jsxNodes } = require('../../../utils/__tests__/helpers/jsxProps');   // 按 AST 认元素 / 属性 / 子节点(不按排版写正则)
const boxes = (rel)=>jsxNodes(read(rel), 'XQDesignScaleBox');

function mountIn(width, el, height){
	const host = document.createElement('div');
	Object.defineProperty(host, 'clientWidth', { get: ()=>width, configurable: true });
	if(height){ Object.defineProperty(host, 'clientHeight', { get: ()=>height, configurable: true }); }
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

	test('⑦ 按可用高适配:纯函数 + 高说了算时居中 + 下限 + 放大档不按高缩 + 不开的盘不变', ()=>{
		expect(designHeightScaleOf(700, 696)).toBe(1);
		expect(designHeightScaleOf(0, 696)).toBe(1);
		expect(designHeightScaleOf(562, 696)).toBeCloseTo(0.8074, 4);
		expect(designHeightScaleOf(100, 696)).toBe(FIT_HEIGHT_MIN_SCALE);
		const kid = <div className="kid">盘</div>;
		// 宽够、高不够:进缩放态,比例 = 高比;盘比栏窄 → 水平居中
		let host = mountIn(800, <XQDesignScaleBox designWidth={400} designHeight={300} fitHeight>{kid}</XQDesignScaleBox>, 150);
		let outer = host.firstElementChild;
		let inner = outer.firstElementChild;
		expect(outer.getAttribute(HTML_DESIGN_BOX_ATTR)).toBe('scaled');
		expect(inner.style.transform).toBe('scale(0.7)');           // 150/300 = 0.5 低于下限 → 取下限
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		host = mountIn(800, <XQDesignScaleBox designWidth={400} designHeight={300} fitHeight>{kid}</XQDesignScaleBox>, 240);
		outer = host.firstElementChild;
		inner = outer.firstElementChild;
		expect(inner.style.transform).toBe('scale(0.8)');
		expect(inner.style.width).toBe('400px');
		expect(inner.style.left).toBe('240px');                     // (800 − 400×0.8) / 2
		expect(outer.style.height).toBe('240px');
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		// 宽、高都不够:取小的那个;宽说了算时贴左铺满
		host = mountIn(200, <XQDesignScaleBox designWidth={400} designHeight={300} fitHeight>{kid}</XQDesignScaleBox>, 240);
		inner = host.firstElementChild.firstElementChild;
		expect(inner.style.transform).toBe('scale(0.5)');
		expect(inner.style.left).toBe('0px');
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		// 带两侧留白:栏宽在「设计宽」与「设计宽 + 留白」之间时宽比也参与
		host = mountIn(420, <XQDesignScaleBox designWidth={400} designHeight={300} designGutter={20} fitHeight>{kid}</XQDesignScaleBox>, 285);
		inner = host.firstElementChild.firstElementChild;
		expect(inner.style.transform).toBe('scale(0.95)');          // min(420/440 = 0.9545, 285/300 = 0.95)
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		// 都放得下:原样
		host = mountIn(800, <XQDesignScaleBox designWidth={400} designHeight={300} fitHeight>{kid}</XQDesignScaleBox>, 300);
		expect(host.firstElementChild.getAttribute(HTML_DESIGN_BOX_ATTR)).toBe('fit');
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		// 不开 fitHeight:高不够也不缩(其余使用方行为不变)
		host = mountIn(800, <XQDesignScaleBox designWidth={400} designHeight={300}>{kid}</XQDesignScaleBox>, 150);
		expect(host.firstElementChild.getAttribute(HTML_DESIGN_BOX_ATTR)).toBe('fit');
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		// 放大档:不按高缩(盘面最小字下限按「宽说了算」反推加宽量)
		document.documentElement.style.zoom = '1.25';
		try{
			host = mountIn(800, <XQDesignScaleBox designWidth={400} designHeight={300} fitHeight>{kid}</XQDesignScaleBox>, 150);
			expect(host.firstElementChild.getAttribute(HTML_DESIGN_BOX_ATTR)).toBe('fit');
			act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		}finally{ document.documentElement.style.zoom = ''; }
		// 缩小档照常生效
		document.documentElement.style.zoom = '0.9';
		try{
			host = mountIn(800, <XQDesignScaleBox designWidth={400} designHeight={300} fitHeight>{kid}</XQDesignScaleBox>, 240);
			expect(host.firstElementChild.firstElementChild.style.transform).toBe('scale(0.8)');
			act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		}finally{ document.documentElement.style.zoom = ''; }
		// 只有按可用高定边长的地占方盘开了它
		const users = ['components/yizhangjing/YiZhangJingMain.js', 'components/cntradition/BaZiFineChart.js', 'components/cntradition/BaZiAncientChart.js'];
		users.forEach((f)=>{ expect([f, boxes(f).some((n)=>n.attrs.fitHeight)]).toEqual([f, false]); });
		expect(boxes('components/geomancy/GeomancyMain.js').filter((n)=>n.attrs.fitHeight === true).length).toBe(2);
		// 地占两式方盘的设计边长 = 盘内字整段落在本宫多边形里的最小边长(实测 680;再小字压分宫线);
		// 两盘设计高 = 边长 + 盘名一行与行距(33,真引擎量得):多给一截缩放态里盘被拉成竖长方
		const geo = read('components/geomancy/GeomancyMain.js');
		expect(Number((geo.match(/export const GEOMANCY_POLY_DESIGN_W = (\d+);/) || [])[1])).toBeGreaterThanOrEqual(680);
		expect(geo).toMatch(/export const GEOMANCY_BOARD_TITLE_ROW = 33;/);
		expect(geo).toMatch(/export const GEOMANCY_SQUARE_DESIGN_H = GEOMANCY_SQUARE_DESIGN_W \+ GEOMANCY_BOARD_TITLE_ROW;/);
		expect(geo).toMatch(/export const GEOMANCY_POLY_DESIGN_H = GEOMANCY_POLY_DESIGN_W \+ GEOMANCY_BOARD_TITLE_ROW;/);
	});

	test('④ 标记与盘面最小字下限同一常量;「HTML 格盘」扫描认缩放态外框、观察器认标记翻转', ()=>{
		expect(HTML_DESIGN_BOX_ATTR).toBe(floor.HTML_DESIGN_BOX_ATTR);
		expect(floor.HTML_FLOOR_BOARD_SELECTOR).toContain(`[${floor.HTML_DESIGN_BOX_ATTR}="scaled"]`);
		const t = stripComments(read('utils/chartTextFloor.js'));
		expect(t).toMatch(/querySelectorAll\(HTML_FLOOR_BOARD_SELECTOR\)/);
		expect(t).toMatch(/attributeFilter: \['viewBox', 'class', HTML_DESIGN_BOX_ATTR\]/);
	});

	// 登记表:盘 → [文件, 被包住的盘根类, 外框应带的属性(值 = 源码文本;无值属性记 true)]
	const BOARDS = [
		['components/geomancy/GeomancyMain.js', 'horosa-geomancy-square', { designWidth: 'GEOMANCY_SQUARE_DESIGN_W', designHeight: 'GEOMANCY_SQUARE_DESIGN_H', fitHeight: true }],
		['components/geomancy/GeomancyMain.js', 'horosa-geomancy-polychart', { designWidth: 'GEOMANCY_POLY_DESIGN_W', designHeight: 'GEOMANCY_POLY_DESIGN_H', designGutter: '16', fitHeight: true }],
		['components/yizhangjing/YiZhangJingMain.js', 'horosa-yizhangjing-board', { designWidth: 'YIZHANGJING_BOARD_DESIGN_W' }],
		['components/cntradition/BaZiFineChart.js', 'horosa-bazi-fine-chart', { designWidth: 'baziFineDesignWidth(cols.length, isSimple)' }],
		['components/cntradition/BaZiAncientChart.js', 'horosa-bazi-anc-table', { designWidth: 'BAZI_ANCIENT_TABLE_DESIGN_W' }],
	];
	// 外框直接包住盘根:子节点以盘根 div 开头,且它的 className 含这个类
	const wraps = (n, cls)=>{
		const kids = jsxNodes(n.children, 'div');
		return kids.length > 0 && n.children.indexOf('<div') === 0 && new RegExp(`(^|[\\s\`'"])${cls}([\\s\`'"]|$)`).test(`${kids[0].attrs.className || ''}`);
	};
	test('⑤ 登记的盘都套了外框;盘根类不许被子选择器直接选中(地占舞台的子选择器同时认放得下态外框里的盘)', ()=>{
		BOARDS.forEach(([f, cls, want])=>{
			const hit = boxes(f).filter((n)=>wraps(n, cls));
			expect([f, cls, hit.length]).toEqual([f, cls, 1]);
			const got = {};
			Object.keys(hit[0].attrs).forEach((k)=>{ got[k] = hit[0].attrs[k] === true ? true : `${hit[0].attrs[k]}`.replace(/^\{|\}$/g, ''); });
			expect([f, cls, got]).toEqual([f, cls, want]);
		});
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
