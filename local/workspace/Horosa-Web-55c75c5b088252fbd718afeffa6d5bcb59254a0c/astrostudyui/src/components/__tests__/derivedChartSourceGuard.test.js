// 静态守卫:异步取到的派生盘必须带来源键,读的时候与当前盘比(asyncLatestResultGuard 的姊妹件)。
//
// asyncLatestResultGuard 管「先发后回」:回包时还是不是最新一次请求。它管不住这一种:换盘以后新派生盘在途、
// 或者新派生盘取失败,state 里那份是**上一张盘**最后一次成功的结果,代次判据全过,照样被画出来 ——
// 中栏显示上一位命主的整宫盘 / 对比盘里新本命配旧推运圈。
// 判据(src/components 全部 .js,零容忍):
//   ① 派生盘与当前盘配对的裸写法一律红:
//      · this.state.X || this.props.value(?? 同;左右互换同)—— 「有派生盘画派生盘,没有回退本命盘」;
//      · 同一个对象字面量里一个键取 this.props.value、另一个键直接取 this.state.X ——「本命 + 派生」成对交给盘面。
//      要写成 pickKeyedDerived(this.state.X, this.state.XSig, 当前来源键, 回退)(utils/derivedChartSource)。
//   ② 经 pickKeyedDerived 读的 state 字段 X(来源键字段 K):本文件里写 X 的 setState 对象(含先拼好再传给
//      setState 的变量)只要给 X 一个非 null 值,就必须同时写 K —— 只存结果不存来源键等于没比。
//   ③ 经 pickKeyedDerived 读的 X,本文件别处不许再裸读 this.state.X(绕过比对);只有「prevState.X !== this.state.X」
//      这种变更探测不算读。
//   ④ 派生表 / 派生数据同样算:类方法里起请求用到 this.props.value(当前命盘),它异步回包后(await 之后 / .then 回调里)
//      写进 state 的数据字段(result / data / rows / list / chart / natal / syzygy / extra / points,或以 Chart / ChartObj /
//      Result / Data / Rows / List / Points / Pan / Series 结尾)必须经 pickKeyedDerived 读 —— 换命主后新结果在途 /
//      取失败时不许再显示上一位命主的表。状态位(loading / error / requestKey / 选中下标…)不在此列。
//      起请求时不读 this.props.value、而由调用方传参的宿主,登记在下方「已按来源键比对的宿主」表里逐个锁。
//      卜类目录(含择日宿主)不走第④条:那里 this.props.value 是起课参照盘、不是命主盘,配对口径是起课签名,
//      由姊妹件 divinationCastSourceGuard.test.js 管(参照盘经 castChartFor 比对、上一课结果不兜底、取失败不留上一课)。
import fs from 'fs';
import path from 'path';

const parser = require('@babel/parser');
const { readSource } = require('../../utils/__tests__/helpers/sourceSet');
const { divinationDirs, DIVINATION_ALSO_DIRS } = require('../../utils/__tests__/helpers/divinationDirs');

const COMPONENTS = path.join(__dirname, '..');
const PARSE_PLUGINS = ['jsx', 'classProperties', 'optionalChaining', 'objectRestSpread', 'dynamicImport', 'nullishCoalescingOperator'];
const CURRENT_CHART_PROPS = new Set(['value', 'chartObj']);

