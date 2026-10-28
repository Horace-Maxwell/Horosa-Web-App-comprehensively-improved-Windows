// 界面简繁 · 真实语料合同:玄学史资料库正文(数据在计算服务的资料库里,不在前端源码,全仓文案快照看不到)。
// 夹具 hantRealCorpus.fixture.json 每条 = [上下文, 该字位置, 繁体档应显示的字],逐条人判过。
//   ①「只」:量词「隻」的召回 ≥ 98%,副词「只」误转成「隻」为 0;没转对的只许是下面登记的几条(多一条少一条都红,要人判)。
//      —— 防「修好副词、坏了量词」(或反过来):量词判定改一处,这里一跑就知道真实文本上退了多少。
//   ②「于 / 朴 / 干事 / 台座」:白名单词跨词(百姓于是 / 救百姓于涂炭 / 俗姓朴)逐条全对。
const fs = require('fs');
const path = require('path');
const { toHant } = require('../hantConverter');

const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'hantRealCorpus.fixture.json'), 'utf8'));
const ROWS = FIXTURE.rows;

// 量词没认出来的(应作「隻」、显示「只」)——已逐条看过,属判据有意不收的写法:
//   「是只 + 非名词」(副词居多,只认名词起首)、「一只能走」(与「甲己9只能得」同形,按副词)、「两只是真鹤」(同「九百九十只是」)
const KNOWN_MISSES = ['落地竟是只背', '原来是只裸身', '出来，一只能走', '出来,一只能走', '两只是真鹤'];

function convertAt(s, p){
	const o = Array.from(toHant(s));
	return o.length === Array.from(s).length ? o[p] : null;
}

describe('真实语料 · 界面简繁', () => {
	it('夹具量足够(防取样静默失效)', () => {
		const zhi = ROWS.filter(([s, p])=>Array.from(s)[p] === '只');
		expect(ROWS.length).toBeGreaterThan(1500);
		expect(zhi.filter((r)=>r[2] === '隻').length).toBeGreaterThan(1000);
		expect(zhi.filter((r)=>r[2] === '只').length).toBeGreaterThan(150);
		expect(ROWS.filter(([s, p])=>Array.from(s)[p] !== '只').length).toBeGreaterThan(5);
	});

	it('①「只」:量词召回 ≥ 98%,副词误转为 0,没转对的只许是登记过的几条', () => {
		let want = 0;
		let got = 0;
		const falseHits = [];
		const misses = [];
		ROWS.forEach(([s, p, exp])=>{
			if(Array.from(s)[p] !== '只'){ return; }
			const out = convertAt(s, p);
			if(exp === '隻'){
				want += 1;
				if(out === '隻'){ got += 1; }else{ misses.push(s); }
			}else if(out === '隻'){
				falseHits.push(s);
			}
		});
		expect(falseHits).toEqual([]);
		expect(got / want).toBeGreaterThanOrEqual(0.98);
		const unexpected = misses.filter((s)=>!KNOWN_MISSES.some((k)=>s.indexOf(k) >= 0));
		expect(unexpected).toEqual([]);
		// 登记过的没转对的,每条都还在(规则改好了就从登记表删掉)
		expect(KNOWN_MISSES.filter((k)=>ROWS.some(([s])=>s.indexOf(k) >= 0) && !misses.some((s)=>s.indexOf(k) >= 0))).toEqual([]);
	});

	it('②「于 / 朴 / 干事 / 台座」:逐条全对', () => {
		const bad = ROWS.filter(([s, p])=>Array.from(s)[p] !== '只')
			.filter(([s, p, exp])=>convertAt(s, p) !== exp)
			.map(([s, p, exp])=>`${s}@${p}:应 ${exp},现 ${convertAt(s, p)}`);
		expect(bad).toEqual([]);
	});
});
