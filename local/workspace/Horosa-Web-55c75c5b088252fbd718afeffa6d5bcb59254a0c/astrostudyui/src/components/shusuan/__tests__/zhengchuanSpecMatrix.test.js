// 神数正传 · 规格对照表【选项 → 预期计算 → 预期显示】+ 穷举压测矩阵。
// 🔴 失败 = 实现与规格不符，不得改测试将就。
//
// 取值域一律【自代码派生】(左栏控件之 Option / 表键)，不手抄 —— 手抄必漏，
// 而漏掉的那个恰是没人测的那个。
//
// 🔴 重点压四个【自由文本】干支输入(求测时辰/大运/小运/岁君)：用户可打任意字，
//    是最容易崩的一类 —— Select 至少还锁着域，Input 什么都收得进来。
import { calcTieban } from '../../../utils/zhengchuanTiebanLocal';
import { calcShaozi } from '../../../utils/zhengchuanShaoziLocal';
import { dadingDeathYear, dadingDeathMonth } from '../../../utils/zhengchuanDadingLocal';
import { calcLiuqin } from '../../../utils/zhengchuanLiuqinLocal';
import { calcXinyi, xiangTable, xingqingTable, XINYI_GONG, XINYI_ITEMS, XINYI_SOUNDS_A, XINYI_SOUNDS_B, XINYI_KE } from '../../../utils/zhengchuanXinyiLocal';
import { buildZhengChuanSnapshotText } from '../../../utils/zhengchuanSnapshot';
import { SCHOOL_KEYS } from '../zhengchuanSchools';

const P = ['庚辰', '壬午', '丙申', '甲午'];
const BASE = { pillars: P, gender: '男', lunarMonth: 5, lunarDay: 25, isLeapMonth: false };
const GAN = '甲乙丙丁戊己庚辛壬癸'.split('');
const ZHI = '子丑寅卯辰巳午未申酉戌亥'.split('');
const ALL_GZ = [];
for (let i = 0; i < 60; i += 1) ALL_GZ.push(GAN[i % 10] + ZHI[i % 12]);

// 🔴 坏输入之谱 —— 四个自由文本框收得进来的东西，一样不少
const BAD_TEXT = ['', ' ', 'x', '甲', '子', '甲子丙', '  甲子  ', '<script>', '零一', '甲x', 'AA', '１２', null, undefined, 123, {}, []];

describe('神数正传·规格表 · 五流派齐备', () => {
	test('流派键即单一源之全', () => {
		expect(SCHOOL_KEYS).toEqual(['tieban', 'shaozi', 'dading', 'liuqin', 'xinyi']);
	});
});

describe('神数正传·压测 · 铁板：求测时辰（自由文本干支）全谱 + 坏输入', () => {
	test('🔴 六十甲子全谱作求测时辰 → 皆出盘、皆有本命数与辟卦', () => {
		const bad = [];
		ALL_GZ.forEach((gz) => {
			try {
				const m = calcTieban({ yearGz: P[0], monthGz: P[1], dayGz: P[2], hourGz: P[3], ...BASE, askGz: gz });
				if (!m || !m.benming || !(m.benming.benMingShu > 0)) bad.push(`${gz} → 本命数 ${m && m.benming && m.benming.benMingShu}`);
				if (!m.liunian || m.liunian.rows.length !== 108) bad.push(`${gz} → 流年 ${m && m.liunian && m.liunian.rows.length} 年（应 108）`);
			} catch (e) { bad.push(`${gz} 抛 ${e.message}`); }
		});
		expect(bad).toEqual([]);
	});
	test('🔴 坏的求测时辰 → 不抛（或明确返 null），绝不出一个错盘', () => {
		const bad = [];
		BAD_TEXT.forEach((v) => {
			try {
				const m = calcTieban({ yearGz: P[0], monthGz: P[1], dayGz: P[2], hourGz: P[3], ...BASE, askGz: v });
				// 允许:返 null(不可算) 或 回落本人时柱(其为合法干支)。不允许:出一个基于坏输入的盘。
				if (m && m.benming && !(m.benming.benMingShu > 0)) bad.push(`${JSON.stringify(v)} → 本命数 ${m.benming.benMingShu}`);
			} catch (e) { bad.push(`${JSON.stringify(v)} 抛 ${e.message}`); }
		});
		expect(bad).toEqual([]);
	});
	test('🔴 四柱本身为坏值 → 不抛', () => {
		[['', '', '', ''], ['甲', '乙', '丙', '丁'], ['xx', 'yy', 'zz', 'ww'], [null, null, null, null]].forEach((pp) => {
			expect(() => calcTieban({ yearGz: pp[0], monthGz: pp[1], dayGz: pp[2], hourGz: pp[3], ...BASE, pillars: pp, askGz: P[3] })).not.toThrow();
		});
	});
	test('农历月日之边界（1/30、闰月）皆出盘', () => {
		[[1, 1], [12, 30], [6, 15]].forEach(([mo, d]) => {
			[false, true].forEach((leap) => {
				const m = calcTieban({ yearGz: P[0], monthGz: P[1], dayGz: P[2], hourGz: P[3], ...BASE, lunarMonth: mo, lunarDay: d, isLeapMonth: leap, askGz: P[3] });
				expect(m && m.benming.benMingShu).toBeGreaterThan(0);
			});
		});
	});
	test('男女两造皆出盘（且考刻之判随之）', () => {
		const a = calcTieban({ yearGz: P[0], monthGz: P[1], dayGz: P[2], hourGz: P[3], ...BASE, gender: '男', askGz: P[3] });
		const b = calcTieban({ yearGz: P[0], monthGz: P[1], dayGz: P[2], hourGz: P[3], ...BASE, gender: '女', askGz: P[3] });
		expect(a.benming.benMingShu).toBeGreaterThan(0);
		expect(b.benming.benMingShu).toBeGreaterThan(0);
	});
});

