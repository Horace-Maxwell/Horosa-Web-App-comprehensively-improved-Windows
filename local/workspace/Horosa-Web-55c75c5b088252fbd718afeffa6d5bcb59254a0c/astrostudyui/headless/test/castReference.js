// 对拍用的「单例」参照(批量测试的子进程;不是 node --test 用例):在一个全新的数据目录里起无头运行时,
// 按 ./horosa call --local 同一条路(协议层 handleMessage → 运行时 dispatch → 页面桥 → runTool)逐条调 cast_technique,
// 把每条的回包(structuredContent / isError / 正文)按原顺序写成一个 JSON 数组到标准输出。
//   标准输入:JSON 数组,每项 { technique, source, maxChars?, sections?, options? };
//   或 { celebrity: '名人库编号', technique, … }:先 create_celebrity_chart 建档(与名人库页「加入命盘」同一构造),再按 { kind:'record', cid } 起盘。
// 每条用自己的会话号(限流桶按会话分,与一个个单独发起的单例调用同义)。
'use strict';
const path = require('path');

async function main(){
	const chunks = [];
	for await (const c of process.stdin){ chunks.push(c); }
	const items = JSON.parse(Buffer.concat(chunks).toString('utf8'));
	const toErr = (...a)=>process.stderr.write(`${require('util').format(...a)}\n`);
	console.log = toErr; console.info = toErr; console.debug = toErr;   // eslint-disable-line no-console
	const { createRuntime } = require(path.join(__dirname, '..', 'runtime.js'));
	const protocol = require(path.join(__dirname, '..', 'protocol.js'));
	const rt = await createRuntime({ quiet: true });
	const call = async (name, args, i)=>{
		const ans = await protocol.handleMessage({ jsonrpc: '2.0', id: `ref-${i}`, method: 'tools/call', params: { name, arguments: args } }, { rt, clientName: 'cli', sessionId: `ref-${i}-${name}`, version: 'ref' });
		return ans && ans.result ? ans.result : { isError: true, error: ans && ans.error };
	};
	const out = [];
	const cids = new Map();
	let i = 0;
	for(const it of items){
		i += 1;
		const args = { technique: it.technique, maxChars: it.maxChars || 60000 };
		if(it.sections){ args.sections = it.sections; }
		if(it.options){ args.options = it.options; }
		if(it.celebrity){
			if(!cids.has(it.celebrity)){
				// 建档是写入工具:按人工本机直调(不经外部限流桶,每小时写入额度与此对拍无关)
				const r = await rt.lib.runTool('create_celebrity_chart', { id: it.celebrity }, { origin: 'mcp', clientName: 'ref' });
				cids.set(it.celebrity, r && r.ok ? r.data.cid : null);
			}
			args.source = { kind: 'record', cid: cids.get(it.celebrity) };
		}else{
			args.source = it.source;
		}
		const r = await call('cast_technique', args, i);
		const text = ((r.content || [])[0] || {}).text || '';
		out.push({ isError: !!r.isError, structuredContent: r.structuredContent === undefined ? null : r.structuredContent, text: r.isError ? text : '' });
	}
	try{ rt.close(); }catch(e){ /* noop */ }
	// 写到管道是异步的:等写完再退(否则大回包被截断)
	process.stdout.write(JSON.stringify(out), ()=>process.exit(0));
}
main().catch((e)=>{ process.stderr.write(`${e && e.stack ? e.stack : e}\n`); process.exit(1); });
