// 静态守卫:卜类页的起课参照盘、异步起课结果按起课签名配对(derivedChartSourceGuard 的卜类分支)。
//
// 卜类页的「当前盘」不是命主盘,是起课参数(起课时刻 + 地点,单源 utils/derivedChartSource.castSourceKey)。
// 起课参照盘 = 主盘或择日宿主取来的 /chart 底盘(this.props.value / chartObj / chart):月将、昼夜、外圈星度、底盘农历都出自它。
// 换了起课时刻 / 地点以后,参照盘在途或取失败时手上那张是上一刻的;上一课异步取到的农历 / 课 / 盘也还在 state 里 ——
// 拿它们定这一课,就是「新时刻配上一课的底盘 / 农历」。判据(卜类目录 + 择日宿主目录,零容忍):
//   ⑤a 自己也异步取起课结果的组件里,参照盘只许经起课签名比对后读:castChartFor / castIsDiurnal / castSourceKey /
//      resolveDivinationNongli 的实参;另外只认三种不读内容的用法 —— JSX 属性原样往下交、prevProps.x !== this.props.x
//      变更探测、hook.fun(…) 原样转交(收的一方自己比对)。
//   ⑤b 上一课的异步结果不许当这一课的兜底:a || this.state.X / this.state.X || a(?? 同;a 不是字面量缺省值),
//      X 是本文件在 await 之后 / then 回调里写进 state 的起课结果字段 —— 要按起课签名取(castFailureKeeps / pickKeyedDerived)。
//   ⑤c 取失败留存判据 castFailureKeeps(this.state.KSig, …) 用到的 KSig:本文件里写 K(去掉 Sig)非空值的 setState
//      必须同时写 KSig —— 只存结果不存签名,失败时就判不出屏上那份是不是同一课。
//   ⑤d 宿主把自己异步取来的底盘往下交(<X value / chartObj / chart={…}>)时,不许裸交 this.state.X ——
//      要经 castChartFor 与交下去的起课参数比对(取失败 / 在途时手上那张是上一刻的)。收的一方本身在卜类目录里
//      (自己受 ⑤a 管、按起课签名比对)可以原样交:三式页要拿到原样的底盘才分得清「底盘还在途」与「本就没有底盘」。
//   ⑤e 异步取起课结果的函数里,取失败的 catch 只收加载态(setState 里不清起课结果)= 失败后上一课照旧顶着新参数显示:
//      catch 里要么交给 settleCastFailure,要么有一条按 castFailureKeeps 判过、把起课结果写空的 setState(只调判据不清不算)。
//   另锁:下表登记的宿主仍走这些单源(改名 / 挪走 / 改回裸写会让守卫空转)。
import fs from 'fs';
import path from 'path';

const parser = require('@babel/parser');
const { readSource } = require('../../utils/__tests__/helpers/sourceSet');
const { divinationDirs, DIVINATION_ALSO_DIRS } = require('../../utils/__tests__/helpers/divinationDirs');

const COMPONENTS = path.join(__dirname, '..');
const SRC = path.join(COMPONENTS, '..');
const PARSE_PLUGINS = ['jsx', 'classProperties', 'optionalChaining', 'objectRestSpread', 'dynamicImport', 'nullishCoalescingOperator'];
const FN_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ClassMethod', 'ObjectMethod', 'ClassPrivateMethod']);
const REFERENCE_PROPS = new Set(['value', 'chartObj', 'chart']);
const CAST_SINKS = new Set(['castChartFor', 'castIsDiurnal', 'castSourceKey', 'resolveDivinationNongli']);
// 起课结果字段(状态位、选项、草稿字段不在内)
const LESSON_FIELD_RE = /^(nongli|pan|liureng|dunjia|taiyi|xinyi|runyear|result|data|rows|list|chart|chartValue|lrLayout|keData|sanChuan)$|(Pan|Chart|ChartObj|ChartValue|Result|Data|Nongli|Bundle)$/;

