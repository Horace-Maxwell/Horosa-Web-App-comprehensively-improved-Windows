/**
 * 埃及占星流派层 golden —— 两份自检脚本逐条移植为 jest。
 *
 * 判据来自传世古籍的算术不变量（三套界的逐宫和/逐星总度、外貌循环、周期数、ZR、法达、映点），
 * 这些数在文献里是硬数字：算出来对不上，就是表被改坏了。
 */
import {
	FACE_SEQ, SIGN_DOMICILE_RULERS, SIGN_ORDER, EGYPT_DECANS,
	faceRulerAt, triplicityDecanRuler, decanRulerAt, decanNumberAt, decansOrderedBy,
	EGYPT_DECAN_RULER_SYSTEMS, EGYPT_DECAN_ANCHORS,
	greekDecan, ancientDecan, norm360,
} from '../../divination/data/egyptianData';
import {
	EGYPT_GODS, EGYPT_GOD_EDITIONS, egyptianGodSign, egyptianGodSegments, EGYPT_GODS_DISCLAIMER,
} from '../../divination/data/egyptianGods';
import { EGYPTIAN_TERMS, PTOLEMAIC_TERMS, TETRABIBLOS_TERMS } from '../../divination/data/dignities';

// 界表用小写行星键、三元组 [ruler, start, end]；旬主星用首字母大写。两侧各自保留原形，
// 只在比对处统一，避免为了测试去改任何一边的生产数据。
const P5 = ['saturn', 'jupiter', 'mars', 'venus', 'mercury'];
const lc = (s2)=>`${s2}`.toLowerCase();

function termTotals(table){
	const t = { saturn: 0, jupiter: 0, mars: 0, venus: 0, mercury: 0 };
	SIGN_ORDER.forEach((sign)=>{
		table[sign].forEach(([ruler, start, end])=>{ t[lc(ruler)] += end - start; });
	});
	return t;
}

