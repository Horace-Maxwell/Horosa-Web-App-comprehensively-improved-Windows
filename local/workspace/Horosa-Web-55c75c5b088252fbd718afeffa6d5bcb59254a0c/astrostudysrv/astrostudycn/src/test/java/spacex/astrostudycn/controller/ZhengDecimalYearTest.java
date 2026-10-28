package spacex.astrostudycn.controller;

import org.junit.Assert;
import org.junit.Test;

/**
 * 郑氏岁差的十进制年按天文年:公元前 300 年 = -299(历史纪年当天文年会偏一年、约 50″);缺日期报错不回落 2000 年。
 * 公元年与旧写法逐值相同。不需要 Python 计算服务。
 */
public class ZhengDecimalYearTest {

	private static double legacy(int year, int month, int day) {
		return year + ((month - 1) * 30.4375 + (day - 1)) / 365.25;
	}

	@Test
	public void bcYearsAreAstronomical() {
		Assert.assertEquals(-299.0, ChartController.zhengDecimalYear("-300/01/01", 1), 1e-12);
		Assert.assertEquals(-299.0, ChartController.zhengDecimalYear("300/01/01", -1), 1e-12);
		Assert.assertEquals(0.0, ChartController.zhengDecimalYear("-0001-01-01", 1), 1e-12);
	}

	@Test
	public void adYearsUnchanged() {
		Assert.assertEquals(legacy(1990, 5, 18), ChartController.zhengDecimalYear("1990/05/18", 1), 0.0);
		Assert.assertEquals(legacy(12000, 1, 1), ChartController.zhengDecimalYear("12000-01-01", 1), 0.0);
	}

	@Test(expected = IllegalArgumentException.class)
	public void missingDateIsAnError() {
		ChartController.zhengDecimalYear("", 1);
	}
}
