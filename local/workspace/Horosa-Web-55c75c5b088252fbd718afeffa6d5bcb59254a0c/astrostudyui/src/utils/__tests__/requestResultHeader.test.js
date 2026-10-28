// Result 响应头的编解码口径:后端经 URLEncoder 写(空格成 +、保留字符成 %XX),页面按同一口径还原;解不开不抛、原样回
import { decodeResultHeader, getResponseHeaders } from '../request';
import * as Constants from '../constants';

const resp = (headers)=>({ headers: { get: (k)=>(Object.prototype.hasOwnProperty.call(headers, k) ? headers[k] : null) } });

describe('Result 响应头解码', ()=>{
	test('URLEncoder 形式:+ 还原成空格,%3A / %2C / 中文还原', ()=>{
		expect(decodeResultHeader('%E5%8F%82%E6%95%B0%E9%94%99%E8%AF%AF%3A+year%2C+month')).toBe('参数错误: year, month');
		expect(decodeResultHeader('a%2Bb')).toBe('a+b');
	});
	test('裸 % / 非法序列不抛,原样回', ()=>{
		expect(()=>decodeResultHeader('100% failed')).not.toThrow();
		expect(decodeResultHeader('100% failed')).toBe('100% failed');
		expect(decodeResultHeader('%E5%8F')).toBe('%E5%8F');
	});
	test('空值原样', ()=>{
		expect(decodeResultHeader(null)).toBe(null);
		expect(decodeResultHeader(undefined)).toBe(undefined);
		expect(decodeResultHeader('')).toBe('');
	});
	test('getResponseHeaders 读 Result 头走同一解码,裸 % 时照样回带状态的头对象', ()=>{
		const h = getResponseHeaders(resp({ [Constants.ResultCodeKey]: '500', [Constants.ResultMessageKey]: '100% bad' }));
		expect(h[Constants.ResultCodeKey]).toBe(500);
		expect(h[Constants.ResultMessageKey]).toBe('100% bad');
		const h2 = getResponseHeaders(resp({ [Constants.ResultCodeKey]: '400', [Constants.ResultMessageKey]: 'bad+request%3A+x' }));
		expect(h2[Constants.ResultMessageKey]).toBe('bad request: x');
	});
});
