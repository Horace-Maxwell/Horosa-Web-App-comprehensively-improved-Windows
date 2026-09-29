// [R5 P0-4 实抓 · 2026-09-25] 跨源请求头合同:前端发给本地 Java(:9999)的每个自定义请求头(X-Horosa-*)都必须
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

function corsSupportedHeaders(){
	const src = fs.readFileSync(JAVA_MAIN, 'utf8');
	const m = src.match(/"cors\.supportedHeaders",\s*"([^"]+)"/);
	if(!m){ throw new Error('AstroStudyProgram.java 缺 cors.supportedHeaders 登记串'); }
	return m[1].split(',').map((s)=>s.trim().toLowerCase()).filter(Boolean);
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
});
