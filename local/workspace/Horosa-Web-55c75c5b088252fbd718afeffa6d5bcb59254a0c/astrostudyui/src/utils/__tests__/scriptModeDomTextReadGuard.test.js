// 界面简繁 · 护栏:代码里「从页面读字」的地方必须登记。
// 界面切到繁体后页面上的字是繁体;拿页面上的字去和简体常量比(认页签 / 认段名 / 找按钮)就会静默认不出。
// 读字做判断的,一律经 utils/scriptMode.js 的 readOriginalText(读到的是简体原文);只量长度 / 只看符号的可以直读。
// 新增一处读字 → 本测试红:按上面判断改写或在此登记理由。
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../..');
// 读字的各种形态(写入 / 复合赋值不算):文字属性、文字节点值、HTML 串、d3 / jQuery 无参 .text()(fetch 响应的 await x.text() 不算)、
// 显示属性 getAttribute 与属性式读法(el.title / .placeholder / .alt / .ariaLabel)、文字节点 .data、原生选项 .text、
// 选区 / Range 的 toString()。后面的「形态样例」用例锁住每一种都抓得到,免得以后有人把正则改窄。
const READ_RES = [
	/\.(textContent|innerText|wholeText)\b(?!\s*=[^=])/g,
	/\.nodeValue\b(?!\s*=[^=])/g,
	/\.(innerHTML|outerHTML)\b(?!\s*(=[^=]|\+=))/g,
	/(?<!await\s+[\w$.]*)\.text\(\s*\)/g,
	/\.getAttribute\(\s*['"](title|placeholder|aria-label|alt)['"]\s*\)/g,
	// 显示属性的属性式读法(el.title / input.placeholder / img.alt / el.ariaLabel):只认看得出是元素的接收者
	//(e.target / el / node / xxxEl / xxxNode / ref.current …),data 对象上的同名字段不算
	/(?:\b(?:e|ev|evt|event)\.(?:target|currentTarget)|\b(?:el|elem|element|node|dom|target|anchor|btn|button|input|img|link|\w+(?:El|Elem|Element|Node|Dom|Btn|Button|Input|Img|Anchor))|\.current|document\.activeElement)\.(?:title|placeholder|alt|ariaLabel)\b(?!\s*=[^=])/g,
	// 文字节点的 .data(接收者名带 node / Node)
	/\b(?:node|textNode|txtNode|\w+(?:TextNode|Node))\.data\b(?!\s*=[^=])/g,
	// 原生 <select> 的选项文字
	/(?:\boptions|\bselectedOptions)\[[^\]]+\]\.text\b(?!\s*=[^=])/g,
	// 用户选区 / Range 的文字
	/(?:getSelection\(\s*\)|\b(?:selection|range|\w+Range|\w+Selection))\.toString\(\s*\)/g,
];
const countReads = (code)=>READ_RES.reduce((n, re)=>n + (code.match(re) || []).length, 0);

// 文件(相对 src)→ 允许的读字处数与理由
const ALLOWED = {
	'utils/aiExport/settingsModel.js': [2, 'textOf 经 readOriginalText 读简体原文(AI 导出按页签名认技法 / 子页)'],
	'components/calendar/NongLi.js': [3, '只量字数挑最长的卡片定字号,简繁等长'],
	'components/aianalysis/AIAnalysisMain.js': [1, '复制代码块:代码块(pre)不转换,读到的就是原文'],
	'components/common/ChartCaptureMount.js': [1, '只量字数判「盘画出来没有」'],
	'components/ziwei/ZWCenterHouse.js': [1, 'd3 sel.text() 同步段里先写后读拿到的是简体原文(观察者在微任务里才转),只量宽度'],
	'utils/aiExport/output.js': [1, '读的是不挂进文档的临时 wrap(观察者看不到,永远是原文),写进打印 iframe'],
	'utils/chartTextFloor.js': [2, '只判「这段字是不是空的」(盘面最小字号量的是字号,不读字面),简繁等价'],
};


function walk(dir, out){
	fs.readdirSync(dir).forEach((f)=>{
		const p = path.join(dir, f);
		const st = fs.statSync(p);
		if(st.isDirectory()){
			if(f === '__tests__' || f === 'test' || f === '.umi' || f === '.umi-production' || f === '.umi-test'){ return; }
			walk(p, out);
		}else if(/\.(js|jsx)$/.test(f)){
			out.push(p);
		}
	});
	return out;
}

describe('从页面读字的地方都已登记(界面简繁)', () => {
	const found = {};
	walk(SRC, []).forEach((file)=>{
		const rel = path.relative(SRC, file).split(path.sep).join('/');
		if(rel === 'utils/scriptMode.js'){ return; }
		const code = fs.readFileSync(file, 'utf8')
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.split('\n').map((ln)=>ln.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n');
		const n = countReads(code);
		if(n){ found[rel] = n; }
	});

	it('没有未登记的读字处', () => {
		const extra = Object.keys(found).filter((f)=>!ALLOWED[f] || found[f] > ALLOWED[f][0])
			.map((f)=>`${f}:${found[f]} 处(登记 ${ALLOWED[f] ? ALLOWED[f][0] : 0})`);
		expect(extra).toEqual([]);
	});

	it('登记表没有过期项(读字处删了就把登记删掉;文件本身不在的不算)', () => {
		const stale = Object.keys(ALLOWED).filter((f)=>fs.existsSync(path.join(SRC, f)) && !found[f]);
		expect(stale).toEqual([]);
	});

	it('形态样例:每一种读字写法都抓得到,写入不算', () => {
		const reads = ['a.textContent', 'a.innerText', 'n.wholeText', 'n.nodeValue', 'el.innerHTML', 'el.outerHTML', 'sel.text()', "el.getAttribute('title')",
			'el.getAttribute("placeholder")', "el.getAttribute('aria-label')", "el.getAttribute('alt')", 'x === a.textContent',
			'e.target.title', 'inputEl.placeholder', 'img.alt', 'btnRef.current.ariaLabel', 'textNode.data', 'walkerNode.data',
			'sel.options[sel.selectedIndex].text', 'window.getSelection().toString()', 'range.toString()', 'document.activeElement.title'];
		reads.forEach((r)=>expect([r, countReads(r)]).toEqual([r, 1]));
		const writes = ["a.textContent = 'x'", 'n.nodeValue = v', 'el.innerHTML = h', 'el.innerHTML += h', 'const t = await resp.text()', "el.getAttribute('class')", "sel.text('x')",
			"el.title = 'x'", 'node.data = v', 'sec.title', 'item.placeholder', 'resp.data', 'option.text', 'value.toString()'];
		writes.forEach((w)=>expect([w, countReads(w)]).toEqual([w, 0]));
	});

	it('AI 导出读页签名经 readOriginalText', () => {
		const src = fs.readFileSync(path.join(SRC, 'utils/aiExport/settingsModel.js'), 'utf8');
		expect(src).toMatch(/return readOriginalText\(node,/);
	});
});
