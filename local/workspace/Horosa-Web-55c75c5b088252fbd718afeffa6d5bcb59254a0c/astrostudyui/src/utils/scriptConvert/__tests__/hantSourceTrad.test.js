// 界面简繁 · 源码字面量里的繁体写法字(棘轮):新界面文字一律照写简体(繁体档由显示层转),
// 简体档上出现「属馬」「天藝」「青龍」一类简繁混排,根子就是源码 / 显示表里写了繁体。
// 下面的登记表 = 每个源码文件(js / jsx 的字符串、模板、JSX 文字;注释不算)现有的繁体写法字,逐文件逐字。
//   · 新文件出现繁体写法字、或已登记文件多出新的繁体字 → 红:是界面显示文字就改写简体
//     (查表键 / 与繁体数据对齐的键要保持繁体时,显示处另给简体显示名,如一掌经 starLabel、五兆 wuzhaoShow);
//     确属古籍原文 / 繁体数据查表键 / 简繁规则表本身,人判后跑一次 UPDATE_HANT_SOURCE_TRAD=1 重写登记表。
//   · 文件里的繁体字少了(改成了简体)同样要重写登记表 —— 登记表只收紧、不留空位。
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const { isTradOnlyChar } = require('../hantConverter');

const SRC = path.resolve(__dirname, '../../..');
const FIXTURE = path.join(__dirname, 'hantSourceTrad.fixture.json');
const SKIP_DIRS = new Set(['__tests__', 'test', '.umi', '.umi-production', '.umi-test']);
// 简体里本来也用的字(乾卦 / 著作)不算
const NOT_TRAD = new Set(['乾', '著']);

function literalTexts(src){
	const ast = parser.parse(src, {
		sourceType: 'module', errorRecovery: true,
		plugins: ['jsx', 'classProperties', 'optionalChaining', 'objectRestSpread', 'dynamicImport', 'nullishCoalescingOperator'],
	});
	const out = [];
	(function walk(n){
		if(!n || typeof n !== 'object'){ return; }
		if(Array.isArray(n)){ n.forEach(walk); return; }
		if(n.type === 'StringLiteral' || n.type === 'JSXText' || n.type === 'DirectiveLiteral'){ out.push(n.value); }
		else if(n.type === 'TemplateElement'){ out.push(n.value && (n.value.cooked || n.value.raw)); }
		Object.keys(n).forEach((k)=>{
			if(k === 'loc' || k === 'start' || k === 'end' || k === 'comments' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments' || k === 'extra'){ return; }
			const v = n[k];
			if(v && typeof v === 'object'){ walk(v); }
		});
	})(ast.program);
	return out;
}

// 取字的源码视图与收录范围(缺省 = 源码原样、全部收录)
let sourceView = (text)=>text;
let inScope = ()=>true;

function scan(){
	const now = {};
	(function walk(dir){
		fs.readdirSync(dir).sort().forEach((f)=>{
			const p = path.join(dir, f);
			const st = fs.statSync(p);
			if(st.isDirectory()){ if(!SKIP_DIRS.has(f)){ walk(p); } return; }
			if(!/\.(js|jsx)$/.test(f)){ return; }
			const rel = path.relative(SRC, p).split(path.sep).join('/');
			if(!inScope(rel)){ return; }
			const src = sourceView(fs.readFileSync(p, 'utf8'));
			if(!/[㐀-鿿]/.test(src)){ return; }
			const chars = new Set();
			literalTexts(src).forEach((t)=>{ Array.from(`${t || ''}`).forEach((c)=>{ if(!NOT_TRAD.has(c) && isTradOnlyChar(c)){ chars.add(c); } }); });
			if(chars.size){ now[rel] = [...chars].sort().join(''); }
		});
	})(SRC);
	return now;
}

describe('源码字面量里的繁体写法字(棘轮)', ()=>{
	it('每个文件的繁体写法字 = 登记表(新增要人判;改成简体后收紧登记表)', ()=>{
		const now = scan();
		if(process.env.UPDATE_HANT_SOURCE_TRAD === '1'){ fs.writeFileSync(FIXTURE, `${JSON.stringify(now, null, '\t')}\n`); }
		const saved = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
		const diff = [];
		Object.keys(now).forEach((f)=>{
			const had = new Set(Array.from(saved[f] || ''));
			const extra = Array.from(now[f]).filter((c)=>!had.has(c));
			if(extra.length){ diff.push(`${f}:新增繁体写法字 ${extra.join('')}`); }
		});
		Object.keys(saved).forEach((f)=>{
			if(!fs.existsSync(path.join(SRC, f))){ return; }   // 本仓没有这个文件(登记表两边共用)
			const cur = new Set(Array.from(now[f] || ''));
			const gone = Array.from(saved[f]).filter((c)=>!cur.has(c));
			if(gone.length){ diff.push(`${f}:已不含 ${gone.join('')}(收紧登记表)`); }
		});
		expect(diff).toEqual([]);
		expect(Object.keys(now).length).toBeGreaterThan(20);   // 防扫描静默失效
	});

	it('判别力:字符串 / 模板 / JSX 文字里的繁体字认得出,注释与「乾 / 著」不算', ()=>{
		const t = literalTexts("// 屬馬\nconst a = '属馬'; const b = `天藝${x}`; const c = <i>青龍</i>; /* 龍 */ const d = '乾为天';").join('|');
		const chars = Array.from(t).filter((c)=>!NOT_TRAD.has(c) && isTradOnlyChar(c));
		expect(chars.join('')).toBe('馬藝龍');
	});
});
