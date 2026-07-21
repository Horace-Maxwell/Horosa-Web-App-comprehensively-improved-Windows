// 皇极轨策 · 起卦十四法 + 卦变代数 金标。
// 🔴 失败 = 引擎错，不得改测试将就。
import {
	qiGua, qiGuaByTime, qiGuaByBaoShu, qiGuaByZi, qiGuaByZhangChi, qiGuaByChiCun,
	qiGuaByWuFang, qiGuaByJingWu, guaByNumber, yaoByNumber, ziZhanSplit, QI_GUA_FA,
} from '../core/guiceQiGua';
import {
	huGua, tiYong, tiHuYongHu, bianGua, cuoGua, zongGua, guaBianAll, trigramsOf, linesOf,
} from '../core/guiceGuaBian';

describe('轨策 · 两条通则', () => {
	test('卦数起例：以八除取余，「如得八數整，即坤卦」→ 整除得八，非零', () => {
		expect(guaByNumber(8)).toEqual({ num: 8, gua: '坤' });
		expect(guaByNumber(16)).toEqual({ num: 8, gua: '坤' });
		expect(guaByNumber(1)).toEqual({ num: 1, gua: '乾' });
		expect(guaByNumber(9)).toEqual({ num: 1, gua: '乾' });
		expect(guaByNumber(35)).toEqual({ num: 3, gua: '离' });
	});
	test('爻以六除：「如不滿六，止用此數為動爻」→ 整除得六，非零', () => {
		expect(yaoByNumber(6)).toBe(6);
		expect(yaoByNumber(42)).toBe(6);
		expect(yaoByNumber(1)).toBe(1);
		expect(yaoByNumber(7)).toBe(1);
	});
	test('八卦之数与先天序合（乾1 兑2 离3 震4 巽5 坎6 艮7 坤8）', () => {
		expect([1, 2, 3, 4, 5, 6, 7, 8].map((n) => guaByNumber(n).gua))
			.toEqual(['乾', '兑', '离', '震', '巽', '坎', '艮', '坤']);
	});
});

// ── 法1 年月日时 ────────────────────────────────────────
describe('轨策 · 法一 年月日时起例', () => {
	const A = { yearZhi: '辰', lunarMonth: 5, lunarDay: 25, hourZhi: '午' };   // 庚辰年五月廿五午时
	test('交接锚点：辰年五月廿五午时 → 火泽睽（上离下兑）六爻动', () => {
		const r = qiGuaByTime(A);
		expect(r.up).toBe('离');       // (5+5+25)=35 ÷8 余3 → 离
		expect(r.lo).toBe('兑');       // 35+7=42 ÷8 余2 → 兑
		expect(r.dongYao).toBe(6);     // 42 ÷6 整除 → 六爻动
	});
	test('其变卦 = 雷泽归妹（上爻动，离变震）', () => {
		const r = qiGuaByTime(A);
		const b = guaBianAll(r.up, r.lo, r.dongYao);
		expect(b.bian.up).toBe('震');
		expect(b.bian.lo).toBe('兑');
	});
	// 与仓内既有之时起卦（guazhan 之 buildTimeGua）同口径 —— 已逐句读源码对拍：
	// 其 up=(y+m+d)%8-1、<0 则 7 → 整除落坤；cyao=(y+m+d+t)%6-1、<0 则 5 → 整除落六爻。
	// 与本层 %8||8 / %6||6 等价。此处不 import 其模块（组件之链拉入 enzyme/parse5，与本层无涉）。
	test('边界：月/日/支越域 → null，不抛', () => {
		[{ lunarMonth: 0 }, { lunarMonth: 13 }, { lunarDay: 0 }, { lunarDay: 31 },
			{ yearZhi: 'X' }, { hourZhi: '' }].forEach((bad) => {
			expect(qiGuaByTime({ ...A, ...bad })).toBeNull();
		});
	});
});

