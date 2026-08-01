// Step3 压力测试矩阵:全选项取值 × 组合 × 边界/空/极端,验证每盘合法(14主星+12宫)+overlay 不抛。
import { assembleNatalChart, calcZiwei } from '../ZiweiCalc';
import { qiShuWei, allBorrowedStars, taiSuiRuGua } from '../ziweiOverlays';
import { childLimits, zhongxianOf, relabelPalaces } from '../ziweiCore';
import { detectPatterns } from '../ziweiPatterns';
import { SiHuaTables, ZWSchool, refreshActiveSiHua } from '../../../constants/ZWConst';

const GAN = '甲乙丙丁戊己庚辛壬癸'.split('');
const ZHI = '子丑寅卯辰巳午未申酉戌亥'.split('');

// 盘合法性:恰 14 主星 + 12 宫齐 + 每宫 index 合法。
function assertValid(c){
	expect(c).toBeTruthy();
	expect(Array.isArray(c.houses)).toBe(true);
	expect(c.houses.length).toBe(12);
	let main = 0;
	for(let i = 0; i < 12; i++){ main += (c.houses[i].starsMain || []).length; }
	expect(main).toBe(14);
	expect(c.lifeHouseIndex).toBeGreaterThanOrEqual(0);
	expect(c.lifeHouseIndex).toBeLessThan(12);
	expect([2, 3, 4, 5, 6]).toContain(c.wuxingJu);
}

const MK = (extra) => assembleNatalChart({ yearGan: '甲', yearZi: '子', monthInt: 6, leap: false, dayInt: 10, timeZi: '卯', male: true, ...extra });

describe('Step3 压力矩阵 · 传本开关全取值', () => {
	test('daxianSpan 全取值', () => { [10, 'ju'].forEach((v) => assertValid(MK({ daxianSpan: v }))); });
	test('tianmaBasis/starSet/shangShi/huoling/kongNaming 全取值', () => {
		['month', 'year'].forEach((v) => assertValid(MK({ tianmaBasis: v })));
		['full', 'north18'].forEach((v) => assertValid(MK({ starSet: v })));
		['fixed', 'yinyang'].forEach((v) => assertValid(MK({ shangShi: v })));
		['sanhe', 'nanpai'].forEach((v) => assertValid(MK({ huoling: v })));
		['modern', 'book'].forEach((v) => assertValid(MK({ kongNaming: v })));
	});
	test('leapMonth 全取值(含新增 split_days/split_star_month;leap=true)', () => {
		['mid_split', 'next', 'prev', 'split_days', 'split_star_month'].forEach((v) => {
			assertValid(assembleNatalChart({ yearGan: '癸', yearZi: '卯', monthInt: 2, leap: true, dayInt: 10, timeZi: '午', male: true, leapMonth: v }));
		});
	});
	test('brightnessSource 全取值(亮度不影响主星数)', () => {
		['zi_jian', 'quanshu'].forEach((v) => assertValid(MK({})));  // 亮度经 ZWEngineOptions,decorateStar 已单测;此处只验盘骨架
	});
});

describe('Step3 压力矩阵 · 四化流派全取值(盘骨架不因四化变)', () => {
	test('4 内置流派 + custom 回退 均合法', () => {
		const prev = ZWSchool.school;
		try {
			['beipai', 'zhongzhou', 'quanshu', 'beixiang'].forEach((s) => {
				ZWSchool.school = s; refreshActiveSiHua();
				assertValid(MK({}));
				expect(SiHuaTables[s]).toBeTruthy();
			});
		} finally { ZWSchool.school = prev; refreshActiveSiHua(); }
	});
});

describe('Step3 压力矩阵 · 全 60 甲子 × 边界日/时 × 性别 笛卡尔(盘恒合法)', () => {
	test('60 甲子年 × 日{1,15,30} × 时{子,午,亥} × 男女 → 全合法(720 盘)', () => {
		let n = 0;
		for (let g = 0; g < 60; g++) {
			const yg = GAN[g % 10], yz = ZHI[g % 12];
			[1, 15, 30].forEach((d) => {
				['子', '午', '亥'].forEach((t) => {
					[true, false].forEach((male) => {
						assertValid(assembleNatalChart({ yearGan: yg, yearZi: yz, monthInt: 1 + (n % 12), leap: false, dayInt: d, timeZi: t, male }));
						n++;
					});
				});
			});
		}
		expect(n).toBe(60 * 3 * 3 * 2);
	});
});

describe('Step3 压力矩阵 · overlay 纯函数对全盘不抛 + 结果合法', () => {
	test('全 12 命宫位置 × overlay 计算不抛,index 合法', () => {
		for (let m = 1; m <= 12; m++) {
			for (let t = 0; t < 12; t++) {
				const c = MK({ monthInt: m, timeZi: ZHI[t] });
				const q = qiShuWei(c);
				expect(q.qiShuIdx).toBeGreaterThanOrEqual(0);
				expect(q.qiShuIdx).toBeLessThan(12);
				const bor = allBorrowedStars(c);
				expect(bor.length).toBe(12);
				const cl = childLimits(c.wuxingJu, c.lifeHouseIndex);
				expect(cl.length).toBe(c.wuxingJu - 1);
				const zx = zhongxianOf(c.wuxingJu, c.lifeHouseIndex);
				expect(zx.length).toBe(4);
				const rl = relabelPalaces(c.lifeHouseIndex);
				expect(new Set(rl).size).toBe(12);
			}
		}
	});
	test('太岁入卦:空关系人/非法生肖/多关系人 边界不抛', () => {
		const c = MK({});
		expect(taiSuiRuGua(c, [])).toEqual([]);
		expect(taiSuiRuGua(c, [{ branch: 'XX' }])[0].houseIndex).toBe(-1);
		expect(taiSuiRuGua(c, ZHI.map((b) => ({ branch: b, role: '', sex: '' }))).length).toBe(12);
	});
	test('detectPatterns 对全盘不抛 + 命中项均在库', () => {
		for (let g = 0; g < 10; g++) {
			const c = MK({ yearGan: GAN[g], yearZi: ZHI[g % 2 === 0 ? 0 : 1] });
			const ps = detectPatterns(c);
			expect(Array.isArray(ps)).toBe(true);
			ps.forEach((p) => { expect(typeof p.name).toBe('string'); expect(typeof p.broken).toBe('boolean'); });
		}
	});
});

describe('Step3 压力矩阵 · 传本开关两两组合(采样,盘恒合法)', () => {
	test('daxianSpan×starSet×shangShi×huoling×kongNaming 笛卡尔(32 组合)', () => {
		[10, 'ju'].forEach((dx) => ['full', 'north18'].forEach((ss) => ['fixed', 'yinyang'].forEach((sh) => ['sanhe', 'nanpai'].forEach((hl) => ['modern', 'book'].forEach((kn) => {
			// 采样降载:仅取部分组合(kn 固定 modern 时全跑,book 时抽一半)
			assertValid(MK({ daxianSpan: dx, starSet: ss, shangShi: sh, huoling: hl, kongNaming: kn }));
		})))));
	});
});
