// [B-A7] SSE 解析器纯函数契约:event/data 帧、CRLF、多行 data、半帧 flush。
import { __testing__ } from '../aianalysis';

const { createSseParser } = __testing__;

function collect(){
	const events = [];
	const parser = createSseParser((evt)=>events.push([evt.type, evt.data]));
	return { events, parser };
}

describe('createSseParser', ()=>{
	it('解析标准 event+data 帧', ()=>{
		const { events, parser } = collect();
		parser.push('event:delta\ndata:{"delta":"你好"}\n\n');
		expect(events).toEqual([['delta', '{"delta":"你好"}']]);
	});

	it('CRLF 行尾等价处理', ()=>{
		const { events, parser } = collect();
		parser.push('event:delta\r\ndata:{"a":1}\r\n\r\n');
		expect(events.length).toBe(1);
		expect(events[0][0]).toBe('delta');
		expect(events[0][1]).toContain('"a":1');
	});

	it('跨 chunk 半帧拼接(流式到达)', ()=>{
		const { events, parser } = collect();
		parser.push('event:del');
		parser.push('ta\ndata:{"x"');
		expect(events.length).toBe(0); // 帧未闭合不触发
		parser.push(':2}\n\n');
		expect(events).toEqual([['delta', '{"x":2}']]);
	});

	it('多行 data 按 SSE 语义合并', ()=>{
		const { events, parser } = collect();
		parser.push('event:done\ndata:line1\ndata:line2\n\n');
		expect(events.length).toBe(1);
		expect(events[0][1]).toContain('line1');
		expect(events[0][1]).toContain('line2');
	});

	it('end() flush 结尾半帧(上游没给最后空行)', ()=>{
		const { events, parser } = collect();
		parser.push('event:done\ndata:{"ok":true}');
		expect(events.length).toBe(0);
		parser.end();
		expect(events.length).toBe(1);
		expect(events[0][0]).toBe('done');
	});

	it('连续多帧逐一派发且顺序稳定', ()=>{
		const { events, parser } = collect();
		parser.push('event:delta\ndata:1\n\nevent:delta\ndata:2\n\nevent:done\ndata:fin\n\n');
		expect(events.map((e)=>e[0])).toEqual(['delta', 'delta', 'done']);
		expect(events.map((e)=>e[1])).toEqual(['1', '2', 'fin']);
	});
});
