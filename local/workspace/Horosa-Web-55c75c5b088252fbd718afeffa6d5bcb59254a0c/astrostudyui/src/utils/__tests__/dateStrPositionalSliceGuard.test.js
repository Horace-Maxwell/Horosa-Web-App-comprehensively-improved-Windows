// 全仓护栏:日期串不许按固定位置切年 / 月日(slice(0, 4)、substr(4)、slice(5, 10) …)。
//
// 病理:日期串的年份是带符号的 1–5 位数(公元前前导负号、五位年),「前 4 位是年」只对公元 1000–9999 年成立。
//   · 返照 / 流年三页「今年 + 出生串.substr(4)」:'-0003-03-10' 拼出「20263 年」,'12000-01-01' 拼出「20260 年」;
//   · 图形星历横轴刻度 slice(0, 4) / slice(0, 7) / slice(5, 10):'-0300-03-10' 显示成「-0300-0」「-03-1」。
//   · 取日期段 slice(0, 10):'-0300-03-10 12:00' 切成 '-0300-03-1';
//   · 换分隔符 replace(/-/g, '/') / 去分隔符 replace(/-/g, ''):连公元前前导负号一起换掉,公元前 300 年与公元 300 年折叠。
// 正确做法:parseDateParts / leadingYearOf / yearMonthKey / monthDayLabel / datePartOf / toSlashDate / dateKeyOfStr /
//   dateAxisTickLabel(utils/dateStrSafe)。
// 判据(AST):① .slice / .substr / .substring 的实参是固定位置组合,且被切的表达式看得出是日期串(名字含 date / birth / time …);
//   「此刻」的 new Date().toISOString() 取日期段放行(现代日期);② 任何 .replace(/-/g, '/' 或 '') 都算。
// 另三条(同一病理的拆 / 截 / 认):
//   ③ 日期串 .split('-') / .split(/-/)(接收者看得出是日期串,含 .format(…) 的返回值):公元前 '-300-03-10' 拆成 ['', '300', '03', '10'],
//      年 = 0、月 = 300(太乙积数整盘错、通书快照为空、七政「冬月」判错)→ parseDateParts;
//   ④ .slice / .substr / .substring(0, X.indexOf('-')) 截年:公元前 indexOf('-') = 0,截出空串 → leadingYearOf;
//   ⑤ 日期正则只认无符号年(/^\d{4}-/、/^(\d{1,4})-/ …,前面没有可选负号):公元前 / 五位年认不出 → 走兜底或整行丢
//      (本 App 自己导出的 CSV 再导入丢行)→ parseDateParts / 带符号 1–5 位年的正则。
// 存量:下面登记的是确属定宽格式的位点,只许减不许增(修掉一处就从表里删一处)。
import fs from 'fs';
import path from 'path';
import * as parser from '@babel/parser';
import traverseDefault from '@babel/traverse';

const traverse = traverseDefault.default || traverseDefault;
const SRC_ROOT = path.join(__dirname, '..', '..');
const PARSE_OPTS = {
	sourceType: 'module',
	plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport'],
};
const POSITIONAL = new Set(['0,4', '4', '0,7', '5,10', '5,7', '8,10', '4,6', '6,8', '5', '0,10']);
const DATE_LIKE = /(date|birth|dtstr|datetime|asof|parts\[0\]|time|moment|updatedAt|createdAt|iso)/i;
// ③ 的接收者:名字看得出是日期串,或是 .format(…) 的返回值
const SPLIT_DATE_LIKE = /(date|birth|dtstr|dstr|datetime|asof|time|ymd|iso|\.format\()/i;
// ⑤ 无符号年的日期正则:^ 后(可有 \s* 与左括号)紧跟 \d{4} / \d{1,4} / \d{3,4} / \d{4,N},再(可有右括号)跟日期分隔符
const UNSIGNED_YEAR_RE = /^\^(?:\\s\*)?\(?\\d\{(?:4|1,4|3,4|2,4|4,\d)\}\)?(?:-|\[[-/\\]+\]|\\\/)/;
const NOW_ISO = /^new Date\(\)\.toISOString\(\)$/;

// 存量登记(文件 → 允许的命中数)。格式串为纯数字 'YYYYMMDD' 的定宽解析不算病灶,单列理由。
const BASELINE = {
	'components/comp/DateTime.js': 3,	// parse(…, 'YYYYMMDD' / 'YYYYMMDDHHMMSS'):调用方显式声明定宽纯数字格式;另 1 处 split('-') 在先剥掉前导负号之后
	'utils/dateStrSafe.js': 99,	// 单源本身(认不出时的旧口径兜底)
	'components/astro/IndiaChartMain.js': 1,	// 时刻串 'HH:MM:SS' 取秒(定宽,不含年份)
};

function walk(dir, acc = []){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const fp = path.join(dir, e.name);
		if(e.isDirectory()){ if(!/node_modules|\.umi|__tests__/.test(e.name)){ walk(fp, acc); } }
		else if(/\.jsx?$/.test(e.name)){ acc.push(fp); }
	});
	return acc;
}

