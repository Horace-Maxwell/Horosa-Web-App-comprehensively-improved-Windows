// 真随机起卦合同:随机起卦 / 抽牌 / 掷骰的随机数一律取自系统随机源(crypto.getRandomValues),不留伪随机退路;
// 需要原样重开的技法把取到的原始字节存成「真随机记录」(tr1- + 十六进制),引擎按顺序直接读记录里的位。
import nodeCrypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
	randomBytes, randomUint32, randomInt, randomBit, newEntropySeed, isEntropySeed, entropySeedBytes,
	isReplayableSeed, parseManualSeedInput, seedDisplayText, ENTROPY_SEED_PREFIX,
} from '../trueRandom';
import { entropyReader } from '../entropyTape';
import { readSource } from './helpers/sourceSet';
import { randomNum } from '../helper';
import { randYao } from '../../components/gua/GuaConst';
import { yarrowYao } from '../../components/gua/LiuYaoConst';
import { castLingqi, resolveLingqiSeed, LINGQI_ENTROPY_BYTES } from '../../components/lingqi/core/lingqiCast';
import { shuffle, tarotShuffle, newTarotRandomSeed } from '../../components/tarot/engine/shuffle';
import { resolveSeed, TAROT_PAGE_SETTINGS } from '../../components/tarot/main/settings';
import { qiGuaByDaYan, qiGuaByYaoQian } from '../../components/xiaochengtu/core/xiaochengtuQiGua';

const SRC = path.resolve(__dirname, '../..');
const sha256 = (buf)=>nodeCrypto.createHash('sha256').update(buf).digest();
const hexOf = (bytes)=>Buffer.from(bytes).toString('hex');
// 卡方上界:自由度 df 的均值 df、标准差 sqrt(2df);取均值 + 8 个标准差(真随机下越界概率可忽略,取数有偏则必越)
const chiLimit = (df)=>df + 8 * Math.sqrt(2 * df);
const chiSquare = (counts, expected)=>counts.reduce((acc, c)=>acc + ((c - expected) * (c - expected)) / expected, 0);

