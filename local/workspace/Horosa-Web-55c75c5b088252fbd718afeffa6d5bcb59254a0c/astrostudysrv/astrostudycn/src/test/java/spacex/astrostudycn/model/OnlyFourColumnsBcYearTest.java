package spacex.astrostudycn.model;

import java.util.Map;

import org.junit.Assert;
import org.junit.Test;

import spacex.astrostudycn.constants.BaZiGender;
import spacex.astrostudycn.constants.TimeZiAlg;

/**
 * 全年份域金标(Java 层):极端年份 × 四柱-农历链(OnlyFourColumns→BaZi.setup→节气窗定位)。
 * 年表=EXTREME_YEARS 单一真源(与 Python tests/test_year_domain_matrix.py、前端年表同表)。
 * 需本地 Python 计算服务(127.0.0.1:8899)在线——与 dev/CI 环境一致。
 */
public class OnlyFourColumnsBcYearTest {

	// EXTREME_YEARS:域边界/五位年界/0 年进位/窗口错位实证对/儒略切换/干支史锚/位数变化/基线
	static final int[][] EXTREME_YEARS = {
		{-1, 12998}, {-1, 12000}, {-1, 8025}, {-1, 7040}, {-1, 7039}, {-1, 3044}, {-1, 3040},
		{-1, 2960}, {-1, 1000}, {-1, 722}, {-1, 100}, {-1, 10}, {-1, 2}, {-1, 1},
		{1, 1}, {1, 2}, {1, 4}, {1, 674}, {1, 675}, {1, 1582}, {1, 1600}, {1, 1984},
		{1, 2026}, {1, 3003}, {1, 4649}, {1, 4650}, {1, 7308}, {1, 9999}, {1, 10000},
		{1, 12000}, {1, 16500}, {1, 16798},
	};

	private static final String STEMS = "甲乙丙丁戊己庚辛壬癸";
	private static final String BRANCHES = "子丑寅卯辰巳午未申酉戌亥";

	private void assertGanzhi(String label, Object gz) {
		Assert.assertNotNull(label + " null", gz);
		String s = String.valueOf(gz);
		Assert.assertTrue(label + " malformed: " + s, s.length() >= 2
				&& STEMS.indexOf(s.charAt(0)) >= 0 && BRANCHES.indexOf(s.charAt(1)) >= 0);
	}

	@Test
	public void extremeYearsMatrix() {
		StringBuilder failures = new StringBuilder();
		for (int[] ay : EXTREME_YEARS) {
			int ad = ay[0];
			int y = ay[1];
			String birth = String.format("%s%04d-07-19 10:30:00", ad < 0 ? "-" : "", y);
			try {
				OnlyFourColumns bz = new OnlyFourColumns(ad, birth, "+08:00", "119e19", "26n04",
						true, BaZiGender.Male, TimeZiAlg.RealSun, false, true);
				Map<String, Object> nongli = bz.getNongli();
				Assert.assertNotNull(birth + " nongli null", nongli);
				Object bazi = nongli.get("bazi");
				Assert.assertNotNull(birth + " bazi null", bazi);
				spacex.astrostudy.model.FourColumns fc = (spacex.astrostudy.model.FourColumns) bazi;
				assertGanzhi(birth + " year", fc.year == null ? null : fc.year.ganzi);
				assertGanzhi(birth + " month", fc.month == null ? null : fc.month.ganzi);
				assertGanzhi(birth + " day", fc.day == null ? null : fc.day.ganzi);
			} catch (Throwable t) {
				failures.append(birth).append(" -> ").append(t).append('\n');
			}
		}
		if (failures.length() > 0) {
			Assert.fail("extreme-year failures:\n" + failures);
		}
	}

	/**
	 * 日柱连续性锚(具体值金标):干支纪日 60 循环古今连续、无历法争议,
	 * 真值口径 = 儒略日数 JDN(显示年,<1582-10-15 儒略历)+49 mod 60(锚:AD1-01-01 儒略=丁丑=JDN 1721424)。
	 * 覆盖:域两顶点(BC12998/AD16798)+ 公元 0 界两侧(BC1/AD1)+ 现代锚(sxtwl/共享件同值)。
	 */
	@Test
	public void dayPillarContinuityAnchors() {
		Object[][] anchors = {
			{1, "2026-07-19 10:00:00", "甲午"},
			{1, "1984-02-02 10:00:00", "丙寅"},
			{1, "0001-01-01 10:00:00", "丁丑"},
			{-1, "-0001-12-31 10:00:00", "丙子"},
			{-1, "-12998-12-29 10:00:00", "己未"},
			{1, "16798-06-15 10:00:00", "壬寅"},
		};
		StringBuilder failures = new StringBuilder();
		for (Object[] a : anchors) {
			int ad = (Integer) a[0];
			String birth = (String) a[1];
			String expect = (String) a[2];
			try {
				String got = spacex.astrostudy.helper.BaZiHelper.getDayGanziStr(ad, birth, "+08:00", false, true);
				if (!expect.equals(got)) {
					failures.append(birth).append(" expect ").append(expect).append(" got ").append(got).append('\n');
				}
			} catch (Throwable t) {
				failures.append(birth).append(" -> ").append(t).append('\n');
			}
		}
		if (failures.length() > 0) {
			Assert.fail("day-pillar anchor failures:\n" + failures);
		}
	}
}
