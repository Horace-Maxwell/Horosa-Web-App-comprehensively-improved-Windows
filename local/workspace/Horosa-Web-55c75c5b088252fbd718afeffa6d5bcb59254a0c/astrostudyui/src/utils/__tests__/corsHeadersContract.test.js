// 跨源请求头合同:前端发给本地 Java(:9999)的每个自定义请求头(X-Horosa-*)都必须
// 登记在 Java CORS 过滤器的 cors.supportedHeaders 白名单里。桌面前端(静态服务口)→ Java 是跨源,浏览器对带自定义头的
// POST 先发 OPTIONS 预检,不在白名单 = 预检 403 = 整条请求被浏览器拦下 —— Node 探针 / jest / 差分套件都不走 CORS,看不见;
// 真浏览器台架首跑才抓到(响应加解密 v2 与预取优先级两枚新头曾整站断网)。本合同把它做成机械红。
import fs from 'fs';
import path from 'path';

const UI_SRC = path.join(__dirname, '..', '..');
const JAVA_MAIN = path.join(UI_SRC, '..', '..', 'astrostudysrv', 'astrostudyboot', 'src', 'main', 'java', 'spacex', 'astrostudyboot', 'AstroStudyProgram.java');

function walk(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((ent)=>{
		const p = path.join(dir, ent.name);
		if(ent.isDirectory()){
			if(ent.name === '__tests__' || ent.name === 'node_modules' || ent.name.startsWith('.umi')){ return; }
			walk(p, out);
		}else if(/\.(js|jsx|ts|tsx)$/.test(ent.name)){
			out.push(p);
		}
	});
	return out;
}

function frontendCustomHeaders(){
	const names = new Set();
	walk(UI_SRC, []).forEach((file)=>{
		const text = fs.readFileSync(file, 'utf8');
		const re = /['"`](X-Horosa-[A-Za-z0-9-]+)['"`]/g;
		let m;
		while((m = re.exec(text))){ names.add(m[1]); }
	});
	return [...names].sort();
}

function corsList(key){
	const src = fs.readFileSync(JAVA_MAIN, 'utf8');
	const m = src.match(new RegExp(`"cors\\.${key}",\\s*"([^"]+)"`));
	if(!m){ throw new Error(`AstroStudyProgram.java 缺 cors.${key} 登记串`); }
	return m[1].split(',').map((s)=>s.trim().toLowerCase()).filter(Boolean);
}
function corsSupportedHeaders(){ return corsList('supportedHeaders'); }
function corsExposedHeaders(){ return corsList('exposedHeaders'); }

// CORS 规范里 JS 无需放行即可读的响应头(CORS-safelisted response headers)
const SAFELISTED_RESPONSE = new Set(['cache-control', 'content-language', 'content-length', 'content-type', 'expires', 'last-modified', 'pragma']);
function constantsTable(){
	const text = fs.readFileSync(path.join(UI_SRC, 'utils', 'constants.js'), 'utf8');
	const table = {};
	const re = /export const (\w+)\s*=\s*['"]([^'"]+)['"]/g;
	let m;
	while((m = re.exec(text))){ table[m[1]] = m[2]; }
	return table;
}
// 前端读的响应头:`<x>.headers.get('Name')` / `.headers.get(Constants.Key)`
function readResponseHeadersIn(text, table){
	const out = [];
	const re = /\.headers\.get\(\s*(?:'([^']+)'|"([^"]+)"|Constants\.(\w+))\s*\)/g;
	let m;
	while((m = re.exec(text))){
		const name = m[1] || m[2] || table[m[3]];
		if(!name){ throw new Error(`响应头常量解析不到:Constants.${m[3]}`); }
		out.push(name);
	}
	return out;
}
function frontendReadResponseHeaders(){
	const table = constantsTable();
	const names = new Set();
	walk(UI_SRC, []).forEach((file)=>{ readResponseHeadersIn(fs.readFileSync(file, 'utf8'), table).forEach((n)=>names.add(n)); });
	return [...names].sort();
}
function missingExposed(used, exposed){
	const allowed = new Set(exposed);
	return used.filter((h)=>!SAFELISTED_RESPONSE.has(h.toLowerCase()) && !allowed.has(h.toLowerCase()));
}
// 请求封装固定发出的头(request.js 的 opts.headers = {…} 字面键 + opts.headers.X = …)
function requestJsSentHeaders(){
	const text = fs.readFileSync(path.join(UI_SRC, 'utils', 'request.js'), 'utf8');
	const names = new Set();
	const block = text.match(/opts\.headers\s*=\s*\{([\s\S]*?)\};/);
	if(!block){ throw new Error('request.js 缺 opts.headers = {…} 构造'); }
	block[1].split('\n').forEach((line)=>{
		const k = line.match(/^\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_][\w-]*))\s*:/);
		if(k){ names.add(k[1] || k[2] || k[3]); }
	});
	const re = /opts\.headers\.([A-Za-z_]\w*)\s*=/g;
	let m;
	while((m = re.exec(text))){ names.add(m[1]); }
	return [...names].sort();
}

describe('跨源请求头合同(前端 X-Horosa-* ↔ Java CORS 白名单)', ()=>{
	test('Java 源码在场且白名单可解析', ()=>{
		expect(fs.existsSync(JAVA_MAIN)).toBe(true);
		const allowed = corsSupportedHeaders();
		expect(allowed.length).toBeGreaterThan(20);
		expect(allowed).toContain('signature');
		expect(allowed).toContain('token');
	});

	test('前端每个自定义请求头都在白名单里(缺一即整站跨源请求被浏览器预检拦下)', ()=>{
		const used = frontendCustomHeaders();
		expect(used.length).toBeGreaterThanOrEqual(2); // 解析器自检:至少有 X-Horosa-Crypto / X-Horosa-Priority
		const allowed = new Set(corsSupportedHeaders());
		const missing = used.filter((h)=>!allowed.has(h.toLowerCase()));
		expect(missing).toEqual([]);
	});

	test('前端读的每个响应头都在 cors.exposedHeaders 里(不在 = 跨源时 JS 读到 null,后端错误文字到不了界面)', ()=>{
		const used = frontendReadResponseHeaders();
		expect(used).toEqual(expect.arrayContaining(['Result', 'ResultCode', 'Encrypted', 'SimpleData']));   // 解析器自检
		expect(missingExposed(used, corsExposedHeaders())).toEqual([]);
	});

	test('请求封装固定发出的头都在 cors.supportedHeaders 里', ()=>{
		const sent = requestJsSentHeaders();
		expect(sent).toEqual(expect.arrayContaining(['Token', 'Content-Type', 'ClientChannel', 'ClientApp', 'ClientVer', 'Signature']));
		const allowed = new Set(corsSupportedHeaders());
		expect(sent.filter((h)=>!allowed.has(h.toLowerCase()))).toEqual([]);
	});

	test('判据自证:放行表删掉一个前端在读的头即红;修前的放行表(缺 Result)即红', ()=>{
		const used = frontendReadResponseHeaders();
		const exposed = corsExposedHeaders();
		expect(missingExposed(used, exposed.filter((h)=>h !== 'encrypted'))).toEqual(['Encrypted']);
		expect(missingExposed(used, exposed.filter((h)=>h !== 'result'))).toEqual(['Result']);
		expect(readResponseHeadersIn("r.headers.get(Constants.ResultMessageKey); r.headers.get('X-A');", { ResultMessageKey: 'Result' })).toEqual(['Result', 'X-A']);
		expect(missingExposed(['Content-Type'], [])).toEqual([]);
	});
});