function isThisMember(n, objName){
	return !!(n && n.type === 'MemberExpression' && !n.computed && n.object
		&& n.object.type === 'MemberExpression' && !n.object.computed
		&& n.object.object && n.object.object.type === 'ThisExpression'
		&& n.object.property && n.object.property.name === objName && n.property);
}
const stateField = (n)=>(isThisMember(n, 'state') ? n.property.name : null);
const isCurrentChart = (n)=>isThisMember(n, 'props') && CURRENT_CHART_PROPS.has(n.property.name);
const keyName = (p)=>(p && p.key ? (p.key.name || p.key.value || '') : '');
// 盘对象字段(dirChart / wsChartObj / natalChart / secDirChart…);标量(inverse / scanStep)不是派生盘
const CHART_FIELD_RE = /chart/i;
// 「拿哪张盘当起盘源」交给取数函数(request… / fetch… / load… / prefetch…)的不算显示:取数端自己按参数核对能否复用
const SOURCE_CALL_RE = /^(request|fetch|load|prefetch)/;
// 派生数据字段名(状态位、请求键、选中下标不在内)
const DATA_FIELD_RE = /^(result|data|rows|list|chart|natal|syzygy|extra|points)$|(Chart|ChartObj|Result|Data|Rows|List|Points|Pan|Series)$/;
const FN_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ClassMethod', 'ObjectMethod', 'ClassPrivateMethod']);
const isNullish = (v)=>!!(v && (v.type === 'NullLiteral' || (v.type === 'Identifier' && v.name === 'undefined')));
const isLiteralValue = (v)=>!!(v && (isNullish(v) || ['BooleanLiteral', 'StringLiteral', 'NumericLiteral'].includes(v.type)
	|| (v.type === 'ArrayExpression' && !v.elements.length) || (v.type === 'ObjectExpression' && !v.properties.length)));