describe('三套界：逐宫合 30、五星各一次、逐星总度', ()=>{
	[['埃及界', EGYPTIAN_TERMS], ['托勒密界·经典传本', PTOLEMAIC_TERMS], ['托勒密界·校勘本', TETRABIBLOS_TERMS]].forEach(([name, table])=>{
		it(`${name}：每宫 5 段合 30°，且五星各出现一次`, ()=>{
			SIGN_ORDER.forEach((sign)=>{
				const rows = table[sign];
				expect(rows.length).toBe(5);
				let prev = 0;
				const rulers = [];
				rows.forEach(([ruler, start, end])=>{
					expect(start).toBe(prev);                    // 段首尾相接，无缝无叠
					expect(end).toBeGreaterThan(start);
					rulers.push(lc(ruler));
					prev = end;
				});
				expect(prev).toBe(30);                          // 逐宫合 30
				expect(new Set(rulers).size).toBe(5);            // 五星各一次
				P5.forEach((p)=>{ expect(rulers).toContain(p); });
			});
		});
	});

	it('埃及界逐星总度 ♄57 ♃79 ♂66 ♀82 ☿76（合 360）', ()=>{
		const t = termTotals(EGYPTIAN_TERMS);
		expect(t).toEqual({ saturn: 57, jupiter: 79, mars: 66, venus: 82, mercury: 76 });
		expect(Object.values(t).reduce((a, b)=>a + b, 0)).toBe(360);
	});

	// ── 托勒密界两传本：拿对表验对不变量 ─────────────────────────────────────
	// 项目把托勒密界分立成两张，各与后端 lockstep、各有测试锁死：
	//   PTOLEMAIC_TERMS   = 经典传本(textus receptus 1647，判读侧 termsVariant=2)
	//   TETRABIBLOS_TERMS = 校勘本 / 批判本(termsVariant=1)
	// 「逐星总度 = 埃及界总度」是**校勘本**的不变量（托勒密自述其重建与古人总数吻合）；
	// 经典传本因抄本传承在双子/天秤/狮子/金牛/摩羯诸宫另有读法，总度自成一格（♄58 ♃80 ♂64），
	// 这是传本差异而非讹误 —— 故不可拿校勘本的不变量去要求经典传本。
	it('校勘本逐星总度 = 埃及界总度（托勒密刻意保留古表的寿命分配总数）', ()=>{
		expect(termTotals(TETRABIBLOS_TERMS)).toEqual(termTotals(EGYPTIAN_TERMS));
		expect(termTotals(TETRABIBLOS_TERMS)).toEqual({ saturn: 57, jupiter: 79, mars: 66, venus: 82, mercury: 76 });
	});

	it('校勘本天秤 ♄6 ♀5 ☿5 ♃8 ♂6（五星齐全，合 30）', ()=>{
		const widths = TETRABIBLOS_TERMS.libra.map(([ruler, start, end])=>[lc(ruler), end - start]);
		expect(widths).toEqual([['saturn', 6], ['venus', 5], ['mercury', 5], ['jupiter', 8], ['mars', 6]]);
		expect(widths.reduce((a, w)=>a + w[1], 0)).toBe(30);
	});

	it('经典传本自成一格（♄58 ♃80 ♂64，合 360）—— 传本差异，非讹误', ()=>{
		expect(termTotals(PTOLEMAIC_TERMS)).toEqual({ saturn: 58, jupiter: 80, mars: 64, venus: 82, mercury: 76 });
		expect(Object.values(termTotals(PTOLEMAIC_TERMS)).reduce((a, b)=>a + b, 0)).toBe(360);
	});

	it('两传本的分歧恰在六宫（其余六宫逐格相同）', ()=>{
		const differ = SIGN_ORDER.filter((sg)=>JSON.stringify(PTOLEMAIC_TERMS[sg]) !== JSON.stringify(TETRABIBLOS_TERMS[sg]));
		expect(differ.sort()).toEqual(['capricorn', 'gemini', 'leo', 'libra', 'scorpio', 'taurus'].sort());
	});

});

describe('迦勒底界（算法生成，昼/夜逐星总度）', ()=>{
	// 度数恒为 8,7,6,5,4；四类起始序列按三分性轮替；夜盘交换 ♄/☿ 先后。
	const W = [8, 7, 6, 5, 4];
	const FIRE = ['Jupiter', 'Venus', 'Saturn', 'Mercury', 'Mars'];
	const EARTH = ['Venus', 'Saturn', 'Mercury', 'Mars', 'Jupiter'];
	const AIR = ['Saturn', 'Mercury', 'Mars', 'Jupiter', 'Venus'];
	const WATER = ['Mars', 'Jupiter', 'Venus', 'Saturn', 'Mercury'];
	const BY_SIGN = [FIRE, EARTH, AIR, WATER, FIRE, EARTH, AIR, WATER, FIRE, EARTH, AIR, WATER];
	const swapSaMe = (seq)=>{
		const out = seq.slice();
		const i = out.indexOf('Saturn');
		const j = out.indexOf('Mercury');
		out[i] = 'Mercury'; out[j] = 'Saturn';
		return out;
	};
	const totals = (night)=>{
		const t = { saturn: 0, jupiter: 0, mars: 0, venus: 0, mercury: 0 };
		BY_SIGN.forEach((seq)=>{
			const use = night ? swapSaMe(seq) : seq;
			use.forEach((r, i)=>{ t[r.toLowerCase()] += W[i]; });
		});
		return t;
	};

	it('每宫度数 8,7,6,5,4 合 30；五星各一次', ()=>{
		expect(W.reduce((a, b)=>a + b, 0)).toBe(30);
		BY_SIGN.forEach((seq)=>{ expect(new Set(seq).size).toBe(5); });
	});

	it('昼盘 ♄78 ♃72 ♂69 ♀75 ☿66；夜盘 ♄66 ☿78（其余不变）', ()=>{
		expect(totals(false)).toEqual({ saturn: 78, jupiter: 72, mars: 69, venus: 75, mercury: 66 });
		expect(totals(true)).toEqual({ saturn: 66, jupiter: 72, mars: 69, venus: 75, mercury: 78 });
		expect(Object.values(totals(false)).reduce((a, b)=>a + b, 0)).toBe(360);
		expect(Object.values(totals(true)).reduce((a, b)=>a + b, 0)).toBe(360);
	});
});

