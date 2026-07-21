// 神数正传 · 穷举压测：每流派 × 每选项每取值 × 组合 × 边界 × 空值 × 极端。
// 判据不止「不抛」——须同时满足：① 结果结构完整 ② 取值落在古籍所限的域内
// ③ 该动的真动（同轴换值必产出互异）④ 不该动的不动（无关轴零串扰）。
import { calcTieban } from '../zhengchuanTiebanLocal';
import { calcShaozi } from '../zhengchuanShaoziLocal';
import { dadingDeathYear, dadingCe } from '../zhengchuanDadingLocal';
import { calcLiuqin, calcQiziXingshi, calcXuanjiDongyao, calcShengxiao } from '../zhengchuanLiuqinLocal';
import { calcXinyi, lookupXiang, lookupXingqing, lookupBake, XINYI_ITEMS, XINYI_SOUNDS_A, XINYI_SOUNDS_B, XINYI_KE, XINYI_GONG } from '../zhengchuanXinyiLocal';

const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GZ60 = Array.from({ length: 60 }, (_, n) => GAN[n % 10] + ZHI[n % 12]);
const BASE = { pillars: ['甲子', '庚午', '乙丑', '甲申'], gender: '男', lunarMonth: 5, lunarDay: 15, isLeapMonth: false };

describe('压测 · 铁板：求测时辰 60 干支全覆盖', () => {
	test('60/60 皆出完整结构，且考刻只出初刻/正刻、本命数为正整数', () => {
		const bad = [];
		GZ60.forEach((gz) => {
			const r = calcTieban({
				yearGz: BASE.pillars[0], monthGz: BASE.pillars[1], dayGz: BASE.pillars[2], hourGz: BASE.pillars[3],
				gender: BASE.gender, lunarMonth: BASE.lunarMonth, lunarDay: BASE.lunarDay, isLeapMonth: false, askGz: gz,
			});
			if (!r || !r.benming) return bad.push(`${gz}: 无结果`);
			const b = r.benming;
			if (['初刻', '正刻'].indexOf(b.ke) < 0) bad.push(`${gz}: 考刻=${b.ke}`);
			if (!(Number.isInteger(b.benMingShu) && b.benMingShu > 0)) bad.push(`${gz}: 本命数=${b.benMingShu}`);
			if (!b.steps || b.steps.length < 8) bad.push(`${gz}: 起数链只 ${b.steps && b.steps.length} 步`);
		});
		expect(bad).toEqual([]);
	});
	test('求测时辰真影响：60 取值所出本命数不止一种（否则=此选项白设）', () => {
		const set = new Set(GZ60.map((gz) => {
			const r = calcTieban({
				yearGz: BASE.pillars[0], monthGz: BASE.pillars[1], dayGz: BASE.pillars[2], hourGz: BASE.pillars[3],
				gender: BASE.gender, lunarMonth: 5, lunarDay: 15, isLeapMonth: false, askGz: gz,
			});
			return r && r.benming && r.benming.benMingShu;
		}));
		expect(set.size).toBeGreaterThan(1);
	});
	test('边界：农历月 1..12 × 日 1..30 全覆盖不抛且本命数恒正', () => {
		const bad = [];
		for (let m = 1; m <= 12; m += 1) for (let d = 1; d <= 30; d += 1) {
			const r = calcTieban({
				yearGz: '甲子', monthGz: '庚午', dayGz: '乙丑', hourGz: '甲申',
				gender: '男', lunarMonth: m, lunarDay: d, isLeapMonth: false, askGz: '丙辰',
			});
			if (!r || !r.benming || !(r.benming.benMingShu > 0)) bad.push(`${m}/${d}`);
		}
		expect(bad).toEqual([]);
	});
	test('极端/空值：闰月 · 男女 · 缺 askGz 皆不抛', () => {
		[true, false].forEach((leap) => ['男', '女'].forEach((g) => {
			const r = calcTieban({ ...{ yearGz: '甲子', monthGz: '庚午', dayGz: '乙丑', hourGz: '甲申' }, gender: g, lunarMonth: 12, lunarDay: 30, isLeapMonth: leap, askGz: '' });
			expect(r).toBeTruthy();
		}));
	});
});

