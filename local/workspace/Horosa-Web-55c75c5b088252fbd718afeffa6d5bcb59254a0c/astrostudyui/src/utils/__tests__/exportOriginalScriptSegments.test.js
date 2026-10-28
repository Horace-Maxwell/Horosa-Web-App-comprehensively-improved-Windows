// 导出栅格化逐段包原文持有:分段截图的每一次 html2canvas / toCanvas 调用都在 withOriginalScript 里
// (外层整次导出另包一层,看门狗按空闲计时)—— 长导出后半段离屏画布永远按简体原文画字,同一份 PDF 不简繁混杂。
import fs from 'fs';
import path from 'path';

const read = (rel)=>fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
// 某个截图调用的每一处出现都必须紧跟在 withOriginalScript(()=> 之后
function unwrappedCalls(src, callee){
	const out = [];
	const re = new RegExp(`\\b${callee}\\(`, 'g');
	let m;
	while((m = re.exec(src))){
		const before = src.slice(Math.max(0, m.index - 40), m.index);
		const line = src.slice(src.lastIndexOf('\n', m.index) + 1, m.index);
		if(/^\s*\/\//.test(line) || /typeof\s*$/.test(before)){ continue; }   // 注释 / 取函数本身不算调用
		if(!/withOriginalScript\(\(\)=>\s*$/.test(before)){ out.push(src.slice(src.lastIndexOf('\n', m.index) + 1, src.indexOf('\n', m.index)).trim().slice(0, 120)); }
	}
	return out;
}

describe('导出逐段包原文持有', ()=>{
	it('🔴 AI 导出栅格 PDF(纯文本 / 样式化):每段 toCanvas 截图都在 withOriginalScript 里', ()=>{
		const src = read('aiExport/output.js');
		expect((src.match(/\btoCanvas\(host/g) || []).length).toBeGreaterThanOrEqual(2);
		expect(unwrappedCalls(src, 'toCanvas')).toEqual([]);
	});
	it('判别力:没包的写法判得出来', ()=>{
		expect(unwrappedCalls('const a = await html2canvas(container, {});', 'html2canvas').length).toBe(1);
		expect(unwrappedCalls('const a = await withOriginalScript(()=>html2canvas(container, {}));', 'html2canvas').length).toBe(0);
	});
});
