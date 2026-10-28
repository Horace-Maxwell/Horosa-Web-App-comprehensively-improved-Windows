// 经请求层(request / requestRaw / cachedPost)发的计算请求,cache 参数的口径:
// · 去重层只认应用层的布尔开关(resultCache:false / cache:false)= 不用结果缓存;fetch 原生的 cache 字符串不算。
// · 这些请求是 POST,HTTP 缓存本来不起作用,写 cache:'no-store' 之类只会误导下一个读代码的人(主限法页四处就因此
//   被去重层当成「不用缓存」,前台请求与 ±N 步预取全部不落桶,预取白跑)→ 一律不许写。
// · 真要绕过结果缓存的调用点登记在下表并写明理由;登记预取任务(submitStepPrefetch)的文件里一个都不许绕过 ——
//   预取的唯一意义就是落桶,绕过 = 白取。
import fs from 'fs';
import path from 'path';
import { cacheBypassed } from '../requestDedupe';

const { parseModule } = require('./helpers/importSpecs');
const traverse = require('@babel/traverse').default;
const SRC = path.resolve(__dirname, '../..');

// 文件(相对 src):为什么这里不用结果缓存
const BYPASS_OK = {
};
const REQUEST_FNS = { request: 1, requestRaw: 1, cachedPost: 2 };   // 函数名 → options 是第几个实参

function walk(dir, acc){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const p = path.join(dir, e.name);
		if(e.isDirectory()){ if(e.name !== '__tests__' && e.name !== '.umi' && e.name !== '.umi-production'){ walk(p, acc); } }
		else if(/\.js$/.test(e.name)){ acc.push(p); }
	});
	return acc;
}
function scan(src){
	const out = { stringCache: [], bypass: [], prefetchFile: /submitStepPrefetch\(/.test(src) };
	let ast = null;
	try{ ast = parseModule(src); }catch(e){ return out; }
	traverse(ast, {
		CallExpression(p){
			const c = p.node.callee;
			const name = c.type === 'Identifier' ? c.name : '';
			if(!Object.prototype.hasOwnProperty.call(REQUEST_FNS, name)){ return; }
			const opts = p.node.arguments[REQUEST_FNS[name]];
			if(!opts || opts.type !== 'ObjectExpression'){ return; }
			opts.properties.forEach((pr)=>{
				if(pr.type !== 'ObjectProperty' || !pr.key){ return; }
				const k = pr.key.name || pr.key.value;
				const line = pr.loc.start.line;
				if(k === 'cache' && (pr.value.type === 'StringLiteral' || pr.value.type === 'TemplateLiteral')){ out.stringCache.push(line); }
				if((k === 'cache' || k === 'resultCache') && pr.value.type === 'BooleanLiteral' && pr.value.value === false){ out.bypass.push(line); }
			});
		},
	});
	return out;
}

describe('源码合同:请求层的 cache 参数', ()=>{
	const files = walk(SRC, []).map((f)=>({ rel: path.relative(SRC, f).split(path.sep).join('/'), src: fs.readFileSync(f, 'utf8') }))
		.filter((x)=>/\b(request|requestRaw|cachedPost)\(/.test(x.src));
	test('不写 fetch 的 cache 字符串', ()=>{
		const bad = [];
		files.forEach(({ rel, src })=>scan(src).stringCache.forEach((l)=>bad.push(`${rel}:${l}`)));
		expect(bad).toEqual([]);
	});
	test('绕过结果缓存只在登记表里;登记预取任务的文件里一处都不许', ()=>{
		const bad = [];
		files.forEach(({ rel, src })=>{
			const r = scan(src);
			r.bypass.forEach((l)=>{ if(r.prefetchFile || !BYPASS_OK[rel]){ bad.push(`${rel}:${l}`); } });
		});
		expect(bad).toEqual([]);
	});
	test('登记表里的每一项都还在用(撤掉要一并撤表)', ()=>{
		Object.keys(BYPASS_OK).forEach((rel)=>{
			const f = path.join(SRC, rel);
			expect(fs.existsSync(f)).toBe(true);
			expect(scan(fs.readFileSync(f, 'utf8')).bypass.length).toBeGreaterThan(0);
		});
	});
	test('判别力', ()=>{
		expect(scan("request(u, { body, cache: 'no-store' });").stringCache.length).toBe(1);
		expect(scan("cachedPost(u, v, { timeoutMs: 1, cache: false }, {});").bypass.length).toBe(1);
		expect(scan("request(u, { body, resultCache: false });").bypass.length).toBe(1);
		expect(scan("fetch(u, { method: 'GET', cache: 'no-store' });").stringCache.length).toBe(0);   // 直接 fetch 的 GET 探活不归这里
		expect(scan("request(u, { body });")).toMatchObject({ stringCache: [], bypass: [] });
	});
});

describe('去重层判据 cacheBypassed 只认布尔开关', ()=>{
	test('表', ()=>{
		expect(cacheBypassed({ resultCache: false })).toBe(true);
		expect(cacheBypassed({ cache: false })).toBe(true);
		['no-store', 'reload', 'no-cache', 'default', undefined, true].forEach((c)=>expect(cacheBypassed({ cache: c })).toBe(false));
		expect(cacheBypassed(undefined)).toBe(false);
		// 主限法页预取 / 前台请求现在的参数形状:不绕过
		expect(cacheBypassed({ body: '{}', silent: true, retry: { retries: 0 } })).toBe(false);
	});
});