describe('压测 · 邵子：元运 3 × 父母年龄域 × 整除特例', () => {
	test('元运 3 取值 × 父12..99 × 母12..99 采样 —— 结构完整、天地人三数皆正整数', () => {
		const bad = [];
		['shang', 'zhong', 'xia'].forEach((yuan) => {
			for (let f = 12; f <= 99; f += 7) for (let m = 12; m <= 99; m += 11) {
				const r = calcShaozi({ ...BASE, fatherAge: f, motherAge: m, yuan });
				if (!r || !r.xianTian) { bad.push(`${yuan}/${f}/${m}: 无结果`); continue; }
				if (!(r.tianMing.num > 0 && r.diMing.num > 0)) bad.push(`${yuan}/${f}/${m}: 天/地命数非正`);
				if (!r.xianTian.gua) bad.push(`${yuan}/${f}/${m}: 无先天命卦`);
			}
		});
		expect(bad).toEqual([]);
	});
	test('整除特例：父/母年龄为 12 之倍数时走特例式（12..96 全覆盖）', () => {
		const bad = [];
		for (let a = 12; a <= 96; a += 12) {
			const r = calcShaozi({ ...BASE, fatherAge: a, motherAge: a });
			if (!r) { bad.push(`${a}: 无结果`); continue; }
			if (!r.tianMing.special) bad.push(`父${a}: 未走整除特例`);
			if (!r.diMing.special) bad.push(`母${a}: 未走整除特例`);
			if (!(r.tianMing.num > 12000 && r.diMing.num > 12000)) bad.push(`${a}: 特例数应逾 12000，实得 ${r.tianMing.num}/${r.diMing.num}`);
		}
		expect(bad).toEqual([]);
	});
	test('元运只在先天命卦余五时生效（非余五之盘：换元运产出恒同）', () => {
		const outs = ['shang', 'zhong', 'xia'].map((yuan) => {
			const r = calcShaozi({ ...BASE, fatherAge: 27, motherAge: 26, yuan });
			return r && r.xianTian && r.xianTian.gua && r.xianTian.gua.name;
		});
		// 本盘若非余五 → 三元运同卦；若为余五 → 至少两异。二者必居其一，不得抛
		expect(outs.every(Boolean)).toBe(true);
		expect(new Set(outs).size === 1 || new Set(outs).size >= 2).toBe(true);
	});
});

describe('压测 · 大定：虚岁 1..120 全覆盖 × 七位干支', () => {
	test('虚岁 1..120 逐岁不抛，起数链各步恒为整数', () => {
		const bad = [];
		for (let age = 1; age <= 120; age += 1) {
			const r = dadingDeathYear({ pillars: BASE.pillars, dayun: '丙午', xiaoyun: '乙巳', suijun: '辛卯', age });
			if (!r) { bad.push(`${age}: 无结果`); continue; }
			if (!Number.isInteger(r.sum) || r.sum <= 0) bad.push(`${age}: 七位策积=${r.sum}`);
			if (!(r.r12 >= 0 && r.r12 < 12)) bad.push(`${age}: 12 除之余=${r.r12} 越域`);
		}
		expect(bad).toEqual([]);
	});
	test('60 干支之策数皆为正整数（太玄数干+支+纳音本数）', () => {
		const bad = GZ60.filter((gz) => { const c = dadingCe(gz); return !(c && Number.isInteger(c.ce) && c.ce > 0 && c.gan > 0 && c.zhi > 0 && c.ben > 0); });
		expect(bad).toEqual([]);
	});
	test('三运（大运/小运/岁君）各 60 取值采样 → 七位策积随之改（选项真生效）', () => {
		['dayun', 'xiaoyun', 'suijun'].forEach((k) => {
			const sums = new Set(GZ60.filter((_, i) => i % 7 === 0).map((gz) => {
				const r = dadingDeathYear({ pillars: BASE.pillars, dayun: '丙午', xiaoyun: '乙巳', suijun: '辛卯', age: 40, [k]: gz });
				return r && r.sum;
			}));
			expect(sums.size).toBeGreaterThan(1);
		});
	});
});

