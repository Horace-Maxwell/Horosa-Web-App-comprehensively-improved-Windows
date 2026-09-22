// 面板/手册的 JSX 文本节点里不得出现 markdown 加粗标记(用户会看到裸星号;D40 两处 `**只读**` / `**你的检索词**`)。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', 'components');
const RE = />[^<>{}\n]*\*\*[^<>{}\n]+\*\*[^<>{}\n]*</;
function walk(dir, out){
	fs.readdirSync(dir).forEach((n)=>{
		const f = path.join(dir, n);
		if(fs.statSync(f).isDirectory()){ if(n !== '__tests__'){ walk(f, out); } return; }
		if(/\.js$/.test(n) && !/\.test\.js$/.test(n)){ out.push(f); }
	});
	return out;
}
const strip = (s)=>s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/mg, '');

it('🔴 判别向量:JSX 文本里的 **x** 必被抓到;属性/模板串里的星号不算', ()=>{
	expect(RE.test('<div>接入后多出 **只读** 工具</div>')).toBe(true);
	expect(RE.test('<div title="**x**">ok</div>')).toBe(false);
	expect(RE.test('<div>{`a ** b`}</div>')).toBe(false);
});

it('🔴 components/aianalysis/** 与 help/AIAnalysisHelpDoc.js:JSX 文本零 markdown 加粗', ()=>{
	const files = walk(path.join(ROOT, 'aianalysis'), []).concat([path.join(ROOT, 'help', 'AIAnalysisHelpDoc.js')]);
	expect(files.length).toBeGreaterThan(20);
	const hits = [];
	files.forEach((f)=>{
		strip(fs.readFileSync(f, 'utf8')).split('\n').forEach((l, i)=>{ if(RE.test(l)){ hits.push(`${path.relative(ROOT, f)}:${i + 1}`); } });
	});
	expect(hits).toEqual([]);
});
