// 视口宽高媒体查询白名单(全 src):`@media (max|min-width|height: …)` 按**物理**窗口判断,壳缩放(documentElement.style.zoom)
// 不改变它的结果(真 WebKit 实测:1400 宽窗口 z = 1 / 1.8 / 0.7 时 matchMedia('(max-width: 900px)') 恒为 false),
// 而放大档下真正可用的布局宽只有「物理宽 ÷ 缩放」(1280 宽 1.8 档 = 711)。所以它管不到「放大后变窄」这件事 ——
// 需要按可用宽度换版面的,一律按容器测(ResizeObserver / 自适应网格 / min() 下限),不要再加媒体查询。
// 现存每一处都已登记(文件 + 查询 → 处数);新增、挪位、删改未同步登记即红。
// 现存条目的核查结论(真 WebKit 零光活窗,1280×800,1.8 档布局宽 711,逐页量横向越界):
//   · 阈值 < 1180:桌面窗口下限 1180 物理 px,桌面恒不触发,只服务网页版窄窗;桌面放大档的窄布局由各页按容器测处理,
//     1.8 档实测无横向裁切(含玄学史 / 天文馆 / 风水 / 三式 / 奇门 / 塔罗 / 紫微 / 黄历 / 七政 / 命其他 / 卜 / 数算 / AI 分析)。
//   · 阈值 ≥ 1180:按物理窗宽做字号 / 间距 / 列宽的密度微调;放大档下不随布局宽变化,但默认档在 1.8 档实测无横向裁切。
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..');

// 「文件|查询」→ 处数
const REGISTRY = {
	'components/aianalysis/AIAnalysisMain.less|@media (max-width: 1280px)': 1,
	'components/aianalysis/AIAnalysisMain.less|@media (max-width: 560px)': 1,
	'components/aianalysis/AIAnalysisMain.less|@media (max-width: 768px)': 1,
	'components/aianalysis/chat/advanced.less|@media (max-width: 1180px)': 1,
	'components/babylon/babylon.less|@media (max-width: 1280px)': 1,
	'components/babylon/babylon.less|@media (max-width: 1500px)': 1,
	'components/homepage/PageHeader.less|@media (max-width: 1180px)': 1,
	'components/homepage/PageHeader.less|@media (max-width: 1320px)': 1,
	'components/homepage/PageHeader.less|@media (max-width: 1500px)': 1,
	'components/homepage/PageHeader.less|@media (max-width: 760px)': 1,
	'components/planetarium/planetarium.less|@media (max-width: 1100px)': 1,
	'components/sanshi/SanShiUnitedMain.less|@media (max-width: 1520px)': 1,
	'components/xq-ui/styles.less|@media (max-width: 1240px)': 1,
	'components/xq-ui/styles.less|@media (max-width: 900px)': 1,
	'components/xuanshi/xuanshiTheme.less|@media (max-width: 720px)': 6,
	'components/xuanshi/xuanshiTheme.less|@media (max-width: 860px)': 1,
	'components/xuanshi/xuanshiTheme.less|@media (max-width: 900px)': 8,
	'css/styles.less|@media (max-width: 1180px)': 1,
	'layouts/app/06-guolao-modules.less|@media (max-width: 760px)': 2,
	'layouts/app/07-qizheng-ziwei.less|@media (max-width: 1360px)': 1,
	'layouts/app/08-india-sanshi.less|@media (max-width: 1480px)': 1,
	'layouts/app/08-india-sanshi.less|@media (max-width: 900px)': 1,
	'layouts/app/11-kinastro-guazhan.less|@media (max-width: 1180px)': 1,
	'layouts/app/11-kinastro-guazhan.less|@media (max-width: 900px)': 1,
	'layouts/app/12-india-tarot-geomancy.less|@media (max-width: 1400px)': 1,
	'layouts/app/12-india-tarot-geomancy.less|@media (max-width: 900px)': 1,
	'layouts/app/13-layout-module.less|@media (max-width: 760px)': 1,
	'layouts/app/15-fengshui.less|@media (max-width: 1280px)': 1,
	'layouts/app/16-zhengchuan-heluo.less|@media (max-width: 900px)': 1,
	'layouts/app/18-ziwei.less|@media (max-width: 1180px)': 1,
	'layouts/app/18-ziwei.less|@media (max-width: 1360px)': 1,
	'layouts/app/18-ziwei.less|@media (max-width: 720px)': 1,
	'layouts/app/19-cnx-divination.less|@media (max-width: 900px)': 2,
	'layouts/app/21-lingqi.less|@media (max-width: 1300px)': 1,
	'layouts/app/21-lingqi.less|@media (max-width: 1500px)': 1,
};

