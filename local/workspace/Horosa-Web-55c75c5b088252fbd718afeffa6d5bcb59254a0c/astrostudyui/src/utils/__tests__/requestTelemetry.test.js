// 请求失败留痕环形缓冲:容量 / 计数 / 只存骨架 / 调试开关 / 剪贴板文本 / 深拷。
import {
	recordRequestFailure, snapshot, lastFor, formatForClipboard, formatRecentLine, pathOfUrl, stripUrlQuery,
	__resetRequestTelemetryForTests,
} from '../requestTelemetry';

const KILL = 'horosa.debug.requestTelemetry';

beforeEach(()=>{
	__resetRequestTelemetryForTests();
	window.localStorage.removeItem(KILL);
});

describe('requestTelemetry', ()=>{
	it('环形缓冲:写 51 条只留 50,最旧一条被挤出,total 仍计 51,first/last 时间戳在位', ()=>{
		for(let i = 0; i < 51; i += 1){
			recordRequestFailure({ url: `http://h/p?i=${i}`, kind: 'unknown', name: `E${i}` });
		}
		const s = snapshot();
		expect(s.total).toBe(51);
		expect(s.recent.length).toBe(50);
		expect(s.recent[0].name).toBe('E1');
		expect(s.recent[49].name).toBe('E50');
		expect(typeof s.firstAt).toBe('number');
		expect(s.lastAt).toBeGreaterThanOrEqual(s.firstAt);
	});

	it('计数:byKind 与 byPath;不同路径超过 30 个后归 other,已有路径仍计到自身', ()=>{
		for(let i = 0; i < 35; i += 1){
			recordRequestFailure({ url: `http://h/path${i}`, kind: i % 2 ? 'http5xx' : 'unreachable' });
		}
		const s = snapshot();
		expect(s.counts.byKind).toEqual({ unreachable: 18, http5xx: 17 });
		expect(Object.keys(s.counts.byPath).filter((k)=>k !== 'other').length).toBe(30);
		expect(s.counts.byPath.other).toBe(5);
		recordRequestFailure({ url: 'http://h/path0', kind: 'unknown' });
		expect(snapshot().counts.byPath['/path0']).toBe(2);
		expect(snapshot().counts.byPath.other).toBe(5);
	});

	it('只存骨架:url 去 query;message 剥内嵌 URL 的 query 并截 200;body/headers 绝不入环', ()=>{
		const e = recordRequestFailure({
			url: 'http://127.0.0.1:9999/chart?x=1&Token=QTOK1',
			kind: 'business', silent: false, name: 'Error',
			message: `bad http://127.0.0.1:9999/chart?Token=QTOK2 then ${'m'.repeat(300)}`,
			status: 200, code: 'need.login',
			body: '{"secret":"BODY1"}', headers: { Token: 'HDR1' },
		});
		expect(e.url).toBe('http://127.0.0.1:9999/chart');
		expect(e.message.length).toBeLessThanOrEqual(200);
		expect(e.message.indexOf('bad http://127.0.0.1:9999/chart then')).toBe(0);
		const s = snapshot();
		const txt = JSON.stringify(s);
		expect(s.recent[0].url.indexOf('?')).toBe(-1);
		['QTOK1', 'QTOK2', 'BODY1', 'HDR1', 'Token'].forEach((bad)=>{
			expect(txt.indexOf(bad)).toBe(-1);
		});
		expect(Object.keys(s.recent[0]).sort()).toEqual(['at', 'code', 'kind', 'message', 'name', 'silent', 'status', 'url']);
		expect(s.recent[0]).toMatchObject({ status: 200, code: 'need.login', silent: false });
	});

	it('调试开关 horosa.debug.requestTelemetry = "0":完全不记录(total 0);移除后恢复记录', ()=>{
		window.localStorage.setItem(KILL, '0');
		expect(recordRequestFailure({ url: 'http://h/a', kind: 'unreachable' })).toBeNull();
		expect(snapshot().total).toBe(0);
		window.localStorage.removeItem(KILL);
		recordRequestFailure({ url: 'http://h/a', kind: 'unreachable' });
		expect(snapshot().total).toBe(1);
	});

	it('formatForClipboard:总数 / 按类计数 / 最近 5 条(HH:mm:ss 路径 kind name,最新在前),不含 Token 与 message', ()=>{
		for(let i = 0; i < 7; i += 1){
			recordRequestFailure({
				url: `http://h/p${i}?Token=QT${i}`, kind: i < 3 ? 'unreachable' : 'timeout',
				name: 'TimeoutError', message: `Token=QT${i} secret-msg-${i}`, headers: { Token: 'x' },
			});
		}
		const txt = formatForClipboard();
		expect(txt).toContain('请求失败总数: 7');
		expect(txt).toContain('timeout: 4');
		expect(txt).toContain('unreachable: 3');
		const recentLines = txt.split('\n').filter((l)=>/^\s+\d{2}:\d{2}:\d{2} \/p\d (timeout|unreachable) TimeoutError$/.test(l));
		expect(recentLines.length).toBe(5);
		expect(recentLines[0]).toMatch(/ \/p6 /);
		expect(recentLines[4]).toMatch(/ \/p2 /);
		expect(txt.indexOf('Token')).toBe(-1);
		expect(txt.indexOf('QT')).toBe(-1);
		expect(txt.indexOf('secret-msg')).toBe(-1);
	});

	it('空账 formatForClipboard 给「最近无请求失败」', ()=>{
		const txt = formatForClipboard();
		expect(txt).toContain('请求失败总数: 0');
		expect(txt).toContain('最近无请求失败');
	});

	it('lastFor(pathPrefix):按路径或完整 url 前缀取最近一条;snapshot 为深拷,改动不串内部', ()=>{
		recordRequestFailure({ url: 'http://h/chart?a=1', kind: 'unreachable', name: 'TypeError' });
		recordRequestFailure({ url: 'http://h/predict/pd', kind: 'http5xx', name: 'Error', status: 502 });
		recordRequestFailure({ url: 'http://h/chart13', kind: 'timeout', name: 'TimeoutError' });
		expect(lastFor('/chart').kind).toBe('timeout');
		expect(lastFor('/predict').status).toBe(502);
		expect(lastFor('http://h/predict').status).toBe(502);
		expect(lastFor('/nope')).toBeNull();
		expect(lastFor('').kind).toBe('timeout');
		const s = snapshot();
		s.recent.length = 0;
		s.counts.byKind.timeout = 99;
		expect(snapshot().recent.length).toBe(3);
		expect(snapshot().counts.byKind.timeout).toBe(1);
	});

	it('纯工具:stripUrlQuery / pathOfUrl / formatRecentLine', ()=>{
		expect(stripUrlQuery('http://h:1/a/b?x=1#f')).toBe('http://h:1/a/b');
		expect(stripUrlQuery(null)).toBe('');
		expect(pathOfUrl('http://127.0.0.1:9999/chart')).toBe('/chart');
		expect(pathOfUrl('http://h')).toBe('/');
		expect(pathOfUrl('/rel/path')).toBe('/rel/path');
		const line = formatRecentLine({ at: new Date(2026, 8, 3, 9, 5, 7).getTime(), url: 'http://h/x', kind: 'timeout', name: 'TimeoutError' });
		expect(line).toBe('09:05:07 /x timeout TimeoutError');
	});
});
