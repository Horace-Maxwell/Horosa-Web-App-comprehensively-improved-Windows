import { julianDayIndex } from '../julianDayIndex';

// 🔴 全年份域日序权威金标(真机根因):八字流日/紫微运限/演禽等旧用 JS Date.UTC(proleptic
// Gregorian)算 60 甲子日干支,1582 前(尤其 BC)与真实儒略历日序偏差数十日 → 日干支全错、
// 与主盘四柱跨面板矛盾。julianDayIndex 用儒略/格里 JDN(含 1582 切换),与后端 extreme_pillars
// 同轴。锚:2026-05-18=壬辰(idx28,八字/紫微流日同源)。
const TG = '甲乙丙丁戊己庚辛壬癸';
const DZ = '子丑寅卯辰巳午未申酉戌亥';
function gz(idx) { const i = ((idx % 60) + 60) % 60; return TG[i % 10] + DZ[i % 12]; }
function mod(n, m) { return ((n % m) + m) % m; }

const DAY_ANCHOR_IDX = 28; // 2026-05-18 = 壬辰
const DAY_OFFSET = mod(DAY_ANCHOR_IDX - julianDayIndex(2026, 5, 18), 60);
function dayGanzi(y, mo, d) { return gz(julianDayIndex(y, mo, d) + DAY_OFFSET); }

describe('julianDayIndex · 全年份域日序权威', () => {
	test('现代域(1582后)与旧 Date.UTC 日序相对差逐日等价 → 流日/运限零回归', () => {
		const aOld = Math.floor(Date.UTC(2026, 4, 18) / 86400000);
		const aNew = julianDayIndex(2026, 5, 18);
		const cases = [[2026, 7, 19], [2000, 1, 1], [1900, 1, 1], [1583, 1, 1], [2100, 12, 31]];
		cases.forEach(([y, mo, d]) => {
			const oldDiff = Math.floor(Date.UTC(y, mo - 1, d) / 86400000) - aOld;
			const newDiff = julianDayIndex(y, mo, d) - aNew;
			expect(newDiff).toBe(oldDiff);
		});
	});

	test('🔴 BC/极端年日干支 = 权威(儒略JDN,非 JS proleptic Gregorian)', () => {
		expect(dayGanzi(-12026, 7, 19)).toBe('己卯'); // 用户实测 BC(旧 Date.UTC 偏 28 位)
		expect(dayGanzi(-1, 12, 31)).toBe('丙子');    // 公元前1年岁末(干支连续锚,同 Java/演禽金标)
		expect(dayGanzi(1, 1, 1)).toBe('丁丑');       // 公元1年元旦(儒略 JDN1721424)
		expect(dayGanzi(2026, 7, 19)).toBe('甲午');   // 现代基线
		expect(dayGanzi(1984, 2, 2)).toBe('丙寅');    // 干支史锚
	});

	test('锚点 2026-05-18 = 壬辰(八字/紫微流日同源)', () => {
		expect(dayGanzi(2026, 5, 18)).toBe('壬辰');
	});
});