const MEDIA_RE = /@media[^{]*\((?:max|min)-(?:width|height)[^{]*/g;

function listFiles(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((d)=>{
		if(d.name === 'node_modules' || d.name === '__tests__' || d.name === '.umi' || d.name === '.umi-production'){ return; }
		const p = path.join(dir, d.name);
		if(d.isDirectory()){ listFiles(p, out); return; }
		if(/\.(less|css|js|jsx)$/.test(d.name) && !/\.test\.js$/.test(d.name)){ out.push(p); }
	});
	return out;
}
function countsIn(text, rel){
	const out = {};
	(text.match(MEDIA_RE) || []).forEach((q)=>{
		const id = `${rel}|${q.replace(/\s+/g, ' ').trim()}`;
		out[id] = (out[id] || 0) + 1;
	});
	return out;
}

// antd 栅格的响应式断点(<Col / Row xs|sm|md|lg|xl|xxl={…}>、Grid.useBreakpoint)同样按物理视口 matchMedia 判断,壳缩放不改变结果,
// 与上面的媒体查询同病。现存每一处按「文件|元素 断点名」登记处数与核查结论;新增未登记即红(按容器测宽换版面,别再加视口断点)。
const GRID_BREAKPOINT_REGISTRY = {
	// 核查结论(真 WebKit 零光活窗,版面裁切 / 文字挤成竖排 / 被盖判据,1 / 0.7 / 1.8 档 × 1728×1010、1440×900、1280×800,逐子页签):
	//   这些都是左栏输入区与相位表的列宽(断点只在 2 列 / 3 列之间切换);左栏宽按布局像素定,1.8 档下 xl 照样生效时每列仍放得下,
	//   三档逐子页签零裁切、零竖排、零被盖(星盘 · 六壬 · 节气宿盘 · 卜类各页)。
	'components/astro/AstroAspect.js|Col xs,sm': 1,
	'components/comp/DateTimeSelector.js|Col lg,xl': 10,
	'components/lrzhan/LiuRengBirthInput.js|Col lg,xl': 1,
	'components/lrzhan/LiuRengInput.js|Col lg,xl': 2,
	'components/suzhan/SuZhanInput.js|Col lg,xl': 6,
};
const GRID_BP = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];
function gridBreakpointCounts(text, rel){
	const parser = require('@babel/parser');
	const out = {};
	let ast;
	try{ ast = parser.parse(text, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'objectRestSpread', 'dynamicImport', 'nullishCoalescingOperator'], errorRecovery: true }); }catch(e){ return out; }
	const walk = (n)=>{
		if(!n || typeof n.type !== 'string'){ return; }
		if(n.type === 'JSXOpeningElement' && n.name && n.name.type === 'JSXIdentifier' && /^(Col|Row)$/.test(n.name.name)){
			const bps = (n.attributes || []).filter((a)=>a.type === 'JSXAttribute' && a.name && GRID_BP.includes(a.name.name)).map((a)=>a.name.name);
			if(bps.length){ const id = `${rel}|${n.name.name} ${bps.join(',')}`; out[id] = (out[id] || 0) + 1; }
		}
		if(n.type === 'CallExpression' && ((n.callee.type === 'Identifier' && n.callee.name === 'useBreakpoint')
			|| (n.callee.type === 'MemberExpression' && n.callee.property && n.callee.property.name === 'useBreakpoint'))){
			const id = `${rel}|useBreakpoint`; out[id] = (out[id] || 0) + 1;
		}
		Object.keys(n).forEach((k)=>{
			if(k === 'loc' || k === 'start' || k === 'end' || /Comments$/.test(k)){ return; }
			const v = n[k];
			if(Array.isArray(v)){ v.forEach(walk); } else if(v && typeof v === 'object'){ walk(v); }
		});
	};
	walk(ast.program);
	return out;
}