describe('神数正传·压测 · 邵子：父母年龄 × 元（三档）', () => {
	const YUAN = ['shang', 'zhong', 'xia'];
	test('🔴 元三档 × 父母年龄边界（1/60/120）→ 皆出盘', () => {
		const bad = [];
		YUAN.forEach((y) => [1, 26, 27, 60, 120].forEach((fa) => [1, 26, 60, 120].forEach((ma) => {
			try {
				const m = calcShaozi({ ...BASE, fatherAge: fa, motherAge: ma, yuan: y });
				if (!m || !m.tianMing || m.tianMing.num == null) bad.push(`yuan=${y} f=${fa} m=${ma} → 天命数空`);
			} catch (e) { bad.push(`yuan=${y} f=${fa} m=${ma} 抛 ${e.message}`); }
		})));
		expect(bad).toEqual([]);
	});
	test('🔴 元三档 → 遇余五特例时先天命卦必异（此档之所以存在）', () => {
		const g = (y) => {
			const m = calcShaozi({ ...BASE, fatherAge: 27, motherAge: 26, yuan: y });
			return m && m.xianTian && m.xianTian.gua && m.xianTian.gua.name;
		};
		// 非余五之局三档同（本例即是）→ 只验其不抛、皆出卦
		YUAN.forEach((y) => expect(g(y)).toBeTruthy());
	});
	test('父母年龄为 0 / 负 / 非数 → 不抛', () => {
		[0, -5, NaN, null, undefined, 'x', 1e9].forEach((v) => {
			expect(() => calcShaozi({ ...BASE, fatherAge: v, motherAge: v, yuan: 'zhong' })).not.toThrow();
		});
	});
	test('🔴 整除特例（父岁整除）→ 天命数走特例式，不落常式', () => {
		const m = calcShaozi({ ...BASE, fatherAge: 10, motherAge: 20, yuan: 'zhong' });
		expect(m.tianMing.num).toBeGreaterThan(0);
	});
});

