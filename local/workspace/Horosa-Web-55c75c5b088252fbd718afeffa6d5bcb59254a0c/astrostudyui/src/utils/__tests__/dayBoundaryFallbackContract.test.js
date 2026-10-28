// 日界 / 晚子时两键「缺键回落」合同(全 src):选项里缺 after23NewDay / lateZiHourUseNextDay 时一律取全局现值
// (utils/dayBoundaryResolve 的 resolveAfter23NewDay / resolveLateZiHourUseNextDay,或 dayBoundary 的 default* 两函数),
// 不许写死 0 / 1。全局改成「24 点换日」后,写死回落的地方仍按 23 点算,同一张盘里日柱与奇门局 / 截盘与正文各说各的。
// AST 判据(剥掉注释与字符串的影响),五种写法:
//   R1  key || 字面量 / key ?? 字面量
//   R2  key !== undefined ? … : 字面量(含 != null / === undefined 反写)
//   R3  两支都是 0 / 1 / 布尔字面量的三元,判定里读了 key(`o.key === 1 ? 1 : 0` 把缺键压成写死值)
//   R4  对象字面量里 key: 字面量(缺省对象 / 构参写死)
//   R5  下拉描述 { key: 'after23NewDay', dv: 字面量 }(显示缺省)
//   R6  把键值当真假用:!!x.key / x.key && … / x.key ? … : … / if(x.key) —— 缺键按「不进位」、'0' 字符串当成开;
//       一律经 resolve 两函数归一后再比(`resolveAfter23NewDay(x.after23NewDay) === 1`)。
//       字段外壳的存在判断(`f.key && f.key.value …`,后面紧接着读同一个外壳的 .value)不算。
// 确属「值形映射表」而非缺键回落的,登记在 EXEMPT 并写理由;豁免以「文件 + 规则 + 代码片段」为键,不含行号。
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const SRC = path.join(__dirname, '..', '..');
const KEYS = new Set(['after23NewDay', 'lateZiHourUseNextDay', 'guaAfter23NewDay']);   // guaAfter23NewDay = 六壬 / 金口诀起课时刻的日界

const EXEMPT = {
	// 紫微「晚子时」三档方案 → 两键的值映射表(档名本身就是值,不是缺键回落)
	'components/ziwei/ZiweiCalc.js|R4|after23NewDay: 0': '紫微晚子时方案映射表',
	'components/ziwei/ZiweiCalc.js|R4|lateZiHourUseNextDay: 1': '紫微晚子时方案映射表',
	'components/ziwei/ZiweiCalc.js|R4|lateZiHourUseNextDay: 0': '紫微晚子时方案映射表',
	'components/ziwei/ZiweiCalc.js|R4|after23NewDay: 1': '紫微晚子时方案映射表',
};

function listJs(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((d)=>{
		if(d.name === 'node_modules' || d.name === '__tests__' || d.name === '.umi' || d.name === '.umi-production'){ return; }
		const p = path.join(dir, d.name);
		if(d.isDirectory()){ listJs(p, out); return; }
		if(/\.(js|jsx)$/.test(d.name) && !/\.test\.js$/.test(d.name)){ out.push(p); }
	});
	return out;
}
function parse(text){
	return parser.parse(text, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'objectRestSpread', 'dynamicImport', 'nullishCoalescingOperator'], errorRecovery: true });
}
const isLit = (n)=>n && ((n.type === 'NumericLiteral' && (n.value === 0 || n.value === 1)) || n.type === 'BooleanLiteral');
const propName = (m)=>{
	if(!m || (m.type !== 'MemberExpression' && m.type !== 'OptionalMemberExpression')){ return null; }
	if(!m.computed && m.property.type === 'Identifier'){ return m.property.name; }
	if(m.computed && m.property.type === 'StringLiteral'){ return m.property.value; }
	return null;
};
// key 引用:o.key / o.key.value / 裸标识符 key
function isKeyRef(n){
	if(!n){ return false; }
	if(n.type === 'Identifier'){ return KEYS.has(n.name); }
	const p = propName(n);
	if(p && KEYS.has(p)){ return true; }
	if(p === 'value' && isKeyRef(n.object)){ return true; }
	return false;
}
function mentionsKey(n){
	let hit = false;
	const visit = (x)=>{
		if(hit || !x || typeof x.type !== 'string'){ return; }
		if(isKeyRef(x)){ hit = true; return; }
		Object.keys(x).forEach((k)=>{
			if(k === 'loc' || k === 'start' || k === 'end' || k === 'leadingComments' || k === 'trailingComments'){ return; }
			const v = x[k];
			if(Array.isArray(v)){ v.forEach(visit); } else if(v && typeof v === 'object'){ visit(v); }
		});
	};
	visit(n);
	return hit;
}
// 判定是否「有没有这个键」的检查:x !== undefined / x != null / x === undefined / x == null
function isPresenceCheck(t){
	if(!t){ return false; }
	if(t.type === 'LogicalExpression'){ return isPresenceCheck(t.left) || isPresenceCheck(t.right); }
	if(t.type !== 'BinaryExpression' || !/^[!=]==?$/.test(t.operator)){ return false; }
	const nil = (x)=>x && ((x.type === 'Identifier' && x.name === 'undefined') || x.type === 'NullLiteral');
	return (nil(t.right) && isKeyRef(t.left)) || (nil(t.left) && isKeyRef(t.right));
}

