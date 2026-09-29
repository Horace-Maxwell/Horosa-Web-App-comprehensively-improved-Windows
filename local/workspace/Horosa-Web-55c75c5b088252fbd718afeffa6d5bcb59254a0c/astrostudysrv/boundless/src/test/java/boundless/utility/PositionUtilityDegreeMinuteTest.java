package boundless.utility;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

/**
 * 「度 + 方位字母 + 分」经纬度串解析:度 + 分 / 60(与前端本地排盘、计算服务同口径)。
 * 此前误作「度 + 1 / 分」:118e27 → 118.037°,真太阳时 / 平太阳时偏移最多差约 4 分钟。
 */
public class PositionUtilityDegreeMinuteTest {

	@Test
	public void longitude() {
		assertEquals(118.45, PositionUtility.convertLonStrToDegree("118e27"), 1e-9);
		assertEquals(87.6, PositionUtility.convertLonStrToDegree("87e36"), 1e-9);
		assertEquals(120 + 1 / 60.0, PositionUtility.convertLonStrToDegree("120e01"), 1e-9);
		assertEquals(120 + 5 / 60.0, PositionUtility.convertLonStrToDegree("120e5"), 1e-9);
		assertEquals(29 / 60.0, PositionUtility.convertLonStrToDegree("0e29"), 1e-9);
		assertEquals(-74.0, PositionUtility.convertLonStrToDegree("74w00"), 1e-9);
		assertEquals(-(2 + 21 / 60.0), PositionUtility.convertLonStrToDegree("2w21"), 1e-9);
		assertEquals(108.9, PositionUtility.convertLonStrToDegree("108.9"), 1e-9);
	}

	@Test
	public void latitude() {
		assertEquals(31 + 38 / 60.0, PositionUtility.convertLatStrToDegree("31n38"), 1e-9);
		assertEquals(45.75, PositionUtility.convertLatStrToDegree("45n45"), 1e-9);
		assertEquals(-(33 + 52 / 60.0), PositionUtility.convertLatStrToDegree("33s52"), 1e-9);
	}

	@Test
	public void roundTripWithFormatter() {
		for (double d : new double[] {118.45, 87.6, 120 + 5 / 60.0, -74.5, 29 / 60.0}) {
			assertEquals(d, PositionUtility.convertLonStrToDegree(PositionUtility.convertLonToStr(d)), 1e-9);
		}
	}
}
