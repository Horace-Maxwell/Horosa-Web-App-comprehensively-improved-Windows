// 静态守卫:异步取数「只认最新一次」。
// 判据(逐段核,不是「方法体里某处有判据」):
//   · async 函数 / 方法里,每个 await 之后、下一次写屏之前;
//   · .then(cb) 的回调里(回调体起点就是回包时刻),第一次写屏之前;
// 必须出现「仍是最新」的判据 ——
//   · 与代次比较:xxxSeq / xxxEpoch / xxxGen / xxxToken / seq 参与的 === / !==;
//   · 判据函数:stale() / isStale() / xxxIsCurrent(...) / isCurrent…(...) / isLatest…(...);
//   · 按内容比:nowKey / curKey / currentKey / latestKey 参与的 === / !==(回包时的现状与请求时一致才写);
//   · 与实例上记的最近一次请求键 / 签名比:this.xxxKey / this.xxxSig 参与的 === / !==;
//   · 每次请求各自一份的闭包旗标:dead / cancelled / disposed / ignore / aborted / superseded(Hook effect 清理置位)。
// 写屏 = this.setState(...) / 给实例字段赋值 this.x = ... / Hook setter(本文件 useState、useReducer 解构的 setX)/
//   传进来的回调作语句调用(props.onX / props.setX / this.props.onX / 裸 onX(...))。
//   按请求键写进映射的函数式更新(setX((m)=>({ ...m, [key]: v })))不算(每个请求只落自己的键)。
// 只判 unmounted 不算:它管不了「先发后回」。
// 范围 = 全部 src/components(扫描面不按目录表收窄,新目录自动在内)。
//   · 卜类技法页(按主导航「卜」组的入口页及其懒加载子页机械导出)与择日宿主:一律零容忍;
//   · 其余目录:现存的未判点登记在 asyncLatestResultBaseline*.json(按「文件#方法」计数,只许减不许增),新加的一律红。
// 姊妹件 derivedChartSourceGuard.test.js 管另一半:回包虽是最新一次,但出自上一张盘(换盘在途 / 新盘取失败)——
//   派生盘必须连同来源键存、经 pickKeyedDerived 与当前盘比对后才画。
import fs from 'fs';
import path from 'path';

const parser = require('@babel/parser');
const { divinationDirs, DIVINATION_ALSO_DIRS } = require('../../utils/__tests__/helpers/divinationDirs');

const SRC = path.join(__dirname, '..', '..');
const COMPONENTS = path.join(SRC, 'components');
// 登记表分两份:共用部分 + 另一份附加表(文件不存在时按空表)
const BASELINE_NAMES = ['asyncLatestResultBaseline.json'];
const BASELINE_FILES = BASELINE_NAMES.map((n)=>path.join(__dirname, n));
function loadBaseline(){
	const out = {};
	BASELINE_FILES.filter((f)=>fs.existsSync(f)).forEach((f)=>{
		const j = JSON.parse(fs.readFileSync(f, 'utf8'));
		Object.keys(j).filter((k)=>k.includes('#')).forEach((k)=>{ out[k] = (out[k] || 0) + j[k]; });
	});
	return out;
}