function scanText(text, rel){
	const hits = [];
	const snip = (n)=>text.slice(n.start, n.end).replace(/\s+/g, ' ').slice(0, 120);
	const add = (rule, n)=>{
		const id = `${rel}|${rule}|${snip(n)}`;
		if(!EXEMPT[id]){ hits.push(id); }
	};
	// R6:`a && b && c` 摊平;某一非末项是键值引用、且下一项不是在读它的 .value(字段外壳存在判断)→ 当真假用了
	const flatAnd = (x)=>(x && x.type === 'LogicalExpression' && x.operator === '&&' ? [...flatAnd(x.left), ...flatAnd(x.right)] : [x]);
	const readsValueOf = (x, wrapper)=>{
		const w = snip(wrapper);
		let hit = false;
		const v = (y)=>{
			if(hit || !y || typeof y.type !== 'string'){ return; }
			if(propName(y) === 'value' && y.object && snip(y.object) === w){ hit = true; return; }
			Object.keys(y).forEach((k)=>{
				if(k === 'loc' || k === 'start' || k === 'end' || k === 'leadingComments' || k === 'trailingComments'){ return; }
				const c = y[k];
				if(Array.isArray(c)){ c.forEach(v); } else if(c && typeof c === 'object'){ v(c); }
			});
		};
		v(x);
		return hit;
	};
	const visit = (n)=>{
		if(!n || typeof n.type !== 'string'){ return; }
		const tail = (x)=>{ const ops = flatAnd(x); return ops[ops.length - 1]; };   // a && b && key:整式的值就是末项
		// 字段对象里的键是外壳({ value }),判它在不在不是判值:x.fields.key / fields.key / flds.key
		const isValueRef = (x)=>isKeyRef(x) && !(KEYS.has(propName(x)) && x.object && ((x.object.type === 'Identifier' && /^(fields|flds|fld)$/.test(x.object.name)) || propName(x.object) === 'fields'));
		if(n.type === 'UnaryExpression' && n.operator === '!' && n.argument && n.argument.type === 'UnaryExpression' && n.argument.operator === '!' && isValueRef(tail(n.argument.argument))){ add('R6', n); }
		if(n.type === 'LogicalExpression' && n.operator === '&&' && !(n.parentAnd)){
			const ops = flatAnd(n);
			ops.forEach((op, i)=>{ if(i + 1 < ops.length && isValueRef(op) && !readsValueOf(ops[i + 1], op)){ add('R6', n); } });   // 末项是取值不是判真假
			const mark = (x)=>{ if(x && x.type === 'LogicalExpression' && x.operator === '&&'){ x.parentAnd = true; mark(x.left); mark(x.right); } };
			mark(n.left); mark(n.right);
		}
		if((n.type === 'ConditionalExpression' || n.type === 'IfStatement') && isValueRef(tail(n.test))){ add('R6', n); }
		if(n.type === 'LogicalExpression' && (n.operator === '||' || n.operator === '??') && isKeyRef(n.left) && isLit(n.right)){ add('R1', n); }
		if(n.type === 'ConditionalExpression'){
			if(isPresenceCheck(n.test) && (isLit(n.alternate) || isLit(n.consequent))){ add('R2', n); } else if(isLit(n.consequent) && isLit(n.alternate) && mentionsKey(n.test)){ add('R3', n); }
		}
		if(n.type === 'ObjectProperty' && !n.computed){
			const k = n.key.type === 'Identifier' ? n.key.name : (n.key.type === 'StringLiteral' ? n.key.value : null);
			if(KEYS.has(k) && isLit(n.value)){ add('R4', n); }
		}
		if(n.type === 'ObjectExpression'){
			const kp = n.properties.find((p)=>p.type === 'ObjectProperty' && !p.computed && p.key.type === 'Identifier' && p.key.name === 'key' && p.value.type === 'StringLiteral' && KEYS.has(p.value.value));
			const dv = kp && n.properties.find((p)=>p.type === 'ObjectProperty' && !p.computed && p.key.type === 'Identifier' && p.key.name === 'dv');
			if(dv && isLit(dv.value)){ add('R5', dv); }
		}
		Object.keys(n).forEach((k)=>{
			if(k === 'loc' || k === 'start' || k === 'end' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments'){ return; }
			const v = n[k];
			if(Array.isArray(v)){ v.forEach(visit); } else if(v && typeof v === 'object'){ visit(v); }
		});
	};
	visit(parse(text).program);
	return hits;
}

describe('日界 / 晚子时缺键回落取全局现值(全 src)', ()=>{
	it('没有写死 0 / 1 的缺键回落', ()=>{
		const bad = [];
		listJs(SRC, []).forEach((abs)=>{
			const rel = path.relative(SRC, abs).split(path.sep).join('/');
			bad.push(...scanText(fs.readFileSync(abs, 'utf8'), rel));
		});
		expect(bad).toEqual([]);
	});
	it('豁免表里每一条都还在源码里(过期即红)', ()=>{
		const all = new Set();
		Object.keys(EXEMPT).forEach((id)=>{
			const rel = id.split('|')[0];
			const abs = path.join(SRC, rel);
			if(!fs.existsSync(abs)){ return; }
			const text = fs.readFileSync(abs, 'utf8');
			const save = EXEMPT[id];
			delete EXEMPT[id];
			scanText(text, rel).forEach((h)=>all.add(h));
			EXEMPT[id] = save;
		});
		const stale = Object.keys(EXEMPT).filter((id)=>!all.has(id) && fs.existsSync(path.join(SRC, id.split('|')[0])));
		expect(stale).toEqual([]);
	});
	// 三式择日浮窗:三式缺省奇门选项不含日界两键,浮窗合成的奇门选项必须显式带上与同一浮窗 /chart 相同的两键,
	// 否则缺键时奇门盘按引擎缺省、农历四柱按全局,同一浮窗里两套日界
	it('择日三式浮窗的奇门选项显式带日界两键', ()=>{
		const text = fs.readFileSync(path.join(SRC, 'components/zeri/ZeriMiniPanPopup.js'), 'utf8');
		const found = [];
		const visit = (n)=>{
			if(!n || typeof n.type !== 'string'){ return; }
			if(n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === 'qimenOptions' && n.init && n.init.type === 'ObjectExpression'){
				found.push(n.init.properties.filter((p)=>p.type === 'ObjectProperty').map((p)=>p.key.name || p.key.value));
			}
			Object.keys(n).forEach((k)=>{
				if(k === 'loc' || k === 'start' || k === 'end'){ return; }
				const v = n[k];
				if(Array.isArray(v)){ v.forEach(visit); } else if(v && typeof v === 'object'){ visit(v); }
			});
		};
		visit(parse(text).program);
		expect(found.length).toBeGreaterThan(0);
		found.forEach((keys)=>{
			expect(keys).toEqual(expect.arrayContaining(['after23NewDay', 'lateZiHourUseNextDay']));
		});
	});
	it('判据自证:六种写死回落 / 真值判断都能认出,取全局的写法不误报', ()=>{
		const red = [
			'const a = { after23NewDay: o.after23NewDay !== undefined ? o.after23NewDay : 1 };',
			'const a = { after23NewDay: opt.after23NewDay !== undefined ? (opt.after23NewDay ? 1 : 0) : 1 };',
			'const a = opts.after23NewDay || 0;',
			'const a = opts.lateZiHourUseNextDay ?? 1;',
			'const a = options && options.after23NewDay === 1 ? 1 : 0;',
			'const a = flds.lateZiHourUseNextDay && flds.lateZiHourUseNextDay.value !== undefined ? flds.lateZiHourUseNextDay.value : 1;',
			'const a = { pdaspects: [], after23NewDay: 1 };',
			'const opts = { after23NewDay: 0, ...(options || {}) };',
			"const f = [{ key: 'lateZiHourUseNextDay', label: 'x', dv: 1, options: [] }];",
			'const s = isLateZi && !!(opts && opts.after23NewDay);',
			"if(hour === 23 && opts && opts.after23NewDay && String(opts.after23NewDay) !== '0'){ x(); }",
			'const d = o.lateZiHourUseNextDay ? next : today;',
			'if(o.after23NewDay){ x(); }',
		];
		red.forEach((code)=>{ expect([code, scanText(code, 'fixture.js').length > 0]).toEqual([code, true]); });
		const green = [
			'const a = { after23NewDay: resolveAfter23NewDay(o.after23NewDay) };',
			'const a = o.after23NewDay !== undefined ? o.after23NewDay : defaultAfter23NewDay();',
			"const f = [{ key: 'lateZiHourUseNextDay', dv: defaultLateZiHourUseNextDay(), options: [] }];",
			"const label = options.after23NewDay === 1 ? '23点算第二天' : '24点算第二天';",
			'const v = isOn(x) ? 1 : 0;',
			'const a = fields.after23NewDay && fields.after23NewDay.value !== undefined ? fields.after23NewDay.value : defaultAfter23NewDay();',
			'const g = resolveAfter23NewDay(calcFields && calcFields.after23NewDay && calcFields.after23NewDay.value);',
			'const s = isLateZi && resolveAfter23NewDay(opts && opts.after23NewDay) === 1;',
		];
		green.forEach((code)=>{ expect([code, scanText(code, 'fixture.js')]).toEqual([code, []]); });
	});
	it('resolve 两函数:值形归一 + 缺键取全局现值', ()=>{
		const { resolveAfter23NewDay, resolveLateZiHourUseNextDay } = require('../dayBoundaryResolve');
		const store = {};
		const ls = { getItem: (k)=>(k in store ? store[k] : null), setItem: (k, v)=>{ store[k] = `${v}`; }, removeItem: (k)=>{ delete store[k]; } };
		const prev = global.localStorage;
		Object.defineProperty(global, 'localStorage', { value: ls, configurable: true, writable: true });
		try{
			expect([1, '1', true, 0, '0', false].map(resolveAfter23NewDay)).toEqual([1, 1, 1, 0, 0, 0]);
			expect([undefined, null, ''].map(resolveAfter23NewDay)).toEqual([1, 1, 1]);
			expect([undefined, null].map(resolveLateZiHourUseNextDay)).toEqual([1, 1]);
			ls.setItem('globalSetup', JSON.stringify({ dayBoundary: 'after24', lateZiHourMode: 'today' }));
			expect([undefined, null, ''].map(resolveAfter23NewDay)).toEqual([0, 0, 0]);
			expect([undefined, null].map(resolveLateZiHourUseNextDay)).toEqual([0, 0]);
			expect(resolveAfter23NewDay(1)).toBe(1);
			expect(resolveLateZiHourUseNextDay(1)).toBe(1);
		}finally{
			Object.defineProperty(global, 'localStorage', { value: prev, configurable: true, writable: true });
		}
	});
});
