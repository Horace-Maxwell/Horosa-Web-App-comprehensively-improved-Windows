// 读源码的测试用:拆成子模块的大文件按「门面 + 子模块」全集读(非 .test.js:测试公因子,照 helpers/ 惯例)。
//
// 登记表单源 = astrostudyui/scripts/source-sets.json(发布前自检的 pf_src_set 与各检查器读同一份)。
// readSource(文件) —— 文件是登记过的 .js 门面:按登记顺序把子模块(原文件里的先后次序)与门面(在最后)首尾相接拼成一份返回;
//                     登记过的 .less 门面(layouts/app.less):门面里的区段 @import 原位展开(= 拆分前的整份样式,规则次序与 :global 嵌套都原样)
//                     (内容即拆分前那份文件的全部代码,先后次序也基本相同;拼出来的是文本,不能当一个模块解析 ——
//                     要解析 AST 的检查按 sourceSetFiles 逐个文件解析);
//                     其余文件:原样 fs.readFileSync(文件, 'utf8'),语义不变。
// sourceSetFiles(文件) —— 全集的文件清单(绝对路径,子模块在前、门面在后;未登记的文件只含它自己)。
// isSourceSetPart(文件) —— 是不是登记过的子模块(逐文件走查目录时跳过它、改由门面按全集读,见下)。
// 门面路径可以是任一仓的 astrostudyui/src 下的路径(按路径尾部认登记项,子模块在同一个 src 根下找)。
// Python 计算引擎的门面(登记表 pySets,路径相对 Horosa-Web/astropy):同样按路径尾部认,子模块在同一个 astropy 根下找。
const fs = require('fs');
const path = require('path');

const MANIFEST = path.resolve(__dirname, '../../../../scripts/source-sets.json');
const MANIFEST_JSON = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const SETS = MANIFEST_JSON.sets;
const PY_SETS = MANIFEST_JSON.pySets || {};
// [登记表, 路径尾部前缀]:前端门面的路径以 src 为基准,Python 门面以 astropy 为基准
const GROUPS = [[SETS, '/src/'], [PY_SETS, '/astropy/']];

function locate(file){
	const abs = path.resolve(`${file}`);
	const norm = abs.split(path.sep).join('/');
	for(const [sets, base] of GROUPS){
		for(const rel of Object.keys(sets)){
			if(norm.endsWith(`${base}${rel}`)){
				return { root: abs.slice(0, abs.length - rel.length), rel, set: sets[rel] };
			}
		}
	}
	return null;
}

function sourceSetFiles(file){
	const hit = locate(file);
	if(!hit){ return [path.resolve(`${file}`)]; }
	const set = hit.set;
	return [...set.files.map((f)=>path.join(hit.root, set.dir, f)), path.join(hit.root, hit.rel)];
}

// 样式门面(.less):把门面里指向登记区段的 `@import './…';` 行原位换成该区段的全文(= 拆分前那份整文件的内容与次序,外加区段文件头注释)。
function expandLessFacade(facadeAbs, partAbs){
	const parts = new Set(partAbs);
	return fs.readFileSync(facadeAbs, 'utf8').split('\n').map((ln)=>{
		const m = ln.match(/^@import '(\.\/[^']+\.less)';\s*$/);
		const p = m ? path.join(path.dirname(facadeAbs), m[1]) : null;
		return p && parts.has(p) ? fs.readFileSync(p, 'utf8').replace(/\n$/, '') : ln;
	}).join('\n');
}

function readSource(file){
	const files = sourceSetFiles(file);
	if(files.length > 1 && /\.less$/.test(file)){ return expandLessFacade(files[files.length - 1], files.slice(0, -1)); }
	return files.map((f)=>fs.readFileSync(f, 'utf8')).join('');
}

// isSourceSetPart(文件) —— 文件是某个登记过的门面的子模块(在登记的子模块目录里、且登记了)。
// 逐文件走查目录的检查(例:「挂 svg 的宿主组件必须订阅主题」)用它把子模块折回门面:跳过子模块、门面按全集读,
// 判据口径与拆分前那份大文件相同(否则搬进子模块的那半边判据会在门面里「消失」)。
function isSourceSetPart(file){
	const norm = path.resolve(`${file}`).split(path.sep).join('/');
	return GROUPS.some(([sets, base])=>Object.keys(sets).some((rel)=>{
		const set = sets[rel];
		return set.files.some((f)=>norm.endsWith(`${base}${set.dir}/${f}`));
	}));
}