describe('迦勒底外貌（36 旬主星）', ()=>{
	it('faces[0] 与 faces[35] 同为火星（36=7×5+1 的固有相邻重复，非错误）', ()=>{
		const faces = Array.from({ length: 36 }, (_, k)=>faceRulerAt(k * 10));
		expect(faces[0]).toBe('Mars');
		expect(faces[35]).toBe('Mars');
	});

	it('36 项 = FACE_SEQ[k%7]', ()=>{
		for(let k = 0; k < 36; k++){
			expect(faceRulerAt(k * 10)).toBe(FACE_SEQ[k % 7]);
			expect(faceRulerAt(k * 10 + 9.99)).toBe(FACE_SEQ[k % 7]);   // 旬内任意度同主
		}
	});

	it('与既有 EGYPT_DECANS[i].face 逐项相等（防两处各写一份）', ()=>{
		EGYPT_DECANS.forEach((d, i)=>{
			expect(d.face).toBe(FACE_SEQ[i % 7]);
			expect(d.face).toBe(faceRulerAt(i * 10));
			expect(decanRulerAt(d, 'chaldean')).toBe(d.face);
		});
	});

	it('黄经归一：负数与超 360 同样落对旬', ()=>{
		expect(faceRulerAt(-350)).toBe(faceRulerAt(10));
		expect(faceRulerAt(730)).toBe(faceRulerAt(10));
		expect(norm360(-350)).toBe(10);
	});
});

describe('三分性旬星（drekkāṇa）36 行', ()=>{
	// 逐行照传世表：火白羊→♂☉♃；水巨蟹→☽♂♃ …
	const EXPECT = {
		aries: ['Mars', 'Sun', 'Jupiter'],
		leo: ['Sun', 'Jupiter', 'Mars'],
		sagittarius: ['Jupiter', 'Mars', 'Sun'],
		taurus: ['Venus', 'Mercury', 'Saturn'],
		virgo: ['Mercury', 'Saturn', 'Venus'],
		capricorn: ['Saturn', 'Venus', 'Mercury'],
		gemini: ['Mercury', 'Venus', 'Saturn'],
		libra: ['Venus', 'Saturn', 'Mercury'],
		aquarius: ['Saturn', 'Mercury', 'Venus'],
		cancer: ['Moon', 'Mars', 'Jupiter'],
		scorpio: ['Mars', 'Jupiter', 'Moon'],
		pisces: ['Jupiter', 'Moon', 'Mars'],
	};

	it('12 宫 × 3 旬逐格与传世表一致', ()=>{
		SIGN_ORDER.forEach((sign, si)=>{
			[1, 2, 3].forEach((di)=>{
				expect(triplicityDecanRuler(si, di)).toBe(EXPECT[sign][di - 1]);
			});
		});
	});

	it('每宫三旬主星 = 同三分性三座的庙主（本宫/第5座/第9座）', ()=>{
		SIGN_ORDER.forEach((sign, si)=>{
			const got = [1, 2, 3].map((di)=>triplicityDecanRuler(si, di));
			const want = [0, 4, 8].map((off)=>SIGN_DOMICILE_RULERS[(si + off) % 12]);
			expect(got).toEqual(want);
		});
	});

	it('经 decanRulerAt 走 EGYPT_DECANS 亦一致；非法入参不抛', ()=>{
		EGYPT_DECANS.forEach((d)=>{
			expect(decanRulerAt(d, 'triplicity')).toBe(EXPECT[d.signId][d.decanInSign - 1]);
		});
		expect(triplicityDecanRuler(-1, 1)).toBe('');
		expect(triplicityDecanRuler(12, 1)).toBe('');
		expect(triplicityDecanRuler(0, 0)).toBe('');
		expect(triplicityDecanRuler(0, 4)).toBe('');
		expect(decanRulerAt(null, 'triplicity')).toBe('');
	});

	it('两派确实不同（不是同一张表换个名字）', ()=>{
		const diff = EGYPT_DECANS.filter((d)=>decanRulerAt(d, 'chaldean') !== decanRulerAt(d, 'triplicity'));
		expect(diff.length).toBeGreaterThan(20);
	});
});

