// 八卦阳宅法计算内核单测：卦位映射 / 成员动态定义 / 64卦合成 / 应期成格 / 排位升降 / 形神。
import { degreeToGua, resolveMemberRole, composeHexagram, computeTiming, guaByDir, computeRankShift, namePositionRelation, guaBySectorNum, SECTOR_NUM_TO_GUA } from '../baguaCore';

describe('degreeToGua — 8卦各45°铺满，必落卦无无人带', () => {
	test('八方中心各落对应卦（北坎/东北艮/东震/东南巽/南离/西南坤/西兑/西北乾）', () => {
		expect(degreeToGua(0)).toBe('坎');
		expect(degreeToGua(45)).toBe('艮');
		expect(degreeToGua(90)).toBe('震');
		expect(degreeToGua(135)).toBe('巽');
		expect(degreeToGua(180)).toBe('离');
		expect(degreeToGua(225)).toBe('坤');
		expect(degreeToGua(270)).toBe('兑');
		expect(degreeToGua(315)).toBe('乾');
	});
	test('全 360° 每一度必落某卦，绝不返 null（无人带已废）', () => {
		for (let a = 0; a < 360; a += 1) {
			expect(degreeToGua(a)).toBeTruthy();
		}
	});
	test('跨 0° 归一与负角', () => {
		expect(degreeToGua(360)).toBe('坎');
		expect(degreeToGua(-45)).toBe('乾');
		expect(degreeToGua(336)).toBe('乾'); // 乾 = [292.5, 337.5)，336 在区间内
		expect(degreeToGua(337.5)).toBe('坎'); // 半开边界滚入坎
	});
	test('非法输入返回 null', () => {
		expect(degreeToGua(null)).toBeNull();
		expect(degreeToGua(undefined)).toBeNull();
		expect(degreeToGua(NaN)).toBeNull();
	});
});

describe('guaByDir — 8 方位 → 卦', () => {
	test('八方齐全', () => {
		['北', '东北', '东', '东南', '南', '西南', '西', '西北'].forEach((d) => {
			expect(guaByDir(d)).toBeTruthy();
		});
		expect(guaByDir('北')).toBe('坎');
		expect(guaByDir('西北')).toBe('乾');
	});
});

describe('resolveMemberRole — 成员动态定义 9 条 + 优先级短路', () => {
	test('有子女最高优先（盖过已婚与兄姐数）', () => {
		expect(resolveMemberRole({ sex: 'M', hasChildren: true, married: false })).toEqual({ role: '父', benmingGua: '乾' });
		expect(resolveMemberRole({ sex: 'F', hasChildren: true, married: true, olderSistersUnmarried: 5 })).toEqual({ role: '母', benmingGua: '坤' });
	});
	test('已婚无子 → 夫 / 妻', () => {
		expect(resolveMemberRole({ sex: 'M', married: true })).toEqual({ role: '夫', benmingGua: '乾' });
		expect(resolveMemberRole({ sex: 'F', married: true })).toEqual({ role: '妻', benmingGua: '坤' });
	});
	test('未婚无子 · 男按未婚兄数（长子震/次子坎/三子艮）', () => {
		expect(resolveMemberRole({ sex: 'M', olderBrothersUnmarried: 0 })).toEqual({ role: '长子', benmingGua: '震' });
		expect(resolveMemberRole({ sex: 'M', olderBrothersUnmarried: 1 })).toEqual({ role: '次子', benmingGua: '坎' });
		expect(resolveMemberRole({ sex: 'M', olderBrothersUnmarried: 2 })).toEqual({ role: '三子', benmingGua: '艮' });
	});
	test('未婚无子 · 女按未婚姐数（长女巽/次女离/三女兑）', () => {
		expect(resolveMemberRole({ sex: 'F', olderSistersUnmarried: 0 })).toEqual({ role: '长女', benmingGua: '巽' });
		expect(resolveMemberRole({ sex: 'F', olderSistersUnmarried: 1 })).toEqual({ role: '次女', benmingGua: '离' });
		expect(resolveMemberRole({ sex: 'F', olderSistersUnmarried: 2 })).toEqual({ role: '三女', benmingGua: '兑' });
	});
	test('取模 3 循环：第 4 女（姐数 3）回长女巽，第 4 子（兄数 3）回长子震', () => {
		expect(resolveMemberRole({ sex: 'F', olderSistersUnmarried: 3 })).toEqual({ role: '长女', benmingGua: '巽' });
		expect(resolveMemberRole({ sex: 'M', olderBrothersUnmarried: 3 })).toEqual({ role: '长子', benmingGua: '震' });
	});
	test('离婚/丧偶且无子 → 归未婚序（married=false 即涵盖）', () => {
		expect(resolveMemberRole({ sex: 'F', married: false, hasChildren: false, olderSistersUnmarried: 0 })).toEqual({ role: '长女', benmingGua: '巽' });
	});
	test('空输入有兜底', () => {
		expect(resolveMemberRole(null)).toEqual({ role: '长女', benmingGua: '巽' });
	});
});

