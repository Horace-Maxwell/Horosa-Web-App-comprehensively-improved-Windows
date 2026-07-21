// 神数正传 · 铁算心易查询层 —— 数表不变式 + 「只出号不代入正文」之守卫。
import {
	lookupBake, bakeTable, lookupXiang, xiangTable, lookupXingqing, xingqingTable,
	lookupQiRiYue, qiRiYueTable, calcXinyi, XINYI_META, XINYI_ITEMS, XINYI_SOUNDS_A, XINYI_SOUNDS_B, XINYI_GONG,
} from '../zhengchuanXinyiLocal';
import TIEBAN_VERSES from '../data/zhengchuanTiebanVerses.json';

const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

describe('神数正传·心易 · 八刻分命表 = 京房八宫卦序', () => {
	// 一刻＝八宫首卦、八刻＝各宫归魂卦（64/64）
	const JING = {
		乾: ['乾', '姤', '遁', '否', '觀', '剝', '晉', '大有'],
		兌: ['兌', '困', '萃', '咸', '蹇', '謙', '小過', '歸妹'],
		離: ['離', '旅', '鼎', '未濟', '蒙', '渙', '訟', '同人'],
		震: ['震', '豫', '解', '恆', '升', '井', '大過', '隨'],
		巽: ['巽', '小畜', '家人', '益', '無妄', '噬嗑', '頤', '蠱'],
		坎: ['坎', '節', '屯', '既濟', '革', '豐', '明夷', '師'],
		艮: ['艮', '賁', '大畜', '損', '睽', '履', '中孚', '漸'],
		坤: ['坤', '復', '臨', '泰', '大壯', '夬', '需', '比'],
	};
	const KE = ['一刻', '二刻', '三刻', '四刻', '五刻', '六刻', '七刻', '八刻'];
	test('64 格逐格与京房八宫卦序吻合', () => {
		const bad = [];
		KE.forEach((ke, ki) => XINYI_GONG.forEach((gong) => {
			const got = (lookupBake(ke, gong) || '').replace('恒', '恆').replace('无妄', '無妄');
			if (got !== JING[gong][ki]) bad.push(`${ke}×${gong}: ${got} ≠ ${JING[gong][ki]}`);
		}));
		expect(bad).toEqual([]);
	});
	test('八刻 × 八宫 满格', () => {
		expect(bakeTable()).toHaveLength(8);
		bakeTable().forEach((r) => expect(r.guas).toHaveLength(8));
	});
	test('64 卦无重复（八宫各八卦恰覆盖六十四卦）', () => {
		const all = bakeTable().flatMap((r) => r.guas);
		expect(new Set(all).size).toBe(64);
	});
});

describe('神数正传·心易 · 六项条文秘数表', () => {
	test('六项皆备，各项 16 声音（日月星辰水火土石 + 平上去入开发收闭）', () => {
		XINYI_ITEMS.forEach((it) => {
			const t = xiangTable(it);
			expect(t).toBeTruthy();
			expect(t.rowsA.map((r) => r.sound)).toEqual(XINYI_SOUNDS_A);
			expect(t.rowsB.map((r) => r.sound)).toEqual(XINYI_SOUNDS_B);
			[...t.rowsA, ...t.rowsB].forEach((r) => expect(r.cell.length).toBeGreaterThan(0));
		});
	});
	test('各项皆载括号默认之注（古籍：当声音在括号内时不取此声音，直接取某号）', () => {
		XINYI_ITEMS.forEach((it) => {
			const t = xiangTable(it);
			expect(t.bracketNote).toContain('直接取條文數');
			expect(typeof t.bracketDefault).toBe('number');
		});
	});
	test('一格多号皆取（父母·上 = 2762、2774）', () => {
		const r = lookupXiang('父母', '上', 1);
		expect(r.all.map((x) => x.num)).toEqual([2762, 2774]);
	});
	test('官禄项 ●○／× 分标：乾造取 ●○（古籍命例为乾造，其官禄「去」声取 2412 = ●○ 之值）', () => {
		const male = lookupXiang('官祿', '去', 1);
		expect(male.picked.map((x) => x.num)).toEqual([2412]);
		expect(male.pickNote).toContain('乾造');
		const female = lookupXiang('官祿', '去', 0);
		expect(female.picked.map((x) => x.num)).toEqual([2464]);
	});
	test('无标记之格不受性别影响', () => {
		expect(lookupXiang('父母', '日', 1).picked).toEqual(lookupXiang('父母', '日', 0).picked);
	});
	test('未知项目/声音 → null，不抛', () => {
		expect(lookupXiang('財運', '日', 1)).toBeNull();   // 古籍未出财运项之表
		expect(lookupXiang('父母', '宮', 1)).toBeNull();
	});
});

