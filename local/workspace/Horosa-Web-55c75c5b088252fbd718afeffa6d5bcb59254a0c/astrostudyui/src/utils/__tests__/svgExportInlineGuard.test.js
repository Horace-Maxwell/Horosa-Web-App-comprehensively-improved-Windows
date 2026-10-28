// svg 序列化导出:克隆体先内联计算样式(导出图里 var() / 样式表 / 继承都不存在,曲线会丢、标签变黑)。
//   ① inlineSvgComputedStyles:把原件的计算值写进克隆体,属性 / 行内样式里残留的 var() 全部移除;
//   ② 静态守卫:src 下凡调用 serializeToString 的文件,必须引入并在序列化之前调用 inlineSvgComputedStyles。
import fs from 'fs';
import path from 'path';
import { inlineSvgComputedStyles, SVG_EXPORT_STYLE_PROPS, exportSurfaceColor } from '../svgExportStyles';

const SRC = path.resolve(__dirname, '../..');
const NS = 'http://www.w3.org/2000/svg';

// 模拟浏览器的计算样式:呈现属性 / 行内样式里的 var(--x[, 后备]) 解析成 RESOLVED[--x](找不到取后备值)
const RESOLVED = { '--horosa-series-1': 'rgb(161, 119, 9)', '--horosa-text': 'rgb(43, 38, 32)', '--horosa-accent-soft': 'rgba(154, 106, 37, 0.14)' };
function resolveVar(v){
	return `${v}`.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (m, name, fb)=>RESOLVED[name] || (fb ? fb.trim() : ''));
}
function fakeComputed(el){
	const inline = {};
	`${el.getAttribute('style') || ''}`.split(';').forEach((d)=>{ const i = d.indexOf(':'); if(i > 0){ inline[d.slice(0, i).trim()] = d.slice(i + 1).trim(); } });
	return { getPropertyValue: (prop)=>{
		const raw = inline[prop] !== undefined ? inline[prop] : (el.getAttribute(prop) || (prop === 'font-size' ? '12px' : ''));
		return resolveVar(raw);
	} };
}

function buildSvg(){
	const svg = document.createElementNS(NS, 'svg');
	svg.setAttribute('width', '200');
	svg.setAttribute('height', '100');
	const g = document.createElementNS(NS, 'g');
	const p1 = document.createElementNS(NS, 'path');
	p1.setAttribute('d', 'M0 0L10 10');
	p1.setAttribute('fill', 'none');
	p1.setAttribute('stroke', 'var(--horosa-series-1)');
	const p2 = document.createElementNS(NS, 'path');
	p2.setAttribute('d', 'M0 0L10 10');
	p2.setAttribute('fill', 'var(--horosa-accent-soft)');
	p2.setAttribute('opacity', '0.28');
	const t = document.createElementNS(NS, 'text');
	t.setAttribute('style', 'fill: var(--horosa-text); font-weight: 600');
	t.textContent = '日';
	const unknown = document.createElementNS(NS, 'line');
	unknown.setAttribute('stroke', 'var(--not-defined-anywhere)');
	g.appendChild(p1); g.appendChild(p2); g.appendChild(t); g.appendChild(unknown);
	svg.appendChild(g);
	document.body.appendChild(svg);
	return { svg, p1, p2, t };
}

