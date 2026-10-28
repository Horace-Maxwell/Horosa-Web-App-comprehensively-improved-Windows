// 原生对话框(window.confirm / alert / prompt)画在页面之外:界面简繁的显示层转不到(繁体界面里弹出简体)、
// 样式与明暗主题不随应用、还阻塞主线程。一律走组件式确认(utils/confirmDialog.js 的 confirmDialog,或组件自带的 XQModal / Popconfirm)。
// 新写出原生对话框 → 本测试红:改组件式,或在豁免表写理由。
//
// 判据按 AST + 作用域判(不按正则):凡引用到「全局」的 confirm / alert / prompt 即算 ——
//   · 裸标识符 confirm / alert / prompt 在作用域里**未绑定**(局部参数 / 解构出的同名函数 / import 进来的不算);
//   · 全局对象(window / globalThis / self / top / parent,本身也未绑定)上的同名属性(点号或 ['confirm'] 写法);
// 不只认调用:先取出来再调(const ask = window.confirm; ask())、当回调传(.then(confirm))同样算 —— 一样会弹原生框。
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const SRC = path.resolve(__dirname, '../..');
const NATIVE = new Set(['confirm', 'alert', 'prompt']);
const GLOBAL_OBJS = new Set(['window', 'globalThis', 'self', 'top', 'parent']);
const PLUGINS = ['jsx', 'classProperties', 'classPrivateProperties', 'classPrivateMethods', 'objectRestSpread', 'optionalChaining',
	'nullishCoalescingOperator', 'dynamicImport', 'decorators-legacy', 'exportDefaultFrom', 'topLevelAwait'];
// 「文件(相对 src)」→ 理由
const EXEMPT = {};

function walk(dir, out){
	fs.readdirSync(dir).forEach((f)=>{
		const p = path.join(dir, f);
		const st = fs.statSync(p);
		if(st.isDirectory()){
			if(f === '__tests__' || f === 'test' || f.startsWith('.umi')){ return; }
			walk(p, out);
		}else if(/\.(js|jsx)$/.test(f)){
			out.push(p);
		}
	});
	return out;
}

const propName = (m)=>{
	if(!m.computed && m.property.type === 'Identifier'){ return m.property.name; }
	if(m.computed && m.property.type === 'StringLiteral'){ return m.property.value; }
	if(m.computed && m.property.type === 'TemplateLiteral' && m.property.expressions.length === 0){ return m.property.quasis[0].value.cooked; }
	return null;
};

// 回这段源码里引用全局原生对话框的位置(行号列表);解析失败抛错(不静默放过)
function nativeDialogRefs(code){
	const ast = parser.parse(code, { sourceType: 'unambiguous', allowReturnOutsideFunction: true, plugins: PLUGINS });
	const hits = [];
	traverse(ast, {
		Identifier(p){
			const name = p.node.name;
			if(!NATIVE.has(name) || !p.isReferencedIdentifier()){ return; }
			if(p.scope.hasBinding(name, true)){ return; }
			hits.push(p.node.loc.start.line);
		},
		MemberExpression(p){
			const m = p.node;
			if(m.object.type !== 'Identifier' || !GLOBAL_OBJS.has(m.object.name)){ return; }
			if(p.scope.hasBinding(m.object.name, true)){ return; }
			const name = propName(m);
			if(name && NATIVE.has(name)){ hits.push(m.loc.start.line); }
		},
		OptionalMemberExpression(p){
			const m = p.node;
			if(m.object.type !== 'Identifier' || !GLOBAL_OBJS.has(m.object.name) || p.scope.hasBinding(m.object.name, true)){ return; }
			const name = propName(m);
			if(name && NATIVE.has(name)){ hits.push(m.loc.start.line); }
		},
	});
	return hits;
}
const count = (code)=>nativeDialogRefs(code).length;

describe('不用浏览器原生对话框(界面简繁 / 主题转不到)', () => {
	const files = walk(SRC, []);
	const found = {};
	const parseErrors = [];
	files.forEach((f)=>{
		const rel = path.relative(SRC, f).split(path.sep).join('/');
		let hits;
		try{ hits = nativeDialogRefs(fs.readFileSync(f, 'utf8')); }catch(e){ parseErrors.push(`${rel}: ${String(e.message).slice(0, 80)}`); return; }
		if(hits.length){ found[rel] = hits; }
	});

	it('扫到了足量的文件、全部解析成功(防扫描静默失效)', () => {
		expect(files.length).toBeGreaterThan(800);
		expect(parseErrors).toEqual([]);
	});

	it('没有未登记的原生对话框', () => {
		expect(Object.keys(found).filter((f)=>!EXEMPT[f]).map((f)=>`${f}:${found[f].join(',')}`)).toEqual([]);
	});

	it('豁免登记没有过期、都写了理由', () => {
		expect(Object.keys(EXEMPT).filter((f)=>!found[f] || !`${EXEMPT[f] || ''}`.trim())).toEqual([]);
	});

	it('形态样例:全局原生对话框都抓得到(含裸 confirm / prompt、取出来再调、当回调传)', () => {
		['window.confirm("x")', 'if(!window.confirm(`a`)) return;', 'window.alert(1)', 'window.prompt("名")', 'globalThis.confirm("x")',
			'alert("x")', 'confirm("删除?")', 'if(prompt("名")){ go(); }', 'const ask = window.confirm; ask("x");', 'p.then(confirm);',
			"window['confirm']('x')", 'self.alert(1)', 'window?.confirm("x")',
			'function f(){ return confirm("x"); }', 'const g = (a)=>alert(a);']
			.forEach((c)=>expect([c, count(c)]).toEqual([c, 1]));
	});

	it('形态样例:局部绑定的同名函数 / 参数 / 组件式 / 注释与字符串都不算', () => {
		['Modal.confirm({})', 'confirmDialog({})', 'asyncConfirm({})', '// window.confirm("注释")', 'x.prompt(1)',
			'const s = "window.confirm(1)";', 'const el = <T onFilter={(value, record, confirm)=>confirm()} />;',
			'function h({ confirm }){ confirm(); }', 'import { confirm } from "./dlg"; confirm();',
			'function k(alert){ alert(1); }', 'const window = { confirm(){ } }; window.confirm();',
			'const o = { confirm: 1, alert(){ } };', 'class A { confirm(){ } prompt = 1; }', 'obj.confirm = ()=>{};']
			.forEach((c)=>expect([c, count(c)]).toEqual([c, 0]));
	});
});