const calleeName = (c)=>(!c ? '' : (c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' && !c.computed && c.property ? c.property.name || '' : '')));

function walk(node, fn, parent){
	if(!node || typeof node.type !== 'string'){ return; }
	fn(node, parent);
	Object.keys(node).forEach((k)=>{
		if(k === 'loc' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments'){ return; }
		const v = node[k];
		if(Array.isArray(v)){ v.forEach((x)=>walk(x, fn, node)); } else if(v && typeof v === 'object' && typeof v.type === 'string'){ walk(v, fn, node); }
	});
}

// 返回一段源码里的违例:[{ rule, field, line }]
// opts.natalAsync === false:不跑第④条(卜类目录,见文件头)
export function scanDerivedChartSource(text, opts){
	const natalAsync = !(opts && opts.natalAsync === false);
	let ast;
	try{
		ast = parser.parse(text, { sourceType: 'module', plugins: PARSE_PLUGINS, errorRecovery: true });
	}catch(e){
		return [{ rule: 'parse-error', field: '', line: 0 }];
	}
	const out = [];
	const keyed = new Map();          // X → K(pickKeyedDerived(this.state.X, this.state.K, …))
	const keyedArgs = new Set();      // pickKeyedDerived 实参里的 this.state.X 节点
	const setStateVars = new Set();   // this.setState(st) 里的 st
	const setStateObjs = [];          // 直接交给 setState 的对象字面量
	walk(ast.program, (n)=>{
		if(n.type !== 'CallExpression' || !n.callee){ return; }
		const c = n.callee;
		if(c.type === 'Identifier' && c.name === 'pickKeyedDerived'){
			const x = stateField(n.arguments[0]);
			const k = stateField(n.arguments[1]);
			if(x){ keyedArgs.add(n.arguments[0]); }
			if(k){ keyedArgs.add(n.arguments[1]); }
			if(x && k){ keyed.set(x, k); }
		}
		if(c.type === 'MemberExpression' && !c.computed && c.property && c.property.name === 'setState'){
			const a = n.arguments[0];
			if(a && a.type === 'Identifier'){ setStateVars.add(a.name); }
			if(a && a.type === 'ObjectExpression'){ setStateObjs.push(a); }
			if(a && (a.type === 'ArrowFunctionExpression' || a.type === 'FunctionExpression')){
				walk(a.body, (m)=>{ if(m.type === 'ObjectExpression'){ setStateObjs.push(m); } });
			}
		}
	});
	walk(ast.program, (n, parent)=>{
		// ① 裸回退:this.state.X || this.props.value
		if(n.type === 'LogicalExpression' && (n.operator === '||' || n.operator === '??')){
			const asSource = parent && parent.type === 'CallExpression' && parent.arguments.includes(n) && SOURCE_CALL_RE.test(calleeName(parent.callee));
			const pairs = [[n.left, n.right], [n.right, n.left]];
			pairs.forEach(([a, b])=>{
				const x = stateField(a);
				if(x && isCurrentChart(b) && !asSource){ out.push({ rule: 'bare-fallback', field: x, line: n.loc.start.line }); }
			});
		}
		// ① 成对交给盘面:{ natal: this.props.value, dir: this.state.X }
		if(n.type === 'ObjectExpression'){
			const props = (n.properties || []).filter((p)=>p.type === 'ObjectProperty');
			if(props.some((p)=>isCurrentChart(p.value))){
				props.forEach((p)=>{
					const x = stateField(p.value);
					if(x && CHART_FIELD_RE.test(x)){ out.push({ rule: 'bare-pair', field: x, line: p.loc.start.line }); }
				});
			}
		}
		// 给 setState 用的变量:const st = { … }; this.setState(st)
		if(n.type === 'VariableDeclarator' && n.id && n.id.type === 'Identifier' && setStateVars.has(n.id.name) && n.init && n.init.type === 'ObjectExpression'){
			setStateObjs.push(n.init);
		}
	});
	// 交给 setState 的对象里 ...(cond ? { X: … } : {}) 这种条件展开,里面的对象同样算写
	const nested = [];
	setStateObjs.forEach((o)=>{
		(o.properties || []).filter((p)=>p.type === 'SpreadElement').forEach((sp)=>{
			walk(sp.argument, (m)=>{ if(m.type === 'ObjectExpression'){ nested.push(m); } });
		});
	});
	nested.forEach((o)=>setStateObjs.push(o));
	// ② 写派生盘必同写来源键
	setStateObjs.forEach((o)=>{
		const props = (o.properties || []).filter((p)=>p.type === 'ObjectProperty' || p.type === 'ObjectMethod');
		const names = new Set(props.map(keyName));
		props.forEach((p)=>{
			const x = keyName(p);
			if(!keyed.has(x)){ return; }
			const v = p.value;
			const isNull = v && ((v.type === 'NullLiteral') || (v.type === 'Identifier' && v.name === 'undefined'));
			if(!isNull && !names.has(keyed.get(x))){ out.push({ rule: 'write-without-key', field: x, line: p.loc.start.line }); }
		});
	});
	// ③ 经比对读的字段不许再裸读(prevState.X !== this.state.X 变更探测除外)
	walk(ast.program, (n, parent)=>{
		const x = stateField(n);
		if(!x || !keyed.has(x) || keyedArgs.has(n)){ return; }
		if(parent && parent.type === 'BinaryExpression' && /^[!=]==?$/.test(parent.operator)){
			const other = parent.left === n ? parent.right : parent.left;
			if(other && other.type === 'MemberExpression' && !other.computed && other.object && other.object.type === 'Identifier'
				&& other.object.name === 'prevState' && other.property && other.property.name === x){ return; }
		}
		out.push({ rule: 'bare-read', field: x, line: n.loc.start.line });
	});
	// ④ 用当前命盘起请求的类方法:异步回包后写进 state 的数据字段必须按来源键读
	const thenCbs = new Set();
	walk(ast.program, (n)=>{
		if(n.type === 'CallExpression' && n.callee && n.callee.type === 'MemberExpression' && n.callee.property && n.callee.property.name === 'then'){
			(n.arguments || []).forEach((a)=>{ if(a && FN_TYPES.has(a.type)){ thenCbs.add(a); } });
		}
	});
	const methods = [];
	walk(ast.program, (n)=>{
		if((n.type === 'ClassMethod' || n.type === 'ClassPrivateMethod') || (n.type === 'ClassProperty' && n.value && FN_TYPES.has(n.value.type))){ methods.push(n); }
	});
	// 只认 this.props.value(命类宿主的当前命盘;卜类页的 props.chartObj 是起课参照,不在本条)
	const usesNatal = (k)=>isThisMember(k, 'props') && k.property.name === 'value';
	const usesCurrentChart = (m)=>{ let hit = false; walk(m, (k)=>{ if(!hit && usesNatal(k)){ hit = true; } }); return hit; };
	methods.filter((m)=>natalAsync && usesCurrentChart(m)).forEach((m)=>{
		const visit = (node, inAsync)=>{
			if(!node || typeof node.type !== 'string'){ return; }
			let ctx = inAsync;
			if(FN_TYPES.has(node.type)){ ctx = !!node.async || thenCbs.has(node); }
			if(ctx && node.type === 'CallExpression' && node.callee && node.callee.type === 'MemberExpression' && !node.callee.computed
				&& node.callee.property && node.callee.property.name === 'setState'){
				const objs = [];
				const a = node.arguments[0];
				if(a && a.type === 'ObjectExpression'){
					objs.push(a);
					(a.properties || []).filter((p)=>p.type === 'SpreadElement').forEach((sp)=>walk(sp.argument, (q)=>{ if(q.type === 'ObjectExpression'){ objs.push(q); } }));
				}
				objs.forEach((o)=>(o.properties || []).filter((p)=>p.type === 'ObjectProperty').forEach((p)=>{
					const x = keyName(p);
					if(DATA_FIELD_RE.test(x) && !isLiteralValue(p.value) && !keyed.has(x)){ out.push({ rule: 'unkeyed-async-data', field: x, line: p.loc.start.line }); }
				}));
			}
			Object.keys(node).forEach((k)=>{
				if(k === 'loc' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments'){ return; }
				const v = node[k];
				if(Array.isArray(v)){ v.forEach((x)=>visit(x, ctx)); } else if(v && typeof v === 'object' && typeof v.type === 'string'){ visit(v, ctx); }
			});
		};
		visit(m, false);
	});
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

describe('静态守卫:派生盘带来源键、按当前盘比对后才画', ()=>{
	test('src/components 全部:派生盘不裸配当前盘、写结果必写来源键、不绕过比对裸读', ()=>{
		const bad = [];
		const files = listJsFiles(COMPONENTS);
		const buDirs = new Set([...divinationDirs().dirs, ...DIVINATION_ALSO_DIRS]);
		files.forEach((f)=>{
			const rel = path.relative(COMPONENTS, f).split(path.sep).join('/');
			const natalAsync = !buDirs.has(rel.split('/')[0]);
			scanDerivedChartSource(fs.readFileSync(f, 'utf8'), { natalAsync }).forEach((h)=>bad.push(`${rel}:${h.line} ${h.rule} ${h.field}`));
		});
		expect(files.length).toBeGreaterThan(500);
		expect(bad).toEqual([]);
	});

	test('已按来源键比对的宿主仍在扫描面里(改名 / 挪走 / 改回裸读会让守卫空转)', ()=>{
		// [文件, 字段]:该字段必须经 pickKeyedDerived(this.state.字段, this.state.字段Sig, …) 读(门面按全集读)
		const HOSTS = [
			['astro/AstroZR.js', 'wsChartObj'], ['astro/AstroZR.js', 'list'],
			['astro/AstroSolarReturn.js', 'dirChart'], ['astro/AstroSolarArc.js', 'dirChart'], ['astro/AstroLunarReturn.js', 'dirChart'],
			['astro/AstroLunarReturn.js', 'secDirChart'], ['astro/AstroProfection.js', 'dirChart'], ['astro/AstroGivenYear.js', 'dirChart'],
			['astro/AstroPlanetaryArc.js', 'dirChart'], ['astro/AstroPersianDirected.js', 'dirChart'], ['astro/AstroProgChart.js', 'dirChart'],
			['astro/AstroPrimaryDirectionChart.js', 'dirChart'], ['astro/AstroPrimaryDirection.js', 'pdPolesData'], ['astro/AstroPrimaryDirection.js', 'lensPoints'],
			['astro/AstroReturnTimeline.js', 'result'], ['astro/AstroDistributions.js', 'result'], ['astro/AstroEphemeris.js', 'result'],
			['astro/AstroAgePoint.js', 'result'], ['astro/AstroAnalysisLab.js', 'result'], ['astro/AstroJaynesProgressions.js', 'result'],
			['astro/AstroProgressions.js', 'result'], ['astro/AstroVedicProgressions.js', 'result'], ['astro/AstroExtraReturns.js', 'data'],
			['astro/AstroPrenatalSyzygy.js', 'syzygy'], ['astro/AstroPrenatalSyzygy.js', 'chart'], ['astro/AstroEgypt.js', 'extra'],
			['astro/IndiaChartMain.js', 'lastChartObj'], ['astro3d/AstroPDSphere.js', 'rows'],
			['auxchart/AstroHarmonicLab.js', 'result'], ['auxchart/AstroRelocationLab.js', 'result'], ['auxchart/AstroDraconicLab.js', 'result'],
			['guolao/GuoLaoChartMain.js', 'moiraTransitChartObj'], ['guolao/GuoLaoChartMain.js', 'qizhengKinPan'],
		];
		const bad = HOSTS.filter(([rel, f])=>{
			const src = readSource(path.join(COMPONENTS, rel));
			return !new RegExp(`pickKeyedDerived\\(this\\.state\\.${f}, this\\.state\\.${f}Sig\\b`).test(src);
		}).map(([rel, f])=>`${rel}#${f}`);
		expect(bad).toEqual([]);
		// 印占回退盘的单源判定同样按来源键;七政换命主整组复位成首次加载
		expect(readSource(path.join(COMPONENTS, 'astro/indiaMain/jyotishData.js'))).toMatch(/pickKeyedDerived\(state\.lastChartObj, state\.lastChartObjSig, state\.activeNatalSig\)/);
		expect(readSource(path.join(COMPONENTS, 'guolao/GuoLaoChartMain.js'))).toMatch(/if\(this\.state\.chartObj && !isChartObjSameNatal\(this\.state\.chartObj, params\)\)\{\s*this\.setState\(\{ \.\.\.GUOLAO_COMPOSITE_EMPTY/);
	});

	test('判据自证:三条规则各自认得出,合规写法不报', ()=>{
		const cls = (body)=>`class A extends B { ${body} }`;
		// ① 裸回退 / 成对
		expect(scanDerivedChartSource(cls('render(){ return <C value={this.state.wsChartObj || this.props.value} />; }')).map((h)=>h.rule)).toEqual(['bare-fallback']);
		expect(scanDerivedChartSource(cls('render(){ return <C value={this.props.value ?? this.state.x} />; }')).map((h)=>h.rule)).toEqual(['bare-fallback']);
		expect(scanDerivedChartSource(cls('render(){ const o = { natualChart: this.props.value, dirChart: this.state.dirChart }; }')).map((h)=>h.rule)).toEqual(['bare-pair']);
		// 本地编辑副本这类不是盘(不与 props.value 配对)不报;标量键与本命同对象不报;交给取数函数当起盘源不报
		expect(scanDerivedChartSource(cls('f(){ return this.state.localFields || this.props.fields; }'))).toEqual([]);
		expect(scanDerivedChartSource(cls('render(){ const o = { natualChart: this.props.value, inverse: this.state.inverse }; }'))).toEqual([]);
		expect(scanDerivedChartSource(cls('f(){ this.requestBundle(this.state.chartObj || this.props.value); }'))).toEqual([]);
		expect(scanDerivedChartSource(cls('f(){ draw(this.state.chartObj || this.props.value); }')).map((h)=>h.rule)).toEqual(['bare-fallback']);
		// ② 写结果不写来源键(直接对象 / 先拼变量)
		const keyedRead = 'shown(){ return pickKeyedDerived(this.state.dirChart, this.state.dirChartSig, k(this.props.value)); }';
		expect(scanDerivedChartSource(cls(`${keyedRead} async m(){ const r = await q(); this.setState({ dirChart: r }); }`)).map((h)=>h.rule)).toEqual(['write-without-key']);
		expect(scanDerivedChartSource(cls(`${keyedRead} async m(){ const r = await q(); const st = { dirChart: r, updating: false }; this.setState(st); }`)).map((h)=>h.rule)).toEqual(['write-without-key']);
		// 写 null(复位)不要求来源键;同写来源键合规
		expect(scanDerivedChartSource(cls(`${keyedRead} m(){ this.setState({ dirChart: null }); }`))).toEqual([]);
		expect(scanDerivedChartSource(cls(`${keyedRead} async m(){ const r = await q(); const dirChartSig = k(p); this.setState({ dirChart: r, dirChartSig }); }`))).toEqual([]);
		// ③ 绕过比对裸读
		expect(scanDerivedChartSource(cls(`${keyedRead} render(){ return this.state.dirChart ? 1 : 0; }`)).map((h)=>h.rule)).toEqual(['bare-read']);
		// 合规全写法;prevState 变更探测不算裸读
		expect(scanDerivedChartSource(cls(`${keyedRead} render(){ const o = { natualChart: this.props.value, dirChart: this.shown() }; }`))).toEqual([]);
		expect(scanDerivedChartSource(cls(`${keyedRead} componentDidUpdate(p, prevState){ if(prevState.dirChart !== this.state.dirChart){ x(); } }`))).toEqual([]);
		// ④ 用当前命盘起请求的方法:回包后写进 state 的数据字段要按来源键读
		const rules = (code)=>scanDerivedChartSource(cls(code)).map((h)=>`${h.rule}:${h.field}`);
		expect(rules('async load(){ const r = await q(this.props.value); this.setState({ result: r, loading: false, requestKey: k }); }')).toEqual(['unkeyed-async-data:result']);
		expect(rules('load(){ q(chartParams(this.props.value)).then((r)=>{ this.setState({ rows: r.rows, selIdx: -1 }); }); }')).toEqual(['unkeyed-async-data:rows']);
		expect(rules('async load(){ const p = natal(this.props.value); const r = await q(p); this.setState({ ...(r ? { lastChartObj: r } : {}), dirChart: r }); }')).toEqual(['unkeyed-async-data:dirChart', 'unkeyed-async-data:lastChartObj']);
		// 同步写 / 写空值 / 状态位 / 不用当前命盘起请求 → 不报;按来源键读 → 不报
		expect(rules('load(){ const p = this.props.value; this.setState({ result: compute(p) }); }')).toEqual([]);
		expect(rules('async load(){ const r = await q(this.props.value); this.setState({ result: null, loading: false, error: r.msg }); }')).toEqual([]);
		expect(rules('async load(){ const r = await q(this.props.fields); this.setState({ result: r }); }')).toEqual([]);
		expect(rules('shownResult(){ return pickKeyedDerived(this.state.result, this.state.resultSig, k(this.props.value)); } async load(){ const resultSig = k(this.props.value); const r = await q(this.props.value); this.setState({ result: r, resultSig }); }')).toEqual([]);
		// 卜类目录不跑第④条(参照盘按起课签名配对,另一份守卫管);其余三条照跑
		expect(scanDerivedChartSource(cls('async load(){ const r = await q(this.props.value); this.setState({ result: r }); }'), { natalAsync: false })).toEqual([]);
		expect(scanDerivedChartSource(cls('render(){ return <C value={this.state.wsChartObj || this.props.value} />; }'), { natalAsync: false }).map((h)=>h.rule)).toEqual(['bare-fallback']);
	});
});
