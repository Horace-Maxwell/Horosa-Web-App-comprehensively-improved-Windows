// 日期时刻串的解析只经单源 utils/dateTimeParse.js(按数字拆分,与引擎无关)。
// 由来:查重「近似组」用 Date.parse('YYYY/MM-DD HH:mm:ss') 比生辰,V8 认、WebKit 回 NaN —— jest 绿、桌面里近似组永远不出;
// 非 ISO 写法(空格分隔、斜杠、负年、不补零)怎么解析由各引擎自定,旧版 JavaScriptCore 对空格分隔的本地时刻历来不稳。
// 合同:
//   ① src 下(测试除外)Date.parse( 只许出现在 dateTimeParse.js;
//   ② new Date(一个实参) 的实参必须一眼是数(数字 / 算术 / getTime() / Date.now() / Date.UTC / 单源解析函数的结果 / 另一个 new Date /
//      按约定命名的毫秒数变量 ms、xxxMs),
//      不许是字符串、模板串、字符串方法链,也不许是看不出类型的变量(可能是串)—— 串一律先经单源解析;
//   ③ 单源本身:按 WebKit 语义(非 ISO 串一律 NaN)替换 Date.parse 时结果不变;与 V8 原 Date.parse 在 ISO 与常见写法上逐值相同。
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
import { parseDateTimeMs, parseLocalDateTimeMs, parseDateTimeParts, toDateOrNull } from '../dateTimeParse';
import { findDuplicateGroups } from '../recordRelations';

const SRC = path.resolve(__dirname, '../..');
const SINGLE_SOURCE = path.join(SRC, 'utils', 'dateTimeParse.js');

function walkFiles(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((d)=>{
		const p = path.join(dir, d.name);
		if(d.isDirectory()){
			if(d.name === '__tests__' || d.name === 'node_modules' || d.name === '.umi' || d.name === '.umi-production' || d.name === 'test'){ return; }
			walkFiles(p, out);
		}else if(/\.(js|jsx)$/.test(d.name) && !/\.test\.js$/.test(d.name)){
			out.push(p);
		}
	});
	return out;
}

const parse = (text)=>parser.parse(text, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'objectRestSpread', 'dynamicImport', 'nullishCoalescingOperator'], errorRecovery: true });

