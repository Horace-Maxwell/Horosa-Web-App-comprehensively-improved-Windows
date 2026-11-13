package spacex.astrostudy.helper;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.Test;

/**
 * 儒略日 → 日期的进程内记忆:键必须带全部入参,且不靠浮点数的字符串格式化(相邻两个儒略日不能撞键)。
 */
public class AstroHelperJdnDateMemoKeyTest {

	private static Map<String, Object> params(double jdn, String zone) {
		Map<String, Object> m = new HashMap<String, Object>();
		m.put("jdn", jdn);
		m.put("zone", zone);
		return m;
	}

	@Test
	public void sameInputsGiveTheSameKeyWhateverTheInsertionOrder() {
		Map<String, Object> a = new LinkedHashMap<String, Object>();
		a.put("jdn", 1721423.5);
		a.put("zone", "+08:00");
		Map<String, Object> b = new LinkedHashMap<String, Object>();
		b.put("zone", "+08:00");
		b.put("jdn", 1721423.5);
		assertEquals(AstroHelper.jdnDateMemoKey(a), AstroHelper.jdnDateMemoKey(b));
	}

	@Test
	public void everyInputIsPartOfTheKey() {
		String base = AstroHelper.jdnDateMemoKey(params(1721423.5, "+08:00"));
		assertNotEquals(base, AstroHelper.jdnDateMemoKey(params(1721423.5, "+00:00")));
		assertNotEquals(base, AstroHelper.jdnDateMemoKey(params(1721424.5, "+08:00")));
		Map<String, Object> more = params(1721423.5, "+08:00");
		more.put("ad", -1);
		assertNotEquals(base, AstroHelper.jdnDateMemoKey(more));
	}

	@Test
	public void neighbouringDoublesDoNotCollide() {
		double jd = 1721423.5;
		double next = Math.nextUp(jd);
		assertNotEquals(AstroHelper.jdnDateMemoKey(params(jd, "+08:00")), AstroHelper.jdnDateMemoKey(params(next, "+08:00")));
		// 一秒之差更不能撞
		assertNotEquals(AstroHelper.jdnDateMemoKey(params(jd, "+08:00")), AstroHelper.jdnDateMemoKey(params(jd + 1.0 / 86400.0, "+08:00")));
	}
}
