import { getDayGanZhi, getOnlyDateNum } from '../localNongliAdapter';

// 🔴 远程农历桥日柱权威金标(真机根因:神数正传铁板 BC12026 日柱显示辛亥,应己卯)。
// getOnlyDateNum 此前只有格里公式(-32045),缺 1582-10-15 儒略切换 → 1582 前(尤其 BC)日序偏差
// 数十日、日柱错;所有走远程桥的域外技法(一掌经/河洛/参评/神数正传/canping/heluo)日柱均受累。
// 修复后与后端 extreme_pillars/_jdn 逐日同轴。getDayGanZhi 入参为天文年(公元前为负、无 0 年前置)。
describe('localNongliAdapter · 远程桥日柱 BC 权威(儒略/格里 JDN)', () => {
	test('🔴 BC/极端年日柱 = 权威(含 1582 儒略切换)', () => {
		// 天文年:显示年 BC12026 = 天文年 -12025
		expect(getDayGanZhi(-12025, 7, 19)).toBe('己卯'); // 用户实测(旧格里公式得辛亥,偏)
		expect(getDayGanZhi(0, 12, 31)).toBe('丙子');      // 公元前1年岁末(天文年0;干支连续锚)
		expect(getDayGanZhi(1, 1, 1)).toBe('丁丑');        // 公元1年元旦(儒略 JDN1721424)
		expect(getDayGanZhi(2026, 7, 19)).toBe('甲午');    // 现代基线(零回归)
		expect(getDayGanZhi(1984, 2, 2)).toBe('丙寅');     // 干支史锚
	});

	test('1582-10 儒略/格里切换边界:15 日为格里首日(连续无缺日)', () => {
		// 儒略 1582-10-04 与格里 1582-10-15 相邻(中间 10 日不存在);JDN 连续,日柱逐日递进。
		const jdn04 = getOnlyDateNum(1582, 10, 4);
		const jdn15 = getOnlyDateNum(1582, 10, 15);
		expect(jdn15 - jdn04).toBe(1); // 切换后紧邻,JDN 差 1(历史真实)
	});
});
