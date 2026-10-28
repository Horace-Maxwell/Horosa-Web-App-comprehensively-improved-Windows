// 页面源码里「有控件改得到」的设置键全集(非 .test.js:测试公因子,照 helpers/ 惯例)。
//
// 为什么要它:页面保存的设置件里有的键页面上没有任何控件(旧存储键 / 早已换了别的键在用),设置描述却把它列成可改项 ——
// 助手照写、回「已修改」,页面上一样都没变。这里按 AST 读页面源码,认出页面上**确有入口改它**的键:
//   ① 控件绑定:JSX 的 value / checked / selected / activeKey 属性里读到 this.state.K(或 this.state 的别名 .K、解构出来的 K);
//      配置对象写法 { value: s.K } / { checked: s.K } 同样算;
//   ② 写入入口:setState / setExtra / userSetExtra 的对象实参第一层键(实参是变量的,取该变量的对象初值与 变量.K = … 赋值);
//      onOptionChange('K', …);计算键 setState({ [key]: … }) 的页,把调用 this.某方法('K') 的字符串实参算进来(通用开关写法)。
// 构造函数里的 this.state = { … } 初值与 definePageSettings(…) 的 schema 本身不算入口(那是分母,不是控件)。
//
// controlKeysOf(文件绝对路径表) —— Set(键)。
const fs = require('fs');
const traverse = require('@babel/traverse').default;
const { parseModule } = require('./importSpecs');

const BIND_ATTRS = new Set(['value', 'checked', 'selected', 'activeKey']);
// 写入入口:setState / 盘壳 extra / 设置件 save / 盘壳左栏「亲手改」上报;本文件里把参数原样转交给它们的方法也算(changeCalc(patch) → setState(patch))
const BASE_WRITERS = ['setState', 'setExtra', 'userSetExtra', 'save', 'notifyUserFieldChange', 'onUserFieldChange'];

const keyName = (prop)=>{
	if(!prop || prop.computed){ return null; }
	if(prop.key && prop.key.type === 'Identifier'){ return prop.key.name; }
	if(prop.key && prop.key.type === 'StringLiteral'){ return prop.key.value; }
	return null;
};
const calleeName = (c)=>{
	if(!c){ return ''; }
	if(c.type === 'Identifier'){ return c.name; }
	if(c.type === 'MemberExpression' && !c.computed && c.property.type === 'Identifier'){ return c.property.name; }
	return '';
};
const isThisState = (n)=>n && n.type === 'MemberExpression' && !n.computed && n.object.type === 'ThisExpression' && n.property.name === 'state';

