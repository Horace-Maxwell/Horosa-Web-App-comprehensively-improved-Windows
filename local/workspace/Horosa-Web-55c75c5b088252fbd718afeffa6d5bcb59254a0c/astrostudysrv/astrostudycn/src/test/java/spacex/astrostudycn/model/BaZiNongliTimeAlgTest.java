package spacex.astrostudycn.model;

import java.util.Map;

import org.junit.Assert;
import org.junit.Test;

import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudycn.constants.TimeZiAlg;

/**
 * 八字类附带的农历日期 / 节后天数 / 人元司令随所选时间算法取基准时刻(与四柱同一口径):
 * 真太阳时不变;直接时间取钟表时刻;平太阳时取「钟表时刻 + 经度时差」。
 * 标为「真太阳时」的一行(nongli.birth / solarTime)仍给真太阳时。
 * 需本地 Python 计算服务(127.0.0.1:8899)在线。
 */
public class BaZiNongliTimeAlgTest {

	private static Map<String, Object> nongli(TimeZiAlg alg) {
		BaZiDirect bz = new BaZiDirect(1, "1976-07-06 00:10:00", "+08:00", "118e27", "31n38", alg, false, "年日", true, true, false, true);
		bz.calculate(PhaseType.HuoTu);
		return bz.getNongli();
	}

	@Test
	public void lunarDateFollowsTheSelectedTimeAlgorithm() {
		// 真太阳时 = 1976-07-05 23:59:14 → 六月初九;钟表时刻 / 平太阳时(00:03:48)都在 7 月 6 日 → 六月初十
		Map<String, Object> real = nongli(TimeZiAlg.RealSun);
		Map<String, Object> direct = nongli(TimeZiAlg.DirectTime);
		Map<String, Object> mean = nongli(TimeZiAlg.LocalMao);
		Assert.assertEquals(6, ((Number) real.get("monthInt")).intValue());
		Assert.assertEquals(9, ((Number) real.get("dayInt")).intValue());
		Assert.assertEquals(10, ((Number) direct.get("dayInt")).intValue());
		Assert.assertEquals(10, ((Number) mean.get("dayInt")).intValue());
		Assert.assertEquals(6, ((Number) direct.get("monthInt")).intValue());
	}

	@Test
	public void trueSolarRowKeepsTrueSolarTime() {
		for (TimeZiAlg alg : new TimeZiAlg[] {TimeZiAlg.RealSun, TimeZiAlg.DirectTime, TimeZiAlg.LocalMao}) {
			Map<String, Object> n = nongli(alg);
			Assert.assertEquals(alg.toString(), "1976-07-05 23:59:14", n.get("birth"));
			Assert.assertEquals(alg.toString(), "1976-07-05 23:59:14", n.get("solarTime"));
			Assert.assertEquals(alg.toString(), "1976-07-06 00:10:00", n.get("clockTime"));
		}
	}
}
