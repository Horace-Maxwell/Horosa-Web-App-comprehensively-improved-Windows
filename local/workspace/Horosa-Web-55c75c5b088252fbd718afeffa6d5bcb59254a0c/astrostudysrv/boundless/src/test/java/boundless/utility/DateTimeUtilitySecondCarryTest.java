package boundless.utility;

import org.junit.Assert;
import org.junit.Test;

/**
 * 儒略日换回「日期 时间」串时,秒四舍五入到 60 要逐级进位(秒→分→时→日):
 * 此前输出 xx:xx:60,且整点时按字符串取「小时」判时辰会读成前一小时。只有原本出 :60 的时刻会变。
 */
public class DateTimeUtilitySecondCarryTest {

	@Test
	public void clockTimeRoundTripsExactly() {
		// 此前约 1% 的整秒钟表时刻往返后变成 :60,例 00:01:00 → 00:00:60
		for (String z : new String[] {"+08:00", "-08:00", "+05:30"}) {
			for (int s = 0; s < 86400; s += 7) {
				String t = String.format("1990-05-18 %02d:%02d:%02d", s / 3600, (s / 60) % 60, s % 60);
				String back = DateTimeUtility.getDateFromJdn(DateTimeUtility.getDateNum(t, z), z, null);
				Assert.assertEquals(z, t, back);
			}
		}
		Assert.assertEquals("1990-05-18 00:01:00", DateTimeUtility.getDateFromJdn(DateTimeUtility.getDateNum("1990-05-18 00:01:00", "+08:00"), "+08:00", null));
	}

	@Test
	public void roundingCarriesIntoHourAndNextDay() {
		// 洛杉矶例:真太阳时正好 01:00:00(差零点几秒)曾显示 00:59:60 → 判成子时
		double oneAm = DateTimeUtility.getDateNum("1990-12-07 00:59:59", "-08:00") + 0.6 / 86400.0;
		Assert.assertEquals("1990-12-07 01:00:00", DateTimeUtility.getDateFromJdn(oneAm, "-08:00", null));
		// 进到 24:00:00 时日期同步进一天(曾显示 1965-11-19 23:59:60)
		double midnight = DateTimeUtility.getDateNum("1965-11-19 23:59:59", "+08:00") + 0.7 / 86400.0;
		Assert.assertEquals("1965-11-20 00:00:00", DateTimeUtility.getDateFromJdn(midnight, "+08:00", null));
		// 不足半秒照旧舍去
		double below = DateTimeUtility.getDateNum("1965-11-19 23:59:59", "+08:00") + 0.3 / 86400.0;
		Assert.assertEquals("1965-11-19 23:59:59", DateTimeUtility.getDateFromJdn(below, "+08:00", null));
	}

	@Test
	public void timePartsCarryButTotalSecondsUnchanged() {
		double almostOneHour = (3600 - 0.3) / 86400.0;
		Assert.assertArrayEquals(new int[] {0, 1, 0, 0}, DateTimeUtility.getTimePartsFromJdnTime(almostOneHour));
		Assert.assertEquals("01:00:00", DateTimeUtility.getTimeFromJdnTime(almostOneHour));
		Assert.assertEquals(3600L, DateTimeUtility.getTotalSecondsFromJdnTime(almostOneHour));
		double almostOneDay = 1.0 - 0.2 / 86400.0;
		Assert.assertArrayEquals(new int[] {1, 0, 0, 0}, DateTimeUtility.getTimePartsFromJdnTime(almostOneDay));
		Assert.assertEquals(86400L, DateTimeUtility.getTotalSecondsFromJdnTime(almostOneDay));
		// 起运用的节前 / 节后秒数(时长,几天到一个多月)与进位前逐值相同
		double span = 12.0 + (3600 * 5 - 0.4) / 86400.0;
		Assert.assertEquals(12L * 86400 + 5 * 3600, DateTimeUtility.getTotalSecondsFromJdnTime(span));
	}
}