function scanFile(src, out){
	const ast = parseModule(src);
	// this.state 的别名(const s = this.state)与解构名(const { a, b: c } = this.state → c 读的是 b)
	const aliases = new Set();
	const destructured = {};
	traverse(ast, {
		VariableDeclarator(p){
			if(!isThisState(p.node.init)){ return; }
			if(p.node.id.type === 'Identifier'){ aliases.add(p.node.id.name); }
			else if(p.node.id.type === 'ObjectPattern'){
				p.node.id.properties.forEach((pr)=>{
					const k = keyName(pr);
					if(k && pr.value && pr.value.type === 'Identifier'){ destructured[pr.value.name] = k; }
					else if(k && pr.value && pr.value.type === 'AssignmentPattern' && pr.value.left.type === 'Identifier'){ destructured[pr.value.left.name] = k; }
				});
			}
		},
	});
	const stateReadsIn = (node)=>{
		const keys = [];
		const visit = (n)=>{
			if(!n || typeof n !== 'object'){ return; }
			if(Array.isArray(n)){ n.forEach(visit); return; }
			if(n.type === 'MemberExpression' && !n.computed && n.property.type === 'Identifier'){
				if(isThisState(n.object) || (n.object.type === 'Identifier' && aliases.has(n.object.name))){ keys.push(n.property.name); }
			}
			if(n.type === 'Identifier' && destructured[n.name]){ keys.push(destructured[n.name]); }
			Object.keys(n).forEach((k)=>{ if(k !== 'loc' && k !== 'start' && k !== 'end' && n[k] && typeof n[k] === 'object'){ visit(n[k]); } });
		};
		visit(node);
		return keys;
	};
	const objectKeys = (obj)=>(obj && obj.type === 'ObjectExpression' ? obj.properties.map(keyName).filter(Boolean) : []);
	// 转交型写入入口:方法 / 函数的某个参数原样交给写入入口 → 该方法也是写入入口(迭代到不再增加)
	const writers = new Set(BASE_WRITERS);
	const fnName = (fp)=>{
		const n = fp.node;
		if((n.type === 'ClassMethod' || n.type === 'ObjectMethod') && n.key && n.key.type === 'Identifier'){ return n.key.name; }
		if(n.type === 'FunctionDeclaration' && n.id){ return n.id.name; }
		if(fp.parentPath && (fp.parentPath.node.type === 'ClassProperty' || fp.parentPath.node.type === 'ObjectProperty') && fp.parentPath.node.key && fp.parentPath.node.key.type === 'Identifier'){ return fp.parentPath.node.key.name; }
		if(fp.parentPath && fp.parentPath.node.type === 'VariableDeclarator' && fp.parentPath.node.id.type === 'Identifier'){ return fp.parentPath.node.id.name; }
		return '';
	};
	for(let round = 0; round < 6; round++){
		const before = writers.size;
		traverse(ast, {
			CallExpression(p){
				if(!writers.has(calleeName(p.node.callee))){ return; }
				(p.node.arguments || []).forEach((a)=>{
					if(a.type !== 'Identifier'){ return; }
					const b = p.scope.getBinding(a.name);
					if(!b || b.kind !== 'param'){ return; }
					const name = fnName(b.scope.path);
					if(name){ writers.add(name); }
				});
			},
		});
		if(writers.size === before){ break; }
	}
	const hasComputed = (n)=>{
		if(!n || typeof n !== 'object'){ return false; }
		if(Array.isArray(n)){ return n.some(hasComputed); }
		if(n.type === 'ObjectProperty' && n.computed){ return true; }
		return Object.keys(n).some((k)=>k !== 'loc' && n[k] && typeof n[k] === 'object' && hasComputed(n[k]));
	};
	let computedWriter = false;
	const thisCallStrings = [];
	const rowStrings = [];
	traverse(ast, {
		ArrayExpression(p){
			// 选项表的行([['mixTian', '天盘层', …], …] / { book: [['cetianShowSihua', …]] }):行首字符串
			const first = p.node.elements && p.node.elements[0];
			if(first && first.type === 'StringLiteral' && p.parentPath.node.type === 'ArrayExpression'){ rowStrings.push(first.value); }
		},
		JSXAttribute(p){
			const n = p.node.name && p.node.name.name;
			if(!BIND_ATTRS.has(n) || !p.node.value || p.node.value.type !== 'JSXExpressionContainer'){ return; }
			stateReadsIn(p.node.value.expression).forEach((k)=>out.add(k));
		},
		ObjectProperty(p){
			const k = keyName(p.node);
			if(k !== 'value' && k !== 'checked'){ return; }
			stateReadsIn(p.node.value).forEach((x)=>out.add(x));
		},
		CallExpression(p){
			const name = calleeName(p.node.callee);
			const args = p.node.arguments || [];
			if(name === 'onOptionChange' || name === 'saveMapEntry'){
				if(args[0] && args[0].type === 'StringLiteral'){ out.add(args[0].value); }
				else if(args[0]){ computedWriter = true; }
			}
			if(p.node.callee.type === 'MemberExpression' && p.node.callee.object.type === 'ThisExpression'){
				args.forEach((a)=>{ if(a.type === 'StringLiteral'){ thisCallStrings.push(a.value); } });
			}
			if(!writers.has(name)){ return; }
			if(hasComputed(args)){ computedWriter = true; }
			args.forEach((a)=>{
				let obj = a;
				if(a.type === 'ArrowFunctionExpression' || a.type === 'FunctionExpression'){ obj = a.body.type === 'ObjectExpression' ? a.body : null; }
				if(obj && obj.type === 'ObjectExpression'){
					objectKeys(obj).forEach((k)=>out.add(k));
					// 计算键取自查表:const persistAs = { mode: 'keypointsMode' }[key]; save({ [persistAs]: v }) → 表里的字符串值
					obj.properties.forEach((pr)=>{
						if(!pr.computed || pr.key.type !== 'Identifier'){ return; }
						const b = p.scope.getBinding(pr.key.name);
						const init = b && b.path.node.type === 'VariableDeclarator' ? b.path.node.init : null;
						if(init && init.type === 'MemberExpression' && init.computed && init.object.type === 'ObjectExpression'){
							init.object.properties.forEach((q)=>{ if(q.value && q.value.type === 'StringLiteral'){ out.add(q.value.value); } });
						}
					});
				}else if(a.type === 'Identifier'){
					const b = p.scope.getBinding(a.name);
					if(!b){ return; }
					if(b.path.node.type === 'VariableDeclarator'){ objectKeys(b.path.node.init).forEach((k)=>out.add(k)); }
					b.referencePaths.forEach((rp)=>{
						const m = rp.parentPath;
						if(m && m.node.type === 'MemberExpression' && m.node.object === rp.node && m.parentPath.node.type === 'AssignmentExpression' && m.parentPath.node.left === m.node){
							if(!m.node.computed && m.node.property.type === 'Identifier'){ out.add(m.node.property.name); }
							else if(m.node.computed && m.node.property.type === 'StringLiteral'){ out.add(m.node.property.value); }
						}
					});
				}
			});
		},
	});
	// 动态键的写入(setState({ [key]: … }) / onOptionChange(key, …)):键来自调用处的字符串实参或选项表的行首
	if(computedWriter){ thisCallStrings.concat(rowStrings).forEach((k)=>out.add(k)); }
}

// 页面把「亲手改」上报接给了某个子组件(<盘壳 onUserFieldChange={…}>):那个子组件左栏上的控件也是本页的控件 → 一并扫
function delegatedControlFiles(file){
	const path = require('path');
	const src = fs.readFileSync(file, 'utf8');
	const ast = parseModule(src);
	const names = new Set();
	traverse(ast, {
		JSXOpeningElement(p){
			if((p.node.attributes || []).some((a)=>a.type === 'JSXAttribute' && a.name && a.name.name === 'onUserFieldChange') && p.node.name.type === 'JSXIdentifier'){ names.add(p.node.name.name); }
		},
	});
	const out = [];
	ast.program.body.forEach((n)=>{
		if(n.type !== 'ImportDeclaration' || !/^\.\.?\//.test(n.source.value)){ return; }
		if(!(n.specifiers || []).some((sp)=>names.has(sp.local.name))){ return; }
		const base = path.resolve(path.dirname(file), n.source.value);
		const hit = [base, `${base}.js`, path.join(base, 'index.js')].find((c)=>/\.js$/.test(c) && fs.existsSync(c));
		if(hit){ out.push(hit); }
	});
	return out;
}

function controlKeysOf(files){
	const out = new Set();
	const all = new Set(files);
	files.forEach((f)=>delegatedControlFiles(f).forEach((d)=>all.add(d)));
	all.forEach((f)=>scanFile(fs.readFileSync(f, 'utf8'), out));
	return out;
}

module.exports = { controlKeysOf, scanSource: (src)=>{ const s = new Set(); scanFile(src, s); return s; } };
