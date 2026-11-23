// 无头 MCP · stdio:每行一条 JSON-RPC 消息(读标准输入、写标准输出)。Claude Code / Claude Desktop / Codex / Cursor 等直接拉起即用,不需要令牌与端口。
// 标准输出只走协议 —— 前端代码里的 console.log 一律改道标准错误;进度通知按请求的 progressToken 逐条写出;
// notifications/cancelled 按请求 id 中止;标准输入关闭 = 等在途请求了结后退出。
'use strict';
const util = require('util');
const readline = require('readline');
const protocol = require('./protocol');

async function runStdio(opts){
	const o = opts || {};
	const write = (m)=>{ process.stdout.write(`${JSON.stringify(m)}\n`); };
	// 日志:控制台输出照旧进标准错误;客户端用 logging/setLevel 选了级别后,同一条也按级别发 notifications/message
	//   (没选级别 = 不发,只进标准错误)。只在握手完成后发;正文截断防刷屏。
	let logMin = -1;
	let ready = false;
	const sevOf = (lv)=>protocol.LOG_LEVELS.indexOf(lv);
	const logTo = (level)=>(...a)=>{
		const text = util.format(...a);
		process.stderr.write(`${text}\n`);
		if(ready && logMin >= 0 && sevOf(level) >= logMin){
			try{ write({ jsonrpc: '2.0', method: 'notifications/message', params: { level, logger: 'horosa', data: text.length > 4000 ? `${text.slice(0, 4000)}…` : text } }); }catch(e){ /* noop */ }
		}
	};
	/* eslint-disable no-console */
	console.debug = logTo('debug'); console.log = logTo('info'); console.info = logTo('info');
	console.warn = logTo('warning'); console.error = logTo('error');
	/* eslint-enable no-console */
	let unwatch = null;
	const onInitialized = ()=>{
		if(ready){ return; }
		ready = true;
		// 目录变化 → notifications/<tools|resources|prompts>/list_changed(开关翻转 / 建档 / 撤销 / 模版写入;与桌面同一套信号源与去抖)
		rtPromise.then((rt)=>{ if(typeof rt.watchCatalog === 'function' && !unwatch){ unwatch = rt.watchCatalog((kind)=>write({ jsonrpc: '2.0', method: `notifications/${kind}/list_changed` })); } }).catch(()=>{});
	};
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
			}else if(msg.method === 'notifications/initialized'){ onInitialized(); }
			return;
		}
		const reported = protocol.initializeClientName(msg);
		if(reported){ sessionClient = reported; }
		const ac = new AbortController();
		const k = JSON.stringify(msg && msg.id);
		inflight.set(k, ac);
		const job = rtPromise.then((rt)=>protocol.handleMessage(msg, { rt, clientName: 'stdio', sessionClient, sessionId: 'stdio', version, signal: ac.signal, onNotification: write, listChanged: true, logging: true, onSetLevel: (lv)=>{ logMin = sevOf(lv); } }))
			.then((out)=>{ if(out){ write(out); } })
			.catch((e)=>{ write(protocol.errorOf(msg && msg.id, protocol.ERR.INTERNAL, e && e.message ? e.message : `${e}`)); })
			.finally(()=>{ inflight.delete(k); pending.delete(job); });
		pending.add(job);
	});
	await new Promise((resolve)=>rl.on('close', resolve));
	await Promise.allSettled(Array.from(pending));
	if(unwatch){ try{ unwatch(); }catch(e){ /* noop */ } }
	try{ (await rtPromise).close(); }catch(e){ /* noop */ }
	return 0;
}

module.exports = { runStdio };