describe('系统随机源', ()=>{
	test('取数范围与参数校验', ()=>{
		expect(randomBytes(70000)).toHaveLength(70000);   // 超过单次 65536 字节上限也取得满
		expect(()=>randomBytes(0)).toThrow(RangeError);
		for(let i = 0; i < 200; i++){
			const u = randomUint32();
			expect(Number.isInteger(u) && u >= 0 && u < 4294967296).toBe(true);
			expect([0, 1]).toContain(randomBit());
			expect(randomInt(1)).toBe(0);
			const v = randomInt(6);
			expect(Number.isInteger(v) && v >= 0 && v < 6).toBe(true);
			const n = randomNum(3);
			expect(Number.isInteger(n) && n >= 0 && n < 1000).toBe(true);
		}
		expect(()=>randomInt(0)).toThrow(RangeError);
		expect(()=>randomInt(4294967297)).toThrow(RangeError);
	});

	test('拒绝采样:落在「不是 n 的整数倍」那截尾巴里的数丢掉重取,不用取模凑', ()=>{
		const saved = globalThis.crypto;
		const feed = [4294967295, 4294967294, 7];   // n = 3 时上界 4294967295 起的尾巴要丢
		let calls = 0;
		Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues: (arr)=>{ arr[0] = feed[calls]; calls += 1; return arr; } }, configurable: true, writable: true });
		try{
			expect(randomInt(3)).toBe(4294967294 % 3);
			expect(calls).toBe(2);
		}finally{
			Object.defineProperty(globalThis, 'crypto', { value: saved, configurable: true, writable: true });
		}
	});

	test('没有系统随机源就报错,绝不退回 Math.random', ()=>{
		const saved = globalThis.crypto;
		// 抛错时测试框架自己会重映射堆栈(source-map 的快排用 Math.random),与业务无关:只记不是它调的
		const orig = Math.random;
		const ours = [];
		let busy = false;
		const spy = jest.spyOn(Math, 'random').mockImplementation(()=>{
			if(!busy){
				busy = true;
				try{ const st = `${new Error().stack || ''}`; if(!/node_modules[\\/]source-map/.test(st)){ ours.push(st); } }finally{ busy = false; }
			}
			return orig.call(Math);
		});
		Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
		try{
			expect(()=>randomUint32()).toThrow('没有系统随机源');
			expect(()=>randomInt(6)).toThrow('没有系统随机源');
			expect(()=>newEntropySeed(4)).toThrow('没有系统随机源');
			expect(()=>randYao()).toThrow('没有系统随机源');
			expect(()=>resolveLingqiSeed('random', null, null)).toThrow('没有系统随机源');
			expect(()=>resolveSeed('random', 0, null, 'three')).toThrow('没有系统随机源');
			expect(()=>qiGuaByDaYan({})).toThrow('没有系统随机源');
			expect(ours).toEqual([]);
		}finally{
			Object.defineProperty(globalThis, 'crypto', { value: saved, configurable: true, writable: true });
			spy.mockRestore();
		}
	});

	test('各技法的随机起法都不碰 Math.random / 当前时刻', ()=>{
		const rnd = jest.spyOn(Math, 'random');
		const now = jest.spyOn(Date, 'now');
		try{
			for(let i = 0; i < 20; i++){
				randYao(); yarrowYao(); randomNum(); randomNum(2);
				castLingqi(resolveLingqiSeed('random', null, null));
				shuffle(resolveSeed('random', 0, null, 'celtic'), { size: 78 });
				qiGuaByDaYan({}); qiGuaByYaoQian({});
			}
			expect(rnd).not.toHaveBeenCalled();
			expect(now).not.toHaveBeenCalled();
		}finally{
			rnd.mockRestore(); now.mockRestore();
		}
	});

	test('等概率:骰面 / 钱 / 蓍草十六分的频数都过卡方', ()=>{
		const N = 60000;
		const die = new Array(6).fill(0);
		const twelve = new Array(12).fill(0);
		const coin = [0, 0];
		for(let i = 0; i < N; i++){ die[randomInt(6)] += 1; twelve[randomInt(12)] += 1; coin[randomBit()] += 1; }
		expect(chiSquare(die, N / 6)).toBeLessThan(chiLimit(5));
		expect(chiSquare(twelve, N / 12)).toBeLessThan(chiLimit(11));
		expect(chiSquare(coin, N / 2)).toBeLessThan(chiLimit(1));
		// 六爻:三钱(老阳 / 老阴各 1/8)与蓍草(老阳 3/16、少阳 5/16、少阴 7/16、老阴 1/16)
		const coins = { '1t': 0, '1f': 0, '0f': 0, '0t': 0 };
		const yarrow = { '1t': 0, '1f': 0, '0f': 0, '0t': 0 };
		const M = 32000;
		for(let i = 0; i < M; i++){
			const a = randYao(); coins[`${a.value}${a.change ? 't' : 'f'}`] += 1;
			const b = yarrowYao(); yarrow[`${b.value}${b.change ? 't' : 'f'}`] += 1;
		}
		const chiOf = (got, probs)=>Object.keys(probs).reduce((acc, k)=>acc + ((got[k] - M * probs[k]) ** 2) / (M * probs[k]), 0);
		expect(chiOf(coins, { '1t': 1 / 8, '1f': 3 / 8, '0f': 3 / 8, '0t': 1 / 8 })).toBeLessThan(chiLimit(3));
		expect(chiOf(yarrow, { '1t': 3 / 16, '1f': 5 / 16, '0f': 7 / 16, '0t': 1 / 16 })).toBeLessThan(chiLimit(3));
	});
});

