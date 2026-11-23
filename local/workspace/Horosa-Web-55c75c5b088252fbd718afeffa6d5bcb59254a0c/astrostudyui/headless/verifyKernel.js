// 验证内核:把「命题」放到一批命例的起盘结果上机械地判定。
//
// 这里全是纯函数:不读写文件、不起进程、不取时间、不取随机数。判定只用精确的整数 / 有理数运算(BigInt),
// 不用浮点 —— 同一份命题、同一批结果,在任何机器上得到的计数、检验值与裁决必然逐字相同。
//
// 三样东西:
//   · 判据(predicate):对一例说「是 / 否 / 不知道」。看技法正文(含某段、含某串、匹配某式、取出一个数来比),
//     或看这一例自带的资料(性别、分类、事件、文件里的任意列),可以用 all / any / not 组合。
//     要看的技法这一例没起出来 → 「不知道」,这一例不进该命题的计数,并如实报出有多少例。
//   · 命题(statement)三种:
//       implication  「凡满足 A 的例都满足 B」—— 有一个反例就不成立,反例逐个列出;
//       association  「有特征 F 的例里,L 的比例与没有 F 的不同(更高 / 更低)」—— 四格表 + 费希尔精确检验;
//       rate         「满足 F 的比例与给定值 p0 不同(更高 / 更低)」—— 二项精确检验。
//   · 裁决:成立 / 不成立 / 样本不足。门槛(显著性水平、最少例数、最小提升)写在命题里,先定后验。
'use strict';
const crypto = require('crypto');

class VerifyError extends Error{ constructor(message){ super(message); this.name = 'VerifyError'; } }
const fail = (msg)=>{ throw new VerifyError(msg); };

// ───────────────────────── 规范化与指纹 ─────────────────────────