// ── 法2 报数 ────────────────────────────────────────────
describe('轨策 · 法二 卦数起例（报数）', () => {
	test('报一数：其数为上卦、时数为下卦', () => {
		const r = qiGuaByBaoShu({ nums: 35, hourZhi: '午' });
		expect(r.up).toBe('离');       // 所报之数 35 ÷8 余3 → 离
		expect(r.lo).toBe('艮');       // 时数 午=7 ÷8 余7 → 艮
		expect(r.danShu).toBe(true);
	});
	test('报一数 · 数与卦逐个写死（35 / 午时7）', () => {
		const r = qiGuaByBaoShu({ nums: 35, hourZhi: '午' });
		expect([r.up, r.lo, r.dongYao]).toEqual(['离', '艮', 6]);   // 35→离；7→艮；(35+7)=42÷6→6
	});
	test('报二数：先数为上、后数为下、(先+后+时)为动爻', () => {
		const r = qiGuaByBaoShu({ nums: [3, 2], hourZhi: '午' });
		expect([r.up, r.lo, r.dongYao]).toEqual(['离', '兑', 6]);   // 3→离；2→兑；(3+2+7)=12÷6→6
		expect(r.danShu).toBe(false);
	});
	test('空/坏值 → null', () => {
		expect(qiGuaByBaoShu({ nums: [], hourZhi: '午' })).toBeNull();
		expect(qiGuaByBaoShu({ nums: 35, hourZhi: '' })).toBeNull();
	});
});

// ── 法5 字占（十一档）──────────────────────────────────
describe('轨策 · 法五 字占（十一档）', () => {
	test('分字之法：停匀则平分；不匀则少一字为上卦（天轻清）、多一字为下卦（地重浊）', () => {
		expect(ziZhanSplit(2)).toMatchObject({ up: 1, lo: 1 });
		expect(ziZhanSplit(3)).toMatchObject({ up: 1, lo: 2 });    // 三才
		expect(ziZhanSplit(4)).toMatchObject({ up: 2, lo: 2 });    // 四象
		expect(ziZhanSplit(5)).toMatchObject({ up: 2, lo: 3 });    // 五行
		expect(ziZhanSplit(7)).toMatchObject({ up: 3, lo: 4 });    // 齐七政
		expect(ziZhanSplit(9)).toMatchObject({ up: 4, lo: 5 });    // 九畴
		expect(ziZhanSplit(10)).toMatchObject({ up: 5, lo: 5 });   // 成数
	});
	test('十一字以上至百字：不用平仄，止用字数；均平则半上半下', () => {
		expect(ziZhanSplit(12)).toMatchObject({ up: 6, lo: 6 });
		expect(ziZhanSplit(11)).toMatchObject({ up: 5, lo: 6 });
		expect(ziZhanSplit(101)).toBeNull();
	});
	test('一字：草书混沌不可得卦（显式拒，不臆造）', () => {
		expect(qiGuaByZi({ text: '天', shu: 'cao' }).error).toContain('草书');
	});
	test('一字·楷书：取字画 —— 左为阳画（上卦）、右为阴画（下卦）', () => {
		const r = qiGuaByZi({ text: '天', shu: 'kai', tones: { leftStrokes: 3, lightStrokes: 0, rightStrokes: 2 }, hourZhi: '午' });
		expect([r.up, r.lo]).toEqual(['离', '兑']);   // 3→离、2→兑
	});
	test('一字·楷书缺字画 → 显式提示，不臆造', () => {
		expect(qiGuaByZi({ text: '天', shu: 'kai' }).error).toContain('字画');
	});
	test('二字：以字数取数（1/1）', () => {
		const r = qiGuaByZi({ text: '天地', hourZhi: '午' });
		expect([r.up, r.lo]).toEqual(['乾', '乾']);   // 上1→乾、下1→乾
	});
	test('四至十字：不数画数，只以平仄声调（平1 上2 去3 入4）', () => {
		const r = qiGuaByZi({ text: '天地人和', tones: ['平', '去', '平', '上'], hourZhi: '午' });
		// 上二字 平1+去3=4 → 震；下二字 平1+上2=3 → 离
		expect([r.up, r.lo]).toEqual(['震', '离']);
	});
	test('四至十字缺声调 → 显式提示（不退回字数，免与古法相左）', () => {
		expect(qiGuaByZi({ text: '天地人和' }).error).toContain('平仄');
	});
	test('十一字以上：止用字数，不用平仄', () => {
		const r = qiGuaByZi({ text: '一二三四五六七八九十一二', hourZhi: '午' });
		expect(r.error).toBeUndefined();
		expect([r.up, r.lo]).toEqual(['坎', '坎']);   // 上6→坎、下6→坎
	});
});

