// 极简 LESS 规则表(源码闸共用):[{ sel: [选择器…], decls: {属性: {v, imp}}, media, order }]
// :global { } 与 @media / @supports { } 只当容器;嵌套选择器按 & / 后代拼接;注释先剥。
const fs = require('fs');
const path = require('path');

const stripComments = (t)=>t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/[^\n]*/g, '$1');

function addDecl(rule, d){
	const m = d.match(/^([a-z-]+)\s*:\s*([\s\S]+)$/);
	if(!m){ return; }
	const imp = /!important\s*$/.test(m[2]);
	rule.decls[m[1]] = { v: m[2].replace(/!important\s*$/, '').trim(), imp };
}

function parseLess(text, base = 0){
	const t = stripComments(text);
	const rules = [];
	const stack = [];
	let buf = '';
	let order = base;
	for(let i = 0; i < t.length; i += 1){
		const ch = t[i];
		if(ch === '{'){
			const head = buf.trim(); buf = '';
			if(/^@media|^@supports|^:global\s*$/.test(head) || head === ''){
				stack.push({ container: true, media: /^@media/.test(head) });
			}else{
				const parent = [...stack].reverse().find((x)=>!x.container);
				let sel = head.split(',').map((x)=>x.trim()).filter(Boolean);
				if(parent){ sel = parent.sel.flatMap((p)=>sel.map((c)=>(c.indexOf('&') >= 0 ? c.replace(/&/g, p) : `${p} ${c}`))); }
				stack.push({ sel, decls: {}, media: stack.some((x)=>x.media) });
			}
		}else if(ch === '}'){
			const top = stack.pop();
			const last = buf.trim(); buf = '';
			if(top && !top.container){
				if(last){ addDecl(top, last); }
				order += 1;
				rules.push({ sel: top.sel, decls: top.decls, media: top.media, order });
			}
		}else if(ch === ';'){
			const top = stack[stack.length - 1];
			if(top && !top.container){ addDecl(top, buf.trim()); }
			buf = '';
		}else{
			buf += ch;
		}
	}
	return rules;
}

const specOf = (sel)=>{
	const s = sel.replace(/:global\(([^()]*)\)/g, '$1').replace(/::[a-z-]+/g, '');
	const ids = (s.match(/#[\w-]+/g) || []).length;
	const b = (s.match(/\.[\w-]+/g) || []).length + (s.match(/\[[^\]]*\]/g) || []).length + (s.match(/:(?!not|is|where)[a-z-]+/g) || []).length;
	const c = (s.replace(/[.#][\w-]+|\[[^\]]*\]|:[a-z-]+(\([^)]*\))?/g, ' ').match(/(^|[\s>+~])[a-z][a-z0-9]*/g) || []).length;
	return ids * 10000 + b * 100 + c;
};

// 目录下全部 .less(跳过测试 / 产物目录)
function lessFilesUnder(dir){
	const out = [];
	(function walk(d){
		fs.readdirSync(d).forEach((n)=>{
			const p = path.join(d, n);
			if(n === '__tests__' || n === 'node_modules' || n === 'dist' || n === 'dist-file' || n === '.umi' || n === '.umi-production'){ return; }
			if(fs.statSync(p).isDirectory()){ walk(p); }else if(/\.less$/.test(n)){ out.push(p); }
		});
	})(dir);
	return out;
}

// 选择器 → 去掉 :global() 外壳、合并空白后的规范写法(同一选择器跨规则合并声明用)
const normSel = (s)=>s.replace(/:global\(([^()]*)\)/g, '$1').replace(/\s*>\s*/g, ' > ').replace(/\s+/g, ' ').trim();

// 同一规范选择器在全部规则里合并后的声明(后写覆盖先写;!important 优先)
function mergedDecls(rules){
	const map = new Map();
	rules.forEach((r)=>{
		if(r.media){ return; }
		r.sel.forEach((s)=>{
			const k = normSel(s);
			const cur = map.get(k) || {};
			Object.keys(r.decls).forEach((p)=>{
				const d = r.decls[p];
				if(!cur[p] || d.imp || !cur[p].imp){ cur[p] = { ...d, file: r.file, order: r.order }; }
			});
			map.set(k, cur);
		});
	});
	return map;
}

module.exports = { stripComments, parseLess, specOf, lessFilesUnder, normSel, mergedDecls };
