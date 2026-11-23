// 命题验证(./horosa verify):内核(纯函数、精确整数运算)与命令的端到端。
// 跑法:node --test headless/test/verify.test.js(端到端只用本地就能算的技法,不要计算服务;假的排盘服务只为让批量开跑)
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const K = require('../verifyKernel');
const V = require('../verify');
const VERIFY = path.join(__dirname, '..', 'verify.js');
const tmp = ()=>fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-verify-test-'));
const frac = (p)=>`${p.num}/${p.den}`;

describe('① 精确检验(与手算 / 朴素求和逐例相同)', ()=>{
	it('费希尔精确检验:手算值', ()=>{
		assert.equal(frac(K.fisherExact(3, 1, 1, 3, 'two-sided')), '17/35');
		assert.equal(frac(K.fisherExact(3, 1, 1, 3, 'greater')), '17/70');
		assert.equal(frac(K.fisherExact(3, 1, 1, 3, 'less')), '69/70');
		assert.equal(frac(K.fisherExact(10, 0, 0, 10, 'two-sided')), '1/92378');
		assert.equal(frac(K.fisherExact(0, 0, 0, 0, 'greater')), '1/1');
		assert.equal(frac(K.fisherExact(5, 0, 0, 0, 'two-sided')), '1/1');
	});
	it('费希尔:与逐项直接算的朴素求和逐例相同(各种边际)', ()=>{
		const naive = (a, b, c, d, alt)=>{
			const row1 = a + b; const col1 = a + c; const n = a + b + c + d;
			const lo = Math.max(0, col1 - (n - row1)); const hi = Math.min(row1, col1);
			const w = (x)=>K.binomial(row1, x) * K.binomial(n - row1, col1 - x);
			let num = 0n;
			for(let x = lo; x <= hi; x++){ if(alt === 'greater' ? x >= a : alt === 'less' ? x <= a : w(x) <= w(a)){ num += w(x); } }
			const den = K.binomial(n, col1); const g = K.gcd(num, den) || 1n;
			return `${num / g}/${den / g}`;
		};
		let cnt = 0;
		for(const [a, b, c, d] of [[1, 2, 3, 4], [0, 5, 5, 0], [7, 3, 2, 8], [12, 30, 9, 41], [50, 50, 50, 50], [1, 99, 0, 100], [20, 0, 15, 5], [3, 17, 40, 2]]){
			for(const alt of ['greater', 'less', 'two-sided']){ assert.equal(frac(K.fisherExact(a, b, c, d, alt)), naive(a, b, c, d, alt), `${a},${b},${c},${d} ${alt}`); cnt += 1; }
		}
		assert.equal(cnt, 24);
	});
	it('二项精确检验:手算值与朴素求和', ()=>{
		assert.equal(frac(K.binomialExact(7, 10, 1n, 2n, 'two-sided')), '11/32');
		assert.equal(frac(K.binomialExact(7, 10, 1n, 2n, 'greater')), '11/64');
		assert.equal(frac(K.binomialExact(3, 10, 1n, 2n, 'less')), '11/64');
		assert.equal(frac(K.binomialExact(0, 5, 0n, 1n, 'greater')), '1/1');
		assert.equal(frac(K.binomialExact(3, 5, 0n, 1n, 'greater')), '0/1');
		assert.equal(frac(K.binomialExact(5, 5, 1n, 1n, 'less')), '1/1');
		// 原假设比例是 0 或 1 时:观测到原假设下不可能的取值,双侧 p 是 0(不是 1)
		assert.equal(frac(K.binomialExact(3, 5, 0n, 1n, 'two-sided')), '0/1'); assert.equal(frac(K.binomialExact(0, 5, 0n, 1n, 'two-sided')), '1/1');
		assert.equal(frac(K.binomialExact(3, 5, 0n, 1n, 'less')), '1/1');
		assert.equal(frac(K.binomialExact(4, 5, 1n, 1n, 'two-sided')), '0/1'); assert.equal(frac(K.binomialExact(5, 5, 1n, 1n, 'two-sided')), '1/1');
		assert.equal(frac(K.binomialExact(4, 5, 1n, 1n, 'less')), '0/1'); assert.equal(frac(K.binomialExact(4, 5, 1n, 1n, 'greater')), '1/1');
		const naive = (k, n, r, s, alt)=>{
			const q = s - r; const ws = [];
			for(let x = 0; x <= n; x++){ ws.push(K.binomial(n, x) * r ** BigInt(x) * q ** BigInt(n - x)); }
			let num = 0n; ws.forEach((v, x)=>{ if(alt === 'greater' ? x >= k : alt === 'less' ? x <= k : v <= ws[k]){ num += v; } });
			const den = s ** BigInt(n); const g = K.gcd(num, den) || 1n;
			return `${num / g}/${den / g}`;
		};
		let cnt = 0;
		for(const n of [1, 2, 7, 25, 60]){ for(const [r, s] of [[1n, 2n], [1n, 12n], [3n, 10n], [9n, 10n]]){ for(let k = 0; k <= n; k += Math.max(1, Math.floor(n / 6))){ for(const alt of ['greater', 'less', 'two-sided']){
			assert.equal(frac(K.binomialExact(k, n, r, s, alt)), naive(k, n, r, s, alt), `${k}/${n} p0=${r}/${s} ${alt}`); cnt += 1;
		} } } }
		assert.ok(cnt > 200);
	});
	it('大表也精确:六万例的四格表给出确定的结果', ()=>{
		assert.equal(K.ratToSci(...Object.values(K.fisherExact(5200, 24800, 4800, 25200, 'greater')), 8), '6.1757909e-06');
	});
	it('分数的写法:小数 / 分数字面量 → 精确分数;定点与科学计数都四舍五入', ()=>{
		assert.deepEqual(K.parseRational('0.01').map(String), ['1', '100']);
		assert.deepEqual(K.parseRational('1.25').map(String), ['5', '4']);
		assert.deepEqual(K.parseRational('1/20').map(String), ['1', '20']);
		assert.throws(()=>K.parseRational('1e-3'), K.VerifyError);
		assert.throws(()=>K.parseRational('1/0'), K.VerifyError);
		assert.equal(K.ratToFixed(1n, 3n, 6), '0.333333'); assert.equal(K.ratToFixed(2n, 3n, 2), '0.67'); assert.equal(K.ratToFixed(-1n, 4n, 1), '-0.3');
		assert.equal(K.ratToSci(1n, 3n, 6), '3.33333e-01'); assert.equal(K.ratToSci(999999n, 1000000n, 3), '1.00e+00'); assert.equal(K.ratToSci(123456789n, 1n, 4), '1.235e+08');
		assert.equal(K.ratToText(0n, 5n), '0'); assert.equal(K.ratToText(3n, 0n), '无定义'); assert.equal(K.ratToText(1n, 1000000n), '1.00000e-06');
	});
	it('指纹:键的先后、空白不影响;值变了就变', ()=>{
		assert.equal(K.fingerprint({ a: 1, b: [1, 2, { c: 'x' }] }), K.fingerprint({ b: [1, 2, { c: 'x' }], a: 1 }));
		assert.notEqual(K.fingerprint({ a: 1 }), K.fingerprint({ a: 2 }));
		assert.equal(K.canonical({ b: undefined, a: null }), '{"a":null}');
	});
});

