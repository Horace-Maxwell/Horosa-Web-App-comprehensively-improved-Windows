// 五兆界面显示名:引擎回包里的繁体写法字在界面上显示简体写法(繁体档由显示层转回);回包原值不动。
import PAN from './fixtures/wuzhaoPan.json';
import { WUZHAO_DISPLAY_CHARS, wuzhaoShow, wuzhaoDisplayPan } from '../wuzhaoDisplay';

const { isTradOnlyChar, toHant } = require('../../../utils/scriptConvert/hantConverter');

function strings(v, out){
	if(typeof v === 'string'){ out.push(v); }
	else if(Array.isArray(v)){ v.forEach((x)=>strings(x, out)); }
	else if(v && typeof v === 'object'){ Object.keys(v).forEach((k)=>strings(v[k], out)); }
	return out;
}
const KEEP = new Set(['乾', '徵']);   // 简体里本来也用

describe('五兆界面显示名', ()=>{
	it('真实回包的显示副本里不剩繁体写法字(新引擎字段带来新繁体字即红:补进字表)', ()=>{
		const left = new Set();
		Object.keys(PAN).forEach((mode)=>{
			strings(wuzhaoDisplayPan(PAN[mode]), []).forEach((s)=>{
				Array.from(s).forEach((c)=>{ if(isTradOnlyChar(c) && !KEEP.has(c)){ left.add(c); } });
			});
		});
		expect([...left].sort()).toEqual([]);
		// 判别力:原回包里确有这些字
		expect(strings(PAN.zhushu, []).some((s)=>s.indexOf('青龍') >= 0)).toBe(true);
	});

	it('只换值不换键;同一份回包只算一次;原回包不被改', ()=>{
		const pan = PAN.ganzhi;
		const before = JSON.stringify(pan);
		const d = wuzhaoDisplayPan(pan);
		expect(wuzhaoDisplayPan(pan)).toBe(d);
		expect(JSON.stringify(pan)).toBe(before);
		expect(Object.keys(d)).toEqual(Object.keys(pan));
		expect(strings(d, []).filter((s)=>/青龍|勾陳|子孫/.test(s)).length).toBe(0);
		expect(strings(pan, []).filter((s)=>/青龍|勾陳|子孫/.test(s)).length).toBeGreaterThan(0);
	});

	it('字表:每个繁体写法字换成的是它的简体写法,繁体档显示层转回来还是原字', ()=>{
		const bad = Object.keys(WUZHAO_DISPLAY_CHARS).filter((c)=>!isTradOnlyChar(c)).map((c)=>`${c} 不是繁体写法字`);
		expect(bad).toEqual([]);
		expect(wuzhaoShow('木鄉·青龍·子孫')).toBe('木乡·青龙·子孙');
		expect(toHant(wuzhaoShow('火鄉·勾陳·妻財'))).toBe('火鄉·勾陳·妻財');
	});
});