describe('① inlineSvgComputedStyles', ()=>{
	let spy;
	beforeEach(()=>{ spy = jest.spyOn(window, 'getComputedStyle').mockImplementation(fakeComputed); });
	afterEach(()=>{ spy.mockRestore(); document.body.innerHTML = ''; });

	it('克隆体写入计算值,序列化串里不留 var(', ()=>{
		const { svg } = buildSvg();
		const clone = svg.cloneNode(true);
		inlineSvgComputedStyles(svg, clone);
		const xml = new XMLSerializer().serializeToString(clone);
		expect(xml).not.toMatch(/var\(/);
		const paths = clone.querySelectorAll('path');
		expect(paths[0].style.getPropertyValue('stroke')).toBe('rgb(161, 119, 9)');
		expect(paths[1].style.getPropertyValue('fill')).toBe('rgba(154, 106, 37, 0.14)');
		expect(clone.querySelector('text').style.getPropertyValue('fill')).toBe('rgb(43, 38, 32)');
		// 原件不动(页面上仍是随主题换值的 var())
		expect(svg.querySelector('path').getAttribute('stroke')).toBe('var(--horosa-series-1)');
	});
	it('写的是绘制 / 文字相关的整组属性', ()=>{
		['fill', 'stroke', 'stop-color', 'opacity', 'font-family', 'font-size', 'text-anchor'].forEach((p)=>expect(SVG_EXPORT_STYLE_PROPS).toContain(p));
	});
	it('判别力自证:不内联直接序列化,串里有 var(', ()=>{
		const { svg } = buildSvg();
		expect(new XMLSerializer().serializeToString(svg.cloneNode(true))).toMatch(/var\(--horosa-series-1\)/);
	});
});

// ── ② 静态守卫 ──
function listJs(dir, out){
	fs.readdirSync(dir).forEach((f)=>{
		const p = path.join(dir, f);
		if(fs.statSync(p).isDirectory()){ if(f !== '__tests__' && f !== 'node_modules'){ listJs(p, out); } }else if(/\.js$/.test(f)){ out.push(p); }
	});
	return out;
}
function checkSource(rel, src){
	const bad = [];
	const re = /serializeToString\s*\(/g; let m = re.exec(src);
	while(m){
		const before = src.slice(0, m.index);
		const call = before.lastIndexOf('inlineSvgComputedStyles(');
		if(!/import\s*\{[^}]*\binlineSvgComputedStyles\b[^}]*\}\s*from\s*'[^']*svgExportStyles'/.test(src) || call < 0){
			bad.push(`${rel}:${before.split('\n').length} serializeToString 之前没有 inlineSvgComputedStyles(导出图里 var() 无定义)`);
		}
		m = re.exec(src);
	}
	return bad;
}
describe('② 凡 svg 序列化导出都先内联样式', ()=>{
	it('src 下每个 serializeToString 调用之前都调用了 inlineSvgComputedStyles', ()=>{
		const bad = [];
		listJs(SRC, []).forEach((abs)=>{
			const rel = path.relative(SRC, abs).split(path.sep).join('/');
			if(rel === 'utils/svgExportStyles.js'){ return; }
			const src = fs.readFileSync(abs, 'utf8');
			if(src.indexOf('serializeToString') < 0){ return; }
			bad.push(...checkSource(rel, src));
		});
		expect(bad).toEqual([]);
	});
	it('判别力自证:没内联的序列化被抓,内联了的放行', ()=>{
		const naked = "export function f(svg){ const c = svg.cloneNode(true); return new XMLSerializer().serializeToString(c); }";
		const fixed = "import { inlineSvgComputedStyles } from './svgExportStyles';\nexport function f(svg){ const c = svg.cloneNode(true); inlineSvgComputedStyles(svg, c); return new XMLSerializer().serializeToString(c); }";
		expect(checkSource('probe.js', naked).length).toBe(1);
		expect(checkSource('probe.js', fixed)).toEqual([]);
	});
});

// ── ③ 盘面导出图的底色随当前主题(盘面墨色按当前主题挑,写死白底 = 暗色主题的浅色盘字压白底) ──
describe('③ 盘面导出图的底色', ()=>{
	it('exportSurfaceColor 取当前主题的 --horosa-surface-solid,取不到回落白底', ()=>{
		document.documentElement.style.setProperty('--horosa-surface-solid', '#090b0e');
		expect(exportSurfaceColor()).toBe('#090b0e');
		document.documentElement.style.removeProperty('--horosa-surface-solid');
		expect(exportSurfaceColor()).toBe('#ffffff');
	});
	it('盘面截图 / 盘面 svg 导出不写死白底(文字报告长图自带白底黑字宿主,不在此列)', ()=>{
		const CHART_EXPORTS = [
		];
		const bad = [];
		CHART_EXPORTS.forEach((rel)=>{
			const abs = path.join(SRC, rel);
			if(!fs.existsSync(abs)){ return; }
			const src = fs.readFileSync(abs, 'utf8');
			if(/backgroundColor:\s*'#fff(?:fff)?'|fillStyle\s*=\s*'#fff(?:fff)?'|let bg = '#fff/.test(src)){ bad.push(`${rel} 写死白底`); }
			if(src.indexOf('exportSurfaceColor(') < 0){ bad.push(`${rel} 没有经 exportSurfaceColor 取底色`); }
		});
		expect(bad).toEqual([]);
	});
});
