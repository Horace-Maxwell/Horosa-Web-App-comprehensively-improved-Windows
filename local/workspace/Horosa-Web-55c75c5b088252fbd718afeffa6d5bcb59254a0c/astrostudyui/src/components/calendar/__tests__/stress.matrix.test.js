// 黄历全功能穷举压力测试矩阵（精简版：穷举快选项空间 + 采样验证 lunar 逐日不变量）。
// 逐日精确正确性由各 golden 测试守；此处专攻「每选项每取值 + 组合 + 边界」的健壮性/取值域。
import { Solar } from 'lunar-javascript';
import { buildHuangliDay } from '../huangliDay';
import { buildHuangliSnapshotText } from '../huangliSnapshot';
import { buildYearAuspicious } from '../yearAuspicious';
import { EVENT_CATEGORIES } from '../tongshuData';
import { donggongDay } from '../tongshu/donggong';
import { DONGGONG_TABLE, DONGGONG_SANXING } from '../tongshu/donggongData';
import { dieshuOf } from '../tongshu/qimenDieShu';
import { QIMEN_GAN_NUM, QIMEN_ZHI_NUM } from '../tongshu/qimenData';
import { sanyuanLiexiuDay } from '../tongshu/sanyuanLiexiu';
import { SANYUAN_STARS } from '../tongshu/sanyuanData';
import { wutuMonth } from '../tongshu/wutu';
import { wuji, xuankongForHour, xuankongDay } from '../tongshu/xuankong';
import { LIUSHI_JIAZI_GUA } from '../tongshu/xuankongData';
import { personBazi, hehunPair, buildPersonalizedDates } from '../riziEngine';

const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const MONTHS = '正 二 三 四 五 六 七 八 九 十 十一 十二'.split(' ').map((m)=> m + '月');
const JIANCHU = '建除满平定执破危成收开闭'.split('');

describe('压测·老黄历 huangliDay（采样逐日 + 边界年）', () => {
	test('2026 每月 1/10/20/28 日 + 边界年结构完整不抛', () => {
		[2024, 2026, 2028].forEach((y)=>{
			for (let m = 1; m <= 12; m++) {
				[1, 10, 20, 28].forEach((d)=>{
					const day = buildHuangliDay(y, m, d);
					expect(Array.isArray(day.yi)).toBe(true);
					expect(day.jianchu.name.length).toBe(1);
					expect(['黄道', '黑道']).toContain(day.tianshen.type);
					expect(day.times.length).toBe(13);
					expect(day.yearGods.taisui).toBeTruthy();
				});
			}
		});
		expect(()=> buildHuangliDay(1900, 2, 28)).not.toThrow();
		expect(()=> buildHuangliDay(2100, 12, 31)).not.toThrow();
		expect(buildHuangliSnapshotText(buildHuangliDay(2100, 6, 1)).length).toBeGreaterThan(50);
	});
});

describe('压测·年度吉日榜（全 8 事项一次全扫 + 含丧葬）', () => {
	test('8 事项皆有序 + 命中宜 + 无破日', () => {
		const all = buildYearAuspicious(2026, { events: EVENT_CATEGORIES.map((c)=> c.key), topN: 20 });
		EVENT_CATEGORIES.forEach((cat)=>{
			const list = all[cat.key].list;
			for (let i = 1; i < list.length; i++) { expect(list[i].score).toBeLessThanOrEqual(list[i - 1].score); }
			list.forEach((d)=>{ expect(d.jianchu).not.toBe('破'); expect(d.reasons.some((x)=> x.text.indexOf('宜') === 0)).toBe(true); });
		});
		expect(buildYearAuspicious(2026, {}).burial).toBeUndefined();
	});
});

