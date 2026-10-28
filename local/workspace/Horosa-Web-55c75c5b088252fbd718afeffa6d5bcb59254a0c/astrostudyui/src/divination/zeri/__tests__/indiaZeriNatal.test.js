// 印度择日本命月宿 / 月座 → 后端请求体:单一出处(择日页与外部调用同引),月座换成后端 0..11。
import fs from 'fs';
import path from 'path';
import { indiaNatalPayload } from '../indiaZeriNatal';

const SRC = path.resolve(__dirname, '../../..');
const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l)=>l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n');

describe('印度择日本命段', ()=>{
	it('月座 1..12 → 后端 0..11;月宿原样;越界 / 非整数 / 未设一律不带', ()=>{
		expect(indiaNatalPayload(5, 3)).toEqual({ moonNak: 5, moonSign: 2 });
		expect(indiaNatalPayload(27, 12)).toEqual({ moonNak: 27, moonSign: 11 });
		expect(indiaNatalPayload(0, 1)).toEqual({ moonSign: 0 });
		expect(indiaNatalPayload('7', 0)).toEqual({ moonNak: 7 });
		[[0, 0], [null, undefined], [28, 13], [-1, -1], [2.5, 1.5], ['x', 'y']].forEach(([a, b])=>{
			const r = indiaNatalPayload(a, b);
			expect(r === null || (!('moonNak' in r) && !('moonSign' in r))).toBe(true);
		});
		expect(indiaNatalPayload(28, 3)).toEqual({ moonSign: 2 });
	});
	it('择日页与外部调用都经这一个函数,源码里没有第二份「月座减一」', ()=>{
		['components/zeri/IndiaZeriMain.js', 'utils/aiTools/zeriSchools.js'].forEach((rel)=>{
			const s = read(rel);
			expect(`${rel}:${/\bindiaNatalPayload\(/.test(s)}`).toBe(`${rel}:true`);
			expect(`${rel}:${/[a-z]*sign\)?\s*-\s*1\b/i.test(s)}`).toBe(`${rel}:false`);
		});
	});
});