export function positionalDateSlices(code){
	let ast;
	try{ ast = parser.parse(code, PARSE_OPTS); }
	catch(e){ return []; }
	const out = [];
	traverse(ast, {
		RegExpLiteral(p){
			if(UNSIGNED_YEAR_RE.test(p.node.pattern)){ out.push({ line: p.node.loc.start.line, text: `/${p.node.pattern}/`.slice(0, 120) }); }
		},
		CallExpression(p){
			const c = p.node.callee;
			if(!c || (c.type !== 'MemberExpression' && c.type !== 'OptionalMemberExpression') || c.computed || !c.property){ return; }
			const a0 = p.node.arguments;
			if(c.property.name === 'replace' && a0.length === 2 && a0[0].type === 'RegExpLiteral' && a0[0].pattern === '-' && a0[0].flags === 'g'
				&& a0[1].type === 'StringLiteral' && (a0[1].value === '/' || a0[1].value === '')){
				out.push({ line: p.node.loc.start.line, text: code.slice(p.node.start, p.node.end).slice(0, 120) });
				return;
			}
			if(c.property.name === 'split' && a0.length === 1
				&& ((a0[0].type === 'StringLiteral' && a0[0].value === '-') || (a0[0].type === 'RegExpLiteral' && a0[0].pattern === '-'))){
				const recvS = code.slice(c.object.start, c.object.end);
				if(SPLIT_DATE_LIKE.test(recvS)){ out.push({ line: p.node.loc.start.line, text: code.slice(p.node.start, p.node.end).slice(0, 120) }); }
				return;
			}
			if(['slice', 'substr', 'substring'].includes(c.property.name) && a0.length === 2 && a0[0].type === 'NumericLiteral' && a0[0].value === 0
				&& a0[1].type === 'CallExpression' && a0[1].callee.type === 'MemberExpression' && !a0[1].callee.computed
				&& a0[1].callee.property.name === 'indexOf' && a0[1].arguments[0] && a0[1].arguments[0].type === 'StringLiteral' && a0[1].arguments[0].value === '-'){
				out.push({ line: p.node.loc.start.line, text: code.slice(p.node.start, p.node.end).slice(0, 120) });
				return;
			}
			if(!['slice', 'substr', 'substring'].includes(c.property.name)){ return; }
			const args = p.node.arguments;
			if(!args.length || !args.every((a)=>a.type === 'NumericLiteral')){ return; }
			if(!POSITIONAL.has(args.map((a)=>a.value).join(','))){ return; }
			const recv = code.slice(c.object.start, c.object.end);
			if(DATE_LIKE.test(recv) && !NOW_ISO.test(recv.trim())){ out.push({ line: p.node.loc.start.line, text: code.slice(p.node.start, p.node.end).slice(0, 120) }); }
		},
	});
	return out;
}

describe('日期串不许按固定位置切年 / 月日 / 日期段,不许整串换掉 「-」', ()=>{
	const files = walk(SRC_ROOT);

	it('判据自检:病灶写法必中、无关写法不中', ()=>{
		expect(positionalDateSlices("let s = datetime.format('yyyy') + parts[0].substr(4);")).toHaveLength(1);
		expect(positionalDateSlices('const y = String(nl.birth).slice(0, 4); const m = d.date.slice(5, 10);')).toHaveLength(2);
		expect(positionalDateSlices("const a = list.slice(0, 4); const k = key.slice(4); const n = new Date().toISOString().slice(0, 10);")).toHaveLength(0);
		expect(positionalDateSlices("const t = birth.slice(0, 10); const u = `${r.updatedAt}`.slice(0, 10);")).toHaveLength(2);
		expect(positionalDateSlices("const a = d.date.replace(/-/g, '/'); const k = time.split(' ')[0].replace(/-/g, ''); const x = s.replace(/-/g, ' ');")).toHaveLength(2);
		// ③ 拆:日期串 / format 返回值的 split('-')
		expect(positionalDateSlices("const d = fields.date.value.format('YYYY-MM-DD').split('-'); const e = dateStr.split('-'); const f = p.ymd.split(/-/);")).toHaveLength(3);
		expect(positionalDateSlices("const a = range.split('-'); const b = ageRangeText.split('-');")).toHaveLength(0);
		// ④ 截:slice(0, X.indexOf('-'))
		expect(positionalDateSlices("const y = tp.date.slice(0, tp.date.indexOf('-')); const z = s.slice(0, s.indexOf(':'));")).toHaveLength(1);
		// ⑤ 认:无符号年的日期正则
		expect(positionalDateSlices("const a = /^\\d{4}-\\d{2}-\\d{2}$/; const b = /^(\\d{1,4})-(\\d{2})/; const c = /^(\\d{4}[\\/\\-]\\d{1,2})/; const d = /^\\s*(\\d{3,4})-/;")).toHaveLength(4);
		expect(positionalDateSlices("const a = /^(-?\\d{1,5})-(\\d{2})/; const b = /^-?\\d{4}-/; const c = /^(\\d{1,3})-(\\d{1,3})岁$/; const d = /^\\d{4}$/; const e = /^(\\d{4})(\\d{2})(\\d{2})$/;")).toHaveLength(0);
	});

	it('全仓无新增(存量只许减不许增)', ()=>{
		const over = [];
		files.forEach((fp)=>{
			const rel = path.relative(SRC_ROOT, fp).split(path.sep).join('/');
			const hits = positionalDateSlices(fs.readFileSync(fp, 'utf8'));
			const allow = BASELINE[rel] || 0;
			if(hits.length > allow){ over.push(`${rel}(允许 ${allow},实有 ${hits.length}):` + hits.map((h)=>`${h.line} ${h.text}`).join(' | ')); }
		});
		expect(over).toEqual([]);
	});
});