describe('composeHexagram — 名在上 × 位在下 → 64 卦', () => {
	test('巽(长女) 上 × 乾(西北) 下 = 风天小畜 no.9', () => {
		expect(composeHexagram('巽', '乾')).toEqual({ no: 9, name: '风天小畜' });
	});
	test('坎 上 × 离 下 = 水火既济 no.63', () => {
		expect(composeHexagram('坎', '离')).toEqual({ no: 63, name: '水火既济' });
	});
	test('8 纯卦对角', () => {
		expect(composeHexagram('乾', '乾')).toEqual({ no: 1, name: '乾为天' });
		expect(composeHexagram('坤', '坤')).toEqual({ no: 2, name: '坤为地' });
		expect(composeHexagram('坎', '坎')).toEqual({ no: 29, name: '坎为水' });
		expect(composeHexagram('离', '离')).toEqual({ no: 30, name: '离为火' });
		expect(composeHexagram('震', '震')).toEqual({ no: 51, name: '震为雷' });
		expect(composeHexagram('巽', '巽')).toEqual({ no: 57, name: '巽为风' });
		expect(composeHexagram('艮', '艮')).toEqual({ no: 52, name: '艮为山' });
		expect(composeHexagram('兑', '兑')).toEqual({ no: 58, name: '兑为泽' });
	});
	test('64 卦号唯一且齐全（1-64 各一次）', () => {
		const guas = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
		const nos = [];
		guas.forEach((u) => guas.forEach((l) => { const h = composeHexagram(u, l); expect(h).toBeTruthy(); nos.push(h.no); }));
		expect(nos.length).toBe(64);
		expect(new Set(nos).size).toBe(64);
		expect(Math.min(...nos)).toBe(1);
		expect(Math.max(...nos)).toBe(64);
	});
	test('缺卦返回 null', () => {
		expect(composeHexagram(null, '乾')).toBeNull();
		expect(composeHexagram('乾', null)).toBeNull();
	});
});

describe('computeTiming — 应期档位 + 八卦五行相生/比和加速、相克减缓', () => {
	test('窗口为三档之一', () => {
		const r = computeTiming({ no: 51 }, {});
		expect(['3天~3月', '3月~3年', '6月~6年']).toContain(r.window);
		expect(['fast', 'mid', 'slow']).toContain(r.pace);
	});
	test('比和（本命乾金 · 房间兑金）→ accelerated', () => {
		const r = computeTiming({ no: 10 }, { benmingGua: '乾', roomGua: '兑' });
		expect(r.accelerated).toBe(true);
		expect(r.slowed).toBe(false);
	});
	test('房间卦生本命（房间坤土 生 本命乾金）→ accelerated', () => {
		const r = computeTiming({ no: 12 }, { benmingGua: '乾', roomGua: '坤' });
		expect(r.accelerated).toBe(true);
	});
	test('相克（房间离火 克 本命乾金）→ slowed', () => {
		const r = computeTiming({ no: 14 }, { benmingGua: '乾', roomGua: '离' });
		expect(r.slowed).toBe(true);
		expect(r.accelerated).toBe(false);
	});
});

