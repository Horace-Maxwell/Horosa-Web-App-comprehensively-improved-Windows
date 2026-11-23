// 六爻中栏:没起卦给居中提示,但逐爻随机(一爻一爻起)时,六爻没齐也要把已落定 / 正在翻动的爻画出来。
// 否则:空态判定只看「有没有本卦」,六爻没齐就没有本卦 → 点「随机一爻」…「随机五爻」中栏一直是空态,第六爻才出盘。
import fs from 'fs';
import path from 'path';

const src = require('../../../utils/__tests__/helpers/sourceSet').readSource(path.resolve(__dirname, '..', 'GuaZhanMain.js'));
const { jsxNodes } = require('../../../utils/__tests__/helpers/jsxProps');   // 按 AST 认元素
// 元素逐个文件认(拼起来的全集是文本,不能当一个模块解析)
const setFiles = require('../../../utils/__tests__/helpers/sourceSet').sourceSetFiles(path.resolve(__dirname, '..', 'GuaZhanMain.js'));
const jsxIn = (name)=>setFiles.flatMap((f)=>{ const text = fs.readFileSync(f, 'utf8'); return jsxNodes(text, name).map((n)=>({ ...n, text })); });

test('有本卦或任一爻有值就画盘', ()=>{
	expect(src).toMatch(/const hasGua = \(this\.state\.currentGua !== null && this\.state\.currentGua !== undefined\)\s*\n\s*\|\| \(this\.state\.yao \|\| \[\]\)\.some\(\(y\)=>y && y\.value >= 0\);/);
	// 卦盘就是 hasGua 为真那一支
	const charts = jsxIn('GuaZhanChart');
	expect(charts.length).toBe(1);
	expect(charts[0].text.slice(0, charts[0].start).replace(/\s+/g, '').endsWith('{hasGua?(')).toBe(true);
});
