/**
 * @jest-environment node
 */
// LESS 把网格简写里的 `a / b` 当除法算掉:`grid-row: 2 / 4` → 0.5(非法值,整条声明被丢弃)、
// `grid-column: 1 / -1` → -1(合法但意思全变:从最后一条线起只占一格,网格多出隐式列)。
// 两层判据:
//   ① 源码:*.less 里 grid-row / grid-column / grid-area 的值不得有「数 / 数」的未转义斜杠
//      (写法:起止分写 grid-*-start / grid-*-end,或 ~"2 / 4" 转义;`/ span N` LESS 不算,允许)。
//   ② 产物:用构建同一个 LESS 编译器现编每个 .less,编出的网格值不得是小数;简写不得是孤立负数。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const SRC = path.join(ROOT, 'src');
const less = require(path.join(ROOT, 'node_modules', '@umijs', 'deps', 'compiled', 'less'));

function listLess(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((d)=>{
		if(d.name === 'node_modules' || d.name === '.umi' || d.name === '.umi-production'){ return; }
		const p = path.join(dir, d.name);
		if(d.isDirectory()){ listLess(p, out); return; }
		if(/\.less$/.test(d.name)){ out.push(p); }
	});
	return out;
}
const stripComments = (t)=>`${t}`.replace(/\/\*[\s\S]*?\*\//g, (m)=>m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');

// ① 源码判据
const GRID_DECL = /grid-(row|column|area)\s*:\s*([^;}]*)/g;
function sourceHits(text){
	const out = [];
	const code = stripComments(text);
	let m;
	GRID_DECL.lastIndex = 0;
	while((m = GRID_DECL.exec(code))){
		const v = m[2].replace(/~"[^"]*"|~'[^']*'|e\([^)]*\)/g, '');
		// 斜杠两侧都是数(可带负号):LESS 会算掉;`/ span 2`、`/ auto`、具名线不算
		if(/-?\d+(\.\d+)?\s*\/\s*-?\d/.test(v)){ out.push(m[0].trim()); }
	}
	return out;
}

// ② 产物判据
function compiledHits(css){
	const out = [];
	const re = /grid-(row|column|area)(-start|-end)?\s*:\s*([^;}]*)/g;
	let m;
	while((m = re.exec(css))){
		const v = m[3].trim();
		if(/^-?\d*\.\d+$/.test(v)){ out.push(m[0]); continue; }   // 小数:非法值
		if(!m[2] && /^-\d+$/.test(v)){ out.push(m[0]); }   // 简写孤立负数 = 斜杠被算掉
	}
	return out;
}
async function compileFile(abs){
	// `~pkg/...` 是 webpack 的模块写法,这里按 node_modules 解析
	const text = fs.readFileSync(abs, 'utf8').replace(/(@import\s+(\([^)]*\)\s*)?['"])~/g, '$1');
	const r = await less.render(text, { filename: abs, javascriptEnabled: true, paths: [path.dirname(abs), path.join(ROOT, 'node_modules')] });
	return r.css;
}

describe('LESS 网格简写的斜杠不被当除法', ()=>{
	const files = listLess(SRC, []);
	it('能找到样式文件(判据有对象)', ()=>{
		expect(files.length).toBeGreaterThan(30);
	});
	it('源码:网格简写里没有未转义的「数 / 数」', ()=>{
		const bad = [];
		files.forEach((abs)=>{
			sourceHits(fs.readFileSync(abs, 'utf8')).forEach((h)=>bad.push(`${path.relative(SRC, abs)}: ${h}`));
		});
		expect(bad).toEqual([]);
	});
	it('产物:每个 .less 现编后网格值不是小数、简写不是孤立负数', async ()=>{
		const bad = [];
		const failed = [];
		for(const abs of files){
			let css;
			try{ css = await compileFile(abs); }catch(e){ failed.push(`${path.relative(SRC, abs)}: ${e.message}`); continue; }
			compiledHits(css).forEach((h)=>bad.push(`${path.relative(SRC, abs)}: ${h}`));
		}
		expect(failed).toEqual([]);   // 每个文件都必须编得过(编不过 = 判据看不见它)
		expect(bad).toEqual([]);
	}, 120000);
	it('判据自证:修前写法两层都红,起止分写 / 转义 / span 都绿', async ()=>{
		expect(sourceHits('.a{ grid-row: 2 / 4; }').length).toBe(1);
		expect(sourceHits('.a{ grid-column: 1 / -1; }').length).toBe(1);
		expect(sourceHits('.a{ grid-row: 2 / 4; }\n/* grid-row: 2 / 4 */').length).toBe(1);
		expect(sourceHits('.a{ grid-row-start: 2; grid-row-end: 4; grid-column: ~"1 / -1"; grid-row: 1 / span 2; }')).toEqual([]);
		const bad = (await less.render('.a{ grid-row: 2 / 4; grid-column: 1 / -1; grid-area: 1 / 3; }', {})).css;
		expect(compiledHits(bad).length).toBe(3);
		const good = (await less.render('.a{ grid-row-start: 2; grid-row-end: 4; grid-column-start: 1; grid-column-end: -1; grid-column: ~"1 / -1"; grid-row: 1 / span 2; grid-row: 2; }', {})).css;
		expect(compiledHits(good)).toEqual([]);
	});
});
