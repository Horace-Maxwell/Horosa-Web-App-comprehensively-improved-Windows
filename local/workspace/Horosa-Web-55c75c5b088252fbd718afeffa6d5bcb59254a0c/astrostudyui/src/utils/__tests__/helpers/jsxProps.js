// 「某个 JSX 元素上带了哪些属性、各是什么值」的判定(非 .test.js:测试公因子,照 helpers/ 惯例)。
//
// 为什么要它:读源码的接线锁过去用正则写死两个属性的相邻次序(`techniqueScope="…"\n\s*dispatch={…}`),
// 中间插一个无关属性、换个先后,锁就红 —— 接线没断、锁误报。这里改按 AST 读元素属性:只认「元素名 + 属性名 + 值」,与次序、排版无关。
//
// jsxElements(源码, 元素名) —— 该名字的每个开标签一项:{ 属性名: 值 },值 = 字符串字面量原文 / 表达式源码文本 / 无值属性记 true。
//   展开属性({...x})不计入。元素名可写 'A' 或成员式 'A.B'。
// jsxNodes(源码, 元素名) —— 同上,每项另带结构:{ attrs, children(开闭标签之间的源码,去首尾空白;自闭合为 ''),
//   ancestors(外层 JSX 元素名,由内向外), fn(最近一层函数 / 方法名,取不到为 null), fns(各层函数名,由内向外),
//   start(元素在源码里的起始下标), source(整个元素的源码,可再交给 jsxNodes 解析) }。
//   代替「<A 属性…>子节点」「<A[\s\S]{0,200}<B」「<A[^>]*属性」这类按排版写死的正则。
// jsxNodesInFile(文件, 元素名) —— 同 jsxNodes;拆成子模块的门面按 sourceSetFiles 逐个文件解析后合并。
const traverse = require('@babel/traverse').default;
const { parseModule } = require('./importSpecs');

const nameOf = (n)=>{
	if(!n){ return ''; }
	if(n.type === 'JSXIdentifier'){ return n.name; }
	if(n.type === 'JSXMemberExpression'){ return `${nameOf(n.object)}.${nameOf(n.property)}`; }
	if(n.type === 'JSXNamespacedName'){ return `${n.namespace.name}:${n.name.name}`; }
	return '';
};

function jsxElements(src, elementName){
	const text = `${src}`;
	const out = [];
	traverse(parseModule(text), {
		JSXOpeningElement(p){
			if(nameOf(p.node.name) !== elementName){ return; }
			const attrs = {};
			(p.node.attributes || []).forEach((a)=>{
				if(a.type !== 'JSXAttribute'){ return; }
				const key = nameOf(a.name);
				const v = a.value;
				if(!v){ attrs[key] = true; }
				else if(v.type === 'StringLiteral'){ attrs[key] = v.value; }
				else if(v.type === 'JSXExpressionContainer'){ attrs[key] = text.slice(v.expression.start, v.expression.end); }
				else{ attrs[key] = text.slice(v.start, v.end); }
			});
			out.push(attrs);
		},
	});
	return out;
}

function attrsOf(text, opening){
	const attrs = {};
	(opening.attributes || []).forEach((a)=>{
		if(a.type !== 'JSXAttribute'){ return; }
		const key = nameOf(a.name);
		const v = a.value;
		if(!v){ attrs[key] = true; }
		else if(v.type === 'StringLiteral'){ attrs[key] = v.value; }
		else if(v.type === 'JSXExpressionContainer'){ attrs[key] = text.slice(v.expression.start, v.expression.end); }
		else{ attrs[key] = text.slice(v.start, v.end); }
	});
	return attrs;
}

function fnNameOf(fp){
	const n = fp.node;
	if(n.id && n.id.name){ return n.id.name; }
	if(n.key && (n.key.name || n.key.value)){ return n.key.name || n.key.value; }
	const parent = fp.parentPath && fp.parentPath.node;
	if(parent && parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier'){ return parent.id.name; }
	if(parent && (parent.type === 'ClassProperty' || parent.type === 'ObjectProperty') && parent.key){ return parent.key.name || parent.key.value; }
	return null;
}

function jsxNodes(src, elementName){
	const text = `${src}`;
	const out = [];
	traverse(parseModule(text), {
		JSXElement(p){
			const op = p.node.openingElement;
			if(nameOf(op.name) !== elementName){ return; }
			const cl = p.node.closingElement;
			const ancestors = [];
			const fns = [];
			for(let q = p.parentPath; q; q = q.parentPath){
				if(q.isJSXElement()){ ancestors.push(nameOf(q.node.openingElement.name)); }
				if(q.isFunction()){ fns.push(fnNameOf(q)); }
			}
			out.push({
				attrs: attrsOf(text, op),
				children: cl ? text.slice(op.end, cl.start).trim() : '',
				ancestors,
				fn: fns.length ? fns[0] : null,
				fns,
				start: p.node.start,
				source: text.slice(p.node.start, p.node.end),
			});
		},
	});
	return out;
}

function jsxNodesInFile(file, elementName){
	const fs = require('fs');
	const { sourceSetFiles } = require('./sourceSet');
	return sourceSetFiles(file).reduce((acc, f)=>acc.concat(jsxNodes(fs.readFileSync(f, 'utf8'), elementName)), []);
}

module.exports = { jsxElements, jsxNodes, jsxNodesInFile };
