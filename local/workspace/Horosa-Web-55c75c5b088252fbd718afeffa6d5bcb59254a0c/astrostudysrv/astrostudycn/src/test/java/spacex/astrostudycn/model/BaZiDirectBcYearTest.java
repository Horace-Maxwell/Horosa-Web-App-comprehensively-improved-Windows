package spacex.astrostudycn.model;

import org.junit.Assert;
import org.junit.Test;

import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudycn.constants.TimeZiAlg;

/**
 * 全年份域金标(Java 层·大运/流年 direction 链):BaZiDirect.calculate → forwardDirect/backwardDirect
 * 循环靠 JdnHelper.getDateFromJdn(BC/1582 前走 Python :8899 /jdn/date 回调)→ DateTimeUtility.getDateTimeParts。
 * 真机症:极端年份八字「大运/流年」两列内容空 = 后端 direction 数组返回空(calculate 抛异常被 boundless 吞)。
 * 断言:direction 非空(9 大运)、smallDirection 非空、subDirect 干支合法。需 127.0.0.1:8899 在线。
 */
public class BaZiDirectBcYearTest {

	// 复用 OnlyFourColumnsBcYearTest 的 EXTREME_YEARS 口径(direction 只需抽样代表:域两端/窗口错位/0 年界/基线)
	static final int[][] YEARS = {
		{1, 2026}, {-1, 7040}, {-1, 3040}, {-1, 1}, {1, 1}, {1, 1582}, {1, 9999}, {1, 12000}, {-1, 12998}, {1, 16798},
	};

	private static final String STEMS = "甲乙丙丁戊己庚辛壬癸";
	private static final String BRANCHES = "子丑寅卯辰巳午未申酉戌亥";

	private void assertGanzhi(String label, String s) {
		Assert.assertTrue(label + " malformed: " + s, s != null && s.length() >= 2
				&& STEMS.indexOf(s.charAt(0)) >= 0 && BRANCHES.indexOf(s.charAt(1)) >= 0);
	}

	@Test
	public void directionMatrix() {
		StringBuilder failures = new StringBuilder();
		for (int[] ay : YEARS) {
			int ad = ay[0];
			int y = ay[1];
			String birth = String.format("%s%04d-07-19 10:30:00", ad < 0 ? "-" : "", y);
			try {
				BaZiDirect bz = new BaZiDirect(ad, birth, "+08:00", "119e19", "26n04",
						TimeZiAlg.RealSun, false, "日", false, true, true, true);
				bz.calculate(PhaseType.HuoTu);
				if (bz.direction == null || bz.direction.length == 0) {
					failures.append(birth).append(" -> direction EMPTY (len=")
							.append(bz.direction == null ? "null" : bz.direction.length).append(")\n");
					continue;
				}
				if (bz.smallDirection == null || bz.smallDirection.length == 0) {
					failures.append(birth).append(" -> smallDirection EMPTY\n");
					continue;
				}
				FateDirect first = bz.direction[0];
				assertGanzhi(birth + " dir0.maindir", first.mainDirect == null ? null : first.mainDirect.ganzi);
				assertGanzhi(birth + " dir0.sub0", first.subDirect[0] == null ? null : first.subDirect[0].ganzi);
			} catch (Throwable t) {
				failures.append(birth).append(" -> ").append(t).append('\n');
			}
		}
		if (failures.length() > 0) {
			Assert.fail("bazi-direct extreme-year failures:\n" + failures);
		}
	}
}