describe('真随机记录', ()=>{
	test('写法、判定、短写、手填解析', ()=>{
		const s = newEntropySeed(32);
		expect(s).toMatch(/^tr1-[0-9a-f]{64}$/);
		expect(s.startsWith(ENTROPY_SEED_PREFIX)).toBe(true);
		expect(isEntropySeed(s)).toBe(true);
		expect(hexOf(entropySeedBytes(s))).toBe(s.slice(4));
		expect(newEntropySeed(32)).not.toBe(s);
		['', 'tr1-', 'tr1-abc', 'tr1-zz', 'rnd-123', 12345, null, undefined, `${s}|fof`].forEach((bad)=>expect(isEntropySeed(bad)).toBe(false));
		expect(entropySeedBytes('rnd-1')).toBeNull();
		expect(isReplayableSeed(s)).toBe(true);
		expect(isReplayableSeed(0)).toBe(true);
		expect(isReplayableSeed('42')).toBe(true);
		[undefined, null, '', true, 'abc'].forEach((bad)=>expect(isReplayableSeed(bad)).toBe(false));
		expect(seedDisplayText('tr1-a3f9')).toBe('真随机 a3f9');
		expect(seedDisplayText(s)).toBe(`真随机 ${s.slice(4, 12)}…`);
		expect(seedDisplayText(12345)).toBe('12345');
		expect(seedDisplayText('rnd-7')).toBe('rnd-7');
		expect(seedDisplayText(null)).toBe('');
		expect(parseManualSeedInput(` ${s.toUpperCase().replace('TR1', 'tr1')} `)).toBe(s);
		expect(parseManualSeedInput('12a34', 999999999)).toBe(1234);
		expect(parseManualSeedInput('99999999999', 999999999)).toBe(999999999);
		expect(parseManualSeedInput('', 10)).toBe(0);
	});

	test('读法:逐字节、高位在前;int 拒绝采样;chance(0.5) 读一位', ()=>{
		const r = entropyReader('tr1-a5f0');   // 1010 0101 1111 0000
		expect([r.bool(), r.bool(), r.bool(), r.bool()]).toEqual([true, false, true, false]);
		expect(r.bits(4)).toBe(5);
		expect(r.int(10)).toBe(0);   // 先读到 1111 = 15 ≥ 10 丢掉,再读 0000
		expect(r.bitsUsed()).toBe(16);
		expect(r.extended()).toBe(0);
		const c = entropyReader('tr1-80');
		expect(c.chance(0.5)).toBe(true);
		expect(c.chance(0.5)).toBe(false);
		expect(c.int(1)).toBe(0);
		expect(c.bitsUsed()).toBe(2);   // int(1) 不读
		const p = entropyReader('tr1-40000000c0000000');
		expect(p.chance(0.3)).toBe(true);    // 0x40000000 / 2^32 = 0.25 < 0.3
		expect(p.chance(0.3)).toBe(false);   // 0xc0000000 / 2^32 = 0.75
		expect(()=>entropyReader('rnd-1')).toThrow(TypeError);
	});

	// 这组数与 Python 侧 tests/test_truerandom.py 的同名用例逐个相同:两边读同一条记录必须读出同样的数
	test('跨语言向量:同一条记录两边读法一致;读完后按「记录全文 + 序号」的 SHA-256 续接', ()=>{
		const seed = 'tr1-9f3a12cd77e0';
		const r = entropyReader(seed);
		const got = [r.bits(5), r.int(10), r.int(78), r.bits(1), r.int(6), r.int(16)];
		expect(got).toEqual([19, 7, 33, 0, 2, 12]);
		expect(r.extended()).toBe(0);
		const tape = Buffer.from('9f3a12cd77e0', 'hex');
		const e = entropyReader('tr1-ff');
		e.bits(8);
		const first = sha256(Buffer.concat([Buffer.from('ff', 'hex'), Buffer.from([0, 0, 0, 0])]));
		const second = sha256(Buffer.concat([Buffer.from('ff', 'hex'), Buffer.from([0, 0, 0, 1])]));
		const read = [];
		for(let i = 0; i < 40; i++){ read.push(e.bits(8)); }
		expect(hexOf(read)).toBe(first.toString('hex') + second.toString('hex').slice(0, 16));
		expect(e.extended()).toBe(2);
		// 分段:各流只读自己那一段;续接时掺进流名,互不相同
		const a = entropyReader(seed, { offset: 0, length: 2, domain: '' });
		const b = entropyReader(seed, { offset: 2, length: 2, domain: 'fof' });
		expect([a.bits(8), a.bits(8)]).toEqual([0x9f, 0x3a]);
		expect([b.bits(8), b.bits(8)]).toEqual([0x12, 0xcd]);
		const extA = a.bits(8);
		const extB = b.bits(8);
		expect(extA).toBe(sha256(Buffer.concat([tape, Buffer.from([0, 0, 0, 0])]))[0]);
		expect(extB).toBe(sha256(Buffer.concat([tape, Buffer.from('|fof', 'utf8'), Buffer.from([0, 0, 0, 0])]))[0]);
	});
});

