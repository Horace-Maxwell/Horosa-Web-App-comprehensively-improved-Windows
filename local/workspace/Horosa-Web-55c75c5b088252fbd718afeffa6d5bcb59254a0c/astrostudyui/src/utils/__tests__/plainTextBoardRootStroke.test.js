// 「盘面文字不描边」的图形版规则只掐从外面继承来的描边,不压 svg 根自己的 stroke 属性。
// 否则:宿盘(SZChart 把线色挂在 svg 根上,方盘宫格矩形不写 stroke、靠继承画框)挂上 horosa-plain-text-board 后,
// CSS 的 stroke:none 压过根上的展示属性 → 方盘 12 个宫格与外框没了框线,角上三角格(path 自带描边)还在,一半有框一半没框。
import fs from 'fs';
import path from 'path';
const { readSource } = require('./helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读

const SRC = path.resolve(__dirname, '..', '..');
const read = (f)=>fs.readFileSync(path.join(SRC, f), 'utf8');

describe('无描边盘面:svg 根自带线色不被压掉', ()=>{
	test('图形版规则带 :not([stroke]),文字规则照旧', ()=>{
		const less = read('layouts/app/22-tail-fixes.less');
		expect(less).toMatch(/\.horosa-workspace-shell svg\.horosa-plain-text-board:not\(\[stroke\]\),\s*\n\s*\.horosa-workspace-shell \.ant-empty-image > svg \{\s*\n\s*stroke: none;/);
		expect(less).not.toMatch(/svg\.horosa-plain-text-board,\s*\n/);
		expect(less).toMatch(/\.horosa-workspace-shell svg\.horosa-plain-text-board text \{\s*\n\s*stroke: none !important;/);
	});
	test('宿盘仍是「线色挂在 svg 根上」的写法且挂了这个类(规则的理由仍成立)', ()=>{
		expect(read('components/suzhan/SZChart.js')).toMatch(/this\.svg\.attr\('stroke', AstroConst\.AstroColor\.Stroke\)/);
		expect(read('components/suzhan/SuZhanChart.js')).toMatch(/horosa-plain-text-board/);
	});
});

describe('老盘面挂上去描边类(盘面字不描边)', ()=>{
	test('金口诀盘 / 七政方盘的 svg 根都挂了 horosa-plain-text-board;根上仍自带线色(框线不受影响)', ()=>{
		expect(read('components/jinkou/JinKouChart.js')).toMatch(/<svg id=\{this\.state\.chartid\} className="horosa-plain-text-board"/);
		expect(read('components/guolao/GuoLaoChart.js')).toMatch(/<svg id=\{this\.state\.chartid\} className="horosa-plain-text-board"/);
		expect(read('components/jinkou/JinKouPanChart.js')).toMatch(/this\.svg\.attr\('stroke', this\.color\)/);
		expect(read('components/guolao/GLChart.js')).toMatch(/this\.svg\.attr\('stroke', AstroConst\.AstroColor\.Stroke\)/);
	});
	test('星盘引擎的盘角信息字:填色、常规字重、不描边(不再「极细字重 + 同色描边」)', ()=>{
		const src = readSource(path.join(SRC, 'components/astro/AstroChartCircle.js'));
		expect(src).not.toMatch(/\.attr\('font-weight', 100\)\s*\n\s*\.attr\('stroke', AstroConst\.AstroColor\.Stroke\)/);
		expect((src.match(/\.attr\('fill', AstroConst\.AstroColor\.Stroke\)\.attr\('stroke', 'none'\)   \/\/ 盘角信息字不描边/g) || []).length).toBe(3);
	});
});
