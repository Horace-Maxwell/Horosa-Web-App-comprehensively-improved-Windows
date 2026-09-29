package spacex.astrostudycn.model;

import org.junit.Assert;
import org.junit.Test;

import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudy.model.FourColumns;
import spacex.astrostudycn.constants.TimeZiAlg;

/**
 * 南半球月令:缺省不对冲(与八字主盘同口径);显式「对冲」才把月支换成对冲之支、按年干重起月干(仅南纬生效)。
 * 需本地 Python 计算服务(127.0.0.1:8899)在线。
 */
public class BaZiSouthMonthTest {

	private static String yearMonth(String lat, String lon, String zone, boolean flip) {
		BaZiDirect bz = new BaZiDirect(1, "1990-05-18 10:00:00", zone, lon, lat, TimeZiAlg.DirectTime, false, "年日", true, true, false, true);
		bz.setSouthMonthFlip(flip);
		bz.calculate(PhaseType.HuoTu);
		FourColumns fc = bz.getFourColums();
		return fc.year.ganzi + fc.month.ganzi;
	}

	@Test
	public void southDefaultsToNoFlip() {
		Assert.assertEquals("庚午辛巳", yearMonth("33s52", "151e12", "+10:00", false));
	}

	@Test
	public void southFlipWhenRequested() {
		Assert.assertEquals("庚午丁亥", yearMonth("33s52", "151e12", "+10:00", true));
	}

	@Test
	public void northUnaffectedByFlip() {
		Assert.assertEquals("庚午辛巳", yearMonth("31n38", "118e27", "+08:00", true));
	}
}