const CASE = (key, extra)=>({ key, fields: { gender: 'male', score: '72', ...((extra && extra.fields) || {}) }, categories: (extra && extra.categories) || [], events: (extra && extra.events) || [],
	results: (extra && extra.results) || { bazi: { ok: true, content: '[起盘信息]\n命造：乾造\n[神煞]\n年柱：羊刃\n评分：72 分', sections: [{ title: '起盘信息', text: '命造：乾造' }, { title: '神煞（四柱）', text: '年柱：羊刃' }] } } });

describe('② 判据:是 / 否 / 不知道', ()=>{
	const t = (spec, c, defs)=>K.compilePredicate(spec, defs || {}, '测试').test(c || CASE('a'));
	it('看技法正文:contains(数组 = 都要含)· regex · number · 只看某一段', ()=>{
		assert.equal(t({ technique: 'bazi', contains: '乾造' }), true);
		assert.equal(t({ technique: 'bazi', contains: ['乾造', '羊刃'] }), true);
		assert.equal(t({ technique: 'bazi', contains: ['乾造', '没有的'] }), false);
		assert.equal(t({ technique: 'bazi', regex: '命造[:：]\\s*乾' }), true);
		assert.equal(t({ technique: 'bazi', regex: 'QIAN', flags: 'i' }), false);
		assert.equal(t({ technique: 'bazi', number: { regex: '评分[:：]\\s*(\\d+)', op: '>=', value: 60 } }), true);
		assert.equal(t({ technique: 'bazi', number: { regex: '评分[:：]\\s*(\\d+)', op: '<', value: 60 } }), false);
		assert.equal(t({ technique: 'bazi', number: { regex: '没有这个[:：](\\d+)', op: '>=', value: 0 } }), false);
		assert.equal(t({ technique: 'bazi', section: '神煞', contains: '羊刃' }), true);
		assert.equal(t({ technique: 'bazi', section: '起盘信息', contains: '羊刃' }), false);      // 羊刃不在这一段
		assert.equal(t({ technique: 'bazi', section: '不存在的段', contains: '羊刃' }), false);
	});
	it('🔴 技法没起出来 = 不知道(null),不是「否」;三值逻辑的 all / any / not', ()=>{
		const failed = CASE('f', { results: { bazi: { ok: false, code: 'E_X' } } });
		const p = { technique: 'bazi', contains: '乾造' };
		assert.equal(t(p, failed), null);
		assert.equal(t({ not: p }, failed), null);
		assert.equal(t({ all: [p, { const: false }] }, failed), false);     // 有一个「否」即否
		assert.equal(t({ all: [p, { const: true }] }, failed), null);
		assert.equal(t({ any: [p, { const: true }] }, failed), true);       // 有一个「是」即是
		assert.equal(t({ any: [p, { const: false }] }, failed), null);
		assert.equal(t({ technique: 'ziwei', contains: 'x' }), null);        // 根本没算这个技法
	});
	it('🔴 正文被截断的格:看得见的部分里找到了 = 是;没找到 / 那一段不在 = 不知道(可能在被裁掉的后半截里),不是「否」', ()=>{
		const cut = CASE('t', { results: { bazi: { ok: true, truncated: true, content: '命造：乾造 评分：72', sections: [{ title: '起盘信息', text: '命造：乾造' }] } } });
		assert.equal(t({ technique: 'bazi', contains: '乾造' }, cut), true);
		assert.equal(t({ technique: 'bazi', contains: '羊刃' }, cut), null);
		assert.equal(t({ technique: 'bazi', section: '神煞', contains: '羊刃' }, cut), null);          // 这一段可能就在被裁掉的部分里
		assert.equal(t({ technique: 'bazi', section: '起盘信息', contains: '乾造' }, cut), true);
		assert.equal(t({ not: { technique: 'bazi', contains: '羊刃' } }, cut), null);
		assert.equal(t({ technique: 'bazi', number: { regex: '评分[:：]\\s*(\\d+)', op: '>=', value: 60 } }, cut), true);
		// 没截断的格照旧:没找到就是「否」
		assert.equal(t({ technique: 'bazi', contains: '没有的' }), false);
	});
	it('🔴 逐例先算好再丢正文:prepareCase 之后把正文删掉,判定结果与留着正文时相同', ()=>{
		const claim = { define: { 乾: { technique: 'bazi', contains: '乾造' }, 刃段: { technique: 'bazi', section: '神煞', contains: '羊刃' } },
			statements: [{ kind: 'implication', if: '乾', then: '刃段' }, { kind: 'rate', feature: { all: ['乾', { not: '刃段' }] }, p0: '1/2', minCases: 1 }], correction: 'none' };
		const mk = ()=>[CASE('a'), CASE('b', { results: { bazi: { ok: true, content: '命造：坤造', sections: [] } } }), CASE('c', { results: { bazi: { ok: false, code: 'E_X' } } }), CASE('d', { results: {} })];
		const full = mk(); const comp = K.compileClaim(claim);
		const want = JSON.stringify([K.evaluateClaim(comp, full), K.countDefinitions(comp, full)]);
		const lean = mk();
		lean.forEach((c)=>{ K.prepareCase(comp, c); Object.keys(c.results).forEach((k)=>{ if(c.results[k].ok){ c.results[k] = { ok: true }; } }); });
		assert.equal(JSON.stringify([K.evaluateClaim(comp, lean), K.countDefinitions(comp, lean)]), want);
		assert.ok(comp.leaves.length >= 2);
	});
	it('看这一例自带的资料:字段 / 分类 / 事件', ()=>{
		const c = CASE('c', { fields: { gender: 'female', birthYear: 1947, note: '' }, categories: ['1947 births', 'Birthplace Paris, FR'], events: [{ type: 'Relationship : Marriage', date: '1 May 1970' }] });
		assert.equal(t({ field: 'gender', eq: 'female' }, c), true);
		assert.equal(t({ field: 'gender', in: ['male', 'unknown'] }, c), false);
		assert.equal(t({ field: 'birthYear', gte: 1940, lte: 1949 }, c), true);
		assert.equal(t({ field: 'birthYear', gte: 1950 }, c), false);
		assert.equal(t({ field: 'note', exists: false }, c), true);          // 空串 = 没有
		assert.equal(t({ field: 'nope', eq: 'x' }, c), false);               // 资料里没写 = 否(不是不知道)
		assert.equal(t({ field: 'gender', regex: '^fe' }, c), true);
		assert.equal(t({ category: '1947 births' }, c), true);
		assert.equal(t({ category: 'Birthplace Paris', prefix: true }, c), true);
		assert.equal(t({ category: 'Birthplace Paris' }, c), false);
		assert.equal(t({ category: true, regex: 'births$' }, c), true);
		assert.equal(t({ event: { type: 'Marriage' } }, c), true);
		assert.equal(t({ event: { type: 'Divorce' } }, c), false);
	});
	it('按名字引用 define;写错的当场报(不认识的键、两种判据混写、绕回自己、正则写错、带 g 标志)', ()=>{
		assert.equal(t('男', CASE('a'), { 男: { field: 'gender', eq: 'male' } }), true);
		assert.equal(t({ ref: '男' }, CASE('a'), { 男: { field: 'gender', eq: 'male' } }), true);
		const bad = [[{ technique: 'bazi', contains: 'x', regex: 'y' }], [{ technique: 'bazi' }], [{ technique: 'bazi', contains: 'x', nope: 1 }], [{ field: 'g' }],
			[{ all: [] }], [{ technique: 'bazi', regex: '(' }], [{ technique: 'bazi', regex: 'x', flags: 'g' }], ['没定义'], [{ field: 'a', eq: 1, technique: 'bazi' }], [{}],
			['a', { a: 'b', b: 'a' }], [{ technique: 'bazi', number: { regex: '(\\d+)', op: '~', value: 1 } }]];
		bad.forEach(([spec, defs])=>assert.throws(()=>K.compilePredicate(spec, defs || {}, 'x'), K.VerifyError, JSON.stringify(spec)));
	});
});