describe('灵棋:随机掷棋读真随机记录', ()=>{
	test('十二枚棋各读一位(上 4 → 中 4 → 下 4),同一记录原样重开', ()=>{
		expect(LINGQI_ENTROPY_BYTES).toBe(2);
		expect(castLingqi('tr1-ffff').counts).toEqual([4, 4, 4]);
		expect(castLingqi('tr1-0000').counts).toEqual([0, 0, 0]);
		const r = castLingqi('tr1-a5c0');   // 1010 | 0101 | 1100
		expect(r.faces).toEqual([[true, false, true, false], [false, true, false, true], [true, true, false, false]]);
		expect(r.counts).toEqual([2, 2, 2]);
		const seed = resolveLingqiSeed('random', null, null);
		expect(castLingqi(seed)).toEqual(castLingqi(seed));
	});
	test('每层正面数服从二项 B(4, ½)', ()=>{
		const N = 16000;
		const hist = [0, 0, 0, 0, 0];
		for(let i = 0; i < N; i++){ castLingqi(resolveLingqiSeed('random', null, null)).counts.forEach((c)=>{ hist[c] += 1; }); }
		const probs = [1, 4, 6, 4, 1].map((k)=>k / 16);
		const chi = hist.reduce((acc, c, i)=>acc + ((c - 3 * N * probs[i]) ** 2) / (3 * N * probs[i]), 0);
		expect(chi).toBeLessThan(chiLimit(4));
	});
	test('手动 / 时间种子仍是确定性起法(旧卦例逐字节照旧)', ()=>{
		expect(castLingqi('rnd-123456')).toEqual(castLingqi('rnd-123456'));
		expect(castLingqi('rnd-123456').counts).toEqual([2, 2, 3]);
		expect(castLingqi('t-2611211030').counts).toEqual([2, 1, 3]);
	});
});