// fnBody(文本, 签名[, 起点]) —— 从签名(函数开头的一段原文,如 'async function foo(' / 'function render(' / 'const foo = (')
//   截到这个函数自己的右花括号为止(含),找不到返回 null。不许用「下一个 `\nasync function ` / `\nexport ` / `\nfunction `」当终点:
//   readSource 把子模块首尾相接后,后面接的可能是别的文件、别的写法(export async function …),终点越过一串函数,
//   窗口大十几倍,锚出现在后面任一函数里都照样绿(判别力静默丢失)。
//   做法:先用 babel(容错模式:全集里各文件的同名导入 / 重复导出只记错不抛)解析,取起点落在签名里的最外层函数节点;
//   文本解析不了(例如被逐行剥过注释)时退回字符级配平:越过字符串 / 模板串 / 注释 / 正则字面量,参数表之后第一个顶层 { 起配平。
const FN_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ClassMethod', 'ClassPrivateMethod', 'ObjectMethod']);
const FN_PARSE_OPTS = {
	sourceType: 'module', errorRecovery: true,
	plugins: ['jsx', 'classProperties', 'classPrivateProperties', 'classPrivateMethods', 'dynamicImport', 'optionalChaining',
		'nullishCoalescingOperator', 'objectRestSpread', 'exportDefaultFrom', 'decorators-legacy'],
};
const fnAstCache = new Map();   // 文本 → 函数节点表(同一份全集反复截取只解析一次;只留最近几份)
function functionNodesOf(text){
	if(fnAstCache.has(text)){ return fnAstCache.get(text); }
	let nodes = null;
	try{
		const ast = require('@babel/parser').parse(text, FN_PARSE_OPTS);
		nodes = [];
		const walk = (n)=>{
			if(!n || typeof n.type !== 'string'){ return; }
			if(FN_TYPES.has(n.type)){ nodes.push(n); }
			Object.keys(n).forEach((k)=>{
				if(k === 'loc' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments'){ return; }
				const v = n[k];
				if(Array.isArray(v)){ v.forEach(walk); }else if(v && typeof v === 'object'){ walk(v); }
			});
		};
		walk(ast.program);
	}catch(e){ nodes = null; }
	fnAstCache.set(text, nodes);
	if(fnAstCache.size > 8){ fnAstCache.delete(fnAstCache.keys().next().value); }
	return nodes;
}
// 字符级:i 起越过一个字符串 / 模板串 / 注释 / 正则,返回其后位置;不是这些返回 -1
function skipNonCode(text, i, prevSig){
	const c = text[i];
	const d = text[i + 1];
	if(c === '/' && d === '/'){ const e = text.indexOf('\n', i); return e < 0 ? text.length : e; }
	if(c === '/' && d === '*'){ const e = text.indexOf('*/', i + 2); return e < 0 ? text.length : e + 2; }
	if(c === '"' || c === "'"){
		let j = i + 1;
		while(j < text.length && text[j] !== c && text[j] !== '\n'){ j += text[j] === '\\' ? 2 : 1; }
		return j + 1;
	}
	if(c === '`'){
		let j = i + 1;
		while(j < text.length && text[j] !== '`'){
			if(text[j] === '\\'){ j += 2; continue; }
			if(text[j] === '$' && text[j + 1] === '{'){ j = matchClose(text, j + 1, '{', '}') + 1; continue; }
			j += 1;
		}
		return j + 1;
	}
	// 正则字面量:前一个记号是运算符 / 开括号 / 关键字;JSX 的 </x> 与 /> 不是(否则把那一行余下的括号当正则吞掉)
	const jsxSlash = /<$/.test(prevSig) || d === '>';
	if(c === '/' && !jsxSlash && (prevSig === '' || /[(,=:[!&|?{;+\-*%<>~^]$/.test(prevSig) || /\b(return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await)$/.test(prevSig))){
		let j = i + 1;
		let inClass = false;
		while(j < text.length && text[j] !== '\n'){
			if(text[j] === '\\'){ j += 2; continue; }
			if(text[j] === '['){ inClass = true; }else if(text[j] === ']'){ inClass = false; }else if(text[j] === '/' && !inClass){ break; }
			j += 1;
		}
		j += 1;
		while(/[a-z]/i.test(text[j] || '')){ j += 1; }
		return j;
	}
	return -1;
}
// 从 text[at] === open 起配平,返回配对的 close 的位置(找不到 = text.length)
function matchClose(text, at, open, close){
	let depth = 0;
	let prevSig = '';
	for(let i = at; i < text.length;){
		const skip = skipNonCode(text, i, prevSig);
		if(skip >= 0){ i = skip; prevSig = 'x'; continue; }
		const c = text[i];
		if(c === open){ depth += 1; }else if(c === close){ depth -= 1; if(depth === 0){ return i; } }
		if(!/\s/.test(c)){ prevSig = (prevSig + c).slice(-8); }
		i += 1;
	}
	return text.length;
}
// 文本里注释 / 字符串 / 模板串 / 正则所占的区间(退路找签名时跳过「注释里提到的签名」)
const nonCodeCache = new Map();
function nonCodeRanges(text){
	if(nonCodeCache.has(text)){ return nonCodeCache.get(text); }
	const out = [];
	let prevSig = '';
	for(let i = 0; i < text.length;){
		const skip = skipNonCode(text, i, prevSig);
		if(skip >= 0){ out.push([i, skip]); i = skip; prevSig = 'x'; continue; }
		if(!/\s/.test(text[i])){ prevSig = (prevSig + text[i]).slice(-8); }
		i += 1;
	}
	nonCodeCache.set(text, out);
	if(nonCodeCache.size > 8){ nonCodeCache.delete(nonCodeCache.keys().next().value); }
	return out;
}
const inRanges = (ranges, pos)=>{
	let lo = 0;
	let hi = ranges.length - 1;
	while(lo <= hi){
		const mid = (lo + hi) >> 1;
		if(pos < ranges[mid][0]){ hi = mid - 1; }else if(pos >= ranges[mid][1]){ lo = mid + 1; }else{ return true; }
	}
	return false;
};
function fnBodyByScan(text, start){
	// 参数表:签名里 / 后的第一个 ( 起配平;之后第一个顶层 { 是函数体(先遇到 ; = 不是块体函数)
	const open = text.indexOf('(', start);
	if(open < 0){ return null; }
	let i = matchClose(text, open, '(', ')') + 1;
	for(; i < text.length; i += 1){
		if(text[i] === '{'){ return text.slice(start, matchClose(text, i, '{', '}') + 1); }
		if(text[i] === ';'){ return null; }
	}
	return null;
}
function fnBody(text, signature, from = 0){
	const src = `${text}`;
	const first = src.indexOf(signature, from);
	if(first < 0){ return null; }
	const nodes = functionNodesOf(src);
	if(!nodes){
		const ranges = nonCodeRanges(src);
		for(let start = first; start >= 0; start = src.indexOf(signature, start + 1)){
			if(!inRanges(ranges, start)){ return fnBodyByScan(src, start); }
		}
		return fnBodyByScan(src, first);   // 全落在「非代码」里 = 文本本身被剥坏(如逐行剥注释剥掉了模板串的一半),按第一处截
	}
	// 解析得了:逐个出现处找真正以它开头的函数(注释 / 字符串里提到的签名不算)
	for(let start = first; start >= 0; start = src.indexOf(signature, start + 1)){
		const within = (p)=>p >= start && p <= start + signature.length;
		const hit = nodes.find((n)=>within(n.start) || (n.key && within(n.key.start)));   // 方法:签名从方法名起(前面可有 async / static)
		if(hit){ return hit.body && hit.body.type === 'BlockStatement' ? src.slice(start, hit.end) : null; }   // 表达式体箭头函数没有函数体可截
	}
	return null;
}

module.exports = { readSource, sourceSetFiles, isSourceSetPart, fnBody, SOURCE_SETS: SETS, PY_SOURCE_SETS: PY_SETS, SOURCE_SETS_MANIFEST: MANIFEST };