describe('旬序锚定（两式只改编号，不改主星）', ()=>{
	it('希腊化回归：白羊 0° 为第 1 旬，双鱼末为第 36 旬', ()=>{
		expect(greekDecan(0)).toBe(1);
		expect(greekDecan(359.9)).toBe(36);
		expect(greekDecan(90)).toBe(10);
	});

	it('古代恒星：天狼所在（0°巨蟹=90°）为原位第 1', ()=>{
		expect(ancientDecan(90)).toBe(1);
		expect(ancientDecan(0)).toBe(28);          // 白羊 I 的原位号
		expect(EGYPT_DECANS[9].ancient).toBe(1);   // 巨蟹 I = 天狼
		expect(EGYPT_DECANS[0].ancient).toBe(28);
	});

	it('两套编号各自 1..36 双射', ()=>{
		const g = EGYPT_DECANS.map((d)=>d.greek).sort((a, b)=>a - b);
		const a = EGYPT_DECANS.map((d)=>d.ancient).sort((a2, b2)=>a2 - b2);
		const want = Array.from({ length: 36 }, (_, i)=>i + 1);
		expect(g).toEqual(want);
		expect(a).toEqual(want);
	});

	it('decanNumberAt 随锚定取号；decansOrderedBy 古代档按原位重排', ()=>{
		const d0 = EGYPT_DECANS[0];
		expect(decanNumberAt(d0, 'greek')).toBe(1);
		expect(decanNumberAt(d0, 'ancient')).toBe(28);
		expect(decansOrderedBy('greek')[0].greek).toBe(1);
		expect(decansOrderedBy('ancient')[0].ancient).toBe(1);
		expect(decansOrderedBy('ancient')[0].star).toContain('天狼');
		expect(decanNumberAt(null, 'greek')).toBeNull();
	});

	it('换锚定不改任一旬的主星（两轴正交）', ()=>{
		EGYPT_DECANS.forEach((d)=>{
			expect(decanRulerAt(d, 'chaldean')).toBe(d.face);   // 与编号无关
		});
		expect(Object.keys(EGYPT_DECAN_ANCHORS).sort()).toEqual(['ancient', 'greek']);
		expect(Object.keys(EGYPT_DECAN_RULER_SYSTEMS).sort()).toEqual(['chaldean', 'triplicity']);
	});
});

describe('旬星塔罗 36 张双射', ()=>{
	it('4 花色 × 2..10 共 36，且与 36 旬一一对应', ()=>{
		const cards = new Set(EGYPT_DECANS.map((d)=>`${d.tarotSuit}${d.tarotPip}`));
		expect(cards.size).toBe(36);
		EGYPT_DECANS.forEach((d)=>{
			expect(['wands', 'cups', 'swords', 'coins']).toContain(d.tarotSuit);
			expect(d.tarotPip).toBeGreaterThanOrEqual(2);
			expect(d.tarotPip).toBeLessThanOrEqual(10);
		});
	});

	it('牌的主星列 = 迦勒底外貌列', ()=>{
		EGYPT_DECANS.forEach((d, i)=>{ expect(d.face).toBe(FACE_SEQ[i % 7]); });
	});
});