describe('压测·董公（144 断语全量 + 三吉星组 + 采样日）', () => {
	test('12月×12建除 = 144 断语齐 + 三吉星三组齐', () => {
		MONTHS.forEach((m)=> JIANCHU.forEach((jc)=>{ expect(DONGGONG_TABLE[m][jc].text.length).toBeGreaterThan(0); }));
		['孟', '仲', '季'].forEach((g)=> ['煞贡', '直星', '人专'].forEach((k)=>{ expect(Array.isArray(DONGGONG_SANXING[g][k])).toBe(true); }));
	});
	test('采样 24 日 donggongDay 合法（月序/三煞/verdict）', () => {
		for (let m = 1; m <= 12; m++) {
			[5, 20].forEach((d)=>{
				const r = donggongDay({ y: 2026, m, d });
				expect(r.text.length).toBeGreaterThan(0);
				expect(['good', 'bad', 'neutral']).toContain(r.verdict.level);
				expect(['东', '南', '西', '北']).toContain(r.sansha.dir);
			});
		}
	});
});

describe('压测·奇门叠数（全 10干×12支×12时支 = 1440 穷举）', () => {
	test('叠数域恒 13~27 + 吉凶表命中', () => {
		let combos = 0;
		TIANGAN.forEach((g)=> DIZHI.forEach((dz)=> DIZHI.forEach((hz)=>{
			const r = dieshuOf(g, dz, hz);
			expect(r.sum).toBe(QIMEN_GAN_NUM[g] + QIMEN_ZHI_NUM[dz] + QIMEN_ZHI_NUM[hz]);
			expect(r.sum >= 13 && r.sum <= 27).toBe(true);
			expect(['吉', '凶']).toContain(r.jx);
			combos++;
		})));
		expect(combos).toBe(1440);
	});
});

describe('压测·玄空（五吉 64 全矩阵 + 60甲子 + 12时辰 + 仙命采样）', () => {
	test('五吉 wuji 全配对合法', () => {
		[1, 2, 3, 4, 6, 7, 8, 9].forEach((a)=> [1, 2, 3, 4, 6, 7, 8, 9].forEach((b)=>{
			const r = wuji(a, b);
			expect(r === null || ['同旺', '生成', '合十', '生入', '克入'].includes(r)).toBe(true);
			if (a === b) { expect(r).toBe('同旺'); }
		}));
	});
	test('60甲子配卦全合法 + 12时辰 level + 8仙命不抛', () => {
		expect(Object.keys(LIUSHI_JIAZI_GUA).length).toBe(60);
		Object.values(LIUSHI_JIAZI_GUA).forEach((v)=>{ expect(v.wxNum >= 1 && v.wxNum <= 9 && v.wxNum !== 5).toBe(true); expect(v.yun >= 1 && v.yun <= 9).toBe(true); });
		DIZHI.forEach((hz)=>{ expect(['上上吉', '上吉', '吉', '平/不合', '凶']).toContain(xuankongForHour({ y: 2026, m: 7, d: 13, hourZhi: hz }, '甲子').level.name); });   // 凶=时对日退神(生出/克出)
		['甲子', '乙丑', '丙寅', '庚午', '壬申', '戊午', '癸亥', '己巳'].forEach((ming)=>{ expect(xuankongDay({ y: 2026, m: 7, d: 13 }, ming).ming.gua.length).toBeGreaterThanOrEqual(2); });
	});
});

describe('压测·乌兔（6农历月起日：太阳/太阴每9日 + 九星域）', () => {
	test('六个农历月太阳/太阴等差9 + 九星合法', () => {
		[[2026, 1, 20], [2026, 4, 10], [2026, 7, 13], [2026, 10, 5], [2027, 2, 1], [1983, 8, 15]].forEach(([y, m, d])=>{
			const M = wutuMonth({ y, m, d });
			[M.sunDays, M.moonDays].forEach((arr)=>{ for (let i = 1; i < arr.length; i++) { expect(arr[i].dayInMonth - arr[i - 1].dayInMonth).toBe(9); } });
			M.rows.forEach((r)=>{ expect(['太阳', '太阴', '木星', '金星', '水星', '土星', '孛星', '火星', '罗喉', '计都']).toContain(r.star); });
		});
	});
});

