/**
 * 窄栏 / 放大档「字被裁、逐字竖排、内容够不着、覆盖规则静默不生效」源码闸(真内核里由版面巡检的 UNREACH / DEGENERATE / TEXTCLIP 判)。
 *   ① 三式右栏:卡身不滚时,内层页签内容区必须接手滚动(同为 !important 且更具体),不许「卡身 hidden、内层 visible」
 *   ② 下拉选项的折行属性按层叠真正生效的那条算:white-space normal + overflow-wrap anywhere(后写的低权重覆盖曾静默不生效)
 *   ③ 神易数神煞 / 角色卡:网格窄时退列,名 / 值不许同时 nowrap + overflow:hidden(硬裁)
 *   ④ 表格标签折行口径单源 labelCell:短标签不折、带断点的标签只在断点换行;登记过的窄表都用它
 *   ⑤ 棘轮:行内定宽(width: 数字)的文字 span 不带 nowrap、原生表格里 ≤ 4 字的字面量表头 / 单元格不带折行口径 —— 只许减少
 *   ⑧ 棘轮:网格首列写死 ≥ 60px 下限的标签列 —— 只许减少(新写的标签列下限随行宽收)
 */
const fs = require('fs');
const path = require('path');
const { sourceSetFiles } = require('./helpers/sourceSet');
// 文件级标记(带它的文件不进共享基线);拼出来写,避免本文件自身被当成带标记的文件
const FILE_ONLY_MARK = new RegExp('^\\s*(//|/\\*)\\s*@horosa-' + 'private' + '-only');

const SRC = path.resolve(__dirname, '..', '..');
// 带文件级标记的文件不进共享基线表,另记一份附加基线(文件不存在时按空表 —— 这类文件出现却没登记 = 红,不再整件跳过)
const EXTRA_BASE_FILES = [];
const loadExtraBase = (key)=>{ const out = {}; EXTRA_BASE_FILES.filter((f)=>fs.existsSync(f)).forEach((f)=>{ Object.assign(out, JSON.parse(fs.readFileSync(f, 'utf8'))[key] || {}); }); return out; };
const writeExtraBase = (key, val)=>{ EXTRA_BASE_FILES.forEach((f)=>{ const all = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { _marker: '@horosa-' + 'private' + '-only' }; all[key] = val; fs.writeFileSync(f, `${JSON.stringify(all, null, 1)}\n`); }); };
const read = (r)=>fs.readFileSync(path.join(SRC, r), 'utf8');
const exists = (r)=>fs.existsSync(path.join(SRC, r));
const stripComments = (t)=>t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/[^\n]*/g, '$1');