describe('guaBySectorNum / SECTOR_NUM_TO_GUA — 扇区编号 → 卦（与纳气盘共用 8 扇区）', () => {
	test('8 扇区各映对应卦', () => {
		expect(guaBySectorNum(1)).toBe('坎'); // 北
		expect(guaBySectorNum(8)).toBe('艮'); // 东北
		expect(guaBySectorNum(3)).toBe('震'); // 东
		expect(guaBySectorNum(4)).toBe('巽'); // 东南
		expect(guaBySectorNum(9)).toBe('离'); // 南
		expect(guaBySectorNum(2)).toBe('坤'); // 西南
		expect(guaBySectorNum(7)).toBe('兑'); // 西
		expect(guaBySectorNum(6)).toBe('乾'); // 西北
	});
	test('映射表 8 项齐全、卦不重复', () => {
		const guas = Object.values(SECTOR_NUM_TO_GUA);
		expect(guas.length).toBe(8);
		expect(new Set(guas).size).toBe(8);
	});
	test('非法编号返回 null', () => {
		expect(guaBySectorNum(0)).toBeNull();
		expect(guaBySectorNum(99)).toBeNull();
	});
});

describe('computeRankShift — 阳宅排位升降（爻辞推命三案例验证）', () => {
	test('火天大有：二女(离)居父位(乾)，女居男位 → 提前 3 年', () => {
		const r = computeRankShift('离', '乾');
		expect(r.dir).toBe('提前');
		expect(r.years).toBe(3);
	});
	test('雷地豫：长子(震)居母位(坤)，男居女位 → 延后 1 年', () => {
		const r = computeRankShift('震', '坤');
		expect(r.dir).toBe('延后');
		expect(r.years).toBe(1);
	});
	test('泽雷随：三女(兑)居长子位(震)，女居男位 → 提前 4 年', () => {
		const r = computeRankShift('兑', '震');
		expect(r.dir).toBe('提前');
		expect(r.years).toBe(4);
	});
	// 同性例外层
	test('例外·同性兄弟升位：次子(坎)居长子位(震) → 提前 2 年（26 vs 28 岁）', () => {
		const r = computeRankShift('坎', '震');
		expect(r.dir).toBe('提前');
		expect(r.years).toBe(2);
	});
	test('例外·同性兄弟降位：长子(震)居次子位(坎) → 延后 2 年', () => {
		const r = computeRankShift('震', '坎');
		expect(r.dir).toBe('延后');
		expect(r.years).toBe(2);
	});
	test('例外·同性姐妹升位：三女(兑)居长女位(巽) → 提前（早嫁）', () => {
		const r = computeRankShift('兑', '巽');
		expect(r.dir).toBe('提前');
		expect(r.years).toBeGreaterThan(0);
	});
	test('例外·同性居父母位：长子(震)居父位(乾) → 延后（心态早熟·晚婚）', () => {
		const r = computeRankShift('震', '乾');
		expect(r.dir).toBe('延后');
		expect(r.years).toBeGreaterThan(0);
	});
	test('名位同卦 → 无加减', () => {
		const r = computeRankShift('巽', '巽');
		expect(r.dir).toBe('平');
		expect(r.years).toBe(0);
	});
});

describe('namePositionRelation — 形神（名=位→家和万事兴）', () => {
	test('巽居巽（名位相同）→ same', () => {
		const r = namePositionRelation('巽', '巽');
		expect(r.same).toBe(true);
		expect(r.text).toContain('家和');
	});
	test('名位不同 → not same', () => {
		expect(namePositionRelation('巽', '乾').same).toBe(false);
	});
});
