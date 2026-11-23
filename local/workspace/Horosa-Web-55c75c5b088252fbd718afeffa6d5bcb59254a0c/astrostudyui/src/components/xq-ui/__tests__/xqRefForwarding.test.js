// 统一件转 ref 合同。单选组统一件若是不转 ref 的普通函数组件,黄道星释基点单选组挂的
// ref(量组宽 → 窄栏折行)会被静默丢掉 —— 放大档永远进不了窄栏模式,星座名被栏的滚动盒横向裁掉。
// ① 原件收得下 ref 的统一件全部转 ref,挂上去拿得到东西;② 全仓凡往统一件(含 import 别名 / const X = XQRadio.Group 成员别名)
//    挂 ref 的地方,目标必须是转 ref 的统一件 —— 新写一处挂到不转 ref 的件上,这里当场红。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import fs from 'fs';
import path from 'path';
import * as XQ from '..';

const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const FORWARD_REF = Symbol.for('react.forward_ref');
const SRC = path.resolve(__dirname, '..', '..', '..');

// 原件收得下 ref 的统一件(名字 → 最小可渲染 props)
const REF_WRAPPERS = {
	XQButton: {},
	XQSwitch: {},
	XQCheckbox: {},
	'XQCheckbox.Group': { options: ['a'] },
	XQRadio: {},
	'XQRadio.Group': { options: ['a'] },
	'XQRadio.Button': { value: 'a' },
	XQSlider: {},
	XQInput: {},
	XQTextArea: {},
	XQSearch: {},
	XQInputNumber: {},
	XQSelect: {},
	XQTable: { columns: [], dataSource: [] },
	XQDatePicker: {},
	'XQDatePicker.RangePicker': {},
	XQTimePicker: {},
};
const resolve = (name)=>name.split('.').reduce((o, k)=>(o ? o[k] : undefined), XQ);

// antd 表格的响应式监听要 matchMedia(jsdom 没有);只在本测试里补桩,不动全局(别的测试依赖「没有 matchMedia」的分支)
beforeAll(()=>{
	if(typeof window.matchMedia !== 'function'){
		window.matchMedia = ()=>({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
	}
});

let host = null;
beforeEach(()=>{ host = document.createElement('div'); document.body.appendChild(host); });
afterEach(()=>{ ReactDOM.unmountComponentAtNode(host); host.remove(); });

describe('统一件转 ref', ()=>{
	test.each(Object.keys(REF_WRAPPERS))('%s 是转 ref 的件,挂上去拿得到东西', (name)=>{
		const C = resolve(name);
		expect(C && C.$$typeof).toBe(FORWARD_REF);
		const ref = React.createRef();
		act(()=>{ ReactDOM.render(React.createElement(C, { ...REF_WRAPPERS[name], ref }), host); });
		expect(ref.current).toBeTruthy();
	});

	test('🔴 单选组的 ref 拿到的是组的 DOM 节点(量宽度的前提)', ()=>{
		const ref = React.createRef();
		act(()=>{ ReactDOM.render(<XQ.XQRadio.Group ref={ref} options={['a', 'b']} />, host); });
		expect(ref.current instanceof HTMLElement).toBe(true);
		expect(ref.current.className).toMatch(/xq-radio-group/);
	});
});

// 全仓扫描:JSX 上挂了 ref 的统一件(按 import 与成员别名解析到统一件名)
function scanRefTargets(){
	const hits = [];
	(function walk(dir){
		fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
			const p = path.join(dir, e.name);
			if(e.isDirectory()){ if(!['__tests__', 'node_modules'].includes(e.name) && !e.name.startsWith('.umi')){ walk(p); } return; }
			if(!e.name.endsWith('.js')){ return; }
			const s = fs.readFileSync(p, 'utf8');
			if(!/xq-ui/.test(s) || !/\bref=/.test(s)){ return; }
			const ast = parser.parse(s, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'classPrivateProperties', 'decorators-legacy', 'exportDefaultFrom', 'dynamicImport', 'optionalChaining', 'nullishCoalescingOperator'] });
			const alias = new Map();
			traverse(ast, { ImportDeclaration(q){ if(/xq-ui$/.test(q.node.source.value)){ q.node.specifiers.forEach((sp)=>{ if(sp.imported){ alias.set(sp.local.name, sp.imported.name); } }); } } });
			traverse(ast, { VariableDeclarator(q){ const i = q.node.init; if(q.node.id.type === 'Identifier' && i && i.type === 'MemberExpression' && i.object.type === 'Identifier' && alias.has(i.object.name)){ alias.set(q.node.id.name, `${alias.get(i.object.name)}.${i.property.name}`); } } });
			traverse(ast, { JSXOpeningElement(q){
				const n = q.node.name;
				let name = null;
				if(n.type === 'JSXIdentifier' && alias.has(n.name)){ name = alias.get(n.name); }
				else if(n.type === 'JSXMemberExpression' && n.object.type === 'JSXIdentifier' && alias.has(n.object.name)){ name = `${alias.get(n.object.name)}.${n.property.name}`; }
				if(name && q.node.attributes.some((a)=>a.type === 'JSXAttribute' && a.name && a.name.name === 'ref')){ hits.push({ at: `${path.relative(SRC, p)}:${q.node.loc.start.line}`, name }); }
			} });
		});
	})(SRC);
	return hits;
}

describe('页面往统一件挂 ref 的地方', ()=>{
	const hits = scanRefTargets();
	test('扫得到(扫描不空转:黄道星释基点单选组就在里面)', ()=>{
		expect(hits.some((h)=>h.name === 'XQRadio.Group' && /AstroZR\.js/.test(h.at))).toBe(true);
	});
	test('🔴 目标全是转 ref 的统一件', ()=>{
		const bad = hits.filter((h)=>{ const C = resolve(h.name); return !(C && C.$$typeof === FORWARD_REF); }).map((h)=>`${h.at} <${h.name} ref=…>`);
		expect(bad).toEqual([]);
	});
});
