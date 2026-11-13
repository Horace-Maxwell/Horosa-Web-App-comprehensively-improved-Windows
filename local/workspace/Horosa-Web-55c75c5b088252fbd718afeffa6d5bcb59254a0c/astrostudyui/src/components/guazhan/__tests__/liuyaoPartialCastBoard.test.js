// 六爻中栏:没起卦给居中提示,但逐爻随机(一爻一爻起)时,六爻没齐也要把已落定 / 正在翻动的爻画出来。
// 否则:空态判定只看「有没有本卦」,六爻没齐就没有本卦 → 点「随机一爻」…「随机五爻」中栏一直是空态,第六爻才出盘。
import fs from 'fs';
import path from 'path';

const src = fs.readFileSync(path.resolve(__dirname, '..', 'GuaZhanMain.js'), 'utf8');
const { jsxNodes } = require('../../../utils/__tests__/helpers/jsxProps');   // 按 AST 认元素

test('有本卦或任一爻有值就画盘', ()=>{
	expect(src).toMatch(/const hasGua = \(this\.state\.currentGua !== null && this\.state\.currentGua !== undefined\)\s*\n\s*\|\| \(this\.state\.yao \|\| \[\]\)\.some\(\(y\)=>y && y\.value >= 0\);/);
	// 卦盘就是 hasGua 为真那一支
	const charts = jsxNodes(src, 'GuaZhanChart');
	expect(charts.length).toBe(1);
	expect(src.slice(0, charts[0].start).replace(/\s+/g, '').endsWith('{hasGua?(')).toBe(true);
});