// 键按字典序、无多余空白的 JSON:同一个值只有一种写法,用来算指纹
function canonical(v){
	if(v === null || v === undefined){ return 'null'; }
	if(typeof v === 'number'){ if(!Number.isFinite(v)){ fail('指纹里出现了非有限数'); } return JSON.stringify(v); }
	if(typeof v === 'boolean' || typeof v === 'string'){ return JSON.stringify(v); }
	if(typeof v === 'bigint'){ return `"${v}n"`; }
	if(Array.isArray(v)){ return `[${v.map(canonical).join(',')}]`; }
	if(typeof v === 'object'){
		return `{${Object.keys(v).filter((k)=>v[k] !== undefined).sort().map((k)=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
	}
	return fail(`指纹里出现了不支持的类型 ${typeof v}`);
}
const sha256 = (text)=>crypto.createHash('sha256').update(`${text}`, 'utf8').digest('hex');
const fingerprint = (v)=>sha256(canonical(v));

// ───────────────────────── 精确有理数 ─────────────────────────

const bigAbs = (x)=>(x < 0n ? -x : x);
function gcd(a, b){ a = bigAbs(a); b = bigAbs(b); while(b){ [a, b] = [b, a % b]; } return a; }

// 十进制小数的字面量("0.01" / "1.25" / "3" / "1/20")→ 精确分数 [分子, 分母](分母为正,已约分)
function parseRational(text, what){
	const s = `${text}`.trim();
	let m = /^(-?\d+)\/(\d+)$/.exec(s);
	let num; let den;
	if(m){ num = BigInt(m[1]); den = BigInt(m[2]); }
	else{
		m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s);
		if(!m){ fail(`${what || '数值'}「${text}」要写成十进制小数或分数(如 0.01、1.2、1/20),并用字符串写,不要用科学计数法`); }
		const frac = m[3] || '';
		num = BigInt(`${m[2]}${frac}`) * (m[1] ? -1n : 1n);
		den = 10n ** BigInt(frac.length);
	}
	if(den === 0n){ fail(`${what || '数值'}「${text}」分母为零`); }
	const g = gcd(num, den) || 1n;
	return [num / g, den / g];
}
// a/b 与 c/d 比大小:负 / 零 / 正(分母都为正)
const ratCmp = (a, b, c, d)=>{ const x = a * d - c * b; return x < 0n ? -1 : x > 0n ? 1 : 0; };

// 分数写成十进制字符串(定小数位,四舍五入,精确)
function ratToFixed(num, den, digits){
	if(den === 0n){ return '无定义'; }
	const neg = (num < 0n) !== (den < 0n) && num !== 0n;
	num = bigAbs(num); den = bigAbs(den);
	const scale = 10n ** BigInt(digits);
	const q = (num * scale * 2n + den) / (den * 2n);
	const s = q.toString().padStart(digits + 1, '0');
	const out = digits ? `${s.slice(0, -digits)}.${s.slice(-digits)}` : s;
	return neg && /[1-9]/.test(out) ? `-${out}` : out;
}
// 分数写成科学计数法(sig 位有效数字,四舍五入,精确);0 写成 "0"
function ratToSci(num, den, sig){
	if(den === 0n){ return '无定义'; }
	if(num === 0n){ return '0'; }
	const neg = (num < 0n) !== (den < 0n);
	num = bigAbs(num); den = bigAbs(den);
	const n = sig || 6;
	// 找 e 使 1 ≤ num / den / 10^e < 10
	let e = num.toString().length - den.toString().length;
	const ge = (ex)=>(ex >= 0 ? num >= den * 10n ** BigInt(ex) : num * 10n ** BigInt(-ex) >= den);
	if(!ge(e)){ e -= 1; }
	// 取 n 位有效数字:mant = round(num / den × 10^(n-1-e))
	const shift = n - 1 - e;
	let mant = shift >= 0 ? (num * 10n ** BigInt(shift) * 2n + den) / (den * 2n) : (num * 2n + den * 10n ** BigInt(-shift)) / (den * 10n ** BigInt(-shift) * 2n);
	if(mant.toString().length > n){ mant /= 10n; e += 1; }
	const digits = mant.toString();
	const body = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
	return `${neg ? '-' : ''}${body}e${e >= 0 ? '+' : '-'}${`${Math.abs(e)}`.padStart(2, '0')}`;
}
// 比例之类的普通大小的数:小于 1e-4 或大于 1e9 用科学计数法,否则定 6 位小数
function ratToText(num, den){
	if(den === 0n){ return '无定义'; }
	if(num === 0n){ return '0'; }
	const a = bigAbs(num); const b = bigAbs(den);
	if(a * 10000n < b || a > b * 1000000000n){ return ratToSci(num, den, 6); }
	return ratToFixed(num, den, 6);
}

// ───────────────────────── 精确检验 ─────────────────────────

function binomial(n, k){
	if(k < 0 || k > n){ return 0n; }
	k = Math.min(k, n - k);
	let c = 1n;
	for(let i = 1; i <= k; i++){ c = c * BigInt(n - k + i) / BigInt(i); }
	return c;
}

// 费希尔精确检验。四格表 [[a, b], [c, d]](行 = 有 / 没有特征,列 = 是 / 不是 L)。
// 在行和、列和固定时,左上格 X 服从超几何分布;p 值 = 满足备择方向的各取值的概率之和:
//   greater:X ≥ a;less:X ≤ a;two-sided:概率不大于观测值那一格概率的全部取值(精确比较,没有容差)。
// 返回 { num, den }:p = num / den,精确。
function fisherExact(a, b, c, d, alternative){
	[a, b, c, d].forEach((x)=>{ if(!Number.isInteger(x) || x < 0){ fail('四格表的格子要非负整数'); } });
	const row1 = a + b; const col1 = a + c; const n = a + b + c + d;
	const lo = Math.max(0, col1 - (n - row1)); const hi = Math.min(row1, col1);
	const den = binomial(n, col1);
	if(den === 0n || n === 0){ return { num: 1n, den: 1n }; }
	// w(x) = C(row1, x) · C(n − row1, col1 − x),逐项按精确的比值递推
	let w = binomial(row1, lo) * binomial(n - row1, col1 - lo);
	let wObs = null; const ws = [];
	for(let x = lo; x <= hi; x++){
		ws.push(w);
		if(x === a){ wObs = w; }
		if(x < hi){ w = w * BigInt(row1 - x) * BigInt(col1 - x) / (BigInt(x + 1) * BigInt(n - row1 - col1 + x + 1)); }
	}
	if(wObs === null){ fail('四格表与边际和不一致'); }
	let num = 0n;
	ws.forEach((v, i)=>{
		const x = lo + i;
		const take = alternative === 'greater' ? x >= a : alternative === 'less' ? x <= a : v <= wObs;
		if(take){ num += v; }
	});
	const g = gcd(num, den) || 1n;
	return { num: num / g, den: den / g };
}

// 二项精确检验:n 例里 k 例为「是」,原假设比例 p0 = r/s。
//   greater:X ≥ k;less:X ≤ k;two-sided:概率不大于观测值概率的全部取值。返回精确的 { num, den }。
function binomialExact(k, n, r, s, alternative){
	if(!Number.isInteger(k) || !Number.isInteger(n) || k < 0 || k > n){ fail('二项检验的计数不对'); }
	if(r < 0n || r > s || s <= 0n){ fail('原假设比例要在 0 与 1 之间'); }
	const q = s - r;
	const den = s ** BigInt(n);
	// w(x) = C(n, x) · r^x · q^(n−x)。相邻两项的比是精确的整数运算:
	//   往上 w(x+1) = w(x) · (n−x) · r / ((x+1) · q);往下 w(x−1) = w(x) · x · q / ((n−x+1) · r)。
	// 不把各项都存下来(n 上万时每项是几万位的整数):单侧只从近的那一头走到 k,双侧走两遍。
	const up = (w, x)=>w * BigInt(n - x) * r / (BigInt(x + 1) * q);
	const down = (w, x)=>w * BigInt(x) * q / (BigInt(n - x + 1) * r);
	let num = 0n;
	// 原假设比例是 0 或 1:全部概率压在一个取值上。观测到别的取值 = 原假设下不可能,双侧与对着它的单侧 p 都是 0
	if(r === 0n){ num = alternative === 'less' ? den : (k === 0 ? den : 0n); }             // 全部概率压在 X = 0
	else if(q === 0n){ num = alternative === 'greater' ? den : (k === n ? den : 0n); }     // 全部概率压在 X = n
	else if(alternative === 'less'){
		let w = q ** BigInt(n);
		for(let x = 0; x <= k; x++){ num += w; if(x < k){ w = up(w, x); } }
	}else if(alternative === 'greater'){
		let w = r ** BigInt(n);
		for(let x = n; x >= k; x--){ num += w; if(x > k){ w = down(w, x); } }
	}else{
		let w = q ** BigInt(n); let wObs = w;
		for(let x = 0; x < k; x++){ w = up(w, x); }
		wObs = w;
		w = q ** BigInt(n);
		for(let x = 0; x <= n; x++){ if(w <= wObs){ num += w; } if(x < n){ w = up(w, x); } }
	}
	const g = gcd(num, den) || 1n;
	return { num: num / g, den: den / g };
}

// ───────────────────────── 判据 ─────────────────────────

const PRED_KEYS = ['technique', 'field', 'category', 'event', 'all', 'any', 'not', 'const', 'ref'];
const CMP = { '>': (x, y)=>x > y, '>=': (x, y)=>x >= y, '<': (x, y)=>x < y, '<=': (x, y)=>x <= y, '==': (x, y)=>x === y, '!=': (x, y)=>x !== y };

function compileRegex(src, flags, where){
	if(typeof src !== 'string' || !src){ fail(`${where}:regex 要非空字符串`); }
	const f = flags === undefined ? '' : `${flags}`;
	if(!/^[imsu]*$/.test(f)){ fail(`${where}:regex 的 flags 只认 i / m / s / u(不认 g / y:判据不带状态)`); }
	try{ return new RegExp(src, f.indexOf('u') >= 0 ? f : `${f}u`); }catch(e){ return fail(`${where}:regex 写错了(${e.message})`); }
}

// 看技法正文的判据(叶子)登记处:compileClaim 编译期间非空,每个叶子领一个序号。调用方读到一例的起盘结果后
// prepareCase 一次把全部叶子算好存在这一例上(c.leaf),随后就可以把正文丢掉 —— 几万例的名人库不用把全部正文留在内存里。
let LEAF_SINK = null;

// 把命题文件里的判据(可按名字引用 define 里的)校验并编译成 { test(caseRecord) → true / false / null, techniques: Set }
function compilePredicate(spec, defs, where, seen){
	const at = where || '判据';
	if(typeof spec === 'string'){
		if(!defs || !Object.prototype.hasOwnProperty.call(defs, spec)){ fail(`${at}:没有名为「${spec}」的判据(define 里没定义)`); }
		const chain = seen || [];
		if(chain.indexOf(spec) >= 0){ fail(`${at}:判据「${spec}」绕回了自己(${chain.concat(spec).join(' → ')})`); }
		return compilePredicate(defs[spec], defs, `define.${spec}`, chain.concat(spec));
	}
	if(!spec || typeof spec !== 'object' || Array.isArray(spec)){ fail(`${at}:判据要写成对象,或 define 里的名字`); }
	const kinds = PRED_KEYS.filter((k)=>Object.prototype.hasOwnProperty.call(spec, k));
	if(kinds.length !== 1){ fail(`${at}:一个判据只能是 ${PRED_KEYS.join(' / ')} 其中一种(这里有 ${kinds.length ? kinds.join('、') : '零种'})`); }
	const kind = kinds[0];
	const techniques = new Set();
	const only = (allowed)=>{ Object.keys(spec).forEach((k)=>{ if(allowed.indexOf(k) < 0){ fail(`${at}:不认识的键「${k}」(这种判据只认 ${allowed.join(' / ')})`); } }); };
	if(kind === 'const'){ only(['const']); if(typeof spec.const !== 'boolean'){ fail(`${at}:const 要 true / false`); } return { test: ()=>spec.const, techniques }; }
	if(kind === 'ref'){ only(['ref']); return compilePredicate(`${spec.ref}`, defs, at, seen); }
	if(kind === 'not'){
		only(['not']);
		const p = compilePredicate(spec.not, defs, `${at}.not`, seen);
		return { test: (c)=>{ const v = p.test(c); return v === null ? null : !v; }, techniques: p.techniques };
	}
	if(kind === 'all' || kind === 'any'){
		only([kind]);
		if(!Array.isArray(spec[kind]) || !spec[kind].length){ fail(`${at}:${kind} 要非空数组`); }
		const ps = spec[kind].map((x, i)=>compilePredicate(x, defs, `${at}.${kind}[${i}]`, seen));
		ps.forEach((p)=>p.techniques.forEach((t)=>techniques.add(t)));
		// 三值逻辑:all 里有一个「否」即否,否则有「不知道」即不知道;any 对偶
		const stop = kind === 'any';
		return { test: (c)=>{ let unknown = false; for(const p of ps){ const v = p.test(c); if(v === stop){ return stop; } if(v === null){ unknown = true; } } return unknown ? null : !stop; }, techniques };
	}
	if(kind === 'technique'){
		only(['technique', 'section', 'contains', 'regex', 'flags', 'number']);
		if(typeof spec.technique !== 'string' || !spec.technique){ fail(`${at}:technique 要技法键`); }
		techniques.add(spec.technique);
		const modes = ['contains', 'regex', 'number'].filter((k)=>spec[k] !== undefined);
		if(modes.length !== 1){ fail(`${at}:看技法正文的判据要 contains / regex / number 三选一`); }
		if(spec.section !== undefined && (typeof spec.section !== 'string' || !spec.section)){ fail(`${at}:section 要段名(按段名里含这几个字找)`); }
		let match;
		if(spec.contains !== undefined){
			const needles = Array.isArray(spec.contains) ? spec.contains : [spec.contains];
			if(!needles.length || needles.some((x)=>typeof x !== 'string' || !x)){ fail(`${at}:contains 要非空字符串(或字符串数组 = 都要含)`); }
			match = (text)=>needles.every((x)=>text.indexOf(x) >= 0);
		}else if(spec.regex !== undefined){
			const re = compileRegex(spec.regex, spec.flags, at);
			match = (text)=>re.test(text);
		}else{
			const nu = spec.number;
			if(!nu || typeof nu !== 'object'){ fail(`${at}:number 要 { regex, op, value }`); }
			Object.keys(nu).forEach((k)=>{ if(['regex', 'flags', 'op', 'value'].indexOf(k) < 0){ fail(`${at}:number 里不认识的键「${k}」`); } });
			const re = compileRegex(nu.regex, nu.flags, `${at}.number`);
			if(!CMP[nu.op]){ fail(`${at}:number.op 只认 ${Object.keys(CMP).join(' ')}`); }
			if(typeof nu.value !== 'number' || !Number.isFinite(nu.value)){ fail(`${at}:number.value 要一个数`); }
			// 取第一处匹配的第一个括号里的数;没匹配到 / 括号里不是数 = 否
			match = (text)=>{ const m = re.exec(text); if(!m || m[1] === undefined){ return false; } const x = Number(`${m[1]}`.replace(/,/g, '')); return Number.isFinite(x) && CMP[nu.op](x, nu.value); };
		}
		const raw = (c)=>{
			const r = c.results && c.results[spec.technique];
			if(!r || !r.ok || typeof r.content !== 'string'){ return null; }   // 这一例这个技法没起出来:不知道
			let v;
			if(spec.section === undefined){ v = match(r.content); }
			else{
				const secs = (r.sections || []).filter((s)=>`${s.title}`.indexOf(spec.section) >= 0);
				v = secs.length ? match(secs.map((s)=>s.text).join('\n')) : false;   // 正文里没有这一段:否
			}
			// 正文超出上限被截断的格:看得见的部分里找到了就是「是」;没找到(或那一段不在)说明不了什么 —— 可能就在被裁掉的后半截里,记「不知道」
			return v === false && r.truncated ? null : v;
		};
		if(!LEAF_SINK){ return { test: raw, techniques }; }
		const idx = LEAF_SINK.length; LEAF_SINK.push(raw);
		return { test: (c)=>(c.leaf && c.leaf.length > idx ? c.leaf[idx] : raw(c)), techniques };
	}
	if(kind === 'field'){
		only(['field', 'eq', 'in', 'regex', 'flags', 'gte', 'lte', 'exists']);
		if(typeof spec.field !== 'string' || !spec.field){ fail(`${at}:field 要字段名`); }
		const ops = ['eq', 'in', 'regex', 'gte', 'lte', 'exists'].filter((k)=>spec[k] !== undefined);
		if(!ops.length){ fail(`${at}:field 判据要 eq / in / regex / gte / lte / exists 至少一个`); }
		const re = spec.regex !== undefined ? compileRegex(spec.regex, spec.flags, at) : null;
		if(spec.in !== undefined && !Array.isArray(spec.in)){ fail(`${at}:in 要数组`); }
		['gte', 'lte'].forEach((k)=>{ if(spec[k] !== undefined && (typeof spec[k] !== 'number' || !Number.isFinite(spec[k]))){ fail(`${at}:${k} 要一个数`); } });
		if(spec.exists !== undefined && typeof spec.exists !== 'boolean'){ fail(`${at}:exists 要 true / false`); }
		const norm = (v)=>(v === null || v === undefined ? '' : `${v}`.trim());
		return { test: (c)=>{
			const raw = c.fields ? c.fields[spec.field] : undefined;
			const has = norm(raw) !== '';
			if(spec.exists !== undefined && has !== spec.exists){ return false; }
			if(ops.length === 1 && spec.exists !== undefined){ return true; }
			if(!has){ return false; }                                           // 这一例没有这个字段:否(不是「不知道」—— 资料就是没写)
			if(spec.eq !== undefined && norm(raw) !== norm(spec.eq)){ return false; }
			if(spec.in !== undefined && spec.in.map(norm).indexOf(norm(raw)) < 0){ return false; }
			if(re && !re.test(norm(raw))){ return false; }
			if(spec.gte !== undefined || spec.lte !== undefined){
				const x = Number(norm(raw));
				if(!Number.isFinite(x)){ return false; }
				if(spec.gte !== undefined && !(x >= spec.gte)){ return false; }
				if(spec.lte !== undefined && !(x <= spec.lte)){ return false; }
			}
			return true;
		}, techniques };
	}
	if(kind === 'category'){
		only(['category', 'prefix', 'regex', 'flags']);
		if(spec.regex !== undefined){
			const re = compileRegex(spec.regex, spec.flags, at);
			return { test: (c)=>(c.categories || []).some((x)=>re.test(`${x}`)), techniques };
		}
		if(typeof spec.category !== 'string' || !spec.category){ fail(`${at}:category 要分类名(或用 { category: true, regex })`); }
		const want = spec.category; const prefix = spec.prefix === true;
		return { test: (c)=>(c.categories || []).some((x)=>(prefix ? `${x}`.indexOf(want) === 0 : `${x}` === want)), techniques };
	}
	// event
	only(['event']);
	const ev = spec.event;
	if(!ev || typeof ev !== 'object'){ fail(`${at}:event 要 { type: 正则 }(可加 flags)`); }
	Object.keys(ev).forEach((k)=>{ if(['type', 'flags'].indexOf(k) < 0){ fail(`${at}:event 里不认识的键「${k}」`); } });
	const re = compileRegex(ev.type, ev.flags, `${at}.event`);
	return { test: (c)=>(c.events || []).some((x)=>re.test(`${(x && x.type) || ''}`)), techniques };
}

// ───────────────────────── 命题 ─────────────────────────

const ALTS = ['greater', 'less', 'two-sided'];
const KINDS = ['implication', 'association', 'rate'];

function posInt(v, dflt, what){
	if(v === undefined){ return dflt; }
	if(!Number.isInteger(v) || v < 0){ fail(`${what} 要非负整数`); }
	return v;
}

// 校验并编译一条命题;返回 { id, kind, title, evaluate(cases) → 结果(不含裁决里与校正有关的部分), techniques }
function compileStatement(st, defs, index){
	const at = `statements[${index}]`;
	if(!st || typeof st !== 'object' || Array.isArray(st)){ fail(`${at}:要写成对象`); }
	const id = st.id === undefined ? `s${index + 1}` : `${st.id}`;
	if(!/^[A-Za-z0-9_.\-一-鿿]{1,60}$/.test(id)){ fail(`${at}:id「${id}」只能用字母、数字、汉字、_ . -(1–60 个)`); }
	if(KINDS.indexOf(st.kind) < 0){ fail(`${at}:kind 只认 ${KINDS.join(' / ')}`); }
	const allow = { implication: ['id', 'kind', 'title', 'where', 'if', 'then', 'minSupport'],
		association: ['id', 'kind', 'title', 'where', 'feature', 'label', 'alternative', 'alpha', 'minCases', 'minSupport', 'minLift'],
		rate: ['id', 'kind', 'title', 'where', 'feature', 'p0', 'alternative', 'alpha', 'minCases'] }[st.kind];
	Object.keys(st).forEach((k)=>{ if(allow.indexOf(k) < 0){ fail(`${at}:不认识的键「${k}」(${st.kind} 只认 ${allow.join(' / ')})`); } });
	const techniques = new Set();
	const pred = (key, required)=>{
		if(st[key] === undefined){ if(required){ fail(`${at}:缺 ${key}`); } return null; }
		const p = compilePredicate(st[key], defs, `${at}.${key}`);
		p.techniques.forEach((t)=>techniques.add(t));
		return p;
	};
	const where = pred('where', false);
	const population = (cases)=>{
		// 先按 where 圈定人群;where 判不出来的例不进人群(记数)
		const inPop = []; let whereUnknown = 0;
		cases.forEach((c)=>{ const v = where ? where.test(c) : true; if(v === null){ whereUnknown += 1; }else if(v){ inPop.push(c); } });
		return { inPop, whereUnknown };
	};
	const base = { id, kind: st.kind, title: st.title === undefined ? '' : `${st.title}` };

	if(st.kind === 'implication'){
		const pIf = pred('if', true); const pThen = pred('then', true);
		const minSupport = posInt(st.minSupport, 1, `${at}.minSupport`);
		return { ...base, techniques, params: { minSupport }, evaluate(cases){
			const { inPop, whereUnknown } = population(cases);
			let support = 0; let unknown = 0; const counter = [];
			inPop.forEach((c)=>{
				const a = pIf.test(c);
				if(a === null){ unknown += 1; return; }
				if(!a){ return; }
				const b = pThen.test(c);
				if(b === null){ unknown += 1; return; }
				support += 1;
				if(!b){ counter.push(c.key); }
			});
			// 有反例就是不成立(一条「凡…则…」被一个反例推翻,与满足前件的例够不够多无关);没有反例时才看够不够多
			const verdict = counter.length ? 'refuted' : support < minSupport ? 'insufficient' : 'holds';
			return { population: inPop.length, whereUnknown, unknown, support, counterexamples: counter.length, counterexampleKeys: counter.slice(0, 50), verdict };
		} };
	}

	const alternative = st.alternative === undefined ? (st.kind === 'association' ? 'greater' : 'two-sided') : st.alternative;
	if(ALTS.indexOf(alternative) < 0){ fail(`${at}:alternative 只认 ${ALTS.join(' / ')}`); }
	const alphaText = st.alpha === undefined ? '0.01' : st.alpha;
	if(typeof alphaText !== 'string'){ fail(`${at}:alpha 要用字符串写(如 "0.01"),免得小数在不同地方读成不同的值`); }
	const alpha = parseRational(alphaText, `${at}.alpha`);
	if(alpha[0] <= 0n || ratCmp(alpha[0], alpha[1], 1n, 1n) >= 0){ fail(`${at}:alpha 要在 0 与 1 之间`); }
	const minCases = posInt(st.minCases, 30, `${at}.minCases`);
	const feature = pred('feature', true);

	if(st.kind === 'association'){
		const label = pred('label', true);
		const minSupport = posInt(st.minSupport, 5, `${at}.minSupport`);
		let minLift = null;
		if(st.minLift !== undefined){
			if(typeof st.minLift !== 'string'){ fail(`${at}:minLift 要用字符串写(如 "1.2")`); }
			minLift = parseRational(st.minLift, `${at}.minLift`);
			if(minLift[0] <= 0n){ fail(`${at}:minLift 要大于 0`); }
		}
		return { ...base, techniques, alpha, params: { alternative, alpha: alphaText, minCases, minSupport, minLift: st.minLift === undefined ? null : st.minLift }, evaluate(cases){
			const { inPop, whereUnknown } = population(cases);
			let a = 0; let b = 0; let c2 = 0; let d = 0; let unknown = 0;
			inPop.forEach((c)=>{
				const f = feature.test(c); const l = label.test(c);
				if(f === null || l === null){ unknown += 1; return; }
				if(f && l){ a += 1; }else if(f){ b += 1; }else if(l){ c2 += 1; }else{ d += 1; }
			});
			const n = a + b + c2 + d;
			const p = fisherExact(a, b, c2, d, alternative);
			// 提升 = P(L | F) / P(L) = a·n / ((a+b)(a+c));比值比 = a·d / (b·c)
			const liftNum = BigInt(a) * BigInt(n); const liftDen = BigInt(a + b) * BigInt(a + c2);
			const out = { population: inPop.length, whereUnknown, unknown, n, table: { featureAndLabel: a, featureOnly: b, labelOnly: c2, neither: d },
				rateWithFeature: ratToText(BigInt(a), BigInt(a + b)), rateWithoutFeature: ratToText(BigInt(c2), BigInt(c2 + d)), baseRate: ratToText(BigInt(a + c2), BigInt(n)),
				lift: ratToText(liftNum, liftDen), oddsRatio: ratToText(BigInt(a) * BigInt(d), BigInt(b) * BigInt(c2)),
				p: ratToSci(p.num, p.den, 8), pExact: p };
			let insufficient = n < minCases || (a + b) === 0 || (c2 + d) === 0 || (a + c2) === 0 || (b + d) === 0;
			if(alternative !== 'less' && a < minSupport){ insufficient = true; }
			out.liftOk = minLift === null ? null : (liftDen !== 0n && ratCmp(liftNum, liftDen, minLift[0], minLift[1]) * (alternative === 'less' ? -1 : 1) >= 0);
			out.insufficient = insufficient;
			return out;
		} };
	}

	// rate
	if(typeof st.p0 !== 'string'){ fail(`${at}:p0 要用字符串写(如 "0.5" 或 "1/12")`); }
	const p0 = parseRational(st.p0, `${at}.p0`);
	if(p0[0] < 0n || ratCmp(p0[0], p0[1], 1n, 1n) > 0){ fail(`${at}:p0 要在 0 与 1 之间`); }
	return { ...base, techniques, alpha, params: { alternative, alpha: alphaText, minCases, p0: st.p0 }, evaluate(cases){
		const { inPop, whereUnknown } = population(cases);
		let k = 0; let n = 0; let unknown = 0;
		inPop.forEach((c)=>{ const f = feature.test(c); if(f === null){ unknown += 1; return; } n += 1; if(f){ k += 1; } });
		const p = binomialExact(k, n, p0[0], p0[1], alternative);
		return { population: inPop.length, whereUnknown, unknown, n, hits: k, rate: ratToText(BigInt(k), BigInt(n)), p0: ratToText(p0[0], p0[1]),
			p: ratToSci(p.num, p.den, 8), pExact: p, insufficient: n < minCases };
	} };
}

// 多条带检验的命题一起判时的校正:none / bonferroni(每条的门槛 = alpha / 条数)/ holm(按 p 从小到大逐条放宽)。
// 精确:门槛与 p 都是分数。返回每条 { threshold: [num, den], significant }。
// total = 校正按多少条算(缺省 = 传进来的条数)。整份命题一起判时传「带检验的命题总数」,样本不足而没进来的也算:
//   「够不够」里有一项是看检验统计量本身(有特征且是的例数),只数「够」的等于看了数据再决定除以几,整体出错率就压不住。
function applyCorrection(tests, method, total){
	const m = total === undefined ? tests.length : Math.max(tests.length, total);
	if(method === 'none' || m === 0){ return tests.map((t)=>({ threshold: t.alpha, significant: ratCmp(t.p.num, t.p.den, t.alpha[0], t.alpha[1]) <= 0 })); }
	if(method === 'bonferroni'){
		return tests.map((t)=>{ const th = [t.alpha[0], t.alpha[1] * BigInt(m)]; return { threshold: th, significant: ratCmp(t.p.num, t.p.den, th[0], th[1]) <= 0 }; });
	}
	if(method === 'holm'){
		const order = tests.map((t, i)=>i).sort((i, j)=>ratCmp(tests[i].p.num, tests[i].p.den, tests[j].p.num, tests[j].p.den) || (i - j));
		const out = new Array(m); let stopped = false;
		order.forEach((idx, rank)=>{
			const t = tests[idx];
			const th = [t.alpha[0], t.alpha[1] * BigInt(m - rank)];
			const sig = !stopped && ratCmp(t.p.num, t.p.den, th[0], th[1]) <= 0;
			if(!sig){ stopped = true; }
			out[idx] = { threshold: th, significant: sig };
		});
		return out;
	}
	return fail(`correction 只认 none / bonferroni / holm(这里是「${method}」)`);
}

// 整份命题跑一遍。cases = [{ key, fields, categories, events, results: { 技法: { ok, content, sections } } }]。
// 返回每条命题的结果与裁决(holds 成立 / refuted 不成立 / not_supported 证据不足以支持 / insufficient 样本不足)。
function evaluateClaim(compiled, cases){
	const raw = compiled.statements.map((s)=>({ s, r: s.evaluate(cases) }));
	const withTest = raw.filter((x)=>x.s.kind !== 'implication');
	const tested = withTest.filter((x)=>!x.r.insufficient);
	const corr = applyCorrection(tested.map((x)=>({ p: x.r.pExact, alpha: x.s.alpha })), compiled.correction, withTest.length);
	const corrOf = new Map(); tested.forEach((x, i)=>corrOf.set(x.s.id, corr[i]));
	return raw.map(({ s, r })=>{
		const out = { id: s.id, kind: s.kind, title: s.title, params: s.params, ...r };
		delete out.pExact; delete out.insufficient; delete out.liftOk;
		if(s.kind === 'implication'){ return out; }
		if(r.insufficient){ out.verdict = 'insufficient'; return out; }
		const c = corrOf.get(s.id);
		out.threshold = ratToSci(c.threshold[0], c.threshold[1], 8);
		out.significant = c.significant;
		if(s.kind === 'association' && r.liftOk !== null){ out.liftOk = r.liftOk; }
		out.verdict = c.significant && (s.kind !== 'association' || r.liftOk !== false) ? 'holds' : 'not_supported';
		return out;
	});
}

// 校验并编译整份命题(只管「怎么判」的部分:define / statements / correction;命例来源等由调用方管)
function compileClaim(claim){
	if(!claim || typeof claim !== 'object' || Array.isArray(claim)){ fail('命题文件要是一个 JSON 对象'); }
	const defs = claim.define === undefined ? {} : claim.define;
	if(!defs || typeof defs !== 'object' || Array.isArray(defs)){ fail('define 要写成 { 名字: 判据 }'); }
	// 每个都编一遍:写错的早报,哪怕暂时没人用;编好的留着,判完后逐个数「是 / 否 / 不知道」
	const leaves = []; LEAF_SINK = leaves;
	let definitions; let statements;
	try{
		definitions = Object.keys(defs).sort().map((k)=>({ name: k, pred: compilePredicate(k, defs, `define.${k}`) }));
		if(!Array.isArray(claim.statements) || !claim.statements.length){ fail('statements 要非空数组(至少一条命题)'); }
		statements = claim.statements.map((st, i)=>compileStatement(st, defs, i));
	}finally{ LEAF_SINK = null; }
	const ids = statements.map((s)=>s.id);
	if(new Set(ids).size !== ids.length){ fail(`statements 里有重复的 id:${ids.filter((x, i)=>ids.indexOf(x) !== i).join(', ')}`); }
	const correction = claim.correction === undefined ? 'bonferroni' : `${claim.correction}`;
	if(['none', 'bonferroni', 'holm'].indexOf(correction) < 0){ fail(`correction 只认 none / bonferroni / holm(这里是「${correction}」)`); }
	const techniques = new Set();
	statements.forEach((s)=>s.techniques.forEach((t)=>techniques.add(t)));
	definitions.forEach((d)=>d.pred.techniques.forEach((t)=>techniques.add(t)));   // 没被命题用到的判据也起它要看的技法:计数才数得出来
	return { statements, correction, definitions, techniques: Array.from(techniques).sort(), leaves };
}

// 一例的起盘结果读到后:把全部看正文的判据先算好存在这一例上。之后判定只读这份,调用方可以把正文丢掉。
function prepareCase(compiled, c){
	c.leaf = (compiled.leaves || []).map((f)=>f(c));
}

// 每个命名判据在全部命例上的计数:是 / 否 / 不知道(要看的技法这一例没起出来)。
// 判据写错(正则不对、段名不对)最常见的样子就是「没有一例是」或「没有一例否」—— 这张表让人一眼看出来;计数进凭据,复核时一并核对。
function countDefinitions(compiled, cases){
	return (compiled.definitions || []).map((d)=>{
		let yes = 0; let no = 0; let unknown = 0;
		cases.forEach((c)=>{ const v = d.pred.test(c); if(v === true){ yes += 1; }else if(v === false){ no += 1; }else{ unknown += 1; } });
		return { name: d.name, yes, no, unknown };
	});
}

module.exports = { VerifyError, canonical, sha256, fingerprint, gcd, parseRational, ratCmp, ratToFixed, ratToSci, ratToText,
	binomial, fisherExact, binomialExact, compilePredicate, compileStatement, compileClaim, prepareCase, applyCorrection, evaluateClaim, countDefinitions };