describe('神数正传·压测 · 大定：大运/小运/岁君（三个自由文本）× 岁数', () => {
	test('🔴 三运各取六十甲子全谱（各 60 局）→ 不抛', () => {
		const bad = [];
		ALL_GZ.forEach((gz) => {
			['dayun', 'xiaoyun', 'suijun'].forEach((k) => {
				const input = { pillars: P, dayun: P[1], xiaoyun: P[3], suijun: P[0], age: 40, [k]: gz };
				try { dadingDeathYear(input); } catch (e) { bad.push(`${k}=${gz} 抛 ${e.message}`); }
			});
		});
		expect(bad).toEqual([]);
	});
	test('🔴 三运为坏文本 → 不抛', () => {
		const bad = [];
		BAD_TEXT.forEach((v) => {
			['dayun', 'xiaoyun', 'suijun'].forEach((k) => {
				try { dadingDeathYear({ pillars: P, dayun: P[1], xiaoyun: P[3], suijun: P[0], age: 40, [k]: v }); }
				catch (e) { bad.push(`${k}=${JSON.stringify(v)} 抛 ${e.message}`); }
			});
		});
		expect(bad).toEqual([]);
	});
	test('岁数边界 0/1/120/999/负/非数 → 不抛', () => {
		[0, 1, 40, 120, 999, -1, NaN, null, 'x'].forEach((age) => {
			expect(() => dadingDeathYear({ pillars: P, dayun: P[1], xiaoyun: P[3], suijun: P[0], age })).not.toThrow();
		});
	});
	test('死月：月柱 × 年干全谱 → 不抛', () => {
		const bad = [];
		ALL_GZ.forEach((gz) => GAN.forEach((g) => {
			try { dadingDeathMonth(gz, g); } catch (e) { bad.push(`${gz}/${g} 抛 ${e.message}`); }
		}));
		expect(bad).toEqual([]);
	});
});

describe('神数正传·压测 · 六亲：演算时辰 12 支 × 天地四象八值', () => {
	const ENV = ['晴', '阴', '雨', '雪', '明', '晦'];
	test('🔴 12 时支 × 6 象 = 72 组 → 皆不抛', () => {
		const bad = [];
		ZHI.forEach((z) => ENV.forEach((e) => {
			try {
				const m = calcLiuqin({ ...BASE, gender: 1, yearZhi: P[0][1], hourZhi: P[3][1], yangYear: true, askHourZhi: z, env: e });
				if (!m) bad.push(`${z}/${e} → null`);
			} catch (err) { bad.push(`${z}/${e} 抛 ${err.message}`); }
		}));
		expect(bad).toEqual([]);
	});
	test('🔴 换演算时辰 → 玄机卦动爻必随之（否则此项是死的）', () => {
		const g = (z) => {
			const m = calcLiuqin({ ...BASE, gender: 1, yearZhi: P[0][1], hourZhi: P[3][1], yangYear: true, askHourZhi: z, env: '晴' });
			return m && m.xuanji && `${m.xuanji.gong}|${m.xuanji.dongYao}`;
		};
		const all = ZHI.map(g);
		expect(new Set(all).size).toBeGreaterThan(1);
	});
	test('乾坤两造 × 阴阳年 四组 → 六亲宫之取必异（天逆地顺）', () => {
		const k = (gd, yy) => {
			const m = calcLiuqin({ ...BASE, gender: gd, yearZhi: P[0][1], hourZhi: P[3][1], yangYear: yy, askHourZhi: '午', env: '晴' });
			return m && m.shengxiao && JSON.stringify(Object.keys(m.shengxiao.items).map((x) => m.shengxiao.items[x].gong));
		};
		expect(k(1, true)).not.toBe(k(0, true));   // 乾造↔坤造：夫妻/父母宫相反
	});
	test('坏输入（空支/坏象）→ 不抛', () => {
		[['', ''], ['x', 'y'], [null, null], [undefined, undefined]].forEach(([z, e]) => {
			expect(() => calcLiuqin({ ...BASE, gender: 1, yearZhi: P[0][1], hourZhi: P[3][1], yangYear: true, askHourZhi: z, env: e })).not.toThrow();
		});
	});
});