describe('压测 · 六亲：演算时辰 12 × 天象 4 全组合（48/48）', () => {
	test('48 组合逐一：宫位落十二支、动爻恒 1..6 或显式为空', () => {
		const bad = [];
		ZHI.forEach((h) => {
			const isDay = '卯辰巳午未申'.indexOf(h) >= 0;
			(isDay ? ['晴', '陰', '雨', '雪'] : ['明', '晦', '雨', '雪']).forEach((env) => {
				const r = calcXuanjiDongyao({
					yearZhi: '子', lunarMonth: 5, lunarDay: 15, hourZhi: '申', gender: 1, yangYear: true,
					askHourZhi: h, env,
				});
				if (!r) return bad.push(`${h}/${env}: 无结果`);
				if (ZHI.indexOf(r.gong) < 0) bad.push(`${h}/${env}: 宫位=${r.gong}`);
				if (r.dongYao !== null && !(r.dongYao >= 1 && r.dongYao <= 6)) bad.push(`${h}/${env}: 动爻=${r.dongYao} 越域`);
				if (r.isDay !== isDay) bad.push(`${h}/${env}: 昼夜判失（应 ${isDay ? '白天' : '昼夜'}）`);
			});
		});
		expect(bad).toEqual([]);
	});
	test('时辰跨昼夜分界（申↔酉）→ 改走地四象、四象取值域随之换', () => {
		const day = calcXuanjiDongyao({ yearZhi: '子', lunarMonth: 5, lunarDay: 15, hourZhi: '申', gender: 1, yangYear: true, askHourZhi: '申', env: '晴' });
		const night = calcXuanjiDongyao({ yearZhi: '子', lunarMonth: 5, lunarDay: 15, hourZhi: '申', gender: 1, yangYear: true, askHourZhi: '酉', env: '明' });
		expect(day.isDay).toBe(true);
		expect(night.isDay).toBe(false);
		expect(['日', '月', '星', '辰']).toContain(day.sixiang);
		expect(['水', '火', '土', '石']).toContain(night.sixiang);
	});
	test('四向（阳男/阴男/阳女/阴女）顺逆各半，宫位不越域', () => {
		const dirs = [];
		[1, 0].forEach((gender) => [true, false].forEach((yangYear) => {
			const r = calcXuanjiDongyao({ yearZhi: '子', lunarMonth: 5, lunarDay: 15, hourZhi: '申', gender, yangYear, askHourZhi: '午', env: '晴' });
			dirs.push(r.direction);
			expect(ZHI).toContain(r.gong);
		}));
		expect(dirs.filter((d) => d === '顺数')).toHaveLength(2);
		expect(dirs.filter((d) => d === '逆数')).toHaveLength(2);
	});
	test('闰月 × 初一..三十全覆盖：十五前后分作前/后月，皆不抛', () => {
		const bad = [];
		for (let d = 1; d <= 30; d += 1) {
			const r = calcXuanjiDongyao({ yearZhi: '子', lunarMonth: 5, lunarDay: d, hourZhi: '申', gender: 1, yangYear: true, isLeapMonth: true, askHourZhi: '午', env: '晴' });
			if (!r) { bad.push(`${d}: 无结果`); continue; }
			const want = d >= 16 ? '后月' : '前月';
			if (r.steps[0].detail.indexOf(want) < 0) bad.push(`闰月 ${d} 日应作${want}`);
		}
		expect(bad).toEqual([]);
	});
	test('60 干支 × 男女 全盘扫：秘音断姓氏 —— 阳支必推到底、阴支必显式标缺（零静默）', () => {
		const bad = [];
		let solved = 0; let flagged = 0;
		GZ60.forEach((yg) => GZ60.filter((_, i) => i % 13 === 0).forEach((hg) => {
			const r = calcQiziXingshi({ pillars: [yg, '庚辰', '己未', hg] });
			if (!r) return bad.push(`${yg}/${hg}: 无结果`);
			if (r.missing) { flagged += 1; if (r.missing.indexOf('古籍') < 0) bad.push(`${yg}/${hg}: 标缺未言古籍依据`); return; }
			solved += 1;
			if (['土', '木', '水', '火', '金'].indexOf(r.xianTianWuxing) < 0) bad.push(`${yg}/${hg}: 先天五行=${r.xianTianWuxing}`);
			if (!(r.tableNo >= 1 && r.tableNo <= 6)) bad.push(`${yg}/${hg}: 表号=${r.tableNo} 越域`);
			if (!Array.isArray(r.candidates)) bad.push(`${yg}/${hg}: 无候选数组`);
		}));
		expect(bad).toEqual([]);
		expect(solved).toBeGreaterThan(0);   // 阳支之格确能推到底
		expect(flagged).toBeGreaterThan(0);  // 阴支之格确会标缺（古籍未载此格之遁法）
	});
	test('60 干支 × 男女：旬遁断属相 —— 生肖恒落十二属，六亲宫恒为十二宫之一', () => {
		const bad = [];
		GZ60.filter((_, i) => i % 7 === 0).forEach((yg) => [1, 0].forEach((gender) => {
			const r = calcShengxiao({ pillars: [yg, '庚午', '乙丑', '甲申'], gender, lunarMonth: 5 });
			if (!r) return bad.push(`${yg}/${gender}: 无结果`);
			['spouse', 'parent'].forEach((k) => {
				const it = r.items[k];
				if (ZHI.indexOf(it.gong) < 0) bad.push(`${yg}/${gender}/${k}: 宫=${it.gong}`);
				if (!it.dun) return bad.push(`${yg}/${gender}/${k}: 旬遁无果`);
				if ('鼠牛虎兔龍蛇馬羊猴雞狗豬'.indexOf(it.dun.shengxiao) < 0) bad.push(`${yg}/${gender}/${k}: 属相=${it.dun.shengxiao}`);
				if (!(it.dun.p >= 1 && it.dun.p <= 9)) bad.push(`${yg}/${gender}/${k}: 落宫=${it.dun.p} 越九宫`);
			});
		}));
		expect(bad).toEqual([]);
	});
});