describe('十二分部两式：8°金牛 → 狮子', ()=>{
	it('乘法式与 2.5°位式落宫一致（宫内度可不同）', ()=>{
		const lam = 38;                       // 金牛 8°
		const s = Math.floor(lam / 30);
		const d = lam - 30 * s;
		const A = norm360(lam + 12 * d);      // 变体 A
		const Bsign = (s + Math.floor(d / 2.5)) % 12;   // 变体 B
		expect(Math.floor(A / 30)).toBe(4);   // 狮子
		expect(Bsign).toBe(4);
	});
});

describe('卷 II 数值不变量', ()=>{
	const LEAST = { Saturn: 30, Jupiter: 12, Mars: 15, Sun: 19, Venus: 8, Mercury: 20, Moon: 25 };
	const GREATEST = { Saturn: 57, Jupiter: 79, Mars: 66, Sun: 120, Venus: 82, Mercury: 76, Moon: 108 };

	it('七星最小年之和 = 129（十年法之基）', ()=>{
		expect(Object.values(LEAST).reduce((a, b)=>a + b, 0)).toBe(129);
	});

	it('五星最大年 = 埃及界五星总度（界与寿命分配同源）', ()=>{
		const five = { saturn: GREATEST.Saturn, jupiter: GREATEST.Jupiter, mars: GREATEST.Mars, venus: GREATEST.Venus, mercury: GREATEST.Mercury };
		expect(five).toEqual(termTotals(EGYPTIAN_TERMS));
	});

	it('中年 = (最小+最大)/2', ()=>{
		expect((LEAST.Saturn + GREATEST.Saturn) / 2).toBe(43.5);
		expect((LEAST.Moon + GREATEST.Moon) / 2).toBe(66.5);
	});

	it('黄道释放：12 宫年数 = 各宫庙主最小年，合 214', ()=>{
		const zr = SIGN_ORDER.map((s, i)=>LEAST[SIGN_DOMICILE_RULERS[i]]);
		expect(zr).toEqual([15, 8, 20, 25, 19, 20, 8, 15, 12, 30, 30, 12]);
		expect(zr.reduce((a, b)=>a + b, 0)).toBe(214);
	});

	it('法达：昼序自☉、夜序自☽，七星各合 70（另加交点 3+2）', ()=>{
		const day = [10, 8, 13, 9, 11, 12, 7];      // ☉♀☿☽♄♃♂
		const night = [9, 11, 12, 7, 10, 8, 13];    // ☽♄♃♂☉♀☿
		expect(day.reduce((a, b)=>a + b, 0)).toBe(70);
		expect(night.reduce((a, b)=>a + b, 0)).toBe(70);
		expect(70 + 3 + 2).toBe(75);
	});

	it('十年法子期：♄30 ☽25 ☿20 ☉19 ♂15 ♃12 ♀8，合 129 月', ()=>{
		expect([30, 25, 20, 19, 15, 12, 8].reduce((a, b)=>a + b, 0)).toBe(129);
	});

	it('上升时间示意表：12 项合 360 且关于分至轴对称', ()=>{
		const asc = [20, 24, 28, 32, 36, 40, 40, 36, 32, 28, 24, 20];
		expect(asc.reduce((a, b)=>a + b, 0)).toBe(360);
		expect(asc[0]).toBe(asc[11]);
		expect(asc[5]).toBe(asc[6]);
	});

	it('映点：分至镜像 anti(15)=165、分点镜像 contra(40)=320', ()=>{
		const anti = (L)=>norm360(180 - L);
		const contra = (L)=>norm360(360 - L);
		expect(anti(15)).toBe(165);
		expect(anti(40)).toBe(140);
		expect(contra(0)).toBe(0);
		expect(contra(40)).toBe(320);
	});
});