const FN_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ClassMethod', 'ObjectMethod', 'ClassPrivateMethod']);
const FRESH_CALL_RE = /^(stale|isStale|\w*IsCurrent|isCurrent\w*|isLatest\w*|\w*StillCurrent)$/;
const FRESH_NAME_RE = /(Seq|Epoch|Gen|Generation|Token)$|^_*(seq|epoch|gen|token)$|^(now|cur|current|latest)\w*Key$/;
// 与实例上「最近一次请求的键 / 签名」比(this.pdPolesKey !== key、this._lensSig !== reqSig):实例字段记的就是最新那次。
const LATEST_FIELD_RE = /(Key|Sig|Signature)$/;
function isLatestFieldSide(n){
	return !!(n && n.type === 'MemberExpression' && !n.computed && n.object && n.object.type === 'ThisExpression'
		&& n.property && LATEST_FIELD_RE.test(n.property.name || ''));
}
// 每次发请求各自一份的闭包旗标(Hook effect 清理时置位 / 新一轮起取时置位):裸标识符才算,this.x 不算。
const FRESH_FLAG_RE = /^(dead|cancell?ed|disposed|ignore|aborted|superseded)$/;
// 写屏的三种形态:this.setState / 给实例字段赋值;Hook setter(本文件 useState / useReducer 解构出来的 setX);
// 传进来的回调(props.onX / props.setX、this.props.onX / this.props.setX、裸 onX(...))。
// 同名的缓存写入(setXxxLocalCache 之类)不是写屏 —— Hook setter 只认本文件真由 useState 解构出来的名字;
// 回调只在作语句调用时算写屏(.then(()=>onExplain(row)) 是接着取数,不是把结果往上交)。
// 按请求键写进映射(setX((m)=>({ ...m, [key]: v })))每个请求只落自己的键,不会盖掉别的请求 —— 不算。
const CALLBACK_NAME_RE = /^(on|set)[A-Z]\w*$/;
function isKeyedFunctionalUpdate(n){
	const f = n.arguments && n.arguments.length === 1 ? n.arguments[0] : null;
	if(!f || (f.type !== 'ArrowFunctionExpression' && f.type !== 'FunctionExpression')){ return false; }
	const body = f.body && f.body.type === 'ObjectExpression' ? f.body : null;
	if(!body){ return false; }
	const props = body.properties || [];
	return props.some((p)=>p.type === 'SpreadElement') && props.filter((p)=>p.type !== 'SpreadElement').every((p)=>p.computed);
}
function isCommitCall(n, hookSetters){
	const c = n.callee;
	if(!c){ return false; }
	if(c.type === 'MemberExpression' && !c.computed && c.property && c.property.name === 'setState'){ return true; }
	if(c.type === 'Identifier' && hookSetters.has(c.name)){ return !isKeyedFunctionalUpdate(n); }
	if(!n._stmt){ return false; }
	if(c.type === 'Identifier'){
		return /^on[A-Z]\w*$/.test(c.name);
	}
	if(c.type === 'MemberExpression' && !c.computed && c.object && c.property && CALLBACK_NAME_RE.test(c.property.name || '')){
		const o = c.object;
		if(o.type === 'Identifier' && o.name === 'props'){ return true; }
		if(o.type === 'MemberExpression' && !o.computed && o.object && o.object.type === 'ThisExpression' && o.property && o.property.name === 'props'){ return true; }
	}
	return false;
}