describe('③ 三种命题与裁决', ()=>{
	const cases = [];
	for(let i = 0; i < 40; i++){
		const male = i % 2 === 0;
		cases.push(CASE(`c${i}`, { fields: { gender: male ? 'male' : 'female' }, results: { bazi: { ok: true, content: `命造：${male ? '乾' : '坤'}造${i % 4 === 0 ? ' 羊刃' : ''}`, sections: [] } } }));
	}
	const run = (statements, extra)=>K.evaluateClaim(K.compileClaim({ define: { 男: { field: 'gender', eq: 'male' }, 乾: { technique: 'bazi', contains: '乾造' }, 刃: { technique: 'bazi', contains: '羊刃' } }, statements, ...(extra || {}) }), cases);
	it('implication:没有反例 = 成立;有反例 = 不成立并列出;满足前件的例不够 = 样本不足', ()=>{
		const [a] = run([{ kind: 'implication', if: '男', then: '乾' }]);
		assert.deepEqual([a.verdict, a.support, a.counterexamples], ['holds', 20, 0]);
		const [b] = run([{ kind: 'implication', if: '男', then: '刃' }]);
		assert.deepEqual([b.verdict, b.support, b.counterexamples], ['refuted', 20, 10]);
		assert.equal(b.counterexampleKeys[0], 'c2');
		const [c] = run([{ kind: 'implication', if: { field: 'gender', eq: 'nobody' }, then: '乾' }]);
		assert.equal(c.verdict, 'insufficient');
		// 有反例就是不成立:不被「满足前件的例不够多」盖住
		const [d] = run([{ kind: 'implication', if: '男', then: '刃', minSupport: 1000 }]);
		assert.deepEqual([d.verdict, d.counterexamples], ['refuted', 10]);
		const [e] = run([{ kind: 'implication', if: '男', then: '乾', minSupport: 1000 }]);
		assert.equal(e.verdict, 'insufficient');
	});
	it('association:四格表、比例、提升、精确的 p 与门槛;方向反了 = 证据不足以支持', ()=>{
		const [a] = run([{ kind: 'association', feature: '男', label: '乾', alpha: '0.001' }], { correction: 'none' });
		assert.deepEqual(a.table, { featureAndLabel: 20, featureOnly: 0, labelOnly: 0, neither: 20 });
		assert.deepEqual([a.verdict, a.n, a.lift, a.rateWithFeature, a.rateWithoutFeature, a.oddsRatio], ['holds', 40, '2.000000', '1.000000', '0', '无定义']);
		assert.equal(a.p, K.ratToSci(1n, K.binomial(40, 20), 8));
		assert.equal(a.threshold, '1.0000000e-03');
		const [b] = run([{ kind: 'association', feature: '男', label: '乾', alternative: 'less' }], { correction: 'none' });
		assert.equal(b.verdict, 'not_supported');
		const [c] = run([{ kind: 'association', feature: '男', label: '刃', minLift: '3' }], { correction: 'none' });
		assert.deepEqual([c.table.featureAndLabel, c.table.labelOnly, c.significant, c.liftOk, c.verdict], [10, 0, true, false, 'not_supported']);   // 显著但提升不到门槛
	});
	it('association:例数不够 / 边际为零 = 样本不足(不给 p 的裁决)', ()=>{
		const [a] = run([{ kind: 'association', feature: '男', label: '乾', minCases: 100 }]);
		assert.equal(a.verdict, 'insufficient');
		const [b] = run([{ kind: 'association', feature: { const: true }, label: '乾' }]);   // 没有「无特征」的例
		assert.equal(b.verdict, 'insufficient');
	});
	it('rate:比例与给定值的精确比较', ()=>{
		const [a] = run([{ kind: 'rate', feature: '刃', p0: '1/2', alpha: '0.05' }], { correction: 'none' });
		assert.deepEqual([a.hits, a.n, a.rate, a.p0, a.verdict], [10, 40, '0.250000', '0.500000', 'holds']);
		assert.equal(a.p, K.ratToSci(...Object.values(K.binomialExact(10, 40, 1n, 2n, 'two-sided')), 8));
		const [b] = run([{ kind: 'rate', feature: '刃', p0: '0.25' }], { correction: 'none' });
		assert.equal(b.verdict, 'not_supported');     // 正好是 1/4:看不出不同
	});
	it('🔴 没起出来的例不进计数,并如实报出;where 圈定人群', ()=>{
		const mixed = cases.concat([CASE('bad1', { results: { bazi: { ok: false, code: 'E_X' } } }), CASE('bad2', { results: {} })]);
		const comp = K.compileClaim({ statements: [{ kind: 'association', feature: { field: 'gender', eq: 'male' }, label: { technique: 'bazi', contains: '乾造' }, where: { field: 'gender', in: ['male', 'female'] } }], correction: 'none' });
		const [a] = K.evaluateClaim(comp, mixed);
		assert.deepEqual([a.population, a.unknown, a.n], [42, 2, 40]);
		const comp2 = K.compileClaim({ statements: [{ kind: 'rate', feature: { technique: 'bazi', contains: '羊刃' }, p0: '1/2', where: { field: 'gender', eq: 'male' }, minCases: 5 }], correction: 'none' });
		const [b] = K.evaluateClaim(comp2, cases);
		assert.deepEqual([b.population, b.n, b.hits], [20, 20, 10]);
	});
	it('多条一起判的校正:bonferroni 把门槛除以条数;holm 逐条放宽;none 不动', ()=>{
		const st = [{ id: 'a', kind: 'rate', feature: '刃', p0: '1/2', alpha: '0.05' }, { id: 'b', kind: 'rate', feature: '乾', p0: '1/2', alpha: '0.05' }];
		const none = run(st, { correction: 'none' }); const bonf = run(st, { correction: 'bonferroni' }); const holm = run(st, { correction: 'holm' });
		assert.equal(none[0].threshold, '5.0000000e-02'); assert.equal(bonf[0].threshold, '2.5000000e-02');
		assert.deepEqual(holm.map((x)=>x.threshold), ['2.5000000e-02', '5.0000000e-02']);     // a 的 p 更小,先按 alpha/2;b 再按 alpha/1
		assert.deepEqual(none.map((x)=>x.verdict), ['holds', 'not_supported']);
	});
	it('🔴 校正的条数 = 命题文件里带检验的命题总数:样本不足的那几条也算(够不够要看数据,不能看了数据再决定除以几);「凡…则…」不算', ()=>{
		const st = [{ id: 'a', kind: 'rate', feature: '刃', p0: '1/2', alpha: '0.05' }, { id: 'b', kind: 'rate', feature: '乾', p0: '1/2', alpha: '0.05', minCases: 1000 },
			{ id: 'c', kind: 'association', feature: '男', label: '刃', alpha: '0.05', minSupport: 1000 }, { id: 'd', kind: 'implication', if: '男', then: '乾' }];
		const bonf = run(st, { correction: 'bonferroni' }); const holm = run(st, { correction: 'holm' });
		assert.deepEqual(bonf.map((x)=>x.verdict), ['holds', 'insufficient', 'insufficient', 'holds']);
		assert.equal(bonf[0].threshold, K.ratToSci(1n, 60n, 8));     // 0.05 / 3,不是 0.05 / 1
		assert.equal(holm[0].threshold, K.ratToSci(1n, 60n, 8));
		assert.deepEqual(K.applyCorrection([{ p: { num: 1n, den: 100n }, alpha: [1n, 20n] }], 'bonferroni', 5)[0], { threshold: [1n, 100n], significant: true });
		assert.deepEqual(K.applyCorrection([{ p: { num: 1n, den: 100n }, alpha: [1n, 20n] }], 'bonferroni')[0].threshold, [1n, 20n]);
	});
	it('🔴 判据计数:每个命名判据在全部命例上的 是 / 否 / 不知道(按名字排);没被命题用到的判据也数,它要看的技法也算进要起的技法', ()=>{
		const comp = K.compileClaim({ define: { 男: { field: 'gender', eq: 'male' }, 刃: { technique: 'bazi', contains: '羊刃' }, 写错的: { technique: 'bazi', contains: '没有这个词' },
			另一技法: { technique: 'ziwei', contains: '紫微' } }, statements: [{ kind: 'rate', feature: '刃', p0: '1/2' }] });
		assert.deepEqual(comp.techniques, ['bazi', 'ziwei']);
		const mixed = cases.concat([CASE('bad', { results: { bazi: { ok: false, code: 'E_X' } } })]);
		assert.deepEqual(K.countDefinitions(comp, mixed), [
			{ name: '写错的', yes: 0, no: 40, unknown: 1 }, { name: '刃', yes: 10, no: 30, unknown: 1 },
			{ name: '另一技法', yes: 0, no: 0, unknown: 41 }, { name: '男', yes: 21, no: 20, unknown: 0 }]);   // 起不出来的那一例自带的资料照样看得到(性别字段不靠技法)
		assert.deepEqual(K.countDefinitions(K.compileClaim({ statements: [{ kind: 'rate', feature: { const: true }, p0: '1/2' }] }), cases), []);
	});
	it('命题写错当场报:缺字段、不认识的键、alpha 不是字符串 / 出界、重复 id、没有命题', ()=>{
		const bad = [[{ kind: 'implication', if: '男' }], [{ kind: 'x' }], [{ kind: 'rate', feature: '刃', p0: 0.5 }], [{ kind: 'rate', feature: '刃', p0: '2' }],
			[{ kind: 'association', feature: '男', label: '乾', alpha: 0.01 }], [{ kind: 'association', feature: '男', label: '乾', alpha: '1.5' }],
			[{ kind: 'association', feature: '男', label: '乾', nope: 1 }], [{ id: 'x', kind: 'rate', feature: '刃', p0: '1/2' }, { id: 'x', kind: 'rate', feature: '刃', p0: '1/2' }], []];
		bad.forEach((st)=>assert.throws(()=>K.compileClaim({ define: { 男: { field: 'gender', eq: 'male' }, 乾: { technique: 'bazi', contains: '乾' }, 刃: { technique: 'bazi', contains: '刃' } }, statements: st }), K.VerifyError, JSON.stringify(st)));
		assert.throws(()=>K.compileClaim({ statements: [{ kind: 'rate', feature: { const: true }, p0: '1/2' }], correction: 'fdr' }), K.VerifyError);
	});
});

