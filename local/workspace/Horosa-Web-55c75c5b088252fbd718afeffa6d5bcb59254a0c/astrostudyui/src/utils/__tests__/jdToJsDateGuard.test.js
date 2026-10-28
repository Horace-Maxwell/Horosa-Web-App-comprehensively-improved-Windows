// 「儒略日 → JS Date 再取日历字段」守卫(全 src,AST):
// `(jd − 2440587.5) × 86400000` 得到 Unix 毫秒,交给 new Date(...) 以后,Date 按外推格里历 + 天文年拆年月日 ——
// 1582-10-15 以前差 10 天起、公元前再差一年(而全站日期口径是 1582 以前儒略历、历史纪年)。
// 儒略日 → 民用日期一律走 utils/civilCalendar.js(civilPartsFromJd / civilWallMs)。
// 判据:这种毫秒值(表达式本身,或同一函数里保存它的变量)流进 new Date(...) 即红;只拿毫秒算时长差的不管。
// 确属只显示现代日期的,在 EXEMPT 登记「文件|函数」与理由。
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const SRC = path.join(__dirname, '..', '..');

const EXEMPT = {
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
const parse = (text)=>parser.parse(text, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'objectRestSpread', 'dynamicImport', 'nullishCoalescingOperator'], errorRecovery: true });
const SKIP = new Set(['loc', 'start', 'end', 'leadingComments', 'trailingComments', 'innerComments', 'extra']);
function each(n, f, parents){
	if(!n || typeof n.type !== 'string'){ return; }
	f(n, parents);
	parents.push(n);
	Object.keys(n).forEach((k)=>{
		if(SKIP.has(k)){ return; }
		const v = n[k];
		if(Array.isArray(v)){ v.forEach((c)=>each(c, f, parents)); } else if(v && typeof v === 'object'){ each(v, f, parents); }
	});
	parents.pop();
}
const num = (n)=>n && n.type === 'NumericLiteral' ? n.value : NaN;
const DAY_MS = 86400000;
const UNIX_JD = [2440587.5, 2440588];
// (X − 2440587.5) × 86400000(左右任一顺序)
function isJdToUnixMs(n){
	if(!n || n.type !== 'BinaryExpression' || n.operator !== '*'){ return false; }
	const pair = [[n.left, n.right], [n.right, n.left]];
	return pair.some(([a, b])=>num(b) === DAY_MS && a && a.type === 'BinaryExpression' && a.operator === '-' && UNIX_JD.includes(num(a.right)));
}
const isFn = (n)=>/Function|ArrowFunction|ClassMethod|ObjectMethod|ClassPrivateMethod/.test(n.type);
function fnName(fn, parent){
	if(fn.id && fn.id.name){ return fn.id.name; }
	if(fn.key && (fn.key.name || fn.key.value)){ return fn.key.name || fn.key.value; }
	if(parent && parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier'){ return parent.id.name; }
	if(parent && (parent.type === 'ObjectProperty' || parent.type === 'ClassProperty') && parent.key){ return parent.key.name || parent.key.value; }
	if(parent && parent.type === 'AssignmentExpression' && parent.left.type === 'MemberExpression' && parent.left.property){ return parent.left.property.name; }
	return '<匿名>';
}
const contains = (root, target)=>{ let hit = false; each(root, (n)=>{ if(n === target){ hit = true; } }, []); return hit; };

function scanText(rel, text){
	const ast = parse(text);
	const out = [];
	each(ast, (n, parents)=>{
		if(!isJdToUnixMs(n)){ return; }
		let fnIdx = -1;
		for(let i = parents.length - 1; i >= 0; i--){ if(isFn(parents[i])){ fnIdx = i; break; } }
		const scope = fnIdx >= 0 ? parents[fnIdx] : ast;
		const name = fnIdx >= 0 ? fnName(parents[fnIdx], parents[fnIdx - 1]) : '<模块顶层>';
		// 直接写在 new Date(...) 里
		let flagged = parents.some((p)=>p.type === 'NewExpression' && p.callee.type === 'Identifier' && p.callee.name === 'Date');
		// 先存进变量,同一函数里再 new Date(变量 …)
		if(!flagged){
			const holder = [...parents].reverse().find((p)=>(p.type === 'VariableDeclarator' && p.id.type === 'Identifier') || (p.type === 'AssignmentExpression' && p.left.type === 'Identifier'));
			const v = holder && (holder.type === 'VariableDeclarator' ? holder.id.name : holder.left.name);
			if(v){
				each(scope, (m)=>{
					if(m.type === 'NewExpression' && m.callee.type === 'Identifier' && m.callee.name === 'Date'
						&& m.arguments.some((a)=>{ let used = false; each(a, (x)=>{ if(x.type === 'Identifier' && x.name === v){ used = true; } }, []); return used; })){
						flagged = true;
					}
				}, []);
			}
		}
		if(flagged){ out.push(`${rel}|${name}`); }
	}, []);
	return out;
}

describe('儒略日不经 JS Date 拆日历字段', ()=>{
	test('全 src:儒略日换来的 Unix 毫秒不流进 new Date(...)(未登记即红)', ()=>{
		const hits = [];
		listJs(SRC, []).forEach((file)=>{
			const rel = path.relative(SRC, file).split(path.sep).join('/');
			const text = fs.readFileSync(file, 'utf8');
			if(!/2440587\.5|2440588/.test(text)){ return; }
			scanText(rel, text).forEach((k)=>hits.push(k));
		});
		const bad = hits.filter((k)=>!EXEMPT[k]);
		expect(bad).toEqual([]);
		// 登记项必须仍然存在(否则清掉登记)
		const stale = Object.keys(EXEMPT).filter((k)=>fs.existsSync(path.join(SRC, k.split('|')[0])) && !hits.includes(k));
		expect(stale).toEqual([]);
	});

	test('判别力:直接构造 / 先存变量两种写法都抓,只算时长差的不抓', ()=>{
		expect(scanText('a.js', 'function f(jd){ return new Date((jd - 2440587.5) * 86400000).getUTCFullYear(); }')).toEqual(['a.js|f']);
		expect(scanText('a.js', 'const g = (jd, off)=>{ const ms = (jd - 2440587.5) * 86400000 + off * 3600000; const d = new Date(ms); return d.getUTCDate(); };')).toEqual(['a.js|g']);
		expect(scanText('a.js', 'function age(jd){ return (Date.now() - (jd - 2440587.5) * 86400000) / 31557600000; }')).toEqual([]);
	});
});