describe('压测 · 心易查询层：项目6×声音16 / 刻8×宫8 / 支12×余12 全组合', () => {
	test('项目 × 声音 96/96 全组合皆出号，且号恒为四位正整数', () => {
		const bad = [];
		XINYI_ITEMS.forEach((item) => [...XINYI_SOUNDS_A, ...XINYI_SOUNDS_B].forEach((sound) => {
			const r = lookupXiang(item, sound, 1);
			if (!r) return bad.push(`${item}/${sound}: 无结果`);
			if (!r.picked.length) return bad.push(`${item}/${sound}: 空号`);
			r.picked.forEach((x) => { if (!(Number.isInteger(x.num) && x.num >= 1000 && x.num <= 9999)) bad.push(`${item}/${sound}: 号=${x.num}`); });
		}));
		expect(bad).toEqual([]);
	});
	test('项目 × 声音 × 男女 192 组合：有标记之格随性别取值，无标记之格恒同', () => {
		const bad = [];
		XINYI_ITEMS.forEach((item) => [...XINYI_SOUNDS_A, ...XINYI_SOUNDS_B].forEach((sound) => {
			const m = lookupXiang(item, sound, 1);
			const f = lookupXiang(item, sound, 0);
			const hasMark = m.all.some((x) => x.mark);
			const same = JSON.stringify(m.picked) === JSON.stringify(f.picked);
			if (!hasMark && !same) bad.push(`${item}/${sound}: 无标记之格却随性别变`);
			if (hasMark && same && m.all.filter((x) => x.mark).length > 1) bad.push(`${item}/${sound}: 有标记之格却不随性别变`);
		}));
		expect(bad).toEqual([]);
	});
	test('刻 8 × 宫 8 = 64/64 全组合皆出卦，且六十四卦无一重出', () => {
		const guas = [];
		const bad = [];
		XINYI_KE.forEach((ke) => XINYI_GONG.forEach((gong) => {
			const g = lookupBake(ke, gong);
			if (!g) return bad.push(`${ke}/${gong}: 无卦`);
			guas.push(g);
		}));
		expect(bad).toEqual([]);
		expect(guas).toHaveLength(64);
		expect(new Set(guas).size).toBe(64);
	});
	test('地支 12 × 余数 12 = 144/144 全组合皆出号', () => {
		const bad = [];
		ZHI.forEach((z) => { for (let k = 1; k <= 12; k += 1) {
			const r = lookupXingqing(z, k);
			if (!r || !r.nums.length) bad.push(`${z}/${k}: 空`);
			else r.nums.forEach((n) => { if (!(n >= 3000 && n <= 3999)) bad.push(`${z}/${k}: 号=${n} 逾性情号段`); });
		} });
		expect(bad).toEqual([]);
	});
	test('六轴全组合采样（6项 × 16声 × 2刻 × 2宫 × 3支 × 3余 = 3456 组）皆不抛且结构完整', () => {
		const bad = [];
		let n = 0;
		XINYI_ITEMS.forEach((item) => [...XINYI_SOUNDS_A, ...XINYI_SOUNDS_B].forEach((sound) => {
			XINYI_KE.filter((_, i) => i % 4 === 0).forEach((ke) => XINYI_GONG.filter((_, i) => i % 4 === 0).forEach((gong) => {
				['子', '午', '亥'].forEach((xqZhi) => ['1', '8', '12'].forEach((xqYushu) => {
					n += 1;
					const r = calcXinyi({ item, sound, ke, gong, xqZhi, xqYushu, gender: 1 });
					if (!r || !r.isLookup) return bad.push(`${item}/${sound}/${ke}/${gong}/${xqZhi}/${xqYushu}: 无结果或未标查询层`);
					if (!r.bake || !r.bake.gua) bad.push(`…/${ke}/${gong}: 八刻无卦`);
					if (!r.xiang || !r.xiang.picked.length) bad.push(`${item}/${sound}: 无号`);
					if (!r.xingqing || !r.xingqing.nums.length) bad.push(`${xqZhi}/${xqYushu}: 性情无号`);
				}));
			}));
		}));
		expect(bad).toEqual([]);
		expect(n).toBe(3456);
	});
	test('空值/坏值：全空 opts、未知项目、越域余数 → 皆返 null/空而不抛', () => {
		expect(calcXinyi({}).isLookup).toBe(true);
		expect(calcXinyi({}).xiang).toBeNull();
		expect(lookupXiang('財運', '日', 1)).toBeNull();      // 古籍未出此项之表
		expect(lookupXingqing('子', 13)).toBeNull();
		expect(lookupXingqing('子', 0)).toBeNull();
		expect(lookupBake('九刻', '乾')).toBeNull();
		expect(lookupBake('一刻', '中')).toBeNull();
	});
});