// 返回毫秒数的日期单源函数:从单源件的导出机械取(名以 Ms / MsOfStr 收尾;…OfMs / …FromWallMs 是把毫秒拆成串 / 部件,不算)
const MS_SOURCE_FILES = ['dateTimeParse.js', 'civilCalendar.js', 'dateStrSafe.js', 'civilMoment.js'];
const PARSE_FNS = new Set(MS_SOURCE_FILES.flatMap((f)=>{
	const p = path.join(SRC, 'utils', f);
	if(!fs.existsSync(p)){ return []; }
	return [...fs.readFileSync(p, 'utf8').matchAll(/export function ([A-Za-z]+)\(/g)].map((m)=>m[1])
		.filter((n)=>/Ms(OfStr)?$/.test(n) && !/(Of|From)[A-Za-z]*Ms$/.test(n));
}));
const NUMERIC_CALLS = new Set(['Number', 'parseInt', 'parseFloat']);
const NUMERIC_MEMBER_CALLS = new Set(['getTime', 'valueOf', 'now', 'UTC']);

// 实参一眼是数?(true = 放行;false = 违规)
export function dateArgIsNumeric(node){
	if(!node){ return false; }
	switch(node.type){
		case 'NumericLiteral': return true;
		// 毫秒数的命名约定:ms / xxxMs(其余变量看不出是不是串,一律先经单源解析)
		// 全局 NaN / Infinity 本身就是数(造 Invalid Date 的惯用写法)
		case 'Identifier': return node.name === 'NaN' || node.name === 'Infinity' || /^ms$|Ms$/.test(node.name);
		case 'MemberExpression': return !node.computed && node.property.type === 'Identifier' && /^ms$|Ms$/.test(node.property.name);
		case 'UnaryExpression': return node.operator === '+' || node.operator === '-' || node.operator === '~';
		case 'BinaryExpression':
			if(node.operator === '+'){ return dateArgIsNumeric(node.left) && dateArgIsNumeric(node.right); }
			return ['-', '*', '/', '%', '|', '&', '>>', '<<', '>>>', '**'].indexOf(node.operator) >= 0;
		case 'CallExpression':{
			const c = node.callee;
			if(c.type === 'Identifier'){ return PARSE_FNS.has(c.name) || NUMERIC_CALLS.has(c.name); }
			if(c.type === 'MemberExpression' && !c.computed && c.property.type === 'Identifier'){
				if(NUMERIC_MEMBER_CALLS.has(c.property.name)){ return true; }
				if(c.object.type === 'Identifier' && c.object.name === 'Math'){ return true; }
			}
			return false;
		}
		case 'NewExpression': return node.callee.type === 'Identifier' && node.callee.name === 'Date';
		case 'ConditionalExpression': return dateArgIsNumeric(node.consequent) && dateArgIsNumeric(node.alternate);
		case 'LogicalExpression': return dateArgIsNumeric(node.left) && dateArgIsNumeric(node.right);
		case 'SequenceExpression': return dateArgIsNumeric(node.expressions[node.expressions.length - 1]);
		default: return false;
	}
}

export function scanDateParseViolations(text, rel){
	const out = [];
	const walk = (node)=>{
		if(!node || typeof node.type !== 'string'){ return; }
		if(node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed
			&& node.callee.object.type === 'Identifier' && node.callee.object.name === 'Date'
			&& node.callee.property.type === 'Identifier' && node.callee.property.name === 'parse'){
			out.push(`${rel}:${node.loc.start.line} Date.parse(`);
		}
		if(node.type === 'NewExpression' && node.callee.type === 'Identifier' && node.callee.name === 'Date'
			&& node.arguments.length === 1 && !dateArgIsNumeric(node.arguments[0])){
			out.push(`${rel}:${node.loc.start.line} new Date(${text.slice(node.arguments[0].start, node.arguments[0].end).slice(0, 60)})`);
		}
		Object.keys(node).forEach((k)=>{
			if(k === 'loc' || k === 'start' || k === 'end' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments'){ return; }
			const v = node[k];
			if(Array.isArray(v)){ v.forEach(walk); }else if(v && typeof v.type === 'string'){ walk(v); }
		});
	};
	walk(parse(text).program);
	return out;
}

describe('🔴 源码合同:日期串不经引擎解析', ()=>{
	it('src 下 Date.parse( 只在单源里;new Date(…) 不直接吃字符串 / 看不出类型的值', ()=>{
		const bad = [];
		walkFiles(SRC, []).forEach((f)=>{
			if(f === SINGLE_SOURCE){ return; }
			const text = fs.readFileSync(f, 'utf8');
			if(text.indexOf('Date') < 0){ return; }
			scanDateParseViolations(text, path.relative(SRC, f)).forEach((x)=>bad.push(x));
		});
		expect(bad).toEqual([]);
	});
	it('判别力:各种违规写法都抓得到,放行写法不误报', ()=>{
		const hits = (code)=>scanDateParseViolations(code, 'x.js').length;
		expect(hits('const t = Date.parse(s);')).toBe(1);
		expect(hits('const t = Date.parse(`${a}`.replace(/-/, "/"));')).toBe(1);
		expect(hits('const d = new Date("2026-01-01");')).toBe(1);
		expect(hits('const d = new Date(`${s}`.replace(/-/g, "/"));')).toBe(1);
		expect(hits('const d = new Date(rec.updateTime);')).toBe(1);
		expect(hits('const d = new Date(s + "T00:00");')).toBe(1);
		expect(hits('const d = new Date(String(x));')).toBe(1);
		expect(hits('const d = new Date(a || b);')).toBe(1);
		// 放行
		expect(hits('const d = new Date();')).toBe(0);
		expect(hits('const d = new Date(y, m - 1, 1);')).toBe(0);   // 本守卫只管「串交给引擎解析」;多参构造做民用日期算术归 civilDateArithmeticGuard
		expect(hits('const d = new Date(Date.now() + 5);')).toBe(0);
		expect(hits('const d = new Date(x.getTime());')).toBe(0);
		expect(hits('const d = new Date(parseDateTimeMs(s));')).toBe(0);
		expect(hits('const d = new Date(Number(s));')).toBe(0);
		expect(hits('const d = new Date(daynum * 86400000);')).toBe(0);
		expect(hits('const d = new Date(NaN);')).toBe(0);
		expect(hits('const d = new Date(civilInstantMsOfStr(s));')).toBe(0);
		expect(hits('const d = new Date(civilDateStrOfMs(ms));')).toBe(1);
		expect(PARSE_FNS.has('parseDateTimeMs')).toBe(true);
		expect(hits('const d = new Date(nan);')).toBe(1);
		expect(hits('const d = new Date(Date.UTC(y, m, 0));')).toBe(0);
		expect(hits('const d = new Date(startMs);')).toBe(0);
		expect(hits('const d = new Date(o.atMs);')).toBe(0);
		expect(hits('const d = new Date(at);')).toBe(1);
		expect(hits('// Date.parse(x) 在注释里\nconst a = 1;')).toBe(0);
		expect(hits('const s = "Date.parse(x)";')).toBe(0);
	});
});

describe('单源解析', ()=>{
	// WebKit 语义:只认 ISO 8601(本机实测 Date.parse("2026/10-24 12:00:00") = NaN);这里更严 —— 一切非 ISO 一律 NaN
	const ISO_ONLY = /^[+-]?\d{4,6}(?:-\d{2}(?:-\d{2})?)?(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;
	// Date.parse 与 new Date(串) 一并换成 WebKit 语义(两条路都是引擎解析)
	const RealDate = Date;
	beforeEach(()=>{
		class WebKitDate extends RealDate {
			constructor(...a){
				if(a.length === 1 && typeof a[0] === 'string' && !ISO_ONLY.test(a[0])){ super(NaN); }else{ super(...a); }
			}
			static parse(s){ return typeof s === 'string' && ISO_ONLY.test(s) ? RealDate.parse(s) : NaN; }
		}
		global.Date = WebKitDate;
	});
	afterEach(()=>{ global.Date = RealDate; });

	it('🔴 查重近似组(同名、生辰差 24 小时内)在 WebKit 语义下照样命中', ()=>{
		const list = [
			{ cid: 'a', name: '张三', birth: '1993-05-05 10:30:00' },
			{ cid: 'b', name: '张三', birth: '1993-05-05 14:45:00' },
			{ cid: 'c', name: '李四', birth: '-0500-03-04 10:00:00' },
			{ cid: 'd', name: '李四', birth: '-0500-03-04 20:00:00' },
			// 同名但相差十天:不算近似
			{ cid: 'e', name: '王五', birth: '2001-01-01 08:00:00' },
			{ cid: 'f', name: '王五', birth: '2001-01-11 08:00:00' },
		];
		const groups = findDuplicateGroups(list);
		expect(groups.map((g)=>g.map((x)=>x.cid).sort().join(',')).sort()).toEqual(['a,b', 'c,d']);
	});

	it('与引擎无关:WebKit 语义下各写法照样解析', ()=>{
		const base = parseLocalDateTimeMs('2026-10-24 12:00:00');
		expect(Number.isFinite(base)).toBe(true);
		expect(parseLocalDateTimeMs('2026/10/24 12:00:00')).toBe(base);
		expect(parseLocalDateTimeMs('2026/10-24 12:00:00')).toBe(base);
		expect(parseLocalDateTimeMs('2026-10-24T12:00:00')).toBe(base);
		expect(parseLocalDateTimeMs(' 2026-10-24  12:00 ')).toBe(base);
		const bc = parseDateTimeParts('-0500-03-04 10:00:00');
		expect(bc).toMatchObject({ year: -500, month: 3, day: 4, hour: 10 });
		expect(new Date(parseLocalDateTimeMs('-0500-03-04 10:00:00')).getFullYear()).toBe(-500);
		expect(new Date(parseLocalDateTimeMs('0050-01-02 03:04:05')).getFullYear()).toBe(50);
	});
});

describe('与 V8 原 Date.parse 逐值相同(ISO 与常见写法)', ()=>{
	const same = ['2026-10-24 12:00:00', '2026-10-24T12:00:00', '2026-10-24', '2026/10/24', '2026/10/24 12:00:00',
		'2026-10-24T12:00:00Z', '2026-10-24T12:00:00.123Z', '2026-10-24T12:00:00+05:30', '2026-10', '2026', '2026-1-5',
		'2026-01-05 5:06', '+002026-10-24T00:00:00.000Z', '-000500-03-04T00:00:00.000Z', ' 2020-03-04 05:06:07 ',
		'x', '', '1792857600000', '2026-10-24T24:00:00', new Date(2020, 1, 3).toISOString()];
	it.each(same)('%s', (s)=>{
		const a = Date.parse(s);
		const b = parseDateTimeMs(s);
		if(Number.isNaN(a)){ expect(Number.isNaN(b)).toBe(true); }else{ expect(b).toBe(a); }
	});
	it('越界不滚月;纯日期两个口径;数字与 Date 原样', ()=>{
		expect(parseDateTimeMs('2026-02-30')).toBeNaN();
		expect(parseDateTimeMs('2026-13-01')).toBeNaN();
		expect(parseDateTimeMs('2026-04-31')).toBeNaN();
		expect(parseDateTimeMs('1500-02-29 00:00')).toBe(Date.parse('1500-02-29 00:00'));
		expect(parseDateTimeMs('2026-01-01 25:00')).toBeNaN();
		expect(parseDateTimeMs('2026-10-24')).toBe(Date.UTC(2026, 9, 24));
		expect(parseLocalDateTimeMs('2026-10-24')).toBe(new Date(2026, 9, 24).getTime());
		expect(parseDateTimeMs(12345)).toBe(12345);
		expect(parseDateTimeMs(NaN)).toBeNaN();
		const d = new Date(2020, 0, 1);
		expect(parseDateTimeMs(d)).toBe(d.getTime());
		expect(parseDateTimeMs({ valueOf: ()=>77 })).toBe(77);
		expect(parseDateTimeMs(null)).toBeNaN();
		expect(toDateOrNull('坏串')).toBe(null);
	});
});