// 极简 LESS 规则表:[{ sel: [选择器…], decls: {属性: {v, imp}}, media, order }];:global { } 与 @media { } 只当容器
function parseLess(text, base = 0){
	const t = stripComments(text);
	const rules = [];
	const stack = [];
	let buf = '';
	let order = base;
	for(let i = 0; i < t.length; i += 1){
		const ch = t[i];
		if(ch === '{'){
			const head = buf.trim(); buf = '';
			if(/^@media|^@supports|^:global\s*$/.test(head) || head === ''){
				stack.push({ container: true, media: /^@media/.test(head) });
			}else{
				const parent = [...stack].reverse().find((x)=>!x.container);
				let sel = head.split(',').map((x)=>x.trim()).filter(Boolean);
				if(parent){ sel = parent.sel.flatMap((p)=>sel.map((c)=>(c.indexOf('&') >= 0 ? c.replace(/&/g, p) : `${p} ${c}`))); }
				stack.push({ sel, decls: {}, media: stack.some((x)=>x.media) });
			}
		}else if(ch === '}'){
			const top = stack.pop();
			const last = buf.trim(); buf = '';
			if(top && !top.container){
				if(last){ addDecl(top, last); }
				order += 1;
				rules.push({ sel: top.sel, decls: top.decls, media: top.media, order });
			}
		}else if(ch === ';'){
			const top = stack[stack.length - 1];
			if(top && !top.container){ addDecl(top, buf.trim()); }
			buf = '';
		}else{
			buf += ch;
		}
	}
	return rules;
}
function addDecl(rule, d){
	const m = d.match(/^([a-z-]+)\s*:\s*([\s\S]+)$/);
	if(!m){ return; }
	const imp = /!important\s*$/.test(m[2]);
	rule.decls[m[1]] = { v: m[2].replace(/!important\s*$/, '').trim(), imp };
}
const specOf = (sel)=>{
	const s = sel.replace(/:global\(([^()]*)\)/g, '$1').replace(/::[a-z-]+/g, '');
	const ids = (s.match(/#[\w-]+/g) || []).length;
	const b = (s.match(/\.[\w-]+/g) || []).length + (s.match(/\[[^\]]*\]/g) || []).length + (s.match(/:(?!not|is|where)[a-z-]+/g) || []).length;
	const c = (s.replace(/[.#][\w-]+|\[[^\]]*\]|:[a-z-]+(\([^)]*\))?/g, ' ').match(/(^|[\s>+~])[a-z][a-z0-9]*/g) || []).length;
	return ids * 10000 + b * 100 + c;
};
// 全站样式区段次序 = 源码全集登记表里 app.less 门面的子模块次序(与门面 @import 次序同一来源;门面本身只有 @import 行)
const APP_ORDER = sourceSetFiles(path.join(SRC, 'layouts/app.less')).slice(0, -1).map((f)=>path.relative(SRC, f).split(path.sep).join('/'));
const APP_RULES = (()=>{
	let n = 0; const all = [];
	APP_ORDER.forEach((f)=>{ const rs = parseLess(read(f), n * 100000); rs.forEach((r)=>{ r.file = f; }); all.push(...rs); n += 1; });
	return all;
})();
// 一个元素(只有给定的类,祖先只有给定的类集)上某属性的层叠赢家
function cascadeWinner(prop, targetClass, ancestorClasses){
	const allowed = new Set([targetClass, ...ancestorClasses]);
	let win = null;
	APP_RULES.forEach((r)=>{
		if(r.media || !r.decls[prop]){ return; }
		r.sel.forEach((sel)=>{
			const compounds = sel.replace(/:global\(([^()]*)\)/g, '$1').split(/\s*[>+~]\s*|\s+/).filter(Boolean);
			const lastC = compounds[compounds.length - 1];
			if(!lastC || (lastC.match(/\.[\w-]+/g) || []).indexOf(`.${targetClass}`) < 0){ return; }
			const ok = compounds.every((c)=>!/[#[:]/.test(c) && (c.match(/\.[\w-]+/g) || []).every((k)=>allowed.has(k.slice(1))) && !/^[a-z]/.test(c));
			if(!ok){ return; }
			const d = r.decls[prop];
			const key = [d.imp ? 1 : 0, specOf(sel), r.order];
			if(!win || key[0] > win.key[0] || (key[0] === win.key[0] && (key[1] > win.key[1] || (key[1] === win.key[1] && key[2] > win.key[2])))){ win = { key, v: d.v, sel, file: r.file }; }
		});
	});
	return win;
}

describe('窄栏文字 / 内容可达 · 源码闸', ()=>{
	test('① 三式右栏卡身不滚时内层内容区接手滚动(规则同为 !important 且严格更具体)', ()=>{
		const rules = parseLess(read('layouts/app/22-tail-fixes.less'));
		const find = (re)=>rules.find((r)=>r.sel.some((s)=>re.test(s)));
		const body = find(/\.ant-card\.horosa-sanshi-subtabs-card > \.ant-card-body$/);
		const tabs = find(/\.ant-card\.horosa-sanshi-subtabs-card > \.ant-card-body > \.horosa-sanshi-liureng-tabs$/);
		const holder = find(/\.ant-card\.horosa-sanshi-subtabs-card > \.ant-card-body > \.horosa-sanshi-liureng-tabs > \.ant-tabs-content-holder$/);
		expect(body && body.decls['overflow-y']).toEqual({ v: 'hidden', imp: true });
		expect(body.decls.display && body.decls.display.v).toBe('flex');
		expect(body.decls['flex-direction'] && body.decls['flex-direction'].v).toBe('column');
		expect(tabs && tabs.decls.height).toEqual({ v: '100%', imp: true });
		expect(tabs.decls['min-height'] && tabs.decls['min-height'].v).toBe('0');
		expect(holder && holder.decls['overflow-y']).toEqual({ v: 'auto', imp: true });
		expect(holder.decls['min-height'] && holder.decls['min-height'].v).toBe('0');
		expect(holder.decls.flex && holder.decls.flex.v).toBe('1 1 auto');
		// 被覆盖的通用规则(14-page-fixes:height:auto / overflow:visible !important)权重必须严格低于上面两条
		const generic = parseLess(read('layouts/app/14-page-fixes.less')).filter((r)=>r.sel.some((s)=>/\.horosa-sanshi-liureng-tabs( > \.ant-tabs-content-holder)?$/.test(s)) && r.decls.overflow && r.decls.overflow.imp);
		expect(generic.length).toBeGreaterThan(0);
		const maxGeneric = Math.max(...generic.flatMap((r)=>r.sel.filter((s)=>/sanshi-liureng-tabs/.test(s)).map(specOf)));
		expect(specOf(tabs.sel[0])).toBeGreaterThan(maxGeneric);
		expect(specOf(holder.sel[0])).toBeGreaterThan(maxGeneric);
	});

	test('② 下拉选项层叠生效的是 white-space normal + overflow-wrap anywhere(长串无断点时也折行不省略)', ()=>{
		const anc = ['ant-select-dropdown', 'ant-select-item', 'ant-select-item-option', 'horosa-workspace-shell'];
		const ws = cascadeWinner('white-space', 'ant-select-item-option-content', anc);
		const ow = cascadeWinner('overflow-wrap', 'ant-select-item-option-content', anc);
		expect(ws && ws.v).toBe('normal');
		expect(ow && ow.v).toBe('anywhere');
		// 同一元素的 overflow-wrap / word-break 只在一处写(各页更高权重的专用下拉除外 —— 它们的选择器带页面类,上面的赢家计算不含)
		const writers = APP_RULES.filter((r)=>!r.media && (r.decls['overflow-wrap'] || r.decls['word-break']) && r.sel.some((s)=>/^(\.horosa-workspace-shell\s+)?(\.ant-select-dropdown\s+)?\.ant-select-item-option-content$/.test(s.trim())));
		expect(writers.map((r)=>r.file)).toEqual(['layouts/app/02-shell.less']);
	});

	test('③ 神易数神煞 / 季令卡窄栏退列;神煞 / 角色卡的名与值不许 nowrap + overflow:hidden 硬裁', ()=>{
		const t = read('layouts/app/10-huangji-wuzhao.less');
		const rules = parseLess(t);
		const last = (re, prop)=>{ let v = null; rules.forEach((r)=>{ if(!r.media && r.decls[prop] && r.sel.some((s)=>re.test(s))){ v = r.decls[prop].v; } }); return v; };
		expect(last(/\.horosa-shenyishu-shensha-grid$/, 'grid-template-columns')).toMatch(/repeat\(auto-fill, minmax\(~?"?max\(96px, calc\(\(100% - 30px\) \/ 4 - 1px\)\)"?, 1fr\)\)/);
		['role', 'shensha'].forEach((kind)=>{
			['span', 'strong'].forEach((tag)=>{
				const re = new RegExp(`\\.horosa-shenyishu-${kind}-card ${tag}$`);
				const ov = last(re, 'overflow'); const ws = last(re, 'white-space');
				expect([kind, tag, ws === 'nowrap' && ov === 'hidden']).toEqual([kind, tag, false]);
			});
		});
	});

	test('④ 标签折行口径单源 labelCell:短标签不折、带断点的标签只在断点换行、长文本照常', ()=>{
		// eslint-disable-next-line global-require
		const { labelCellStyle, withLabelCell } = require('../labelCell');
		expect(labelCellStyle('正位')).toEqual({ whiteSpace: 'nowrap' });
		expect(labelCellStyle('8 宫')).toEqual({ whiteSpace: 'nowrap' });
		expect(labelCellStyle(10)).toEqual({ whiteSpace: 'nowrap' });
		expect(labelCellStyle('昼(日出起)')).toEqual({ wordBreak: 'keep-all' });
		expect(labelCellStyle('宫主落宫(整宫)')).toEqual({ wordBreak: 'keep-all' });
		expect(labelCellStyle('这是一段很长的说明文字放不下时照常折行')).toBe(null);
		expect(labelCellStyle('巨蟹座守护星群')).toBe(null);   // 没有断点的 5 字以上不收紧(否则整列被撑宽)
		expect(labelCellStyle(null)).toBe(null);
		const base = { padding: 2 };
		expect(withLabelCell(base, '很长很长很长很长很长很长很长')).toBe(base);
		expect(withLabelCell(base, '世/应')).toEqual({ padding: 2, whiteSpace: 'nowrap' });
		// 登记过的窄表(放大档 / 窄列实测逐字竖排过的)都走单源
		const USERS = [
			'components/astro/AstroExtraCommon.js',
			'components/tarot/TarotMain.js',
			'components/horary/HoraryJudgment.js',
			'components/election/ElectionJudgment.js',
			'components/tongshefa/TongSheFaMain.js',
		];
		USERS.filter(exists).forEach((f)=>{ expect([f, /from '\.\.\/\.\.\/utils\/labelCell'/.test(read(f))]).toEqual([f, true]); });
		expect(read('components/tarot/TarotMain.js')).toMatch(/style=\{labelCellStyle\(this\.orientLabel\(d\)\)\}/);
	});

	test('⑥ 三式合一盘的盘摞子盒不许被纵向压扁(定高盘框被压矮 = 盘底一整排宫位被裁)', ()=>{
		const t = stripComments(read('components/sanshi/SanShiUnitedMain.less'));
		const m = t.match(/\.boardStack > \* \{([^}]*)\}/);
		expect(m && /flex-shrink:\s*0/.test(m[1])).toBe(true);
	});

	test('⑦ 棘轮:固定 N(≥ 3)列的 1fr 网格(窄栏不退列 → 两字竖排 / 撑出被裁)—— 每个文件只许减少;新写的用 auto-fill + 列下限', ()=>{
		const RE = /repeat\(\s*([3-9]|1[0-9])\s*,\s*(?:minmax\(\s*0(?:px)?\s*,\s*1fr\s*\)|1fr)\s*\)/g;
		const cur = {}; const curExtra = {};
		const walk = (d)=>{ fs.readdirSync(d).forEach((n)=>{ const p = path.join(d, n); if(n === '__tests__' || n === 'node_modules'){ return; } if(fs.statSync(p).isDirectory()){ walk(p); }else if(/\.(less|js)$/.test(n)){ const t = fs.readFileSync(p, 'utf8'); const k = (stripComments(t).match(RE) || []).length; if(k){ (FILE_ONLY_MARK.test(t) ? curExtra : cur)[path.relative(SRC, p).split(path.sep).join('/')] = k; } } }); };
		walk(path.join(SRC, 'components')); walk(path.join(SRC, 'layouts'));
		// eslint-disable-next-line global-require
		const BASE = require('./narrowLabelLayout.baseline.json').fixedGrid || {};
		if(process.env.NARROW_BASELINE_WRITE){ const all = JSON.parse(fs.readFileSync(path.join(__dirname, 'narrowLabelLayout.baseline.json'), 'utf8')); all.fixedGrid = cur; fs.writeFileSync(path.join(__dirname, 'narrowLabelLayout.baseline.json'), `${JSON.stringify(all, null, 1)}\n`); writeExtraBase('fixedGrid', curExtra); }
		const over = (c, b)=>Object.keys(c).filter((f)=>c[f] > (b[f] || 0)).map((f)=>`${f}: ${c[f]} > ${b[f] || 0}`);
		expect(over(cur, BASE)).toEqual([]);
		expect(over(curExtra, loadExtraBase('fixedGrid'))).toEqual([]);
		expect(Object.keys(cur).length).toBeGreaterThan(3);
		expect(read('components/astro/AstroEgypt.js')).not.toMatch(/repeat\(9, 1fr\)/);
	});

	test('⑧ 棘轮:网格首列写死 ≥ 60px 下限的标签列(minmax(Npx, …))—— 窄档值列被挤成 0 宽、逐字竖排;新写的用 minmax(min(Npx, N%), …)', ()=>{
		const RE = /grid-template-columns\s*:\s*minmax\(\s*(\d+(?:\.\d+)?)px\s*,/g;
		const cur = {}; const curExtra = {};
		const walk = (d)=>{ fs.readdirSync(d).forEach((n)=>{ const p = path.join(d, n); if(n === '__tests__' || n === 'node_modules'){ return; } if(fs.statSync(p).isDirectory()){ walk(p); }else if(/\.(less|js)$/.test(n)){ const t = fs.readFileSync(p, 'utf8'); let k = 0; let m; const re = new RegExp(RE.source, 'g'); const body = stripComments(t); while((m = re.exec(body))){ if(Number(m[1]) >= 60){ k += 1; } } if(k){ (FILE_ONLY_MARK.test(t) ? curExtra : cur)[path.relative(SRC, p).split(path.sep).join('/')] = k; } } }); };
		walk(path.join(SRC, 'components')); walk(path.join(SRC, 'layouts'));
		// eslint-disable-next-line global-require
		const BASE = require('./narrowLabelLayout.baseline.json').labelMinmax || {};
		if(process.env.NARROW_BASELINE_WRITE){ const all = JSON.parse(fs.readFileSync(path.join(__dirname, 'narrowLabelLayout.baseline.json'), 'utf8')); all.labelMinmax = cur; fs.writeFileSync(path.join(__dirname, 'narrowLabelLayout.baseline.json'), `${JSON.stringify(all, null, 1)}\n`); writeExtraBase('labelMinmax', curExtra); }
		const over = (c, b)=>Object.keys(c).filter((f)=>c[f] > (b[f] || 0)).map((f)=>`${f}: ${c[f]} > ${b[f] || 0}`);
		expect(over(cur, BASE)).toEqual([]);
		expect(over(curExtra, loadExtraBase('labelMinmax'))).toEqual([]);
		expect(Object.keys(cur).length).toBeGreaterThan(2);   // 防遍历静默失效
		// 信息行(十一个技法共用)已改成随行宽收的下限
		expect(read('layouts/app/10-huangji-wuzhao.less')).toMatch(/\.horosa-huangji-info-row \{\s*display: grid;\s*grid-template-columns: minmax\(~"min\(90px, 40%\)", 32%\)/);
	});


	test('⑤ 棘轮:定宽文字 span 不带 nowrap / 原生表格 ≤ 4 字字面量表头单元格不带折行口径 —— 每个文件只许减少', ()=>{
		// eslint-disable-next-line global-require
		const parser = require('@babel/parser');
		// eslint-disable-next-line global-require
		const traverse = require('@babel/traverse').default;
		const files = [];
		(function walk(d){ fs.readdirSync(d).forEach((n)=>{ const p = path.join(d, n); if(n === '__tests__' || n === 'node_modules'){ return; } if(fs.statSync(p).isDirectory()){ walk(p); }else if(/\.js$/.test(n)){ files.push(p); } }); })(path.join(SRC, 'components'));
		const shared = { fixedSpan: {}, shortCell: {} }; const extra = { fixedSpan: {}, shortCell: {} };
		files.forEach((abs)=>{
			const src = fs.readFileSync(abs, 'utf8');
			if(!/<span|<t[hd]\b/.test(src)){ return; }
			// 带文件级标记的文件不进共享的基线表,计进附加基线(同样只许减少)
			const { fixedSpan, shortCell } = FILE_ONLY_MARK.test(src) ? extra : shared;
			let ast; try{ ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator', 'objectRestSpread', 'dynamicImport'] }); }catch(e){ return; }
			const rel = path.relative(SRC, abs).split(path.sep).join('/');
			traverse(ast, { JSXElement(p){
				const op = p.node.openingElement; if(op.name.type !== 'JSXIdentifier'){ return; }
				const attrs = src.slice(op.start, op.end);
				const kids = p.node.children.filter((c)=>!(c.type === 'JSXText' && !c.value.trim()));
				if(op.name.name === 'span' && /style=\{\{[^}]*\bwidth:\s*\d+\s*[,}]/.test(attrs) && !/nowrap|labelCell/.test(attrs) && kids.length){ fixedSpan[rel] = (fixedSpan[rel] || 0) + 1; }
				if(/^t[hd]$/.test(op.name.name) && kids.length === 1 && kids[0].type === 'JSXText' && Array.from(kids[0].value.trim()).length <= 4 && !/nowrap|labelCell/.test(attrs)){ shortCell[rel] = (shortCell[rel] || 0) + 1; }
			} });
		});
		// eslint-disable-next-line global-require
		const BASE = require('./narrowLabelLayout.baseline.json');
		const over = (cur, base)=>Object.keys(cur).filter((f)=>cur[f] > (base[f] || 0)).map((f)=>`${f}: ${cur[f]} > ${base[f] || 0}`);
		if(process.env.NARROW_BASELINE_WRITE){ const all = JSON.parse(fs.readFileSync(path.join(__dirname, 'narrowLabelLayout.baseline.json'), 'utf8')); all.fixedSpan = shared.fixedSpan; all.shortCell = shared.shortCell; fs.writeFileSync(path.join(__dirname, 'narrowLabelLayout.baseline.json'), `${JSON.stringify(all, null, 1)}\n`); writeExtraBase('fixedSpan', extra.fixedSpan); writeExtraBase('shortCell', extra.shortCell); }
		expect(over(shared.fixedSpan, BASE.fixedSpan)).toEqual([]);
		expect(over(shared.shortCell, BASE.shortCell)).toEqual([]);
		expect(over(extra.fixedSpan, loadExtraBase('fixedSpan'))).toEqual([]);
		expect(over(extra.shortCell, loadExtraBase('shortCell'))).toEqual([]);
		expect(Object.keys(shared.fixedSpan).length + Object.keys(shared.shortCell).length).toBeGreaterThan(5);   // 防遍历静默失效
	});
});
