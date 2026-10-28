#!/usr/bin/env node
// 页面宿主(给桌面壳的真栈联调用):把无头运行时当成「页面」,接桌面壳本机服务的投递 —— 不开窗口也能测桌面壳的 MCP / REST / 终端命令。
//   POST /dispatch {id, method, params} → 运行时 dispatch(与壳 → 页面桥同一入口);进度逐行写回 {progress},结果最后一行 {done, ok, result | error}(NDJSON);
//   POST /cancel {id} → 中止该调用(与壳的取消脚本同义)。
// 用法:HOROSA_HOME=<临时目录> node headless/pagehost.js <端口> [就绪文件]
// 壳侧对应 mcp_server.rs 的 e2e_real_page_host(#[ignore]);驱动脚本 Horosa_Desktop_Installer/scripts/verify_desktop_api_e2e.sh。
'use strict';
const fs = require('fs');
const http = require('http');
const util = require('util');

async function main(){
	const port = Number(process.argv[2] || 0);
	const ready = process.argv[3] || '';
	console.log = (...a)=>process.stderr.write(`${util.format(...a)}\n`);   // eslint-disable-line no-console
	const { createRuntime } = require('./runtime');
	const { isLoopbackAuthority, originAllowed, MAX_BODY_BYTES } = require('./server');
	const rt = await createRuntime({ quiet: true, handleSignals: false });
	const inflight = new Map();
	const readBody = (req)=>new Promise((resolve, reject)=>{
		let b = ''; let n = 0;
		req.on('data', (c)=>{ n += c.length; if(n > MAX_BODY_BYTES){ reject(new Error('payload too large')); req.destroy(); return; } b += c; });
		req.on('end', ()=>resolve(b));
		req.on('error', reject);
	});
	const server = http.createServer(async (req, res)=>{
		// 只给本机联调进程用:Host / Origin 只认本机(浏览器跨站发的 POST 一律带 Origin → 403),只收 POST
		if((req.headers.host !== undefined && !isLoopbackAuthority(req.headers.host)) || !originAllowed(req.headers.origin)){ res.writeHead(403); res.end('{}'); return; }
		if(req.method !== 'POST'){ res.writeHead(405); res.end('{}'); return; }
		let body = {};
		try{ body = JSON.parse((await readBody(req)) || '{}'); }catch(e){ res.writeHead(400); res.end('{}'); return; }
		if(req.url === '/cancel'){
			const ac = inflight.get(`${body.id}`);
			if(ac){ ac.abort(); }
			res.end('{}');
			return;
		}
		if(req.url !== '/dispatch'){ res.writeHead(404); res.end('{}'); return; }
		res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
		const ac = new AbortController();
		inflight.set(`${body.id}`, ac);
		const p = body.params || {};
		const clientName = p.clientName || (p._meta && p._meta.clientName) || 'external';
		try{
			const out = await rt.dispatch(body.method, p, { clientName, signal: ac.signal, progress: p.progress === true ? (v)=>res.write(`${JSON.stringify({ progress: v })}\n`) : undefined });
			res.end(`${JSON.stringify({ done: true, ok: !!(out && out.ok), result: out && out.ok ? out.result : undefined, error: out && !out.ok ? out.error : undefined })}\n`);
		}catch(e){
			res.end(`${JSON.stringify({ done: true, ok: false, error: { code: -32603, message: e && e.message ? e.message : `${e}` } })}\n`);
		}finally{
			inflight.delete(`${body.id}`);
		}
	});
	server.listen(port, '127.0.0.1', ()=>{
		const actual = server.address().port;
		process.stderr.write(`[horosa] 页面宿主在跑 http://127.0.0.1:${actual}\n`);
		if(ready){ fs.writeFileSync(ready, `${actual}\n`); }
	});
	const stop = ()=>{ server.close(); rt.close(); process.exit(0); };
	process.once('SIGTERM', stop);
	process.once('SIGINT', stop);
}

main().catch((e)=>{ process.stderr.write(`[horosa] 页面宿主起不来:${e && e.stack ? e.stack : e}\n`); process.exit(1); });
