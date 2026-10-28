import { splitAfterPunct, SENTENCE_END, CLAUSE_END } from '../splitAfterPunct';

// 对照组:后行断言写法(测试跑在 node 里,不进产物)
const viaLookbehind = (s, p)=>s.split(new RegExp(`(?<=[${p.replace(/[\]\\^-]/g, '\\$&')}])`));

describe('splitAfterPunct 与后行断言切句逐段相同', ()=>{
	test('穷举短串(句末标点集 / 分句标点集)', ()=>{
		[SENTENCE_END, CLAUSE_END].forEach((p)=>{
			const alphabet = ['a', '字', '\n', ' ', ...p.slice(0, 3), ...p.slice(-2)];
			let n = 0;
			const diffs = [];
			const gen = (prefix, d)=>{
				if(d === 0){
					n += 1;
					const a = JSON.stringify(viaLookbehind(prefix, p));
					const b = JSON.stringify(splitAfterPunct(prefix, p));
					if(a !== b && diffs.length < 5){ diffs.push([prefix, a, b]); }
					return;
				}
				alphabet.forEach((c)=>gen(prefix + c, d - 1));
			};
			for(let d = 0; d <= 5; d += 1){ gen('', d); }
			expect(n).toBeGreaterThan(30000);
			expect(diffs).toEqual([]);
		});
	});

	test('随机长串', ()=>{
		let seed = 7;
		const rnd = ()=>{ seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
		const pool = `甲乙丙丁 abc\n12${CLAUSE_END}`;
		for(let k = 0; k < 2000; k += 1){
			const len = Math.floor(rnd() * 60);
			let s = '';
			for(let i = 0; i < len; i += 1){ s += pool[Math.floor(rnd() * pool.length)]; }
			expect(splitAfterPunct(s, CLAUSE_END)).toEqual(viaLookbehind(s, CLAUSE_END));
			expect(splitAfterPunct(s, SENTENCE_END)).toEqual(viaLookbehind(s, SENTENCE_END));
		}
	});

	test('边界:空串、无标点、空值、标点集含正则特殊字符', ()=>{
		expect(splitAfterPunct('')).toEqual(['']);
		expect(splitAfterPunct('没有标点')).toEqual(['没有标点']);
		expect(splitAfterPunct(null)).toEqual(['']);
		expect(splitAfterPunct('一。二!三', SENTENCE_END)).toEqual(['一。', '二!', '三']);
		expect(splitAfterPunct('a-b]c^d\\e', '-]^\\')).toEqual(viaLookbehind('a-b]c^d\\e', '-]^\\'));
	});

	test('分句标点集含全角感叹号 / 问号 / 分号', ()=>{
		expect(CLAUSE_END).toEqual(expect.stringContaining('！'));
		expect(CLAUSE_END).toEqual(expect.stringContaining('？'));
		expect(CLAUSE_END).toEqual(expect.stringContaining('；'));
		expect(splitAfterPunct('甲年吉！乙年凶；丙年平', CLAUSE_END)).toEqual(['甲年吉！', '乙年凶；', '丙年平']);
	});
});