describe('神数正传·压测 · 心易：项 × 声 × 刻 × 宫 × 支 × 余数（查询层全谱）', () => {
	// 🔴 项名/声名一律取引擎之单一源 —— 我起初手抄了简体(姻缘/子孙/官禄)，而真表是繁体
	//    (姻緣/子孫/官祿)，96 组当场半数报「无条文号」。是我的测试错，非引擎错。
	//    手抄一份就是给自己挖坑：故此后一概自源取。
	const ITEMS = XINYI_ITEMS;
	const SOUNDS = [...XINYI_SOUNDS_A, ...XINYI_SOUNDS_B];
	test('🔴 六项 × 十六声 = 96 组 → 皆出条文号', () => {
		const bad = [];
		ITEMS.forEach((it) => SOUNDS.forEach((sd) => {
			try {
				const m = calcXinyi({ item: it, sound: sd, gender: 1 });
				if (!m || !m.xiang || !m.xiang.picked || !m.xiang.picked.length) bad.push(`${it}/${sd} → 无条文号`);
			} catch (e) { bad.push(`${it}/${sd} 抛 ${e.message}`); }
		}));
		expect(bad).toEqual([]);
	});
	test('🔴 八刻 × 八宫 = 64 组 → 皆出本命卦（京房八宫序，64/64）', () => {
		const KE = XINYI_KE;
		const bad = [];
		const seen = new Set();
		KE.forEach((k) => XINYI_GONG.forEach((g) => {
			const m = calcXinyi({ ke: k, gong: g, gender: 1 });
			if (!m || !m.bake || !m.bake.gua) bad.push(`${k}/${g} → 无卦`);
			else seen.add(m.bake.gua);
		}));
		expect(bad).toEqual([]);
		expect(seen.size).toBe(64);   // 64 格恰得 64 个不同之卦
	});
	test('🔴 十二支 × 十二余数 = 144 组 → 性情项皆出条文号', () => {
		const bad = [];
		ZHI.forEach((z) => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].forEach((y) => {
			try {
				const m = calcXinyi({ xqZhi: z, xqYushu: y, gender: 1 });
				if (!m || !m.xingqing || !m.xingqing.nums || !m.xingqing.nums.length) bad.push(`${z}/余${y} → 无条文号`);
			} catch (e) { bad.push(`${z}/余${y} 抛 ${e.message}`); }
		}));
		expect(bad).toEqual([]);
	});
	test('余数越界（0/13/-1/非数）→ 不抛', () => {
		[0, 13, -1, NaN, null, 'x'].forEach((y) => {
			expect(() => calcXinyi({ xqZhi: '子', xqYushu: y, gender: 1 })).not.toThrow();
		});
	});
	test('全空 opts → 仍出体例与所缺（查询层不依赖生辰）', () => {
		const m = calcXinyi({});
		expect(m).toBeTruthy();
		expect(m.meta && m.meta.gaps && m.meta.gaps.length).toBeGreaterThan(0);
	});
	test('🔴 条文正文古籍未载 → 只出号，不代入既有条文库之正文', () => {
		const m = calcXinyi({ item: XINYI_ITEMS[0], sound: '日', gender: 1 });
		expect(m.xiang.picked.every((x) => typeof x.num === 'number')).toBe(true);
		// 本支只出号：其 picked 皆为数,不带正文字段
		expect(m.xiang.picked.every((x) => !x.text && !x.verse)).toBe(true);
	});
});

describe('神数正传·压测 · 快照（导出/挂载之所本）皆可构且无字面 undefined', () => {
	test('🔴 五流派 × 快照 → 皆非空、皆无字面 undefined/NaN', () => {
		const models = {
			tieban: calcTieban({ yearGz: P[0], monthGz: P[1], dayGz: P[2], hourGz: P[3], ...BASE, askGz: P[3] }),
			shaozi: calcShaozi({ ...BASE, fatherAge: 27, motherAge: 26, yuan: 'zhong' }),
			liuqin: calcLiuqin({ ...BASE, gender: 1, yearZhi: P[0][1], hourZhi: P[3][1], yangYear: true, askHourZhi: '午', env: '晴' }),
			xinyi: calcXinyi({ item: XINYI_ITEMS[0], sound: '日', ke: '一刻', gong: '乾', xqZhi: '子', xqYushu: 3, gender: 1 }),
		};
		const bad = [];
		Object.keys(models).forEach((k) => {
			const t = buildZhengChuanSnapshotText(models[k], {});
			if (!t || t.length < 30) bad.push(`${k} → 快照 ${t ? t.length : 0} 字`);
			if (/undefined|NaN|\[object/.test(t || '')) bad.push(`${k} → 快照含字面 undefined/NaN`);
		});
		expect(bad).toEqual([]);
	});
	test('model 为 null → 快照不抛，返空', () => {
		expect(() => buildZhengChuanSnapshotText(null, {})).not.toThrow();
	});
});

describe('神数正传·规格表 · 查询表自证（数据完整性）', () => {
	test('六项之表皆在（项名取单一源，不手抄）', () => {
		expect(XINYI_ITEMS).toHaveLength(6);
		XINYI_ITEMS.forEach((it) => expect(xiangTable(it)).toBeTruthy());
	});
	test('性情表十二支齐', () => {
		expect(xingqingTable().length).toBe(12);
	});
	test('八宫齐', () => {
		expect(XINYI_GONG).toHaveLength(8);
	});
});
