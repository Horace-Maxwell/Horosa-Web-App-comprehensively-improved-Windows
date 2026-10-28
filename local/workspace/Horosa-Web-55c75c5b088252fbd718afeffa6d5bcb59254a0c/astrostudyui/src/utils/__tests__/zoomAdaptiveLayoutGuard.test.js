/**
 * 放大档 / 窄栏「盘变小时自适应」的源码侧闸门(真内核里另有版面巡检的文字级判据)。
 *
 *   ① 不用容器查询与 cq 单位:系统浏览器内核在文档缩放(壳的 ⌘± 缩放)下 cq 单位按**视觉像素**算(1.8 档 10cqi = 18px),
 *      尺寸条件换档后也不按 CSS px 重算(印占 1.5 档 113px 的格不命中 150px 条件)—— 与 vh/vw 同罪
 *      (真内核实测)。按盘大小换版式一律
 *      直接量容器(utils/boxSizeVars:clientWidth / clientHeight 布局域)写属性 / 变量。
 *   ② 三栏工作台的侧栏下限必须带「栅格自身宽 %」一项(min(定值, [N × 视口宽,] 栅格自身宽 29%~35%)):裸定值(260px)或只有「N × 视口宽」
 *      在栅格嵌在别的宿主里时高估可用宽,把中栏挤到 200 出头(卜 · 其他各技法 1.8 档标题逐字竖排);整页栅格里百分比项与旧值持平。
 *   ③ 方盘格子(南印 / 分盘集 / 盘面美术南印)的紧凑版式在位:组件量盘挂 data-isq-compact,样式按 --isq-cell 取字号;
 *      绝对定位 + 两个以上 ≥ 24px 固定内距 + overflow:hidden 的「格内容器」必须登记它的紧凑版式选择器。
 *   ④ 三式合一盘:盘面可读底线 + 设计下限等比缩放 + 上下信息盒按栏宽等比缩(不再撑出横向滚动条)。
 *   ⑤ 按像素绘制的 svg 盘(六爻 / 宿盘)走设计下限 + viewBox;六壬 / 六爻盘头单行按实测长度缩到行宽。
 *   ⑥ 换档当帧同步工作区高(不等 80ms 去抖)。
 *   ⑦ 空态提示在位(合盘两盘未选齐、八卦类象未选卦)。
 */
const fs = require('fs');
const path = require('path');

const UI_ROOT = path.resolve(__dirname, '..', '..', '..');
const SRC = path.join(UI_ROOT, 'src');
const SKIP_DIRS = new Set(['__tests__', 'node_modules', 'dist', 'dist-file', '.umi', '.umi-production']);