function isThisMember(n, objName){
	return !!(n && n.type === 'MemberExpression' && !n.computed && n.object
		&& n.object.type === 'MemberExpression' && !n.object.computed
		&& n.object.object && n.object.object.type === 'ThisExpression'
		&& n.object.property && n.object.property.name === objName && n.property);
}
const stateField = (n)=>(isThisMember(n, 'state') ? n.property.name : null);
const isReferenceRead = (n)=>isThisMember(n, 'props') && REFERENCE_PROPS.has(n.property.name);
const keyName = (p)=>(p && p.key ? (p.key.name || p.key.value || '') : '');
const calleeName = (c)=>(!c ? '' : (c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' && !c.computed && c.property ? c.property.name || '' : '')));
const isLiteralDefault = (v)=>!!(v && (['NullLiteral', 'BooleanLiteral', 'StringLiteral', 'NumericLiteral'].includes(v.type)
	|| (v.type === 'Identifier' && v.name === 'undefined')
	|| (v.type === 'ArrayExpression' && !v.elements.length) || (v.type === 'ObjectExpression' && !v.properties.length)));
const isNullish = (v)=>!!(v && (v.type === 'NullLiteral' || (v.type === 'Identifier' && v.name === 'undefined')));

function walk(node, fn, parent){
	if(!node || typeof node.type !== 'string'){ return; }
	fn(node, parent);
	Object.keys(node).forEach((k)=>{
		if(k === 'loc' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments'){ return; }
		const v = node[k];
		if(Array.isArray(v)){ v.forEach((x)=>walk(x, fn, node)); } else if(v && typeof v === 'object' && typeof v.type === 'string'){ walk(v, fn, node); }
	});
}

// setState 实参里的对象字面量(含函数式更新返回的对象、...(cond ? { X } : {}) 条件展开、先拼好再传的变量 const st = { … })
function setStateObjects(call, varInits){
	const out = [];
	let a = call.arguments[0];
	if(a && a.type === 'Identifier' && varInits && varInits.has(a.name)){ a = varInits.get(a.name); }
	const take = (o)=>{
		out.push(o);
		(o.properties || []).filter((p)=>p.type === 'SpreadElement').forEach((sp)=>walk(sp.argument, (q)=>{ if(q.type === 'ObjectExpression'){ out.push(q); } }));
	};
	if(a && a.type === 'ObjectExpression'){ take(a); }
	if(a && a.type === 'ConditionalExpression'){ [a.consequent, a.alternate].forEach((b)=>{ if(b && b.type === 'ObjectExpression'){ take(b); } }); }
	if(a && (a.type === 'ArrowFunctionExpression' || a.type === 'FunctionExpression')){ walk(a.body, (m)=>{ if(m.type === 'ObjectExpression'){ out.push(m); } }); }
	return out;
}
const isSetStateCall = (n)=>n.type === 'CallExpression' && n.callee && n.callee.type === 'MemberExpression' && !n.callee.computed
	&& n.callee.property && n.callee.property.name === 'setState';

// 返回一段源码里的违例:[{ rule, field, line }]
// opts.selfKeyingImport(import 路径) → true:该组件在卜类目录里、自己按起课签名比对(⑤d 可原样交)
export function scanDivinationCastSource(text, opts){
	const selfKeying = (opts && opts.selfKeyingImport) || (()=>false);
	let ast;
	try{
		ast = parser.parse(text, { sourceType: 'module', plugins: PARSE_PLUGINS, errorRecovery: true });
	}catch(e){
		return [{ rule: 'parse-error', field: '', line: 0 }];
	}
	const out = [];
	const parents = new Map();
	const varInits = new Map();   // const st = { … }(给 setState 的变量)
	walk(ast.program, (n, p)=>{
		parents.set(n, p);
		if(n.type === 'VariableDeclarator' && n.id && n.id.type === 'Identifier' && n.init && n.init.type === 'ObjectExpression'){ varInits.set(n.id.name, n.init); }
	});
	// 异步写进 state 的起课结果字段
	const asyncCbs = new Set();
	walk(ast.program, (n)=>{
		if(n.type === 'CallExpression' && n.callee && n.callee.type === 'MemberExpression' && n.callee.property
			&& ['then', 'catch', 'finally'].includes(n.callee.property.name)){
			(n.arguments || []).forEach((a)=>{ if(a && FN_TYPES.has(a.type)){ asyncCbs.add(a); } });
		}
	});
	const asyncFields = new Set();
	const visit = (node, inAsync)=>{
		if(!node || typeof node.type !== 'string'){ return; }
		let ctx = inAsync;
		if(FN_TYPES.has(node.type)){ ctx = inAsync || !!node.async || asyncCbs.has(node); }
		if(ctx && isSetStateCall(node)){
			setStateObjects(node, varInits).forEach((o)=>(o.properties || []).filter((p)=>p.type === 'ObjectProperty').forEach((p)=>{
				const x = keyName(p);
				if(LESSON_FIELD_RE.test(x) && !isNullish(p.value)){ asyncFields.add(x); }
			}));
		}
		Object.keys(node).forEach((k)=>{
			if(k === 'loc' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments'){ return; }
			const v = node[k];
			if(Array.isArray(v)){ v.forEach((x)=>visit(x, ctx)); } else if(v && typeof v === 'object' && typeof v.type === 'string'){ visit(v, ctx); }
		});
	};
	visit(ast.program, false);
	// ⑤a 参照盘只经起课签名比对后读
	if(asyncFields.size){
		walk(ast.program, (n)=>{
			if(!isReferenceRead(n)){ return; }
			const p = parents.get(n);
			if(p && p.type === 'JSXExpressionContainer' && parents.get(p) && parents.get(p).type === 'JSXAttribute'){ return; }
			if(p && p.type === 'BinaryExpression' && /^[!=]==?$/.test(p.operator)){
				const other = p.left === n ? p.right : p.left;
				if(other && other.type === 'MemberExpression' && !other.computed && other.object && other.object.type === 'Identifier'
					&& /^prev/.test(other.object.name) && other.property && other.property.name === n.property.name){ return; }
			}
			if(p && p.type === 'CallExpression' && p.arguments.includes(n) && calleeName(p.callee) === 'fun'){ return; }
			// 祖先链里有比对单源的调用,且本节点在它的实参里
			let cur = n;
			let up = parents.get(cur);
			while(up){
				if(up.type === 'CallExpression' && CAST_SINKS.has(calleeName(up.callee)) && up.arguments.some((a)=>a === cur)){ return; }
				if(FN_TYPES.has(up.type)){ break; }
				cur = up;
				up = parents.get(cur);
			}
			out.push({ rule: 'raw-reference-chart', field: n.property.name, line: n.loc.start.line });
		});
	}
	// ⑤b 上一课结果当这一课的兜底
	walk(ast.program, (n)=>{
		if(n.type !== 'LogicalExpression' || (n.operator !== '||' && n.operator !== '??')){ return; }
		[[n.left, n.right], [n.right, n.left]].forEach(([a, b])=>{
			const x = stateField(a);
			// 另一侧也取自 state(屏上同一份里二选一,如 state.xinyi || state.pan.xinyi)不是拿上一课顶新参数
			let otherFromState = false;
			walk(b, (m)=>{ if(stateField(m)){ otherFromState = true; } });
			if(x && asyncFields.has(x) && !isLiteralDefault(b) && !otherFromState){ out.push({ rule: 'previous-lesson-fallback', field: x, line: n.loc.start.line }); }
		});
	});
	// ⑤d 宿主往下交异步取来的底盘必经比对
	const importOf = new Map();   // 组件名 → import 路径
	(ast.program.body || []).filter((d)=>d.type === 'ImportDeclaration').forEach((d)=>{
		(d.specifiers || []).forEach((sp)=>{ if(sp.local){ importOf.set(sp.local.name, d.source.value); } });
	});
	walk(ast.program, (n)=>{
		const p = parents.get(n);
		if(n.type !== 'JSXAttribute' || !n.name || !REFERENCE_PROPS.has(n.name.name)){ return; }
		const el = p && p.type === 'JSXOpeningElement' && p.name && p.name.type === 'JSXIdentifier' ? p.name.name : '';
		if(el && importOf.has(el) && selfKeying(importOf.get(el))){ return; }
		const e = n.value && n.value.type === 'JSXExpressionContainer' ? n.value.expression : null;
		const x = stateField(e);
		if(x && asyncFields.has(x)){ out.push({ rule: 'raw-host-chart-handoff', field: x, line: n.loc.start.line }); }
	});
	// ⑤e 取失败的 catch 不许只收加载态
	walk(ast.program, (fn)=>{
		if(!FN_TYPES.has(fn.type)){ return; }
		const writes = new Set();
		walk(fn.body, (m)=>{
			if(isSetStateCall(m)){
				setStateObjects(m, varInits).forEach((o)=>(o.properties || []).filter((p)=>p.type === 'ObjectProperty').forEach((p)=>{
					const x = keyName(p);
					if(asyncFields.has(x) && !isNullish(p.value)){ writes.add(x); }
				}));
			}
		});
		if(!writes.size){ return; }
		walk(fn.body, (c)=>{
			if(c.type !== 'CatchClause'){ return; }
			let commits = false;
			let settles = false;
			walk(c.body, (m)=>{
				if(isSetStateCall(m)){
					commits = true;
					setStateObjects(m, varInits).forEach((o)=>(o.properties || []).filter((p)=>p.type === 'ObjectProperty').forEach((p)=>{
						if(writes.has(keyName(p))){ settles = true; }
					}));
				}
				// 只调判据不按它清(结果被丢掉)不算:要么交给 settleCastFailure,要么 catch 里真有一条把起课结果写空的 setState
				if(m.type === 'CallExpression' && calleeName(m.callee) === 'settleCastFailure'){ settles = true; }
			});
			if(commits && !settles){ out.push({ rule: 'failure-keeps-previous-lesson', field: [...writes].join(','), line: c.loc.start.line }); }
		});
	});
	// ⑤c 取失败判据用到的签名字段:写结果必同写签名
	const sigFields = new Set();
	walk(ast.program, (n)=>{
		if(n.type === 'CallExpression' && calleeName(n.callee) === 'castFailureKeeps'){
			const k = stateField(n.arguments[0]);
			if(k && /Sig$/.test(k) && k.length > 3){ sigFields.add(k); }
		}
	});
	if(sigFields.size){
		walk(ast.program, (n)=>{
			if(!isSetStateCall(n)){ return; }
			setStateObjects(n, varInits).forEach((o)=>{
				const props = (o.properties || []).filter((p)=>p.type === 'ObjectProperty');
				const names = new Set(props.map(keyName));
				props.forEach((p)=>{
					const x = keyName(p);
					const k = `${x}Sig`;
					if(sigFields.has(k) && !isNullish(p.value) && !names.has(k)){ out.push({ rule: 'write-without-cast-sig', field: x, line: p.loc.start.line }); }
				});
			});
		});
	}
	return out;
}

function listJsFiles(dir){
	const out = [];
	const rec = (d)=>{
		fs.readdirSync(d, { withFileTypes: true }).forEach((e)=>{
			const f = path.join(d, e.name);
			if(e.isDirectory()){ if(e.name !== '__tests__' && e.name !== 'node_modules'){ rec(f); } return; }
			if(/\.jsx?$/.test(e.name)){ out.push(f); }
		});
	};
	rec(dir);
	return out;
}

describe('静态守卫:卜类页的参照盘与起课结果按起课签名配对', ()=>{
	const buDirs = [...divinationDirs().dirs, ...DIVINATION_ALSO_DIRS];

	test('卜类目录 + 择日宿主:参照盘经比对后读、上一课结果不兜底、取失败判据的签名随结果写', ()=>{
		const bad = [];
		let n = 0;
		buDirs.forEach((d)=>{
			const dir = path.join(COMPONENTS, d);
			if(!fs.existsSync(dir)){ return; }
			listJsFiles(dir).forEach((f)=>{
				n += 1;
				const rel = path.relative(COMPONENTS, f).split(path.sep).join('/');
				const selfKeyingImport = (spec)=>{
					if(!/^\./.test(spec)){ return false; }
					const target = path.relative(COMPONENTS, path.resolve(path.dirname(f), spec)).split(path.sep);
					return target[0] !== '..' && buDirs.includes(target[0]);
				};
				scanDivinationCastSource(fs.readFileSync(f, 'utf8'), { selfKeyingImport }).forEach((h)=>bad.push(`${rel}:${h.line} ${h.rule} ${h.field}`));
			});
		});
		expect(buDirs.length).toBeGreaterThanOrEqual(16);
		expect(n).toBeGreaterThan(150);
		expect(bad).toEqual([]);
	});

	test('登记的宿主仍走起课签名单源(改名 / 挪走 / 改回裸写会让守卫空转)', ()=>{
		const src = (rel)=>readSource(path.join(COMPONENTS, rel));
		// 取失败不留上一课
		['dunjia/DunJiaMain.js', 'sanshi/SanShiUnitedMain.js', 'lrzhan/LiuRengMain.js', 'jinkou/JinKouMain.js',
			'huangji/HuangJiMain.js', 'wuzhao/WuZhaoMain.js', 'taixuan/TaiXuanMain.js', 'shenyishu/ShenYiShuMain.js'].forEach((rel)=>{
			expect([rel, /castFailureKeeps\(/.test(src(rel))]).toEqual([rel, true]);
		});
		// 昼夜单源(参照盘对得上才用它的,否则按起课时刻本地算)
		['dunjia/DunJiaMain.js', 'sanshi/SanShiUnitedMain.js', 'jinkou/JinKouMain.js'].forEach((rel)=>{
			expect([rel, /castIsDiurnal\(/.test(src(rel))]).toEqual([rel, true]);
		});
		// 取失败走留存 / 清掉判据(catch 不只收加载态)
		expect(src('sanshi/SanShiUnitedMain.js')).toMatch(/this\.lastKey = '';[^\n]*\n\s*this\.settleCastFailure\(fields\);/);
		expect((src('dunjia/DunJiaMain.js').match(/this\.settleCastFailure\(flds\);/g) || []).length).toBe(2);
		// 三式:屏上农历只在同一课时才拿来兜底
		expect(src('sanshi/SanShiUnitedMain.js')).toMatch(/if\(!nongli && this\.state\.nongli && castFailureKeeps\(this\.state\.lessonSig, castSourceKey\(fields\)\)\)\{/);
		// 参照盘与课同一次落定
		expect(src('sanshi/SanShiUnitedMain.js')).toMatch(/castChart: chartWrap,\s*lessonSig: castKey,/);
		expect(src('sanshi/SanShiUnitedMain.js')).toMatch(/chartWrap=\{this\.state\.castChart\}/);
		expect(src('lrzhan/LiuRengMain.js')).toMatch(/calcFields: fields,\s*calcChart: chart,/);
		expect(src('jinkou/JinKouMain.js')).toMatch(/calcFields: fields,\s*calcChart,/);
		// 太乙:屏上农历只认同一课
		expect(src('taiyi/TaiYiMain.js')).toMatch(/pickKeyedDerived\(this\.state\.nongli, this\.state\.nongliSig, castSourceKey\(/);
		// 择日宿主:底盘只在与内嵌页同一时刻时交下去
		['zeri/LiurengZeriMain.js', 'zeri/QizhengZeriMain.js'].forEach((rel)=>{
			expect([rel, /castChartFor\(this\.state\.chartValue, embedFields\)/.test(src(rel))]).toEqual([rel, true]);
		});
		// 择日六壬宿主:取这一刻的底盘失败 → 告诉内嵌页(换了时刻地点清掉上一课,盘区留空)
		expect(src('zeri/LiurengZeriMain.js')).toMatch(/\.catch\(\(\)=>\{ unavailable\(\);/);
		expect(src('zeri/LiurengZeriMain.js')).toMatch(/this\.liurengHook\.chartUnavailable\(fields\)/);
		expect(src('lrzhan/LiuRengMain.js')).toMatch(/this\.props\.hook\.chartUnavailable = \(fields\)=>\{[\s\S]{0,80}this\.settleCastChartFailure\(fields\);/);
		expect(src('lrzhan/LiuRengMain.js')).toMatch(/settleCastChartFailure\(fields\)\{\n\t\tif\(!fields \|\| castFailureKeeps\(castSourceKey\(this\.state\.calcFields\), castSourceKey\(fields\)\)\)\{ return; \}/);
		// 三式宿主原样交底盘:三式页自己比对(上面 ⑤a 管着)并在底盘在途时留上一课 + 更新中
		expect(src('zeri/SanshiZeriMain.js')).toMatch(/import SanShiUnitedMain\b[^;]*from '\.\.\/sanshi\/SanShiUnitedMain'/);
		expect(src('sanshi/SanShiUnitedMain.js')).toMatch(/return SANSHI_RECALC_HELD;/);
		// 卜类子页占时农历单源
		expect(fs.readFileSync(path.join(SRC, 'utils/divinationTimeDraft.js'), 'utf8')).toMatch(/const sameCast = castChartFor\(chartWrap, gf\);/);
		['xiaoliuren/XiaoLiuRenMain.js', 'feigong/FeiGongMain.js', 'lingqi/LingQiMain.js', 'guice/GuiceMain.js'].forEach((rel)=>{
			expect([rel, /resolveDivinationNongli\(this\.state\.localFields, this\.props\.fields, this\.props\.value\)/.test(src(rel))]).toEqual([rel, true]);
		});
	});

	test('判据自证:三条规则各自认得出,合规写法不报', ()=>{
		const cls = (body)=>`class A extends B { async load(){ const r = await q(); this.setState({ pan: r, panSig: r.k, nongli: r.n }); } ${body} }`;
		const rules = (body)=>scanDivinationCastSource(cls(body)).map((h)=>`${h.rule}:${h.field}`);
		// ⑤a 裸读参照盘
		expect(rules('ctx(){ return this.props.value.chart.isDiurnal; }')).toEqual(['raw-reference-chart:value']);
		expect(rules('ctx(){ const w = this.props.chartObj || this.props.chart || null; return w; }')).toEqual(['raw-reference-chart:chartObj', 'raw-reference-chart:chart']);
		expect(rules('go(f){ this.requestGods(f, this.props.value); }')).toEqual(['raw-reference-chart:value']);
		// 经比对单源 / JSX 原样往下交 / 变更探测 / hook 转交 → 不报
		expect(rules('ctx(f){ return castChartFor(this.props.chartObj || this.props.chart || null, f); }')).toEqual([]);
		expect(rules('ctx(f, c){ return castChartFor(c === undefined ? this.props.value : c, f); }')).toEqual([]);
		expect(rules('ctx(f){ return castIsDiurnal(this.props.value, f); }')).toEqual([]);
		expect(rules('render(){ return <C value={this.props.chart} />; }')).toEqual([]);
		expect(rules('componentDidUpdate(prevProps){ if(prevProps.chartObj !== this.props.chartObj){ x(); } }')).toEqual([]);
		expect(rules('go(){ hook.fun(this.props.fields, this.props.chart); }')).toEqual([]);
		// 不自己异步取起课结果的组件(纯展示 / 盘就是主盘本身)不在 ⑤a 内
		expect(scanDivinationCastSource('class A extends B { render(){ return draw(this.props.value.chart); } }')).toEqual([]);
		// ⑤d 宿主裸交异步底盘
		const host = (attr)=>`import M from '../other/M'; class H extends B { req(){ fetchChart(p).then((rsp)=>{ this.setState({ chartValue: rsp.Result }); }); } render(){ const f = this.f(); return <M ${attr} fields={f} />; } }`;
		expect(scanDivinationCastSource(host('value={this.state.chartValue}')).map((h)=>h.rule)).toEqual(['raw-host-chart-handoff']);
		expect(scanDivinationCastSource(host('chartObj={this.state.chartValue}')).map((h)=>h.rule)).toEqual(['raw-host-chart-handoff']);
		expect(scanDivinationCastSource(host('value={castChartFor(this.state.chartValue, f)}'))).toEqual([]);
		// 收的一方自己按起课签名比对(卜类目录里的页)→ 可原样交
		expect(scanDivinationCastSource(host('chartObj={this.state.chartValue}'), { selfKeyingImport: (s)=>s === '../other/M' })).toEqual([]);
		// ⑤e 取失败只收加载态
		expect(scanDivinationCastSource('class A extends B { async load(f){ try{ const pan = await q(f); this.setState({ pan, loading: false }); }catch(e){ this.setState({ loading: false }); } } }').map((h)=>h.rule)).toEqual(['failure-keeps-previous-lesson']);
		expect(scanDivinationCastSource('class A extends B { async load(f){ try{ const pan = await q(f); this.setState({ pan, loading: false }); }catch(e){ this.settleCastFailure(f); } } }')).toEqual([]);
		expect(scanDivinationCastSource('class A extends B { async load(f){ try{ const pan = await q(f); this.setState({ pan, loading: false }); }catch(e){ this.setState({ loading: false, pan: null }); } } }')).toEqual([]);
		expect(scanDivinationCastSource('class A extends B { async load(f){ try{ const pan = await q(f); this.setState({ pan, panSig: k, loading: false }); }catch(e){ const keep = castFailureKeeps(this.state.panSig, k); this.setState(keep ? { loading: false } : { loading: false, pan: null }); } } }')).toEqual([]);
		// 调了判据却不按它清 → 仍报
		expect(scanDivinationCastSource('class A extends B { async load(f){ try{ const pan = await q(f); this.setState({ pan, panSig: k, loading: false }); }catch(e){ const keep = castFailureKeeps(this.state.panSig, k); this.setState({ loading: false }); } } }').map((h)=>h.rule)).toEqual(['failure-keeps-previous-lesson']);
		// 先拼好再传给 setState 的变量同样算写
		expect(scanDivinationCastSource('class A extends B { async load(f){ const r = await q(f); const st = { liureng: r }; this.setState(st); } go(){ return this.props.value.chart; } }').map((h)=>h.rule)).toEqual(['raw-reference-chart']);
		// ⑤b 上一课结果兜底
		expect(rules('recalc(f, nongli){ return calc(f, nongli || this.state.nongli); }')).toEqual(['previous-lesson-fallback:nongli']);
		expect(rules('recalc(f, nongli){ return calc(f, this.state.nongli ?? nongli); }')).toEqual(['previous-lesson-fallback:nongli']);
		// 字面量缺省 / 按签名取 / 非异步字段 → 不报
		expect(rules('show(){ return this.state.pan || {}; }')).toEqual([]);
		expect(rules('recalc(f, nongli){ return calc(f, (castFailureKeeps(this.state.lessonSig, castSourceKey(f)) && this.state.nongli) || nongli); }')).toEqual([]);
		expect(rules('show(){ return this.state.localFields || this.props.fields; }')).toEqual([]);
		expect(rules('show(){ return this.state.nongli || (this.state.pan && this.state.pan.nongli); }')).toEqual([]);
		// ⑤c 写结果不写签名
		expect(rules('fail(f){ if(!castFailureKeeps(this.state.panSig, castSourceKey(f))){ this.setState({ pan: null, panSig: "" }); } } ok(p, k){ this.setState({ pan: p }); }')).toEqual(['write-without-cast-sig:pan']);
		expect(rules('fail(f){ if(!castFailureKeeps(this.state.panSig, castSourceKey(f))){ this.setState({ pan: null, panSig: "" }); } } ok(p, k){ this.setState(k ? { pan: p, panSig: k } : { loading: false }); }')).toEqual([]);
		// 起课结果字段要异步写过才算(load 里异步写了 pan / nongli)
		expect(scanDivinationCastSource('class A extends B { recalc(f, nongli){ return calc(f, nongli || this.state.nongli); } }')).toEqual([]);
	});
});
