// 界面简繁 · 护栏:导出 / 截图永远是简体原文。
// 界面切到繁体后页面上的字与 canvas 画的字都是繁体;栅格类导出(html2canvas / html-to-image / canvas 转图 / SVG 序列化)
// 若直接截,导出物就成了繁体 —— 违背「数据 / 导出永远简体」。凡这类调用,所在文件必须经 utils/scriptMode.js 的
// withOriginalScript(期间暂停转换、页上要截的元素放回原文、canvas 补丁旁路);
// 只截屏(就是要「看到什么截什么」)或不含文字的(照片压缩 / 热力图像素 / WebGL 帧)登记理由豁免。
jest.mock('html-to-image', ()=>({ toCanvas: jest.fn() }));
jest.mock('jspdf', ()=>({
	jsPDF: jest.fn().mockImplementation(()=>({
		internal: { pageSize: { getWidth: ()=>210, getHeight: ()=>297 } },
		addPage: jest.fn(),
		addImage: jest.fn(),
	})),
}));

import { toCanvas } from 'html-to-image';
import { __aiExportTesting__ } from '../aiExport';
import FengShuiEngine from '../../components/fengshui/fengshuiEngine';
import { applyScriptMode, SCRIPT_HANT, __resetScriptModeForTest, __setConverterForTest } from '../scriptMode';

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../..');
const EXPORT_RE = /html2canvas\s*\(|['"]html-to-image['"]|\bto(?:Png|Jpeg|Canvas|Svg)\s*\(|\.toDataURL\s*\(|(?<!Packer)\.toBlob\s*\(|serializeToString\s*\(/;

// 文件(相对 src)→ 豁免理由
const EXEMPT = {
	'utils/pageScreenshot.js': '页面截图:就是要截「屏幕上看到的」(界面繁体就是繁体)',
	'components/acg/AcgD3Map.js': '热力图像素层(不含文字)',
	'components/astro3d/PDSphereEngine.js': 'WebGL 帧给页面截图用(同页面截图口径)',
	'utils/scriptMode.js': '单源件本身(注释里提到这些名字)',
};
// 已知导出点(防正则静默失效)
const KNOWN_EXPORTERS = ['utils/aiExport/output.js', 'components/fengshui/fengshuiEngine.js'];

function walk(dir, out){
	fs.readdirSync(dir).forEach((f)=>{
		const p = path.join(dir, f);
		if(fs.statSync(p).isDirectory()){
			if(f === '__tests__' || f === 'test' || f === '.umi' || f === '.umi-production' || f === '.umi-test'){ return; }
			walk(p, out);
		}else if(/\.(js|jsx)$/.test(f)){
			out.push(p);
		}
	});
	return out;
}

const stripComments = (code)=>code.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((ln)=>ln.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n');

describe('导出 / 截图经 withOriginalScript(界面简繁)', () => {
	const found = {};
	walk(SRC, []).forEach((file)=>{
		const rel = path.relative(SRC, file).split(path.sep).join('/');
		const code = stripComments(fs.readFileSync(file, 'utf8'));
		if(EXPORT_RE.test(code)){ found[rel] = /\bwithOriginalScript\s*\(/.test(code); }
	});

	it('扫到了已知的导出点(防正则静默失效)', () => {
		KNOWN_EXPORTERS.forEach((f)=>expect([f, found[f]]).toEqual([f, true]));
	});

	it('凡导出 / 截图的文件都经 withOriginalScript 或登记了豁免理由', () => {
		const bad = Object.keys(found).filter((f)=>!found[f] && !EXEMPT[f]).sort();
		expect(bad).toEqual([]);
	});

	it('豁免表没有过期项', () => {
		const stale = Object.keys(EXEMPT).filter((f)=>fs.existsSync(path.join(SRC, f)) && found[f] === undefined && f !== 'utils/scriptMode.js');
		expect(stale).toEqual([]);
	});
});

// 调用点级判定:每个截图 / 转图 / 序列化调用必须处在传给 withOriginalScript 的函数体内,
// 或其所在函数(按名回溯一层)只在这类函数体内被调用;否则须按「文件#函数名」登记豁免理由。
// (按文件判时,同一文件只要出现一次 withOriginalScript 就全过 —— 以后在多出口文件里新加一个不包的出口,护栏照样绿。)
const EXPORT_CALLS = new Set(['html2canvas', 'toPng', 'toJpeg', 'toCanvas', 'toSvg', 'toDataURL', 'toBlob', 'serializeToString']);
const CALL_EXEMPT = {
};
function unguardedExportCalls(code){
	const parser = require('@babel/parser');
	const traverse = require('@babel/traverse').default;
	let ast;
	try{ ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'objectRestSpread', 'dynamicImport', 'nullishCoalescingOperator'] }); }catch(e){ return null; }
	const calleeName = (c)=>(c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' && !c.computed && c.property ? c.property.name : ''));
	const isWOS = (p)=>p && p.node && p.node.type === 'CallExpression' && calleeName(p.node.callee) === 'withOriginalScript';
	// 函数节点是不是直接作为 withOriginalScript 的第一参
	const fnInWOS = (fnPath)=>fnPath && fnPath.parentPath && isWOS(fnPath.parentPath) && fnPath.parentPath.node.arguments[0] === fnPath.node;
	const insideWOS = (p)=>{
		let fn = p.getFunctionParent();
		while(fn){ if(fnInWOS(fn)){ return true; } fn = fn.parentPath && fn.parentPath.getFunctionParent(); }
		return false;
	};
	const fnName = (fnPath)=>{
		const nd = fnPath.node;
		if(nd.id && nd.id.name){ return nd.id.name; }
		if(nd.key && nd.key.name){ return nd.key.name; }
		const par = fnPath.parentPath && fnPath.parentPath.node;
		if(par && par.type === 'VariableDeclarator' && par.id && par.id.name){ return par.id.name; }
		if(par && (par.type === 'ClassProperty' || par.type === 'ObjectProperty') && par.key && par.key.name){ return par.key.name; }
		return '';
	};
	// 最近的具名外层函数(匿名箭头 / 回调往上找)
	const namedFnOf = (p)=>{
		let fn = p.getFunctionParent();
		while(fn){ if(fnInWOS(fn)){ return ''; } const n = fnName(fn); if(n){ return n; } fn = fn.parentPath && fn.parentPath.getFunctionParent(); }
		return '';
	};
	const exportCalls = [];
	const callsByName = Object.create(null);
	traverse(ast, { CallExpression(p){
		const n = calleeName(p.node.callee);
		if(n){ (callsByName[n] = callsByName[n] || []).push(p); }
		if(!EXPORT_CALLS.has(n)){ return; }
		if(n === 'toBlob' && p.node.callee.type === 'MemberExpression' && p.node.callee.object && p.node.callee.object.name === 'Packer'){ return; }
		exportCalls.push(p);
	} });
	// 函数(按名)是否只在 withOriginalScript 之内被调:逐个调用点看,调用点本身在其内,或调用点所在函数(按名递归)也满足
	const memo = Object.create(null);
	const fnGuarded = (name, seen)=>{
		if(!name){ return false; }
		if(memo[name] !== undefined){ return memo[name]; }
		if(seen.has(name)){ return false; }
		seen.add(name);
		const callers = callsByName[name] || [];
		const ok = callers.length > 0 && callers.every((c)=>{
			if(insideWOS(c)){ return true; }
			return fnGuarded(namedFnOf(c), seen);
		});
		memo[name] = ok;
		return ok;
	};
	const out = [];
	exportCalls.forEach((p)=>{
		if(insideWOS(p)){ return; }
		const name = namedFnOf(p);
		if(fnGuarded(name, new Set())){ return; }
		out.push(`${name || '(顶层)'}:${p.node.loc.start.line}`);
	});
	return out;
}

describe('导出 / 截图经 withOriginalScript · 调用点级', () => {
	it('每个截图调用都处在 withOriginalScript 之内(或其函数只在其内被调),否则按调用点登记豁免', () => {
		const bad = [];
		walk(SRC, []).forEach((file)=>{
			const rel = path.relative(SRC, file).split(path.sep).join('/');
			if(EXEMPT[rel]){ return; }
			const code = fs.readFileSync(file, 'utf8');
			if(!EXPORT_RE.test(stripComments(code))){ return; }
			const list = unguardedExportCalls(code);
			if(!list){ return; }
			list.forEach((site)=>{
				const fnKey = `${rel}#${site.split(':')[0]}`;
				if(!CALL_EXEMPT[fnKey]){ bad.push(`${rel}#${site}`); }
			});
		});
		expect(bad).toEqual([]);
	});
	it('判别力:多出口文件里新加一个不包的出口 → 判为未包', () => {
		const src = fs.readFileSync(path.join(SRC, 'utils/aiExport/output.js'), 'utf8');
		expect(unguardedExportCalls(src)).toEqual([]);
		const mutated = `${src}\nexport async function exportNewRaster(host){ const c = await toCanvas(host); return c.toDataURL('image/png'); }\n`;
		const bad = unguardedExportCalls(mutated);
		expect(bad.some((s)=>/^exportNewRaster:/.test(s))).toBe(true);
	});
	it('调用点豁免表没有过期项', () => {
		Object.keys(CALL_EXEMPT).forEach((k)=>{
			const [rel, fn] = k.split('#');
			const p = path.join(SRC, rel);
			if(!fs.existsSync(p)){ return; }
			const list = unguardedExportCalls(fs.readFileSync(p, 'utf8')) || [];
			expect([k, list.some((s)=>s.split(':')[0] === fn)]).toEqual([k, true]);
		});
	});
});

describe('AI 导出栅格 PDF:界面繁体时截到的仍是简体原文', () => {
	function FakeCtx(){ this.drawn = []; }
	FakeCtx.prototype.fillText = function(t){ this.drawn.push(t); };
	FakeCtx.prototype.strokeText = function(t){ this.drawn.push(t); };
	FakeCtx.prototype.measureText = function(t){ return { width: `${t}`.length }; };
	const MAP = { '财': '財', '运': '運', '冲': '沖', '盘': '盤' };
	const fake = (s)=>Array.from(`${s}`).map((c)=>MAP[c] || c).join('');

	beforeAll(() => { window.CanvasRenderingContext2D = FakeCtx; });
	afterAll(() => { __resetScriptModeForTest(); delete window.CanvasRenderingContext2D; });
	beforeEach(() => {
		__resetScriptModeForTest();
		__setConverterForTest(fake);
		document.body.innerHTML = '<div>本命盘</div>';
		toCanvas.mockReset();
	});

	it.each(['exportPdfPlain', 'exportPdfStyled'])('%s:宿主文字与 canvas 画字都是简体', async (name) => {
		await applyScriptMode(SCRIPT_HANT);
		expect(document.body.textContent).toBe('本命盤');
		const seen = [];
		toCanvas.mockImplementation(async (host)=>{
			await Promise.resolve();                 // 观察者在微任务里转换:若宿主没被跳过,这里已是繁体
			await new Promise((r)=>setTimeout(r, 0));
			const ctx = new FakeCtx();
			ctx.fillText('财运六冲', 0, 0);
			seen.push([host.textContent.indexOf('财运六冲') >= 0, host.textContent.indexOf('財運') >= 0, ctx.drawn[0]]);
			return { width: 0, height: 0 };
		});
		await __aiExportTesting__[name]({ tech: '本命盘', text: '财运六冲', blocks: [{ type: 'para', text: '财运六冲' }], filenameBase: 'x' });
		expect(seen.length).toBeGreaterThan(0);
		seen.forEach((row)=>expect(row).toEqual([true, false, '财运六冲']));
		const ctx = new FakeCtx();
		ctx.fillText('财运', 0, 0);
		expect(ctx.drawn).toEqual(['財運']);       // 导出完恢复
	});
});

describe('风水导出(图片 / 报告 PNG / 报告 PDF):界面繁体时画的字是简体', () => {
	function FakeCtx(){ this.drawn = []; }
	FakeCtx.prototype.fillText = function(t){ this.drawn.push(t); };
	FakeCtx.prototype.strokeText = function(t){ this.drawn.push(t); };
	FakeCtx.prototype.measureText = function(t){ return { width: `${t}`.length }; };
	beforeAll(() => { window.CanvasRenderingContext2D = FakeCtx; });
	afterAll(() => { __resetScriptModeForTest(); delete window.CanvasRenderingContext2D; });

	it.each([['exportPng', 'renderCompositeCanvas'], ['exportReportPng', 'buildReportCanvas'], ['exportReportPdf', 'buildReportCanvas']])('%s', async (entry, builder) => {
		__resetScriptModeForTest();
		__setConverterForTest((s)=>`${s}`.replace(/盘/g, '盤'));
		await applyScriptMode(SCRIPT_HANT);
		const eng = Object.create(FengShuiEngine.prototype);
		eng.techMode = 'naqi';
		const ctx = new FakeCtx();
		eng[builder] = ()=>{ ctx.fillText('纳气盘', 0, 0); return { toDataURL: ()=>'data:image/png;base64,' }; };
		eng.downloadDataUrl = ()=>{};
		const openSpy = jest.spyOn(window, 'open').mockImplementation(()=>null);
		try{ await eng[entry](); }finally{ openSpy.mockRestore(); }
		expect(ctx.drawn).toEqual(['纳气盘']);
	});
});
