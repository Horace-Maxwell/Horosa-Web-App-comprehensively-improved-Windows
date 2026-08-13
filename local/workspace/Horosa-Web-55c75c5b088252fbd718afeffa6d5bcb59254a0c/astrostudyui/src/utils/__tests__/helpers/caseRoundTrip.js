// 存案往返用例的公因子(非 .test.js:照 tarot/__tests__/tarotOptionSpec.js 的 fixture-module 惯例)。
//
// 背景:wuzhaoOptionRoundTrip / geomancyCaseRoundtrip / xiaochengtuQaMatrix 三处**各自手抄**了
// 同一套 mock + makeInstance,新增技法要写往返用例就得再抄第四份。此处提取,三处与新总闸共用。
//
// 🔴 AST 抽取而非正则:首版用正则从源码抠 `options: { … }`,把 dispatch 对象的
//    type/payload/key/record/event 也当成了存案选项(dunjia 报 17 键全未读回、guice 报 5 键全未读回,
//    全是假报)。preflight :5024 早写过「凡从源码正则求名单,必须先断言名单合理,
//    否则判据本身失效比漏支更险」—— 故改走 @babel/parser + traverse 精确取。
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverseMod = require('@babel/traverse');

const traverse = traverseMod.default || traverseMod;

const UI_SRC = path.resolve(__dirname, '../../..');

const PARSE_OPTS = {
	sourceType: 'module',
	plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport'],
};

function readSrc(relFromSrc){
	return fs.readFileSync(path.join(UI_SRC, relFromSrc), 'utf8');
}

function parseFile(relFromSrc){
	return parser.parse(readSrc(relFromSrc), PARSE_OPTS);
}

/** 取类里某个方法的 AST 节点(找不到回 null) */
function findMethod(ast, name){
	let found = null;
	traverse(ast, {
		ClassMethod(p){
			if(!found && p.node.key && p.node.key.name === name){ found = p; }
		},
	});
	return found;
}

/**
 * 抽「存案时写进 payload.options 的键」。
 * 只认 `options: { … }` 这一层的字面量属性名;展开(...x)与计算键跳过并如实回报,
 * 让调用方能判断「这条技法的键集能不能机械求出」——求不出就不该拿来当判据。
 */
function savedOptionKeys(ast, methodName = 'clickSaveCase'){
	const m = findMethod(ast, methodName);
	if(!m){ return { keys: [], spread: false, found: false }; }
	let keys = null;
	let spread = false;
	m.traverse({
		ObjectProperty(p){
			if(keys !== null){ return; }
			const k = p.node.key;
			const nm = k && (k.name || k.value);
			if(nm !== 'options'){ return; }
			const v = p.node.value;
			if(!v || v.type !== 'ObjectExpression'){ return; }
			keys = [];
			v.properties.forEach((prop)=>{
				if(prop.type === 'SpreadElement' || prop.type === 'SpreadProperty'){ spread = true; return; }
				if(prop.computed){ spread = true; return; }
				const pk = prop.key;
				const pn = pk && (pk.name || pk.value);
				if(pn){ keys.push(pn); }
			});
		},
	});
	return { keys: keys || [], spread, found: true };
}

/**
 * 抽「options 上被读到的键」——形如 `options.X` / `o.X` / `opts.X` 的成员访问,
 * 外加解构 `const { a, b } = options`。
 *
 * 🔴 读者面必须放宽到**整个文件 + 相关文件**,不能只看 restore 方法:
 * 实测灵棋经的 wuDay/timeLines 由无头快照 builder(lingqiSnapshot.js)读、
 * 奇门的 chartCategory 由 `pan.options.chartCategory` 与挂载 schema 读 ——
 * 只扫 restore 会把这两条误判成「存而不载」。判据应是「存进去的键必须有人读」,
 * 而不是「必须由 restore 读」。
 */
function optionReaderKeys(asts){
	const out = new Set();
	(Array.isArray(asts) ? asts : [asts]).forEach((ast)=>{
		if(!ast){ return; }
		traverse(ast, {
			MemberExpression(p){
				const obj = p.node.object;
				const prop = p.node.property;
				const nm = prop && (prop.name || prop.value);
				if(!obj || !nm){ return; }
				// ① 直读:options.X / o.X / opts.X
				if(obj.type === 'Identifier' && ['options', 'o', 'opts'].includes(obj.name)){
					out.add(nm); return;
				}
				// ② 嵌套读:<任意>.options.X —— 如奇门的 `pan.options.chartCategory`、
				//    各处的 `payload.options.X`。漏掉这一形态会把它们误判成「存而不载」。
				if(obj.type === 'MemberExpression'){
					const inner = obj.property;
					if(inner && (inner.name || inner.value) === 'options'){ out.add(nm); }
				}
			},
			ObjectPattern(p){
				const init = p.parent && p.parent.init;
				if(!init || init.type !== 'Identifier' || !['options', 'o', 'opts'].includes(init.name)){ return; }
				p.node.properties.forEach((prop)=>{
					const k = prop.key;
					const nm = k && (k.name || k.value);
					if(nm){ out.add(nm); }
				});
			},
		});
	});
	return out;
}

/** 该组件是否具备读档入口(两种命名之一)。 */
function hasRestoreEntry(ast){
	return !!(findMethod(ast, 'restoreFromCurrentCase') || findMethod(ast, 'restoreOptionsFromCurrentCase'));
}

/** 直接实例化组件类并接管 setState(不挂 DOM):往返逻辑全在实例方法内。 */
function makeInstance(Comp, props){
	const inst = new Comp(props || {});
	inst.setState = function setState(patch, cb){
		const next = typeof patch === 'function' ? patch(this.state) : patch;
		this.state = { ...this.state, ...next };
		if(cb){ cb(); }
	};
	return inst;
}

module.exports = {
	UI_SRC,
	readSrc,
	parseFile,
	findMethod,
	savedOptionKeys,
	optionReaderKeys,
	hasRestoreEntry,
	makeInstance,
};