describe('压测·三垣（16曜齐 + 4用事类断语齐 + 天帝加临 + 采样不抛）', () => {
	test('16吉曜齐；4用事类均有曜可高亮；天帝加临命中；采样不抛', () => {
		expect(SANYUAN_STARS.length).toBe(16);
		// 每个用事类（建宅/安葬/修造/造命）都须有若干曜有断语可高亮，性别式「勾了没变」不复现。
		['建宅', '安葬', '修造', '造命'].forEach((k)=>{ expect(SANYUAN_STARS.filter((s)=> s[k]).length).toBeGreaterThanOrEqual(10); });
		// 每曜至少有释义或一个用事类断语（无全空壳曜；坟墓仅释义主丧葬亦可）。
		SANYUAN_STARS.forEach((s)=>{ expect(!!s.desc || ['建宅', '安葬', '修造', '造命'].some((k)=> s[k])).toBe(true); });
		expect(sanyuanLiexiuDay({ y: 2026, m: 6, d: 9 }).hitStars.some((s)=> s.name === '天帝')).toBe(true);
		[[2026, 1, 15], [2026, 6, 9], [2026, 12, 10], [2028, 8, 1]].forEach(([y, m, d])=>{ expect(()=> sanyuanLiexiuDay({ y, m, d })).not.toThrow(); });
	});
});

describe('压测·日子馆（合婚144全支组 + 性别 + 多命主 + 事项采样 + 边界）', () => {
	const A = personBazi({ date: '1988-06-01', time: '1988-06-01 10:00:00', gender: 0 });
	const B = personBazi({ date: '1990-08-08', time: '1990-08-08 08:00:00', gender: 1 });
	const CHONG = { 子: '午', 午: '子', 卯: '酉', 酉: '卯', 寅: '申', 申: '寅', 巳: '亥', 亥: '巳', 辰: '戌', 戌: '辰', 丑: '未', 未: '丑' };

	test('hehunPair 全 12×12 合法 + 冲对称', () => {
		const mk = (zhi)=> ({ yearZhi: zhi, yearGZ: '甲' + zhi, nayinYear: '', nayinYearWx: '木' });
		DIZHI.forEach((a)=> DIZHI.forEach((b)=>{
			const r = hehunPair(mk(a), mk(b));
			expect(['bad', 'good', 'neutral']).toContain(r.jx);
			expect(hehunPair(mk(b), mk(a)).chong).toBe(r.chong);
		}));
	});
	test('婚嫁/开工/安葬(单命主) + 婚嫁双命主：有序 + 冲本命淘汰', () => {
		const p1 = [{ role: 'self', name: 'A', gender: 0, bazi: A }];
		const p2 = [...p1, { role: 'spouse', name: 'B', gender: 1, bazi: B }];
		[['marriage', p1], ['start', p1], ['burial', p1], ['marriage', p2]].forEach(([event, persons])=>{
			const r = buildPersonalizedDates({ event, persons, year: 2026, topN: 12 });
			for (let i = 1; i < r.list.length; i++) { expect(r.list[i].score).toBeLessThanOrEqual(r.list[i - 1].score); }
			r.list.forEach((d)=>{ persons.forEach((p)=>{ expect(d.ganzhi[1]).not.toBe(CHONG[p.bazi.yearZhi]); }); });
		});
	});
	test('性别对婚嫁排名有效（男≠女）', () => {
		const m = buildPersonalizedDates({ event: 'marriage', persons: [{ role: 'self', name: 'M', gender: 1, bazi: A }], year: 2026, topN: 20 });
		const f = buildPersonalizedDates({ event: 'marriage', persons: [{ role: 'self', name: 'F', gender: 0, bazi: A }], year: 2026, topN: 20 });
		expect(JSON.stringify(m.list.map((x)=> x.score))).not.toBe(JSON.stringify(f.list.map((x)=> x.score)));
	});
	test('空/无bazi命主健壮不抛', () => {
		expect(()=> buildPersonalizedDates({ event: 'marriage', persons: [], year: 2026, topN: 10 })).not.toThrow();
		expect(()=> buildPersonalizedDates({ event: 'start', persons: [{ role: 'self', name: 'X', gender: 1, bazi: null }], year: 2026, topN: 10 })).not.toThrow();
	});
});
