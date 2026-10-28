// 全仓「拿 NaN 做相等比较」护栏(等价于 eslint 的 use-isnan)。
//
// 病理:NaN 与任何值(包括它自己)都不相等,`x === NaN` / `x == NaN` 恒为 false、`!==` 恒为 true,
//    `switch (x) { case NaN: }` 永远进不去 —— 本想把 NaN 归成 null 的分支从来不走,NaN 原样流到下游。
//    实例:经纬度查找弹窗把 lat / lng / gpsLat / gpsLng 的 NaN 归 null,写成了 `=== NaN`。
// 判 NaN 一律用 Number.isNaN(x)(或 Number.isFinite 判有限数)。本项目构建不设 lint 闸,用测试锁。
import fs from 'fs';
import path from 'path';
import * as parser from '@babel/parser';
import traverseDefault from '@babel/traverse';

const traverse = traverseDefault.default || traverseDefault;
const SRC_ROOT = path.join(__dirname, '..', '..');
const SHELL_PAGES = path.join(__dirname, '..', '..', '..', '..', '..', 'Horosa_Desktop_Installer', 'web');
const PARSE_OPTS = {
	sourceType: 'unambiguous',
	plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport'],
};
const EQ_OPS = new Set(['==', '===', '!=', '!==']);

function walk(dir, acc = []){
	if(!fs.existsSync(dir)){ return acc; }
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const fp = path.join(dir, e.name);
		if(e.isDirectory()){ if(!/node_modules|\.umi/.test(e.name)){ walk(fp, acc); } }
		else if(/\.jsx?$/.test(e.name)){ acc.push(fp); }
	});
	return acc;
}

function isNaNNode(n){
	if(!n){ return false; }
	if(n.type === 'Identifier' && n.name === 'NaN'){ return true; }
	return n.type === 'MemberExpression' && !n.computed && n.object.type === 'Identifier' && n.object.name === 'Number'
		&& n.property.type === 'Identifier' && n.property.name === 'NaN';
}

/** 源码文本里「与 NaN 做相等比较」的位置(行号列表)。解析不了的返回 null。 */
function nanComparisons(code){
	let ast;
	try{ ast = parser.parse(code, PARSE_OPTS); }
	catch(e){ return null; }
	const out = [];
	traverse(ast, {
		BinaryExpression(p){
			if(EQ_OPS.has(p.node.operator) && (isNaNNode(p.node.left) || isNaNNode(p.node.right))){ out.push(p.node.loc.start.line); }
		},
		SwitchCase(p){
			if(isNaNNode(p.node.test)){ out.push(p.node.loc.start.line); }
		},
	});
	return out;
}

describe('NaN 相等比较护栏(判 NaN 必须用 Number.isNaN)', ()=>{
	test('判别力:各种写法都抓得到,Number.isNaN 不误报', ()=>{
		expect(nanComparisons('const a = x === NaN;')).toEqual([1]);
		expect(nanComparisons('if (NaN != y) {}')).toEqual([1]);
		expect(nanComparisons('const b = z !== Number.NaN;')).toEqual([1]);
		expect(nanComparisons('switch (v) {\n case NaN: break;\n}')).toEqual([2]);
		expect(nanComparisons('const ok = Number.isNaN(x) || isNaN(y) || x !== x || Number.isFinite(z);')).toEqual([]);
	});

	test('前端源码与壳自带页面里没有与 NaN 做相等比较', ()=>{
		const files = walk(SRC_ROOT).concat(walk(SHELL_PAGES)).filter((f)=>!/nanEqualityGuard\.test\.js$/.test(f));
		expect(files.length).toBeGreaterThan(500);
		const hits = [];
		files.forEach((f)=>{
			const lines = nanComparisons(fs.readFileSync(f, 'utf8'));
			(lines || []).forEach((ln)=>hits.push(`${path.relative(SRC_ROOT, f)}:${ln}`));
		});
		expect(hits).toEqual([]);
	});
});