// ── 法6/7 丈尺 · 尺寸（一不加时、一加时）──────────────
describe('轨策 · 法六/七 丈尺占与尺寸占（加时与否之别）', () => {
	test('丈尺占：不加时；寸数不用', () => {
		const r = qiGuaByZhangChi({ zhang: 3, chi: 2 });
		expect([r.up, r.lo, r.dongYao]).toEqual(['离', '兑', 5]);   // 3→离、2→兑、(3+2)=5÷6→5
		expect(r.steps[2].detail).toContain('不加时');
	});
	test('尺寸占：加时；分数不用', () => {
		const r = qiGuaByChiCun({ chi: 3, cun: 2, hourZhi: '午' });
		expect([r.up, r.lo, r.dongYao]).toEqual(['离', '兑', 6]);   // (3+2+7)=12÷6→6
		expect(r.steps[2].detail).toContain('加时');
	});
	test('两法同数而动爻异 —— 加时与否之别真生效', () => {
		expect(qiGuaByZhangChi({ zhang: 3, chi: 2 }).dongYao)
			.not.toBe(qiGuaByChiCun({ chi: 3, cun: 2, hourZhi: '午' }).dongYao);
	});
});

// ── 法10/12 物卦 · 方位 ────────────────────────────────
describe('轨策 · 法十/十二 占动物与端法后天起卦', () => {
	test('上卦=物之卦、下卦=方位之卦、动爻=(物+方+时)÷6', () => {
		const r = qiGuaByWuFang({ wuGuaNum: 3, fangGuaNum: 2, hourZhi: '午' });
		expect([r.up, r.lo, r.dongYao]).toEqual(['离', '兑', 6]);   // (3+2+7)=12÷6→6
	});
	test('卦数越域（0/9）→ null', () => {
		expect(qiGuaByWuFang({ wuGuaNum: 0, fangGuaNum: 2, hourZhi: '午' })).toBeNull();
		expect(qiGuaByWuFang({ wuGuaNum: 9, fangGuaNum: 2, hourZhi: '午' })).toBeNull();
	});
});

// ── 法11 占静物 ────────────────────────────────────────
describe('轨策 · 法十一 占静物（有不可起卦者，须显式拒）', () => {
	const T = { yearZhi: '辰', lunarMonth: 5, lunarDay: 25, hourZhi: '午' };
	test('屋宅初创之时可起', () => {
		const r = qiGuaByJingWu({ kind: '屋宅初创', ...T });
		expect(r.up).toBe('离');
		expect(r.note).toContain('屋宅初创');
	});
	test('🔴「群物之动」「江河山石」不可起卦 —— 显式拒，不臆造一个卦', () => {
		expect(qiGuaByJingWu({ kind: '群物之动', ...T }).error).toContain('不可起卦');
		expect(qiGuaByJingWu({ kind: '江河山石', ...T }).error).toContain('不可起卦');
	});
});

describe('轨策 · 起卦统一入口', () => {
	test('十二法皆有其目', () => {
		expect(QI_GUA_FA.map((f) => f.key)).toEqual([
			'time', 'baoshu', 'wushu', 'shengyin', 'zizhan', 'zhangchi',
			'chicun', 'weiren', 'ziji', 'dongwu', 'jingwu', 'duanfa',
		]);
	});
	test('未知之法 → null，不抛', () => {
		expect(qiGua('nope', {})).toBeNull();
	});
	test('物数占与声音占同链而异名', () => {
		const a = qiGua('wushu', { wuShu: 35, hourZhi: '午' });
		const b = qiGua('shengyin', { shengShu: 35, hourZhi: '午' });
		expect([a.up, a.lo, a.dongYao]).toEqual([b.up, b.lo, b.dongYao]);
		expect(a.fa).not.toBe(b.fa);
	});
});