describe('③b 凭据复核的两层:判定层必须逐项相同;正文的差异另报', ()=>{
	const mk = (over)=>({
		verdict: 'holds',
		statements: [{ id: 's1', verdict: 'holds' }, { id: 's2', verdict: 'holds' }],
		engine: { version: '9.9.9', platform: 'darwin', arch: 'arm64' },
		fingerprints: { claim: 'c', cases: 'k', results: 'r', statements: 's', resultsByTechnique: { bazi: 'b1', astrochart: 'a1', ephemeris: 'e1' } },
		...(over || {}),
	});
	const cert = mk();
	it('四层都对得上 → 一致(full)', ()=>{
		const r = V.compareCertificates(cert, mk(), {});
		assert.deepEqual([r.consistent, r.level, r.differing, r.differingTechniques], [true, 'full', [], []]);
		assert.match(r.lines[0], /复核一致:命题、命例清单、起盘结果、判据计数、判定各层指纹都对得上;裁决 全部命题成立/);
	});
	it('🔴 只有正文不同(换了处理器 / 数学库的末位取整):判定层一致 → 缺省算一致并指出是哪些技法;--strict 算不一致', ()=>{
		const again = mk({ engine: { version: '9.9.9', platform: 'linux', arch: 'x64' },
			fingerprints: { claim: 'c', cases: 'k', results: 'r2', statements: 's', resultsByTechnique: { bazi: 'b1', astrochart: 'a1', ephemeris: 'e2' } } });
		const loose = V.compareCertificates(cert, again, {});
		assert.deepEqual([loose.consistent, loose.level, loose.differing, loose.differingTechniques], [true, 'statements', ['起盘结果'], ['ephemeris']]);
		assert.match(loose.lines.join('\n'), /复核一致\(判定层\)/); assert.match(loose.lines.join('\n'), /技法:ephemeris/);
		assert.match(loose.lines.join('\n'), /darwin arm64;这里:星阙 9\.9\.9 · linux x64/); assert.match(loose.lines.join('\n'), /--strict/);
		const strict = V.compareCertificates(cert, again, { strict: true });
		assert.deepEqual([strict.consistent, strict.level], [false, 'statements']);
		assert.match(strict.lines[0], /复核不一致\(--strict\)/);
	});
	it('🔴 判定层有一处不同 → 不一致(无论正文同不同),并说出哪条命题的裁决变了', ()=>{
		const changed = mk({ verdict: 'not_all_hold', statements: [{ id: 's1', verdict: 'holds' }, { id: 's2', verdict: 'not_supported' }],
			fingerprints: { ...cert.fingerprints, statements: 's-other' } });
		const r = V.compareCertificates(cert, changed, {});
		assert.deepEqual([r.consistent, r.level, r.differing], [false, 'none', ['判定(计数 / 检验值 / 裁决)']]);
		assert.match(r.lines.join('\n'), /命题 s2:凭据里是「成立」,这里是「证据不足以支持」/);
		const counts = mk({ fingerprints: { ...cert.fingerprints, results: 'r2', statements: 's-other' } });
		const r2 = V.compareCertificates(cert, counts, {});
		assert.equal(r2.consistent, false); assert.match(r2.lines.join('\n'), /各条命题的裁决与凭据相同\(差在计数或检验值的细处\)/);
		const defs = mk({ fingerprints: { ...cert.fingerprints, definitions: 'd2' } });
		assert.deepEqual(V.compareCertificates({ ...cert, fingerprints: { ...cert.fingerprints, definitions: 'd1' } }, defs, {}).differing, ['判据计数']);
		assert.equal(V.compareCertificates(cert, defs, {}).consistent, true, '早先的凭据没有判据计数这一层:不因此判不一致');
		const cases = mk({ fingerprints: { ...cert.fingerprints, cases: 'k2' } });
		assert.match(V.compareCertificates(cert, cases, {}).lines.join('\n'), /命例清单不同/);
		const claim = mk({ fingerprints: { ...cert.fingerprints, claim: 'c2' } });
		assert.deepEqual(V.compareCertificates(cert, claim, {}).differing, ['命题']);
	});
	it('旧凭据没有逐技法指纹:照样比,只是说不出是哪些技法', ()=>{
		const old = mk({ fingerprints: { claim: 'c', cases: 'k', results: 'r', statements: 's' } });
		const again = mk({ fingerprints: { ...cert.fingerprints, results: 'r2' } });
		const r = V.compareCertificates(old, again, {});
		assert.deepEqual([r.consistent, r.level, r.differingTechniques], [true, 'statements', []]);
	});
});

