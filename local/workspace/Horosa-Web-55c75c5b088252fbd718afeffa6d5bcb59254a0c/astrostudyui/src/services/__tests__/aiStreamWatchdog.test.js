// [#77 根修制度化] 流式三层超时语义契约:空闲看门狗(只认真产出续命)/总时长硬顶/
// providerOptions 两键覆盖与 handlers 优先级。mock fetch+受控 reader+fake timers 驱动。
// 判别向量:默认值(180000/1800000)注错即「默认档」两例红(执行轮已实证)。
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from 'util';
if(typeof global.TextEncoder === 'undefined'){ global.TextEncoder = NodeTextEncoder; }
if(typeof global.TextDecoder === 'undefined'){ global.TextDecoder = NodeTextDecoder; }
// eslint-disable-next-line import/first
import { requestAIAnalysisChatStream } from '../aianalysis';

function makeStream(){
	const pending = [];
	let cancelled = false;
	const reader = {
		read(){
			return new Promise((resolve)=>{ pending.push(resolve); });
		},
		cancel(){
			cancelled = true;
			while(pending.length){ pending.shift()({ done: true }); }
			return Promise.resolve();
		},
	};
	const enc = new TextEncoder();
	return {
		reader,
		isCancelled: ()=>cancelled,
		emit(text){
			if(pending.length){ pending.shift()({ done: false, value: enc.encode(text) }); }
		},
		end(){
			if(pending.length){ pending.shift()({ done: true }); }
		},
	};
}

function mockFetchWith(stream){
	global.fetch = jest.fn(()=>Promise.resolve({
		ok: true,
		body: { getReader: ()=>stream.reader },
	}));
}

const flush = async (n = 4)=>{ for(let i = 0; i < n; i++){ await Promise.resolve(); } };
const sse = (type, json)=>`event:${type}\ndata:${JSON.stringify(json)}\n\n`;

describe('[#77] 流式看门狗三层语义', ()=>{
	beforeEach(()=>{ jest.useFakeTimers(); });
	afterEach(()=>{ jest.useRealTimers(); jest.restoreAllMocks(); });

	it('默认档:180s 无产出 → stall 错误(文案含 180 秒与调参指引)', async ()=>{
		const stream = makeStream();
		mockFetchWith(stream);
		const p = requestAIAnalysisChatStream({ providerType: 'openai', messages: [] }, {});
		const guarded = p.catch((e)=>e);
		await flush();
		jest.advanceTimersByTime(179000);
		await flush();
		expect(stream.isCancelled()).toBe(false);
		jest.advanceTimersByTime(1001);
		await flush();
		const err = await guarded;
		expect(`${err && err.message}`).toContain('180 秒无新内容');
		expect(`${err && err.message}`).toContain('流式空闲上限');
	});

	it('默认档:持续产出跨过 300s 旧硬顶不再被掐;30min 才是总上限(文案含 30 分钟)', async ()=>{
		const stream = makeStream();
		mockFetchWith(stream);
		const p = requestAIAnalysisChatStream({ providerType: 'openai', messages: [] }, {});
		const guarded = p.catch((e)=>e);
		await flush();
		// 每 100s 送一个 delta(续 stall),推到 20 分钟——旧 300s 硬顶下早死;新默认必须活着
		for(let i = 0; i < 12; i++){
			stream.emit(sse('delta', { delta: `t${i}` }));
			await flush();
			jest.advanceTimersByTime(100000);
			await flush();
		}
		expect(stream.isCancelled()).toBe(false);
		// 继续喂满到 30 分钟总上限
		for(let i = 0; i < 6; i++){
			stream.emit(sse('delta', { delta: `u${i}` }));
			await flush();
			jest.advanceTimersByTime(100000);
			await flush();
		}
		const err = await guarded;
		expect(`${err && err.message}`).toContain('总时长上限 30 分钟');
	});

	it('心跳/usage 不续命:先 delta 复位,再只发 usage,仍在 STALL 到点判卡', async ()=>{
		const stream = makeStream();
		mockFetchWith(stream);
		const p = requestAIAnalysisChatStream({ providerType: 'openai', providerOptions: { streamStallMs: 5000 }, messages: [] }, {});
		const guarded = p.catch((e)=>e);
		await flush();
		stream.emit(sse('delta', { delta: 'x' }));
		await flush();
		jest.advanceTimersByTime(4000);
		stream.emit(sse('usage', { total_tokens: 1 }));
		await flush();
		jest.advanceTimersByTime(1001);
		await flush();
		const err = await guarded;
		expect(`${err && err.message}`).toContain('5 秒无新内容');
	});

	it('reasoning 事件续命(深思模型思考流不判卡)+ 正常收尾 onDone', async ()=>{
		const stream = makeStream();
		mockFetchWith(stream);
		let done = false;
		const p = requestAIAnalysisChatStream({ providerType: 'openai', providerOptions: { streamStallMs: 5000 }, messages: [] }, { onDone: ()=>{ done = true; } });
		await flush();
		for(let i = 0; i < 3; i++){
			stream.emit(sse('reasoning', { reasoning: `思${i}` }));
			await flush();
			jest.advanceTimersByTime(4000);
			await flush();
		}
		expect(stream.isCancelled()).toBe(false);
		stream.end();
		await flush();
		await p;
		expect(done).toBe(true);
	});

	it('优先级:handlers 显式 stallMs > providerOptions.streamStallMs', async ()=>{
		const stream = makeStream();
		mockFetchWith(stream);
		const p = requestAIAnalysisChatStream({ providerType: 'openai', providerOptions: { streamStallMs: 60000 }, messages: [] }, { stallMs: 3000 });
		const guarded = p.catch((e)=>e);
		await flush();
		jest.advanceTimersByTime(3001);
		await flush();
		const err = await guarded;
		expect(`${err && err.message}`).toContain('3 秒无新内容');
	});

	it('providerOptions.streamMaxStreamMs 覆盖总上限', async ()=>{
		const stream = makeStream();
		mockFetchWith(stream);
		const p = requestAIAnalysisChatStream({ providerType: 'openai', providerOptions: { streamStallMs: 5000, streamMaxStreamMs: 8000 }, messages: [] }, {});
		const guarded = p.catch((e)=>e);
		await flush();
		for(let i = 0; i < 4; i++){
			stream.emit(sse('delta', { delta: `k${i}` }));
			await flush();
			jest.advanceTimersByTime(2100);
			await flush();
		}
		const err = await guarded;
		expect(`${err && err.message}`).toContain('总时长上限');
	});
});