describe('现代众神星座（类别 E）', ()=>{
	const daysOfYear = ()=>{
		const out = [];
		const DIM = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];   // 含 2/29
		DIM.forEach((n, i)=>{ for(let d = 1; d <= n; d++){ out.push([i + 1, d]); } });
		return out;
	};

	it('12 神齐备，各带关键词', ()=>{
		expect(EGYPT_GODS.length).toBe(12);
		EGYPT_GODS.forEach((g)=>{
			expect(g.key).toBeTruthy();
			expect(g.cn).toBeTruthy();
			expect(g.keywords.length).toBeGreaterThanOrEqual(3);
		});
	});

	it('默认版 28 段；366 天（含 2/29）无缺口、无重叠', ()=>{
		expect(EGYPT_GOD_EDITIONS.seamless.ranges.length).toBe(28);
		const all = daysOfYear();
		expect(all.length).toBe(366);
		const seen = new Set();
		let overlap = 0;
		EGYPT_GOD_EDITIONS.seamless.ranges.forEach(([, m1, d1, m2, d2])=>{
			all.forEach(([m, d])=>{
				const k = m * 100 + d;
				if(m1 * 100 + d1 <= k && k <= m2 * 100 + d2){
					if(seen.has(k)){ overlap += 1; }
					seen.add(k);
				}
			});
		});
		expect(overlap).toBe(0);
		expect(seen.size).toBe(366);
		all.forEach(([m, d])=>{ expect(egyptianGodSign(m, d)).toBeTruthy(); });
	});

	it('逐日归属可复算（抽点核对）', ()=>{
		expect(egyptianGodSign(1, 1)).toBe('Nile');
		expect(egyptianGodSign(1, 8)).toBe('AmunRa');
		expect(egyptianGodSign(2, 29)).toBe('Geb');
		expect(egyptianGodSign(7, 1)).toBe('Anubis');
		expect(egyptianGodSign(12, 31)).toBe('Isis');
	});

	it('变体版照实留缺口，不代为补洞', ()=>{
		expect(egyptianGodSign(1, 15, 'variant')).toBe('');
		expect(egyptianGodSign(6, 20, 'variant')).toBe('');
		expect(egyptianGodSign(1, 15, 'seamless')).toBe('AmunRa');
		expect(EGYPT_GOD_EDITIONS.variant.note).toContain('未代为补洞');
	});

	it('每神 2–4 段，段文可读', ()=>{
		EGYPT_GODS.forEach((g)=>{
			const segs = egyptianGodSegments(g.key);
			expect(segs.length).toBeGreaterThanOrEqual(2);
			expect(segs.length).toBeLessThanOrEqual(4);
		});
	});

	it('非法入参返回空而非乱判', ()=>{
		[[0, 1], [13, 1], [1, 0], [1, 32], [NaN, 1], ['a', 'b']].forEach(([m, d])=>{
			expect(egyptianGodSign(m, d)).toBe('');
		});
	});

	it('性质声明在位且明说与古埃及无史料关系', ()=>{
		expect(EGYPT_GODS_DISCLAIMER).toContain('20 世纪');
		expect(EGYPT_GODS_DISCLAIMER).toContain('无史料关系');
	});
});

describe('显示层红线（公开技法：零章节号、零「手册」字样）', ()=>{
	it('新增数据文件的对外文案不含 § 与「手册」', ()=>{
		const texts = [
			EGYPT_GODS_DISCLAIMER,
			...EGYPT_GODS.map((g)=>`${g.cn}${g.note}${g.keywords.join('')}`),
			...Object.values(EGYPT_GOD_EDITIONS).map((e)=>`${e.label}${e.note}`),
			...Object.values(EGYPT_DECAN_RULER_SYSTEMS).map((v)=>`${v.label}${v.column}${v.note}`),
			...Object.values(EGYPT_DECAN_ANCHORS).map((v)=>`${v.label}${v.column}${v.note}`),
		].join('');
		expect(texts).not.toMatch(/§/);
		expect(texts).not.toMatch(/手册/);
	});
});