describe('视口宽高媒体查询白名单(放大档下不随布局宽变化)', ()=>{
	it('现存每一处都已登记,没有未登记的新增', ()=>{
		const found = {};
		listFiles(SRC, []).forEach((abs)=>{
			const rel = path.relative(SRC, abs).split(path.sep).join('/');
			Object.assign(found, countsIn(fs.readFileSync(abs, 'utf8'), rel));
		});
		const unregistered = Object.keys(found).filter((id)=>REGISTRY[id] !== found[id]).map((id)=>`${id} ×${found[id]}(登记 ${REGISTRY[id] || 0})`);
		expect(unregistered).toEqual([]);
		// 登记了但源码里已没有(只核这份检出里存在的文件)
		const stale = Object.keys(REGISTRY).filter((id)=>fs.existsSync(path.join(SRC, id.split('|')[0])) && !found[id]);
		expect(stale).toEqual([]);
	});
	it('判据自证:新增一条宽度查询即被认出', ()=>{
		expect(countsIn('.a{} @media (max-width: 900px) { .a{ x:1 } } @media (min-height:600px){}', 'f.less')).toEqual({ 'f.less|@media (max-width: 900px)': 1, 'f.less|@media (min-height:600px)': 1 });
		expect(countsIn('@media (prefers-color-scheme: dark) { }', 'f.less')).toEqual({});
	});
});

describe('antd 栅格视口断点白名单(同病:按物理视口 matchMedia)', ()=>{
	it('现存每一处都已登记,没有未登记的新增', ()=>{
		const found = {};
		listFiles(SRC, []).filter((abs)=>/\.jsx?$/.test(abs)).forEach((abs)=>{
			const text = fs.readFileSync(abs, 'utf8');
			if(!/useBreakpoint|<(Col|Row)\b/.test(text)){ return; }
			const rel = path.relative(SRC, abs).split(path.sep).join('/');
			Object.assign(found, gridBreakpointCounts(text, rel));
		});
		const unregistered = Object.keys(found).filter((id)=>GRID_BREAKPOINT_REGISTRY[id] !== found[id]).map((id)=>`${id} ×${found[id]}(登记 ${GRID_BREAKPOINT_REGISTRY[id] || 0})`);
		expect(unregistered).toEqual([]);
		const stale = Object.keys(GRID_BREAKPOINT_REGISTRY).filter((id)=>fs.existsSync(path.join(SRC, id.split('|')[0])) && !found[id]);
		expect(stale).toEqual([]);
	});
	it('判据自证:Col / Row 的断点属性与 useBreakpoint 都被认出;固定 span 与注释不算', ()=>{
		expect(gridBreakpointCounts('const a = <Row gutter={8}><Col span={6}>x</Col><Col lg={12} xl={8}>y</Col><Col xs={24}>z</Col></Row>;\n// <Col md={6}>', 'f.js'))
			.toEqual({ 'f.js|Col lg,xl': 1, 'f.js|Col xs': 1 });
		expect(gridBreakpointCounts('function F(){ const bp = Grid.useBreakpoint(); return <Row md={2} />; }', 'g.js'))
			.toEqual({ 'g.js|useBreakpoint': 1, 'g.js|Row md': 1 });
	});
});
