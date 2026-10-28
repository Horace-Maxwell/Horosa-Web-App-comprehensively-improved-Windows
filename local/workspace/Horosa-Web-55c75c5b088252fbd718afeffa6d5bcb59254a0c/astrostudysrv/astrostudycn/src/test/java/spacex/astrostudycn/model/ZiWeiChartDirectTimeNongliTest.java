package spacex.astrostudycn.model;

import org.junit.Assert;
import org.junit.Test;

import boundless.utility.JsonUtility;
import spacex.astrostudy.helper.NongliHelper;
import spacex.astrostudycn.constants.BaZiGender;
import spacex.astrostudycn.constants.TimeZiAlg;

/**
 * 紫微盘的农历基准随时间算法取:直接时间 = 钟表时刻(NongliHelper 直接时间口径),
 * 真太阳时 = 按出生地经度校正。经度远离时区中央经线时两者时辰不同,用来区分口径。
 * 需本地 Python 计算服务(127.0.0.1:8899)在线。
 */
public class ZiWeiChartDirectTimeNongliTest {

	private static final String BIRTH = "1976-07-06 00:10:00";
	private static final String ZONE = "+08:00";
	private static final String LON = "87e36";
	private static final String LAT = "43n48";

	private static ZiWeiChart chart(TimeZiAlg alg, boolean lateZiHourUseNextDay) {
		return new ZiWeiChart(1, BaZiGender.Male, BIRTH, ZONE, LON, LAT, false, null, alg, false, lateZiHourUseNextDay);
	}

	@Test
	public void directTimeChartUsesClockTimeNongli() {
		for (boolean lateZi : new boolean[] {true, false}) {
			String expected = JsonUtility.encode(NongliHelper.getNongLi(1, BIRTH, ZONE, LON, false, true, lateZi));
			Assert.assertEquals("lateZiHourUseNextDay=" + lateZi, expected, JsonUtility.encode(chart(TimeZiAlg.DirectTime, lateZi).nongli));
		}
	}

	@Test
	public void realSunChartKeepsLongitudeCorrectedNongli() {
		String expected = JsonUtility.encode(NongliHelper.getNongLi(1, BIRTH, ZONE, LON, false, false, true));
		ZiWeiChart real = chart(TimeZiAlg.RealSun, true);
		Assert.assertEquals(expected, JsonUtility.encode(real.nongli));
		Assert.assertNotEquals("经度远离中央经线时,真太阳时与钟表时刻的时辰应不同", real.nongli.time, chart(TimeZiAlg.DirectTime, true).nongli.time);
	}
}
