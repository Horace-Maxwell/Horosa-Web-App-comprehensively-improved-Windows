// [D8/Q1] 非流式短调用必须带中止信号(先红)。合同/判别向量:
//   用户按「停止」/关页面后,流式那一路早就靠 AbortController 收住了;非流式短调用却各走各的——
//   判官(goalRunner.judgeGoal)、编排的 shortJson(规划/综合)、联网检索(integrations/webSearch)
//   三处都不带 signal → 停了之后请求还在飞:继续烧 token,回来还可能改任务状态(计划批一 #11)。
//   判据分两层:
//     ① 行为层(能直调的):judgeGoal 收到 signal 后,必须交给它发出去的那次短调用。
//     ② 源码结构层(钩子/薄封装不便驱动的):调用参数里必须出现 signal 字面
//        —— 连同两条服务出口(requestAIAnalysisChat / requestWebSearch),否则前面「传了」也中止不了。
//   shortCall.requestShortCompletion 是现成的正面样板(已带 signal),用绿用例钉住不许退化。
// 纪律:源码断言一律先剥注释(注释里复写字面会造成假绿),并按括号配平取「调用参数原文」。
import fs from 'fs';
import path from 'path';
import { judgeGoal } from '../aiAgent/goalRunner';

const SRC = {
	shortCall: path.resolve(__dirname, '..', 'aiChat', 'shortCall.js'),
	orchestrate: path.resolve(__dirname, '..', '..', 'components', 'aianalysis', 'chat', 'useChatOrchestrate.js'),
	webSearchIntegration: path.resolve(__dirname, '..', '..', 'integrations', 'webSearch.js'),
	webSearchTool: path.resolve(__dirname, '..', 'aiTools', 'tools', 'webSearch.js'),
	services: path.resolve(__dirname, '..', '..', 'services', 'aianalysis.js'),
};

const strip = (s)=>s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const readStripped = (key)=>strip(fs.readFileSync(SRC[key], 'utf8'));

// 取 `name(` 之后括号配平的参数原文;from 之后的第一处。找不到返回 null。
function callArgs(src, name, from){
	const head = `${name}(`;
	const i = src.indexOf(head, from || 0);
	if(i < 0){ return null; }
	let depth = 0;
	for(let j = i + head.length - 1; j < src.length; j++){
		const ch = src[j];
		if(ch === '('){ depth += 1; }
		else if(ch === ')'){ depth -= 1; if(depth === 0){ return src.slice(i + head.length, j); } }
	}
	return null;
}
function allCallArgs(src, name){
	const out = [];
	let from = 0;
	for(;;){
		const i = src.indexOf(`${name}(`, from);
		if(i < 0){ break; }
		const args = callArgs(src, name, i);
		if(args === null){ break; }
		out.push(args);
		from = i + name.length + 1;
	}
	return out;
}
// 取 `export function name(` 到下一个顶格 `}` 为止的函数体
function fnBody(src, decl){
	const i = src.indexOf(decl);
	if(i < 0){ return null; }
	const end = src.indexOf('\n}', i);
	return src.slice(i, end > -1 ? end : undefined);
}
const hasSignal = (text)=>/\bsignal\b/.test(`${text || ''}`);

function signalOfChatCall(call){
	const body = call && call[0];
	const opts = call && call[1];
	return (opts && opts.signal) || (body && body.signal) || (body && body.providerOptions && body.providerOptions.signal) || null;
}

describe('Q1 · 行为层', ()=>{
	it('🔴 judgeGoal 把 signal 交给它发出去的短调用', async ()=>{
		// 当前红:goalRunner.js:134 的 judgeGoal({profile,model,spec,lastReply,deps}) 根本不收 signal,
		// :138 的 chat({…}) 参数里也没有 signal 键。
		const ac = new AbortController();
		const chat = jest.fn(async ()=>({ Result: { content: '{"status":"done","reason":"ok"}' } }));
		const profile = { id: 'p1', providerType: 'openai', protocolFamily: 'openai', baseUrl: 'http://x', apiKey: 'k', providerOptions: {} };
		await judgeGoal({ profile, model: 'm', spec: { goal: 'G' }, lastReply: 'x', signal: ac.signal, deps: { requestAIAnalysisChat: chat } });
		expect(chat).toHaveBeenCalledTimes(1);
		expect(signalOfChatCall(chat.mock.calls[0])).toBe(ac.signal);
	});
});

describe('Q1 · 源码结构层(剥注释)', ()=>{
	it('shortCall.requestShortCompletion 的短调用带 signal(正面样板,不许退化)', ()=>{
		const args = callArgs(readStripped('shortCall'), 'requestAIAnalysisChat');
		expect(args).not.toBe(null);
		expect(hasSignal(args)).toBe(true);
	});

	it('🔴 useChatOrchestrate.shortJson 的短调用带 signal', ()=>{
		// 当前红:useChatOrchestrate.js:46 的 requestAIAnalysisChat({…}) 里没有 signal;
		// 同文件 :113 明明已经有 abortRef/AbortController(流式那路在用),短调用却没接上。
		const src = readStripped('orchestrate');
		// [D11] 结构化短调用经 requestStructuredWithFallback(requestAIAnalysisChat, {…}) 包装(空正文第三级降级):包装形态的参数原文同样必须带 signal
		const calls = allCallArgs(src, 'requestAIAnalysisChat')
			.concat(allCallArgs(src, 'requestStructuredWithFallback').filter((a)=>/^\s*requestAIAnalysisChat\s*,/.test(a)));
		expect(calls.length).toBeGreaterThan(0);
		calls.forEach((args)=>expect(hasSignal(args)).toBe(true));
	});

	it('🔴 联网检索:runWebSearch 收 signal 并下传 requestWebSearch;工具把 ctx.signal 交给它', ()=>{
		// 当前红:integrations/webSearch.js:50 runWebSearch({query,maxResults,freshness,site}) 不收 signal,
		// :58 的 requestWebSearch({…}) 也不带;aiTools/tools/webSearch.js:25 的 run(args) 连 ctx 都没接。
		const integ = readStripped('webSearchIntegration');
		const runSig = callArgs(integ, 'export async function runWebSearch');
		expect(runSig).not.toBe(null);
		expect(hasSignal(runSig)).toBe(true);
		const req = callArgs(integ, 'requestWebSearch');
		expect(req).not.toBe(null);
		expect(hasSignal(req)).toBe(true);
		const tool = readStripped('webSearchTool');
		expect(hasSignal(callArgs(tool, 'runWebSearch'))).toBe(true);
	});

	it('🔴 服务出口 requestAIAnalysisChat / requestWebSearch 能把 signal 交到请求层', ()=>{
		// 当前红:services/aianalysis.js:226/233 只把 timeoutMs 交给 requestJson 的第三参,
		// signal 一路丢失 —— 上面三处即使「传了 signal」也中止不了任何请求(requestJson 的
		// withTimeout(…, options.signal) 才是真正的中止入口)。
		const svc = readStripped('services');
		const chatFn = fnBody(svc, 'export function requestAIAnalysisChat(');
		expect(chatFn).not.toBe(null);
		expect(hasSignal(chatFn)).toBe(true);
		const searchFn = fnBody(svc, 'export function requestWebSearch(');
		expect(searchFn).not.toBe(null);
		expect(hasSignal(searchFn)).toBe(true);
	});
});