// ── 端到端:假的排盘服务(只为让批量开跑;用到的技法都是本地就能算的)──
let fake = null; let fakePort = 0; let javaPort = 0;
const freePort = ()=>new Promise((resolve)=>{ const s = net.createServer(); s.listen(0, '127.0.0.1', ()=>{ const p = s.address().port; s.close(()=>resolve(p)); }); });
before(async ()=>{
	fake = http.createServer((req, res)=>{ res.writeHead(503, { 'Content-Type': 'application/json' }); res.end('{"ResultCode":503}'); });
	await new Promise((r)=>fake.listen(0, '127.0.0.1', r));
	fakePort = fake.address().port; javaPort = await freePort();
});
after(()=>{ if(fake){ fake.close(); } });
const CHILDREN = new Set();
after(()=>{ CHILDREN.forEach((c)=>{ try{ c.kill('SIGKILL'); }catch(e){ /* noop */ } }); });
function runVerify(args, home){
	return new Promise((resolve)=>{
		const env = { ...process.env, HOROSA_HOME: home, HOROSA_SERVER_PORT: `${javaPort}`, HOROSA_CHART_PORT: `${fakePort}` };
		delete env.HOROSA_SERVER_ROOT;
		const c = spawn(process.execPath, [VERIFY, ...args, '--python-only', '--no-probe'], { env, cwd: home, stdio: ['ignore', 'pipe', 'pipe'] });
		CHILDREN.add(c);
		let out = ''; let err = '';
		c.stdout.on('data', (b)=>{ out += b; }); c.stderr.on('data', (b)=>{ err += b; });
		c.on('exit', (code)=>{ CHILDREN.delete(c); resolve({ code, out, err }); });
	});
}
function writeCases(file, n){
	const lines = ['编号,姓名,date,time,zone,lat,lon,gender,职业'];
	for(let i = 0; i < n; i++){
		const p2 = (x)=>`${x}`.padStart(2, '0');
		lines.push(`p${i},人${i},${1950 + (i * 7) % 60}-${p2(1 + (i * 5) % 12)}-${p2(1 + (i * 3) % 27)},${p2((i * 11) % 24)}:${p2((i * 13) % 60)},+08:00,${(20 + i % 20).toFixed(2)},${(100 + i % 30).toFixed(2)},${i % 2 ? '男' : '女'},${i % 3 ? '甲' : '乙'}`);
	}
	fs.writeFileSync(file, `${lines.join('\n')}\n`);
}
const CLAIM = (extra)=>({
	title: '端到端',
	cases: { file: 'cases.csv' },
	clock: { now: '2030-06-01 12:00', tz: 'Asia/Shanghai' },
	define: { 男: { field: 'gender', eq: '男' }, 乾造: { technique: 'bazi', section: '起盘信息', contains: '命造：乾造' } },
	statements: [
		{ id: '男即乾造', kind: 'implication', if: '男', then: '乾造' },
		{ id: '男与乾造', kind: 'association', feature: '男', label: '乾造', alpha: '0.001', minCases: 10 },
	],
	...(extra || {}),
});

