// 界面简繁 · 护栏:用户输入的检索词与数据比对,一律经单源归一(utils/scriptMode.js)。
// 界面切到繁体后,用户照屏幕输入繁体;数据大多是简体,也可能本身存的是繁体(繁体命名的命盘、史书原文)——
// 直接 indexOf / includes / startsWith / RegExp 比对,两头总有一头对不上。
// 规矩:比对的两边(检索词与被搜文字)都要经单源比对 matchesUserQuery / scriptMatchIndex / scriptTextEquals
//       (或包了它们的本地函数;不随界面档位的比对用 scriptConvert/scriptMatch 的纯函数)。
//       两边各过 scriptMatchKey 再 indexOf 不算:整串折回简体在子串上不稳定(「乾」折成「干」却命中「天干地支」)。
//       没法两边归一的远端检索(后端 / iframe 里的 SQL)发 scriptQueryVariants 给出的其它写法。简体模式下单源与原比对逐字节等价。
// 「用户输入」的认定:变量名约定(q / kw / keyword / query / search* / filter* / term / needle / xxxQ / xxxKeyword / xxxQuery …),
//   或本文件里由输入框写进来的状态(onChange 里 setState({ k: e.target.value }) / setK(e.target.value))。顺着变量绑定追三层。
// 确实不是检索比对的(精确取值、选项值、常量关键词),登记在 EXEMPT,写理由;登记过期(那段代码已不存在)也判红。
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const SRC = path.resolve(__dirname, '../..');
// containsNeutral(utils/scriptNeutralMatch):计算层 / 工具层用的、与界面档位无关的入口(内部仍走 scriptMode 同一算法,anyScript)
const SINGLE_SOURCE_NAMES = ['containsNeutral', 'matchesUserQuery', 'scriptMatchIndex', 'scriptTextEquals', 'scriptFilterBy', 'scriptFilterOption', 'scriptQueryVariants',
	'matchAcrossScripts', 'indexAcrossScripts', 'equalsAcrossScripts', 'queryVariantsAcrossScripts'];