describe('塔罗:随机抽牌读真随机记录', ()=>{
	const SIZES = [22, 32, 36, 52, 56, 78, 79, 97];
	test('记录长度:一律 1344 字节(含开钥五操作那五段)—— 先按别的牌阵抽、再换到开钥牌阵,也读得到记录原文', ()=>{
		expect(newTarotRandomSeed('celtic')).toMatch(/^tr1-[0-9a-f]{2688}$/);
		expect(newTarotRandomSeed('opening_of_key')).toMatch(/^tr1-[0-9a-f]{2688}$/);
		expect(resolveSeed('random', 0, null, 'three')).toMatch(/^tr1-[0-9a-f]{2688}$/);
		// 按普通牌阵取的记录,开钥五操作的五条流全部读自记录原文(不续接)
		const seed = resolveSeed('random', 0, null, 'three');
		['ook1', 'ook2', 'ook3', 'ook4', 'ook5'].forEach((lane)=>{
			expect([lane, shuffle(`${seed}|${lane}`, { size: 78, usesReversals: true, pReversed: 0.5 }).entropy.extended]).toEqual([lane, 0]);
		});
		// 早先的短记录(只有前四段)照旧能读:主洗牌结果与同一记录的前 384 字节相同
		const short = `tr1-${seed.slice(4, 4 + 768)}`;
		expect(shuffle(short, { size: 78, usesReversals: true, pReversed: 0.5 }).order).toEqual(shuffle(seed, { size: 78, usesReversals: true, pReversed: 0.5 }).order);
	});
	test('新抽的牌:各牌组张数下都是合法排列、全部读自记录原文(不续接)、同一记录原样重开', ()=>{
		for(let round = 0; round < 120; round++){
			const seed = newTarotRandomSeed('opening_of_key');
			SIZES.forEach((size)=>{
				const sh = shuffle(seed, { size, usesReversals: true, pReversed: 0.5 });
				expect(sh.order.slice().sort((x, y)=>x - y)).toEqual(Array.from({ length: size }, (_, i)=>i));
				expect(sh.reversed).toHaveLength(size);
				expect(sh.entropy.extended).toBe(0);
				const again = shuffle(seed, { size, usesReversals: true, pReversed: 0.5 });
				expect(again.order).toEqual(sh.order);
				expect(again.reversed).toEqual(sh.reversed);
				// 逆位关:同一副牌序,朝向全正
				const off = shuffle(seed, { size, usesReversals: false });
				expect(off.order).toEqual(sh.order);
				expect(off.reversed.every((v)=>v === false)).toBe(true);
				// 各子流各读各的一段,都不续接
				expect(shuffle(`${seed}|fof`, { size, usesReversals: false, take: 3 }).entropy.extended).toBe(0);
				expect(shuffle(`${seed}|cut`, { size, usesReversals: false, take: 1 }).entropy.extended).toBe(0);
				expect(shuffle(`${seed}|timing`, { size: Math.min(size, 56), usesReversals: false }).entropy.extended).toBe(0);
				[1, 2, 3, 4, 5].forEach((op)=>{
					expect(shuffle(`${seed}|ook${op}`, { size, usesReversals: true, pReversed: 0.5 }).entropy.extended).toBe(0);
				});
			});
		}
	});
	test('各子流互不相干;只定前几位时与整副洗完的前几位相同', ()=>{
		const seed = newTarotRandomSeed('opening_of_key');
		const main = shuffle(seed, { size: 78 }).order;
		const subs = ['fof', 'cut', 'timing', 'ook1', 'ook2', 'ook3', 'ook4', 'ook5'].map((k)=>shuffle(`${seed}|${k}`, { size: 78, usesReversals: false }).order.join(','));
		expect(new Set([main.join(','), ...subs]).size).toBe(9);
		const full = shuffle(`${seed}|fof`, { size: 78, usesReversals: false }).order;
		const head = shuffle(`${seed}|fof`, { size: 78, usesReversals: false, take: 3 }).order;
		expect(head.slice(0, 3)).toEqual(full.slice(0, 3));
	});
	test('早先的短记录(只有前四段)换到开钥牌阵:读到头后确定性续接,仍可原样重开', ()=>{
		const seed = `tr1-${newTarotRandomSeed().slice(4, 4 + 768)}`;   // 384 字节:没有开钥那几段
		const a = shuffle(`${seed}|ook3`, { size: 78, usesReversals: true, pReversed: 0.5 });
		const b = shuffle(`${seed}|ook3`, { size: 78, usesReversals: true, pReversed: 0.5 });
		expect(a.entropy.extended).toBeGreaterThan(0);
		expect(b.order).toEqual(a.order);
		expect(b.reversed).toEqual(a.reversed);
		// 没划过段的子流名:同样只由记录决定
		expect(shuffle(`${seed}|later`, { size: 40 }).order).toEqual(shuffle(`${seed}|later`, { size: 40 }).order);
	});
	test('等概率:首张牌在 78 张上均匀,正逆各半', ()=>{
		const N = 39000;
		const first = new Array(78).fill(0);
		let rev = 0;
		for(let i = 0; i < N; i++){
			const sh = shuffle(newEntropySeed(192), { size: 78, usesReversals: true, pReversed: 0.5 });
			first[sh.order[0]] += 1;
			if(sh.reversed[0]){ rev += 1; }
		}
		expect(chiSquare(first, N / 78)).toBeLessThan(chiLimit(77));
		expect(chiSquare([rev, N - rev], N / 2)).toBeLessThan(chiLimit(1));
	});
	test('不带逆位的牌组(逆位概率 0)一位都不多读;生辰 / 手动种子仍是确定性洗牌', ()=>{
		const seed = newEntropySeed(192);
		const noRev = shuffle(seed, { size: 36, usesReversals: true, pReversed: 0 });
		expect(noRev.reversed.every((v)=>v === false)).toBe(true);
		expect(noRev.entropy.bitsUsed).toBe(shuffle(seed, { size: 36, usesReversals: false }).entropy.bitsUsed);
		const legacy = tarotShuffle('horosa-tarot-default');
		expect(legacy.entropy).toBeUndefined();
		expect(legacy.order.slice(0, 8)).toEqual(tarotShuffle('horosa-tarot-default').order.slice(0, 8));
		expect(legacy.order.slice(0, 8)).toEqual([65, 50, 46, 40, 48, 76, 55, 36]);
	});
});