describe('④ 端到端:命题 → 起盘 → 裁决 → 凭据 → 复核', ()=>{
	it('🔴 成立的命题退 0;凭据带四层指纹;照凭据重跑复核一致;换一台「机器」(另一个数据目录)也一致', async ()=>{
		const home = tmp();
		writeCases(path.join(home, 'cases.csv'), 24);
		fs.writeFileSync(path.join(home, 'claim.json'), JSON.stringify(CLAIM()));
		const r = await runVerify(['claim.json'], home);
		assert.equal(r.code, 0, r.err + r.out);
		assert.match(r.out, /\[成立\] 男即乾造/); assert.match(r.out, /\[成立\] 男与乾造/); assert.match(r.out, /裁决:全部命题成立/);
		const dir = path.join(home, 'claim.verify');
		const cert = JSON.parse(fs.readFileSync(path.join(dir, 'certificate.json'), 'utf8'));
		assert.equal(cert.format, V.FORMAT); assert.equal(cert.verdict, 'holds'); assert.equal(cert.cases.count, 24);
		assert.deepEqual(cert.claim.clock, { now: '2030-06-01T04:00:00.000Z', tz: 'Asia/Shanghai' });
		assert.deepEqual(cert.statements[1].table, { featureAndLabel: 12, featureOnly: 0, labelOnly: 0, neither: 12 });
		['claim', 'cases', 'results', 'statements'].forEach((k)=>assert.match(cert.fingerprints[k], /^[0-9a-f]{64}$/));
		assert.equal(cert.fingerprints.claim, K.fingerprint(cert.claim));
		assert.equal(cert.fingerprints.statements, K.fingerprint(cert.statements));
		assert.deepEqual(Object.keys(cert.fingerprints.resultsByTechnique), ['bazi']); assert.match(cert.fingerprints.resultsByTechnique.bazi, /^[0-9a-f]{64}$/);
		assert.deepEqual(cert.definitions, [{ name: '乾造', yes: 12, no: 12, unknown: 0 }, { name: '男', yes: 12, no: 12, unknown: 0 }]);
		assert.equal(cert.fingerprints.definitions, K.fingerprint(cert.definitions));
		assert.match(r.out, /判据\(在全部命例上\):\n {2}乾造:是 12 · 否 12\n {2}男:是 12 · 否 12/);
		assert.ok(fs.existsSync(path.join(dir, 'report.txt')) && fs.existsSync(path.join(dir, 'cases.jsonl')) && fs.existsSync(path.join(dir, 'results.jsonl')));
		const chk = await runVerify(['--check', path.join(dir, 'certificate.json')], home);
		assert.equal(chk.code, 0, chk.err + chk.out); assert.match(chk.out, /复核一致/);
		const chkStrict = await runVerify(['--check', path.join(dir, 'certificate.json'), '--strict', '--json'], home);
		assert.equal(chkStrict.code, 0, chkStrict.err + chkStrict.out); assert.deepEqual([JSON.parse(chkStrict.out).consistent, JSON.parse(chkStrict.out).level], [true, 'full']);
		const chk2 = await runVerify(['--check', path.join(dir, 'certificate.json'), '--cases', path.join(home, 'cases.csv')], tmp());
		assert.equal(chk2.code, 0, chk2.err + chk2.out); assert.match(chk2.out, /复核一致/);
		// 凭据只记命例文件名(不带本机路径);整个目录搬到别处,照命题里的相对路径找得到命例,复核一致
		assert.equal(cert.cases.file, 'cases.csv'); assert.doesNotMatch(JSON.stringify(cert), new RegExp(home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
		const moved = tmp(); fs.cpSync(home, path.join(moved, 'copy'), { recursive: true });
		const chk3 = await runVerify(['--check', path.join(moved, 'copy', 'claim.verify', 'certificate.json'), '--strict'], tmp());
		assert.equal(chk3.code, 0, chk3.err + chk3.out); assert.match(chk3.out, /复核一致/);
	});
	it('🔴 本机存的技法设置不进结果:数据目录里改过八字的设置,凭据各层指纹与空目录跑出来的相同(口径只认命题里的 options)', async ()=>{
		const mk = async (settings)=>{
			const home = tmp();
			if(settings){ const d = path.join(home, 'headless', 'data'); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'localStorage.json'), JSON.stringify(settings)); }
			writeCases(path.join(home, 'cases.csv'), 6);
			fs.writeFileSync(path.join(home, 'claim.json'), JSON.stringify(CLAIM({ statements: [{ id: 's', kind: 'implication', if: '男', then: '乾造' }] })));
			const r = await runVerify(['claim.json', '--json'], home);
			assert.equal(r.code, 0, r.err + r.out);
			return JSON.parse(r.out).fingerprints;
		};
		const clean = await mk(null);
		const tuned = await mk({ 'horosa.ai.mount.techniqueDefaults.v1': JSON.stringify({ version: 1, techniques: { bazi: { godKeyPos: '日' } } }), 'horosa.chart.newChartSeeds.v1': JSON.stringify({ godKeyPos: '日', phaseType: 1 }) });
		assert.deepEqual(tuned, clean);
	});
	it('🔴 "sections" 只取要用的段(原样交给批量);写错形状 / 技法没被用到当场报;只改门槛时 --reuse 不重跑', async ()=>{
		const home = tmp();
		writeCases(path.join(home, 'cases.csv'), 12);
		const base = CLAIM({ sections: { bazi: ['起盘信息'] }, statements: [{ id: '男即乾造', kind: 'implication', if: '男', then: '乾造' }, { id: '男与乾造', kind: 'association', feature: '男', label: '乾造', alpha: '0.05', minCases: 10 }] });
		fs.writeFileSync(path.join(home, 'claim.json'), JSON.stringify(base));
		const r = await runVerify(['claim.json', '--json'], home);
		assert.equal(r.code, 0, r.err + r.out);
		const cert = JSON.parse(r.out);
		assert.deepEqual(cert.claim.sections, { bazi: ['起盘信息'] });
		assert.deepEqual(cert.run.cells.bazi, { ok: 12, failed: 0, truncated: 0 });
		const row = JSON.parse(fs.readFileSync(path.join(home, 'claim.verify', 'results.jsonl'), 'utf8').split('\n')[0]);
		assert.deepEqual(row.results.bazi.sections.map((s)=>s.title).filter((x)=>x && x.indexOf('起盘信息') < 0), [], '正文里只有要的那一段');
		// 只改门槛:起盘结果照用
		const stat0 = fs.statSync(path.join(home, 'claim.verify', 'results.jsonl')).mtimeMs;
		const st2 = base.statements.map((s)=>(s.kind === 'association' ? { ...s, alpha: '0.01' } : s));
		fs.writeFileSync(path.join(home, 'claim.json'), JSON.stringify({ ...base, statements: st2 }));
		const again = await runVerify(['claim.json', '--reuse', '--json'], home);
		assert.equal(again.code, 0, again.err + again.out); assert.equal(JSON.parse(again.out).run.reused, true);
		assert.equal(fs.statSync(path.join(home, 'claim.verify', 'results.jsonl')).mtimeMs, stat0);
		// 写错的
		for(const bad of [{ sections: { bazi: [] } }, { sections: { bazi: 'x' } }, { sections: { ziwei: ['命宫'] } }, { sections: [] }]){
			fs.writeFileSync(path.join(home, 'bad.json'), JSON.stringify(CLAIM(bad)));
			const b = await runVerify(['bad.json'], home);
			assert.equal(b.code, 2, JSON.stringify(bad) + b.err); assert.match(b.err, /sections/);
		}
	});
	it('🔴 不成立的命题退 1 并列出反例;--reuse 不重跑起盘;--json 只打凭据', async ()=>{
		const home = tmp();
		writeCases(path.join(home, 'cases.csv'), 12);
		const claim = CLAIM({ statements: [{ id: '甲业即乾造', kind: 'implication', if: { field: '职业', eq: '甲' }, then: '乾造' }] });
		fs.writeFileSync(path.join(home, 'c.json'), JSON.stringify(claim));
		const r = await runVerify(['c.json', '-o', 'out'], home);
		assert.equal(r.code, 1, r.err + r.out);
		assert.match(r.out, /\[不成立\(有反例\)\] 甲业即乾造/); assert.match(r.out, /反例:p2、p4、p8、p10/);
		const stat0 = fs.statSync(path.join(home, 'out', 'results.jsonl')).mtimeMs;
		const again = await runVerify(['c.json', '-o', 'out', '--reuse', '--json'], home);
		assert.equal(again.code, 1);
		const cert = JSON.parse(again.out);
		assert.equal(cert.run.reused, true); assert.equal(cert.statements[0].counterexamples, 4);
		assert.equal(fs.statSync(path.join(home, 'out', 'results.jsonl')).mtimeMs, stat0, '起盘结果没有被重写');
		assert.doesNotMatch(again.err, /\[batch\] 完成/);
	});
	it('🔴 凭据被改过 / 命例文件变了:复核认得出', async ()=>{
		const home = tmp();
		writeCases(path.join(home, 'cases.csv'), 12);
		fs.writeFileSync(path.join(home, 'claim.json'), JSON.stringify(CLAIM({ statements: [{ id: 's', kind: 'implication', if: '男', then: '乾造' }] })));
		const r = await runVerify(['claim.json'], home);
		assert.equal(r.code, 0, r.err + r.out);
		const file = path.join(home, 'claim.verify', 'certificate.json');
		const cert = JSON.parse(fs.readFileSync(file, 'utf8'));
		const t1 = JSON.parse(JSON.stringify(cert)); t1.statements[0].support = 99;
		fs.writeFileSync(path.join(home, 't1.json'), JSON.stringify(t1));
		const a = await runVerify(['--check', 't1.json'], home);
		assert.equal(a.code, 2); assert.match(a.err, /判定内容.*指纹对不上/);
		const t2 = JSON.parse(JSON.stringify(cert)); t2.claim.statements[0].then = { const: true };
		fs.writeFileSync(path.join(home, 't2.json'), JSON.stringify(t2));
		const b = await runVerify(['--check', 't2.json'], home);
		assert.equal(b.code, 2); assert.match(b.err, /命题.*指纹对不上/);
		const t3 = JSON.parse(JSON.stringify(cert)); t3.definitions[0].yes = 99;
		fs.writeFileSync(path.join(home, 't3.json'), JSON.stringify(t3));
		const b3 = await runVerify(['--check', 't3.json'], home);
		assert.equal(b3.code, 2); assert.match(b3.err, /判据计数.*指纹对不上/);
		// 命例文件改一行(一个男改成女):命例清单的指纹变了,裁决也可能变
		const txt = fs.readFileSync(path.join(home, 'cases.csv'), 'utf8').replace('p1,人1,', 'p1,人壹,');
		fs.writeFileSync(path.join(home, 'cases.csv'), txt);
		const c = await runVerify(['--check', file], home);
		assert.equal(c.code, 1, c.err + c.out); assert.match(c.out, /复核不一致:命例清单/);
	});
	it('🔴 判据写错(没有一例满足)在报告里点出来;随包的示例命题跑得通', async ()=>{
		const home = tmp();
		writeCases(path.join(home, 'cases.csv'), 12);
		const claim = CLAIM({ define: { 男: { field: 'gender', eq: '男' }, 乾造: { technique: 'bazi', section: '起盘信息', contains: '命造：乾造' }, 写错: { technique: 'bazi', regex: '日主[:：]甲' } },
			statements: [{ id: 's', kind: 'rate', feature: '写错', p0: '1/2', minCases: 5 }] });
		fs.writeFileSync(path.join(home, 'claim.json'), JSON.stringify(claim));
		const r = await runVerify(['claim.json'], home);
		assert.match(r.out, /写错:是 0 · 否 12 {2}← 没有一例满足:检查写法/);
		// 示例:三条命题各得一种裁决里的两种(成立 ×2、证据不足以支持 ×1)→ 退 1
		const ex = path.join(__dirname, '..', 'examples', 'verify');
		const home2 = tmp();
		fs.copyFileSync(path.join(ex, 'claim-sample.json'), path.join(home2, 'claim-sample.json'));
		fs.copyFileSync(path.join(ex, 'cases-sample.csv'), path.join(home2, 'cases-sample.csv'));
		const e = await runVerify(['claim-sample.json', '--json'], home2);
		assert.equal(e.code, 1, e.err + e.out);
		const cert = JSON.parse(e.out);
		assert.deepEqual(cert.statements.map((x)=>x.verdict), ['holds', 'holds', 'not_supported']);
		assert.equal(cert.cases.count, 60);
		assert.ok(cert.definitions.every((d)=>d.yes > 0 && d.no > 0 && d.unknown === 0), JSON.stringify(cert.definitions));
	});
	it('命题文件写错 → 退 2 并说明(缺 clock、不认识的键、没用到技法、命例文件不存在)', async ()=>{
		const home = tmp();
		writeCases(path.join(home, 'cases.csv'), 3);
		const tryClaim = async (obj)=>{ fs.writeFileSync(path.join(home, 'x.json'), typeof obj === 'string' ? obj : JSON.stringify(obj)); return runVerify(['x.json'], home); };
		const noClock = CLAIM(); delete noClock.clock;
		let r = await tryClaim(noClock); assert.equal(r.code, 2); assert.match(r.err, /clock\.now 必填/);
		r = await tryClaim(CLAIM({ nope: 1 })); assert.equal(r.code, 2); assert.match(r.err, /不认识的键「nope」/);
		r = await tryClaim(CLAIM({ define: {}, statements: [{ kind: 'rate', feature: { field: 'gender', eq: '男' }, p0: '1/2' }] })); assert.equal(r.code, 2); assert.match(r.err, /没有用到任何技法/);
		r = await tryClaim(CLAIM({ cases: { file: 'missing.csv' } })); assert.equal(r.code, 2); assert.match(r.err, /命例文件不存在/);
		r = await tryClaim('{oops'); assert.equal(r.code, 2); assert.match(r.err, /不是合法 JSON/);
		r = await tryClaim(CLAIM({ clock: { now: '昨天' } })); assert.equal(r.code, 2); assert.match(r.err, /clock/);
		r = await runVerify([], home); assert.equal(r.code, 2);
		r = await runVerify(['--explain'], home); assert.equal(r.code, 0); assert.match(r.out, /命题三种/);
	});
});

