// 无头 MCP · stdio:每行一条 JSON-RPC 消息(读标准输入、写标准输出)。Claude Code / Claude Desktop / Codex / Cursor 等直接拉起即用,不需要令牌与端口。
// 标准输出只走协议 —— 前端代码里的 console.log 一律改道标准错误;进度通知按请求的 progressToken 逐条写出;
// notifications/cancelled 按请求 id 中止;标准输入关闭 = 等在途请求了结后退出。
'use strict';
const util = require('util');
const readline = require('readline');
const protocol = require('./protocol');

async function runStdio(opts){
	const o = opts || {};
	const toErr = (...a)=>process.stderr.write(`${util.format(...a)}\n`);
	console.log = toErr; console.info = toErr; console.debug = toErr;   // eslint-disable-line no-console
	const write = (m)=>{ process.stdout.write(`${JSON.stringify(m)}\n`); };
	const { createRuntime } = require('./runtime');
	const { appVersion } = require('./server');
	const rtPromise = createRuntime({ ...o, quiet: true });
	const version = appVersion();
	const inflight = new Map();
	let sessionClient = '';   // initialize 报的名字;身份规则单源在 protocol.clientIdentityOf(缺省 stdio)
	const pending = new Set();
	const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
	rl.on('line', (line)=>{
		const text = line.trim();
		if(!text){ return; }
		let msg;
		try{ msg = JSON.parse(text); }catch(e){ write(protocol.errorOf(null, protocol.ERR.PARSE, 'parse error')); return; }
		if(msg && typeof msg === 'object' && !Array.isArray(msg) && !Object.prototype.hasOwnProperty.call(msg, 'id')){
			if(msg.method === 'notifications/cancelled'){
				const ac = inflight.get(JSON.stringify(msg.params && msg.params.requestId));
				if(ac){ ac.abort(); }
			}
			return;
		}
		const reported = protocol.initializeClientName(msg);
		if(reported){ sessionClient = reported; }
		const ac = new AbortController();
		const k = JSON.stringify(msg && msg.id);
		inflight.set(k, ac);
		const job = rtPromise.then((rt)=>protocol.handleMessage(msg, { rt, clientName: 'stdio', sessionClient, sessionId: 'stdio', version, signal: ac.signal, onNotification: write }))
			.then((out)=>{ if(out){ write(out); } })
			.catch((e)=>{ write(protocol.errorOf(msg && msg.id, protocol.ERR.INTERNAL, e && e.message ? e.message : `${e}`)); })
			.finally(()=>{ inflight.delete(k); pending.delete(job); });
		pending.add(job);
	});
	await new Promise((resolve)=>rl.on('close', resolve));
	await Promise.allSettled(Array.from(pending));
	try{ (await rtPromise).close(); }catch(e){ /* noop */ }
	return 0;
}

module.exports = { runStdio };
