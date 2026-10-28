// 全仓护栏:不许拿 moment(...) 直接包表单字段里的值(fields.*.value / 取自它的变量)。
//
// 病理:表单的日期 / 时刻字段值是应用自制的 DateTime(month 从 1 起算、自带纪元与时区)。moment(实例) 走对象构造,
//       把 month 当 0 起算 → 日期整体晚一个月,12 月直接无效;公元前纪元丢失。编译、运行都不报错,只是算出来全错。
// 正确做法:要 moment 用 momentOfDateTime(先换儒略日序数、再取同一天);只算天数差 / 年龄用儒略日序数
//       (DateTime.getOnlyDateNum / calcJdn、dateStrSafe.civilJdnOfYmd),不经 moment。
// 判据(AST):moment 的调用只有一个实参,且实参是
//   ① 末段为 .value 的成员表达式(含 a && a.b && a.b.value 的逻辑链末项、x.value.clone() 之类),或
//   ② 一个变量,其声明初值是 ①。
// 同族第二条:moment(串, 含年份记号的格式)读命盘日期。moment 的格式解析把公元前 '-300-03-10' 读成公元 300 年、
//   两位年 '50-03-10' 读成 2050 年、五位年 '12000-01-01' 截成 1200 年(行星年龄 / 月相周期 / 三分主星 / Balbillus 时间线实抓:
//   公元 50 年出生的「当前年龄」= −23.4);1582 以前还按外推格里历。正确做法:utils/civilMoment 的 momentOfCivilDateTimeStr /
//   birthMomentOfChart(标签经 civilDateOfMoment)。判据:moment(x, F),F 是含 'Y' 的字符串字面量 / 含它的数组 / 初值为二者的常量。
//   存量登记(MOMENT_FORMAT_BASELINE)只给「输入来自只能选现代日期的控件」的位点,只许减不许增。
// 同族第三条:moment(串) 单实参吃字符串(字面量 / 模板串 / 字符串方法链 / String(…) / 名字以 label、str、text、ymd、iso 结尾的值)
//   = 交给引擎猜(非 ISO 写法 moment 退回 Date 解析,各引擎口径不一;公元前 / 五位年 / 儒略标签全错)。
//   正确做法:日期控件要的标签 moment 用 civilMoment.labelMomentOfCivilDateStr;真实那一天用 momentOfCivilDateTimeStr;
//   计算服务给的 ISO 时刻用 moment(parseLocalDateTimeMs(iso)) / moment.parseZone(iso)。零容忍。
// 第二、三条同样管 moment.parseZone / moment.utc / moment.tz 三种成员调用(换个入口照样是 moment 的格式解析 / 引擎猜):
//   单参 moment.parseZone 只放行「先经 xxx_ZONE_RE.test(…) 判过带偏移」的条件分支(计算服务给的带偏移 ISO)。
//   命盘出生时刻要落在出生时区上用 civilMoment.zonedBirthMomentOfChart / zonedMomentOfCivilDateTimeStr。
import fs from 'fs';
import path from 'path';
import * as parser from '@babel/parser';
import traverseDefault from '@babel/traverse';

const traverse = traverseDefault.default || traverseDefault;
// moment(…) 本身,或 moment.parseZone / moment.utc / moment.tz(…)
const MOMENT_PARSE_MEMBERS = new Set(['parseZone', 'utc', 'tz']);
function isMomentParseCallee(c, names){
	if(!c){ return false; }
	if(c.type === 'Identifier'){ return names.has(c.name); }
	return c.type === 'MemberExpression' && !c.computed && c.object && c.object.type === 'Identifier' && names.has(c.object.name)
		&& c.property && MOMENT_PARSE_MEMBERS.has(c.property.name);
}
// 单参 moment.parseZone(iso) 在「ISO_ZONE_RE.test(…) ? moment.parseZone(iso) : …」的真分支里:已判过带偏移,放行
function isZoneCheckedParseZone(p){
	const c = p.node.callee;
	if(!(c.type === 'MemberExpression' && c.property && c.property.name === 'parseZone')){ return false; }
	const par = p.parentPath && p.parentPath.node;
	if(!par || par.type !== 'ConditionalExpression' || par.consequent !== p.node){ return false; }
	const t = par.test;
	return !!(t && t.type === 'CallExpression' && t.callee.type === 'MemberExpression' && t.callee.property && t.callee.property.name === 'test'
		&& t.callee.object.type === 'Identifier' && /ZONE_RE$/.test(t.callee.object.name));
}
const SRC_ROOT = path.join(__dirname, '..', '..');
const PARSE_OPTS = {
	sourceType: 'module',
	plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport'],
};