describe('④b 按起课时间的命例(cases.kind = timepoint)', ()=>{
	it('🔴 命例是一批起课时间:起按时间起盘的技法、照常出凭据与复核;写错的 kind / 配名人库当场报', async ()=>{
		const home = tmp();
		const lines = ['id,time,zone,lat,lon,label'];
		for(let i = 0; i < 16; i++){ const p2 = (x)=>`${x}`.padStart(2, '0'); lines.push(`m${i},20${p2(10 + i)}-${p2(1 + (i * 5) % 12)}-${p2(1 + (i * 7) % 27)} ${p2((i * 5) % 24)}:${p2((i * 13) % 60)},+08:00,39.9,116.4,${i % 2 ? 'x' : 'y'}`); }
		fs.writeFileSync(path.join(home, 'moments.csv'), `${lines.join('\n')}\n`);
		const claim = { title: '起课时间', cases: { file: 'moments.csv', kind: 'timepoint' }, clock: { now: '2030-06-01 12:00', tz: 'Asia/Shanghai' },
			define: { 阳遁: { technique: 'qimen', regex: '阳遁' }, 阴遁: { technique: 'qimen', regex: '阴遁' }, 有盘: { technique: 'qimen', contains: '[起盘信息]' } },
			statements: [{ id: '非阳即阴', kind: 'implication', if: { not: '阳遁' }, then: '阴遁', minSupport: 1 }, { id: '都起得出来', kind: 'implication', if: { const: true }, then: '有盘' }] };
		fs.writeFileSync(path.join(home, 'claim.json'), JSON.stringify(claim));
		const r = await runVerify(['claim.json', '--json'], home);
		assert.equal(r.code, 0, r.err + r.out);
		const cert = JSON.parse(r.out);
		assert.equal(cert.claim.cases.kind, 'timepoint'); assert.equal(cert.cases.count, 16);
		const by = Object.fromEntries(cert.definitions.map((d)=>[d.name, d]));
		assert.equal(by.有盘.yes, 16); assert.equal(by.阳遁.yes + by.阴遁.yes, 16); assert.ok(by.阳遁.yes > 0 && by.阴遁.yes > 0, JSON.stringify(by));
		const chk = await runVerify(['--check', path.join(home, 'claim.verify', 'certificate.json'), '--strict'], home);
		assert.equal(chk.code, 0, chk.err + chk.out); assert.match(chk.out, /复核一致/);
		const bad = async (cases)=>{ fs.writeFileSync(path.join(home, 'bad.json'), JSON.stringify({ ...claim, cases })); return runVerify(['bad.json'], home); };
		let e = await bad({ file: 'moments.csv', kind: 'moment' }); assert.equal(e.code, 2); assert.match(e.err, /cases\.kind 只认 natal \/ timepoint/);
		e = await bad({ celebrities: true, kind: 'timepoint' }); assert.equal(e.code, 2); assert.match(e.err, /不能配内置名人库/);
		// 缺省(出生资料)不把 kind 写进规范化的命题:已有凭据的命题指纹不因多了这个选项而变
		assert.equal(V.loadClaim({ ...claim, cases: { file: 'moments.csv', kind: 'natal' }, define: {}, statements: [{ kind: 'rate', feature: { technique: 'bazi', contains: 'x' }, p0: '1/2' }] }, home).claim.cases.kind, undefined);
	});
});

