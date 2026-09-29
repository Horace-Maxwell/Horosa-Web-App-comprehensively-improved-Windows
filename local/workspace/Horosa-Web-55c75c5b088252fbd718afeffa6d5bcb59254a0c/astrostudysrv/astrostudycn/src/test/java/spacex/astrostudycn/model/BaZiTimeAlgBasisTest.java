package spacex.astrostudycn.model;

import java.util.Map;

import org.junit.Assert;
import org.junit.Test;

import boundless.utility.JsonUtility;
import spacex.astrostudy.constants.PhaseType;
import spacex.astrostudy.model.FourColumns;
import spacex.astrostudycn.constants.TimeZiAlg;

/**
 * 八字时间算法口径:
 * ① 「直接时间」采用所填钟表时刻,不做任何时刻换算 —— 年柱、月柱与交节距离也按钟表时刻取(与帮助文档、本地引擎同口径);
 * ② 「春分定卯时」尚无独立换算,结果与「直接时间」逐字节相同;
 * ③ 真太阳时 / 平太阳时照旧按各自偏移换算。
 * 需本地 Python 计算服务(127.0.0.1:8899)在线。
 */
public class BaZiTimeAlgBasisTest {

	private static final String ZONE = "+08:00";
	private static final String LON = "118e27";
	private static final String LAT = "31n38";

	private static BaZiDirect direct(String birth, TimeZiAlg alg) {
		BaZiDirect bz = new BaZiDirect(1, birth, ZONE, LON, LAT, alg, false, "年日", true, true, false, true);
		bz.calculate(PhaseType.HuoTu);
		return bz;
	}

	private static String pillars(BaZi bz) {
		FourColumns fc = bz.getFourColums();
		return fc.year.ganzi + fc.month.ganzi + fc.day.ganzi + fc.time.ganzi;
	}

	@Test
	public void springMaoCalculatesAsDirectTime() {
		Assert.assertSame(TimeZiAlg.DirectTime, TimeZiAlg.SpringMao.calcBasis());
		Assert.assertSame(TimeZiAlg.DirectTime, TimeZiAlg.fromCode(2).calcBasis());
		for (TimeZiAlg a : new TimeZiAlg[] {TimeZiAlg.RealSun, TimeZiAlg.DirectTime, TimeZiAlg.LocalMao}) {
			Assert.assertSame(a, a.calcBasis());
		}
	}

	// 子时至申时各取一例(曾按平移后的时刻判换日:日柱前错一天、时柱落到别的时辰)+ 酉时、晚子时
	@Test
	public void springMaoOutputEqualsDirectTimeByteForByte() {
		String[] births = {
			"1990-05-18 00:30:00", "1990-05-18 03:00:00", "1990-05-18 09:00:00",
			"1990-05-18 16:30:00", "1990-05-18 17:30:00", "1990-05-18 23:30:00",
		};
		for (String b : births) {
			Assert.assertEquals(b, JsonUtility.encode(direct(b, TimeZiAlg.DirectTime)), JsonUtility.encode(direct(b, TimeZiAlg.SpringMao)));
		}
		Assert.assertEquals("庚午辛巳癸未丁巳", pillars(direct("1990-05-18 09:00:00", TimeZiAlg.SpringMao)));
		Assert.assertEquals("庚午辛巳癸未甲寅", pillars(direct("1990-05-18 03:00:00", TimeZiAlg.SpringMao)));
	}

	@Test
	public void directTimeUsesClockTimeWithoutOffset() {
		Map<String, Object> m = JsonUtility.toDictionary(JsonUtility.encode(direct("1990-05-18 09:00:00", TimeZiAlg.DirectTime)));
		Assert.assertEquals(0, ((Number) m.get("timeOffset")).intValue());
		Assert.assertEquals(0.0, ((Number) m.get("timeOffsetJDN")).doubleValue(), 0.0);
		// 立夏(1990-05-06 02:35)后 25 分钟:按钟表时刻已交节 → 辛巳月(曾把出生时刻前移到交节前,节气窗不够而报错)
		Assert.assertEquals("庚午辛巳辛未庚寅", pillars(direct("1990-05-06 03:00:00", TimeZiAlg.DirectTime)));
		Assert.assertEquals("庚午辛巳辛未庚寅", pillars(direct("1990-05-06 03:00:00", TimeZiAlg.SpringMao)));
		// 立春(2024-02-04 16:26)后:甲辰年丙寅月
		Assert.assertEquals("甲辰丙寅戊戌辛酉", pillars(direct("2024-02-04 17:00:00", TimeZiAlg.DirectTime)));
		// 六壬 / 四柱农历同一口径
		LiuReng lr = new LiuReng(1, "1990-05-06 03:00:00", ZONE, LON, LAT, TimeZiAlg.SpringMao, false, "日", true, true);
		lr.calculate(PhaseType.ShuiTu);
		Assert.assertEquals("庚午辛巳辛未庚寅", pillars(lr));
		OnlyFourColumns of = new OnlyFourColumns(1, "1990-05-06 03:00:00", ZONE, LON, LAT, true, spacex.astrostudycn.constants.BaZiGender.Male, TimeZiAlg.DirectTime, false, true);
		FourColumns fc = (FourColumns) of.getNongli().get("bazi");
		Assert.assertEquals("庚午辛巳辛未庚寅", fc.year.ganzi + fc.month.ganzi + fc.day.ganzi + fc.time.ganzi);
	}

	@Test
	public void solarTimeAlgorithmsKeepTheirOffsets() {
		// 真太阳时(约 −4 分)/ 平太阳时(约 −8 分):03:00 换算后落丑时
		Assert.assertEquals("庚午辛巳癸未癸丑", pillars(direct("1990-05-18 03:00:00", TimeZiAlg.RealSun)));
		Assert.assertEquals("庚午辛巳癸未癸丑", pillars(direct("1990-05-18 03:00:00", TimeZiAlg.LocalMao)));
		Map<String, Object> m = JsonUtility.toDictionary(JsonUtility.encode(direct("1990-05-18 09:00:00", TimeZiAlg.RealSun)));
		Assert.assertTrue(((Number) m.get("timeOffset")).intValue() != 0);
	}
}