describe('塔罗:种子来源默认是随机', ()=>{
	test('页面设置的出厂值与页面初始状态都是「随机」;「出生信息」是要自己选的可复现档', ()=>{
		expect(TAROT_PAGE_SETTINGS.schema.seedMode.def).toBe('random');
		expect(TAROT_PAGE_SETTINGS.schema.seedMode.oneOf).toEqual(['birth', 'random']);
		const page = readSource(path.join(SRC, 'components/tarot/TarotMain.js'));   // 页面门面 + 拆出去的子模块全集
		expect(page).toContain("seedMode: 'random', manualSeed: 0");
		expect(page).not.toContain("seedMode: 'birth'");
		// 下拉里「随机」排第一
		expect(page.indexOf('<Option value="random">随机</Option>')).toBeGreaterThan(0);
		expect(page.indexOf('<Option value="random">随机</Option>')).toBeLessThan(page.indexOf('<Option value="birth">'));
	});
	test('不改设置直接抽牌 = 真随机:每次是一段新的真随机记录,与出生信息无关', ()=>{
		const fields = { name: { value: '甲' }, lat: { value: '30n00' }, lon: { value: '120e00' } };
		const def = TAROT_PAGE_SETTINGS.schema.seedMode.def;
		const a = resolveSeed(def, 0, fields, 'three');
		const b = resolveSeed(def, 0, fields, 'three');
		expect(isEntropySeed(a) && isEntropySeed(b)).toBe(true);
		expect(a).not.toBe(b);
		expect(resolveSeed('birth', 0, fields, 'three')).toBe(resolveSeed('birth', 0, fields, 'three'));   // 可复现档照旧
	});
});

describe('小成图:大衍 / 摇钱没给种子就是真随机', ()=>{
	test('六爻都在 6–9;填了种子仍按种子复现', ()=>{
		for(let i = 0; i < 100; i++){
			qiGuaByDaYan({}).counts.forEach((c)=>expect([6, 7, 8, 9]).toContain(c));
			qiGuaByYaoQian({ seed: '' }).counts.forEach((c)=>expect([6, 7, 8, 9]).toContain(c));
		}
		expect(qiGuaByDaYan({ seed: 42 }).counts).toEqual(qiGuaByDaYan({ seed: 42 }).counts);
		expect(qiGuaByYaoQian({ seed: 42 }).counts).toEqual(qiGuaByYaoQian({ seed: 42 }).counts);
	});
	test('分布:蓍草 3/5/7/1 之十六,摇钱 1/3/3/1 之八', ()=>{
		const N = 6000;
		const dy = { 6: 0, 7: 0, 8: 0, 9: 0 };
		const yq = { 6: 0, 7: 0, 8: 0, 9: 0 };
		for(let i = 0; i < N; i++){
			qiGuaByDaYan({}).counts.forEach((c)=>{ dy[c] += 1; });
			qiGuaByYaoQian({}).counts.forEach((c)=>{ yq[c] += 1; });
		}
		const T = N * 6;
		const chiOf = (got, probs)=>Object.keys(probs).reduce((acc, k)=>acc + ((got[k] - T * probs[k]) ** 2) / (T * probs[k]), 0);
		expect(chiOf(dy, { 9: 3 / 16, 7: 5 / 16, 8: 7 / 16, 6: 1 / 16 })).toBeLessThan(chiLimit(3));
		expect(chiOf(yq, { 6: 1 / 8, 7: 3 / 8, 8: 3 / 8, 9: 1 / 8 })).toBeLessThan(chiLimit(3));
	});
});

