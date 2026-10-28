// 界面简繁 · 护栏:可搜索的下拉都按「看到的字」比对。
// 界面切到繁体后选项显示繁体,用户照屏幕输入繁体;选项数据却是简体 —— 直接 indexOf 永远对不上。
// 凡可搜索的 Select(showSearch,或 mode 为 multiple / tags —— 这两种缺省可搜)都必须经单源比对
// (utils/scriptMode.js 的 scriptFilterBy / scriptFilterOption / matchesUserQuery / scriptMatchKey):
//   · antd Select:必须写 filterOption,且其表达式(或它指向的 this.方法)经单源;filterOption={false}(远端搜)可以。
//   · XQSelect:不写 filterOption 时组件内缺省就走单源;写了也要经单源。
// 简体模式下单源与原比对逐字节等价,缺省结果不变。
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const SRC = path.resolve(__dirname, '../..');
const SINGLE_SOURCE_RE = /\b(scriptFilterBy|scriptFilterOption|matchesUserQuery|scriptMatchKey)\b/;

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

function visit(node, fn){
	if(!node || typeof node.type !== 'string'){ return; }
	fn(node);
	Object.keys(node).forEach((k)=>{
		if(k === 'loc' || k === 'start' || k === 'end' || k === 'leadingComments' || k === 'trailingComments'){ return; }
		const v = node[k];
		if(Array.isArray(v)){ v.forEach((c)=>{ if(c && typeof c.type === 'string'){ visit(c, fn); } }); }
		else if(v && typeof v.type === 'string'){ visit(v, fn); }
	});
}

function elementName(n){
	if(n.type === 'JSXIdentifier'){ return n.name; }
	if(n.type === 'JSXMemberExpression'){ return n.property.name; }
	return '';
}

function attrMap(opening){
	const m = {};
	opening.attributes.forEach((a)=>{ if(a.type === 'JSXAttribute' && a.name && a.name.type === 'JSXIdentifier'){ m[a.name.name] = a; } });
	return m;
}

function literalOf(attr){
	if(!attr){ return undefined; }
	if(attr.value === null){ return true; }
	if(attr.value.type === 'StringLiteral'){ return attr.value.value; }
	if(attr.value.type === 'JSXExpressionContainer'){
		const e = attr.value.expression;
		if(e.type === 'BooleanLiteral' || e.type === 'StringLiteral'){ return e.value; }
		return '<expr>';
	}
	return '<expr>';
}

function scan(file){
	const code = fs.readFileSync(file, 'utf8');
	if(!/showSearch|mode=/.test(code)){ return []; }
	let ast;
	try{
		ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport', 'objectRestSpread', 'exportDefaultFrom'] });
	}catch(e){ return [`解析失败:${e.message}`]; }
	// 本文件里的局部名 → 'antd'(antd 的 Select)/ 'xq'(xq-ui 的 XQSelect,含 XQSelect as Select 别名)
	const kinds = {};
	ast.program.body.forEach((b)=>{
		if(b.type !== 'ImportDeclaration'){ return; }
		const from = b.source.value;
		b.specifiers.forEach((sp)=>{
			if(!sp.imported){ return; }
			if(from === 'antd' && sp.imported.name === 'Select'){ kinds[sp.local.name] = 'antd'; }
			if(/(^|\/)xq-ui$/.test(from) && sp.imported.name === 'XQSelect'){ kinds[sp.local.name] = 'xq'; }
		});
	});
	if(/export function XQSelect\(/.test(code)){ kinds.Select = 'antd'; }   // xq-ui 本身:里面的 <Select> 是 antd 的
	const methods = {};
	visit(ast, (n)=>{
		if((n.type === 'ClassMethod' || n.type === 'ClassProperty') && n.key && n.key.name){ methods[n.key.name] = code.slice(n.start, n.end); }
	});
	const bad = [];
	visit(ast, (n)=>{
		if(n.type !== 'JSXOpeningElement'){ return; }
		const name = elementName(n.name);
		const kind = n.name.type === 'JSXIdentifier' ? kinds[name] : (n.name.object && n.name.object.name === 'antd' ? 'antd' : undefined);
		if(!kind){ return; }
		const attrs = attrMap(n);
		const show = literalOf(attrs.showSearch);
		const mode = literalOf(attrs.mode);
		const hasSpread = n.attributes.some((a)=>a.type === 'JSXSpreadAttribute');
		const searchable = (show !== undefined && show !== false) || mode === 'multiple' || mode === 'tags' || mode === '<expr>';
		if(!searchable){ return; }
		const line = n.loc.start.line;
		const fo = attrs.filterOption;
		if(!fo){
			if(kind === 'xq' || hasSpread){ return; }             // XQSelect 缺省走单源;展开属性的由来源处负责
			bad.push(`${line}: <${name}> 可搜索但没写 filterOption`);
			return;
		}
		if(literalOf(fo) === false){ return; }
		const exprSrc = code.slice(fo.value.start, fo.value.end);
		if(SINGLE_SOURCE_RE.test(exprSrc)){ return; }
		const m = exprSrc.match(/this\.(\w+)/);
		if(m && methods[m[1]] && SINGLE_SOURCE_RE.test(methods[m[1]])){ return; }
		bad.push(`${line}: <${name}> 的 filterOption 没经单源比对`);
	});
	return bad;
}

describe('可搜索的下拉都按「看到的字」比对(界面简繁)', () => {
	const report = {};
	let selects = 0;
	walk(SRC, []).forEach((file)=>{
		const rel = path.relative(SRC, file).split(path.sep).join('/');
		const code = fs.readFileSync(file, 'utf8');
		selects += (code.match(/showSearch/g) || []).length;
		const bad = scan(file);
		if(bad.length){ report[rel] = bad; }
	});

	it('扫到了足量的可搜索下拉(防扫描静默失效)', () => {
		expect(selects).toBeGreaterThan(40);
	});

	it('没有绕过单源比对的可搜索下拉', () => {
		expect(report).toEqual({});
	});

	it('XQSelect 缺省 filterOption 走单源', () => {
		const src = fs.readFileSync(path.join(SRC, 'components/xq-ui/index.js'), 'utf8');
		expect(src).toMatch(/filterOption\s*=\s*\{\s*scriptFilterBy\(/);
	});
});