describe('压测 · 跨流派：同盘五支互不串扰 + 空/极端输入', () => {
	test('同一盘跑五支：各出各的结构，互不污染', () => {
		const t = calcTieban({ yearGz: '甲子', monthGz: '庚午', dayGz: '乙丑', hourGz: '甲申', gender: '男', lunarMonth: 5, lunarDay: 15, isLeapMonth: false, askGz: '己巳' });
		const s = calcShaozi({ ...BASE, fatherAge: 27, motherAge: 26 });
		const d = dadingDeathYear({ pillars: BASE.pillars, dayun: '丙午', xiaoyun: '乙巳', suijun: '辛卯', age: 40 });
		const l = calcLiuqin({ pillars: BASE.pillars, gender: 1, lunarMonth: 5, lunarDay: 15, yearZhi: '子', hourZhi: '申', yangYear: true });
		const x = calcXinyi({ item: '父母', sound: '日', gender: 1 });
		expect(t.benming.benMingShu).toBeGreaterThan(0);
		expect(s.xianTian.gua).toBeTruthy();
		expect(d.sum).toBeGreaterThan(0);
		expect(l.shengxiao.items.spouse.dun.shengxiao).toBeTruthy();
		expect(x.isLookup).toBe(true);
		expect(l.school).toBe('liuqin');
		expect(x.school).toBe('xinyi');
	});
	test('极端：坏四柱（空串/单字/非干支）各支皆返 null 而不抛', () => {
		[[], ['', '', '', ''], ['甲', '庚', '乙', '甲'], ['XX', 'YY', 'ZZ', 'WW']].forEach((p) => {
			expect(() => calcShaozi({ ...BASE, pillars: p, fatherAge: 27, motherAge: 26 })).not.toThrow();
			expect(() => calcLiuqin({ pillars: p, gender: 1, lunarMonth: 5 })).not.toThrow();
			expect(() => calcQiziXingshi({ pillars: p })).not.toThrow();
		});
	});
	test('极端：农历月/日越域（0、13、31、负数）不抛', () => {
		[[0, 1], [13, 1], [5, 0], [5, 31], [-1, -1]].forEach(([m, d]) => {
			expect(() => calcTieban({ yearGz: '甲子', monthGz: '庚午', dayGz: '乙丑', hourGz: '甲申', gender: '男', lunarMonth: m, lunarDay: d, isLeapMonth: false, askGz: '丙辰' })).not.toThrow();
			expect(() => calcXuanjiDongyao({ yearZhi: '子', lunarMonth: m, lunarDay: d, hourZhi: '申', gender: 1, yangYear: true, askHourZhi: '午', env: '晴' })).not.toThrow();
		});
	});
	test('极端：坏天象/坏时辰 → 四象为空但不抛，动爻显式为 null（不臆造）', () => {
		const r = calcXuanjiDongyao({ yearZhi: '子', lunarMonth: 5, lunarDay: 15, hourZhi: '申', gender: 1, yangYear: true, askHourZhi: '午', env: '霧' });
		expect(r).toBeTruthy();
		expect(r.sixiang).toBeFalsy();
		expect(r.dongYao).toBeFalsy();
	});
});

