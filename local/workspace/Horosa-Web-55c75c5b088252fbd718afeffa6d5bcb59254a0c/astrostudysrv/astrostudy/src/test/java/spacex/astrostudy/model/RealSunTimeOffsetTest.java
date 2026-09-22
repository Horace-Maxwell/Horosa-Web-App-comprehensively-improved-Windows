package spacex.astrostudy.model;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/**
 * [Q-195/T-121] 均时差 NOAA/Meeus 级数金标:独立天文年历锚点(非与前端同式自证)。
 */
public class RealSunTimeOffsetTest {

	/** Meeus《天文算法》例 28.a:1992-10-13 0h → E = +13m42.6s(13.71 min)。 */
	@Test
	public void meeusExample28a() {
		double eot = RealSunTimeOffset.equationOfTimeMinutes(2448908.5);
		assertEquals(13.71, eot, 0.05);
	}

	/** 年历极值:11 月 3 日前后 ≈ +16.4 min;2 月 11 日前后 ≈ −14.2 min;4 月 15 / 6 月 13 / 9 月 1 / 12 月 25 前后过零。 */
	@Test
	public void almanacExtremaAndZeros() {
		assertEquals(16.4, RealSunTimeOffset.equationOfTimeMinutes(2461348.0), 0.3);   // 2026-11-03 12h UT
		assertEquals(-14.2, RealSunTimeOffset.equationOfTimeMinutes(2461083.0), 0.3);  // 2026-02-11 12h UT
		assertTrue(Math.abs(RealSunTimeOffset.equationOfTimeMinutes(2461146.0)) < 0.6); // 2026-04-15
		assertTrue(Math.abs(RealSunTimeOffset.equationOfTimeMinutes(2461205.0)) < 0.6); // 2026-06-13
		assertTrue(Math.abs(RealSunTimeOffset.equationOfTimeMinutes(2461400.0)) < 0.6); // 2026-12-25
	}

	/** 偏移 = 经度时差 + 均时差:120°E 在 +08:00 下经度时差 0;分钟时区(+05:30)折算基准经度 82.5°。 */
	@Test
	public void offsetComposition() {
		int sec = RealSunTimeOffset.getOffsetByDate("1992-10-13 00:00:00", "+00:00", "0e00");
		assertEquals(823, sec, 3);
		assertEquals(0, RealSunTimeOffset.getMeanSolarOffset("+08:00", "120e00"));
		assertEquals(82.5, RealSunTimeOffset.getBaseLonByZone("+05:30"), 1e-9);
		assertEquals(-300.0, RealSunTimeOffset.getBaseLonByZone("-20:00"), 1e-9);
		// 116°E 北京在 +08:00:经度时差 −16 min = −960 s;真太阳时 = −960 + EoT
		int mean = RealSunTimeOffset.getMeanSolarOffset("+08:00", "116e00");
		assertEquals(-960, mean);
		int real = RealSunTimeOffset.getOffsetByDate("2026-11-03 12:00:00", "+08:00", "116e00");
		assertEquals(-960 + 16.4 * 60, real, 20);
	}
}