function walk(dir, out, re){
	for(const name of fs.readdirSync(dir)){
		const p = path.join(dir, name);
		const st = fs.statSync(p);
		if(st.isDirectory()){
			if(!SKIP_DIRS.has(name)){ walk(p, out, re); }
		}else if(re.test(name)){
			out.push(p);
		}
	}
	return out;
}
const rel = (p)=>path.relative(SRC, p).split(path.sep).join('/');
const read = (r)=>fs.readFileSync(path.join(SRC, r), 'utf8');
// 去注释(块注释与行尾 // 注释;url 里的 // 前有冒号,保留)
const stripComments = (t)=>t.replace(/\/\*[\s\S]*?\*\//g, (m)=>m.replace(/[^\n]/g, ' ')).replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');

describe('放大档 / 窄栏自适应 · 源码闸', () => {
	test('① src 里不出现容器查询 / container-type / cq 单位(注释不计)', () => {
		const hits = [];
		for(const f of walk(SRC, [], /\.(less|css|js)$/)){
			const lines = stripComments(fs.readFileSync(f, 'utf8')).split('\n');
			lines.forEach((ln, i)=>{
				if(/@container\b|container-type\s*:|container\s*:\s*[\w-]+\s*\/|\b\d+(?:\.\d+)?cq(?:i|b|w|h|min|max)\b/.test(ln)){
					hits.push(`${rel(f)}:${i + 1}: ${ln.trim().slice(0, 90)}`);
				}
			});
		}
		expect(hits).toEqual([]);
	});

	test('② 三栏 / 两栏栅格的侧栏下限必须带栅格自身宽百分比', () => {
		const bad = [];
		for(const f of walk(SRC, [], /\.(less|css)$/)){
			const lines = stripComments(fs.readFileSync(f, 'utf8')).split('\n');
			lines.forEach((ln, i)=>{
				if(!/grid-template-columns\s*:/.test(ln)){ return; }
				// clamp 的第一个参数(下限):裸 px(≥ 200)或「min(Npx, calc(N * var(--horosa-lvw…)))」= 视口口径 → 红
				const re = /clamp\(\s*(~?"?)([^,]+?),/g;
				let m;
				while((m = re.exec(ln))){
					const lo = m[2].trim();
					const px = lo.match(/^(\d+)px$/);
					if(px && Number(px[1]) >= 200){
						bad.push(`${rel(f)}:${i + 1}: clamp(${lo}, …`);
					}
				}
				// clamp 的下限写成 min(…) 时必须带「栅格自身宽 %」一项(只有定值 / 视口宽 = 嵌套宿主里高估可用宽)
				const reMin = /clamp\(\s*~?"?\s*min\(/g;
				let mm;
				while((mm = reMin.exec(ln))){
					// 按括号配对取出 min(…) 的完整参数(内含 calc(var(…)) 两层嵌套)
					let depth = 1;
					let j = mm.index + mm[0].length;
					const start = j;
					while(j < ln.length && depth > 0){ if(ln[j] === '('){ depth += 1; }else if(ln[j] === ')'){ depth -= 1; } j += 1; }
					const args = ln.slice(start, j - 1);
					if(!/\d%/.test(args)){ bad.push(`${rel(f)}:${i + 1}: clamp(min(${args.trim()}), …`); }
				}
			});
		}
		expect(bad).toEqual([]);
	});

	// 「绝对定位 + 两个以上 ≥ 24px 固定内距 + overflow:hidden」的格内容器:格子一小内容区就成负高(整块被裁)。
	// 登记的每一条都必须有对应的紧凑版式选择器在源码里(格子小时改排法);新增同型规则不登记 = 红。
	const FIXED_INSET_CONTAINERS = {
		'.horosa-india-square-objects': '.horosa-india-square-board[data-isq-compact] .horosa-india-square-cell .horosa-india-square-objects',
	};
	test('③ 方盘格内容器的紧凑版式在位;同型新规则必须登记', () => {
		const offenders = [];
		for(const f of walk(SRC, [], /\.(less|css)$/)){
			const text = stripComments(fs.readFileSync(f, 'utf8'));
			const re = /([^{};]+)\{([^{}]*)\}/g;
			let m;
			while((m = re.exec(text))){
				const sel = m[1].trim().split('\n').pop().trim();
				const body = m[2];
				if(!/position\s*:\s*absolute/.test(body) || !/overflow\s*:\s*hidden/.test(body)){ continue; }
				const ins = body.match(/inset\s*:\s*([^;]+);/);
				if(!ins){ continue; }
				const big = ins[1].split(/\s+/).map((v)=>parseFloat(v)).filter((n)=>n >= 24).length;
				if(big >= 2){ offenders.push(sel); }
			}
		}
		const unregistered = offenders.filter((s)=>!Object.keys(FIXED_INSET_CONTAINERS).some((k)=>s.endsWith(k)));
		expect(unregistered).toEqual([]);
		const allLess = walk(SRC, [], /\.(less|css)$/).map((f)=>fs.readFileSync(f, 'utf8')).join('\n');
		for(const compact of Object.values(FIXED_INSET_CONTAINERS)){
			expect(allLess.indexOf(compact)).toBeGreaterThan(-1);
		}
		// 两个方盘组件都量盘
		for(const f of ['components/astro/IndiaSouthChart.js', 'components/astro/AstroWheelArtChart.js']){
			expect(read(f)).toMatch(/horosa-india-square-board[^"]*" ref=\{this\._isqSizeRef \|\| \(this\._isqSizeRef = boxSizeVarsRef\(indiaSquareSizeVars\)\)\}/);
		}
	});

	test('③b 卜 · 其他各盘量盘宽挂 data-board-narrow(取代旧容器查询)', () => {
		const boards = {
			'components/taixuan/TaiXuanMain.js': 1, 'components/shenyishu/ShenYiShuMain.js': 1, 'components/jingjue/JingJueMain.js': 1,
			'components/kinastro/KinAstroMain.js': 7, 'components/shusuan/ZhengChuanMain.js': 1, 'components/wuzhao/WuZhaoMain.js': 1,
			'components/xiaoliuren/XiaoLiuRenMain.js': 1, 'components/xiaochengtu/XiaoChengTuMain.js': 1, 'components/feigong/FeiGongMain.js': 1,
			'components/lingqi/LingQiMain.js': 1,
		};
		for(const [f, n] of Object.entries(boards)){
			expect([f, (read(f).match(/ref=\{ownedBoxSizeRef\(this, '[\w-]+', narrowBoardVars\)\}/g) || []).length]).toEqual([f, n]);
		}
		const less = read('layouts/app/10-huangji-wuzhao.less');
		expect(less).toMatch(/\.horosa-taixuan-board\[data-board-narrow\] \.horosa-taixuan-main-grid \{\s*grid-template-columns: minmax\(0, 1fr\);/);
		expect(less).toMatch(/\.horosa-cnx-board\[data-board-narrow\] \.horosa-cnx-grid\.is-cols-3/);
	});

	test('④ 三式合一盘:可读底线 / 设计下限等比缩 / 信息盒按栏宽缩', () => {
		const main = read('components/sanshi/SanShiUnitedMain.js');
		const board = read('components/sanshi/SanshiUnitedBoard.js');
		expect(main).toMatch(/export const SANSHI_BOARD_READABLE_MIN = 360;/);
		expect(main).toMatch(/const boardMin = Math\.max\(visualFloorPx\(SANSHI_BOARD_MIN\), Math\.min\(wCap, SANSHI_BOARD_READABLE_MIN\)\);/);
		expect(main).toMatch(/fitWidth=\{this\.state\.leftBoardWidth > 0 \? this\.state\.leftBoardWidth - 8 : 0\}/);
		expect(board).toMatch(/const boardSize = Math\.max\(shownSize, SANSHI_BOARD_DESIGN_MIN\);/);
		const { jsxNodes } = require('./helpers/jsxProps');
		const scaled = jsxNodes(board, 'ScaleToWidth').filter((e)=>e.attrs.width === 'fitWidth' && e.attrs.designWidth === 'SANSHI_INFO_DESIGN_W').map((e)=>e.children);
		expect(scaled).toEqual(expect.arrayContaining(['{renderTop(boardSize)}', '{renderBottom(boardSize)}']));
	});

	test('⑤ 按像素绘制的 svg 盘走设计下限;盘头单行缩到行宽', () => {
		expect(read('components/guazhan/GZChart.js')).toMatch(/const \{ width, height \} = fitSvgDesignBox\(svgdom, GZ_DESIGN_MIN_W, GZ_DESIGN_MIN_H\);/);
		expect(read('components/suzhan/SZChart.js')).toMatch(/const \{ width, height \} = fitSvgDesignBox\(svgdom, SZ_DESIGN_MIN, SZ_DESIGN_MIN\);/);
		expect(read('components/lrzhan/RengChart.js')).toMatch(/fitSvgTextWidth\(summaryNode && summaryNode\.node \? summaryNode\.node\(\) : null, cord\.w - 8, 9\);/);
		expect((read('components/guazhan/GZChart.js').match(/fitLast\(\);/g) || []).length).toBe(3);
		expect(read('components/ziwei/ZWChart.js')).toMatch(/const \{ width, height \} = fitSvgDesignBox\(svgdom, ZW_DESIGN_MIN, ZW_DESIGN_MIN\);/);
		expect(read('components/lrzhan/RengChart.js')).toMatch(/const designK = this\.compactPreview \? 1 : Math\.max\(1, RENG_DESIGN_MIN_W \/ realW\);/);
	});

	test('⑧ 小表格的短标签单元格不折行(放大档右栏「10宫」「触发点」此前逐字竖排)', () => {
		// eslint-disable-next-line global-require
		const React = require('react');
		// eslint-disable-next-line global-require
		const { renderToStaticMarkup } = require('react-dom/server');
		// eslint-disable-next-line global-require
		const { SmallTable } = require('../../components/astro/AstroExtraCommon');
		const html = renderToStaticMarkup(React.createElement(SmallTable, {
			columns: [{ key: 'h', title: '宫' }, { key: 'd', title: '宫主落宫(整宫)' }],
			rows: [{ h: '10宫', d: '这是一段很长的说明文字,放不下时照常折行' }],
		}));
		expect(html).toMatch(/<th style="[^"]*white-space:nowrap[^"]*">宫<\/th>/);
		expect(html).toMatch(/<td style="[^"]*white-space:nowrap[^"]*">10宫<\/td>/);
		expect(html).not.toMatch(/white-space:nowrap[^"]*">宫主落宫/);
		expect(html).not.toMatch(/white-space:nowrap[^"]*">这是一段/);
	});

	test('⑨ 底部快捷钮标签整条可见 / 印占方盘留白按盘区收 / 两列芯片可退一列且不折行 / 黄道星释窄组折行', () => {
		const st = read('css/styles.less');
		expect((st.match(/- min\(44px, 7%\)\)/g) || []).length).toBe(4);   // 方盘 width 两项 + max-width + max-height
		expect(st).toMatch(/padding: ~"min\(18px, 3%\)";/);
		const gl = read('layouts/app/06-guolao-modules.less');
		expect((gl.match(/repeat\(auto-fill, minmax\(~"max\(84px, calc\(\(100% - 8px\) \/ 2\)\)", 1fr\)\)/g) || []).length).toBe(2);
		expect(gl).toMatch(/\.horosa-bazi-shensha-groups \.ant-checkbox-wrapper > span:last-child,[\s\S]{0,120}white-space: nowrap;/);
		expect(read('components/astro/AstroZR.js')).toMatch(/ref=\{ownedBoxSizeRef\(this, 'zrBase', zrBaseNarrowVars\)\}/);
		expect(read('layouts/app/22-tail-fixes.less')).toMatch(/\[data-zr-narrow\] \.horosa-zr-base-radio\.ant-radio-wrapper/);
	});

	test('⑥ 工作区容器尺寸一变当帧同步工作区高(不走去抖)', () => {
		const app = read('models/app.js');
		const i = app.indexOf('workspaceRO = new ResizeObserver(');
		expect(i).toBeGreaterThan(-1);
		const body = app.slice(i, i + 200);
		expect(body).toMatch(/syncWorkspaceHeight\(\);/);
		expect(body).not.toMatch(/new ResizeObserver\(handleResize\)/);
	});

	test('⑦ 空态提示在位', () => {
		expect(read('components/astro/AstroRelative.js')).toMatch(/\(!this\.state\.chartA \|\| !this\.state\.chartB\) \? \(\s*<div className="horosa-empty-line horosa-relative-empty-hint"/);
		expect(read('components/gua/GuaSymDesc.js')).toMatch(/!this\.state\.allData \? \(\s*<div className="horosa-empty-line horosa-guasym-empty-hint"/);
	});
});