// 本文件里 const [x, setX] = useState(...) / useReducer(...) 解构出来的 setter 名
function hookSettersOf(ast){
	const out = new Set();
	const walk = (n)=>{
		if(!n || typeof n.type !== 'string'){ return; }
		if(n.type === 'VariableDeclarator' && n.id && n.id.type === 'ArrayPattern' && n.init && n.init.type === 'CallExpression'){
			const cal = n.init.callee;
			const nm = cal && (cal.type === 'Identifier' ? cal.name : (cal.type === 'MemberExpression' && cal.property ? cal.property.name : ''));
			const el = n.id.elements && n.id.elements[1];
			if(/^use(State|Reducer)$/.test(nm || '') && el && el.type === 'Identifier'){ out.add(el.name); }
		}
		Object.keys(n).forEach((k)=>{
			if(k === 'loc' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments'){ return; }
			const v = n[k];
			if(Array.isArray(v)){ v.forEach(walk); } else if(v && typeof v === 'object' && typeof v.type === 'string'){ walk(v); }
		});
	};
	walk(ast.program);
	return out;
}
const PARSE_PLUGINS = ['jsx', 'classProperties', 'optionalChaining', 'objectRestSpread', 'dynamicImport', 'nullishCoalescingOperator'];

function nameOfSide(n){
	if(!n){ return ''; }
	if(n.type === 'Identifier'){ return n.name; }
	if(n.type === 'MemberExpression' && !n.computed && n.property){ return n.property.name || ''; }
	if(n.type === 'AssignmentExpression'){ return nameOfSide(n.left); }   // seq === (this._x = this._x + 1) 之类
	if(n.type === 'UpdateExpression'){ return nameOfSide(n.argument); }
	return '';
}

// 返回一段源码里所有「await 之后、下一次写屏之前无判据」的位点:[{ owner, line, commitLine }]
export function scanAsyncFreshness(text){
	let ast;
	try{
		ast = parser.parse(text, { sourceType: 'module', plugins: PARSE_PLUGINS, errorRecovery: true });
	}catch(e){
		return [{ owner: '(parse-error)', line: 0, commitLine: 0 }];
	}
	const records = [];
	const hookSetters = hookSettersOf(ast);
	const thenCbs = new Set();   // .then(cb, onRejected) 的回调:回调体本身就是「回包之后」
	const visit = (n, cur, ownerName)=>{
		if(!n || typeof n.type !== 'string'){ return; }
		let rec = cur;
		let owner = ownerName;
		if(n.type === 'ClassMethod' || n.type === 'ObjectMethod' || n.type === 'ClassPrivateMethod'){
			owner = (n.key && (n.key.name || n.key.value)) || owner;
		}
		if(n.type === 'FunctionDeclaration' && n.id){ owner = n.id.name; }
		if((n.type === 'ClassProperty' || n.type === 'ObjectProperty') && n.key && n.value && FN_TYPES.has(n.value.type)){ owner = n.key.name || n.key.value || owner; }
		if(n.type === 'VariableDeclarator' && n.id && n.id.type === 'Identifier' && n.init && FN_TYPES.has(n.init.type)){ owner = n.id.name; }
		if(n.type === 'CallExpression' && n.callee && n.callee.type === 'MemberExpression' && !n.callee.computed && n.callee.property && n.callee.property.name === 'then'){
			(n.arguments || []).forEach((a)=>{ if(a && FN_TYPES.has(a.type)){ thenCbs.add(a); a._thenLine = n.loc.start.line; } });
		}
		if(FN_TYPES.has(n.type)){
			rec = { async: !!n.async, thenCb: thenCbs.has(n), node: n, owner: owner || '(anonymous)', awaits: [], commits: [], fresh: [] };
			records.push(rec);
		}
		if(rec && (rec.async || rec.thenCb)){
			if(n.type === 'AwaitExpression'){ rec.awaits.push(n); }
			if(n.type === 'CallExpression' && isCommitCall(n, hookSetters)){
				rec.commits.push(n);
			}
			if(n.type === 'Identifier' && !n._isKey && FRESH_FLAG_RE.test(n.name)){ rec.fresh.push(n); }
			if(n.type === 'AssignmentExpression' && n.left && n.left.type === 'MemberExpression' && n.left.object && n.left.object.type === 'ThisExpression' && !n.left.computed){
				rec.commits.push(n);
			}
			if(n.type === 'CallExpression' && n.callee){
				const c = n.callee;
				const nm = c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' && !c.computed && c.property ? c.property.name : '');
				if(FRESH_CALL_RE.test(nm || '')){ rec.fresh.push(n); }
			}
			if(n.type === 'BinaryExpression' && /^[!=]==?$/.test(n.operator)){
				if([n.left, n.right].some((side)=>FRESH_NAME_RE.test(nameOfSide(side)) || isLatestFieldSide(side))){ rec.fresh.push(n); }
			}
		}
		if(n.type === 'ExpressionStatement' && n.expression){ n.expression._stmt = true; }
		// 成员名 / 对象键不是标识符引用(this.dead、{ dead: 1 } 都不算闭包旗标)
		if((n.type === 'MemberExpression' || n.type === 'OptionalMemberExpression') && !n.computed && n.property){ n.property._isKey = true; }
		if((n.type === 'ObjectProperty' || n.type === 'ClassProperty') && !n.computed && n.key){ n.key._isKey = true; }
		Object.keys(n).forEach((k)=>{
			if(k === 'loc' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments'){ return; }
			const v = n[k];
			if(Array.isArray(v)){ v.forEach((x)=>visit(x, rec, owner)); } else if(v && typeof v === 'object' && typeof v.type === 'string'){ visit(v, rec, owner); }
		});
	};
	visit(ast.program, null, '');
	const out = [];
	records.forEach((r)=>{
		if(r.thenCb){
			// 回调体起点即回包时刻:第一次写屏之前必须有判据
			const first = r.commits.slice().sort((x, y)=>x.start - y.start)[0];
			if(first && !r.fresh.some((f)=>f.start < first.start)){
				out.push({ owner: r.owner, line: r.node._thenLine || r.node.loc.start.line, commitLine: first.loc.start.line });
			}
		}
		if(!r.async){ return; }
		r.awaits.forEach((a)=>{
			const next = r.commits.filter((c)=>c.start > a.end).sort((x, y)=>x.start - y.start)[0];
			if(!next){ return; }
			if(!r.fresh.some((f)=>f.start >= a.end && f.start < next.start)){
				out.push({ owner: r.owner, line: a.loc.start.line, commitLine: next.loc.start.line });
			}
		});
	});
	return out;
}

function listJsFiles(dir){
	const out = [];
	const walk = (d)=>{
		fs.readdirSync(d, { withFileTypes: true }).forEach((e)=>{
			const f = path.join(d, e.name);
			if(e.isDirectory()){ if(e.name !== '__tests__' && e.name !== 'node_modules'){ walk(f); } return; }
			if(/\.jsx?$/.test(e.name)){ out.push(f); }
		});
	};
	walk(dir);
	return out;
}

// 卜类目录:主导航「卜」组机械导出(单源 helpers/divinationDirs,卜类配对守卫 divinationCastSourceGuard 共用)
export { divinationDirs };

// 择日宿主内嵌卜类整页,与卜类同等零容忍
const ALSO_ZERO_DIRS = DIVINATION_ALSO_DIRS;

function scanAll(){
	const counts = {};
	const detail = {};
	listJsFiles(COMPONENTS).forEach((f)=>{
		const rel = path.relative(COMPONENTS, f).split(path.sep).join('/');
		scanAsyncFreshness(fs.readFileSync(f, 'utf8')).forEach((hit)=>{
			const id = `${rel}#${hit.owner}`;
			counts[id] = (counts[id] || 0) + 1;
			(detail[id] = detail[id] || []).push(`${rel}:${hit.line}→${hit.commitLine}`);
		});
	});
	return { counts, detail };
}

describe('静态守卫:异步取数只认最新一次(逐个 await 段核)', ()=>{
	const baseline = loadBaseline();
	const { counts, detail } = scanAll();
	const { keys, dirs } = divinationDirs();
	const zeroDirs = new Set([...dirs, ...ALSO_ZERO_DIRS]);
	const dirOfId = (id)=>id.split('/')[0];

	test('卜类技法页与择日宿主:每个 await 之后、下一次写屏之前都有「仍是最新」判据', ()=>{
		const bad = Object.keys(counts).filter((id)=>zeroDirs.has(dirOfId(id))).map((id)=>detail[id].join(' '));
		expect(bad).toEqual([]);
	});

	test('其余目录:未判点只许减不许增(新加的异步取数必须带判据)', ()=>{
		const grown = Object.keys(counts)
			.filter((id)=>!zeroDirs.has(dirOfId(id)))
			.filter((id)=>counts[id] > (baseline[id] || 0))
			.map((id)=>`${id} ${counts[id]} > ${baseline[id] || 0}: ${detail[id].join(' ')}`);
		expect(grown).toEqual([]);
	});

	test('登记表里没有卜类 / 择日目录的条目(那里零容忍,不许靠登记豁免)', ()=>{
		expect(Object.keys(baseline).filter((id)=>zeroDirs.has(dirOfId(id)))).toEqual([]);
	});

	test('卜类目录由导航机械导出,扫描面不塌缩', ()=>{
		expect(keys.length).toBeGreaterThanOrEqual(8);
		['lrzhan', 'dunjia', 'taiyi', 'sanshi', 'jinkou', 'guazhan', 'fengshui', 'tarot', 'cnyibu', 'huangji', 'wuzhao', 'taixuan', 'xiaoliuren', 'feigong', 'lingqi'].forEach((d)=>{
			expect(dirs).toContain(d);
		});
		expect(listJsFiles(COMPONENTS).length).toBeGreaterThan(500);
	});

	test('判据自证:漏判的 await 段会被认出,带判据的不报', ()=>{
		const wrap = (body)=>`class A { async m(){ ${body} } }`;
		// 只有前一个 await 判了、最后一个 await 之后直接写屏 → 报
		expect(scanAsyncFreshness(wrap('const seq = ++this.s; const a = await x(); if(seq !== this.requestSeq){ return; } const b = await y(); this.setState({ b });')).length).toBe(1);
		// 给实例字段赋值也算写屏
		expect(scanAsyncFreshness(wrap('const b = await y(); this.lastKey = b;')).length).toBe(1);
		// 只判 unmounted 不算
		expect(scanAsyncFreshness(wrap('const b = await y(); if(this.unmounted){ return; } this.setState({ b });')).length).toBe(1);
		// 箭头函数 / 类属性同样在内
		expect(scanAsyncFreshness('class A { f = async ()=>{ const b = await y(); this.setState({ b }); } }').length).toBe(1);
		expect(scanAsyncFreshness('const g = async function(){ const b = await y(); this.setState({ b }); };').length).toBe(1);
		// 带判据
		expect(scanAsyncFreshness(wrap('const seq = ++this.requestSeq; const b = await y(); if(this.unmounted || seq !== this.requestSeq){ return; } this.setState({ b });'))).toEqual([]);
		expect(scanAsyncFreshness(wrap('const b = await y(); if(stale()){ return; } this.setState({ b });'))).toEqual([]);
		expect(scanAsyncFreshness(wrap('const run = 1; const b = await y(); if(!scanRunIsCurrent(this, run)){ return; } this.setState({ b });'))).toEqual([]);
		expect(scanAsyncFreshness(wrap('const b = await y(); const nowKey = k(); if(nowKey !== key){ return; } this.setState({ b });'))).toEqual([]);
		// await 之后不再写屏 → 不报
		expect(scanAsyncFreshness(wrap('this.setState({ a: 1 }); await y();'))).toEqual([]);
		// 嵌套回调里的写屏归回调自己(非 async 回调不在判据内)
		expect(scanAsyncFreshness(wrap('const seq = ++this.requestSeq; await y(); if(seq !== this.requestSeq){ return; } this.setState({ b: 1 }, ()=>{ this.x = 1; });'))).toEqual([]);
	});

	test('判据自证:.then 回调、Hook setter、传入回调三种写屏形态', ()=>{
		const cls = (body)=>`class A { m(){ ${body} } }`;
		// .then 回调里直接写屏 → 报;回调体先比代次 / 实例键 → 不报
		expect(scanAsyncFreshness(cls('fetchX(p).then((r)=>{ this.setState({ r }); });')).length).toBe(1);
		expect(scanAsyncFreshness(cls('const seq = ++this._seq; fetchX(p).then((r)=>{ if(seq !== this._seq){ return; } this.setState({ r }); });'))).toEqual([]);
		expect(scanAsyncFreshness(cls('this.pdKey = k; fetchX(p).then((r)=>{ if(this.pdKey !== k){ return; } this.setState({ r }); });'))).toEqual([]);
		// 回调里先改在途标记(实例字段)也是写屏,得先判
		expect(scanAsyncFreshness(cls('fetchX(p).then((r)=>{ this._loading = false; if(this.cur() !== k){ return; } this.setState({ r }); });')).length).toBe(1);
		// Hook setter:只认本文件 useState 解构出来的 setX
		const hook = (body)=>`function C(){ const [rows, setRows] = useState([]); ${body} }`;
		expect(scanAsyncFreshness(hook('const run = async ()=>{ const r = await q(); setRows(r); };')).length).toBe(1);
		expect(scanAsyncFreshness(hook('const run = ()=>{ q().then((r)=>setRows(r)); };')).length).toBe(1);
		expect(scanAsyncFreshness(hook('const runSeq = useRef(0); const run = async ()=>{ const seq = ++runSeq.current; const r = await q(); if(seq !== runSeq.current){ return; } setRows(r); };'))).toEqual([]);
		expect(scanAsyncFreshness(hook('useEffect(()=>{ let dead = false; q().then((r)=>{ if(!dead){ setRows(r); } }); return ()=>{ dead = true; }; }, []);'))).toEqual([]);
		// 同名缓存写入不是写屏;按请求键写映射不算
		expect(scanAsyncFreshness(hook('const run = async ()=>{ const r = await q(); setRowsLocalCache(k, r); };'))).toEqual([]);
		expect(scanAsyncFreshness(hook('const run = ()=>{ q().then((r)=>{ setRows((m)=>({ ...m, [k]: r })); }); };'))).toEqual([]);
		// this.dead(实例字段)不算闭包旗标
		expect(scanAsyncFreshness(cls('fetchX(p).then((r)=>{ if(this.dead){ return; } this.setState({ r }); });')).length).toBe(1);
		// 传进来的回调:作语句调用算写屏;作 then 的返回值(接着取数)不算
		expect(scanAsyncFreshness(cls('fetchX(p).then((r)=>{ this.props.onLoaded(r); });')).length).toBe(1);
		expect(scanAsyncFreshness('function C({ onChange }){ const go = async ()=>{ const r = await q(); onChange(r); }; }').length).toBe(1);
		expect(scanAsyncFreshness('function C({ onExplain }){ Promise.resolve().then(()=>onExplain(row)); }')).toEqual([]);
	});
});