describe('神数正传·心易 · 性情项条文秘数表', () => {
	test('12 支 × 12 余数满格', () => {
		const t = xingqingTable();
		expect(t).toHaveLength(12);
		t.forEach((r) => { expect(r.cells).toHaveLength(12); r.cells.forEach((c) => expect(c.length).toBeGreaterThan(0)); });
	});
	test('不变式：下表[支][k+6] = 上表[冲支][k]，72 格中 71 格成立', () => {
		const bad = [];
		ZHI.forEach((z, zi) => {
			for (let k = 1; k <= 6; k += 1) {
				const a = lookupXingqing(z, k + 6).nums;
				const b = lookupXingqing(ZHI[(zi + 6) % 12], k).nums;
				if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(`${z}/${k + 6}`);
			}
		});
		expect(bad).toEqual(['巳/8']);   // 唯一破例，古籍原样录入并标存疑
	});
	test('唯一破例之格带存疑标注', () => {
		expect(lookupXingqing('巳', 8).ambiguous).toContain('唯一破例');
		expect(lookupXingqing('巳', 8).nums).toEqual([3431, 3274]);   // 原值录入，不擅改
		expect(lookupXingqing('亥', 2).nums).toEqual([3192, 3492]);
		expect(lookupXingqing('子', 7).ambiguous).toBeNull();
	});
	test('古籍命例：性格项 3177、3506 出自性情表巳栏第五格（一格两数）', () => {
		expect(lookupXingqing('巳', 5).nums).toEqual([3506, 3177]);
	});
});

describe('神数正传·心易 · 起日月声音表', () => {
	test('卦气求日之宫、余数求月之宫（十二辟卦 × 余数1..12 × 十二支）', () => {
		expect(qiRiYueTable()).toHaveLength(12);
		expect(lookupQiRiYue({ guaqi: '復' }).riGong).toBe('子');
		expect(lookupQiRiYue({ guaqi: '坤' }).riGong).toBe('亥');
		expect(lookupQiRiYue({ yushu: 1 }).yueGong).toBe('子');
		expect(lookupQiRiYue({ yushu: 12 }).yueGong).toBe('亥');
	});
	test('辟卦序为一阳生至纯阴（复临泰大壮夬乾姤遁否观剥坤）', () => {
		expect(qiRiYueTable().map((r) => r.guaqi)).toEqual(['復', '臨', '泰', '大壯', '夬', '乾', '姤', '遁', '否', '觀', '剝', '坤']);
	});
});

// 🔴 本支正文古籍未载：号段虽与既有条文库同，正文全异（另一套库）→ 绝不代入
describe('神数正传·心易 · 只出号不代入正文（防张冠李戴）', () => {
	test('查询结果不含任何条文正文字段', () => {
		const r = calcXinyi({ item: '父母', sound: '日', gender: 1, ke: '三刻', gong: '乾', xqZhi: '巳', xqYushu: 5 });
		const s = JSON.stringify(r);
		expect(s).not.toContain('verse');
		expect(s).not.toContain('text');
	});
	test('古籍命例之号在既有条文库中亦命中，然正文全异 → 坐实两库不同源，不可代入', () => {
		const V = TIEBAN_VERSES.verses || TIEBAN_VERSES;
		// 古籍命例自载之号与正文（父母 2789／性格 3177、3506）
		const caseText = { 2789: '承祖業而倍增榮', 3177: '清清品格樂襟懷', 3506: '性賦剛直' };
		Object.keys(caseText).forEach((num) => {
			expect(V[num]).toBeTruthy();                       // 号在既有库中存在
			expect(V[num]).not.toContain(caseText[num]);       // 而正文并非本支所载 → 不同源
		});
	});
	test('_meta 载明三项硬缺（起数入口／条文正文／五项无表）', () => {
		const items = (XINYI_META.gaps || []).map((g) => g.item).join('|');
		expect(items).toContain('起数入口');
		expect(items).toContain('条文正文');
		expect(items).toContain('祖坟');
	});
	test('查询层自标 isLookup，绝不冒充推算', () => {
		expect(calcXinyi({}).isLookup).toBe(true);
	});
});
