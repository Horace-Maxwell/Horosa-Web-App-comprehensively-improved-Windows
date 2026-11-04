// 印度择日内嵌的印占页「盘式」(北印 / 南印 / 东印):切换只写全局 app.indiaChartStyle,盘面读 props.indiaChartStyle。
// 曾:入口不给择日页、择日页不给印度择日宿主、宿主不给内嵌印占页 → 恒按缺省南印画,点北印 / 东印纹丝不动(死开关)。
// 三层必须逐层传下去。
const fs = require('fs');
const path = require('path');

const read = (rel)=>fs.readFileSync(path.join(__dirname, rel), 'utf8');
function tagBlock(src, tag){
	const m = new RegExp(`<${tag}\\s`).exec(src);   // JSX 开标签(注释里的「<Tag>」不算)
	expect(m).not.toBeNull();
	const i = m.index;
	return src.slice(i, src.indexOf('/>', i) + 2);
}

describe('印度择日盘式逐层透传', ()=>{
	test('入口 → 择日页', ()=>{
		expect(tagBlock(read('../../../pages/index.js'), 'ZeriMain')).toMatch(/indiaChartStyle=\{indiaChartStyle\}/);
	});
	test('择日页 → 印度择日宿主', ()=>{
		expect(tagBlock(read('../ZeriMain.js'), 'IndiaZeriMain')).toMatch(/indiaChartStyle=\{this\.props\.indiaChartStyle\}/);
	});
	test('宿主 → 内嵌印占页', ()=>{
		expect(tagBlock(read('../IndiaZeriMain.js'), 'IndiaChartMain')).toMatch(/indiaChartStyle=\{this\.props\.indiaChartStyle\}/);
	});
});