function walk(dir, acc = []){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const fp = path.join(dir, e.name);
		if(e.isDirectory()){ if(!/node_modules|\.umi|__tests__/.test(e.name)){ walk(fp, acc); } }
		else if(/\.jsx?$/.test(e.name)){ acc.push(fp); }
	});
	return acc;
}

// 表达式是否「取自字段值」:末段 .value 的成员表达式;逻辑链取末项;.clone() / .startOf() 之类链式调用剥一层
function isFieldValueExpr(node){
	if(!node){ return false; }
	if(node.type === 'LogicalExpression'){ return isFieldValueExpr(node.right); }
	if(node.type === 'ConditionalExpression'){ return isFieldValueExpr(node.consequent) || isFieldValueExpr(node.alternate); }
	if((node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') && !node.computed && node.property && node.property.name === 'value'){ return true; }
	if((node.type === 'CallExpression' || node.type === 'OptionalCallExpression') && node.callee
		&& (node.callee.type === 'MemberExpression' || node.callee.type === 'OptionalMemberExpression')
		&& node.callee.property && ['clone', 'startOf'].includes(node.callee.property.name)){
		return isFieldValueExpr(node.callee.object);
	}
	return false;
}

export function momentOfFieldValueSites(code, rel){
	let ast;
	try{ ast = parser.parse(code, PARSE_OPTS); }
	catch(e){ return []; }
	const out = [];
	// moment 在本文件里的本地名(import moment from 'moment' / const moment = require('moment'))
	const names = new Set();
	traverse(ast, {
		ImportDeclaration(p){
			if(p.node.source.value === 'moment'){
				p.node.specifiers.forEach((sp)=>{ if(sp.type === 'ImportDefaultSpecifier' || sp.type === 'ImportNamespaceSpecifier'){ names.add(sp.local.name); } });
			}
		},
		VariableDeclarator(p){
			const i = p.node.init;
			if(i && i.type === 'CallExpression' && i.callee.name === 'require' && i.arguments[0] && i.arguments[0].value === 'moment' && p.node.id.type === 'Identifier'){ names.add(p.node.id.name); }
		},
	});
	if(!names.size){ return out; }
	traverse(ast, {
		CallExpression(p){
			const c = p.node.callee;
			if(c.type !== 'Identifier' || !names.has(c.name) || p.node.arguments.length !== 1){ return; }
			const a = p.node.arguments[0];
			let hit = isFieldValueExpr(a);
			if(!hit && a.type === 'Identifier'){
				const b = p.scope.getBinding(a.name);
				if(b && b.path && b.path.node && b.path.node.type === 'VariableDeclarator'){ hit = isFieldValueExpr(b.path.node.init); }
			}
			if(hit){ out.push(`${rel}:${p.node.loc.start.line}`); }
		},
	});
	return out;
}

// moment(x, 含年份记号的格式)
function isYearFormatNode(node, scope){
	if(!node){ return false; }
	if(node.type === 'StringLiteral'){ return /Y/.test(node.value); }
	if(node.type === 'TemplateLiteral'){ return node.quasis.some((q)=>/Y/.test(q.value.cooked || '')); }
	if(node.type === 'ArrayExpression'){ return node.elements.some((e)=>isYearFormatNode(e, scope)); }
	if(node.type === 'ConditionalExpression'){ return isYearFormatNode(node.consequent, scope) || isYearFormatNode(node.alternate, scope); }
	if(node.type === 'Identifier' && scope){
		const b = scope.getBinding(node.name);
		if(b && b.path && b.path.node && b.path.node.type === 'VariableDeclarator'){ return isYearFormatNode(b.path.node.init, null); }
	}
	return false;
}

export function momentWithYearFormatSites(code, rel){
	let ast;
	try{ ast = parser.parse(code, PARSE_OPTS); }
	catch(e){ return []; }
	const names = new Set();
	traverse(ast, {
		ImportDeclaration(p){
			if(p.node.source.value === 'moment'){
				p.node.specifiers.forEach((sp)=>{ if(sp.type === 'ImportDefaultSpecifier' || sp.type === 'ImportNamespaceSpecifier'){ names.add(sp.local.name); } });
			}
		},
		VariableDeclarator(p){
			const i = p.node.init;
			if(i && i.type === 'CallExpression' && i.callee.name === 'require' && i.arguments[0] && i.arguments[0].value === 'moment' && p.node.id.type === 'Identifier'){ names.add(p.node.id.name); }
		},
	});
	const out = [];
	if(!names.size){ return out; }
	traverse(ast, {
		CallExpression(p){
			const c = p.node.callee;
			if(!isMomentParseCallee(c, names) || p.node.arguments.length < 2){ return; }
			if(isYearFormatNode(p.node.arguments[1], p.scope)){ out.push(`${rel}:${p.node.loc.start.line}`); }
		},
	});
	return out;
}

const STR_METHODS = new Set(['replace', 'trim', 'slice', 'substring', 'substr', 'toString', 'concat', 'padStart', 'toUpperCase', 'toLowerCase', 'join']);
const STR_NAME = /(label|str|text|ymd|iso)$/i;
function isStringishNode(node){
	if(!node){ return false; }
	if(node.type === 'StringLiteral' || node.type === 'TemplateLiteral'){ return true; }
	if(node.type === 'BinaryExpression' && node.operator === '+'){ return isStringishNode(node.left) || isStringishNode(node.right); }
	if(node.type === 'CallExpression' || node.type === 'OptionalCallExpression'){
		const c = node.callee;
		if(c.type === 'Identifier' && c.name === 'String'){ return true; }
		if((c.type === 'MemberExpression' || c.type === 'OptionalMemberExpression') && !c.computed && c.property && STR_METHODS.has(c.property.name)){ return true; }
		return false;
	}
	if(node.type === 'Identifier'){ return STR_NAME.test(node.name); }
	if((node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') && !node.computed && node.property){ return STR_NAME.test(node.property.name); }
	return false;
}

export function momentOfStringSites(code, rel){
	let ast;
	try{ ast = parser.parse(code, PARSE_OPTS); }
	catch(e){ return []; }
	const names = new Set();
	traverse(ast, {
		ImportDeclaration(p){
			if(p.node.source.value === 'moment'){
				p.node.specifiers.forEach((sp)=>{ if(sp.type === 'ImportDefaultSpecifier' || sp.type === 'ImportNamespaceSpecifier'){ names.add(sp.local.name); } });
			}
		},
		VariableDeclarator(p){
			const i = p.node.init;
			if(i && i.type === 'CallExpression' && i.callee.name === 'require' && i.arguments[0] && i.arguments[0].value === 'moment' && p.node.id.type === 'Identifier'){ names.add(p.node.id.name); }
		},
	});
	const out = [];
	if(!names.size){ return out; }
	traverse(ast, {
		CallExpression(p){
			const c = p.node.callee;
			if(!isMomentParseCallee(c, names) || p.node.arguments.length !== 1){ return; }
			if(isZoneCheckedParseZone(p)){ return; }
			if(isStringishNode(p.node.arguments[0])){ out.push(`${rel}:${p.node.loc.start.line}`); }
		},
	});
	return out;
}

describe('moment(串) 不许把字符串交给引擎解析', ()=>{
	it('判据自检', ()=>{
		const hdr = "import moment from 'moment';\n";
		expect(momentOfStringSites(hdr + "moment(ev.date.replace(/\\//g, '-')); moment(label); moment(r.iso); moment('2026-01-01'); moment(`${a}`); moment(String(x));", 'x')).toHaveLength(6);
		expect(momentOfStringSites(hdr + "moment(); moment(ms); moment(fieldsObj); moment(parseLocalDateTimeMs(iso)); moment({ year: 1 }); moment(e.date);", 'x')).toHaveLength(0);
		// 成员入口同样算;判过带偏移的单参 parseZone 放行,没判过的照报
		expect(momentOfStringSites(hdr + "moment.parseZone(raw + ''); moment.utc(label); moment.tz(`${a}`); moment.parseZone(iso);", 'x')).toHaveLength(4);
		expect(momentOfStringSites(hdr + "const m = ISO_ZONE_RE.test(`${iso}`) ? moment.parseZone(iso) : null; moment.utc(fieldsObj); moment.utc();", 'x')).toHaveLength(0);
	});
	it('全仓零命中', ()=>{
		const hits = [];
		walk(SRC_ROOT).forEach((fp)=>{
			const text = fs.readFileSync(fp, 'utf8');
			if(text.indexOf('moment') < 0){ return; }
			hits.push(...momentOfStringSites(text, path.relative(SRC_ROOT, fp).split(path.sep).join('/')));
		});
		expect(hits).toEqual([]);
	});
});

// 文件 → 允许的命中数(只许减)。
const MOMENT_FORMAT_BASELINE = {
	'components/astro/IndiaChartMain.js': 2,	// 行运日期选择器(日期控件只出四位年)
	'components/aianalysis/TechniqueSettingsFields.js': 1,	// 设置项的日期控件草稿值(日期控件只出四位年)
};

describe('moment(串, 含年份记号的格式) 不许读命盘日期', ()=>{
	const files = walk(SRC_ROOT);
	it('判据自检', ()=>{
		const hdr = "import moment from 'moment';\n";
		expect(momentWithYearFormatSites(hdr + "moment(birth, ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD']); moment(s, 'YYYY/MM/DD'); const F = 'YYYY-MM-DD'; moment(x, F);", 'x')).toHaveLength(3);
		expect(momentWithYearFormatSites(hdr + "moment(t, 'HH:mm:ss'); moment(); moment(ms); m.format('YYYY');", 'x')).toHaveLength(0);
		// moment.parseZone / utc / tz 带年份格式同样算
		expect(momentWithYearFormatSites(hdr + "moment.parseZone(raw, ['YYYY-MM-DD HH:mm:ss Z'], true); moment.utc(s, 'YYYY-MM-DD'); moment.tz(s, 'YYYY', 'Asia/Shanghai');", 'x')).toHaveLength(3);
		expect(momentWithYearFormatSites(hdr + "moment.utc(t, 'HH:mm'); x.parseZone(s, 'YYYY');", 'x')).toHaveLength(0);
	});
	it('全仓无新增(存量只许减不许增)', ()=>{
		const over = [];
		files.forEach((fp)=>{
			const rel = path.relative(SRC_ROOT, fp).split(path.sep).join('/');
			const text = fs.readFileSync(fp, 'utf8');
			if(text.indexOf('moment') < 0){ return; }
			const hits = momentWithYearFormatSites(text, rel);
			const allow = MOMENT_FORMAT_BASELINE[rel] || 0;
			if(hits.length > allow){ over.push(`${rel}(允许 ${allow},实有 ${hits.length}):${hits.join(' ')}`); }
		});
		expect(over).toEqual([]);
	});
});

describe('moment(...) 不许直接包表单字段值(DateTime 月份 1 起算)', ()=>{
	const files = walk(SRC_ROOT);

	it('扫描面可信', ()=>{
		expect(files.length).toBeGreaterThan(500);
	});

	it('判据自检:病灶写法必中、正确写法不中', ()=>{
		const hdr = "import moment from 'moment';\n";
		expect(momentOfFieldValueSites(hdr + 'const nd = this.props.fields && this.props.fields.date && this.props.fields.date.value; const b = moment(nd).startOf("day");', 'x')).toHaveLength(1);
		expect(momentOfFieldValueSites(hdr + 'moment(fields.date.value);', 'x')).toHaveLength(1);
		expect(momentOfFieldValueSites(hdr + 'moment(f.time.value.clone());', 'x')).toHaveLength(1);
		expect(momentOfFieldValueSites("const m = require('moment');\nconst d = p.date.value; m(d);", 'x')).toHaveLength(1);
		expect(momentOfFieldValueSites(hdr + 'moment(fields.date.value.format("YYYY-MM-DD"), "YYYY-MM-DD"); moment(); moment(ms); moment(v.text);', 'x')).toHaveLength(0);
		expect(momentOfFieldValueSites('function moment(x){ return x; }\nmoment(a.value);', 'x')).toHaveLength(0);
	});

	it('全仓零命中', ()=>{
		const hits = [];
		files.forEach((fp)=>{ hits.push(...momentOfFieldValueSites(fs.readFileSync(fp, 'utf8'), path.relative(SRC_ROOT, fp))); });
		expect(hits).toEqual([]);
	});
});
