// 全仓护栏:等宽分段取段号不许裸 Math.floor(x / 宽度)(宽度不能整除时)。
//
// 病理:27 宿 360/27、28 宿 360/28、13°20′ = 13 + 20/60 这类宽度在浮点里不精确,k × 宽度常比真段界小一点点
//   (7 × 360/27 = 93.33333333333333,÷ 360/27 = 6.999999999999999),恰在段界上的点(由段首反推的点、度数取整后的点)
//   落进前一段。27 宿有 14 个界、28 宿有 22 个界会错。
// 正确做法:utils/segmentIndex(与计算服务 india/primitives.segment_index 同算法:先加 1e-9 宽容再取整,夹到 [0, 段数 − 1])。
// 判据(AST):Math.floor(a / W),W 能静态求值(数字字面量的四则运算,或初值为它的常量)且不是整数 / 二进分数。
import fs from 'fs';
import path from 'path';
import * as parser from '@babel/parser';
import traverseDefault from '@babel/traverse';
import { segmentIndex } from '../segmentIndex';

const traverse = traverseDefault.default || traverseDefault;
const SRC_ROOT = path.join(__dirname, '..', '..');
const PARSE_OPTS = {
	sourceType: 'module',
	plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport'],
	errorRecovery: true,
};
const SINGLE_SOURCE = 'utils/segmentIndex.js';
// 文件 → 允许的命中数(只许减;每条写明为何不是段界取整)
const BASELINE = {
	'divination/babylon/calendar.js': 1,	// 月号 → 年的粗估,其后两个 while 逐年校正(不靠取整定段)
	'utils/profectionSummary.js': 2,	// 日数 ÷ 回归年 / 月长换算整岁整月(日数不是由段界反推的点)
	'components/ziwei/ZWCommHouse.js': 1,	// 版面:可容字数
	'utils/aiExportPdfVector.js': 1,	// 版面:可容行数
	'utils/civilCalendar.js': 1,	// Swiss Ephemeris revjul 逐式移植(30.6001 是该算法自带的防舍入常数,与计算服务逐位同口径,不可改)
};

function walk(dir, acc = []){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const fp = path.join(dir, e.name);
		if(e.isDirectory()){ if(!/node_modules|\.umi|__tests__/.test(e.name)){ walk(fp, acc); } }
		else if(/\.jsx?$/.test(e.name) && !/\.test\.js$/.test(e.name)){ acc.push(fp); }
	});
	return acc;
}

// 数字字面量四则运算的静态值;求不出 → NaN
function constValue(node, scope, depth){
	if(!node || depth > 4){ return NaN; }
	switch(node.type){
		case 'NumericLiteral': return node.value;
		case 'UnaryExpression': return node.operator === '-' ? -constValue(node.argument, scope, depth + 1) : NaN;
		case 'BinaryExpression':{
			const a = constValue(node.left, scope, depth + 1); const b = constValue(node.right, scope, depth + 1);
			if(node.operator === '+'){ return a + b; }
			if(node.operator === '-'){ return a - b; }
			if(node.operator === '*'){ return a * b; }
			if(node.operator === '/'){ return a / b; }
			return NaN;
		}
		case 'Identifier':{
			const b = scope && scope.getBinding(node.name);
			if(b && b.constant && b.path && b.path.node && b.path.node.type === 'VariableDeclarator'){ return constValue(b.path.node.init, b.path.scope, depth + 1); }
			return NaN;
		}
		default: return NaN;
	}
}

export function bareSegmentDivisions(code){
	let ast;
	try{ ast = parser.parse(code, PARSE_OPTS); }
	catch(e){ return []; }
	const out = [];
	traverse(ast, {
		CallExpression(p){
			const c = p.node.callee;
			if(!(c.type === 'MemberExpression' && !c.computed && c.object.type === 'Identifier' && c.object.name === 'Math' && c.property.name === 'floor')){ return; }
			let a = p.node.arguments[0];
			while(a && a.type === 'ParenthesizedExpression'){ a = a.expression; }
			if(!a || a.type !== 'BinaryExpression' || a.operator !== '/'){ return; }
			const w = constValue(a.right, p.scope, 0);
			// 二进分数宽度(2.5、3.75、365.25 …)k × 宽度与除法都是精确的,不算
			if(Number.isFinite(w) && w !== 0 && !Number.isInteger(w * 1024)){
				out.push({ line: p.node.loc.start.line, text: code.slice(p.node.start, p.node.end).slice(0, 100) });
			}
		},
	});
	return out;
}

describe('等宽分段取段号走 segmentIndex 单源', ()=>{
	it('单源行为:27 / 28 等分的 k × 宽度点归第 k 段;非段界点与裸除相同;夹到末段', ()=>{
		[27, 28, 9, 12, 81].forEach((n)=>{
			const w = 360 / n;
			for(let k = 0; k < n; k++){ expect(segmentIndex(k * w, w, n)).toBe(k); }
		});
		const w800 = 13 + 20 / 60;
		for(let k = 0; k < 27; k++){ expect(segmentIndex(k * w800, w800, 27)).toBe(k); }
		[0.5, 13.2, 100.7, 359.99].forEach((x)=>{ expect(segmentIndex(x, 360 / 27, 27)).toBe(Math.floor(x / (360 / 27))); });
		expect(segmentIndex(360, 360 / 28, 28)).toBe(27);
		expect(segmentIndex(-1e-12, 360 / 28, 28)).toBe(0);
	});
	it('判据自检', ()=>{
		expect(bareSegmentDivisions('const a = Math.floor(lon / (360 / 27)); const S = 360 / 28; const b = Math.floor(L / S); const W = 13 + 20 / 60; const c = Math.floor(x / W);')).toHaveLength(3);
		expect(bareSegmentDivisions('const a = Math.floor(lon / 30); const b = Math.floor(x / (360 / 12)); const c = Math.floor(ms / 86400000); const d = Math.floor(a / b);')).toHaveLength(0);
	});
	it('全仓无新增', ()=>{
		const over = [];
		walk(SRC_ROOT).forEach((fp)=>{
			const rel = path.relative(SRC_ROOT, fp).split(path.sep).join('/');
			if(rel === SINGLE_SOURCE){ return; }
			const text = fs.readFileSync(fp, 'utf8');
			if(text.indexOf('Math.floor') < 0){ return; }
			const hits = bareSegmentDivisions(text);
			const allow = BASELINE[rel] || 0;
			if(hits.length > allow){ over.push(`${rel}(允许 ${allow},实有 ${hits.length}):` + hits.map((h)=>`${h.line} ${h.text}`).join(' | ')); }
		});
		expect(over).toEqual([]);
	});
});