// 起卦 / 抽牌的代码里不许再出现伪随机:技法目录(components 下除几个与起卦无关的目录外全部,加 divination/)
// 不得调用 Math.random,也不得拿当前时刻当种子。记录 id、重试抖动、贴图名这类与起卦无关的用途集中在放行的目录 / 文件里。
describe('源码守卫:技法代码里没有伪随机', ()=>{
	const ALLOWED_DIRS = ['aianalysis', 'planetarium', 'jieqi'];   // 界面元素 id / 贴图名 / 出错占位签名,与起卦无关
	const ALLOWED_FILES = ['divination/zeri/schemeStore.js'];   // 方案 id
	const walk = (dir, out)=>{
		fs.readdirSync(dir, { withFileTypes: true }).forEach((ent)=>{
			const full = path.join(dir, ent.name);
			if(ent.isDirectory()){ if(ent.name !== '__tests__' && ent.name !== 'node_modules'){ walk(full, out); } return; }
			if(/\.jsx?$/.test(ent.name) && !/\.test\.js$/.test(ent.name)){ out.push(full); }
		});
		return out;
	};
	const stripComments = (code)=>code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
	const files = [];
	fs.readdirSync(path.join(SRC, 'components'), { withFileTypes: true }).forEach((ent)=>{
		if(ent.isDirectory() && ALLOWED_DIRS.indexOf(ent.name) < 0){ walk(path.join(SRC, 'components', ent.name), files); }
	});
	walk(path.join(SRC, 'divination'), files);
	const scoped = files.filter((f)=>ALLOWED_FILES.indexOf(path.relative(SRC, f).split(path.sep).join('/')) < 0);

	test('扫描范围不空', ()=>{
		expect(scoped.length).toBeGreaterThan(500);
		expect(scoped.some((f)=>f.endsWith(path.join('gua', 'GuaConst.js')))).toBe(true);
		expect(scoped.some((f)=>f.endsWith(path.join('tarot', 'engine', 'shuffle.js')))).toBe(true);
	});
	test('技法代码不调用 Math.random', ()=>{
		const hits = scoped.filter((f)=>/Math\s*\.\s*random\s*\(/.test(stripComments(fs.readFileSync(f, 'utf8')))).map((f)=>path.relative(SRC, f));
		expect(hits).toEqual([]);
	});
	test('技法代码不拿当前时刻当种子', ()=>{
		const re = /seed\w*\s*[:=][^;\n]*(Date\.now\(\)|getTime\(\)|performance\.now\(\))/i;
		const hits = scoped.filter((f)=>re.test(stripComments(fs.readFileSync(f, 'utf8')))).map((f)=>path.relative(SRC, f));
		expect(hits).toEqual([]);
	});
	test('公共随机入口与 AI 代摇不含 Math.random;helper 里只剩界面 id 两处', ()=>{
		const read = (rel)=>stripComments(fs.readFileSync(path.join(SRC, rel), 'utf8'));
		['utils/trueRandom.js', 'utils/entropyTape.js', 'utils/aiTools/tools/castRandomCase.js', 'utils/aiTools/divinationCast.js'].forEach((rel)=>{
			expect(/Math\s*\.\s*random/.test(read(rel))).toBe(false);
		});
		const helper = read('utils/helper.js');
		const body = helper.slice(helper.indexOf('export function randomNum'), helper.indexOf('export function gcj02ToGps'));
		expect(body).toContain('randomInt(');
		expect(/Math\s*\.\s*random/.test(body)).toBe(false);
	});
	test('请求加密的传输钥取自系统随机源:源码里没有 Math.random(换钥的运行时判据在 rsaSessionKey.test.js)', ()=>{
		const src = stripComments(fs.readFileSync(path.join(SRC, 'utils/rsahelper.js'), 'utf8'));
		expect(/Math\s*\.\s*random/.test(src)).toBe(false);
		expect(src).toContain('randomInt(txt.length)');
	});
});