describe('⑤ 运行包带上了命题验证', ()=>{
	const P = require('../batchPack');
	it('🔴 入口脚本用到的本目录文件都在随包清单里(少一个,服务器上一跑就缺模块);示例与启动脚本齐全', ()=>{
		const dir = path.join(__dirname, '..');
		const seen = new Set(); const queue = ['verify.js', 'batch.js'];
		while(queue.length){
			const f = queue.pop();
			if(seen.has(f)){ continue; }
			seen.add(f);
			const src = fs.readFileSync(path.join(dir, f), 'utf8');
			const re = /require\('\.\/([A-Za-z0-9_]+)'\)/g; let m;
			while((m = re.exec(src))){ queue.push(`${m[1]}.js`); }
		}
		const missing = Array.from(seen).filter((f)=>P.HEADLESS_FILES.indexOf(f) < 0).sort();
		assert.deepEqual(missing, [], `随包清单(batchPack.HEADLESS_FILES)里缺:${missing.join(', ')}`);
		assert.ok(seen.has('verifyKernel.js') && seen.has('runtime.js') && seen.size >= 6);
		P.VERIFY_EXAMPLES.forEach((f)=>assert.ok(fs.existsSync(path.join(dir, 'examples', 'verify', f)), f));
		assert.match(P.VERIFY_LAUNCHER, /headless\/verify\.js" "\$@"\n$/); assert.match(P.LAUNCHER, /headless\/batch\.js" "\$@"\n$/);
		assert.match(P.VERIFY_LAUNCHER, /^#!\/usr\/bin\/env bash\n/);
		// 起盘用不到的大件数据不进包;代码与其它数据照进
		const a = P.packExclude('astropy'); const v = P.packExclude('vendor'); const f = P.packExclude('flatlib-ctrad2');
		['astrostudy/xuanshi/data/editorial.sqlite', 'astrostudy/xuanshi/data/public_data.sqlite', 'astrostudy/xuanshi/data/editorial.sqlite-wal', 'tests/test_x.py', 'astrostudy/__pycache__'].forEach((x)=>assert.equal(a.test(x), true, x));
		['astrostudy/xuanshi/db.py', 'astrostudy/xuanshi/data/china.geo.json', 'astrostudy/perchart.py', 'websrv/webchartsrv.py'].forEach((x)=>assert.equal(a.test(x), false, x));
		['kinastro/tools/cities', 'kinastro/tools/cities/cities.json'].forEach((x)=>assert.equal(v.test(x), true, x));
		['kinastro/astro/qizheng/calculator.py', 'kinastro/tools/parse_tieban_text.py', 'kintaiyi/src/kintaiyi/config.py'].forEach((x)=>assert.equal(v.test(x), false, x));
		assert.equal(f.test('flatlib/resources/swefiles/sepl_18.se1'), false); assert.equal(f.test('flatlib/__pycache__'), true);
		// 本机运行留下的东西不进包:结果缓存、后端日志(变量没展开的目录名)、测试缓存、点开头的配置、egg-info、日志文件
		['.horosa-cache', '.horosa-cache/paramhash/_chart/ab.json', '${env:HOME:-${sys:user.home}}', '${env:HOME:-${sys:user.home}}/.horosa-logs/astrostudyboot/raw/reqbody.log',
			'.pytest_cache/v/cache/lastfailed', '.gitignore', 'astrostudy.egg-info/PKG-INFO', 'websrv/run.log', 'astrostudy/.DS_Store'].forEach((x)=>assert.equal(a.test(x), true, x));
		['kinqimen/.streamlit/config.toml', 'kinastro/.github/workflows/test.yml', 'kinastro/.pytest_cache'].forEach((x)=>assert.equal(v.test(x), true, x));
		assert.equal(f.test('flatlib.egg-info'), true);
		// 名字里带点 / 美元号但不在开头的照进
		['astrostudy/helper.py', 'astrostudy/data/a.b.json', 'resources/x$y.txt', 'astrostudy/logic.py', 'astrostudy/catalog.json'].forEach((x)=>assert.equal(a.test(x), false, x));
		// 依赖清单:包里只带 Linux 那份(自成一份,不再引用 mac 清单)
		const packSrc = fs.readFileSync(path.join(dir, 'batchPack.js'), 'utf8');
		assert.match(packSrc, /'scripts\/requirements\/linux-python\.txt'\]\.forEach/); assert.doesNotMatch(packSrc, /'scripts\/requirements\/mac-python\.txt'/);
		// 示例命题的命例文件就在它旁边(相对路径)
		const claim = JSON.parse(fs.readFileSync(path.join(dir, 'examples', 'verify', 'claim-sample.json'), 'utf8'));
		assert.equal(claim.cases.file, 'cases-sample.csv');
	});
});