// ══ 卦变代数 ═══════════════════════════════════════════
describe('轨策 · 卦变代数（三条硬规则）', () => {
	test('🔴 规则一：互卦只出两个八卦，不产六十四卦名', () => {
		const h = huGua(linesOf('震', '巽'), 3);
		expect(Object.keys(h)).toEqual(expect.arrayContaining(['shangHu', 'xiaHu']));
		expect(JSON.stringify(h)).not.toMatch(/为|卦$/);   // 不含六十四卦之名
	});
	test('🔴 交接锚点：恒卦（上震下巽）→ 下互乾、上互兑', () => {
		const h = huGua(linesOf('震', '巽'), 3);
		expect(h.xiaHu).toBe('乾');    // 爻2·3·4
		expect(h.shangHu).toBe('兑');  // 爻3·4·5
		expect(h.fromBian).toBe(false);
	});
	test('🔴 规则二：乾坤无互 → 互其变卦', () => {
		const q = huGua(linesOf('乾', '乾'), 1);
		expect(q.fromBian).toBe(true);
		expect(q.note).toContain('乾坤无互');
		const k = huGua(linesOf('坤', '坤'), 1);
		expect(k.fromBian).toBe(true);
	});
	test('乾坤之外不走变卦之互', () => {
		['震', '巽', '坎', '离', '艮', '兑'].forEach((g) => {
			expect(huGua(linesOf(g, g), 1).fromBian).toBe(false);
		});
	});
	test('🔴 规则三：体卦在上 → 上互为体之互；体卦在下 → 反之', () => {
		// 恒卦 3 爻动 → 用在下(巽)、体在上(震) → 体互 = 上互 = 兑
		const a = tiHuYongHu(linesOf('震', '巽'), 3);
		expect([a.tiGua, a.yongGua]).toEqual(['震', '巽']);
		expect(a.tiHu).toBe('兑');
		expect(a.yongHu).toBe('乾');
		// 同卦 4 爻动 → 用在上(震)、体在下(巽) → 体互 = 下互 = 乾
		const b = tiHuYongHu(linesOf('震', '巽'), 4);
		expect([b.tiGua, b.yongGua]).toEqual(['巽', '震']);
		expect(b.tiHu).toBe('乾');
		expect(b.yongHu).toBe('兑');
	});
	test('体用：动爻所在为用卦、另一为体卦', () => {
		[1, 2, 3].forEach((f) => expect(tiYong(linesOf('乾', '坤'), f)).toMatchObject({ yongGua: '坤', tiGua: '乾' }));
		[4, 5, 6].forEach((f) => expect(tiYong(linesOf('乾', '坤'), f)).toMatchObject({ yongGua: '乾', tiGua: '坤' }));
	});
	test('变卦=动爻反转；错卦=全爻反转；综卦=倒置', () => {
		const l = linesOf('离', '兑');       // 火泽睽
		expect(trigramsOf(bianGua(l, 6))).toEqual({ up: '震', lo: '兑' });
		expect(trigramsOf(cuoGua(l))).toEqual({ up: '坎', lo: '艮' });
		expect(trigramsOf(zongGua(l))).toEqual({ up: '巽', lo: '离' });   // 睽之综 = 家人
	});
	test('全变之出：本／互（两八卦）／变／错／综 + 体用', () => {
		const all = guaBianAll('离', '兑', 6);
		expect(all.ben).toMatchObject({ up: '离', lo: '兑' });
		expect(all.hu).toMatchObject({ shangHu: expect.any(String), xiaHu: expect.any(String) });
		expect(all.bian).toMatchObject({ up: '震', lo: '兑' });
		expect(all.hu.tiGua).toBe('兑');    // 6 爻动 → 用在上(离)、体在下(兑)
	});
	test('边界：坏爻/坏卦 → null，不抛', () => {
		expect(bianGua(linesOf('乾', '坤'), 0)).toBeNull();
		expect(bianGua(linesOf('乾', '坤'), 7)).toBeNull();
		expect(bianGua([1, 1], 1)).toBeNull();
		expect(linesOf('甲', '坤')).toBeNull();
		expect(guaBianAll('甲', '坤', 1)).toBeNull();
	});
});