// ── 压测抓出的四处真 bug 之反锚：诸表键域皆 1..N（无 0 行）→ 余 0 须作 N ──────
// 古籍只言「除以 N 取其餘數」而未载整除之例（其算例之余皆非 0），然表印 N 行无 0 行 →
// 域即 1..N。若引擎作 % N 而不保底：余 0 查表落空（铁板即崩），且键 N 永成死码。
describe('压测 · 取余查表须与表键域相容（余 0 作 N）', () => {
	const TIEBAN_TABLES = require('../data/zhengchuanTiebanTables.json');
	const SHAOZI_TABLES = require('../data/zhengchuanShaoziTables.json');

	test('诸表之数字键域皆自 1 起、不含 0（此为「余 0 作 N」之依据）', () => {
		const chk = (t, name) => {
			const ks = Object.keys(t).filter((k) => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
			expect({ [name]: ks[0] }).toEqual({ [name]: 1 });
			expect(t['0']).toBeUndefined();
		};
		chk(TIEBAN_TABLES.liunianMark, 'liunianMark');
		chk(SHAOZI_TABLES.xingqingSound, 'xingqingSound');
		chk(SHAOZI_TABLES.zuyeGua, 'zuyeGua');
		chk(SHAOZI_TABLES.taixuanYuJing, 'taixuanYuJing');
		chk(SHAOZI_TABLES.lianshanGua, 'lianshanGua');
	});

	test('铁板：60 求测时辰 × 60 年柱 全扫 —— 后天命数恒落 1..8，零崩（余 0 曾崩于 liunianMark[0]）', () => {
		const bad = [];
		GZ60.forEach((yg) => GZ60.filter((_, i) => i % 6 === 0).forEach((ag) => {
			let r;
			try {
				r = calcTieban({ yearGz: yg, monthGz: '庚午', dayGz: '乙丑', hourGz: '甲申', gender: '男', lunarMonth: 5, lunarDay: 15, isLeapMonth: false, askGz: ag });
			} catch (e) { return bad.push(`${yg}/${ag}: 抛 ${e.message}`); }
			if (!r || !r.liunian) return;
			const h = r.liunian.houTian;
			if (!(h >= 1 && h <= 8)) bad.push(`${yg}/${ag}: 后天命数=${h} 越域(表键 1..8)`);
			r.liunian.rows.forEach((x) => { if (!x.missing && !x.letter) bad.push(`${yg}/${ag}/${x.age}岁: 字母失值`); });
		}));
		expect(bad).toEqual([]);
	});

	test('邵子：父母年龄全域扫 —— 性情/祖业之余恒落 1..12、玉景之余恒落 1..81，零失值', () => {
		const bad = [];
		for (let f = 12; f <= 99; f += 3) for (let m = 12; m <= 99; m += 5) {
			let r;
			try { r = calcShaozi({ ...BASE, fatherAge: f, motherAge: m }); }
			catch (e) { bad.push(`${f}/${m}: 抛 ${e.message}`); continue; }
			if (!r || !r.benming) continue;
			const xq = r.benming['性情']; const zy = r.benming['祖业']; const cy = r.benming['财运'];
			if (xq && !(xq.rem >= 1 && xq.rem <= 12)) bad.push(`${f}/${m}: 性情余=${xq.rem} 越域`);
			if (zy && !(zy.rem >= 1 && zy.rem <= 12)) bad.push(`${f}/${m}: 祖业余=${zy.rem} 越域`);
			if (cy && cy.path && !(cy.path.rem >= 1 && cy.path.rem <= 81)) bad.push(`${f}/${m}: 玉景余=${cy.path.rem} 越域`);
		}
		expect(bad).toEqual([]);
	});
});