const SINGLE_SOURCE = new Set(SINGLE_SOURCE_NAMES);
const SINGLE_SOURCE_RE = new RegExp(`\\b(${SINGLE_SOURCE_NAMES.join('|')})\\b`);
// 整串折回键:只许用于存检索条件 / 按名查表,不许拿来做子串比对
const KEY_ONLY = new Set(['scriptMatchKey', 'toMatchKey']);
const KEY_ONLY_RE = /\b(scriptMatchKey|toMatchKey)\b/;
// 单源实现件本身(比对算法就在这里)
const SELF = new Set(['utils/scriptNeutralMatch.js', 'utils/scriptMode.js', 'utils/scriptConvert/scriptMatch.js', 'utils/scriptConvert/hantConverter.js']);
const NAME_RE = /^(q|qq|ql|qll|qs|qk|kw|kws|keywords?|query|queries|term|terms|needle|search|searchText|searchValue|searchQuery|searchTerm|searchKey(word)?|filter|filterText|filterValue|filterKeyword|filterQuery|[a-z]\w*Q|\w+Keyword|\w+Query|\w+SearchText|\w+SearchValue)$/;
const CALLS = new Set(['indexOf', 'lastIndexOf', 'includes', 'startsWith', 'endsWith', 'search', 'match']);
const PLUGINS = ['jsx', 'classProperties', 'classPrivateProperties', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport', 'objectRestSpread', 'exportDefaultFrom'];

// 「文件|代码片段(压掉空白后包含即可)」→ 理由。不写行号(行号随改动漂移)。
const EXEMPT = {
	'components/cntradition/BaZiLuckFlowPanel.js|FLOW_JIEQI_TERMS.indexOf(term)': '节气名常量表里查当前节气(term 是数据,不是输入)',
	'components/lingqi/LingQiMain.js|newRegExp(`(${kws.join(\'|\')})`,\'g\')': '按问类常量关键词高亮释文(kws 来自 LINGQI_CATEGORY_KEYWORDS,且只在简体显示档开启)',
	'components/amap/cityMatch.js|c._n.startsWith(q)': '城市库五万条:检索词经 build 期按显示规则烘焙的繁→简单字折叠表(foldTrad)归一,cityFoldMapConsistency 测试锁与显示同口径',
	'components/amap/cityMatch.js|c._pf.startsWith(q)': '同上(城市检索:拼音 / 英文前缀)',
	'components/amap/cityMatch.js|c._pi.startsWith(q)': '同上(城市检索:拼音首字母)',
	'components/amap/cityMatch.js|c._e.startsWith(q)': '同上(城市检索:英文名)',
	'components/amap/cityMatch.js|c._ef.startsWith(q)': '同上(城市检索:去空格英文)',
	'components/amap/cityMatch.js|c._ea.startsWith(qa)': '同上(城市检索:去重音英文)',
	'components/amap/cityMatch.js|c._eaf.startsWith(qaf)': '同上(城市检索:去重音去空格英文)',
	'components/amap/cityMatch.js|c._n.indexOf(q)': '同上(城市检索:名称包含)',
	'components/amap/cityMatch.js|c._e.indexOf(q)': '同上(城市检索:英文包含)',
	'components/amap/cityMatch.js|c._r.indexOf(q)': '同上(城市检索:地区包含)',
	'components/amap/cityMatch.js|c._ea.indexOf(qa)': '同上(城市检索:去重音英文包含)',
	'utils/aiTools/normalize/place.js|h.c._region.indexOf(head)': '外部智能体工具层的地名解析(不是界面输入;同走城市折叠表)',
	'utils/aiTools/normalize/place.js|h.c._name.indexOf(head)': '同上',
	'utils/aiTools/normalize/place.js|h.c._en.indexOf(head.toLowerCase())': '同上',
	'utils/localRecordStore.js|grp.indexOf(tag)': '标签筛选:下拉里选中的标签值与记录标签数组精确比对(值即原值,不是文字检索)',
	'components/dunjia/DunJiaCalc.js|YANG_JIEQI.indexOf(jqCur)': '节气常量表里查当前节气(term 是节气名数据,不是输入)',
	'utils/preciseCalcBridge.js|uniq.indexOf(t)': '节气名去重(term 是节气名数据,不是检索词)',
	'utils/aiChat/commands.js|it.value.indexOf(q)': '年份参数补全:候选值是四位数字,与输入的数字前缀比(无汉字可归一)',
};

function walk(dir, out){
	fs.readdirSync(dir).forEach((f)=>{
		const p = path.join(dir, f);
		if(fs.statSync(p).isDirectory()){
			if(f === '__tests__' || f === 'test' || f === '.umi' || f === '.umi-production' || f === '.umi-test'){ return; }
			walk(p, out);
		}else if(/\.(js|jsx)$/.test(f)){
			out.push(p);
		}
	});
	return out;
}

function namesIn(node, out = []){
	if(!node || typeof node !== 'object'){ return out; }
	if(Array.isArray(node)){ node.forEach((n)=>namesIn(n, out)); return out; }
	if(node.type === 'Identifier'){ out.push(node.name); }
	// 方法调用的方法名(list.filter(…) 的 filter)不算变量名,只看对象与参数
	if((node.type === 'CallExpression' || node.type === 'OptionalCallExpression') && node.callee && /MemberExpression/.test(node.callee.type) && !node.callee.computed){
		namesIn(node.callee.object, out);
		namesIn(node.arguments, out);
		return out;
	}
	if(/MemberExpression/.test(node.type) && !node.computed && node.property && node.property.type === 'Identifier'){ out.push(node.property.name); }
	Object.keys(node).forEach((k)=>{
		if(k === 'loc' || k === 'start' || k === 'end' || k === 'leadingComments' || k === 'trailingComments' || k === 'extra'){ return; }
		const c = node[k];
		if(c && typeof c === 'object'){ namesIn(c, out); }
	});
	return out;
}

// 本文件里由「检索框」写进来的状态名:placeholder 含 搜 / 检索 / 过滤 / 筛选 / 查找 / 关键词 的输入框,
// 或 Search / Input.Search / XQSearch / AutoComplete 组件;从它的 onChange / onSearch 处理函数(内联,或 this.方法 / 本地函数)里
// 认 setState({ k: <事件值> }) 与 setK(<事件值>)。普通表单框(姓名、数字)不算检索框,不在此列。
const SEARCH_PH_RE = /搜|检索|过滤|筛选|查找|关键词|search|filter/i;
const SEARCH_EL_RE = /^(Search|XQSearch|AutoComplete)$/;
function inputStateNames(ast, code){
	const out = new Set();
	const fnSrc = {};
	traverse(ast, {
		'ClassMethod|ClassProperty'(p){ if(p.node.key && p.node.key.name){ fnSrc[p.node.key.name] = code.slice(p.node.start, p.node.end); } },
		FunctionDeclaration(p){ if(p.node.id){ fnSrc[p.node.id.name] = code.slice(p.node.start, p.node.end); } },
		VariableDeclarator(p){ const i = p.node.init; if(p.node.id.type === 'Identifier' && i && /Function/.test(i.type)){ fnSrc[p.node.id.name] = code.slice(p.node.start, p.node.end); } },
	});
	const harvest = (src, depth)=>{
		if(!src || depth > 2){ return; }
		const params = ['e', 'ev', 'evt', 'event', 'v', 'val', 'value', 'text', 'input'];
		const pm = src.match(/^\s*(?:async\s*)?\(?\s*(\w+)/);
		if(pm){ params.push(pm[1]); }
		const alt = params.join('|');
		let m;
		const re1 = new RegExp(`(\\w+)\\s*:\\s*\\(?\\s*(?:${alt})\\b`, 'g');
		while((m = re1.exec(src))){ out.add(m[1]); }
		const re2 = /\bset([A-Z]\w*)\s*\(/g;
		while((m = re2.exec(src))){ if(m[1] !== 'State'){ out.add(m[1][0].toLowerCase() + m[1].slice(1)); } }
		const re3 = /\bthis\.(\w+)\b|\b(\w+)\s*\(/g;
		while((m = re3.exec(src))){ const n = m[1] || m[2]; if(fnSrc[n] && fnSrc[n] !== src){ harvest(fnSrc[n], depth + 1); } }
	};
	traverse(ast, {
		JSXOpeningElement(p){
			const n = p.node.name;
			const name = n.type === 'JSXIdentifier' ? n.name : (n.type === 'JSXMemberExpression' ? n.property.name : '');
			const attrs = {};
			p.node.attributes.forEach((a)=>{ if(a.type === 'JSXAttribute' && a.name){ attrs[a.name.name] = a; } });
			const ph = attrs.placeholder && attrs.placeholder.value ? code.slice(attrs.placeholder.value.start, attrs.placeholder.value.end) : '';
			if(!SEARCH_EL_RE.test(name) && !SEARCH_PH_RE.test(ph)){ return; }
			['onChange', 'onSearch', 'onInput'].forEach((k)=>{
				const a = attrs[k];
				if(!a || !a.value || a.value.type !== 'JSXExpressionContainer'){ return; }
				const e = a.value.expression;
				harvest(code.slice(e.start, e.end), 0);
			});
		},
	});
	return out;
}

function parse(code){
	return parser.parse(code, { sourceType: 'module', plugins: PLUGINS });
}

// 返回 [{ snippet, line, why }]
function scan(code){
	let ast;
	try{ ast = parse(code); }catch(e){ return [{ snippet: '', line: 0, why: `解析失败:${e.message}` }]; }
	const stateNames = inputStateNames(ast, code);
	// 表格列的自由文字筛选(同一列对象里有 filterDropdown 的 onFilter):第一个参数就是用户输入的检索词
	const userParams = new Set();
	traverse(ast, {
		ObjectExpression(p){
			const props = {};
			p.node.properties.forEach((x)=>{ if(x.key && (x.key.name || x.key.value)){ props[x.key.name || x.key.value] = x; } });
			const f = props.onFilter && (props.onFilter.value || props.onFilter);
			if(!props.filterDropdown || !f || !/Function/.test(f.type) || !f.params || !f.params[0] || f.params[0].type !== 'Identifier'){ return; }
			userParams.add(f.params[0]);
		},
	});
	const isUserName = (n)=>NAME_RE.test(n) || stateNames.has(n);
	// 包了单源的本地函数(const mk = (s)=>scriptMatchKey(...) / function nameKey(...){ ... })
	const wrappers = new Set();
	const keyWrappers = new Set();
	const noteWrapper = (name, src)=>{
		if(SINGLE_SOURCE_RE.test(src)){ wrappers.add(name); }
		else if(KEY_ONLY_RE.test(src)){ keyWrappers.add(name); }
	};
	traverse(ast, {
		VariableDeclarator(p){
			const init = p.node.init;
			if(p.node.id.type === 'Identifier' && init && (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression')){
				noteWrapper(p.node.id.name, code.slice(init.start, init.end));
			}
		},
		FunctionDeclaration(p){
			if(p.node.id){ noteWrapper(p.node.id.name, code.slice(p.node.start, p.node.end)); }
		},
	});
	const callsOf = (names, wraps)=>(node)=>{
		let hit = false;
		const v = (n)=>{
			if(hit || !n || typeof n !== 'object'){ return; }
			if(Array.isArray(n)){ n.forEach(v); return; }
			if(n.type === 'CallExpression' && n.callee && ((n.callee.type === 'Identifier' && (names.has(n.callee.name) || wraps.has(n.callee.name)))
				|| (n.callee.type === 'MemberExpression' && !n.callee.computed && n.callee.property && names.has(n.callee.property.name)))){ hit = true; return; }
			Object.keys(n).forEach((k)=>{ if(k !== 'loc' && k !== 'leadingComments' && k !== 'trailingComments'){ const c = n[k]; if(c && typeof c === 'object'){ v(c); } } });
		};
		v(node);
		return hit;
	};
	const callsNormalizer = callsOf(SINGLE_SOURCE, wrappers);
	const callsKeyOnly = callsOf(KEY_ONLY, keyWrappers);
	// 顺着变量绑定追三层:表达式本身或它引到的变量初值里是否有「用户输入名」/ 是否经过单源
	const trace = (p, node, test, viaParams, depth = 0, seen = new Set())=>{
		if(test(node)){ return true; }
		if(depth >= 3){ return false; }
		const ids = [];
		const v = (n)=>{
			if(!n || typeof n !== 'object'){ return; }
			if(Array.isArray(n)){ n.forEach(v); return; }
			if(n.type === 'Identifier'){ ids.push(n.name); }
			if(n.type === 'MemberExpression'){ v(n.object); if(n.computed){ v(n.property); } return; }
			if(n.type === 'ObjectProperty' && !n.computed){ v(n.value); return; }
			Object.keys(n).forEach((k)=>{ if(k !== 'loc' && k !== 'leadingComments' && k !== 'trailingComments'){ const c = n[k]; if(c && typeof c === 'object'){ v(c); } } });
		};
		v(node);
		return ids.some((name)=>{
			if(seen.has(name)){ return false; }
			seen.add(name);
			const b = p.scope.getBinding(name);
			if(!b){ return false; }
			if(!viaParams && b.kind === 'param' && userParams.has(b.identifier)){ return true; }
			const decl = b.path.node;
			const init = decl.type === 'VariableDeclarator' ? decl.init : null;
			const inits = init ? [init] : [];
			// 回调参数(list.some((w)=>…) 里的 w):追到被遍历的那个对象(list)—— 只用于判「是否已归一」
			if(viaParams && b.kind === 'param'){
				const fn = b.path.parentPath && b.path.parentPath.node;
				const call = b.path.parentPath && b.path.parentPath.parentPath && b.path.parentPath.parentPath.node;
				if(fn && /Function/.test(fn.type) && call && call.type === 'CallExpression' && call.arguments.indexOf(fn) >= 0
					&& call.callee.type === 'MemberExpression'){ inits.push(call.callee.object); }
			}
			(b.constantViolations || []).forEach((cv)=>{ if(cv.node && cv.node.type === 'AssignmentExpression'){ inits.push(cv.node.right); } });
			return inits.some((x)=>trace(p, x, test, viaParams, depth + 1, seen));
		});
	};
	const involvesUser = (p, node)=>trace(p, node, (n)=>namesIn(n).some(isUserName), false);
	const normalized = (p, node)=>trace(p, node, callsNormalizer, true);
	const keyFolded = (p, node)=>trace(p, node, callsKeyOnly, true);
	const KEY_WHY = '整串折回键(scriptMatchKey)做子串比对:子串上不稳定,改用 matchesUserQuery / scriptMatchIndex / scriptTextEquals';
	const bad = [];
	const report = (p, why)=>bad.push({ snippet: code.slice(p.node.start, p.node.end).replace(/\s+/g, ''), line: p.node.loc.start.line, why });
	traverse(ast, {
		CallExpression(p){
			const c = p.node.callee;
			if(c.type !== 'MemberExpression' || c.computed || !c.property || !CALLS.has(c.property.name)){ return; }
			const needle = p.node.arguments[0];
			if(!needle || needle.type === 'StringLiteral' || needle.type === 'NumericLiteral' || needle.type === 'RegExpLiteral'){ return; }
			if(!involvesUser(p, needle)){ return; }
			if(!normalized(p, needle)){ report(p, keyFolded(p, needle) ? KEY_WHY : '检索词没经单源归一'); return; }
			if(!normalized(p, c.object)){ report(p, keyFolded(p, c.object) ? KEY_WHY : '被搜的文字没经单源归一(只归一了检索词)'); }
		},
		NewExpression(p){
			if(!p.node.callee || p.node.callee.name !== 'RegExp'){ return; }
			const a = p.node.arguments[0];
			if(!a || a.type === 'StringLiteral'){ return; }
			if(involvesUser(p, a) && !normalized(p, a)){ report(p, '用户输入直接拼成正则(繁体模式对不上)'); }
		},
	});
	return bad;
}

function exemptKey(rel, snippet){
	return Object.keys(EXEMPT).find((k)=>{
		const at = k.indexOf('|');
		return k.slice(0, at) === rel && snippet.indexOf(k.slice(at + 1).replace(/\s+/g, '')) >= 0;
	});
}

describe('用户输入的检索比对都经单源归一(界面简繁)', () => {
	const files = walk(path.join(SRC, 'components'), []).concat(walk(path.join(SRC, 'utils'), []));
	const report = {};
	const used = new Set();
	let scanned = 0;
	files.forEach((file)=>{
		const rel = path.relative(SRC, file).split(path.sep).join('/');
		const code = fs.readFileSync(file, 'utf8');
		if(SELF.has(rel)){ return; }
		if(!/\.(indexOf|lastIndexOf|includes|startsWith|endsWith|search|match)\(|RegExp\(/.test(code)){ return; }
		scanned += 1;
		scan(code).forEach((b)=>{
			const ex = exemptKey(rel, b.snippet);
			if(ex){ used.add(ex); return; }
			(report[rel] = report[rel] || []).push(`${b.line}: ${b.why} —— ${b.snippet.slice(0, 120)}`);
		});
	});

	it('扫到了足量的文件(防扫描静默失效)', () => {
		expect(files.length).toBeGreaterThan(800);
		expect(scanned).toBeGreaterThan(300);
	});

	it('没有绕过单源的检索比对', () => {
		expect(report).toEqual({});
	});

	it('豁免登记没有过期(登记的代码片段都还在)', () => {
		expect(Object.keys(EXEMPT).filter((k)=>!used.has(k))).toEqual([]);
	});

	it('豁免都写了理由', () => {
		expect(Object.keys(EXEMPT).filter((k)=>!`${EXEMPT[k] || ''}`.trim())).toEqual([]);
	});

	describe('自证:扫描器能抓到这些写法', () => {
		const red = [
			['约定名直接比', 'export const f = (items, q)=>items.filter((x)=>x.name.indexOf(q) >= 0);'],
			['小写后比', 'export function f(list, keyword){ const k = `${keyword}`.trim().toLowerCase(); return list.filter((x)=>`${x.title}`.toLowerCase().includes(k)); }'],
			['输入框写进来的状态', 'class A { render(){ const v = this.state.lexWord; return <div><input placeholder="检索判语" onChange={(e)=>this.setState({ lexWord: e.target.value })} />{LIST.filter((t)=>t.indexOf(v) >= 0).length}</div>; } }'],
			['useState 的输入', 'function A(){ const [word, setWord] = React.useState(""); return <XQSearch onChange={(e)=>setWord(e.target.value)} value={LIST.filter((t)=>t.startsWith(word)).join()} />; }'],
			['只归一了检索词', 'import { scriptMatchKey } from "x"; export const f = (items, q)=>items.filter((x)=>x.name.indexOf(scriptMatchKey(q)) >= 0);'],
			['拼正则', 'export const f = (text, query)=>new RegExp(query, "g").test(text);'],
			['表格列自由文字筛选', 'export const cols = [{ title: "标题", filterDropdown: ()=>null, onFilter: (val, r)=>`${r.title}`.toLowerCase().includes(`${val}`.toLowerCase()) }];'],
			['xxxQ 状态', 'export const f = (lexQ, txts)=>txts.some((t)=>`${t}`.indexOf(lexQ) >= 0);'],
			['两边 scriptMatchKey 再子串比', 'import { scriptMatchKey } from "x"; export const f = (items, q)=>{ const k = scriptMatchKey(q); return items.filter((x)=>scriptMatchKey(x.name).indexOf(k) >= 0); };'],
			['包了 scriptMatchKey 的本地函数', 'import { scriptMatchKey } from "x"; const mk = (s)=>scriptMatchKey(`${s}`).toLowerCase(); export const f = (items, q)=>{ const k = mk(q); return items.filter((x)=>mk(x.name).indexOf(k) >= 0); };'],
		];
		red.forEach(([name, code])=>{
			it(`判红:${name}`, () => { expect(scan(code).length).toBeGreaterThan(0); });
		});
		const green = [
			['matchesUserQuery', 'import { matchesUserQuery } from "x"; export const f = (items, q)=>items.filter((x)=>matchesUserQuery(x.name, q));'],
			['scriptMatchIndex 逐处找', 'import { scriptMatchIndex } from "x"; export const f = (text, q)=>{ let n = 0, at = 0, i; while((i = scriptMatchIndex(text, q, { from: at })) >= 0){ n += 1; at = i + q.length; } return n; };'],
			['本地包装函数', 'import { matchesUserQuery } from "x"; const has = (s, k)=>matchesUserQuery(`${s}`.toLowerCase(), k); export const f = (items, q)=>{ const k = `${q}`.toLowerCase(); return items.filter((x)=>has(x.name, k)); };'],
			['纯函数(不随界面档位)', 'import { matchAcrossScripts } from "x"; export const f = (items, q, conv)=>items.filter((x)=>matchAcrossScripts(x.name, q, conv));'],
			['与用户输入无关', 'export const f = (items, id)=>items.filter((x)=>x.tags.indexOf(id) >= 0);'],
			['表格列选项筛选(无自由文字框)', 'export const cols = [{ title: "技法", filters: OPTS, onFilter: (val, r)=>r.tags.indexOf(val) >= 0 }];'],
			['普通表单框不算检索框', 'class A { render(){ return <input placeholder="姓名" onChange={(e)=>this.setState({ name: e.target.value })} />; } ok(){ return NAMES.indexOf(this.state.name) >= 0; } }'],
		];
		green.forEach(([name, code])=>{
			it(`放行:${name}`, () => { expect(scan(code)).toEqual([]); });
		});
	});
});
